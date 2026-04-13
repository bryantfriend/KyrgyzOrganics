import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initMobileMenu, loc, setupLanguage, t } from './common.js';
import { buildProductPageUrl } from './product-utils.js';
import { addCartItem, loadCart, saveCart, saveCartDay } from './shop-utils.js';
import { COMPANY_ID, matchesCompanyId } from './company-config.js';
import { getInventoryDocId } from './firestore-paths.js';

const root = document.getElementById('productPageRoot');

let categoriesMap = {};
let dailyInventory = {};

async function init() {
    setupLanguage();
    initMobileMenu();

    await Promise.all([loadCategories(), loadInventory()]);
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
    const snap = await getDocs(collection(db, 'categories'));
    snap.forEach((docSnap) => {
        const category = { id: docSnap.id, ...docSnap.data() };
        if (!matchesCompanyId(category, `categories/${category.id}`)) return;
        categoriesMap[docSnap.id] = category;
    });
}

async function loadInventory() {
    const today = getTodayKey();
    const invId = getInventoryDocId(COMPANY_ID, today);
    let invSnap = await getDoc(doc(db, 'inventory', invId));
    if (!invSnap.exists()) {
        invSnap = await getDoc(doc(db, 'inventory', today));
    }
    if (invSnap.exists()) {
        const inventoryData = invSnap.data();
        if (inventoryData.companyId && inventoryData.companyId !== COMPANY_ID) {
            console.warn('Inventory companyId mismatch:', getTodayKey());
            dailyInventory = {};
        } else {
            if (!inventoryData.companyId) console.warn('Inventory missing companyId:', getTodayKey());
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
            if (productData.companyId && productData.companyId !== COMPANY_ID) {
                console.warn('Product companyId mismatch:', productId);
                return null;
            }
            if (!productData.companyId) console.warn('Product missing companyId:', productId);
            return { id: productDoc.id, ...productData };
        }
    }

    return null;
}

function renderMissingState() {
    root.innerHTML = `
        <a href="index.html" class="text-link-inline">${t('back_to_catalog')}</a>
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
    const cartUrl = new URL('index.html', window.location.href);
    cartUrl.searchParams.set('cart', 'open');
    const shareUrl = new URL(buildProductPageUrl(product), window.location.origin + window.location.pathname.replace(/[^/]+$/, '')).toString();
    const imagePack = product.imageUrl || 'https://placehold.co/800x600?text=Packaging';
    const imageContent = product.imageNoPackagingUrl || imagePack;

    root.innerHTML = `
        <nav class="product-breadcrumbs">
            <a href="index.html">${t('home')}</a>
            <span>/</span>
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
                <a href="index.html" class="text-link-inline">${t('back_to_catalog')}</a>
                <div class="modal-category" style="margin-top:1rem;">${categoryName}</div>
                <h1 class="product-page-title">${loc(product, 'name')}</h1>
                <div class="product-page-price-row">
                    <span class="modal-price">${product.price} ${t('price_currency')}</span>
                    <span class="modal-weight">/ ${product.weight || ''}</span>
                </div>
                <div class="product-stock ${isInStock ? 'in-stock' : 'sold-out'}">
                    ${isInStock ? `${t('stock_in')}${stock !== null ? `: ${stock}` : ''}` : t('stock_out')}
                </div>
                <p class="product-page-description">${loc(product, 'description') || 'No description available.'}</p>

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
            const cartUrl = new URL('index.html', window.location.href);
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

function updateMeta(product) {
    const name = loc(product, 'name');
    const description = loc(product, 'description') || 'Organic product from Kyrgyz Organic.';
    document.title = `${name} | OA Kyrgyz Organic`;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
        descriptionMeta.setAttribute('content', description);
    }
}

init();
