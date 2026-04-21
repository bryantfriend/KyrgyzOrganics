import { db } from '../firebase-config.js';
import {
    collection,
    getDocs,
    limit,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ACTIVE_ORDER_MAX_AGE_MS, archiveOrder } from './orderArchiveService.js';

export async function cleanupOldOrders({ companyId = null, batchLimit = 25 } = {}) {
    const cutoff = new Date(Date.now() - ACTIVE_ORDER_MAX_AGE_MS);
    const constraints = [where('createdAt', '<', cutoff), limit(batchLimit)];
    if (companyId) constraints.unshift(where('companyId', '==', companyId));

    const snapshot = await getDocs(query(collection(db, 'orders'), ...constraints));
    const archiveJobs = snapshot.docs.map((docSnap) => archiveOrder(docSnap.id, {
        cleanupReason: 'older_than_48_hours'
    }));

    await Promise.allSettled(archiveJobs);
    return snapshot.docs.length;
}
