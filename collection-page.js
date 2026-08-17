import { auth, db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMobileMenu, loc, setupLanguage, t } from './common.js';
import { buildProductPageUrl, getDisplayPrice } from './product-utils.js';
import { getProductExternalLinkCtaLabel, getProductExternalLinks } from './product-external-links.mjs';
import { COMPANY_ID, getCurrentCompanyId, initCompanyFromLocation, matchesCompanyId } from './company-config.js';
import { formatPrice } from './shop-utils.js';
import { loadStoreConfig } from './storefront/store-loader.js';
import { applyStoreTheme } from './storefront/theme-engine.js';

const root = document.getElementById('collectionPageRoot');
let activeStoreName = 'OA Kyrgyz Organic';
let currentUserProfile = null;
let categoriesMap = {};

async function init() {
    const companyConfig = initCompanyFromLocation();
    const storeConfig = await loadStoreConfig(companyConfig.companyId);
    activeStoreName = storeConfig.name || companyConfig.name || activeStoreName;
    applyStoreTheme(storeConfig);
    updateStoreBranding();
    setupLanguage();
    initMobileMenu();

    currentUserProfile = await loadCurrentUserProfile();
    const collectionData = await loadCollectionFromUrl();
    if (!collectionData) {
        renderMissingState();
        return;
    }

    const [products] = await Promise.all([
        loadCollectionProducts(collectionData),
        loadCategories()
    ]);
    renderCollectionPage(collectionData, products);
    updateMeta(collectionData);
}

async function loadCollectionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const collectionId = params.get('id');

    if (slug) {
        const collectionQuery = query(
            collection(db, 'product_collections'),
            where('slug', '==', slug),
            where('active', '==', true),
            limit(10)
        );
        const snapshot = await getDocs(collectionQuery);
        const match = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .find((item) => matchesCompanyId(item, `product_collections/${item.id}`));
        if (match) return match;
    }

    if (collectionId) {
        const snapshot = await getDoc(doc(db, 'product_collections', collectionId));
        if (snapshot.exists()) {
            const data = { id: snapshot.id, ...snapshot.data() };
            if (data.active !== false && matchesCompanyId(data, `product_collections/${data.id}`)) return data;
        }
    }

    return null;
}

async function loadCollectionProducts(collectionData) {
    const productIds = Array.isArray(collectionData.productIds) ? collectionData.productIds : [];
    if (!productIds.length) return [];

    const snapshot = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
    const productById = new Map();
    snapshot.docs.forEach((docSnap) => {
        const product = { id: docSnap.id, ...docSnap.data() };
        if (matchesCompanyId(product, `products/${product.id}`)) productById.set(product.id, product);
    });

    return productIds.map((id) => productById.get(id)).filter(Boolean);
}

async function loadCategories() {
    const snapshot = await getDocs(query(collection(db, 'categories'), where('active', '==', true)));
    categoriesMap = {};
    snapshot.docs.forEach((docSnap) => {
        const category = { id: docSnap.id, ...docSnap.data() };
        if (matchesCompanyId(category, `categories/${category.id}`)) categoriesMap[category.id] = category;
    });
}

function loadCurrentUserProfile() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                resolve(null);
                return;
            }

            try {
                const snapshot = await getDoc(doc(db, 'users', user.uid));
                resolve(snapshot.exists() ? snapshot.data() : null);
            } catch (error) {
                console.warn('Customer profile load failed:', error);
                resolve(null);
            }
        });
    });
}

