import { auth, db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initMobileMenu, loc, setupLanguage, t } from './common.js';
import { buildProductPageUrl, getDisplayPrice, getDisplayPriceType } from './product-utils.js';
import { getProductExternalLinkCtaLabel, getProductExternalLinkNavigation, getProductExternalLinkProviderName, getProductExternalLinks } from './product-external-links.mjs?v=2.4';
import { trackProductExternalLinkClickIntent } from './product-external-links.service.js';
import { addCartItem, formatPrice, loadCart, saveCart, saveCartDay } from './shop-utils.js';
import { COMPANY_ID, getCurrentCompanyId, initCompanyFromLocation, matchesCompanyId } from './company-config.js';
import { getInventoryDocId } from './firestore-paths.js';
import { loadStoreConfig } from './storefront/store-loader.js';
import { applyStoreTheme } from './storefront/theme-engine.js';

const root = document.getElementById('productPageRoot');

let categoriesMap = {};
let dailyInventory = {};
let activeStoreName = 'OA Kyrgyz Organic';
let currentUserProfile = null;

async function init() {
    const companyConfig = initCompanyFromLocation();
    const storeConfig = await loadStoreConfig(companyConfig.companyId);
    activeStoreName = storeConfig.name || companyConfig.name || activeStoreName;
    applyStoreTheme(storeConfig);
    updateStoreBranding();
    setupLanguage();
    initMobileMenu();
    currentUserProfile = await loadCurrentUserProfile();

    const supportingDataResults = await Promise.allSettled([loadCategories(), loadInventory()]);
    supportingDataResults.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.warn(index === 0 ? 'Product categories failed to load:' : 'Product inventory failed to load:', result.reason);
        }
    });
    const product = await loadProductFromUrl();

    if (!product) {
        renderMissingState();
        return;
    }

    renderProductPage(product);
    updateMeta(product);
}

function getTodayKey() {
    const localNow = new Date();
    const y = localNow.getFullYear();
    const m = String(localNow.getMonth() + 1).padStart(2, '0');
    const d = String(localNow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function loadCategories() {
    const snap = await getDocs(query(collection(db, 'categories'), where('active', '==', true)));
    snap.forEach((docSnap) => {
        const category = { id: docSnap.id, ...docSnap.data() };
        if (!matchesCompanyId(category, `categories/${category.id}`)) return;
        categoriesMap[docSnap.id] = category;
    });
}

async function loadInventory() {
    const today = getTodayKey();
    const activeCompanyId = getCurrentCompanyId();
    const invId = getInventoryDocId(activeCompanyId, today);
    let invSnap = await getDoc(doc(db, 'inventory', invId));
    if (!invSnap.exists() && activeCompanyId === COMPANY_ID) {
        invSnap = await getDoc(doc(db, 'inventory', today));
    }
    if (invSnap.exists()) {
        const inventoryData = invSnap.data();
        if (inventoryData.companyId && inventoryData.companyId !== activeCompanyId) {
            console.warn('Inventory companyId mismatch:', getTodayKey());
            dailyInventory = {};
        } else {
            if (!inventoryData.companyId && activeCompanyId === COMPANY_ID) console.warn('Inventory missing companyId:', getTodayKey());
            dailyInventory = inventoryData;
        }
    }
}

async function loadProductFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const productId = params.get('id');

    if (slug) {
        const productQuery = query(
            collection(db, 'products'),
            where('slug', '==', slug),
            where('active', '==', true),
            limit(5)
        );
        const snap = await getDocs(productQuery);
        const product = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .find(p => matchesCompanyId(p, `products/${p.id}`));
        if (product) return product;
    }

    if (productId) {
        const productDoc = await getDoc(doc(db, 'products', productId));
        if (productDoc.exists()) {
            const productData = productDoc.data();
            if (!matchesCompanyId(productData, `products/${productId}`)) return null;
            return { id: productDoc.id, ...productData };
        }
    }

    return null;
}

function loadCurrentUserProfile() {
    return new Promise(function (resolve) {
        onAuthStateChanged(auth, async function (user) {
            if (!user) {
                resolve(null);
                return;
            }

            try {
                const userSnap = await getDoc(doc(db, 'users', user.uid));
                resolve(userSnap.exists() ? userSnap.data() : null);
            } catch (error) {
                console.warn('Customer profile load failed:', error);
                resolve(null);
            }
        });
    });
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

    const footCopyright = document.getElementById('footCopyright');
    if (footCopyright) footCopyright.textContent = `© 2025 ${activeStoreName}. All rights reserved.`;
}

function getStoreHomeUrl() {
    const companyId = getCurrentCompanyId();
    if (!companyId || companyId === COMPANY_ID) return '/';
    return `/${companyId}/`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeHttpUrl(value, allowedHosts = []) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        if (allowedHosts.length) {
            const host = url.hostname.replace(/\.$/, '').toLowerCase();
            if (!allowedHosts.includes(host)) return '';
        }
        return url.toString();
    } catch (error) {
        return '';
    }
}

