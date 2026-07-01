import { BaseTab } from './BaseTab.js';
import { db, functions, httpsCallable } from '../../firebase-config.js';
import { uploadImage, logAudit } from '../utils.js';
import { buildProductPageUrl, getBusinessPrice, getPreferredProductName, getRetailPrice, slugifyProductName } from '../../product-utils.js';
import { getSelectedCompanyId, matchesSelectedCompany } from '../../store-context.js';
import {
    collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, getDoc, getDocs, serverTimestamp, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class ProductsTab extends BaseTab {
    constructor() {
        super('products');

        this.list = document.getElementById('productList');
        this.form = document.getElementById('productForm');
        this.submitBtn = document.getElementById('pSubmitBtn');
        this.cancelBtn = document.getElementById('pCancelBtn');
        this.formTitle = document.getElementById('prodFormTitle');
        this.pId = document.getElementById('pId');
        this.pSlug = document.getElementById('pSlug');
        this.pPrice = document.getElementById('pPrice');
        this.pPriceRetail = document.getElementById('pPriceRetail');
        this.pPriceBusiness = document.getElementById('pPriceBusiness');
        this.migrateProductPricesBtn = document.getElementById('migrateProductPricesBtn');

        // Image UI
        this.pPreviewPack = document.getElementById('pPreviewPack');
        this.pPreviewContent = document.getElementById('pPreviewContent');
        this.previewContainerPack = document.getElementById('previewContainerPack');
        this.previewContainerContent = document.getElementById('previewContainerContent');
        this.fNamePack = document.getElementById('fNamePack');
        this.fNameContent = document.getElementById('fNameContent');
        this.filePack = document.getElementById('pImgPack');
        this.fileContent = document.getElementById('pImgContent');
        this.mediaImageUrl = document.getElementById('pImageUrl');
        this.mediaImageNoPackagingUrl = document.getElementById('pImageNoPackagingUrl');
        this.autoCompress = document.getElementById('pAutoCompress');
        this.availabilityDayInputs = Array.from(document.querySelectorAll('.pAvailDay'));
        this.leadTimeHours = document.getElementById('pLeadTimeHours');
        this.availabilityNote = document.getElementById('pAvailabilityNote');
        this.collectionForm = document.getElementById('collectionForm');
        this.collectionId = document.getElementById('collectionId');
        this.collectionName = document.getElementById('collectionName');
        this.collectionSlug = document.getElementById('collectionSlug');
        this.collectionDescription = document.getElementById('collectionDescription');
        this.collectionOrder = document.getElementById('collectionOrder');
        this.collectionActive = document.getElementById('collectionActive');
        this.collectionHomepage = document.getElementById('collectionHomepage');
        this.collectionPicker = document.getElementById('collectionProductPicker');
        this.collectionList = document.getElementById('collectionList');
        this.collectionSubmitBtn = document.getElementById('collectionSubmitBtn');
        this.collectionCancelBtn = document.getElementById('collectionCancelBtn');

        this.allProductsCache = [];
        this.collectionsCache = [];
        this.unsubscribeProducts = null;
        this.unsubscribeCategories = null;
        this.unsubscribeCollections = null;
        this.slugTouched = false;
        this.pGlovoEnabled = document.getElementById('pGlovoEnabled');
        this.pGlovoUrl = document.getElementById('pGlovoUrl');
        this.pYandexEnabled = document.getElementById('pYandexEnabled');
        this.pYandexUrl = document.getElementById('pYandexUrl');
        this.pYandexSelectedJson = document.getElementById('pYandexSelectedJson');
        this.pYandexSelectedProduct = document.getElementById('pYandexSelectedProduct');
        this.importYandexMenuBtn = document.getElementById('importYandexMenuBtn');
        this.clearYandexProductBtn = document.getElementById('clearYandexProductBtn');
        this.yandexMenuModal = document.getElementById('yandexMenuModal');
        this.closeYandexMenuModalBtn = document.getElementById('closeYandexMenuModalBtn');
        this.yandexMenuSearch = document.getElementById('yandexMenuSearch');
        this.yandexMenuResults = document.getElementById('yandexMenuResults');
        this.yandexMenuStatus = document.getElementById('yandexMenuStatus');
        this.pMapEnabled = document.getElementById('pMapEnabled');
        this.pMapUrl = document.getElementById('pMapUrl');
        this.yandexMenuProducts = [];
    }

    async init() {
        window.editProduct = this.editProduct.bind(this);
        window.deleteProduct = this.deleteProduct.bind(this);

        this.bindEvents();
        this.loadCategories(); // Populates dropdowns
        this.loadProducts();
        this.loadCollections();
    }

    onStoreChanged() {
        // Switch listeners to the newly-selected store.
        this.allProductsCache = [];
        this.loadCategories();
        this.loadProducts();
        this.loadCollections();
    }

    bindEvents() {
        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.resetForm());
        if (this.pPriceRetail) this.pPriceRetail.addEventListener('input', this.syncLegacyPriceField.bind(this));
        if (this.pPriceBusiness) this.pPriceBusiness.addEventListener('blur', this.defaultBusinessPrice.bind(this));
        if (this.migrateProductPricesBtn) this.migrateProductPricesBtn.addEventListener('click', this.migrateLegacyPrices.bind(this));
        if (this.collectionForm) this.collectionForm.addEventListener('submit', (e) => this.saveCollection(e));
        if (this.collectionCancelBtn) this.collectionCancelBtn.addEventListener('click', () => this.resetCollectionForm());
        if (this.importYandexMenuBtn) this.importYandexMenuBtn.addEventListener('click', () => this.importYandexMenu());
        if (this.clearYandexProductBtn) this.clearYandexProductBtn.addEventListener('click', () => this.clearYandexSelection());
        if (this.closeYandexMenuModalBtn) this.closeYandexMenuModalBtn.addEventListener('click', () => this.closeYandexModal());
        if (this.yandexMenuModal) {
            this.yandexMenuModal.addEventListener('click', (event) => {
                if (event.target === this.yandexMenuModal) this.closeYandexModal();
            });
        }
        if (this.yandexMenuSearch) this.yandexMenuSearch.addEventListener('input', () => this.renderYandexMenuProducts());

        if (this.collectionName && this.collectionSlug) {
            this.collectionName.addEventListener('input', () => {
                if (!this.collectionId?.value) this.collectionSlug.value = slugifyProductName(this.collectionName.value);
            });
        }

        // File Previews
        this.handleFileSelect(this.filePack, this.pPreviewPack, this.previewContainerPack, this.fNamePack);
        this.handleFileSelect(this.fileContent, this.pPreviewContent, this.previewContainerContent, this.fNameContent);
        this.bindSlugGeneration();

        // Filter
        const filterSelect = document.getElementById('filterCategory');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => this.renderProductList());
        }
    }

    handleFileSelect(input, previewImg, container, nameSpan) {
        if (!input) return;
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                nameSpan.textContent = file.name;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    previewImg.src = ev.target.result;
                    container.style.display = 'flex';
                };
                reader.readAsDataURL(file);
            } else {
                nameSpan.textContent = 'No file chosen';
            }
        });
    }

    bindSlugGeneration() {
        if (!this.pSlug) return;

        this.pSlug.addEventListener('input', () => {
            this.slugTouched = true;
        });

        ['pNameEN', 'pNameRU', 'pNameKG'].forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;

            input.addEventListener('input', () => {
                if (!this.slugTouched || !this.pSlug.value.trim()) {
                    this.pSlug.value = this.generateUniqueSlugFromForm(this.pId.value);
                    this.slugTouched = false;
                }
            });
        });
    }

    generateUniqueSlug(baseSlug, currentId = '') {
        const cleanBase = slugifyProductName(baseSlug) || `product-${Date.now()}`;
        const existing = new Set(
            this.allProductsCache
                .filter((p) => p.id !== currentId)
                .map((p) => (p.slug || '').trim())
                .filter(Boolean)
        );

        if (!existing.has(cleanBase)) return cleanBase;

        let attempt = 2;
        while (existing.has(`${cleanBase}-${attempt}`)) {
            attempt += 1;
        }

        return `${cleanBase}-${attempt}`;
    }

    generateUniqueSlugFromForm(currentId = '') {
        const name = document.getElementById('pNameEN').value
            || document.getElementById('pNameRU').value
            || document.getElementById('pNameKG').value;

        return this.generateUniqueSlug(name, currentId);
    }

    async loadCategories() {
        // Populate Product Form Category Select & Filter
        const selectedCompanyId = getSelectedCompanyId();
        const q = query(collection(db, 'categories'), where('companyId', '==', selectedCompanyId));

        if (this.unsubscribeCategories) this.unsubscribeCategories();

        this.unsubscribeCategories = onSnapshot(q, (snapshot) => {
            const catSelect = document.getElementById('pCategory');
            const filterSelect = document.getElementById('filterCategory');

            // Preserve filter selection?
            const currentFilter = filterSelect ? filterSelect.value : 'all';

            if (catSelect) catSelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
            if (filterSelect) filterSelect.innerHTML = '<option value="all">All Categories</option>';

            const sorted = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(c => matchesSelectedCompany(c, `categories/${c.id}`))
                .sort((a, b) => (a.name_ru || '').localeCompare(b.name_ru || ''));

            sorted.forEach(c => {
                const name = c.name_en || c.name_ru || c.name || c.id;

                // Form Select
                if (catSelect) {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = name;
                    catSelect.appendChild(opt);
                }

                // Filter Select
                if (filterSelect) {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = name;
                    filterSelect.appendChild(opt);
                }
            });

            if (filterSelect) filterSelect.value = currentFilter;
        });
    }

    loadProducts() {
        const selectedCompanyId = getSelectedCompanyId();
        const q = query(collection(db, 'products'), where('companyId', '==', selectedCompanyId));

        if (this.unsubscribeProducts) this.unsubscribeProducts();

        this.unsubscribeProducts = onSnapshot(q, (snapshot) => {
            this.allProductsCache = [];
            snapshot.forEach(docSnap => {
                const product = { id: docSnap.id, ...docSnap.data() };
                if (matchesSelectedCompany(product, `products/${product.id}`)) {
                    this.allProductsCache.push(product);
                }
            });
            this.renderProductList();
            this.renderCollectionProductPicker();
        });
    }

    loadCollections() {
        const selectedCompanyId = getSelectedCompanyId();
        const q = query(collection(db, 'product_collections'), where('companyId', '==', selectedCompanyId), orderBy('order', 'asc'));

        if (this.unsubscribeCollections) this.unsubscribeCollections();

        this.unsubscribeCollections = onSnapshot(q, (snapshot) => {
            this.collectionsCache = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(c => matchesSelectedCompany(c, `product_collections/${c.id}`));
            this.renderCollections();
        }, async (error) => {
            console.warn('Collections snapshot failed, retrying without order:', error);
            const fallback = query(collection(db, 'product_collections'), where('companyId', '==', selectedCompanyId));
            if (this.unsubscribeCollections) this.unsubscribeCollections();
            this.unsubscribeCollections = onSnapshot(fallback, (snapshot) => {
                this.collectionsCache = snapshot.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(c => matchesSelectedCompany(c, `product_collections/${c.id}`))
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
                this.renderCollections();
            });
        });
    }

    renderProductList() {
        if (!this.list) return;
        this.list.innerHTML = '';

        const filterVal = document.getElementById('filterCategory')?.value || 'all';
        const filtered = (filterVal === 'all')
            ? this.allProductsCache
            : this.allProductsCache.filter(p => p.categoryId === filterVal);

        if (!filtered.length) {
            const companyId = getSelectedCompanyId();
            this.list.innerHTML = `<p style="color:#666; padding:1rem;">No products found for ${companyId}. Add the first product for this store below.</p>`;
            return;
        }

        filtered.forEach(p => {
            const pageUrl = buildProductPageUrl(p);
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <img src="${p.imageUrl}" class="preview-img">
                <div style="flex:1; margin-left:1rem;">
                    <strong>${p.name_ru || 'No Name'}</strong><br>
                    Retail: ${getRetailPrice(p)} som | Business: ${getBusinessPrice(p)} som | ${p.weight}<br>
                    <span class="external-link-count">${this.getExternalLinkSummary(p)}</span><br>
                    <a href="${pageUrl}" target="_blank" rel="noopener" style="font-size:0.85rem; color:#2e7d32;">${pageUrl}</a>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary" title="Edit" onclick="editProduct('${p.id}')">✏️</button>
                    <button class="btn-danger" title="Delete" onclick="deleteProduct('${p.id}')">🗑️</button>
                </div>
            `;
            this.list.appendChild(el);
        });
        this.renderCollectionProductPicker();
    }

    syncLegacyPriceField() {
        if (!this.pPrice || !this.pPriceRetail) return;
        this.pPrice.value = this.pPriceRetail.value || '';
    }

    defaultBusinessPrice() {
        if (!this.pPriceBusiness || !this.pPriceRetail) return;
        if (!String(this.pPriceBusiness.value || '').trim()) {
            this.pPriceBusiness.value = this.pPriceRetail.value || '';
        }
    }

    readProductPricesFromForm() {
        const retailPrice = Number(this.pPriceRetail ? this.pPriceRetail.value || 0 : 0);
        const businessInput = String(this.pPriceBusiness ? this.pPriceBusiness.value || '' : '').trim();
        const businessPrice = businessInput ? Number(businessInput) : retailPrice;

        return {
            retailPrice: Number.isFinite(retailPrice) ? retailPrice : 0,
            businessPrice: Number.isFinite(businessPrice) ? businessPrice : retailPrice
        };
    }

    renderCollectionProductPicker(selectedIds = null) {
        if (!this.collectionPicker) return;
        const selected = new Set(selectedIds || this.getSelectedCollectionProductIds());
        if (!this.allProductsCache.length) {
            this.collectionPicker.innerHTML = '<p style="color:#666;">Add products first, then create collections.</p>';
            return;
        }
        this.collectionPicker.innerHTML = this.allProductsCache
            .slice()
            .sort((a, b) => getPreferredProductName(a).localeCompare(getPreferredProductName(b)))
            .map(product => `
                <label style="display:flex; align-items:center; gap:0.45rem;">
                    <input type="checkbox" value="${product.id}" ${selected.has(product.id) ? 'checked' : ''}>
                    ${getPreferredProductName(product)}
                </label>
            `).join('');
    }

    getSelectedCollectionProductIds() {
        if (!this.collectionPicker) return [];
        return Array.from(this.collectionPicker.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
    }

    renderCollections() {
        if (!this.collectionList) return;
        if (!this.collectionsCache.length) {
            this.collectionList.innerHTML = '<p style="color:#666;">No collections yet.</p>';
            return;
        }
        this.collectionList.innerHTML = '';
        this.collectionsCache.forEach(collectionData => {
            const productCount = Array.isArray(collectionData.productIds) ? collectionData.productIds.length : 0;
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <div style="flex:1;">
                    <strong>${collectionData.name || collectionData.slug || collectionData.id}</strong>
                    <div style="color:#666; font-size:0.9rem;">${productCount} products • ${collectionData.showOnHomepage ? 'Homepage' : 'Hidden from homepage'} • ${collectionData.active === false ? 'Inactive' : 'Active'}</div>
                    ${collectionData.description ? `<div style="color:#777; font-size:0.85rem;">${collectionData.description}</div>` : ''}
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary" type="button" data-action="edit-collection" data-id="${collectionData.id}">Edit</button>
                    <button class="btn-danger" type="button" data-action="delete-collection" data-id="${collectionData.id}">Delete</button>
                </div>
            `;
            el.querySelector('[data-action="edit-collection"]')?.addEventListener('click', () => this.editCollection(collectionData.id));
            el.querySelector('[data-action="delete-collection"]')?.addEventListener('click', () => this.deleteCollection(collectionData.id));
            this.collectionList.appendChild(el);
        });
    }

    async saveCollection(e) {
        e.preventDefault();
        const name = String(this.collectionName?.value || '').trim();
        if (!name) return alert('Collection name is required.');

        const id = this.collectionId?.value || '';
        const data = {
            companyId: getSelectedCompanyId(),
            name,
            slug: slugifyProductName(this.collectionSlug?.value || name),
            description: String(this.collectionDescription?.value || '').trim(),
            order: Number(this.collectionOrder?.value || 0),
            active: this.collectionActive ? this.collectionActive.checked : true,
            showOnHomepage: this.collectionHomepage ? this.collectionHomepage.checked : false,
            productIds: this.getSelectedCollectionProductIds(),
            updatedAt: serverTimestamp()
        };

        try {
            if (id) {
                await updateDoc(doc(db, 'product_collections', id), data);
                await logAudit('Collection Updated', `${data.name} (${data.productIds.length} products)`);
            } else {
                await addDoc(collection(db, 'product_collections'), {
                    ...data,
                    createdAt: serverTimestamp()
                });
                await logAudit('Collection Created', `${data.name} (${data.productIds.length} products)`);
            }
            this.resetCollectionForm();
        } catch (err) {
            console.error(err);
            alert('Error saving collection: ' + err.message);
        }
    }

    editCollection(id) {
        const collectionData = this.collectionsCache.find(c => c.id === id);
        if (!collectionData) return;

        if (this.collectionId) this.collectionId.value = id;
        if (this.collectionName) this.collectionName.value = collectionData.name || '';
        if (this.collectionSlug) this.collectionSlug.value = collectionData.slug || '';
        if (this.collectionDescription) this.collectionDescription.value = collectionData.description || '';
        if (this.collectionOrder) this.collectionOrder.value = collectionData.order || 0;
        if (this.collectionActive) this.collectionActive.checked = collectionData.active !== false;
        if (this.collectionHomepage) this.collectionHomepage.checked = collectionData.showOnHomepage === true;
        if (this.collectionSubmitBtn) this.collectionSubmitBtn.textContent = 'Update Collection';
        if (this.collectionCancelBtn) this.collectionCancelBtn.style.display = 'inline-block';
        this.renderCollectionProductPicker(collectionData.productIds || []);
        this.collectionForm?.scrollIntoView?.({ behavior: 'smooth' });
    }

    async deleteCollection(id) {
        const collectionData = this.collectionsCache.find(c => c.id === id);
        if (!collectionData) return;
        if (!confirm(`Delete collection "${collectionData.name || id}"?`)) return;
        await deleteDoc(doc(db, 'product_collections', id));
        await logAudit('Collection Deleted', collectionData.name || id);
    }

    resetCollectionForm() {
        this.collectionForm?.reset?.();
        if (this.collectionId) this.collectionId.value = '';
        if (this.collectionActive) this.collectionActive.checked = true;
        if (this.collectionHomepage) this.collectionHomepage.checked = false;
        if (this.collectionOrder) this.collectionOrder.value = 0;
        if (this.collectionSubmitBtn) this.collectionSubmitBtn.textContent = 'Save Collection';
        if (this.collectionCancelBtn) this.collectionCancelBtn.style.display = 'none';
        this.renderCollectionProductPicker([]);
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    normalizeExternalUrl(value, allowedHosts = []) {
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

    parseSelectedYandexProduct() {
        if (!this.pYandexSelectedJson?.value) return null;
        try {
            return JSON.parse(this.pYandexSelectedJson.value);
        } catch (error) {
            return null;
        }
    }

    readExternalLinksFromForm() {
        const glovoUrl = this.normalizeExternalUrl(this.pGlovoUrl?.value, ['glovoapp.com', 'www.glovoapp.com']);
        const yandexProduct = this.parseSelectedYandexProduct();
        const yandexUrl = this.normalizeExternalUrl(this.pYandexUrl?.value || yandexProduct?.restaurantUrl, ['eda.yandex.kg', 'eda.yandex.ru', 'eda.yandex.com']);
        const mapUrl = this.normalizeExternalUrl(this.pMapUrl?.value);

        return {
            glovo: {
                enabled: Boolean(this.pGlovoEnabled?.checked && glovoUrl),
                url: glovoUrl,
                label: 'Order on Glovo'
            },
            yandex: {
                enabled: Boolean(this.pYandexEnabled?.checked && yandexUrl),
                url: yandexUrl,
                restaurantUrl: yandexUrl,
                label: 'Order on Yandex',
                product: yandexProduct || null
            },
            map: {
                enabled: Boolean(this.pMapEnabled?.checked && mapUrl),
                url: mapUrl,
                label: 'View map locations'
            }
        };
    }

    getExternalLinkSummary(product) {
        const links = product?.externalLinks || {};
        const active = ['glovo', 'yandex', 'map'].filter((key) => links[key]?.enabled && links[key]?.url);
        return active.length ? 'External links: ' + active.join(', ') : 'External links: none';
    }

    setYandexSelection(product) {
        if (!product) {
            this.clearYandexSelection();
            return;
        }

        if (this.pYandexSelectedJson) this.pYandexSelectedJson.value = JSON.stringify(product);
        if (this.pYandexUrl && product.restaurantUrl) this.pYandexUrl.value = product.restaurantUrl;
        if (this.pYandexEnabled) this.pYandexEnabled.checked = true;
        this.renderYandexSelectedProduct(product);
        this.closeYandexModal();
    }

    renderYandexSelectedProduct(product = this.parseSelectedYandexProduct()) {
        if (!this.pYandexSelectedProduct) return;
        if (!product) {
            this.pYandexSelectedProduct.innerHTML = 'No Yandex product selected.';
            return;
        }

        const price = product.price ? product.price + ' som' : 'Price not available';
        this.pYandexSelectedProduct.innerHTML =
            (product.imageUrl ? '<img src="' + this.escapeHtml(product.imageUrl) + '" alt="">' : '') +
            '<div>' +
                '<strong>' + this.escapeHtml(product.name) + '</strong>' +
                '<span>' + this.escapeHtml(product.categoryName || 'Yandex item') + ' - ' + this.escapeHtml(price) + '</span>' +
                '<small>ID ' + this.escapeHtml(product.itemId) + (product.publicId ? ' - ' + this.escapeHtml(product.publicId) : '') + '</small>' +
            '</div>';
    }

    clearYandexSelection() {
        if (this.pYandexSelectedJson) this.pYandexSelectedJson.value = '';
        if (this.pYandexEnabled) this.pYandexEnabled.checked = Boolean(this.pYandexUrl?.value);
        this.renderYandexSelectedProduct(null);
    }

    openYandexModal() {
        if (this.yandexMenuModal) this.yandexMenuModal.classList.remove('hidden');
        if (this.yandexMenuSearch) this.yandexMenuSearch.focus();
    }

    closeYandexModal() {
        if (this.yandexMenuModal) this.yandexMenuModal.classList.add('hidden');
    }

    async importYandexMenu() {
        const restaurantUrl = String(this.pYandexUrl?.value || '').trim();
        if (!restaurantUrl) {
            alert('Paste a Yandex Eats restaurant URL first.');
            return;
        }

        this.openYandexModal();
        if (this.yandexMenuStatus) this.yandexMenuStatus.textContent = 'Importing Yandex menu...';
        if (this.yandexMenuResults) this.yandexMenuResults.innerHTML = '<div class="yandex-menu-empty">Loading menu products...</div>';

        try {
            const importMenu = httpsCallable(functions, 'importYandexMenu');
            const result = await importMenu({ restaurantUrl });
            this.yandexMenuProducts = Array.isArray(result.data?.products) ? result.data.products : [];
            if (this.yandexMenuStatus) this.yandexMenuStatus.textContent = this.yandexMenuProducts.length + ' Yandex products imported.';
            this.renderYandexMenuProducts();
        } catch (error) {
            console.error(error);
            if (this.yandexMenuStatus) this.yandexMenuStatus.textContent = error.message || 'Yandex import failed.';
            if (this.yandexMenuResults) this.yandexMenuResults.innerHTML = '<div class="yandex-menu-empty error">Could not import this menu. Try another restaurant URL.</div>';
        }
    }

    renderYandexMenuProducts() {
        if (!this.yandexMenuResults) return;
        const search = String(this.yandexMenuSearch?.value || '').trim().toLowerCase();
        const products = this.yandexMenuProducts
            .filter((product) => !search || [product.name, product.categoryName, product.description, product.itemId].some((value) => String(value || '').toLowerCase().includes(search)))
            .slice(0, 120);

        if (!products.length) {
            this.yandexMenuResults.innerHTML = '<div class="yandex-menu-empty">No matching Yandex products.</div>';
            return;
        }

        this.yandexMenuResults.innerHTML = products.map((product, index) => {
            const price = product.price ? product.price + ' som' : 'Price not available';
            return '<button type="button" class="yandex-menu-product" data-index="' + index + '">' +
                (product.imageUrl ? '<img src="' + this.escapeHtml(product.imageUrl) + '" alt="">' : '<span class="yandex-menu-thumb-empty">No image</span>') +
                '<span>' +
                    '<strong>' + this.escapeHtml(product.name) + '</strong>' +
                    '<small>' + this.escapeHtml(product.categoryName || 'Yandex menu') + ' - ' + this.escapeHtml(price) + '</small>' +
                    (product.description ? '<em>' + this.escapeHtml(product.description) + '</em>' : '') +
                '</span>' +
            '</button>';
        }).join('');

        this.yandexMenuResults.querySelectorAll('.yandex-menu-product').forEach((button) => {
            button.addEventListener('click', () => {
                const product = products[Number(button.dataset.index)];
                this.setYandexSelection(product);
            });
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const filePack = this.filePack.files[0];
        const fileContent = this.fileContent.files[0];
        const isEdit = !!this.pId.value;

        if (!isEdit && !filePack) { alert('Packaging image required for new product'); return; }
        if (isEdit && !this.allProductsCache.some(product => product.id === this.pId.value)) {
            alert('This product is not available for your company.');
            return;
        }

        try {
            let imageUrl = null;
            let imageNoPackagingUrl = null;
            const uploadOptions = {
                autoCompress: this.autoCompress ? this.autoCompress.checked : true
            };

            if (filePack) imageUrl = await uploadImage(filePack, 'products', uploadOptions);
            if (fileContent) imageNoPackagingUrl = await uploadImage(fileContent, 'products', uploadOptions);
            if (!imageUrl && this.mediaImageUrl?.value) imageUrl = this.mediaImageUrl.value;
            if (!imageNoPackagingUrl && this.mediaImageNoPackagingUrl?.value) imageNoPackagingUrl = this.mediaImageNoPackagingUrl.value;

            const prices = this.readProductPricesFromForm();
            const data = {
                companyId: getSelectedCompanyId(),
                name_ru: document.getElementById('pNameRU').value,
                name_en: document.getElementById('pNameEN').value,
                name_kg: document.getElementById('pNameKG').value,
                // Legacy price is kept for backward compatibility with older pages and data.
                price: prices.retailPrice,
                priceRetail: prices.retailPrice,
                priceBusiness: prices.businessPrice,
                weight: document.getElementById('pWeight').value,
                categoryId: document.getElementById('pCategory').value,
                description_ru: document.getElementById('pDescRU').value,
                description_en: document.getElementById('pDescEN').value,
                description_kg: document.getElementById('pDescKG').value,
                availability: {
                    days: this.availabilityDayInputs
                        .filter(input => input.checked)
                        .map(input => Number(input.value))
                        .filter(value => Number.isFinite(value)),
                    leadTimeHours: Math.max(0, Number(this.leadTimeHours?.value || 0) || 0),
                    note: String(this.availabilityNote?.value || '').trim()
                },
                externalLinks: this.readExternalLinksFromForm(),
                slug: this.generateUniqueSlug(
                    this.pSlug.value || getPreferredProductName({
                        name_en: document.getElementById('pNameEN').value,
                        name_ru: document.getElementById('pNameRU').value,
                        name_kg: document.getElementById('pNameKG').value
                    }),
                    this.pId.value
                ),
                updatedAt: serverTimestamp()
            };

            if (imageUrl) data.imageUrl = imageUrl;
            if (imageNoPackagingUrl) data.imageNoPackagingUrl = imageNoPackagingUrl;

            if (!isEdit) {
                data.active = true;
                data.isFeatured = false;
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'products'), data);
                await logAudit('Product Created', `Name: ${data.name_en}`);
                alert('Product Added!');
            } else {
                await updateDoc(doc(db, 'products', this.pId.value), data);
                await logAudit('Product Updated', `ID: ${this.pId.value}`);
                alert('Product Updated!');
            }
            this.resetForm();

        } catch (err) {
            console.error(err);
            alert('Error saving product: ' + err.message);
        }
    }

    resetForm() {
        this.form.reset();
        this.pId.value = '';
        this.submitBtn.textContent = 'Add Product';
        this.formTitle.textContent = 'Add Product';
        this.cancelBtn.style.display = 'none';

        this.previewContainerPack.style.display = 'none';
        this.previewContainerContent.style.display = 'none';
        this.pPreviewPack.src = '';
        this.pPreviewContent.src = '';
        this.fNamePack.textContent = 'No file chosen';
        this.fNameContent.textContent = 'No file chosen';
        if (this.mediaImageUrl) this.mediaImageUrl.value = '';
        if (this.mediaImageNoPackagingUrl) this.mediaImageNoPackagingUrl.value = '';
        if (this.pSlug) this.pSlug.value = '';
        if (this.pPrice) this.pPrice.value = '';
        if (this.pPriceRetail) this.pPriceRetail.value = '';
        if (this.pPriceBusiness) this.pPriceBusiness.value = '';
        if (this.autoCompress) this.autoCompress.checked = true;
        this.availabilityDayInputs.forEach(input => {
            input.checked = false;
        });
        if (this.leadTimeHours) this.leadTimeHours.value = 0;
        if (this.availabilityNote) this.availabilityNote.value = '';
        if (this.pGlovoEnabled) this.pGlovoEnabled.checked = false;
        if (this.pGlovoUrl) this.pGlovoUrl.value = '';
        if (this.pYandexEnabled) this.pYandexEnabled.checked = false;
        if (this.pYandexUrl) this.pYandexUrl.value = '';
        if (this.pYandexSelectedJson) this.pYandexSelectedJson.value = '';
        this.renderYandexSelectedProduct(null);
        if (this.pMapEnabled) this.pMapEnabled.checked = false;
        if (this.pMapUrl) this.pMapUrl.value = '';
        this.yandexMenuProducts = [];
        this.slugTouched = false;
    }

    async editProduct(id) {
        const p = this.allProductsCache.find(x => x.id === id);
        if (!p) return;

        this.pId.value = id;
        document.getElementById('pNameRU').value = p.name_ru || '';
        document.getElementById('pNameEN').value = p.name_en || '';
        document.getElementById('pNameKG').value = p.name_kg || '';
        if (this.pPriceRetail) this.pPriceRetail.value = getRetailPrice(p) || '';
        if (this.pPriceBusiness) this.pPriceBusiness.value = getBusinessPrice(p) || '';
        if (this.pPrice) this.pPrice.value = getRetailPrice(p) || '';
        document.getElementById('pWeight').value = p.weight || '';
        document.getElementById('pCategory').value = p.categoryId || '';
        document.getElementById('pDescRU').value = p.description_ru || '';
        document.getElementById('pDescEN').value = p.description_en || '';
        document.getElementById('pDescKG').value = p.description_kg || '';
        const availabilityDays = new Set(Array.isArray(p.availability?.days) ? p.availability.days.map(Number) : []);
        this.availabilityDayInputs.forEach(input => {
            input.checked = availabilityDays.has(Number(input.value));
        });
        if (this.leadTimeHours) this.leadTimeHours.value = p.availability?.leadTimeHours || 0;
        if (this.availabilityNote) this.availabilityNote.value = p.availability?.note || '';
        if (this.pSlug) this.pSlug.value = p.slug || this.generateUniqueSlug(getPreferredProductName(p), id);
        const links = p.externalLinks || {};
        if (this.pGlovoUrl) this.pGlovoUrl.value = links.glovo?.url || '';
        if (this.pGlovoEnabled) this.pGlovoEnabled.checked = links.glovo?.enabled === true || Boolean(links.glovo?.url);
        if (this.pYandexUrl) this.pYandexUrl.value = links.yandex?.restaurantUrl || links.yandex?.url || '';
        if (this.pYandexEnabled) this.pYandexEnabled.checked = links.yandex?.enabled === true || Boolean(links.yandex?.url);
        if (this.pYandexSelectedJson) this.pYandexSelectedJson.value = links.yandex?.product ? JSON.stringify(links.yandex.product) : '';
        this.renderYandexSelectedProduct(links.yandex?.product || null);
        if (this.pMapUrl) this.pMapUrl.value = links.map?.url || '';
        if (this.pMapEnabled) this.pMapEnabled.checked = links.map?.enabled === true || Boolean(links.map?.url);
        this.slugTouched = !!p.slug;

        // Show Images
        if (p.imageUrl) {
            if (this.mediaImageUrl) this.mediaImageUrl.value = p.imageUrl;
            this.pPreviewPack.src = p.imageUrl;
            this.previewContainerPack.style.display = 'flex';
            this.fNamePack.textContent = 'Existing Image';
        }
        if (p.imageNoPackagingUrl) {
            if (this.mediaImageNoPackagingUrl) this.mediaImageNoPackagingUrl.value = p.imageNoPackagingUrl;
            this.pPreviewContent.src = p.imageNoPackagingUrl;
            this.previewContainerContent.style.display = 'flex';
            this.fNameContent.textContent = 'Existing Image';
        }

        this.submitBtn.textContent = 'Update Product';
        this.formTitle.textContent = 'Edit Product';
        this.cancelBtn.style.display = 'inline-block';
        this.form.scrollIntoView({ behavior: 'smooth' });
    }

    async deleteProduct(id) {
        if (!this.allProductsCache.some(product => product.id === id)) {
            alert('This product is not available for your company.');
            return;
        }

        if (confirm('Delete this product?')) {
            await deleteDoc(doc(db, 'products', id));
            await logAudit('Product Deleted', `ID: ${id}`);
        }
    }

    async migrateLegacyPrices() {
        if (!confirm('Copy legacy price into Retail Price and Business Price where those fields are missing? The legacy price field will be kept.')) return;

        let updatedCount = 0;
        const selectedCompanyId = getSelectedCompanyId();
        const q = query(collection(db, 'products'), where('companyId', '==', selectedCompanyId));
        const snapshot = await getDocs(q);

        for (const docSnap of snapshot.docs) {
            const product = { id: docSnap.id, ...docSnap.data() };
            if (!matchesSelectedCompany(product, `products/${product.id}`)) continue;

            const updates = {};
            if (product.priceRetail === undefined || product.priceRetail === null || product.priceRetail === '') {
                updates.priceRetail = getRetailPrice(product);
            }
            if (product.priceBusiness === undefined || product.priceBusiness === null || product.priceBusiness === '') {
                updates.priceBusiness = getBusinessPrice(product);
            }

            if (Object.keys(updates).length) {
                updates.updatedAt = serverTimestamp();
                await updateDoc(doc(db, 'products', docSnap.id), updates);
                updatedCount += 1;
            }
        }

        await logAudit('Product Price Migration', `Updated ${updatedCount} products`);
        alert(`Price migration complete. Updated ${updatedCount} products.`);
    }
}
