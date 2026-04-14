import { db, storage, functions, httpsCallable } from './firebase-config.js';
import { collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { $, $$, t, loc, setupLanguage, initMobileMenu } from './common.js';
import { buildProductPageUrl } from './product-utils.js';
import { COMPANY_ID, getCurrentCompanyId, initCompanyFromLocation, matchesCompanyId } from './company-config.js';
import { getCheckoutSettingsDocId, getInventoryDocId } from './firestore-paths.js';
import { loadStoreConfig } from './storefront/store-loader.js';
import { applyStoreTheme } from './storefront/theme-engine.js';
import { renderStoreSection } from './storefront/section-renderer.js';
import {
    DEFAULT_CHECKOUT_SETTINGS,
    addCartItem,
    calculateCartTotals,
    clearCart,
    formatPrice,
    getCartItemCount,
    loadCart,
    loadCartDay,
    removeCartItem,
    saveCart,
    saveCartDay,
    updateCartItemQuantity
} from './shop-utils.js';

// --- STATE ---
let products = [];
let bannerData = [];
let categories = [];
let categoriesMap = {}; // ID -> Data
let dailyInventory = {}; // { prodId: { available, sold } }
let todayStr = "";
let paymentMethods = [];
let pendingOrder = null; // { orderId, orderToken, expiresAtMillis, total, items, timerInterval }
let cart = loadCart();
let checkoutSettings = { ...DEFAULT_CHECKOUT_SETTINGS };
let supportWhatsappNumber = '';
let cartNoticeMessage = '';
let campaignTimeline = [];
let activeStoreName = 'OA Kyrgyz Organic';
let activeStoreConfig = null;

// --- DOM ELEMENTS ---
const productGrid = $('productGrid');
const featuredGrid = $('featuredGrid');
const recommendedGrid = $('recommendedGrid');
const searchInput = $('searchInput');
const filterList = $('categoryFilters');

const modal = $('productModal');
const modalContent = $('modalContent');
const closeModal = $('closeModal');
const heroCarousel = $$('.hero-carousel');
const cartButton = $('cartButton');
const cartCount = $('cartCount');
const cartModal = $('cartModal');
const closeCartModal = $('closeCartModal');
const cartItems = $('cartItems');
const cartEmptyState = $('cartEmptyState');
const cartNotice = $('cartNotice');
const cartCheckoutForm = $('cartCheckoutForm');
const cartSubtotal = $('cartSubtotal');
const cartDeliveryFee = $('cartDeliveryFee');
const cartTotal = $('cartTotal');
const checkoutAddressRow = $('checkoutAddressRow');
const paymentOrderSummary = $('paymentOrderSummary');
const stickyCartSummary = $('stickyCartSummary');
const stickyCartButton = $('stickyCartButton');
const stickyCartTitle = $('stickyCartTitle');
const stickyCartMeta = $('stickyCartMeta');
const stickyCartTotal = $('stickyCartTotal');
const whatsAppSupportBtn = $('whatsAppSupportBtn');
const homeCampaignSection = $('homeCampaignSection');
const homeCampaignTimeline = $('homeCampaignTimeline');

// --- INIT ---
async function init() {
    const companyConfig = initCompanyFromLocation();
    activeStoreName = companyConfig.name || activeStoreName;
    activeStoreConfig = await loadStoreConfig(companyConfig.companyId);
    activeStoreName = activeStoreConfig.name || activeStoreName;
    applyStoreTheme(activeStoreConfig);
    setupLanguage();
    initMobileMenu();

    // Special handling for Mobile Categories Toggle on Home
    const mobCatBtn = document.getElementById('mobCategories');
    const mobCatList = document.getElementById('mobCategoryList');
    if (mobCatBtn && mobCatList) {
        mobCatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mobCatList.style.display = mobCatList.style.display === 'none' ? 'flex' : 'none';
        });
    }

    await loadData();
    renderAll();
    setupEventListeners();
    maybeOpenCartFromUrl();
}

async function loadData() {
    const activeCompanyId = getCurrentCompanyId();

    // 1. Load Banners Separately & Immediately
    getDocs(collection(db, "banners")).then(snap => {
        const now = new Date();
        bannerData = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(b => matchesCompanyId(b, `banners/${b.id}`))
            .filter(b => {
                if (!b.active) return false;
                let start = b.startAt;
                if (start && typeof start.toDate === 'function') start = start.toDate();
                else if (start && !(start instanceof Date)) start = new Date(start);

                let end = b.endAt;
                if (end && typeof end.toDate === 'function') end = end.toDate();
                else if (end && !(end instanceof Date)) end = new Date(end);

                if (start && start > now) return false;
                if (end && end < now) return false;
                return true;
            })
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        renderBanner(); // Render immediately when ready
    }).catch(e => console.error("Banners failed:", e));

    // Calc Today YYYY-MM-DD (Local)
    const localNow = new Date();
    const y = localNow.getFullYear();
    const m = String(localNow.getMonth() + 1).padStart(2, '0');
    const d = String(localNow.getDate()).padStart(2, '0');
    todayStr = `${y}-${m}-${d}`;

    try {
        // 2. Load Rest of Data
        const results = await Promise.allSettled([
            getDocs(query(collection(db, "products"), where("active", "==", true))),
            getDocs(query(collection(db, "categories"), where("active", "==", true))),
            getDocs(query(collection(db, "payment_methods"), where("active", "==", true)))
        ]);

        const pRes = results[0].status === 'fulfilled' ? results[0].value : { docs: [] };
        const cRes = results[1].status === 'fulfilled' ? results[1].value : { docs: [] };
        // Banners removed from here
        const pmRes = results[2].status === 'fulfilled' ? results[2].value : { docs: [] };


        // Fetch Inventory (company-scoped, with legacy fallback)
        const invId = getInventoryDocId(activeCompanyId, todayStr);
        let invSnap = await getDoc(doc(db, 'inventory', invId));
        if (!invSnap.exists() && activeCompanyId === COMPANY_ID) {
            invSnap = await getDoc(doc(db, 'inventory', todayStr));
        }
        if (invSnap.exists()) {
            const inventoryData = invSnap.data();
            if (inventoryData.companyId && inventoryData.companyId !== activeCompanyId) {
                console.warn('Inventory companyId mismatch:', todayStr);
                dailyInventory = {};
            } else {
                if (!inventoryData.companyId && activeCompanyId === COMPANY_ID) console.warn('Inventory missing companyId:', todayStr);
                dailyInventory = inventoryData;
            }
        } else {
            dailyInventory = {};
        }

        products = pRes.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => matchesCompanyId(p, `products/${p.id}`));

        categories = [];
        cRes.docs.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            if (!matchesCompanyId(data, `categories/${data.id}`)) return;
            categories.push(data);
            categoriesMap[doc.id] = data;
        });

        categories.sort((a, b) => loc(a, 'name').localeCompare(loc(b, 'name')));

        // Banner processing moved to top of function for lazy loading

        // Payment Methods
        paymentMethods = pmRes.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(pm => matchesCompanyId(pm, `payment_methods/${pm.id}`));
        await loadCampaignTimeline();
        await loadCheckoutSettings();
        syncCartWithCatalog();
        reconcileCartWithInventory({ shouldNotify: true });

    } catch (e) {
        console.error("Error loading data:", e);
        if (e.code === 'permission-denied' || e.code === 'failed-precondition') {
            if (productGrid) productGrid.innerHTML = '<p style="color: red; padding: 2rem;">Error: Check Firebase Config.</p>';
        }
    }
}

