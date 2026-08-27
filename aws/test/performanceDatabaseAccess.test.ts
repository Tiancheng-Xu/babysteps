import { describe, expect, it } from "vitest";
import {
	cleanupPerformanceDatabase,
	initializePerformanceDatabase,
	performanceSchemaExists,
	performanceSchemaName,
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

		await initializePerformanceDatabase(database, "123", {
			username: "bs_perf_123",
			password: "private-password",
		});

		expect(calls.some(({ text }) => text.includes("CREATE ROLE"))).toBe(true);
		expect(calls.some(({ text }) => text.includes("GRANT USAGE"))).toBe(true);
		expect(calls.flatMap(({ values }) => values ?? [])).toContain(
			"bs_perf_123",
		);
		expect(calls.flatMap(({ values }) => values ?? [])).toContain(
			"babysteps_performance_123",
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

		await cleanupPerformanceDatabase(database, "123", "bs_perf_123");

		expect(calls[0]?.text).toContain("DROP SCHEMA");
		expect(calls.some(({ text }) => text.includes("DROP ROLE"))).toBe(true);
		expect(calls.flatMap(({ values }) => values ?? [])).toContain(
			"bs_perf_123",
		);
		expect(calls.flatMap(({ values }) => values ?? [])).toContain(
			"babysteps_performance_123",
		);
		expect(
			calls.find(({ text }) => text.includes("SELECT format"))?.text,
		).toMatch(/\$1::text/);
	});

	it("accepts numeric run IDs only and derives one exact schema", () => {
		expect(performanceSchemaName("123456")).toBe(
			"babysteps_performance_123456",
		);
		for (const invalid of ["", "e123", "123-x", "01;DROP SCHEMA public"]) {
			expect(() => performanceSchemaName(invalid)).toThrow("INVALID_RUN_ID");
		}
	});

	it("verifies schema presence through a parameterized catalog lookup", async () => {
		const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
		const database = {
			query: async (text: string, values?: readonly unknown[]) => {
				calls.push({ text, values });
				return { rows: [{ schemaOid: "1234" }], rowCount: 1 };
			},
		};
		await expect(performanceSchemaExists(database, "2468")).resolves.toBe(true);
		expect(calls[0]?.text).toContain("to_regnamespace");
		expect(calls[0]?.values).toEqual(["babysteps_performance_2468"]);
	});

	it("upgrades an existing run schema idempotently without losing rows", async () => {
		const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
		const database = {
			query: async (text: string, values?: readonly unknown[]) => {
				calls.push({ text, values });
				if (text.includes("FROM pg_roles"))
					return { rows: [{ exists: 1 }], rowCount: 1 };
				if (text.includes("SELECT format")) {
					const template = text.match(/SELECT format\('([^']+)'/)?.[1] ?? "";
					return {
						rows: [{ statement: `FORMATTED:${template}` }],
						rowCount: 1,
					};
				}
				return { rows: [], rowCount: 0 };
			},
		};

		await initializePerformanceDatabase(
			database,
			"987",
			{ username: "bs_perf_987", password: "private-password" },
			"CREATE SCHEMA IF NOT EXISTS babysteps_performance;\nALTER TABLE babysteps_performance.events ADD COLUMN IF NOT EXISTS category TEXT;",
		);

		const sql = calls.map(({ text }) => text).join("\n");
		expect(sql).not.toContain("DROP TABLE");
		expect(sql).not.toContain("TRUNCATE");
		expect(sql).toContain("babysteps_performance_987");
		expect(sql).not.toMatch(/babysteps_performance(?:\.|;)/);
	});

	it("verifies a real existing events table retains its rows across migration", async () => {
		let countReads = 0;
		const database = {
			query: async (text: string) => {
				if (text.includes("FROM pg_roles"))
					return { rows: [{ exists: 1 }], rowCount: 1 };
				if (text.includes("to_regclass"))
					return { rows: [{ eventsTable: "events" }], rowCount: 1 };
				if (text.includes("COUNT(*)")) {
					countReads += 1;
					return { rows: [{ count: "7" }], rowCount: 1 };
				}
				if (text.includes("SELECT format"))
					return { rows: [{ statement: "SAFE_FORMATTED_SQL" }], rowCount: 1 };
				return { rows: [], rowCount: 0 };
			},
		};

		await initializePerformanceDatabase(
			database,
			"654",
			{ username: "bs_perf_654", password: "private-password" },
			"ALTER TABLE babysteps_performance.events ADD COLUMN IF NOT EXISTS category TEXT;",
		);
		expect(countReads).toBe(2);
	});
});
