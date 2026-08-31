# Performance Control Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 BabySteps 固定性能 Runtime 在启动早期失败时仍可最小权限、可幂等、零残留地恢复，并消除定时/人工恢复回调的 Run lineage 竞争。

**Architecture:** 以现有 SSM cleanup marker 和 active-operation 为唯一 AWS 生命周期账本，新增严格枚举的 `databaseState` 与 `expectedWorkflowRunId`。Origin Secret 值读取只授予精确项目 Secret；清理拓扑按数据库是否曾访问分支，终止回调绑定持久化 predecessor，不改变 HMAC、operation 或 generation Gate。

**Tech Stack:** GitHub Actions YAML、Bash、Node.js `node:test`、AWS SAM/CloudFormation/IAM、SSM、Cloudflare Pages Git Integration。

**Spec:** `docs/superpowers/specs/2026-08-31-performance-control-recovery-contract.md`

## Global Constraints

- 禁止 dispatch AWS Runtime `start`；只运行本地测试、GitHub CI 和 Cloudflare Pages 发布。
- Origin Secret 权限只能是 exact project prefix 的 `DescribeSecret` + `GetSecretValue`。
- 共享 Secret、共享 Foundation 和 AWS Free 计划不得改变。
- 所有行为变更必须先出现预期 RED，再做最小 GREEN。

---

### Task 1: Exact Origin Secret Read Permission

**Files:**
- Modify: `scripts/performance-iam-contract.test.mjs`
- Modify: `aws/iam/performance-control-readback-policy.json`

**Interfaces:**
- Consumes: `performance-control-readback-policy.json` 的 IAM Statement 数组。
- Produces: `ReadExactPerformanceOriginSecret`，只覆盖 `babysteps-performance-origin-control-*`。

- [x] **Step 1: Write the failing IAM behavior test**

断言 DB Secret 只有 `DescribeSecret`，Origin Secret 同时具有 `DescribeSecret` 和 `GetSecretValue`，所有 Secret action 均不是通配符。

- [x] **Step 2: Run test to verify RED**

Run: `node --test scripts/performance-iam-contract.test.mjs`

Expected: FAIL，因为当前 policy 没有 `secretsmanager:GetSecretValue`。

- [x] **Step 3: Write minimal IAM implementation**

拆分 Secret metadata 与 exact Origin value 两个 Statement，不改其他资源和 action。

- [x] **Step 4: Run test to verify GREEN**

Run: `node --test scripts/performance-iam-contract.test.mjs`

Expected: PASS。

### Task 2: Persisted Database Lifecycle and Before-DB Cleanup

**Files:**
- Modify: `scripts/performance-lifecycle-contract.test.mjs`
- Modify: `.github/workflows/aws-performance-control.yml`

**Interfaces:**
- Consumes: SSM cleanup marker and active-operation JSON。
- Produces: `database_state` and `expected_workflow_run_id` outputs from `Resolve fixed action and expiry`。

- [x] **Step 1: Write failing lifecycle tests**

断言 start marker 写入 `before-database-access`，Schema 初始化成功后写入 `schema-initialized`；before-db stop/expiry 跳过 Secret、aggregate、Schema cleanup，但允许精确 delete + zero-residue。

- [x] **Step 2: Run tests to verify RED**

Run: `node --test scripts/performance-lifecycle-contract.test.mjs`

Expected: FAIL，指出缺少 database state 和 before-db 分支。

- [x] **Step 3: Implement minimal workflow branch**

在现有 marker 中持久化严格枚举状态；只按该状态控制 Secret、aggregate、Schema cleanup 和 stack deletion。

- [x] **Step 4: Run tests to verify GREEN**

Run: `node --test scripts/performance-lifecycle-contract.test.mjs`

Expected: PASS。

### Task 3: Recovery Lineage and Idempotent Terminal Callback

**Files:**
- Modify: `scripts/performance-lifecycle-contract.test.mjs`
- Modify: `.github/workflows/aws-performance-control.yml`

**Interfaces:**
- Consumes: active-operation `workflowRunId` and current `github.run_id`。
- Produces: terminal callback `workflowRunId=expected predecessor`，delivery id 仍绑定实际 producer Run。

- [x] **Step 1: Write failing lineage tests**

断言 start 把当前 Run 写入 active-operation；schedule/expiry 读取该 expected predecessor；stopped、idempotent-stopped 与 cleanup-required 回调使用该值，delivery id 继续使用当前 `GITHUB_RUN_ID`。

- [x] **Step 2: Run tests to verify RED**

Run: `node --test scripts/performance-lifecycle-contract.test.mjs`

Expected: FAIL，因为当前终止回调直接使用每个 producer 的 `github.run_id`。

- [x] **Step 3: Implement minimal lineage binding**

持久化并验证十进制 Run ID；控制面 callback 使用 expected predecessor，不改变 HMAC、operation、generation、timestamp 或 delivery id。

- [x] **Step 4: Run tests to verify GREEN**

Run: `node --test scripts/performance-lifecycle-contract.test.mjs scripts/aws-performance-control-state.test.mjs`

Expected: PASS。

### Task 4: Full Verification and Release

**Files:**
- Verify: all modified files and generated build output only。

**Interfaces:**
- Consumes: Tasks 1–3 green implementation。
- Produces: PR、main SHA、GitHub Actions results、Cloudflare deployment and production readback。

- [x] **Step 1: Run deterministic local gates**

Run IAM/lifecycle/pipeline validators, full validator suite, checks, tests, typecheck, build, IAM shared-resource gate, secret scan and git diff review.

- [ ] **Step 2: Commit and open PR**

Push the isolated branch, open a PR, and wait for required checks. Do not manually dispatch AWS performance workflows.

- [ ] **Step 3: Merge and verify publication**

After green checks, merge; verify main SHA, Actions, deployment-specific URL, Pages alias, production root and Evidence route. Treat automatic schedule runs as read-only/noop unless independently proven otherwise.

- [ ] **Step 4: Report executable boundary**

Return PR, SHA, Actions, Cloudflare deployment, tests, and the explicit statement that AWS Runtime remains stopped and awaits a separate user authorization.
