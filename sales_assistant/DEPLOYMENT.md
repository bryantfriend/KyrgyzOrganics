# Production release — 21 October 2026

- Primary URL: https://oako.kg/sales_assistant/
- Firebase Hosting copy: https://oa-kyrgyz-organic.web.app/sales_assistant/
- Application release commit: `02e683191af8d3b1c48c9a7fe82697b0a2c78d1a`.
- GitHub Pages: `main`, repository root, custom domain `oako.kg`; build completed successfully.
- Firebase Hosting version: `16609fdfde80ef5c`.
- Previous Hosting version retained for rollback: `f814dfbb96593a59`.

The deployed Firestore rules were prepared from the active production rules, with only the Sales Assistant fragment added. They compiled successfully and were published before the frontend release. Existing staff roles, customer/product permissions, and unrelated rules were preserved. Functions, indexes and Storage rules were not deployed.

The Firebase Hosting release cloned its active version and added the 15 application runtime files plus the reserved `sales_assistant` company route. Existing hashes for all other files were verified unchanged; 376 pre-existing files and the original routing configuration were retained. GitHub Pages was fast-forwarded to the reviewed application release. Unrelated local edits and the local main branch were preserved.

## Verification

- 10 unit tests passed, including literal rules-fragment assembly regression coverage.
- 11 Firebase/repository groups and 11 browser/hosting groups passed from a clean release directory using the current production rules plus the additive fragment against local emulators.
- Both live URLs returned HTTP 200, loaded their actual Firebase SDK/assets, and displayed the staff sign-in screen.
- Direct navigation, refresh, and signed-out `#new` navigation passed on both live targets.
- No uncaught browser errors and no customer/enquiry reads before sign-in were observed.
- Anonymous production enquiry listing returned HTTP 403.
- Existing `/`, `/admin/admin.html`, `/dailybread/`, `/product.html`, `/hamster_game/`, `/p/`, `/q/` returned HTML successfully on both targets.

No synthetic production records or user accounts were created. Authenticated save/matching/follow-up behavior was verified in emulators; staff can now sign in with their own existing account for live use. Ilja requires an existing CRM-authorized staff account; this release does not create accounts or broaden access.

Local release backups and detailed verification artifacts are retained under ignored `output/sales-assistant/`. Rollback must preserve enquiry/customer data and all unrelated rules/routes; see the architecture README for the release procedure.
