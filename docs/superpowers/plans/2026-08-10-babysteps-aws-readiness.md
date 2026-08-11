# BabySteps AWS Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and locally verify the BabySteps AWS readiness layer without creating AWS resources until the user authorizes service startup.

**Architecture:** A Cloudflare Worker sends an HMAC-authenticated completion request to API Gateway. A VPC Lambda atomically records the request in private PostgreSQL, uses an asymmetric KMS key to sign an Ethereum transaction, and reaches Sepolia through one NAT Gateway. Two CloudFormation templates separate free/low-idle-cost CI bootstrap resources from the runtime stack that creates NAT, RDS, KMS, Secrets Manager, API Gateway, and Lambda.

**Tech Stack:** TypeScript 6, Vitest, AWS SAM/CloudFormation, Node.js 22 Lambda, PostgreSQL/`pg`, AWS SDK v3, viem, GitHub Actions OIDC, CodeBuild Linux/Small, S3 source artifacts.

## Global Constraints

- Work directly in `/Users/shier/Desktop/babysteps`; do not create or switch Git/Codex worktrees.
- Do not create, start, update, or delete any AWS resource during local implementation.
- Runtime Region is `us-east-1`; stack name is `babysteps-readiness`.
- Runtime uses one NAT Gateway, Single-AZ `db.t4g.micro`, 20 GB gp3, one `ECC_SECG_P256K1` KMS key, and 7-day logs.
- Every managed resource carries `Project=babysteps`, `Environment=delivery-readiness`, `ManagedBy=cloudformation`, and `ExpiresAt`.
- RDS is private and only the Relayer security group can reach port `5432`.
- No private key, database password, RPC key, webhook secret, AWS credential, account ID, or private endpoint enters Git, logs, screenshots, or Evidence.
- AWS paid deployment remains blocked until a later explicit authorization.
- Do not mark AWS rows complete without a live Stack, CloudWatch evidence, a KMS-derived address, and a Sepolia transaction.

---

### Task 1: AWS workspace and runtime template contract

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `aws/package.json`
- Create: `aws/tsconfig.json`
- Create: `aws/vitest.config.ts`
- Create: `aws/test/template.test.ts`
- Create: `aws/template.yaml`

**Interfaces:**
- Consumes: the approved AWS resource contract in `docs/superpowers/specs/2026-08-10-babysteps-web3-delivery-completion-design.md`.
- Produces: `loadTemplate(): Record<string, unknown>` test helper and a SAM template containing the exact runtime resources and outputs used by later tasks.

- [ ] **Step 1: Add the package skeleton and a failing template test**

  Configure `@babysteps/aws` with `vitest run`, `tsc --noEmit`, Biome, and `sam validate --template-file template.yaml`. The first test loads `template.yaml` and asserts resources named `BabystepsVpc`, `NatGateway`, `Database`, `RelayerKey`, `CompletionApi`, and `RelayerFunction` exist with `Database.PubliclyAccessible === false`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `pnpm --filter @babysteps/aws test -- template.test.ts`

  Expected: FAIL because `aws/template.yaml` does not yet exist or lacks the asserted resources.

- [ ] **Step 3: Implement the minimum SAM template**

  Add parameters `EnvironmentName`, `ExpiresAt`, `DatabaseName`, `SepoliaRpcUrl`, and `MarketplaceAddress`. The on-chain `COMPLETION_RELAYER_ROLE` is granted to the address derived from KMS and is not an AWS ARN or CloudFormation parameter. Define two public and two private subnets across two AZs, one NAT/EIP, private route tables, Lambda/RDS security groups, a generated RDS Secret, private PostgreSQL, asymmetric KMS key, HTTP API, Lambda, and explicit 7-day log group. Export only non-secret identifiers.

- [ ] **Step 4: Verify GREEN and validate syntax**

  Run: `pnpm --filter @babysteps/aws test -- template.test.ts && sam validate --template-file aws/template.yaml`

- [ ] **Step 5: Commit**

  Commit message: `feat: define aws readiness runtime stack`

### Task 2: HMAC webhook authentication

**Files:**
- Create: `aws/src/auth/webhook.ts`
- Create: `aws/test/webhook.test.ts`

**Interfaces:**
- Consumes: headers `x-babysteps-timestamp`, `x-babysteps-nonce`, and `x-babysteps-signature` plus the raw request body.
- Produces: `verifyWebhook(input: WebhookInput, options: WebhookOptions): Promise<WebhookClaims>` and error codes `AUTH_MISSING`, `AUTH_EXPIRED`, `AUTH_REPLAYED`, `AUTH_INVALID`.

