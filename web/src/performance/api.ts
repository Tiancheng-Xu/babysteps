export type PerformanceFilters = {
	window: "1h" | "24h" | "7d";
	route?: string;
	metric?: string;
	environment?: string;
	version?: string;
};

export type PerformanceCoverageStatus =
	| "observed"
	| "instrumented-no-sample"
	| "unavailable";

export type PerformanceMetricSummary = {
	name: string;
	unit: "ms" | "score" | "count";
	sampleCount: number;
	p50: number | null;
	p75: number | null;
	p95: number | null;
	coverage: PerformanceCoverageStatus;
};

export type PerformanceDashboardResponse = {
	window: PerformanceFilters["window"];
	freshness: {
		observedAt: number | null;
		latestSampleAt: number | null;
		mode: "live" | "snapshot";
		source: "live-api" | "verified-snapshot";
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

export type PerformanceStats = PerformanceDashboardResponse;

export class PerformanceApiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PerformanceApiError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
	return value === null || isFiniteNumber(value);
}

function isNonnegativeInteger(value: unknown): value is number {
	return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isCoverage(value: unknown): value is PerformanceCoverageStatus {
	return (
		value === "observed" ||
		value === "instrumented-no-sample" ||
		value === "unavailable"
	);
}

function isMetricSummary(value: unknown): value is PerformanceMetricSummary {
	if (!isRecord(value)) return false;
	const validShape =
		typeof value.name === "string" &&
		(value.unit === "ms" || value.unit === "score" || value.unit === "count") &&
		isNonnegativeInteger(value.sampleCount) &&
		isNullableNumber(value.p50) &&
		isNullableNumber(value.p75) &&
		isNullableNumber(value.p95) &&
		isCoverage(value.coverage);
	if (!validShape) return false;
	if (value.sampleCount === 0) {
		return value.p50 === null && value.p75 === null && value.p95 === null;
	}
	return (
		isFiniteNumber(value.p50) &&
		isFiniteNumber(value.p75) &&
		isFiniteNumber(value.p95) &&
		value.coverage === "observed"
	);
}

function isFreshness(
	value: unknown,
): value is PerformanceDashboardResponse["freshness"] {
	if (!isRecord(value)) return false;
	return (
		isNullableNumber(value.observedAt) &&
		isNullableNumber(value.latestSampleAt) &&
		(value.mode === "live" || value.mode === "snapshot") &&
		(value.source === "live-api" || value.source === "verified-snapshot") &&
		(value.runId === null || typeof value.runId === "string") &&
		(value.commit === null || typeof value.commit === "string")
	);
}

function isLongTasks(
	value: unknown,
): value is PerformanceDashboardResponse["longTasks"] {
	if (!isRecord(value)) return false;
	return (
		isFiniteNumber(value.count) &&
		value.count >= 0 &&
		isFiniteNumber(value.totalDurationMs) &&
		value.totalDurationMs >= 0 &&
		isNullableNumber(value.maxDurationMs) &&
		isMetricSummary(value.duration) &&
		isCoverage(value.coverage)
	);
}

function isErrorSummary(
	value: unknown,
): value is PerformanceDashboardResponse["errors"][number] {
	if (!isRecord(value)) return false;
	return (
		typeof value.name === "string" &&
		isNonnegativeInteger(value.sampleCount) &&
		isNullableNumber(value.rate) &&
		(value.rate === null || value.rate >= 0) &&
		isCoverage(value.coverage)
	);
}

function isWeb3Summary(
	value: unknown,
): value is PerformanceDashboardResponse["web3"][number] {
	if (!isRecord(value)) return false;
	return (
		typeof value.name === "string" &&
		value.unit === "ms" &&
		isNonnegativeInteger(value.sampleCount) &&
		isNonnegativeInteger(value.successCount) &&
		isNonnegativeInteger(value.failureCount) &&
		isNullableNumber(value.successRate) &&
		(value.successRate === null ||
			(value.successRate >= 0 && value.successRate <= 1)) &&
		isNullableNumber(value.p50) &&
		isNullableNumber(value.p75) &&
		isNullableNumber(value.p95) &&
		isCoverage(value.coverage)
	);
}

function isRouteSummary(
	value: unknown,
): value is PerformanceDashboardResponse["routes"][number] {
	if (!isRecord(value)) return false;
	return (
		typeof value.route === "string" &&
		isNonnegativeInteger(value.sampleCount) &&
		isFiniteNumber(value.p75) &&
		isFiniteNumber(value.p95)
	);
}

function isTrendSummary(
	value: unknown,
): value is PerformanceDashboardResponse["trend"][number] {
	if (!isRecord(value)) return false;
	return (
		isNonnegativeInteger(value.bucketStart) &&
		value.bucketStart % 3_600_000 === 0 &&
		typeof value.name === "string" &&
		isNonnegativeInteger(value.sampleCount) &&
		isFiniteNumber(value.p75)
	);
}

function isVersionSummary(
	value: unknown,
): value is PerformanceDashboardResponse["versions"][number] {
	if (!isRecord(value)) return false;
	return (
		typeof value.version === "string" &&
		isNonnegativeInteger(value.sampleCount) &&
		isFiniteNumber(value.p75) &&
		isFiniteNumber(value.p95)
	);
}

export function isPerformanceDashboardResponse(
	value: unknown,
): value is PerformanceDashboardResponse {
	if (!isRecord(value)) return false;
	return (
		(value.window === "1h" ||
			value.window === "24h" ||
			value.window === "7d") &&
		isFreshness(value.freshness) &&
		Array.isArray(value.vitals) &&
		value.vitals.every(isMetricSummary) &&
		Array.isArray(value.navigation) &&
		value.navigation.every(isMetricSummary) &&
		Array.isArray(value.resources) &&
		value.resources.every(isMetricSummary) &&
		isLongTasks(value.longTasks) &&
		Array.isArray(value.errors) &&
		value.errors.every(isErrorSummary) &&
		Array.isArray(value.web3) &&
		value.web3.every(isWeb3Summary) &&
		Array.isArray(value.routes) &&
		value.routes.every(isRouteSummary) &&
		Array.isArray(value.trend) &&
		value.trend.every(isTrendSummary) &&
		Array.isArray(value.versions) &&
		value.versions.every(isVersionSummary) &&
		Array.isArray(value.coverage) &&
		value.coverage.every(
			(item) =>
				isRecord(item) &&
				typeof item.name === "string" &&
				isCoverage(item.status),
		) &&
		isRecord(value.pipeline) &&
		value.pipeline.status === "unavailable" &&
		value.pipeline.source === "database-only"
	);
}

export function performanceEventsEndpoint(apiUrl?: string): string {
	return `${apiUrl?.replace(/\/$/u, "") ?? ""}/api/performance/events`;
}

export function performanceStatsEndpoint(apiUrl?: string): string {
	return `${apiUrl?.replace(/\/$/u, "") ?? ""}/api/performance/stats`;
}

export async function fetchPerformanceStats(
	filters: PerformanceFilters,
	apiUrl?: string,
): Promise<PerformanceDashboardResponse> {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (value) query.set(key, value);
	}

	const response = await fetch(
		`${performanceStatsEndpoint(apiUrl)}?${query.toString()}`,
		{
			headers: { accept: "application/json" },
			credentials: "omit",
		},
	);
	if (!response.ok) {
		throw new PerformanceApiError("performance stats unavailable");
	}
	const result: unknown = await response.json();
	if (!isPerformanceDashboardResponse(result)) {
		throw new PerformanceApiError("invalid performance response");
	}
	return result;
}
