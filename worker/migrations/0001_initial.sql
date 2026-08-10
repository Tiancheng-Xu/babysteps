CREATE TABLE profiles (
	wallet TEXT PRIMARY KEY,
	username TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE auth_challenges (
	id TEXT PRIMARY KEY,
	wallet TEXT NOT NULL,
	action TEXT NOT NULL,
	nonce_hash TEXT NOT NULL UNIQUE,
	message TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	used_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	wallet TEXT NOT NULL,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at INTEGER NOT NULL,
	revoked_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE TABLE task_drafts (
	id TEXT PRIMARY KEY,
	provider_wallet TEXT NOT NULL,
	metadata_json TEXT NOT NULL,
	metadata_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE published_tasks (
	task_key TEXT PRIMARY KEY,
	draft_id TEXT NOT NULL UNIQUE REFERENCES task_drafts(id),
	chain_id INTEGER NOT NULL,
	marketplace_address TEXT NOT NULL,
	task_id TEXT NOT NULL,
	transaction_hash TEXT NOT NULL,
	metadata_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	UNIQUE(chain_id, marketplace_address, task_id)
);

CREATE TABLE comments (
	id TEXT PRIMARY KEY,
	task_key TEXT NOT NULL REFERENCES published_tasks(task_key),
	wallet TEXT NOT NULL,
	content TEXT NOT NULL,
	hidden_at INTEGER,
	hidden_by TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE audit_logs (
	id TEXT PRIMARY KEY,
	actor_wallet TEXT,
	action TEXT NOT NULL,
	resource_type TEXT NOT NULL,
	resource_id TEXT NOT NULL,
	detail_json TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX idx_challenges_lookup
	ON auth_challenges(wallet, action, expires_at, used_at);
CREATE INDEX idx_sessions_token
	ON sessions(token_hash, expires_at, revoked_at);
CREATE UNIQUE INDEX idx_published_chain_task
	ON published_tasks(chain_id, marketplace_address, task_id);
CREATE INDEX idx_comments_visible
	ON comments(task_key, hidden_at, created_at);
CREATE INDEX idx_audit_resource
	ON audit_logs(resource_type, resource_id, created_at);
