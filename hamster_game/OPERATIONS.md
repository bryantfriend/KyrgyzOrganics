# Lucky Hamster — live game

The approved cream/sage game runs at `/hamster_game/`. The local prototype remains separate and is not part of the production release.

## Accounts and progress

Guests receive five server-owned trial spins. Registration links an email/password credential to the same anonymous Firebase UID, preserving progress. Signing into an existing account loads that account instead. Verified email is required for daily gifts, purchase-code claims, and bakery reward redemption. Password reset and verification resend are available in My hamster.

Previous PIN-based records in `individual_customers` are left untouched. Untrusted browser demo balances and legacy PIN balances are not imported into redeemable accounts.

## Default economy

- 55% no-match outcome: no seeds; spends one spin.
- 40% pair: 5 seeds.
- 5% jackpot: 40 seeds.
- Daily spins: 3, 3, 4, 4, 5, 5, 8. Reset at midnight Asia/Bishkek (UTC+6); missed days reset the streak, day 7 cycles to day 1.
- Purchase codes: 5 spins, expire after 90 days by default.
- Existing seeds are not deducted by losses. No paid spins are offered.

Admin → Games → Settings controls availability, odds, payout amounts, daily gifts, starting spins, purchase-code grants/expiry, and reward prices/availability. Existing codes/coupons keep their issued values. Staff can validate a reward coupon under Coupons; customers cannot mark it used themselves.

## Purchase QR workflow

1. Games → Purchase codes: enter a batch or receipt reference and generate 1–50 codes.
2. Print/save the labels as PDF, or export a CSV for a label printer. Reprinting uses the same codes.
3. Apply one unique QR per bread package or paid receipt. Protect it from being scanned before purchase (inside packaging, covered label, or issue after payment).
4. A phone camera opens `https://oako.kg/hamster_game/#code=…`. The player signs in/verifies email and claims it once.
5. Cancel unused codes from a batch if labels are lost. Claimed codes cannot be claimed by another account.

These are reward QRs, not the existing shared product or bank-payment QRs. The first release does not automatically turn payment receipts into reward codes; staff issues a unique code after verifying a purchase. QR generation is local in the admin browser; tokens are not sent to a third-party QR service.

## Backend and analytics

Two second-generation callable functions: `hamsterGame` and `hamsterAdmin` in `us-central1`.

Firestore root: `stores/kyrgyz-organics/games/hamster-spin`. Collections: `players`, player `requests`, `settings/main`, `coupons`, `purchaseCodes`, `batches`, `events`, `metrics`, `visits`, `adminAudit`.

All balance changes are server transactions. Request IDs make retries idempotent; purchase-code consumption and spin grants commit together. Client Firestore access to these paths remains denied by the existing production default-deny rules. Staff permissions are checked from the existing `users/{uid}` role and company. No Firestore rules relaxation is required.

Overview reports server-confirmed spins, wins/losses, seeds awarded/spent, daily claims, purchase scans, coupon claims/collection, and daily unique active players. Players and coupons show the latest 50; daily metrics show the latest month and lifetime totals. No automatic retention deletion is configured yet.

## Release and checks

Deploy functions before the website: `firebase deploy --only functions:hamsterGame,functions:hamsterAdmin --project oa-kyrgyz-organic`. On slow Windows hosts set `FUNCTIONS_DISCOVERY_TIMEOUT=120`.

The canonical `oako.kg` site is GitHub Pages from `main`; Firebase Hosting is also maintained. Release only the game and its admin/backend changes, excluding unrelated working files. Email/password and anonymous authentication must stay enabled and the site domain must be authorized.

- `node --test --experimental-test-isolation=none tests/hamster-game.test.cjs`
- `node tests/qr-payment.test.mjs`
- `node tests/hamster-ui.cjs` (UI fixtures; local Playwright path)
- `node tests/hamster-live.cjs` (explicit live smoke test using the signed-in gcloud account; temporary records/accounts and analytic contributions are cleaned up)