function renderAll() {
    renderCategories();
    renderBanner();
    renderQuickActions();
    renderFeatured();
    renderProducts(products);
    renderCampaignTimeline();
    updateStaticUI();
    renderCart();
}

function isFeatureEnabled(featureName, fallback = true) {
    const features = activeStoreConfig?.features || {};
    return Object.prototype.hasOwnProperty.call(features, featureName)
        ? features[featureName] === true
        : fallback;
}

function isSectionEnabled(sectionType, fallback = true) {
    const layout = Array.isArray(activeStoreConfig?.layout) ? activeStoreConfig.layout : [];
    const section = layout.find(item => item.type === sectionType);
    return section ? section.enabled !== false : fallback;
}

function getProductDisplayConfig() {
    return {
        view: 'grid',
        cardSize: 'medium',
        showPrice: true,
        showDiscount: true,
        showBadges: true,
        showStock: true,
        ...(activeStoreConfig?.productDisplay || {})
    };
}

function toCampaignDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCampaignTitle(campaign = {}, fallback = 'Campaign') {
    return campaign.timelineTitle || campaign.headline || campaign.headlineEN || campaign.headlineKG || campaign.title || fallback;
}

function getCampaignImage(campaign = {}) {
    return campaign.timelineImageUrl || campaign.imageUrl || campaign.optionalImageUrl || '';
}

function getCampaignUrl(campaign = {}) {
    if (campaign.url) return campaign.url;
    if (campaign.campaignUrl) return campaign.campaignUrl;
    if (campaign.slug) return `/${String(campaign.slug).replace(/^\/+|\/+$/g, '')}/`;
    const activeCompanyId = getCurrentCompanyId();
    if (activeCompanyId !== COMPANY_ID) return `/${activeCompanyId}/?campaign=prime-mun`;
    if (campaign.id === 'prime-mun') return '/prime-mun/';
    return '/prime-mun/';
}

function isCampaignLive(campaign = {}, now = new Date()) {
    if (!campaign.id) return false;
    const start = toCampaignDate(campaign.startDate);
    const end = toCampaignDate(campaign.endDate);
    return Boolean(campaign.isActive && (!start || start <= now) && (!end || end >= now));
}

function getFallbackCampaignTimeline(currentCampaign = {}) {
    const headline = getCampaignTitle(currentCampaign, 'Current Campaign');
    const fallbackTimeline = [
        { key: 'past1', status: 'past', title: 'Previous Drop', imageUrl: '' },
        { key: 'past2', status: 'past', title: 'Last Campaign', imageUrl: '' },
        { key: 'current', status: 'current', title: headline, imageUrl: getCampaignImage(currentCampaign), url: getCampaignUrl(currentCampaign), isClickable: isCampaignLive(currentCampaign) },
        { key: 'future1', status: 'future', title: 'Coming Soon', imageUrl: '' },
        { key: 'future2', status: 'future', title: 'Next Surprise', imageUrl: '' }
    ];
    const savedTimeline = Array.isArray(currentCampaign.campaignTimeline) ? currentCampaign.campaignTimeline : [];

    return fallbackTimeline.map((fallback) => ({
        ...fallback,
        ...(savedTimeline.find(item => item.key === fallback.key) || {})
    }));
}

function campaignToTimelineItem(campaign, key, status, fallbackTitle) {
    return {
        key,
        status,
        title: getCampaignTitle(campaign, fallbackTitle),
        imageUrl: getCampaignImage(campaign),
        url: getCampaignUrl(campaign),
        isClickable: status === 'current' ? isCampaignLive(campaign) : false
    };
}

function buildCampaignTimelineFromDocs(campaigns, currentCampaign) {
    const now = new Date();
    const fallbackTimeline = getFallbackCampaignTimeline(currentCampaign);
    const fallbackByKey = Object.fromEntries(fallbackTimeline.map(item => [item.key, item]));
    const current = currentCampaign || campaigns.find(campaign => campaign.id === 'prime-mun') || {};
    const currentId = current.id || 'prime-mun';

    const pastCampaigns = campaigns
        .filter(campaign => campaign.id !== currentId)
        .filter(campaign => {
            const end = toCampaignDate(campaign.endDate);
            return end && end < now;
        })
        .sort((a, b) => toCampaignDate(b.endDate) - toCampaignDate(a.endDate))
        .slice(0, 2)
        .reverse();

    const futureCampaigns = campaigns
        .filter(campaign => campaign.id !== currentId)
        .filter(campaign => {
            const start = toCampaignDate(campaign.startDate);
            return start && start > now;
        })
        .sort((a, b) => toCampaignDate(a.startDate) - toCampaignDate(b.startDate))
        .slice(0, 2);

    const activeCampaign = campaigns.find(campaign => isCampaignLive(campaign, now));
    const currentTimelineItem = activeCampaign
        ? campaignToTimelineItem(activeCampaign, 'current', 'current', fallbackByKey.current?.title || 'Current Campaign')
        : { ...fallbackByKey.current, isClickable: false, url: '' };

    return [
        pastCampaigns[0] ? campaignToTimelineItem(pastCampaigns[0], 'past1', 'past', 'Previous Campaign') : fallbackByKey.past1,
        pastCampaigns[1] ? campaignToTimelineItem(pastCampaigns[1], 'past2', 'past', 'Last Campaign') : fallbackByKey.past2,
        currentTimelineItem,
        futureCampaigns[0] ? campaignToTimelineItem(futureCampaigns[0], 'future1', 'future', 'Coming Soon') : fallbackByKey.future1,
        futureCampaigns[1] ? campaignToTimelineItem(futureCampaigns[1], 'future2', 'future', 'Next Surprise') : fallbackByKey.future2
    ].filter(Boolean);
}

