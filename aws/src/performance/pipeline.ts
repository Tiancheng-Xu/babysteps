import { z } from "zod";

const performanceCategories = [
	"fetch",
	"xhr",
	"script",
	"stylesheet",
	"image",
	"font",
	"type_error",
	"network",
	"timeout",
	"user_rejected",
	"unknown",
] as const;

const performanceOutcomes = ["success", "failure", "unavailable"] as const;

const web3OperationNames = [
	"contract.read",
	"contract.write",
	"web3.uniswap.quote",
	"web3.uniswap.swap",
	"web3.privy.login",
	"wallet.connect",
	"auth.challenge",
	"auth.sign",
	"auth.verify",
	"rpc.read",
	"web3.rpc.read",
	"approve.submit",
	"approve.receipt",
	"transaction.submit",
	"transaction.receipt",
] as const;

const allowedEventNames = {
	metric: new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]),
	resource: new Set([
		"resource.duration",
		"resource.fetch.duration",
		"resource.xhr.duration",
		"resource.script.duration",
		"resource.stylesheet.duration",
		"resource.image.duration",
		"resource.font.duration",
	]),
	error: new Set([
		"javascript.error",
		"promise.rejection",
		"error.javascript.type_error",
		"error.javascript.network",
		"error.javascript.timeout",
		"error.javascript.unknown",
		"error.promise.type_error",
		"error.promise.network",
		"error.promise.timeout",
		"error.promise.unknown",
	]),
	custom: new Set([
		"navigation.dns",
		"navigation.tcp",
		"navigation.tls",
		"navigation.request_wait",
		"navigation.download",
		"navigation.dom_ready",
		"navigation.window_load",
		"longtask.duration",
		"longtask.count",
		"longtask.total",
		"longtask.max",
		"spa.route.duration",
		"ssr.shell.duration",
		"hydration.duration",
		"csr.fallback",
		"hydration.recoverable_error",
	]),
	web3: new Set([
		...web3OperationNames,
		...web3OperationNames.map((name) => `${name}.error`),
	]),
} as const;

const allowedRoutes = [
	"/",
	"/home",
	"/marketplace",
	"/parent",
	"/keepsakes",
	"/provider",
	"/exchange",
	"/profile",
	"/performance",
	"/evidence",
	"/tasks",
	"/tasks/:id",
] as const;

const eventSchema = z
	.object({
		eventId: z.uuid(),
		timestamp: z.number().int().nonnegative(),
		type: z.enum(["metric", "resource", "error", "custom", "web3"]),
		name: z.string().regex(/^[a-z0-9._-]{1,64}$/iu),
		value: z.number().finite(),
		unit: z.enum(["ms", "score", "count"]),
		category: z.enum(performanceCategories).optional(),
		outcome: z.enum(performanceOutcomes).optional(),
		route: z.enum(allowedRoutes),
		environment: z.enum([
			"production",
			"development",
			"preview",
			"test",
			"evidence",
		]),
		version: z.string().regex(/^[a-z0-9._-]{1,64}$/iu),
	})
	.strict()
	.superRefine((event, context) => {
		if (/@|%40/iu.test(event.route)) {
			context.addIssue({ code: "custom", message: "route contains PII" });
		}
		const isCountMetric =
			event.type === "error" ||
			event.name.endsWith(".count") ||
			event.name === "csr.fallback" ||
			event.name === "hydration.recoverable_error";
		const expectedUnit =
			event.name === "CLS" ? "score" : isCountMetric ? "count" : "ms";
		if (event.unit !== expectedUnit) {
			context.addIssue({ code: "custom", message: "metric unit mismatch" });
		}
		if (!allowedEventNames[event.type].has(event.name)) {
			context.addIssue({
				code: "custom",
				message: "metric name is not allowed",
			});
		}
		if (
			event.type === "resource" &&
			event.name !== "resource.duration" &&
			event.category !== event.name.split(".")[1]
		) {
			context.addIssue({
				code: "custom",
				message: "resource category mismatch",
			});
		}
	});

const batchSchema = z
	.object({
		schemaVersion: z.union([z.literal(1), z.literal(2)]),
		events: z.array(eventSchema).min(1).max(20),
		sentAt: z.number().int().optional(),
	})
	.strict();

export type PerformanceEvent = z.infer<typeof eventSchema>;
export type StoredPerformanceEvent = Omit<
	PerformanceEvent,
	"route" | "environment"
> & {
	route: string;
	environment: string;
};

