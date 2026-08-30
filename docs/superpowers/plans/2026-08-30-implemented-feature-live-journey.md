# BabySteps 已实现功能真实全旅程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过当前产品 UI 真实执行 BabySteps 已实现功能，在 Sepolia、Worker/D1 与一次性 AWS 性能管线中形成同一提交、同一 Journey ID、可清理且可公开复核的证据。

**Architecture:** 保留现有 React/Vite/Worker/AWS 边界，在性能客户端新增低基数 `business` 操作事件；浏览器执行器只编排公开 UI，不直接调用合约或业务 API。执行顺序为本地确定性 Gate、Sepolia 只读预检、可见钱包旅程、一次 AWS Live、Evidence/录屏、精确清理与发布；任一 Gate 失败均停止后续写操作。

**Tech Stack:** React 19、TypeScript、Vite、Viem/Wagmi、Privy、Cloudflare Worker/D1、Playwright、Node test/Vitest、AWS SAM/CloudFormation/SQS/ECS/PostgreSQL、BackstopJS 等价视觉 Gate。

**Spec:** `docs/superpowers/specs/2026-08-30-implemented-feature-live-journey-design.md`

## Global Constraints

- 只覆盖规格矩阵中当前已有 UI 的功能；不实现 Provider 草稿、任务详情/评论、家长独立总览、购买抽屉自动兑换、Agent Market 仲裁或 Cocos。
- 所有链上写操作仅限 Sepolia `chainId=11155111` 的专用测试身份和最小测试资产；主网交易数必须为 0。
- 浏览器执行器不得读取、传递或记录私钥、助记词、Cookie、Token、完整地址、签名材料或 Secret Value。
- 钱包签名由用户在可见钱包界面确认；脚本不得调用隐藏 RPC 或直接写合约绕过 UI。
- AWS 只能创建 `babysteps-performance-*` 一次性项目资源；不得修改共享 VPC、NAT、RDS、ALB、OIDC 或 Free 计划。
- 只有 Stack absent、项目资源 0、SQS/DLQ 0、Schema absent、共享 Foundation protected 同时成立，才可宣称清理完成。
- 每个指标记录来源、route、environment、version、窗口、设备/限速、sampleCount、p50/p75/p95、采集时间和 freshness；受控浏览器不得冒充 RUM。
- 视觉 Gate 固定 375/390/430/1440，要求根级横向溢出为 0、pageerror 为 0；Backstop 差异必须人工检查，不盲目批准基线。
- 保护用户的 `worker/.wrangler/` 未跟踪目录；任何提交都不得暂存它。

---

### Task 1: 修复显式不可用导航阶段的云端聚合契约

**Files:**
- Modify: `web/src/performance/client.ts`
- Modify: `web/src/performance/client.test.ts`
- Modify: `scripts/run-performance-browser-journey.mjs`
- Modify: `aws/src/performance/pipeline.ts`
- Modify: `aws/test/performancePipeline.test.ts`
- Modify: `aws/migrations/0002_performance.sql`
- Modify: `aws/test/postgresContract.test.ts`
- Modify: `web/src/performance/api.ts`
- Modify: `web/src/performance/api.test.ts`
- Modify: `web/src/performance/verifiedObservation.ts`
- Modify: `web/src/pages/PerformanceDashboardPage.tsx`
- Modify: `web/src/pages/PerformanceDashboardPage.test.tsx`
- Modify: `scripts/validate-performance-readback.mjs`
- Modify: `scripts/performance-pipeline-contract.test.mjs`
- Create: `docs/evidence/testing/2026-08-30-performance-readback-unavailable.md`

**Interfaces:**
- Consumes: `PerformanceEvent.outcome: "unavailable"` 与 Manifest 的 `unavailableMetrics`。
- Produces: `computePerformanceDashboard(events)` 对 DNS/TCP/TLS 返回 `sampleCount=0`、空分位数以及 `coverage/status="unavailable"`；`validatePerformanceReadback()` 接受这一精确形状。

