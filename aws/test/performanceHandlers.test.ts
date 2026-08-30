import { describe, expect, it, vi } from "vitest";
import {
	createPerformanceIngestHandler,
	createPerformanceQueryHandler,
} from "../src/performance/handlers";

const body = JSON.stringify({
	schemaVersion: 1,
	events: [
		{
			eventId: "123e4567-e89b-42d3-a456-426614174000",
			timestamp: 1_786_600_000_000,
			type: "metric",
			name: "LCP",
			value: 100,
			unit: "ms",
			route: "/",
			environment: "preview",
			version: "abc123",
		},
	],
});

describe("performance Lambda adapters", () => {
	it("returns 202 only after enqueue succeeds", async () => {
		const enqueueBatch = vi.fn(async () => undefined);
		const handler = createPerformanceIngestHandler({
			originToken: "token",
			enqueueBatch,
			now: () => 1_786_600_001_000,
		});
		const response = await handler({
			body,
			headers: { "x-babysteps-origin-token": "token" },
			isBase64Encoded: false,
		});
		expect(response.statusCode).toBe(202);
		expect(JSON.parse(response.body)).toEqual({
			accepted: 1,
			eventIds: ["123e4567-e89b-42d3-a456-426614174000"],
		});
	});

	it("returns the full dashboard contract without fixtures", async () => {
		const query = vi.fn(async () => [JSON.parse(body).events[0]]);
		const handler = createPerformanceQueryHandler({
			originToken: "token",
			query,
			now: () => 1_786_600_001_000,
		});
		const response = await handler({
			headers: { "x-babysteps-origin-token": "token" },
			rawPath: "/stats",
			queryStringParameters: { window: "24h" },
		});
		expect(response.statusCode).toBe(200);
		const result = JSON.parse(response.body);
		expect(
			result.vitals.find(({ name }: { name: string }) => name === "LCP"),
		).toMatchObject({ sampleCount: 1, p75: 100 });
		expect(result).toMatchObject({
			window: "24h",
			filters: { window: "24h" },
			pipeline: { status: "unavailable", source: "database-only" },
			freshness: {
				observedAt: 1_786_600_001_000,
				latestSampleAt: 1_786_600_000_000,
				source: "live-api",
				mode: "live",
			},
		});
		expect(result.observedRoutes).toEqual([
			{
				route: "/",
				sampleCount: 1,
				latestSampleAt: 1_786_600_000_000,
			},
		]);
	});

	it("returns a versioned all-metric overview for snapshot generation", async () => {
		const events = [
			JSON.parse(body).events[0],
			{
				...JSON.parse(body).events[0],
				eventId: "123e4567-e89b-42d3-a456-426614174001",
				type: "error",
				name: "javascript.error",
				unit: "count",
				value: 1,
			},
		];
		const handler = createPerformanceQueryHandler({
			originToken: "token",
			query: vi.fn(async () => events),
			now: () => 1_786_603_600_000,
		});
		const response = await handler({
			headers: { "x-babysteps-origin-token": "token" },
			rawPath: "/stats",
			queryStringParameters: { window: "1h", metric: "all" },
		});
		const overview = JSON.parse(response.body);
		expect(overview).toMatchObject({
			schemaVersion: "performance-overview/v2",
			window: { preset: "1h" },
			summary: { totalEvents: 2, errorCount: 1, metricCount: 2 },
		});
		expect(overview.metrics).toHaveLength(2);
	});

	it("rejects direct unauthenticated statistics reads", async () => {
		const handler = createPerformanceQueryHandler({
			originToken: "token",
			query: vi.fn(async () => []),
		});
		const response = await handler({
			headers: {},
			rawPath: "/stats",
			queryStringParameters: {},
		});
		expect(response.statusCode).toBe(401);
	});
});
