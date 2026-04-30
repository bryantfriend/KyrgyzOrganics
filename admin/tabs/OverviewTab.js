import { db } from '../../firebase-config.js';
import { getSelectedCompanyId } from '../../store-context.js';
import { getInventoryDocId } from '../../firestore-paths.js';
import { BaseTab } from './BaseTab.js';
import { subscribeToOrders } from '../../services/orderListener.js';
import { normalizeOrderStatus, updateOrderStatus } from '../../services/orderActions.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const DASHBOARD_ACTIVE_ORDER_LIMIT = 10;
const DASHBOARD_RANGE_ORDER_LIMIT = 80;
const DASHBOARD_PRODUCT_LIMIT = 250;
const DASHBOARD_ACTIVITY_LIMIT = 10;
const ACTIVE_DASHBOARD_STATUSES = ['new', 'pending', 'accepted', 'preparing', 'ready'];

const RANGE_CONFIG = {
    today: { label: 'Today', days: 0 },
    '7d': { label: 'Last 7 Days', days: 7 },
    '30d': { label: 'Last 30 Days', days: 30 },
    all: { label: 'All Time', days: null }
};

function getStartOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function getCutoffDate(rangeKey) {
    const config = RANGE_CONFIG[rangeKey] || RANGE_CONFIG.today;
    if (config.days === null) return null;
    if (config.days === 0) return getStartOfDay();

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - (config.days - 1));
    return now;
}

