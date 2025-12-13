import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Data Containers
let products = [];
let bannerData = [];
let categories = [];

// DOM Elements
const productGrid = document.getElementById('productGrid');
const featuredGrid = document.getElementById('featuredGrid');
const recommendedGrid = document.getElementById('recommendedGrid');
const searchInput = document.getElementById('searchInput');
const filterList = document.getElementById('categoryFilters');
const modal = document.getElementById('productModal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');
const heroCarousel = document.querySelector('.hero-carousel');

// Init
async function init() {
    await loadData();
    renderCategories(); // Render dynamic category pills
    setupEventListeners(); // Re-attach listeners to new elements
    renderFeatured();
    renderProducts(products);
    renderRecommended();
    renderBanner();
}

async function loadData() {
    try {
        const [pRes, cRes, bRes] = await Promise.all([
            getDocs(query(collection(db, "products"), where("active", "==", true))),
            getDocs(query(collection(db, "categories"), where("active", "==", true), orderBy("name"))),
            getDocs(collection(db, "banners"))
        ]);

        products = pRes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        categories = cRes.docs.map(doc => doc.data().name); // Just extracting names for compatibility
        bannerData = bRes.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } catch (e) {
        console.error("Error loading data from Firebase:", e);
        // Fallback for demo if firebase fails (e.g. invalid config)
        if (e.code === 'permission-denied' || e.code === 'failed-precondition') {
            productGrid.innerHTML = '<p style="color: red; padding: 2rem;">Error: Check Firebase Config.</p>';
        }
    }
}

function renderBanner() {
    if (!bannerData.length) return;
    // Just showing first slide for now to keep it simple as per original implementation
    const slide = bannerData[0];
    const slideHtml = `
        <div class="hero-slide">
            <h1 class="hero-title">${slide.title}</h1>
            <p class="hero-subtitle">${slide.subtitle}</p>
        </div>
    `;
    heroCarousel.innerHTML = slideHtml;
}

function renderCategories() {
    // Keep "All" button
    let html = '<li><button class="filter-pill active" data-category="all">All Products</button></li>';
    categories.forEach(cat => {
        html += `<li><button class="filter-pill" data-category="${cat}">${cat}</button></li>`;
    });
    filterList.innerHTML = html;
}

// Render Featured
function renderFeatured() {
    // Filter by isFeatured flag
    const hits = products.filter(p => p.isFeatured);
    featuredGrid.innerHTML = '';

    // If no featured, maybe fallback to first few?
    const itemsToShow = hits.length > 0 ? hits : products.slice(0, 4);

    itemsToShow.forEach(product => {
        // Pass 'Hit' as tag
        const card = createCard(product, 'Hit 🔥');
        featuredGrid.appendChild(card);
    });
}

// Render Products
function renderProducts(data) {
    productGrid.innerHTML = '';

    if (data.length === 0) {
        productGrid.innerHTML = '<p class="no-results" style="grid-column: 1/-1; text-align: center; color: #777; padding: 2rem;">No products found matching your selection.</p>';
        return;
    }

    data.forEach(product => {
        const card = createCard(product);
        productGrid.appendChild(card);
    });
}

function createCard(product, tag = 'Available') {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <div class="delivery-badge">${tag}</div>
        <div class="product-image">
            <img src="${product.imageUrl || 'https://placehold.co/400x300'}" alt="${product.name}">
        </div>
        <div class="product-info">
            <div class="product-category">${product.category}</div>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-meta">
                <span class="product-weight">${product.weight}</span>
                <span class="product-price">${product.price}</span>
            </div>
        </div>
    `;
    card.addEventListener('click', () => openModal(product));
    return card;
}

// Render Recommended (Simulated)
function renderRecommended() {
    // Just show first 4 random products
    const recs = products.slice(0, 4);
    recommendedGrid.innerHTML = '';
    recs.forEach(product => {
        const card = createCard(product, 'Top Pick');
        recommendedGrid.appendChild(card);
    });
}

// Filter Logic
function setupEventListeners() {
    // Delegated Category Filters (since buttons are now dynamic)
    filterList.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill')) {
            const btn = e.target;

            // Remove active from all
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Filter
            const category = btn.dataset.category;
            if (category === 'all') {
                renderProducts(products);
            } else {
                const filtered = products.filter(p => p.category === category);
                renderProducts(filtered);
            }
        }
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.category.toLowerCase().includes(term)
        );
        renderProducts(filtered);
    });

    // Modal
    closeModal.addEventListener('click', () => {
        closeModalFn();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalFn();
        }
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModalFn();
        }
    });
}

function closeModalFn() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Modal Logic
function openModal(product) {
    // Responsive modal layout
    const isMobile = window.innerWidth < 768;

    modalContent.innerHTML = `
        <div style="display: flex; flex-direction: ${isMobile ? 'column' : 'row'}; gap: 2rem;">
            <div style="flex: 1;">
                <img src="${product.imageUrl || 'https://placehold.co/400x300'}" style="width: 100%; border-radius: 8px; object-fit: cover; aspect-ratio: 4/3;" alt="${product.name}">
            </div>
            <div style="flex: 1;">
                <div style="color: var(--color-primary); font-size: 0.9rem; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">${product.category}</div>
                <h2 style="margin-bottom: 1rem; line-height: 1.2;">${product.name}</h2>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-accent); margin-bottom: 1.5rem;">${product.price} <span style="font-size: 1rem; color: #777; font-weight: 400;">/ ${product.weight}</span></div>

                <p style="color: #555; margin-bottom: 1.5rem; line-height: 1.6;">${product.description}</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;">

                <div style="margin-bottom: 1rem;">
                    <strong>Ingredients:</strong><br>
                    <span style="color: #666;">100% Organic certified ingredients. (Placeholder)</span>
                </div>

                <div style="margin-bottom: 2rem;">
                    <strong>Storage:</strong><br>
                    <span style="color: #666;">Store in a cool, dry place away from direct sunlight.</span>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Disable scroll
}

// Run
init();