export class PerformanceRequestError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export function parsePerformanceBatch(input: unknown): PerformanceEvent[] {
	return batchSchema.parse(input).events;
}

export function secureEqual(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return mismatch === 0;
}

export async function acceptPerformanceBatch(input: {
	originToken: string;
	providedToken: string | undefined;
	body: unknown;
	now: number;
	enqueueBatch: (events: PerformanceEvent[]) => Promise<void>;
}): Promise<{ accepted: number; eventIds: string[] }> {
	if (
		!input.providedToken ||
		!secureEqual(input.originToken, input.providedToken)
	) {
		throw new PerformanceRequestError(401, "origin authentication failed");
	}

	const eventCount =
		typeof input.body === "object" &&
		input.body !== null &&
		"events" in input.body
			? (input.body as { events?: unknown[] }).events?.length
			: undefined;
	if (eventCount !== undefined && eventCount > 20) {
		throw new PerformanceRequestError(413, "batch is too large");
	}

	const parsed = batchSchema.safeParse(input.body);
	if (!parsed.success)
		throw new PerformanceRequestError(400, "invalid event batch");
	const oldest = input.now - 24 * 60 * 60 * 1_000;
	const newest = input.now + 5 * 60 * 1_000;
	if (
		parsed.data.events.some(
			(event) => event.timestamp < oldest || event.timestamp > newest,
		)
	) {
		throw new PerformanceRequestError(
			400,
			"event timestamp is outside the allowed window",
		);
	}

	await input.enqueueBatch(parsed.data.events);
	return {
		accepted: parsed.data.events.length,
		eventIds: parsed.data.events.map(({ eventId }) => eventId),
	};
}

function percentile(sorted: number[], quantile: number): number {
	if (sorted.length === 0) return 0;
	const index = Math.ceil(quantile * sorted.length) - 1;
	return sorted[Math.max(0, index)] ?? 0;
}

export type PerformanceRouteStats = {
	route: string;
	sampleCount: number;
	p50: number;
	p75: number;
	p95: number;
};

export type PerformanceTrendPoint = {
	bucketStart: number;
	sampleCount: number;
	p50: number;
	p75: number;
	p95: number;
};

export type PerformanceOverviewMetric = {
	metric: string;
	category: "web-vital" | PerformanceEvent["type"];
	unit: PerformanceEvent["unit"];
	sampleCount: number;
	p50: number;
	p75: number;
	p95: number;
	errorCount: number;
	errorRate: number;
	routes: PerformanceRouteStats[];
	trend: PerformanceTrendPoint[];
};

export type PerformanceOverview = {
	summary: {
		totalEvents: number;
		errorCount: number;
		errorRate: number;
		metricCount: number;
		routeCount: number;
		latestEventAt: number | null;
	};
	metrics: PerformanceOverviewMetric[];
};

export type PerformanceCoverageStatus =
	| "observed"
	| "instrumented-no-sample"
	| "unavailable";

export type PerformanceMetricSummary = {
	name: string;
	unit: PerformanceEvent["unit"];
	sampleCount: number;
	p50: number | null;
	p75: number | null;
	p95: number | null;
	coverage: PerformanceCoverageStatus;
};

export type PerformanceDashboardResponse = {
	freshness: {
		observedAt: number | null;
		latestSampleAt: number | null;
		mode: "live";
		source: "live-api";
		runId: string | null;
		commit: string | null;
	};
	vitals: PerformanceMetricSummary[];
	navigation: PerformanceMetricSummary[];
	resources: PerformanceMetricSummary[];
	longTasks: {
		count: number;
		totalDurationMs: number;
		maxDurationMs: number | null;
		duration: PerformanceMetricSummary;
		coverage: PerformanceCoverageStatus;
	};
	errors: Array<{
		name: string;
		sampleCount: number;
		rate: number | null;
		coverage: PerformanceCoverageStatus;
	}>;
	web3: Array<{
		name: string;
		unit: "ms";
		sampleCount: number;
		successCount: number;
		failureCount: number;
		successRate: number | null;
		p50: number | null;
		p75: number | null;
		p95: number | null;
		coverage: PerformanceCoverageStatus;
	}>;
	routes: Array<{
		route: string;
		sampleCount: number;
		p75: number;
		p95: number;
	}>;
	trend: Array<{
		bucketStart: number;
		name: string;
		sampleCount: number;
		p75: number;
	}>;
	versions: Array<{
		version: string;
		sampleCount: number;
		p75: number;
		p95: number;
	}>;
	coverage: Array<{ name: string; status: PerformanceCoverageStatus }>;
	pipeline: { status: "unavailable"; source: "database-only" };
};

