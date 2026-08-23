import { afterEach, describe, expect, it, vi } from "vitest";
import {
	fetchPerformanceStats,
	isPerformanceDashboardResponse,
	PerformanceApiError,
	type PerformanceCoverageStatus,
	type PerformanceDashboardResponse,
	type PerformanceMetricSummary,
} from "./api";

const vitalNames = ["LCP", "CLS", "INP", "FCP", "TTFB"] as const;
const navigationNames = [
	"navigation.dns",
	"navigation.tcp",
	"navigation.tls",
	"navigation.request_wait",
	"navigation.download",
	"navigation.dom_ready",
	"navigation.window_load",
] as const;
const resourceNames = [
	"resource.duration",
	"resource.fetch.duration",
	"resource.xhr.duration",
	"resource.script.duration",
	"resource.stylesheet.duration",
	"resource.image.duration",
	"resource.font.duration",
] as const;
const errorNames = [
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
const web3Names = [
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
const renderingNames = [
	"spa.route.duration",
	"ssr.shell.duration",
	"hydration.duration",
	"csr.fallback",
	"hydration.recoverable_error",
] as const;
const longTaskNames = [
	"longtask.duration",
	"longtask.count",
	"longtask.total",
	"longtask.max",
] as const;
const coverageNames = [
	...vitalNames,
	...navigationNames,
	...resourceNames,
	...longTaskNames,
	...renderingNames,
	...errorNames,
	...web3Names,
] as const;

function emptyMetric(
	name: string,
	unit: PerformanceMetricSummary["unit"] = "ms",
): PerformanceMetricSummary {
	return {
		name,
		unit,
		sampleCount: 0,
		p50: null,
		p75: null,
		p95: null,
		coverage: "instrumented-no-sample",
	};
}

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
	vitals: vitalNames.map((name) =>
		name === "LCP"
			? {
					name,
					unit: "ms" as const,
					sampleCount: 1,
					p50: 100,
					p75: 100,
					p95: 100,
					coverage: "observed" as const,
				}
			: emptyMetric(name, name === "CLS" ? "score" : "ms"),
	),
	navigation: navigationNames.map((name) => emptyMetric(name)),
	resources: resourceNames.map((name) => emptyMetric(name)),
	longTasks: {
		count: 0,
		totalDurationMs: 0,
		maxDurationMs: null,
		duration: emptyMetric("longtask.duration"),
		coverage: "instrumented-no-sample",
	},
	errors: errorNames.map((name) => ({
		name,
		sampleCount: 0,
		rate: null,
		coverage: "instrumented-no-sample" as const,
	})),
	web3: web3Names.map((name) => ({
		name,
		unit: "ms" as const,
		sampleCount: 0,
		successCount: 0,
		failureCount: 0,
		successRate: null,
		p50: null,
		p75: null,
		p95: null,
		coverage: "instrumented-no-sample" as const,
	})),
	routes: [],
	trend: [],
	versions: [],
	coverage: coverageNames.map((name) => ({
		name,
		status: (name === "LCP"
			? "observed"
			: "instrumented-no-sample") as PerformanceCoverageStatus,
	})),
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
		["empty vitals", { ...response, vitals: [] }],
		[
			"duplicate navigation",
			{
				...response,
				navigation: [
					response.navigation[0],
					...response.navigation.slice(0, -1),
				],
			},
		],
		[
			"missing resource",
			{ ...response, resources: response.resources.slice(0, -1) },
		],
		[
			"resource over limit",
			{
				...response,
				resources: [...response.resources, response.resources[0]],
			},
		],
		["missing Web3 operation", { ...response, web3: response.web3.slice(1) }],
		[
			"duplicate coverage",
			{
				...response,
				coverage: [response.coverage[0], ...response.coverage.slice(0, -1)],
			},
		],
		[
			"eleven routes",
			{
				...response,
				routes: Array.from({ length: 11 }, (_, index) => ({
					route: `/route-${index}`,
					sampleCount: 1,
					p75: 1,
					p95: 1,
				})),
			},
		],
		[
			"eleven errors",
			{
				...response,
				errors: [...response.errors, response.errors[0]],
			},
		],
		[
			"eleven versions",
			{
				...response,
				versions: Array.from({ length: 11 }, (_, index) => ({
					version: `v${index}`,
					sampleCount: 1,
					p75: 1,
					p95: 1,
				})),
			},
		],
	])(
		"rejects an incomplete, duplicate, or unbounded %s catalog",
		(_name, body) => {
			expect(isPerformanceDashboardResponse(body)).toBe(false);
		},
	);

	it.each([
		[
			"zero-sample observed metric",
			{
				...response,
				vitals: [
					{
						...response.vitals[0],
						sampleCount: 0,
						p50: null,
						p75: null,
						p95: null,
					},
					...response.vitals.slice(1),
				],
			},
		],
		[
			"positive metric with null percentile",
			{
				...response,
				vitals: [
					{ ...response.vitals[0], p75: null },
					...response.vitals.slice(1),
				],
			},
		],
		[
			"Web3 sample count mismatch",
			{
				...response,
				web3: [
					{
						...response.web3[0],
						sampleCount: 2,
						successCount: 1,
						failureCount: 0,
						successRate: 1,
						p50: 10,
						p75: 10,
						p95: 10,
						coverage: "observed",
					},
					...response.web3.slice(1),
				],
			},
		],
		[
			"zero Web3 denominator with numeric success rate",
			{
				...response,
				web3: [
					{ ...response.web3[0], successRate: 0 },
					...response.web3.slice(1),
				],
			},
		],
		[
			"positive Web3 denominator with null percentile",
			{
				...response,
				web3: [
					{
						...response.web3[0],
						sampleCount: 1,
						successCount: 1,
						successRate: 1,
						coverage: "observed",
					},
					...response.web3.slice(1),
				],
			},
		],
	])("rejects contradictory %s semantics", (_name, body) => {
		expect(isPerformanceDashboardResponse(body)).toBe(false);
	});

	it("fails closed when fetch returns an invalid response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () => new Response(JSON.stringify({ ...response, vitals: [] })),
			),
		);

		await expect(fetchPerformanceStats({ window: "24h" })).rejects.toEqual(
			new PerformanceApiError("invalid performance response"),
		);
	});
});
