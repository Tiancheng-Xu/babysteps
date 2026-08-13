# Expanded Architecture Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the compact BabySteps architecture and sequence images with truthful expanded versions and lock their content, page walkthrough, and responsive Evidence into local and GitHub gates.

**Architecture:** Keep the existing two public asset paths so Evidence links remain stable. First make the validator and page demand the expanded information architecture, then replace both deterministic SVGs, and finally regenerate desktop/mobile visual proof from the production build.

**Tech Stack:** React, TypeScript, deterministic SVG, Node test runner, Vitest, Vite, Biome, in-app browser responsive verification.

## Global Constraints

- Work directly in `/Users/shier/Desktop/babysteps`; do not create or switch worktrees.
- Preserve StarBuddy cream/gold/sage/navy visual language and accurate Chinese labels.
- Do not modify contracts, Worker, D1, AWS resources, Cloudflare production configuration, or external services.
- Do not mark AWS KMS Relayer, IPFS pin, or another unverified capability as complete.
- Keep the existing asset paths and public Evidence navigation.
- No push or production deployment without a later explicit authorization.

---

### Task 0: Pre-drawing Whole-project Baseline

**Files:**
- Verify only: repository HEAD before expanded-image implementation

**Interfaces:**
- Consumes: current committed repository state.
- Produces: a fresh green baseline proving SVG work starts from a verified project rather than masking an existing failure.

- [ ] **Step 1: Run the complete repository baseline**

Run: `pnpm check`, `pnpm test`, `pnpm typecheck`, `pnpm --filter @babysteps/web build`, `pnpm validate:public-artifact`, and `git diff --check`.

Expected: zero failures before any SVG content is changed. Existing reduced-motion and third-party bundle-size warnings remain non-blocking only if their commands exit successfully.

- [ ] **Step 2: Run repository policy against the committed candidate**

Run the central repository-policy audit with `--require-caller`.

Expected: policy passes. If either baseline step fails, stop and repair the project before updating or drawing SVGs.

### Task 1: Expanded Evidence Contract and Walkthrough

**Files:**
- Modify: `scripts/validate-delivery-evidence.test.mjs`
- Modify: `scripts/validate-delivery-evidence.mjs`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/pages/EvidencePage.tsx`

**Interfaces:**
- Consumes: existing `validateDeliveryEvidence(...)` and the two stable SVG imports.
- Produces: a Gate that reads SVG text and rejects missing expanded-view markers; Evidence copy that teaches six columns/four bands and five business phases.

- [ ] **Step 1: Write failing validator tests**

Add asset facts containing `text`, `width`, and `height`. Assert rejection when the global image omits `用户与角色`, `Cloudflare`, `Ethereum Sepolia`, `Web3 外部依赖`, `交付与 AWS`, or the protocol legend, and when the sequence omits `登录会话`, `Uniswap 获得 BABY`, `Provider 上架与 Owner 审核`, `家长购买结算`, or `完课与证书`.

- [ ] **Step 2: Run the validator tests and verify RED**

Run: `node --test scripts/validate-delivery-evidence.test.mjs`

Expected: new expanded-image tests fail because asset facts currently expose only existence and byte size.

- [ ] **Step 3: Implement the minimal validator contract**

Extend `readAssetFact()` to read each SVG as UTF-8 and extract its declared `width` and `height`. Validate a minimum 2200 × 1400 global canvas, a minimum 2200 × 1600 sequence canvas, and exact marker arrays for both images.

- [ ] **Step 4: Write the failing Evidence page test**

Require the page to mention `六列责任边界`, `四条数据带`, `五段完整闭环`, `登录与会话`, `Uniswap 获币`, `上架与审核`, `购买与结算`, and `完课与证书`.

- [ ] **Step 5: Run the page test and verify RED**

Run: `pnpm --filter @babysteps/web test -- App.test.tsx`

Expected: the new copy assertions fail against the current compact walkthrough.

- [ ] **Step 6: Update Evidence copy and intrinsic dimensions**

Update the two cards to explain the expanded reading order. Set final intrinsic dimensions to the SVG canvases selected in Task 2. Keep both original-image links and accurate `alt` text.

- [ ] **Step 7: Run focused tests and verify GREEN for page behavior**

Run: `pnpm --filter @babysteps/web test -- App.test.tsx`

Expected: all frontend tests pass; the validator remains RED only because the old compact SVGs have not yet been replaced.

- [ ] **Step 8: Commit the page and Gate contract**

Commit message: `test: require expanded architecture evidence`

At this checkpoint the validator unit tests and frontend tests must be GREEN, while `pnpm validate:delivery-evidence` must fail only on the old SVG markers/dimensions. That intentional RED proves the new Gate can detect the compact images; it is the sole accepted failure before Task 2.

### Task 2: Deterministic Expanded SVGs

**Files:**
- Modify: `docs/architecture/starbuddy-web3-global-architecture.svg`
- Modify: `docs/architecture/starbuddy-web3-business-sequence.svg`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`

