import assert from "node:assert/strict";
import test from "node:test";
import { buildPerformanceSnapshot } from "./build-performance-snapshot.mjs";

const overview = {
	schemaVersion: "performance-overview/v2",
	window: {
		preset: "1h",
		from: "2026-08-27T00:00:00.000Z",
		to: "2026-08-27T01:00:00.000Z",
	},
	filters: { window: "1h", environment: "production" },
	summary: {
		totalEvents: 4,
		errorCount: 1,
		errorRate: 0.25,
		metricCount: 2,
		routeCount: 1,
		latestEventAt: 1_787_773_600_000,
	},
	metrics: [
		{
			metric: "LCP",
			category: "web-vital",
			unit: "ms",
			sampleCount: 3,
			p50: 900,
			p75: 1100,
			p95: 1400,
			errorCount: 0,
			errorRate: 0,
			routes: [{ route: "/", sampleCount: 3, p50: 900, p75: 1100, p95: 1400 }],
			trend: [{ bucketStart: 1_787_770_000_000, sampleCount: 3, p50: 900, p75: 1100, p95: 1400 }],
		},
		{
			metric: "javascript.error",
			category: "error",
			unit: "count",
			sampleCount: 1,
			p50: 1,
			p75: 1,
			p95: 1,
			errorCount: 1,
			errorRate: 1,
			routes: [{ route: "/", sampleCount: 1, p50: 1, p75: 1, p95: 1 }],
			trend: [{ bucketStart: 1_787_770_000_000, sampleCount: 1, p50: 1, p75: 1, p95: 1 }],
		},
	],
};

const context = {
	projectSlug: "performance-observability-control",
	captureId: "capture-123-1",
	capturedAt: "2026-08-27T00:30:00.000Z",
	kind: "synthetic-closed-loop",
	repository: "Tiancheng-Xu/babysteps",
	commitSha: "0123456789abcdef0123456789abcdef01234567",
	workflowRunId: "123",
	sdkVersion: "2.0.0",
	cleanerVersion: "2.0.0",
	sampleRate: "1",
	expiresAt: "2026-08-27T01:00:00.000Z",
	ttlMinutes: "45",
	estimatedCostUsd: "0.20",
	maximumCostUsd: "0.20",
};

test("builds an auditable multi-metric v2 snapshot", () => {
	const snapshot = buildPerformanceSnapshot(overview, context);
	assert.equal(snapshot.schemaVersion, 2);
	assert.equal(snapshot.metrics.length, 2);
	assert.equal(snapshot.summary.totalEvents, 4);
	assert.equal(snapshot.operation.maximumIncrementalCostUsd, 0.2);
	assert.equal(snapshot.operation.observedRuntimeMinutes, 15);
});

test("rejects empty, unordered, or sensitive snapshots", () => {
	assert.throws(() => buildPerformanceSnapshot({ ...overview, metrics: [] }, context));
	assert.throws(() =>
		buildPerformanceSnapshot(
			{ ...overview, metrics: [{ ...overview.metrics[0], p50: 2000 }] },
			context,
		),
	);
	assert.throws(() =>
		buildPerformanceSnapshot(
			{ ...overview, filters: { authorization: "private" } },
			context,
		),
	);
});
