# BabySteps 已实现功能真实全旅程：本地 Gate 记录

## 当前结论

本检查点为 `local-verified`，证明 31 个已实现 Journey 的目录、执行器、业务性能指标、录屏合同、隐私规则、响应式页面和视觉回归在本地通过。另有一份 35.92 秒、30 章的完整功能场景录屏覆盖全部非 AWS Journey；它不代表本轮 Sepolia 写入、AWS Live 或生产发布已经完成。

状态层级固定为：`local-verified` → `sepolia-verified` → `aws-live-verified` → `production-verified`；任一 Gate 失败使用 `blocked`，不得跨级。

## 非 AWS 独立执行路径

AWS 暂停期间可使用 `--scope non-aws` 执行 30 个 Sepolia、产品 UI、Worker/D1 与 Privy Journey。该路径只排除 `PERF-01`，并把原因写为 `AWS_SCOPE_EXCLUDED`；受控浏览器会阻断 `/api/performance/*`，每个结果显式记录 telemetry 未采集。它不会改变完整 31 项路径的 AWS fail-closed 规则，也不会在真实钱包旅程和媒体审阅完成前升级本证据状态。详细合同见 `docs/evidence/testing/2026-09-09-non-aws-journey-scope.md`。

本地执行器还完成了可恢复状态收尾：Swap receipt 后重新读取 allowance，非零时必须由用户在独立钱包确认中执行 `approve(router, 0)` 并以链上零值回读闭环；pending 状态锁定输入和重复点击。任务购买、登录会话与最终钱包断开均有显式补偿关系；不可逆的 Sepolia 历史只标记为公开测试记录，不伪造回滚。

## 完整功能场景录屏

`docs/evidence/recordings/2026-09-12-implemented-feature-walkthrough/implemented-feature-full-walkthrough.webm` 按 Manifest 固定顺序展示 30 个非 AWS Journey。录屏本身使用产品化状态文案，不叠加“本地确定性模拟”标识；机器侧清单仍明确记录 `provenance=controlled-browser-local-production-build-mock-data`、`mockData=true`、`chainTransactions=0`、`awsWrites=0` 与 `fullJourneyProof=false`，因此不能被真实 Sepolia 录屏 Validator 接受。

媒体 SHA-256 为 `7368947bd921ff47fe661897f35e0f9508fa7fd82882febbcb4469897d2972f4`，时长 35.92 秒；30/30 章节齐全，375/390/430/1440 根级溢出为 0，pageerror 为 0，联系表已人工检查。

## 要求 → 实现 → 证据 → 状态

| 要求 | 实现 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 已实现功能完整目录 | 31 个 Journey 精确、顺序固定、角色别名化 | `scripts/performance-journey.manifest.json` | Manifest 合同 31/31 | local-verified |
| 只走可见 UI | Playwright 只点击页面、等待可见状态和人工钱包确认 | `scripts/run-implemented-feature-journey.mjs` | 执行器合同与 fail-closed 补偿 Gate | local-verified |
| 业务阶段性能 | 20 个低基数业务指标覆盖请求、receipt 与最终回读 | `web/src/performance/businessOperations.ts` | Web/AWS Schema 与聚合测试 | local-verified |
| 录屏与隐私 | 30 章非 AWS 场景媒体 + 31 章真实旅程合同；媒体哈希、时长、无声、响应式和隐私扫描 | `scripts/validate-implemented-feature-mock-recording.mjs` · `scripts/validate-implemented-feature-recording.mjs` | 场景录屏 30/30 已验证；真实 Sepolia 媒体仍待 Task 7 | local-verified |
| 写操作收尾 | Swap 后读取剩余 allowance、独立清零确认、pending 防重与 Journey 补偿图 | `web/src/features/exchange/useUniswapSwap.ts` · `scripts/run-implemented-feature-journey.mjs` | Hook/UI/执行器合同测试；真实钱包签名待 Task 7 | local-verified |
| 全页面视觉 | 9 路由 × 4 视口，确定性未配置状态与人工审核基线 | `backstop.config.cjs` | BackstopJS 36/36；HTTP、overflow、pageerror 36/36 | local-verified |
| 云端闭环 | Sepolia 可见交易与临时 AWS 性能栈 | 固定 Journey 与 AWS workflow | 尚未运行本轮 Live | blocked |

## 运行架构与关键时序

1. 本地确定性 Gate 冻结 Journey Schema、埋点目录、响应式和公开内容。
2. Sepolia 只读预检核对 chainId、角色、余额、allowance、任务、VRF、Privy 与 Worker origin。
3. 可见浏览器逐 Journey 执行；钱包确认必须由用户操作，脚本不读取私钥、助记词或签名。
4. 每步必须同时得到产品回读、脱敏交易证明和 accepted telemetry event ID。
5. 本地 Gate 全绿后才允许启动一次临时 AWS：Browser → API → SQS/DLQ → ECS → PostgreSQL → Query/Dashboard。
6. 最终 Evidence 必须证明 Schema、Stack、SQS/DLQ 和 12 类项目资源归零，共享 Foundation 受保护。

## 当前实现边界

不在当前实现范围：Provider D1 草稿编辑、Owner 角色管理、独立任务详情与评论、家长购买总览、购买抽屉自动串联 Swap、无页面入口的后台能力，以及属于 Agent Market 的仲裁和 Cocos 功能。它们不会通过脚本直调或测试夹具冒充产品 UI。

## 本地验证结果

- Journey Manifest：31/31。
- 场景录屏 Validator：30/30；媒体哈希、时长、隐私、联系表审阅均通过。
- 页面语义：9 路由 × 375/390/430/1440，共 36/36；根级横向溢出 0，pageerror 0。
- BackstopJS：人工审核新基线后候选 36/36。
- 生产构建、性能管线合同、公开内容与既有 Evidence 合同：通过。
- AWS Runtime：未启动；本检查点 AWS 增量成本为 0。
