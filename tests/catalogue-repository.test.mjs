import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
    CATALOGUE_CACHE_KEY,
    CATALOGUE_INVALIDATION_EVENT,
    CATALOGUE_INVALIDATION_KEY,
    connectCatalogueInvalidation,
    createCatalogueCache,
    createCatalogueRepository
} from '../storefront/catalogue-repository.mjs';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

function mockFirestore(data, { beforeRead = async () => {} } = {}) {
    const reads = [];
    const document = (name, id) => ({
        id,
        exists: () => Object.hasOwn(data[name] || {}, id),
        data: () => data[name]?.[id]
    });
    const sdk = {
        collection: (_db, name) => ({ name }),
        where: (field, operator, value) => ({ field, operator, value }),
        query: (reference, ...filters) => ({ ...reference, filters }),
        doc: (_db, name, id) => ({ name, id }),
        async getDocs(request) {
            reads.push({ type: 'query', ...request });
            await beforeRead(request);
            return {
                docs: Object.entries(data[request.name] || {})
                    .filter(([, value]) => request.filters.every(filter => filter.operator === '==' && value[filter.field] === filter.value))
                    .map(([id]) => document(request.name, id))
            };
        },
        async getDoc(request) {
            reads.push({ type: 'document', ...request });
            await beforeRead(request);
            return document(request.name, request.id);
        }
    };
    return { sdk, reads };
}

const catalogueFixture = () => ({
    products: {
        a: { companyId: 'alpha', active: true, slug: 'bread', name_en: 'Bread', name_ru: 'Хлеб' },
        b: { companyId: 'beta', active: true, slug: 'bread' },
        hidden: { companyId: 'alpha', active: false },
        legacy: { active: true, slug: 'bread' },
        default: { companyId: 'kyrgyz-organics', active: true },
        missingActive: { companyId: 'alpha' }
    },
    categories: { a: { companyId: 'alpha', active: true }, b: { companyId: 'beta', active: true }, legacy: { active: true } },
    product_collections: { a: { companyId: 'alpha', active: true, slug: 'popular', productIds: ['a', 'b', 'hidden', 'a'] } },
    payment_methods: { a: { companyId: 'alpha', active: true, account: 'public account' } }
});

function repository(data = catalogueFixture(), options = {}) {
    const mock = mockFirestore(data, options);
    return { ...mock, repo: createCatalogueRepository({ db: {}, sdk: mock.sdk, ...options }), data };
}

const ids = values => values.map(value => value.id);

test('nondefault active queries are company-scoped and isolated across stores/collections', async () => {
    const { repo, reads } = repository();
    assert.deepEqual(ids(await repo.listActive('alpha', 'products')), ['a']);
    assert.deepEqual(ids(await repo.listActive('beta', 'products')), ['b']);
    assert.deepEqual(ids(await repo.listActive('alpha', 'categories')), ['a']);
    assert.equal(reads.length, 3);
    for (const request of reads) {
        assert.ok(request.filters.some(filter => filter.field === 'companyId'));
        assert.ok(request.filters.some(filter => filter.field === 'active' && filter.value === true));
    }
    const product = (await repo.listActive('alpha', 'products'))[0];
    assert.equal(product.name_ru, 'Хлеб');
    product.name_ru = 'mutated';
    assert.equal((await repo.listActive('alpha', 'products'))[0].name_ru, 'Хлеб');
    assert.equal(reads.length, 3);
});

test('default compatibility query retains missing/null/empty company IDs and caches the filtered result only', async () => {
    const data = catalogueFixture();
    data.products.nullCompany = { companyId: null, active: true };
    data.products.emptyCompany = { companyId: '', active: true };
    const storage = memoryStorage();
    const { repo, reads } = repository(data, { cache: createCatalogueCache({ storage }) });
    assert.deepEqual(ids(await repo.listActive('kyrgyz-organics', 'products')), ['legacy', 'default', 'nullCompany', 'emptyCompany']);
    assert.equal(reads[0].filters.some(filter => filter.field === 'companyId'), false);
    await repo.listActive('kyrgyz-organics', 'products');
    assert.equal(reads.length, 1);
    assert.equal(storage.getItem(CATALOGUE_CACHE_KEY).includes('alpha'), false);
});

