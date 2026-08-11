# BabySteps Web3 delivery Phase 1 Contract V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and locally verify the V2 review, purchase, idempotent completion, and ERC-5192 contract boundary while preserving the existing Sepolia deployment as historical evidence.

**Architecture:** Reuse the deployed BabyCoin address, deploy a new `TaskMarketplaceV2` and `GrowthCertificateSBT`, and keep Chainlink VRF v2.5 as the only randomness source. Add a validator-backed delivery map and status-aware architecture source so every later phase must distinguish existing, planned, and externally verified work.

**Tech Stack:** Solidity 0.8.28, Hardhat 3.12, Viem 2.55, OpenZeppelin Contracts 5.6.1, Chainlink VRF v2.5 compatible interfaces, Node test runner, pnpm 11, Mermaid.

## Global constraints

- Work directly in `/Users/shier/Desktop/babysteps`; do not create or switch a worktree.
- Keep the current branch name and Git author free of model, agent, or MCP names.
- Preserve the four existing Sepolia contracts and their evidence; this phase performs no Sepolia deployment.
- Reuse BabyCoin in V2. Do not migrate old star balances or create another platform token.
- Use Chainlink VRF v2.5 for a locked 2 to 4 BABY price and activity-specific integer duration.
- Require Provider submission and Owner approval before requesting randomness.
- Make completion and certificate minting idempotent by `purchaseId` and evidence hash.
- Implement formal ERC-5192 support and reject every approval, transfer, and burn path after mint.
- Never commit private keys, seed phrases, RPC credentials, API keys, tokens, full email addresses, or private local paths in public evidence.
- Explain every task before starting and report files, lines, tests, commit, deployment state, and evidence after completion.
- Update `docs/delivery/web3-delivery-implementation-map.md` and `docs/architecture/starbuddy-web3-architecture.mmd` at each completed task.

---

## Locked file structure

This phase adds focused files instead of rewriting the existing V1 contracts.

- `contracts/contracts/interfaces/IERC5192.sol`: formal locked-token interface and events
- `contracts/contracts/GrowthCertificateSBT.sol`: one locked certificate per purchase
- `contracts/contracts/test/GrowthCertificateSBTHarness.sol`: test-only public burn probe for the internal ownership hook
- `contracts/contracts/TaskMarketplaceV2.sol`: review, VRF, purchase, and completion state
- `contracts/test/GrowthCertificateSBT.ts`: ERC-5192, access, and idempotency tests
- `contracts/test/TaskMarketplaceV2.ts`: review, randomness, purchase, role, and completion tests
- `contracts/ignition/modules/BabyStepsWeb3V2.ts`: Sepolia V2 graph that attaches to an existing BabyCoin
- `contracts/ignition/modules/BabyStepsWeb3V2Local.ts`: deterministic local graph with mock VRF and local BabyCoin
- `contracts/test/babysteps-web3-v2-module.test.ts`: module structure and script contract tests
- `contracts/ignition/parameters/babysteps-web3-v2.sepolia.example.json`: public V2 parameter schema without secrets
- `scripts/validate-delivery-evidence.mjs`: implementation-map and architecture status validator
- `scripts/validate-delivery-evidence.test.mjs`: validator regression tests
- `docs/delivery/web3-delivery-implementation-map.md`: assignment-to-code-to-evidence matrix
- `docs/architecture/starbuddy-web3-architecture.mmd`: status-aware architecture source

## Official references locked for this phase

- Chainlink VRF v2.5 Ethereum Sepolia coordinator and key hash: <https://docs.chain.link/vrf/v2-5/supported-networks>
- ERC-5192 interface: <https://eips.ethereum.org/EIPS/eip-5192>
- OpenZeppelin ERC-721 extension points: <https://docs.openzeppelin.com/contracts/5.x/api/token/erc721>

### Task 1: Enforce the delivery map and architecture status contract

**Files:**
- Create: `scripts/validate-delivery-evidence.test.mjs`
- Create: `scripts/validate-delivery-evidence.mjs`
- Create: `docs/delivery/web3-delivery-implementation-map.md`
- Create: `docs/architecture/starbuddy-web3-architecture.mmd`
- Modify: `package.json`