async function loadCampaignTimeline() {
    try {
        if (!isFeatureEnabled('campaign', getCurrentCompanyId() === COMPANY_ID)) {
            campaignTimeline = [];
            return;
        }

        const activeCompanyId = getCurrentCompanyId();
        const isDefaultCompany = activeCompanyId === COMPANY_ID;
        const campaignsSnap = await getDocs(collection(db, 'campaigns'));
        const campaigns = campaignsSnap.docs
            .map(campaignDoc => ({ id: campaignDoc.id, ...campaignDoc.data() }))
            .filter(campaign => matchesCompanyId(campaign, `campaigns/${campaign.id}`));

        const currentCampaign = campaigns.find(campaign => isCampaignLive(campaign)) || campaigns.find(campaign => campaign.id === 'prime-mun') || campaigns[0] || {};
        const hasCampaignJourneySetting = Object.prototype.hasOwnProperty.call(currentCampaign, 'showCampaignJourney');
        const shouldShowCampaignJourney = hasCampaignJourneySetting
            ? currentCampaign.showCampaignJourney === true
            : isDefaultCompany;

        if (!shouldShowCampaignJourney) {
            campaignTimeline = [];
            return;
        }

        campaignTimeline = buildCampaignTimelineFromDocs(campaigns, currentCampaign);
    } catch (error) {
        console.warn('Campaign timeline load failed:', error);
        campaignTimeline = getCurrentCompanyId() === COMPANY_ID ? getFallbackCampaignTimeline({}) : [];
    }
}

function buildCampaignSilhouette(title = 'Coming Soon') {
    return `
        <div class="home-campaign-silhouette">
            <div class="home-silhouette-arch"></div>
            <div class="home-silhouette-lines">
                <span></span>
                <span></span>
            </div>
        </div>
        <span>${title}</span>
    `;
}

function renderCampaignTimeline() {
    if (!homeCampaignSection || !homeCampaignTimeline || !campaignTimeline.length || !isFeatureEnabled('campaign', getCurrentCompanyId() === COMPANY_ID) || !isSectionEnabled('campaign', getCurrentCompanyId() === COMPANY_ID)) {
        if (homeCampaignSection) homeCampaignSection.hidden = true;
        return;
    }

    homeCampaignSection.hidden = false;
    homeCampaignTimeline.innerHTML = campaignTimeline.map((item) => {
        const status = item.status || 'future';
        const isCurrent = status === 'current';
        const title = item.title || (status === 'future' ? 'Coming Soon' : 'Campaign');
        const label = isCurrent ? (item.isClickable ? 'Now' : 'Paused') : status === 'future' ? 'Soon' : 'Past';
        const imageMarkup = item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${title}">`
            : buildCampaignSilhouette(title);
        const content = `
            <div class="home-campaign-image">${imageMarkup}</div>
            <div class="home-campaign-label">${label}</div>
            <h3>${title}</h3>
        `;

        if (isCurrent && item.isClickable) {
            return `
                <a class="home-campaign-card is-current" href="${item.url || '/prime-mun/'}" aria-label="Open current campaign: ${title}">
                    ${content}
                </a>
            `;
        }

        return `
            <article class="home-campaign-card ${isCurrent ? 'is-current' : ''} ${status === 'future' ? 'is-future' : ''}">
                ${content}
            </article>
        `;
    }).join('');
}

function updateStaticUI() {
    document.title = `${activeStoreName} - Grocery Catalog`;

    document.querySelectorAll('.logo').forEach((logo) => {
        logo.textContent = activeStoreName;
    });

    const footAboutTitle = document.getElementById('footAboutTitle');
    if (footAboutTitle) footAboutTitle.textContent = activeStoreName;

    const copyrightText = document.getElementById('copyrightText');
    if (copyrightText) copyrightText.textContent = `© 2025 ${activeStoreName}. All rights reserved. | `;

    const availableTodayTitle = document.getElementById('availableTodayTitle');
    const fullCatalogTitle = document.getElementById('fullCatalog');
    if (availableTodayTitle) availableTodayTitle.textContent = t('available_today');
    if (fullCatalogTitle) fullCatalogTitle.textContent = t('full_catalog');

    const availableTodayLabel = document.getElementById('availableTodayLabel');
    if (availableTodayLabel) availableTodayLabel.textContent = t('available_today_label');

    const ctaTitle = document.querySelector('.cta-title');
    if (ctaTitle) ctaTitle.textContent = t('invest_title');
    const ctaText = document.querySelector('.cta-text');
    if (ctaText) ctaText.textContent = t('invest_text');
    const ctaBtn = document.querySelector('.investment-cta .cta-btn');
    if (ctaBtn) ctaBtn.textContent = t('learn_more');
    const investmentCta = document.querySelector('.investment-cta');
    if (investmentCta) investmentCta.hidden = !isFeatureEnabled('investmentSection', getCurrentCompanyId() === COMPANY_ID) || !isSectionEnabled('cta', getCurrentCompanyId() === COMPANY_ID);

    const deliveryBanner = document.querySelector('.delivery-banner');
    if (deliveryBanner) deliveryBanner.hidden = !isFeatureEnabled('deliveryBanner', true);

    if (cartButton) cartButton.hidden = !isFeatureEnabled('cart', true);

    const allBtn = document.querySelector('.filter-pill[data-category="all"]');
    if (allBtn) allBtn.textContent = t('all');

    if (cartEmptyState) cartEmptyState.textContent = t('cart_empty');
    if (stickyCartTitle) stickyCartTitle.textContent = t('cart');
    if (whatsAppSupportBtn) whatsAppSupportBtn.textContent = t('contact_support_whatsapp');
}

