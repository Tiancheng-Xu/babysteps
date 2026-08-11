# BabySteps Web3 作业实现映射

本表以老师公告的 7 项课程平台要求，加上 RPC/The Graph/AWS 部署要求为验收基准。`complete` 仅表示代码、测试和题目要求的外部证据均存在；`partial` 表示实现已存在但仍缺外部配置、资金或部署证据；`pending` 表示尚未实现；`blocked` 表示验证失败并停止。

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 1. 链上任务列表 + 链下数据库，按 ID 绑定视频和评论 | `chainId:marketplaceAddress:taskId` 稳定键；canonical metadata hash；Worker 同时核验回执、`TaskRequested` 和 `getTask`；D1 保存富内容、视频、评论、会话与审计 | `worker/src/domain/taskMetadata.ts:41`<br>`worker/src/chain/viemMarketplaceReader.ts:66`<br>`worker/src/routes/tasks.ts:74`<br>`worker/src/routes/comments.ts:79` | Worker/D1 测试见 `docs/evidence/testing/2026-08-10-worker-d1.md`；远程 D1 `82d96e36-2adc-44f7-93b2-aeb19c075d09` 已迁移；Worker 因 V2 地址未部署而被发布门禁阻止 | `partial` |
| 2. Owner 管理商家/老师，Provider 提交任务并由 Owner 审核上架 | `PROVIDER_ROLE`；`PendingReview → PendingRandomness → Active`；Owner 可拒绝、暂停；Provider Console 展示链上提交阶段 | `contracts/contracts/TaskMarketplaceV2.sol:166`<br>`contracts/contracts/TaskMarketplaceV2.sol:204`<br>`web/src/features/provider/useProviderTaskCreation.ts:73`<br>`web/src/pages/ProviderConsolePage.tsx:26` | V2 合约 12 项审核/VRF/购买/完成测试及 Ignition 本地部署通过；见 `docs/evidence/testing/2026-08-10-web3-v2-contracts.md`；Sepolia V2 交易待部署 | `partial` |
| 3. 发行 ERC-20 平台币 | 使用 BabyCoin 取代 YD；原 UI 星星直接改为 BabyCoin 展示，奖励余额与累计成长值分离 | `contracts/contracts/BabyCoin.sol:7`<br>`contracts/contracts/GrowthActivities.sol:1`<br>`web/src/contracts/web3Contracts.ts:1` | Sepolia BabyCoin `0x108a55217011983b93C3A95aD8D3B3343Bd5471b`；合约测试和 V1 闭环 Evidence | `complete` |
| 4. Uniswap 池：USDC、ETH/WETH → 平台币 | 锁定 Uniswap v3 Sepolia 官方 Factory/PositionManager/Router/Quoter、Circle 官方测试 USDC 与官方 WETH9；部署脚本预检两池、初始价、fee 和双边余额；不复制 MockUSDC | `web/src/contracts/web3Contracts.ts:57`<br>`contracts/scripts/provisionSepoliaUniswapV3.ts:49`<br>`contracts/scripts/lib/uniswapPoolMath.ts:1` | 合约和地址只读核验通过；两池当前不存在，钱包 BABY=18、USDC=0、WETH=0，零写交易；见 `docs/evidence/deployment/2026-08-10-uniswap-v3-pools.json` | `partial` |
| 4a. 前端按 USDC 或 ETH/WETH 兑换 BabyCoin | QuoterV2 报价；ETH 缺额先 wrap WETH；有限额度 approve；SwapRouter02 exact-input swap；1% 滑点保护和完整状态反馈 | `web/src/features/exchange/useUniswapSwap.ts:69`<br>`web/src/features/exchange/useUniswapSwap.ts:125`<br>`web/src/features/exchange/useUniswapSwap.ts:152`<br>`web/src/features/exchange/useUniswapSwap.ts:171` | 前端模型测试和生产构建通过；真实 swap 因官方 Sepolia USDC 与池流动性不足待执行；见 `docs/evidence/testing/2026-08-10-uniswap-v3-local.md` | `partial` |
| 5. 点击购买，精确价格、approve → buy、`msg.sender` 与购买记录写链 | 精确 allowance；`safeTransferFrom(msg.sender)`；每位家长每项任务仅一次；显示购买、暂停、过期和重复失败状态 | `contracts/contracts/TaskMarketplaceV2.sol:254`<br>`web/src/features/marketplace/useTaskPurchase.ts:1` | V1 Sepolia 4 BABY 闭环交易：approve `0x120b…3a31`、buy `0xba0d…2cfd`；V2 本地购买/完成测试通过 | `complete` |
| 6. Chainlink 随机性；课程完成后发行带名称和图的 NFT/SBT | 按确认方案使用 Chainlink VRF v2.5 对价格、开放时间和额度做随机化；完成后铸 ERC-5192 不可转让证书；名称、描述、图片采用内容寻址 metadata | `contracts/contracts/TaskMarketplaceV2.sol:204`<br>`contracts/contracts/GrowthCertificateSBT.sol:10`<br>`scripts/prepare-ipfs-metadata.mjs:1` | V1 VRF Sepolia 闭环和 requestId 有公开证据；V2/SBT 本地测试通过；IPFS CID 已确定但尚未 pin，V2 地址待部署；见 `docs/evidence/testing/2026-08-10-ipfs-v2-preparation.md` | `partial` |
| 7. 个人中心使用 Privy 登录，可修改用户名并签名 | Privy Google/邮箱/外部钱包；Smart Wallet 懒创建；challenge-sign-verify；12 小时 HttpOnly 会话；D1 用户名；无私钥或 paymaster | `web/src/config/providers.tsx:27`<br>`web/src/features/identity/PrivyIdentityPanel.tsx:1`<br>`worker/src/routes/auth.ts:41`<br>`worker/src/routes/profile.ts:46` | 身份模型、API、Worker 鉴权与资料测试通过；真实登录等待 `VITE_PRIVY_APP_ID` 与 Privy Dashboard 配置；见 `docs/evidence/testing/2026-08-10-privy-identity-local.md` | `partial` |
| ethers.js 通过公共 RPC、Infura、Alchemy 对照读取链上数据 | 同一交易、回执、区块、余额和链 ID 的三源读取与一致性报告；缺失 provider 明确标 `not-configured` | `contracts/scripts/readSepoliaAcrossProviders.ts:12`<br>`contracts/scripts/lib/rpcComparison.ts:163` | 公共 Sepolia RPC 已真实读取并生成 `docs/evidence/deployment/2026-08-10-rpc-comparison.json`；Infura/Alchemy URL 尚未配置 | `partial` |
| The Graph 通过日志索引并用 GraphQL 读回 | schema、V2 ABI、event handlers、Matchstick 测试和 delivery query；索引角色、任务、审核、随机、购买与完成事件 | `subgraph/subgraph.yaml:5`<br>`subgraph/src/task-marketplace.ts:58`<br>`subgraph/queries/delivery.graphql:1` | `graph build` 与 4 项 Matchstick 测试通过；Studio 部署 ID 与公开 GraphQL 查询待 V2 地址和 deploy key；见 `docs/evidence/testing/2026-08-10-subgraph-local.md` | `partial` |
| AWS VPC/RDS/Lambda/CodeBuild 部署闭环，费用可控 | 已部署：隔离 VPC、2 AZ 私有子网、私有 RDS、5 分钟自动停库、Readiness Lambda、OIDC/S3/CodeBuild；明确延后：API Gateway、NAT/EIP、KMS、Secrets、生产 Relayer | `aws/pausable-template.yaml:46`<br>`aws/pausable-template.yaml:181`<br>`aws/pausable-template.yaml:225`<br>`aws/pausable-template.yaml:297`<br>`aws/pausable-template.yaml:357`<br>`aws/bootstrap.yaml:30`<br>`aws/bootstrap.yaml:129`<br>`aws/bootstrap.yaml:277`<br>`aws/buildspec.yml:16`<br>`scripts/validate-aws-readiness.mjs:6` | 批准的可暂停阶段 complete、生产阶段 deferred；43 项 AWS 测试、validator、两份 SAM lint 通过；Runtime `CREATE_COMPLETE`，CodeBuild `SUCCEEDED`，RDS `stopped`，无 IGW/NAT；见 `docs/evidence/deployment/2026-08-11-aws-pausable.md` | `partial` |

