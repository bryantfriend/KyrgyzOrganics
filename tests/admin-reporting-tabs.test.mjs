import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import * as collectionAnalytics from '../collection-analytics.mjs';
import * as granolaAnalytics from '../granola-purchase-analytics.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const document = { getElementById: () => null, querySelector: () => null };
function loadClass(source, name, context = {}) {
  const stripped = source.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '').replace(`export class ${name}`, `class ${name}`);
  const globals = { BaseTab: class {}, document, console: { warn() {}, error() {} }, ...collectionAnalytics, ...granolaAnalytics, ...context };
  return new Function(...Object.keys(globals), `${stripped}\nreturn ${name};`)(...Object.values(globals));
}
const storesSource = await fs.readFile(new URL('../admin/tabs/StoresTab.js', import.meta.url), 'utf8');
const analyticsSource = await fs.readFile(new URL('../admin/tabs/AnalyticsTab.js', import.meta.url), 'utf8');
function storesTab(context = {}) {
  const auth = { currentUser: { uid: 'first-user' } };
  const Class = loadClass(storesSource, 'StoresTab', { getSelectedCompanyId: () => 'a', auth, reportingRepository: { version: 0 }, ...context });
  const tab = Object.create(Class.prototype);
  Object.assign(tab, {
    isActive: true, activity: 1, metricsCache: new Map(), metricsInFlight: new Map(), metricsQueue: [], metricsConcurrency: 4, metricsActive: 0,
    getActivityToken() { return this.activity; },
    isActivityCurrent(token) { return this.isActive && token === this.activity; },
    render() {}, renderStoreHealthAlerts() {},
  });
  return { tab, auth };
}

test('all Store metrics callers share one pending query set, including forced modal/health refresh', async () => {
  const { tab } = storesTab();
  const wait = deferred();
  let calls = 0;
  tab.loadMetricsForCompany = async () => { calls++; return wait.promise; };
  const table = tab.ensureMetricsLoaded('a');
  const health = tab.getMetricsForCompany('a');
  const modal = tab.getMetricsForCompany('a', { force: true });
  assert.strictEqual(table, health);
  assert.strictEqual(table, modal);
  assert.equal(calls, 1);
  wait.resolve({ ordersCount: 1, updatedAt: Date.now() });
  assert.equal((await table).ordersCount, 1);
  await flush();
  assert.equal((await tab.getMetricsForCompany('a')).ordersCount, 1);
  assert.equal(calls, 1);
  await tab.getMetricsForCompany('a', { force: true });
  assert.equal(calls, 2, 'explicit refresh after completion does not use old metrics');
});

test('Store metrics concurrency is bounded and hidden queued work does not start or render', async () => {
  const { tab } = storesTab();
  const waits = [];
  let renders = 0;
  tab.render = () => { renders++; };
  tab.loadMetricsForCompany = async () => { const wait = deferred(); waits.push(wait); return wait.promise; };
  const work = Array.from({ length: 8 }, (_, index) => tab.getMetricsForCompany(`store-${index}`));
  assert.equal(waits.length, 4);
  tab.isActive = false;
  tab.activity++;
  tab.onHide();
  for (const wait of waits) wait.resolve({ updatedAt: Date.now() });
  await Promise.all(work);
  await flush();
  assert.equal(waits.length, 4);
  assert.equal(tab.metricsInFlight.size, 0);
  assert.equal(tab.metricsCache.size, 0);
  assert.equal(renders, 0);
});

test('failed Store metrics display an error, never fake zeros, and retry on explicit refresh', async () => {
  const { tab } = storesTab();
  tab.loadMetricsForCompany = async () => { throw new Error('denied'); };
  const failed = await tab.getMetricsForCompany('a');
  assert.equal(failed.error, true);
  assert.equal(failed.ordersCount, 'ERR');
  await flush();
  tab.loadMetricsForCompany = async () => ({ ordersCount: 10, updatedAt: Date.now() });
  assert.equal((await tab.getMetricsForCompany('a', { force: true })).ordersCount, 10);
});

test('Store metrics cache is bounded, expires and cannot cross authenticated users', async () => {
  const { tab, auth } = storesTab();
  tab.loadMetricsForCompany = async (companyId) => ({ companyId, updatedAt: Date.now() });
  for (let index = 0; index < 50; index++) { await tab.getMetricsForCompany(`store-${index}`); await flush(); }
  assert.equal(tab.metricsCache.size, 40);
  tab.metricsCache.set('stale', { updatedAt: Date.now() - 61_000 });
  assert.equal(tab.getCachedMetrics('stale'), null);
  auth.currentUser = { uid: 'second-user' };
  assert.equal(tab.getCachedMetrics('store-49'), null);
  assert.equal(tab.metricsCache.size, 0);
});

