import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, limit, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initMobileMenu, loc, setupLanguage, t } from './common.js';
import { buildProductPageUrl } from './product-utils.js';

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
        categoriesMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
    });
}

async function loadInventory() {
    const invSnap = await getDoc(doc(db, 'inventory', getTodayKey()));
    if (invSnap.exists()) {
        dailyInventory = invSnap.data();
    }
}

async function loadProductFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const productId = params.get('id');

    if (slug) {
        const productQuery = query(collection(db, 'products'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(productQuery);
        if (!snap.empty) {
            const productDoc = snap.docs[0];
            return { id: productDoc.id, ...productDoc.data() };
        }
    }

    if (productId) {
        const productDoc = await getDoc(doc(db, 'products', productId));
        if (productDoc.exists()) {
            return { id: productDoc.id, ...productDoc.data() };
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

                <div class="product-page-actions">
                    <a href="${shareUrl}" class="cta-btn">${t('view_product_page')}</a>
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

    bindPageInteractions(shareUrl);
}

function bindPageInteractions(shareUrl) {
    const copyBtn = document.getElementById('copyProductLink');
    const copyStatus = document.getElementById('copyStatus');
    const imageButtons = root.querySelectorAll('.thumb-btn');
    const mainImage = document.getElementById('detailMainImage');

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
