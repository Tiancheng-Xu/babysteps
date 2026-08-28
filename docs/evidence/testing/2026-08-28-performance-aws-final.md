# BabySteps 性能观测 AWS 最终闭环

日期：2026-08-28

状态：已实现、已验证、已清理

最终 Run：`33160455921`

验证提交：`e40008e056d24199641fa978142f706051889f3b`

## 作业要求 → 实现 → 代码 → 证据 → 状态

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 状态 |
| --- | --- | --- | --- | --- |
| 浏览器性能 SDK | Web Vitals、导航、资源、长任务、错误、Web3 与自定义耗时；采样、限流、批量、定时 flush、sendBeacon 优先、失败静默 | `packages/performance-sdk/src`、`web/src/performance` | 5 条真实页面路径、25 个批次、415 个浏览器事件 | 已验证 |
| AWS 日志接收与异步队列 | Worker 隐藏 Origin Token；API 校验；20 条浏览器批次按 SQS 最多 10 条安全拆批；DLQ 有界重试 | `worker/src/performanceProxy.ts`、`aws/src/performance/ingestLambda.ts`、`aws/src/performance/sqsTransport.ts`、`aws/performance-template.yaml` | 最终 Run 的 Browser journey、API、SQS 与 DLQ Gate 全部通过 | 已验证 |
| ECS 清洗 | 一次性 Fargate Task；脱敏、去重、路由归一、幂等写入；不常驻运行 | `aws/src/performance/cleanerMain.ts`、`aws/src/performance/storage.ts` | processed=103、inserted=103、discarded=0、retryableFailures=0、exitCode=0 | 已验证 |
| 真实统计页 | 真实 sampleCount 与 p50/p75/p95；时间、route、metric、environment、version 筛选；无 Mock 兜底 | `web/src/pages/PerformanceDashboardPage.tsx`、`aws/src/performance/queryLambda.ts` | Live API 观测到 LCP/FCP/TTFB、导航和脚本资源分位数；1440/390 截图与 WebM 录屏 | 已验证 |
| 费用与清理 | GitHub OIDC 短期身份；临时 Schema/Stack；固定零残留清单；共享资源受保护 | `.github/workflows/aws-performance.yml`、`aws/iam/performance-control-readback-policy.json` | Schema 删除与不存在性验证；Stack absent；12 类项目资源均为 0 | 已验证 |

## 真实运行结果

- Chromium 访问 `/`、`/tasks`、`/profile`、`/performance`、`/evidence`。
- 浏览器和 Worker 运行面是本地 Chromium、Vite Preview 与本地 Worker 代理；后端 API、SQS、ECS 和 PostgreSQL 为临时 AWS 真实资源。本轮不证明 Cloudflare Worker 已参与该次性能取证。
- SDK 形成 25 个上报批次，共记录 415 个浏览器事件。
- 一次性 ECS Cleaner 处理并写入 103 条事件；0 去重、0 丢弃、0 可重试失败。
- 清理前控制面仍显示 80 条 SQS 可见消息；本轮只证明 103 条样本穿过完整清洗与查询链，不宣称 415 条事件已全部排空。剩余临时队列随精确项目 Stack 在取证后删除。
- Live Dashboard 实测：LCP 960 ms、FCP 960 ms、TTFB 8.5 ms；导航样本 3；脚本资源样本 79，p50/p75/p95 为 104.1/138.2/171.4 ms。
- CLS、INP、Long Task、错误与 Web3 指标已埋点，但这次短时受控旅程没有产生样本；页面明确显示“已埋点，当前快照无样本”，没有伪造数据。

## 有工程意义的修复过程

1. 浏览器 SDK 每批最多 20 条，而 AWS SQS `SendMessageBatch` 每次最多 10 条。PR #42 把接收层改为按 10 条拆批，同时保留失败 ID 与批次边界测试；Run `33158594517` 证明主链路成功。
2. 同一 Run 的截图步骤最初错误使用 `development` 环境筛选，真实样本存放在 `production`。PR #43 用契约测试锁定 `production`，最终 Run `33160455921` 的桌面、手机截图和录屏全部通过。
3. 每轮失败和成功 Run 都执行 Schema/Stack 清理；最终结论只使用当前提交对应的最终 Run，不把旧 Run 或本地构建冒充当前云端成功。

## 身份、费用与保护边界

- GitHub Actions 通过 `aws-performance` Environment 与 OIDC 获取短期身份；没有长期 Access Key。
- Deploy role 与 CloudFormation execution role 只管理 `babysteps-performance-*` 项目资源。
- 共享 VPC、NAT、PostgreSQL、OIDC、Artifact Bucket 与 Foundation 只读复用，项目清理不能删除。
- 本轮取证后：ECR、ECS Cluster、ECS Task、Task Definition、SQS/DLQ、API Gateway、Lambda、CloudWatch Log Group、Secret、Security Group/Ingress、IAM Role 全部为 0。

## 可视证据

- 桌面截图：`docs/evidence/screenshots/2026-08-28-performance-final/performance-live-desktop-1440.png`
- 手机截图：`docs/evidence/screenshots/2026-08-28-performance-final/performance-live-mobile-390.png`
- 走读录屏：`docs/evidence/recordings/2026-08-28-performance-final/performance-live.webm`
- 机器可读闭环：`docs/evidence/deployment/2026-08-28-performance-aws-final.json`
- 完整架构图：`docs/architecture/starbuddy-performance-global-architecture.svg`
- 关键时序图：`docs/architecture/starbuddy-performance-pipeline-sequence.svg`

## 限制

- 这是受控作业验收流量，不代表生产规模或长期 SLO。
- 为控制费用，取证后已删除项目运行资源与数据库 Schema；公开站点不会把已关闭的 AWS 后端显示成持续实时监控。
- 共享基础设施由统一 Foundation 管理，不属于 BabySteps 项目清理范围。