function getProductLinkIcon(type) {
    const icons = {
        whatsapp: 'W',
        telegram: 'T',
        glovo: 'G',
        yandex: 'Y',
        map: 'M',
        optima_payda: 'P',
        website: '↗',
        other: '↗'
    };

    return icons[type] || icons.other;
}

function getProductLinkHelperText(link) {
    if (link.type === 'map') return 'Open map or location details';
    if (link.type === 'optima_payda') return 'Open Optima PayDa payment link';
    if (link.type === 'website') return 'Open the order page';
    if (link.type === 'glovo') return 'Already signed in? Open this exact product';
    if (link.type === 'yandex') return 'Open this product search on the Yandex website';
    return 'Open ' + getProductExternalLinkProviderName(link) + ' to buy this product';
}

function renderExternalActionControl(link, ctaLabel) {
    const navigation = getProductExternalLinkNavigation(link);
    const content = '<span aria-hidden="true">' + escapeHtml(getProductLinkIcon(link.type)) + '</span>' +
        '<div class="external-action-copy"><strong>' + escapeHtml(ctaLabel) + '</strong><small>' + escapeHtml(getProductLinkHelperText(link)) + '</small></div>';
    const trackingAttribute = ' data-product-external-link-id="' + escapeHtml(link.id) + '"';

    if (navigation.kind === 'form') {
        const fields = navigation.fields.map((field) =>
            '<input type="hidden" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(field.value) + '">'
        ).join('');

        const actionForm = '<form class="external-action-form" method="get" action="' + escapeHtml(navigation.action) + '">' +
            fields +
            '<button class="external-action ' + escapeHtml(link.type) + '" type="submit" aria-label="' + escapeHtml(ctaLabel) + '"' + trackingAttribute + '>' + content + '</button>' +
        '</form>';

        if (!navigation.loginAction) return actionForm;

        const loginFields = navigation.loginFields.map((field) =>
            '<input type="hidden" name="' + escapeHtml(field.name) + '" value="' + escapeHtml(field.value) + '">'
        ).join('');

        return '<div class="glovo-action-stack">' +
            actionForm +
            '<div class="glovo-signin-option">' +
                '<p><strong>Not signed in to Glovo?</strong><span>Start here and choose Email on Android. Google can open the app and lose the product.</span></p>' +
                '<form class="glovo-signin-form" method="get" action="' + escapeHtml(navigation.loginAction) + '">' +
                    loginFields +
                    '<button type="submit">Sign in first with Email</button>' +
                '</form>' +
            '</div>' +
        '</div>';
    }

    const targetAttribute = navigation.openInNewTab === false ? '' : ' target="_blank"';
    return '<a class="external-action ' + escapeHtml(link.type) + '" href="' + escapeHtml(navigation.url) + '"' + targetAttribute + ' rel="noopener noreferrer" aria-label="' + escapeHtml(ctaLabel) + '"' + trackingAttribute + '>' +
        content +
    '</a>';
}

function renderExternalActions(product) {
    const links = getProductExternalLinks(product);
    if (!links.length) return '';

    let html = '<section class="product-external-panel" aria-label="External ordering options">' +
        '<div class="product-external-heading">' +
            '<span>Order options</span>' +
            '<strong>Where to order</strong>' +
        '</div>' +
        '<div class="product-external-actions">';

    links.forEach((link) => {
        const ctaLabel = getProductExternalLinkCtaLabel(link);
        html += renderExternalActionControl(link, ctaLabel);
    });

    html += '</div></section>';
    return html;
}

function getProductReturnContext() {
    const params = new URLSearchParams(window.location.search);
    const collectionSlug = params.get('collectionSlug');
    const collectionId = params.get('collectionId');
    if (!collectionSlug && !collectionId) {
        return {
            url: getStoreHomeUrl(),
            label: t('back_to_catalog'),
            collectionName: ''
        };
    }

    const returnUrl = new URL('/collection.html', window.location.origin);
    if (collectionSlug) returnUrl.searchParams.set('slug', collectionSlug);
    else returnUrl.searchParams.set('id', collectionId);
    const companyId = params.get('company');
    if (companyId) returnUrl.searchParams.set('company', companyId);
    const collectionName = String(params.get('collectionName') || 'Collection').trim();
    return {
        url: `${returnUrl.pathname}${returnUrl.search}`,
        label: `← Back to ${collectionName}`,
        collectionName
    };
}

