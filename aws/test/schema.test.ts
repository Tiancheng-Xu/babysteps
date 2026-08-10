import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	COMPLETION_SCHEMA_SQL,
	initializeCompletionSchema,
} from "../src/repositories/schema.js";

describe("completion database schema initialization", () => {
	it("keeps the runtime schema identical to the checked-in migration", async () => {
		const migration = await readFile(
			path.join(
				import.meta.dirname,
				"..",
				"migrations",
				"0001_completion_jobs.sql",
			),
			"utf8",
		);
		expect(COMPLETION_SCHEMA_SQL.trim()).toBe(migration.trim());
		expect(COMPLETION_SCHEMA_SQL).toMatch(
			/CREATE TABLE IF NOT EXISTS completion_jobs/i,
		);
		expect(COMPLETION_SCHEMA_SQL).toMatch(
			/CREATE TABLE IF NOT EXISTS webhook_nonces/i,
		);
	});

	it("applies the idempotent schema through the database boundary", async () => {
		const query = vi.fn(async () => ({ rows: [], rowCount: null }));
		await initializeCompletionSchema({ query });
		expect(query).toHaveBeenCalledOnce();
		expect(query).toHaveBeenCalledWith(COMPLETION_SCHEMA_SQL);
	});
});
