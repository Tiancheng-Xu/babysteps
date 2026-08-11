# BabySteps Web3 Homework Completion With Cost Gates

> **Execution note:** Follow strict red-green-refactor for application behavior. External deployment evidence is recorded only after a real receipt, query, or cloud resource read succeeds.

**Goal:** Complete every BabySteps-backed Web3 homework requirement except AWS resources that cannot be paused and continue charging while idle, then produce a reproducible evidence bundle and step-by-step review.

**Architecture:** Keep the approved React + Cloudflare Worker/D1 + Ethereum Sepolia + The Graph design. Complete local adapters and tests first, then deploy the V2 contract graph and external development services. Split AWS into a low-cost readiness layer and a deferred continuous-cost layer; never deploy NAT Gateway, ALB, public IPv4, KMS key, or Secrets Manager secret in this run.

**Technology:** React 19, TypeScript, Vite, wagmi/viem, Privy React SDK, Hardhat 3, Solidity 0.8.28, Uniswap v3 Sepolia, ethers.js v6, The Graph CLI/graph-ts, Cloudflare Worker/D1, AWS SAM/CloudFormation.

---

## Scope correction

The current homework catalog is authoritative. Privy must expose Google, email, external-wallet, and embedded Smart Wallet entry points. Paymaster remains optional and is excluded. Cosmos remains a separate repository and is excluded from BabySteps.

## Task 1: Completion contracts and configuration gates

**Files:**
- Modify: `web/.env.example`
- Modify: `web/src/vite-env.d.ts`
- Modify: `web/src/contracts/web3Contracts.ts`
- Test: `web/src/contracts/web3Contracts.test.ts`

1. Add failing tests for strict Sepolia addresses, Privy configuration, Uniswap v3 deployment constants, Circle Sepolia USDC, and WETH9.
2. Run the focused test and confirm it fails because the configuration API is missing.
3. Implement the smallest typed configuration surface.
4. Run the focused test, web typecheck, and formatter.

## Task 2: Privy identity and profile flow

**Files:**
- Modify: `web/package.json`
- Modify: `web/src/config/providers.tsx`
- Create: `web/src/features/identity/identityModel.ts`
- Create: `web/src/features/identity/IdentityPanel.tsx`
- Create: `web/src/pages/ProfilePage.tsx`
- Modify: `web/src/components/ProductNavigation.tsx`
- Modify: `web/src/App.tsx`
- Tests: identity model, panel, navigation, and app tests

1. Add failing tests for Google/email/external-wallet availability, embedded wallet selection, missing-app-id fallback, signed challenge progression, username validation, and session expiry.
2. Install the official Privy React SDK and wrap the app only when a public app ID is configured.
3. Implement the personal center against the existing Worker challenge-sign-verify and profile endpoints.
4. Preserve the existing injected-wallet path as a read/write fallback; never fake a successful Privy login without a real app ID.
5. Run focused tests, all web tests, typecheck, and production build.

## Task 3: Uniswap exact-output swap and purchase state machine

**Files:**
- Create: `web/src/features/swap/uniswapConfig.ts`
- Create: `web/src/features/swap/swapPlan.ts`
- Create: `web/src/features/swap/useBabyCoinSwap.ts`
- Create: `web/src/features/swap/BabyCoinSwapPanel.tsx`
- Modify: `web/src/features/marketplace/useTaskPurchase.ts`
- Modify: `web/src/features/marketplace/MarketplaceTaskCard.tsx`
- Tests: swap config, plan, hook, and purchase integration

1. Add failing tests for BABY/USDC and BABY/WETH 0.3% pools, exact-output deficit calculation, finite USDC approval, ETH/WETH route, slippage ceiling, quote expiry, insufficient liquidity, rejection, and recovery.
2. Implement read-only pool discovery through the official v3 Factory and quoting through QuoterV2.
3. Implement SwapRouter02 exact-output requests using only the current deficit and a user-confirmed maximum input.
4. Extend purchase UI to show `Quote → Swap → BABY Approve → Buy → Confirmed` without infinite approval.
5. Run focused tests and the full web gate.

## Task 4: Three-provider ethers.js evidence reader

**Files:**
- Modify: `contracts/package.json`
- Create: `contracts/scripts/readSepoliaAcrossProviders.ts`
- Create: `contracts/test/read-sepolia-across-providers.test.ts`
- Modify: `.gitignore` if a generated evidence output needs an allowlisted location

1. Add failing tests for URL redaction, normalized block/transaction/receipt/log output, source timing, and mismatch detection.
2. Add ethers.js v6 and implement public RPC, Infura, and Alchemy readers using environment-only URLs/keys.
3. Make the script succeed with available providers and explicitly report `not-configured` for missing providers; require all three only in the final external evidence command.
4. Record only sanitized provider names, timings, block/transaction facts, and comparison results.

## Task 5: The Graph subgraph