function renderBanner() {
    if (!heroCarousel) return;

    const heroSection = activeStoreConfig?.layout?.find(section => section.type === 'hero' && section.enabled !== false) || { type: 'hero', variant: 'carousel' };
    renderStoreSection('hero', {
        root: heroCarousel,
        store: activeStoreConfig,
        section: heroSection,
        bannerData
    });
}

function renderQuickActions() {
    const quickActions = document.querySelector('.quick-actions-row');
    if (!quickActions) return;

    if (!isFeatureEnabled('quickActions', getCurrentCompanyId() === COMPANY_ID) || !isSectionEnabled('quickActions', getCurrentCompanyId() === COMPANY_ID)) {
        quickActions.hidden = true;
        return;
    }

    quickActions.hidden = false;
    renderStoreSection('quickActions', {
        root: quickActions,
        store: activeStoreConfig
    });
}

function renderFeatured() {
    if (!featuredGrid) return;
    featuredGrid.innerHTML = '';
    const availableToday = products
        .map((product) => ({
            product,
            available: Number(dailyInventory[product.id]?.available || 0)
        }))
        .filter((item) => item.available > 0)
        .sort((a, b) => b.available - a.available)
        .slice(0, 4);

    if (!availableToday.length) {
        featuredGrid.innerHTML = `<p class="no-results" style="grid-column: 1/-1; text-align: center; color: #777; padding: 2rem;">${t('no_available_today')}</p>`;
        return;
    }

    availableToday.forEach(({ product, available }) => {
        const card = createCard(product, `${t('stock_in')}: ${available}`);
        featuredGrid.appendChild(card);
    });
}

function renderProducts(data) {
    if (!productGrid) return;
    const fullCatalog = document.getElementById('fullCatalog');
    if (!isSectionEnabled('products', true)) {
        productGrid.hidden = true;
        if (fullCatalog) fullCatalog.hidden = true;
        return;
    }
    productGrid.hidden = false;
    if (fullCatalog) fullCatalog.hidden = false;
    productGrid.innerHTML = '';
    const display = getProductDisplayConfig();
    productGrid.classList.toggle('product-grid-list', display.view === 'list');
    productGrid.dataset.cardSize = display.cardSize || 'medium';
    if (data.length === 0) {
        productGrid.innerHTML = `<p class="no-results" style="grid-column: 1/-1; text-align: center; color: #777; padding: 2rem;">${t('no_products_found') || 'No products found.'}</p>`;
        return;
    }
    data.forEach(product => {
        const card = createCard(product);
        productGrid.appendChild(card);
    });
}

function syncCartWithCatalog() {
    const validIds = new Set(products.map((product) => product.id));
    const nextCart = cart.filter((item) => validIds.has(item.productId));

    if (nextCart.length !== cart.length) {
        cart = nextCart;
        saveCart(cart);
    }
}

async function loadCheckoutSettings() {
    try {
        const activeCompanyId = getCurrentCompanyId();
        const settingsId = getCheckoutSettingsDocId(activeCompanyId);
        let snap = await getDoc(doc(db, 'shop_settings', settingsId));
        if (!snap.exists() && activeCompanyId === COMPANY_ID) {
            snap = await getDoc(doc(db, 'shop_settings', 'checkout'));
        }
        const data = snap.exists() ? snap.data() : {};
        if (data.companyId && data.companyId !== activeCompanyId) {
            console.warn('Checkout settings companyId mismatch');
            throw new Error('Checkout settings unavailable for this company');
        }
        if (snap.exists() && !data.companyId && activeCompanyId === COMPANY_ID) console.warn('Checkout settings missing companyId');
        checkoutSettings = { ...DEFAULT_CHECKOUT_SETTINGS, ...data };
        supportWhatsappNumber = String(data.supportWhatsappNumber || '').trim();
        updateWhatsAppSupportButton();
    } catch (error) {
        console.error('Checkout settings load error:', error);
        checkoutSettings = { ...DEFAULT_CHECKOUT_SETTINGS };
        supportWhatsappNumber = '';
        updateWhatsAppSupportButton();
    }
}

function normalizeWhatsappNumber(value) {
    return String(value || '').replace(/[^\d]/g, '');
}

function updateWhatsAppSupportButton() {
    if (!whatsAppSupportBtn) return;

    if (!isFeatureEnabled('whatsappSupport', true)) {
        whatsAppSupportBtn.hidden = true;
        return;
    }

    const phone = normalizeWhatsappNumber(supportWhatsappNumber);
    if (!phone) {
        whatsAppSupportBtn.hidden = true;
        return;
    }

    const message = encodeURIComponent('Hello, I need help with my order.');
    whatsAppSupportBtn.href = `https://wa.me/${phone}?text=${message}`;
    whatsAppSupportBtn.hidden = false;
}

function setCartNotice(message = '') {
    cartNoticeMessage = message;
    if (!cartNotice) return;

    cartNotice.textContent = cartNoticeMessage;
    cartNotice.style.display = cartNoticeMessage ? 'block' : 'none';
}

function getAvailableStock(productId) {
    return Math.max(0, Number.parseInt(dailyInventory[productId]?.available, 10) || 0);
}

function getCartQuantity(productId) {
    return cart.find((item) => item.productId === productId)?.quantity || 0;
}

function buildAvailabilityMessage(productName, available) {
    if (available <= 0) {
        return `${productName}: ${t('sold_out_today')}`;
    }

    return `${productName}: ${t('limited_stock_today').replace('{count}', String(available))}`;
}

function reconcileCartWithInventory({ shouldNotify = false } = {}) {
    const previousDay = loadCartDay();
    const isNewDay = previousDay && previousDay !== todayStr;
    const productMap = new Map(products.map((product) => [product.id, product]));
    const nextCart = [];
    let changed = false;

    cart.forEach((item) => {
        const product = productMap.get(item.productId);
        const available = getAvailableStock(item.productId);

        if (!product || available <= 0) {
            changed = true;
            return;
        }

        const nextQuantity = Math.min(item.quantity, available);
        if (nextQuantity !== item.quantity) changed = true;
        nextCart.push({ productId: item.productId, quantity: nextQuantity });
    });

    if (isNewDay) {
        saveCartDay(todayStr);
    }

    if (changed || isNewDay) {
        cart = nextCart;
        saveCart(cart);
        saveCartDay(todayStr);

        if (shouldNotify && (changed || isNewDay)) {
            setCartNotice(t('cart_updated_today'));
        }
    }
}