const vitalCatalog = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;
const navigationCatalog = [
	"navigation.dns",
	"navigation.tcp",
	"navigation.tls",
	"navigation.request_wait",
	"navigation.download",
	"navigation.dom_ready",
	"navigation.window_load",
] as const;
const resourceCatalog = [
	"resource.duration",
	"resource.fetch.duration",
	"resource.xhr.duration",
	"resource.script.duration",
	"resource.stylesheet.duration",
	"resource.image.duration",
	"resource.font.duration",
] as const;
const errorCatalog = [
	"javascript.error",
	"promise.rejection",
	"error.javascript.type_error",
	"error.javascript.network",
	"error.javascript.timeout",
	"error.javascript.unknown",
	"error.promise.type_error",
	"error.promise.network",
	"error.promise.timeout",
	"error.promise.unknown",
] as const;
const longTaskCatalog = [
	"longtask.duration",
	"longtask.count",
	"longtask.total",
	"longtask.max",
] as const;
const renderingCatalog = [
	"spa.route.duration",
	"ssr.shell.duration",
	"hydration.duration",
	"csr.fallback",
	"hydration.recoverable_error",
] as const;
const topN = 10;

export function isAllowedPerformanceMetricName(name: string): boolean {
	return Object.values(allowedEventNames).some((names) => names.has(name));
}

function coverageFor(
	events: StoredPerformanceEvent[],
): PerformanceCoverageStatus {
	if (events.some(({ outcome }) => outcome !== "unavailable"))
		return "observed";
	if (events.some(({ outcome }) => outcome === "unavailable"))
		return "unavailable";
	return "instrumented-no-sample";
}

function nullablePercentile(values: number[], quantile: number): number | null {
	return values.length === 0
		? null
		: percentile(
				[...values].sort((left, right) => left - right),
				quantile,
			);
}

function summarizeMetric(
	events: StoredPerformanceEvent[],
	name: string,
	unit: PerformanceEvent["unit"],
): PerformanceMetricSummary {
	const matching = events.filter((event) => event.name === name);
	const observed = matching.filter(({ outcome }) => outcome !== "unavailable");
	const values = observed.map(({ value }) => value);
	return {
		name,
		unit,
		sampleCount: observed.length,
		p50: nullablePercentile(values, 0.5),
		p75: nullablePercentile(values, 0.75),
		p95: nullablePercentile(values, 0.95),
		coverage: coverageFor(matching),
	};
}

function summarizeDimension(
	events: StoredPerformanceEvent[],
	dimension: "route" | "version",
): Array<{
	key: string;
	sampleCount: number;
	p75: number;
	p95: number;
}> {
	const groups = new Map<string, number[]>();
	for (const event of events) {
		const key = event[dimension];
		const values = groups.get(key) ?? [];
		values.push(event.value);
		groups.set(key, values);
	}
	return [...groups]
		.map(([key, values]) => ({
			key,
			sampleCount: values.length,
			p75: percentile(
				[...values].sort((a, b) => a - b),
				0.75,
			),
			p95: percentile(
				[...values].sort((a, b) => a - b),
				0.95,
			),
		}))
		.sort(
			(left, right) =>
				right.p75 - left.p75 || left.key.localeCompare(right.key),
		)
		.slice(0, topN);
}

export function computePerformanceStats(
	events: StoredPerformanceEvent[],
	metric?: string,
): {
	metric: string;
	unit: PerformanceEvent["unit"];
	sampleCount: number;
	p50: number;
	p75: number;
	p95: number;
	errorRate: number;
	routes: Array<{ route: string; sampleCount: number; p75: number }>;
	trend: Array<{ bucketStart: number; sampleCount: number; p75: number }>;
} {
	const selected = metric
		? events.filter((item) => item.name === metric)
		: events;
	const identities = new Set(
		selected.map((item) => `${item.name}:${item.unit}`),
	);
	if (identities.size > 1) {
		throw new Error("statistics require a single metric and unit");
	}
	const values = selected.map(({ value }) => value).sort((a, b) => a - b);
	const routeGroups = new Map<string, number[]>();
	const trendGroups = new Map<number, number[]>();
	for (const event of selected) {
		const group = routeGroups.get(event.route) ?? [];
		group.push(event.value);
		routeGroups.set(event.route, group);
		const bucketStart = Math.floor(event.timestamp / 3_600_000) * 3_600_000;
		const bucket = trendGroups.get(bucketStart) ?? [];
		bucket.push(event.value);
		trendGroups.set(bucketStart, bucket);
	}

	return {
		metric: metric ?? selected[0]?.name ?? "unknown",
		unit: selected[0]?.unit ?? (metric === "CLS" ? "score" : "ms"),
		sampleCount: selected.length,
		p50: percentile(values, 0.5),
		p75: percentile(values, 0.75),
		p95: percentile(values, 0.95),
		errorRate:
			events.length === 0
				? 0
				: events.filter(({ type }) => type === "error").length / events.length,
		routes: [...routeGroups]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([route, routeValues]) => ({
				route,
				sampleCount: routeValues.length,
				p75: percentile(
					[...routeValues].sort((a, b) => a - b),
					0.75,
				),
			})),
		trend: [...trendGroups]
			.sort(([left], [right]) => left - right)
			.map(([bucketStart, bucketValues]) => ({
				bucketStart,
				sampleCount: bucketValues.length,
				p75: percentile(
					[...bucketValues].sort((a, b) => a - b),
					0.75,
				),
			})),
	};
}

