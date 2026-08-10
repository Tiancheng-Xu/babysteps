# BabySteps Web3 Homework Phase 2 Worker/D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to implement this plan task by task, and `superpowers:test-driven-development` for every behavior change.

**Goal:** Build and locally verify the Cloudflare Worker/D1 boundary that joins on-chain task facts to off-chain task content, provides replay-safe wallet authentication, stores profiles, and permits comments only after an on-chain purchase check.

**Architecture:** React remains the browser client. A Hono Worker exposes focused route modules and uses a D1 binding for rich content, sessions, nonces, comments, and audit records. An injected viem-backed chain reader is the only boundary that reads `TaskMarketplaceV2`; D1 never claims ownership of price, task status, purchase, completion, or certificate facts. Published records use `chainId:marketplaceAddress:taskId` as the stable key. Phase 2 is local-only: it creates no remote D1 database, Worker deployment, DNS record, secret, or paid resource.

**Tech Stack:** Cloudflare Workers, Hono, D1, Wrangler, Cloudflare Vitest pool, TypeScript, viem, Zod, Web Crypto.

## Global constraints

- Work directly in `/Users/shier/Desktop/babysteps`; do not create or switch a worktree.
- Use `wrangler.jsonc`, the newest date supported by the installed Workerd runtime (`2026-08-08` at implementation time), `nodejs_compat`, observability, and generated Worker environment types.
- Access D1 only through the Worker binding. Do not use Cloudflare management REST APIs.
- Do not store credentials, RPC keys, signatures, raw session tokens, raw nonces, child names, birthdays, schools, locations, health data, feeding/sleep data, or child photos in D1.
- Use Web Crypto for UUIDs, nonces, and opaque session tokens. Store only SHA-256 hashes of nonce/session tokens.
- Keep request state local to each handler. Every promise must be awaited or explicitly passed to an execution-context lifetime mechanism.
- Return structured JSON errors with stable machine-readable codes. Do not expose stack traces or internal database errors.
- Public RPC URL, marketplace address, owner wallet, cookie domain, and allowed web origin are environment bindings; secrets are never committed.
- Tests inject a deterministic chain reader. Local verification must not write to Sepolia or Cloudflare.
- Every task ends with code/test evidence and one focused commit. Documentation may only mark externally deployed behavior complete after independent external verification.

---

### Task 1: Scaffold the Worker, D1 schema, and local test harness

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.jsonc`
- Create: `worker/vitest.config.ts`
- Create: `worker/test/apply-migrations.ts`
- Create: `worker/migrations/0001_initial.sql`
- Create: `worker/src/index.ts`
- Create: `worker/src/app.ts`
- Create: `worker/src/http/respond.ts`
- Create: `worker/test/health.test.ts`
- Generate: `worker/worker-configuration.d.ts`

**Schema contract:**

- `profiles(wallet PRIMARY KEY, username, created_at, updated_at)`
- `auth_challenges(id PRIMARY KEY, wallet, action, nonce_hash UNIQUE, message, expires_at, used_at, created_at)`
- `sessions(id PRIMARY KEY, wallet, token_hash UNIQUE, expires_at, revoked_at, created_at)`
- `task_drafts(id PRIMARY KEY, provider_wallet, metadata_json, metadata_hash, created_at, updated_at)`
- `published_tasks(task_key PRIMARY KEY, draft_id UNIQUE, chain_id, marketplace_address, task_id, transaction_hash, metadata_hash, created_at)`
- `comments(id PRIMARY KEY, task_key, wallet, content, hidden_at, hidden_by, created_at, updated_at)`
- `audit_logs(id PRIMARY KEY, actor_wallet, action, resource_type, resource_id, detail_json, created_at)`

All timestamps are integer Unix seconds. Add indexes for session token lookup, challenge lookup, published-task lookup, visible comments, and audit resource lookup. Enforce unique `(chain_id, marketplace_address, task_id)`.

**Step 1: Add the failing health/schema test**

Write a Cloudflare Vitest test that applies all migrations, calls `GET /api/health`, and queries `sqlite_master` to require all seven tables and the critical uniqueness/index constraints.

Run: `pnpm --filter @babysteps/worker test -- health.test.ts`

Expected: FAIL because the Worker package, app, and migration do not exist.

**Step 2: Add the minimal Worker package and configuration**

Add Hono, viem, and Zod runtime dependencies; add Wrangler, TypeScript, Vitest, Workers types, and the Cloudflare Vitest pool as development dependencies. Configure:

- `main: src/index.ts`
- `compatibility_date: 2026-08-08`, the newest date accepted by the installed Workerd runtime
- `compatibility_flags: ["nodejs_compat"]`
- local-development D1 binding named `DB`, with a non-production database identifier
- observability enabled
- no remote database operation

Add Worker scripts for `check`, `test`, `typecheck`, `build`, and `types`. Add the package to the workspace and include Worker gates in the root `check`, `test`, `typecheck`, and `build` scripts.

**Step 3: Add the migration and health route**

Implement `GET /api/health` as a side-effect-free endpoint returning:

```json
{"status":"ok","service":"babysteps-worker","schemaVersion":1}
```

Unknown routes return `404` with `{"error":{"code":"NOT_FOUND","message":"Route not found"}}`.

**Step 4: Generate types and run focused gates**

Run:

```bash
pnpm --filter @babysteps/worker types
pnpm --filter @babysteps/worker test -- health.test.ts
pnpm --filter @babysteps/worker typecheck
pnpm --filter @babysteps/worker build
```

Expected: generated `Env` binding types are used by the app; health/schema test, typecheck, and dry-run build pass.

**Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml worker
git commit -m "build: add worker d1 test harness"
```

