# Performance MFA Control Tasks

- [ ] T-001 + T-002 (atomic red/green review unit): lifecycle contract tests and the fixed start/stop/scheduled-expiry implementation must be reviewed together; neither is independently complete or a test-only diff.
- [ ] T-003: Add sanitized architecture, sequence, cost, recovery, IAM pending-cloud-readback status, and production Evidence plus deterministic repository gates.
## Repair round 4

- [x] RED: add contract coverage for service-specific absence classification, AccessDenied retry/fail-closed behavior, persistent cleanup marker gating, schema-unknown idempotent stop, and orphan API Gateway detection.
- [x] GREEN: implement the classified AWS read helper, fixed SSM Standard cleanup marker, marker-gated callbacks, and fixed-tag API readback.
- [x] T-001/T-002 review note: tests and minimal implementation remain one red/green repair unit; this is not represented as a test-only diff.
- [ ] `pending-cloud-readback`: confirm the GitHub AWS role has fixed-scope `ssm:GetParameter`, `ssm:PutParameter`, `tag:GetResources`, and the existing resource describe permissions.
