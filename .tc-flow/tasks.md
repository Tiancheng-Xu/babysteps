# BabySteps design system modernization

- [x] T-001: Freeze `DESIGN.md` with the design language, responsive and accessibility contracts, component ownership, bounded TanStack Query slice, rejected dependencies, route matrix, and measurable non-regression gates.
- [x] T-002: Introduce tested typed design tokens and the smallest reusable primitive set without changing blockchain, metric, Evidence-claim, Dashboard, or Agent Market behavior.
- [x] T-003: Apply the shared primitives and accessible loading, empty, error, disabled, focus, success, and reduced-motion states across the nine existing routes from one responsive component tree.
- [x] T-004: Migrate `OwnerCompletionReviewPanel` list loading to the existing TanStack Query client as the only initial HTTP server-state slice; preserve manual API validation and all Wagmi cache, receipt, and transaction ownership.
- [x] T-005: Pass functional, type, build, edge-SSR, GET/HEAD, asset/API passthrough, unknown-document 404, accessibility, and public-content gates with no out-of-contract behavior changes.
- [ ] T-006: Record and review deterministic BackstopJS results at 375, 390, 430, and 1440 pixels plus comparable route gzip and controlled-browser CWV evidence; complete isolated review, Feature QA, Stop Hook, policy, PR checks, and preview smoke before claiming delivery.

T-006 的本地 BackstopJS、bundle、Chrome trace、单人双轴代码审查与 Feature QA 已完成；PR checks、Preview smoke、合并与生产回读仍待 N7 发布流程。用户因 token 预算明确禁止 subagent，本轮独立审查要求改为主代理基于冻结规格的单人双轴复核并如实记录，不冒充独立 reviewer。
