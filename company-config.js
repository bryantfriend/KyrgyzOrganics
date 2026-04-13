export const COMPANY_ID = "kyrgyz-organics";
export let CURRENT_COMPANY_ID = COMPANY_ID;

export function setCompanyId(companyId) {
    CURRENT_COMPANY_ID = companyId || COMPANY_ID;
}

export function getCurrentCompanyId() {
    return CURRENT_COMPANY_ID || COMPANY_ID;
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
