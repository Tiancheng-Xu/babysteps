# 多应用性能采样闭环设计

## 目标

先在 BabySteps 证明一条真实、可重复且费用受控的性能观测闭环，再把已经验证有效的通用部分同步给其他应用。闭环必须覆盖：浏览器真实旅程、指标覆盖门禁、AWS 预算与共享资源门禁、临时接收/队列/ECS 清洗/PostgreSQL 聚合、Dashboard 回读、Evidence 固化和零残留清理。

## 当前问题与已验证根因

当前历史快照只保存了 LCP、FCP、TTFB 和少量资源指标；CLS、INP 与导航分项在页面上缺少可展示样本。只读诊断确认：

1. 现有浏览器旅程只要求“访问五条路由且总事件数大于零”，没有要求 CLS、INP 或关键导航阶段实际出现，因此覆盖不完整也能进入 AWS 阶段。
2. 当前 SDK 使用 `web-vitals` 的默认 INP 40 ms 观察阈值；短而正常的代表性交互可能没有进入观察结果。
3. 现有旅程只点击页面空白处并按 Tab，没有执行会产生下一帧的代表性产品交互。
4. 导航事件在当前生产构建中确实会由 SDK 发出；历史页面仍无分项数据，是因为公开快照没有保存完整统计结果，而且旧运行只执行一次 Cleaner，最终仍有队列消息未清洗。
5. 旧运行的 415 个浏览器事件、103 条 Cleaner 写入和清理前 80 条可见队列消息只能证明部分闭环，不能证明指标全覆盖或队列全量排空。

## 选型

采用“清单驱动的应用旅程 + 通用覆盖合同 + 临时云闭环”方案。

不采用以下方案：

- 不在通用脚本中硬编码 BabySteps 的按钮或中文文案；这会让其他应用无法复用。
- 不通过人为制造页面抖动或伪造固定数值来补 CLS/INP；受控交互可以是实验室来源，但指标必须来自浏览器 Performance API。
- 不为每个应用复制 VPC、NAT、RDS、OIDC 或常驻 ECS；所有应用复用已保护的共享 Foundation，仅拥有带项目前缀和 TTL 的临时资源。

## 架构

### 应用层

每个应用维护一个公开、无密钥的 Journey Manifest，声明：

- 应用 ID、允许的本地 Origin；
- 必走路由与每条路由的可见语义断言；
- 至少一个代表性交互及其完成断言；
- 本应用要求的业务自定义指标；
- 可诚实标记为 `unavailable` 的浏览器/协议指标。

应用层只描述产品语义，不拥有 AWS 资源创建逻辑。

### 通用层

通用 Gate 读取 Journey Manifest，并执行以下固定合同：

1. 在不连接 AWS 的本地受控浏览器中拦截遥测请求，验证路由、代表性交互、批次数、每批成功响应和指标覆盖；清单声明的受控 hidden/pagehide 只负责让 `web-vitals` 结算真实 Performance API 条目，不写入固定指标值。
2. Core Web Vitals 要求 LCP、CLS、INP；FCP、TTFB 作为诊断指标单列。只有浏览器 `onCLS` 实际回调的 0 才是有效稳定样本，不为不支持或不可观测环境手写 0；INP 必须来自清单声明的真实代表性交互，不能由无关键盘操作或固定值补齐。
3. 导航阶段至少要求 `request_wait`、`download`、`dom_ready`、`window_load` 有样本。DNS、TCP、TLS 遇到 localhost、连接复用或协议不适用时可标记 `unavailable`，不得伪造 0 ms。
4. 本地覆盖 Gate 通过后，才允许进入预算 Gate 与临时 AWS 阶段。
5. 云端回读必须逐项验证要求指标的 `sampleCount > 0`、单位、`coverage=observed` 以及有限且有序的 p50/p75/p95，不能只验证总样本数大于零。
6. Cleaner 以明显短于 GitHub Job 的三分钟上限处理队列；若指标仍缺失或主队列/DLQ 不为零，运行失败并进入 `always()` 清理，不把部分数据包装成完成。Dashboard-only 截图在浏览器内截断自身遥测，不能在最终 drain 后重新入队。

