# Performance Sampling Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BabySteps fail before AWS when its controlled journey cannot produce required performance metrics, then prove and package the verified contract for other applications.

**Architecture:** The browser SDK owns honest metric production, an application-owned Journey Manifest owns product routes and interactions, and a generic journey runner owns coverage validation. The AWS workflow consumes the same required metric catalog, validates per-metric database samples, captures the complete sanitized query snapshot, and always performs exact project cleanup.

**Tech Stack:** React, TypeScript, Vite, web-vitals 5.1, Playwright, Node test runner, GitHub Actions, AWS HTTP API/Lambda/SQS/ECS Fargate/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-29-performance-sampling-coverage-design.md`

## Global Constraints

- No AWS resource may be created before the local journey coverage and AWS Budget Guard pass.
- Do not fabricate CLS, INP, navigation values, errors, long tasks, or blockchain transactions.
- Controlled-browser samples must remain labeled laboratory evidence, not field/RUM evidence.
- Reuse protected VPC, NAT, PostgreSQL, OIDC and artifact storage; project cleanup must never delete them.
- Do not modify `web/src/App.tsx`, `web/src/App 2.tsx`, user-owned untracked files, unrelated product UI, or fullstack-showcase performance-control code.
- Production merge and publication remain manual.

---

### Task 1: Browser SDK emits honest CLS and fast-interaction INP

**Files:**
- Modify: `web/src/performance/client.test.ts`
- Modify: `web/src/performance/client.ts`

**Interfaces:**
- Consumes: `web-vitals` callbacks and the existing `PerformanceClient` queue.
- Produces: CLS zero/nonzero samples and INP observations with `durationThreshold: 0` from real browser interactions.

- [x] **Step 1: Write failing tests**

Add tests that capture `onCLS` and `onINP` registration. Assert that INP receives `{ reportAllChanges: true, durationThreshold: 0 }`. Assert that a document hidden transition records one CLS=0 sample when `onCLS` produced no value, and does not duplicate CLS when the callback already reported a value.

- [x] **Step 2: Verify RED**

Run: `pnpm --filter @babysteps/web test -- client.test.ts`

Expected: FAIL because the existing client passes no options and has no final CLS zero fallback.

- [x] **Step 3: Implement minimal production behavior**

Track whether CLS has been reported. Keep `onCLS` and `onINP` at their final-value defaults so cumulative updates do not become duplicate samples; set INP `durationThreshold: 0`, and add a visibility-hidden finalizer registered after the web-vitals listeners. The finalizer records CLS=0 only when no CLS callback ran, then flushes the queue. Remove the listener in `stop()`.

- [x] **Step 4: Verify GREEN**

Run: `pnpm --filter @babysteps/web test -- client.test.ts`

Expected: all client tests pass with no unhandled timer or listener leakage.

### Task 2: Manifest-driven browser journey fails on missing required coverage

**Files:**
- Create: `scripts/performance-journey.manifest.json`
- Modify: `scripts/run-performance-browser-journey.mjs`
- Modify: `scripts/performance-pipeline-contract.test.mjs`

**Interfaces:**
- Consumes: a versioned manifest with route headings, representative interaction and required/unavailable metric names.
- Produces: a bounded summary with routes, observed/unavailable/missing coverage, accepted/rejected batch counts and deterministic failure codes.

- [x] **Step 1: Write failing journey contract tests**

Use literal fixtures to prove: missing CLS fails coverage; missing INP fails coverage; missing any required navigation phase fails coverage; exact required coverage passes; private URLs or payload fields never enter the sanitized summary.

- [x] **Step 2: Verify RED**

Run: `node --test scripts/performance-pipeline-contract.test.mjs`

Expected: FAIL because the existing runner accepts any nonzero event count.

- [x] **Step 3: Implement manifest validation and representative interaction**

Load the checked-in manifest. Visit its routes, assert headings, execute the declared performance-filter interaction on `/performance`, wait for the next paint, and capture telemetry response status. Reject invalid/missing routes, interaction assertions, non-2xx telemetry, or missing required metrics before writing a success artifact.

- [x] **Step 4: Verify GREEN and run a no-AWS browser probe**

Run the focused Node test, then run the journey against a local/production page with the telemetry endpoint intercepted to return 202. Assert the summary contains LCP, CLS, INP, FCP, TTFB and the required navigation phases.

### Task 3: AWS workflow verifies complete metric readback before Evidence

**Files:**
- Modify: `.github/workflows/aws-performance.yml`
- Modify: `aws/performance-template.yaml`
- Modify: `aws/src/performance/cleanerMain.ts`
- Modify: `aws/test/performanceCleaner.test.ts`
- Modify: `scripts/performance-pipeline-contract.test.mjs`
- Modify: `scripts/validate-performance-pipeline.mjs`

**Interfaces:**
- Consumes: `browser-journey.json`, cleaner summary, SQS/DLQ attributes and Query API statistics.
- Produces: `performance-stats.json` that passes an exact per-metric sample contract, plus truthful queue/cleaner evidence.

- [x] **Step 1: Write failing workflow contract tests**

Parse the workflow and assert the aggregate step validates every required vital and navigation metric by name and positive sample count, rejects DLQ messages, and records queue state. Assert one total-sample check is insufficient.

- [x] **Step 2: Verify RED**

Run: `node --test scripts/performance-pipeline-contract.test.mjs`

Expected: FAIL because the current workflow only sums all vital/navigation samples.

- [x] **Step 3: Implement minimal exact readback Gate**

Validate the required lists from the Journey Manifest against the Query API response, including unit, coverage and ordered finite p50/p75/p95 values. If a required metric is absent, fail before Dashboard capture and enter cleanup. Preserve the full sanitized response as Evidence. Keep the main queue and DLQ at zero; intercept Dashboard-only telemetry locally so Evidence capture cannot repopulate SQS. Bound the Cleaner to three minutes so GitHub's `always()` cleanup retains time to run.

- [x] **Step 4: Verify GREEN**

Run focused validators and the AWS unit suite. Confirm malformed/partial fixtures fail closed.

### Task 4: Feature QA before any AWS dispatch

**Files:**
- Modify only if tests expose a defect in Task 1-3 files.

- [x] Run `pnpm test:validators`.
- [x] Run `pnpm --filter @babysteps/web test`.
- [x] Run `pnpm --filter @babysteps/aws test`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm check` and `pnpm build`.
- [x] Run the no-AWS controlled-browser journey at 375/390/430/1440 where relevant; assert HTTP semantics, no root overflow and no page errors.
- [x] Run `pnpm validate:performance-budget` and the shared-resource AWS Budget Guard against the exact performance template and its unexpired exception.

