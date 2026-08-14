import { describe, expect, it } from "vitest";
import {
	cleanupPerformanceDatabase,
	initializePerformanceDatabase,
} from "../src/performance/databaseAccess";

describe("performance database least privilege", () => {
	it("creates a parameter-formatted project role and grants only schema data access", async () => {
		const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
		const database = {
			query: async (text: string, values?: readonly unknown[]) => {
				calls.push({ text, values });
				if (text.includes("FROM pg_roles")) return { rows: [], rowCount: 0 };
				if (text.includes("SELECT format")) {
					return { rows: [{ statement: "SAFE_FORMATTED_SQL" }], rowCount: 1 };
				}
				return { rows: [], rowCount: 0 };
			},
		};

		await initializePerformanceDatabase(database, {
			username: "bs_perf_e123",
			password: "private-password",
		});

		expect(calls.some(({ text }) => text.includes("CREATE ROLE"))).toBe(true);
		expect(calls.some(({ text }) => text.includes("GRANT USAGE"))).toBe(true);
		expect(calls.flatMap(({ values }) => values ?? [])).toContain(
			"bs_perf_e123",
		);
		expect(calls.map(({ text }) => text).join("\n")).not.toContain(
			"private-password",
		);
		for (const { text } of calls.filter(({ text }) =>
			text.includes("SELECT format"),
		)) {
			expect(text).toMatch(/\$\d+::text/);
		}
	});

	it("drops both project schema and exact generated role during cleanup", async () => {
		const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
		const database = {
			query: async (text: string, values?: readonly unknown[]) => {
				calls.push({ text, values });
				if (text.includes("SELECT format")) {
					return { rows: [{ statement: "SAFE_DROP_ROLE" }], rowCount: 1 };
				}
				return { rows: [], rowCount: 0 };
			},
		};

		await cleanupPerformanceDatabase(database, "bs_perf_e123");

		expect(calls[0]?.text).toContain("DROP SCHEMA");
		expect(calls.some(({ text }) => text.includes("DROP ROLE"))).toBe(true);
		expect(calls.flatMap(({ values }) => values ?? [])).toContain(
			"bs_perf_e123",
		);
		expect(
			calls.find(({ text }) => text.includes("SELECT format"))?.text,
		).toMatch(/\$1::text/);
	});
});
