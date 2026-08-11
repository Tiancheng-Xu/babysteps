# BabySteps IPFS metadata and Sepolia V2 preparation

- Date: 2026-08-10 (America/New_York)
- IPFS state: `prepared-not-pinned`
- V2 Sepolia deployment state: `pending wallet signature`
- AWS KMS completion relayer: `deferred by cost gate`

## Content-addressed metadata

The generator hashes the exact public bytes with SHA-256 and creates CIDv1 raw-block identifiers. It produces separate task and certificate JSON documents, both referencing the existing StarBuddy architecture artwork by `ipfs://` URI.

Prepared CIDs:

```text
image       bafkreidexwnxt62s5tbz72suyikizn4yedeqsnlg4izilw77xks2vdfria
task        bafkreiciotjcmmzlhxhs4u3oojbtxlrsefja37x5jrwq3l4h7w45j3yvi4
certificate bafkreif7culycmrc4r5n62u45xfdbriqxlcfrfdhvxbl5szirwyb5p4qhu
```

The metadata excludes child personal data. Videos, comments and usernames remain in D1; the certificate declares ERC-721 + ERC-5192 and purchaseId idempotency.

## Verification

```text
node --test scripts/prepare-ipfs-metadata.test.mjs
2 tests passed

pnpm prepare:ipfs
status: prepared-not-pinned
```

Machine-readable manifest: `docs/evidence/deployment/2026-08-10-ipfs-metadata-manifest.json`.

## V2 deployment safety

- The actual V2 parameter file is ignored by Git even though it contains only public addresses and the public VRF subscription identifier.
- The Ignition module attaches to the existing Sepolia BabyCoin and deploys only `GrowthCertificateSBT` and `TaskMarketplaceV2`.
- `finalize:web3:v2:sepolia` grants the demo Provider role and adds the V2 marketplace as a VRF consumer.
- The finalizer intentionally does **not** grant `COMPLETION_RELAYER_ROLE` to the deployer. That role remains reserved for a non-exportable AWS KMS signer after explicit approval of the continuously billed KMS key.

Observed contract result after these additions:

```text
Hardhat node tests: 79 passed
Contracts TypeScript: passed
Repository validator tests: 11 passed
Public-copy/secret scan: passed
```

## Pending external evidence

- Pin the image, task JSON and certificate JSON through an IPFS provider.
- Fetch all three CIDs from an independent public gateway.
- Deploy and verify V2 contracts on Sepolia, then record addresses and transaction hashes.
- Add the V2 contract as VRF consumer and independently read the subscription.
- Grant the completion role only after the KMS-backed relayer is available.

No pinning token, RPC credential, wallet private key, keystore password or AWS credential is stored in the repository.
