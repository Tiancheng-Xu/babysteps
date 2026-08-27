# Performance MFA Control Design

## Decision

BabySteps owns the AWS lifecycle. A fixed GitHub Actions workflow accepts only `start` or `stop`; a scheduled path expires an orphaned run. It always uses `us-east-1`, the stable project stack name, a 45-minute TTL, and the existing shared foundation. It cannot accept arbitrary AWS parameters from the browser.

## Start

1. Validate the repository, budget contract, approval environment, operation identifier, and authenticated callback contract.
2. Refuse to start when the stable stack already exists.
3. Deploy the temporary performance stack against the shared VPC, NAT, RDS, artifact bucket, and GitHub OIDC provider.
4. Build and push the immutable ARM cleaner image, initialize the exact project schema, enable bounded aggregation, and publish a sanitized running callback.

## Stop and expiry

1. Resolve only the stable project stack and its exact project schema.
2. Disable new aggregation, run a final cleaner, validate the real aggregate, and publish the sanitized immutable snapshot.
3. Drop the exact schema, delete the exact stack, and read back zero remaining project clusters/resources.
4. On failure, publish `cleanup_required`; never publish a false stopped state.

## Cost and safety

- Fixed TTL: 45 minutes.
- Incremental estimate gate: at most USD 0.20 per run.
- One live stack and one workflow concurrency group.
- Shared foundation resources are protected and never deleted by project cleanup.
- No long-lived AWS keys; GitHub OIDC assumes repository-scoped roles.

## Status

This document is the frozen implementation contract. Production status and measured cost are added only after cloud verification.
