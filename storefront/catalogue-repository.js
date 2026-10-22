import { db } from '../firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { COMPANY_ID } from '../company-config.js';
import { hasCanonicalCompanyIds } from '../read-model-readiness.mjs';
import { CATALOGUE_INVALIDATION_EVENT, connectCatalogueInvalidation, createCatalogueCache, createCatalogueRepository } from './catalogue-repository.mjs';

function optionalStorage(name) {
    try { return globalThis[name]; } catch (_) { return null; }
}

const cache = createCatalogueCache({ storage: optionalStorage('sessionStorage') });
export const catalogueRepository = createCatalogueRepository({
    db,
    sdk: { collection, doc, getDoc, getDocs, query, where },
    cache,
    defaultCompanyId: COMPANY_ID,
    isCompanyIdMigrationComplete: hasCanonicalCompanyIds
});

connectCatalogueInvalidation({ cache, eventTarget: globalThis.window, storage: optionalStorage('localStorage') });

// Call after a successful product/category/banner/collection edit, import, delete or active-status change.
// Omit the company only when all stores were changed. This invalidates caches, not already-rendered UI.
export function invalidateCatalogueCache(companyId) {
    if (globalThis.window) window.dispatchEvent(new CustomEvent(CATALOGUE_INVALIDATION_EVENT, { detail: { companyId } }));
    else cache.invalidate(companyId);
}
