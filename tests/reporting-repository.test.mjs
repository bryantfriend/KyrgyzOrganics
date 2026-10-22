import assert from 'node:assert/strict';
import test from 'node:test';
import { createReportCache, createReportingRepository, filterReportRange, reportDate } from '../admin/reporting-repository.mjs';

function fakeFirestore(data) {
  const reads = [];
  let fail = false;
  const normal = (value) => typeof value?.toDate === 'function' ? value.toDate().getTime() : value instanceof Date ? value.getTime() : value;
  const execute = ({ name, constraints = [] }) => {
    let result = data[name] || [];
    for (const constraint of constraints) {
      if (constraint.kind === 'where') {
        const { field, op, value } = constraint;
        result = result.filter((row) => {
          // Firestore equality to null does NOT include missing fields.
          if (!Object.hasOwn(row, field)) return false;
          if (op === '==') return normal(row[field]) === normal(value);
          if (op === '>=') return row[field] !== null && normal(row[field]) >= normal(value);
          if (op === 'in') return value.includes(row[field]);
          throw new Error(`Unsupported operator ${op}`);
        });
      } else if (constraint.kind === 'orderBy') {
        result = result.filter((row) => Object.hasOwn(row, constraint.field)).slice().sort((a, b) => (normal(a[constraint.field]) - normal(b[constraint.field])) * (constraint.direction === 'desc' ? -1 : 1));
      } else if (constraint.kind === 'limit') result = result.slice(0, constraint.value);
    }
    return result;
  };
  return {
    reads,
    setFail(value) { fail = value; },
    sdk: {
      collection: (_db, name) => ({ name }),
      doc: (_db, name, id) => ({ name, id }),
      query: (ref, ...constraints) => ({ ...ref, constraints }),
      where: (field, op, value) => ({ kind: 'where', field, op, value }),
      orderBy: (field, direction) => ({ kind: 'orderBy', field, direction }),
      limit: (value) => ({ kind: 'limit', value }),
      async getDocs(ref) {
        if (fail) throw new Error('offline');
        const found = execute(ref);
        reads.push({ kind: 'docs', ...ref, documents: found.length });
        return { docs: found.map((row) => ({ id: row.id, data: () => ({ ...row }) })) };
      },
      async getCountFromServer(ref) {
        if (fail) throw new Error('offline');
        reads.push({ kind: 'count', ...ref, documents: 0 });
        return { data: () => ({ count: execute(ref).length }) };
      },
      async getDoc(ref) {
        if (fail) throw new Error('offline');
        const found = (data[ref.name] || []).find((item) => item.id === ref.id);
        reads.push({ kind: 'doc', ...ref, documents: found ? 1 : 0 });
        return { id: ref.id, exists: () => !!found, data: () => found };
      }
    }
  };
}
const makeRepo = (data, options = {}) => {
  const fake = fakeFirestore(data);
  const repository = createReportingRepository({ db: {}, firestore: fake.sdk, ...options });
  return { fake, repository };
};
const cutoff = new Date('2026-10-01T00:00:00Z');
const before = new Date(cutoff.getTime() - 1);
const after = new Date(cutoff.getTime() + 1);
const timestamp = (date) => ({ toDate: () => date });
const ids = (rows) => rows.map((row) => row.id).sort();