function renderCollectionPage(collectionData, products) {
    const shareUrl = window.location.href;
    const productCards = products.length
        ? products.map((product) => renderProductCard(product, collectionData)).join('')
        : '<div class="collection-page-empty">This collection does not have any available products yet.</div>';

    root.innerHTML = `
        <nav class="product-breadcrumbs">
            <a href="${getStoreHomeUrl()}">${t('home')}</a>
            <span>/</span>
            <span>Collection</span>
        </nav>
        <section class="collection-page-header">
            <div>
                <span class="collection-page-kicker">Product Collection</span>
                <h1>${escapeHtml(collectionData.name || 'Collection')}</h1>
                ${collectionData.description ? `<p>${escapeHtml(collectionData.description)}</p>` : ''}
                <strong>${products.length} product${products.length === 1 ? '' : 's'}</strong>
            </div>
            <div class="collection-page-header-actions">
                <a class="secondary-pill" href="${getStoreHomeUrl()}">← Back to Store</a>
                <button class="secondary-pill" id="copyCollectionLink" type="button">${t('copy_link')}</button>
            </div>
            <div id="copyCollectionStatus" class="product-share-status" aria-live="polite"></div>
        </section>
        <section class="collection-page-products" aria-label="Products in ${escapeHtml(collectionData.name || 'collection')}">
            <div class="product-grid collection-page-grid">${productCards}</div>
        </section>
    `;

    const copyButton = document.getElementById('copyCollectionLink');
    const copyStatus = document.getElementById('copyCollectionStatus');
    copyButton?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            copyStatus.textContent = t('link_copied');
        } catch (error) {
            copyStatus.textContent = shareUrl;
        }
    });
}

function renderProductCard(product, collectionData) {
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : '';
    const productUrl = buildProductUrlWithCollectionReturn(product, collectionData);
    const externalLinks = getProductExternalLinks(product);
    const externalActions = externalLinks.map((link) => `
        <a class="collection-page-buy-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(getProductExternalLinkCtaLabel(link))}
        </a>
    `).join('');

    return `
        <article class="product-card collection-page-product-card">
            <a class="collection-page-product-image" href="${escapeHtml(productUrl)}">
                <div class="product-image">
                    <img src="${escapeHtml(product.imageUrl || 'https://placehold.co/400x300')}" alt="${escapeHtml(loc(product, 'name'))}">
                </div>
            </a>
            <div class="product-info">
                <div class="product-category">${escapeHtml(categoryName)}</div>
                <h2 class="product-title"><a href="${escapeHtml(productUrl)}">${escapeHtml(loc(product, 'name'))}</a></h2>
                <div class="product-meta">
                    <span class="product-weight">${escapeHtml(product.weight || '')}</span>
                    <span class="product-price">${formatPrice(getDisplayPrice(product, currentUserProfile))} ${t('price_currency')}</span>
                </div>
                <div class="collection-page-card-actions">
                    <a class="secondary-pill" href="${escapeHtml(productUrl)}">${t('view_product_page')}</a>
                    ${externalActions}
                </div>
            </div>
        </article>
    `;
}

function buildProductUrlWithCollectionReturn(product, collectionData) {
    const url = new URL(buildProductPageUrl(product), window.location.origin);
    if (collectionData.slug) url.searchParams.set('collectionSlug', collectionData.slug);
    else url.searchParams.set('collectionId', collectionData.id);
    url.searchParams.set('collectionName', collectionData.name || 'Collection');
    return `${url.pathname}${url.search}`;
}

function renderMissingState() {
    root.innerHTML = `
        <a href="${getStoreHomeUrl()}" class="text-link-inline">← Back to Store</a>
        <section class="collection-page-header">
            <h1>Collection not found</h1>
            <p>Please check the link or return to the store.</p>
        </section>
    `;
}

function updateStoreBranding() {
    const homeUrl = getStoreHomeUrl();
    document.querySelectorAll('.logo').forEach((logo) => {
        logo.textContent = activeStoreName;
        logo.href = homeUrl;
    });
    ['navHome', 'mobHome'].forEach((id) => {
        const link = document.getElementById(id);
        if (link) link.href = homeUrl;
    });
    const footAboutTitle = document.getElementById('footAboutTitle');
    if (footAboutTitle) footAboutTitle.textContent = activeStoreName;
}

function getStoreHomeUrl() {
    const companyId = getCurrentCompanyId();
    if (!companyId || companyId === COMPANY_ID) return '/';
    return `/?company=${encodeURIComponent(companyId)}`;
}

function updateMeta(collectionData) {
    document.title = `${collectionData.name || 'Collection'} | ${activeStoreName}`;
    const description = collectionData.description || `Explore ${collectionData.name || 'this collection'} from ${activeStoreName}.`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

init().catch((error) => {
    console.error('Collection page failed to load:', error);
    renderMissingState();
});
