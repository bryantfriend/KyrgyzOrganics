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
        console.warn("Missing companyId:", id);
        return true;
    }

    return data.companyId === getCurrentCompanyId();
}
