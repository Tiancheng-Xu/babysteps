CREATE TABLE completion_submissions (
	id TEXT PRIMARY KEY,
	task_key TEXT NOT NULL REFERENCES published_tasks(task_key),
	purchase_id TEXT NOT NULL UNIQUE,
	buyer_wallet TEXT NOT NULL,
	evidence_text TEXT NOT NULL,
	evidence_hash TEXT NOT NULL,
	certificate_uri TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX idx_completion_submissions_created
	ON completion_submissions(created_at DESC);
