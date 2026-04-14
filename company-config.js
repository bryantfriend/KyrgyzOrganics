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

    const queryCompanyId = new URLSearchParams(window.location.search).get('company');
    if (queryCompanyId) {
        const knownConfig = Object.values(PATH_COMPANY_CONFIG).find(config => config.companyId === queryCompanyId);
        return knownConfig ? { ...knownConfig } : { companyId: queryCompanyId, name: queryCompanyId };
    }

    const host = window.location.hostname.toLowerCase();
    const subdomain = host.endsWith('.oako.kg') ? host.replace('.oako.kg', '') : '';
    if (subdomain && subdomain !== 'www' && PATH_COMPANY_CONFIG[subdomain]) {
        return { ...PATH_COMPANY_CONFIG[subdomain] };
    }

    const firstPathSegment = window.location.pathname
        .split('/')
        .filter(Boolean)[0]
        ?.toLowerCase();

    if (firstPathSegment && PATH_COMPANY_CONFIG[firstPathSegment]) {
        return { ...PATH_COMPANY_CONFIG[firstPathSegment] };
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
