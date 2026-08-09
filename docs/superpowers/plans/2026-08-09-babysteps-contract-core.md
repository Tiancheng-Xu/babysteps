# BabySteps Contract Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and locally verify the new BabyCoin, growth-activity, VRF marketplace, purchase, completion, and certificate contract system without changing or migrating the legacy Sepolia contract.

**Architecture:** Four focused contracts separate token accounting, activity policy, marketplace/VRF state, and certificate ownership. Production code consumes Chainlink VRF v2.5, while a minimal test coordinator drives deterministic fulfillments in local tests. An Ignition module deploys the graph and grants only the roles each contract needs.

**Tech Stack:** Solidity 0.8.28, Hardhat 3.12, Viem 2.55, OpenZeppelin Contracts 5.6.1, a minimal ABI-compatible VRF v2.5 interface set derived from Chainlink Contracts 1.5.0, Node test runner, pnpm 11.

## Global Constraints

- Work directly in `/Users/shier/Desktop/babysteps`; do not create or switch a worktree.
- Keep `OnchainNotebook.sol`, its Sepolia address, and its tests intact as legacy evidence.
- Deploy only to Ethereum Sepolia and use test assets with no real value.
- Never commit a private key, seed phrase, RPC credential, VRF subscription secret, or API token.
- Use 18 decimals for BabyCoin and express whole BABY values with `1 ether` units in Solidity.
- Random marketplace price is 2-4 BABY; task duration is an integer number of hours determined once by VRF.
- Every wallet can purchase each task at most once; the provider payee receives the full price; platform fee is zero.
- Use UTC+8 daily boundaries for legacy-compatible activity caps.
- Completion callbacks and certificate minting must be idempotent.
- Preserve the existing `pnpm test` and `pnpm check` baseline.

---

### Task 1: BabyCoin ERC-20 and lifetime-earned accounting

**Files:**
- Modify: `contracts/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `contracts/contracts/BabyCoin.sol`
- Create: `contracts/test/BabyCoin.ts`

**Interfaces:**
- Produces: `BabyCoin.reward(address,uint256)`, `BabyCoin.mintTest(address,uint256)`, `BabyCoin.lifetimeEarned(address)`, and `BabyCoin.growthStageOf(address)`.
- Produces role: `REWARD_ROLE`, granted later to `GrowthActivities`.

- [ ] **Step 1: Install audited dependencies**

Run:

```bash
pnpm --filter @babysteps/contracts add @openzeppelin/contracts@5.6.1
```

Expected: `contracts/package.json` and `pnpm-lock.yaml` contain OpenZeppelin 5.6.1. The full Chainlink package is intentionally not installed because its 1,085-file multi-chain dependency graph includes an exotic Git subdependency blocked by pnpm's supply-chain policy; Task 4 vendors only the three MIT VRF compatibility units required by this project.

- [ ] **Step 2: Write failing BabyCoin tests**

Create tests that deploy with the first wallet as admin and prove:

```ts
assert.equal(await token.read.name(), "BabyCoin");
assert.equal(await token.read.symbol(), "BABY");
await token.write.mintTest([parent.account.address, parseEther("10")], { account: admin.account });
assert.equal(await token.read.lifetimeEarned([parent.account.address]), 0n);
await token.write.reward([parent.account.address, parseEther("3")], { account: rewarder.account });
assert.equal(await token.read.lifetimeEarned([parent.account.address]), parseEther("3"));
assert.equal(await token.read.growthStageOf([parent.account.address]), 1);
```

Also assert that an unprivileged wallet cannot call either mint path and that transfers/spending do not change either wallet's lifetime earned total.

- [ ] **Step 3: Run the focused test and verify it fails**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/BabyCoin.ts`

Expected: FAIL because `BabyCoin` does not exist.

- [ ] **Step 4: Implement the minimal token**

Implement `BabyCoin` with `ERC20` and `AccessControl`:

```solidity
bytes32 public constant REWARD_ROLE = keccak256("REWARD_ROLE");
mapping(address account => uint256 amount) public lifetimeEarned;

constructor(address admin) ERC20("BabyCoin", "BABY") {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
}

function mintTest(address account, uint256 amount)
    external onlyRole(DEFAULT_ADMIN_ROLE)
{
    _mint(account, amount);
}

function reward(address account, uint256 amount)
    external onlyRole(REWARD_ROLE)
{
    lifetimeEarned[account] += amount;
    _mint(account, amount);
}
```

Return stages `0..3` at whole-token thresholds 3, 8, and 15 BABY.

- [ ] **Step 5: Run focused and contract tests**

Run:

```bash
pnpm --filter @babysteps/contracts exec hardhat test test/BabyCoin.ts
pnpm --filter @babysteps/contracts test
```

Expected: PASS, including all legacy tests.

### Task 2: GrowthActivities reward policy

**Files:**
- Create: `contracts/contracts/GrowthActivities.sol`
- Create: `contracts/test/GrowthActivities.ts`

**Interfaces:**
- Consumes: `BabyCoin.reward(address,uint256)` and `BabyCoin.REWARD_ROLE()`.
- Produces: `recordActivity(ActivityType)`, `getActivityAvailability(address,ActivityType)`, `currentUtc8DayId()`, and `ActivityRecorded`.

