# BabySteps 性能覆盖语义与全路由检查（2026-08-30）

## 结论

本次修复调整性能指标的覆盖语义、受控浏览器 Journey、SDK 的低优先级公平采样与 Dashboard 展示。中间失败 Run [`33292966972`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33292966972) 已安全失败并完成零残留清理；Run [`33304145710`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33304145710) 在无 AWS 权限的 `local-coverage` 前置 Job 停止，未创建 AWS Runtime。最终 Run [`33370197607`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33370197607) 已在 commit `f15bc873b14b` 完成 9 路由、232 事件、49 批次、Cleaner 232/232、Live Dashboard 与零残留闭环，现为最新生产历史快照；完整证据见 `docs/evidence/testing/2026-08-31-performance-aws-final.md`。

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

受控 Journey 扩展到 `/`、`/tasks`、`/parent`、`/keepsakes`、`/provider`、`/exchange`、`/profile`、`/performance`、`/evidence` 共 9 条路由；在 `/performance` 使用同源、无用户数据的探针采集 fetch、XHR、stylesheet、image、font 与 generic Resource Timing，在首页执行真实 SPA 路由切换，在兑换页只执行 Sepolia 报价读取。报价场景的成功与失败分别记录：二者都能证明场景已执行，但失败绝不冒充成功。Journey 不会故意制造错误、坏 CLS、钱包授权、Swap 或链上写交易来填数。

为避免先创建 AWS 资源、后发现浏览器合同不完整，`aws-performance.yml` 现在把同一份生产 Edge SSR 产物和同一份 Journey Manifest 放进独立的 `local-coverage` 前置 Job。该 Job 不申请 GitHub OIDC、没有 AWS 环境变量，只有 9 路由、代表性交互、资源探针、渲染指标和覆盖语义全部通过后，后续临时 AWS Job 才能开始。

合并后的首次派发 Run [`33298723546`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33298723546) 在该前置 Job 的本地 Worker 就绪检查中于 30 秒后以 `curl` exit 7 停止；`prove-and-clean` 被跳过，因而没有创建 AWS Runtime。修复不是绕过 Gate，而是把启动等待扩为有界 90 秒，并同时监测 Worker PID：进程提前退出或超时都会输出最后 80 行本地启动日志并继续 fail-closed，避免“无诊断地重跑”。

首次云端尝试中，9 条路由全部通过，但最终 Coverage Gate 拒绝了缺少 XHR 与 stylesheet 的不完整样本。根因不是 AWS 接收失败，而是模块加载与 RPC 诊断先占满 SDK 每分钟额度，导致后到的资源类别和 SPA 路由耗时被饥饿。修复后，队列明确分为业务错误与 Web Vitals、合同必需覆盖、普通诊断三层；生产每分钟额度的一半保留给合同必需指标，同一高频指标另有有界上限。总体事件上限不变，不增加 Worker 或 AWS 配额。Coverage Gate 同时只输出白名单内缺失指标的脱敏 token，后续失败不再只有笼统错误。

SSR 场景还发现一项独立缺陷：客户端静态路由树包含 `Suspense`，服务端静态树缺少对应流式边界标记，导致所有路由触发 React hydration recoverable error。修复后服务端保留不含 Privy 的专用静态树，但与客户端使用相同的 Error Boundary 与 Suspense 外壳；钱包、查询和身份 Provider 仍只在 hydration 完成后挂载。逐路由复核为 9/9 无 recoverable error、无 CSR fallback、无 `pageerror`。

Run `33304145710` 的精确根因不是 INP SDK 未安装：同一页面逐步诊断证明 `onINP(..., { durationThreshold: 0 })` 能产生真实 Event Timing 样本，但原“填写页面路径并应用筛选”交互在 CI 中偶尔低于浏览器可报告阈值。候选修复在 6 倍 CPU 降速下继续使用真实 UI，追加“历史快照”模式切换并等待两个绘制帧；不插入忙循环，也不伪造 INP。另一个缺口来自 `/tasks`：Sepolia 市集读取通常在路由标题出现后才完成，旧 Journey 过早离开页面。现在 Manifest 明确等待只读状态结束，再验收 `rpc.read` 与 `web3.rpc.read`；整个过程不连接钱包、不签名、不发交易。

