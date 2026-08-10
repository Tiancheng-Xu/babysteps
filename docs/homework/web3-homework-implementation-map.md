# BabySteps Web3 作业实现映射

本表只记录可核验状态。`complete` 表示代码、测试和所需外部证据均已存在；`partial` 表示已有一部分真实实现；`pending` 表示尚未实现或尚无外部证明；`blocked` 表示验证失败且当前节点停止。

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 链上任务列表与链下视频、评论稳定绑定 | V1 已有链上任务 ID 和 metadata URI；D1 稳定复合键、视频和评论尚未实现 | `contracts/contracts/TaskMarketplace.sol:30`<br>`web/src/features/marketplace/useMarketplace.ts:1` | `contracts/test/TaskMarketplace.ts` 现有链上任务测试；D1 证据缺失 | `partial` |
| Owner 管理机构和育婴师，Provider 提交并审核上架 | V2 已在本地实现 `PendingReview → PendingRandomness → Active`、Owner 拒绝和暂停；尚未部署 | `contracts/contracts/TaskMarketplaceV2.sol:16`<br>`web/src/pages/ProviderConsolePage.tsx:1` | `contracts/test/TaskMarketplaceV2.ts` 7 个审核与 VRF 测试通过；Sepolia Owner 审核交易缺失 | `partial` |
| 发行 ERC-20 平台币 | 使用 BabyCoin 替代 YD，奖励与 `lifetimeEarned` 分离 | `contracts/contracts/BabyCoin.sol:1`<br>`contracts/contracts/GrowthActivities.sol:1` | Sepolia `0x108a55217011983b93C3A95aD8D3B3343Bd5471b`；`contracts/test/BabyCoin.ts`；`docs/evidence/deployment/2026-08-09-sepolia.md` | `complete` |
| 建立 BABY/USDC 与 BABY/WETH Uniswap v3 池 | 计划使用 Circle Sepolia USDC、官方 WETH9、0.3% fee tier | 尚无实现文件 | 池地址、流动性交易与 Swap 回执缺失 | `pending` |
| 余额不足时使用 USDC 或 ETH 自动兑换 BABY | 计划使用官方 Router 与 Quoter 执行 exact-output 短缺额兑换 | 尚无实现文件 | Router 单元测试和 Sepolia Swap 回执缺失 | `pending` |
| 展示精确 Approve、Buy、购买记录和失败状态 | V1 已实现精确 allowance、`safeTransferFrom(msg.sender)`、购买记录和前端状态机 | `contracts/contracts/TaskMarketplace.sol:186`<br>`web/src/features/marketplace/useTaskPurchase.ts:1` | `contracts/test/TaskMarketplace.ts:194`；`web/src/features/marketplace/useTaskPurchase.test.tsx`；购买交易 `0xba0d13402507da21b4c680dbe1dd3413c7fd0eb2c97b93a30c8f86a0f0622cfd` | `complete` |
| Chainlink 随机价格和开放时间 | V1 使用 VRF v2.5 两个随机数锁定 2 至 4 BABY 与活动时长；V2 仅在 Owner 审核后请求随机数 | `contracts/contracts/TaskMarketplaceV2.sol:149`<br>`contracts/contracts/TaskMarketplace.sol:253` | `contracts/test/TaskMarketplaceV2.ts` 边界测试；Sepolia request ID 与完成闭环见 `docs/evidence/deployment/2026-08-09-business-closed-loop.json` | `complete` |
| 完成后自动发放带名称和图片的 ERC-5192 证书 | V2 已在本地实现正式 ERC-5192、不可转让语义和按购买幂等；IPFS 与 Sepolia V2 尚未验证 | `contracts/contracts/GrowthCertificateSBT.sol:1`<br>`contracts/contracts/interfaces/IERC5192.sol:1`<br>`contracts/contracts/TaskMarketplace.sol:225` | `contracts/test/GrowthCertificateSBT.ts` 6 个本地测试通过；V1 Sepolia token ID `1`；V2 地址与 IPFS 证据缺失 | `partial` |
| Privy 登录、用户名修改与签名 | 计划支持邮箱嵌入式钱包和外部钱包，并使用一次性 nonce 验签 | 尚无实现文件 | Privy 测试、Worker 会话测试和页面证据缺失 | `pending` |
| KMS + Lambda Relayer 完成确认 | 计划使用不可导出的 secp256k1 KMS key 与最小权限 Relayer | 尚无实现文件 | AWS 资源、IAM 摘要和完成交易缺失 | `pending` |
| ethers.js 对照公共 RPC、Infura 和 Alchemy | V1 已通过公共 RPC 读取链上闭环；ethers.js 与三源对照尚未实现 | `contracts/scripts/inspectSepolia.ts:1` | `docs/evidence/deployment/2026-08-09-rpc-verification.json` 仅证明公共 RPC | `partial` |
| The Graph 事件索引与 GraphQL Demo | 计划索引角色、任务、随机数、购买、完成和证书事件 | 尚无实现文件 | Schema、Mapping、部署 ID 和 GraphQL 输出缺失 | `pending` |

## 当前真实部署

- Network：Ethereum Sepolia，chain ID `11155111`
- BabyCoin：`0x108a55217011983b93C3A95aD8D3B3343Bd5471b`
- GrowthActivities：`0x69935c3683eBbf34c898B8DC7404E546a7E1939a`
- GrowthCertificate V1：`0x4d594aeeAAfb4280D95CD60940AeBd3d11DBAFa3`
- TaskMarketplace V1：`0x2D1107610eBaBbFa7CD9569eb42eF315eb6F25BE`
- V2 contracts：`pending`

## 更新规则

每个关键节点结束时更新本表。没有合约地址、交易哈希或云端读取结果时，不能把本地测试状态升级为外部 `complete`。
