# BabySteps End-to-End Data Flow Architecture Implementation Plan

> **For agentic workers:** Execute inline in the current repository. Do not create or switch worktrees. Do not push or deploy until the user approves the local preview.

**Goal:** Expand the two Evidence SVGs into traceable end-to-end engineering diagrams without adding unimplemented services.

**Architecture:** Keep the existing six ownership columns and status vocabulary. Add consistent numbered flows for authentication, token acquisition, task activation, purchase settlement, completion/certificate, plus a separate delivery lifecycle.

**Tech Stack:** SVG, React, TypeScript, Node validation scripts, Vitest, Vite.

## Global Constraints

- Preserve verified/planned boundaries.
- Match real code and Sepolia evidence.
- Keep original-image links and mobile horizontal viewing.
- Local preview only in this iteration.

### Task 1: Contract Gate

**Files:**
- Modify: `scripts/validate-delivery-evidence.mjs`
- Modify: `scripts/validate-delivery-evidence.test.mjs`

- [ ] Add failing fixtures for missing numbered flows and settlement details.
- [ ] Require five business flows, the delivery flow, core methods, and failure outcomes.
- [ ] Run focused validator tests.

### Task 2: Expanded SVGs and Walkthrough

**Files:**
- Modify: `docs/architecture/starbuddy-web3-global-architecture.svg`
- Modify: `docs/architecture/starbuddy-web3-business-sequence.svg`
- Modify: `web/src/pages/EvidencePage.tsx`

- [ ] Add cross-layer numbered paths and protocol/data labels to the global diagram.
- [ ] Expand exchange and purchase phases into explicit quote/approve/router/pool/receipt and allowance/buy/transferFrom/event/readback steps.
- [ ] Connect actual failure branches to their originating steps.
- [ ] Update the Evidence walkthrough and legend.

### Task 3: Local Verification

**Files:**
- Verify: `web/dist/**`

- [ ] Run validator tests and the Evidence Gate.
- [ ] Run project checks, tests, type checks, and production build.
- [ ] Inspect the SVGs and Evidence page at desktop and mobile sizes.
- [ ] Open the local Evidence page for user review without pushing or deploying.