test('audited per-collection migration gate scopes default company queries', async () => {
    const { repo, reads } = repository(undefined, { isCompanyIdMigrationComplete: name => name === 'products' });
    assert.deepEqual(ids(await repo.listActive('kyrgyz-organics', 'products')), ['default']);
    assert.deepEqual(ids(await repo.listActive('kyrgyz-organics', 'categories')), ['legacy']);
    assert.ok(reads[0].filters.some(filter => filter.field === 'companyId' && filter.value === 'kyrgyz-organics'));
    assert.equal(reads[1].filters.some(filter => filter.field === 'companyId'), false);
});

test('slug queries scope nondefault stores and do not truncate legacy results before filtering', async () => {
    const data = catalogueFixture();
    data.products = Object.fromEntries([
        ...Array.from({ length: 15 }, (_, i) => [`other-${i}`, { companyId: 'other', slug: 'bread', active: true }]),
        ...Object.entries(data.products)
    ]);
    const { repo, reads } = repository(data);
    assert.equal((await repo.findBySlug('alpha', 'products', 'bread')).id, 'a');
    assert.equal((await repo.findBySlug('kyrgyz-organics', 'products', 'bread')).id, 'legacy');
    assert.ok(reads[0].filters.some(filter => filter.field === 'companyId'));
    assert.equal(reads[1].filters.some(filter => filter.field === 'companyId'), false);
});

test('product ID links preserve inactive/missing-active visibility while enforcing company isolation', async () => {
    const { repo, reads } = repository();
    assert.equal((await repo.findById('alpha', 'products', 'a')).id, 'a');
    assert.equal((await repo.findById('alpha', 'products', 'hidden')).active, false);
    assert.equal((await repo.findById('alpha', 'products', 'missingActive')).id, 'missingActive');
    for (const id of ['b', 'legacy', 'missing']) assert.equal(await repo.findById('alpha', 'products', id), null);
    assert.equal((await repo.findById('kyrgyz-organics', 'products', 'legacy')).id, 'legacy');
    assert.equal(await repo.findById('beta', 'products', 'a'), null);
    const before = reads.length;
    assert.equal(await repo.findById('alpha', 'products', 'bad/path'), null);
    assert.equal(reads.length, before);
});

test('collection ID links preserve missing-active legacy behavior but reject inactive/foreign collections', async () => {
    const data = catalogueFixture();
    data.product_collections.legacy = { productIds: ['legacy'] };
    data.product_collections.hidden = { active: false };
    const { repo } = repository(data);
    assert.equal((await repo.findById('kyrgyz-organics', 'product_collections', 'legacy')).id, 'legacy');
    assert.equal(await repo.findById('kyrgyz-organics', 'product_collections', 'hidden'), null);
    assert.equal(await repo.findById('alpha', 'product_collections', 'legacy'), null);
});

test('collection products fetch only unique referenced IDs, preserve order/duplicates and never scan products', async () => {
    const { repo, reads } = repository();
    const collection = { id: 'featured', companyId: 'alpha', active: true, productIds: ['a', 'b', 'hidden', 'a', 'bad/path', null] };
    assert.deepEqual(ids(await repo.collectionProducts('alpha', collection)), ['a', 'a']);
    assert.deepEqual(reads.map(read => [read.type, read.name, read.id]), [
        ['document', 'products', 'a'], ['document', 'products', 'b'], ['document', 'products', 'hidden']
    ]);
    assert.deepEqual(await repo.collectionProducts('beta', collection), []);
    assert.deepEqual(await repo.collectionProducts('alpha', { ...collection, productIds: [] }), []);
    await repo.collectionProducts('alpha', collection);
    assert.equal(reads.length, 3);
});