function createCard(product, tag = '') {
    const display = getProductDisplayConfig();
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : (product.category || 'Other');
    const productPageUrl = buildProductPageUrl(product);

    // Inventory Badge Logic
    const inv = dailyInventory[product.id];
    const avail = inv ? (inv.available || 0) : 0;

    let badgeHtml = '';

    if (display.showBadges !== false) {
        if (avail === 0) {
            badgeHtml = `<div class="delivery-badge" style="background:#e53935;">${t('sold_out') || 'Sold Out'}</div>`;
        } else if (display.showStock !== false && avail < 5) {
            badgeHtml = `<div class="delivery-badge" style="background:#fb8c00;">${t('only_left') || 'Only'} ${avail}</div>`;
        } else if (tag && display.showStock !== false) {
            badgeHtml = `<div class="delivery-badge">${tag}</div>`;
        }
    }

    const card = document.createElement('div');
    card.className = `product-card product-card-${display.cardSize || 'medium'}`;
    if (avail === 0) card.classList.add('sold-out'); // Optional CSS styling

    card.innerHTML = `
        ${badgeHtml}
        <div class="product-image">
            <img src="${product.imageUrl || 'https://placehold.co/400x300'}" alt="${loc(product, 'name')}">
        </div>
        <div class="product-info">
            <div class="product-category">${categoryName}</div>
            <h3 class="product-title">${loc(product, 'name')}</h3>
            <div class="product-meta">
                <span class="product-weight">${product.weight}</span>
                ${display.showPrice !== false ? `<span class="product-price">${product.price} ${t('price_currency')}</span>` : ''}
            </div>
            <div class="product-card-actions">
                <a class="text-link-inline" href="${productPageUrl}">${t('view_product_page')}</a>
            </div>
        </div>
    `;
    card.addEventListener('click', () => openModal(product));
    const pageLink = card.querySelector('a');
    if (pageLink) {
        pageLink.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
    return card;
}




function renderCategories() {
    // 1. Render Filter Pills
    let html = `<li><button class="filter-pill active" data-category="all">${t('all')}</button></li>`;
    categories.forEach(cat => {
        const style = `--cat-bg: ${cat.style_bg || '#f8f9fa'}; --cat-color: ${cat.style_color || '#333'}; --cat-border: ${cat.style_border || 'transparent'};`;
        html += `<li><button class="filter-pill" style="${style}" data-category="${cat.id}">${loc(cat, 'name')}</button></li>`;
    });
    if (filterList) filterList.innerHTML = html;

    // 2. Render Mobile Sub-menu
    const mobList = document.getElementById('mobCategoryList');
    if (mobList) {
        let mobHtml = `<a href="#" data-cat="all" style="font-size:1rem; padding: 0.5rem 0;">${t('all')}</a>`;
        categories.forEach(cat => {
            mobHtml += `<a href="#" data-cat="${cat.id}" style="font-size:1rem; padding: 0.5rem 0;">${loc(cat, 'name')}</a>`;
        });
        mobList.innerHTML = mobHtml;

        // Add listeners to these specific links to close menu
        mobList.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                filterByCategory(e.target.dataset.cat);
            });
        });
    }
}

// Global Filter Helper used by Dropdown & Scroll logic
window.filterByCategory = (catId) => {
    // 1. Activate Pill
    document.querySelectorAll('.filter-pill').forEach(b => {
        if (b.dataset.category === catId) b.classList.add('active');
        else b.classList.remove('active');
    });

    // 2. Filter Grid
    if (catId === 'all') {
        renderProducts(products);
    } else {
        const filtered = products.filter(p => p.categoryId === catId);
        renderProducts(filtered);
    }

    // 3. Scroll to "Full Catalog" Header
    const fullCatalog = document.getElementById('fullCatalog');
    if (fullCatalog) {
        const headerOffset = 100;
        const elementPosition = fullCatalog.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    }

    // 4. Close Mobile Menu (we need access to closeMenu, or just re-select it)
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    }
};

function setupEventListeners() {
    if (filterList) {
        filterList.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-pill');
            if (btn) {
                e.preventDefault();
                filterByCategory(btn.dataset.category);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = products.filter(p =>
                loc(p, 'name').toLowerCase().includes(term)
            );
            renderProducts(filtered);
        });
    }

    if (cartButton) {
        cartButton.addEventListener('click', () => {
            if (isFeatureEnabled('cart', true)) openCartModal();
        });
    }

    if (closeCartModal && cartModal) {
        closeCartModal.addEventListener('click', closeCartModalFn);
    }

    if (stickyCartButton) {
        stickyCartButton.addEventListener('click', () => {
            if (isFeatureEnabled('cart', true)) openCartModal();
        });
    }

    if (cartItems) {
        cartItems.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-remove-product]');
            if (removeBtn) {
                cart = removeCartItem(cart, removeBtn.dataset.removeProduct);
                persistCart();
            }
        });

        cartItems.addEventListener('input', (event) => {
            const qtyInput = event.target.closest('[data-product-qty]');
            if (!qtyInput) return;

            const quantity = Number.parseInt(qtyInput.value, 10);
            if (!Number.isFinite(quantity)) return;
            const productId = qtyInput.dataset.productQty;
            const product = products.find((item) => item.id === productId);
            const available = getAvailableStock(productId);
            const safeQuantity = Math.max(0, Math.min(quantity, available));

            if (quantity > available) {
                const productName = product ? loc(product, 'name') : 'This product';
                setCartNotice(buildAvailabilityMessage(productName, available));
                qtyInput.value = String(safeQuantity);
            } else if (cartNoticeMessage) {
                setCartNotice('');
            }

            cart = updateCartItemQuantity(cart, productId, safeQuantity);
            persistCart();
        });
    }

    if (cartCheckoutForm) {
        cartCheckoutForm.addEventListener('submit', handleCheckoutSubmit);
        cartCheckoutForm.addEventListener('change', (event) => {
            if (event.target.name === 'checkoutDeliveryMethod') {
                renderCart();
            }
        });
    }

    if (closeModal && modal) {
        closeModal.addEventListener('click', closeModalFn);
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModalFn();
        if (e.target === cartModal) closeCartModalFn();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModalFn();
            closeCartModalFn();
        }
    });
}

