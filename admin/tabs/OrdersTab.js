import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { COMPANY_ID, getCurrentCompanyId, matchesCompanyId } from '../../company-config.js';
import { getInventoryDocId } from '../../firestore-paths.js';
import {
    collection, query, where, orderBy, getDocs, getDoc, doc, updateDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { storage } from '../../firebase-config.js';
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { subscribeToOrders } from '../../services/orderListener.js';
import {
    getNextOrderTransition,
    normalizeOrderStatus,
    STATUS_LABELS,
    updateOrderStatus
} from '../../services/orderActions.js';
import { getTrackingQrUrl, getTrackingUrl } from '../../utils/qrGenerator.js';
import { formatElapsed, formatTimeRemaining, getUrgencyState } from '../../utils/timeUtils.js';

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export class OrdersTab extends BaseTab {
    constructor() {
        super('orders');
        this.list = document.getElementById('ordersList');
        this.board = document.getElementById('ordersBoard');
        this.dashboard = document.getElementById('ordersDashboard');
        this.filterSelect = document.getElementById('orderFilterStatus');
        this.storeScope = document.getElementById('orderStoreScope');
        this.btnRefresh = document.getElementById('btnRefreshOrders');
        this.btnReleaseExpired = document.getElementById('btnReleaseExpired');
        this.receiptUrlCache = new Map();
        this.unsubscribeOrders = null;
        this.currentOrderDocs = [];
        this.knownOrderIds = new Set();
        this.newOrderIds = new Map();
        this.hasInitialLiveSnapshot = false;
        this.liveClock = null;
        this.liveStartedAt = 0;
    }

    async init() {
        if (this.btnRefresh) this.btnRefresh.addEventListener('click', () => this.startLiveOrders());
        if (this.filterSelect) this.filterSelect.addEventListener('change', () => this.handleFilterChange());
        if (this.storeScope) this.storeScope.addEventListener('change', () => this.startLiveOrders());
        if (this.btnReleaseExpired) this.btnReleaseExpired.addEventListener('click', () => this.releaseExpiredOrders());

        // Expose global actions
        window.verifyOrder = this.verifyOrder.bind(this);
        window.rejectOrder = this.rejectOrder.bind(this);
        window.markOrderPreparing = this.markOrderPreparing.bind(this);
        window.markOrderOutForDelivery = this.markOrderOutForDelivery.bind(this);
        window.markOrderDelivered = this.markOrderDelivered.bind(this);
        window.cancelOrderAdmin = this.cancelOrderAdmin.bind(this);
        window.advanceStoreOrder = this.advanceStoreOrder.bind(this);

        this.startLiveOrders();
    }

    onShow() {
        this.startLiveOrders();
    }

    onStoreChanged() {
        if (!this.isInitialized) return;
        this.startLiveOrders();
    }

    handleFilterChange() {
        const scope = this.storeScope ? this.storeScope.value : 'selected';
        if (scope === 'all') {
            this.loadOrders();
            return;
        }
        this.renderCurrentOrders();
    }

    startLiveOrders() {
        if (!this.list) return;

        const scope = this.storeScope ? this.storeScope.value : 'selected';
        if (scope === 'all') {
            this.stopLiveOrders();
            this.loadOrders();
            return;
        }

        this.stopLiveOrders();
        this.hasInitialLiveSnapshot = false;
        this.liveStartedAt = Date.now();
        this.knownOrderIds.clear();
        this.newOrderIds.clear();
        this.list.innerHTML = '<p>Opening live order feed...</p>';
        if (this.board) this.board.innerHTML = '<div class="orders-board-empty">Connecting to live orders...</div>';

        this.unsubscribeOrders = subscribeToOrders(getCurrentCompanyId(), (orders, meta = {}) => {
            this.handleLiveOrders(orders, meta);
        });

        this.startLiveClock();
    }

    stopLiveOrders() {
        if (this.unsubscribeOrders) {
            this.unsubscribeOrders();
            this.unsubscribeOrders = null;
        }
        if (this.liveClock) {
            window.clearInterval(this.liveClock);
            this.liveClock = null;
        }
    }

    startLiveClock() {
        if (this.liveClock) window.clearInterval(this.liveClock);
        this.liveClock = window.setInterval(() => this.renderCurrentOrders(), 30000);
    }

    handleLiveOrders(orders = [], meta = {}) {
        const now = Date.now();
        const changes = Array.isArray(meta.changes) ? meta.changes : [];

        const isStartupWindow = now - this.liveStartedAt < 2500;

        if (!this.hasInitialLiveSnapshot) {
            this.knownOrderIds = new Set(orders.map((order) => order.id));
            this.hasInitialLiveSnapshot = true;
        } else {
            changes.forEach((change) => {
                if (change.type === 'added' && !this.knownOrderIds.has(change.id) && !isStartupWindow) {
                    this.newOrderIds.set(change.id, now + 10000);
                    this.playNewOrderSound();
                    window.setTimeout(() => {
                        this.newOrderIds.delete(change.id);
                        this.renderCurrentOrders();
                    }, 10050);
                }
                if (change.type !== 'removed') this.knownOrderIds.add(change.id);
            });
        }

        this.currentOrderDocs = orders.map((order) => this.toDocLike(order));
        this.renderCurrentOrders();
    }

    toDocLike(order) {
        return {
            id: order.id,
            data: () => order
        };
    }

    renderCurrentOrders() {
        const statusFilter = this.filterSelect ? this.filterSelect.value : 'all';
        const scope = this.storeScope ? this.storeScope.value : 'selected';
        const now = Date.now();

        this.newOrderIds.forEach((expiresAt, orderId) => {
            if (expiresAt <= now) this.newOrderIds.delete(orderId);
        });

        const docs = this.currentOrderDocs.filter((docSnap) => {
            if (statusFilter === 'all') return true;
            const order = docSnap.data();
            return order.status === statusFilter || normalizeOrderStatus(order.status, order) === statusFilter;
        });

        this.renderDashboard(docs);
        this.renderBoard(docs, { showCompany: scope === 'all' });
        this.renderList(docs, { showCompany: scope === 'all' });
    }

    playNewOrderSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = 880;
            gain.gain.value = 0.04;
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.18);
        } catch (error) {
            // Browsers may block sound until the user interacts with the page.
        }
    }

    async loadOrders() {
        if (!this.list) return;
        this.list.innerHTML = '<p>Loading orders...</p>';

        const statusFilter = this.filterSelect ? this.filterSelect.value : 'all';
        const scope = this.storeScope ? this.storeScope.value : 'selected';

        try {
            let q;
            if (scope === 'all') {
                q = statusFilter === 'all'
                    ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
                    : query(collection(db, 'orders'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
            } else if (statusFilter === 'all') {
                q = query(collection(db, 'orders'), where('companyId', '==', getCurrentCompanyId()), orderBy('createdAt', 'desc'));
            } else {
                q = query(collection(db, 'orders'), where('companyId', '==', getCurrentCompanyId()), where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
            }

            const snap = await getDocs(q);
            const docs = scope === 'all' ? snap.docs : this.filterCompanyDocs(snap.docs, 'orders');
            this.renderDashboard(docs);
            this.renderBoard(docs, { showCompany: scope === 'all' });
            await this.renderList(docs, { showCompany: scope === 'all' });
        } catch (e) {
            console.error("Load Orders Error:", e);
            if (this.board) this.board.innerHTML = '';
            this.list.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;

            // Index correction hint
            if (e.message.includes("requires an index")) {
                this.list.innerHTML += `<p style="font-size:0.8rem; color:#666;">(Missing Index for current filter)</p>`;
                // Fallback: client side filter
                const fallbackQuery = scope === 'all'
                    ? query(collection(db, 'orders'))
                    : query(collection(db, 'orders'), where('companyId', '==', getCurrentCompanyId()));
                const allSnap = await getDocs(fallbackQuery);
                const filtered = allSnap.docs
                    .filter(d => statusFilter === 'all' || d.data().status === statusFilter)
                    .sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
                const docs = scope === 'all' ? filtered : this.filterCompanyDocs(filtered, 'orders');
                this.renderDashboard(docs);
                this.renderBoard(docs, { showCompany: scope === 'all' });
                await this.renderList(docs, { showCompany: scope === 'all' });
            }
        }
    }

    filterCompanyDocs(docs, collectionName) {
        return docs.filter((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() };
            return matchesCompanyId(data, `${collectionName}/${data.id}`);
        });
    }

    renderDashboard(docs = []) {
        if (!this.dashboard) return;

        const orders = docs.map((d) => d.data ? d.data() : d);
        const totalRevenue = orders.reduce((sum, order) => {
            const value = Number(order.total ?? order.price ?? 0);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const pending = orders.filter((order) => normalizeOrderStatus(order.status, order) === 'new').length;
        const active = orders.filter((order) => ['accepted', 'preparing', 'ready', 'delivery'].includes(normalizeOrderStatus(order.status, order))).length;
        const completed = orders.filter((order) => normalizeOrderStatus(order.status, order) === 'completed').length;
        const stores = new Set(orders.map((order) => order.companyId || COMPANY_ID));

        const cards = [
            ['Orders', orders.length],
            ['Revenue', `${totalRevenue} som`],
            ['New', pending],
            ['Active', active],
            ['Completed', completed],
            ['Stores', stores.size]
        ];

        this.dashboard.innerHTML = cards.map(([label, value]) => `
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:0.9rem;">
                <div style="font-size:0.75rem; color:#666; text-transform:uppercase; font-weight:800;">${label}</div>
                <div style="font-size:1.35rem; font-weight:900; color:#2e7d32;">${value}</div>
            </div>
        `).join('');
    }

    getBoardColumns() {
        return [
            {
                id: 'new',
                title: 'New Orders',
                helper: 'Needs store acceptance',
                statuses: ['new'],
                targetStatus: 'new'
            },
            {
                id: 'accepted',
                title: 'Accepted',
                helper: 'Confirmed by the store',
                statuses: ['accepted'],
                targetStatus: 'accepted'
            },
            {
                id: 'preparing',
                title: 'Preparing',
                helper: 'Being packed or baked',
                statuses: ['preparing'],
                targetStatus: 'preparing'
            },
            {
                id: 'ready',
                title: 'Ready',
                helper: 'Packed and waiting',
                statuses: ['ready'],
                targetStatus: 'ready'
            },
            {
                id: 'delivery',
                title: 'Delivery / Pickup',
                helper: 'On the way or ready for pickup',
                statuses: ['delivery'],
                targetStatus: 'delivery'
            },
            {
                id: 'completed',
                title: 'Completed',
                helper: 'Delivered or picked up',
                statuses: ['completed'],
                targetStatus: 'completed'
            },
            {
                id: 'cancelled',
                title: 'Cancelled',
                helper: 'Released or rejected',
                statuses: ['cancelled'],
                targetStatus: 'cancelled'
            }
        ];
    }

    renderBoard(docs = [], { showCompany = false } = {}) {
        if (!this.board) return;

        const orders = docs.map((d) => ({ id: d.id, ...(d.data ? d.data() : d) }));
        if (!orders.length) {
            this.board.innerHTML = '<div class="orders-board-empty">No orders match this view yet.</div>';
            return;
        }

        this.board.innerHTML = this.getBoardColumns().map((column) => {
            const columnOrders = orders.filter((order) => column.statuses.includes(normalizeOrderStatus(order.status, order)));
            return `
                <section class="orders-column" data-board-status="${column.targetStatus}">
                    <div class="orders-column-header">
                        <div>
                            <strong>${escapeHtml(column.title)}</strong>
                            <small>${escapeHtml(column.helper)}</small>
                        </div>
                        <span>${columnOrders.length}</span>
                    </div>
                    <div class="orders-column-body">
                        ${columnOrders.length
                    ? columnOrders.map((order) => this.renderBoardCard(order, { showCompany })).join('')
                    : '<div class="orders-drop-hint">No orders here</div>'}
                    </div>
                </section>
            `;
        }).join('');
    }

    renderBoardCard(order, { showCompany = false } = {}) {
        const createdAt = order.createdAt?.toDate ? order.createdAt.toDate() : null;
        const createdLabel = createdAt ? createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New';
        const items = this.getOrderItemsText(order);
        const total = Number(order.total ?? order.price ?? 0);
        const deliveryLabel = order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery';
        const urgency = getUrgencyState(order);
        const trackingUrl = getTrackingUrl(order.id);
        const qrUrl = getTrackingQrUrl(order.id, { size: 96, url: trackingUrl });
        const actions = this.renderBoardCardActions(order);
        const normalizedStatus = normalizeOrderStatus(order.status, order);
        const isNew = this.newOrderIds.has(order.id);

        return `
            <article class="order-kanban-card ${escapeHtml(urgency.className)} ${isNew ? 'is-new-order' : ''}" data-order-id="${escapeHtml(order.id)}" data-order-status="${escapeHtml(normalizedStatus)}">
                <div class="order-card-topline">
                    <span class="order-card-id">#${escapeHtml(order.id.slice(0, 8))}</span>
                    <span class="order-card-badges">
                        ${isNew ? '<span class="new-order-badge">NEW</span>' : ''}
                        <span class="order-chip" style="--chip-color:${this.getStatusColor(normalizedStatus)}">${escapeHtml(this.getStatusLabel(normalizedStatus))}</span>
                    </span>
                </div>
                <h4>${escapeHtml(items)}</h4>
                <div class="order-card-meta">
                    <span>${escapeHtml(order.customerName || 'Guest customer')}</span>
                    <span>${escapeHtml(order.phone || order.customerPhone || 'No phone')}</span>
                    <span>${escapeHtml(deliveryLabel)}${order.customerAddress ? `: ${escapeHtml(order.customerAddress)}` : ''}</span>
                </div>
                <div class="order-urgency-row">
                    <span>${escapeHtml(urgency.label)}</span>
                    <span>${escapeHtml(formatElapsed(order))} • ${escapeHtml(formatTimeRemaining(order))}</span>
                </div>
                <div class="order-card-footer">
                    <strong>${Number.isFinite(total) ? total : 0} som</strong>
                    <span>${escapeHtml(createdLabel)}</span>
                </div>
                ${showCompany ? `<div class="order-card-store">${escapeHtml(order.companyId || COMPANY_ID)}</div>` : ''}
                <div class="order-tracking-mini">
                    <img src="${qrUrl}" alt="Tracking QR for order ${escapeHtml(order.id)}">
                    <a href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener">Customer tracking</a>
                </div>
                ${actions}
            </article>
        `;
    }

    renderBoardCardActions(order) {
        const id = escapeHtml(order.id);
        const transition = getNextOrderTransition(order);

        if (!transition) return '';
        return `
            <div class="order-card-actions">
                <button class="btn-primary live-order-action" onclick="advanceStoreOrder('${id}')">${escapeHtml(transition.label)}</button>
                <button class="btn-danger" onclick="cancelOrderAdmin('${id}')">Cancel</button>
            </div>
        `;
    }

    getOrderItemsText(order) {
        if (Array.isArray(order.items) && order.items.length) {
            return order.items
                .map((item) => `${Number(item.quantity || 1)} x ${item.name_en || item.name_ru || item.name_kg || item.productName || item.productId || 'Item'}`)
                .join(', ');
        }
        return order.productName || order.productId || 'Order item';
    }

    getStatusLabel(status) {
        const labels = {
            ...STATUS_LABELS,
            pending_payment: 'Pending',
            pending_verification: 'Verify',
            reserved: 'Reserved',
            paid: 'Accepted',
            out_for_delivery: 'Delivery',
            delivered: 'Completed'
        };
        return labels[status] || status || 'Unknown';
    }

    async advanceStoreOrder(orderId) {
        try {
            const order = await this.ensureCompanyOrder(orderId);
            const transition = getNextOrderTransition(order);
            if (!transition) return;

            await updateOrderStatus(orderId, transition.status, {
                storeId: order.storeId || order.companyId || getCurrentCompanyId(),
                companyId: order.companyId || getCurrentCompanyId(),
                estimatedTime: order.estimatedTime
            });
        } catch (e) {
            alert(e.message || e);
        }
    }

    async renderList(docs, { showCompany = false } = {}) {
        if (docs.length === 0) {
            this.list.innerHTML = '<p style="color:#666; padding:1rem;">No orders found.</p>';
            return;
        }

        this.list.innerHTML = '';
        for (const d of docs) {
            const order = d.data();
            const id = d.id;
            const date = order.createdAt ? new Date(order.createdAt.toDate()) : new Date();
            const timeAgo = Math.floor((new Date() - date) / 60000); // mins
            const isExpired = order.expiresAt?.toDate ? order.expiresAt.toDate() < new Date() : timeAgo > 15;
            const receiptUrl = await this.getReceiptUrl(order);
            const normalizedStatus = normalizeOrderStatus(order.status, order);
            const transition = getNextOrderTransition({ id, ...order });
            const trackingUrl = getTrackingUrl(id);
            const qrUrl = getTrackingQrUrl(id, { size: 110, url: trackingUrl });
            const orderItems = Array.isArray(order.items) && order.items.length
                ? order.items.map(item => `${item.quantity} x ${item.name_en || item.name_ru || item.name_kg || item.productName || item.productId}`).join('<br>')
                : `${order.productName || order.productId || 'Unknown Product'}`;

            let actions = '';

            if (transition) {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="advanceStoreOrder('${id}')" class="btn-primary" style="color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">${escapeHtml(transition.label)}</button>
                        <button onclick="cancelOrderAdmin('${id}')" class="btn-danger" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Cancel</button>
                    </div>
                 `;
            }

            const el = document.createElement('div');
            el.className = 'list-item';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'flex-start';

            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <div>
                        <strong>Order #${id}</strong> <span style="color:#666;">(${date.toLocaleString()})</span>
                        <div style="font-size:0.85rem; color:#888;">Order ID: ${id} • ${date.toLocaleString()}</div>
                        ${showCompany ? `<div style="font-size:0.85rem; color:#2e7d32; font-weight:700;">Store: ${order.companyId || COMPANY_ID}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <span class="status-badge status-${order.status}" 
                              style="padding:2px 8px; border-radius:12px; font-size:0.8rem; background:${this.getStatusColor(normalizedStatus)}; color:white;">
                            ${escapeHtml(this.getStatusLabel(normalizedStatus))}
                        </span>
                    </div>
                </div>

                <div style="margin-top:10px; width:100%; display:grid; gap:10px; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));">
                    <div>
                        <div style="font-size:0.8rem; color:#777; font-weight:700;">Items</div>
                        <div>${orderItems}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem; color:#777; font-weight:700;">Customer</div>
                        <div>${order.customerName || 'Guest'}</div>
                        <div>${order.phone || order.customerPhone || ''}</div>
                        <div>${order.customerAddress || ''}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem; color:#777; font-weight:700;">Totals</div>
                        <div>Subtotal: ${order.subtotal ?? order.price ?? 0} som</div>
                        <div>Delivery: ${order.deliveryFee ?? 0} som</div>
                        <div><strong>Total: ${order.total ?? order.price ?? 0} som</strong></div>
                        <div>${order.deliveryMethod || 'delivery'}</div>
                        <div>${escapeHtml(formatElapsed(order))} • ${escapeHtml(formatTimeRemaining(order))}</div>
                    </div>
                </div>
                <div class="order-detail-tracking">
                    <img src="${qrUrl}" alt="Tracking QR for order ${escapeHtml(id)}">
                    <div>
                        <div style="font-size:0.8rem; color:#777; font-weight:700;">Customer Tracking</div>
                        <a href="${escapeHtml(trackingUrl)}" target="_blank" rel="noopener">${escapeHtml(trackingUrl)}</a>
                    </div>
                </div>
                
                ${receiptUrl ? `
                    <div style="margin-top:10px; border:1px solid #eee; padding:5px;">
                        <span style="font-size:0.8rem; font-weight:bold;">Receipt:</span><br>
                        <a href="${receiptUrl}" target="_blank">
                            <img src="${receiptUrl}" style="max-height:100px; max-width:100%; object-fit:contain;">
                        </a>
                    </div>
                ` : ''}

                ${actions}
            `;
            this.list.appendChild(el);
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'new': return '#2563eb';
            case 'accepted': return '#16a34a';
            case 'ready': return '#f59e0b';
            case 'delivery': return '#0891b2';
            case 'completed': return '#0f766e';
            case 'paid': return '#2e7d32'; // Green
            case 'preparing': return '#6a1b9a';
            case 'out_for_delivery': return '#00897b';
            case 'delivered': return '#1565c0';
            case 'pending_verification': return '#ff9800'; // Orange
            case 'pending_payment':
            case 'reserved': return '#2196f3'; // Blue
            case 'cancelled': return '#f44336'; // Red
            default: return '#9e9e9e';
        }
    }

    async getReceiptUrl(order) {
        if (order.receiptUrl) return order.receiptUrl;
        if (!order.receiptPath) return '';
        if (this.receiptUrlCache.has(order.receiptPath)) return this.receiptUrlCache.get(order.receiptPath);

        try {
            const url = await getDownloadURL(ref(storage, order.receiptPath));
            this.receiptUrlCache.set(order.receiptPath, url);
            return url;
        } catch (error) {
            console.warn('Receipt URL unavailable:', error);
            return '';
        }
    }

    async ensureCompanyOrder(orderId) {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (!orderSnap.exists()) throw new Error('Order not found');

        const order = orderSnap.data();
        if (order.companyId && !matchesCompanyId(order, `orders/${orderId}`)) {
            throw new Error('Order belongs to another company');
        }
        if (!order.companyId) {
            console.warn('Order missing companyId:', orderId);
        }
        return { id: orderId, ...order };
    }

    async verifyOrder(orderId) {
        if (!confirm("Confirm payment received? Status will be PAID.")) return;
        try {
            await this.ensureCompanyOrder(orderId);
            await updateDoc(doc(db, 'orders', orderId), {
                status: 'paid',
                paymentStatus: 'paid',
                verifiedAt: serverTimestamp(),
                paidAt: serverTimestamp()
            });
            alert("Order Verified!");
            this.loadOrders();
        } catch (e) { alert(e.message); }
    }

    async rejectOrder(orderId) {
        if (!confirm("Reject payment? This will CANCEL the order and RELEASE stock.")) return;
        try {
            await this.cancelAndRelease(orderId, 'rejected_payment');
            alert("Order Rejected & Stock Released");
            this.loadOrders();
        } catch (e) { alert(e.message); }
    }

    async markOrderPreparing(orderId) {
        try {
            await this.ensureCompanyOrder(orderId);
            await updateDoc(doc(db, 'orders', orderId), {
                status: 'preparing',
                preparingAt: serverTimestamp()
            });
            this.loadOrders();
        } catch (e) { alert(e.message); }
    }

    async markOrderDelivered(orderId) {
        try {
            await this.ensureCompanyOrder(orderId);
            await updateDoc(doc(db, 'orders', orderId), {
                status: 'delivered',
                deliveredAt: serverTimestamp()
            });
            this.loadOrders();
        } catch (e) { alert(e.message); }
    }

    async markOrderOutForDelivery(orderId, deliveryMethod = 'delivery') {
        try {
            await this.ensureCompanyOrder(orderId);
            const timestampField = deliveryMethod === 'pickup' ? 'readyForPickupAt' : 'outForDeliveryAt';

            await updateDoc(doc(db, 'orders', orderId), {
                status: 'out_for_delivery',
                [timestampField]: serverTimestamp()
            });
            this.loadOrders();
        } catch (e) { alert(e.message); }
    }

    async cancelOrderAdmin(orderId) {
        if (!confirm("Cancel this order and release stock?")) return;
        try {
            await this.cancelAndRelease(orderId, 'admin_cancelled');
            this.loadOrders();
        } catch (e) { alert(e.message); }
    }

    async releaseExpiredOrders() {
        if (!confirm("Release stock for ALL expired reservations (>15 mins)?")) return;

        const now = new Date();
        const cutoff = new Date(now.getTime() - 15 * 60000); // 15 mins ago

        try {
            // Find expired reserved orders
            const q = query(
                collection(db, 'orders'),
                where('companyId', '==', getCurrentCompanyId()),
                where('status', '==', 'pending_payment'),
                where('createdAt', '<', cutoff)
            );

            let snap;
            try {
                snap = await getDocs(q);
            } catch (e) {
                // Client-side fallback if index missing
                const all = await getDocs(query(collection(db, 'orders'), where('companyId', '==', getCurrentCompanyId()), where('status', '==', 'pending_payment')));
                snap = { docs: all.docs.filter(d => d.data().createdAt.toDate() < cutoff) };
            }
            snap.docs = this.filterCompanyDocs(snap.docs, 'orders');

            if (snap.docs.length === 0) {
                return alert("No expired orders found.");
            }

            let count = 0;
            for (const d of snap.docs) {
                await this.cancelAndRelease(d.id, 'expired_cleanup');
                count++;
            }
            alert(`Released ${count} expired orders.`);
            this.loadOrders();

        } catch (e) { alert(e.message); }
    }

    async cancelAndRelease(orderId, reason) {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw "Order not found";

            const order = orderSnap.data();
            if (order.companyId && !matchesCompanyId(order, `orders/${orderId}`)) throw "Order belongs to another company";
            if (!order.companyId) console.warn('Order missing companyId:', orderId);
            if (['cancelled', 'delivered'].includes(order.status)) throw "Order already finalized";

            // Release Stock
            const dateStr = order.date; // e.g. "2025-01-11"
            const items = Array.isArray(order.items) && order.items.length
                ? order.items.map(item => ({ productId: item.productId, quantity: Number(item.quantity || 1) }))
                : (order.productId ? [{ productId: order.productId, quantity: 1 }] : []);

            if (dateStr && items.length) {
                const companyId = order.companyId || getCurrentCompanyId();
                const invRefNew = doc(db, 'inventory', getInventoryDocId(companyId, dateStr));
                let invRef = invRefNew;
                let invSnap = await transaction.get(invRefNew);

                // Back-compat: legacy single-tenant inventory used date-only IDs.
                if (!invSnap.exists() && companyId === COMPANY_ID) {
                    const invRefOld = doc(db, 'inventory', dateStr);
                    const invSnapOld = await transaction.get(invRefOld);
                    if (invSnapOld.exists()) {
                        invRef = invRefOld;
                        invSnap = invSnapOld;
                    }
                }

                if (invSnap.exists()) {
                    const invData = invSnap.data();
                    if (invData.companyId && !matchesCompanyId(invData, `inventory/${invRef.id}`)) throw "Inventory belongs to another company";
                    if (!invData.companyId) console.warn('Inventory missing companyId:', dateStr);
                    const updates = {};

                    items.forEach(item => {
                        const currentAvail = invData[item.productId]?.available || 0;
                        const currentSold = invData[item.productId]?.sold || 0;

                        updates[`${item.productId}.available`] = currentAvail + item.quantity;
                        updates[`${item.productId}.sold`] = Math.max(0, currentSold - item.quantity);
                    });

                    transaction.update(invRef, updates);
                }
            }

            transaction.update(orderRef, {
                status: 'cancelled',
                paymentStatus: 'cancelled',
                cancelledAt: serverTimestamp(),
                reason: reason
            });
        });
    }
}
