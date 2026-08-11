import { createHash } from "node:crypto";
import type { NonceStore } from "../auth/webhook.js";
import {
	type CompletionJob,
	type CompletionJobInput,
	type CompletionJobStatus,
	decideClaim,
	type Hex,
} from "../domain/completionJob.js";
import type { ClaimResult, CompletionJobRepository } from "./completionJobs.js";

export type SqlResult = {
	rows: Record<string, unknown>[];
	rowCount: number | null;
};

export interface SqlQueryable {
	query(text: string, values?: readonly unknown[]): Promise<SqlResult>;
}

export interface SqlClient extends SqlQueryable {
	release(): void;
}

export interface SqlPool extends SqlQueryable {
	connect(): Promise<SqlClient>;
}

const RETURNING_COLUMNS = `
	idempotency_key,
	purchase_id,
	evidence_hash,
	status,
	attempt_count,
	transaction_hash,
	error_code
`;

export class PostgresCompletionJobs implements CompletionJobRepository {
	constructor(private readonly pool: SqlPool) {}

	async claim(input: CompletionJobInput): Promise<ClaimResult> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const inserted = await client.query(
				`INSERT INTO completion_jobs (
					idempotency_key, purchase_id, evidence_hash, status,
					attempt_count, created_at, updated_at
				) VALUES ($1, $2, $3, 'pending', 1, NOW(), NOW())
				ON CONFLICT DO NOTHING
				RETURNING ${RETURNING_COLUMNS}`,
				[input.idempotencyKey, input.purchaseId.toString(), input.evidenceHash],
			);

			if (inserted.rowCount === 1 && inserted.rows[0]) {
				const job = mapRow(inserted.rows[0]);
				await client.query("COMMIT");
				return { kind: "claimed", job };
			}

			const existing = await client.query(
				`SELECT ${RETURNING_COLUMNS}
				 FROM completion_jobs
				 WHERE idempotency_key = $1 OR purchase_id = $2
				 FOR UPDATE`,
				[input.idempotencyKey, input.purchaseId.toString()],
			);
			const jobs = existing.rows.map(mapRow);
			const decision = decideClaim(input, jobs);
			await client.query("COMMIT");
			if (decision.kind === "claimed") {
				throw new Error("CLAIM_STATE_INCONSISTENT");
			}
			return decision;
		} catch (error) {
			await client.query("ROLLBACK").catch(() => undefined);
			throw error;
		} finally {
			client.release();
		}
	}

	async markSubmitted(
		idempotencyKey: string,
		transactionHash: Hex,
	): Promise<void> {
		await this.updatePending(
			idempotencyKey,
			"submitted",
			transactionHash,
			null,
		);
	}

	async markFailed(idempotencyKey: string, errorCode: string): Promise<void> {
		await this.updatePending(idempotencyKey, "failed", null, errorCode);
	}

	private async updatePending(
		idempotencyKey: string,
		status: Exclude<CompletionJobStatus, "pending">,
		transactionHash: Hex | null,
		errorCode: string | null,
	) {
		const result = await this.pool.query(
			`UPDATE completion_jobs
			 SET status = $2, transaction_hash = $3, error_code = $4,
			     attempt_count = attempt_count + 1, updated_at = NOW()
			 WHERE idempotency_key = $1 AND status = 'pending'`,
			[idempotencyKey, status, transactionHash, errorCode],
		);
		if (result.rowCount !== 1) throw new Error("INVALID_TRANSITION");
	}
}

export class PostgresNonceStore implements NonceStore {
	constructor(private readonly database: SqlQueryable) {}

	async consume(nonce: string, expiresAt: Date): Promise<boolean> {
		const nonceHash = createHash("sha256").update(nonce).digest("hex");
		const result = await this.database.query(
			`WITH expired AS (
				DELETE FROM webhook_nonces WHERE expires_at <= NOW()
			)
			INSERT INTO webhook_nonces (nonce_hash, expires_at)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
			RETURNING nonce_hash`,
			[nonceHash, expiresAt],
		);
		return result.rowCount === 1;
	}
}

function mapRow(row: Record<string, unknown>): CompletionJob {
	const status = row.status;
	if (status !== "pending" && status !== "submitted" && status !== "failed") {
		throw new Error("INVALID_JOB_STATUS");
	}

	return {
		idempotencyKey: String(row.idempotency_key),
		purchaseId: BigInt(String(row.purchase_id)),
		evidenceHash: String(row.evidence_hash) as Hex,
		status,
		attemptCount: Number(row.attempt_count),
		transactionHash: row.transaction_hash
			? (String(row.transaction_hash) as Hex)
			: null,
		errorCode: row.error_code ? String(row.error_code) : null,
	};
}