---

### Task 2: Implement challenge-sign-verify sessions and profile updates

**Files:**

- Create: `worker/src/config.ts`
- Create: `worker/src/security/digests.ts`
- Create: `worker/src/security/random.ts`
- Create: `worker/src/auth/message.ts`
- Create: `worker/src/auth/session.ts`
- Create: `worker/src/repositories/authRepository.ts`
- Create: `worker/src/repositories/profileRepository.ts`
- Create: `worker/src/routes/auth.ts`
- Create: `worker/src/routes/profile.ts`
- Create: `worker/src/http/errors.ts`
- Modify: `worker/src/app.ts`
- Create: `worker/test/auth.test.ts`
- Create: `worker/test/profile.test.ts`

**API contract:**

- `POST /api/auth/challenges` body: `{wallet, action}`
- `POST /api/auth/sessions` body: `{challengeId, message, signature}`
- `POST /api/auth/logout`
- `GET /api/profile`
- `PUT /api/profile` body: `{username}`

Allowed actions are an explicit allowlist: `login`, `update-profile`, `create-task-draft`, `bind-task`, `create-comment`, `edit-comment`, and `moderate-comment`.

The challenge message includes application name, configured domain, URI, wallet, chain ID, nonce, action, issued-at, and expiry. Expiry is five minutes. The signature must recover the requested wallet. Challenge consumption uses a conditional update with `used_at IS NULL AND expires_at > now`; a second consumer receives `AUTH_CHALLENGE_USED`.

Successful login creates a cryptographically random 32-byte opaque token, stores only its SHA-256 hash, and returns an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie named `__Host-babysteps_session`. Session lifetime is 12 hours. Logout revokes it and expires the cookie.

Username rules: trim outer whitespace, 2–32 Unicode characters, no control characters, no HTML. Profile responses contain only wallet, username, and update timestamp.

**Step 1: Add failing challenge/session tests**

Use a deterministic viem test account to cover:

- valid challenge and signed login
- wrong wallet/signature
- altered action, domain, chain ID, message, or expiry
- expired challenge
- concurrent/repeated consumption
- cookie security attributes
- logout revocation
- no raw nonce/session token persisted

Run: `pnpm --filter @babysteps/worker test -- auth.test.ts`

Expected: FAIL because auth modules and routes do not exist.

**Step 2: Implement only enough auth behavior to pass**

Use `crypto.getRandomValues`, `crypto.subtle.digest`, viem address normalization, and viem message recovery. Parse environment values once per request through a typed config function; do not keep mutable request state globally.

Run the auth test until it passes.

**Step 3: Add failing profile tests**

Cover unauthenticated access, profile creation/update, validation limits, cookie lookup by token hash, expired/revoked sessions, and one audit row for each update.

Run: `pnpm --filter @babysteps/worker test -- profile.test.ts`

Expected: FAIL because profile routes are missing.

**Step 4: Implement profiles and audit writes**

Use an upsert keyed by normalized wallet. The audit detail may include old/new usernames but never the session token, signature, nonce, or full request headers.

**Step 5: Run focused gates and commit**

```bash
pnpm --filter @babysteps/worker test -- auth.test.ts profile.test.ts
pnpm --filter @babysteps/worker typecheck
pnpm --filter @babysteps/worker check
git add worker
git commit -m "feat: add replay safe wallet sessions"
```