## 当前真实外部状态

- Ethereum Sepolia chain ID：`11155111`
- BabyCoin：`0x108a55217011983b93C3A95aD8D3B3343Bd5471b`
- GrowthActivities：`0x69935c3683eBbf34c898B8DC7404E546a7E1939a`
- GrowthCertificate V1：`0x4d594aeeAAfb4280D95CD60940AeBd3d11DBAFa3`
- TaskMarketplace V1：`0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE`
- V1 完整业务闭环：`docs/evidence/deployment/2026-08-09-business-closed-loop.json`
- Cloudflare D1：`babysteps-production`，远程 migration 已应用
- AWS Bootstrap：`babysteps-aws-readiness-bootstrap`，`UPDATE_COMPLETE`
- AWS Runtime：`babysteps-delivery-readiness`，`CREATE_COMPLETE`；RDS `stopped`
- V2 contracts、Worker、Privy、Uniswap pools、Subgraph、IPFS pin：尚无可公开的外部完成证据

## 更新规则

每个关键节点结束时更新本表。没有合约地址、交易哈希、部署 ID、HTTP/RPC/GraphQL 返回或云资源读取结果时，不把本地测试升级成外部 `complete`。第三方不可用或缺少授权时保留 `partial`，绝不以计划或截图替代运行证据。