test('legacy collection products use direct IDs without a full compatibility scan', async () => {
    const { repo, reads } = repository();
    assert.deepEqual(ids(await repo.collectionProducts('kyrgyz-organics', { id: 'legacy-list', productIds: ['legacy', 'default', 'a'] })), ['legacy', 'default']);
    assert.equal(reads.every(read => read.type === 'document'), true);
});

test('collection direct-read concurrency is bounded to eight', async () => {
    let active = 0;
    let maximum = 0;
    const data = { products: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [`p${i}`, { companyId: 'alpha', active: true }])) };
    const { repo, reads } = repository(data, { beforeRead: async () => {
        maximum = Math.max(maximum, ++active);
        await new Promise(resolve => setTimeout(resolve, 1));
        active--;
    } });
    const products = await repo.collectionProducts('alpha', { companyId: 'alpha', productIds: Object.keys(data.products) });
    assert.equal(products.length, 35);
    assert.equal(maximum, 8);
    await repo.collectionProducts('alpha', { companyId: 'alpha', productIds: Object.keys(data.products) });
    assert.equal(reads.length, 35, 'group cache reuses collections larger than the individual entry budget');
});

test('home catalogue cache serves collection and product navigation without more reads, across page instances', async () => {
    const storage = memoryStorage();
    const { repo, sdk, reads } = repository(undefined, { cache: createCatalogueCache({ storage }) });
    await repo.listActive('alpha', 'products');
    const nextPage = createCatalogueRepository({ sdk, db: {}, cache: createCatalogueCache({ storage }) });
    assert.deepEqual(ids(await nextPage.collectionProducts('alpha', { companyId: 'alpha', productIds: ['a', 'hidden'] })), ['a']);
    assert.equal((await nextPage.findById('alpha', 'products', 'a')).id, 'a');
    assert.equal((await nextPage.findBySlug('alpha', 'products', 'bread')).id, 'a');
    assert.equal(reads.length, 1);
});

test('payment methods remain uncached and sensitive collections are rejected before reads', async () => {
    const storage = memoryStorage();
    const { repo, reads } = repository(undefined, { cache: createCatalogueCache({ storage }) });
    await repo.listActive('alpha', 'payment_methods');
    await repo.listActive('alpha', 'payment_methods');
    assert.equal(reads.length, 2);
    assert.equal(storage.getItem(CATALOGUE_CACHE_KEY), null);
    for (const collection of ['users', 'orders', 'inventory', 'business_accounts']) {
        await assert.rejects(repo.listActive('alpha', collection), /Not a public catalogue collection/);
        await assert.rejects(repo.findById('alpha', collection, 'id'), /Not a public catalogue collection/);
    }
    assert.equal(reads.length, 2);
});

test('concurrent requests coalesce, results are independent clones, and failures can be retried', async () => {
    const cache = createCatalogueCache();
    let calls = 0;
    const loader = async () => { calls++; return [{ id: 'a' }]; };
    const values = await Promise.all(Array.from({ length: 10 }, () => cache.get('alpha', 'products', loader)));
    assert.equal(calls, 1);
    values[0][0].id = 'changed';
    assert.equal(values[1][0].id, 'a');
    await assert.rejects(cache.get('alpha', 'failure', async () => { throw new Error('offline'); }), /offline/);
    assert.equal(await cache.get('alpha', 'failure', async () => 'recovered'), 'recovered');
});

test('TTL expires without sliding on access and persisted stale entries cannot be revived', async () => {
    let time = 1_000;
    let calls = 0;
    const storage = memoryStorage();
    const options = { storage, now: () => time, ttlMs: 100 };
    const cache = createCatalogueCache(options);
    const loader = async () => ++calls;
    assert.equal(await cache.get('alpha', 'products', loader), 1);
    time = 1_099;
    assert.equal(await cache.get('alpha', 'products', loader), 1);
    time = 1_100;
    assert.equal(await createCatalogueCache(options).get('alpha', 'products', loader), 2);
    time = 1_101;
    assert.equal(await cache.get('alpha', 'products', loader), 3);
});

