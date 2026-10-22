import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BaseTab } from '../../admin/tabs/BaseTab.js';
import { createCampaignStatsRepository } from '../../admin/campaign-stats.mjs';

const source = (await readFile(new URL('../../admin/tabs/CampaignsTab.js', import.meta.url), 'utf8'))
    .replace(/^import\s[\s\S]*?;\s*$/gm, '')
    .replace('export class ', 'class ');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

async function until(check) {
    for (let i = 0; i < 20; i++) {
        if (check()) return;
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.fail('mock operation did not start');
}

function element(id = '') {
    const events = new Map();
    return {
        id, style: {}, checked: false, value: '', textContent: '', hidden: false,
        children: [], events,
        addEventListener(name, callback) { events.set(name, callback); },
        setAttribute() {},
        append(...children) { this.children.push(...children); },
        classList: { add() {}, remove() {}, toggle() {} },
        parentElement: { append() {} }
    };
}

function fixture({ getCount = async () => 12, getDocument, stats } = {}) {
    const nodes = new Map();
    const document = {
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, element(id));
            return nodes.get(id);
        },
        createElement: tag => element(tag),
        querySelectorAll: selector => selector === '.tab-content' ? [document.getElementById('campaigns')] : []
    };
    let store = 'alpha';
    const countCalls = [];
    const listeners = [];
    const writes = [];
    let confirmations = 0;
    const window = {
        location: { origin: 'https://example.test' },
        confirm() { confirmations++; return true; }
    };
    // BaseTab is imported normally. Only browser/Firebase dependencies are mocked.
    globalThis.document = document;
    globalThis.window = window;
    const mocks = {
        BaseTab, document, window,
        console: { log() {}, warn() {}, error() {} },
        db: {},
        COMPANY_ID: 'default-store',
        getCurrentCompanyId: () => store,
        getCompanyScopedId: (companyId, id) => `${companyId}__${id}`,
        doc: (_, collection, id) => ({ collection, id }),
        getDoc: ref => getDocument ? getDocument(ref) : Promise.resolve({
            exists: () => true,
            data: () => ({ companyId: store, isActive: false, conversionOffset: 0 })
        }),
        onSnapshot: (ref, next) => {
            assert.equal(ref.collection, 'campaigns', 'events must never get a live-history listener');
            const listener = { ref, next, active: true };
            listeners.push(listener);
            return () => { listener.active = false; };
        },
        setDoc: async (...args) => { writes.push(args); },
        alert() {},
        campaignStats: stats || {
            getConversionCount(companyId, options) {
                countCalls.push({ companyId, options });
                return getCount(companyId, options);
            }
        }
    };
    const CampaignsTab = new Function(...Object.keys(mocks), `${source}\nreturn CampaignsTab;`)(...Object.values(mocks));
    // Keep data loading, state, listeners and count rendering real. Only visual
    // animation/editor wiring is outside this dependency-free test DOM.
    for (const method of ['bindEvents', 'updateFieldStates', 'updateLivePreview', 'hydrateCampaignTimeline', 'clearMockParticleAnimations', 'initSharing']) {
        CampaignsTab.prototype[method] = () => {};
    }
    const tab = new CampaignsTab();
    return { tab, nodes, listeners, writes, countCalls, get confirmations() { return confirmations; }, setStore(value) { store = value; } };
}

function snapshot(companyId, conversionOffset = 0) {
    return { exists: () => true, data: () => ({ companyId, conversionOffset, soldCount: 1, maxSales: 50 }) };
}

test('campaign enabled checkbox is separate from tab activity and unopened invalidation reads nothing', async () => {
    const f = fixture();
    assert.equal(f.tab.isActive, false);
    assert.equal(f.tab.campaignActiveInput, f.nodes.get('campActive'));
    f.tab.markStoreChanged();
    assert.equal(f.countCalls.length, 0);
    assert.equal(f.listeners.length, 0);
    await f.tab.show();
    assert.equal(f.tab.isActive, true, 'disabled campaign still has an active admin tab');
    assert.equal(f.tab.campaignActiveInput.checked, false, 'saved campaign setting stays disabled');
    assert.equal(f.tab.statClicks.textContent, '12');
    f.tab.hide();
    assert.equal(f.tab.isActive, false);
    assert.equal(f.tab.campaignActiveInput.checked, false);
    assert(f.listeners.every(listener => !listener.active));
});

test('leaving during campaign hydration never starts counts or a document listener afterward', async () => {
    const ready = deferred();
    const f = fixture({ getDocument: () => ready.promise });
    const opening = f.tab.show();
    f.tab.hide();
    ready.resolve(snapshot('alpha'));
    await opening;
    assert.equal(f.countCalls.length, 0);
    assert.equal(f.listeners.length, 0);
    assert.equal(f.tab.isActive, false);
});

test('count completion while hidden cannot render; reopening starts the current count', async () => {
    const pending = deferred();
    let calls = 0;
    const f = fixture({ getCount: () => ++calls === 1 ? pending.promise : Promise.resolve(7) });
    const opening = f.tab.show();
    await until(() => calls === 1);
    f.tab.hide();
    pending.resolve(1001);
    await opening;
    assert.notEqual(f.tab.statClicks.textContent, '1001');
    assert(f.listeners.every(listener => !listener.active));
    await f.tab.show();
    assert.equal(f.tab.statClicks.textContent, '7');
    assert.equal(f.listeners.filter(listener => listener.active).length, 1);
});