Run [`33309628686`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33309628686) 在合并后的精确 main 提交上再次于 `local-coverage` fail-closed：9/9 路由均完成，但新增的精确路由 Gate 发现 INP 最终生命周期回调没有绑定到 `/performance`，因此 `prove-and-clean` 被跳过，AWS Runtime 仍未创建。根因是 `web-vitals` 默认只在页面生命周期结算最终 INP；CI 的快速页面切换会把回调延后到另一条路由。修复仅在受控浏览器构建中启用 `reportAllChanges`，让同一个真实 Event Timing 交互在当前路由立即上报；生产 RUM 默认值不变，仍保持每个页面生命周期的最终 INP 口径。本地复核为 9/9 路由、`215` 个事件、`40/40` 批次接受、`representativeInteraction.route=/performance`、`metric=INP`、`observed=true`。

Run [`33310685523`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33310685523) 证明只启用 `reportAllChanges` 仍不足以消除 Linux runner 的 freshness race：9/9 路由再次完成，但生命周期排空函数看到“此前路由的累计批次已经 settled”后可提前返回，而 `/performance` 的 INP 仍在 `web-vitals` idle callback 中等待处理；下一次导航随后销毁旧 Document。该 Run 同样在 `local-coverage` 停止，`prove-and-clean` 被跳过，未创建 AWS Runtime。修复把代表性交互由直接赋值的 `fill()` 改为真实逐键输入，并把排空条件升级为“精确 `/performance` INP `eventId` 已被接收且全部批次 settled”；旧路由的 accepted batch 不再能满足新路由。整个过程仍使用真实 Event Timing，不插入忙循环、不生成合成指标，也不放宽路由 Gate。最终候选本地复核为 9/9 路由、`206` 个事件、`45/45` 批次接受、精确 `/performance` INP 已接收、`missingRequired=[]`、健康错误/降级 `unexpectedObserved=[]`。

读回 Gate 同步升级为全合同校验：每个必需样本都校验单位、样本数、p50/p75/p95 顺序与 `observed` 状态；DNS/TCP/TLS 必须是空分位数的 `unavailable`；JS/Promise 错误、CSR fallback 与 hydration recoverable error 必须是 `observed-zero`；钱包、身份和写交易能力在这条匿名只读 Journey 中必须是 `not-exercised`。失败的只读报价或合约读取以 `.error` 原始事件进入聚合，并折叠为对应操作的失败样本，绝不冒充成功。

业务指标覆盖进一步绑定到 **事件类型 + 指标名 + 精确路由 + outcome**：`contract.read` 与报价只能来自 `/exchange`，`rpc.read` 与 `web3.rpc.read` 只能来自 `/tasks`；错误路由的同名事件不能再通过 raw-name fallback 补齐覆盖。Web3 基础名只允许成功 outcome，`.error` 名只允许失败 outcome；名称与 outcome 矛盾的事件在 AWS Schema 和本地 Journey 都 fail-closed。云端读回还必须同时匹配候选 commit、`production` 环境、`1h` 窗口、Run 起始时间之后的新鲜度，以及 9 条路由各自的真实样本，旧 Run 或其他版本不能补齐本轮合同。

## 场景合同

