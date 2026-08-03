# 链上记事本 DApp

## Sepolia 本地配置

Sepolia 凭据只保存在 Hardhat keystore 中；请在 `contracts` 目录交互输入下列变量的值，绝不把值写入仓库：

```sh
pnpm --filter @course-homework/web3-contracts exec hardhat keystore set SEPOLIA_RPC_URL
pnpm --filter @course-homework/web3-contracts exec hardhat keystore set SEPOLIA_PRIVATE_KEY
pnpm --filter @course-homework/web3-contracts exec hardhat keystore set ETHERSCAN_API_KEY
```

## 部署与开源验证

合约没有构造参数。配置完成并拥有测试币后，运行：

```sh
pnpm --filter @course-homework/web3-contracts deploy:sepolia
pnpm --filter @course-homework/web3-contracts deploy:verify:sepolia
```

第二条命令会在部署时请求开源验证。Etherscan 配置使用统一的 V2 API。
