# Local QA checkpoint

- Feature: `performance-sampling-coverage-semantics`
- Contract version/hash: `2 / 502998ee7fe2bd558f6232f7508b1d8061053bde3e19443ba9a5c4124c5b1427`
- State: `N6 / local_verified_release_deferred`
- Controlled-browser journey: 9/9 routes, 205 unique events, 43/43 accepted batches, zero rejected batches, zero transport failures, zero missing required metrics.
- Required coverage: 23 metric families, including all five Web Vitals, four deterministic navigation phases, seven resource families, three rendering phases, and four safe read-only Web3/RPC observations.
- Truthful boundaries: no manufactured layout shifts, JavaScript errors, promise rejections, wallet signatures, approvals, swaps, or transactions; conditional metrics remain `not-exercised`; environment-dependent DNS/TCP/TLS remain `unavailable` when appropriate.
- Responsive semantics: 9 routes x 4 widths (375/390/430/1440) = 36/36 HTTP 200, expected heading, zero root overflow, zero page errors.
- Visual regression: BackstopJS 4/4 with zero diff against the reviewed baseline; layout assertions 2/2.
- Deterministic gates: validators 98/98, AWS 90/90, contracts 108/108, web 293/293, worker 62/62, subgraph 4/4; typecheck, production build, delivery Evidence, public copy, and diff checks passed.
- Release boundary: no Git push, Cloudflare publication, AWS provisioning, or fresh cloud snapshot was performed in this local checkpoint.