**Interfaces:**
- Produces CLI: `node scripts/validate-delivery-evidence.mjs`
- Produces package script: `pnpm validate:delivery-evidence`
- Produces allowed statuses: `complete`, `partial`, `pending`, `blocked`
- Produces required architecture markers: `现有`, `计划`, `待验证`

- [ ] **Step 1: Write validator tests against temporary fixtures**

Create a Node test that writes fixtures under `mkdtemp(join(tmpdir(), "babysteps-delivery-"))`. Import `validateDeliveryEvidence` and assert a valid map passes while a missing evidence column, an invalid status, and an architecture file without status markers each fail.

```js
const validRows = [
  ["链上与链下列表", "taskId 映射", "pending"],
  ["Owner 与 Provider", "审核状态机", "partial"],
];
assert.deepEqual(validateDeliveryEvidence(validMap, validArchitecture), []);
assert.match(validateDeliveryEvidence(mapWithoutEvidence, validArchitecture)[0], /验证证据/);
assert.match(validateDeliveryEvidence(mapWithDone, validArchitecture)[0], /invalid status: done/);
```

- [ ] **Step 2: Run the validator test and verify the missing-module failure**

Run: `node --test scripts/validate-delivery-evidence.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `validate-delivery-evidence.mjs`.

- [ ] **Step 3: Implement the validator**

Export `validateDeliveryEvidence(mapText, architectureText): string[]`. Require these exact table headers:

```js
const requiredHeaders = [
  "作业要求",
  "实现功能",
  "代码位置",
  "验证证据",
  "当前状态",
];
const allowedStatuses = new Set(["complete", "partial", "pending", "blocked"]);
```

The CLI reads the two repository files, prints one error per line, and exits with code 1 on validation errors. It prints `delivery evidence contract: ok` on success.

- [ ] **Step 4: Create the initial truthful map and architecture source**

The map lists every Web3 delivery item. Mark existing BabyCoin and the proven V1 Approve/Buy mechanics `complete`; mark review, Uniswap, Privy, ERC-5192, KMS, IPFS, The Graph, and three-provider ethers.js comparison `pending`; mark Chainlink and certificate issuance `partial` because V1 evidence exists but V2 is not implemented.

The Mermaid source includes runtime, storage, external services, CI/CD, and permission boundaries. Label every node `现有`, `计划`, or `待验证`. Link the current architecture PNG as historical evidence without claiming it reflects V2.

- [ ] **Step 5: Add the package script and make the test pass**

Add `validate:delivery-evidence` to root scripts and call it from `check` after the existing validators.

Run:

```bash
node --test scripts/validate-delivery-evidence.test.mjs
pnpm validate:delivery-evidence
pnpm test:validators
```

Expected: all tests pass and the CLI prints `delivery evidence contract: ok`.

- [ ] **Step 6: Commit the evidence contract**

```bash
git add package.json scripts/validate-delivery-evidence.mjs scripts/validate-delivery-evidence.test.mjs docs/delivery/web3-delivery-implementation-map.md docs/architecture/starbuddy-web3-architecture.mmd
git commit -m "docs: enforce web3 delivery evidence mapping"
```

### Task 2: Implement the ERC-5192 growth certificate

**Files:**
- Create: `contracts/contracts/interfaces/IERC5192.sol`
- Create: `contracts/contracts/GrowthCertificateSBT.sol`
- Create: `contracts/contracts/test/GrowthCertificateSBTHarness.sol`
- Create: `contracts/test/GrowthCertificateSBT.ts`
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`

**Interfaces:**
- Produces constructor: `GrowthCertificateSBT(address admin)`
- Produces interface: `IERC5192.locked(uint256 tokenId) returns (bool)`
- Produces events: `Locked(uint256 tokenId)` and `Unlocked(uint256 tokenId)`
- Produces role: `MINTER_ROLE`
- Produces function: `mintForPurchase(address recipient,uint256 purchaseId,string metadataUri) returns (uint256 tokenId)`
- Produces mapping getter: `tokenForPurchase(uint256 purchaseId) returns (uint256)`

- [ ] **Step 1: Write failing ERC-5192 tests**

Test the exact interface ID, one-per-purchase behavior, URI immutability, access control, and all blocked ownership changes.