- [ ] **Step 1: Write failing activity tests**

Test the exact policies:

```ts
const policies = [
  { activity: 0, reward: "3", min: 3 * 3600, max: 4 * 3600, cap: 6 },
  { activity: 1, reward: "5", min: 8 * 3600, max: 12 * 3600, cap: 2 },
  { activity: 2, reward: "7", min: 4 * 3600, max: 6 * 3600, cap: 3 },
] as const;
```

Grant the deployed activity contract `REWARD_ROLE`, record each activity, assert BabyCoin balance and lifetime earned, assert the minimum/maximum cooldown bounds, enforce the UTC+8 cap, and prove a transferred token does not grant growth.

- [ ] **Step 2: Run and observe the missing-contract failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/GrowthActivities.ts`

Expected: FAIL because `GrowthActivities` does not exist.

- [ ] **Step 3: Implement activity state and reward issuance**

Port the existing `ActivityProgress`, UTC+8 boundary, cooldown ranges, caps, and activity entropy into the focused contract. Replace internal point mutations with:

```solidity
babyCoin.reward(msg.sender, rewardFor(activity));
```

Return rewards in wei units: `3 ether`, `5 ether`, and `7 ether`.

- [ ] **Step 4: Run focused and full contract tests**

Run:

```bash
pnpm --filter @babysteps/contracts exec hardhat test test/GrowthActivities.ts
pnpm --filter @babysteps/contracts test
```

Expected: PASS.

### Task 3: GrowthCertificate one-per-purchase NFT

**Files:**
- Create: `contracts/contracts/GrowthCertificate.sol`
- Create: `contracts/test/GrowthCertificate.ts`

**Interfaces:**
- Produces role: `MINTER_ROLE`.
- Produces: `mintForPurchase(address,uint256,string) returns (uint256)` and `tokenForPurchase(uint256)`.

- [ ] **Step 1: Write failing certificate tests**

Prove the name/symbol, standard transferability, minter-only minting, metadata URI, monotonically increasing token IDs, and duplicate purchase rejection:

```ts
const tokenId = await certificate.read.nextTokenId();
await certificate.write.mintForPurchase([parent.account.address, 7n, "ipfs://certificate/7"], { account: minter.account });
assert.equal(await certificate.read.ownerOf([tokenId]), parent.account.address);
assert.equal(await certificate.read.tokenForPurchase([7n]), tokenId);
```

- [ ] **Step 2: Run and observe the missing-contract failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/GrowthCertificate.ts`

Expected: FAIL because `GrowthCertificate` does not exist.

- [ ] **Step 3: Implement the ERC-721 contract**

Use `ERC721URIStorage` plus `AccessControl`. Reserve zero as the “not minted” sentinel by starting `nextTokenId` at 1. Store `tokenForPurchase[purchaseId]` and revert when it is already nonzero.

- [ ] **Step 4: Run focused and full contract tests**

Run the certificate test and then the entire contracts suite; expect PASS.

### Task 4: TaskMarketplace provider and VRF task activation

**Files:**
- Create: `contracts/contracts/vrf/VRFV2PlusClient.sol`
- Create: `contracts/contracts/vrf/IVRFCoordinatorV2Plus.sol`
- Create: `contracts/contracts/vrf/VRFConsumerBaseV2Plus.sol`
- Create: `contracts/contracts/test/MockVrfCoordinator.sol`
- Create: `contracts/contracts/TaskMarketplace.sol`
- Create: `contracts/test/TaskMarketplace.ts`

**Interfaces:**
- Consumes: BabyCoin address, GrowthCertificate address, VRF coordinator, subscription ID, key hash, confirmation count, and callback gas limit.
- Produces roles: `PROVIDER_ROLE` and `ORACLE_ROLE`.
- Produces: `createTask(address,uint8,string) returns (uint256)`, `setTaskPaused(uint256,bool)`, `getTask(uint256)`, and task/VRF events.

- [ ] **Step 1: Add a deterministic local coordinator**

The mock must expose the same `requestRandomWords(VRFV2PlusClient.RandomWordsRequest)` selector consumed by the production contract, increment request IDs, and later invoke the consumer's `rawFulfillRandomWords(requestId, words)` from the coordinator address.

- [ ] **Step 2: Write failing provider and VRF tests**

Cover:

```ts
await marketplace.write.grantRole([providerRole, provider.account.address], { account: admin.account });
const createHash = await marketplace.write.createTask([
  provider.account.address,
  1,
  "ipfs://task/walk-1",
], { account: provider.account });
```

Assert unprivileged creation reverts, the task starts pending, the request maps to the task, purchase is blocked before fulfillment, and a mock fulfillment with two known words activates it. Test all output bounds:

- price is exactly 2, 3, or 4 BABY
- Meal duration is 3-4 hours
- Walk duration is 8-12 hours
- Read duration is 4-6 hours
- duplicate fulfillment and reroll paths revert or are impossible
- Owner pause works and Provider cannot pause

