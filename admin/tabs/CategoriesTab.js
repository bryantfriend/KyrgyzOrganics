import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import {
    collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class CategoriesTab extends BaseTab {
    constructor() {
        super('categories');
        // Form Elements
        this.form = document.getElementById('categoryForm');
        this.list = document.getElementById('categoryList');
        this.submitBtn = document.getElementById('cSubmitBtn');
        this.cancelBtn = document.getElementById('cCancelBtn');
        this.formTitle = document.getElementById('catFormTitle');

        // Inputs
        this.cId = document.getElementById('cId');
        this.cNameRU = document.getElementById('cNameRU');
        this.cNameEN = document.getElementById('cNameEN');
        this.cNameKG = document.getElementById('cNameKG');
        this.cStyleBg = document.getElementById('cStyleBg');
        this.cStyleBorder = document.getElementById('cStyleBorder');
        this.cStyleColor = document.getElementById('cStyleColor');
        this.cActive = document.getElementById('cActive');
        this.catPreview = document.getElementById('catPreview');
    }

    async init() {
        // Expose global helpers for inline onclicks (migration path)
        window.editCategory = this.editCategory.bind(this);
        window.deleteCategory = this.deleteCategory.bind(this);

        this.bindEvents();
        this.loadCategories();
        this.updatePreview(); // Initial state
    }

    bindEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.resetForm());
        }

        // Live Preview Listeners
        [this.cNameRU, this.cNameEN, this.cStyleBg, this.cStyleBorder, this.cStyleColor].forEach(el => {
            if (el) el.addEventListener('input', () => this.updatePreview());
        });
    }

    updatePreview() {
        if (!this.catPreview) return;
        this.catPreview.style.background = this.cStyleBg.value;
        this.catPreview.style.borderColor = this.cStyleBorder.value;
        this.catPreview.style.borderStyle = 'solid';
        this.catPreview.style.borderWidth = '1px';
        this.catPreview.style.color = this.cStyleColor.value;
        this.catPreview.textContent = this.cNameEN.value || this.cNameRU.value || 'Category Name';
    }

    resetForm() {
        this.form.reset();
        this.cId.value = '';
        this.submitBtn.textContent = 'Add Category';
        this.formTitle.textContent = 'Add Category';
        this.cancelBtn.style.display = 'none';
        this.updatePreview();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const data = {
            name_ru: this.cNameRU.value,
            name_en: this.cNameEN.value,
            name_kg: this.cNameKG.value,
            style_bg: this.cStyleBg.value,
            style_border: this.cStyleBorder.value,
            style_color: this.cStyleColor.value,
            active: this.cActive.checked
        };

        try {
            if (this.cId.value) {
                await updateDoc(doc(db, 'categories', this.cId.value), data);
                alert('Category Updated');
            } else {
                await addDoc(collection(db, 'categories'), data);
                alert('Category Created');
            }
            this.resetForm();
        } catch (err) {
            console.error(err);
            alert('Error saving category');
        }
    }

    async editCategory(id) {
        const docSnap = await getDoc(doc(db, 'categories', id));
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        this.cId.value = id;
        this.cNameRU.value = data.name_ru || '';
        this.cNameEN.value = data.name_en || '';
        if (this.cNameKG) this.cNameKG.value = data.name_kg || '';
        this.cStyleBg.value = data.style_bg || '#ffffff';
        this.cStyleBorder.value = data.style_border || '#000000';
        this.cStyleColor.value = data.style_color || '#000000';
        this.cActive.checked = data.active !== false;

        this.updatePreview();

        this.submitBtn.textContent = 'Update Category';
        this.formTitle.textContent = 'Edit Category';
        this.cancelBtn.style.display = 'inline-block';

        this.form.scrollIntoView({ behavior: 'smooth' });
    }

    async deleteCategory(id) {
        if (confirm('Delete this category?')) {
            await deleteDoc(doc(db, 'categories', id));
        }
    }

    loadCategories() {
        if (!this.list) return;
        const q = query(collection(db, 'categories'), orderBy('name_ru'));

        onSnapshot(q, snapshot => {
            this.list.innerHTML = '';
            snapshot.forEach(docSnap => {
                const c = docSnap.data();
                const el = document.createElement('div');
                el.className = 'list-item';

                const style = `background:${c.style_bg}; border:1px solid ${c.style_border}; color:${c.style_color}; padding:0.25rem 0.75rem; border-radius:50px; display:inline-block; margin-right:10px; font-size:0.9rem;`;

                el.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <div style="${style}">${c.name_en || c.name_ru || 'Category'}</div>
                    </div>
                    <div>
                         <button class="btn-secondary" title="Edit" onclick="editCategory('${docSnap.id}')">✏️</button>
                         <button class="btn-danger" title="Delete" onclick="deleteCategory('${docSnap.id}')">🗑️</button>
                    </div>
                `;
                this.list.appendChild(el);
            });
        });
    }
}
