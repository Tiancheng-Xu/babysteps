# Performance sampling coverage semantics

## Decisions

- A required safe read-only operation may be represented by a settled success or a settled sanitized failure, but the failure must retain its failure outcome through aggregation and readback.
- Healthy pages report JavaScript errors, promise rejections, CSR fallback, and hydration recovery as `observed-zero`; the journey never manufactures failures merely to create samples.
- Wallet, identity, signing, approvals, swaps, and transaction receipts remain `not-exercised` without explicit prerequisites and user authorization.
- DNS, TCP, and TLS remain `unavailable` when browser connection reuse prevents independent observation.
- The pre-AWS controlled-browser gate must pass before any project Runtime or database Schema is created.

## Reusable findings

- Route readiness is not equivalent to asynchronous business-observation readiness. A Journey manifest needs explicit read-only settle conditions for operations that complete after the route heading appears.
- A representative INP interaction must pass through a real paint and remain deterministic under declared CPU conditions; a synthetic busy loop is not acceptable evidence.
- Coverage names and outcome semantics are separate contracts. Mapping `<metric>.error` to a required base name proves instrumentation coverage only; the readback Gate must still require the corresponding failure count.
- Business coverage must fail closed on event type, exact route, metric name, and explicit outcome. Never fall back to the raw metric name after a route-aware helper rejects an event.

## Recovery boundary

The local candidate is reproducible without AWS. A cloud snapshot may replace the historical snapshot only after the workflow completes browser ingestion, SQS/DLQ drain, ECS cleaning, PostgreSQL aggregation, Evidence capture, Schema deletion, Stack deletion, and zero-residue readback.