test('entry count and byte bounds evict LRU or oversized data but never fail a fetch', async () => {
    const storage = memoryStorage();
    const cache = createCatalogueCache({ storage, maxEntries: 2, maxBytes: 1_024 });
    await cache.get('alpha', 'a', async () => 'a');
    await cache.get('alpha', 'b', async () => 'b');
    cache.peek('alpha', 'a');
    await cache.get('alpha', 'c', async () => 'c');
    assert.equal(cache.peek('alpha', 'b'), undefined);
    assert.equal(cache.peek('alpha', 'a'), 'a');
    const large = 'x'.repeat(1_024);
    assert.equal(await cache.get('alpha', 'large', async () => large), large);
    assert.equal(cache.peek('alpha', 'large'), undefined);
    assert.ok((storage.getItem(CATALOGUE_CACHE_KEY)?.length || 0) * 2 <= 1_024);
});

test('corrupt JSON and invalid persisted entry schemas fall back to fresh queries', async () => {
    for (const raw of ['not json', '{"version":1,"entries":{}}', JSON.stringify({ version: 1, entries: [{ companyId: 'alpha', key: 'products:scoped:active', json: '{"oops":1}', createdAt: 1_000, expiresAt: 1_100 }] })]) {
        const storage = memoryStorage({ [CATALOGUE_CACHE_KEY]: raw });
        const { repo, reads } = repository(undefined, { cache: createCatalogueCache({ storage, now: () => 1_000 }) });
        assert.deepEqual(ids(await repo.listActive('alpha', 'products')), ['a']);
        assert.equal(reads.length, 1);
    }
});

test('corrupt cache cannot leak another store or inactive documents', async () => {
    const cache = createCatalogueCache();
    await cache.get('alpha', 'products:scoped:active', async () => [
        { id: 'a', companyId: 'alpha', active: true },
        { id: 'foreign', companyId: 'beta', active: true },
        { id: 'inactive', companyId: 'alpha', active: false },
        { id: 'legacy', active: true }
    ]);
    const { repo } = repository(undefined, { cache });
    assert.deepEqual(ids(await repo.listActive('alpha', 'products')), ['a']);
    assert.equal(await repo.findById('alpha', 'products', 'foreign'), null);
});

test('quota/storage failures preserve bounded in-memory results', async () => {
    const storage = {
        getItem() { throw new Error('storage denied'); },
        setItem() { throw new Error('QuotaExceededError'); },
        removeItem() { throw new Error('storage denied'); }
    };
    const { repo, reads } = repository(undefined, { cache: createCatalogueCache({ storage }) });
    assert.deepEqual(ids(await repo.listActive('alpha', 'products')), ['a']);
    assert.deepEqual(ids(await repo.listActive('alpha', 'products')), ['a']);
    assert.equal(reads.length, 1);
});

