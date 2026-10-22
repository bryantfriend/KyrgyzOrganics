import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BaseTab } from '../admin/tabs/BaseTab.js';

function setupDom(ids = ['first', 'second']) {
    const nodes = new Map(ids.map(id => [id, { id, style: { display: 'none' } }]));
    const events = new Map();
    globalThis.document = {
        getElementById: id => nodes.get(id) || null,
        querySelectorAll: selector => selector === '.tab-content' ? [...nodes.values()] : []
    };
    globalThis.window = { addEventListener: (name, callback) => events.set(name, callback) };
    return { nodes, events };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

class CountingTab extends BaseTab {
    constructor(id) {
        super(id);
        this.initializations = 0;
        this.loads = 0;
        this.stops = 0;
        this.storeChanges = 0;
    }
    async init() { this.initializations++; this.load(); }
    onShow() { this.load(); }
    onStoreChanged() { this.storeChanges++; this.load(); }
    load() {
        assert.equal(this.isActive, true);
        this.loads++;
        this.unsubscribeData = () => { this.stops++; };
    }
}

test('store invalidation does not initialize unopened or hidden tabs; revisiting restores one listener', async () => {
    setupDom();
    const first = new CountingTab('first');
    const second = new CountingTab('second');
    first.markStoreChanged();
    second.markStoreChanged();
    assert.equal(first.loads + second.loads, 0);
    await first.show();
    await first.show();
    assert.equal(first.initializations, 1);
    assert.equal(first.loads, 1, 'active repeated clicks do not reload');
    first.hide();
    assert.equal(first.unsubscribeData, null);
    assert.equal(first.stops, 1);
    first.markStoreChanged();
    second.markStoreChanged();
    assert.equal(first.loads, 1, 'hidden store changes only invalidate');
    await second.show();
    second.hide();
    await first.show();
    assert.equal(first.loads, 2);
    assert.equal(first.storeChanges, 1);
    assert.equal(first.initializations, 1, 'UI handlers are not rebound');
    first.hide();
    await first.show();
    assert.equal(first.loads, 3, 'ordinary return restarts the feed too');
});

test('rapid navigation deduplicates asynchronous init and ignores its hidden completion', async () => {
    setupDom();
    const ready = deferred();
    class SlowTab extends CountingTab {
        async init() {
            this.initializations++;
            const token = this.getActivityToken();
            await ready.promise;
            if (this.isActivityCurrent(token)) this.load();
        }
    }
    const tab = new SlowTab('first');
    const firstOpen = tab.show();
    const duplicateOpen = tab.show();
    tab.hide();
    ready.resolve();
    await Promise.all([firstOpen, duplicateOpen]);
    assert.equal(tab.initializations, 1);
    assert.equal(tab.loads, 0);
    assert.equal(tab.isActive, false);
    assert.equal(tab.container.style.display, 'none');
    await tab.show();
    assert.equal(tab.initializations, 1);
    assert.equal(tab.loads, 1);
});

test('switching stores or signing out while initialization waits reloads only the latest context', async () => {
    setupDom();
    const ready = deferred();
    let store = 'alpha';
    const loaded = [];
    class SlowTab extends BaseTab {
        async init() {
            const token = this.getActivityToken();
            const initialStore = store;
            await ready.promise;
            if (this.isActivityCurrent(token)) loaded.push(initialStore);
        }
        onShow() { loaded.push(store); }
    }
    const tab = new SlowTab('first');
    const firstOpen = tab.show();
    tab.hide(); // sign-out
    tab.markStoreChanged();
    store = 'beta';
    tab.markStoreChanged();
    const latestOpen = tab.show(); // verified sign-in
    ready.resolve();
    await Promise.all([firstOpen, latestOpen]);
    assert.deepEqual(loaded, ['beta']);
    await tab.show();
    assert.deepEqual(loaded, ['beta']);
});

test('stale async refresh cannot clear a newer store invalidation', async () => {
    setupDom();
    const oldRefresh = deferred();
    let changed = 0;
    class SlowRefreshTab extends BaseTab {
        onStoreChanged() {
            changed++;
            if (changed === 1) return oldRefresh.promise;
        }
    }
    const tab = new SlowRefreshTab('first');
    await tab.show();
    tab.markStoreChanged();
    const oldShow = tab.show();
    tab.markStoreChanged();
    await tab.show();
    oldRefresh.resolve();
    await oldShow;
    assert.equal(changed, 2);
    assert.equal(tab._storeDirty, false);
    await tab.show();
    assert.equal(changed, 2);
});

test('a rejected initialization can retry without leaving the tab permanently busy', async () => {
    setupDom();
    let attempts = 0;
    class RetryingTab extends BaseTab {
        async init() { if (++attempts === 1) throw new Error('offline'); }
    }
    const tab = new RetryingTab('first');
    await assert.rejects(tab.show(), /offline/);
    await tab.show();
    assert.equal(attempts, 2);
    assert.equal(tab.isInitialized, true);
});

// Load the real controller and Products methods without connecting Firebase.
// The app's browser-only CDN imports are replaced with explicit local mocks.
async function loadClass(path, className, mocks) {
    const source = (await readFile(new URL(path, import.meta.url), 'utf8'))
        .replace(/^import\s[\s\S]*?;\s*$/gm, '')
        .replace('export class ', 'class ')
        .replace('window.adminApp = new AdminApp();', '');
    return new Function(...Object.keys(mocks), `${source}\nreturn ${className};`)(...Object.values(mocks));
}

test('Products keeps exactly three active-store listeners and discards stale snapshots and fallback errors', async () => {
    setupDom(['products']);
    let store = 'alpha';
    const listeners = [];
    const ProductsTab = await loadClass('../admin/tabs/ProductsTab.js', 'ProductsTab', {
        BaseTab,
        db: {},
        createQrPaymentEditor: () => ({}),
        getSelectedCompanyId: () => store,
        matchesSelectedCompany: item => item.companyId === store,
        collection: (_, name) => ({ name }),
        where: (field, operator, value) => ({ field, operator, value }),
        orderBy: field => ({ orderBy: field }),
        query: (collection, ...constraints) => ({ ...collection, constraints }),
        onSnapshot: (query, next, error) => {
            const listener = { query, next, error, active: true };
            listeners.push(listener);
            return () => { listener.active = false; };
        }
    });
    const tab = new ProductsTab();
    for (const method of ['bindEvents', 'resetForm', 'closeCollectionProductsModal', 'renderProductList', 'renderCollectionProductPicker', 'renderCollections']) tab[method] = () => {};
    tab.markStoreChanged();
    assert.equal(listeners.length, 0);
    await tab.show();
    await tab.show();
    assert.equal(listeners.length, 3);
    assert.equal(listeners.filter(item => item.active).length, 3);
    const oldProducts = listeners.find(item => item.query.name === 'products');
    const oldCollections = listeners.find(item => item.query.name === 'product_collections');
    tab.hide();
    assert.equal(listeners.filter(item => item.active).length, 0);
    store = 'beta';
    tab.markStoreChanged();
    await tab.show();
    assert.equal(listeners.filter(item => item.active).length, 3);
    assert(listeners.filter(item => item.active).every(item => item.query.constraints.some(c => c.field === 'companyId' && c.value === 'beta')));
    const currentProducts = listeners.filter(item => item.query.name === 'products').at(-1);
    currentProducts.next({ forEach: fn => fn({ id: 'current', data: () => ({ companyId: 'beta' }) }) });
    oldProducts.next({ forEach: fn => fn({ id: 'stale', data: () => ({ companyId: 'alpha' }) }) });
    await oldCollections.error(new Error('index unavailable'));
    assert.deepEqual(tab.allProductsCache.map(item => item.id), ['current']);
    assert.equal(listeners.length, 6, 'stale errors must not attach fallback listeners');
    tab.hide();
    await tab.show();
    assert.equal(listeners.filter(item => item.active).length, 3);
    assert.equal(listeners.length, 9);
});

test('controller refreshes only the active tab on store change and only the selected tab after auth recovery', async () => {
    const { events } = setupDom(['overview', 'products', 'analytics']);
    let authenticated = true;
    const AdminApp = await loadClass('../admin/admin.js', 'AdminApp', {});
    const app = Object.create(AdminApp.prototype);
    app.tabs = Object.fromEntries(['overview', 'products', 'analytics'].map(id => [id, new CountingTab(id)]));
    app.activeTabName = 'overview';
    app.tabsEnabled = true;
    app.isSuperAdmin = true;
    app.hasActiveSession = () => authenticated;
    app.updateActivePageChrome = () => {};
    app.refreshHeaderContext = () => {};
    app.showToast = message => { throw new Error(message); };
    app.setupStoreSwitching();
    app.openTab('overview');
    await app.tabs.overview._showPromise;
    app.openTab('products');
    await app.tabs.products._showPromise;
    assert.equal(app.tabs.overview.stops, 1);
    events.get('oako:store-changed')();
    await app.tabs.products._showPromise;
    assert.equal(app.tabs.overview.loads, 1);
    assert.equal(app.tabs.analytics.loads, 0);
    assert.equal(app.tabs.products.loads, 2);
    app.pauseLiveTabs();
    authenticated = false;
    app.openTab('analytics');
    events.get('oako:store-changed')();
    assert.equal(app.tabs.analytics.loads, 0);
    assert(Object.values(app.tabs).every(tab => !tab.isActive && !tab.unsubscribeData));
    authenticated = true;
    app.resumeLiveTabs();
    app.openTab('products');
    await app.tabs.products._showPromise;
    assert.equal(app.tabs.products.loads, 3);
    assert.equal(app.tabs.overview.loads, 1);
    assert.equal(app.tabs.analytics.loads, 0);
});

test('null auth cancels a delayed bootstrap, restores sign-in, and cannot corrupt a newer attempt', async () => {
    setupDom();
    window.location = { hostname: 'localhost', pathname: '/admin/admin.html', search: '' };
    const profile = deferred();
    const nextProfile = deferred();
    const user = { uid: 'old-user' };
    const auth = { currentUser: user };
    let authChanged;
    let downstreamReads = 0;
    let profileReads = 0;
    const AdminApp = await loadClass('../admin/admin.js', 'AdminApp', {
        auth,
        COMPANY_ID: 'default-store',
        onAuthStateChanged: (_, callback) => { authChanged = callback; },
        getUserProfile: uid => { profileReads++; return uid === 'old-user' ? profile.promise : nextProfile.promise; },
        ensureBaseCompanies: () => { downstreamReads++; return Promise.resolve(); },
        signOut: () => Promise.resolve()
    });
    const app = Object.create(AdminApp.prototype);
    Object.assign(app, {
        authEpoch: 0, loginAttemptInFlight: true, tabsEnabled: false, tabs: {},
        loginSubmitBtn: { setAttribute() {} }, loginStatus: {}, authScreen: {}, mainApp: {}
    });
    app.applySignedInShell = () => assert.fail('stale login must not expose the workspace');
    app.setupAuth();
    const pendingLogin = authChanged(user);
    assert.equal(app.authBootstrapInFlight, true);
    assert.equal(app.loginSubmitBtn.disabled, true);
    auth.currentUser = null;
    await authChanged(null);
    assert.equal(app.authBootstrapInFlight, false, 'the interrupted bootstrap is no longer awaited');
    assert.equal(app.loginAttemptInFlight, false);
    assert.equal(app.loginSubmitBtn.disabled, false, 'the user can immediately try signing in again');
    assert.equal(app.loginStatus.hidden, true);
    assert.equal(app.authScreen.hidden, false);
    assert.equal(app.mainApp.hidden, true);

    // A fresh explicit login must be allowed before the old profile read ends.
    const nextUser = { uid: 'next-user' };
    app.loginAttemptInFlight = true;
    auth.currentUser = nextUser;
    const nextLogin = authChanged(nextUser);
    assert.equal(profileReads, 2);
    assert.equal(app.authBootstrapInFlight, true);
    profile.resolve({ role: 'superadmin', companyId: 'alpha' });
    await pendingLogin;
    assert.equal(app.authBootstrapInFlight, true, 'stale completion cannot clear a newer bootstrap');
    assert.equal(app.loginSubmitBtn.disabled, true);

    auth.currentUser = null;
    await authChanged(null);
    nextProfile.resolve({ role: 'superadmin', companyId: 'beta' });
    await nextLogin;
    assert.equal(app.authBootstrapInFlight, false);
    assert.equal(app.loginAttemptInFlight, false);
    assert.equal(app.loginSubmitBtn.disabled, false);
    assert.equal(downstreamReads, 0);
    assert.equal(app.tabsEnabled, false);
});

test('late header data cannot overwrite the newly selected store', async () => {
    setupDom();
    let store = 'alpha';
    const slowStore = deferred();
    let configReads = 0;
    const AdminApp = await loadClass('../admin/admin.js', 'AdminApp', {
        getSelectedCompanyId: () => store
    });
    const app = Object.create(AdminApp.prototype);
    app.authEpoch = 1;
    app.hasActiveSession = () => true;
    app.getStoreDetails = () => slowStore.promise;
    app.getStorefrontConfig = async () => { configReads++; return {}; };
    app.currentStore = { companyId: 'beta' };
    const pendingHeader = app.refreshHeaderContext();
    store = 'beta';
    slowStore.resolve({ companyId: 'alpha' });
    await pendingHeader;
    assert.equal(configReads, 0);
    assert.equal(app.currentStore.companyId, 'beta');
});