- [x] **Step 1: 写入真实失败回归测试**

```ts
it("preserves unavailable DNS TCP and TLS through aggregate coverage", () => {
  const dashboard = computePerformanceDashboard([
    event({ name: "navigation.dns", outcome: "unavailable", value: 0 }),
    event({ name: "navigation.tcp", outcome: "unavailable", value: 0 }),
    event({ name: "navigation.tls", outcome: "unavailable", value: 0 }),
  ]);
  for (const name of ["navigation.dns", "navigation.tcp", "navigation.tls"]) {
    expect(dashboard.navigation.find((item) => item.name === name)).toMatchObject({
      sampleCount: 0, p50: null, p75: null, p95: null, coverage: "unavailable",
    });
    expect(dashboard.coverage).toContainEqual({ name, status: "unavailable" });
  }
});
```

- [x] **Step 2: 运行失败测试并复现 Run 33311946947 的错误**

Run: `pnpm --filter @babysteps/aws test -- --runInBand && node --test --test-name-pattern='performance readback' scripts/performance-pipeline-contract.test.mjs`

Expected: 新测试在修复前失败，或夹具复现 `INVALID_UNAVAILABLE_COVERAGE_navigation_dns`。

- [x] **Step 3: 修复聚合而不把 0ms 冒充观测值**

```ts
function summarizeMetric(events, name, unit) {
  const matching = events.filter((event) => event.name === name);
  const observed = matching.filter(({ outcome }) => outcome !== "unavailable");
  return {
    name, unit, sampleCount: observed.length,
    p50: nullablePercentile(observed.map(({ value }) => value), 0.5),
    p75: nullablePercentile(observed.map(({ value }) => value), 0.75),
    p95: nullablePercentile(observed.map(({ value }) => value), 0.95),
    coverage: coverageFor(matching),
  };
}
```

同时确认 Cleaner/PostgreSQL 没有丢弃 `outcome="unavailable"`；若丢弃，修复映射并增加数据库往返测试，不能放宽 Validator 绕过事实。

- [x] **Step 4: 运行目标测试与管线契约**

Run: `pnpm --filter @babysteps/aws test && pnpm test:validators && pnpm validate:performance-pipeline`

Expected: PASS，且错误/Long Task 的 healthy-zero 语义不回归。

- [x] **Step 5: 记录根因并提交**

```bash
git add aws/src/performance/pipeline.ts aws/test/performancePipeline.test.ts scripts/validate-performance-readback.mjs scripts/performance-pipeline-contract.test.mjs docs/evidence/testing/2026-08-30-performance-readback-unavailable.md
git commit -m "fix: preserve unavailable navigation coverage"
```

### Task 2: 新增低基数业务操作性能事件合同

**Files:**
- Modify: `web/src/performance/types.ts`
- Modify: `web/src/performance/client.ts`
- Modify: `web/src/performance/runtime.ts`
- Modify: `web/src/performance/client.test.ts`
- Modify: `web/src/performance/runtime.test.ts`
- Modify: `aws/src/performance/pipeline.ts`
- Modify: `aws/test/performancePipeline.test.ts`
- Modify: `scripts/performance-journey.manifest.json`
- Modify: `scripts/validate-performance-pipeline.mjs`
- Modify: `scripts/performance-pipeline-contract.test.mjs`

**Interfaces:**
- Produces: `measureBusinessPerformance<T>(name: BusinessOperationName, operation: () => Promise<T>): Promise<T>`。
- Produces: 规格中的 20 个固定 `BusinessOperationName`；成功记录原名，失败记录 `${name}.error`，结果和输入不进入事件。

- [x] **Step 1: 先写类型、隐私和成功/失败测试**

