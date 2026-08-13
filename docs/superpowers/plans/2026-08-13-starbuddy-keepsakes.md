# StarBuddy Keepsakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested Sepolia-ready keepsake draw and fusion loop that spends transferable growth stars and renders the approved Stitch experience.

**Architecture:** Extend `OnchainNotebook` with a narrowly authorized debit/refund boundary, deploy an enumerable soulbound keepsake token, and coordinate Chainlink VRF draw/fusion requests in a separate contract. The React page reads those contracts through wagmi, keeps business decisions in pure model functions, and renders one responsive component tree with a reduced-motion terminal animation.

**Tech Stack:** Solidity 0.8.28, OpenZeppelin 5.6.1, Chainlink VRF v2.5-compatible local interfaces, Hardhat 3, viem, React 19, wagmi 3, Vitest, CSS.

## Global Constraints

- Draw costs exactly 12 transferable growth stars; fusion costs zero growth stars.
- Draw rarity is 70/22/7/1 for 普通/稀有/星耀/典藏.
- Fusion requires three caller-owned tokens with identical series and rarity.
- Fusion succeeds at 100/70/40 percent; 典藏 cannot fuse.
- Failure burns one VRF-selected parent and unlocks the other two.
- Recovery is available only after 24 hours and late callbacks are ignored.
- Keepsakes are ERC-5192 soulbound and expose no transfer or resale path.
- Public metadata contains no child or family-private data.
- UI supports 375, 390, 430, and 1440 px without root overflow; touch targets are at least 44 px.
- Branch names, code, commits, and public copy must not contain model-provider names or project-course labels prohibited by repository policy.

---

### Task 1: Authorized transferable-star spending

**Files:**
- Modify: `contracts/contracts/OnchainNotebook.sol`
- Modify: `contracts/test/OnchainNotebook.ts`
- Modify: `contracts/ignition/modules/OnchainNotebook.ts`

**Interfaces:**
- Produces: `setGrowthStarConsumer(address,bool)`, `spendTransferableBalance(address,uint256)`, and `refundTransferableBalance(address,uint256)`.
- Preserves: `getGrowthPoints`, `getGrowthStage`, transfers, notes, activity rewards, and the no-argument deployment constructor.

- [ ] **Step 1: Write failing authorization and accounting tests**

Test that the deployer can authorize one consumer, unauthorized wallets cannot debit or refund, an authorized consumer can spend exactly 12 stars, refunds restore transferable balance only, and lifetime growth remains unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @babysteps/contracts test -- OnchainNotebook.ts`

Expected: failure because the consumer functions do not exist.

- [ ] **Step 3: Implement the minimum consumer boundary**

Add an immutable admin, allowlist mapping, explicit authorization/error events, and checks for zero consumer, zero amount, and insufficient transferable balance. Do not add ERC-20 approvals or alter lifetime growth.

- [ ] **Step 4: Run focused tests and contract checks**

Run:

```bash
pnpm --filter @babysteps/contracts test -- OnchainNotebook.ts
pnpm --filter @babysteps/contracts typecheck
```

Expected: all focused tests pass with no type errors.

### Task 2: Enumerable StarBuddy keepsake SBT

**Files:**
- Create: `contracts/contracts/StarBuddyKeepsakeSBT.sol`
- Create: `contracts/test/StarBuddyKeepsakeSBT.ts`

**Interfaces:**
- Produces: `mint(address,uint8,uint8) returns (uint256)`, `burnFrom(address,uint256)`, `getKeepsake(uint256) returns (uint8 series,uint8 rarity)`, enumerable owner reads, and deterministic token URIs.
- Consumes: coordinator granted `MINTER_ROLE` and `BURNER_ROLE`.

- [ ] **Step 1: Write failing SBT behavior tests**

Test role-gated mint/burn, four valid series and rarities, deterministic URI, owner enumeration, ERC-5192 `locked`, and rejection of transfer/approval.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @babysteps/contracts test -- StarBuddyKeepsakeSBT.ts`

