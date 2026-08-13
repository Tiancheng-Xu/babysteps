# StarBuddy Keepsakes Design

**Status:** approved for implementation
**Date:** 2026-08-13
**Source:** user-approved grill decisions and Google Stitch project `10462394847748948069`

## Goal

Add a verifiable StarBuddy keepsake loop to BabySteps. An adult caregiver spends
12 transferable growth stars to request one random non-transferable keepsake,
can combine three eligible keepsakes into the next rarity, and can inspect the
Chainlink VRF and Sepolia evidence for every terminal result.

## Non-goals

- No BabyCoin payment, market price, resale, transfer, investment, yield, or
  financial promise.
- No child name, birthday, photo, video, comment, health data, or family-private
  content in public metadata.
- No migration of balances or tokens from previous Sepolia deployments.
- No mainnet deployment and no production release in this feature.
- No additional charge for fusion.

## Product rules

### Draw

- Cost: exactly 12 transferable growth stars.
- Rarity distribution: Common 70%, Rare 22%, Super Rare 7%, Collector 1%.
- User-facing labels: `普通 / 稀有 / 星耀 / 典藏`.
- Character series is independently selected from the four StarBuddy stages:
  Egg, Sprout, Explorer, and Star.
- Each series/rarity visual is fixed. A new draw randomly selects its series and
  rarity; it does not procedurally redesign an existing card.
- Randomness is provided by Chainlink VRF v2.5 on Ethereum Sepolia.

### Fusion

- Inputs: three keepsakes owned by the caller, with the same character series
  and the same rarity.
- Collector keepsakes cannot be fused.
- Fusion costs no additional growth stars.
- Success rates: Common to Rare 100%, Rare to Super Rare 70%, Super Rare to
  Collector 40%.
- On success, all three parent tokens are burned and one keepsake of the same
  series at the next rarity is minted.
- On failure, Chainlink VRF selects one parent token to burn permanently; the
  other two are unlocked and remain owned by the caller.

### Recovery

- A pending draw or fusion can be recovered after 24 hours.
- Recovering a draw cancels the pending request and refunds 12 transferable
  growth stars.
- Recovering a fusion cancels the pending request and unlocks all three parent
  tokens.
- A late VRF callback for a recovered request is ignored and cannot mint or burn.

## Smart-contract architecture

### `OnchainNotebook`

The existing transferable-star ledger remains the source of truth. It gains an
admin-controlled consumer allowlist and two consumer-only operations:

- `spendTransferableBalance(account, amount)`
- `refundTransferableBalance(account, amount)`

The deployer is the initial admin. Only an explicitly authorized keepsake
contract can debit or refund stars. Lifetime growth points and growth stage are
never reduced.

### `StarBuddyKeepsakeSBT`

An ERC-721 enumerable, ERC-5192-compatible soulbound token. It stores immutable
series and rarity attributes per token. Only the keepsake coordinator can mint
and burn. Approvals and transfers always revert.

### `StarBuddyKeepsakes`

A reentrancy-protected Chainlink VRF v2.5 consumer that:

1. validates and spends stars for a draw;
2. locks eligible fusion inputs;
3. requests randomness;
4. settles draw or fusion results in the VRF callback;
5. exposes request status, latest request by owner, token lock state, and
   terminal evidence; and
6. provides bounded 24-hour recovery.

Request status is explicit: `None / Pending / Succeeded / Failed / Recovered`.
Events include the request ID, owner, consumed or burned token IDs, minted token
ID, rarity, series, and recovery result.

## Frontend architecture

Add `星宝纪念馆` to the existing product navigation. The page is one responsive
component tree and contains:

1. draw balance, fixed cost, initial rarity probabilities, and draw action;
2. pending VRF state with request ID, Sepolia link, leave-and-return copy, and
   24-hour recovery action;
3. collection filters and accessible keepsake cards;
4. three-slot fusion selection, exact eligibility, success rates, token-ID
   confirmation, and irreversible failure warning;
5. terminal success/failure panels with concrete consumed, burned, unlocked,
   and minted token IDs; and
6. a one-shot 2.1-second success presentation based on the approved Stitch
   candidate.

The success presentation disables actions during animation, does not loop, and
is skipped on revisits to an already confirmed request. With
`prefers-reduced-motion`, particle, parallax, convergence, and floating effects
are replaced by a 150 ms fade and a visible reduced-motion message.

If deployed contract addresses are absent, the page must show a truthful
configuration-unavailable state. It must not invent balances, tokens, request
IDs, or transaction hashes.

## Visual and accessibility contract

- Warm watercolor and cream-paper background with 2.5D holographic cards.
- Chinese business labels; technical identifiers may retain canonical Web3
  names such as `Token ID`, `Chainlink VRF Request ID`, and `Ethereum Sepolia`.
- Minimum 44 px touch targets, visible keyboard focus, no root horizontal
  overflow at 375, 390, 430, and 1440 px.
- Color is not the only status signal; every state has icon, heading, and text.
- Public navigation uses `作品集首页 / 项目主页 / 工作证明` where those global
  links are rendered, and the product navigation identifies `星宝纪念馆`.

## Error and trust boundaries

- Reject insufficient balance, zero/duplicate/foreign tokens, mixed series,
  mixed rarity, Collector fusion, locked tokens, and premature recovery.
- Checks-effects-interactions plus reentrancy protection guard state changes.
- The coordinator address and VRF subscription parameters are immutable.
- Metadata URIs are admin-configured per series and rarity; public assets are
  sanitized and contain no child data.
- UI distinguishes wallet rejection, transaction failure, pending receipt,
  pending VRF, terminal failure, and read/configuration errors.

## Verification

- Contract unit tests cover distribution boundaries, star debit/refund,
  ownership and fusion eligibility, success/failure burns, late callback after
  recovery, SBT transfer rejection, and emitted evidence.
- Frontend model and component tests cover cost/probability copy, selection
  eligibility, pending/recovery states, success animation, reduced motion, and
  truthful unconfigured state.
- Full repository checks include test, typecheck, build, public-copy scan,
  responsive screenshots, Evidence validation, and repository policy.
- Evidence maps every requirement to code and test/deployment proof. Sepolia
  deployment remains `待验证` until real addresses and transactions exist.

