# BabySteps · 成长星球

这是周日 Web3 作业的概念验证版：一个使用 Vite、React、wagmi、Hardhat 和
Sepolia 的链上记事本 DApp，同时加入不具有金融属性的 BabySteps 成长星体验。

## 先理解 DApp 的前后端

在这个项目里，Solidity 合约就是公开运行的“后端”。前端通过 ABI 调用合约：

- 读取是 call，不修改链上状态，也不要求钱包支付 gas；
- 写入需要钱包签名、广播交易并使用少量 Sepolia 测试 ETH 支付 gas；
- 拿到 transaction hash 只表示交易已经广播，收到成功 receipt 才表示链上确认。

成长活动的 ABI 枚举顺序固定为 `Meal = 0`、`Walk = 1`、`Read = 2`，分别获得
3、5、7 枚成长星。每日限制按 `UTC+8`（北京时间）计算；合约保存 `dayId + 1`，
避免当天编号与 Solidity mapping 默认值 `0` 混淆。

活动交易只包含钱包、活动枚举、日期编号和积分，不包含儿童姓名、照片、位置、
健康或疫苗文字，也不能证明现实活动真实发生。成长星没有价格，可以在 Sepolia
测试钱包间赠送但不可兑换，也不是 Token、NFT 或孩子表现评级。

## 为什么使用双账本

`累计成长值`像一本只会增加页数的成长相册：只有当前钱包记录 Meal、Walk、Read
活动时才增加，用来决定星宝阶段，赠送后不会减少。`可转余额`像手里可送出的星星：
记录活动时同步获得，可以通过 `transferGrowthPoints` 送给另一个 Sepolia 地址；
收到的星星可以再次赠送，但不会冒充收款钱包完成活动，也不会增加它的星宝阶段。

这不是 ERC-20：没有名称、符号、小数、`approve`、`allowance`、交易市场、价格或
提现能力。课程只计划部署到 Sepolia，不宣称主网部署。地址、数量和交易都会公开，
测试链赠送同样无法撤回，必须逐字核对收款地址。

公开便签是独立的课程实验。便签文字和历史交易会长期公开；`clearNote` 只清空
当前合约状态，不能删除已经写入区块链的历史内容。请只填写无隐私的测试文字。

## 本地开发与验证

从仓库根目录运行：

```sh
pnpm web3:check
pnpm web3:test
pnpm web3:typecheck
pnpm web3:build
```

`web3:build` 的前端生产构建必须读取真实合约地址。部署前可以独立运行本地测试和
类型检查，但不能用占位地址冒充生产成果。

部署完成后，在被 Git 忽略的 `homeworks/06-web3-dapp/web/.env.local` 中写入公开地址：

```dotenv
VITE_ONCHAIN_NOTEBOOK_ADDRESS=0x实际部署的公开合约地址
```

随后启动前端：

```sh
pnpm --filter @course-homework/web3-web dev
```

## Sepolia 凭据

RPC URL、部署钱包私钥和 Etherscan API Key 只通过 Hardhat 的交互式 keystore
提示输入。不要写进命令行参数、`.env`、聊天、截图、日志或 Git：

```sh
pnpm --filter @course-homework/web3-contracts exec hardhat keystore set SEPOLIARPCURL
pnpm --filter @course-homework/web3-contracts exec hardhat keystore set SEPOLIAPRIVATEKEY
pnpm --filter @course-homework/web3-contracts exec hardhat keystore set ETHERSCANAPIKEY
```

只使用专用测试钱包，不使用持有真实资产的钱包。

## 部署与开源验证

合约没有构造参数。配置凭据并确认专用账户有足够的 Sepolia 测试币后运行：

```sh
pnpm --filter @course-homework/web3-contracts deploy:sepolia
pnpm --filter @course-homework/web3-contracts deploy:verify:sepolia
```

第二条命令会通过 Etherscan V2 API 请求源码验证。部署、验证和钱包签名都属于外部
链上操作，必须在执行前确认账户、网络、合约候选提交和公开信息范围。

## 已部署的 Sepolia 实例

- 合约地址：[`0xeb7216D50a2708a59fef5322e452e34382aFCDaD`](https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code)
- 部署交易：[`0x2128ff…f674a`](https://sepolia.etherscan.io/tx/0x2128ff833511d6f6c03d9c60ab6f161f62909e6f00fedd80710a8826495f674a)
- 部署区块：`11411013`（`2026-08-03T14:42:48.000Z`）
- 源码验证：Etherscan `Source Code Verified · Exact Match`
- Sourcify：[`chainId 11155111` 完整匹配源码](https://sourcify.dev/server/repo-ui/11155111/0xeb7216D50a2708a59fef5322e452e34382aFCDaD)

以上地址和交易均为公开测试链证据，不包含任何钱包私钥或本地凭据。

## 验收证据

- [本地与 Sepolia 验收记录](../../docs/qa/web3-onchain-notebook.md)
- [周六 Remix 合约验收记录](../../docs/qa/web3-saturday-contracts.md)
