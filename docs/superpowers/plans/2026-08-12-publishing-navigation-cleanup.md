# Publishing Navigation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product and Evidence navigation reciprocal and keep Cloudflare Pages Git Integration as the only production publisher.

**Architecture:** Reuse the existing `CourseEvidenceFooter` as a site-wide footer driven by the current product view. The footer exposes the required portfolio, product, and Evidence destinations in a fixed order, and the app renders it after every view. Replace the old GitHub Pages deployment validator with a Cloudflare-only publishing-contract validator, then remove the duplicate GitHub Pages workflow.

**Tech Stack:** React, TypeScript, Vitest, Node.js validators, Cloudflare Pages Git Integration.

## Global Constraints

- Navigation order is `作品集首页 / 项目主页 / 工作证明`.
- The current page uses `aria-current="page"`.
- The product footer links to `查看完整工作证明`.
- Cloudflare Pages Git Integration is the only production publisher.
- No Cloudflare API token or deployment credential is added to this repository.

---

### Task 1: Site-wide reciprocal footer

**Files:**
- Modify: `web/src/components/CourseEvidenceFooter.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Test: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `currentView: ProductView` and `onViewChange(view: ProductView)` from `App`.
- Produces: `CourseEvidenceFooter({ currentView, onViewChange })` with the fixed navigation links and `aria-current` state.

- [ ] Add a failing app test that asserts the fixed navigation order, Evidence URL, portfolio URL, and current-page state.
- [ ] Run the targeted web test and confirm the missing links fail.
- [ ] Move the footer outside `HomeView`, pass current view/change callback, and add responsive footer styles.
- [ ] Run the targeted test and web test suite.

### Task 2: Remove duplicate GitHub Pages publisher

**Files:**
- Delete: `.github/workflows/pages.yml`
- Modify: `scripts/validate-pages-workflow.mjs`
- Test: `scripts/validate-pages-workflow.test.mjs`

**Interfaces:**
- Consumes: `.github/baby2b-publish.yml` and `.github/workflows/verify-baby2b-project.yml`.
- Produces: a validator that rejects GitHub Pages deployment actions and confirms the shared Cloudflare publishing contract remains configured.

- [ ] Add a failing validator test proving the repository must not contain a GitHub Pages deploy workflow.
- [ ] Run the validator test and confirm it fails while `pages.yml` exists.
- [ ] Update the validator and delete `pages.yml`.
- [ ] Run validator tests and `pnpm validate:pages-workflow`.

### Task 3: Release gate

**Files:**
- Verify: all changed files from Tasks 1–2.

**Interfaces:**
- Consumes: product build and shared publishing manifest.
- Produces: a clean PR whose preview and main deployment can be verified through Cloudflare Pages.

- [ ] Run web tests, validator tests, type check, build, public-content scan, and `git diff --check`.
- [ ] Push a product-named branch, open a PR, and wait for Repository Policy, project verification, and Cloudflare Preview.
- [ ] Merge after all gates pass, then verify deployment-specific URL, `pages.dev`, custom domain, reciprocal navigation, Evidence deep link, and TLS.
