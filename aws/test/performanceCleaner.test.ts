import { describe, expect, it } from "vitest";
import {
	classifyCleanerError,
	cleanPerformanceEvent,
} from "../src/performance/cleaner";

describe("performance cleaner", () => {
	it("normalizes routes and keeps only allowlisted fields", () => {
		const cleaned = cleanPerformanceEvent({
			eventId: "123e4567-e89b-42d3-a456-426614174000",
			timestamp: 1_786_600_000_000,
			type: "resource",
			name: "fetch.duration",
			value: 42,
			unit: "ms",
			category: "fetch",
			outcome: "unavailable",
			route: "/tasks/42?token=secret",
			environment: "preview",
			version: "abc123",
			authorization: "Bearer secret",
		});
		expect(cleaned.route).toBe("/tasks/:id");
		expect(cleaned.category).toBe("fetch");
		expect(cleaned.outcome).toBe("unavailable");
		expect(JSON.stringify(cleaned)).not.toContain("secret");
		expect(Object.keys(cleaned).sort()).toEqual(
			[
				"category",
				"environment",
				"eventId",
				"name",
				"outcome",
				"route",
				"timestamp",
				"type",
				"unit",
				"value",
				"version",
			].sort(),
		);
	});

	it("distinguishes retryable infrastructure errors from poison events", () => {
		expect(classifyCleanerError(new Error("ECONNRESET"))).toBe("retry");
		expect(classifyCleanerError(new Error("PERMANENT_SCHEMA_INVALID"))).toBe(
			"discard",
		);
	});
});

describe("performance cleaner execution summary", () => {
	it("stops polling before the workflow cleanup budget is exhausted", async () => {
		const { withinCleanerRuntime } = await import(
			"../src/performance/cleanerMain"
		);
		expect(withinCleanerRuntime(1_000, 180_000, 180_999)).toBe(true);
		expect(withinCleanerRuntime(1_000, 180_000, 181_000)).toBe(false);
	});

	it("prints exactly one sanitized JSON line with complete counters", async () => {
		const { formatCleanerSummary } = await import(
			"../src/performance/cleanerMain"
		);
		const line = formatCleanerSummary({
			processed: 3,
			inserted: 1,
			deduplicated: 1,
			discarded: 1,
			retryableFailures: 0,
			writeDurationMs: 12,
			durationMs: 34,
		});
		expect(line.endsWith("\n")).toBe(true);
		expect(line.trim().split("\n")).toHaveLength(1);
		expect(JSON.parse(line)).toEqual({
			processed: 3,
			inserted: 1,
			deduplicated: 1,
			discarded: 1,
			retryableFailures: 0,
			writeDurationMs: 12,
			durationMs: 34,
		});
		expect(line).not.toMatch(/secret|host|authorization|cookie|eventId|route/i);
	});
});
