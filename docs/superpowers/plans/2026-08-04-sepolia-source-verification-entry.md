# Sepolia Source Verification Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible, safe link from the BabySteps product page to the verified Sepolia contract source on Etherscan.

**Architecture:** Extend the existing footer evidence card instead of adding a new navigation or wallet control. Reuse the shared `explorer-link` style and protect the behavior with the existing app-level React test.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing CSS design system

## Global Constraints

- The link text is `在 Sepolia 查看已验证源码`.
- The destination is `https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code`.
- The link opens in a new tab with `rel="noreferrer"`.
- Reuse `explorer-link`; do not add a new component, dependency, wallet action, chain selector, or credential channel.
- Keep the product page free of public-facing training or assignment language.

---

### Task 1: Add the verified-source entry

**Files:**
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/components/CourseEvidenceFooter.tsx`

**Interfaces:**
- Consumes: the existing `CourseEvidenceFooter` render path and global `.explorer-link` CSS class.
- Produces: one accessible anchor named `在 Sepolia 查看已验证源码` with the approved Etherscan URL and safe new-tab attributes.

- [ ] **Step 1: Write the failing app-level test**

Add these assertions to the test named `keeps the single-page story flow and course proof area aligned with the PRD` after the existing core-technology assertions:

```tsx
const verifiedSourceLink = screen.getByRole("link", {
	name: "在 Sepolia 查看已验证源码",
});
expect(verifiedSourceLink.getAttribute("href")).toBe(
	"https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code",
);
expect(verifiedSourceLink.getAttribute("target")).toBe("_blank");
expect(verifiedSourceLink.getAttribute("rel")).toBe("noreferrer");
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter @babysteps/web test -- src/App.test.tsx
```

Expected: FAIL because no link named `在 Sepolia 查看已验证源码` exists yet.

- [ ] **Step 3: Add the minimal footer link**

Append this anchor inside `.course-evidence__card`, after the explanatory paragraph:

```tsx
<a
	className="explorer-link"
	href="https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code"
	target="_blank"
	rel="noreferrer"
>
	在 Sepolia 查看已验证源码
</a>
```

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:

```bash
pnpm --filter @babysteps/web test -- src/App.test.tsx
```

Expected: all `App.test.tsx` tests PASS.

- [ ] **Step 5: Run the full delivery gate**

Run:

```bash
pnpm check
pnpm test
pnpm typecheck
pnpm build
```

Expected: formatting, public-copy validation, security validation, contract tests, web tests, type checking, and production builds all PASS.

- [ ] **Step 6: Commit the implementation**

```bash
git add web/src/App.test.tsx web/src/components/CourseEvidenceFooter.tsx
git commit -m "feat: link verified Sepolia contract source"
```
