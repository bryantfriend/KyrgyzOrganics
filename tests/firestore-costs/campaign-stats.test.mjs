import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignStatsRepository, CONVERSION_ACTIONS } from '../../admin/campaign-stats.mjs';
import { createReportCache } from '../../admin/reporting-repository.mjs';
import { createCatalogueMutations } from '../../admin/catalogue-mutations.mjs';

function fixture(docs, extra = {}) {
  const calls = [];
  const equal = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));
  const matches = (doc, filters) => filters.every(([key, op, value]) => {
    if (!(key in doc)) return false;
    if (op === '==') return equal(doc[key], value);
    if (op === 'in') return value.some(v => equal(doc[key], v));
    if (op === 'not-in') return doc[key] !== null && !value.some(v => equal(doc[key], v));
    throw new Error(op);
  });
  const sdk = {
    collection: (_, name) => name,
    where: (...args) => args,
    query: (name, ...filters) => ({ name, filters }),
    async getCountFromServer(q) { calls.push(['count', q]); return { data: () => ({ count: docs.filter(d => matches(d, q.filters)).length }) }; },
    async getDocs(q) { calls.push(['docs', q]); return { docs: docs.filter(d => matches(d, q.filters)).map(d => ({ data: () => d })) }; },
    ...extra
  };
  const repo = createCampaignStatsRepository({ db: {}, firestore: sdk, defaultCompanyId: 'default' });
  return { repo, calls };
}

test('conversion aggregates preserve action, campaign and legacy store semantics', async () => {
  const companyValues = ['default', 'other', '', false, 0, NaN, null, undefined, 42, true];
  const docs = companyValues.flatMap(companyId => CONVERSION_ACTIONS.map(actionType => ({ campaignId: 'prime-mun', actionType, ...(companyId === undefined ? {} : { companyId }) })));
  docs.push({ companyId: 'default', campaignId: 'another', actionType: 'cta_click' }, { companyId: 'default', campaignId: 'prime-mun', actionType: 'page_view' });
  const { repo, calls } = fixture(docs);
  const expected = docs.filter(d => d.campaignId === 'prime-mun' && CONVERSION_ACTIONS.includes(d.actionType) && (!d.companyId || d.companyId === 'default')).length;
  assert.equal(await repo.getConversionCount('default'), expected);
  assert.equal(await repo.getConversionCount('other'), 3);
  assert.equal(calls.filter(c => c[0] === 'docs').length, 0);
  assert.equal(await repo.getLegacyConversionCount('default'), expected);
});

test('concurrent and repeated counts coalesce; invalidation forces fresh scope', async () => {
  const { repo, calls } = fixture([{ companyId: 'other', campaignId: 'prime-mun', actionType: 'cta_click' }]);
  assert.deepEqual(await Promise.all([repo.getConversionCount('other'), repo.getConversionCount('other')]), [1, 1]);
  assert.equal(calls.length, 1);
  assert.equal(await repo.getConversionCount('other'), 1);
  assert.equal(calls.length, 1);
  repo.invalidate();
  await repo.getConversionCount('other');
  assert.equal(calls.length, 2);
});

test('missing indexes do not trigger an automatic full-history fallback or become zero', async () => {
  const { repo, calls } = fixture([], { getCountFromServer: async () => { throw Object.assign(new Error('index'), { code: 'failed-precondition' }); } });
  await assert.rejects(repo.getConversionCount('other'), /index/);
  assert.equal(calls.filter(c => c[0] === 'docs').length, 0);
});

test('catalogue invalidation follows success and the captured store, not active store after await', async () => {
  let company = 'store-a';
  let finish;
  const invalidated = [];
  const sdk = { addDoc: () => new Promise(resolve => { finish = resolve; }), updateDoc: async () => { throw new Error('denied'); }, deleteDoc: async () => 'deleted' };
  const mutations = createCatalogueMutations({ sdk, getCompanyId: () => company, invalidate: id => invalidated.push(id) });
  const pending = mutations.addDoc('products', {});
  company = 'store-b';
  assert.deepEqual(invalidated, []);
  finish('created');
  assert.equal(await pending, 'created');
  assert.deepEqual(invalidated, ['store-a']);
  await assert.rejects(mutations.updateDoc('products/id', {}), /denied/);
  assert.deepEqual(invalidated, ['store-a']);
  await mutations.deleteDoc('products/id');
  assert.deepEqual(invalidated, ['store-a', 'store-b']);
});
