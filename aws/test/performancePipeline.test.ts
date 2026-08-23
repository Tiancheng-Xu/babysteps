import { describe, expect, it, vi } from "vitest";
import {
	acceptPerformanceBatch,
	computePerformanceDashboard,
	computePerformanceStats,
	type PerformanceEvent,
	parsePerformanceBatch,
} from "../src/performance/pipeline";

const event = (
	overrides: Partial<PerformanceEvent> = {},
): PerformanceEvent => ({
	eventId: crypto.randomUUID(),
	timestamp: 1_786_600_000_000,
	type: "metric",
	name: "LCP",
	value: 100,
	unit: "ms",
	route: "/tasks/:id",
	environment: "preview",
	version: "abc123",
	...overrides,
});

describe("performance ingest", () => {
	it("accepts v1 and v2 whitelisted events while rejecting private resource names", () => {
		const batch = (
			type: PerformanceEvent["type"],
			name: string,
			unit: PerformanceEvent["unit"],
			overrides: Partial<PerformanceEvent> = {},
		) => ({
			schemaVersion: 2 as const,
			events: [event({ type, name, unit, ...overrides })],
		});

		expect(() =>
			parsePerformanceBatch(batch("custom", "csr.fallback", "count")),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch(batch("custom", "longtask.count", "count")),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch(
				batch("resource", "resource.image.duration", "ms", {
					category: "image",
				}),
			),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch(
				batch("web3", "web3.rpc.read", "ms", { outcome: "success" }),
			),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch(batch("web3", "contract.write.error", "ms")),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch(
				batch("resource", "https://private.example/a?token=x", "ms"),
			),
		).toThrow();
		expect(() =>
			parsePerformanceBatch({ schemaVersion: 1, events: [event()] }),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch({
				schemaVersion: 1,
				events: [
					event({ type: "custom", name: "hydration.duration", unit: "ms" }),
				],
			}),
		).not.toThrow();
		expect(() =>
			parsePerformanceBatch(
				batch("web3", "web3.rpc.read.0x1234567890abcdef", "ms"),
			),
		).toThrow();
		expect(() =>
			parsePerformanceBatch(batch("error", "javascript.alice_smith", "count")),
		).toThrow();
	});

	it("authenticates, validates and enqueues a bounded batch", async () => {
		const enqueueBatch = vi.fn(async () => undefined);
		const result = await acceptPerformanceBatch({
			originToken: "expected",
			providedToken: "expected",
			body: { schemaVersion: 1, events: [event()] },
			now: 1_786_600_001_000,
			enqueueBatch,
		});

		expect(result).toEqual({
			accepted: 1,
			eventIds: [expect.any(String)],
		});
		expect(enqueueBatch).toHaveBeenCalledOnce();
		expect(JSON.stringify(enqueueBatch.mock.calls)).not.toContain("expected");
	});

	it("rejects bad auth, oversized batches, stale events and unknown fields", async () => {
		const base = {
			originToken: "expected",
			providedToken: "wrong",
			body: { schemaVersion: 1, events: [event()] },
			now: 1_786_600_001_000,
			enqueueBatch: vi.fn(async () => undefined),
		};
		await expect(acceptPerformanceBatch(base)).rejects.toMatchObject({
			status: 401,
		});
		await expect(
			acceptPerformanceBatch({
				...base,
				providedToken: "expected",
				body: {
					schemaVersion: 1,
					events: Array.from({ length: 21 }, () => event()),
				},
			}),
		).rejects.toMatchObject({ status: 413 });
		await expect(
			acceptPerformanceBatch({
				...base,
				providedToken: "expected",
				body: { schemaVersion: 1, events: [event({ timestamp: 0 })] },
			}),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			acceptPerformanceBatch({
				...base,
				providedToken: "expected",
				body: { schemaVersion: 1, events: [{ ...event(), cookie: "secret" }] },
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it("rejects PII-like routes and type/unit mismatches", async () => {
		const base = {
			originToken: "expected",
			providedToken: "expected",
			now: 1_786_600_001_000,
			enqueueBatch: vi.fn(async () => undefined),
		};
		await expect(
			acceptPerformanceBatch({
				...base,
				body: {
					schemaVersion: 1,
					events: [event({ route: "/users/alice@example.com" as "/" })],
				},
			}),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			acceptPerformanceBatch({
				...base,
				body: {
					schemaVersion: 1,
					events: [event({ name: "CLS", unit: "ms" })],
				},
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it("rejects unbounded routes and environments before they reach storage", async () => {
		const base = {
			originToken: "expected",
			providedToken: "expected",
			now: 1_786_600_001_000,
			enqueueBatch: vi.fn(async () => undefined),
		};
		await expect(
			acceptPerformanceBatch({
				...base,
				body: {
					schemaVersion: 1,
					events: [event({ route: "/users/arbitrary-profile" as "/" })],
				},
			}),
		).rejects.toMatchObject({ status: 400 });
		await expect(
			acceptPerformanceBatch({
				...base,
				body: {
					schemaVersion: 1,
					events: [event({ environment: "attacker-controlled" as "preview" })],
				},
			}),
		).rejects.toMatchObject({ status: 400 });
	});
});

describe("real-sample statistics", () => {
	it("uses UTC hour boundaries for dashboard trend buckets", () => {
		const dashboard = computePerformanceDashboard([
			event({ timestamp: 3_599_999, value: 10 }),
			event({ timestamp: 3_600_001, value: 20 }),
		]);

		expect(dashboard.trend).toEqual([
			{ bucketStart: 0, name: "LCP", sampleCount: 1, p75: 10 },
			{
				bucketStart: 3_600_000,
				name: "LCP",
				sampleCount: 1,
				p75: 20,
			},
		]);
		expect(
			dashboard.trend.every(({ bucketStart }) => bucketStart % 3_600_000 === 0),
		).toBe(true);
	});

	it("returns the fixed vital catalog with honest empty-sample coverage", () => {
		const dashboard = computePerformanceDashboard([
			event({ name: "LCP", value: 200 }),
		]);

		expect(dashboard.vitals.map(({ name }) => name)).toEqual([
			"LCP",
			"CLS",
			"INP",
			"FCP",
			"TTFB",
		]);
		expect(dashboard.vitals.find(({ name }) => name === "INP")).toMatchObject({
			sampleCount: 0,
			p50: null,
			p75: null,
			p95: null,
			coverage: "instrumented-no-sample",
		});
		expect(dashboard.coverage.find(({ name }) => name === "INP")).toEqual({
			name: "INP",
			status: "instrumented-no-sample",
		});
	});

	it("marks explicit unavailable observations without turning zero into a percentile", () => {
		const dashboard = computePerformanceDashboard([
			event({
				type: "custom",
				name: "navigation.tls",
				value: 0,
				unit: "ms",
				outcome: "unavailable",
			}),
		]);

		expect(
			dashboard.navigation.find(({ name }) => name === "navigation.tls"),
		).toMatchObject({
			sampleCount: 0,
			p75: null,
			coverage: "unavailable",
		});
	});

	it("uses page observations for error rates and operation outcomes for Web3 success", () => {
		const dashboard = computePerformanceDashboard([
			event({ type: "custom", name: "navigation.window_load", unit: "ms" }),
			event({ type: "custom", name: "navigation.window_load", unit: "ms" }),
			event({
				type: "error",
				name: "javascript.error",
				unit: "count",
				value: 1,
			}),
			event({
				type: "web3",
				name: "web3.rpc.read",
				outcome: "success",
			}),
			event({
				type: "web3",
				name: "web3.rpc.read",
				outcome: "failure",
			}),
		]);

		expect(dashboard.errors[0]).toMatchObject({
			name: "javascript.error",
			sampleCount: 1,
			rate: 0.5,
		});
		expect(
			dashboard.web3.find(({ name }) => name === "web3.rpc.read"),
		).toMatchObject({
			sampleCount: 2,
			successCount: 1,
			failureCount: 1,
			successRate: 0.5,
		});
	});

	it.each([
		{ durations: [50, 70], cumulativeCounts: [1, 2], expectedCount: 2 },
		{
			durations: [50, 70, 90],
			cumulativeCounts: [1, 2, 3],
			expectedCount: 3,
		},
	])(
		"counts $expectedCount long-task duration events instead of summing cumulative counters",
		({ durations, cumulativeCounts, expectedCount }) => {
			const dashboard = computePerformanceDashboard([
				...durations.map((value) =>
					event({
						type: "custom",
						name: "longtask.duration",
						unit: "ms",
						value,
					}),
				),
				...cumulativeCounts.map((value) =>
					event({
						type: "custom",
						name: "longtask.count",
						unit: "count",
						value,
					}),
				),
			]);

			expect(dashboard.longTasks).toMatchObject({
				count: expectedCount,
				totalDurationMs: durations.reduce((total, value) => total + value, 0),
				maxDurationMs: Math.max(...durations),
			});
		},
	);

	it("includes every fixed rendering metric in coverage", () => {
		const names = computePerformanceDashboard([]).coverage.map(
			({ name }) => name,
		);

		expect(names).toEqual(
			expect.arrayContaining([
				"spa.route.duration",
				"ssr.shell.duration",
				"hydration.duration",
				"csr.fallback",
				"hydration.recoverable_error",
			]),
		);
	});

	it("keeps response observation time separate from the latest database sample", () => {
		const latestSampleAt = 1_786_600_000_000;
		const observedAt = latestSampleAt + 12_345;
		const dashboard = computePerformanceDashboard(
			[event({ timestamp: latestSampleAt })],
			"LCP",
			observedAt,
		);

		expect(dashboard.freshness).toMatchObject({ observedAt, latestSampleAt });
	});

	it("returns only the ten slowest routes", () => {
		const routes = [
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
		const dashboard = computePerformanceDashboard(
			routes.map((route, index) => event({ route, value: index + 1 })),
		);

		expect(dashboard.routes).toHaveLength(10);
		expect(dashboard.routes.map(({ p75 }) => p75)).toEqual([
			12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
		]);
	});

	it("computes sample count and p50/p75/p95 from the raw window", () => {
		const stats = computePerformanceStats([
			event({ value: 10 }),
			event({ value: 20 }),
			event({ value: 30 }),
			event({ value: 40 }),
			event({ value: 50 }),
		]);
		expect(stats).toMatchObject({ sampleCount: 5, p50: 30, p75: 40, p95: 50 });
	});

	it("keeps routes separate instead of averaging their percentiles", () => {
		const stats = computePerformanceStats([
			event({ route: "/", value: 10 }),
			event({ route: "/", value: 20 }),
			event({ route: "/tasks", value: 100 }),
		]);
		expect(stats.routes).toEqual([
			{ route: "/", sampleCount: 2, p75: 20 },
			{ route: "/tasks", sampleCount: 1, p75: 100 },
		]);
	});

	it("refuses to combine different metrics or units into one percentile", () => {
		expect(() =>
			computePerformanceStats([
				event({ name: "LCP", unit: "ms", value: 100 }),
				event({ name: "CLS", unit: "score", value: 0.1 }),
			]),
		).toThrow(/single metric and unit/i);
	});

	it("selects one metric while computing error rate from the whole window", () => {
		const stats = computePerformanceStats(
			[
				event({ name: "LCP", unit: "ms", value: 100 }),
				event({
					type: "error",
					name: "javascript.error",
					unit: "count",
					value: 1,
				}),
			],
			"LCP",
		);
		expect(stats).toMatchObject({
			metric: "LCP",
			unit: "ms",
			sampleCount: 1,
			p75: 100,
			errorRate: 0.5,
		});
	});

	it("returns real p75 trend buckets without averaging bucket percentiles", () => {
		const stats = computePerformanceStats(
			[
				event({ timestamp: 1_786_600_000_000, value: 10 }),
				event({ timestamp: 1_786_600_100_000, value: 30 }),
				event({ timestamp: 1_786_603_700_000, value: 90 }),
			],
			"LCP",
		);
		expect(stats.trend).toEqual([
			{ bucketStart: 1_786_597_200_000, sampleCount: 2, p75: 30 },
			{ bucketStart: 1_786_600_800_000, sampleCount: 1, p75: 90 },
		]);
	});
});