---

### Task 3: Bind D1 task content to verified on-chain task facts

**Files:**

- Create: `worker/src/domain/taskIdentity.ts`
- Create: `worker/src/domain/taskMetadata.ts`
- Create: `worker/src/chain/marketplaceReader.ts`
- Create: `worker/src/chain/viemMarketplaceReader.ts`
- Create: `worker/src/repositories/taskRepository.ts`
- Create: `worker/src/routes/tasks.ts`
- Modify: `worker/src/app.ts`
- Create: `worker/test/taskIdentity.test.ts`
- Create: `worker/test/tasks.test.ts`

**Domain contract:**

```ts
type TaskKey = `${number}:0x${string}:${bigint}`;

type TaskMetadataInput = {
  title: string;
  description: string;
  coverUrl: string;
  videoUrl: string;
  completionInstructions: string;
  activityType: "Meal" | "Walk" | "Read";
};
```

Canonical metadata serializes exactly those fields in that fixed order after validation, then computes `keccak256(toBytes(canonicalJson))`. Only HTTPS URLs are accepted. Apply explicit maximum lengths to every text field and reject unknown fields so child PII cannot be added silently.

**Chain-reader contract:**

```ts
interface MarketplaceReader {
  hasProviderRole(wallet: `0x${string}`): Promise<boolean>;
  verifyTaskBinding(input: BindingInput): Promise<VerifiedTaskBinding>;
  readTask(taskKey: TaskKey): Promise<ChainTaskView>;
  purchaseIdForBuyer(taskKey: TaskKey, wallet: `0x${string}`): Promise<bigint>;
}
```

`verifyTaskBinding` must independently confirm the transaction receipt, `TaskRequested` event, Provider wallet, task ID, marketplace, chain ID, and metadata hash, then compare the current `getTask` result. A transaction hash submitted by the client is evidence to verify, not authority.

**API contract:**

- `POST /api/task-drafts` creates a provider-owned draft after session + on-chain Provider-role check
- `PUT /api/task-drafts/:draftId` edits an unbound provider-owned draft
- `POST /api/task-drafts/:draftId/bind` body: `{chainId, marketplaceAddress, taskId, transactionHash}`
- `GET /api/tasks/:taskKey` returns D1 rich content merged with current chain state

The bind operation is idempotent for the same draft, key, transaction, and hash. Any conflicting repeat returns `TASK_BINDING_CONFLICT` without overwriting the first valid record.

**Step 1: Add failing identity/metadata tests**

Cover address case normalization, chain/address/task collision resistance, deterministic JSON/hash, unknown-field rejection, URL validation, and text limits.

Run: `pnpm --filter @babysteps/worker test -- taskIdentity.test.ts`

Expected: FAIL because the domain modules do not exist.

**Step 2: Implement the pure domain functions**

Keep these functions independent from D1 and network access. Run the focused test until green.

**Step 3: Add failing draft/bind/read tests**

Inject a fake `MarketplaceReader` and cover:

- unauthenticated and non-Provider rejection
- Provider draft creation/update
- ownership isolation between Provider wallets
- metadata hash mismatch
- receipt/event/current-state mismatch
- successful bind and merged read
- identical bind retry
- conflicting draft/key/transaction retry
- audit rows without signatures or secrets

Run: `pnpm --filter @babysteps/worker test -- tasks.test.ts`

Expected: FAIL because the repository/routes are absent.

**Step 4: Implement repositories, routes, and viem adapter**

The real adapter reads the configured Sepolia RPC and `TaskMarketplaceV2` ABI. It performs read-only calls only. Route tests continue to use the fake adapter and never contact a public RPC.

**Step 5: Run focused gates and commit**

```bash
pnpm --filter @babysteps/worker test -- taskIdentity.test.ts tasks.test.ts
pnpm --filter @babysteps/worker typecheck
pnpm --filter @babysteps/worker check
git add worker
git commit -m "feat: bind task content to chain facts"
```

---

### Task 4: Gate comments by verified purchase and add Owner moderation

**Files:**

- Create: `worker/src/repositories/commentRepository.ts`
- Create: `worker/src/routes/comments.ts`
- Modify: `worker/src/app.ts`
- Create: `worker/test/comments.test.ts`

**API contract:**

