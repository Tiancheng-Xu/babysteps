# Cloudflare Pages Build Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing repository-level `pnpm build` build only the Web workspace on Cloudflare Pages while preserving the complete local and CI build.

**Architecture:** A focused Node entry point selects workspace targets from the official `CF_PAGES` environment signal and executes the existing package build commands sequentially. The root package delegates to that entry point; package-level build scripts and Cloudflare output configuration stay unchanged.

**Tech Stack:** Node.js ESM, pnpm workspaces, Node test runner, Cloudflare Pages Git Integration.

## Global Constraints

- `CF_PAGES=1` builds only `@babysteps/web`.
- Every other environment builds AWS, contracts, Web, Worker, and Subgraph in the existing order.
- Project branch names must not contain the centrally configured academic aliases.
- No AWS resource or Cloudflare production deployment is created before the PR preview passes.
- The existing production deployment remains the rollback target.

---

### Task 0: Product naming cleanup and enforcement

**Files:**
- Create: `scripts/validate-project-naming.mjs`
- Create: `scripts/validate-project-naming.test.mjs`
- Rename: legacy `delivery`-named docs, validator, and GraphQL query paths to product-oriented `delivery` or `platform` names.
- Modify: tracked references to the renamed paths and commands.

**Interfaces:**
- Consumes: Git tracked paths, text content, and local/remote Git refs.
- Produces: `pnpm validate:project-naming`, which rejects the configured academic aliases except exact retained AWS identifiers in explicitly listed infrastructure/Evidence files.

- [ ] **Step 1: Write RED tests for paths, content, refs, and exact legacy identifiers**
- [ ] **Step 2: Rename safe paths and replace academic wording with product language**
- [ ] **Step 3: Implement the naming validator and package command**
- [ ] **Step 4: Prove the repository scan passes and only protected external identifiers remain**
- [ ] **Step 5: Commit the naming cleanup separately**

### Task 1: Environment-aware build entry point

**Files:**
- Create: `scripts/build.mjs`
- Create: `scripts/build-routing.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `process.env.CF_PAGES` and existing package-level `build` scripts.
- Produces: `selectBuildTargets(env): string[]` and a root `pnpm build` command that returns the first failed child build status.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { selectBuildTargets } from "./build.mjs";

test("Cloudflare Pages builds only the Web workspace", () => {
  assert.deepEqual(selectBuildTargets({ CF_PAGES: "1" }), ["@babysteps/web"]);
});

test("other environments keep the complete ordered build", () => {
  assert.deepEqual(selectBuildTargets({}), [
    "@babysteps/aws",
    "@babysteps/contracts",
    "@babysteps/web",
    "@babysteps/worker",
    "@babysteps/subgraph",
  ]);
});

test("the root build delegates to the routing entry point", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.scripts.build, "node scripts/build.mjs");
});
```

- [ ] **Step 2: Run the test to prove RED**

Run: `node --test scripts/build-routing.test.mjs`

Expected: FAIL because `scripts/build.mjs` does not exist.

- [ ] **Step 3: Implement the minimal router**

```js
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const FULL_BUILD_TARGETS = [
  "@babysteps/aws",
  "@babysteps/contracts",
  "@babysteps/web",
  "@babysteps/worker",
  "@babysteps/subgraph",
];

export function selectBuildTargets(env = process.env) {
  return env.CF_PAGES === "1" ? ["@babysteps/web"] : FULL_BUILD_TARGETS;
}

export function runBuild(targets = selectBuildTargets()) {
  for (const target of targets) {
    const result = spawnSync("pnpm", ["--filter", target, "build"], {
      env: process.env,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runBuild();
}
```

Set `package.json` `scripts.build` to `node scripts/build.mjs`.

- [ ] **Step 4: Run focused and validator tests**

Run:

```bash
node --test scripts/build-routing.test.mjs
pnpm test:validators
CF_PAGES=1 pnpm build
```

Expected: routing tests PASS, validators PASS, and the Pages-mode build completes without invoking SAM.

- [ ] **Step 5: Commit Task 1**

```bash
git add package.json scripts/build.mjs scripts/build-routing.test.mjs
git commit -m "fix: route Cloudflare Pages to the Web build"
```

### Task 2: Delivery gates and Preview proof

**Files:**
- Modify only if verification exposes a source defect: files named by the failing test.
- Verify: `web/dist`, `worker/dist`, the open GitHub PR, and the matching Cloudflare Preview deployment.

**Interfaces:**
- Consumes: Task 1 root build routing and the canonical repository-policy caller.
- Produces: a pushed product-named branch, passing repository-policy and Cloudflare Pages checks, and a preview URL tied to the pushed commit.

- [ ] **Step 1: Run complete local verification**

Run:

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

Expected: all commands exit zero. Existing non-failing CSS or bundle-size warnings are recorded but do not become success claims.

- [ ] **Step 2: Run repository policy against source and public outputs**

Run:

```bash
policy_repo=$(git config --global --path --get workflow.policyRepository)
node "$policy_repo/scripts/repository-policy.mjs" \
  --mode audit \
  --root /Users/shier/Desktop/babysteps \
  --build-output web/dist \
  --build-output worker/dist \
  --require-caller
```

Expected: `Repository policy passed.`

- [ ] **Step 3: Push and open the replacement PR**

Push `feature/starbuddy-web3-platform`, create a ready PR to `main`, and record its URL and head SHA. Do not merge while any check is pending or failed.

- [ ] **Step 4: Verify the exact Preview deployment**

Require the Cloudflare Pages check to pass, then verify the deployment API reports the same commit, non-empty build configuration, build/deploy success, and a deployment-specific URL returning 2xx.

- [ ] **Step 5: Merge only after all gates pass**

Merge the PR only after repository policy and Cloudflare Preview are green. Then verify the canonical Pages deployment points to the merge commit and the custom-domain root and required deep links return 2xx before starting the separately gated AWS Action node.