function closeModalFn() {
    if (modal) modal.style.display = 'none';
    syncBodyScroll();
}

function openCartModal() {
    renderCart();
    if (cartModal) cartModal.style.display = 'flex';
    syncBodyScroll();
}

function closeCartModalFn() {
    if (cartModal) cartModal.style.display = 'none';
    syncBodyScroll();
}

function syncBodyScroll() {
    const paymentModal = document.getElementById('paymentModal');
    const hasOpenModal = [modal, cartModal, paymentModal].some((el) => el && el.style.display === 'flex');
    document.body.style.overflow = hasOpenModal ? 'hidden' : 'auto';
}

function getSelectedDeliveryMethod() {
    const selected = document.querySelector('input[name="checkoutDeliveryMethod"]:checked');
    return selected?.value || 'delivery';
}

function persistCart() {
    saveCart(cart);
    if (todayStr) saveCartDay(todayStr);
    renderCart();
}

function maybeOpenCartFromUrl() {
    const url = new URL(window.location.href);

    if (url.searchParams.get('cart') !== 'open') return;

    openCartModal();
    url.searchParams.delete('cart');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function buildOrderTrackingUrl(orderId, orderToken) {
    const url = new URL('track-order.html', window.location.href);
    url.searchParams.set('orderId', orderId);
    url.searchParams.set('token', orderToken);
    return url.toString();
}

function renderCart() {
    if (!isFeatureEnabled('cart', true)) {
        if (cartButton) cartButton.hidden = true;
        if (stickyCartSummary) stickyCartSummary.hidden = true;
        document.body.classList.remove('has-sticky-cart');
        return;
    }

    if (cartCount) cartCount.textContent = String(getCartItemCount(cart));
    if (!cartItems) return;

    const deliveryMethod = getSelectedDeliveryMethod();
    const totals = calculateCartTotals(cart, products, deliveryMethod, checkoutSettings);
    const itemCount = getCartItemCount(cart);

    if (checkoutAddressRow) {
        checkoutAddressRow.style.display = deliveryMethod === 'delivery' ? 'flex' : 'none';
    }

    if (stickyCartSummary) {
        const hasItems = itemCount > 0;
        stickyCartSummary.hidden = !hasItems;
        document.body.classList.toggle('has-sticky-cart', hasItems);

        if (hasItems) {
            if (stickyCartTitle) stickyCartTitle.textContent = t('cart_ready');
            if (stickyCartMeta) stickyCartMeta.textContent = `${itemCount} ${t('cart_items_count')}`;
            if (stickyCartTotal) stickyCartTotal.textContent = `${formatPrice(totals.total)} ${t('price_currency')}`;
        }
    }

    setCartNotice(cartNoticeMessage);

    if (cartEmptyState) {
        cartEmptyState.style.display = totals.items.length ? 'none' : 'block';
    }

    if (!totals.items.length) {
        cartItems.innerHTML = '';
    } else {
        cartItems.innerHTML = totals.items.map((item) => {
            const available = dailyInventory[item.productId]?.available;
            const maxQty = available && available > 0 ? available : 99;

            return `
                <article class="cart-item">
                    <img src="${item.product.imageUrl || 'https://placehold.co/120x120'}" alt="${loc(item.product, 'name')}">
                    <div>
                        <div class="cart-item-title">${loc(item.product, 'name')}</div>
                        <div class="cart-item-meta">${item.product.weight || ''}</div>
                        <div class="cart-item-actions">
                            <label>
                                ${t('quantity')}
                                <input type="number" min="1" max="${maxQty}" value="${item.quantity}" data-product-qty="${item.productId}">
                            </label>
                            <button type="button" class="secondary-pill" data-remove-product="${item.productId}">${t('remove')}</button>
                        </div>
                    </div>
                    <div class="cart-item-price">${formatPrice(item.lineTotal)} ${t('price_currency')}</div>
                </article>
            `;
        }).join('');
    }

    if (cartSubtotal) cartSubtotal.textContent = `${formatPrice(totals.subtotal)} ${t('price_currency')}`;
    if (cartDeliveryFee) {
        cartDeliveryFee.textContent = totals.deliveryFee === 0
            ? t('free_delivery')
            : `${formatPrice(totals.deliveryFee)} ${t('price_currency')}`;
    }
    if (cartTotal) cartTotal.textContent = `${formatPrice(totals.total)} ${t('price_currency')}`;
    if (document.getElementById('cartCheckoutBtn')) {
        document.getElementById('cartCheckoutBtn').disabled = totals.items.length === 0;
    }
}

function openModal(product) {
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : (product.category || 'Other');
    const productPageUrl = buildProductPageUrl(product);

    // Default Images
    const imgPack = product.imageUrl || 'https://placehold.co/400x300?text=Packaging';
    const imgContent = product.imageNoPackagingUrl || 'https://placehold.co/400x300?text=No+Packaging';

    // Inventory Info
    const inv = dailyInventory[product.id];
    const avail = inv ? (inv.available || 0) : 0;

    let btnHtml = '';
    if (avail > 0) {
        btnHtml = `
            <div class="modal-quantity-row">
                <label for="modalQuantity">
                    ${t('quantity')}
                </label>
                <div class="modal-quantity-input">
                    <input id="modalQuantity" type="number" min="1" max="${Math.max(avail, 1)}" value="1">
                </div>
            </div>
            <div class="product-page-actions modal-buy-actions">
                <button id="buyNowBtn" type="button" class="cta-btn modal-buy-now">${t('buy_now')}</button>
                <button id="addToCartBtn" type="button" class="secondary-pill">${t('add_to_cart')}</button>
                <button id="openCartBtn" type="button" class="secondary-pill">${t('open_cart')}</button>
            </div>
        `;
    } else {
        btnHtml = `<button disabled class="cta-btn modal-buy-now" style="width:100%; margin-top:1rem; background:#ccc; cursor:not-allowed;">${t('stock_out')}</button>`;
    }

    modalContent.innerHTML = `
        <div class="modal-body">
            <!-- Left: Image Section -->
            <div class="modal-image-col">
                <div class="modal-image-container">
                    <img id="modalMainImage" class="modal-main-image" src="${imgPack}" alt="${loc(product, 'name')}">
                </div>
                <!-- Thumbnails Strip -->
                <div class="thumbnail-strip">
                    <div class="thumb-btn active" onclick="switchModalImage(this, '${imgPack}')">
                        <img src="${imgPack}" alt="Packaging">
                    </div>
                    <div class="thumb-btn" onclick="switchModalImage(this, '${imgContent}')">
                        <img src="${imgContent}" alt="Content">
                    </div>
                </div>
            </div>

            <!-- Right: Info Section -->
            <div class="modal-info-col">
                <div class="modal-category">${categoryName}</div>
                <h2 class="modal-title">${loc(product, 'name')}</h2>
                
                <div class="modal-price-block">
                    <span class="modal-price">${product.price} ${t('price_currency')}</span>
                    <span class="modal-weight">/ ${product.weight}</span>
                </div>
                
                <!-- Stock Status -->
                <div style="margin-bottom:1rem; font-weight:600; color: ${avail > 0 ? '#2e7d32' : '#d32f2f'};">
                    ${avail > 0 ? `${t('stock_in')}: ${avail}` : t('stock_out')}
                </div>

                <div class="modal-description">
                    ${loc(product, 'description') || 'No description available.'}
                </div>

                <div class="product-page-actions modal-share-actions" style="margin-bottom:1rem;">
                    <a href="${productPageUrl}" class="cta-btn">${t('view_product_page')}</a>
                    <button id="copyProductLink" type="button" class="secondary-pill">${t('copy_link')}</button>
                </div>
                <div id="copyStatus" class="product-share-status"></div>
                
                ${btnHtml}
                <div id="buyStatus" class="product-share-status"></div>

                <!-- Product Details Table -->
                <h3 style="font-size:1.1rem; margin-top:1.5rem; margin-bottom:0.5rem; font-weight:700;">${t('product_details')}</h3>
                <div class="modal-meta-box">
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
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    syncBodyScroll();

    const copyBtn = document.getElementById('copyProductLink');
    const copyStatus = document.getElementById('copyStatus');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const shareUrl = new URL(productPageUrl, window.location.href).toString();

            try {
                await navigator.clipboard.writeText(shareUrl);
                if (copyStatus) copyStatus.textContent = t('link_copied');
            } catch (error) {
                if (copyStatus) copyStatus.textContent = shareUrl;
            }
        });
    }

    const buyNowBtn = document.getElementById('buyNowBtn');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const openCartBtn = document.getElementById('openCartBtn');
    const statusDiv = document.getElementById('buyStatus');
    const getSelectedQuantity = () => {
        const quantity = Number.parseInt(document.getElementById('modalQuantity')?.value || '1', 10);
        return Math.max(1, quantity || 1);
    };
    const tryAddProductToCart = (openCartAfter = false) => {
        const requestedQuantity = getSelectedQuantity();
        const available = getAvailableStock(product.id);
        const currentInCart = getCartQuantity(product.id);
        const nextTotal = currentInCart + requestedQuantity;

        if (nextTotal > available) {
            if (statusDiv) statusDiv.textContent = buildAvailabilityMessage(loc(product, 'name'), available);
            return false;
        }

        cart = addCartItem(cart, product.id, requestedQuantity);
        persistCart();
        setCartNotice('');

        if (openCartAfter) {
            closeModalFn();
            openCartModal();
        } else if (statusDiv) {
            statusDiv.textContent = t('added_to_cart');
        }

        return true;
    };

    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
            tryAddProductToCart(true);
        });
    }

    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', () => {
            tryAddProductToCart(false);
        });
    }

    if (openCartBtn) {
        openCartBtn.addEventListener('click', () => {
            closeModalFn();
            openCartModal();
        });
    }
}

async function handleCheckoutSubmit(event) {
    event.preventDefault();

    reconcileCartWithInventory({ shouldNotify: true });
    const deliveryMethod = getSelectedDeliveryMethod();
    const totals = calculateCartTotals(cart, products, deliveryMethod, checkoutSettings);
    const name = document.getElementById('checkoutName')?.value.trim() || '';
    const phone = document.getElementById('checkoutPhone')?.value.trim() || '';
    const address = document.getElementById('checkoutAddress')?.value.trim() || '';
    const notes = document.getElementById('checkoutNotes')?.value.trim() || '';
    const submitBtn = document.getElementById('cartCheckoutBtn');

    if (!totals.items.length) return;
    if (!name) return alert(t('checkout_name_required'));
    if (!phone) return alert(t('checkout_phone_required'));
    if (deliveryMethod === 'delivery' && !address) return alert(t('checkout_address_required'));

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
    }

    try {
        const createOrder = httpsCallable(functions, 'createOrder');
        const result = await createOrder({
            companyId: getCurrentCompanyId(),
            dateStr: todayStr,
            items: totals.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity
            })),
            customer: {
                name,
                phone,
                address,
                notes
            },
            fulfillment: {
                method: deliveryMethod
            }
        });

        cart = clearCart();
        renderCart();
        if (cartCheckoutForm) cartCheckoutForm.reset();
        closeCartModalFn();
        closeModalFn();
        setupPaymentModal(result.data);
    } catch (error) {
        console.error('Checkout Error:', error);
        alert(error.message || error);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = t('place_order');
        }
    }
}

// --- PAYMENT MODAL LOGIC ---
function setupPaymentModal(orderData) {
    const payModal = document.getElementById('paymentModal');
    const methodsContainer = document.getElementById('paymentMethodsContainer');
    const contentDiv = document.getElementById('paymentContent');
    const timerEl = document.getElementById('paymentTimer');
    const btnConfirm = document.getElementById('btnConfirmPayment');
    const btnCancel = document.getElementById('btnCancelPayment');

    if (!payModal) return;

    if (pendingOrder && pendingOrder.timerInterval) clearInterval(pendingOrder.timerInterval);

    pendingOrder = {
        ...orderData,
        paymentMethodId: null,
        timerInterval: null
    };

    renderPaymentSummary();

    // Render Methods Tabs
    if (paymentMethods.length === 0) {
        methodsContainer.innerHTML = `<p style="color:red;">${t('no_payment_methods')}</p>`;
        btnConfirm.disabled = true;
    } else {
        methodsContainer.innerHTML = '';
        const tabsDiv = document.createElement('div');
        tabsDiv.style.display = 'flex';
        tabsDiv.style.gap = '5px';
        tabsDiv.style.marginBottom = '10px';
        tabsDiv.style.justifyContent = 'center';

        paymentMethods.forEach((pm, idx) => {
            const btn = document.createElement('button');
            btn.textContent = pm.name;
            btn.className = 'filter-pill'; // Reuse styled pill
            if (idx === 0) btn.classList.add('active');
            btn.onclick = () => showPaymentDetails(pm, contentDiv);
            tabsDiv.appendChild(btn);
        });
        methodsContainer.appendChild(tabsDiv);

        // Show first method
        showPaymentDetails(paymentMethods[0], contentDiv);
        btnConfirm.disabled = false;
    }

    // Start Timer
    updateTimerDisplay(getSecondsRemaining(), timerEl);
    pendingOrder.timerInterval = setInterval(() => {
        const secondsRemaining = getSecondsRemaining();
        updateTimerDisplay(secondsRemaining, timerEl);
        if (secondsRemaining <= 0) {
            cancelPayment(true); // Auto cancel on timeout
        }
    }, 1000);

    // Bind Buttons
    btnConfirm.onclick = () => confirmPayment();
    btnCancel.onclick = () => cancelPayment(false);

    payModal.style.display = 'flex';
    syncBodyScroll();
}

function renderPaymentSummary() {
    if (!paymentOrderSummary || !pendingOrder) return;

    const trackingUrl = buildOrderTrackingUrl(pendingOrder.orderId, pendingOrder.orderToken);

    paymentOrderSummary.innerHTML = `
        <div class="cart-summary-row">
            <span>${t('order_summary')}</span>
            <strong>#${pendingOrder.orderId}</strong>
        </div>
        <div class="cart-summary-row">
            <span>${t('subtotal')}</span>
            <strong>${formatPrice(pendingOrder.subtotal)} ${t('price_currency')}</strong>
        </div>
        <div class="cart-summary-row">
            <span>${t('delivery_fee')}</span>
            <strong>${pendingOrder.deliveryFee === 0 ? t('free_delivery') : `${formatPrice(pendingOrder.deliveryFee)} ${t('price_currency')}`}</strong>
        </div>
        <div class="cart-summary-row total">
            <span>${t('total')}</span>
            <strong>${formatPrice(pendingOrder.total)} ${t('price_currency')}</strong>
        </div>
        <div style="margin-top:0.75rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
            <a href="${trackingUrl}" class="secondary-pill" style="text-decoration:none;">Track Order</a>
            <button type="button" id="copyTrackingLinkBtn" class="secondary-pill">Copy Tracking Link</button>
        </div>
    `;

    const copyTrackingLinkBtn = document.getElementById('copyTrackingLinkBtn');
    if (copyTrackingLinkBtn) {
        copyTrackingLinkBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(trackingUrl);
                copyTrackingLinkBtn.textContent = 'Tracking Link Copied';
            } catch (error) {
                copyTrackingLinkBtn.textContent = 'Copy Failed';
            }
        };
    }
}

function showPaymentDetails(pm, container) {
    if (pendingOrder) pendingOrder.paymentMethodId = pm.id;
    container.innerHTML = `
        <div style="margin-bottom:1rem;">
             ${pm.qrUrl ? `<img src="${pm.qrUrl}" style="max-width:200px; border:1px solid #ccc; padding:5px;">` : ''}
        </div>
        <div style="font-size:1.1rem; font-weight: bold;">${pm.number || ''}</div>
        <div>${pm.accountName || ''}</div>
        <div style="font-size:0.9rem; color:#666; margin-top:5px;">${t('payment_instructions') || 'Scan QR code to pay'}</div>
    `;
    // Update active tab style
    const tabs = document.getElementById('paymentMethodsContainer').querySelectorAll('button');
    tabs.forEach(t => {
        if (t.textContent === pm.name) t.classList.add('active');
        else t.classList.remove('active');
    });
}

function updateTimerDisplay(seconds, el) {
    const safeSeconds = Math.max(0, seconds);
    const m = Math.floor(safeSeconds / 60);
    const s = safeSeconds % 60;
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function getSecondsRemaining() {
    if (!pendingOrder?.expiresAtMillis) return 0;
    return Math.max(0, Math.floor((pendingOrder.expiresAtMillis - Date.now()) / 1000));
}

async function confirmPayment() {
    const btn = document.getElementById('btnConfirmPayment');
    const fileInput = document.getElementById('paymentProof');
    if (!pendingOrder) return;

    if (!fileInput.files[0]) return alert("Please upload a payment receipt screenshot.");

    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
        const file = fileInput.files[0];
        const storageRef = ref(storage, `order_receipts/${pendingOrder.orderId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);

        const submitPaymentProof = httpsCallable(functions, 'submitPaymentProof');
        await submitPaymentProof({
            orderId: pendingOrder.orderId,
            orderToken: pendingOrder.orderToken,
            paymentMethodId: pendingOrder.paymentMethodId,
            receiptPath: storageRef.fullPath
        });

        const trackingUrl = buildOrderTrackingUrl(pendingOrder.orderId, pendingOrder.orderToken);
        closePaymentModal();
        alert(t('payment_submitted'));
        window.location.href = trackingUrl;
        renderAll();

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.innerText = "Confirm Paid";
    }
}

async function cancelPayment(isTimeout = false) {
    if (!pendingOrder) return;

    if (!isTimeout && !confirm("Cancel this order and release the reserved stock?")) return;

    try {
        const cancelOrder = httpsCallable(functions, 'cancelOrder');
        await cancelOrder({
            orderId: pendingOrder.orderId,
            orderToken: pendingOrder.orderToken,
            reason: isTimeout ? 'timeout' : 'user_cancelled'
        });

        closePaymentModal();
        if (isTimeout) alert("Order expired. Stock released.");
        renderAll();

    } catch (e) {
        console.error("Cancel Error:", e);
    }
}

function closePaymentModal() {
    if (pendingOrder?.timerInterval) {
        clearInterval(pendingOrder.timerInterval);
    }
    pendingOrder = null;

    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) paymentModal.style.display = 'none';
    const proofInput = document.getElementById('paymentProof');
    if (proofInput) proofInput.value = '';
    syncBodyScroll();
}

window.switchModalImage = (btn, src) => {
    document.getElementById('modalMainImage').src = src;
    document.querySelectorAll('.thumb-btn, .photo-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

// Start
init();