- `GET /api/tasks/:taskKey/comments` publicly returns only non-hidden comments
- `POST /api/tasks/:taskKey/comments` creates a comment for the signed-in purchasing wallet
- `PUT /api/comments/:commentId` edits the author's visible comment
- `POST /api/comments/:commentId/hide` soft-hides a comment for the configured Owner wallet

Comment content is trimmed, 1–500 Unicode characters, and returned as plain data for React escaping. D1 does not store rendered HTML. Before every comment creation, the Worker calls `purchaseIdForBuyer(taskKey, wallet)` and requires a non-zero purchase ID. Session ownership alone is insufficient.

Owner moderation requires both a valid session and equality with the configured Owner address. It never deletes the row; it records `hidden_at`, `hidden_by`, and an audit entry. Authors cannot edit a hidden comment.

**Step 1: Add failing comment tests**

Cover:

- public empty/list read
- unauthenticated write
- signed-in wallet without purchase
- purchaser comment creation
- wrong author edit
- control characters/empty/over-limit content
- hidden comments absent from public list
- non-Owner hide rejection
- Owner soft hide and audit
- chain reader errors mapped to `CHAIN_READ_UNAVAILABLE`, not false authorization

Run: `pnpm --filter @babysteps/worker test -- comments.test.ts`

Expected: FAIL because comment modules/routes do not exist.

**Step 2: Implement comment repository and routes**

Use stable error codes and structured logs containing request ID, route, result, and duration. Do not log cookie, signature, username, comment text, RPC credentials, or database statements.

**Step 3: Run focused and Worker-wide gates**

```bash
pnpm --filter @babysteps/worker test
pnpm --filter @babysteps/worker check
pnpm --filter @babysteps/worker typecheck
pnpm --filter @babysteps/worker build
```

Expected: all Worker tests, formatting/lint, types, and dry-run build pass with no external writes.

**Step 4: Commit**

```bash
git add worker
git commit -m "feat: gate comments by chain purchase"
```

---

### Task 5: Update architecture, homework mapping, and Phase 2 evidence

**Files:**

- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`
- Modify: `docs/homework/web3-homework-implementation-map.md`
- Create: `docs/evidence/testing/2026-08-10-worker-d1.md`
- Modify: `scripts/validate-homework-evidence.mjs`
- Modify: `scripts/validate-homework-evidence.test.mjs`

**Step 1: Add a failing evidence assertion**

Extend the evidence validator to require:

- Phase 2 evidence file
- stable task-key definition
- auth replay test evidence
- D1 migration test evidence
- purchase-gated comment test evidence
- explicit `local only / no remote D1 or Worker deployment` boundary
- architecture status `Worker/D1 本地已验证` and external status still `待部署`

Run: `pnpm test:validators`

Expected: FAIL before the documentation is updated.

**Step 2: Record only measured evidence**

The Phase 2 evidence must include exact commands and counts from the final run, changed code locations, the D1 tables, auth threat controls, reference architecture decisions, known limitations, and a statement that no Cloudflare/AWS/Sepolia write occurred.

Update the homework map rows for requirement 1 and requirement 7. Mark Worker/D1 local behavior as `partial/local verified`, not deployed or complete. Keep Uniswap, Privy UI, Lambda/KMS, RPC comparison, and The Graph pending.

**Step 3: Run the complete repository gate**

```bash
pnpm test
pnpm check
pnpm typecheck
pnpm build
pnpm validate:public-artifact
git diff --check
git status --short
```

Expected:

- Validators pass
- Contract suite remains green
- Frontend suite remains green
- Worker suite is green
- Typecheck and production/dry-run builds pass
- Public artifact and repository scans expose no secrets, personal paths, or private data
- Only intentional documentation/evidence changes remain before commit

**Step 4: Commit**

```bash
git add docs scripts
git commit -m "docs: record worker d1 homework evidence"
```

## Phase 2 completion criteria

Phase 2 is complete only when all five tasks are committed and the full repository gate passes. The deliverable then proves local Worker/D1 behavior for:

1. deterministic chain/D1 task identity and metadata hashing
2. replay-safe challenge-sign-verify sessions
3. authenticated username updates
4. Provider-only draft creation and verified on-chain binding
5. purchaser-only comments and Owner soft moderation
6. migrations, structured errors, audit records, and sanitized evidence

Phase 2 does **not** prove a remote Worker/D1 deployment, Privy UI integration, AWS KMS/Lambda signing, Uniswap liquidity, V2 Sepolia deployment, IPFS publication, Infura/Alchemy comparison, or The Graph indexing. Those remain separate authorized phases with their own tests and external evidence.
