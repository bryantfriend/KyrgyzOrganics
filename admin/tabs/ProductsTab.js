import { BaseTab } from './BaseTab.js';
import { db, functions, httpsCallable } from '../../firebase-config.js';
import { uploadImage, logAudit } from '../utils.js';
import { buildProductPageUrl, getBusinessPrice, getPreferredProductName, getRetailPrice, slugifyProductName } from '../../product-utils.js';
import {
    PRODUCT_EXTERNAL_LINK_TYPES,
    PRODUCT_LINK_TYPE_LABELS,
    getDefaultProductLinkLabel,
    normalizeProductExternalLinkInput,
    normalizeProductExternalLinks
} from '../../product-external-links.mjs';
import {
    addProductExternalLinkIntent,
    deleteProductExternalLinkIntent,
    reorderProductExternalLinksIntent,
    toggleProductExternalLinkIntent,
    updateProductExternalLinkIntent
} from '../../product-external-links.service.js';
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
        this.openCollectionProductsBtn = document.getElementById('openCollectionProductsBtn');
        this.collectionProductsModal = document.getElementById('collectionProductsModal');
        this.closeCollectionProductsBtn = document.getElementById('closeCollectionProductsBtn');
        this.cancelCollectionProductsBtn = document.getElementById('cancelCollectionProductsBtn');
        this.confirmCollectionProductsBtn = document.getElementById('confirmCollectionProductsBtn');
        this.collectionProductsSearch = document.getElementById('collectionProductsSearch');
        this.collectionProductsGrid = document.getElementById('collectionProductsGrid');
        this.collectionProductsCount = document.getElementById('collectionProductsCount');
        this.selectAllCollectionProductsBtn = document.getElementById('selectAllCollectionProductsBtn');
        this.clearCollectionProductsBtn = document.getElementById('clearCollectionProductsBtn');
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
        this.productLinksModal = null;
        this.productLinksProduct = null;
        this.productLinksEditingId = '';
        this.productLinksAutoLabel = '';
        this.collectionSelectedProductIds = new Set();
        this.collectionDraftProductIds = new Set();
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
        this.collectionSelectedProductIds.clear();
        this.collectionDraftProductIds.clear();
        this.closeCollectionProductsModal();
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
        if (this.openCollectionProductsBtn) this.openCollectionProductsBtn.addEventListener('click', () => this.openCollectionProductsModal());
        if (this.closeCollectionProductsBtn) this.closeCollectionProductsBtn.addEventListener('click', () => this.closeCollectionProductsModal());
        if (this.cancelCollectionProductsBtn) this.cancelCollectionProductsBtn.addEventListener('click', () => this.closeCollectionProductsModal());
        if (this.confirmCollectionProductsBtn) this.confirmCollectionProductsBtn.addEventListener('click', () => this.confirmCollectionProducts());
        if (this.collectionProductsSearch) this.collectionProductsSearch.addEventListener('input', () => this.renderCollectionProductsModal());
        if (this.selectAllCollectionProductsBtn) this.selectAllCollectionProductsBtn.addEventListener('click', () => this.selectAllCollectionProducts());
        if (this.clearCollectionProductsBtn) this.clearCollectionProductsBtn.addEventListener('click', () => this.clearCollectionProducts());
        if (this.collectionProductsGrid) {
            this.collectionProductsGrid.addEventListener('change', (event) => this.handleCollectionProductSelection(event));
        }
        if (this.collectionProductsModal) {
            this.collectionProductsModal.addEventListener('click', (event) => {
                if (event.target === this.collectionProductsModal) this.closeCollectionProductsModal();
            });
        }
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

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !this.collectionProductsModal?.classList.contains('hidden')) {
                this.closeCollectionProductsModal();
            }
        });
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
            const productName = this.escapeHtml(getPreferredProductName(p) || p.name_ru || 'Product');
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <img src="${p.imageUrl}" class="preview-img">
                <div style="flex:1; margin-left:1rem;">
                    <strong>${productName}</strong><br>
                    Retail: ${getRetailPrice(p)} som | Business: ${getBusinessPrice(p)} som | ${p.weight}<br>
                    <span class="external-link-count">${this.getExternalLinkSummary(p)}</span><br>
                    <a href="${pageUrl}" target="_blank" rel="noopener" style="font-size:0.85rem; color:#2e7d32;">${pageUrl}</a>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary product-link-action-btn" type="button" title="Product Links" aria-label="Manage product links" data-action="manage-product-links" data-id="${p.id}">🔗</button>
                    <button class="btn-secondary" title="Edit" onclick="editProduct('${p.id}')">✏️</button>
                    <button class="btn-danger" title="Delete" onclick="deleteProduct('${p.id}')">🗑️</button>
                </div>
            `;
            el.querySelector('[data-action="manage-product-links"]')?.addEventListener('click', () => this.openProductLinksModal(p.id));
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
        if (selectedIds !== null) {
            this.collectionSelectedProductIds = new Set(selectedIds || []);
        }

        if (!this.allProductsCache.length) {
            this.collectionPicker.innerHTML = '<p class="collection-selection-empty">Add products first, then create collections.</p>';
            if (this.openCollectionProductsBtn) this.openCollectionProductsBtn.disabled = true;
            return;
        }

        if (this.openCollectionProductsBtn) this.openCollectionProductsBtn.disabled = false;
        const selectedProducts = this.allProductsCache.filter((product) => this.collectionSelectedProductIds.has(product.id));
        if (!selectedProducts.length) {
            this.collectionPicker.innerHTML = '<p class="collection-selection-empty">No products selected yet.</p><small>Use Choose Products to add items to this collection.</small>';
            return;
        }

        const previews = selectedProducts.slice(0, 8).map((product) => `
            <span class="collection-selection-preview" title="${this.escapeHtml(getPreferredProductName(product))}">
                ${product.imageUrl
                    ? '<img src="' + this.escapeHtml(product.imageUrl) + '" alt="">'
                    : '<span class="collection-selection-preview-empty">No image</span>'}
            </span>
        `).join('');
        const remaining = selectedProducts.length > 8
            ? '<span class="collection-selection-more">+' + (selectedProducts.length - 8) + ' more</span>'
            : '';

        this.collectionPicker.innerHTML = `
            <strong>${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'} selected</strong>
            <div class="collection-selection-previews">${previews}${remaining}</div>
        `;
    }

    getSelectedCollectionProductIds() {
        const availableIds = new Set(this.allProductsCache.map((product) => product.id));
        return Array.from(this.collectionSelectedProductIds).filter((id) => availableIds.has(id));
    }

    openCollectionProductsModal() {
        if (!this.collectionProductsModal) return;
        this.collectionDraftProductIds = new Set(this.collectionSelectedProductIds);
        if (this.collectionProductsSearch) this.collectionProductsSearch.value = '';
        this.collectionProductsModal.classList.remove('hidden');
        this.collectionProductsModal.setAttribute('aria-hidden', 'false');
        this.renderCollectionProductsModal();
        this.collectionProductsSearch?.focus();
    }

    closeCollectionProductsModal() {
        if (!this.collectionProductsModal) return;
        this.collectionProductsModal.classList.add('hidden');
        this.collectionProductsModal.setAttribute('aria-hidden', 'true');
        this.collectionDraftProductIds = new Set(this.collectionSelectedProductIds);
        this.openCollectionProductsBtn?.focus?.();
    }

    confirmCollectionProducts() {
        this.collectionSelectedProductIds = new Set(this.collectionDraftProductIds);
        this.renderCollectionProductPicker();
        this.closeCollectionProductsModal();
    }

    renderCollectionProductsModal() {
        if (!this.collectionProductsGrid) return;
        const searchTerm = String(this.collectionProductsSearch?.value || '').trim().toLowerCase();
        const filteredProducts = this.allProductsCache
            .slice()
            .sort((a, b) => getPreferredProductName(a).localeCompare(getPreferredProductName(b)))
            .filter((product) => {
                if (!searchTerm) return true;
                return [product.name_en, product.name_ru, product.name_kg, getPreferredProductName(product)]
                    .filter(Boolean)
                    .some((name) => String(name).toLowerCase().includes(searchTerm));
            });

        if (!filteredProducts.length) {
            this.collectionProductsGrid.innerHTML = '<div class="collection-products-empty">No matching products found.</div>';
            this.updateCollectionProductsCount();
            return;
        }

        this.collectionProductsGrid.innerHTML = filteredProducts.map((product) => {
            const isSelected = this.collectionDraftProductIds.has(product.id);
            const productName = getPreferredProductName(product) || product.name_ru || 'Product';
            return `
                <label class="collection-picker-card ${isSelected ? 'selected' : ''}">
                    ${product.imageUrl
                        ? '<img src="' + this.escapeHtml(product.imageUrl) + '" alt="">'
                        : '<span class="collection-picker-image-empty">No image</span>'}
                    <span class="collection-picker-copy">
                        <strong>${this.escapeHtml(productName)}</strong>
                        <small>${this.escapeHtml(product.weight || '')}</small>
                    </span>
                    <input class="collection-picker-checkbox" type="checkbox" value="${this.escapeHtml(product.id)}" ${isSelected ? 'checked' : ''} aria-label="Add ${this.escapeHtml(productName)} to collection">
                </label>
            `;
        }).join('');
        this.updateCollectionProductsCount();
    }

    handleCollectionProductSelection(event) {
        const checkbox = event.target.closest('.collection-picker-checkbox');
        if (!checkbox) return;

        if (checkbox.checked) this.collectionDraftProductIds.add(checkbox.value);
        else this.collectionDraftProductIds.delete(checkbox.value);
        checkbox.closest('.collection-picker-card')?.classList.toggle('selected', checkbox.checked);
        this.updateCollectionProductsCount();
    }

    updateCollectionProductsCount() {
        const count = this.collectionDraftProductIds.size;
        if (this.collectionProductsCount) {
            this.collectionProductsCount.textContent = `${count} product${count === 1 ? '' : 's'} selected`;
        }
        if (this.confirmCollectionProductsBtn) {
            this.confirmCollectionProductsBtn.textContent = count
                ? `Add ${count} Selected Product${count === 1 ? '' : 's'}`
                : 'Use Empty Collection';
        }
    }

    selectAllCollectionProducts() {
        this.collectionDraftProductIds = new Set(this.allProductsCache.map((product) => product.id));
        this.renderCollectionProductsModal();
    }

    clearCollectionProducts() {
        this.collectionDraftProductIds.clear();
        this.renderCollectionProductsModal();
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
        const glovoUrl = this.normalizeExternalUrl(this.pGlovoUrl?.value);
        const yandexProduct = this.parseSelectedYandexProduct();
        const yandexUrl = this.normalizeExternalUrl(this.pYandexUrl?.value || yandexProduct?.restaurantUrl);
        const mapUrl = this.normalizeExternalUrl(this.pMapUrl?.value);

        return {
            glovo: {
                enabled: Boolean(this.pGlovoEnabled?.checked && glovoUrl),
                url: glovoUrl,
                label: getDefaultProductLinkLabel('glovo')
            },
            yandex: {
                enabled: Boolean(this.pYandexEnabled?.checked && yandexUrl),
                url: yandexUrl,
                restaurantUrl: yandexUrl,
                label: getDefaultProductLinkLabel('yandex'),
                product: yandexProduct || null
            },
            map: {
                enabled: Boolean(this.pMapEnabled?.checked && mapUrl),
                url: mapUrl,
                label: 'View map locations'
            }
        };
    }

    mergeExternalLinksFromForm(product) {
        const existingLinks = normalizeProductExternalLinks(product || []);
        if (!this.pGlovoUrl && !this.pYandexUrl && !this.pMapUrl) return existingLinks;

        const quickLinks = this.readExternalLinksFromForm();
        const nextLinks = existingLinks.slice();

        ['glovo', 'yandex', 'map'].forEach((type) => {
            const formLink = quickLinks[type];
            const existingIndex = nextLinks.findIndex((link) => link.type === type);
            const existingLink = existingIndex >= 0 ? nextLinks[existingIndex] : null;

            if (!formLink?.url) {
                if (existingIndex >= 0) nextLinks.splice(existingIndex, 1);
                return;
            }

            const normalized = normalizeProductExternalLinkInput({
                ...existingLink,
                type,
                label: formLink.label,
                url: formLink.url,
                isEnabled: formLink.enabled === true
            }, {
                sortOrder: existingLink?.sortOrder || nextLinks.length + 1
            });

            if (existingIndex >= 0) nextLinks[existingIndex] = normalized;
            else nextLinks.push(normalized);
        });

        return normalizeProductExternalLinks(nextLinks);
    }

    getExternalLinkSummary(product) {
        const links = normalizeProductExternalLinks(product);
        const active = links.filter((link) => link.isEnabled === true);
        return active.length
            ? 'Product links: ' + active.length + ' enabled / ' + links.length + ' total'
            : 'Product links: none';
    }

    ensureProductLinksModal() {
        if (this.productLinksModal) return this.productLinksModal;

        const modal = document.createElement('div');
        modal.id = 'productLinksModal';
        modal.className = 'modal hidden';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-panel product-links-panel" role="dialog" aria-modal="true" aria-labelledby="productLinksTitle">
                <div class="modal-header">
                    <div>
                        <span class="modal-kicker">Product Links</span>
                        <h3 id="productLinksTitle">Product Links</h3>
                        <p id="productLinksSubtitle" class="product-links-subtitle"></p>
                    </div>
                    <button type="button" class="icon-button" data-action="close-product-links" aria-label="Close product links modal">&times;</button>
                </div>
                <div class="product-links-body">
                    <div id="productLinksError" class="inline-alert error product-links-error" hidden></div>
                    <section class="product-links-section">
                        <h4>Existing Links</h4>
                        <div id="productLinksExisting" class="product-links-list"></div>
                    </section>
                    <section class="product-links-section">
                        <h4 id="productLinkFormTitle">Add New Link</h4>
                        <form id="productLinkForm" class="product-link-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="productLinkType">Link Type</label>
                                    <select id="productLinkType"></select>
                                </div>
                                <div class="form-group">
                                    <label for="productLinkLabel">Label</label>
                                    <input type="text" id="productLinkLabel" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="productLinkUrl">URL</label>
                                <input type="url" id="productLinkUrl" placeholder="https://..." required>
                            </div>
                            <label class="product-link-enabled">
                                <input type="checkbox" id="productLinkEnabled" checked>
                                Enabled
                            </label>
                            <div class="product-link-form-actions">
                                <button type="submit" id="productLinkSaveBtn">Save Link</button>
                                <button type="button" class="btn-secondary" id="productLinkCancelBtn">Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.productLinksModal = modal;

        modal.querySelector('[data-action="close-product-links"]')?.addEventListener('click', () => this.closeProductLinksModal());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) this.closeProductLinksModal();
        });
        modal.querySelector('#productLinkForm')?.addEventListener('submit', (event) => this.saveProductLink(event));
        modal.querySelector('#productLinkCancelBtn')?.addEventListener('click', () => this.resetProductLinkForm());

        const typeSelect = modal.querySelector('#productLinkType');
        if (typeSelect) {
            typeSelect.innerHTML = PRODUCT_EXTERNAL_LINK_TYPES.map((type) => {
                return '<option value="' + type + '">' + this.escapeHtml(PRODUCT_LINK_TYPE_LABELS[type] || type) + '</option>';
            }).join('');
            typeSelect.addEventListener('change', () => this.applyDefaultProductLinkLabel());
        }

        const labelInput = modal.querySelector('#productLinkLabel');
        if (labelInput) {
            labelInput.addEventListener('input', () => {
                if (labelInput.value !== this.productLinksAutoLabel) {
                    this.productLinksAutoLabel = '';
                }
            });
        }

        return modal;
    }

    openProductLinksModal(productId) {
        const product = this.allProductsCache.find((item) => item.id === productId);
        if (!product) {
            alert('This product is not available for your company.');
            return;
        }

        const modal = this.ensureProductLinksModal();
        this.productLinksProduct = product;
        this.productLinksEditingId = '';
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        this.renderProductLinksModal();
        this.resetProductLinkForm();
    }

    closeProductLinksModal() {
        if (!this.productLinksModal) return;
        this.productLinksModal.classList.add('hidden');
        this.productLinksModal.setAttribute('aria-hidden', 'true');
        this.productLinksProduct = null;
        this.productLinksEditingId = '';
        this.productLinksAutoLabel = '';
    }

    renderProductLinksModal() {
        const modal = this.ensureProductLinksModal();
        const product = this.productLinksProduct;
        if (!product) return;

        const subtitle = modal.querySelector('#productLinksSubtitle');
        if (subtitle) subtitle.textContent = getPreferredProductName(product) || product.name_ru || product.id;

        const existing = modal.querySelector('#productLinksExisting');
        if (!existing) return;

        const links = normalizeProductExternalLinks(product);
        if (!links.length) {
            existing.innerHTML = '<div class="product-links-empty">No product links yet.</div>';
            return;
        }

        existing.innerHTML = links.map((link, index) => {
            return `
                <article class="product-link-row" data-id="${this.escapeHtml(link.id)}">
                    <div class="product-link-row-main">
                        <span class="product-link-type">${this.escapeHtml(PRODUCT_LINK_TYPE_LABELS[link.type] || link.type)}</span>
                        <strong>${this.escapeHtml(link.label)}</strong>
                        <a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(link.url)}</a>
                        <small>${link.isEnabled ? 'Enabled' : 'Disabled'}</small>
                    </div>
                    <div class="product-link-row-actions">
                        <button type="button" class="btn-secondary" data-action="move-up" ${index === 0 ? 'disabled' : ''}>Up</button>
                        <button type="button" class="btn-secondary" data-action="move-down" ${index === links.length - 1 ? 'disabled' : ''}>Down</button>
                        <button type="button" class="btn-secondary" data-action="toggle-link">${link.isEnabled ? 'Disable' : 'Enable'}</button>
                        <button type="button" class="btn-secondary" data-action="edit-link">Edit</button>
                        <button type="button" class="btn-danger" data-action="delete-link">Delete</button>
                    </div>
                </article>
            `;
        }).join('');

        existing.querySelectorAll('.product-link-row').forEach((row) => {
            const id = row.dataset.id;
            row.querySelector('[data-action="edit-link"]')?.addEventListener('click', () => this.editProductLink(id));
            row.querySelector('[data-action="delete-link"]')?.addEventListener('click', () => this.deleteProductLink(id));
            row.querySelector('[data-action="toggle-link"]')?.addEventListener('click', () => this.toggleProductLink(id));
            row.querySelector('[data-action="move-up"]')?.addEventListener('click', () => this.moveProductLink(id, -1));
            row.querySelector('[data-action="move-down"]')?.addEventListener('click', () => this.moveProductLink(id, 1));
        });
    }

    applyDefaultProductLinkLabel() {
        const modal = this.ensureProductLinksModal();
        const type = modal.querySelector('#productLinkType')?.value || 'other';
        const labelInput = modal.querySelector('#productLinkLabel');
        if (!labelInput) return;

        const nextLabel = getDefaultProductLinkLabel(type);
        if (!String(labelInput.value || '').trim() || labelInput.value === this.productLinksAutoLabel) {
            labelInput.value = nextLabel;
            this.productLinksAutoLabel = nextLabel;
        }
    }

    resetProductLinkForm() {
        const modal = this.ensureProductLinksModal();
        const formTitle = modal.querySelector('#productLinkFormTitle');
        const typeSelect = modal.querySelector('#productLinkType');
        const labelInput = modal.querySelector('#productLinkLabel');
        const urlInput = modal.querySelector('#productLinkUrl');
        const enabledInput = modal.querySelector('#productLinkEnabled');
        const cancelBtn = modal.querySelector('#productLinkCancelBtn');

        this.productLinksEditingId = '';
        this.setProductLinksError('');
        if (formTitle) formTitle.textContent = 'Add New Link';
        if (typeSelect) typeSelect.value = 'whatsapp';
        if (labelInput) labelInput.value = '';
        if (urlInput) urlInput.value = '';
        if (enabledInput) enabledInput.checked = true;
        if (cancelBtn) cancelBtn.style.display = 'none';
        this.productLinksAutoLabel = '';
        this.applyDefaultProductLinkLabel();
    }

    editProductLink(linkId) {
        const modal = this.ensureProductLinksModal();
        const link = normalizeProductExternalLinks(this.productLinksProduct).find((item) => item.id === linkId);
        if (!link) return;

        this.productLinksEditingId = linkId;
        this.setProductLinksError('');
        modal.querySelector('#productLinkFormTitle').textContent = 'Edit Link';
        modal.querySelector('#productLinkType').value = link.type;
        modal.querySelector('#productLinkLabel').value = link.label;
        modal.querySelector('#productLinkUrl').value = link.url;
        modal.querySelector('#productLinkEnabled').checked = link.isEnabled === true;
        modal.querySelector('#productLinkCancelBtn').style.display = 'inline-block';
        this.productLinksAutoLabel = getDefaultProductLinkLabel(link.type) === link.label ? link.label : '';
    }

    async saveProductLink(event) {
        event.preventDefault();
        const modal = this.ensureProductLinksModal();
        const product = this.productLinksProduct;
        if (!product) return;

        const saveBtn = modal.querySelector('#productLinkSaveBtn');
        const originalText = saveBtn ? saveBtn.textContent : '';
        const payload = {
            productId: product.id,
            companyId: getSelectedCompanyId(),
            linkId: this.productLinksEditingId,
            link: {
                type: modal.querySelector('#productLinkType')?.value || 'other',
                label: modal.querySelector('#productLinkLabel')?.value || '',
                url: modal.querySelector('#productLinkUrl')?.value || '',
                isEnabled: modal.querySelector('#productLinkEnabled')?.checked === true
            }
        };

        try {
            this.setProductLinksError('');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            const result = this.productLinksEditingId
                ? await updateProductExternalLinkIntent(payload)
                : await addProductExternalLinkIntent(payload);
            this.productLinksProduct.externalLinks = result.data.externalLinks;
            await logAudit(this.productLinksEditingId ? 'Product Link Updated' : 'Product Link Added', product.id);
            this.renderProductLinksModal();
            this.renderProductList();
            this.resetProductLinkForm();
        } catch (error) {
            console.error(error);
            this.setProductLinksError(error.message || 'Could not save product link.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText || 'Save Link';
            }
        }
    }

    async deleteProductLink(linkId) {
        const product = this.productLinksProduct;
        if (!product) return;
        if (!confirm('Delete this product link?')) return;

        try {
            const result = await deleteProductExternalLinkIntent({
                productId: product.id,
                companyId: getSelectedCompanyId(),
                linkId: linkId
            });
            this.productLinksProduct.externalLinks = result.data.externalLinks;
            await logAudit('Product Link Deleted', product.id);
            this.renderProductLinksModal();
            this.renderProductList();
            this.resetProductLinkForm();
        } catch (error) {
            console.error(error);
            this.setProductLinksError(error.message || 'Could not delete product link.');
        }
    }

    async toggleProductLink(linkId) {
        const product = this.productLinksProduct;
        if (!product) return;
        const link = normalizeProductExternalLinks(product).find((item) => item.id === linkId);
        if (!link) return;

        try {
            const result = await toggleProductExternalLinkIntent({
                productId: product.id,
                companyId: getSelectedCompanyId(),
                linkId: linkId,
                isEnabled: link.isEnabled !== true
            });
            this.productLinksProduct.externalLinks = result.data.externalLinks;
            await logAudit('Product Link Toggled', product.id);
            this.renderProductLinksModal();
            this.renderProductList();
        } catch (error) {
            console.error(error);
            this.setProductLinksError(error.message || 'Could not update product link.');
        }
    }

    async moveProductLink(linkId, direction) {
        const product = this.productLinksProduct;
        if (!product) return;
        const links = normalizeProductExternalLinks(product);
        const index = links.findIndex((item) => item.id === linkId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= links.length) return;

        const ordered = links.slice();
        const moved = ordered[index];
        ordered[index] = ordered[nextIndex];
        ordered[nextIndex] = moved;

        try {
            const result = await reorderProductExternalLinksIntent({
                productId: product.id,
                companyId: getSelectedCompanyId(),
                linkIds: ordered.map((item) => item.id)
            });
            this.productLinksProduct.externalLinks = result.data.externalLinks;
            await logAudit('Product Links Reordered', product.id);
            this.renderProductLinksModal();
            this.renderProductList();
        } catch (error) {
            console.error(error);
            this.setProductLinksError(error.message || 'Could not reorder product links.');
        }
    }

    setProductLinksError(message) {
        const modal = this.ensureProductLinksModal();
        const errorBox = modal.querySelector('#productLinksError');
        if (!errorBox) return;
        errorBox.textContent = message || '';
        errorBox.hidden = !message;
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
        const existingProduct = isEdit ? this.allProductsCache.find(product => product.id === this.pId.value) : null;
        if (isEdit && !existingProduct) {
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
                externalLinks: this.mergeExternalLinksFromForm(existingProduct),
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
        const normalizedLinks = normalizeProductExternalLinks(p);
        const glovoLink = normalizedLinks.find((link) => link.type === 'glovo');
        const yandexLink = normalizedLinks.find((link) => link.type === 'yandex');
        const mapLink = normalizedLinks.find((link) => link.type === 'map');
        const legacyYandexProduct = !Array.isArray(p.externalLinks) ? p.externalLinks?.yandex?.product || null : null;
        if (this.pGlovoUrl) this.pGlovoUrl.value = glovoLink?.url || '';
        if (this.pGlovoEnabled) this.pGlovoEnabled.checked = glovoLink?.isEnabled === true;
        if (this.pYandexUrl) this.pYandexUrl.value = yandexLink?.url || '';
        if (this.pYandexEnabled) this.pYandexEnabled.checked = yandexLink?.isEnabled === true;
        if (this.pYandexSelectedJson) this.pYandexSelectedJson.value = legacyYandexProduct ? JSON.stringify(legacyYandexProduct) : '';
        this.renderYandexSelectedProduct(legacyYandexProduct);
        if (this.pMapUrl) this.pMapUrl.value = mapLink?.url || '';
        if (this.pMapEnabled) this.pMapEnabled.checked = mapLink?.isEnabled === true;
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
