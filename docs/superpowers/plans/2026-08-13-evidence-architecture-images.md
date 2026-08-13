# Evidence Architecture Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish accurate StarBuddy-themed global architecture and core business sequence images, and make local plus GitHub gates reject incomplete Evidence.

**Architecture:** Keep `docs/architecture/starbuddy-web3-architecture.mmd` as the engineering truth source. Add deterministic SVG image sources with exact Chinese labels and exportable dimensions, consume the images on the Evidence page with adjacent walkthroughs, then extend the existing delivery validator so the same contract runs locally and through the shared GitHub workflow.

**Tech Stack:** SVG, React, TypeScript, CSS, Node.js validators, Node test runner, Vitest, Vite, GitHub Actions reusable workflow.

## Global Constraints

- Final deliverables must be directly viewable, zoomable image assets; Mermaid code alone is insufficient.
- The global image must cover runtime/data flow, storage/external services, CI/CD, security boundaries, failure/rollback, and lifecycle/cleanup.
- The sequence image must cover Provider request, Owner approval, VRF, approve/buy/transferFrom, completion, SBT, independent readback, and bounded failure paths.
- Images and copy must distinguish verified, pending verification, planned/deferred, and fallback paths.
- Do not copy the reference project's images or claim its Foundry, EC2, Sale, oracle, or AWS implementation as BabySteps evidence.
- Do not publish credentials, full RPC URLs, cookies, wallet secrets, personal data, or private infrastructure endpoints.
- Production release is outside this plan.

---

### Task 1: Lock the strict delivery contract with failing tests

**Files:**
- Modify: `scripts/validate-delivery-evidence.test.mjs`
- Modify: `scripts/validate-delivery-evidence.mjs`

**Interfaces:**
- Consumes: `validateDeliveryEvidence(mapText, architectureText, workerEvidenceText, evidencePageText?, assetFacts?)`.
- Produces: deterministic validation errors for missing sections, diagrams, page references, accessibility copy, and assets.

- [ ] **Step 1: Write failing tests**

Add fixtures containing a complete architecture, a public Evidence page that imports both image assets, and asset facts with positive byte sizes. Add negative cases for missing `sequenceDiagram`, missing failure/cleanup sections, one-image-only Evidence, missing walkthrough labels, and absent/empty assets.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/validate-delivery-evidence.test.mjs`

Expected: new strict-contract tests fail because the current validator does not inspect public Evidence or image assets.

- [ ] **Step 3: Implement the strict contract**

Extend the validator with required architecture sections and markers. The CLI reads `web/src/pages/EvidencePage.tsx` plus the two expected image paths, converts them to `{ path, exists, bytes }`, and passes those facts into the pure validator.

- [ ] **Step 4: Verify GREEN**

Run: `node --test scripts/validate-delivery-evidence.test.mjs`

Expected: all validator tests pass while existing mapping and Worker/D1 checks remain active.

- [ ] **Step 5: Commit independently**

Stage only the validator and validator tests, then commit with a human-authored conventional message.

---

### Task 2: Create the image deliverables

**Files:**
- Create: `docs/architecture/starbuddy-web3-global-architecture.svg`
- Create: `docs/architecture/starbuddy-web3-business-sequence.svg`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`

**Interfaces:**
- Consumes: verified states and boundaries from the existing Mermaid truth source and deployment Evidence.
- Produces: two 1600×1000 responsive SVG images with stable filenames and accessible `<title>`/`<desc>` metadata.

- [ ] **Step 1: Create the global architecture image**

Use a cream-paper StarBuddy palette and four clearly bounded lanes: user/runtime, Cloudflare/data, Sepolia/external reads, and delivery/AWS. Add a status legend and explicit failure/cleanup lane. Include only shortened public contract addresses.

- [ ] **Step 2: Create the business sequence image**

Use actors for Provider, React/Wallet, Worker/D1, Owner, Marketplace V2, VRF, Relayer/SBT, and Graph/RPC. Number the happy path and include bounded side branches for metadata conflict, VRF pending, allowance failure, failed receipt, and idempotent completion replay.

- [ ] **Step 3: Reconcile the truth source**

Update stale statements in the Mermaid document, especially the old overview-image status and public diagram inventory. Do not mark Privy login, IPFS pin, or production KMS Relayer complete without external proof.

- [ ] **Step 4: Validate images**

Parse both SVG files as text, verify `viewBox`, `<title>`, `<desc>`, required labels, and nonzero byte size. Visually inspect at desktop width and at 390 px with zoom/open-original behavior.

- [ ] **Step 5: Commit independently**

Stage the two SVG images and truth-source update, then commit.

---

### Task 3: Publish both images on the Evidence page

**Files:**
- Modify: `web/src/pages/EvidencePage.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/src/App.test.tsx`
- Modify: `docs/evidence/README.md`

**Interfaces:**
- Consumes: `starbuddy-web3-global-architecture.svg` and `starbuddy-web3-business-sequence.svg`.
- Produces: two semantic `<figure>` sections, open-original links, adjacent walkthroughs, status legend, and mobile-readable overflow/zoom behavior.

- [ ] **Step 1: Write the failing UI test**

Assert two named figures exist, both images have descriptive alt text, both “查看原图” links target the imported assets, and each section contains “看哪里” and “证明什么”.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @babysteps/web test -- App.test.tsx`

Expected: fail because the current page contains one image and no sequence walkthrough.

- [ ] **Step 3: Implement the Evidence layout**

Replace the old single overview with a diagram gallery. Use intrinsic width/height, lazy loading, semantic captions, explanatory cards, and a scrollable frame that preserves legibility on narrow screens.

- [ ] **Step 4: Verify GREEN and responsive behavior**

Run the focused Vitest file, build the Web app, open the Evidence page at 390 and 1440 px, and confirm no root horizontal overflow. The diagram frame may scroll internally.

- [ ] **Step 5: Update Evidence learning path and commit**

Link the two public images and the Mermaid truth source from `docs/evidence/README.md`, then commit the page, styles, tests, and documentation.

---

### Task 4: Wire the same gate locally and remotely, then complete verification

**Files:**
- Verify: `package.json`
- Verify: `.github/workflows/verify-baby2b-project.yml`
- Modify only if needed: `.github/workflows/verify-baby2b-project.yml`
- Create: `docs/evidence/testing/2026-08-13-architecture-evidence-gate.md`

**Interfaces:**
- Consumes: `pnpm validate:delivery-evidence` from the root package.
- Produces: identical local and GitHub enforcement plus a verifiable result record.

- [ ] **Step 1: Prove local wiring**

Run `pnpm validate:delivery-evidence` and confirm it reads the architecture truth source, Evidence page, and both images.

- [ ] **Step 2: Prove repository wiring**

Confirm `.github/workflows/verify-baby2b-project.yml` passes `pnpm validate:delivery-evidence` to `Tiancheng-Xu/.github/.github/workflows/verify-project.yml@main`. Change YAML only if that invocation is absent.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm check
pnpm test
pnpm typecheck
pnpm --filter @babysteps/web build
pnpm validate:public-artifact
git diff --check
```

Expected: all commands exit 0. Existing accessibility-only CSS warnings and third-party chunk-size warnings may remain documented if nonblocking.

- [ ] **Step 4: Record Evidence**

Write the requirement → implementation → code → proof → status mapping, image byte sizes and SHA-256, local command results, remote workflow path, limitations, and reproduction commands.

- [ ] **Step 5: Final review and commit**

Review the complete diff for stale claims, secrets, private paths, broken links, and reference-project copying. Commit the final Evidence record. Do not push or deploy production without separate authorization.