```ts
assert.equal(await certificate.read.supportsInterface(["0xb45a3c0e"]), true);
assert.equal(await certificate.read.locked([1n]), true);
await viem.assertions.revertWithCustomError(
  certificate.write.transferFrom([parent.account.address, outsider.account.address, 1n], { account: parent.account }),
  certificate,
  "Soulbound",
);
```

Also assert `approve`, `setApprovalForAll`, both `safeTransferFrom` overloads, `transferFrom`, and `GrowthCertificateSBTHarness.burnForTest` cannot move or destroy a minted token. Repeat `mintForPurchase` with the same recipient, purchase ID, and URI and assert it returns the existing token ID without emitting a second transfer. Repeat with a different recipient or URI and assert `CertificateConflict`.

- [ ] **Step 2: Run the test and verify the missing-contract failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/GrowthCertificateSBT.ts`

Expected: FAIL because `GrowthCertificateSBT` does not exist.

- [ ] **Step 3: Implement the ERC-5192 interface and certificate**

Define the interface and emit `Locked(tokenId)` after `_safeMint`. Reserve token ID zero as the unmapped sentinel. Return the existing token for an identical idempotent call. `locked` calls `_requireOwned(tokenId)` before returning `true`, so a nonexistent token reverts as required by ERC-5192.

Block ownership mutations with these overrides:

```solidity
function approve(address, uint256) public pure override {
    revert Soulbound();
}

function setApprovalForAll(address, bool) public pure override {
    revert Soulbound();
}

function _update(address to, uint256 tokenId, address auth)
    internal override returns (address previousOwner)
{
    previousOwner = _ownerOf(tokenId);
    if (previousOwner != address(0)) revert Soulbound();
    return super._update(to, tokenId, auth);
}
```

`supportsInterface` returns true for `type(IERC5192).interfaceId` plus inherited ERC-721, metadata, and AccessControl interfaces.

- [ ] **Step 4: Run focused and full certificate tests**

Run:

```bash
pnpm --filter @babysteps/contracts exec hardhat test test/GrowthCertificateSBT.ts
pnpm --filter @babysteps/contracts exec hardhat test test/GrowthCertificate.ts
pnpm --filter @babysteps/contracts typecheck
```

Expected: V2 and historical V1 certificate tests pass.

- [ ] **Step 5: Update evidence status and commit**

Set ERC-5192 to `partial`: local code and tests exist, but IPFS and Sepolia deployment remain unverified. Add the SBT node to the architecture with label `现有代码，待部署`.

```bash
git add contracts/contracts/interfaces/IERC5192.sol contracts/contracts/GrowthCertificateSBT.sol contracts/contracts/test/GrowthCertificateSBTHarness.sol contracts/test/GrowthCertificateSBT.ts docs/delivery/web3-delivery-implementation-map.md docs/architecture/starbuddy-web3-architecture.mmd
git commit -m "feat: add locked growth certificate"
```

### Task 3: Implement Provider submission and Owner review

**Files:**
- Create: `contracts/contracts/TaskMarketplaceV2.sol`
- Create: `contracts/test/TaskMarketplaceV2.ts`
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`

**Interfaces:**
- Produces constructor: `TaskMarketplaceV2(address admin,address babyCoinAddress,address certificateAddress,address coordinatorAddress,uint256 vrfSubscriptionId,bytes32 vrfKeyHash,uint16 vrfRequestConfirmations,uint32 vrfCallbackGasLimit)`
- Consumes: existing `BabyCoin`, new `GrowthCertificateSBT`, and the existing VRF v2.5 compatibility interfaces
- Produces roles: `PROVIDER_ROLE` and `COMPLETION_RELAYER_ROLE`
- Produces enum: `TaskStatus { None, PendingReview, PendingRandomness, Active, Rejected }`
- Produces functions: `requestTask(address,uint8,string,bytes32)`, `approveTask(uint256)`, `rejectTask(uint256,bytes32)`, `setTaskPaused(uint256,bool)`, and `getTask(uint256)`
- Produces events: `TaskRequested`, `TaskApproved`, `TaskRejected`, `TaskRandomized`, and `TaskPauseChanged`

- [ ] **Step 1: Write failing review-state tests**

Use `MockVrfCoordinator` and assert:

