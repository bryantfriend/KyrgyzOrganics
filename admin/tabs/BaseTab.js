export class BaseTab {
    constructor(tabId) {
        this.tabId = tabId;
        this.container = document.getElementById(tabId);
        this.isInitialized = false;
        this.isActive = false;
        this._activityVersion = 0;
        this._storeVersion = 0;
        this._storeDirty = false;
        this._needsRefresh = true;
        this._initPromise = null;
        this._showPromise = null;
    }

    // Capture before starting asynchronous reads/listeners. Ignore completions
    // from a hidden tab, a previous store, or an earlier signed-in session.
    getActivityToken() {
        return this._activityVersion;
    }

    isActivityCurrent(token) {
        return this.isActive && token === this._activityVersion;
    }

    /** Only the controller's selected, authenticated tab may be shown. */
    async show() {
        if (!this.container) return;
        if (!this.isActive) {
            this.isActive = true;
            this._activityVersion += 1;
        }
        const token = this.getActivityToken();
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        this.container.style.display = 'block';

        // Repeated clicks must not duplicate initialization or subscriptions.
        if (this._showPromise && this._showToken === token) return this._showPromise;
        this._showToken = token;
        const work = this._show(token);
        this._showPromise = work;
        try {
            await work;
        } finally {
            if (this._showPromise === work) this._showPromise = null;
        }
    }

    async _show(token) {
        const initializedHere = !this.isInitialized && !this._initPromise;
        if (!this.isInitialized) {
            if (!this._initPromise) {
                this._initStoreVersion = this._storeVersion;
                this._initActivityToken = token;
                this._initPromise = Promise.resolve(this.init()).then(() => {
                    this.isInitialized = true;
                }).catch((error) => {
                    this._initPromise = null;
                    throw error;
                });
            }
            await this._initPromise;
            if (!this.isActivityCurrent(token)) return;
            // An initialization begun before a store switch must be replaced by
            // current-store data, not treated as a successful refresh.
            if (this._initStoreVersion !== this._storeVersion) this._storeDirty = true;
            else if (initializedHere) this._storeDirty = false;
        }
        if (!this.isActivityCurrent(token)) return;

        try {
            if (this._storeDirty) {
                await this.onStoreChanged();
            } else if (this._needsRefresh && (!initializedHere || this._initActivityToken !== token)) {
                await this.onShow();
            }
            if (this.isActivityCurrent(token)) {
                this._storeDirty = false;
                this._needsRefresh = false;
            }
        } catch (error) {
            this._needsRefresh = true;
            throw error;
        }
    }

    stopListeners() {
        // Existing tabs use both unsubscribeProducts and ordersUnsubscribe.
        Object.keys(this).forEach((key) => {
            if (!/unsubscribe/i.test(key) || typeof this[key] !== 'function') return;
            const unsubscribe = this[key];
            this[key] = null;
            try {
                unsubscribe();
            } catch (error) {
                console.warn(`Failed to stop ${this.tabId}.${key}:`, error);
            }
        });
    }

    hide() {
        this.isActive = false;
        this._activityVersion += 1;
        this._needsRefresh = true;
        this.stopListeners();
        this.onHide();
        if (this.container) this.container.style.display = 'none';
    }

    /** Invalidates hidden tabs without initializing or fetching anything. */
    markStoreChanged() {
        this._storeVersion += 1;
        this._activityVersion += 1;
        this._storeDirty = true;
        this._needsRefresh = true;
        this.stopListeners();
        this.onHide();
    }

    async init() {}
    onShow() {}
    onHide() {}

    onStoreChanged() {
        return this.onShow();
    }
}
