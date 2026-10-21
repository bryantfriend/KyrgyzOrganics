# Local verification — 21 October 2026

Implemented using the approved five-screen concept board. Verification used synthetic data and the local `demo-sales-assistant` Firebase project. No production records, rules, deployments, commits or pushes were changed by these tests.

| Check | Result |
| --- | --- |
| Sales Assistant domain/ICF unit tests | 10 passed |
| Firebase rules / repository integration groups | 11 passed |
| Browser / Firebase Hosting workflow groups | 11 passed |
| Existing website `.test.mjs` checks | 24 passed |
| JavaScript syntax and scoped whitespace checks | Passed |
| Five desktop screen captures | Generated and visually inspected |

Covered: direct `/sales_assistant` and `/sales_assistant/` entry and refresh; detail refresh with an authenticated session; login denial for non-staff; existing-role parity and forged-role denial; strict JSON parsing; missing/ambiguous information; manual prompt and reply copying; CRM and catalog matching; explicit customer creation; incomplete enquiries; duplicate messages and customer identities; concurrent customer creation; revision conflicts; save/reload; immutable source; atomic activity; missing/archived customers; inactive/other-store products; read/write denial; and private UI clearing on permission revocation.

Multilingual follow-up verification covers Russian, Urdu and Roman Urdu extraction-prompt inputs; English record/translation instructions; typed language metadata and length/type validation; unknown-language handling without English fallback; manual customer-language translation/review/copy; clearing stale translations when English content or reply language changes; reply-language persistence; and editing legacy enquiries without changing their immutable original extraction. Translation quality remains a staff-reviewed manual ChatGPT responsibility; no inference API is called by these tests.

Existing `/`, `/admin/admin.html`, `/dailybread/`, `/product.html`, `/hamster_game/`, `/p/`, `/q/` returned their HTML through the actual Firebase Hosting emulator. Their full independent workflows were not rerun in the browser; the existing website unit suite passed.

Screenshots are ignored test artifacts under `output/sales-assistant/`:

1. `01-dashboard.png`
2. `02-intake.png`
3. `03-review.png`
4. `04-matching.png`
5. `05-details.png`

Browser tests run the actual application and repository against Authentication/Firestore/Hosting emulators. Test-only browser interception supplies the emulator Firebase configuration and an installed Firebase SDK bundle; it does not add a production demo mode or authentication bypass. The manual ChatGPT boundary is exercised using representative JSON; tests do not operate ChatGPT or send WhatsApp messages.

Remaining release verification: reconcile the additive enquiry rules with the latest authoritative live rules; publish only after explicit approval; verify both real hosting targets and authorized staff access; complete the manual acceptance checklist. Offline interruption, clipboard-denial fallback and narrow-screen checks are included in that manual checklist. No live production verification is claimed.

See [README.md](README.md) for schema details, known duplicate/scaling limits, exact test commands, step-by-step manual verification, and deployment/rollback instructions.
