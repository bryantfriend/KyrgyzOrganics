# Campaign aggregation integration check

Run explicitly with Java 21+ and Node.js 22+:

```sh
bash tests/firestore-costs/run-emulator-validation.sh
```

The runner installs exact official versions Firebase Web SDK 10.7.1 and
firebase-tools 15.34.1 into a temporary package. The latter supplies Firestore
emulator 1.22.0. It uses only the local `demo-cost-tests` project and copies the
pure repository modules, never the production Firebase configuration. It seeds
and reads synthetic local fixtures and removes its temporary package afterward.
An already occupied port 18780 is a blocker; do not point this test at a real
project or remove its project/endpoint assertions.

## Independently verified result, 2026-10-22

For each conversion action (`cta_click`, `click_whatsapp`, `click_glovo`), fourteen
fixtures cover company IDs missing, null, empty string, false, 0, -0, NaN, the
default store, another store, true, 1, empty array, empty map, and string `0`.
Eight belong to the default store under the existing JavaScript falsy-value
compatibility rule. Other campaigns and non-conversion actions are also excluded.

Both emulator 1.19.8 (firebase-tools 14.22.0) and emulator 1.22.0 returned:

- Total: 14.
- Foreign count using `not-in [default, '', false, 0, NaN]`: 7.
- Foreign count using `not-in [default, '', false, 0]`: 7.
- Explicit `companyId == NaN` count: 1.
- Original subtraction: 7, incorrect for this fixture.
- Corrected subtraction plus explicit NaN count: 8, matching the legacy filter.

Therefore the implementation must not assume NaN inside the mixed `not-in`
array is excluded by the emulator. Explicit NaN equality compiles to `IS_NAN`.
The test also exercises the current repository, not just the arithmetic.

This verifies local SDK/query semantics, not production data or index readiness.
Firestore Emulator does not enforce production composite-index requirements.
Deploy the required indexes separately and confirm readiness before expecting
production aggregation queries to succeed. No production reads or writes were
used for this validation.