for (const collectionName of ['orders', 'storefront_events', 'campaign_events']) {
  for (const canonical of [false, true]) {
    test(`${collectionName}: ${canonical ? 'gated range queries' : 'compatibility cache'} preserve legacy dates and scopes`, async () => {
      const fallback = collectionName === 'orders' ? 'date' : 'timestamp';
      const records = [
        { id: 'before', companyId: 'a', createdAt: timestamp(before) },
        { id: 'boundary', companyId: 'a', createdAt: timestamp(cutoff) },
        { id: 'after', companyId: 'a', createdAt: after.toISOString() },
        { id: 'fallback', companyId: 'a', [fallback]: after.toISOString() },
        { id: 'false-created', companyId: 'a', createdAt: '', [fallback]: after },
        { id: 'invalid-overrides-fallback', companyId: 'a', createdAt: 'invalid', [fallback]: after },
        { id: 'old-overrides-fallback', companyId: 'a', createdAt: before, [fallback]: after },
        { id: 'undated', companyId: 'a' },
        { id: 'other-store', companyId: 'b', createdAt: after },
        { id: 'missing-company', createdAt: after },
        { id: 'null-company', companyId: null, createdAt: after }
      ].map((row) => ({ ...row, reportingDate: reportDate(row.createdAt || row[fallback]) }));
      const { repository, fake } = makeRepo({ [collectionName]: records }, { hasCanonicalDates: () => canonical });
      const expected = (scope) => records.filter((row) => scope === 'all' || row.companyId === 'a').filter((row) => {
        const date = reportDate(row.createdAt || row[fallback]);
        return date ? date >= cutoff : collectionName !== 'orders';
      });
      const selected = await repository.getRows(collectionName, { companyId: 'a', cutoff });
      assert.deepEqual(ids(selected), ids(expected('selected')));
      const requestCount = fake.reads.length;
      await repository.getRows(collectionName, { companyId: 'a', cutoff });
      assert.equal(fake.reads.length, requestCount, 'identical range reuses reads');
      const all = await repository.getRows(collectionName, { scope: 'all', cutoff });
      assert.deepEqual(ids(all), ids(expected('all')));
      const details = await repository.getRows(collectionName, { companyId: 'a', cutoff: null });
      assert.deepEqual(ids(details), ids(records.filter((row) => row.companyId === 'a')), 'detail/all time retains old history');
      if (canonical) {
        assert(fake.reads.some((read) => read.constraints?.some((constraint) => constraint.field === 'reportingDate' && constraint.op === '>=')));
      } else {
        assert(!fake.reads.some((read) => read.constraints?.some((constraint) => constraint.field === 'reportingDate')));
      }
      await assert.rejects(repository.getRows(collectionName, { cutoff }), /Select a store/);
      await assert.rejects(repository.getRows(collectionName, { scope: 'typo', companyId: 'a' }), /Invalid report scope/);
    });
  }
}

test('event summaries aggregate without downloading normal history and exactly retain actionType precedence', async () => {
  const events = [
    ...Array.from({ length: 1000 }, (_, index) => ({ id: `view-${index}`, companyId: 'a', actionType: 'page_view' })),
    { id: 'double-field', companyId: 'a', actionType: 'page_view', type: 'page_view' },
    { id: 'custom', companyId: 'a', actionType: 'custom_launch' },
    { id: 'conflict', companyId: 'a', actionType: 'other', type: 'page_view' },
    { id: 'legacy', companyId: 'a', type: 'page_view' },
    ...[null, '', false, 0].map((actionType, index) => ({ id: `falsey-${index}`, companyId: 'a', actionType, type: 'page_view' })),
    { id: 'unknown', companyId: 'a' },
    { id: 'b', companyId: 'b', actionType: 'page_view' },
    { id: 'no-company', actionType: 'page_view' }
  ];
  const { fake, repository } = makeRepo({ storefront_events: events });
  const scoped = events.filter((row) => row.companyId === 'a');
  const [first, second] = await Promise.all([repository.getEventSummary('a'), repository.getEventSummary('a')]);
  assert.strictEqual(first, second);
  assert.equal(first.analyticsEvents, scoped.length);
  assert.equal(first.pageViews, scoped.filter((row) => (row.actionType || row.type) === 'page_view').length);
  assert.equal(first.eventsByType, null, 'summary explicitly defers the dynamic type breakdown');
  assert.equal(fake.reads.length, 3);
  assert.equal(fake.reads.filter((read) => read.kind === 'count').length, 2);
  assert.equal(fake.reads.reduce((n, read) => n + read.documents, 0), 7, 'only targeted legacy candidates downloaded vs 1009 history records');
  const details = await repository.getRows('storefront_events', { companyId: 'a' });
  assert.equal(details.length, scoped.length);
  assert(details.some((row) => row.actionType === 'custom_launch'));
  await repository.getRows('storefront_events', { companyId: 'a' });
  assert.equal(fake.reads.length, 4, 'explicit detail is cached');
  assert.equal((await repository.getEventSummary('b')).pageViews, 1);
});

test('catalog product counts include missing/null/truthy active fields with zero document downloads', async () => {
  const products = [false, true, null, 0, '', undefined, 'false'].map((active, index) => ({ id: `${index}`, companyId: 'a', ...(active !== undefined ? { active } : {}) }));
  products.push({ id: 'b', companyId: 'b', active: false }, { id: 'legacy' });
  const { fake, repository } = makeRepo({ products });
  assert.deepEqual(await repository.getProductCounts('a'), { productsCount: 7, activeProducts: 6, inactiveProducts: 1 });
  assert.equal(fake.reads.length, 2);
  assert.equal(fake.reads.reduce((n, read) => n + read.documents, 0), 0);
});

