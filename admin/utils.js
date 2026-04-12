import { db, auth, storage } from '../firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getCurrentCompanyId } from '../company-config.js';

/**
 * Uploads a file to Firebase Storage and returns the URL.
 * @param {File} file 
 * @param {string} pathPrefix - Folder path in storage (e.g. 'banners', 'products')
 * @param {{ autoCompress?: boolean, maxDimension?: number, quality?: number }} options
 * @returns {Promise<string>} Download URL
 */
export async function uploadImage(file, pathPrefix = 'products', options = {}) {
    if (!file) return null;
    const processedFile = await prepareImageForUpload(file, options);
    const storageRef = ref(storage, `${pathPrefix}/${Date.now()}_${processedFile.name}`);
    await uploadBytes(storageRef, processedFile, { contentType: processedFile.type || file.type });
    return await getDownloadURL(storageRef);
}

async function prepareImageForUpload(file, options = {}) {
    const shouldCompress = options.autoCompress ?? false;

    if (!shouldCompress) return file;
    if (!file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

    try {
        return await compressImage(file, options);
    } catch (error) {
        console.warn('Image compression failed, uploading original file instead:', error);
        return file;
    }
}

async function compressImage(file, options = {}) {
    const maxDimension = options.maxDimension || 1600;
    const quality = options.quality || 0.8;
    const outputType = 'image/webp';
    const image = await loadImageFromFile(file);

    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error('Canvas compression returned an empty blob.'));
        }, outputType, quality);
    });

    if (!blob || blob.size >= file.size) {
        return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '') || `image-${Date.now()}`;
    return new File([blob], `${baseName}.webp`, {
        type: outputType,
        lastModified: Date.now()
    });
}

async function loadImageFromFile(file) {
    return await new Promise((resolve, reject) => {
        const imageUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(imageUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error('Could not decode image file.'));
        };

        image.src = imageUrl;
    });
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
export async function logAudit(action, details) {
    try {
        const user = auth.currentUser ? auth.currentUser.email : 'system';
        await addDoc(collection(db, 'audit_logs'), {
            companyId: getCurrentCompanyId(),
            action,
            details,
            user,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.warn("Audit Log Failed:", e);
    }
}
