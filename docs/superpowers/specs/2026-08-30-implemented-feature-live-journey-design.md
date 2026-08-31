---
title: BabySteps 已实现功能真实全旅程与性能证据设计
contentType: Conceptual
audience: BabySteps 项目开发者、作业验收人与 Evidence 审核人
goal: 只对当前已实现功能执行真实 UI、Sepolia、Worker/D1 与 AWS 性能闭环，并生成可复核证据
status: Approved
approvedScopeAt: 2026-08-30
approvedByUserAt: 2026-08-30
openQuestions: []
---

# BabySteps 已实现功能真实全旅程与性能证据设计

## 决策与边界

本轮只覆盖当前仓库中已经存在 UI、Hook、API 或链上调用路径的功能。历史 README、旧设计稿或 Evidence 中出现但当前没有可操作 UI 的能力，不进入本轮实现，也不得在最终录屏或 Evidence 中写成已完成。

本轮采用“真实浏览器旅程 + 专用 Sepolia 测试身份 + 真实链上回读 + 临时 AWS 性能闭环”的混合方案：

- 浏览器执行用户真正能看到的导航、输入、按钮、钱包确认、等待和结果回读；
- 所有链上写操作只使用 Sepolia 专用测试钱包、测试 ETH、BABY 和测试 NFT/SBT；
- Provider、Owner/Relayer、家长和接收者使用明确的测试角色，不使用主网钱包或真实资产；
- 钱包签名由用户在可见钱包界面确认，自动化不得读取私钥、助记词或签名材料；
- 每个流程必须证明开始、关键节点、最终状态、性能事件和必要的补偿/清理；
- 打开页面、看到按钮、Mock 成功状态或已有历史交易都不能代替本轮真实流程。

### 明确排除

以下能力虽然出现在较早设计中，但当前没有完整 UI，因此不属于本轮“已实现功能”验收：

- Provider 的 D1 草稿保存、编辑与重新哈希；
- Owner 授予或撤销 Provider、暂停或恢复任务；
- 独立任务详情页以及评论发布、编辑、软隐藏；
- 家长购买、进度和证书的独立总览；
- 余额不足时在购买抽屉内自动串联 Swap、Approve 与 Buy；
- 任何当前页面没有入口的后台或计划能力。
- Agent Market 所属的仲裁流程和 Cocos 功能；它们应在所属项目单独录屏与验收。

这些项目必须继续显示为未实现或不在本轮范围，不能靠合约脚本、隐藏接口或测试夹具冒充产品 UI。

## 身份、角色与测试资产

### 测试身份

至少使用以下逻辑身份；Evidence 只保存别名和脱敏地址：

| 身份 | 用途 | 最小权限与资产 |
| --- | --- | --- |
| Parent A | 登录、活动、购买、完成提交、抽卡、兑换 | Sepolia Gas、最小 BABY、Privy 测试身份 |
| Recipient B | 接收旧成长星并验证双方余额 | 独立 Sepolia 地址，不需要产品角色 |
| Provider C | 创建成长任务 | `PROVIDER_ROLE` 与 Sepolia Gas |
| Owner/Relayer D | 审批或拒绝任务、确认完成并铸证 | Owner 或 `COMPLETION_RELAYER_ROLE` 与 Sepolia Gas |

如果现有部署把多个角色授予同一个专用测试钱包，可以复用该钱包，但录屏与机器证据必须在每一步标明当前角色，不能把单钱包结果描述成角色隔离证明。

### 凭据边界

- 私钥、助记词、Privy Token、Cookie、OAuth 凭据和钱包完整地址不得进入 Git、聊天、命令行参数、公开日志、录屏或 Evidence；
- 现有 Hardhat keystore、系统 Keychain 或用户可见钱包是唯一允许的签名载体；
- 不新增 GitHub 长期 Access Key，不把链上私钥放入 GitHub Actions；
- 测试钱包必须不持有主网资产，所有交易前验证 `chainId=11155111`。

## 旅程执行模型

每个功能流程使用同一状态机：

`preflight → UI ready → input → validation → wallet/signature → broadcast → receipt → product readback → telemetry accepted → evidence → compensation`

完成条件不是“点击成功”，而是同时满足：

1. UI 显示精确的最终成功状态；
2. 交易流程存在 Sepolia transaction hash 与成功 receipt，链下流程存在 Worker/D1 语义回读；
3. 页面重新读取后的状态与链上或链下事实一致；
4. 对应性能事件被本轮接收端接受，且事件包含 route、environment、commit、outcome、duration 与新鲜时间；
5. 录屏和逐步 JSON 能关联同一个 journey ID；
6. 需要补偿的测试状态已经恢复，不能恢复的测试网历史已明确披露。

