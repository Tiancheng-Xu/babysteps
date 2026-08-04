# BabySteps · 成长星球

BabySteps 是一个运行在 Sepolia 测试链上的亲子成长 DApp 概念验证：家庭成员用
钱包记录喂养、散步和共读等日常活动，获得可赠送的成长星，并共同培育一个随累计
成长值变化的星宝形象。

> 产品域名：<https://babysteps.baby2b.online/>（域名接入中）

## 产品体验

- 三类成长活动：喂养、散步、共读分别获得 3、5、7 枚成长星。
- 活动存在符合婴幼儿生活节奏的冷却时间；不可领取时按钮禁用，不展示精确倒计时。
- `累计成长值`只因本人记录活动而增长，用来驱动星宝阶段，赠送后不会减少。
- `可转余额`可以赠送给其他 Sepolia 钱包，收到的成长星也可以再次赠送。
- 链上便签允许保存一条公开文字，并明确提醒公开区块链不可删除历史记录。

成长活动的 ABI 枚举顺序固定为 `Meal = 0`、`Walk = 1`、`Read = 2`。每日限制按
`UTC+8` 计算；合约保存 `dayId + 1`，避免当天编号和 Solidity mapping 默认值 `0`
混淆。

## DApp 如何工作

Solidity 合约是公开运行的后端，React 前端通过 wagmi 和 ABI 与它交互：

- 读取使用 call，不改变链上状态，也不要求钱包支付 gas；
- 写入需要钱包签名，并使用少量 Sepolia 测试 ETH 支付 gas；
- transaction hash 只说明交易已广播，成功 receipt 才代表链上确认。

成长星不是 ERC-20：它没有价格、交易市场、提现能力、`approve` 或 `allowance`，
仅用于演示可转让的产品积分。当前版本只支持 Sepolia，不面向主网或真实资产。

## 技术栈

- 前端：Vite、React、TypeScript、wagmi、viem
- 合约：Solidity、Hardhat
- 网络：Ethereum Sepolia（chain ID `11155111`）
- 质量保障：Vitest、Hardhat Test、Biome、TypeScript
- 发布：GitHub Actions、GitHub Pages、自定义子域名

## 本地运行

需要 Node.js 22 和 pnpm 11：

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @babysteps/web dev
```

生产构建会使用已经公开部署的 Sepolia 合约地址。本地开发若要显式指定地址，可在
被 Git 忽略的 `web/.env.local` 中写入：

```dotenv
VITE_ONCHAIN_NOTEBOOK_ADDRESS=0xeb7216D50a2708a59fef5322e452e34382aFCDaD
```

## Sepolia 凭据

RPC、部署账户和源码验证凭据只通过 Hardhat 的交互式 keystore 提示输入，不写入
命令参数、环境文件、聊天、截图、日志或 Git：

```sh
pnpm --filter @babysteps/contracts exec hardhat keystore set SEPOLIARPCURL
pnpm --filter @babysteps/contracts exec hardhat keystore set SEPOLIAPRIVATEKEY
pnpm --filter @babysteps/contracts exec hardhat keystore set ETHERSCANAPIKEY
```

只使用不持有真实资产的专用测试钱包。合约没有构造参数；确认网络、账户余额和准备
公开的源码后，可以部署并请求 Etherscan 验证：

```sh
pnpm --filter @babysteps/contracts deploy:sepolia
pnpm --filter @babysteps/contracts deploy:verify:sepolia
```

## 已部署的 Sepolia 合约

- 合约地址：[`0xeb7216D50a2708a59fef5322e452e34382aFCDaD`](https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code)
- 部署交易：[`0x2128ff…f674a`](https://sepolia.etherscan.io/tx/0x2128ff833511d6f6c03d9c60ab6f161f62909e6f00fedd80710a8826495f674a)
- 部署区块：`11411013`（`2026-08-03T14:42:48.000Z`）
- 源码验证：Etherscan `Source Code Verified · Exact Match`
- Sourcify：[`chainId 11155111` 完整匹配源码](https://sourcify.dev/server/repo-ui/11155111/0xeb7216D50a2708a59fef5322e452e34382aFCDaD)

## 文档

- [架构说明](docs/architecture.md)
- [安全与隐私边界](docs/security.md)
- [Sepolia 验证记录](docs/qa/sepolia.md)
- [学习与演进记录](docs/learning-history.md)
- [仓库拆分来源](docs/migration/source.json)

所有公开地址和交易均为测试链证据。仓库不保存钱包私钥、RPC 凭据、API Key 或
儿童的真实姓名、照片、位置及健康数据。