const overviewWebVitalNames = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

function computeOverviewMetric(
	events: StoredPerformanceEvent[],
): PerformanceOverviewMetric {
	const values = events.map(({ value }) => value).sort((a, b) => a - b);
	const routeGroups = new Map<string, number[]>();
	const trendGroups = new Map<number, number[]>();
	for (const event of events) {
		const routeValues = routeGroups.get(event.route) ?? [];
		routeValues.push(event.value);
		routeGroups.set(event.route, routeValues);
		const bucketStart = Math.floor(event.timestamp / 3_600_000) * 3_600_000;
		const trendValues = trendGroups.get(bucketStart) ?? [];
		trendValues.push(event.value);
		trendGroups.set(bucketStart, trendValues);
	}
	const summarize = (group: number[]) => {
		const sorted = [...group].sort((left, right) => left - right);
		return {
			sampleCount: sorted.length,
			p50: percentile(sorted, 0.5),
			p75: percentile(sorted, 0.75),
			p95: percentile(sorted, 0.95),
		};
	};
	const errorCount = events.filter(({ type }) => type === "error").length;
	const first = events[0];
	return {
		metric: first?.name ?? "unknown",
		category: first
			? overviewWebVitalNames.has(first.name)
				? "web-vital"
				: first.type
			: "metric",
		unit: first?.unit ?? "ms",
		sampleCount: events.length,
		p50: percentile(values, 0.5),
		p75: percentile(values, 0.75),
		p95: percentile(values, 0.95),
		errorCount,
		errorRate: events.length === 0 ? 0 : errorCount / events.length,
		routes: [...routeGroups]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([route, group]) => ({ route, ...summarize(group) })),
		trend: [...trendGroups]
			.sort(([left], [right]) => left - right)
			.map(([bucketStart, group]) => ({ bucketStart, ...summarize(group) })),
	};
}

export function computePerformanceOverview(
	events: StoredPerformanceEvent[],
): PerformanceOverview {
	const groups = new Map<string, StoredPerformanceEvent[]>();
	for (const event of events) {
		const key = `${event.name}:${event.unit}`;
		const group = groups.get(key) ?? [];
		group.push(event);
		groups.set(key, group);
	}
	const errorCount = events.filter(({ type }) => type === "error").length;
	return {
		summary: {
			totalEvents: events.length,
			errorCount,
			errorRate: events.length === 0 ? 0 : errorCount / events.length,
			metricCount: groups.size,
			routeCount: new Set(events.map(({ route }) => route)).size,
			latestEventAt:
				events.length === 0
					? null
					: Math.max(...events.map(({ timestamp }) => timestamp)),
		},
		metrics: [...groups.values()]
			.map(computeOverviewMetric)
			.sort((left, right) => left.metric.localeCompare(right.metric)),
	};
}

