// Deployment-owned schema gates. Leave false until an audited, separately
// approved migration has normalized EVERY historical document in that collection
// and all current writers use the same fields. These are not feature flags that
// an end user can enable through localStorage or a URL.
// Missing Firestore fields cannot be matched with `where(field, '==', null)`.
// Disabling the compatibility paths prematurely would hide legacy business data.
export const READ_MODEL_READINESS = Object.freeze({
    companyIds: Object.freeze({
        products: false,
        categories: false,
        banners: false,
        payment_methods: false,
        product_collections: false,
        campaigns: false,
        campaign_events: false,
        storefront_events: false
    }),
    // reportingDate: Timestamp|null must exactly mirror the historic effective
    // date (createdAt || date for orders, createdAt || timestamp for events).
    // Null includes invalid effective values. Every writer must maintain it.
    canonicalDates: Object.freeze({
        orders: false,
        storefront_events: false,
        campaign_events: false
    })
});

export function hasCanonicalCompanyIds(collectionName) {
    return READ_MODEL_READINESS.companyIds[collectionName] === true;
}

export function hasCanonicalDates(collectionName) {
    return READ_MODEL_READINESS.canonicalDates[collectionName] === true;
}
