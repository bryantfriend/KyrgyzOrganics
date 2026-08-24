import { auth, db } from './firebase-config.js';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMobileMenu, loc, setupLanguage, t } from './common.js';
import { buildProductPageUrl, getDisplayPrice } from './product-utils.js';
import { getProductExternalLinkCtaLabel, getProductExternalLinkNavigation, getProductExternalLinks } from './product-external-links.mjs?v=2.4';
import { COMPANY_ID, getCurrentCompanyId, initCompanyFromLocation, matchesCompanyId } from './company-config.js';
import { formatPrice } from './shop-utils.js';
import { loadStoreConfig } from './storefront/store-loader.js';
import { applyStoreTheme } from './storefront/theme-engine.js';
import { trackProductExternalLinkClickIntent } from './product-external-links.service.js';

const root = document.getElementById('collectionPageRoot');
let activeStoreName = 'OA Kyrgyz Organic';
let currentUserProfile = null;
let categoriesMap = {};
let collectionSessionId = '';

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
    trackCollectionEvent('collection_page_view', collectionData.id, {
        collectionId: collectionData.id,
        collectionSlug: collectionData.slug || '',
        collectionName: collectionData.name || '',
        productCount: products.length,
        source: 'collection_page'
    });
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
        trackCollectionEvent('collection_copy_link_click', collectionData.id, {
            collectionId: collectionData.id,
            collectionSlug: collectionData.slug || '',
            collectionName: collectionData.name || '',
            source: 'collection_page'
        });
        try {
            await navigator.clipboard.writeText(shareUrl);
            copyStatus.textContent = t('link_copied');
        } catch (error) {
            copyStatus.textContent = shareUrl;
        }
    });

    bindCollectionAnalytics(collectionData, products);
}

function renderProductCard(product, collectionData) {
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : '';
    const productUrl = buildProductUrlWithCollectionReturn(product, collectionData);
    const externalLinks = getProductExternalLinks(product);
    const externalActions = externalLinks.map((link) => {
        const navigation = getProductExternalLinkNavigation(link);
        const label = escapeHtml(getProductExternalLinkCtaLabel(link));
        if (navigation.kind === 'form') {
            const fields = navigation.fields.map((field) =>
                `<input type="hidden" name="${escapeHtml(field.name)}" value="${escapeHtml(field.value)}">`
            ).join('');
            return `<form class="collection-page-buy-form" method="get" action="${escapeHtml(navigation.action)}" data-collection-external-link-id="${escapeHtml(link.id)}" data-product-id="${escapeHtml(product.id)}"><button class="collection-page-buy-link" type="submit">${label}</button>${fields}</form>`;
        }

        const targetAttribute = navigation.openInNewTab === false ? '' : ' target="_blank"';
        return `<a class="collection-page-buy-link" href="${escapeHtml(navigation.url)}"${targetAttribute} rel="noopener noreferrer" data-collection-external-link-id="${escapeHtml(link.id)}" data-product-id="${escapeHtml(product.id)}">${label}</a>`;
    }).join('');

    return `
        <article class="product-card collection-page-product-card">
            <a class="collection-page-product-image" href="${escapeHtml(productUrl)}" data-collection-product-click="image" data-product-id="${escapeHtml(product.id)}">
                <div class="product-image">
                    <img src="${escapeHtml(product.imageUrl || 'https://placehold.co/400x300')}" alt="${escapeHtml(loc(product, 'name'))}">
                </div>
            </a>
            <div class="product-info">
                <div class="product-category">${escapeHtml(categoryName)}</div>
                <h2 class="product-title"><a href="${escapeHtml(productUrl)}" data-collection-product-click="title" data-product-id="${escapeHtml(product.id)}">${escapeHtml(loc(product, 'name'))}</a></h2>
                <div class="product-meta">
                    <span class="product-weight">${escapeHtml(product.weight || '')}</span>
                    <span class="product-price">${formatPrice(getDisplayPrice(product, currentUserProfile))} ${t('price_currency')}</span>
                </div>
                <div class="collection-page-card-actions">
                    <a class="secondary-pill" href="${escapeHtml(productUrl)}" data-collection-product-click="view_product" data-product-id="${escapeHtml(product.id)}">${t('view_product_page')}</a>
                    ${externalActions}
                </div>
            </div>
        </article>
    `;
}

function buildProductUrlWithCollectionReturn(product, collectionData) {
    const url = new URL(buildProductPageUrl(product), window.location.origin);
    if (collectionData.slug) url.searchParams.set('collectionSlug', collectionData.slug);
    url.searchParams.set('collectionId', collectionData.id);
    url.searchParams.set('collectionName', collectionData.name || 'Collection');
    return `${url.pathname}${url.search}`;
}

function getCollectionSessionId() {
    if (collectionSessionId) return collectionSessionId;
    const key = 'oako_storefront_session';
    collectionSessionId = localStorage.getItem(key) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, collectionSessionId);
    return collectionSessionId;
}

async function trackCollectionEvent(actionType, actionValue, extra = {}) {
    try {
        await addDoc(collection(db, 'storefront_events'), {
            companyId: getCurrentCompanyId(),
            actionType,
            actionValue: String(actionValue || ''),
            sessionId: getCollectionSessionId(),
            path: window.location.pathname,
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp(),
            ...extra
        });
    } catch (error) {
        console.warn('Collection analytics event failed:', error);
    }
}

function bindCollectionAnalytics(collectionData, products) {
    const productById = new Map(products.map((product) => [String(product.id), product]));

    root.querySelectorAll('[data-collection-product-click]').forEach((link) => {
        link.addEventListener('click', async (event) => {
            const product = productById.get(String(link.dataset.productId || ''));
            if (!product) return;
            const tracking = trackCollectionEvent('collection_product_click', product.id, {
                collectionId: collectionData.id,
                collectionSlug: collectionData.slug || '',
                collectionName: collectionData.name || '',
                productId: product.id,
                productName: loc(product, 'name') || product.name_en || product.name_ru || '',
                buttonName: link.dataset.collectionProductClick || 'product',
                source: 'collection_page'
            });
            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                await Promise.race([tracking, new Promise((resolve) => setTimeout(resolve, 650))]);
                window.location.assign(link.href);
            }
        });
    });

    root.querySelectorAll('[data-collection-external-link-id]').forEach((element) => {
        const eventName = element.tagName === 'FORM' ? 'submit' : 'click';
        element.addEventListener(eventName, async (event) => {
            const product = productById.get(String(element.dataset.productId || ''));
            const link = getProductExternalLinks(product || {}).find((item) => item.id === element.dataset.collectionExternalLinkId);
            if (!product || !link) return;

            const tracking = trackProductExternalLinkClickIntent({
                productId: product.id || '',
                productName: loc(product, 'name') || product.name_en || product.name_ru || '',
                companyId: product.companyId || getCurrentCompanyId(),
                linkId: link.id,
                linkType: link.type,
                linkLabel: link.label,
                buttonName: getProductExternalLinkCtaLabel(link),
                destinationUrl: link.url,
                collectionId: collectionData.id,
                collectionSlug: collectionData.slug || '',
                collectionName: collectionData.name || '',
                source: 'collection_page_buy_button'
            }).catch((error) => {
                console.warn('Collection product link click tracking failed', error);
            });

            if (element.tagName === 'FORM') {
                event.preventDefault();
                await Promise.race([tracking, new Promise((resolve) => setTimeout(resolve, 700))]);
                HTMLFormElement.prototype.submit.call(element);
            }
        });
    });
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