function renderMissingState() {
    const returnContext = getProductReturnContext();
    root.innerHTML = `
        <a href="${escapeHtml(returnContext.url)}" class="text-link-inline">${escapeHtml(returnContext.label)}</a>
        <div class="product-page-layout" style="margin-top:1rem;">
            <div class="product-page-info">
                <h1 class="section-title" style="margin-top:0;">${t('product_not_found')}</h1>
                <p>Please check the link or return to the catalog.</p>
            </div>
        </div>
    `;
}

function renderProductPage(product) {
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : '';
    const stock = dailyInventory[product.id]?.available ?? null;
    const isInStock = stock === null ? true : stock > 0;
    const maxQty = stock !== null && stock > 0 ? stock : 99;
    const cartUrl = new URL(getStoreHomeUrl(), window.location.origin + '/');
    cartUrl.searchParams.set('cart', 'open');
    const shareUrl = new URL(buildProductPageUrl(product), window.location.origin + window.location.pathname.replace(/[^/]+$/, '')).toString();
    const imagePack = product.imageUrl || 'https://placehold.co/800x600?text=Packaging';
    const imageContent = product.imageNoPackagingUrl || imagePack;
    const displayPrice = getDisplayPrice(product, currentUserProfile);
    const priceType = getDisplayPriceType(product, currentUserProfile);
    const externalActions = renderExternalActions(product);
    const returnContext = getProductReturnContext();

    root.innerHTML = `
        <nav class="product-breadcrumbs">
            <a href="${getStoreHomeUrl()}">${t('home')}</a>
            <span>/</span>
            ${returnContext.collectionName ? `<a href="${escapeHtml(returnContext.url)}">${escapeHtml(returnContext.collectionName)}</a><span>/</span>` : ''}
            <span>${categoryName || t('product_details')}</span>
        </nav>

        <section class="product-page-layout">
            <div class="product-page-gallery">
                <div class="product-page-main-image">
                    <img id="detailMainImage" src="${imagePack}" alt="${loc(product, 'name')}">
                </div>
                <div class="thumbnail-strip">
                    <button class="thumb-btn active" type="button" data-src="${imagePack}">
                        <img src="${imagePack}" alt="Packaging">
                    </button>
                    <button class="thumb-btn" type="button" data-src="${imageContent}">
                        <img src="${imageContent}" alt="Content">
                    </button>
                </div>
            </div>

            <div class="product-page-info">
                <a href="${escapeHtml(returnContext.url)}" class="text-link-inline">${escapeHtml(returnContext.label)}</a>
                <div class="modal-category" style="margin-top:1rem;">${categoryName}</div>
                <h1 class="product-page-title">${loc(product, 'name')}</h1>
                <div class="product-page-price-row">
                    <span class="modal-price">${formatPrice(displayPrice)} ${t('price_currency')}</span>
                    <span class="modal-weight">/ ${product.weight || ''}</span>
                </div>
                ${priceType === 'business' ? '<div class="business-price-note">Business price applied</div>' : ''}
                <div class="product-stock ${isInStock ? 'in-stock' : 'sold-out'}">
                    ${isInStock ? `${t('stock_in')}${stock !== null ? `: ${stock}` : ''}` : t('stock_out')}
                </div>
                <p class="product-page-description">${loc(product, 'description') || 'No description available.'}</p>
                ${product.availability?.note ? `<p class="product-availability-note">${product.availability.note}</p>` : ''}
                ${externalActions}

                ${isInStock ? `
                <div class="product-order-panel">
                    <div class="product-quantity-row">
                        <label for="detailQuantity">${t('quantity')}</label>
                        <div class="modal-quantity-input">
                            <input id="detailQuantity" type="number" min="1" max="${maxQty}" value="1">
                        </div>
                    </div>
                    <div class="product-page-actions product-buy-actions">
                        <button id="detailBuyNow" class="cta-btn modal-buy-now" type="button">${t('buy_now')}</button>
                        <button id="detailAddToCart" class="secondary-pill" type="button">${t('add_to_cart')}</button>
                        <a href="${cartUrl.pathname}${cartUrl.search}" class="secondary-pill">${t('open_cart')}</a>
                    </div>
                </div>
                ` : `
                <button class="cta-btn modal-buy-now" type="button" disabled style="background:#ccc; cursor:not-allowed;">${t('stock_out')}</button>
                `}

                <div class="product-page-actions product-share-actions">
                    <button id="copyProductLink" class="secondary-pill" type="button">${t('copy_link')}</button>
                </div>
                <div id="copyStatus" class="product-share-status"></div>

                <div class="modal-meta-box" style="margin-top:1.5rem;">
                    ${product.ingredients ? `
                    <div class="modal-meta-item">
                        <span class="modal-meta-label">${t('ingredients')}</span>
                        <span>${loc(product, 'ingredients') || product.ingredients}</span>
                    </div>` : ''}
                    <div class="modal-meta-item">
                        <span class="modal-meta-label">${t('storage')}</span>
                        <span>${loc(product, 'storage') || 'Store in a cool, dry place.'}</span>
                    </div>
                    <div class="modal-meta-item">
                        <span class="modal-meta-label">Origin</span>
                        <span>Kyrgyzstan</span>
                    </div>
                    ${product.availability?.leadTimeHours ? `
                    <div class="modal-meta-item">
                        <span class="modal-meta-label">Lead time</span>
                        <span>${product.availability.leadTimeHours} hours</span>
                    </div>` : ''}
                    <div class="modal-meta-item">
                        <span class="modal-meta-label">URL</span>
                        <span>${shareUrl}</span>
                    </div>
                </div>
            </div>
        </section>
    `;

    bindPageInteractions(product, shareUrl);
}

