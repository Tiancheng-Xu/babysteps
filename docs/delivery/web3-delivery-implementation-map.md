# BabySteps Web3 作业实现映射

本表以老师公告的 7 项课程平台要求，加上 RPC/The Graph/AWS 部署要求为验收基准。`complete` 仅表示代码、测试和题目要求的外部证据均存在；`partial` 表示实现已存在但仍缺外部配置、资金或部署证据；`pending` 表示尚未实现；`blocked` 表示验证失败并停止。

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 1. 链上任务列表 + 链下数据库，按 ID 绑定视频和评论 | `chainId:marketplaceAddress:taskId` 稳定键；canonical metadata hash；Worker 同时核验回执、`TaskRequested` 和 `getTask`；D1 保存富内容、视频、评论、会话与审计 | `worker/src/domain/taskMetadata.ts:41`<br>`worker/src/chain/viemMarketplaceReader.ts:66`<br>`worker/src/routes/tasks.ts:74`<br>`worker/src/routes/comments.ts:78`<br>`contracts/scripts/runSepoliaPublicApiClosedLoop.ts:145` | V2 任务 #2 已通过公开 API 完成 challenge-sign-verify、D1 草稿、Sepolia 上架/购买、绑定、用户名和购买门控评论写入；公开任务与评论读回均通过；见 `docs/evidence/deployment/2026-08-12-public-api-closed-loop.json` | `complete` |
| 2. Owner 管理商家/老师，Provider 提交任务并由 Owner 审核上架 | `PROVIDER_ROLE`；`PendingReview → PendingRandomness → Active`；Owner 可拒绝、暂停；Provider Console 展示链上提交阶段 | `contracts/contracts/TaskMarketplaceV2.sol:166`<br>`contracts/contracts/TaskMarketplaceV2.sol:204`<br>`web/src/features/provider/useProviderTaskCreation.ts:73`<br>`web/src/pages/ProviderConsolePage.tsx:26` | Sepolia Provider `requestTask`、Owner `approveTask` 与 VRF 激活已完成；任务 #1 最终状态为 Active；交易与随机结果见 `docs/evidence/deployment/2026-08-11-sepolia-v2-business.json` | `complete` |
| 3. 发行 ERC-20 平台币 | 使用 BabyCoin 取代 YD；原 UI 星星直接改为 BabyCoin 展示，奖励余额与累计成长值分离 | `contracts/contracts/BabyCoin.sol:7`<br>`contracts/contracts/GrowthActivities.sol:1`<br>`web/src/contracts/web3Contracts.ts:1` | Sepolia BabyCoin `0x108a55217011983b93C3A95aD8D3B3343Bd5471b`；合约测试和 V1 闭环 Evidence | `complete` |
| 4. Uniswap 池：USDC、ETH/WETH → 平台币 | 锁定 Uniswap v3 Sepolia 官方 Factory/PositionManager/Router/Quoter、Circle 官方测试 USDC 与官方 WETH9；先用既有 WETH/USDC 池取得官方测试 USDC，再创建 BABY/USDC 与 BABY/WETH；不复制 MockUSDC | `web/src/contracts/web3Contracts.ts:3`<br>`contracts/scripts/provisionSepoliaUniswapV3.ts:23`<br>`contracts/scripts/lib/uniswapPoolMath.ts:1` | BABY/USDC `0x50F6…A9cB`、LP NFT #230840；BABY/WETH `0x4820…Ed80`、LP NFT #230841；15/15 receipts 成功；见 `docs/evidence/deployment/2026-08-12-uniswap-v3-verification.json` | `complete` |
| 4a. 前端按 USDC 或 ETH/WETH 兑换 BabyCoin | QuoterV2 报价；ETH 缺额先 wrap WETH；有限额度 approve；SwapRouter02 exact-input swap；1% 滑点保护和完整状态反馈 | `web/src/features/exchange/useUniswapSwap.ts:69`<br>`web/src/features/exchange/useUniswapSwap.ts:125`<br>`web/src/features/exchange/useUniswapSwap.ts:152`<br>`web/src/features/exchange/useUniswapSwap.ts:171` | 真实 swap：0.1 USDC → 0.0980703969 BABY；0.00005 WETH → 0.0980703969 BABY；均高于 0.095 BABY 最小到账，Router allowance 均为 0 | `complete` |
| 5. 点击购买，精确价格、approve → buy、`msg.sender` 与购买记录写链 | 精确 allowance；`safeTransferFrom(msg.sender)`；每位家长每项任务仅一次；显示购买、暂停、过期和重复失败状态 | `contracts/contracts/TaskMarketplaceV2.sol:254`<br>`web/src/features/marketplace/useTaskPurchase.ts:1` | V2 Sepolia 随机价格为 2 BABY；exact approve `0x3b08…593b`、buy `0x1aaf…302`；Provider 收款 2 BABY，剩余 allowance 为 0 | `complete` |
| 6. Chainlink 随机性；课程完成后发行带名称和图的 NFT/SBT | 按确认方案使用 Chainlink VRF v2.5 对价格、开放时间和额度做随机化；完成后铸 ERC-5192 不可转让证书；名称、描述、图片由公开 metadata 提供；IPFS pin 属增强项 | `contracts/contracts/TaskMarketplaceV2.sol:204`<br>`contracts/contracts/GrowthCertificateSBT.sol:10`<br>`scripts/prepare-ipfs-metadata.mjs:1` | V2 requestId 已由 VRF 履约，得到 2 BABY / 5 小时；完成交易 `0x8897…00f0` 铸出锁定 SBT #1，tokenURI 可公开读取；临时 Relayer 权限已撤销；见 `docs/evidence/deployment/2026-08-11-sepolia-v2-business.json` | `complete` |
| 7. 个人中心使用 Privy 登录，可修改用户名并签名 | Privy Google/邮箱/外部钱包；Smart Wallet 懒创建；challenge-sign-verify；12 小时 HttpOnly 会话；D1 用户名；无私钥或 paymaster | `web/src/config/providers.tsx:27`<br>`web/src/features/identity/PrivyIdentityPanel.tsx:1`<br>`worker/src/routes/auth.ts:41`<br>`worker/src/routes/profile.ts:46` | 生产 App ID 已配置，Privy Allowed origin 已加入 `https://babysteps.baby2b.online`；Web 157/157、typecheck、production build 通过；公开 API 的真实钱包签名、HttpOnly 会话、D1 用户名写入已在 `2026-08-12-public-api-closed-loop.json` 验证。仍待本批代码发布后通过 Privy Google/Email UI 做最终登录验收 | `partial` |
| ethers.js 通过公共 RPC、Infura、Alchemy 对照读取链上数据 | 同一交易、回执、区块、余额和链 ID 的三源读取与一致性报告；端点只通过 0600 临时文件注入，输出自动脱敏 | `contracts/scripts/readSepoliaAcrossProviders.ts:12`<br>`contracts/scripts/lib/rpcComparison.ts:163` | 公共 Sepolia、Infura Core、Alchemy Free 三源均读取交易 `0xba0d…02cfd` 成功；chainId、余额、交易、回执和日志完全一致，`complete: true`；证据见 `2026-08-12-rpc-comparison.json` | `complete` |
| The Graph 通过日志索引并用 GraphQL 读回 | schema、V2 ABI、event handlers、Matchstick 测试和 delivery query；索引角色、任务、审核、随机、购买与完成事件 | `subgraph/subgraph.yaml:5`<br>`subgraph/src/task-marketplace.ts:58`<br>`subgraph/queries/delivery.graphql:1` | Studio `babysteps-sepolia@v0.1.0` 已部署并 100% 同步；从部署块 `11467677` 索引 9 个实体，真实 GraphQL 查询读回 2 个任务、2 笔购买和 1 张证书；证据见 `2026-08-12-the-graph-sepolia.json` | `complete` |
| AWS VPC/RDS/Lambda/CodeBuild 部署闭环，费用可控 | 已部署：隔离 VPC、2 AZ 私有子网、私有 RDS、5 分钟自动停库、Readiness Lambda、OIDC/S3/CodeBuild；明确延后：API Gateway、NAT/EIP、KMS、Secrets、生产 Relayer | `aws/pausable-template.yaml:46`<br>`aws/pausable-template.yaml:181`<br>`aws/pausable-template.yaml:225`<br>`aws/pausable-template.yaml:297`<br>`aws/pausable-template.yaml:357`<br>`aws/bootstrap.yaml:30`<br>`aws/bootstrap.yaml:129`<br>`aws/bootstrap.yaml:277`<br>`aws/buildspec.yml:16`<br>`scripts/validate-aws-readiness.mjs:6` | 批准的可暂停阶段 complete、生产阶段 deferred；43 项 AWS 测试、validator、两份 SAM lint 通过；Runtime `CREATE_COMPLETE`，CodeBuild `SUCCEEDED`，RDS `stopped`，无 IGW/NAT；见 `docs/evidence/deployment/2026-08-11-aws-pausable.md` | `partial` |

