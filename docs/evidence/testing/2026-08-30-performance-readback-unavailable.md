# Run 33311946947 导航不可用覆盖根因

## 结论

Run `33311946947` 的浏览器、接收端与 ECS Cleaner 均成功，聚合回读在
`INVALID_UNAVAILABLE_COVERAGE_navigation_dns` 处 fail-closed。临时 Schema 与
CloudFormation Stack 随后成功删除；该 Run 不是可发布的性能快照。

根因位于浏览器发送前的优先队列与本地覆盖判定之间：

1. `collectNavigationEvents()` 会把连接复用导致的 DNS/TCP/TLS `0 ms` 写成
   `outcome=unavailable`，这是正确的可观测性语义；
2. DNS/TCP/TLS 没有列入 `coverageCriticalNames`，在同一分钟低优先级事件达到配额后
   可以被客户端丢弃；
3. Browser Journey Summary 又预先把三个指标写入 `coverage.unavailable`，即使事件没有
   进入已接收批次，本地 Gate 仍会通过；
4. PostgreSQL Query 没有收到该事件，因此诚实返回非 `unavailable` 状态，云端 Validator
   正确拒绝了结果。

## 修复合同

- DNS/TCP/TLS 进入覆盖关键优先队列，每个页面分钟窗口最多各保留一个；
- Journey Summary 只从真实出站批次生成 `coverage.unavailable`，不再预填；
- 缺少任一显式不可用事件时输出稳定错误码
  `INCOMPLETE_UNAVAILABLE_COVERAGE_*`，在 AWS 创建前阻断；
- 聚合仍保持 `sampleCount=0`、`p50/p75/p95=null`、`coverage=unavailable`，禁止把
  连接复用伪装成真实 `0 ms` 测量。

## 证明边界

本记录只证明根因和本地回归合同。只有后续新 Run 的 Query/Dashboard、SQS/DLQ 排空、
Schema 删除、Stack 删除和零残留 artifact 全部通过，才可更新生产历史快照。
