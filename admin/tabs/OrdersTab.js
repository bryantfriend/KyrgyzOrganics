import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { formatDate } from '../utils.js';
import {
    collection, query, where, orderBy, getDocs, doc, updateDoc, runTransaction, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class OrdersTab extends BaseTab {
    constructor() {
        super('orders');
        this.list = document.getElementById('ordersList');
        this.filterSelect = document.getElementById('orderFilterStatus');
        this.btnRefresh = document.getElementById('btnRefreshOrders');
        this.btnReleaseExpired = document.getElementById('btnReleaseExpired');
    }

    async init() {
        if (this.btnRefresh) this.btnRefresh.addEventListener('click', () => this.loadOrders());
        if (this.filterSelect) this.filterSelect.addEventListener('change', () => this.loadOrders());
        if (this.btnReleaseExpired) this.btnReleaseExpired.addEventListener('click', () => this.releaseExpiredOrders());

        // Expose global actions
        window.verifyOrder = this.verifyOrder.bind(this);
        window.rejectOrder = this.rejectOrder.bind(this);

        this.loadOrders();
    }

    onShow() {
        this.loadOrders();
    }

    async loadOrders() {
        if (!this.list) return;
        this.list.innerHTML = '<p>Loading orders...</p>';

        const statusFilter = this.filterSelect ? this.filterSelect.value : 'all';

        try {
            let q;
            if (statusFilter === 'all') {
                q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
            } else {
                q = query(collection(db, 'orders'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
            }

            const snap = await getDocs(q);
            this.renderList(snap.docs);
        } catch (e) {
            console.error("Load Orders Error:", e);
            this.list.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;

            // Index correction hint
            if (e.message.includes("requires an index")) {
                this.list.innerHTML += `<p style="font-size:0.8rem; color:#666;">(Missing Index for current filter)</p>`;
                // Fallback: client side filter
                const allSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
                const filtered = allSnap.docs.filter(d => statusFilter === 'all' || d.data().status === statusFilter);
                this.renderList(filtered);
            }
        }
    }

    renderList(docs) {
        if (docs.length === 0) {
            this.list.innerHTML = '<p style="color:#666; padding:1rem;">No orders found.</p>';
            return;
        }

        this.list.innerHTML = '';
        docs.forEach(d => {
            const order = d.data();
            const id = d.id;
            const date = order.createdAt ? new Date(order.createdAt.toDate()) : new Date();
            const timeAgo = Math.floor((new Date() - date) / 60000); // mins

            let actions = '';

            if (order.status === 'pending_verification') {
                actions = `
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <button onclick="verifyOrder('${id}', true)" class="btn-primary" style="background:#2e7d32; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Approve (Paid)</button>
                        <button onclick="rejectOrder('${id}')" class="btn-danger" style="padding:5px 10px; border-radius:4px; cursor:pointer;">Reject (Release Stock)</button>
                    </div>
                 `;
            } else if (order.status === 'reserved') {
                const isExpired = timeAgo > 15; // 15 mins buffer
                if (isExpired) {
                    actions = `<div style="color:red; font-size:0.8rem; margin-top:5px;">Expired (${timeAgo}m ago)</div>`;
                } else {
                    actions = `<div style="color orange; font-size:0.8rem; margin-top:5px;">Reserved (${timeAgo}m ago)</div>`;
                }
            }

            const el = document.createElement('div');
            el.className = 'list-item';
            el.style.flexDirection = 'column';
            el.style.alignItems = 'flex-start';

            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <div>
                        <strong>${order.productName}</strong> <span style="color:#666;">(${order.price} som)</span>
                        <div style="font-size:0.85rem; color:#888;">Order ID: ${id} • ${date.toLocaleString()}</div>
                    </div>
                    <div style="text-align:right;">
                        <span class="status-badge status-${order.status}" 
                              style="padding:2px 8px; border-radius:12px; font-size:0.8rem; background:${this.getStatusColor(order.status)}; color:white;">
                            ${order.status}
                        </span>
                    </div>
                </div>
                
                ${order.receiptUrl ? `
                    <div style="margin-top:10px; border:1px solid #eee; padding:5px;">
                        <span style="font-size:0.8rem; font-weight:bold;">Receipt:</span><br>
                        <a href="${order.receiptUrl}" target="_blank">
                            <img src="${order.receiptUrl}" style="max-height:100px; max-width:100%; object-fit:contain;">
                        </a>
                    </div>
                ` : ''}

                ${actions}
            `;
            this.list.appendChild(el);
        });
    }

    getStatusColor(status) {
        switch (status) {
            case 'paid': return '#2e7d32'; // Green
            case 'pending_verification': return '#ff9800'; // Orange
            case 'reserved': return '#2196f3'; // Blue
            case 'cancelled': return '#f44336'; // Red
            default: return '#9e9e9e';
        }
    }

    async verifyOrder(orderId) {
        if (!confirm("Confirm payment received? Status will be PAID.")) return;
        try {
            await updateDoc(doc(db, 'orders', orderId), {
                status: 'paid',
                verifiedAt: serverTimestamp()
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

    async releaseExpiredOrders() {
        if (!confirm("Release stock for ALL expired reservations (>15 mins)?")) return;

        const now = new Date();
        const cutoff = new Date(now.getTime() - 15 * 60000); // 15 mins ago

        try {
            // Find expired reserved orders
            const q = query(
                collection(db, 'orders'),
                where('status', '==', 'reserved'),
                where('createdAt', '<', cutoff) // Requires Composite Index usually
            );

            let snap;
            try {
                snap = await getDocs(q);
            } catch (e) {
                // Client-side fallback if index missing
                const all = await getDocs(query(collection(db, 'orders'), where('status', '==', 'reserved')));
                snap = { docs: all.docs.filter(d => d.data().createdAt.toDate() < cutoff) };
            }

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
            if (['cancelled', 'paid'].includes(order.status)) throw "Order already finalized";

            // Release Stock
            const dateStr = order.date; // e.g. "2025-01-11"
            const prodId = order.productId;

            if (dateStr && prodId) {
                const invRef = doc(db, 'inventory', dateStr);
                const invSnap = await transaction.get(invRef);

                if (invSnap.exists()) {
                    const invData = invSnap.data();
                    const currentAvail = invData[prodId]?.available || 0;
                    const currentSold = invData[prodId]?.sold || 0;

                    transaction.update(invRef, {
                        [`${prodId}.available`]: currentAvail + 1,
                        [`${prodId}.sold`]: Math.max(0, currentSold - 1)
                    });
                }
            }

            transaction.update(orderRef, {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                reason: reason
            });
        });
    }
}