test('operational order sample retains latest100 active scope, ordering and missing-date exclusion', async () => {
  const orders = Array.from({ length: 105 }, (_, id) => ({ id: String(id), companyId: 'a', status: 'new', createdAt: new Date(1000 + id) }));
  orders.push({ id: 'missing', companyId: 'a', status: 'new' }, { id: 'paid', companyId: 'a', status: 'complete', createdAt: after }, { id: 'b', companyId: 'b', status: 'new', createdAt: after });
  const { repository } = makeRepo({ orders });
  const rows = await repository.getActiveOrders('a', ['new']);
  assert.equal(rows.length, 100);
  assert.equal(rows[0].id, '104');
  assert.equal(rows.at(-1).id, '5');
});

test('selected store metadata is a document lookup, all stores is explicit', async () => {
  const { repository, fake } = makeRepo({ companies: [{ id: 'a' }, { id: 'b' }] });
  assert.deepEqual(await repository.getStores({ companyId: 'a' }), [{ id: 'a' }]);
  assert.equal(fake.reads[0].kind, 'doc');
  assert.equal((await repository.getStores({ scope: 'all' })).length, 2);
});

test('failed loads are not cached as zero success and refresh/invalidation read current data', async () => {
  const data = { products: [{ id: '1', companyId: 'a' }], storefront_events: [] };
  const { repository, fake } = makeRepo(data);
  fake.setFail(true);
  await assert.rejects(repository.getProductCounts('a'), /offline/);
  await assert.rejects(repository.getEventSummary('a'), /offline/);
  assert.equal(repository.cache.size, 0);
  fake.setFail(false);
  assert.equal((await repository.getProductCounts('a')).productsCount, 1);
  data.products.push({ id: '2', companyId: 'a' });
  assert.equal((await repository.getProductCounts('a')).productsCount, 1);
  assert.equal((await repository.getProductCounts('a', { force: true })).productsCount, 2);
  data.products.push({ id: '3', companyId: 'a' });
  repository.invalidate({ companyId: 'a' });
  assert.equal((await repository.getProductCounts('a')).productsCount, 3);
});

test('single-flight dedupes concurrent refresh, expires, evicts and supersedes invalidated pending work', async () => {
  let now = 0;
  const cache = createReportCache({ now: () => now, ttlMs: 10, maxEntries: 2, maxDocuments: 3 });
  let calls = 0;
  let finish;
  const loader = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const a = cache.get('a', loader);
  const a2 = cache.get('a', loader, { force: true });
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.strictEqual(a, a2);
  finish([1]);
  await a;
  assert.deepEqual(await cache.get('a', () => assert.fail('cached')), [1]);
  now = 11;
  assert.deepEqual(await cache.get('a', () => [2]), [2]);
  await cache.get('b', () => [3, 4]);
  await cache.get('c', () => [5, 6]);
  assert.equal(cache.size, 1);
  assert.equal(cache.documents, 2);
  await cache.get('too-big', () => [1, 2, 3, 4]);
  assert.equal(cache.size, 1);
  const old = cache.get('old', loader);
  await Promise.resolve();
  cache.invalidate();
  await cache.get('old', () => ['new']);
  finish(['stale']);
  await old;
  assert.deepEqual(await cache.get('old', () => assert.fail('new value should be cached')), ['new']);
});

test('canonical date query downloads only the requested interval and null events', async () => {
  const history = Array.from({ length: 500 }, (_, index) => ({ id: `old-${index}`, companyId: 'a', createdAt: before, reportingDate: before }));
  history.push({ id: 'new', companyId: 'a', createdAt: after, reportingDate: after }, { id: 'undated', companyId: 'a', reportingDate: null });
  const { repository, fake } = makeRepo({ storefront_events: history }, { hasCanonicalDates: () => true });
  assert.equal((await repository.getRows('storefront_events', { companyId: 'a', cutoff })).length, 2);
  assert.equal(fake.reads.reduce((n, read) => n + read.documents, 0), 2);
  assert.deepEqual(ids(filterReportRange(history, 'storefront_events', cutoff)), ['new', 'undated']);
});


test('concurrently inconsistent aggregate snapshots fail visibly and are not cached', async () => {
  for (const kind of ['products', 'events']) {
    const fake = fakeFirestore({});
    fake.sdk.getCountFromServer = async (ref) => ({ data: () => ({ count: ref.constraints.length > 1 ? 3 : 2 }) });
    const repository = createReportingRepository({ db: {}, firestore: fake.sdk });
    const load = () => kind === 'products' ? repository.getProductCounts('a') : repository.getEventSummary('a');
    await assert.rejects(load(), /changed while loading counts/);
    assert.equal(repository.cache.size, 0);
    fake.sdk.getCountFromServer = async () => ({ data: () => ({ count: 0 }) });
  }
});
