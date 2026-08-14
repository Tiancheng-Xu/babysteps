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
		const store = new PostgresPerformanceStore({
			query: async (text, values) => {
				calls.push({ text, values });
				return { rows: [], rowCount: 1 };
			},
		});
		await store.insert(sample);

		expect(calls[0]?.text).toContain("ON CONFLICT (event_id) DO NOTHING");
		expect(calls[0]?.text).toContain("babysteps_performance.hourly_aggregates");
		expect(calls[0]?.text).toContain("FROM inserted");
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
								timestamps: [sample.timestamp],
								values: [sample.value],
							},
						],
						rowCount: 1,
					};
				},
			},
			() => sample.timestamp + 3_600_000,
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
							timestamps: Array.from(
								{ length: 10_001 },
								() => sample.timestamp,
							),
							values: Array.from({ length: 10_001 }, () => sample.value),
						},
					],
					rowCount: 1,
				}),
			},
			() => sample.timestamp + 3_600_000,
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
							timestamps: [sample.timestamp - 1, sample.timestamp + 1],
							values: [999, 123],
						},
					],
					rowCount: 1,
				}),
			},
			() => now,
		);

		const result = await store.query({ window: "1h", metric: "LCP" });
		expect(result.map(({ value }) => value)).toEqual([123]);
	});
});
