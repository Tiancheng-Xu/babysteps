# BabySteps Web3 Product Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every behavior change. This repository explicitly forbids creating a Codex worktree, so execute on the approved feature branch.

**Goal:** Close the V2 task review, purchased-content, and completion-to-SBT user flows without adding paid relayer infrastructure.

**Architecture:** React performs wallet transactions. Worker/D1 owns sanitized rich content and completion submissions, while Sepolia V2 remains authoritative for role, purchase, completion, and certificate facts.

**Tech Stack:** React, TypeScript, wagmi/viem, Hono, D1, Vitest, Solidity V2 contracts already deployed on Sepolia.

**Spec:** `docs/superpowers/specs/2026-08-20-web3-product-closure-design.md`

## Global Constraints

- Do not create a worktree, paid service, production deployment, or stored relayer private key.
- Do not expose `videoUrl` or `completionInstructions` from a public route.
- Do not store child PII; store only normalized text and evidence hashes.
- Treat chain reads as authority and fail closed when they are unavailable.
- Production release remains manual.

---

### Task 1: Purchased content boundary

**Files:** `worker/src/routes/tasks.ts`, `worker/test/tasks.test.ts`

- [ ] Add RED tests proving public detail redaction and session/purchase gating.
- [ ] Add `GET /api/tasks/:taskKey/content` with session and `purchaseIdForBuyer` verification.
- [ ] Run worker focused tests, typecheck, and check.

### Task 2: V2 Provider and Owner review

**Files:** `web/src/contracts/web3Contracts.ts`, `web/src/features/provider/useProviderTaskCreation.ts`, `web/src/features/provider/useOwnerTaskReview.ts`, `web/src/pages/ProviderConsolePage.tsx` and focused tests.

- [ ] Add RED ABI/hook/page tests for `requestTask`, `approveTask`, and `rejectTask`.
- [ ] Replace V1 creation with V2 request and metadata hash.
- [ ] Add Owner-only review controls with explicit task ID and rejection reason hash.
- [ ] Run focused web tests, typecheck, and check.

### Task 3: Completion submission and SBT confirmation

**Files:** `worker/migrations/0003_completion_submissions.sql`, Worker repository/routes/tests, Web API/hook/page/tests.

- [ ] Add RED Worker tests for purchase ownership, idempotency, conflict, Owner listing, and privacy validation.
- [ ] Add the D1 migration and completion repository/routes.
- [ ] Add RED Web tests for submission and Owner `confirmCompletion` transaction states.
- [ ] Implement buyer submission and Owner confirmation UI using the existing V2 contract.
- [ ] Run focused Worker/Web tests, typecheck, and check.

### Task 4: Evidence and release gates

**Files:** implementation map, Evidence content, architecture SVG, sequence SVG, `.tc-flow` evidence.

- [ ] Update only verified statuses and mark external role/deployment checks pending until observed.
- [ ] Run full tests, typecheck, build, public scans, link checks, and responsive checks.
- [ ] Run repository policy against the exact staged file set.
- [ ] Commit, push, and create a test PR; keep production manual-pending.
