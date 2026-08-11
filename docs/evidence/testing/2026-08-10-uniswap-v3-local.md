# BabySteps Uniswap v3 — implementation and read-only Sepolia evidence

- Date: 2026-08-10 (America/New_York)
- Network: Ethereum Sepolia (`11155111`)
- Protocol version: Uniswap v3, 0.3% fee tier
- Pool transaction status: `pending funding` — the read-only preflight sent no transaction.

## Official contracts used

- v3 Factory: `0x0227628f3F023bb0B980b67D528571c95c6DaC1c`
- NonfungiblePositionManager: `0x1238536071E1c677A632429e3655c799b22cDA52`
- QuoterV2: `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3`
- SwapRouter02: `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E`
- Circle test USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- WETH9: `0xfff9976782d46cc05630d1f6ebab18b2324d6b14`

Sources: [Uniswap Ethereum deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments), [Circle testnet USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses).

## Implemented behavior

- The provisioning script discovers each pool through `Factory.getPool` before writing.
- If a pool is absent, it computes the Q64.96 initial price, initializes the pool, grants exact token approvals, and mints a full-range position with 1% minimum-amount protection.
- A global preflight checks the BABY amount for both pools and official USDC before any pool transaction. Missing WETH may be created from test ETH only after the non-WETH preflight passes.
- `UNISWAP_EXECUTE=1` is required for any transaction. Default mode is read-only and writes only sanitized local evidence.
- The frontend reads `QuoterV2`, wraps only an ETH deficit through WETH9, uses a finite approval equal to the selected input, and simulates `exactInputSingle` before submitting it.
- The UI never treats a missing quote as permission to swap and applies a 1% output floor.

## Tests and read-only preflight

Observed local results:

```text
Web Vitest: 27 files passed, 156 tests passed
Contract node tests: 79 passed
TypeScript (web/contracts): passed
```

Read-only command:

```text
pnpm --filter @babysteps/contracts uniswap:v3:sepolia
```

Observed Sepolia facts:

```text
BABY/USDC 0.3% pool: not yet created
BABY/WETH 0.3% pool: not yet created
Operator BABY balance: 18 BABY
Operator official USDC balance: 0 USDC
Operator WETH balance: 0 WETH
Configured provisioning target: 8 BABY + 8 USDC; 8 BABY + 0.002 WETH
Transactions sent: 0
```

Machine-readable output: `docs/evidence/deployment/2026-08-10-uniswap-v3-pools.json`.

## Honest remaining blocker

At least 8 official Sepolia USDC is required before the all-or-nothing preflight permits pool creation. WETH does not require a faucet because the script can wrap the operator's test ETH. Pool and swap transaction hashes must remain pending until the funding and wallet-signature steps actually succeed.

No MockUSDC, mainnet asset, private key, RPC credential, wallet password, or infinite token approval is used or published.