export function computePerformanceDashboard(
	events: StoredPerformanceEvent[],
	metric = "LCP",
	observedAt = Date.now(),
): PerformanceDashboardResponse {
	const latestSampleAt = events.length
		? Math.max(...events.map(({ timestamp }) => timestamp))
		: null;
	const diagnosticEvents = events.filter(
		(event) => event.name === metric && event.outcome !== "unavailable",
	);
	const pageObservationCount = events.filter(
		(event) =>
			event.name === "navigation.window_load" &&
			event.outcome !== "unavailable",
	).length;
	const duration = summarizeMetric(events, "longtask.duration", "ms");
	const durationValues = events
		.filter(
			(event) =>
				event.name === "longtask.duration" && event.outcome !== "unavailable",
		)
		.map(({ value }) => value);
	const longTaskEvents = events.filter(({ name }) =>
		longTaskCatalog.includes(name as (typeof longTaskCatalog)[number]),
	);
	const count = durationValues.length;
	const web3 = web3OperationNames.map((name) => {
		const operationEvents = events.filter(
			(event) => event.name === name || event.name === `${name}.error`,
		);
		const observed = operationEvents.filter(
			({ outcome }) => outcome !== "unavailable",
		);
		const successCount = observed.filter(
			(event) =>
				event.outcome === "success" ||
				(event.outcome === undefined && !event.name.endsWith(".error")),
		).length;
		const failureCount = observed.filter(
			(event) => event.outcome === "failure" || event.name.endsWith(".error"),
		).length;
		const denominator = successCount + failureCount;
		const values = observed.map(({ value }) => value);
		return {
			name,
			unit: "ms" as const,
			sampleCount: observed.length,
			successCount,
			failureCount,
			successRate: denominator === 0 ? null : successCount / denominator,
			p50: nullablePercentile(values, 0.5),
			p75: nullablePercentile(values, 0.75),
			p95: nullablePercentile(values, 0.95),
			coverage: coverageFor(operationEvents),
		};
	});
	const routeSummaries = summarizeDimension(diagnosticEvents, "route");
	const versionSummaries = summarizeDimension(diagnosticEvents, "version");
	const trendGroups = new Map<number, number[]>();
	for (const event of diagnosticEvents) {
		const bucketStart = Math.floor(event.timestamp / 3_600_000) * 3_600_000;
		const values = trendGroups.get(bucketStart) ?? [];
		values.push(event.value);
		trendGroups.set(bucketStart, values);
	}

	const vitals = vitalCatalog.map((name) =>
		summarizeMetric(events, name, name === "CLS" ? "score" : "ms"),
	);
	const navigation = navigationCatalog.map((name) =>
		summarizeMetric(events, name, "ms"),
	);
	const resources = resourceCatalog
		.map((name) => summarizeMetric(events, name, "ms"))
		.sort(
			(left, right) =>
				(right.p75 ?? Number.NEGATIVE_INFINITY) -
					(left.p75 ?? Number.NEGATIVE_INFINITY) ||
				left.name.localeCompare(right.name),
		)
		.slice(0, topN);
	const errors = errorCatalog
		.map((name) => {
			const matching = events.filter((event) => event.name === name);
			return {
				name,
				sampleCount: matching.length,
				rate:
					pageObservationCount === 0
						? null
						: matching.length / pageObservationCount,
				coverage: coverageFor(matching),
			};
		})
		.sort(
			(left, right) =>
				right.sampleCount - left.sampleCount ||
				left.name.localeCompare(right.name),
		)
		.slice(0, topN);
	const coverage = [
		...vitals,
		...navigation,
		...resources,
		...longTaskCatalog.map((name) =>
			summarizeMetric(events, name, name.endsWith(".count") ? "count" : "ms"),
		),
		...renderingCatalog.map((name) =>
			summarizeMetric(
				events,
				name,
				name === "csr.fallback" || name === "hydration.recoverable_error"
					? "count"
					: "ms",
			),
		),
		...errors.map(({ name, coverage: status }) => ({
			name,
			coverage: status,
		})),
		...web3,
	].map(({ name, coverage: status }) => ({ name, status }));

	return {
		freshness: {
			observedAt,
			latestSampleAt,
			mode: "live",
			source: "live-api",
			runId: null,
			commit: null,
		},
		vitals,
		navigation,
		resources,
		longTasks: {
			count,
			totalDurationMs: durationValues.reduce(
				(total, value) => total + value,
				0,
			),
			maxDurationMs:
				durationValues.length === 0 ? null : Math.max(...durationValues),
			duration,
			coverage: coverageFor(longTaskEvents),
		},
		errors,
		web3,
		routes: routeSummaries.map(({ key, ...summary }) => ({
			route: key,
			...summary,
		})),
		trend: [...trendGroups]
			.sort(([left], [right]) => left - right)
			.map(([bucketStart, values]) => ({
				bucketStart,
				name: metric,
				sampleCount: values.length,
				p75: percentile(
					[...values].sort((a, b) => a - b),
					0.75,
				),
			})),
		versions: versionSummaries.map(({ key, ...summary }) => ({
			version: key,
			...summary,
		})),
		coverage,
		pipeline: { status: "unavailable", source: "database-only" },
	};
}
