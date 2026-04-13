import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { COMPANY_ID } from '../../company-config.js';
import { getSelectedCompanyId, setSelectedCompany } from '../../store-context.js';
import { getInventoryDocId } from '../../firestore-paths.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function toLocalDateId(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTags(raw) {
  return String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export class StoresTab extends BaseTab {
  constructor() {
    super('stores');

    this.searchInput = document.getElementById('storesSearch');
    this.table = document.getElementById('storesTable');
    this.refreshMetricsBtn = document.getElementById('refreshStoreMetrics');

    this.formTitle = document.getElementById('storeFormTitle');
    this.form = document.getElementById('storeForm');
    this.editId = document.getElementById('storeEditId');
    this.companyId = document.getElementById('storeCompanyId');
    this.name = document.getElementById('storeName');
    this.plan = document.getElementById('storePlan');
    this.contactName = document.getElementById('storeContactName');
    this.phone = document.getElementById('storePhone');
    this.address = document.getElementById('storeAddress');
    this.twoGisLink = document.getElementById('storeTwoGis');
    this.website = document.getElementById('storeWebsite');
    this.tags = document.getElementById('storeTags');
    this.notes = document.getElementById('storeNotes');
    this.active = document.getElementById('storeActive');
    this.cancelBtn = document.getElementById('storeCancelBtn');

    // Users (basic)
    this.userForm = document.getElementById('storeUserForm');
    this.userUid = document.getElementById('userUid');
    this.userEmail = document.getElementById('userEmail');
    this.userCompanyId = document.getElementById('userCompanyId');
    this.userRole = document.getElementById('userRole');
    this.usersList = document.getElementById('storeUsersList');

    this.unsubscribeStores = null;
    this.stores = [];

    this.metricsCache = new Map(); // companyId -> metrics
    this.metricsInFlight = new Set();
    this.metricsQueue = [];
    this.metricsActive = 0;
    this.metricsConcurrency = 4;
  }

  async init() {
    this.bindEvents();
    this.subscribeStores();
    this.hydrateUserCompanyInput();
    this.loadUsersForSelectedCompany();

    window.addEventListener('oako:store-changed', () => {
      this.hydrateUserCompanyInput();
      this.loadUsersForSelectedCompany();
      this.render();
    });
  }

  onShow() {
    this.hydrateUserCompanyInput();
    this.render();
  }

  onStoreChanged() {
    // Called by AdminApp on global store change.
    this.hydrateUserCompanyInput();
    this.loadUsersForSelectedCompany();
    this.render();
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.render());
    }

    if (this.refreshMetricsBtn) {
      this.refreshMetricsBtn.addEventListener('click', () => {
        this.metricsCache.clear();
        this.metricsQueue = [];
        this.render();
      });
    }

    if (this.table) {
      this.table.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!action || !id) return;

        if (action === 'edit') this.editStore(id);
        if (action === 'switch') setSelectedCompany(id);
        if (action === 'metrics') this.ensureMetricsLoaded(id);
      });
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => this.saveStore(e));
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.resetForm());
    }

    if (this.userForm) {
      this.userForm.addEventListener('submit', (e) => this.saveUserProfile(e));
    }
  }

  hydrateUserCompanyInput() {
    if (this.userCompanyId) {
      this.userCompanyId.value = getSelectedCompanyId();
    }
  }

  subscribeStores() {
    try {
      const q = query(collection(db, 'companies'), orderBy('name', 'asc'));

      if (this.unsubscribeStores) {
        this.unsubscribeStores();
      }

      this.unsubscribeStores = onSnapshot(q, (snap) => {
        this.stores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.render();
      }, (err) => {
        console.error('Stores snapshot error:', err);
        if (this.table) {
          this.table.innerHTML = `<tbody><tr><td style="padding:10px; color:red;">Error loading stores: ${err.message}</td></tr></tbody>`;
        }
      });
    } catch (e) {
      console.error(e);
    }
  }

  getFilteredStores() {
    const term = String(this.searchInput?.value || '').trim().toLowerCase();
    const stores = Array.isArray(this.stores) ? this.stores : [];
    if (!term) return stores;

    return stores.filter((store) => {
      const blob = `${store.name || ''} ${store.contactName || ''} ${store.phone || ''} ${store.address || ''} ${store.companyId || store.id || ''}`.toLowerCase();
      return blob.includes(term);
    });
  }

  render() {
    if (!this.table) return;

    const selected = getSelectedCompanyId();
    const stores = this.getFilteredStores();

    const header = `
      <thead>
        <tr style="background:#f5f5f5; text-align:left;">
          <th style="padding:10px; border-bottom:2px solid #ddd;">Store</th>
          <th style="padding:10px; border-bottom:2px solid #ddd;">Contact</th>
          <th style="padding:10px; border-bottom:2px solid #ddd;">Plan</th>
          <th style="padding:10px; border-bottom:2px solid #ddd;">Website</th>
          <th style="padding:10px; border-bottom:2px solid #ddd;">Metrics</th>
          <th style="padding:10px; border-bottom:2px solid #ddd;">Alerts</th>
          <th style="padding:10px; border-bottom:2px solid #ddd;">Actions</th>
        </tr>
      </thead>
    `;

    const rows = stores.map((store) => {
      const id = store.companyId || store.id;
      const metrics = this.metricsCache.get(id);

      // Kick off async metrics load (lazy, cached)
      if (!metrics) this.ensureMetricsLoaded(id);

      const ordersCount = metrics?.ordersCount ?? '...';
      const revenue = metrics?.revenue != null ? `${metrics.revenue} som` : '...';
      const productsCount = metrics?.productsCount ?? '...';

      const alertParts = [];
      if (store.active === false) alertParts.push('Inactive');
      if (metrics?.noOrders3d === true) alertParts.push('No orders 3d');
      if (typeof metrics?.lowInventoryCount === 'number' && metrics.lowInventoryCount > 0) alertParts.push(`Low inv: ${metrics.lowInventoryCount}`);

      const alerts = alertParts.length ? alertParts.join(' • ') : 'OK';
      const isSelected = id === selected;

      return `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
              <strong>${store.name || id}</strong>
              <span style="font-size:0.85rem; color:#666;">${id}${isSelected ? ' • selected' : ''}</span>
              ${Array.isArray(store.tags) && store.tags.length ? `<span style="font-size:0.8rem; color:#888;">Tags: ${store.tags.join(', ')}</span>` : ''}
            </div>
          </td>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
              <span>${store.contactName || ''}</span>
              <span style="font-size:0.85rem; color:#666;">${store.phone || ''}</span>
              <span style="font-size:0.8rem; color:#888;">${store.address || ''}</span>
            </div>
          </td>
          <td style="padding:10px; border-bottom:1px solid #eee;">${store.plan || 'free'}</td>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            ${store.website ? `<a href="${store.website.startsWith('http') ? store.website : `https://${store.website}`}" target="_blank" rel="noopener" style="color:#2e7d32; font-weight:700; text-decoration:none;">${store.website}</a>` : ''}
          </td>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
              <span><strong>${ordersCount}</strong> orders</span>
              <span><strong>${revenue}</strong> revenue</span>
              <span><strong>${productsCount}</strong> products</span>
            </div>
          </td>
          <td style="padding:10px; border-bottom:1px solid #eee; color:${alerts === 'OK' ? '#2e7d32' : '#c62828'}; font-weight:700;">${alerts}</td>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn-secondary" data-action="switch" data-id="${id}">Switch</button>
              <button type="button" class="btn-secondary" data-action="edit" data-id="${id}">Edit</button>
              <button type="button" class="btn-secondary" data-action="metrics" data-id="${id}">Metrics</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.table.innerHTML = header + `<tbody>${rows || `<tr><td style="padding:10px; color:#666;" colspan="7">No stores found.</td></tr>`}</tbody>`;
  }

  async ensureMetricsLoaded(companyId) {
    if (!companyId) return;
    if (this.metricsCache.has(companyId)) return;
    if (this.metricsInFlight.has(companyId)) return;

    this.metricsInFlight.add(companyId);
    this.metricsQueue.push(companyId);
    this.processMetricsQueue();
  }

  processMetricsQueue() {
    while (this.metricsActive < this.metricsConcurrency && this.metricsQueue.length > 0) {
      const companyId = this.metricsQueue.shift();
      this.metricsActive += 1;
      this.loadMetricsForCompany(companyId)
        .catch(() => {})
        .finally(() => {
          this.metricsActive = Math.max(0, this.metricsActive - 1);
          this.metricsInFlight.delete(companyId);
          this.render();
          this.processMetricsQueue();
        });
    }
  }

  async loadMetricsForCompany(companyId) {
    try {
      const ordersBase = query(collection(db, 'orders'), where('companyId', '==', companyId));
      const productsBase = query(collection(db, 'products'), where('companyId', '==', companyId));

      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const [ordersSnap, productsSnap, lowInv] = await Promise.all([
        getDocs(ordersBase),
        getDocs(productsBase),
        this.computeLowInventory(companyId).catch(() => null)
      ]);

      const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const ordersCount = orders.length;
      const productsCount = products.length;
      const revenue = orders.reduce((sum, order) => {
        const value = Number(order.total ?? order.price ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);

      const recentCount = orders.filter((order) => {
        const createdAt = typeof order.createdAt?.toDate === 'function'
          ? order.createdAt.toDate()
          : (order.createdAt ? new Date(order.createdAt) : null);
        return createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
      }).length;
      const noOrders3d = ordersCount > 0 ? recentCount === 0 : true;

      this.metricsCache.set(companyId, {
        ordersCount,
        revenue,
        productsCount,
        noOrders3d,
        lowInventoryCount: lowInv,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Metrics load failed for', companyId, e);
      this.metricsCache.set(companyId, {
        ordersCount: 'ERR',
        revenue: 'ERR',
        productsCount: 'ERR',
        noOrders3d: null,
        lowInventoryCount: null,
        updatedAt: Date.now()
      });
    }
  }

  async computeLowInventory(companyId) {
    const today = toLocalDateId(new Date());
    const newId = getInventoryDocId(companyId, today);
    let invSnap = await getDoc(doc(db, 'inventory', newId));

    // Back-compat for the legacy single-tenant inventory format.
    if (!invSnap.exists() && companyId === COMPANY_ID) {
      invSnap = await getDoc(doc(db, 'inventory', today));
    }

    if (!invSnap.exists()) return 0;

    const data = invSnap.data() || {};
    let low = 0;
    Object.keys(data).forEach((key) => {
      if (key === 'companyId') return;
      const entry = data[key];
      const available = typeof entry === 'object' && entry
        ? Number(entry.available ?? entry.qty ?? entry.quantity ?? 0)
        : Number(entry ?? 0);

      if (Number.isFinite(available) && available <= 3) {
        low += 1;
      }
    });
    return low;
  }

  resetForm() {
    if (!this.form) return;
    this.form.reset();
    if (this.editId) this.editId.value = '';
    if (this.companyId) {
      this.companyId.disabled = false;
      this.companyId.value = '';
    }
    if (this.formTitle) this.formTitle.textContent = 'Create Store';
    if (this.active) this.active.checked = true;
  }

  editStore(companyId) {
    const store = this.stores.find((s) => (s.companyId || s.id) === companyId);
    if (!store) return;

    if (this.editId) this.editId.value = companyId;
    if (this.companyId) {
      this.companyId.value = companyId;
      this.companyId.disabled = true;
    }
    if (this.name) this.name.value = store.name || '';
    if (this.plan) this.plan.value = store.plan || 'free';
    if (this.contactName) this.contactName.value = store.contactName || '';
    if (this.phone) this.phone.value = store.phone || '';
    if (this.address) this.address.value = store.address || '';
    if (this.twoGisLink) this.twoGisLink.value = store.twoGisLink || '';
    if (this.website) this.website.value = store.website || '';
    if (this.tags) this.tags.value = Array.isArray(store.tags) ? store.tags.join(', ') : '';
    if (this.notes) this.notes.value = store.notes || '';
    if (this.active) this.active.checked = store.active !== false;
    if (this.formTitle) this.formTitle.textContent = `Edit Store: ${store.name || companyId}`;
    this.form?.scrollIntoView?.({ behavior: 'smooth' });
  }

  async saveStore(e) {
    e.preventDefault();
    const companyIdRaw = String(this.companyId?.value || '').trim();
    if (!companyIdRaw) return alert('Company ID is required.');

    const companyId = companyIdRaw.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!companyId) return alert('Company ID is invalid.');

    const isEdit = !!(this.editId?.value);

    const storeData = {
      companyId,
      name: String(this.name?.value || '').trim(),
      slug: companyId,
      plan: String(this.plan?.value || 'free'),
      contactName: String(this.contactName?.value || '').trim(),
      phone: String(this.phone?.value || '').trim(),
      address: String(this.address?.value || '').trim(),
      twoGisLink: String(this.twoGisLink?.value || '').trim(),
      website: String(this.website?.value || '').trim(),
      tags: parseTags(this.tags?.value),
      notes: String(this.notes?.value || '').trim(),
      active: this.active ? !!this.active.checked : true,
      updatedAt: serverTimestamp()
    };

    try {
      const ref = doc(db, 'companies', companyId);
      const existing = await getDoc(ref);
      await setDoc(ref, {
        ...storeData,
        ...(existing.exists() || isEdit ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });

      alert('Store saved.');
      this.resetForm();
    } catch (err) {
      console.error(err);
      alert('Failed to save store: ' + err.message);
    }
  }

  async loadUsersForSelectedCompany() {
    if (!this.usersList) return;

    const companyId = getSelectedCompanyId();
    this.usersList.innerHTML = '<p style="color:#666;">Loading users...</p>';

    try {
      let snap;
      try {
        const q = query(collection(db, 'users'), where('companyId', '==', companyId), orderBy('email', 'asc'));
        snap = await getDocs(q);
      } catch (e) {
        if (!String(e?.message || '').includes('index')) throw e;
        const q2 = query(collection(db, 'users'), where('companyId', '==', companyId));
        snap = await getDocs(q2);
      }

      const users = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));

      if (!users.length) {
        this.usersList.innerHTML = '<p style="color:#666;">No users found for this store.</p>';
        return;
      }

      this.usersList.innerHTML = '';
      users.forEach((u) => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:0.15rem;">
            <strong>${u.email || u.id}</strong>
            <span style="font-size:0.85rem; color:#666;">UID: ${u.id}</span>
            <span style="font-size:0.8rem; color:#888;">Role: ${u.role || 'admin'}</span>
          </div>
          <div>
            <button class="btn-secondary" type="button">Edit</button>
          </div>
        `;
        el.querySelector('button')?.addEventListener('click', () => {
          if (this.userUid) this.userUid.value = u.id;
          if (this.userEmail) this.userEmail.value = u.email || '';
          if (this.userCompanyId) this.userCompanyId.value = u.companyId || companyId;
          if (this.userRole) this.userRole.value = u.role || 'admin';
          this.userForm?.scrollIntoView?.({ behavior: 'smooth' });
        });
        this.usersList.appendChild(el);
      });
    } catch (err) {
      console.error(err);
      this.usersList.innerHTML = `<p style="color:red;">Error loading users: ${err.message}</p>`;
    }
  }

  async saveUserProfile(e) {
    e.preventDefault();
    const uid = String(this.userUid?.value || '').trim();
    if (!uid) return alert('User UID is required.');

    const email = String(this.userEmail?.value || '').trim();
    const companyId = String(this.userCompanyId?.value || '').trim();
    if (!companyId) return alert('Company is required.');

    const role = String(this.userRole?.value || 'admin').trim() || 'admin';

    try {
      const ref = doc(db, 'users', uid);
      const existing = await getDoc(ref);
      await setDoc(ref, {
        userId: uid,
        email,
        companyId,
        role,
        updatedAt: serverTimestamp(),
        ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });

      alert('User profile saved.');
      this.userForm?.reset?.();
      this.hydrateUserCompanyInput();
      this.loadUsersForSelectedCompany();
    } catch (err) {
      console.error(err);
      alert('Failed to save user profile: ' + err.message);
    }
  }
}
