import { db } from '../firebase-config.js';
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ACTIVE_ORDER_STATUSES, LIVE_ORDER_LIMIT } from './orderArchiveService.js';

function sortByCreatedAtDesc(orders = []) {
    return [...orders].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
    });
}

function createOrdersQuery(storeId, fieldName, shouldOrder = true) {
    const constraints = [
        where(fieldName, '==', storeId),
        where('status', 'in', ACTIVE_ORDER_STATUSES)
    ];
    if (shouldOrder) constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(LIVE_ORDER_LIMIT));
    return query(collection(db, 'orders'), ...constraints);
}

// Listens to both the new storeId field and the legacy companyId field.
// This keeps existing orders visible while we migrate to the store-first schema.
export function subscribeToOrders(storeId, callback) {
    if (!storeId) {
        callback([], { changes: [], error: new Error('Missing storeId') });
        return () => { };
    }

    const records = new Map();
    const unsubscribers = [];
    let closed = false;

    const emit = (changes = [], error = null) => {
        if (closed) return;
        callback(sortByCreatedAtDesc([...records.values()]).slice(0, LIVE_ORDER_LIMIT), { changes, error });
    };

    const attachListener = (fieldName, shouldOrder = true) => {
        const unsubscribe = onSnapshot(
            createOrdersQuery(storeId, fieldName, shouldOrder),
            (snapshot) => {
                const changes = snapshot.docChanges().map((change) => {
                    if (change.type === 'removed') {
                        records.delete(change.doc.id);
                    } else {
                        records.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
                    }
                    return {
                        id: change.doc.id,
                        type: change.type,
                        order: change.type === 'removed' ? null : { id: change.doc.id, ...change.doc.data() }
                    };
                });
                emit(changes);
            },
            (error) => {
                console.warn(`Order listener failed for ${fieldName}:`, error);

                // Firestore can require a composite index for where + orderBy. If that happens,
                // keep the live feed running with a simpler real-time query and sort client-side.
                if (shouldOrder && String(error?.message || '').includes('requires an index')) {
                    attachListener(fieldName, false);
                    emit([], error);
                    return;
                }

                emit([], error);
            }
        );
        unsubscribers.push(unsubscribe);
    };

    attachListener('storeId');
    attachListener('companyId');

    return () => {
        closed = true;
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
}
