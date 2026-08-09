# Web3 UI Data Integration Plan

**Goal:** Replace the deployment-gated placeholder behavior with typed Sepolia contract reads and safe `approve -> buy` transaction states while preserving honest empty states before deployment.

## Task 1: Address and ABI boundary

- Add failing tests for optional address parsing, invalid configured addresses, and the four public contract ABIs.
- Add one typed configuration module that never invents an address and never prints secrets.
- Keep the legacy OnchainNotebook address independent from the new contract graph.

## Task 2: Marketplace read model

- Add failing tests that map `TaskMarketplace.getTask` results into pending, active, paused, and expired cards.
- Read `nextTaskId` and existing tasks only when the marketplace address is configured and the wallet is on Sepolia.
- Render verified on-chain values; otherwise keep the deployment-gated empty state.

## Task 3: Exact BabyCoin purchase flow

- Add failing hook/component tests for allowance, exact approve, transaction receipt, and `buy(taskId)`.
- Never combine approval and purchase into a misleading single confirmation.
- Refresh BabyCoin balance, allowance, purchase flag, and task state only after successful receipts.

## Task 4: Evidence and verification

- Save browser screenshots for disconnected, wrong-network, approval-pending, and purchase-confirmed states when those states are locally reproducible.
- Run tests, typecheck, build, Biome, public-copy validation, and `git diff --check`.
- Do not deploy or push during this phase.