Expected: failure because the contract artifact is missing.

- [ ] **Step 3: Implement the minimal SBT**

Compose `ERC721Enumerable`, `ERC721URIStorage`, `AccessControl`, and `IERC5192`. Store only series and rarity; derive metadata URI from a constructor-provided base URI and canonical `series-rarity.json` suffix.

- [ ] **Step 4: Run focused tests, compile, and typecheck**

Run:

```bash
pnpm --filter @babysteps/contracts test -- StarBuddyKeepsakeSBT.ts
pnpm --filter @babysteps/contracts compile
pnpm --filter @babysteps/contracts typecheck
```

### Task 3: VRF draw, fusion, and recovery coordinator

**Files:**
- Create: `contracts/contracts/StarBuddyKeepsakes.sol`
- Create: `contracts/contracts/interfaces/ITransferableGrowthStars.sol`
- Create: `contracts/test/StarBuddyKeepsakes.ts`
- Create: `contracts/ignition/modules/StarBuddyKeepsakesLocal.ts`
- Create: `contracts/ignition/modules/StarBuddyKeepsakesSepolia.ts`
- Create: `contracts/test/starbuddy-keepsakes-module.test.ts`
- Modify: `contracts/package.json`
- Modify: `contracts/ignition/parameters/babysteps-web3-v2.sepolia.example.json`
- Modify: `web/.env.example`

**Interfaces:**
- Produces: `requestDraw()`, `requestFusion(uint256[3])`, `recover(uint256)`, `getRequest(uint256)`, `latestRequestIdByOwner(address)`, and `isTokenLocked(uint256)`.
- Consumes: `ITransferableGrowthStars`, `StarBuddyKeepsakeSBT`, and `IVRFCoordinatorV2Plus`.

- [ ] **Step 1: Write failing end-to-end coordinator tests**

Cover exact draw debit, rarity boundary words, independent series selection, fusion eligibility, Common success, Rare/Super Rare success and failure, deterministic failed-parent selection, token locks, 24-hour draw refund, 24-hour fusion unlock, and ignored late callbacks.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @babysteps/contracts test -- StarBuddyKeepsakes.ts`

Expected: failure because the coordinator does not exist.

- [ ] **Step 3: Implement request state and VRF settlement**

Use two random words, explicit request kind/status enums, checks-effects-interactions, `ReentrancyGuard`, immutable VRF configuration, and terminal events containing concrete token IDs. Recovery changes status before external refund/unlock effects; callbacks return immediately unless status is `Pending`.

- [ ] **Step 4: Add local and Sepolia Ignition modules**

The modules deploy the SBT and coordinator, grant mint/burn roles, authorize the coordinator in `OnchainNotebook`, and expose only public parameters. The Sepolia module attaches to a configured notebook address and uses the existing VRF coordinator/key hash pattern.

- [ ] **Step 5: Run coordinator/module tests and full contract suite**

Run:

```bash
pnpm --filter @babysteps/contracts test -- StarBuddyKeepsakes.ts
pnpm --filter @babysteps/contracts test -- starbuddy-keepsakes-module.test.ts
pnpm --filter @babysteps/contracts test
pnpm --filter @babysteps/contracts check
pnpm --filter @babysteps/contracts typecheck
```

### Task 4: Responsive keepsake gallery and dynamic result UI

**Files:**
- Create: `web/src/features/keepsakes/keepsakeModel.ts`
- Create: `web/src/features/keepsakes/keepsakeModel.test.ts`
- Create: `web/src/features/keepsakes/StarBuddyKeepsakeCard.tsx`
- Create: `web/src/features/keepsakes/StarBuddyKeepsakeCard.test.tsx`
- Create: `web/src/features/keepsakes/useKeepsakes.ts`
- Create: `web/src/features/keepsakes/useKeepsakes.test.tsx`
- Create: `web/src/pages/KeepsakeGalleryPage.tsx`
- Create: `web/src/pages/KeepsakeGalleryPage.test.tsx`
- Modify: `web/src/contracts/onchainNotebook.ts`
- Modify: `web/src/contracts/web3Contracts.ts`
- Modify: `web/src/components/ProductNavigation.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Produces: `KeepsakeGalleryPage`, pure rarity/fusion helpers, wallet transaction phases, pending recovery, and terminal success/failure view models.
- Consumes: notebook address/ABI, optional keepsake contract addresses, wagmi reads/writes, and the existing `StarBuddy` character component.