function timestampToMillis(value) {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelativeTime(value) {
    const millis = timestampToMillis(value);
    if (!millis) return 'No recent updates';

    const diff = Date.now() - millis;
    const minutes = Math.max(1, Math.round(diff / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatClock(value) {
    const millis = timestampToMillis(value);
    if (!millis) return '--';
    return new Date(millis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSom(value) {
    const amount = Number(value || 0);
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} som`;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function ensureAbsoluteUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw.replace(/^\/+/, '')}`;
}

function sortByFieldDesc(items, fieldName) {
    return [...items].sort((a, b) => timestampToMillis(b?.[fieldName]) - timestampToMillis(a?.[fieldName]));
}

function uniqueById(records = []) {
    const map = new Map();
    records.forEach((record) => {
        if (record?.id) map.set(record.id, record);
    });
    return [...map.values()];
}

function getStorePublicUrl(store = {}, companyId = '') {
    const explicitUrl = store.website || store.publicUrl || store.domain || store.customDomain;
    if (explicitUrl) return ensureAbsoluteUrl(explicitUrl);
    const slug = store.slug || store.storeSlug || companyId;
    if (!slug || slug === 'kyrgyz-organics') return 'https://oako.kg/';
    return `https://${slug}.oako.kg/`;
}

function getStoreInitials(store = {}, companyId = '') {
    const source = store.name || companyId || 'OA';
    return source
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2) || 'OA';
}

function getOrderCustomerName(order = {}) {
    return order.customerName || order.name || order.customer?.name || 'Customer';
}

function getOrderPhone(order = {}) {
    return order.phone || order.customerPhone || order.customer?.phone || order.whatsapp || 'No phone';
}

function getOrderTotal(order = {}) {
    const total = Number(order.total ?? order.amount ?? order.price ?? 0);
    return Number.isFinite(total) ? total : 0;
}

function getOrderTime(order = {}) {
    return order.createdAt || order.updatedAt || null;
}

function getItemsSummary(order = {}) {
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items.slice(0, 3).map((item) => {
            const qty = Number(item.quantity || item.qty || 1);
            const label = item.name || item.title || item.productName || 'Item';
            return `${qty}x ${label}`;
        }).join(', ');
    }
    if (order.productName) return `1x ${order.productName}`;
    return 'Items will appear here';
}

function getQuickActionsForOrder(order = {}) {
    const status = normalizeOrderStatus(order.status, order);

    if (status === 'new') {
        return [
            { status: 'accepted', label: 'Accept', tone: 'primary' },
            { status: 'cancelled', label: 'Cancel', tone: 'danger' }
        ];
    }
    if (status === 'accepted') {
        return [
            { status: 'preparing', label: 'Preparing', tone: 'warning' },
            { status: 'cancelled', label: 'Cancel', tone: 'danger' }
        ];
    }
    if (status === 'preparing') {
        return [
            { status: 'ready', label: 'Ready', tone: 'success' },
            { status: 'cancelled', label: 'Cancel', tone: 'danger' }
        ];
    }
    if (status === 'ready' || status === 'delivery') {
        return [
            { status: 'completed', label: 'Completed', tone: 'success' }
        ];
    }
    return [];
}

function isVisibleProduct(product = {}) {
    return !(product.hidden === true || product.active === false || product.isActive === false);
}

function getProductStockNumber(product = {}) {
    const value = Number(product.stock ?? product.quantity ?? product.inventory ?? product.availableStock ?? product.qty);
    return Number.isFinite(value) ? value : null;
}

function hasContactInfo(store = {}, config = {}) {
    return Boolean(
        store?.contact?.whatsapp ||
        store?.contact?.phone ||
        store?.whatsapp ||
        store?.phone ||
        config?.contact?.whatsapp ||
        config?.contact?.phone
    );
}

function hasSeo(store = {}, config = {}) {
    return Boolean(
        config?.seo?.title ||
        config?.seoTitle ||
        config?.seo?.description ||
        config?.seoDescription ||
        store?.seo?.title
    );
}

function hasDomain(store = {}, config = {}) {
    return Boolean(store?.customDomain || store?.website || store?.domain || config?.domain || config?.publicUrl);
}

function hasQrSupport(store = {}, config = {}) {
    return Boolean(store?.qrCodeUrl || config?.qrCodeUrl || store?.publicUrl || store?.website || config?.publicUrl);
}

function getOrderingState(store = {}, config = {}) {
    const value = store?.orderingEnabled ?? config?.orderingEnabled ?? config?.features?.orderingEnabled;
    if (value === true) return 'Enabled';
    if (value === false) return 'Disabled';
    return 'Not configured';
}

function getStatusTone(ok, pending = false) {
    if (ok) return 'success';
    if (pending) return 'info';
    return 'warning';
}

async function runScopedQuery({
    collectionName,
    companyId,
    fieldNames = ['companyId'],
    extraConstraints = [],
    orderField = 'createdAt',
    limitCount = DASHBOARD_RANGE_ORDER_LIMIT
}) {
    const records = [];
    const errors = [];

    for (const fieldName of fieldNames) {
        try {
            const orderedQuery = query(
                collection(db, collectionName),
                where(fieldName, '==', companyId),
                ...extraConstraints,
                orderBy(orderField, 'desc'),
                limit(limitCount)
            );
            const snapshot = await getDocs(orderedQuery);
            snapshot.docs.forEach((docSnap) => records.push({ id: docSnap.id, ...docSnap.data() }));
        } catch (error) {
            const isIndexIssue = String(error?.message || '').includes('requires an index');
            if (!isIndexIssue) {
                errors.push(error);
                continue;
            }

            try {
                const fallbackQuery = query(
                    collection(db, collectionName),
                    where(fieldName, '==', companyId),
                    ...extraConstraints,
                    limit(limitCount)
                );
                const snapshot = await getDocs(fallbackQuery);
                snapshot.docs.forEach((docSnap) => records.push({ id: docSnap.id, ...docSnap.data() }));
            } catch (fallbackError) {
                errors.push(fallbackError);
            }
        }
    }

    const deduped = uniqueById(records);
    if (deduped.length > 0) {
        return sortByFieldDesc(deduped, orderField).slice(0, limitCount);
    }
    if (errors.length > 0) throw errors[0];
    return [];
}

async function runSingleFieldQuery({
    collectionName,
    companyId,
    fieldName = 'companyId',
    extraConstraints = [],
    orderField = 'createdAt',
    limitCount = DASHBOARD_ACTIVITY_LIMIT
}) {
    return runScopedQuery({
        collectionName,
        companyId,
        fieldNames: [fieldName],
        extraConstraints,
        orderField,
        limitCount
    });
}

export class OverviewTab extends BaseTab {
    constructor() {
        super('overview');
        this.rangeKey = 'today';
        this.activeOrders = [];
        this.metricsOrders = [];
        this.products = [];
        this.inventoryDoc = null;
        this.auditItems = [];
        this.bannerItems = [];
        this.currentStore = null;
        this.currentConfig = null;
        this.ordersUnsubscribe = null;
        this.refreshToken = 0;
        this.pendingOrderUpdates = new Set();
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        this.renderLoadingState();
        await this.refresh();
        this.startOrdersFeed();
    }

    onShow() {
        this.refresh();
        this.startOrdersFeed();
    }

    onStoreChanged() {
        this.activeOrders = [];
        this.stopOrdersFeed();
        this.renderOrdersFeed();
        this.refresh();
        this.startOrdersFeed();
    }

    cacheElements() {
        this.titleEl = document.getElementById('overviewTitle');
        this.subtitleEl = document.getElementById('overviewSubtitle');
        this.logoEl = document.getElementById('overviewStoreLogo');
        this.urlEl = document.getElementById('overviewStoreUrl');
        this.slugEl = document.getElementById('overviewStoreSlug');
        this.heroStatusEl = document.getElementById('overviewHeroStatus');
        this.heroModeEl = document.getElementById('overviewHeroMode');
        this.updatedAtEl = document.getElementById('overviewUpdatedAt');
        this.brandingEl = document.getElementById('overviewStoreBranding');
        this.ordersCountEl = document.getElementById('overviewOrdersCount');
        this.ordersBreakdownEl = document.getElementById('overviewOrdersBreakdown');
        this.ordersHintEl = document.getElementById('overviewOrdersHint');
        this.inventoryAlertCountEl = document.getElementById('overviewInventoryAlertCount');
        this.inventoryBreakdownEl = document.getElementById('overviewInventoryBreakdown');
        this.productsHintEl = document.getElementById('overviewProductsHint');
        this.revenueEl = document.getElementById('overviewRevenue');
        this.revenueBreakdownEl = document.getElementById('overviewRevenueBreakdown');
        this.revenueHintEl = document.getElementById('overviewRevenueHint');
        this.healthEl = document.getElementById('overviewHealth');
        this.healthBreakdownEl = document.getElementById('overviewHealthBreakdown');
        this.healthHintEl = document.getElementById('overviewHealthHint');
        this.ordersLoadingEl = document.getElementById('overviewOrdersLoading');
        this.ordersListEl = document.getElementById('overviewOrdersList');
        this.ordersMetaEl = document.getElementById('overviewOrdersMeta');
        this.checklistEl = document.getElementById('overviewChecklist');
        this.launchBadgeEl = document.getElementById('overviewLaunchBadge');
        this.inventoryStatusEl = document.getElementById('overviewInventoryStatus');
        this.qrPreviewEl = document.getElementById('overviewQrPreview');
        this.previewUrlEl = document.getElementById('overviewPreviewUrl');
        this.previewStatusEl = document.getElementById('overviewPreviewStatus');
        this.activityEl = document.getElementById('overviewActivity');
        this.activityMetaEl = document.getElementById('overviewActivityMeta');
        this.openToggleBtn = document.getElementById('overviewOpenToggleBtn');
        this.rangeFiltersEl = document.getElementById('overviewRangeFilters');
    }

    bindEvents() {
        this.rangeFiltersEl?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-range]');
            if (!button) return;
            const nextRange = button.dataset.range;
            if (!RANGE_CONFIG[nextRange] || nextRange === this.rangeKey) return;
            this.rangeKey = nextRange;
            this.updateRangeButtons();
            this.refresh();
        });

        this.ordersListEl?.addEventListener('click', (event) => {
            const actionButton = event.target.closest('[data-order-id][data-order-action]');
            if (!actionButton) return;
            this.handleOrderAction(actionButton.dataset.orderId, actionButton.dataset.orderAction);
        });

        this.container?.addEventListener('click', (event) => {
            const navButton = event.target.closest('[data-nav-tab]');
            if (navButton) {
                window.dispatchEvent(new CustomEvent('oako:navigate-admin-tab', {
                    detail: { tab: navButton.dataset.navTab }
                }));
                return;
            }

            if (event.target.closest('#overviewCopyLinkBtn, #overviewQuickCopyLinkBtn, #overviewPreviewCopyBtn')) {
                this.copyStoreLink();
                return;
            }

            if (event.target.closest('#overviewQrBtn, #overviewQuickQrBtn')) {
                this.openQrPreview();
                return;
            }

            if (event.target.closest('#overviewDownloadQrBtn, #overviewPreviewDownloadQrBtn')) {
                this.downloadQrCode();
                return;
            }

            if (event.target.closest('#overviewPreviewViewBtn')) {
                window.adminApp?.openSelectedStorefront?.();
                return;
            }

            if (event.target.closest('#overviewQuickViewSiteBtn')) {
                window.adminApp?.openSelectedStorefront?.();
                return;
            }

            if (event.target.closest('#overviewViewAllOrdersBtn')) {
                window.dispatchEvent(new CustomEvent('oako:navigate-admin-tab', {
                    detail: { tab: 'orders' }
                }));
                return;
            }

            if (event.target.closest('#overviewOpenToggleBtn')) {
                this.toggleStoreOpenState();
            }
        });
    }

    renderLoadingState() {
        if (this.ordersLoadingEl) this.ordersLoadingEl.hidden = false;
        if (this.ordersListEl) this.ordersListEl.hidden = true;
        if (this.ordersMetaEl) this.ordersMetaEl.textContent = 'Live feed';
    }

    updateRangeButtons() {
        this.rangeFiltersEl?.querySelectorAll('[data-range]').forEach((button) => {
            button.classList.toggle('active', button.dataset.range === this.rangeKey);
        });
    }

    async refresh() {
        const companyId = getSelectedCompanyId();
        if (!companyId) return;

        const refreshToken = ++this.refreshToken;
        this.updateRangeButtons();
        this.setMetaText(this.updatedAtEl, 'Refreshing...');
        this.setMetaText(this.heroModeEl, `${RANGE_CONFIG[this.rangeKey]?.label || 'Today'} mode`);

        const cutoffDate = getCutoffDate(this.rangeKey);
        const createdAfter = cutoffDate ? Timestamp.fromDate(cutoffDate) : null;
        const rangeConstraints = createdAfter ? [where('createdAt', '>=', createdAfter)] : [];
        const auditConstraints = createdAfter ? [where('timestamp', '>=', createdAfter)] : [];

        try {
            const [store, config, products, banners, rangeOrders, inventoryDoc, activity] = await Promise.all([
                this.getStoreDetails(companyId),
                this.getStoreConfig(companyId),
                runSingleFieldQuery({
                    collectionName: 'products',
                    companyId,
                    fieldName: 'companyId',
                    extraConstraints: [],
                    orderField: 'updatedAt',
                    limitCount: DASHBOARD_PRODUCT_LIMIT
                }),
                runSingleFieldQuery({
                    collectionName: 'banners',
                    companyId,
                    fieldName: 'companyId',
                    extraConstraints: [],
                    orderField: 'updatedAt',
                    limitCount: 20
                }).catch(() => []),
                runScopedQuery({
                    collectionName: 'orders',
                    companyId,
                    fieldNames: ['storeId', 'companyId'],
                    extraConstraints: rangeConstraints,
                    orderField: 'createdAt',
                    limitCount: DASHBOARD_RANGE_ORDER_LIMIT
                }).catch((error) => {
                    console.warn('Overview range orders query failed:', error);
                    return [];
                }),
                this.getTodayInventoryDoc(companyId),
                runSingleFieldQuery({
                    collectionName: 'audit_logs',
                    companyId,
                    fieldName: 'companyId',
                    extraConstraints: auditConstraints,
                    orderField: 'timestamp',
                    limitCount: DASHBOARD_ACTIVITY_LIMIT
                }).catch((error) => {
                    console.warn('Overview activity query failed:', error);
                    return [];
                })
            ]);

            if (refreshToken !== this.refreshToken) return;

            this.currentStore = store || {};
            this.currentConfig = config || {};
            this.products = products || [];
            this.bannerItems = banners || [];
            this.metricsOrders = rangeOrders || [];
            this.inventoryDoc = inventoryDoc;
            this.auditItems = activity || [];

            this.renderHero(companyId);
            this.renderSummaryCards();
            this.renderLaunchReadiness();
            this.renderInventoryPanel();
            this.renderWebsitePreview(companyId);
            this.renderActivityFeed();
            this.setMetaText(this.updatedAtEl, `Updated ${formatRelativeTime(store?.updatedAt || config?.updatedAt || new Date())}`);
        } catch (error) {
            console.warn('Overview refresh failed:', error);
            if (refreshToken !== this.refreshToken) return;
            this.showToast('Overview could not load. Please try refreshing again.', 'error');
            this.setMetaText(this.updatedAtEl, 'Refresh failed');
            if (this.activityEl) {
                this.activityEl.innerHTML = `<div class="inline-alert error">Overview could not load: ${error.message}</div>`;
            }
        }
    }

    startOrdersFeed() {
        if (!window.adminApp?.hasActiveSession?.()) return;
        const companyId = getSelectedCompanyId();
        if (!companyId || this.ordersUnsubscribe) return;

        this.ordersUnsubscribe = subscribeToOrders(companyId, (orders, meta = {}) => {
            if (meta.error) {
                console.warn('Overview live orders listener warning:', meta.error);
            }

            this.activeOrders = (orders || [])
                .map((order) => ({ ...order, status: order.status || 'new' }))
                .filter((order) => ACTIVE_DASHBOARD_STATUSES.includes(normalizeOrderStatus(order.status, order)))
                .slice(0, DASHBOARD_ACTIVE_ORDER_LIMIT);

            this.renderOrdersFeed();
        });
    }

    stopOrdersFeed() {
        if (typeof this.ordersUnsubscribe === 'function') {
            this.ordersUnsubscribe();
        }
        this.ordersUnsubscribe = null;
    }

    pauseLiveUpdates(message = 'Reconnecting session...') {
        this.stopOrdersFeed();
        if (this.ordersLoadingEl) this.ordersLoadingEl.hidden = false;
        if (this.ordersListEl) this.ordersListEl.hidden = true;
        if (this.ordersMetaEl) this.ordersMetaEl.textContent = message;
    }

    resumeLiveUpdates() {
        if (!this.isInitialized) return;
        this.startOrdersFeed();
    }

    async handleOrderAction(orderId, nextStatus) {
        const order = this.activeOrders.find((entry) => entry.id === orderId);
        if (!order || this.pendingOrderUpdates.has(orderId)) return;

        this.pendingOrderUpdates.add(orderId);
        const orderIndex = this.activeOrders.findIndex((entry) => entry.id === orderId);
        const originalOrder = { ...order };
        if (nextStatus === 'completed' || nextStatus === 'cancelled') {
            this.activeOrders.splice(orderIndex, 1);
        } else {
            order.status = nextStatus;
        }
        this.renderOrdersFeed();

        try {
            await updateOrderStatus(orderId, nextStatus, {
                storeId: order.storeId || getSelectedCompanyId(),
                companyId: order.companyId || getSelectedCompanyId(),
                estimatedTime: order.estimatedTime
            });
            this.showToast(`Order ${orderId.slice(0, 6)} moved to ${nextStatus}.`, 'success');
        } catch (error) {
            if (nextStatus === 'completed' || nextStatus === 'cancelled') {
                this.activeOrders.splice(orderIndex, 0, originalOrder);
            } else {
                order.status = originalOrder.status;
            }
            this.showToast(`Order update failed: ${error.message}`, 'error');
            this.renderOrdersFeed();
        } finally {
            this.pendingOrderUpdates.delete(orderId);
        }
    }

    async toggleStoreOpenState() {
        const companyId = getSelectedCompanyId();
        if (!companyId || !this.openToggleBtn || this.openToggleBtn.disabled) return;

        const store = this.currentStore || {};
        const fieldName = Object.prototype.hasOwnProperty.call(store, 'isOpen')
            ? 'isOpen'
            : (Object.prototype.hasOwnProperty.call(store, 'open') ? 'open' : null);
        if (!fieldName) return;

        const nextValue = !Boolean(store[fieldName]);
        this.openToggleBtn.disabled = true;

        try {
            await updateDoc(doc(db, 'companies', companyId), {
                [fieldName]: nextValue,
                updatedAt: serverTimestamp()
            });
            this.currentStore = { ...store, [fieldName]: nextValue };
            this.renderHero(companyId);
            this.showToast(`Store marked as ${nextValue ? 'open' : 'closed'}.`, 'success');
        } catch (error) {
            this.showToast(`Open/closed toggle failed: ${error.message}`, 'error');
        } finally {
            this.openToggleBtn.disabled = false;
        }
    }

    renderHero(companyId) {
        const store = this.currentStore || {};
        const config = this.currentConfig || {};
        const displayName = store.name || config.name || companyId;
        const slug = store.slug || config.slug || slugify(displayName) || companyId;
        const publicUrl = getStorePublicUrl({ ...config, ...store, slug }, companyId);
        const isActive = store.active !== false && config.active !== false;
        const explicitOpen = Object.prototype.hasOwnProperty.call(store, 'isOpen')
            ? Boolean(store.isOpen)
            : (Object.prototype.hasOwnProperty.call(store, 'open') ? Boolean(store.open) : null);
        const address = store.address || config.address || 'Address not added yet';
        const contact = store.phone || store.whatsapp || config?.contact?.phone || config?.contact?.whatsapp || 'Contact info missing';
        const category = store.type || store.category || config.storeType || 'Store';
        const accent = store.themeColor || config.themeColor || '#7cb342';

        if (this.titleEl) this.titleEl.textContent = displayName;
        if (this.subtitleEl) {
            this.subtitleEl.textContent = `${displayName} is ${isActive ? 'live' : 'inactive'}. Here is the website, your current readiness, and what needs attention next.`;
        }
        if (this.logoEl) {
            this.logoEl.textContent = getStoreInitials(store, companyId);
            this.logoEl.style.background = `linear-gradient(135deg, ${accent}, #1f3b2c)`;
        }
        this.setMetaText(this.urlEl, publicUrl);
        this.setMetaText(this.slugEl, slug);
        this.setMetaText(this.heroModeEl, `${RANGE_CONFIG[this.rangeKey]?.label || 'Today'} mode`);
        if (this.heroStatusEl) {
            this.heroStatusEl.textContent = isActive ? 'Active' : 'Inactive';
            this.heroStatusEl.className = `status-badge ${isActive ? 'success' : 'warning'}`;
        }
        if (this.brandingEl) {
            this.brandingEl.innerHTML = [
                `<span class="muted-pill">${category}</span>`,
                `<span class="muted-pill">${address}</span>`,
                `<span class="muted-pill">${contact}</span>`,
                store.twoGisLink ? `<a class="muted-pill link-pill" href="${store.twoGisLink}" target="_blank" rel="noopener">2GIS</a>` : `<span class="muted-pill">2GIS not added</span>`
            ].join('');
        }

        if (this.openToggleBtn) {
            if (explicitOpen === null) {
                this.openToggleBtn.disabled = true;
                this.openToggleBtn.textContent = 'Hours not configured';
            } else {
                this.openToggleBtn.disabled = false;
                this.openToggleBtn.textContent = explicitOpen ? 'Mark Store Closed' : 'Mark Store Open';
            }
        }
    }

    renderSummaryCards() {
        const inventoryHealth = this.computeInventoryHealth();
        const statusCounts = {
            new: 0,
            preparing: 0,
            ready: 0,
            completed: 0
        };
        const paidOrders = [];

        this.metricsOrders.forEach((order) => {
            const normalized = normalizeOrderStatus(order.status, order);
            if (normalized === 'new') statusCounts.new += 1;
            if (normalized === 'accepted' || normalized === 'preparing') statusCounts.preparing += 1;
            if (normalized === 'ready' || normalized === 'delivery') statusCounts.ready += 1;
            if (normalized === 'completed') statusCounts.completed += 1;

            if (normalized === 'completed' || String(order.paymentStatus || '').toLowerCase() === 'paid') {
                paidOrders.push(order);
            }
        });

        const totalRevenue = paidOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
        const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;
        const visibleProducts = this.products.filter((product) => isVisibleProduct(product)).length;
        const contactReady = hasContactInfo(this.currentStore, this.currentConfig);
        const orderingState = getOrderingState(this.currentStore, this.currentConfig);

        if (this.ordersCountEl) this.ordersCountEl.textContent = String(this.metricsOrders.length);
        if (this.ordersBreakdownEl) {
            this.ordersBreakdownEl.innerHTML = [
                `<span class="metric-chip tone-blue">New ${statusCounts.new}</span>`,
                `<span class="metric-chip tone-amber">Preparing ${statusCounts.preparing}</span>`,
                `<span class="metric-chip tone-green">Ready ${statusCounts.ready}</span>`,
                `<span class="metric-chip tone-slate">Completed ${statusCounts.completed}</span>`
            ].join('');
        }
        if (this.ordersHintEl) {
            this.ordersHintEl.textContent = this.rangeKey === 'all'
                ? 'Recent capped snapshot used for speed'
                : `${RANGE_CONFIG[this.rangeKey]?.label || 'Today'} only`;
        }

        if (this.inventoryAlertCountEl) this.inventoryAlertCountEl.textContent = String(inventoryHealth.alertCount);
        if (this.inventoryBreakdownEl) {
            this.inventoryBreakdownEl.innerHTML = [
                `<span class="metric-chip tone-amber">Low stock ${inventoryHealth.lowStock}</span>`,
                `<span class="metric-chip tone-danger">Out ${inventoryHealth.outOfStock}</span>`,
                `<span class="metric-chip tone-slate">Hidden ${inventoryHealth.hidden}</span>`,
                `<span class="metric-chip tone-warning">Not updated ${inventoryHealth.notUpdatedToday}</span>`
            ].join('');
        }
        if (this.productsHintEl) {
            this.productsHintEl.textContent = inventoryHealth.sampled
                ? 'Product snapshot is capped to keep the dashboard fast'
                : 'Low stock, out of stock, hidden, and missing today';
        }

        if (this.revenueEl) this.revenueEl.textContent = formatSom(totalRevenue);
        if (this.revenueBreakdownEl) {
            this.revenueBreakdownEl.innerHTML = [
                `<span class="metric-chip tone-green">Paid / completed ${paidOrders.length}</span>`,
                `<span class="metric-chip tone-blue">Avg ${formatSom(averageOrderValue)}</span>`
            ].join('');
        }
        if (this.revenueHintEl) {
            this.revenueHintEl.textContent = this.rangeKey === 'all'
                ? 'All-time uses a recent capped sample unless aggregate fields exist'
                : `${RANGE_CONFIG[this.rangeKey]?.label || 'Today'} revenue snapshot`;
        }

        const healthScore = [
            visibleProducts > 0,
            contactReady,
            this.currentStore?.active !== false,
            orderingState !== 'Disabled'
        ].filter(Boolean).length;
        const healthLabel = healthScore >= 4 ? 'Healthy' : healthScore >= 2 ? 'Needs attention' : 'At risk';
        if (this.healthEl) this.healthEl.textContent = healthLabel;
        if (this.healthBreakdownEl) {
            this.healthBreakdownEl.innerHTML = [
                `<span class="metric-chip ${this.currentStore?.active !== false ? 'tone-green' : 'tone-danger'}">Store ${this.currentStore?.active !== false ? 'live' : 'inactive'}</span>`,
                `<span class="metric-chip ${visibleProducts > 0 ? 'tone-blue' : 'tone-warning'}">Visible products ${visibleProducts}</span>`,
                `<span class="metric-chip ${contactReady ? 'tone-green' : 'tone-warning'}">Contact ${contactReady ? 'ready' : 'missing'}</span>`,
                `<span class="metric-chip ${orderingState === 'Enabled' ? 'tone-green' : 'tone-slate'}">Ordering ${orderingState.toLowerCase()}</span>`
            ].join('');
        }
    }

    renderOrdersFeed() {
        if (!this.ordersLoadingEl || !this.ordersListEl || !this.ordersMetaEl) return;

        const orders = this.activeOrders.slice(0, DASHBOARD_ACTIVE_ORDER_LIMIT);
        this.ordersLoadingEl.hidden = true;
        this.ordersListEl.hidden = false;
        this.ordersMetaEl.textContent = `${orders.length} live orders`;

        if (orders.length === 0) {
            this.ordersListEl.innerHTML = `
                <div class="overview-empty-state">
                  <span class="overview-empty-icon" aria-hidden="true">◇</span>
                  <strong>No orders yet.</strong>
                  <p>Once customers place orders from the website, they will appear here automatically.</p>
                  <button type="button" class="btn-secondary" id="overviewEmptyViewSiteBtn">View Website</button>
                </div>
            `;
            const emptyButton = document.getElementById('overviewEmptyViewSiteBtn');
            emptyButton?.addEventListener('click', () => window.adminApp?.openSelectedStorefront?.(), { once: true });
            return;
        }

        this.ordersListEl.innerHTML = orders.map((order) => {
            const normalized = normalizeOrderStatus(order.status, order);
            const actions = getQuickActionsForOrder(order);
            const isPending = this.pendingOrderUpdates.has(order.id);
            return `
                <article class="overview-order-card status-${normalized}">
                  <div class="overview-order-head">
                    <div>
                      <strong>#${order.id.slice(0, 8)}</strong>
                      <p>${getOrderCustomerName(order)} · ${getOrderPhone(order)}</p>
                    </div>
                    <div class="overview-order-meta">
                      <span class="status-badge info">${normalized}</span>
                      <strong>${formatSom(getOrderTotal(order))}</strong>
                    </div>
                  </div>
                  <div class="overview-order-details">
                    <span>${formatClock(getOrderTime(order))}</span>
                    <span>${getItemsSummary(order)}</span>
                  </div>
                  <div class="overview-order-actions">
                    ${actions.map((action) => `
                      <button
                        type="button"
                        class="overview-order-action tone-${action.tone}"
                        data-order-id="${order.id}"
                        data-order-action="${action.status}"
                        ${isPending ? 'disabled' : ''}
                      >${action.label}</button>
                    `).join('')}
                  </div>
                </article>
            `;
        }).join('');
    }

    renderLaunchReadiness() {
        if (!this.checklistEl || !this.launchBadgeEl) return;
        const inventoryHealth = this.computeInventoryHealth();
        const checks = [
            {
                ok: this.currentStore?.active !== false,
                label: 'Store is active',
                explanation: this.currentStore?.active !== false ? 'Customers can reach the storefront.' : 'Reactivate the store before sharing the link.',
                action: 'Settings',
                tab: 'settings'
            },
            {
                ok: this.products.length > 0,
                label: 'Products added',
                explanation: this.products.length > 0 ? `${this.products.length} products are loaded.` : 'No products yet. Add the first product so customers can order.',
                action: this.products.length > 0 ? 'View Products' : 'Add Product',
                tab: 'products'
            },
            {
                ok: hasDomain(this.currentStore, this.currentConfig),
                label: 'Domain planned',
                explanation: hasDomain(this.currentStore, this.currentConfig) ? 'A public website address is connected.' : 'Add a public URL or custom domain.',
                action: 'Open Settings',
                tab: 'settings'
            },
            {
                ok: hasSeo(this.currentStore, this.currentConfig),
                label: 'SEO configured',
                explanation: hasSeo(this.currentStore, this.currentConfig) ? 'Search metadata is present.' : 'Add store title and description so the site shares cleanly.',
                action: 'Edit Content',
                tab: 'content'
            },
            {
                ok: hasContactInfo(this.currentStore, this.currentConfig),
                label: 'WhatsApp / contact ready',
                explanation: hasContactInfo(this.currentStore, this.currentConfig) ? 'Customers can reach the store directly.' : 'Add a phone or WhatsApp number.',
                action: 'Add Contact Info',
                tab: 'settings'
            },
            {
                ok: this.bannerItems.length > 0,
                label: 'Banner added',
                explanation: this.bannerItems.length > 0 ? 'Homepage promotion is in place.' : 'Add a banner to make the storefront feel alive.',
                action: 'Create Banner',
                tab: 'banners'
            },
            {
                ok: inventoryHealth.notUpdatedToday === 0,
                label: 'Inventory updated today',
                explanation: inventoryHealth.notUpdatedToday === 0 ? 'Today’s availability looks current.' : `${inventoryHealth.notUpdatedToday} products are still missing a today update.`,
                action: 'Update Inventory',
                tab: 'inventory'
            },
            {
                ok: hasQrSupport(this.currentStore, this.currentConfig),
                label: 'QR code ready',
                explanation: hasQrSupport(this.currentStore, this.currentConfig) ? 'Customers can scan directly into the storefront.' : 'Prepare a shareable QR experience before launch.',
                action: 'View QR',
                tab: null,
                customAction: 'qr'
            }
        ];

        const completedCount = checks.filter((check) => check.ok).length;
        this.launchBadgeEl.textContent = completedCount === checks.length ? 'Ready' : `${completedCount}/${checks.length} ready`;
        this.launchBadgeEl.className = `status-badge ${completedCount >= 6 ? 'success' : 'warning'}`;

        this.checklistEl.innerHTML = checks.map((check) => `
            <div class="overview-check-item ${check.ok ? 'ok' : 'warn'}">
              <div class="overview-check-copy">
                <span class="overview-check-icon">${check.ok ? '✓' : '!'}</span>
                <div>
                  <strong>${check.label}</strong>
                  <p>${check.explanation}</p>
                </div>
              </div>
              <button
                type="button"
                class="btn-secondary overview-check-action"
                ${check.customAction ? `data-overview-action="${check.customAction}"` : `data-nav-tab="${check.tab}"`}
              >${check.action}</button>
            </div>
        `).join('');

        this.checklistEl.querySelectorAll('[data-overview-action="qr"]').forEach((button) => {
            button.addEventListener('click', () => this.openQrPreview());
        });
    }

    renderInventoryPanel() {
        if (!this.inventoryStatusEl) return;
        const inventoryHealth = this.computeInventoryHealth();

        this.inventoryStatusEl.innerHTML = `
            <div class="overview-health-row">
              <span>Available products</span>
              <strong>${inventoryHealth.available}</strong>
            </div>
            <div class="overview-health-row">
              <span>Out of stock</span>
              <strong>${inventoryHealth.outOfStock}</strong>
            </div>
            <div class="overview-health-row">
              <span>Low stock</span>
              <strong>${inventoryHealth.lowStock}</strong>
            </div>
            <div class="overview-health-row">
              <span>Hidden from website</span>
              <strong>${inventoryHealth.hidden}</strong>
            </div>
            <div class="overview-health-row">
              <span>Not updated today</span>
              <strong>${inventoryHealth.notUpdatedToday}</strong>
            </div>
            ${inventoryHealth.notUpdatedToday > 0 ? `
              <div class="inline-alert warning">
                Some products have not been updated today. Customers may see outdated availability.
              </div>
            ` : `
              <div class="inline-alert success">
                Inventory looks current for today’s service.
              </div>
            `}
        `;
    }

    renderWebsitePreview(companyId) {
        const store = this.currentStore || {};
        const config = this.currentConfig || {};
        const publicUrl = getStorePublicUrl({ ...config, ...store }, companyId);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`;
        const visibleProducts = this.products.filter((product) => isVisibleProduct(product)).length;
        const orderingState = getOrderingState(store, config);

        if (this.previewUrlEl) this.previewUrlEl.textContent = publicUrl;
        if (this.urlEl) this.urlEl.textContent = publicUrl;

        if (this.qrPreviewEl) {
            this.qrPreviewEl.innerHTML = `
                <img src="${qrUrl}" alt="Store QR code for ${store.name || companyId}" />
                <small>Customer can scan this to open the store.</small>
            `;
            this.qrPreviewEl.dataset.qrUrl = qrUrl;
        }

        if (this.previewStatusEl) {
            this.previewStatusEl.innerHTML = [
                `<span class="metric-chip ${store.active !== false ? 'tone-green' : 'tone-warning'}">Website ${store.active !== false ? 'live' : 'inactive'}</span>`,
                `<span class="metric-chip ${orderingState === 'Enabled' ? 'tone-green' : 'tone-slate'}">Ordering ${orderingState.toLowerCase()}</span>`,
                `<span class="metric-chip ${visibleProducts > 0 ? 'tone-blue' : 'tone-warning'}">Visible products ${visibleProducts}</span>`,
                `<span class="metric-chip tone-slate">Last update ${formatRelativeTime(store.updatedAt || config.updatedAt)}</span>`
            ].join('');
        }
    }

    renderActivityFeed() {
        if (!this.activityEl || !this.activityMetaEl) return;
        const rangeLabel = RANGE_CONFIG[this.rangeKey]?.label || 'Today';
        const items = [];

        this.auditItems.forEach((entry) => {
            items.push({
                title: entry.action || 'Store activity',
                detail: entry.details?.summary || entry.details?.message || `Triggered by ${entry.user || 'admin'}`,
                time: entry.timestamp,
                tone: 'info'
            });
        });

        if (items.length === 0) {
            this.metricsOrders.slice(0, DASHBOARD_ACTIVITY_LIMIT).forEach((order) => {
                const normalized = normalizeOrderStatus(order.status, order);
                items.push({
                    title: `Order ${order.id.slice(0, 8)} moved to ${normalized}`,
                    detail: `${getOrderCustomerName(order)} · ${formatSom(getOrderTotal(order))}`,
                    time: order.updatedAt || order.createdAt,
                    tone: normalized === 'completed' ? 'success' : 'info'
                });
            });
        }

        const visibleItems = sortByFieldDesc(items, 'time').slice(0, DASHBOARD_ACTIVITY_LIMIT);
        this.activityMetaEl.textContent = `${rangeLabel} · latest ${visibleItems.length || 0}`;

        if (visibleItems.length === 0) {
            this.activityEl.innerHTML = `
                <div class="overview-empty-state compact">
                  <span class="overview-empty-icon" aria-hidden="true">◎</span>
                  <strong>No activity yet.</strong>
                  <p>Once orders, inventory updates, or content changes happen, they will show up here.</p>
                </div>
            `;
            return;
        }

        this.activityEl.innerHTML = visibleItems.map((item) => `
            <div class="overview-activity-item tone-${item.tone}">
              <span class="overview-activity-dot"></span>
              <div>
                <strong>${item.title}</strong>
                <p>${item.detail}</p>
              </div>
              <small>${formatRelativeTime(item.time)}</small>
            </div>
        `).join('');
    }

    computeInventoryHealth() {
        const todayInventory = this.inventoryDoc?.data || {};
        const trackedIds = new Set(Object.keys(todayInventory).filter((key) => !['companyId', 'updatedAt', 'createdAt', 'date'].includes(key)));
        let visible = 0;
        let hidden = 0;
        let outOfStock = 0;
        let lowStock = 0;
        let notUpdatedToday = 0;

        this.products.forEach((product) => {
            const productVisible = isVisibleProduct(product);
            const stockNumber = getProductStockNumber(product);
            const inventoryEntry = todayInventory[product.id];
            const availableFlag = typeof inventoryEntry?.available === 'boolean' ? inventoryEntry.available : null;

            if (!productVisible) {
                hidden += 1;
                return;
            }

            visible += 1;
            if (availableFlag === false || stockNumber === 0) {
                outOfStock += 1;
            } else if (typeof stockNumber === 'number' && stockNumber > 0 && stockNumber <= 5) {
                lowStock += 1;
            }

            if (!trackedIds.has(product.id)) {
                notUpdatedToday += 1;
            }
        });

        return {
            available: Math.max(0, visible - outOfStock),
            hidden,
            outOfStock,
            lowStock,
            notUpdatedToday,
            alertCount: hidden + outOfStock + lowStock + notUpdatedToday,
            sampled: this.products.length >= DASHBOARD_PRODUCT_LIMIT
        };
    }

    async copyStoreLink() {
        const url = this.urlEl?.textContent || this.previewUrlEl?.textContent;
        if (!url || url === '--') return;

        try {
            await navigator.clipboard.writeText(url);
            this.showToast('Store link copied.', 'success');
        } catch (error) {
            this.showToast(`Copy failed: ${error.message}`, 'error');
        }
    }

    openQrPreview() {
        const qrUrl = this.qrPreviewEl?.dataset?.qrUrl;
        if (!qrUrl) {
            this.showToast('QR preview is not ready yet.', 'warning');
            return;
        }
        window.open(qrUrl, '_blank', 'noopener');
    }

    downloadQrCode() {
        const qrUrl = this.qrPreviewEl?.dataset?.qrUrl;
        if (!qrUrl) {
            this.showToast('QR download is not ready yet.', 'warning');
            return;
        }
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `${this.slugEl?.textContent || 'store'}-qr.png`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
    }

    async getStoreDetails(companyId) {
        if (typeof window.adminApp?.getStoreDetails === 'function') {
            return window.adminApp.getStoreDetails(companyId);
        }
        const snapshot = await getDoc(doc(db, 'companies', companyId));
        return snapshot.exists() ? snapshot.data() : {};
    }

    async getStoreConfig(companyId) {
        if (typeof window.adminApp?.getStorefrontConfig === 'function') {
            return window.adminApp.getStorefrontConfig(companyId);
        }
        const snapshot = await getDoc(doc(db, 'storefront_configs', companyId));
        return snapshot.exists() ? snapshot.data() : {};
    }

    async getTodayInventoryDoc(companyId) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const docId = getInventoryDocId(companyId, dateStr);
        const snapshot = await getDoc(doc(db, 'inventory', docId)).catch(() => null);
        if (!snapshot?.exists?.()) {
            return { id: docId, data: {} };
        }
        return { id: docId, data: snapshot.data() || {} };
    }

    setMetaText(element, value) {
        if (element) element.textContent = value;
    }

    showToast(message, type = 'success') {
        window.adminApp?.showToast?.(message, type);
    }
}
