import { COMPANY_ID, getCurrentCompanyId } from './company-config.js';

export function getPreferredProductName(product) {
    return product?.name_en || product?.name_ru || product?.name_kg || product?.name || '';
}

export function slugifyProductName(name) {
    return String(name || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

export function ensureProductSlug(product) {
    return product?.slug || slugifyProductName(getPreferredProductName(product));
}

export function buildProductPageUrl(product) {
    const companyId = getCurrentCompanyId();
    const companyParam = companyId && companyId !== COMPANY_ID ? `&company=${encodeURIComponent(companyId)}` : '';
    const slug = product?.slug;
    if (slug) {
        return `product.html?slug=${encodeURIComponent(slug)}${companyParam}`;
    }

    return `product.html?id=${encodeURIComponent(product?.id || '')}${companyParam}`;
}
