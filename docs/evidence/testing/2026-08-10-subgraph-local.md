# BabySteps TaskMarketplaceV2 Subgraph — local evidence

- Date: 2026-08-10 (America/New_York)
- Environment: local Graph CLI and Matchstick
- Chain target: Ethereum Sepolia (`11155111`)
- External deployment status: `pending` — the local manifest intentionally uses the zero address and start block `0` until the V2 Sepolia deployment exists.

## Indexed facts

The Subgraph stores only event-backed facts:

- AccessControl role grants and revocations
- task request, approval, rejection, random activation and pause state
- purchase creation
- completion evidence hash
- certificate token and recipient

Video URLs, comments, usernames and other D1 content are not copied into the Subgraph.

## Test evidence

Command:

```text
pnpm --filter @babysteps/subgraph test
```

Observed result:

```text
All 4 tests passed
```

The tests cover the task review/randomization lifecycle, purchase→completion→certificate linking, certificate idempotency, Provider role revocation, rejection, and pause state.

## Build evidence

Command:

```text
pnpm --filter @babysteps/subgraph build
```

Observed result:

```text
Build completed: build/subgraph.yaml
```

The build regenerated the ABI from the compiled `TaskMarketplaceV2` artifact, generated Graph types, compiled the AssemblyScript mapping to WASM, and emitted a deployable local artifact.

## Pending external proof

- V2 Marketplace Sepolia address and deployment start block
- Subgraph Studio slug, deployment ID and sync status
- a real GraphQL response for the homework query
- comparison of the Subgraph result with public RPC, Infura and Alchemy

No deploy key, API key or wallet secret is stored in this evidence.
