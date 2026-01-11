import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { logAudit } from '../utils.js';
import {
    collection, getDocs, getDoc, doc, setDoc, addDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class InventoryTab extends BaseTab {
    constructor() {
        super('inventory');

        // UI Elements
        this.dateInput = document.getElementById('invDate');
        this.loadBtn = document.getElementById('loadInvBtn');
        this.saveBtn = document.getElementById('saveInvBtn');
        this.accordion = document.getElementById('catalogAccordion');
        this.menuList = document.getElementById('todayMenuList');
        this.status = document.getElementById('invStatus');

        // Templates & Actions
        this.templateSelect = document.getElementById('templateSelect');
        this.btnLoadTemplate = document.getElementById('btnLoadTemplate');
        this.btnSaveTemplate = document.getElementById('btnSaveTemplate');
        this.btnClear = document.getElementById('btnClearInventory');
        this.copyDateInput = document.getElementById('copyFromDate');
        this.btnCopyDate = document.getElementById('btnCopyDate');

        // State
        this.inventoryCache = {}; // { pid: { available, sold } }
        this.selectedProducts = new Set();
        this.productsCache = [];
        this.categoriesMap = {};
    }

    async init() {
        // Default Date
        if (this.dateInput) this.dateInput.valueAsDate = new Date();

        this.bindEvents();
        this.fetchTemplates();
    }

    bindEvents() {
        if (this.loadBtn) this.loadBtn.addEventListener('click', () => this.loadInventory());
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.saveInventory());

        if (this.btnSaveTemplate) this.btnSaveTemplate.addEventListener('click', () => this.saveTemplate());
        if (this.btnLoadTemplate) this.btnLoadTemplate.addEventListener('click', () => this.loadTemplate());
        if (this.btnCopyDate) this.btnCopyDate.addEventListener('click', () => this.copyFromDate());
        if (this.btnClear) this.btnClear.addEventListener('click', () => this.clearSelection());
    }

    async ensureDataLoaded() {
        // Products
        if (this.productsCache.length === 0) {
            const snaps = await getDocs(collection(db, 'products'));
            this.productsCache = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        // Categories
        if (Object.keys(this.categoriesMap).length === 0) {
            const snaps = await getDocs(collection(db, 'categories'));
            snaps.docs.forEach(d => this.categoriesMap[d.id] = d.data());
        }
    }

    async loadInventory() {
        const dateStr = this.dateInput.value;
        if (!dateStr) return alert("Select a date");

        this.loadBtn.textContent = 'Loading...';
        this.loadBtn.disabled = true;

        try {
            await this.ensureDataLoaded();

            const snap = await getDoc(doc(db, 'inventory', dateStr));

            this.selectedProducts.clear();
            this.inventoryCache = {};

            if (snap.exists()) {
                this.inventoryCache = snap.data();
                Object.keys(this.inventoryCache).forEach(pid => this.selectedProducts.add(pid));
                this.setStatus(`Loaded inventory for ${dateStr}`);
            } else {
                this.setStatus(`No inventory for ${dateStr}. Select items to start.`);
            }

            this.renderAccordion();
            this.renderMenu();

        } catch (e) {
            console.error(e);
            alert(e.message);
        } finally {
            this.loadBtn.textContent = 'Load Inventory';
            this.loadBtn.disabled = false;
        }
    }

    renderAccordion() {
        if (!this.accordion) return;
        this.accordion.innerHTML = '';

        // Grouping
        const grouped = {};
        Object.keys(this.categoriesMap).forEach(cid => {
            grouped[cid] = { name: this.categoriesMap[cid].name_ru || 'Category', products: [] };
        });

        this.productsCache.forEach(p => {
            const cid = p.categoryId;
            if (grouped[cid]) grouped[cid].products.push(p);
            else {
                if (!grouped['other']) grouped['other'] = { name: 'Other', products: [] };
                grouped['other'].products.push(p);
            }
        });

        Object.values(grouped).forEach(group => {
            if (group.products.length === 0) return;

            const item = document.createElement('div');
            item.className = 'accordion-item';

            // Header
            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.innerHTML = `<span>${group.name}</span> <span>▼</span>`;
            header.onclick = () => {
                const content = item.querySelector('.accordion-content');
                const isActive = content.classList.contains('active');
                this.accordion.querySelectorAll('.accordion-content').forEach(c => c.classList.remove('active'));
                if (!isActive) content.classList.add('active');
            };

            // Content
            const content = document.createElement('div');
            content.className = 'accordion-content';

            group.products.forEach(p => {
                const row = document.createElement('div');
                row.className = 'cat-product-row';
                const isChecked = this.selectedProducts.has(p.id);

                row.innerHTML = `
                    <label style="display:flex; align-items:center; width:100%; cursor:pointer;">
                        <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} style="margin-right:10px;">
                        <div>
                            <div style="font-weight:600;">${p.name_en || p.name_ru}</div>
                            <div style="font-size:0.8rem; color:#888;">${p.weight}</div>
                        </div>
                    </label>
                `;

                row.querySelector('input').addEventListener('change', (e) => {
                    this.toggleProduct(p.id, e.target.checked);
                });
                content.appendChild(row);
            });

            item.appendChild(header);
            item.appendChild(content);
            this.accordion.appendChild(item);
        });
    }

    captureCurrentInputs() {
        document.querySelectorAll('.inv-qty-input').forEach(input => {
            const pid = input.dataset.id;
            const qty = parseInt(input.value) || 0;
            if (this.inventoryCache[pid]) {
                this.inventoryCache[pid].available = qty;
            }
        });
    }

    toggleProduct(pid, isSelected) {
        this.captureCurrentInputs();
        if (isSelected) {
            this.selectedProducts.add(pid);
            if (!this.inventoryCache[pid]) this.inventoryCache[pid] = { available: 0, sold: 0 };
        } else {
            this.selectedProducts.delete(pid);
        }
        this.renderMenu();
    }

    renderMenu() {
        if (!this.menuList) return;
        this.menuList.innerHTML = '';

        if (this.selectedProducts.size === 0) {
            this.menuList.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:#999;">No items selected.</td></tr>';
            return;
        }

        this.selectedProducts.forEach(pid => {
            const p = this.productsCache.find(x => x.id === pid);
            if (!p) return;
            const data = this.inventoryCache[pid] || { available: 0, sold: 0 };

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #eee';
            row.innerHTML = `
                <td style="padding:8px;"><strong>${p.name_en || p.name_ru}</strong></td>
                <td style="padding:8px;">
                    <input type="number" class="inv-qty-input" data-id="${pid}" 
                        value="${data.available}" min="0" style="width:70px;">
                </td>
                <td style="padding:8px; color:#555;">${data.sold || 0}</td>
            `;
            this.menuList.appendChild(row);
        });
    }

    async saveInventory() {
        const dateStr = this.dateInput.value;
        if (!dateStr) return;

        this.saveBtn.innerText = 'Saving...';
        this.saveBtn.disabled = true;

        try {
            const updateData = {};
            // Capture Inputs
            document.querySelectorAll('.inv-qty-input').forEach(input => {
                const pid = input.dataset.id;
                const qty = parseInt(input.value) || 0;
                const existing = this.inventoryCache[pid] || {};
                if (this.selectedProducts.has(pid)) {
                    updateData[pid] = {
                        available: qty,
                        sold: existing.sold || 0,
                        price: this.productsCache.find(x => x.id === pid)?.price || 0
                    };
                }
            });
            // Note: If item selected but not in DOM? (Shouldn't happen with renderMenu)
            // If item unchecked, it's not in selectedProducts, so not saved (deleted from day).

            await setDoc(doc(db, 'inventory', dateStr), updateData);
            this.inventoryCache = updateData;
            await logAudit('Inventory Saved', `Date: ${dateStr}`);
            this.setStatus('Saved successfully!', true);

        } catch (e) {
            console.error(e);
            alert(e.message);
        } finally {
            this.saveBtn.innerHTML = '💾 Save Inventory';
            this.saveBtn.disabled = false;
        }
    }

    /* --- Templates --- */
    async fetchTemplates() {
        if (!this.templateSelect) return;
        try {
            const snap = await getDocs(query(collection(db, 'inventory_templates'), orderBy('name')));
            this.templateSelect.innerHTML = '<option value="">-- Select Template --</option>';
            snap.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.data().name;
                this.templateSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    async saveTemplate() {
        if (this.selectedProducts.size === 0) return alert("Select products first.");
        const name = prompt("Template Name:");
        if (!name) return;

        const data = {};
        this.selectedProducts.forEach(pid => {
            const existing = this.inventoryCache[pid] || { available: 0 };
            data[pid] = existing.available || 0;
        });

        try {
            await addDoc(collection(db, 'inventory_templates'), { name, items: data, createdAt: serverTimestamp() });
            alert("Template Saved!");
            this.fetchTemplates();
        } catch (e) { alert(e.message); }
    }

    async loadTemplate() {
        const id = this.templateSelect.value;
        if (!id) return alert("Select a template");

        const snap = await getDoc(doc(db, 'inventory_templates', id));
        if (snap.exists()) {
            await this.ensureDataLoaded(); // Ensure we have products to display
            this.applyData(snap.data().items);
            this.setStatus(`Loaded template: ${snap.data().name}`);
        }
    }

    async copyFromDate() {
        const dateStr = this.copyDateInput.value;
        if (!dateStr) return alert("Select date");

        const snap = await getDoc(doc(db, 'inventory', dateStr));
        if (snap.exists()) {
            await this.ensureDataLoaded();
            const raw = snap.data();
            const clean = {};
            Object.keys(raw).forEach(k => clean[k] = raw[k].available || 0);
            this.applyData(clean);
            this.setStatus(`Copied stock from ${dateStr}`);
        } else {
            alert("No inventory found.");
        }
    }

    applyData(itemsMap) {
        this.selectedProducts.clear();
        this.inventoryCache = {};
        Object.keys(itemsMap).forEach(pid => {
            this.selectedProducts.add(pid);
            this.inventoryCache[pid] = { available: itemsMap[pid], sold: 0 };
        });

        // Sync Checkboxes (Re-render accordion to be easy)
        this.renderAccordion(); // Re-builds checks
        this.renderMenu();
    }

    clearSelection() {
        if (!confirm("Clear selections?")) return;
        this.selectedProducts.clear();
        this.inventoryCache = {};
        this.renderAccordion();
        this.renderMenu();
        this.status.style.display = 'none';
    }

    setStatus(msg, isSuccess = false) {
        if (!this.status) return;
        this.status.textContent = msg;
        this.status.style.display = 'block';
        this.status.style.background = isSuccess ? '#e8f5e9' : '#fff3e0';
        this.status.style.color = isSuccess ? '#2e7d32' : '#e65100';
    }
}
