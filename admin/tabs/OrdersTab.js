import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { COMPANY_ID, getCurrentCompanyId, matchesCompanyId } from '../../company-config.js';
import { getInventoryDocId } from '../../firestore-paths.js';
import {
    collection, query, where, orderBy, getDocs, getDoc, doc, updateDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { storage } from '../../firebase-config.js';
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

export class OrdersTab extends BaseTab {
    constructor() {
        super('orders');
        this.list = document.getElementById('ordersList');
        this.dashboard = document.getElementById('ordersDashboard');
        this.filterSelect = document.getElementById('orderFilterStatus');
        this.storeScope = document.getElementById('orderStoreScope');
        this.btnRefresh = document.getElementById('btnRefreshOrders');
        this.btnReleaseExpired = document.getElementById('btnReleaseExpired');
        this.receiptUrlCache = new Map();
    }

    async init() {
        if (this.btnRefresh) this.btnRefresh.addEventListener('click', () => this.loadOrders());
        if (this.filterSelect) this.filterSelect.addEventListener('change', () => this.loadOrders());
        if (this.storeScope) this.storeScope.addEventListener('change', () => this.loadOrders());
        if (this.btnReleaseExpired) this.btnReleaseExpired.addEventListener('click', () => this.releaseExpiredOrders());

        // Expose global actions
        window.verifyOrder = this.verifyOrder.bind(this);
        window.rejectOrder = this.rejectOrder.bind(this);
        window.markOrderPreparing = this.markOrderPreparing.bind(this);
        window.markOrderOutForDelivery = this.markOrderOutForDelivery.bind(this);
        window.markOrderDelivered = this.markOrderDelivered.bind(this);
        window.cancelOrderAdmin = this.cancelOrderAdmin.bind(this);

        this.loadOrders();
    }

    onShow() {
        this.loadOrders();
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
            await this.renderList(docs, { showCompany: scope === 'all' });
        } catch (e) {
            console.error("Load Orders Error:", e);
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
        const pending = orders.filter((order) => ['pending_payment', 'pending_verification', 'reserved'].includes(order.status)).length;
        const paid = orders.filter((order) => ['paid', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status)).length;
        const stores = new Set(orders.map((order) => order.companyId || COMPANY_ID));

        const cards = [
            ['Orders', orders.length],
            ['Revenue', `${totalRevenue} som`],
            ['Pending', pending],
            ['Paid/Active', paid],
            ['Stores', stores.size]
        ];

        this.dashboard.innerHTML = cards.map(([label, value]) => `
            <div style="background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:0.9rem;">
                <div style="font-size:0.75rem; color:#666; text-transform:uppercase; font-weight:800;">${label}</div>
                <div style="font-size:1.35rem; font-weight:900; color:#2e7d32;">${value}</div>
            </div>
        `).join('');
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
            const orderItems = Array.isArray(order.items) && order.items.length
                ? order.items.map(item => `${item.quantity} x ${item.name_en || item.name_ru || item.name_kg || item.productName || item.productId}`).join('<br>')
                : `${order.productName || order.productId || 'Unknown Product'}`;

            let actions = '';

            if (order.status === 'pending_verification') {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button onclick="verifyOrder('${id}', true)" class="btn-primary" style="background:#2e7d32; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Approve (Paid)</button>
                        <button onclick="rejectOrder('${id}')" class="btn-danger" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Reject (Release Stock)</button>
                    </div>
                 `;
            } else if (['pending_payment', 'reserved'].includes(order.status)) {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                        <div style="font-size:0.85rem; color:${isExpired ? '#d32f2f' : '#e65100'};">
                            ${isExpired ? `Expired (${timeAgo}m ago)` : `Awaiting payment (${timeAgo}m ago)`}
                        </div>
                        <button onclick="cancelOrderAdmin('${id}')" class="btn-danger" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Cancel & Release</button>
                    </div>
                `;
            } else if (order.status === 'paid') {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="markOrderPreparing('${id}')" class="btn-secondary" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Mark Preparing</button>
                        <button onclick="cancelOrderAdmin('${id}')" class="btn-danger" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Cancel & Release</button>
                    </div>
                `;
            } else if (order.status === 'preparing') {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="markOrderOutForDelivery('${id}', '${order.deliveryMethod || 'delivery'}')" class="btn-secondary" style="padding:5px 10px; border-radius:4px; cursor:pointer;">${order.deliveryMethod === 'pickup' ? 'Ready for Pickup' : 'Out for Delivery'}</button>
                        <button onclick="cancelOrderAdmin('${id}')" class="btn-danger" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Cancel & Release</button>
                    </div>
                `;
            } else if (order.status === 'out_for_delivery') {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                        <button onclick="markOrderDelivered('${id}')" class="btn-primary" style="background:#1565c0; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">${order.deliveryMethod === 'pickup' ? 'Mark Picked Up' : 'Mark Delivered'}</button>
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
                              style="padding:2px 8px; border-radius:12px; font-size:0.8rem; background:${this.getStatusColor(order.status)}; color:white;">
                            ${order.status}
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
                        <div>${order.customerPhone || ''}</div>
                        <div>${order.customerAddress || ''}</div>
                    </div>
                    <div>
                        <div style="font-size:0.8rem; color:#777; font-weight:700;">Totals</div>
                        <div>Subtotal: ${order.subtotal ?? order.price ?? 0} som</div>
                        <div>Delivery: ${order.deliveryFee ?? 0} som</div>
                        <div><strong>Total: ${order.total ?? order.price ?? 0} som</strong></div>
                        <div>${order.deliveryMethod || 'delivery'}</div>
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
