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

## Account-level ECS prerequisite

Run `31758788485` crossed stack creation and the immutable ARM64 image build but
CloudTrail showed that `ecs:RunTask` returned `InvalidParameterException` before
creating a task: the account did not yet have the AWS-managed ECS service-linked
role. The shared Identity stack now retains `AWSServiceRoleForECS` with the
official `/aws-service-role/ecs.amazonaws.com/` path, trust limited to
`ecs.amazonaws.com`, and only `AmazonECSServiceRolePolicy` attached.

This role is intentionally shared at account level: ECS needs it to manage task
network interfaces, creating one per project would be both impossible and the
wrong trust model. The role is not an IAM user, has no access keys, costs
nothing by itself, and does not grant GitHub or browser code access to database
secrets. The Identity stack reached `UPDATE_COMPLETE` and drift `IN_SYNC`; shared
VPC, NAT, RDS, OIDC and the Foundation stack were not modified.

## Real startup failure and exact recovery

Run `31760380214` proved that the account prerequisite was fixed: the database
admin Fargate task was created and reached `STOPPED`. Its exit code was `1`, and
the sanitized project log showed `Dynamic require of "node:https" is not
supported` while the bundled module was still loading. The failure occurred
before environment validation, Secret retrieval or database connection, so no
project Schema or role was created.

The same error also prevented the cleanup container from starting. The main
workflow therefore refused to delete the stack automatically instead of
guessing that database cleanup had succeeded. A separate manual recovery gate
was added for this narrow pre-database state: it accepts only an exact
`babysteps-performance-<run-id>` name, the protected `aws-performance`
Environment, a human approval reference and an explicit pre-database-failure
acknowledgement. Recovery Run `31761586956` deletes only that stack and must
prove the run-scoped ECS, ECR, SQS, Lambda, API, log, Secret and active task
definitions are all absent. The shared Foundation remains protected.

The Cleaner build now has an executable production-bundle regression test. It
first reproduced the cloud stack trace locally, then retained ESM/top-level
await while adding Node's `createRequire(import.meta.url)` compatibility bridge
for bundled CommonJS AWS SDK internals. The test now boots the real artifact far
enough to reach the expected `MISSING_QUEUE_URL` boundary rather than failing in
the module loader.

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
