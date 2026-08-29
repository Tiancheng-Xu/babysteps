# BabySteps 性能观测最终闭环（2026-08-29）

最终 Run：[`33279132965`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33279132965)
精确提交：`1e703caeba2d256936f677eb7ea15f2044cc7dd6`
Artifact：`9722636468`

## 结果

本轮使用受控本地 Chromium、Vite Web 和本地 Worker 代理连接临时 AWS 性能链。五条页面路径共生成 85 个唯一事件，14 个批次全部接收；一次性 ECS Cleaner 处理并写入 85 条，0 丢弃、0 可重试失败。Cleaner 完成后 SQS 与 DLQ 的 visible、in-flight、delayed 都为 0。

| 作业要求 | 实现 | 代码位置 | 最终证据 | 状态 |
| --- | --- | --- | --- | --- |
| 浏览器 SDK | LCP、CLS、INP、FCP、TTFB、导航阶段、资源耗时、错误与自定义耗时；批量、限流、重试、失败静默 | `packages/performance-sdk/src`、`web/src/performance` | LCP 4、CLS 5、INP 1、FCP 5、TTFB 5；导航分项各 5；脚本资源 30 | 已验证 |
| 真实异步链 | Worker → API Gateway/Lambda → SQS/DLQ → ECS Cleaner → PostgreSQL | `worker/src`、`aws/src/performance`、`aws/performance-template.yaml` | 85 processed / 85 inserted；队列与 DLQ 全量排空 | 已验证 |
| 真实统计页 | sampleCount、p50/p75/p95、route、version、coverage 与数据新鲜度 | `web/src/pages/PerformanceDashboardPage.tsx`、`aws/src/performance/queryLambda.ts` | Live API 桌面/手机截图与 WebM；逐指标查询 Gate 通过 | 已验证 |
| 隐私与身份 | 浏览器无 AWS 凭据；GitHub OIDC 短期身份；不采 Token、Cookie、请求正文或 PII | `.github/workflows/aws-performance.yml`、`packages/performance-sdk/src` | Run 元数据脱敏；无长期 Access Key | 已验证 |
| 生命周期 | 项目 Schema、精确 Stack、12 类项目资源自动回收；共享 Foundation 受保护 | `.github/workflows/aws-performance.yml`、`scripts/aws-performance-cleanup.mjs` | Schema absence=true、Stack absent=true、remainingProjectResources=0 | 已验证 |

## 指标口径

- 来源：`controlled-browser`，不是生产真实用户监控（Field RUM）或 CrUX。
- Core Web Vitals：LCP p75=992ms（n=4）、CLS p75=0.052（n=5）、INP p75=48ms（n=1）。INP 只有一次代表性交互，属于低置信度；p50=p75=p95 是单样本的正常数学结果。
- 诊断指标：FCP p75=752ms（n=5）、TTFB p75=5.6ms（n=5）。
- 导航阶段：request wait、download、DOM ready 与 window load 各有 5 条。DNS/TLS 来自本地 HTTP 与连接复用，因此显示 0 或不适用，不能解释为互联网延迟。
- 没有为填满页面而制造错误、坏 CLS、长任务、钱包交易或链上写入；无真实样本的模块继续诚实显示“已埋点，当前无样本”。

## 工程修复记录

1. Route readiness 使用稳定页面标题和完成态，不再依赖某个动态业务文案。
2. Journey Manifest 为五条页面声明 readiness、代表性交互和逐路由预算，总量不超过接收端配额。
3. 生命周期 drain 改为按 `eventId` 对账：3 秒单次传输超时只结束一次 attempt，同一事件后续重试成功才算最终送达；永久拒绝、重试耗尽或未接收事件仍 fail-closed。
4. 控制面回读使用 canonical `List*` 权限并按精确项目名过滤，不扩大 IAM；缺失 cleaner summary 记录为 `null`，不阻断 `always()` cleanup，也不伪造成功。
5. Dashboard-only 取证流量被本地 202 截断，防止截图阶段重新向已清空队列写入事件。

## 可见证据

- 桌面截图：`docs/evidence/screenshots/2026-08-29-performance-final/performance-live-desktop-1440.png`
- 手机截图：`docs/evidence/screenshots/2026-08-29-performance-final/performance-live-mobile-390.png`
- 走读录屏：`docs/evidence/recordings/2026-08-29-performance-final/performance-live.webm`
- 机器可读闭环：`docs/evidence/deployment/2026-08-29-performance-aws-final.json`
- 完整架构图：`docs/architecture/starbuddy-performance-global-architecture.svg`
- 关键时序图：`docs/architecture/starbuddy-performance-pipeline-sequence.svg`

## 费用与清理

临时资源只在受控 Run 内存在，使用未过期的精确 Budget Guard 例外；未升级、转换或取消 AWS Free 计划。取证后项目 Schema 一次删除成功，精确 CloudFormation Stack 不存在，ECR、ECS Cluster/Task/Task Definition、SQS/DLQ、API Gateway、Lambda、CloudWatch Log Group、Secret、Security Group/Ingress、IAM Role 共 12 类项目资源均为 0。共享 VPC、NAT、PostgreSQL、OIDC、Artifact Bucket 与 Foundation 继续保持受保护。