```ts
await expect(client.markBusinessOperation("business.growth.activity", async () => "private-result")).resolves.toBe("private-result");
await expect(client.markBusinessOperation("business.marketplace.buy", async () => { throw new Error("private"); })).rejects.toThrow();
expect(serialized).toContain("business.growth.activity");
expect(serialized).toContain("business.marketplace.buy.error");
expect(serialized).not.toContain("private-result");
```

- [x] **Step 2: 运行 Web 性能测试确认接口尚不存在**

Run: `pnpm --filter @babysteps/web test -- src/performance/client.test.ts src/performance/runtime.test.ts`

Expected: FAIL with `markBusinessOperation is not a function`。

- [x] **Step 3: 实现业务操作专用 API**

```ts
export function measureBusinessPerformance<T>(
  name: BusinessOperationName,
  operation: () => Promise<T>,
): Promise<T> {
  return runtimeClient?.markBusinessOperation(name, operation) ?? operation();
}
```

客户端事件类型使用 `business`，白名单只包含规格中的固定名称及 `.error`；事件不得包含动态 ID、地址或正文。

- [x] **Step 4: 在 AWS Schema 与 Dashboard 聚合中加入业务目录**

聚合输出 `businessOperations: Array<{name, sampleCount, successCount, failureCount, successRate, p50, p75, p95, coverage}>`；空样本使用 `not-exercised`，不能写成成功 0%。

- [x] **Step 5: 运行前后端合同测试并提交**

Run: `pnpm --filter @babysteps/web test -- src/performance && pnpm --filter @babysteps/aws test && pnpm test:validators`

```bash
git add web/src/performance aws/src/performance scripts/performance-journey.manifest.json scripts/validate-performance-pipeline.mjs scripts/performance-pipeline-contract.test.mjs
git commit -m "feat: add bounded business operation metrics"
```

### Task 3: 在现有功能 Hook 中埋入端到端业务操作

**Files:**
- Modify/Test: `web/src/features/growth/useGrowth.ts`, `web/src/features/growth/useGrowth.test.tsx`
- Modify/Test: `web/src/features/growth/usePointTransfer.ts`, `web/src/features/growth/usePointTransfer.test.tsx`
- Modify/Test: `web/src/features/notebook/useNotebook.ts`, `web/src/features/notebook/useNotebook.test.tsx`
- Modify/Test: `web/src/features/babycoin/useBabyCoinGrowth.ts`, `web/src/features/babycoin/useBabyCoinGrowth.test.tsx`
- Modify/Test: `web/src/features/marketplace/useMarketplace.ts`, `web/src/features/marketplace/useMarketplace.test.tsx`
- Modify/Test: `web/src/features/marketplace/useTaskPurchase.ts`, `web/src/features/marketplace/useTaskPurchase.test.tsx`
- Modify/Test: `web/src/features/marketplace/completionApi.ts`, `web/src/features/marketplace/completionApi.test.ts`
- Modify/Test: `web/src/features/provider/useProviderTaskCreation.ts`, `web/src/features/provider/useProviderTaskCreation.test.tsx`
- Modify/Test: `web/src/features/provider/useOwnerTaskReview.ts`, `web/src/features/provider/useOwnerTaskReview.test.tsx`
- Modify/Test: `web/src/features/provider/useOwnerCompletionConfirmation.ts`, `web/src/features/provider/useOwnerCompletionConfirmation.test.tsx`
- Modify/Test: `web/src/features/keepsakes/useKeepsakes.ts`, `web/src/features/keepsakes/useKeepsakes.test.tsx`
- Modify/Test: `web/src/features/exchange/useUniswapSwap.ts`, `web/src/features/exchange/useUniswapSwap.test.tsx`
- Modify/Test: `web/src/features/identity/PrivyIdentityPanel.tsx`, `web/src/features/identity/PrivyIdentityPanel.test.tsx`

**Interfaces:**
- Consumes: `measureBusinessPerformance()` from Task 2。
- Produces: 每个规格 Journey 的一次成功或精确失败事件；既有 UI 状态、receipt 等待和回读顺序不变。