### Task 5: One temporary AWS proof and immediate cleanup

**Files:**
- Create after the run: exact machine-readable Evidence under `docs/evidence/deployment/` and a Chinese walkthrough under `docs/evidence/testing/`.
- Modify: project Evidence mapping/page only after exact artifacts exist.

- [ ] Recheck identity, current monthly cost, Free-plan eligibility, no active project Stack/Run and shared protected resources.
- [ ] Trigger exactly one main-head `aws-performance.yml` run with its existing approval contract.
- [ ] Verify Browser → API/Lambda → SQS/DLQ → ECS Cleaner → PostgreSQL → Query/Dashboard for every required metric.
- [ ] Preserve run URL, exact SHA, artifact ID, full metric snapshot, screenshots/recording, cleaner counters and queue state.
- [ ] Verify schema deletion and project resource zero residue; if cleanup is uncertain, stop with `cleanup-required` and use only the fixed Recovery workflow.

### Task 6: Generalize only the verified capability

**Files in the shared policy repository:**
- Create: shared performance sampling standard and Journey Manifest schema.
- Create: reusable coverage validator.
- Modify: TC Flow local Gate and reusable GitHub Actions workflow inputs.
- Create: regression fixtures for BabySteps and one non-BabySteps application.

- [ ] Copy only the BabySteps behaviors proven by Task 5 into the shared contract.
- [ ] Keep application selectors and business interactions in application manifests.
- [ ] Run shared policy tests and old-project regressions.
- [ ] Mark each other application `pending` until its own manifest and local Gate pass; do not create its AWS runtime during synchronization.
