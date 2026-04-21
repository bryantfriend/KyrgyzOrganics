import { db } from '../firebase-config.js';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    startAfter,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const ACTIVE_ORDER_STATUSES = [
    'new',
    'accepted',
    'preparing',
    'ready',
    'delivery',
    'pending_payment',
    'reserved',
    'pending_verification',
    'paid',
    'out_for_delivery'
];

export const LIVE_ORDER_LIMIT = 50;
export const HISTORY_PAGE_LIMIT = 20;
export const ACTIVE_ORDER_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export async function archiveOrder(orderId, extraData = {}) {
    if (!orderId) return;

    const orderRef = doc(db, 'orders', orderId);
    const archiveRef = doc(db, 'orders_archive', orderId);
    const snapshot = await getDoc(orderRef);

    if (!snapshot.exists()) return;

    await setDoc(archiveRef, {
        ...snapshot.data(),
        ...extraData,
        archivedAt: serverTimestamp()
    }, { merge: true });

    await deleteDoc(orderRef);
}

export async function loadMoreArchivedOrders({ companyId = null, lastDoc = null, pageSize = HISTORY_PAGE_LIMIT } = {}) {
    const constraints = [];
    if (companyId) constraints.push(where('companyId', '==', companyId));
    constraints.push(orderBy('createdAt', 'desc'));
    if (lastDoc) constraints.push(startAfter(lastDoc));
    constraints.push(limit(pageSize));

    return getDocs(query(collection(db, 'orders_archive'), ...constraints));
}