```ts
await marketplace.write.requestTask([
  provider.account.address,
  1,
  "ipfs://task/walk-1",
  keccak256(toBytes("walk-1")),
], { account: provider.account });
assert.equal(task.status, 1);
assert.equal(await coordinator.read.latestRequestId(), 0n);
await marketplace.write.approveTask([taskId], { account: admin.account });
assert.equal((await marketplace.read.getTask([taskId])).status, 2);
```

Reject zero payee, empty URI, zero metadata hash, outsider submission, Provider approval, duplicate approval, rejected-task approval, unknown task, and non-Owner pause. Assert rejection stores no VRF request and emits the reason hash.

- [ ] **Step 2: Run the test and verify the missing-contract failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/TaskMarketplaceV2.ts`

Expected: FAIL because `TaskMarketplaceV2` does not exist.

- [ ] **Step 3: Implement submission and review without requesting VRF early**

`requestTask` stores Provider, payee, activity, URI, metadata hash, and `PendingReview`. `approveTask` is the only function that calls `coordinator.requestRandomWords`, stores `requestToTaskId`, changes status to `PendingRandomness`, and emits the request ID. `rejectTask` only accepts `PendingReview`.

Use a single `Task` struct with these fields:

```solidity
address provider;
address payee;
ActivityType activityType;
string metadataUri;
bytes32 metadataHash;
uint256 requestId;
uint256 price;
uint64 opensAt;
uint64 closesAt;
TaskStatus status;
bool paused;
```

- [ ] **Step 4: Add deterministic VRF boundary tests and implementation**

Test price words `0`, `1`, and `2`; test Meal at 3 and 4 hours, Walk at 8 and 12 hours, and Read at 4 and 6 hours. Reject unknown request IDs, callback from a non-coordinator, duplicate fulfillment, and fulfillment before approval.

Use the existing formula:

```solidity
uint256 price = (2 + (randomWords[0] % 3)) * 1 ether;
uint256 duration = (minimumHours + (randomWords[1] % (spanHours + 1))) * 1 hours;
```

Set `status = TaskStatus.Active` only after fulfillment.

- [ ] **Step 5: Run focused and regression tests**

Run:

```bash
pnpm --filter @babysteps/contracts exec hardhat test test/TaskMarketplaceV2.ts
pnpm --filter @babysteps/contracts exec hardhat test test/TaskMarketplace.ts
pnpm --filter @babysteps/contracts typecheck
```

Expected: V2 and V1 marketplace tests pass.

- [ ] **Step 6: Update evidence status and commit**

Set Owner/Provider review and Chainlink V2 lifecycle to `partial`: local tests pass, Sepolia evidence is not yet available.

```bash
git add contracts/contracts/TaskMarketplaceV2.sol contracts/test/TaskMarketplaceV2.ts docs/delivery/web3-delivery-implementation-map.md docs/architecture/starbuddy-web3-architecture.mmd
git commit -m "feat: add owner-reviewed task marketplace"
```

### Task 4: Implement exact purchase and idempotent completion

**Files:**
- Modify: `contracts/contracts/TaskMarketplaceV2.sol`
- Modify: `contracts/test/TaskMarketplaceV2.ts`
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`

**Interfaces:**
- Produces function: `buy(uint256 taskId) returns (uint256 purchaseId)`
- Produces function: `confirmCompletion(uint256 purchaseId,bytes32 evidenceHash,string certificateUri) returns (uint256 tokenId)`
- Produces function: `getPurchase(uint256 purchaseId) returns (Purchase)`
- Produces getter: `purchaseIdForBuyer(uint256 taskId,address buyer) returns (uint256)`
- Produces events: `PurchaseCreated`, `CompletionConfirmed`, and `CertificateMinted`

- [ ] **Step 1: Write failing exact-purchase tests**

Mint test BABY without changing `lifetimeEarned`, activate a task, approve the exact locked price, and assert the Provider receives that price. Reject pending, rejected, paused, expired, insufficient allowance, insufficient balance, and duplicate purchases. Store buyer, task ID, historical price, timestamp, completion flag, evidence hash, and certificate token ID.

```ts
assert.equal(providerAfter - providerBefore, task.price);
assert.equal(parentBefore - parentAfter, task.price);
assert.equal(await token.read.lifetimeEarned([parent.account.address]), 0n);
assert.equal(await marketplace.read.purchaseIdForBuyer([taskId, parent.account.address]), purchaseId);
```

