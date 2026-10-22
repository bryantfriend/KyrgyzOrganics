# Firestore read-cost rollout

## Changes that do not need a data migration

- Only the active authenticated admin tab starts reads/listeners. Leaving it detaches listeners; old store/auth responses cannot render. Already-started one-shot Firestore reads cannot be cancelled.
- Store changes invalidate hidden tabs instead of refreshing every tab. Stores metrics share pending requests across table, health panel and modal, with at most four concurrent store loads, a bounded 60-second cache and explicit refresh/error behavior.
- Stores product totals use count queries. Page-view totals use count queries plus the targeted legacy `type == page_view` subset to preserve `actionType || type` precedence. No general event-history download occurs for the summary. An explicit detail button retains the full breakdown, including unknown/custom event names. Existing operational latest-100 active order behavior is retained and labeled.
- Campaign click totals use count queries rather than a full-history listener. The default company preserves legacy falsy/missing company IDs using aggregate complement arithmetic, with explicit `IS_NAN` compensation. Counts are snapshots, not live subscriptions. Query errors are visible, never fabricated zeros. Missing indexes offer an explicit manual legacy snapshot button; no full-history fallback runs automatically. Manual snapshots cache only the count for 60 seconds.
- Public catalogue queries are company-scoped where safe; collection pages fetch referenced product IDs, not every active product. Public catalogue cache is bounded to 120 seconds, 32 entries and 2 MiB, with per-store keys, in-flight coalescing and successful-write/cross-tab invalidation. Payment methods, auth, inventory and orders are excluded. Existing direct-ID product visibility and legacy collection behavior are preserved.
- Reports retain selected/all-store semantics. Selected reports no longer fetch every company's metadata. Auth transitions invalidate private report caches. Report errors remain visible rather than becoming partial zero-filled reports.

## Deliberately incomplete until separately verified

`read-model-readiness.mjs` gates remain **false**. Do not enable them merely because new code was deployed.

1. Default-store catalogue lists must still scan active records across companies to retain old documents with missing/falsy company IDs. Caching reduces repeat downloads; targeted collection pages reduce their first load. Company-filtered default lists require an audited, approved backfill. The existing `migrate-companyId.js` omits `product_collections` and is not sufficient evidence.
2. Analytics still loads the selected scope's history on a cache miss because historical records may use `createdAt`, `timestamp` or `date`, including invalid/missing values. The date-range query path is implemented but disabled pending normalization. Explicit all-store reports remain all-store reports; there is no silent sample/limit.
3. Legacy `type == page_view` records still need a targeted document query for exact precedence. A verified canonical event-type field or maintained counters could remove this remaining subset read later.
4. Aggregate queries still scan billable index entries. They reduce document downloads, not all reads to zero. Separate aggregate requests are not a single transactional snapshot; inconsistent derived totals fail visibly and can be refreshed. No percentage or dollar saving is guaranteed.

## Index prerequisite

Proposed composite indexes are committed to `firestore.indexes.json`; a GitHub Pages publish does **not** deploy them. Existing production indexes have not been inspected. A Firebase administrator with existing authorized access should review the diff and deploy only these indexes, for example:

```sh
firebase deploy --only firestore:indexes --project oa-kyrgyz-organic
```

Do not deploy rules, functions, storage settings or migration scripts as part of that command. Wait for the indexes to report Ready, then verify aggregate queries in an authorized admin session. The campaign composite `(campaignId ASC, actionType ASC, companyId ASC)` supports the legacy complement and explicit NaN counts; the company-scoped alternative is included too. Product/event equality indexes and future company/date indexes are declared for review. Index build completion and query costs must be verified before removing compatibility paths.

## Future schema migration, not executed here

- Obtain separate approval for a backup, bounded audit/backfill, and production writes. Do not delete history or infer ownership of ambiguous records.
- Inventory every reader/writer, including deployed functions and older clients. Normalize company IDs only after validating the intended owner. Audit all collections listed in `READ_MODEL_READINESS.companyIds`, including collections omitted by older scripts.
- For dated collections, every record must receive `reportingDate: Timestamp | null`, matching the exact previous effective date: `createdAt || date` for orders, `createdAt || timestamp` for events. Invalid truthy values remain null instead of silently falling through. All current writers must maintain that field before enabling the gate.
- Compare report totals by company and date boundaries, including undated events, unknown/custom event types, all-store views and all-time collection detail. Finite date ranges exclude undated orders but retain undated events, matching existing behavior.
- Deploy/verify required indexes; enable gates one collection at a time only after full parity verification. If any check fails, leave the gate false.

## Validation and release

Tests use mocks or an isolated `demo-cost-tests` emulator, never the production project. Run:

```sh
node --test tests/*.test.mjs tests/firestore-costs/*.test.mjs tests/sales-assistant/domain.test.mjs
```

The local read-budget fixture with 1,009 events returns only 7 legacy page-view candidate documents plus two counts for a Stores summary, instead of 1,009 full documents. Product count queries return no product documents. These numbers describe the fixture only, not measured production volume or guaranteed billed savings.

Before release: review auth/store races, cache invalidation, data/report parity and the index limitations above. GitHub Pages has an established `main` build-and-deployment workflow; use a reviewed PR, then verify the workflow succeeded and the live served files match the release commit. Do not test cost reductions by repeatedly reading production history.

Rollback baseline: `0d1df64affdc0a71ad0291f533517fb2c96b7820`. Revert the release merge commit (do not force-reset main or remove concurrent work), publish through the same Pages workflow, and verify live file hashes. No records, security rules, credentials, functions or retention settings are changed by this frontend rollout.