## 当前真实外部状态

- Ethereum Sepolia chain ID：`11155111`
- BabyCoin：`0x108a55217011983b93C3A95aD8D3B3343Bd5471b`
- GrowthActivities：`0x69935c3683eBbf34c898B8DC7404E546a7E1939a`
- GrowthCertificate V1：`0x4d594aeeAAfb4280D95CD60940AeBd3d11DBAFa3`
- TaskMarketplace V1：`0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE`
- GrowthCertificate SBT V2：`0xF4efB99228f3ae6733d0c6CC5C5772bB5b37F654`
- TaskMarketplace V2：`0x2EE9fAFE99e143e5a1376805753D026bDac715de`
- V1 完整业务闭环：`docs/evidence/deployment/2026-08-09-business-closed-loop.json`
- V2 完整业务闭环：`docs/evidence/deployment/2026-08-11-sepolia-v2-business.json`
- Cloudflare D1：`babysteps-production`，远程 migration 已应用
- Cloudflare Worker：`https://babysteps-api.baby2b.online`，版本 `aa2cfd54-b4fe-4f9d-a927-1c78068aad4e`，HTTP/TLS/CORS 已验证
- AWS Bootstrap：`babysteps-aws-readiness-bootstrap`，`UPDATE_COMPLETE`
- AWS Runtime：`babysteps-delivery-readiness`，`CREATE_COMPLETE`；RDS `stopped`
- Privy Dashboard 正式域名与生产 App ID 已配置；真实 Google/Email 登录 UI 仍待本批发布后验收
- Subgraph Studio 已完成部署、同步和 GraphQL 读回；Infura 与 Alchemy 均为免费 Sepolia 专用配置，三源 RPC 已对照一致；IPFS pin 仍待外部完成证据

## 更新规则

每个关键节点结束时更新本表。没有合约地址、交易哈希、部署 ID、HTTP/RPC/GraphQL 返回或云资源读取结果时，不把本地测试升级成外部 `complete`。第三方不可用或缺少授权时保留 `partial`，绝不以计划或截图替代运行证据。
