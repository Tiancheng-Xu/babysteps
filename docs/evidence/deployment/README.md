# 部署证据清单

## 本地 Hardhat 部署

2026-08-09 使用 `BabyStepsWeb3Local` Ignition module 完成过一次临时本地部署，用于验证合约依赖与角色连线：

| 合约 | 临时本地地址 |
| --- | --- |
| BabyCoin | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| GrowthCertificate | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| MockVrfCoordinator | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| GrowthActivities | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| TaskMarketplace | `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9` |

这些地址来自临时本地链，重启节点后可能失效，不能用作 Sepolia 或生产部署证明。

## Sepolia 部署

2026-08-09 已完成 V1 四合约部署、角色连线和 Chainlink VRF v2.5 业务闭环。2026-08-11 已完成 V2 Marketplace 与 ERC-5192 SBT 部署，并在 Sepolia 真实执行 Provider 提交、Owner 审核、VRF 随机价格/时长、精确 approve、购买、完成、锁定证书，以及临时 Completion Relayer 权限撤销。机器可读证据见 [`2026-08-11-sepolia-v2-business.json`](2026-08-11-sepolia-v2-business.json)。

同日 Cloudflare Worker V2 已绑定远程 D1 与 `babysteps-api.baby2b.online`，通过 HTTP 200、TLS、允许/拒绝 Origin CORS 和远程 D1 只读验证；见 [`2026-08-11-cloudflare-worker-v2.json`](2026-08-11-cloudflare-worker-v2.json)。源码浏览器验证仍待 Etherscan API key。

## 后续业务闭环证据清单

部署时必须逐项保存以下证据：

1. 部署前参数检查：部署钱包、余额、chain ID、VRF subscription、key hash、callback gas limit。
2. Ignition 部署输出：四个新合约地址和每笔部署交易哈希。
3. 源码验证：每个合约的区块浏览器 `#code` 链接。
4. 角色连线：GrowthActivities 的 REWARD_ROLE、TaskMarketplace 的证书 MINTER_ROLE、Provider 与 Oracle 授权交易。
5. VRF 闭环：创建任务请求、coordinator fulfillment、锁定价格与开放时长事件。
6. 支付闭环：测试 BABY 余额、approve、buy、Provider 收款和购买记录。
7. 完成闭环：Oracle 确认、ERC-721 mint、tokenURI 和 NFT 所有权。
8. 前端闭环：Cloudflare Pages 构建、环境变量、公开 URL、桌面与移动端页面。

### 已采用的部署参数

- Chainlink VRF v2.5 Sepolia Coordinator：`0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B`。
- 500 gwei key hash：`0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae`。
- 回调使用原生 Sepolia ETH 支付，准备脚本会把 subscription 补足到 `0.5 ETH`。该余额为 500 gwei gas lane、500,000 callback gas limit 和验证开销预留测试额度，不代表实际单次消耗。
- Hardhat keystore 保存 RPC 与部署测试钱包；私钥、密码和 RPC 凭据未写入证据。
- Etherscan API key 尚未保存，因此源码验证步骤在 key 补齐前保持待办。

每项证据应包含时间、网络、交易哈希或构建链接、结果和失败重试说明；不得保存私钥、助记词、API token 或完整敏感环境变量。