function bindPageInteractions(product, shareUrl) {
    const copyBtn = document.getElementById('copyProductLink');
    const copyStatus = document.getElementById('copyStatus');
    const buyNowBtn = document.getElementById('detailBuyNow');
    const addToCartBtn = document.getElementById('detailAddToCart');
    const copyYandexProductNameBtn = document.getElementById('copyYandexProductName');
    const quantityInput = document.getElementById('detailQuantity');
    const imageButtons = root.querySelectorAll('.thumb-btn');
    const mainImage = document.getElementById('detailMainImage');
    const getSelectedQuantity = () => {
        const quantity = Number.parseInt(quantityInput?.value || '1', 10);
        return Math.max(1, quantity || 1);
    };
    const getAvailableStock = () => Math.max(0, Number.parseInt(dailyInventory[product.id]?.available, 10) || 0);
    const saveCartForToday = (cart) => {
        saveCart(cart);
        saveCartDay(getTodayKey());
    };
    const tryAddToCart = (redirectToCart = false) => {
        const currentCart = loadCart();
        const existingQty = currentCart.find((item) => item.productId === product.id)?.quantity || 0;
        const requestedQty = getSelectedQuantity();
        const available = getAvailableStock();

        if (existingQty + requestedQty > available) {
            copyStatus.textContent = available <= 0
                ? `${loc(product, 'name')}: ${t('sold_out_today')}`
                : `${loc(product, 'name')}: ${t('limited_stock_today').replace('{count}', String(available))}`;
            return;
        }

        const nextCart = addCartItem(currentCart, product.id, requestedQty);
        saveCartForToday(nextCart);

        if (redirectToCart) {
            const cartUrl = new URL(getStoreHomeUrl(), window.location.origin);
            cartUrl.searchParams.set('cart', 'open');
            window.location.href = cartUrl.toString();
            return;
        }

        copyStatus.textContent = t('added_to_cart');
    };

    imageButtons.forEach((button) => {
        button.addEventListener('click', () => {
            imageButtons.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            mainImage.src = button.dataset.src;
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                copyStatus.textContent = t('link_copied');
            } catch (error) {
                copyStatus.textContent = shareUrl;
            }
        });
    }

    bindProductExternalLinkTracking(product);

    if (copyYandexProductNameBtn) {
        copyYandexProductNameBtn.addEventListener('click', async () => {
            const productName = copyYandexProductNameBtn.dataset.productName || '';
            try {
                await navigator.clipboard.writeText(productName);
                copyStatus.textContent = 'Yandex product name copied';
            } catch (error) {
                copyStatus.textContent = productName;
            }
        });
    }
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
            tryAddToCart(true);
        });
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            tryAddToCart(false);
        });
    }
}

function bindProductExternalLinkTracking(product) {
    const links = getProductExternalLinks(product);
    const linkById = new Map(links.map((link) => [link.id, link]));
    const params = new URLSearchParams(window.location.search);

    root.querySelectorAll('[data-product-external-link-id]').forEach((anchor) => {
        anchor.addEventListener('click', () => {
            const link = linkById.get(anchor.dataset.productExternalLinkId);
            if (!link) return;

            trackProductExternalLinkClickIntent({
                productId: product.id || '',
                productName: loc(product, 'name') || product.name_en || product.name_ru || '',
                companyId: product.companyId || getCurrentCompanyId(),
                linkId: link.id,
                linkType: link.type,
                linkLabel: link.label,
                destinationUrl: link.url,
                trackingSlug: params.get('trackingSlug') || '',
                campaignId: params.get('campaignId') || params.get('campaign') || '',
                influencerId: params.get('influencerId') || '',
                source: 'product_page'
            }).catch((error) => {
                console.warn('Product external link click tracking failed', error);
            });
        });
    });
}
function updateMeta(product) {
    const name = loc(product, 'name');
    const description = loc(product, 'description') || `Product from ${activeStoreName}.`;
    document.title = `${name} | ${activeStoreName}`;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
        descriptionMeta.setAttribute('content', description);
    }
}

init().catch((error) => {
    console.error('Product page failed to initialize:', error);
    renderMissingState();
});

