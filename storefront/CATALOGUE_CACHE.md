# Public catalogue reads and cache

`catalogue-repository.js` provides the browser singleton. The pure dependency-injected implementation is in `catalogue-repository.mjs`; tests use a mock Firestore SDK and never contact production.

## Read scope

- Products, categories, banners, active collections and payment methods are queried by company and active status for non-default stores.
- The default `kyrgyz-organics` store still includes legacy records with a missing, empty or null `companyId`, matching the existing company helper. Firestore cannot query missing fields. Until `hasCanonicalCompanyIds(collectionName)` is true in `read-model-readiness.mjs`, its list reads deliberately retain the legacy active-document scan and filter before caching. This compatibility path is **not fully read-optimized**.
- Enable each deployment-owned gate only after a separately approved backfill and verification of **all** documents and current writers in that collection. The older `migrate-companyId.js` does not include `product_collections`; do not assume it completes every required migration. No migration is run by this change.
- Slug lookups are tenant-scoped where possible. The legacy path does not apply an arbitrary limit before company filtering, which could hide the matching store behind another store's duplicate slugs.
- Collection pages read only referenced product document IDs, deduplicate network reads, keep the collection's display order and use at most eight concurrent reads. Active cached catalogue lists and per-ID cache entries are reused across public pages.
- Explicit product ID links preserve their original visibility behavior, including inactive and missing-active products, while enforcing company isolation. Active lists, slug lookups and collection product lists still require `active === true`. An absent item in an active-list cache therefore cannot short-circuit a direct product ID read. Explicit collection ID links retain the existing legacy `active !== false` behavior.
- Campaign timelines use scoped, uncached reads, retaining historic and future records. The default store uses the same migration gate and compatibility rule.

## Cache contract

- Allowed records: public `products`, `categories`, `banners`, `product_collections` only.
- Never cache payment methods, auth/customer profiles, orders, inventory, checkout settings or campaign data here. Payment-method reads are scoped but intentionally uncached because they may contain account identifiers. Inventory and checkout behavior remain separate.
- The cache is keyed by company, Firestore collection, lookup and legacy/scoped mode where applicable. It retains at most 32 entries and 2 MiB of serialized UTF-16 data for 120 seconds; access does not extend expiry. Oversized entries are returned normally but not retained.
- Same-tab navigation reuses `sessionStorage`; memory remains available when storage is disabled or full. Cache contents are intentionally not shared via `localStorage`. Corrupt, oversized, stale or structurally invalid entries cause fresh reads, never a failed catalogue solely because storage is unavailable.
- Concurrent identical reads share a promise. Returned JSON data is cloned so sorting/rendering cannot mutate a later caller's cached records. Date/Timestamp values become ISO date strings, including on the first load, so date filtering works identically before and after navigation.
- Cache results are not a security boundary or authoritative price/stock check. Tenant checks and the applicable lookup visibility rules are repeated on returned catalogue records, while checkout/stock validation remains authoritative outside this cache.

## Invalidation after successful changes

Import `invalidateCatalogueCache` from the browser wrapper and call it with the company ID captured for the completed write:

```js
import { invalidateCatalogueCache } from '../storefront/catalogue-repository.js';
await saveProductForCompany(companyId, product);
invalidateCatalogueCache(companyId);
```

Call after a successful create/edit/delete/import/active-status change to any cached collection. Invalidate the old **and** new company if ownership changes. Omit the company only for an operation affecting all stores. Do not invalidate on every render or read.

The wrapper also listens to `window` event `oako:catalogue-invalidated` with `{ detail: { companyId } }`. It clears the local company cache and writes a small nonce to `localStorage` key `oako:catalogue-invalidation:v1`; other same-origin tabs receive and apply it. No catalogue/payment/customer data is transmitted in this event. Pending pre-invalidation reads may finish for their original caller but cannot repopulate the cache. The event invalidates future reads, not already-rendered UI.

Cross-browser/device edits cannot deliver this same-origin signal; their fallback is the two-minute TTL. Already-open storefront pages do not auto-refresh or create polling/listener costs. Admin integration must call the hook for its successful mutations.

## Local verification

```sh
node --test tests/catalogue-repository.test.mjs
node --check home.js
node --check collection-page.js
node --check product-page.js
```

The suite covers store isolation, collection targeting, legacy compatibility and gates, cache reuse/coalescing, bounded concurrency/size/TTL, corrupt/quota storage, timestamp serialization, sensitive-data exclusions, and local/cross-tab/in-flight invalidation. A deployment smoke test should still verify default and non-default stores, ID and slug links, localization, inventory and payment rendering, plus cache invalidation after an authorized edit. No live database queries or writes are part of this unit suite.