- [x] **Step 1: 为每组 Hook 写“恰好一次、覆盖完整异步周期、不泄露结果”的测试**

```ts
expect(mocks.measureBusinessPerformance).toHaveBeenCalledWith(
  "business.growth.activity",
  expect.any(Function),
);
await expect(mocks.measureBusinessPerformance.mock.calls[0][1]()).resolves.toBeUndefined();
```

- [x] **Step 2: 运行目标测试验证 RED**

Run: `pnpm --filter @babysteps/web test -- src/features/growth src/features/babycoin src/features/marketplace src/features/provider src/features/keepsakes src/features/exchange src/features/identity`

- [x] **Step 3: 用统一包装器覆盖“请求签名到产品回读”**

```ts
return measureBusinessPerformance("business.notebook.write", async () => {
  const hash = await writeContractAsync(request);
  await waitForReceiptAndRefresh(hash);
});
```

不得只包 `writeContractAsync`；必须包含 receipt 和最终 UI/链上/Worker 回读。已有 `contract.write`、`approve.*`、`transaction.*` 继续保留。

- [x] **Step 4: 运行全量 Web 测试与类型检查**

Run: `pnpm --filter @babysteps/web test && pnpm --filter @babysteps/web typecheck && pnpm --filter @babysteps/web check`

- [x] **Step 5: 提交**

```bash
git add web/src/features
git commit -m "feat: instrument implemented product journeys"
```

### Task 4: 建立可见钱包全功能 Journey Manifest 与执行器

**Files:**
- Modify: `scripts/performance-journey.manifest.json`
- Create: `scripts/implemented-feature-journey.schema.json`
- Create: `scripts/run-implemented-feature-journey.mjs`
- Create: `scripts/run-implemented-feature-preflight.mjs`
- Modify: `scripts/performance-pipeline-contract.test.mjs`
- Modify: `scripts/validate-performance-pipeline.mjs`

**Interfaces:**
- Produces: `implemented-feature-journey.json`，每项包含 `journeyId`、`route`、`roleAlias`、`startedAt`、`finishedAt`、`outcome`、脱敏 receipt/readback、`acceptedEventIds`、`compensation`。
- Consumes: 用户可见钱包/Privy 会话；脚本只点击页面和等待可见状态。

- [x] **Step 1: 写 Manifest Schema 和完整性失败测试**

要求 Journey ID 精确等于规格矩阵；禁止 `privateKey`、`mnemonic`、`cookie`、完整 `0x` 地址、邮箱和本地绝对路径字段。

- [x] **Step 2: 写预检 RED 测试**

预检必须 fail-closed 核验 Sepolia、角色、余额、allowance、Active task、VRF、Privy/Worker origin 与 AWS Runtime 状态；只返回别名和布尔/计数。

- [x] **Step 3: 实现 Playwright 可见 UI 状态机**

```js
await runStep({
  journeyId: "MARKET-BUY-01",
  route: "/tasks",
  action: () => page.getByRole("button", { name: /购买任务/u }).click(),
  walletPrompt: "confirm-transaction",
  settled: () => page.getByText(/购买成功|purchaseId/u).waitFor(),
});
```

签名点写入 `WAITING_FOR_USER_<ROLE>_<ACTION>` 并暂停；不得自动操作扩展钱包、读取密钥或重复发送未知交易。

- [x] **Step 4: 增加每步 receipt/readback/telemetry/补偿 Gate**

只有 UI 成功、receipt/Worker 回读成功、对应业务事件已被接受后才写 `PASS`。拒签、余额不足、冷却、VRF 未完成分别输出稳定错误码。

- [x] **Step 5: 本地 dry-run 与合同测试**

Run: `node --test --test-name-pattern='implemented feature journey' scripts/performance-pipeline-contract.test.mjs && node scripts/run-implemented-feature-preflight.mjs --mode local-contract`

- [x] **Step 6: 提交**

