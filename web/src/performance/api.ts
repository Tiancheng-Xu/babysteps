export type PerformanceFilters = {
	window: "1h" | "24h" | "7d";
	route?: string;
	metric?: string;
	environment?: string;
	version?: string;
};

export type PerformanceRouteSummary = {
	route: string;
	sampleCount: number;
	p50: number;
	p75: number;
	p95: number;
};

export type PerformanceStats = {
	window: PerformanceFilters["window"];
	metric: string;
	unit: "ms" | "score" | "count";
	sampleCount: number;
	p50: number;
	p75: number;
	p95: number;
	errorCount: number;
	errorRate: number;
	routes: PerformanceRouteSummary[];
	trend: Array<{
		bucketStart: number;
		sampleCount: number;
		p50: number;
		p75: number;
		p95: number;
	}>;
};

export type PerformanceMetricStats = Omit<PerformanceStats, "window"> & {
	category: "web-vital" | "metric" | "resource" | "error" | "custom" | "web3";
};

export type PerformanceOverview = {
	schemaVersion: "performance-overview/v2";
	window: { preset: PerformanceFilters["window"]; from: string; to: string };
	filters: Record<string, string>;
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

export function performanceEventsEndpoint(apiUrl?: string): string {
	return `${apiUrl?.replace(/\/$/u, "") ?? ""}/api/performance/events`;
}

export function performanceStatsEndpoint(apiUrl?: string): string {
	return `${apiUrl?.replace(/\/$/u, "") ?? ""}/api/performance/stats`;
}

export async function fetchPerformanceStats(
	filters: PerformanceFilters,
	apiUrl?: string,
): Promise<PerformanceStats> {
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
	if (!response.ok) throw new Error("performance stats unavailable");
	return (await response.json()) as PerformanceStats;
}

export async function fetchPerformanceOverview(
	filters: Omit<PerformanceFilters, "metric">,
	apiUrl?: string,
): Promise<PerformanceOverview> {
	const query = new URLSearchParams({ metric: "all" });
	for (const [key, value] of Object.entries(filters)) {
		if (value) query.set(key, value);
	}
	const response = await fetch(
		`${performanceStatsEndpoint(apiUrl)}?${query.toString()}`,
		{ headers: { accept: "application/json" }, credentials: "omit" },
	);
	if (!response.ok) throw new Error("performance overview unavailable");
	const overview = (await response.json()) as PerformanceOverview;
	if (overview.schemaVersion !== "performance-overview/v2") {
		throw new Error("invalid performance overview");
	}
	return overview;
}
