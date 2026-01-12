import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { storage } from './firebase-config.js';
import { $, $$, t, loc, setupLanguage, currentLang, initMobileMenu } from './common.js';

// --- STATE ---
let products = [];
let bannerData = [];
let categories = [];
let categoriesMap = {}; // ID -> Data
let dailyInventory = {}; // { prodId: { available, sold } }
let todayStr = "";
let paymentMethods = [];
let pendingOrder = null; // { orderId, prodId, expiresAt, timerInterval }

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
        const [pRes, cRes, bRes, pmRes] = await Promise.all([
            getDocs(query(collection(db, "products"), where("active", "==", true))),
            getDocs(query(collection(db, "categories"), where("active", "==", true))),
            getDocs(collection(db, "banners")),
            getDocs(query(collection(db, "payment_methods"), where("active", "==", true)))
        ]);

        // Calc Today YYYY-MM-DD (Local)
        const localNow = new Date();
        const y = localNow.getFullYear();
        const m = String(localNow.getMonth() + 1).padStart(2, '0');
        const d = String(localNow.getDate()).padStart(2, '0');
        todayStr = `${y}-${m}-${d}`;

        // Fetch Inventory
        const invSnap = await getDoc(doc(db, 'inventory', todayStr));
        if (invSnap.exists()) {
            dailyInventory = invSnap.data();
        } else {
            dailyInventory = {};
        }

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

        // Payment Methods
        paymentMethods = pmRes.docs.map(d => ({ id: d.id, ...d.data() }));

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
    // renderRecommended();
    updateStaticUI();
}