test('Firestore timestamps and Dates remain usable after persistent cache round-trip', async () => {
    const storage = memoryStorage();
    const first = createCatalogueCache({ storage });
    const value = await first.get('alpha', 'banners', async () => ({ startAt: { toDate: () => new Date('2026-10-01T00:00:00Z') }, endAt: new Date('2026-11-01T00:00:00Z') }));
    const persisted = createCatalogueCache({ storage }).peek('alpha', 'banners');
    assert.deepEqual(persisted, value);
    assert.equal(new Date(persisted.startAt).toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(new Date(persisted.endAt).toISOString(), '2026-11-01T00:00:00.000Z');
});

test('invalidation clears only the selected company and prevents old in-flight reads refilling the cache', async () => {
    const cache = createCatalogueCache();
    await cache.get('beta', 'products', async () => 'beta');
    let resolveOld;
    const old = cache.get('alpha', 'products', () => new Promise(resolve => { resolveOld = resolve; }));
    await Promise.resolve();
    cache.invalidate('alpha');
    assert.equal(await cache.get('alpha', 'products', async () => 'new'), 'new');
    resolveOld('old');
    assert.equal(await old, 'old');
    assert.equal(cache.peek('alpha', 'products'), 'new');
    assert.equal(cache.peek('beta', 'products'), 'beta');
    cache.invalidate();
    assert.equal(cache.peek('alpha', 'products'), undefined);
    assert.equal(cache.peek('beta', 'products'), undefined);
});

test('same-tab and cross-tab invalidation hooks purge caches without cross-store collisions', async () => {
    const cache = createCatalogueCache();
    const target = new EventTarget();
    const storage = memoryStorage();
    const disconnect = connectCatalogueInvalidation({ cache, eventTarget: target, storage });
    await cache.get('alpha', 'products', async () => 'alpha');
    await cache.get('beta', 'products', async () => 'beta');
    const event = new Event(CATALOGUE_INVALIDATION_EVENT);
    event.detail = { companyId: 'alpha' };
    target.dispatchEvent(event);
    assert.equal(cache.peek('alpha', 'products'), undefined);
    assert.equal(cache.peek('beta', 'products'), 'beta');
    assert.equal(JSON.parse(storage.getItem(CATALOGUE_INVALIDATION_KEY)).companyId, 'alpha');
    const storageEvent = new Event('storage');
    Object.assign(storageEvent, { key: CATALOGUE_INVALIDATION_KEY, newValue: JSON.stringify({ companyId: 'beta' }) });
    target.dispatchEvent(storageEvent);
    assert.equal(cache.peek('beta', 'products'), undefined);
    disconnect();
});

test('all three public pages use repository reads and collection page contains no all-product scan', async () => {
    const files = await Promise.all(['home.js', 'collection-page.js', 'product-page.js'].map(name => readFile(new URL(`../${name}`, import.meta.url), 'utf8')));
    for (const content of files) assert.match(content, /import \{ catalogueRepository \} from '.\/storefront\/catalogue-repository.js'/);
    assert.match(files[0], /catalogueRepository\.listActive\(activeCompanyId, 'products'\)/);
    assert.match(files[1], /catalogueRepository\.collectionProducts/);
    assert.doesNotMatch(files[1], /getDocs\(/);
    assert.match(files[2], /catalogueRepository\.findById\(companyId, 'products', productId\)/);
});


test('public campaign timeline reads scope stores without excluding historic records or caching', async () => {
    const data = { campaigns: { alpha: { companyId: 'alpha', active: false }, beta: { companyId: 'beta' }, legacy: {} } };
    const storage = memoryStorage();
    const { repo, reads } = repository(data, { cache: createCatalogueCache({ storage }) });
    assert.deepEqual(ids(await repo.listCampaigns('alpha')), ['alpha']);
    assert.deepEqual(ids(await repo.listCampaigns('kyrgyz-organics')), ['legacy']);
    assert.deepEqual(reads[0].filters, [{ field: 'companyId', operator: '==', value: 'alpha' }]);
    assert.deepEqual(reads[1].filters, []);
    assert.equal(storage.getItem(CATALOGUE_CACHE_KEY), null);
});


test('active-list cache does not hide inactive or missing-active explicit product IDs', async () => {
    const { repo } = repository();
    await repo.listActive('alpha', 'products');
    assert.equal((await repo.findById('alpha', 'products', 'hidden')).active, false);
    assert.equal((await repo.findById('alpha', 'products', 'missingActive')).id, 'missingActive');
    assert.equal(await repo.findById('beta', 'products', 'hidden'), null);
    assert.equal(await repo.findBySlug('alpha', 'products', 'not-active'), null);
    assert.deepEqual(ids(await repo.collectionProducts('alpha', { companyId: 'alpha', productIds: ['a', 'hidden', 'missingActive'] })), ['a']);
});