### AWS 临时链路

固定链路为：

`Browser SDK → 项目 Worker 代理 → HTTP API/Lambda 校验 → SQS/DLQ → ECS Fargate Cleaner → 共享 PostgreSQL 项目 Schema → Query API → Dashboard/Evidence`

复用并保护：共享 VPC、私有子网、单 NAT、PostgreSQL、GitHub OIDC、Artifact Bucket 和 Foundation Stack。

项目临时拥有：精确项目前缀的 API/Lambda、SQS/DLQ、ECR、ECS Task/Cluster、日志、Secrets、Security Group 和项目数据库 Schema。所有临时资源必须带 Run ID、项目标签和到期时间；项目清理不能删除共享资源。

## 数据与证据合同

每次运行必须保存脱敏、机器可读的：

- Journey Manifest 版本与 Hash；
- commit、Run URL、环境、路由、浏览器版本、viewport、采集时间和来源标签；
- 每个指标的样本量、p50/p75/p95、单位与覆盖状态；
- 浏览器批次接受/拒绝计数；
- Cleaner processed/inserted/deduplicated/discarded/retryableFailures；
- SQS/DLQ 清理前后状态；
- Dashboard 查询响应的完整脱敏快照；
- CloudFormation、ECS、ECR、SQS、日志、Secrets、Security Group 与项目 Schema 的零残留回读；
- 共享 Foundation 受保护的反向证明。

实验室数据必须标为 `controlled-browser`，不能描述成真实用户现场数据；历史数据必须标为 `historical-verified-snapshot`。样本稀疏时明确低置信度。

## 失败与降级

- Manifest、路由、交互、遥测响应或指标覆盖失败：AWS 创建前停止。
- Budget Guard、Free-plan eligibility、OIDC 或共享资源盘点失败：不创建资源。
- 云端接收、Cleaner、聚合或 Dashboard 回读失败：保留真实失败制品，立即进入精确清理。
- 清理未证明零残留：状态为 `cleanup-required`，只能用固定 Recovery Workflow 处理；不得即时重复部署。
- Runtime 关闭后，Dashboard 诚实回退到最近已验证快照并明确“非实时”。

## 多应用同步边界

公共仓库只吸收已经在 BabySteps 中实现并验证的能力：Manifest Schema、覆盖验证器、预算/TTL/清理合同和 reusable GitHub Actions 输入。每个应用保留自己的路由、断言、代表性交互和业务指标适配器。

接入顺序：

1. BabySteps 完成一次全指标临时闭环与零残留；
2. 抽取并发布公共标准、Schema、验证脚本和 reusable workflow；
3. TC Flow 本地 Gate 与 GitHub 远端 Gate 同步；
4. 选择一个第二应用做回归，证明公共层没有 BabySteps 专属假设；
5. 其余应用逐个接入，未完成接入的应用保持 `pending`，不得显示成已启用。

## 验收标准

1. 本地 Gate 能在缺少 CLS、INP 或关键导航阶段时确定性失败，且不触发 AWS。
2. BabySteps 的受控旅程能产生 LCP、CLS、INP、FCP、TTFB 和四个关键导航阶段样本。
3. 云端 Query/Dashboard 对每个必需指标均返回真实 `sampleCount > 0` 与分位数。
4. 运行完成后项目 Stack、ECS、ECR、SQS/DLQ、日志、Secrets、Security Group 和 Schema 均为零残留；共享资源保持受保护。
5. Evidence 页面展示架构、时序、费用、指标合同、Run/commit、真实截图/录屏、限制与清理证据。
6. 公共合同在至少一个非 BabySteps 应用通过本地回归后，才标记为 `verified reusable`。

## 非目标

- 不建设常驻生产监控集群。
- 不把受控浏览器样本描述为真实用户体验。
- 不为了填满 Dashboard 而制造错误、长任务、坏 CLS 或虚假链上交易。
- 不在应用仓库保存 AWS 凭据、Cookie、Token、钱包完整地址、请求正文或用户输入。
- 不自动合并 PR 或自动发布生产。
