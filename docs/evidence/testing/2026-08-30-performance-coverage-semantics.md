# BabySteps 性能覆盖语义与全路由检查（2026-08-30）

## 结论

本次修复只调整性能指标的覆盖语义、受控浏览器 Journey、SDK 的低优先级公平采样与 Dashboard 展示，不把本地验证冒充新的云端闭环。生产历史快照仍来自 Run `33279132965`。首次新云端尝试 Run [`33292966972`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33292966972) 已安全失败并完成零残留清理，因此没有替换该历史快照。

## 根因与修复

旧 Dashboard 把四种不同事实都显示为“已埋点，当前快照无样本”：

1. 真实未采到资源样本；
2. 本轮确实没有发生错误或 Long Task；
3. 安全 Journey 没有执行钱包、签名、Swap 或链上写入；
4. 本地 HTTP 与连接复用环境无法提供可信 DNS、TCP、TLS 阶段。

现在状态合同拆为：

- `observed`：已有真实样本；
- `observed-zero`：本轮观测窗口内未发生，属于健康零事件；
- `not-exercised`：本轮受控场景未执行该能力；
- `instrumented-no-sample`：埋点已启用但确实缺少样本；
- `unavailable`：当前环境不能提供可信测量。

受控 Journey 扩展到 `/`、`/tasks`、`/parent`、`/keepsakes`、`/provider`、`/exchange`、`/profile`、`/performance`、`/evidence` 共 9 条路由；只在 `/performance` 使用浏览器真实 Resource Timing 请求安全采集 fetch、XHR、stylesheet 与 image。它不会故意制造错误、长任务、坏 CLS、钱包授权、Swap 或链上交易来填数。

首次云端尝试中，9 条路由全部通过，但最终 Coverage Gate 拒绝了缺少 XHR 与 stylesheet 的不完整样本。根因不是 AWS 接收失败，而是 Vite 模块加载产生大量重复 `resource.script.duration`，先占满了 SDK 每分钟的低优先级额度，导致后到的资源类别被饥饿。修复后，同一个低优先级指标名在每页面、每分钟只保留首条；总体事件上限与高优先级预留不变，不增加 Worker 或 AWS 配额。Coverage Gate 同时只输出白名单内缺失指标的脱敏 token，后续失败不再只有笼统错误。

Run `33292966972` 的 Cleaner、聚合查询与 Dashboard 截图因浏览器 Gate 失败而严格跳过，没有把部分数据发布成成功 Evidence。Artifact `9726707324` 证明：临时 Schema 已删除且复核不存在，CloudFormation Stack 不存在，12 类项目资源剩余数为 `0`；共享 VPC、NAT、RDS、OIDC、Artifact Bucket 与 Foundation 保持只读保护。

## 验证

- 全量测试：validators、AWS、contracts、Web、Worker、Subgraph 全通过；Web `282/282`、Worker `62/62`、contracts `108/108`。
- `pnpm typecheck`、`pnpm check`、`pnpm build`、`pnpm validate:public-artifact` 通过；CSS 仅保留 8 条既有 warning，无 error。
- 全路由浏览器矩阵：9 路由 × 375/390/430/1440，共 36 项；HTTP 200、正确主标题、根级横向溢出 0、`pageerror` 0，性能历史页可见含混文案计数 0。
- BackstopJS：人工检查 candidate/diff 后更新基线，375/390/430/1440 共 `4/4` 通过；没有用 mask 隐藏产品内容。
- 修复后本地同构 Journey：9/9 路由、`156` 个事件、`24/24` 批次接受、拒绝与传输失败均为 `0`；LCP、CLS、INP、FCP、TTFB、四个导航阶段以及 fetch、XHR、stylesheet、image 全部覆盖，`missingRequired=[]`。
- 工作树检查：`git diff --check` 通过；生成代码与用户文件未被带入修改清单。

## 边界

- 首次 AWS Runtime 只使用现有受控临时资源与自清理路径；它已删除，且未修改或取消 AWS Free 计划。
- `observed-zero` 只表示本轮受控窗口内没有观测到事件，不证明线上永远不会出错或永远没有 Long Task。
- `not-exercised` 不等于功能失败；它明确表示本轮安全采样没有执行需要身份、资产、Gas 或外部授权的动作。
- 公平采样修复目前为本地已验证、云端待补验；新的资源样本与 9 路由统计仍必须由新的临时 Run、Cleaner 写入、Dashboard 查询和零残留清理共同证明。
