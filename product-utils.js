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
        return `/product.html?slug=${encodeURIComponent(slug)}${companyParam}`;
    }

    return `/product.html?id=${encodeURIComponent(product?.id || '')}${companyParam}`;
}

function hasOwnValue(source, key) {
    return source
        && Object.prototype.hasOwnProperty.call(source, key)
        && source[key] !== undefined
        && source[key] !== null
        && source[key] !== '';
}

function normalizeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function isApprovedBusinessUser(currentUserProfile) {
    return !!currentUserProfile
        && currentUserProfile.accountType === 'business'
        && currentUserProfile.businessStatus === 'approved';
}

export function getRetailPrice(product) {
    if (!product) return 0;
    if (hasOwnValue(product, 'priceRetail')) return normalizeMoney(product.priceRetail);
    return normalizeMoney(product.price);
}

export function getBusinessPrice(product) {
    if (!product) return 0;
    if (hasOwnValue(product, 'priceBusiness')) return normalizeMoney(product.priceBusiness);
    return getRetailPrice(product);
}

export function getDisplayPriceType(product, currentUserProfile) {
    return isApprovedBusinessUser(currentUserProfile) ? 'business' : 'retail';
}

export function getDisplayPrice(product, currentUserProfile) {
    if (getDisplayPriceType(product, currentUserProfile) === 'business') {
        return getBusinessPrice(product);
    }
    return getRetailPrice(product);
}
