import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchPerformanceStats,
	PerformanceApiError,
	type PerformanceDashboardResponse,
} from "./api";

const response = {
	window: "24h",
	freshness: {
		observedAt: 1_786_600_001_000,
		latestSampleAt: 1_786_600_000_000,
		mode: "live",
		source: "live-api",
		runId: null,
		commit: null,
	},
	vitals: [
		{
			name: "LCP",
			unit: "ms",
			sampleCount: 1,
			p50: 100,
			p75: 100,
			p95: 100,
			coverage: "observed",
		},
	],
	navigation: [],
	resources: [],
	longTasks: {
		count: 0,
		totalDurationMs: 0,
		maxDurationMs: null,
		duration: {
			name: "longtask.duration",
			unit: "ms",
			sampleCount: 0,
			p50: null,
			p75: null,
			p95: null,
			coverage: "instrumented-no-sample",
		},
		coverage: "instrumented-no-sample",
	},
	errors: [],
	web3: [],
	routes: [],
	trend: [],
	versions: [],
	coverage: [{ name: "LCP", status: "observed" }],
	pipeline: { status: "unavailable", source: "database-only" },
} satisfies PerformanceDashboardResponse;

afterEach(() => vi.unstubAllGlobals());

describe("performance query API", () => {
	it("accepts a complete explicitly validated dashboard response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () => new Response(JSON.stringify(response), { status: 200 }),
			),
		);

		await expect(
			fetchPerformanceStats({ window: "24h" }, "https://api.example"),
		).resolves.toEqual(response);
	});

	it.each([
		{ ...response, vitals: [{ ...response.vitals[0], p75: "100" }] },
		{
			...response,
			vitals: [
				{
					...response.vitals[0],
					sampleCount: 0,
					p50: 0,
					p75: 0,
					p95: 0,
					coverage: "instrumented-no-sample",
				},
			],
		},
		{ ...response, coverage: [{ name: "LCP", status: "unknown" }] },
		{ ...response, web3: [{ name: "rpc.read", successRate: 2 }] },
	])("fails closed for an invalid response", async (body) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
		);

		await expect(fetchPerformanceStats({ window: "24h" })).rejects.toEqual(
			new PerformanceApiError("invalid performance response"),
		);
	});
});
