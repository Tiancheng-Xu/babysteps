# BabySteps 全覆盖性能闭环（2026-08-31）

最终 Run：[`33370197607`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33370197607)  
验证提交：`f15bc873b14bb7193495514a6a7cc57c7e0eaf37`  
Artifact：`9750458914`

## 真实链路

受控 Chromium 访问 `/`、`/tasks`、`/parent`、`/keepsakes`、`/provider`、`/exchange`、`/profile`、`/performance`、`/evidence`，经本地 Worker 代理进入临时 AWS API Gateway/Lambda，再由 SQS/DLQ、一次性 ECS Cleaner、隔离 PostgreSQL Schema 和 Query Lambda 返回 Live Dashboard。

- 浏览器：232 个唯一事件，49/49 批次接收，0 拒绝、0 传输失败、0 未接收事件。
- Cleaner：232/232 写入，0 丢弃、0 可重试失败；SQS 与 DLQ 的 visible/in-flight/delayed 全部为 0。
- 页面：9/9 路由均有事件；Live Dashboard 显示 37 个摘要样本。
- Core Web Vitals：LCP n=6、CLS n=9、INP n=4；诊断指标 FCP n=9、TTFB n=9。
- 导航：request wait、download、DOM ready、window load 均 n=9；DNS n=1、TCP n=2；TLS 因受控 Origin/连接复用无法拆分，诚实标为 unavailable。
- 资源：stylesheet、fetch、image、script、font、XHR 与总资源耗时都有样本；8 个 Long Task 总计 1614 ms，最长 565 ms。
- 渲染：SPA route、SSR shell、hydration 均有样本；CSR fallback、hydration recoverable error 为健康零事件。
- Web3：Sepolia RPC read 4/4 成功；只读合约/Uniswap quote 路径记录了 1 个真实失败样本。没有为填数执行钱包登录、签名、Approve、Swap 或其他链上写交易。
- 稳定性：Journey 执行期间 JavaScript error、Promise rejection、CSR fallback 和 hydration recoverable error 均为 0；这是“已执行但健康为零”，不是缺样本。

## 分位数与置信度边界

| 指标 | n | P50 | P75 | P95 | 结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| LCP | 6 | 1244 ms | 2568 ms | 3372 ms | 受控样本 P75 略高于 2.5 s，需改进；不外推为生产 Field RUM |
| CLS | 9 | 0.051 | 0.090 | 0.227 | P75 良好 |
| INP | 4 | 40 ms | 48 ms | 56 ms | 受控代表性交互，低样本量 |
| FCP | 9 | 528 ms | 736 ms | 932 ms | 诊断指标，不是 Core Web Vital |
| TTFB | 9 | 16 ms | 63 ms | 360 ms | 本地 Worker Origin 条件，不代表公网距离 |

DNS n=1、TCP n=2 和单次只读 Web3 失败均属低置信度；机器 Evidence 保留完整 sampleCount 与覆盖状态，不把 `n=1` 的 p50/p75/p95 当成稳定分布。

## 清理与保护边界

取证后第一次清理即验证 Schema 删除且不存在；CloudFormation Stack 不存在，ECR、ECS Cluster/Task/Task Definition、SQS/DLQ、API Gateway、Lambda、CloudWatch Logs、Secrets、Security Group/Ingress 和 IAM Role 共 12 类项目资源全部为 0。共享 VPC、NAT、PostgreSQL、OIDC、Artifact Bucket 与 Foundation 保持只读保护/显式拒绝删除。

机器可读清单：[`../deployment/2026-08-31-performance-aws-final.json`](../deployment/2026-08-31-performance-aws-final.json)。原始脱敏制品位于 `../deployment/2026-08-31-performance-aws-final/`，不包含凭据、Token、Cookie、钱包完整地址或用户输入。

## 可见证据

- 桌面 Live Dashboard：`docs/evidence/screenshots/2026-08-31-performance-final/performance-live-desktop-1440.png`
- 390 px Live Dashboard：`docs/evidence/screenshots/2026-08-31-performance-final/performance-live-mobile-390.png`
- Live Dashboard 录屏：`docs/evidence/recordings/2026-08-31-performance-final/performance-live.webm`
- 九路由 Journey 录屏：`docs/evidence/recordings/2026-08-31-performance-final/browser-journey.webm`

这些媒体证明受控运行窗口；Runtime 已清理，公开 `/performance` 将该结果标成 `historical-verified-snapshot`，不会伪装成持续在线的生产监控。
