import { BaseTab } from './BaseTab.js';
import { auth, db } from '../../firebase-config.js';
import { COMPANY_ID, getCurrentCompanyId, matchesCompanyId } from '../../company-config.js';
import { getCheckoutSettingsDocId } from '../../firestore-paths.js';
import { getPreferredProductName, getRetailPrice } from '../../product-utils.js';
import { getNextOrderTransition, normalizeOrderStatus, STATUS_LABELS, updateOrderStatus } from '../../services/orderActions.js?v=1.1';
import { buildWhatsAppOrderRecord, buildWhatsAppReplyUrl, normalizeMoney, WHATSAPP_ORDER_SOURCE } from '../../whatsapp-order-utils.mjs?v=1';
import { logAudit } from '../utils.js';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function timestampMillis(value) {
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();
    const parsed = new Date(value || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function bishkekDayId(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

function formatOrderDate(value) {
    const millis = timestampMillis(value);
    if (!millis) return 'Just now';
    return new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Bishkek',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(millis));
}

function getOrderItemsLabel(order) {
    return (Array.isArray(order.items) ? order.items : [])
        .map((item) => `${Math.max(1, Number(item.quantity || 1))} × ${item.productName || item.name || item.name_en || item.productId || 'Product'}`)
        .join(', ') || order.productName || 'WhatsApp order';
}

export class WhatsAppOrdersTab extends BaseTab {
    constructor() {
        super('whatsappOrders');
        this.form = document.getElementById('whatsappOrderForm');
        this.customerName = document.getElementById('waCustomerName');
        this.customerPhone = document.getElementById('waCustomerPhone');
        this.customerAddress = document.getElementById('waCustomerAddress');
        this.productSelect = document.getElementById('waProductSelect');
        this.customProduct = document.getElementById('waCustomProduct');
        this.quantity = document.getElementById('waQuantity');
        this.unitPrice = document.getElementById('waUnitPrice');
        this.addItemBtn = document.getElementById('waAddItemBtn');
        this.itemsList = document.getElementById('waOrderItems');
        this.deliveryMethod = document.getElementById('waDeliveryMethod');
        this.deliveryFee = document.getElementById('waDeliveryFee');
        this.paymentStatus = document.getElementById('waPaymentStatus');
        this.notes = document.getElementById('waNotes');
        this.subtotalNode = document.getElementById('waSubtotal');
        this.totalNode = document.getElementById('waTotal');
        this.saveBtn = document.getElementById('waSaveOrderBtn');
        this.resetBtn = document.getElementById('waResetOrderBtn');
        this.formStatus = document.getElementById('waFormStatus');
        this.ordersList = document.getElementById('whatsappOrdersList');
        this.stats = document.getElementById('whatsappOrdersStats');
        this.refreshBtn = document.getElementById('waRefreshOrdersBtn');
        this.openBoardBtn = document.getElementById('waOpenOrdersBoardBtn');
        this.products = [];
        this.lineItems = [];
        this.activeOrders = new Map();
        this.unsubscribeOrders = null;
    }

    async init() {
        this.form?.addEventListener('submit', (event) => this.saveOrder(event));
        this.addItemBtn?.addEventListener('click', () => this.addLineItem());
        this.resetBtn?.addEventListener('click', () => this.resetForm());
        this.refreshBtn?.addEventListener('click', () => this.refreshHistory());
        this.openBoardBtn?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('oako:navigate-admin-tab', { detail: { tab: 'orders' } }));
        });
        this.productSelect?.addEventListener('change', () => this.handleProductSelection());
        this.deliveryFee?.addEventListener('input', () => this.renderTotals());
        this.itemsList?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-remove-wa-item]');
            if (!button) return;
            this.lineItems.splice(Number(button.dataset.removeWaItem), 1);
            this.renderItems();
        });
        this.ordersList?.addEventListener('click', (event) => this.handleOrderAction(event));

        await Promise.all([this.loadProducts(), this.loadDeliverySettings()]);
        this.renderItems();
        this.startLiveOrders();
    }

    onShow() {
        if (!this.unsubscribeOrders) this.startLiveOrders();
    }

    onStoreChanged() {
        if (!this.isInitialized) return;
        this.lineItems = [];
        this.activeOrders.clear();
        this.renderItems();
        this.loadProducts();
        this.loadDeliverySettings();
        this.startLiveOrders();
    }

    pauseLiveUpdates(message = 'Session reconnecting...') {
        if (this.unsubscribeOrders) this.unsubscribeOrders();
        this.unsubscribeOrders = null;
        if (this.ordersList) this.ordersList.innerHTML = `<div class="wa-empty-state">${escapeHtml(message)}</div>`;
    }

    resumeLiveUpdates() {
        if (this.isInitialized && !this.unsubscribeOrders) this.startLiveOrders();
    }

    async loadProducts() {
        const companyId = getCurrentCompanyId();
        try {
            let snapshot;
            try {
                snapshot = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
            } catch (_) {
                snapshot = await getDocs(collection(db, 'products'));
            }
            this.products = snapshot.docs
                .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
                .filter((product) => matchesCompanyId(product, `products/${product.id}`))
                .filter((product) => product.active !== false)
                .sort((a, b) => getPreferredProductName(a).localeCompare(getPreferredProductName(b)));
        } catch (error) {
            console.warn('Could not load products for WhatsApp orders:', error);
            this.products = [];
        }
        this.renderProductOptions();
    }

    renderProductOptions() {
        if (!this.productSelect) return;
        this.productSelect.innerHTML = '<option value="">Choose a product</option>'
            + this.products.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(getPreferredProductName(product))}</option>`).join('')
            + '<option value="__custom">Custom item…</option>';
    }

    handleProductSelection() {
        const custom = this.productSelect?.value === '__custom';
        if (this.customProduct) {
            this.customProduct.hidden = !custom;
            if (custom) this.customProduct.focus();
        }
        const product = this.products.find((item) => item.id === this.productSelect?.value);
        if (product && this.unitPrice) this.unitPrice.value = getRetailPrice(product) || '';
    }

    async loadDeliverySettings() {
        try {
            const companyId = getCurrentCompanyId();
            let snapshot = await getDoc(doc(db, 'shop_settings', getCheckoutSettingsDocId(companyId)));
            if (!snapshot.exists() && companyId === COMPANY_ID) snapshot = await getDoc(doc(db, 'shop_settings', 'checkout'));
            if (snapshot.exists() && this.deliveryFee && !this.deliveryFee.value) {
                this.deliveryFee.value = Number(snapshot.data().deliveryFee || 0);
                this.renderTotals();
            }
        } catch (error) {
            console.warn('Could not load the default delivery fee:', error);
        }
    }

    addLineItem() {
        const selectedId = this.productSelect?.value || '';
        const product = this.products.find((item) => item.id === selectedId);
        const productName = selectedId === '__custom'
            ? String(this.customProduct?.value || '').trim()
            : getPreferredProductName(product);
        const unitPrice = normalizeMoney(this.unitPrice?.value);
        const quantity = Math.max(1, Number.parseInt(this.quantity?.value, 10) || 1);

        if (!productName) return this.setFormStatus('Choose a product or enter a custom item.', true);
        this.lineItems.push({ productId: product?.id || '', productName, quantity, unitPrice });
        this.productSelect.value = '';
        this.customProduct.value = '';
        this.customProduct.hidden = true;
        this.quantity.value = '1';
        this.unitPrice.value = '';
        this.setFormStatus('');
        this.renderItems();
    }

    renderItems() {
        if (!this.itemsList) return;
        if (!this.lineItems.length) {
            this.itemsList.innerHTML = '<div class="wa-empty-item">No products added yet.</div>';
        } else {
            this.itemsList.innerHTML = this.lineItems.map((item, index) => `
                <div class="wa-line-item">
                    <div><strong>${escapeHtml(item.productName)}</strong><span>${item.quantity} × ${normalizeMoney(item.unitPrice)} som</span></div>
                    <strong>${normalizeMoney(item.quantity * item.unitPrice)} som</strong>
                    <button type="button" data-remove-wa-item="${index}" aria-label="Remove ${escapeHtml(item.productName)}">Remove</button>
                </div>
            `).join('');
        }
        this.renderTotals();
    }

    renderTotals() {
        const subtotal = normalizeMoney(this.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0));
        const delivery = normalizeMoney(this.deliveryFee?.value);
        if (this.subtotalNode) this.subtotalNode.textContent = `${subtotal} som`;
        if (this.totalNode) this.totalNode.textContent = `${normalizeMoney(subtotal + delivery)} som`;
    }

    async saveOrder(event) {
        event.preventDefault();
        if (!this.lineItems.length) return this.setFormStatus('Add at least one product before saving.', true);

        try {
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = 'Saving order…';
            const record = buildWhatsAppOrderRecord({
                companyId: getCurrentCompanyId(),
                customerName: this.customerName?.value,
                customerPhone: this.customerPhone?.value,
                customerAddress: this.customerAddress?.value,
                items: this.lineItems,
                deliveryMethod: this.deliveryMethod?.value,
                deliveryFee: this.deliveryFee?.value,
                paymentStatus: this.paymentStatus?.value,
                paymentMethod: this.paymentStatus?.value,
                notes: this.notes?.value,
                estimatedTime: this.deliveryMethod?.value === 'pickup' ? 30 : 60
            });
            const user = auth.currentUser;
            const saved = await addDoc(collection(db, 'orders'), {
                ...record,
                date: bishkekDayId(),
                inventoryReserved: false,
                createdBy: user?.email || user?.uid || 'admin',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            await logAudit('WhatsApp Order Added', `Order ${saved.id}: ${record.customerName}, ${record.total} som`);
            this.setFormStatus(`Order ${saved.id.slice(0, 8).toUpperCase()} saved and added to the main Orders board.`);
            this.resetForm({ keepStatus: true, keepDeliveryFee: true });
        } catch (error) {
            this.setFormStatus(error?.message || 'Could not save the order.', true);
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Save WhatsApp Order';
        }
    }

    resetForm({ keepStatus = false, keepDeliveryFee = false } = {}) {
        const deliveryFee = this.deliveryFee?.value || '';
        this.form?.reset();
        this.lineItems = [];
        if (keepDeliveryFee && this.deliveryFee) this.deliveryFee.value = deliveryFee;
        if (this.customProduct) this.customProduct.hidden = true;
        if (!keepStatus) this.setFormStatus('');
        this.renderItems();
    }

    setFormStatus(message, isError = false) {
        if (!this.formStatus) return;
        this.formStatus.textContent = message || '';
        this.formStatus.classList.toggle('is-error', isError);
    }

    startLiveOrders() {
        if (this.unsubscribeOrders) this.unsubscribeOrders();
        this.unsubscribeOrders = null;
        const companyId = getCurrentCompanyId();
        if (this.ordersList) this.ordersList.innerHTML = '<div class="wa-empty-state">Loading WhatsApp orders…</div>';

        this.unsubscribeOrders = onSnapshot(
            query(collection(db, 'orders'), where('companyId', '==', companyId), limit(100)),
            (snapshot) => {
                this.activeOrders.clear();
                snapshot.docs.forEach((orderDoc) => {
                    const order = { id: orderDoc.id, ...orderDoc.data(), archived: false };
                    if (order.source === WHATSAPP_ORDER_SOURCE && matchesCompanyId(order, `orders/${order.id}`)) {
                        this.activeOrders.set(order.id, order);
                    }
                });
                this.renderHistory();
            },
            (error) => {
                console.warn('WhatsApp order listener failed:', error);
                if (this.ordersList) this.ordersList.innerHTML = '<div class="wa-empty-state">Orders could not be loaded. Try Refresh.</div>';
            }
        );
    }

    async refreshHistory() {
        this.startLiveOrders();
    }

    allOrders() {
        return [...this.activeOrders.values()]
            .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    }

    renderHistory() {
        const orders = this.allOrders();
        this.renderStats(orders);
        if (!this.ordersList) return;
        if (!orders.length) {
            this.ordersList.innerHTML = '<div class="wa-empty-state"><strong>No WhatsApp orders yet</strong><span>Enter the first confirmed chat order using the form.</span></div>';
            return;
        }

        this.ordersList.innerHTML = orders.map((order) => {
            const normalizedStatus = normalizeOrderStatus(order.status, order);
            const transition = getNextOrderTransition(order);
            const replyUrl = buildWhatsAppReplyUrl({ phone: order.customerPhone || order.phone, orderId: order.id.slice(0, 8).toUpperCase(), customerName: order.customerName });
            const paid = order.paymentStatus === 'paid';
            return `
                <article class="wa-order-card" data-wa-order-id="${escapeHtml(order.id)}">
                    <div class="wa-order-card-head">
                        <div><span class="wa-order-reference">#${escapeHtml(order.id.slice(0, 8).toUpperCase())}</span><strong>${escapeHtml(order.customerName || 'Customer')}</strong></div>
                        <span class="wa-status wa-status-${escapeHtml(normalizedStatus)}">${escapeHtml(STATUS_LABELS[normalizedStatus] || normalizedStatus)}</span>
                    </div>
                    <p class="wa-order-items">${escapeHtml(getOrderItemsLabel(order))}</p>
                    <div class="wa-order-meta">
                        <span>${escapeHtml(order.customerPhone || order.phone || 'No phone')}</span>
                        <span>${escapeHtml(order.deliveryMethod === 'pickup' ? 'Pickup' : order.deliveryMethod === 'yandex_delivery' ? 'Yandex Delivery' : 'Other courier')}</span>
                        <span>${escapeHtml(formatOrderDate(order.createdAt))}</span>
                    </div>
                    ${order.customerAddress ? `<p class="wa-order-address">${escapeHtml(order.customerAddress)}</p>` : ''}
                    <div class="wa-order-total-row"><strong>${normalizeMoney(order.total)} som</strong><span class="${paid ? 'is-paid' : ''}">${paid ? 'Paid' : order.paymentStatus === 'collect_on_delivery' ? 'Collect on delivery' : 'Payment pending'}</span></div>
                    <div class="wa-order-actions">
                        ${replyUrl ? `<a class="wa-reply-link" href="${escapeHtml(replyUrl)}" target="_blank" rel="noopener">Reply in WhatsApp</a>` : ''}
                        ${!paid ? `<button type="button" data-wa-action="paid" data-order-id="${escapeHtml(order.id)}">Mark paid</button>` : ''}
                        ${transition ? `<button type="button" class="is-primary" data-wa-action="advance" data-order-id="${escapeHtml(order.id)}">${escapeHtml(transition.label)}</button>` : ''}
                    </div>
                </article>
            `;
        }).join('');
    }

    renderStats(orders) {
        if (!this.stats) return;
        const todayId = bishkekDayId();
        const today = orders.filter((order) => order.date === todayId || bishkekDayId(new Date(timestampMillis(order.createdAt))) === todayId);
        const active = orders.filter((order) => !['completed', 'cancelled'].includes(normalizeOrderStatus(order.status, order)));
        const completed = orders.filter((order) => normalizeOrderStatus(order.status, order) === 'completed');
        const completedRevenue = completed.reduce((sum, order) => sum + normalizeMoney(order.total), 0);
        this.stats.innerHTML = `
            <div><span>Today</span><strong>${today.length}</strong></div>
            <div><span>Active</span><strong>${active.length}</strong></div>
            <div><span>Completed</span><strong>${completed.length}</strong></div>
            <div><span>Completed value</span><strong>${normalizeMoney(completedRevenue)} som</strong></div>
        `;
    }

    async handleOrderAction(event) {
        const button = event.target.closest('[data-wa-action]');
        if (!button) return;
        const orderId = button.dataset.orderId;
        const order = this.activeOrders.get(orderId);
        if (!order) return;

        button.disabled = true;
        try {
            if (button.dataset.waAction === 'paid') {
                await updateDoc(doc(db, 'orders', orderId), {
                    paymentStatus: 'paid',
                    paidAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            } else if (button.dataset.waAction === 'advance') {
                const transition = getNextOrderTransition(order);
                if (transition) {
                    await updateOrderStatus(orderId, transition.status, {
                        storeId: order.storeId || order.companyId,
                        companyId: order.companyId,
                        estimatedTime: order.estimatedTime,
                        archive: false
                    });
                }
            }
        } catch (error) {
            alert(error?.message || 'Could not update the order.');
        } finally {
            button.disabled = false;
        }
    }
}
