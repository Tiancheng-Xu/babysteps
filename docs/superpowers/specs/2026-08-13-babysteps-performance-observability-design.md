# BabySteps 性能可观测链路设计

## 目标

把性能 SDK、AWS 异步日志清洗和真实统计 Dashboard 融入 BabySteps，完成一条可复验、可暂停、可清理的真实链路，同时保证 SDK 故障不影响产品主流程。

## 完成范围

- 浏览器采集 LCP、CLS、INP、FCP、TTFB、资源/请求耗时、JS error、unhandled rejection、自定义 mark，以及钱包连接、签名、合约读写和交易确认耗时。
- SDK 支持采样、单页限流、批量、5 秒定时 flush、`pagehide` flush、`sendBeacon` 优先、`fetch keepalive` 兜底和静默失败。
- 同源 Worker 代理把事件转发到 AWS HTTP API；浏览器不持有 AWS 地址、凭据或 Origin Token。
- AWS Lambda 校验来源、Origin Token、Schema、时间窗和每批上限，再异步写入 SQS；失败由 HTTP 状态表达，不同步清洗。
- SQS 配置重试和 DLQ；ECS Fargate Cleaner 按需运行，完成脱敏、去重、路由归一化和幂等聚合。
- 复用共享 PostgreSQL，仅创建 BabySteps 独立 Schema/角色/表；原始脱敏事件和聚合查询职责分离。
- Dashboard 按时间、route、metric、environment、version 筛选，展示真实 sample count、p50/p75/p95、错误率、趋势、route 对比和慢请求榜。
- Evidence 记录单个受控事件从浏览器到 Dashboard 的追踪 ID、资源 ID、测试、查询窗口、样本量、架构、失败路径和清理结果。

## 架构

```text
Browser SDK
  -> Cloudflare Worker /api/performance/*（同源代理、Origin Token）
  -> API Gateway HTTP API
  -> Ingest Lambda（来源/鉴权/Schema/批量上限）
  -> SQS Main -> DLQ
  -> ECS Fargate Cleaner（按需任务，不常驻）
  -> shared PostgreSQL / babysteps_performance schema
  -> Query Lambda / API Gateway
  -> BabySteps Performance Dashboard
```

## 数据边界

- SDK 允许字段使用固定 Schema；不采集 Cookie、Authorization、Token、请求正文、邮箱、钱包签名或完整钱包地址。
- Route 去除 query/hash、数字 ID 和地址型片段；URL 仅保留同源归一化 path。
- 原始脱敏事件按 `event_id` 幂等保存并设置保留窗口；Dashboard 只通过服务端查询聚合，不直接连接数据库。
- 分位数由查询窗口内真实样本计算；禁止平均多个 p75，也不提供伪造平滑曲线。

## 可靠性

- SDK 全部入口均为 best-effort，不抛出到宿主应用。
- Ingest Lambda 拒绝超大批次、过期事件和非法枚举；成功入队后返回 `202` 与 request ID。
- Cleaner 对暂时错误不确认消息，让 SQS 重试；永久非法消息记录安全原因后确认消费，避免无限污染 DLQ。
- 数据库使用唯一键保证重放幂等；部分批次失败只重试失败消息。
- Dashboard 在页面可见时每 10 秒刷新，并保留上一轮数据，失败时显示“暂不可用”而不是模拟数据。

## AWS 费用与生命周期

- 复用并保护共享 VPC、NAT、私有子网、PostgreSQL、artifact bucket 和 GitHub OIDC；BabySteps cleanup 不得删除它们。
- 项目新增：API Gateway、2 个 Lambda、SQS/DLQ、ECR、ECS Cluster/Task Definition、短保留 CloudWatch Logs、BabySteps 数据库 Schema。
- 不创建 ALB、第二套 NAT/RDS、ECS 常驻 Service、Synthetics 或 SNS。
- 部署只允许 GitHub Actions + OIDC；Root CLI 只读。
- 真实验证完成后：停止/禁用调度，确认没有运行任务；导出脱敏 Evidence；删除 BabySteps 性能项目 Stack、ECR 镜像和项目 Schema。共享底座继续保留。

## 验收

1. 五项 Web Vitals、资源/请求、JS 错误、自定义和 Web3 耗时都有单元测试。
2. 采样、限流、批量、定时/卸载 flush、Beacon/fetch 降级和静默失败可自动验证。
3. Lambda 鉴权、Schema、批量上限与 SQS 入队通过测试；无浏览器 AWS 凭据。
4. Cleaner 脱敏、去重、route 归一化、幂等、临时/永久错误边界通过测试。
5. Dashboard 使用真实 API 数据，显示 sample count 与 p50/p75/p95，并完成 375/390/430/1440 响应式验收。
6. 本地 Gate、远端 GitHub Actions、Cloudflare 预览和 AWS 受控事件闭环全部通过。
7. Evidence 完整后，项目计费资源停止或销毁，并给出清理后的只读盘点证明。

## 非目标

- 不实现 Firehose/Glue/Athena 数据湖、ALB、常驻 ECS Service、机器学习异常检测或跨项目统一 Dashboard。
- 不把 IaC、fixture 或演示曲线作为云端完成证明。
