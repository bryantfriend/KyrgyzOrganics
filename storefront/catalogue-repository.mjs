// Public catalogue only. Never pass customer, auth, order or payment records to this cache.
export const CATALOGUE_CACHE_KEY = 'oako:public-catalogue:v1';
export const CATALOGUE_INVALIDATION_KEY = 'oako:catalogue-invalidation:v1';
export const CATALOGUE_INVALIDATION_EVENT = 'oako:catalogue-invalidated';
const CACHE_VERSION = 1;
const CACHED_COLLECTIONS = new Set(['products', 'categories', 'banners', 'product_collections']);
const READABLE_COLLECTIONS = new Set([...CACHED_COLLECTIONS, 'payment_methods']);

function cloneJson(json) {
    return JSON.parse(json);
}

// Date and Firestore Timestamp fields must have the same representation after navigation.
function serialize(value) {
    return JSON.stringify(value, function (key, item) {
        const original = this[key];
        return original && typeof original.toDate === 'function' ? original.toDate().toISOString() : item;
    });
}

export function createCatalogueCache({
    storage = null,
    storageKey = CATALOGUE_CACHE_KEY,
    now = Date.now,
    ttlMs = 120_000,
    maxEntries = 32,
    maxBytes = 2 * 1024 * 1024
} = {}) {
    if (!(ttlMs > 0) || !(maxEntries > 0) || !(maxBytes > 0)) throw new Error('Invalid catalogue cache bounds');
    const entries = new Map();
    const pending = new Map();
    const generations = new Map();
    let initialized = false;
    let nextToken = 0;
    const keyFor = (companyId, key) => JSON.stringify([companyId, key]);
    const generation = (companyId) => generations.get(companyId) || 0;
    const bytes = (entry) => JSON.stringify(entry).length * 2;

    function prune() {
        const time = now();
        for (const [key, entry] of entries) {
            if (entry.expiresAt <= time || entry.createdAt > time || entry.expiresAt > time + ttlMs) entries.delete(key);
        }
        let size = [...entries.values()].reduce((sum, entry) => sum + bytes(entry) + 2, 64);
        for (const [key, entry] of entries) {
            if (entries.size <= maxEntries && size <= maxBytes) break;
            entries.delete(key);
            size -= bytes(entry);
        }
    }

    function persist() {
        prune();
        try {
            if (entries.size) storage?.setItem(storageKey, JSON.stringify({ version: CACHE_VERSION, entries: [...entries.values()] }));
            else storage?.removeItem(storageKey);
        } catch (_) {
            // Quota exceeded, disabled storage, or private mode: keep the bounded memory cache.
            try { storage?.removeItem(storageKey); } catch (_) { /* Storage is optional. */ }
        }
    }

    function initialize() {
        if (initialized) return;
        initialized = true;
        try {
            const raw = storage?.getItem(storageKey);
            if (!raw) return;
            if (raw.length * 2 > maxBytes) throw new Error('Oversized catalogue cache');
            const saved = JSON.parse(raw);
            if (saved?.version !== CACHE_VERSION || !Array.isArray(saved.entries)) throw new Error('Invalid catalogue cache');
            for (const entry of saved.entries) {
                if (!entry || typeof entry.companyId !== 'string' || typeof entry.key !== 'string' || typeof entry.json !== 'string'
                    || !Number.isFinite(entry.createdAt) || !Number.isFinite(entry.expiresAt)
                    || entry.expiresAt - entry.createdAt > ttlMs || entry.expiresAt <= entry.createdAt) continue;
                try { cloneJson(entry.json); } catch (_) { continue; }
                entries.set(keyFor(entry.companyId, entry.key), entry);
            }
            prune();
        } catch (_) {
            entries.clear();
            try { storage?.removeItem(storageKey); } catch (_) { /* Storage is optional. */ }
        }
    }

    function peek(companyId, key, validate = () => true) {
        initialize();
        prune();
        const cacheKey = keyFor(companyId, key);
        const found = entries.get(cacheKey);
        if (!found) return undefined;
        const value = cloneJson(found.json);
        if (!validate(value)) {
            entries.delete(cacheKey);
            persist();
            return undefined;
        }
        entries.delete(cacheKey);
        entries.set(cacheKey, found);
        return value;
    }

    async function get(companyId, key, loader, validate = () => true) {
        if (typeof companyId !== 'string' || !companyId) throw new Error('A company ID is required');
        const found = peek(companyId, key, validate);
        if (found !== undefined) return found;
        const cacheKey = keyFor(companyId, key);
        if (pending.has(cacheKey)) return cloneJson(await pending.get(cacheKey).promise);
        const startedGeneration = generation(companyId);
        const token = ++nextToken;
        const promise = Promise.resolve().then(loader).then((value) => {
            const json = serialize(value);
            if (typeof json !== 'string') throw new Error('Catalogue loader returned invalid data');
            if (generation(companyId) === startedGeneration) {
                const createdAt = now();
                entries.set(cacheKey, { companyId, key, json, createdAt, expiresAt: createdAt + ttlMs });
                persist();
            }
            return json;
        }).finally(() => {
            if (pending.get(cacheKey)?.token === token) pending.delete(cacheKey);
        });
        pending.set(cacheKey, { promise, token, companyId });
        return cloneJson(await promise);
    }

    function invalidate(companyId) {
        initialize();
        const companies = companyId ? [companyId] : new Set([
            ...generations.keys(), ...[...entries.values()].map(entry => entry.companyId),
            ...[...pending.values()].map(entry => entry.companyId)
        ]);
        for (const company of companies) generations.set(company, generation(company) + 1);
        for (const [key, entry] of entries) if (!companyId || entry.companyId === companyId) entries.delete(key);
        for (const [key, entry] of pending) if (!companyId || entry.companyId === companyId) pending.delete(key);
        persist();
    }

    return { get, peek, invalidate };
}

