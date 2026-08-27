import { z } from "zod";

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
		const expectedUnit =
			event.name === "CLS" ? "score" : event.type === "error" ? "count" : "ms";
		if (event.unit !== expectedUnit) {
			context.addIssue({ code: "custom", message: "metric unit mismatch" });
		}
	});

const batchSchema = z
	.object({
		schemaVersion: z.literal(1),
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

function secureEqual(left: string, right: string): boolean {
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

export type PerformanceMetricStats = {
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
	metrics: PerformanceMetricStats[];
};

const webVitalNames = new Set(["LCP", "CLS", "INP", "FCP", "TTFB"]);

const categoryFor = (event: StoredPerformanceEvent) =>
	webVitalNames.has(event.name) ? "web-vital" : event.type;

export function computePerformanceStats(
	events: StoredPerformanceEvent[],
	metric?: string,
): PerformanceMetricStats {
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
		category: selected[0] ? categoryFor(selected[0]) : "metric",
		unit: selected[0]?.unit ?? (metric === "CLS" ? "score" : "ms"),
		sampleCount: selected.length,
		p50: percentile(values, 0.5),
		p75: percentile(values, 0.75),
		p95: percentile(values, 0.95),
		errorCount: selected.filter(({ type }) => type === "error").length,
		errorRate:
			events.length === 0
				? 0
				: events.filter(({ type }) => type === "error").length / events.length,
		routes: [...routeGroups]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([route, routeValues]) => ({
				route,
				sampleCount: routeValues.length,
				p50: percentile(
					[...routeValues].sort((a, b) => a - b),
					0.5,
				),
				p75: percentile(
					[...routeValues].sort((a, b) => a - b),
					0.75,
				),
				p95: percentile(
					[...routeValues].sort((a, b) => a - b),
					0.95,
				),
			})),
		trend: [...trendGroups]
			.sort(([left], [right]) => left - right)
			.map(([bucketStart, bucketValues]) => ({
				bucketStart,
				sampleCount: bucketValues.length,
				p50: percentile(
					[...bucketValues].sort((a, b) => a - b),
					0.5,
				),
				p75: percentile(
					[...bucketValues].sort((a, b) => a - b),
					0.75,
				),
				p95: percentile(
					[...bucketValues].sort((a, b) => a - b),
					0.95,
				),
			})),
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
			.map((group) => computePerformanceStats(group))
			.sort((left, right) => left.metric.localeCompare(right.metric)),
	};
}