**Files:**
- Create: `subgraph/package.json`
- Create: `subgraph/subgraph.yaml`
- Create: `subgraph/schema.graphql`
- Create: `subgraph/src/task-marketplace.ts`
- Create: `subgraph/abis/TaskMarketplaceV2.json`
- Create: `subgraph/queries/homework.graphql`
- Create: `subgraph/tests/task-marketplace.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: root scripts as needed

1. Add failing Matchstick tests for task review/randomization, purchase, completion, certificate, pause/reject, and AccessControl role events.
2. Implement deterministic entity IDs from transaction hash plus log index where needed.
3. Generate types, run Matchstick, and run `graph build`.
4. Keep Studio deploy and query evidence separate; never publish to the decentralized network without a later production decision.

## Task 6: IPFS metadata and V2 Sepolia deployment

**Files:**
- Create: `metadata/` allowlisted task/certificate metadata and StarBuddy asset manifest
- Create: `scripts/validate-ipfs-metadata.mjs`
- Create: `contracts/scripts/finalizeSepoliaV2.ts`
- Create: `contracts/scripts/runSepoliaV2ClosedLoop.ts`
- Modify: contract package scripts and evidence validators

1. Validate metadata contains no personal data, uses stable content hashes, and references the approved StarBuddy asset.
2. Deploy V2 against the existing BabyCoin and Chainlink VRF subscription; add V2 as consumer and grant only Provider and completion roles required for the demo.
3. Execute Provider request, Owner approval, VRF fulfillment, finite approval, buy, idempotent completion, and ERC-5192 ownership/locked checks.
4. Save contract addresses, deployment block, transaction hashes, and sanitized JSON outputs.

## Task 7: Uniswap Sepolia pools and minimum swaps

1. Read Factory `getPool` first; reuse compatible 0.3% pools if they already exist.
2. Confirm the demo wallet has BABY, official Circle Sepolia USDC, WETH, and gas. Never substitute MockUSDC.
3. Create only missing pools, initialize the approved demo price, and add the minimum usable in-range liquidity.
4. Execute one minimal USDC→BABY and one ETH/WETH→BABY exact-output swap.
5. Save pool addresses, position NFT IDs, fee tier, liquidity transactions, quotes, swaps, and post-swap balances.

## Task 8: Worker/D1 and Privy external development verification

1. Create/reuse one D1 development database and one Worker development service after read-only inventory.
2. Apply migrations, configure only non-secret vars, and set secrets through the platform secret store.
3. Create/reuse a Privy development app; configure the exact development origin and the four required login methods.
4. Verify challenge-sign-verify, username update, task metadata binding, purchased-only comment, and replay rejection.
5. Keep production Pages, DNS, and public Evidence unchanged until a production-release instruction.

## Task 9: AWS low-cost readiness layer

**Allowed now:** VPC, subnets, route tables without NAT, security groups, IAM/OIDC, CodeBuild project/build, on-demand Lambda/API calls, and one stoppable development RDS instance after a verified account inventory.

**Deferred:** NAT Gateway, EIP/public IPv4, ALB, KMS customer-managed key, Secrets Manager secret, provisioned concurrency, and any second shared foundation.

1. Inventory the authenticated account and `us-east-1`; update `~/.codex/aws-shared-foundation.yaml` only from verified output.
2. Produce the required reuse matrix and exact incremental billable list.
3. Refactor the templates into stoppable/readiness and deferred/full-relayer layers without weakening the final architecture.
4. Run the AWS shared-resource IaC gate, SAM/CloudFormation validation, and local tests.
5. Deploy only the allowed layer, run one CodeBuild, verify Lambda/API and RDS schema/idempotency, then stop RDS immediately.
6. Add an EventBridge/Lambda protection that re-stops the tagged homework RDS after AWS auto-restarts it; verify the rule without exposing credentials.
7. Record resource IDs, build ID, stop state, retained storage cost, and deferred resource list. Do not delete stacks or shared resources without action-time confirmation.

## Task 10: Evidence, architecture, and final gates

1. Update `docs/homework/web3-homework-implementation-map.md` with requirement, feature, exact code location, evidence, environment, and status.
2. Update Mermaid and StarBuddy architecture visual so every node is marked deployed, locally verified, deferred, or pending external authorization.
3. Add incident notes for VRF funding, keystore password, deployment-success-but-empty-output, and AWS cost gates.
4. Run full tests, typechecks, builds, link/Pages validators, public-copy scan, evidence validator, responsive checks, and public HTTP checks that do not trigger a production release.
5. Commit coherent phases on `feature/babysteps-homework-readers`; do not merge, push, or deploy production until explicitly requested.

## Completion boundary

The local implementation is complete only when every new behavior has a witnessed failing test followed by a passing test. External completion requires real Sepolia transactions, GraphQL output, Worker/D1 responses, and AWS resource reads. A missing account login, deploy key, app ID, faucet balance, or API key remains `pending-external` and cannot be relabeled as complete.