// Pass the company explicitly and capture it before awaits; a store switch cannot change a request's scope.
export function createCatalogueRepository({ db, sdk, cache = createCatalogueCache(), defaultCompanyId = 'kyrgyz-organics', isCompanyIdMigrationComplete = () => false }) {
    const belongsToCompany = (value, companyId) => value?.companyId ? value.companyId === companyId : companyId === defaultCompanyId;
    const scopeMode = (companyId, name) => companyId !== defaultCompanyId || isCompanyIdMigrationComplete(name) ? 'scoped' : 'legacy';
    const fromDocument = (snapshot) => ({ ...snapshot.data(), id: snapshot.id });
    const assertReadable = (name) => {
        if (!READABLE_COLLECTIONS.has(name)) throw new Error(`Not a public catalogue collection: ${name}`);
    };
    const isDocument = value => value && typeof value === 'object' && !Array.isArray(value) && typeof value.id === 'string';
    const isDocumentList = value => Array.isArray(value) && value.every(isDocument);
    // Preserve explicit product-ID links, which historically did not require active=true.
    // Lists, slugs and collection membership still expose active products only.
    const isVisibleById = (name, value) => name === 'products' || (name === 'product_collections' ? value.active !== false : value.active === true);
    const cached = (companyId, name, key, loader, validate = isDocumentList) => CACHED_COLLECTIONS.has(name) ? cache.get(companyId, key, loader, validate) : loader();
    const activeCacheKey = (companyId, name) => `${name}:${scopeMode(companyId, name)}:active`;
    const cachedActive = (companyId, name) => CACHED_COLLECTIONS.has(name) ? cache.peek(companyId, activeCacheKey(companyId, name), isDocumentList) : undefined;
    function constraints(companyId, name) {
        return scopeMode(companyId, name) === 'scoped' ? [sdk.where('companyId', '==', companyId)] : [];
    }

    async function listActive(companyId, name) {
        assertReadable(name);
        const result = await cached(companyId, name, activeCacheKey(companyId, name), async () => {
            const snapshot = await sdk.getDocs(sdk.query(sdk.collection(db, name), ...constraints(companyId, name), sdk.where('active', '==', true)));
            return snapshot.docs.map(fromDocument).filter(value => value.active === true && belongsToCompany(value, companyId));
        });
        // Storage can be stale or corrupted. Never trust cached tenant/visibility fields blindly.
        return result.filter(value => value.active === true && belongsToCompany(value, companyId));
    }

    async function findBySlug(companyId, name, slug) {
        assertReadable(name);
        if (!slug) return null;
        const existing = cachedActive(companyId, name);
        if (existing) return existing.find(value => value.slug === slug && value.active === true && belongsToCompany(value, companyId)) || null;
        const mode = scopeMode(companyId, name);
        const matches = await cached(companyId, name, `${name}:${mode}:slug:${slug}`, async () => {
            // Do not limit a legacy query before tenant filtering: another store can share the slug.
            const snapshot = await sdk.getDocs(sdk.query(sdk.collection(db, name), ...constraints(companyId, name), sdk.where('slug', '==', slug), sdk.where('active', '==', true)));
            return snapshot.docs.map(fromDocument).filter(value => value.active === true && belongsToCompany(value, companyId));
        });
        return matches.find(value => value.slug === slug && value.active === true && belongsToCompany(value, companyId)) || null;
    }

    async function findById(companyId, name, id) {
        assertReadable(name);
        if (typeof id !== 'string' || !id || id.includes('/')) return null;
        // Active-list reuse avoids rereading products after home -> collection -> product navigation.
        // An absent active-list item cannot decide an explicit product/collection ID lookup:
        // those links retain their existing inactive/missing-active compatibility behavior.
        const existing = cachedActive(companyId, name);
        if (existing) {
            const match = existing.find(value => value.id === id && value.active === true && belongsToCompany(value, companyId));
            if (match) return match;
            if (name !== 'products' && name !== 'product_collections') return null;
        }
        const value = await cached(companyId, name, `${name}:id:${id}`, async () => {
            const snapshot = await sdk.getDoc(sdk.doc(db, name, id));
            if (!snapshot.exists()) return null;
            const data = fromDocument(snapshot);
            return isVisibleById(name, data) && belongsToCompany(data, companyId) ? data : null;
        }, value => value === null || isDocument(value));
        return value?.id === id && isVisibleById(name, value) && belongsToCompany(value, companyId) ? value : null;
    }

    async function collectionProducts(companyId, collectionData) {
        if (!collectionData || !belongsToCompany(collectionData, companyId) || collectionData.active === false) return [];
        const ids = Array.isArray(collectionData.productIds)
            ? collectionData.productIds.filter(id => typeof id === 'string' && id && !id.includes('/')) : [];
        if (!ids.length) return [];
        const existing = cachedActive(companyId, 'products');
        if (existing) {
            // Build this index once, rather than cloning/scanning the entire catalogue per ID.
            const byId = new Map(existing.filter(value => value.active === true && belongsToCompany(value, companyId)).map(value => [value.id, value]));
            return ids.map(id => byId.get(id)).filter(Boolean);
        }
        const key = `products:collection:${JSON.stringify([collectionData.id || '', ids])}`;
        const result = await cached(companyId, 'products', key, async () => {
            // Direct reads of referenced IDs preserve legacy default-company products.
            // Cache the group too, so collections larger than the per-ID entry budget still reuse their reads.
            const uniqueIds = [...new Set(ids)];
            const found = new Map();
            let cursor = 0;
            await Promise.all(Array.from({ length: Math.min(8, uniqueIds.length) }, async () => {
                while (cursor < uniqueIds.length) {
                    const id = uniqueIds[cursor++];
                    const product = await findById(companyId, 'products', id);
                    if (product?.active === true) found.set(id, product);
                }
            }));
            return ids.map(id => found.get(id)).filter(Boolean);
        });
        const selectedIds = new Set(ids);
        return result.filter(value => selectedIds.has(value.id) && value.active === true && belongsToCompany(value, companyId));
    }

    async function listCampaigns(companyId) {
        // Campaign timelines include past/future/inactive records; scope but do not change that selection or cache them.
        const snapshot = await sdk.getDocs(sdk.query(sdk.collection(db, 'campaigns'), ...constraints(companyId, 'campaigns')));
        return snapshot.docs.map(fromDocument).filter(value => belongsToCompany(value, companyId));
    }

    return { listActive, findBySlug, findById, collectionProducts, listCampaigns, invalidate: cache.invalidate };
}