- **强制观测（23 项）**：LCP、CLS、INP、FCP、TTFB；request wait、download、DOM ready、window load；fetch、XHR、script、stylesheet、image、font、generic resource；SSR shell、hydration、SPA route；`contract.read`、`rpc.read`、`web3.rpc.read` 与 Sepolia Uniswap quote。
- **零次或真实观测均有效**：Long Task。快速、健康页面没有 Long Task 时必须聚合为 `observed-zero`（次数与总耗时为 0、分位数为空）；若确实发生则必须提供真实 `longtask.duration` 样本，不能为了通过 Gate 人为阻塞主线程。
- **健康零事件**：JS error、Promise rejection 的八个分类、hydration recoverable error、CSR fallback。任意一项在 Journey 中出现都会直接失败，不再把错误样本当成“覆盖成功”。
- **有条件执行**：Privy 登录、钱包连接、challenge/sign/verify、合约写入、approve、swap、transaction receipt。代码与 Schema 必须存在真实埋点 owner，但没有用户授权、测试资产和 Gas 时保持 `not-exercised`，不能自动签名或发送交易。
- **环境不可用**：DNS、TCP、TLS 在本地同源与连接复用下不输出伪造值，保持 `unavailable`。

Run `33292966972` 的 Cleaner、聚合查询与 Dashboard 截图因浏览器 Gate 失败而严格跳过，没有把部分数据发布成成功 Evidence。Artifact `9726707324` 证明：临时 Schema 已删除且复核不存在，CloudFormation Stack 不存在，12 类项目资源剩余数为 `0`；共享 VPC、NAT、RDS、OIDC、Artifact Bucket 与 Foundation 保持只读保护。

## 验证

- 全量测试：validators `100/100`、AWS `90/90`、contracts `108/108`、Web `293/293`、Worker `62/62`、Subgraph `4/4` 全通过。
- `pnpm typecheck`、`pnpm check`、`pnpm build`、`pnpm validate:delivery-evidence`、`pnpm validate:public-copy` 通过；CSS 仅保留 8 条既有 warning，无 error。
- 全路由浏览器矩阵：9 路由 × 375/390/430/1440，共 36 项；HTTP 200、正确主标题、根级横向溢出 0、`pageerror` 0，性能历史页可见含混文案计数 0。
- BackstopJS：375/390/430/1440 共 `4/4` 通过，性能模块布局 Gate `2/2` 通过；候选与已审阅基线无像素差异，没有用 mask 隐藏产品内容。
- 修复后本地 Edge SSR + hydration Journey：9/9 路由、`215` 个事件、`40/40` 批次接受、拒绝与传输失败均为 `0`；23 项强制观测全部覆盖，`missingRequired=[]`；INP 为 `/performance` 的真实代表性交互样本，12 项健康零错误/降级的 `unexpectedObserved=[]`。Sepolia 报价调用已执行并明确记录为失败，不冒充成功；`contract.read`、`rpc.read`、`web3.rpc.read` 均有真实只读样本，也没有发起授权、Swap 或链上写入。完整性能 Journey 视频与逐路由截图保存在本地临时 Gate 产物中。
- 推送前 PRD 全功能录屏已完成：`34.4s`、`1440×900`、`25fps`、16 段、9 条路由，并切换到 `390×844` 移动视口；`pageerror=0`、钱包写入 `0`、链上交易 `0`。只读报价 outcome 为 `failure`，AWS Runtime 关闭时性能筛选 outcome 为 `unavailable`，均未冒充成功。视频 SHA-256 为 `61c0188e2eb8ce489ca8b24670b426d6c2b6f479c319fafa1ce26259e3dc7f87`，伴随 JSON 固定 provenance、commit、视口、outcome 与边界；视频抽帧拼图已人工复核。
- 工作树检查：`git diff --check` 通过；生成代码与用户文件未被带入修改清单。

## 边界

- 首次 AWS Runtime 只使用现有受控临时资源与自清理路径；它已删除，且未修改或取消 AWS Free 计划。
- `observed-zero` 只表示本轮受控窗口内没有观测到事件，不证明线上永远不会出错或永远没有 Long Task。
- `not-exercised` 不等于功能失败；它明确表示本轮安全采样没有执行需要身份、资产、Gas 或外部授权的动作。
- 全场景合同修复目前为本地已验证、云端待补验；新的资源、渲染、Long Task、只读 Web3 样本与 9 路由统计仍必须由新的临时 Run、Cleaner 写入、Dashboard 查询和零残留清理共同证明。