- [ ] **Step 1: Write failing tests**

  Assert that a valid `HMAC-SHA256(timestamp + "." + nonce + "." + rawBody)` passes, a signature mismatch fails, timestamps outside 300 seconds fail, and a nonce accepted once is rejected on replay.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @babysteps/aws test -- webhook.test.ts`

- [ ] **Step 3: Implement constant-time verification**

  Use Node `createHmac` and `timingSafeEqual`. Inject `now()` and a `NonceStore` so tests do not mock globals and the production store can use PostgreSQL.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm --filter @babysteps/aws test -- webhook.test.ts`

- [ ] **Step 5: Commit**

  Commit message: `feat: verify relayer webhook signatures`

### Task 3: Completion-job domain and PostgreSQL repository

**Files:**
- Create: `aws/src/domain/completionJob.ts`
- Create: `aws/src/repositories/completionJobs.ts`
- Create: `aws/src/repositories/postgresCompletionJobs.ts`
- Create: `aws/migrations/0001_completion_jobs.sql`
- Create: `aws/test/completionJob.test.ts`
- Create: `aws/test/postgresContract.test.ts`

**Interfaces:**
- Consumes: `{purchaseId: bigint, evidenceHash: Hex, idempotencyKey: string}`.
- Produces: `CompletionJobRepository.claim(input)` returning `claimed | existing | conflict`, `markSubmitted`, and `markFailed`; SQL tables `completion_jobs` and `webhook_nonces` with unique constraints.

- [ ] **Step 1: Write failing domain and SQL contract tests**

  Assert the same idempotency key and payload returns the existing job, a reused key with different payload conflicts, one purchase cannot mint twice, state transitions are `pending → submitted|failed`, and migration text contains unique indexes without child/user PII columns.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @babysteps/aws test -- completionJob.test.ts postgresContract.test.ts`

- [ ] **Step 3: Implement the domain and repository**

  Keep state transition logic pure. Use `INSERT ... ON CONFLICT` inside a transaction and query the existing row before deciding `existing` versus `conflict`. Parameterize every SQL value.

- [ ] **Step 4: Verify GREEN and typecheck**

  Run: `pnpm --filter @babysteps/aws test -- completionJob.test.ts postgresContract.test.ts && pnpm --filter @babysteps/aws typecheck`

- [ ] **Step 5: Commit**

  Commit message: `feat: persist idempotent completion jobs`

### Task 4: KMS-backed Ethereum signing adapter

**Files:**
- Create: `aws/src/signing/ethereumSigner.ts`
- Create: `aws/src/signing/kmsEthereumSigner.ts`
- Create: `aws/src/signing/derSignature.ts`
- Create: `aws/test/derSignature.test.ts`
- Create: `aws/test/kmsEthereumSigner.test.ts`

**Interfaces:**
- Consumes: an unsigned EIP-1559 transaction and a KMS key ID configured for `ECC_SECG_P256K1`/`SIGN_VERIFY`.
- Produces: `EthereumSigner.getAddress(): Promise<Address>` and `EthereumSigner.signTransaction(tx): Promise<Hex>`; the adapter calls `GetPublicKey` and calls `Sign` with `MessageType=DIGEST` plus `ECDSA_SHA_256` so KMS does not hash the Keccak-256 transaction digest again, then normalizes low-`s`, derives the recovery bit, and serializes a viem transaction.

- [ ] **Step 1: Write failing DER and address tests**

  Use fixed public DER fixtures and fixed KMS DER signature fixtures containing no secret key. Assert DER parsing, low-`s` normalization, Ethereum address derivation, recovery-bit selection, and that the serialized transaction recovers the expected public address.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @babysteps/aws test -- derSignature.test.ts kmsEthereumSigner.test.ts`

