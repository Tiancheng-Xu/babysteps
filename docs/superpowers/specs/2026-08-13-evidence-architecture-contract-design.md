# BabySteps Evidence 严格架构契约设计

日期：2026-08-13

## 背景与目标

BabySteps 已有 `docs/architecture/starbuddy-web3-architecture.mmd` 作为工程真相源，其中包含系统上下文、运行时与数据流、链上链下事实边界、组件与外部服务、关键时序、CI/CD、安全、失败恢复和清理生命周期。公开 Evidence 页面目前只展示一张较早的 StarBuddy 概览图，没有公开展示关键业务时序，且概览图中的部分“待实现”状态已经落后于真实部署。

本次采用严格架构契约：公开 Evidence 必须同时呈现一张完整全局架构图和一张核心业务时序图；本地与 GitHub Gate 必须验证内容完整性、真实状态标记及页面引用关系，不能只检查文件是否存在。

参考 `yue3694/x-web3` 的可取之处是：用全局架构图解释系统边界，用分阶段时序解释跨链上链下闭环，并明确价格预言机只是参考信息而非结算真相。BabySteps 保留自己的差异化：Cloudflare Worker/D1、Chainlink VRF 随机任务、Uniswap v3 双池、The Graph、三 RPC 对照、ERC-5192 SBT，以及 AWS 可暂停/持续计费边界。

## 交付结构

### 1. 工程真相源

继续使用 `docs/architecture/starbuddy-web3-architecture.mmd`，并要求至少包含：

- 系统上下文；
- 运行时请求与数据流；
- 链上与链下事实所有权；
- 组件、职责、存储与外部服务；
- 至少一个核心业务 `sequenceDiagram`；
- 部署与 CI/CD；
- 权限与安全边界；
- 失败恢复与 Evidence；
- 预览或临时环境生命周期与清理责任；
- `已验证`、`待验证`、`计划/延后`等真实状态标记。

Mermaid 文档是工程状态的唯一文字真相源。展示图片只能帮助阅读，不能覆盖 Mermaid 中的真实状态。

### 2. 公开全局架构图

新增或更新一张 StarBuddy 主题的全局架构图，覆盖：

- 家长、Provider、Owner 与浏览器钱包；
- React、Privy/Reown、Cloudflare Pages/Worker/D1；
- Ethereum Sepolia 上的 BabyCoin、Marketplace V2、Chainlink VRF、Uniswap v3、ERC-5192；
- Public RPC、Infura、Alchemy 与 The Graph；
- AWS 已验证可暂停层和延后的持续计费 Relayer；
- GitHub Actions、OIDC、部署、验证与清理；
- 失败后停止、独立读取验证和回滚/清理路径。

图例必须区分已实现并验证、已实现待外部验证、计划/延后、降级路径。移动端允许横向滚动或点击放大，不得把整张图压缩成不可读缩略图。

### 3. 核心业务时序图

公开时序图覆盖完整业务闭环：

1. Provider 在 Worker/D1 创建草稿并计算 metadata hash；
2. Provider 钱包提交链上任务请求；
3. Owner 审核后触发 Chainlink VRF；
4. VRF 回填随机价格和时间范围；
5. 家长检查余额，执行精确 `approve` 与 `buy`；
6. Marketplace 使用 `transferFrom` 结算并记录购买；
7. 完成证据进入 Worker/Relayer 边界；
8. Marketplace 确认完成并铸造不可转让 SBT；
9. The Graph、三 RPC 和 Evidence 对链上事实进行独立读回。

时序图必须标出失败路径：哈希不一致、未购买、授权不足、VRF pending、交易失败、Relayer 重试和重复完成幂等保护。

### 4. 公开 Evidence 页面

Evidence 页面必须：

- 同时展示全局架构图和业务时序图；
- 每张图提供标题、相邻文字走读、图例，以及“看哪里 / 证明什么”；
- 图片支持点击打开原图，具有明确替代文本和固有宽高；
- 链接到 Mermaid 工程真相源或公开可读的对应说明；
- 明示当前限制，避免把计划或参考架构包装成已完成证据。

## Gate 设计

### 本地 Gate

扩展 `scripts/validate-delivery-evidence.mjs`，验证：

- 作业映射表五列仍完整且状态值受控；
- 架构文档包含全部必需章节；
- 至少存在一个 `flowchart` 和一个 `sequenceDiagram`；
- 运行、数据、存储、外部依赖、部署、安全、可观测/失败、生命周期/清理均有明确文字；
- 同时出现已验证、待验证、计划或延后状态；
- Evidence 页面真实引用全局架构图和时序图；
- 两张图均具有标题、替代文本、相邻说明与查看原图链接；
- 所引用的图片文件存在且非空；
- 实现映射与既有 Worker/D1 证据仍通过。

Gate 不尝试从像素推断架构真伪，而以 Mermaid 真相源、页面引用和真实 Evidence 文件共同约束。

### GitHub Gate

现有 `.github/workflows/verify-baby2b-project.yml` 已通过共享 workflow 执行 `pnpm validate:delivery-evidence`。保持调用方式不变，但扩展命令的检查范围，并补充回归测试。因此 pull request、main push 和手动运行都会执行同一严格契约；本地与远端不存在两套规则。

## 失败与安全边界

- 缺图、缺章节、缺时序、页面未引用、图片为空或状态标记缺失时 Gate 失败。
- 图中的计划项必须使用计划/延后样式；不得因为参考项目存在就标为 BabySteps 已实现。
- 不把 RPC Key、Privy Secret、钱包私钥、Cookie、内部数据库连接或完整个人信息写入图和 Evidence。
- 同学项目只作为结构参考，Gate 不依赖其在线可用性，也不复制其图片或源文件。
- AWS 图严格区分真实已验证的可暂停资源与尚未部署的持续计费资源。

## 测试与验收

采用测试先行：先增加会失败的验证器测试，再扩展实现。至少验证：

- 缺 `sequenceDiagram` 时失败；
- 缺失败恢复或清理生命周期时失败；
- Evidence 页面只展示一张图时失败；
- 图片引用不存在或空文件时失败；
- 完整契约通过；
- 既有映射状态、Worker/D1 证据和公开内容扫描不回归。

最终执行验证器专项测试、全仓 `check`、`test`、`typecheck`、Web 构建、公开产物扫描、链接与响应式页面检查。公开发布不在本次默认授权内。
