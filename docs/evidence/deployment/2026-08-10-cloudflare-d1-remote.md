# Cloudflare D1 remote deployment evidence

On 2026-08-10, Wrangler authenticated through its encrypted local OAuth profile and confirmed D1/Workers write scope without printing a credential. The account previously contained no D1 database and no `babysteps-worker` deployment.

Created `babysteps-production` in ENAM and applied `0001_initial.sql`. The remote schema query independently returned all eight application/migration tables and their indexes. The verification query was served from EWR and reported a database size of 118,784 bytes.

The Worker was intentionally **not** deployed: `TaskMarketplaceV2` still has no Sepolia address, so the production config correctly remains blocked instead of publishing an API bound to `0x000…000`.

Cost boundary: [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) states that D1 is usage billed and scales compute to zero; storage above the included plan allowance can still be billed. This tiny database therefore has no always-running instance but remains subject to normal usage monitoring.

Machine-readable evidence: `docs/evidence/deployment/2026-08-10-cloudflare-d1-remote.json`.