- [ ] **Step 3: Implement the signer**

  Keep AWS calls behind a narrow `KmsLike` interface. Never log KMS blobs, signatures, unsigned transaction bodies, RPC URLs, or key IDs.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm --filter @babysteps/aws test -- derSignature.test.ts kmsEthereumSigner.test.ts`

- [ ] **Step 5: Commit**

  Commit message: `feat: add kms ethereum signer adapter`

### Task 5: Lambda Relayer application and handler

**Files:**
- Create: `aws/src/application/confirmCompletion.ts`
- Create: `aws/src/chain/marketplaceClient.ts`
- Create: `aws/src/handler.ts`
- Create: `aws/test/confirmCompletion.test.ts`
- Create: `aws/test/handler.test.ts`

**Interfaces:**
- Consumes: authenticated completion payload, repository, signer, public Sepolia client, Marketplace ABI/address.
- Produces: HTTP `202` for a claimed job, `200` for the same completed/submitted job, `409` for payload conflicts, `401` for auth failure, and a transaction hash after `confirmCompletion(purchaseId,evidenceHash)` is broadcast.

- [ ] **Step 1: Write failing application tests**

  Cover first claim, exact replay, conflicting replay, reverted simulation, RPC timeout, successful broadcast, repository update failure, and redacted error output.

- [ ] **Step 2: Verify RED**

  Run: `pnpm --filter @babysteps/aws test -- confirmCompletion.test.ts handler.test.ts`

- [ ] **Step 3: Implement application and handler**

  Parse payloads with Zod. Simulate the contract call before signing, fetch nonce/fees/chain ID from Sepolia, sign once, broadcast once, and persist the hash. Return stable public error codes without internal messages.

- [ ] **Step 4: Verify GREEN, typecheck, and build**

  Run: `pnpm --filter @babysteps/aws test && pnpm --filter @babysteps/aws typecheck && pnpm --filter @babysteps/aws build`

- [ ] **Step 5: Commit**

  Commit message: `feat: add completion relayer lambda`

### Task 6: GitHub OIDC, S3 source, CodeBuild, and deployment gates

**Files:**
- Create: `aws/bootstrap.yaml`
- Create: `aws/buildspec.yml`
- Create: `aws/test/bootstrap.test.ts`
- Create: `.github/workflows/aws-readiness.yml`
- Create: `scripts/validate-aws-readiness.mjs`
- Create: `scripts/validate-aws-readiness.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: GitHub repository `Tiancheng-Xu/babysteps`, main or manually approved workflow, an OIDC provider ARN (existing or conditionally created), and a source zip uploaded by GitHub Actions.
- Produces: a bootstrap Stack with artifact bucket, OIDC deploy role, CodeBuild role/project, a workflow that uploads `git archive` output and triggers one Linux/Small build, and a validator that blocks paid deployment unless `ALLOW_AWS_PAID_DEPLOYMENT=true`.

- [ ] **Step 1: Write failing template/workflow gate tests**

  Assert OIDC trust limits `sub` to this repository, no long-lived AWS secret is referenced, CodeBuild concurrency is one, source is S3 override rather than a GitHub OAuth token, buildspec runs test/typecheck/SAM validation before deploy, and deploy exits before AWS writes without the explicit environment gate.

- [ ] **Step 2: Verify RED**

  Run: `pnpm test:validators -- validate-aws-readiness.test.mjs && pnpm --filter @babysteps/aws test -- bootstrap.test.ts`

- [ ] **Step 3: Implement bootstrap, workflow, and gate**

  Split IAM permissions into GitHub start-build/upload-source and CodeBuild CloudFormation deployment roles. Scope S3 prefixes and CloudFormation stack names. Do not create a webhook or schedule.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm validate:aws-readiness && pnpm test:validators && pnpm --filter @babysteps/aws test && sam validate --template-file aws/bootstrap.yaml && sam validate --template-file aws/template.yaml`

- [ ] **Step 5: Commit**

  Commit message: `ci: add gated aws readiness pipeline`

### Task 7: Architecture, mapping, and local Evidence

**Files:**
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`
- Modify: `docs/architecture.md`
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Create: `docs/evidence/testing/2026-08-10-aws-readiness-local.md`

**Interfaces:**
- Consumes: verified local command output and actual file paths from Tasks 1–6.
- Produces: an architecture view matching code, a sanitized local Evidence record, and mapping statuses that remain `partial/local verified` until live AWS evidence exists.

- [ ] **Step 1: Update the diagrams and proof matrix**

  Mark VPC/NAT/RDS/API/Lambda/KMS/CodeBuild as `本地 IaC 已验证，云端待部署`; show D1 versus RDS data ownership, trust boundaries, CI/CD, and cleanup flow.

- [ ] **Step 2: Run full verification**

  Run: `pnpm check && pnpm test && pnpm typecheck && pnpm build && pnpm validate:public-copy && pnpm validate:delivery-evidence && pnpm validate:aws-readiness`

- [ ] **Step 3: Record exact evidence**

  Save exact command counts and exit statuses, changed files, security assertions, cost assumptions, and the statement `no AWS resource was created or changed`.

- [ ] **Step 4: Run repository policy and secret scans**

  Run the configured local repository policy audit and inspect the sanitized diff. Stop on any secret, account identifier, private endpoint, or P0 finding.

- [ ] **Step 5: Commit**

  Commit message: `docs: record local aws readiness evidence`

## Deferred live deployment checkpoint

Do not execute this checkpoint now. When the user later authorizes service startup:

1. Resolve caller identity, account plan, Region, quotas, existing GitHub OIDC provider, and enabled Regions read-only.
2. Present the exact bootstrap/runtime resource manifest and current AWS price estimate.
3. Deploy bootstrap, run one CodeBuild, deploy runtime, and verify `API → Lambda → RDS`, `Lambda → NAT → Sepolia`, KMS address derivation, and one controlled Sepolia completion transaction.
4. Save sanitized CloudFormation, CodeBuild, HTTP, CloudWatch, RDS, KMS, transaction, architecture, and cost Evidence.
5. After the complete flow and Evidence pass, build the final cleanup manifest and obtain action-time confirmation before permanent deletion.