钱包拒签、字段错误、余额不足、角色不足等安全失败分支只在不会破坏后续旅程时执行。系统错误、坏 CLS、Long Task、RPC 故障和失败交易不得人为制造来填充样本。

## 当前已实现功能矩阵

### 全局、首页与家长中心

| Journey ID | Route | 真实动作 | 最终证明 | 补偿或清理 |
| --- | --- | --- | --- | --- |
| NAV-01 | 全站 | 九条导航、深链、刷新、404、返回 | URL、标题、SSR/水合、SPA 切换、无 pageerror | 无 |
| WALLET-01 | `/` | 连接钱包、必要时切到 Sepolia、读取地址与网络 | Sepolia 网络、脱敏地址、读取成功 | 最后断开 |
| GROWTH-01/02/03 | `/` | Meal、Walk、Read 各执行一次可领取活动 | 分别增加 3/5/7；receipt 后阶段和余额刷新 | 链史不可回滚，标为测试记录 |
| TRANSFER-01 | `/` | Parent A 向 Recipient B 赠送最小成长星 | 双方余额变化、累计成长值不变 | 如产品允许，B 转回最小余额；保留链史 |
| NOTE-01 | `/` | 保存、覆盖、刷新读取公开便签 | 当前便签与链上读取一致，280 字节校验有效 | 二次确认后清空当前值 |
| BABY-01/02/03 | `/parent` | 三类 BabyCoin 活动各执行一次 | BABY 余额与 lifetimeEarned 语义正确 | 链史不可回滚 |
| PARENT-READ-01 | `/parent` | 读取钱包、BabyCoin、成长阶段与便签 | 页面与链上读取一致 | 清空便签、断开钱包 |

活动受冷却或每日上限约束时，不通过修改浏览器时间、直接写合约存储或隐藏按钮绕过。旅程可以使用多个专用测试钱包分摊冷却；仍无法执行时保持阻断，不能用旧交易替代。

### 任务市集与完成流程

| Journey ID | Route | 真实动作 | 最终证明 | 补偿或清理 |
| --- | --- | --- | --- | --- |
| MARKET-READ-01 | `/tasks` | 读取任务列表并执行一次重试路径 | task 数量、状态和 RPC settle | 无 |
| MARKET-APPROVE-01 | `/tasks` | 对一个 Active task 执行精确 BABY allowance | allowance 与价格一致，receipt 成功 | Buy 消耗或最终 approve 0 |
| MARKET-BUY-01 | `/tasks` | 支付 BABY 购买任务 | purchaseId、Provider 收款与购买事实 | 购买不可回滚，使用唯一测试任务 |
| CONTENT-01 | `/tasks` | 登录会话下解锁已购内容 | Worker 同时验证会话与链上购买 | logout |
| COMPLETE-SUBMIT-01 | `/tasks` | 提交无个人信息的完成说明 | D1 记录与 evidence hash 回读 | 使用唯一 Run 标识；审计记录保留 |

任务详情和评论 UI 不存在，明确排除；不得直接调用 comments API 把它写成用户功能覆盖。

### Provider 与 Owner

| Journey ID | Route | 真实动作 | 最终证明 | 补偿或清理 |
| --- | --- | --- | --- | --- |
| PROVIDER-CREATE-01 | `/provider` | Provider 输入测试 metadata URI/hash 并创建任务 | `PendingReview`、taskId、成功 receipt | 进入批准或拒绝流程 |
| OWNER-APPROVE-01 | `/provider` | Owner 批准一个待审任务并请求 VRF | `PendingRandomness → Active`，价格和开放时长确定 | 任务用于购买闭环 |
| OWNER-REJECT-01 | `/provider` | 创建第二个任务并填写非敏感原因后拒绝 | `Rejected` 与原因 hash | 不可恢复，标记为测试拒绝 |
| COMPLETION-LOAD-01 | `/provider` | 登录会话加载完成申请 | D1 列表与 task/purchase 对应 | 无 |
| COMPLETION-CONFIRM-01 | `/provider` | Relayer 角色确认完成并铸证 | 完成事实、幂等 purchaseId、ERC-5192 SBT receipt | 不可回滚，保留测试证书 |

### 纪念卡、兑换与身份

