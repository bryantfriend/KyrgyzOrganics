import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- STATE ---
let currentLang = localStorage.getItem('site_lang') || 'ru'; // Default RU
let products = [];
let bannerData = [];
let categories = [];
let categoriesMap = {}; // ID -> Data

// --- TRANSLATIONS (Static UI) ---
const translations = {
    ru: { title: "Кыргыз Органик", home: "Главная", products: "Продукты", categories: "Категории", about: "О нас", contact: "Контакты", search: "Поиск продуктов...", all: "Все продукты", hits: "Хиты продаж 🔥", hit: "Хит", full_catalog: "Полный каталог", recommended: "С этим покупают", delivery_title: "Бесплатная доставка", delivery_text: "По Бишкеку и окрестностям", invest_title: "Инвестируйте в Бискотти", invest_text: "Поддержите местное производство и получайте доход.", learn_more: "Подробнее", ingredients: "Состав:", storage: "Хранение:", price_currency: "с", no_products_found: "Продукты не найдены." },
    en: { title: "Kyrgyz Organic", home: "Home", products: "Products", categories: "Categories", about: "About", contact: "Contact", search: "Search products...", all: "All Products", hits: "Top Sellers 🔥", hit: "Hit", full_catalog: "Full Catalog", recommended: "Frequently Bought Together", delivery_title: "Free Delivery", delivery_text: "In Bishkek and nearby areas", invest_title: "Invest in Biscotti", invest_text: "Support local production and earn returns.", learn_more: "Learn More", ingredients: "Ingredients:", storage: "Storage:", price_currency: "KGS", no_products_found: "No products found." },
    kg: { title: "Кыргыз Органик", home: "Башкы бет", products: "Продукциялар", categories: "Категориялар", about: "Биз жөнүндө", contact: "Байланыш", search: "Издөө...", all: "Бардык продуктылар", hits: "Эң көп сатылган 🔥", hit: "Хит", full_catalog: "Толук каталог", recommended: "Көбүнчө чогуу алышат", delivery_title: "Акысыз жеткирүү", delivery_text: "Бишкек жана айланасына", invest_title: "Бискоттиге инвестиция", invest_text: "Жергиликтүү өндүрүштү колдоп, киреше табыңыз.", learn_more: "Кененирээк", ingredients: "Курамы:", storage: "Сактоо:", price_currency: "сом", no_products_found: "Продуктылар табылган жок." }
};

// DOM Elements
const productGrid = document.getElementById('productGrid');
const featuredGrid = document.getElementById('featuredGrid');
// const recommendedGrid = document.getElementById('recommendedGrid'); // Removed
const searchInput = document.getElementById('searchInput');
const filterList = document.getElementById('categoryFilters');
const modal = document.getElementById('productModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');
const heroCarousel = document.querySelector('.hero-carousel');
const langToggle = document.querySelector('.lang-toggle');

// Helper: Get Localized String
function t(key) {
    return translations[currentLang][key] || translations['ru'][key] || key;
}

// Helper: Get Localized Data Field
function loc(item, field) {
    return item[`${field}_${currentLang}`] || item[`${field}_ru`] || item[field] || ''; // Fallback chain
}

// --- INIT ---
async function init() {
    setupLanguage();
    await loadData();
    renderAll();
    setupEventListeners();
}

function setupLanguage() {
    // Render Language Toggle
    langToggle.innerHTML = `
        <span class="${currentLang === 'en' ? 'active' : ''}" onclick="setLang('en')">EN</span> / 
        <span class="${currentLang === 'ru' ? 'active' : ''}" onclick="setLang('ru')">RU</span> / 
        <span class="${currentLang === 'kg' ? 'active' : ''}" onclick="setLang('kg')">KG</span>
    `;

    // Update critical static text based on existing IDs
    document.getElementById('searchInput').placeholder = t('search');
}

