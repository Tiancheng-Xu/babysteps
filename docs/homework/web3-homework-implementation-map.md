# BabySteps Web3 作业实现映射

本表只记录可核验状态。`complete` 表示代码、测试和所需外部证据均已存在；`partial` 表示已有一部分真实实现；`pending` 表示尚未实现或尚无外部证明；`blocked` 表示验证失败且当前节点停止。

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 链上任务列表与链下视频、评论稳定绑定 | Worker/D1 已在本地实现 `chainId:marketplaceAddress:taskId`、canonical metadata keccak256、交易回执/`TaskRequested`/`getTask` 三重核验、富内容聚合与购买后评论；远程 D1/Worker 和产品 UI 尚未部署 | `worker/src/domain/taskIdentity.ts:15`<br>`worker/src/domain/taskMetadata.ts:41`<br>`worker/src/routes/tasks.ts:74`<br>`worker/src/routes/comments.ts:78`<br>`worker/src/chain/viemMarketplaceReader.ts:66` | `worker/test/taskIdentity.test.ts`、`worker/test/tasks.test.ts`、`worker/test/comments.test.ts` 本地通过；完整输出见 `docs/evidence/testing/2026-08-10-worker-d1.md`；远程 API 地址与截图缺失 | `partial` |
| Owner 管理机构和育婴师，Provider 提交并审核上架 | V2 已在本地实现 `PendingReview → PendingRandomness → Active`、Owner 拒绝和暂停；生产图复用既有 BabyCoin，本地图使用 Mock VRF；尚未部署 Sepolia | `contracts/contracts/TaskMarketplaceV2.sol:20`<br>`contracts/ignition/modules/BabyStepsWeb3V2.ts:1`<br>`contracts/ignition/modules/BabyStepsWeb3V2Local.ts:1`<br>`web/src/pages/ProviderConsolePage.tsx:1` | `contracts/test/TaskMarketplaceV2.ts` 12 个审核、VRF、购买和完成测试；`contracts/test/babysteps-web3-v2-module.test.ts` 4 个部署契约测试；本地 Ignition 部署成功；完整输出见 `docs/evidence/testing/2026-08-10-web3-v2-contracts.md`；Sepolia Owner 审核交易缺失 | `partial` |
| 发行 ERC-20 平台币 | 使用 BabyCoin 替代 YD，奖励与 `lifetimeEarned` 分离 | `contracts/contracts/BabyCoin.sol:1`<br>`contracts/contracts/GrowthActivities.sol:1` | Sepolia `0x108a55217011983b93C3A95aD8D3B3343Bd5471b`；`contracts/test/BabyCoin.ts`；`docs/evidence/deployment/2026-08-09-sepolia.md` | `complete` |
| 建立 BABY/USDC 与 BABY/WETH Uniswap v3 池 | 计划使用 Circle Sepolia USDC、官方 WETH9、0.3% fee tier | 尚无实现文件 | 池地址、流动性交易与 Swap 回执缺失 | `pending` |
| 余额不足时使用 USDC 或 ETH 自动兑换 BABY | 计划使用官方 Router 与 Quoter 执行 exact-output 短缺额兑换 | 尚无实现文件 | Router 单元测试和 Sepolia Swap 回执缺失 | `pending` |
| 展示精确 Approve、Buy、购买记录和失败状态 | V1 已有 Sepolia 闭环；V2 本地实现精确 allowance、`safeTransferFrom(msg.sender)`、每个家长每项任务一次购买、购买记录以及暂停/过期/重复失败保护 | `contracts/contracts/TaskMarketplaceV2.sol:229`<br>`contracts/contracts/TaskMarketplace.sol:186`<br>`web/src/features/marketplace/useTaskPurchase.ts:1` | `contracts/test/TaskMarketplaceV2.ts` 5 个购买与完成闭环测试；`contracts/test/TaskMarketplace.ts:194`；购买交易 `0xba0d13402507da21b4c680dbe1dd3413c7fd0eb2c97b93a30c8f86a0f0622cfd` | `complete` |
| Chainlink 随机价格和开放时间 | V1 使用 VRF v2.5 两个随机数锁定 2 至 4 BABY 与活动时长；V2 仅在 Owner 审核后请求随机数 | `contracts/contracts/TaskMarketplaceV2.sol:149`<br>`contracts/contracts/TaskMarketplace.sol:253` | `contracts/test/TaskMarketplaceV2.ts` 边界测试；Sepolia request ID 与完成闭环见 `docs/evidence/deployment/2026-08-09-business-closed-loop.json` | `complete` |
| 完成后自动发放带名称和图片的 ERC-5192 证书 | V2 已在本地实现正式 ERC-5192、不可转让语义、`COMPLETION_RELAYER_ROLE` 完成确认和按购买幂等；IPFS 与 Sepolia V2 尚未验证 | `contracts/contracts/GrowthCertificateSBT.sol:1`<br>`contracts/contracts/interfaces/IERC5192.sol:1`<br>`contracts/contracts/TaskMarketplaceV2.sol:280` | `contracts/test/GrowthCertificateSBT.ts` 6 个本地测试和 `contracts/test/TaskMarketplaceV2.ts` 证书幂等闭环通过；完整输出见 `docs/evidence/testing/2026-08-10-web3-v2-contracts.md`；V1 Sepolia token ID `1`；V2 地址与 IPFS 证据缺失 | `partial` |
| Privy 登录、用户名修改与签名 | Worker 已在本地实现 EIP-4361 风格 challenge、一次性 nonce 原子消费、viem 验签、12 小时 HttpOnly 会话、注销和用户名更新；Privy 邮箱/外部钱包 UI 尚未接入 | `worker/src/routes/auth.ts:41`<br>`worker/src/auth/session.ts:18`<br>`worker/src/routes/profile.ts:46` | `worker/test/auth.test.ts` 与 `worker/test/profile.test.ts` 本地通过；原 nonce/token 不落库测试通过；Privy 页面与真实登录证据缺失 | `partial` |
| KMS + Lambda Relayer 完成确认 | 已实现 HMAC 时间窗与 nonce 防重放、RDS 幂等 claim、运行时 schema 初始化、KMS SPKI 地址派生、DER/low-s/recovery、EIP-1559 模拟/签名/广播和脱敏 HTTP 错误；云端尚未启动 | `aws/src/auth/webhook.ts:46`<br>`aws/src/repositories/postgresCompletionJobs.ts:39`<br>`aws/src/repositories/schema.ts:3`<br>`aws/src/signing/kmsEthereumSigner.ts:27`<br>`aws/src/application/confirmCompletion.ts:40`<br>`aws/src/handler.ts:71` | AWS 包 11 个测试文件、39 项测试通过；SAM 生产构建生成非空 handler；本地证据见 `docs/evidence/testing/2026-08-10-aws-readiness-local.md`；API、RDS、KMS ARN 与 Sepolia V2 完成交易待云端启动 | `partial` |
| AWS VPC/NAT/RDS 与 OIDC/CodeBuild 部署闭环 | 已实现双 AZ 公私子网、单 NAT/EIP、私有 Single-AZ RDS、SG-only 5432、Secrets、KMS、API/Lambda、7 天日志；GitHub OIDC 受 Environment 限制，S3 源码 7 天生命周期，CodeBuild Small/并发 1，付费部署双门禁 | `aws/template.yaml:45`<br>`aws/bootstrap.yaml:90`<br>`aws/bootstrap.yaml:295`<br>`aws/buildspec.yml:1`<br>`.github/workflows/aws-readiness.yml:1`<br>`scripts/validate-aws-readiness.mjs:5` | 两份模板 `sam validate --lint` 通过；AWS 包 11 个测试文件、39 项测试与 9 项仓库 validator 通过；没有 AWS 资源或费用证据，因为用户要求晚些启动 | `partial` |
| ethers.js 对照公共 RPC、Infura 和 Alchemy | V1 已通过公共 RPC 读取链上闭环；ethers.js 与三源对照尚未实现 | `contracts/scripts/inspectSepolia.ts:1` | `docs/evidence/deployment/2026-08-09-rpc-verification.json` 仅证明公共 RPC | `partial` |
| The Graph 事件索引与 GraphQL Demo | 计划索引角色、任务、随机数、购买、完成和证书事件 | 尚无实现文件 | Schema、Mapping、部署 ID 和 GraphQL 输出缺失 | `pending` |

## 当前真实部署

- Network：Ethereum Sepolia，chain ID `11155111`
- BabyCoin：`0x108a55217011983b93C3A95aD8D3B3343Bd5471b`
- GrowthActivities：`0x69935c3683eBbf34c898B8DC7404E546a7E1939a`
- GrowthCertificate V1：`0x4d594aeeAAfb4280D95CD60940AeBd3d11DBAFa3`
- TaskMarketplace V1：`0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE`
- V2 contracts：`pending`
- AWS runtime/bootstrap stacks：`not created`（本地 IaC 已验证，云端待启动）

## 更新规则

每个关键节点结束时更新本表。没有合约地址、交易哈希或云端读取结果时，不能把本地测试状态升级为外部 `complete`。
