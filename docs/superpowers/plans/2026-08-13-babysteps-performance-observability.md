# BabySteps Performance Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a privacy-safe browser performance SDK, AWS asynchronous cleaner, real percentile dashboard, Evidence, and deterministic cost cleanup.

**Architecture:** Browser events travel through the existing same-origin Cloudflare Worker to an authenticated API Gateway/Lambda ingest endpoint, SQS/DLQ, an on-demand ECS Fargate cleaner, and an isolated schema in the shared PostgreSQL database. A query Lambda returns windowed aggregates to a responsive BabySteps dashboard; the workload stack is deleted after cloud Evidence is captured.

**Tech Stack:** React 19, TypeScript 6, PerformanceObserver/Web Vitals, Cloudflare Worker, AWS SAM/CloudFormation, API Gateway HTTP API, Lambda Node.js 22, SQS/DLQ, ECS Fargate, ECR, PostgreSQL, Vitest, GitHub Actions OIDC.

## Global Constraints

- No AWS credentials, Origin Token, Cookie, Authorization, request body, email, wallet signature, or full wallet address in browser events or Evidence.
- Reuse protected shared VPC, NAT, subnets, PostgreSQL, artifact bucket, and GitHub OIDC; never delete them from project cleanup.
- Do not create ALB, a second NAT/RDS, a permanent ECS service, SNS, Synthetics, Firehose, Glue, or Athena.
- Production release remains manual; cloud workload writes use GitHub Actions + OIDC only.
- Use real samples and real percentiles; fixture data is test-only and cannot be presented as cloud proof.

---

### Task 1: Browser SDK contract

**Files:**
- Create: `web/src/performance/types.ts`
- Create: `web/src/performance/sanitize.ts`
- Create: `web/src/performance/client.ts`
- Create: `web/src/performance/client.test.ts`
- Modify: `web/src/main.tsx`

**Interfaces:**
- Produces: `createPerformanceClient(options): PerformanceClient`, `markOperation(name, operation): Promise<T>`.
- Emits allowlisted `PerformanceEvent` batches to `/api/performance/events`.

- [ ] Write failing tests for metrics, privacy, batching, rate limit, Beacon/fetch fallback and silent failure.
- [ ] Run the focused test and confirm missing production APIs cause RED.
- [ ] Implement the smallest typed SDK satisfying those tests.
- [ ] Register it after the app mounts and keep initialization non-blocking.
- [ ] Run the focused and full Web suites.

### Task 2: Same-origin Worker proxy

**Files:**
- Create: `worker/src/performanceProxy.ts`
- Create: `worker/test/performanceProxy.test.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/wrangler.jsonc`

**Interfaces:**
- Consumes: browser `POST /api/performance/events` and dashboard `GET /api/performance/stats`.
- Produces: AWS requests with server-side `Origin Token` and propagated request ID.

- [ ] Write RED tests proving secrets stay server-side, methods/routes are bounded, and errors are safe.
- [ ] Implement proxy routing and configuration checks.
- [ ] Run Worker tests and production dry-run validation.

### Task 3: AWS ingest and query APIs

**Files:**
- Create: `performance/package.json`
- Create: `performance/src/schema.ts`
- Create: `performance/src/ingest.ts`
- Create: `performance/src/query.ts`
- Create: `performance/test/ingest.test.ts`
- Create: `performance/test/query.test.ts`

**Interfaces:**
- Ingest: validated batch -> SQS messages -> `202 {requestId, accepted}`.
- Query: filters -> `{window, sampleCount, percentiles, errorRate, trend, routes, slowRequests}`.

- [ ] Write RED tests for origin auth, batch limits, enums, age window and queue calls.
- [ ] Implement strict parsing and safe responses.
- [ ] Write RED tests proving weighted real-sample percentiles and filter handling.
- [ ] Implement parameterized PostgreSQL queries and empty-state behavior.
- [ ] Run package tests, typecheck and build.

### Task 4: ECS cleaner and storage migration

**Files:**
- Create: `performance/src/cleaner.ts`
- Create: `performance/src/storage.ts`
- Create: `performance/migrations/0001_performance.sql`
- Create: `performance/test/cleaner.test.ts`
- Create: `performance/test/storage.test.ts`
- Create: `performance/Dockerfile`

