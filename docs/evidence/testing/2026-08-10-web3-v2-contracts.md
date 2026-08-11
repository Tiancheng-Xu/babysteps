# BabySteps Web3 V2 Phase 1 本地验证证据

## 结论

2026-08-10，BabySteps Web3 V2 的本地合约边界已通过完整门禁：Provider 提交、Owner 审核后请求 Chainlink VRF、2 至 4 BABY 随机价格、精确授权购买、购买记录、Relayer 幂等完成，以及不可转让的 ERC-5192 成长证书。生产部署图复用既有 Sepolia BabyCoin，本地部署图使用 Mock VRF；两者没有混用。

本证据只证明代码、本地测试、本地部署图和构建结果，不把尚未执行的外部操作写成完成。

- Sepolia V2 deployment: `pending`
- Cloud resources created in Phase 1: `none`
- Production deployment changed in Phase 1: `no`
- Existing Sepolia V1 deployment: preserved as historical evidence

## 作业要求与实现证明

| 作业节点 | 本阶段实现 | 核验位置 | 结果 |
| --- | --- | --- | --- |
| Owner 审核 Provider 上架 | `PendingReview → PendingRandomness → Active`，支持拒绝与暂停 | `contracts/contracts/TaskMarketplaceV2.sol`、`contracts/test/TaskMarketplaceV2.ts` | 本地通过；Sepolia 待部署 |
| Chainlink 随机价格与时长 | Owner 审核后才发起 VRF；价格锁定为 2 至 4 BABY，时长按活动范围随机 | `contracts/contracts/TaskMarketplaceV2.sol` | 边界测试通过；V2 外部履约待验证 |
| `approve → buy → transferFrom` | 家长 `msg.sender` 精确付款给 Provider；记录购买并阻止重复、暂停及过期购买 | `contracts/contracts/TaskMarketplaceV2.sol` | 本地闭环测试通过；V1 已有 Sepolia 交易证据 |
| 完成后发证 | Relayer 按 `purchaseId + evidenceHash` 幂等确认，Marketplace 调用证书合约 | `contracts/contracts/TaskMarketplaceV2.sol` | 本地重复调用与冲突用例通过 |
| ERC-5192 证书 | 一次购买一张、永久 locked，阻止批准、转让和销毁 | `contracts/contracts/GrowthCertificateSBT.sol`、`contracts/contracts/interfaces/IERC5192.sol` | 6 个专项测试通过；Sepolia 地址待部署 |
| 可复现部署 | 生产图挂接既有 BabyCoin；本地图部署 BabyCoin、Mock VRF、SBT、Marketplace | `contracts/ignition/modules/BabyStepsWeb3V2.ts`、`contracts/ignition/modules/BabyStepsWeb3V2Local.ts` | 本地 Ignition 实际部署成功 |

完整映射见 `docs/delivery/web3-delivery-implementation-map.md`，架构及权限边界见 `docs/architecture/starbuddy-web3-architecture.mmd`。

## 新鲜门禁输出

在当前 Feature 分支执行以下串行命令，整条命令退出码为 `0`：

```bash
pnpm test
pnpm typecheck
pnpm check
pnpm build
pnpm validate:delivery-evidence
pnpm validate:public-copy
git diff --check
```

结果摘要：

| 门禁 | 结果 |
| --- | --- |
| Validator tests | 5 passed，0 failed |
| Solidity/Hardhat tests | 73 passed，0 failed |
| Frontend Vitest | 147 passed，0 failed，24 个测试文件 |
| Contracts TypeScript | `tsc --noEmit`，exit 0 |
| Web TypeScript | `tsc -b`，exit 0 |
| Biome | Contracts 21 个文件、Web 64 个文件检查完成；0 error |
| Standalone validator | passed |
| Public copy / secret scan | passed |
| Pages workflow validator | passed |
| delivery evidence contract | passed |
| Contracts build | 无需重新编译，exit 0 |
| Web production build | 1,725 modules transformed，`dist/index.html` 及非空资源生成，exit 0 |
| Git whitespace | `git diff --check`，exit 0 |

Web Biome 输出包含 reduced-motion CSS 中 4 条既有 `!important` warning；命令退出码仍为 `0`，本阶段未把非阻塞警告伪装成错误，也未越界重构样式。

## TDD 与故障复盘

1. ERC-5192 测试最初因 `GrowthCertificateSBT` 不存在而失败；实现后专项 6/6 通过。
2. Owner 审核测试最初因 `TaskMarketplaceV2` 不存在而失败；实现后审核与 VRF 用例通过。
3. 购买闭环测试在旧 ABI 上新增 5 个失败，明确缺少 `buy`、购买账本和完成 Relayer；实现后 V2 全部 12/12 通过。
4. 部署图测试最初因两个 V2 Ignition 模块不存在而失败；实现后模块契约 4/4 通过。
5. 首次本地部署按旧计划附带 `--reset`，Hardhat 3 返回 `HHE10105`：临时内存网络没有可重置的持久部署状态。保持模块和网络不变、仅移除 `--reset` 后，本地四组件部署及 MINTER_ROLE 授权成功。计划中的复现命令已同步修正。

## 实现提交

| 提交 | 内容 |
| --- | --- |
| `712c66d` | 作业映射与架构状态校验 |
| `9e94360` | ERC-5192 locked 成长证书 |
| `a9feb66` | Owner 审核的 Marketplace V2 |
| `bdb9d54` | 精确购买与幂等完成闭环 |
| `1ad9cff` | 本地与 Sepolia V2 部署图 |

## 安全、限制与下一步

- 模块只自动授予 Marketplace 的 SBT `MINTER_ROLE`；Provider 和 Relayer 不会被部署脚本自动扩权。
- 公开参数样例只含合约地址、Coordinator、key hash、确认数、gas limit 和值为 `0` 的 Subscription 占位符；不包含 RPC URL、私钥、助记词、keystore 密码或 API token。
- 本阶段没有创建 Cloudflare、AWS、IPFS、The Graph 或 Uniswap 资源，没有变更 DNS、生产页面或公开可见性。
- 尚未完成：V2 Sepolia 部署与角色交易、VRF Consumer 授权、IPFS metadata、AWS KMS Relayer、Worker/D1、Privy、Uniswap 池、The Graph 和三 RPC 对照。
- 外部部署前必须复制公开参数样例为不提交的实际参数文件，并经人工授权后执行；成功状态必须由合约地址、交易哈希与独立读取共同证明。

## 本地复现

```bash
pnpm install --frozen-lockfile
pnpm --filter @babysteps/contracts test
pnpm --filter @babysteps/contracts deploy:web3:v2:local
pnpm test
pnpm typecheck
pnpm check
pnpm build
pnpm validate:delivery-evidence
```

本地 Ignition 默认使用一次性 Hardhat 内存链，退出后地址和状态丢失，这是测试隔离设计，不是部署失败。
