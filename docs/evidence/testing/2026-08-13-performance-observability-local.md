# BabySteps performance observability local verification

Date: 2026-08-13

## Status

- Browser SDK, Worker proxy, AWS ingest/query/cleaner/store, real-statistics UI: locally verified.
- SAM template, one-shot ECS bundle, budget guard and deployment/cleanup workflow contract: locally verified.
- AWS run, controlled event, ECS task exit, live aggregate and post-run resource deletion: pending GitHub Actions verification.

## Verified results

- AWS performance and regression suite: 67/67 passed.
- Web regression suite: 185/185 passed.
- Worker regression suite: 55/55 passed.
- Performance workflow contract and Evidence contract tests: passed.
- Type checks: all workspaces passed.
- `sam validate --lint` for `aws/performance-template.yaml`: passed.
- Performance Lambda SAM build: passed.
- ECS cleaner ESM bundle: produced a non-empty artifact.
- ECS persists a UUID-idempotent raw row and hourly aggregate in one SQL statement; the query path reads the aggregate table and preserves exact timestamps for 1h/24h/7d boundaries.
- Responsive check: 390 px viewport and root content width were both 390 px; no root horizontal overflow.
- Local `aws-budget-guard`: passed with one exact, expiring ECS Cluster exception; no NAT, RDS, ALB or ECS Service is created.

## Cost and cleanup boundary

The performance stack reuses the protected shared VPC, private app subnets, single NAT, PostgreSQL engine, artifact bucket and GitHub OIDC provider. The project stack creates its own generated database login secret and owns only `babysteps-performance-*` API/Lambda/SQS/DLQ/ECR/ECS/log/security-group resources plus the `babysteps_performance` schema/role. The privileged shared database secret is readable only by the short-lived schema initialize/cleanup task, not by the normal cleaner or query Lambda. The workflow records sanitized Evidence, runs an exact schema-cleanup task, deletes the exact project stack and verifies the project cluster count is zero.

No cloud resource ID or successful cleanup result is claimed here until the GitHub Actions run exists.

The meaningful AWS implementation timeline, least-privilege lifecycle and final
proof contract are recorded separately in
[`2026-08-13-performance-aws-implementation.md`](2026-08-13-performance-aws-implementation.md).