- [ ] **Step 2: Run the purchase tests and verify failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/TaskMarketplaceV2.ts`

Expected: FAIL because V2 purchase functions do not exist.

- [ ] **Step 3: Implement exact purchase**

Use `SafeERC20.safeTransferFrom` and `nonReentrant`. Set the purchase mapping before the external token call. Do not collect a platform fee. Do not accept a price from the frontend.

- [ ] **Step 4: Write failing completion and conflict tests**

Grant `COMPLETION_RELAYER_ROLE` and certificate `MINTER_ROLE`. Confirm one purchase and assert one SBT. Repeat with identical evidence hash and URI and assert the existing token ID returns without a second `Transfer` or `CertificateMinted`. Repeat with a different evidence hash or URI and assert `CompletionConflict` or `CertificateConflict`. Reject non-relayer and unknown purchase.

- [ ] **Step 5: Implement idempotent completion**

Store `evidenceHash` before calling the SBT contract. For an already completed purchase, compare the stored hash and return the existing token only when the request is identical.

```solidity
if (purchase.completed) {
    if (purchase.evidenceHash != evidenceHash) {
        revert CompletionConflict(purchaseId);
    }
    return purchase.certificateTokenId;
}
```

Emit `CompletionConfirmed` and `CertificateMinted` only on the first successful completion.

- [ ] **Step 6: Run contract verification**

Run:

```bash
pnpm --filter @babysteps/contracts exec hardhat test test/TaskMarketplaceV2.ts
pnpm --filter @babysteps/contracts test
pnpm --filter @babysteps/contracts typecheck
pnpm --filter @babysteps/contracts check
```

Expected: all contract tests, type checks, and Biome checks pass.

- [ ] **Step 7: Update evidence status and commit**

Keep Approve/Buy `complete` because V1 has Sepolia evidence and V2 passes local regression. Set automatic SBT issuance to `partial` until V2 is deployed and IPFS resolves.

```bash
git add contracts/contracts/TaskMarketplaceV2.sol contracts/test/TaskMarketplaceV2.ts docs/delivery/web3-delivery-implementation-map.md docs/architecture/starbuddy-web3-architecture.mmd
git commit -m "feat: add idempotent marketplace settlement"
```

### Task 5: Add reproducible local and Sepolia V2 deployment graphs

**Files:**
- Create: `contracts/ignition/modules/BabyStepsWeb3V2.ts`
- Create: `contracts/ignition/modules/BabyStepsWeb3V2Local.ts`
- Create: `contracts/test/babysteps-web3-v2-module.test.ts`
- Create: `contracts/ignition/parameters/babysteps-web3-v2.sepolia.example.json`
- Modify: `contracts/package.json`
- Modify: `web/.env.example`
- Modify: `docs/delivery/web3-delivery-implementation-map.md`

**Interfaces:**
- Produces Ignition results: `babyCoin`, `growthCertificateSBT`, and `taskMarketplaceV2`
- Produces scripts: `deploy:web3:v2:local`, `deploy:web3:v2:sepolia`, and `deploy:web3:v2:verify:sepolia`
- Consumes public parameters: `admin`, `babyCoinAddress`, `vrfCoordinator`, `vrfSubscriptionId`, `vrfKeyHash`, `vrfRequestConfirmations`, and `vrfCallbackGasLimit`

- [ ] **Step 1: Write failing module contract tests**

Assert the production module attaches to `BabyCoin` with `m.contractAt`, deploys only the SBT and Marketplace V2, and grants only `MINTER_ROLE` to the marketplace. Assert the local module deploys BabyCoin and MockVrfCoordinator. Assert no module grants Provider or Relayer roles to arbitrary addresses.

Also assert `web/.env.example` contains:

```text
VITE_GROWTH_CERTIFICATE_SBT_ADDRESS=
VITE_TASK_MARKETPLACE_V2_ADDRESS=
```

- [ ] **Step 2: Run and verify the missing-module failure**

Run: `pnpm --filter @babysteps/contracts exec hardhat test test/babysteps-web3-v2-module.test.ts`

Expected: FAIL because the V2 modules do not exist.

- [ ] **Step 3: Implement both deployment graphs**

The production module uses `m.contractAt("BabyCoin", babyCoinAddress)` and deploys V2 contracts. The local module deploys a fresh local BabyCoin and MockVrfCoordinator so tests never depend on Sepolia.

Grant only this cross-contract role in the module:

```ts
const minterRole = m.staticCall(growthCertificateSBT, "MINTER_ROLE", [], 0, {
  id: "ReadV2MinterRole",
});
m.call(growthCertificateSBT, "grantRole", [minterRole, taskMarketplaceV2], {
  id: "GrantV2MinterRoleToMarketplace",
});
```

Provider and Relayer grants remain explicit post-deployment admin actions with evidence.

- [ ] **Step 4: Add safe scripts and parameter example**

Add package scripts with the V2 module and parameter path. The example parameter file uses the verified Sepolia BabyCoin address and public Chainlink coordinator/key hash, but uses string `0` for the subscription ID. It contains no RPC URL, private key, deploy key, or account credential.

- [ ] **Step 5: Run the local deployment and inspect addresses**

Run:

```bash
pnpm --filter @babysteps/contracts exec hardhat ignition deploy ignition/modules/BabyStepsWeb3V2Local.ts
pnpm --filter @babysteps/contracts exec hardhat test test/babysteps-web3-v2-module.test.ts
```

Expected: in-memory local deployment succeeds and the module test passes. Do not pass `--reset`: Hardhat 3 rejects reset on an ephemeral network because it has no persistent deployment state. Record local addresses only in test output, not public deployment evidence.

- [ ] **Step 6: Commit deployment support**

```bash
git add contracts/ignition/modules/BabyStepsWeb3V2.ts contracts/ignition/modules/BabyStepsWeb3V2Local.ts contracts/test/babysteps-web3-v2-module.test.ts contracts/ignition/parameters/babysteps-web3-v2.sepolia.example.json contracts/package.json web/.env.example docs/delivery/web3-delivery-implementation-map.md
git commit -m "build: add web3 v2 deployment graphs"
```

### Task 6: Close the phase 1 verification gate

**Files:**
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`
- Create: `docs/evidence/testing/2026-08-10-web3-v2-contracts.md`