test('Store scope switch rejects old completions without overriding newer store metrics', async () => {
  const { tab } = storesTab();
  const first = deferred();
  let calls = 0;
  tab.loadMetricsForCompany = async () => ++calls === 1 ? first.promise : { marker: 'new', updatedAt: Date.now() };
  const old = tab.getMetricsForCompany('a');
  tab.activity++;
  await tab.getMetricsForCompany('a');
  first.resolve({ marker: 'old', updatedAt: Date.now() });
  await old;
  await flush();
  assert.equal(tab.metricsCache.get('a').marker, 'new');
});

test('report HTML preserves original metric/report output across legacy edge cases', () => {
  const FixedDate = new Proxy(Date, { construct(Target, args) { return new Target(...(args.length ? args : ['2026-10-22T00:00:00Z'])); } });
  const Updated = loadClass(analyticsSource, 'AnalyticsTab', { Date: FixedDate });
  const updated = Object.create(Updated.prototype);
  const input = {
    scope: 'all', selectedCompanyId: 'a', stores: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    orders: [
      { id: '1', companyId: 'a', total: 20, status: 'new', createdAt: new Date('2026-10-01'), items: [{ name: 'A', quantity: 2 }] },
      { id: '2', companyId: 'b', price: '40', date: '2026-10-02', items: [{ name: 'B', qty: 3 }] },
      { id: '3', amount: 5, items: [] }
    ],
    products: [{ id: 'a', active: false }, { id: 'b' }, { id: 'c', active: true }],
    events: [{ actionType: 'page_view' }, { type: 'page_view', timestamp: '2026-10-02' }, { actionType: 'custom_event' }],
    qrEvents: [{ actionType: 'qr_click', linkId: 'offer', timestamp: '2026-10-02' }, { type: 'qr_click' }],
    granolaEvents: [], collections: [], collectionEvents: []
  };
  // Golden digest captured from the pre-change renderer for this deterministic fixture.
  // No dependency on git history, a particular branch, or a network service.
  assert.equal(createHash('sha256').update(updated.renderReport(input).replaceAll('>Snapshot report<', '>Tracking live<')).digest('hex'), '13c20f7f5b7a0f2c194b9b230d4bf65c789b0a53e541e5c81092da9780e123c2');
});

test('Analytics slow earlier store/range response never overwrites the latest report', async () => {
  let selected = 'a';
  const slow = deferred();
  const repository = {
    getRows(_name, { companyId }) { return companyId === 'a' ? slow.promise : Promise.resolve([]); },
    getStores() { return Promise.resolve([]); }, invalidate() {}
  };
  const Class = loadClass(analyticsSource, 'AnalyticsTab', { reportingRepository: repository, getSelectedCompanyId: () => selected });
  const tab = Object.create(Class.prototype);
  Object.assign(tab, { isActive: true, activity: 1, reportDiv: { innerHTML: '' }, rangeSelect: { value: 'all' },
    getActivityToken() { return this.activity; }, isActivityCurrent(token) { return this.isActive && this.activity === token; },
    renderReport({ selectedCompanyId }) { return `report ${selectedCompanyId}`; }, bindGranolaAnalyticsOverview() {}, bindCollectionAnalyticsOverview() {} });
  const first = tab.generateReport();
  selected = 'b';
  tab.activity++;
  await tab.generateReport();
  assert.equal(tab.reportDiv.innerHTML, 'report b');
  slow.resolve([]);
  await first;
  assert.equal(tab.reportDiv.innerHTML, 'report b');
  assert.equal(tab.reportScope.companyId, 'b');
});

test('Store summary labels sample scope and defers unknown event breakdown explicitly', () => {
  const { tab } = storesTab();
  const html = tab.renderMetricsPanel('a', {}, { ordersCount: 100, pageViews: 10, analyticsEvents: 15, eventsByType: null });
  assert.match(html, /Active orders \(latest 100\)/);
  assert.match(html, /Other events \(summary\)/);
  assert.match(html, /Load detailed event breakdown/);
  const detailed = tab.renderMetricsPanel('a', {}, { ordersCount: 1, pageViews: 1, analyticsEvents: 2, eventsByType: { page_view: 1, custom_new_event: 1 } });
  assert.match(detailed, /custom_new_event/);
  assert.doesNotMatch(detailed, /Load detailed event breakdown/);
});


test('catalogue invalidation prevents an old Store query from repopulating the local cache', async () => {
  const repository = { version: 0 };
  const { tab } = storesTab({ reportingRepository: repository });
  const first = deferred();
  let calls = 0;
  tab.loadMetricsForCompany = async () => ++calls === 1 ? first.promise : { marker: 'new', updatedAt: Date.now() };
  const old = tab.getMetricsForCompany('a');
  repository.version++;
  await tab.getMetricsForCompany('a');
  first.resolve({ marker: 'old', updatedAt: Date.now() });
  await old;
  await flush();
  assert.equal(tab.metricsCache.get('a').marker, 'new');
});

test('Stores does not install a duplicate global store-change listener', () => {
  assert.doesNotMatch(storesSource, /addEventListener\(['"]oako:store-changed/);
});
