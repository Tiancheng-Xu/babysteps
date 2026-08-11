# BabySteps Privy identity — local evidence

- Date: 2026-08-10 (America/New_York)
- Scope: Google/email/external-wallet login configuration, Smart Wallet provider, challenge-sign-verify session, and D1 username profile
- External Privy status: `pending` — no App ID or secret is committed, and this evidence does not claim a real OAuth login.

## Implemented boundary

- `PrivyProvider` exposes only Google, email, and external-wallet login methods on Ethereum Sepolia.
- `SmartWalletsProvider` is enabled without a Paymaster. Smart Wallet deployment remains lazy until a real user operation is sent.
- The browser asks a connected wallet to sign the Worker-issued message; the client never reads or stores a private key.
- The Worker verifies the recovered address and returns a Secure, HttpOnly, SameSite=Lax session cookie.
- Username changes go to D1 with an audit record; no profile value is written to the public chain.
- Missing `VITE_PRIVY_APP_ID` produces an honest “Privy 待配置” state while existing MetaMask product paths remain usable.

## Test and build evidence

Commands:

```text
pnpm --filter @babysteps/web typecheck
pnpm --filter @babysteps/web test
pnpm --filter @babysteps/web check
pnpm --filter @babysteps/web build
```

Observed result:

```text
TypeScript: passed
Vitest: 26 files passed, 153 tests passed
Biome: passed with 4 pre-existing reduced-motion !important warnings
Vite production build: passed
```

The focused identity tests prove the login-method contract, linked-account classification, Worker-compatible username validation, and the two-call challenge/sign/session API flow. The App navigation test proves the unconfigured public state renders without pretending that OAuth has succeeded.

## Pending external proof

- Privy Dashboard App ID and allowed production origin
- Google, email, and external-wallet login screenshots
- a visible Smart Wallet linked account after login
- public Worker CORS/cookie acceptance from the production origin
- username update and audit row in deployed D1

No App Secret, wallet private key, session cookie, access token, or personal email address is stored in this evidence.