- [ ] **Step 3: Run and observe the missing-contract failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/TaskMarketplace.ts`

Expected: FAIL before implementation.

- [ ] **Step 4: Implement the VRF lifecycle**

Inherit the ABI-compatible `VRFConsumerBaseV2Plus`, `AccessControl`, and `ReentrancyGuard`. The local base preserves Chainlink's coordinator-only callback invariant, while the client struct and function selectors match VRF v2.5. Store `requestToTaskId`. Request two words and use:

```solidity
uint256 price = (2 + (randomWords[0] % 3)) * 1 ether;
(uint256 minimumHours, uint256 spanHours) = durationRange(task.activityType);
uint256 duration = (minimumHours + (randomWords[1] % (spanHours + 1))) * 1 hours;
```

Set `opensAt` at fulfillment, calculate `closesAt`, and emit `TaskActivated` with the locked values.

- [ ] **Step 5: Run the marketplace and complete contract suites**

Run the focused marketplace test and `pnpm --filter @babysteps/contracts test`; expect PASS.

### Task 5: Exact-price purchase and idempotent completion

**Files:**
- Modify: `contracts/contracts/TaskMarketplace.sol`
- Modify: `contracts/test/TaskMarketplace.ts`

**Interfaces:**
- Consumes: `BabyCoin.transferFrom` allowance and `GrowthCertificate.mintForPurchase`.
- Produces: `buy(uint256) returns (uint256)`, `confirmCompletion(uint256,string)`, `getPurchase(uint256)`, `hasPurchased(uint256,address)`, `PurchaseCreated`, `TaskCompleted`, and `CertificateMinted`.

- [ ] **Step 1: Write failing purchase tests**

Activate a task, mint test BABY to a parent without changing lifetime earned, approve the exact random price, and assert:

```ts
assert.equal(providerBalanceAfter - providerBalanceBefore, task.price);
assert.equal(parentBalanceBefore - parentBalanceAfter, task.price);
assert.equal(await token.read.lifetimeEarned([parent.account.address]), 0n);
```

Reject insufficient allowance, insufficient balance, duplicate purchase, pending task, expired task, and paused task. Assert the purchase stores buyer, task, historical price, timestamp, and incomplete state.

- [ ] **Step 2: Write failing completion tests**

Grant `ORACLE_ROLE`, grant the marketplace the certificate `MINTER_ROLE`, confirm a valid purchase, and assert one certificate. Reject a non-oracle, unknown purchase, and second confirmation.

- [ ] **Step 3: Run focused tests and verify new cases fail**

Run the marketplace test; expect failures for missing `buy` and `confirmCompletion` behavior.

- [ ] **Step 4: Implement purchase and completion**

Use `SafeERC20.safeTransferFrom`, `nonReentrant`, checks-effects-interactions, and set the one-purchase flag before transferring. Completion must set `completed = true` before calling the certificate contract and must never mint twice.

- [ ] **Step 5: Run complete contract verification**

Run:

```bash
pnpm --filter @babysteps/contracts test
pnpm --filter @babysteps/contracts typecheck
pnpm --filter @babysteps/contracts check
```

Expected: all pass.

### Task 6: Deployment graph and configuration documentation

**Files:**
- Create: `contracts/ignition/modules/BabyStepsWeb3.ts`
- Create: `contracts/test/babysteps-web3-module.test.ts`
- Modify: `contracts/package.json`
- Modify: `README.md`
- Modify: `web/.env.example`

**Interfaces:**
- Produces Ignition results: `babyCoin`, `growthActivities`, `growthCertificate`, and `taskMarketplace`.
- Produces configuration names for coordinator, subscription ID, key hash, callback gas limit, and deployed contract addresses.

- [ ] **Step 1: Write the failing module test**

Assert the module exports exactly four contract results, wires constructor parameters, and schedules role grants from token to activities and certificate to marketplace. Assert README and `.env.example` document only variable names, never secret values.

- [ ] **Step 2: Run and observe the missing-module failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/babysteps-web3-module.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the Ignition deployment graph**

Use module parameters for all external addresses and VRF settings. Deploy the four contracts, then call `grantRole` for the activities reward role and marketplace certificate minter role. Do not grant provider or oracle roles to arbitrary addresses in the default module.

- [ ] **Step 4: Add local deployment scripts and safe documentation**

Add `deploy:web3:local`, `deploy:web3:sepolia`, and `deploy:web3:verify:sepolia` scripts. Document the exact parameter file shape with placeholder public configuration values and refer secret material to Hardhat configuration variables.

- [ ] **Step 5: Run repository-wide verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm check
git diff --check
```

Expected: all tests and builds pass; only the pre-existing reduced-motion CSS warnings may remain.

## Plan self-review

- Spec coverage: token, activities, roles, VRF, purchase, completion, certificate, and deployment are each owned by a task.
- Explicitly deferred to later plans: Stitch UI, Privy, Worker/D1, live completion oracle, The Graph, dual RPC evidence, Uniswap pools, and Sepolia deployment.
- No legacy state migration or `OnchainNotebook` mutation is planned.
- Public role and function names are consistent across tasks.
- No placeholder implementation step or secret value is included.