// Same-tab events plus other-tab localStorage events. Cache data itself can remain in sessionStorage.
export function connectCatalogueInvalidation({ cache, eventTarget, storage = null }) {
    function receiveEvent(event) {
        const companyId = event.detail?.companyId;
        if (companyId !== undefined && (typeof companyId !== 'string' || !companyId)) return;
        cache.invalidate(companyId);
        try {
            storage?.setItem(CATALOGUE_INVALIDATION_KEY, JSON.stringify({ companyId: companyId || null, nonce: `${Date.now()}-${Math.random()}` }));
        } catch (_) { /* TTL remains the fallback when storage is blocked. */ }
    }
    function receiveStorage(event) {
        if (event.key !== CATALOGUE_INVALIDATION_KEY || !event.newValue) return;
        try {
            const message = JSON.parse(event.newValue);
            if (message.companyId === null || (typeof message.companyId === 'string' && message.companyId)) cache.invalidate(message.companyId || undefined);
        } catch (_) { /* Ignore unrelated or malformed events. */ }
    }
    eventTarget?.addEventListener(CATALOGUE_INVALIDATION_EVENT, receiveEvent);
    eventTarget?.addEventListener('storage', receiveStorage);
    return () => {
        eventTarget?.removeEventListener(CATALOGUE_INVALIDATION_EVENT, receiveEvent);
        eventTarget?.removeEventListener('storage', receiveStorage);
    };
}
