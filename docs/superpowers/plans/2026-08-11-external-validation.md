# BabySteps External Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining assignment-required Sepolia and third-party validation loops with real, sanitized Evidence before the 21:00 review.

**Architecture:** Reuse the implemented V2 contracts, Worker/D1, web app, Uniswap v3 integration, RPC comparison, Subgraph, and metadata pipeline. External writes are performed only after read-only preflight; every service produces a reproducible evidence artifact and no paid AWS resource is added.

**Tech Stack:** Solidity 0.8.28, Hardhat Ignition, viem, Chainlink VRF v2.5, Uniswap v3 Sepolia, Cloudflare Workers/D1/Pages, Privy, The Graph, IPFS, GitHub Actions.

## Global Constraints

- Use Ethereum Sepolia only; no mainnet transaction or asset with real value.
- Do not create NAT, EIP, KMS Relayer, API Gateway, or monitoring resources.
- Never print or commit private keys, API keys, passwords, cookies, or deploy tokens.
- Preserve Git-integrated Cloudflare Pages and require commit-specific HTTP/TLS verification.
- Keep assignment mapping and architecture status truthful; local code is not external completion evidence.

---

### Task 1: V2 Sepolia business loop

**Files:**
- Create: `contracts/scripts/runSepoliaV2BusinessClosedLoop.ts`
- Create: `contracts/test/SepoliaV2BusinessScript.ts`
- Modify: `contracts/package.json`
- Update: `docs/evidence/deployment/2026-08-11-sepolia-v2-business.json`

**Interfaces:**
- Consumes: `BabyStepsWeb3V2Module` deployment addresses and the existing VRF subscription.
- Produces: V2 contract addresses, role/consumer configuration, task/request/purchase/certificate IDs, transaction hashes, and post-transaction reads.

- [ ] Write a failing script-contract test covering request, approval, VRF wait, exact approval, buy, temporary completion role, SBT mint, role revocation, and verification.
- [ ] Run the focused test and confirm it fails because the V2 business script is absent.
- [ ] Implement the idempotent V2 business script and package command.
- [ ] Run contract tests, typecheck, and compile.
- [ ] Deploy V2, finalize Provider/VRF configuration, execute the loop, and independently read every persisted result.

### Task 2: Uniswap v3 pools and real test swaps

**Files:**
- Reuse: `contracts/scripts/provisionSepoliaUniswapV3.ts`
- Update: `docs/evidence/deployment/2026-08-11-uniswap-v3-pools.json`
- Create: `docs/evidence/deployment/2026-08-11-uniswap-v3-swaps.json`

**Interfaces:**
- Consumes: official Sepolia USDC, WETH9, BABY, Uniswap v3 Factory and PositionManager.
- Produces: BABY/USDC and BABY/WETH pool addresses, liquidity NFT/transaction hashes, quotes, swaps, balances, and slippage evidence.

- [ ] Obtain only free official test assets and recheck balances.
- [ ] Run planned-mode preflight and confirm exact amounts and existing pools.
- [ ] Create/fund both pools with minimum useful liquidity.
- [ ] Execute one small USDC-to-BABY and one WETH-to-BABY test swap and verify balance deltas.

### Task 3: Worker/D1 and Privy identity

**Files:**
- Modify only configuration references required by the deployed V2 address and Privy App ID.
- Update: `docs/evidence/deployment/2026-08-11-worker-privy.json`

**Interfaces:**
- Consumes: V2 marketplace address, existing D1 database, Privy application configuration.
- Produces: deployed Worker URL, task metadata/comment persistence, challenge-sign-verify session, and profile update evidence.

- [ ] Configure the Worker with the V2 address and deploy through Wrangler OAuth without repository tokens.
- [ ] Verify task metadata and comment linkage against the V2 task ID.
- [ ] Configure Privy allowed origins and public App ID.
- [ ] Validate wallet login, signature, HttpOnly session, and username update without exposing identity data.

### Task 4: RPC, The Graph, and IPFS

**Files:**
- Reuse: `contracts/scripts/readSepoliaAcrossProviders.ts`
- Reuse: `subgraph/`
- Reuse: `scripts/prepare-ipfs-metadata.mjs`
- Update sanitized Evidence under `docs/evidence/deployment/`.

**Interfaces:**
- Consumes: public Sepolia RPC, Infura, Alchemy, V2 ABI/address, Graph deploy key, content-addressed metadata.
- Produces: three-provider consistency report, deployed Subgraph ID and GraphQL response, pinned metadata/image CIDs.

- [ ] Configure Infura and Alchemy endpoints outside Git and run the same-block comparison.
- [ ] Pin the exact prepared image and metadata bytes, then verify both CIDs through an independent gateway.
- [ ] Update Subgraph address/start block, build/test, deploy to Studio, and query V2 task/purchase/completion events.

### Task 5: Evidence, architecture, and release gate

**Files:**
- Modify: `docs/delivery/web3-delivery-implementation-map.md`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`
- Modify: relevant `docs/evidence/**` summaries.

**Interfaces:**
- Consumes: real transaction hashes, contract/pool/Subgraph/Worker IDs, tests, HTTP/TLS/RPC/GraphQL reads.
- Produces: truthful requirement-to-code-to-evidence mapping and deployed project/Evidence URLs.

- [ ] Run checks, tests, typecheck, build, public-content scan, secret scan, and Repository Policy.
- [ ] Update only statuses supported by external evidence and preserve limitations.
- [ ] Push a product-named branch, require Repository Policy and Pages Preview, then merge only after user-authorized production gate.
- [ ] Verify deployment-specific URL, canonical Pages alias, custom domain, Evidence page/manifest, TLS, reciprocal navigation, and rollback reference.
