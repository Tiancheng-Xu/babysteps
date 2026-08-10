import type { SqlQueryable } from "./postgresCompletionJobs.js";

export const COMPLETION_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS completion_jobs (
  idempotency_key text PRIMARY KEY,
  purchase_id numeric(78, 0) NOT NULL UNIQUE,
  evidence_hash char(66) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'submitted', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  transaction_hash char(66),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_nonces (
  nonce_hash char(64) PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS webhook_nonces_expires_at_idx ON webhook_nonces (expires_at);
`;

export async function initializeCompletionSchema(database: SqlQueryable) {
	await database.query(COMPLETION_SCHEMA_SQL);
}
