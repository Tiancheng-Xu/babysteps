# BabySteps performance AWS implementation record

Date: 2026-08-13

## Why the cloud proof is ephemeral

The assignment needs one real path from browser-shaped telemetry to an AWS-hosted
cleaner and a statistics page. It does not need a permanently running analytics
platform. The workflow therefore creates a run-scoped stack only after a manual
approval reference, proves one controlled event, captures sanitized Evidence,
removes the project database schema, and deletes the exact stack. Shared VPC,
NAT, PostgreSQL, artifact storage and GitHub OIDC remain protected and are never
owned by the project cleanup.

## Permission lifecycle used by CloudFormation

The GitHub job receives a short-lived OIDC session and can pass only the exact
BabySteps CloudFormation execution role. The execution role separates operations
that happen before AWS resource tags are observable from stable operations:

1. **Create/provision:** resource-name prefixes and request tags constrain the
   ECR, SQS, Secret, security-group and API Gateway create handlers.
2. **Stable management:** destructive ECR, SQS, Secret and security-group actions
   require `Project=babysteps-performance` on the existing resource.
3. **Cleanup:** CloudFormation may deregister the two run-scoped task-definition
   revisions. AWS does not support resource-level authorization for
   `ecs:DeregisterTaskDefinition`, so that single action uses `Resource: *`; the
   principal is still a CloudFormation-only service role and the stack can pass
   only BabySteps-prefixed task roles.
4. **Explicit protection:** deleting shared NAT, RDS, load balancers, OIDC and the
   shared Foundation stack remains denied.

The API Gateway V2 provider uses two tagging authorization paths: API creation
calls the `/tags/<resource ARN>` endpoint, while the SAM-generated `$default`
stage calls the native `apigateway:TagResource` action against an
`/apis/<id>/stages` resource. Both are limited to the project request tag. The
local cfn-lint IAM action catalogue does not yet include the native action, so
only warning `W3037` is suppressed in this template; the exact action, ARN and
request-tag condition are enforced by regression tests and IAM simulation.

## Meaningful implementation checkpoints

| Checkpoint | What the real run proved | Result / next action |
| --- | --- | --- |
| Create-handler boundary | ECR lifecycle/tag and SQS queue attributes/tag calls happen before stable resource tags can be relied on. | Split provisioning permissions from tag-gated stable mutations. Other repository/queue prefixes remain denied. |
| Explicit generated Secret name | CloudFormation must create the password under the same project prefix that IAM expects. | The SAM template names it `babysteps-performance-db-<environment>`; no browser or GitHub job can read the value. |
| API and generated Stage tagging | SAM creates both the HTTP API and a `$default` Stage, and AWS authorizes their tags differently. | API and Stage both reached `CREATE_COMPLETE` after adding their two exact tagging paths. |
| Task-definition cleanup | A failed run must not leave active ECS revisions or a stack in `DELETE_FAILED`. | The execution role can deregister the two run-scoped definitions; subsequent rollback completed instead of stalling. |
| Cost cleanup gate | A failed step must still execute Evidence capture and exact-stack deletion. | Failed runs were followed by a nine-service inventory covering Stack, ECS, ECR, SQS, Lambda, API, logs, Secrets and task definitions; zero active project resources was required before retry. |

This table records engineering decisions and verified failure boundaries. It is
not a success claim for the final event pipeline. The authoritative successful
run, metrics, ECS exit code, sanitized Artifact and post-run zero-residue audit
will be added only after all six runtime stages complete.

## Final runtime proof contract

The accepted run must show all of the following together:

- a controlled `LCP=321` browser-shaped event is accepted through the Worker
  proxy and AWS ingest API;
- SQS hands the event to an on-demand ECS Fargate cleaner and the task exits 0;
- PostgreSQL returns `sampleCount=1` and exact `p50=p75=p95=321`, rather than a
  mock curve or calculated substitute;
- the run records its commit and immutable image tag without publishing
  credentials, endpoints or database details;
- the project schema/role is dropped, the exact CloudFormation stack is deleted,
  and the same nine-service inventory returns no active project resource.

## Current status

The local SDK, Worker, Lambda, ECS cleaner, storage, dashboard, SAM template and
workflow gates are verified. The final successful cloud event and aggregate are
still pending; the public status must remain **AWS cloud verification pending**
until the proof contract above is satisfied.
