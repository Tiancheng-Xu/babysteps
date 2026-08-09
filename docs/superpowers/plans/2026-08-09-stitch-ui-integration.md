# Stitch UI Integration Plan

**Goal:** Apply the canonical Chinese Stitch screens to the existing BabySteps React app without replacing working wallet, growth, transfer, or notebook behavior.

**Architecture:** A lightweight in-app product navigation switches among five views. The existing single-page experience remains the home view. New marketplace, parent, provider, and evidence views render only verified local state or explicit deployment-gated empty states; they never invent chain data.

**Design source:** Stitch project `10462394847748948069`, using the canonical Chinese desktop/mobile home, growth marketplace, parent dashboard, provider console, evidence, wrong-network, and transaction-state screens.

## Task 1: Navigation contract

- Add failing App tests for the five-view navigation and accessible current-view state.
- Implement `ProductNavigation` and view selection in `App`.
- Keep the existing home user journey and all existing tests functional.

## Task 2: Canonical page shells

- Add `GrowthMarketplacePage`, `ParentDashboardPage`, `ProviderConsolePage`, and `EvidencePage`.
- Use deployment-gated empty states when Web3 contract addresses are absent.
- Reuse the current wallet/growth/transfer/notebook components in the parent view.
- Show the StarBuddy architecture image in the evidence view.

## Task 3: Celestial Nursery responsive styling

- Add cream-paper, sea-blue outline, apricot CTA, sage success, and muted-purple Web3 styles matching Stitch.
- Keep 48 px minimum controls, strong focus-visible states, readable text, and 320 px no-overflow behavior.
- Respect the existing reduced-motion policy.

## Task 4: Verification

- Run focused App tests, all frontend tests, typecheck, build, Biome, and repository validators.
- Run a local browser visual check at desktop and mobile widths before any deployment.
