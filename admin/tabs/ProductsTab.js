import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { uploadImage, logAudit } from '../utils.js';
import {
    collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, getDoc, serverTimestamp
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

        // Image UI
        this.pPreviewPack = document.getElementById('pPreviewPack');
        this.pPreviewContent = document.getElementById('pPreviewContent');
        this.previewContainerPack = document.getElementById('previewContainerPack');
        this.previewContainerContent = document.getElementById('previewContainerContent');
        this.fNamePack = document.getElementById('fNamePack');
        this.fNameContent = document.getElementById('fNameContent');
        this.filePack = document.getElementById('pImgPack');
        this.fileContent = document.getElementById('pImgContent');

        this.allProductsCache = [];
    }

    async init() {
        window.editProduct = this.editProduct.bind(this);
        window.deleteProduct = this.deleteProduct.bind(this);

        this.bindEvents();
        this.loadCategories(); // Populates dropdowns
        this.loadProducts();
    }

    bindEvents() {
        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.resetForm());

        // File Previews
        this.handleFileSelect(this.filePack, this.pPreviewPack, this.previewContainerPack, this.fNamePack);
        this.handleFileSelect(this.fileContent, this.pPreviewContent, this.previewContainerContent, this.fNameContent);

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

    async loadCategories() {
        // Populate Product Form Category Select & Filter
        onSnapshot(collection(db, 'categories'), (snapshot) => {
            const catSelect = document.getElementById('pCategory');
            const filterSelect = document.getElementById('filterCategory');

            // Preserve filter selection?
            const currentFilter = filterSelect ? filterSelect.value : 'all';

            if (catSelect) catSelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
            if (filterSelect) filterSelect.innerHTML = '<option value="all">All Categories</option>';

            const sorted = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
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
        onSnapshot(query(collection(db, 'products')), (snapshot) => {
            this.allProductsCache = [];
            snapshot.forEach(docSnap => {
                this.allProductsCache.push({ id: docSnap.id, ...docSnap.data() });
            });
            this.renderProductList();
        });
    }

    renderProductList() {
        if (!this.list) return;
        this.list.innerHTML = '';

        const filterVal = document.getElementById('filterCategory')?.value || 'all';
        const filtered = (filterVal === 'all')
            ? this.allProductsCache
            : this.allProductsCache.filter(p => p.categoryId === filterVal);

        filtered.forEach(p => {
            const el = document.createElement('div');
            el.className = 'list-item';
            el.innerHTML = `
                <img src="${p.imageUrl}" class="preview-img">
                <div style="flex:1; margin-left:1rem;">
                    <strong>${p.name_ru || 'No Name'}</strong><br>
                    ${p.price} som | ${p.weight}
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary" title="Edit" onclick="editProduct('${p.id}')">✏️</button>
                    <button class="btn-danger" title="Delete" onclick="deleteProduct('${p.id}')">🗑️</button>
                </div>
            `;
            this.list.appendChild(el);
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const filePack = this.filePack.files[0];
        const fileContent = this.fileContent.files[0];
        const isEdit = !!this.pId.value;

        if (!isEdit && !filePack) { alert('Packaging image required for new product'); return; }

        try {
            let imageUrl = null;
            let imageNoPackagingUrl = null;

            if (filePack) imageUrl = await uploadImage(filePack);
            if (fileContent) imageNoPackagingUrl = await uploadImage(fileContent);

            const data = {
                name_ru: document.getElementById('pNameRU').value,
                name_en: document.getElementById('pNameEN').value,
                name_kg: document.getElementById('pNameKG').value,
                price: Number(document.getElementById('pPrice').value),
                weight: document.getElementById('pWeight').value,
                categoryId: document.getElementById('pCategory').value,
                description_ru: document.getElementById('pDescRU').value,
                description_en: document.getElementById('pDescEN').value,
                description_kg: document.getElementById('pDescKG').value,
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
    }

    async editProduct(id) {
        const p = this.allProductsCache.find(x => x.id === id);
        if (!p) return;

        this.pId.value = id;
        document.getElementById('pNameRU').value = p.name_ru || '';
        document.getElementById('pNameEN').value = p.name_en || '';
        document.getElementById('pNameKG').value = p.name_kg || '';
        document.getElementById('pPrice').value = p.price || '';
        document.getElementById('pWeight').value = p.weight || '';
        document.getElementById('pCategory').value = p.categoryId || '';
        document.getElementById('pDescRU').value = p.description_ru || '';
        document.getElementById('pDescEN').value = p.description_en || '';
        document.getElementById('pDescKG').value = p.description_kg || '';

        // Show Images
        if (p.imageUrl) {
            this.pPreviewPack.src = p.imageUrl;
            this.previewContainerPack.style.display = 'flex';
            this.fNamePack.textContent = 'Existing Image';
        }
        if (p.imageNoPackagingUrl) {
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
        if (confirm('Delete this product?')) {
            await deleteDoc(doc(db, 'products', id));
            await logAudit('Product Deleted', `ID: ${id}`);
        }
    }
}
