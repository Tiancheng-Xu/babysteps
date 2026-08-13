# BabyCoin Balance Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BabyCoin balances readable across desktop and mobile without changing onchain precision or transaction behavior.

**Architecture:** Add one pure display formatter for 18-decimal BABY amounts, then render number and unit as separate semantic elements in the growth panel. Reuse the formatter in other user-facing BABY balances and validate the layout at the repository's required responsive widths.

**Tech Stack:** React 19, TypeScript, viem, Vitest, Testing Library, CSS.

## Global Constraints

- Display at most 4 fractional digits and trim trailing zeros.
- Never use the shortened display value for transactions or validation.
- Preserve the exact formatted token value in accessible supporting text and `title`.
- Validate 375, 390, 430, and 1440 px without root horizontal overflow.
- Do not change Solidity, Worker, AWS, or Cloudflare configuration.

---

### Task 1: BABY display formatter

**Files:**
- Create: `web/src/features/babycoin/formatBabyCoinAmount.ts`
- Create: `web/src/features/babycoin/formatBabyCoinAmount.test.ts`

**Interfaces:**
- Produces: `formatBabyCoinAmount(value: bigint | undefined): { display: string; exact?: string; isApproximate: boolean }`

- [ ] Write tests for undefined, integer, long fractional, trailing zeros, and a non-zero value below 4 decimal places.
- [ ] Run the focused test and verify RED because the formatter does not exist.
- [ ] Implement integer-safe rounding using bigint arithmetic; do not convert token values through JavaScript `number`.
- [ ] Run the focused test and verify GREEN.

### Task 2: Growth balance hierarchy and meaning

**Files:**
- Modify: `web/src/features/babycoin/BabyCoinGrowthPanel.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `formatBabyCoinAmount` from Task 1.

- [ ] Add failing UI assertions for separate amount/unit nodes, exact-value support, and the two balance explanations.
- [ ] Run the focused web test and verify RED on missing semantics.
- [ ] Render the number, unit, and explanation as separate elements and add stable accessible names.
- [ ] Add tabular numeric styling, safe wrapping, and responsive one-column/two-column rules.
- [ ] Run the focused web test and verify GREEN.

### Task 3: Reuse and verification

**Files:**
- Modify: `web/src/features/marketplace/MarketplaceTaskCard.tsx`
- Modify: `web/src/pages/ExchangePage.tsx` if its quoted value is an 18-decimal raw token amount.
- Modify: related focused tests only when the rendered contract changes.

**Interfaces:**
- Consumes: the same formatter from Task 1.

- [ ] Audit all user-facing BABY amount renderers and reuse the formatter only where input is a raw 18-decimal bigint.
- [ ] Run web tests, type check, build, and public artifact validation.
- [ ] Inspect 375, 390, 430, and 1440 px; assert zero root horizontal overflow and capture one sanitized proof image.
- [ ] Run `git diff --check` and report remaining unrelated working-tree changes separately.