**Interfaces:**
- Consumes: the marker and canvas contract established in Task 1.
- Produces: exact-text vector images that the build can bundle without raster text artifacts.

- [ ] **Step 1: Draw the expanded global architecture SVG**

Use a 2400 × 1500 canvas with six responsibility columns, four horizontal data bands, explicit HTTPS/signature/JSON-RPC/GraphQL/event/OIDC arrows, status badges, failure/rollback strip, and a StarBuddy visual anchor.

- [ ] **Step 2: Run the validator and confirm only the sequence asset remains RED**

Run: `pnpm validate:delivery-evidence`

Expected: global-image errors disappear; sequence markers/dimensions still fail.

- [ ] **Step 3: Draw the expanded business lifecycle SVG**

Use a 2400 × 1800 canvas with five numbered phases: login/session, Uniswap BABY acquisition, Provider/Owner/VRF review, exact approval and purchase, completion/SBT/index readback. Show bounded failure branches under their owning phase.

- [ ] **Step 4: Align the Mermaid truth source**

Update `starbuddy-web3-architecture.mmd` so its responsibilities, status markers, protocols, and phase names match the SVGs exactly.

- [ ] **Step 5: Run the validator and verify GREEN**

Run: `node --test scripts/validate-delivery-evidence.test.mjs && pnpm validate:delivery-evidence`

Expected: all validator tests pass and the repository Evidence contract reports `ok`.

- [ ] **Step 6: Render and visually inspect both SVGs**

Render temporary PNG previews outside the repository. Check exact text, arrow direction, clipping, legend clarity, color contrast, and truthful status labels.

- [ ] **Step 7: Commit the expanded SVGs**

Commit message: `docs: expand architecture and lifecycle diagrams`

### Task 3: Final Responsive Evidence and Verification

**Files:**
- Replace: `docs/evidence/screenshots/2026-08-13-architecture-gate/evidence-architecture-desktop-1440.jpg`
- Replace: `docs/evidence/screenshots/2026-08-13-architecture-gate/evidence-architecture-mobile-390.jpg`
- Modify: `docs/evidence/testing/2026-08-13-architecture-evidence-gate.md`
- Modify: `docs/evidence/README.md`

**Interfaces:**
- Consumes: the production build containing the final expanded SVGs.
- Produces: final screenshots, byte counts/SHA-256, responsive measurements, and an updated requirement-to-evidence mapping.

- [ ] **Step 1: Build and start a local production preview**

Run: `pnpm --filter @babysteps/web build`, then serve `web/dist` through Vite preview.

- [ ] **Step 2: Verify desktop layout and capture 1440 × 900**

Confirm root `scrollWidth === clientWidth`; the image fits the card and original-image link is present. Replace the desktop Evidence screenshot.

- [ ] **Step 3: Verify mobile layout and capture 390 × 844**

Confirm root `scrollWidth === clientWidth === 390`; the diagram frame, rather than the page root, owns horizontal scrolling. Replace the mobile Evidence screenshot.

- [ ] **Step 4: Update asset inventory and walkthrough**

Record final SVG and screenshot dimensions, byte counts, SHA-256, “看哪里 / 证明什么,” RED/GREEN evidence, and the explicit no-production-deploy boundary.

- [ ] **Step 5: Run the complete final gate**

Run: `pnpm check`, `pnpm test`, `pnpm typecheck`, `pnpm --filter @babysteps/web build`, `pnpm validate:public-artifact`, `git diff --check`, and the central repository-policy audit against the complete staged candidate.

Expected: zero failures. Existing reduced-motion `!important` warnings and third-party Privy chunk-size warnings may remain documented as non-blocking.

- [ ] **Step 6: Commit the final Evidence proof**

Commit message: `docs: verify expanded architecture evidence`
