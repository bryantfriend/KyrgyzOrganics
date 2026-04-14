import { db } from '../firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getCurrentCompanyId } from '../company-config.js';
import { getFallbackStoreConfig } from './defaults/default-store-config.js';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
    const merged = { ...base };

    Object.entries(override || {}).forEach(([key, value]) => {
        merged[key] = isPlainObject(base?.[key]) && isPlainObject(value)
            ? deepMerge(base[key], value)
            : value;
    });

    return merged;
}

function mergeStoreConfig(base, override) {
    const merged = deepMerge(base, override);

    merged.id = override?.id || override?.companyId || base.companyId;
    merged.companyId = override?.companyId || override?.id || base.companyId;
    merged.layout = Array.isArray(override?.layout) ? override.layout : base.layout;

    return merged;
}

export async function loadStoreConfig(companyId = getCurrentCompanyId()) {
    const fallback = getFallbackStoreConfig(companyId);

    for (const collectionName of ['storefront_configs', 'companies']) {
        try {
            const snap = await getDoc(doc(db, collectionName, companyId));

            if (!snap.exists()) continue;

            return mergeStoreConfig(fallback, {
                id: snap.id,
                ...snap.data()
            });
        } catch (error) {
            if (error?.code !== 'permission-denied') {
                console.warn(`Store config load failed from ${collectionName}:`, error);
            }
        }
    }

    return fallback;
}
