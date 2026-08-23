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
			{ bucketStart: 0, sampleCount: 1, p75: 10 },
			{ bucketStart: 3_600_000, sampleCount: 1, p75: 20 },
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