| Journey ID | Route | 真实动作 | 最终证明 | 补偿或清理 |
| --- | --- | --- | --- | --- |
| KEEPSAKE-DRAW-01 | `/keepsakes` | 消耗 12 星请求抽卡并等待 VRF | 请求 receipt、VRF settle、新卡片 | SBT 与链史保留 |
| KEEPSAKE-FUSE-01 | `/keepsakes` | 选择三张同系列同稀有度卡并融合 | 成功升级或合约定义的真实失败结果 | 结果不可回滚 |
| KEEPSAKE-RECOVER-01 | `/keepsakes` | 对已超过恢复窗口的 pending 请求执行恢复 | 余额退回或卡片解锁 | 恢复本身是补偿 |
| QUOTE-01 | `/exchange` | 对页面支持的输入资产读取真实报价 | QuoterV2 成功结果；失败不能冒充成功 | 无 |
| SWAP-01 | `/exchange` | 必要时 Wrap、有限 Approve、`exactInputSingle`、等待 receipt | BABY 到账、allowance 与余额回读 | 剩余 allowance 归零；测试资产可保留 |
| IDENTITY-LOGIN-01 | `/profile` | 使用一个批准的 Privy 登录入口 | Privy authenticated | 最后 logout |
| IDENTITY-SESSION-01 | `/profile` | challenge、无 Gas 钱包签名、verify | HttpOnly 会话与 profile 读取成功 | Worker logout 清理会话 |
| PROFILE-01 | `/profile` | 保存 2–32 字符中性测试用户名 | D1 回读与 UI 一致 | 覆盖为中性结束值后 logout |

抽卡恢复需要真实超时请求，融合需要三张满足条件的卡。如果当前链上状态不满足，先通过同一公开 UI 准备资产；可能跨越多个 VRF 回合和恢复窗口。不得修改合约存储、伪造卡片或跳过钱包签名。

### 性能与 Evidence

| Journey ID | Route | 真实动作 | 最终证明 | 补偿或清理 |
| --- | --- | --- | --- | --- |
| PERF-01 | `/performance` | Live 模式筛选 window/route/env/version，切换历史快照 | Query 返回本轮新鲜样本；Runtime 关闭后诚实降级 | 清查询参数；AWS 精确清理 |
| EVIDENCE-01 | `/evidence` | 播放录屏、打开 Run/交易/架构链接 | 媒体可播放、链接 200、证据与 commit 一致 | 无 |

## 性能指标与业务阶段

每条旅程都采相同的浏览器基础指标：LCP、CLS、INP、FCP、TTFB、导航分项、资源类型、Long Task、JavaScript error 与 Promise rejection。Core Web Vitals 使用 p75，受控浏览器数据明确标为 `controlled-browser`，不能描述成真实用户 RUM。

现有业务操作还需要固定、低基数的业务指标。指标不得包含 taskId、purchaseId、钱包地址、便签、用户名、完成说明或交易正文：

- `business.growth.activity`
- `business.growth.transfer`
- `business.notebook.write`
- `business.babycoin.activity`
- `business.marketplace.approve`
- `business.marketplace.buy`
- `business.marketplace.content_unlock`
- `business.marketplace.completion_submit`
- `business.provider.create`
- `business.owner.approve`
- `business.owner.reject`
- `business.owner.completion_confirm`
- `business.keepsake.draw`
- `business.keepsake.fuse`
- `business.keepsake.recover`
- `business.exchange.quote`
- `business.exchange.swap`
- `business.identity.login`
- `business.identity.session`
- `business.profile.write`

链上写入至少拆分以下阶段：

1. UI 提交到钱包请求出现；
2. 用户确认到交易广播；
3. 广播到成功或失败 receipt；
4. receipt 到产品状态重新读取完成；
5. 端到端总耗时。

用户停留在钱包中的人工确认时间必须标为 `manual-signature-included`，不能与自动受控交互直接横向比较。每个业务指标保存 sampleCount、p50/p75/p95、outcome、route、commit、环境、设备/限速、采集时间和 freshness。

## 运行与取证架构

完整验证分为四个连续 Gate：

1. **本地确定性 Gate**：组件/Hook/Worker/合约测试、Journey Schema、功能矩阵完整性、静态构建、页面错误和响应式检查；不连接 AWS，不发链上交易。
2. **Sepolia 预检 Gate**：只读核对 chain ID、合约地址、角色、余额、allowance、任务状态、VRF 可用性、Privy/Worker 配置和专用钱包，不读取任何 Secret Value。
3. **可见真实旅程 Gate**：通过真实浏览器和用户确认的钱包逐项执行；交易与录屏必须来自同一 commit、环境和 journey ID。
4. **AWS Live 性能 Gate**：在本地覆盖、Budget Guard 与前述业务旅程合同通过后，只触发一次临时性能 Stack，完成 Browser → API → SQS/DLQ → ECS → PostgreSQL → Query/Dashboard → Evidence → DROP SCHEMA → delete-stack → 零残留。

