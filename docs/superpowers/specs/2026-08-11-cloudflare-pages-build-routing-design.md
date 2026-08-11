# Cloudflare Pages build routing

## Problem

Cloudflare Pages currently runs the repository-level `pnpm build`. That command
builds every workspace, including the AWS package, whose build requires the SAM
CLI. The Pages build image does not provide SAM, so the preview fails before the
Web application is built.

## Decision

Keep one repository-level build entry point, but route its targets by execution
environment:

- When Cloudflare Pages supplies `CF_PAGES=1`, build only
  `@babysteps/web`.
- In every other environment, build AWS, contracts, Web, Worker, and Subgraph in
  the existing order.

The routing lives in one small Node script. `package.json` delegates `pnpm build`
to that script. Individual package build commands remain unchanged.

## Failure behavior

The script runs the selected package builds sequentially and stops on the first
non-zero exit code. Signals and failures propagate to the caller. It does not
deploy, retry, or modify Cloudflare configuration.

## Verification

Automated tests must prove:

1. `CF_PAGES=1` selects only the Web build.
2. The default environment selects the complete existing build list in order.
3. The root `build` command delegates to the routing script.

Release verification then requires the existing local checks, a successful full
local production build, repository-policy approval, and a successful Cloudflare
PR preview for the exact commit.

## Boundaries

- No AWS resource or Cloudflare production deployment is created by this change.
- The current production deployment remains the rollback target until the new
  preview and production URLs pass HTTP verification.
- Project branch names use product or feature language and must not contain
  `homework`, `yideng`, or the standalone token `yd`. The current delivery branch
  is renamed to `feature/starbuddy-web3-platform` before the next preview.
- Branch-name enforcement is a repository-policy concern. These ref-only terms
  must not be applied as a blanket source or documentation content filter.