- [ ] **Step 1: Write failing pure-model tests**

Test Chinese rarity labels, 70/22/7/1 copy, exact three-token eligibility, mixed-series/mixed-rarity/Collector rejection, 100/70/40 rates, and token-ID confirmation text.

- [ ] **Step 2: Run model tests and verify RED**

Run: `pnpm --filter @babysteps/web test -- keepsakeModel.test.ts`

- [ ] **Step 3: Implement model and card components**

Build typed, data-driven cards that reuse the four StarBuddy stages and add rarity-specific holographic treatments without relying on color alone.

- [ ] **Step 4: Write failing hook/page tests**

Test truthful unconfigured state, 12-star draw action, pending VRF evidence, three-slot selection, failure warning, terminal consumed/burned/unlocked IDs, one-shot success animation, and visible reduced-motion fallback.

- [ ] **Step 5: Implement wagmi hook, page, navigation, and styles**

Parse the latest request after transaction confirmation, invalidate balance/token reads, keep animation state separate from chain status, and render the approved Stitch hierarchy. Do not include demo balances or fabricated hashes.

- [ ] **Step 6: Run frontend checks**

Run:

```bash
pnpm --filter @babysteps/web test
pnpm --filter @babysteps/web typecheck
pnpm --filter @babysteps/web check
pnpm --filter @babysteps/web build
```

### Task 5: Evidence, architecture, and release gates

**Files:**
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `docs/architecture/starbuddy-web3-global-architecture.svg`
- Modify: `docs/architecture/starbuddy-web3-business-sequence.svg`
- Create: `docs/evidence/testing/2026-08-13-starbuddy-keepsakes.md`
- Create: `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/README.md`
- Modify: `scripts/validate-delivery-evidence.mjs`
- Modify: `scripts/validate-delivery-evidence.test.mjs`
- Update: `.tc-flow/**`

**Interfaces:**
- Produces: requirement-to-code-to-proof mapping, true implementation status, responsive proof assets, and TC Flow run result.

- [ ] **Step 1: Add failing Evidence gate expectations**

Require the keepsake architecture path, draw/fusion/recovery sequence, code mapping, contract/frontend test proof, and real desktop/mobile screenshot assets. Do not mark Sepolia deployment verified without real addresses and transactions.

- [ ] **Step 2: Run Evidence gate and verify RED**

Run: `node --test scripts/validate-delivery-evidence.test.mjs`

- [ ] **Step 3: Update diagrams, mapping, and test evidence**

Add the notebook authorization boundary, VRF request/callback, SBT mint/burn, late-callback ignore path, frontend pending/terminal states, and reduced-motion path. Label cloud deployment as pending until externally verified.

- [ ] **Step 4: Run local responsive preview and capture evidence**

Capture truthful 1440 px and 390 px screenshots after local build. Each README entry states what to inspect and what it proves.

- [ ] **Step 5: Run the full repository gate**

Run:

```bash
pnpm test
pnpm typecheck
pnpm check
pnpm build
pnpm validate:public-artifact
git diff --check
```

- [ ] **Step 6: Run TC Flow Review, QA, and repository policy**

Save sanitized task reviews and Feature QA under `.tc-flow/`, stage only the Feature files, and run the central repository policy with `web/dist` as the public build output. Commit and push only on `ALLOW`.