window.setLang = (lang) => {
    currentLang = lang;
    localStorage.setItem('site_lang', lang);
    location.reload();
};

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

        bannerData = bRes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (e) {
        console.error("Error loading data:", e);
        if (e.code === 'permission-denied' || e.code === 'failed-precondition') {
            productGrid.innerHTML = '<p style="color: red; padding: 2rem;">Error: Check Firebase Config.</p>';
        }
    }
}

function renderAll() {
    renderCategories();
    renderBanner();
    renderFeatured();
    renderProducts(products);
    // renderRecommended(); // Removed
    updateStaticUI();
}

function updateStaticUI() {
    const sectionTitles = document.querySelectorAll('.section-title');
    if (sectionTitles[0]) sectionTitles[0].textContent = t('hits');
    if (sectionTitles[1]) sectionTitles[1].textContent = t('full_catalog');
    // if (sectionTitles[2]) sectionTitles[2].textContent = t('recommended'); // Removed

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
    if (!bannerData.length) return;
    const slide = bannerData[0];
    const slideHtml = `
        <div class="hero-slide" style="background-image: url('${slide.imageUrl || ''}');">
            <div class="hero-overlay">
                <h1 class="hero-title">${loc(slide, 'title')}</h1>
                <p class="hero-subtitle">${loc(slide, 'subtitle')}</p>
            </div>
        </div>
    `;
    heroCarousel.innerHTML = slideHtml;
}

function renderCategories() {
    let html = `<li><button class="filter-pill active" data-category="all">${t('all')}</button></li>`;
    categories.forEach(cat => {
        const style = `background-color: ${cat.style_bg || '#f8f9fa'}; color: ${cat.style_color || '#333'}; border-color: ${cat.style_border || 'transparent'};`;
        html += `<li><button class="filter-pill" style="${style}" data-category="${cat.id}">${loc(cat, 'name')}</button></li>`;
    });
    filterList.innerHTML = html;
}

function renderFeatured() {
    const hits = products.filter(p => p.isFeatured);
    featuredGrid.innerHTML = '';
    const itemsToShow = hits.length > 0 ? hits : products.slice(0, 4);
    itemsToShow.forEach(product => {
        const card = createCard(product, t('hit'));
        featuredGrid.appendChild(card);
    });
}

function renderProducts(data) {
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

// Removed renderRecommended()

function setupEventListeners() {
    filterList.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill')) {
            const btn = e.target;
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const catId = btn.dataset.category;
            if (catId === 'all') {
                renderProducts(products);
            } else {
                const filtered = products.filter(p => p.categoryId === catId);
                renderProducts(filtered);
            }
        }
    });

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = products.filter(p =>
            loc(p, 'name').toLowerCase().includes(term)
        );
        renderProducts(filtered);
    });

    closeModal.addEventListener('click', closeModalFn);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModalFn(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModalFn(); });
}

function closeModalFn() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openModal(product) {
    const isMobile = window.innerWidth < 768;
    const categoryName = categoriesMap[product.categoryId] ? loc(categoriesMap[product.categoryId], 'name') : (product.category || 'Other');

    modalContent.innerHTML = `
        <div style="display: flex; flex-direction: ${isMobile ? 'column' : 'row'}; gap: 2rem;">
            <div style="flex: 1;">
                <img src="${product.imageUrl || 'https://placehold.co/400x300'}" style="width: 100%; border-radius: 8px; object-fit: cover; aspect-ratio: 4/3;" alt="${loc(product, 'name')}">
            </div>
            <div style="flex: 1;">
                <div style="color: var(--color-primary); font-size: 0.9rem; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">${categoryName}</div>
                <h2 style="margin-bottom: 1rem; line-height: 1.2;">${loc(product, 'name')}</h2>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-accent); margin-bottom: 1.5rem;">${product.price} ${t('price_currency')} <span style="font-size: 1rem; color: #777; font-weight: 400;">/ ${product.weight}</span></div>

                <p style="color: #555; margin-bottom: 1.5rem; line-height: 1.6;">${loc(product, 'description')}</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;">
                <div style="margin-bottom: 2rem;">
                     <span><strong>${t('storage')}</strong> Store in a cool, dry place.</span>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

init();
