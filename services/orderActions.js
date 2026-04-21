import { db } from '../firebase-config.js';
import {
    doc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { archiveOrder } from './orderArchiveService.js';

export const STORE_ORDER_STATUSES = ['new', 'accepted', 'preparing', 'ready', 'delivery', 'completed'];

export const STATUS_LABELS = {
    new: 'New',
    accepted: 'Accepted',
    preparing: 'Preparing',
    ready: 'Ready',
    delivery: 'Delivery',
    completed: 'Completed',
    cancelled: 'Cancelled'
};

export function normalizeOrderStatus(status, order = {}) {
    if (STORE_ORDER_STATUSES.includes(status)) return status;
    if (status === 'cancelled') return 'cancelled';

    // Legacy ecommerce statuses mapped into the store dashboard workflow.
    if (['pending_payment', 'reserved', 'pending_verification'].includes(status)) {
        return order.paymentType === 'online' ? 'accepted' : 'new';
    }
    if (status === 'paid') return 'accepted';
    if (status === 'out_for_delivery') return 'delivery';
    if (status === 'delivered') return 'completed';

    return 'new';
}

export function isPickupOrder(order = {}) {
    return ['pickup', 'pick_up', 'collect'].includes(String(order.deliveryType || order.deliveryMethod || '').toLowerCase());
}

export function getNextOrderTransition(order = {}) {
    const status = normalizeOrderStatus(order.status, order);

    if (status === 'new') return { status: 'accepted', label: 'Accept' };
    if (status === 'accepted') return { status: 'preparing', label: 'Start Preparing' };
    if (status === 'preparing') return { status: 'ready', label: 'Mark Ready' };
    if (status === 'ready') {
        return isPickupOrder(order)
            ? { status: 'completed', label: 'Complete Pickup' }
            : { status: 'delivery', label: 'Start Delivery' };
    }
    if (status === 'delivery') return { status: 'completed', label: 'Complete' };

    return null;
}

function getStatusTimestamps(newStatus) {
    const now = serverTimestamp();
    const payload = {
        updatedAt: now,
        [`${newStatus}At`]: now
    };

    if (newStatus === 'accepted') payload.acceptedAt = now;
    if (newStatus === 'preparing') payload.preparingAt = now;
    if (newStatus === 'ready') payload.readyAt = now;
    if (newStatus === 'delivery') payload.deliveryAt = now;
    if (newStatus === 'completed') payload.completedAt = now;

    return payload;
}

export async function updateOrderStatus(orderId, newStatus, options = {}) {
    if (!orderId) throw new Error('Missing orderId');
    if (![...STORE_ORDER_STATUSES, 'cancelled'].includes(newStatus)) {
        throw new Error(`Unsupported order status: ${newStatus}`);
    }

    const payload = {
        status: newStatus,
        ...getStatusTimestamps(newStatus)
    };

    if (options.storeId) payload.storeId = options.storeId;
    if (options.companyId) payload.companyId = options.companyId;
    if (options.estimatedTime) payload.estimatedTime = Number(options.estimatedTime);

    await updateDoc(doc(db, 'orders', orderId), payload);

    if (newStatus === 'completed') {
        await archiveOrder(orderId, payload);
    }
}
