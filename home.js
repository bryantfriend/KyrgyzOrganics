import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Carousel } from './carousel.js';
import { $, $$, t, loc, setupLanguage, currentLang, initMobileMenu } from './common.js';

// --- STATE ---
let products = [];
let bannerData = [];
let categories = [];
let categoriesMap = {}; // ID -> Data

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

// --- INIT ---
async function init() {
    setupLanguage();
    const closeMenu = initMobileMenu(); // Init shared menu logic

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
    setupEventListeners(closeMenu);
}

async function loadData() {
    try {
        const [pRes, cRes, bRes] = await Promise.all([
            getDocs(query(collection(db, "products"), where("active", "==", true))),
            getDocs(query(collection(db, "categories"), where("active", "==", true))),
            getDocs(collection(db, "banners"))
        ]);

        products = pRes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        categories = [];
        cRes.docs.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            categories.push(data);
            categoriesMap[doc.id] = data;
        });

        categories.sort((a, b) => loc(a, 'name').localeCompare(loc(b, 'name')));

        const now = new Date();

        bannerData = bRes.docs
            .map(d => d.data())
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
    renderFeatured();
    renderProducts(products);
    renderRecommended();
    updateStaticUI();
}

function updateStaticUI() {
    const sectionTitles = document.querySelectorAll('.section-title');
    if (sectionTitles[0]) sectionTitles[0].textContent = t('hits');
    if (sectionTitles[1]) sectionTitles[1].textContent = t('full_catalog');
    if (sectionTitles[2]) sectionTitles[2].textContent = t('recommended');

    const ctaTitle = document.querySelector('.cta-title');
    if (ctaTitle) ctaTitle.textContent = t('invest_title');
    const ctaText = document.querySelector('.cta-text');
    if (ctaText) ctaText.textContent = t('invest_text');
    const ctaBtn = document.querySelector('.cta-btn');
    if (ctaBtn) ctaBtn.textContent = t('learn_more');

    const allBtn = document.querySelector('.filter-pill[data-category="all"]');
    if (allBtn) allBtn.textContent = t('all');
}

function renderBanner() {
    if (!heroCarousel) return;

    heroCarousel.innerHTML = '';

    if (!bannerData.length) {
        heroCarousel.innerHTML = `
          <div style="display:flex; justify-content:center; align-items:center; height:100%; background:#eee; color:#777;">
            No Active Banners
          </div>`;
        return;
    }

    heroCarousel.innerHTML = `
        <div class="carousel-track">
            ${bannerData.map((b, i) => `
                <div class="carousel-slide ${i === 0 ? 'is-active' : ''}">
                    <img src="${b.imageUrl}" class="carousel-image">
                </div>
            `).join('')}
        </div>
        <div class="carousel-dots">
            ${bannerData.map((_, i) => `<button class="dot ${i === 0 ? 'is-active' : ''}"></button>`).join('')}
        </div>
    `;

    new Carousel(heroCarousel, { interval: 5000 });
}

function renderFeatured() {
    if (!featuredGrid) return;
    featuredGrid.innerHTML = '';
    const hits = products.filter(p => p.isFeatured);
    const itemsToShow = hits.length > 0 ? hits : products.slice(0, 4);
    itemsToShow.forEach(product => {
        const card = createCard(product, t('hit'));
        featuredGrid.appendChild(card);
    });
}

function renderProducts(data) {
    if (!productGrid) return;
    productGrid.innerHTML = '';
    if (data.length === 0) {
        productGrid.innerHTML = `<p class="no-results" style="grid-column: 1/-1; text-align: center; color: #777; padding: 2rem;">${t('no_products_found') || 'No products found.'}</p>`;
        return;
    }
    data.forEach(product => {
        const card = createCard(product);
        productGrid.appendChild(card);
    });
}

function createCard(product, tag = '') {
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : (product.category || 'Other');

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        ${tag ? `<div class="delivery-badge">${tag}</div>` : ''}
        <div class="product-image">
            <img src="${product.imageUrl || 'https://placehold.co/400x300'}" alt="${loc(product, 'name')}">
        </div>
        <div class="product-info">
            <div class="product-category">${categoryName}</div>
            <h3 class="product-title">${loc(product, 'name')}</h3>
            <div class="product-meta">
                <span class="product-weight">${product.weight}</span>
                <span class="product-price">${product.price} ${t('price_currency')}</span>
            </div>
        </div>
    `;
    card.addEventListener('click', () => openModal(product));
    return card;
}

function renderRecommended() {
    if (!recommendedGrid) return;
    recommendedGrid.innerHTML = '';
    const recs = products.slice(0, 4);
    recs.forEach(product => {
        const card = createCard(product, '');
        recommendedGrid.appendChild(card);
    });
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

function setupEventListeners(closeMenuFn) {
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

    if (closeModal && modal) {
        closeModal.addEventListener('click', closeModalFn);
        window.addEventListener('click', (e) => { if (e.target === modal) closeModalFn(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModalFn(); });
    }
}

function closeModalFn() {
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openModal(product) {
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : (product.category || 'Other');

    // Default Images
    const imgPack = product.imageUrl || 'https://placehold.co/400x300?text=Packaging';
    const imgContent = product.imageNoPackagingUrl || 'https://placehold.co/400x300?text=No+Packaging';

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

                <div class="modal-description">
                    ${loc(product, 'description') || 'No description available.'}
                </div>

                <!-- Product Details Table -->
                <h3 style="font-size:1.1rem; margin-bottom:0.5rem; font-weight:700;">Product Details</h3>
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
    document.body.style.overflow = 'hidden';
}

window.switchModalImage = (btn, src) => {
    document.getElementById('modalMainImage').src = src;
    document.querySelectorAll('.thumb-btn, .photo-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// Start
init();