**Interfaces:**
- Consumes: SQS messages in batches.
- Produces: sanitized idempotent raw rows and queryable aggregate source rows in `babysteps_performance`.

- [ ] Write RED tests for PII redaction, route normalization, event-id dedupe and retry classification.
- [ ] Implement cleaner and repository boundaries.
- [ ] Write migration contract tests for isolated schema, unique event IDs and indexes.
- [ ] Build the ARM64-compatible container locally.

### Task 5: AWS IaC, OIDC workflows and cleanup gate

**Files:**
- Create: `performance/template.yaml`
- Create: `performance/buildspec.yml`
- Create: `.github/workflows/performance-preview.yml`
- Create: `.github/workflows/performance-cleanup.yml`
- Create: `scripts/validate-performance-infra.mjs`
- Create: `scripts/validate-performance-infra.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Stack inputs import shared foundation IDs and secret ARN.
- Cleanup accepts an exact stack name/preview ID and refuses protected resources.

- [ ] Write RED validator tests banning ALB/NAT/RDS/ECS Service and requiring DLQ, retention, tags, zero steady tasks and exact cleanup.
- [ ] Implement SAM/CloudFormation resources and least-privilege roles.
- [ ] Add manual GitHub OIDC deploy/verify/cleanup workflow with approval reference.
- [ ] Run SAM lint, Budget Guard and repository policy.

### Task 6: Performance Dashboard

**Files:**
- Create: `web/src/performance/api.ts`
- Create: `web/src/pages/PerformanceDashboardPage.tsx`
- Create: `web/src/pages/PerformanceDashboardPage.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/ProductNavigation.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `/api/performance/stats` filters and response.
- Produces: accessible metrics, trend, route comparison, errors and slow requests UI.

- [ ] Write RED tests for real-data provenance, sample count, p50/p75/p95, filters, refresh and unavailable state.
- [ ] Implement the page without demo fallback.
- [ ] Add route/navigation and responsive styles.
- [ ] Run Web tests, build and 375/390/430/1440 browser checks.

### Task 7: Evidence and diagrams

**Files:**
- Create: `docs/evidence/testing/2026-08-13-performance-observability.md`
- Create: `docs/architecture/starbuddy-performance-architecture.svg`
- Create: `docs/architecture/starbuddy-performance-sequence.svg`
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `web/src/pages/EvidencePage.tsx`
- Modify: `scripts/validate-delivery-evidence.mjs`
- Modify: `scripts/validate-delivery-evidence.test.mjs`

**Interfaces:**
- Maps requirement -> feature -> code -> proof -> status.
- Distinguishes local pass, cloud verified, paused and cleaned states.

- [ ] Write RED Evidence gate tests for architecture, sequence, trace, sample count, cost matrix and cleanup proof.
- [ ] Add diagrams, walkthrough, proof cards and responsive screenshots.
- [ ] Run Evidence, public-content and responsive gates.

### Task 8: Cloud verification and deterministic cleanup

**Files:**
- Update: `docs/evidence/testing/2026-08-13-performance-observability.md`
- Update: `.tc-flow/state.json`
- Update: `.tc-flow/events.jsonl`
- Create: `.tc-flow/run-result.json`

**Interfaces:**
- Deployment produces sanitized resource IDs and one controlled trace.
- Cleanup proves no running ECS task/schedule and no remaining project stack, while shared resources remain protected.

- [ ] Run full local tests, checks, typecheck, build, policy and Budget Guard.
- [ ] Commit and push the test branch; require remote CI and Cloudflare preview success.
- [ ] Deploy the project workload through GitHub OIDC and capture stack outputs.
- [ ] Send controlled real samples, run ECS cleaner, query Dashboard and verify DLQ behavior.
- [ ] Capture Evidence assets and checksums.
- [ ] Disable schedules, wait for zero running tasks, delete exact project stack/ECR/schema, and inventory cleanup.
- [ ] Update Evidence truthfully, rerun all gates and publish the final branch state without merging production.
