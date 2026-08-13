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
			route: "/tasks/42?token=secret",
			environment: "preview",
			version: "abc123",
			authorization: "Bearer secret",
		});
		expect(cleaned.route).toBe("/tasks/:id");
		expect(JSON.stringify(cleaned)).not.toContain("secret");
		expect(Object.keys(cleaned).sort()).toEqual(
			[
				"environment",
				"eventId",
				"name",
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
