export const COMPANY_ID = "kyrgyz-organics";
export let CURRENT_COMPANY_ID = COMPANY_ID;

const DEFAULT_COMPANY_CONFIG = {
    companyId: COMPANY_ID,
    name: "OA Kyrgyz Organic"
};

const PATH_COMPANY_CONFIG = {
    dailybread: {
        companyId: "dailybread",
        name: "Daily Bread"
    },
    oako: DEFAULT_COMPANY_CONFIG
};
const RESERVED_PATH_SEGMENTS = new Set([
    'admin',
    'about.html',
    'contact.html',
    'cart.html',
    'checkout.html',
    'index.html',
    'product.html',
    'business-register.html',
    'hamster_game',
    'prime-mun',
    'url-converter',
    'assets',
    'admin-assets',
    'data',
    'demo',
    'eonis',
    'functions',
    'granola',
    'icf',
    'images',
    'jobs',
    'node_modules',
    'p',
    'q',
    'services',
    'storefront',
    'tests',
    'track',
    'utils'
]);

function getCompanyConfig(companyId) {
    const normalized = String(companyId || '').trim().toLowerCase();
    if (!normalized) return null;
    return PATH_COMPANY_CONFIG[normalized] || { companyId: normalized, name: normalized };
}

function isStorePathSegment(segment) {
    const normalized = String(segment || '').trim().toLowerCase();
    if (!normalized || RESERVED_PATH_SEGMENTS.has(normalized)) return false;
    if (normalized.includes('.')) return false;
    return /^[a-z0-9][a-z0-9-_]*$/.test(normalized);
}

export function setCompanyId(companyId) {
    CURRENT_COMPANY_ID = companyId || COMPANY_ID;
}

export function getCurrentCompanyId() {
    return CURRENT_COMPANY_ID || COMPANY_ID;
}

export function getDefaultCompanyConfig() {
    return { ...DEFAULT_COMPANY_CONFIG };
}

export function detectCompanyFromLocation() {
    if (typeof window === 'undefined') return getDefaultCompanyConfig();

    const explicitCompanyId = window.OAKO_COMPANY_ID || window.OAKO_STORE_ID;
    if (explicitCompanyId) {
        return {
            companyId: String(explicitCompanyId),
            name: window.OAKO_STORE_NAME || String(explicitCompanyId)
        };
    }

    const params = new URLSearchParams(window.location.search);
    const queryCompanyId = params.get('company') || params.get('companyId') || params.get('store');
    if (queryCompanyId) {
        const queryConfig = getCompanyConfig(queryCompanyId);
        if (queryConfig) return { ...queryConfig };
    }

    const host = window.location.hostname.toLowerCase();
    const subdomain = host.endsWith('.oako.kg') ? host.replace('.oako.kg', '') : '';
    if (subdomain && subdomain !== 'www') {
        const subdomainConfig = getCompanyConfig(subdomain);
        if (subdomainConfig) return { ...subdomainConfig };
    }

    const firstPathSegment = window.location.pathname
        .split('/')
        .filter(Boolean)[0]
        ?.toLowerCase();

    if (firstPathSegment && PATH_COMPANY_CONFIG[firstPathSegment]) {
        return { ...PATH_COMPANY_CONFIG[firstPathSegment] };
    }

    if (isStorePathSegment(firstPathSegment)) {
        const pathConfig = getCompanyConfig(firstPathSegment);
        if (pathConfig) return { ...pathConfig };
    }

    return getDefaultCompanyConfig();
}

export function initCompanyFromLocation() {
    const config = detectCompanyFromLocation();
    setCompanyId(config.companyId);
    return config;
}

export function matchesCompanyId(data, id = 'document') {
    if (!data?.companyId) {
        // Safe migration: legacy docs without companyId belong to the default company only.
        const current = getCurrentCompanyId();
        // Avoid spamming the console for Kyrgyz Organic legacy data.
        if (current !== COMPANY_ID) {
            console.warn("Missing companyId:", id);
        }
        return current === COMPANY_ID;
    }

    return data.companyId === getCurrentCompanyId();
}
