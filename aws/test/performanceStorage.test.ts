import { describe, expect, it } from "vitest";
import type { PerformanceEvent } from "../src/performance/pipeline";
import { PostgresPerformanceStore } from "../src/performance/storage";

const sample: PerformanceEvent = {
	eventId: "123e4567-e89b-42d3-a456-426614174000",
	timestamp: 1_786_600_000_000,
	type: "metric",
	name: "LCP",
	value: 123,
	unit: "ms",
	route: "/",
	environment: "preview",
	version: "abc123",
};

describe("performance PostgreSQL store", () => {
	it("inserts idempotently with parameterized SQL", async () => {
		const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
		const store = new PostgresPerformanceStore(
			{
				query: async (text, values) => {
					calls.push({ text, values });
					return { rows: [], rowCount: 1 };
				},
			},
			Date.now,
			"123",
		);
		await expect(store.insert(sample)).resolves.toBe("inserted");

		expect(calls[0]?.text).toContain("ON CONFLICT (event_id) DO NOTHING");
		expect(calls[0]?.text).toContain(
			'"babysteps_performance_123"."hourly_aggregates"',
		);
		expect(calls[0]?.text).not.toMatch(/babysteps_performance(?:\.|")/);
		expect(calls[0]?.text).toContain("FROM inserted");
		expect(calls[0]?.text).toContain("category, outcome");
		expect(calls[0]?.values).toContain(sample.eventId);
		expect(calls[0]?.text).not.toContain(sample.eventId);
	});

	it("queries only bounded allowlisted filters", async () => {
		const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
		const store = new PostgresPerformanceStore(
			{
				query: async (text, values) => {
					calls.push({ text, values });
					return {
						rows: [
							{
								bucketStart: sample.timestamp,
								type: sample.type,
								name: sample.name,
								unit: sample.unit,
								route: sample.route,
								environment: sample.environment,
								version: sample.version,
								timestamp: sample.timestamp,
								value: sample.value,
								category: null,
								outcome: null,
								totalCount: 1,
							},
						],
						rowCount: 1,
					};
				},
			},
			() => sample.timestamp + 3_600_000,
			"123",
		);
		const result = await store.query({
			window: "24h",
			route: "/",
			metric: "LCP",
			environment: "preview",
			version: "abc123",
		});

		expect(result).toHaveLength(1);
		expect(calls[0]?.text).toContain("bucket_start_ms >= $1");
		expect(calls[0]?.text).toContain("hourly_aggregates");
		expect(calls[0]?.text).toContain("LIMIT 10000");
		const sql = calls[0]?.text ?? "";
		expect(sql).toContain("LIMIT 10001");
		expect(sql.indexOf("LIMIT 10001")).toBeLessThan(
			sql.indexOf("COUNT(*) OVER ()"),
		);
		expect(sql.indexOf("COUNT(*) OVER ()")).toBeLessThan(
			sql.lastIndexOf("LIMIT 10000"),
		);
		expect(sql.slice(0, sql.indexOf("LIMIT 10001"))).not.toContain("ORDER BY");
		expect(calls[0]?.text).not.toContain("FROM babysteps_performance.events");
		expect(calls[0]?.values).toEqual(
			expect.arrayContaining(["/", "preview", "abc123"]),
		);
		expect(calls[0]?.values).not.toContain("LCP");
	});

	it("fails closed instead of reporting percentiles from a truncated window", async () => {
		const store = new PostgresPerformanceStore(
			{
				query: async () => ({
					rows: [
						{
							bucketStart: sample.timestamp,
							type: sample.type,
							name: sample.name,
							unit: sample.unit,
							route: sample.route,
							environment: sample.environment,
							version: sample.version,
							timestamp: sample.timestamp,
							value: sample.value,
							category: null,
							outcome: null,
							totalCount: 10_001,
						},
					],
					rowCount: 1,
				}),
			},
			() => sample.timestamp + 3_600_000,
			"123",
		);
		await expect(store.query({ window: "24h", metric: "LCP" })).rejects.toThrow(
			"STATISTICS_WINDOW_TOO_LARGE",
		);
	});

	it("filters individual values from the partially overlapping first hour", async () => {
		const now = sample.timestamp + 3_600_000;
		const store = new PostgresPerformanceStore(
			{
				query: async () => ({
					rows: [
						{
							bucketStart: sample.timestamp,
							type: sample.type,
							name: sample.name,
							unit: sample.unit,
							route: sample.route,
							environment: sample.environment,
							version: sample.version,
							timestamp: sample.timestamp + 1,
							value: 123,
							category: "image",
							outcome: "success",
							totalCount: 1,
						},
					],
					rowCount: 1,
				}),
			},
			() => now,
			"123",
		);

		const result = await store.query({ window: "1h", metric: "LCP" });
		expect(result).toEqual([
			expect.objectContaining({
				value: 123,
				category: "image",
				outcome: "success",
			}),
		]);
	});

	it("reports a duplicate event without updating aggregates", async () => {
		const store = new PostgresPerformanceStore(
			{
				query: async () => ({ rows: [], rowCount: 0 }),
			},
			Date.now,
			"456",
		);
		await expect(store.insert(sample)).resolves.toBe("deduplicated");
	});
});
