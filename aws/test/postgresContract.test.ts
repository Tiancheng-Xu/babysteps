import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	PostgresCompletionJobs,
	PostgresNonceStore,
	type SqlClient,
	type SqlPool,
} from "../src/repositories/postgresCompletionJobs.js";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

class ScriptedClient implements SqlClient {
	readonly calls: Array<{ text: string; values?: readonly unknown[] }> = [];
	readonly results: QueryResult[];
	released = false;

	constructor(results: QueryResult[]) {
		this.results = [...results];
	}

	async query(text: string, values?: readonly unknown[]) {
		this.calls.push({ text, values });
		return this.results.shift() ?? { rows: [], rowCount: 0 };
	}

	release() {
		this.released = true;
	}
}

function poolFor(client: ScriptedClient): SqlPool {
	return {
		connect: async () => client,
		query: (text, values) => client.query(text, values),
	};
}

describe("PostgreSQL completion contract", () => {
	it("keeps bounded business performance events valid in raw and aggregate storage", async () => {
		const migration = await readFile(
			path.join(
				import.meta.dirname,
				"..",
				"migrations",
				"0002_performance.sql",
			),
			"utf8",
		);

		expect(migration).toMatch(
			/events[\s\S]*type\s+text\s+not null check \(type in \([^)]*'business'/i,
		);
		expect(migration).toMatch(
			/hourly_aggregates[\s\S]*type\s+text\s+not null check \(type in \([^)]*'business'/i,
		);
		expect(migration).toMatch(/performance_events_type_allowed/i);
		expect(migration).toMatch(/performance_aggregates_type_allowed/i);
	});

	it("declares unique idempotency, purchase, and nonce constraints without child PII", async () => {
		const migration = await readFile(
			path.join(
				import.meta.dirname,
				"..",
				"migrations",
				"0001_completion_jobs.sql",
			),
			"utf8",
		);

		expect(migration).toMatch(/idempotency_key\s+text\s+primary key/i);
		expect(migration).toMatch(
			/purchase_id\s+numeric\(78,\s*0\)\s+not null\s+unique/i,
		);
		expect(migration).toMatch(/nonce_hash\s+char\(64\)\s+primary key/i);
		expect(migration).toMatch(
			/check\s*\(status in \('pending', 'submitted', 'failed'\)\)/i,
		);
		expect(migration).not.toMatch(
			/child|baby_name|parent|email|phone|username/i,
		);
	});

	it("claims with parameterized SQL inside one transaction", async () => {
		const row = {
			idempotency_key: "completion-7-v1",
			purchase_id: "7",
			evidence_hash: `0x${"ab".repeat(32)}`,
			status: "pending",
			attempt_count: 1,
			transaction_hash: null,
			error_code: null,
		};
		const client = new ScriptedClient([
			{ rows: [], rowCount: 0 },
			{ rows: [row], rowCount: 1 },
			{ rows: [], rowCount: 0 },
		]);
		const repository = new PostgresCompletionJobs(poolFor(client));

		await expect(
			repository.claim({
				purchaseId: 7n,
				evidenceHash: row.evidence_hash as `0x${string}`,
				idempotencyKey: row.idempotency_key,
			}),
		).resolves.toMatchObject({ kind: "claimed", job: { purchaseId: 7n } });

		expect(client.calls.map(({ text }) => text.trim().split(/\s+/)[0])).toEqual(
			["BEGIN", "INSERT", "COMMIT"],
		);
		expect(client.calls[1]?.values).toEqual([
			"completion-7-v1",
			"7",
			row.evidence_hash,
		]);
		expect(client.released).toBe(true);
	});

	it("stores only a hash of a consumed webhook nonce", async () => {
		const client = new ScriptedClient([{ rows: [], rowCount: 1 }]);
		const nonceStore = new PostgresNonceStore(poolFor(client));
		await expect(
			nonceStore.consume(
				"raw-nonce-must-not-be-stored",
				new Date("2026-08-10T18:05:00Z"),
			),
		).resolves.toBe(true);

		expect(client.calls[0]?.text).toContain("nonce_hash");
		expect(client.calls[0]?.values?.[0]).toMatch(/^[0-9a-f]{64}$/);
		expect(client.calls[0]?.values).not.toContain(
			"raw-nonce-must-not-be-stored",
		);
	});
});