当前 Run `33311946947` 只证明了路由/代表性交互、浏览器接收和 Cleaner；`Query and verify real browser aggregates` 失败，Live Dashboard 被跳过，且清理尚未完成。因此它只能作为失败诊断证据，不能成为新的历史快照。下一次 AWS Run 必须先解释并修复该精确聚合失败，不能直接重复派发。

## 录屏与视觉证据

最终证据使用多段原始录屏和一个章节化总览：

- 每个业务 Journey 一段连续录屏，包含页面、钱包确认、等待状态、结果与交易链接；
- 总览视频只裁剪等待时间，不改写结果，不把不同 Run 的动作拼成同一笔交易；
- 伴随 JSON 记录章节、route、journey ID、开始/结束时间、commit、交易哈希或链下回读、outcome、性能事件 ID 与截图文件；
- 截图覆盖 375、390、430、1440，验证无根级横向溢出、pageerror=0、关键状态可读；
- BackstopJS 使用固定环境与已审核 baseline，差异必须人工检查，不盲目更新 reference；
- 录屏、截图和日志不得出现邮箱、Cookie、签名、完整钱包地址、Private Key、Secret Value 或本地绝对路径。

## 失败、恢复与清理

- 任一步骤未达到产品回读或 telemetry accepted，当前 Journey 失败；不得继续写“已覆盖”。
- 钱包拒签、余额不足、角色不足、VRF 未完成、RPC 不稳定和 Worker 错误分别保存精确根因，不用同一 `unknown` 覆盖。
- 一个链上交易失败不触发未知重试；先读取 nonce、receipt 和链上状态，确认没有成功后再决定是否重试。
- 不可回滚的 Sepolia 测试交易、任务、购买、证书和纪念卡在 Evidence 中明确标为持久测试历史。
- 可补偿状态在结束前恢复：allowance 归零、公开便签清空、测试用户名覆盖为中性值、会话 logout、钱包断开。
- AWS 失败一律进入 `always()` 清理；只有 `cloudFormationStackAbsent=true`、`remainingProjectResources=0`、主队列和 DLQ 为 0、项目 Schema 缺失且共享 Foundation 受保护，才允许标记清理完成。
- 清理失败只使用固定 Recovery workflow 处理同一精确 Stack，不重复采样、不创建第二套 Runtime。

## 预计修改边界

实施阶段只修改与本合同直接相关的文件：

- Journey Manifest 与浏览器执行器；
- 现有功能 Hook 的业务阶段性能埋点；
- 性能事件 Schema、Cleaner 与 Query 聚合白名单；
- 本地和 GitHub Actions Gate；
- 录屏/截图/交易与清理 Evidence；
- Evidence 页面与实现映射。

不实现“明确排除”中的新产品功能，不修改共享 AWS Foundation，不升级或取消 AWS Free 计划，不创建常驻性能服务。

## 验收标准

1. 当前已实现功能矩阵中的每个 Journey 都有本轮 `PASS` 证据；没有以页面可见、Mock、旧交易或脚本直调冒充 UI 流程。
2. 所有链上写入均为 Sepolia，具有成功 receipt 与产品回读；主网交易数为 0。
3. Provider → Owner → VRF → Approve → Buy → 完成提交 → Relayer → SBT 的现有 UI 路径闭环完成。
4. 抽卡、融合、恢复、旧成长活动、转移、便签、BabyCoin 活动与 Swap 都通过当前 UI 执行。
5. Privy 登录、签名会话、用户名保存与 logout 完成，公开证据不泄露身份数据。
6. 每个 Journey 至少有业务阶段耗时，基础性能指标按真实可观测性给出样本或诚实不可用；不制造错误、Long Task 或坏 CLS 填数。
7. 原始录屏、章节总览、逐步 JSON、交易哈希、D1/链上回读和 AWS artifact 可交叉关联同一 commit 与 journey ID。
8. 测试、类型、构建、公开内容、链接、BackstopJS、375/390/430/1440、Chrome Performance 和 pageerror Gate 全部通过。
9. Cloudflare 生产发布与生产 HTTP/功能回读成功后才更新 Evidence。
10. 临时 AWS Runtime 与可补偿测试状态完成清理；不可删除的 Sepolia 测试历史被准确披露。
