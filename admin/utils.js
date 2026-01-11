import { storage } from '../firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * Uploads a file to Firebase Storage and returns the URL.
 * @param {File} file 
 * @param {string} pathPrefix - Folder path in storage (e.g. 'banners', 'products')
 * @returns {Promise<string>} Download URL
 */
export async function uploadImage(file, pathPrefix = 'uploads') {
    if (!file) return null;
    const storageRef = ref(storage, `${pathPrefix}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
}

/**
 * simple date formatter
 */
export function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
}

/**
 * Logs an admin action to Firestore.
 * @param {string} action - Short action name (e.g. "Product Added")
 * @param {string} details - Description
 * @param {string} user - User email or ID
 */
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, auth } from '../firebase-config.js';

export async function logAudit(action, details) {
    try {
        const user = auth.currentUser ? auth.currentUser.email : 'system';
        await addDoc(collection(db, 'audit_logs'), {
            action,
            details,
            user,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.warn("Audit Log Failed:", e);
    }
}