```bash
git add scripts/implemented-feature-journey.schema.json scripts/run-implemented-feature-journey.mjs scripts/run-implemented-feature-preflight.mjs scripts/performance-journey.manifest.json scripts/performance-pipeline-contract.test.mjs scripts/validate-performance-pipeline.mjs
git commit -m "feat: add visible implemented-feature journey"
```

### Task 5: 录屏、响应式与公开内容 Gate

**Files:**
- Modify: `scripts/run-prd-walkthrough-recording.mjs`
- Create: `scripts/validate-implemented-feature-recording.mjs`
- Modify: `scripts/performance-layout.browser.mjs`
- Modify: `scripts/run-visual-gate.mjs`
- Modify: `scripts/performance-pipeline-contract.test.mjs`

**Interfaces:**
- Consumes: Task 4 的步骤 JSON 和连续原始视频。
- Produces: 多段 Journey 视频、章节清单、总览视频元数据、375/390/430/1440 截图和页面错误/overflow 报告。

- [x] **Step 1: 将旧“仅走页”测试改成真实证据合同**

断言不能再出现 `walletWrites: 0` / `chainTransactions: 0` 作为全功能证明；每个已实现 Journey 必须关联视频章节与真实结果。

- [x] **Step 2: 实现录屏隐私过滤和章节清单**

```json
{
  "journeyId": "GROWTH-01",
  "route": "/",
  "outcome": "success",
  "receipt": { "network": "sepolia", "hash": "redacted-linked-proof" },
  "telemetry": { "name": "business.growth.activity", "accepted": true }
}
```

公开视频显示短 hash；完整 hash 只放允许公开的交易链接，不显示地址或账户身份。

- [x] **Step 3: 运行视觉与浏览器语义 Gate**

Run: `pnpm build && pnpm visual:test && node scripts/performance-layout.browser.mjs`

Expected: 375/390/430/1440 无根级溢出、pageerror=0，Backstop candidate 已人工检查。

- [ ] **Step 4: 运行公开内容和媒体完整性检查**

Run: `node scripts/validate-implemented-feature-recording.mjs && pnpm validate:public-copy && pnpm validate:delivery-evidence`

- [x] **Step 5: 提交**

```bash
git add scripts/run-prd-walkthrough-recording.mjs scripts/validate-implemented-feature-recording.mjs scripts/performance-layout.browser.mjs scripts/run-visual-gate.mjs scripts/performance-pipeline-contract.test.mjs docs/evidence/recordings docs/evidence/screenshots
git commit -m "test: record implemented feature journey evidence"
```

### Task 6: 更新 Evidence 页面与机器证据映射

**Files:**
- Modify: `docs/evidence/performance-observability.json`
- Create: `docs/evidence/testing/2026-08-30-implemented-feature-live-journey.md`
- Create: `docs/evidence/deployment/2026-08-30-implemented-feature-live-journey.json`
- Modify: `web/src/pages/EvidencePage.tsx`
- Modify: `web/src/pages/EvidencePage.test.tsx`
- Modify: `scripts/validate-delivery-evidence.mjs`
- Modify: `scripts/validate-delivery-evidence.test.mjs`

**Interfaces:**
- Consumes: Journey JSON、录屏、交易链接、Worker/D1 回读、性能快照与清理 JSON。
- Produces: “要求 → 实现 → 代码 → 测试/Run/交易 → 状态”的项目 Evidence；失败 Run 33311946947 保留为诊断，不冒充成功快照。

- [x] **Step 1: 写 Evidence 映射失败测试**

要求所有规格 Journey ID 精确出现一次；明确排除项必须显示“不在当前实现范围”；不得出现私有路径、邮箱、完整地址或 Secret。

- [x] **Step 2: 更新 Evidence 页面与 JSON**

页面必须区分 `local-verified`、`sepolia-verified`、`aws-live-verified`、`production-verified` 和 `blocked`，并展示样本量与低置信度。