function updateStaticUI() {
    const sectionTitles = document.querySelectorAll('.section-title');
    if (sectionTitles[0]) sectionTitles[0].textContent = t('hits');
    if (sectionTitles[1]) sectionTitles[1].textContent = t('full_catalog');
    // if (sectionTitles[2]) sectionTitles[2].textContent = t('recommended');

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

    // Simple Carousel Logic
    let currentSlide = 0;
    const slides = heroCarousel.querySelectorAll('.carousel-slide');
    const dots = heroCarousel.querySelectorAll('.dot');

    if (slides.length > 1) {
        setInterval(() => {
            slides[currentSlide].classList.remove('is-active');
            if (dots[currentSlide]) dots[currentSlide].classList.remove('is-active');

            currentSlide = (currentSlide + 1) % slides.length;

            slides[currentSlide].classList.add('is-active');
            if (dots[currentSlide]) dots[currentSlide].classList.add('is-active');
        }, 5000);
    }
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

    // Inventory Badge Logic
    const inv = dailyInventory[product.id];
    const avail = inv ? (inv.available || 0) : 0;

    let badgeHtml = '';

    if (avail === 0) {
        badgeHtml = `<div class="delivery-badge" style="background:#e53935;">${t('sold_out') || 'Sold Out'}</div>`;
    } else if (avail < 5) {
        badgeHtml = `<div class="delivery-badge" style="background:#fb8c00;">${t('only_left') || 'Only'} ${avail}</div>`;
    } else if (tag) {
        badgeHtml = `<div class="delivery-badge">${tag}</div>`;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
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
                <span class="product-price">${product.price} ${t('price_currency')}</span>
            </div>
        </div>
    `;
    card.addEventListener('click', () => openModal(product));
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

    // Inventory Info
    const inv = dailyInventory[product.id];
    const avail = inv ? (inv.available || 0) : 0;

    let btnHtml = '';
    if (avail > 0) {
        btnHtml = `<button id="buyBtn" class="cta-btn" style="width:100%; margin-top:1rem;">${t('buy_now') || 'Buy Now'}</button>`;
    } else {
        btnHtml = `<button disabled class="cta-btn" style="width:100%; margin-top:1rem; background:#ccc; cursor:not-allowed;">${t('sold_out') || 'Sold Out'}</button>`;
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
                    ${avail > 0 ? `In Stock: ${avail}` : 'Sold Out'}
                </div>

                <div class="modal-description">
                    ${loc(product, 'description') || 'No description available.'}
                </div>
                
                ${btnHtml}
                <div id="buyStatus" style="margin-top:0.5rem; font-size:0.9rem;"></div>

                <!-- Product Details Table -->
                <h3 style="font-size:1.1rem; margin-top:1.5rem; margin-bottom:0.5rem; font-weight:700;">Product Details</h3>
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

    // Attach Listener
    const buyBtn = document.getElementById('buyBtn');
    if (buyBtn) {
        buyBtn.addEventListener('click', () => handleBuy(product));
    }
}

async function handleBuy(product) {
    const buyBtn = document.getElementById('buyBtn');
    const statusDiv = document.getElementById('buyStatus');
    if (buyBtn) buyBtn.disabled = true;
    if (statusDiv) statusDiv.innerHTML = '<span style="color:#666;">Checking stock...</span>';

    try {
        // Call Cloud Function to Reserve Stock & Create Order
        const reserveOrder = httpsCallable(functions, 'reserveOrder');
        const result = await reserveOrder({
            productId: product.id,
            dateStr: todayStr
        });

        const orderId = result.data.orderId;

        // Optimistic UI Update
        if (dailyInventory[product.id]) {
            dailyInventory[product.id].available--;
            dailyInventory[product.id].sold++;
        }

        // Open Payment Modal
        closeModalFn(); // Close product modal
        setupPaymentModal(product, orderId);

    } catch (e) {
        console.error("Buy Error:", e);
        if (buyBtn) buyBtn.disabled = false;
        if (statusDiv) statusDiv.innerHTML = `<span style="color:red;">Error: ${e.message || e}</span>`;
    }
}

// --- PAYMENT MODAL LOGIC ---
function setupPaymentModal(product, orderId) {
    const payModal = document.getElementById('paymentModal');
    const methodsContainer = document.getElementById('paymentMethodsContainer');
    const contentDiv = document.getElementById('paymentContent');
    const timerEl = document.getElementById('paymentTimer');
    const btnConfirm = document.getElementById('btnConfirmPayment');
    const btnCancel = document.getElementById('btnCancelPayment');

    if (!payModal) return;

    // Reset State
    let timeLeft = 600; // 10 mins
    if (pendingOrder && pendingOrder.timerInterval) clearInterval(pendingOrder.timerInterval);

    pendingOrder = { orderId, prodId: product.id, interval: null };

    // Render Methods Tabs
    if (paymentMethods.length === 0) {
        methodsContainer.innerHTML = '<p style="color:red;">No payment methods available. Contact Admin.</p>';
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
    }

    // Start Timer
    updateTimerDisplay(timeLeft, timerEl);
    pendingOrder.timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft, timerEl);
        if (timeLeft <= 0) {
            cancelPayment(true); // Auto cancel on timeout
        }
    }, 1000);

    // Bind Buttons
    btnConfirm.onclick = () => confirmPayment();
    btnCancel.onclick = () => cancelPayment(false);

    payModal.style.display = 'flex';
}

function showPaymentDetails(pm, container) {
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
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

async function confirmPayment() {
    const btn = document.getElementById('btnConfirmPayment');
    const fileInput = document.getElementById('paymentProof');

    if (!fileInput.files[0]) return alert("Please upload a payment receipt screenshot.");

    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
        const file = fileInput.files[0];
        const storageRef = ref(storage, `receipts/${todayStr}/${pendingOrder.orderId}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        // Update Order
        await updateDoc(doc(db, 'orders', pendingOrder.orderId), {
            status: 'pending_verification', // or 'paid' if we trust them 100%
            receiptUrl: url,
            paidAt: serverTimestamp()
        });

        clearInterval(pendingOrder.timerInterval);
        document.getElementById('paymentModal').style.display = 'none';
        alert("Payment Submitted! We will verify and process your order.");
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

    if (!isTimeout && !confirm("Cancel purchase and release stock?")) return;

    const { orderId, prodId } = pendingOrder;
    clearInterval(pendingOrder.timerInterval);
    document.getElementById('paymentModal').style.display = 'none';

    try {
        await runTransaction(db, async (transaction) => {
            const invRef = doc(db, 'inventory', todayStr);
            const invDoc = await transaction.get(invRef);
            if (!invDoc.exists()) return;

            // Release Stock
            const currentAvail = invDoc.data()[prodId]?.available || 0;
            const currentSold = invDoc.data()[prodId]?.sold || 0;

            transaction.update(invRef, {
                [`${prodId}.available`]: currentAvail + 1,
                [`${prodId}.sold`]: Math.max(0, currentSold - 1)
            });

            transaction.update(doc(db, 'orders', orderId), {
                status: 'cancelled',
                cancelledAt: serverTimestamp(),
                reason: isTimeout ? 'timeout' : 'user_cancelled'
            });

            // Revert local state
            if (dailyInventory[prodId]) {
                dailyInventory[prodId].available++;
                dailyInventory[prodId].sold--;
            }
        });

        if (isTimeout) alert("Order expired. Stock released.");
        renderAll();

    } catch (e) {
        console.error("Cancel Error:", e);
    }
}

window.switchModalImage = (btn, src) => {
    document.getElementById('modalMainImage').src = src;
    document.querySelectorAll('.thumb-btn, .photo-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

// Start
init();
