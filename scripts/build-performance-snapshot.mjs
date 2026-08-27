import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const forbiddenKey = /(authorization|cookie|password|secret|token|private.?key)/i;

const containsForbiddenKey = (value) =>
	Boolean(value) &&
	typeof value === "object" &&
	Object.entries(value).some(
		([key, nested]) => forbiddenKey.test(key) || containsForbiddenKey(nested),
	);

const required = (value, label) => {
	if (!value) throw new Error(`missing ${label}`);
	return value;
};

export function buildPerformanceSnapshot(overview, context) {
	if (
		overview?.schemaVersion !== "performance-overview/v2" ||
		!Array.isArray(overview.metrics) ||
		overview.metrics.length === 0 ||
		containsForbiddenKey(overview)
	) {
		throw new Error("invalid performance overview");
	}
	const capturedAt = required(context.capturedAt, "capturedAt");
	const ttlMinutes = Number(context.ttlMinutes);
	const expiresAt = Date.parse(required(context.expiresAt, "expiresAt"));
	const elapsedMinutes = Math.max(
		0,
		Math.min(ttlMinutes, ttlMinutes - Math.max(0, expiresAt - Date.parse(capturedAt)) / 60_000),
	);
	const metrics = overview.metrics.map((metric) => ({
		name: required(metric.metric, "metric name"),
		category: required(metric.category, "metric category"),
		unit: required(metric.unit, "metric unit"),
		page: overview.filters.route ?? "all",
		route: overview.filters.route ?? "all",
		sampleCount: metric.sampleCount,
		p50: metric.p50,
		p75: metric.p75,
		p95: metric.p95,
		errorCount: metric.errorCount,
		routes: metric.routes,
		trend: metric.trend,
	}));
	const snapshot = {
		schemaVersion: 2,
		projectSlug: required(context.projectSlug, "projectSlug"),
		captureId: required(context.captureId, "captureId"),
		capturedAt,
		kind: context.kind ?? "synthetic-closed-loop",
		window: overview.window,
		repository: required(context.repository, "repository"),
		commitSha: required(context.commitSha, "commitSha"),
		workflowRunId: required(context.workflowRunId, "workflowRunId"),
		sdkVersion: required(context.sdkVersion, "sdkVersion"),
		cleanerVersion: required(context.cleanerVersion, "cleanerVersion"),
		percentileMethod: "nearest-rank",
		sampleRate: Number(context.sampleRate),
		filters: overview.filters,
		summary: overview.summary,
		operation: {
			estimatedIncrementalCostUsd: Number(context.estimatedCostUsd),
			maximumIncrementalCostUsd: Number(context.maximumCostUsd),
			ttlMinutes,
			observedRuntimeMinutes: Number(elapsedMinutes.toFixed(2)),
		},
		metrics,
	};
	if (
		!/^[a-f0-9]{40}$/.test(snapshot.commitSha) ||
		!Number.isFinite(Date.parse(snapshot.capturedAt)) ||
		!Number.isFinite(snapshot.sampleRate) ||
		snapshot.sampleRate <= 0 ||
		snapshot.sampleRate > 1 ||
		metrics.some(
			(metric) =>
				!Number.isInteger(metric.sampleCount) ||
				metric.sampleCount < 1 ||
				metric.p50 > metric.p75 ||
				metric.p75 > metric.p95,
		) ||
		containsForbiddenKey(snapshot)
	) {
		throw new Error("invalid performance snapshot");
	}
	return snapshot;
}

async function main() {
	const [input, output] = process.argv.slice(2);
	const overview = JSON.parse(await readFile(required(input, "input"), "utf8"));
	const capturedAt = new Date().toISOString();
	const snapshot = buildPerformanceSnapshot(overview, {
		projectSlug: "performance-observability-control",
		captureId: `capture-${required(process.env.GITHUB_RUN_ID, "GITHUB_RUN_ID")}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`,
		capturedAt,
		kind: process.env.PERFORMANCE_SNAPSHOT_KIND ?? "synthetic-closed-loop",
		repository: process.env.GITHUB_REPOSITORY,
		commitSha: process.env.GITHUB_SHA,
		workflowRunId: process.env.GITHUB_RUN_ID,
		sdkVersion: process.env.PERFORMANCE_SDK_VERSION ?? "1.0.0",
		cleanerVersion: process.env.PERFORMANCE_CLEANER_VERSION ?? "1.0.0",
		sampleRate: process.env.PERFORMANCE_SAMPLE_RATE ?? "1",
		expiresAt: process.env.EXPIRES_AT,
		ttlMinutes: process.env.TTL_MINUTES,
		estimatedCostUsd: process.env.ESTIMATED_INCREMENTAL_COST_USD,
		maximumCostUsd: process.env.MAX_INCREMENTAL_COST_USD,
	});
	await writeFile(required(output, "output"), `${JSON.stringify(snapshot)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