- [x] **Step 3: 运行 Evidence、链接与构建检查**

Run: `pnpm --filter @babysteps/web test -- src/pages/EvidencePage.test.tsx && pnpm validate:delivery-evidence && pnpm build`

- [x] **Step 4: 提交**

```bash
git add docs/evidence/performance-observability.json docs/evidence/testing/2026-08-30-implemented-feature-live-journey.md docs/evidence/deployment/2026-08-30-implemented-feature-live-journey.json web/src/pages/EvidencePage.tsx web/src/pages/EvidencePage.test.tsx scripts/validate-delivery-evidence.mjs scripts/validate-delivery-evidence.test.mjs
git commit -m "docs: publish implemented feature journey evidence"
```

### Task 7: 完整验证、一次 AWS Live、清理与发布

**Files:**
- Modify after successful run only: `docs/evidence/deployment/2026-08-30-implemented-feature-live-journey.json`
- Modify after successful run only: `docs/evidence/performance-observability.json`
- Modify after successful run only: Evidence media manifests and `web/src/pages/EvidencePage.tsx`

**Interfaces:**
- Consumes: Tasks 1–6 全部绿色提交。
- Produces: PR、GitHub Actions Run、Cloudflare deployment、生产 URL、AWS artifact、零残留 JSON。

- [x] **Step 1: 运行本地确定性总 Gate**

Run: `pnpm check && pnpm test && pnpm typecheck && pnpm build && pnpm validate:performance-pipeline && pnpm validate:performance-budget && pnpm visual:test`

- [ ] **Step 2: 只读 Sepolia/AWS 预检**

Run: `node scripts/run-implemented-feature-preflight.mjs --mode sepolia-readonly` 与仓库现有 `aws-budget-guard`。任何余额、角色、VRF、预算或 Free-plan Gate 失败即停止。

- [ ] **Step 3: 在用户可见钱包下执行一次全功能旅程并录屏**

所有签名逐次等待用户确认；每笔交易发送前重读 chainId、余额、nonce 与预期调用。失败交易不得盲重试。

- [ ] **Step 4: 推送 PR 并等待所有远端 Gate/Preview 全绿**

```bash
git push -u origin feat/implemented-feature-live-journey
gh pr create --base main --head feat/implemented-feature-live-journey \
  --title "feat: verify implemented BabySteps journeys" \
  --body $'## Summary\n- execute every currently implemented BabySteps UI journey\n- preserve bounded performance and privacy contracts\n- publish linked Sepolia, AWS cleanup, recording, and Evidence proof\n\n## Verification\n- pnpm check\n- pnpm test\n- pnpm typecheck\n- pnpm build\n- pnpm validate:performance-pipeline\n- pnpm validate:performance-budget\n- pnpm visual:test'
```

- [ ] **Step 5: 合并后只触发一次 AWS performance workflow**

精确记录 main SHA、Run ID、Stack 名与 TTL；只有 Browser → API → SQS/DLQ → ECS → PostgreSQL → Query/Dashboard 全部通过才更新快照。

- [ ] **Step 6: 验证清理和公开 Evidence**

要求 `cloudFormationStackAbsent=true`、`remainingProjectResources=0`、队列/DLQ 0、Schema absent、共享资源 protected；失败只触发固定 Recovery workflow，不重采样。

- [ ] **Step 7: 发布 Cloudflare 并生产回读**

使用 `publish-baby2b-project` 既有 Gate，验证生产提交、部署 ID、`/performance`、`/evidence`、视频、链接、响应式和无 pageerror。

- [ ] **Step 8: 最终提交运行事实**

```bash
git add docs/evidence web/src/pages/EvidencePage.tsx web/src/pages/EvidencePage.test.tsx
git commit -m "docs: close implemented feature live evidence"
```

最终回传精确 commit、PR、Actions Run、Cloudflare deployment、生产 URL、各 Journey/指标样本数、链上不可回滚测试历史和 AWS 零残留摘要。