test('store switch during the first count suppresses the old store and loads only the latest context', async () => {
    const pending = deferred();
    const f = fixture({ getCount: companyId => companyId === 'alpha' ? pending.promise : Promise.resolve(9) });
    const oldOpen = f.tab.show();
    await until(() => f.countCalls.length === 1);
    const oldListener = f.listeners[0];
    f.setStore('beta');
    f.tab.markStoreChanged();
    const currentOpen = f.tab.show();
    pending.resolve(1001);
    await Promise.all([oldOpen, currentOpen]);
    assert.deepEqual(f.countCalls.map(call => call.companyId), ['alpha', 'beta']);
    assert.equal(f.tab.statClicks.textContent, '9');
    oldListener.next(snapshot('alpha', 100));
    assert.equal(f.tab.statClicks.textContent, '9', 'stale doc callbacks cannot change the new count/offset');
    assert.equal(f.tab.currentConversionOffset, 0);
    assert.equal(f.listeners.filter(listener => listener.active).length, 1);
    assert.equal(f.listeners.filter(listener => listener.active)[0].ref.id, 'beta__prime-mun');
});

test('document snapshots preserve count loading and apply their offset only after count success', async () => {
    const pending = deferred();
    const f = fixture({ getCount: () => pending.promise });
    const opening = f.tab.show();
    await until(() => f.countCalls.length === 1);
    const loadingLabel = f.tab.statClicks.textContent;
    f.listeners[0].next(snapshot('alpha', 4));
    assert.equal(f.tab.statClicks.textContent, loadingLabel);
    assert.notEqual(f.tab.statClicks.textContent, '0', 'pending counts are not measured zeroes');
    pending.resolve(10);
    await opening;
    assert.equal(f.tab.statClicks.textContent, '6');
    assert.equal(f.tab.conversionCountAvailable, true);
});

test('failed count followed by a campaign snapshot remains unavailable, never numeric zero', async () => {
    const f = fixture({ getCount: async () => { throw new Error('offline'); } });
    await f.tab.show();
    assert.equal(f.tab.conversionCountAvailable, false);
    assert.equal(f.tab.statClicks.textContent, '—');
    f.listeners[0].next(snapshot('alpha', 3));
    assert.equal(f.tab.statClicks.textContent, '—');
    assert.match(f.tab.statsStatus.textContent, /unavailable/i);
    assert.equal(f.tab.currentConversionOffset, 3);
});

test('reset cannot write a conversion offset when its fresh count is unavailable', async () => {
    const f = fixture({ getCount: async () => { throw new Error('offline'); } });
    await f.tab.show();
    await f.tab.resetConversions();
    assert.equal(f.writes.length, 0);
    assert.equal(f.confirmations, 0);
    assert.equal(f.tab.statClicks.textContent, '—');
});

test('real aggregate repository serves reopened Campaigns from cache without any event-history listener', async () => {
    const reads = [];
    const firestore = {
        collection: (_, name) => ({ name }),
        query: (collection, ...constraints) => ({ ...collection, constraints }),
        where: (field, operator, value) => ({ field, operator, value }),
        getCountFromServer: async query => { reads.push(query); return { data: () => ({ count: 18 }) }; }
    };
    const stats = createCampaignStatsRepository({ db: {}, firestore, defaultCompanyId: 'default-store' });
    const f = fixture({ stats });
    await f.tab.show();
    f.tab.hide();
    await f.tab.show();
    assert.equal(f.tab.statClicks.textContent, '18');
    assert.equal(reads.length, 1);
    assert.equal(reads[0].name, 'campaign_events');
    assert(reads[0].constraints.some(c => c.field === 'companyId' && c.value === 'alpha'));
    assert.equal(f.listeners.filter(listener => listener.active).length, 1);
});

test('missing index offers legacy history only after an explicit click, and never while hidden', async () => {
    let legacyReads = 0;
    const f = fixture({ stats: {
        async getConversionCount() {
            throw Object.assign(new Error('index required'), { code: 'failed-precondition' });
        },
        async getLegacyConversionCount(companyId) {
            assert.equal(companyId, 'alpha');
            legacyReads++;
            return 5;
        }
    } });
    await f.tab.show();
    assert.equal(legacyReads, 0, 'index errors must not silently download event histories');
    assert.equal(f.tab.statsLegacyButton.hidden, false);
    assert.match(f.tab.statsStatus.textContent, /downloads click history/i);
    f.listeners[0].next(snapshot('alpha'));
    assert.equal(f.tab.statClicks.textContent, '—');
    await f.tab.statsLegacyButton.events.get('click')();
    assert.equal(legacyReads, 1);
    assert.equal(f.tab.statClicks.textContent, '5');
    assert.match(f.tab.statsStatus.textContent, /legacy snapshot/i);
    f.tab.hide();
    await f.tab.statsLegacyButton.events.get('click')();
    assert.equal(legacyReads, 1, 'hidden tabs cannot trigger even an explicit-refresh callback');
});

test('ordinary network errors never offer the expensive legacy-history action', async () => {
    const f = fixture({ getCount: async () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); } });
    await f.tab.show();
    assert.equal(f.tab.statsLegacyButton.hidden, true);
    assert.equal(f.tab.statClicks.textContent, '—');
});