**Interfaces:**
- Produces phase evidence with exact commands, pass counts, commit hashes, and a truthful “not deployed” statement
- Produces the input contract for the Worker/Privy phase

- [ ] **Step 1: Run the full repository gate**

Run:

```bash
pnpm test
pnpm typecheck
pnpm check
pnpm build
pnpm validate:delivery-evidence
git diff --check
```

Expected: every command exits 0. If any command fails, mark the affected map row `blocked` and do not claim phase completion.

- [ ] **Step 2: Record exact local evidence**

Write the command, exit result, contract test count, build result, and commit hashes to `docs/evidence/testing/2026-08-10-web3-v2-contracts.md`. State explicitly:

```text
Sepolia V2 deployment: pending
Cloud resources created in phase 1: none
Production deployment changed in phase 1: no
```

- [ ] **Step 3: Reconcile the map and architecture**

Confirm every V2 local code row points to an existing file and test. Keep all external services `pending`. Mark V2 contracts `partial` until Sepolia addresses and transactions exist.

- [ ] **Step 4: Run the public-content scan and commit evidence**

Run:

```bash
pnpm validate:public-copy
pnpm validate:delivery-evidence
git diff --check
```

Expected: all commands exit 0 and no credential pattern or private path appears.

```bash
git add docs/delivery/web3-delivery-implementation-map.md docs/architecture/starbuddy-web3-architecture.mmd docs/evidence/testing/2026-08-10-web3-v2-contracts.md
git commit -m "docs: record web3 v2 contract evidence"
```

## Phase completion checkpoint

Phase 1 is complete only when V2 contracts pass local tests, the deployment graph succeeds locally, and the implementation map distinguishes local proof from pending Sepolia proof. The next plan covers Worker/D1, Privy email and external wallet login, username updates, comments, metadata binding, and signed completion requests.

## Execution handoff

Execute this plan inline in the current task with `superpowers:executing-plans`. Do not dispatch subagents unless the user explicitly requests delegation. Stop at the Phase 1 checkpoint before any Sepolia, Cloudflare, AWS, IPFS, or The Graph write operation.
