import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ensureBaseCompanies, getUserProfile, login } from '../tenant-auth.js';
import { COMPANY_ID } from '../company-config.js';
import { getSelectedCompanyId, loadSelectedCompany, setSelectedCompany } from '../store-context.js';
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { CategoriesTab } from './tabs/CategoriesTab.js';
import { ProductsTab } from './tabs/ProductsTab.js';
import { BannersTab } from './tabs/BannersTab.js';
import { ContentTab } from './tabs/ContentTab.js';
import { InventoryTab } from './tabs/InventoryTab.js';
import { SettingsTab } from './tabs/SettingsTab.js';
import { OrdersTab } from './tabs/OrdersTab.js';
import { AuditTab } from './tabs/AuditTab.js';
import { AnalyticsTab } from './tabs/AnalyticsTab.js';
import { CampaignsTab } from './tabs/CampaignsTab.js?v=2.1';
import { StoresTab } from './tabs/StoresTab.js';

const ADMIN_VERSION = '2.9';

function getHostname() {
  try {
    return String(window.location.hostname || '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function isHqAdminHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'oako.kg' || host === 'www.oako.kg' || host === 'localhost' || host === '127.0.0.1';
}

function getCompanyIdFromHost(hostname) {
  const host = String(hostname || '').toLowerCase();

  if (host === 'oako.kg' || host === 'www.oako.kg') return COMPANY_ID;

  if (host.endsWith('.oako.kg')) {
    const sub = host.replace(/\.oako\.kg$/, '');
    if (sub && sub !== 'www') return sub;
  }

  return null;
}

class AdminApp {
  constructor() {
    this.authScreen = document.getElementById('authScreen');
    this.mainApp = document.getElementById('mainApp');
    this.loginForm = document.getElementById('loginForm');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.tabs = {};

    // Store Switch UI (superadmin only)
    this.storePill = document.getElementById('storePill');
    this.selectStoreBtn = document.getElementById('selectStoreBtn');
    this.storesTabBtn = document.getElementById('storesTabBtn');
    this.adminVersionPill = document.getElementById('adminVersionPill');
    this.storeModal = document.getElementById('storeSwitchModal');
    this.storeModalClose = document.getElementById('closeStoreModal');
    this.storeSearchInput = document.getElementById('storeSearchInput');
    this.storeSwitchList = document.getElementById('storeSwitchList');

    this.userProfile = null;
    this.isSuperAdmin = false;
    this.companiesCache = [];

    // Navigation
    this.navButtons = document.querySelectorAll('.nav-btn'); // Assuming I added class nav-btn to all? 
    // Wait, I only added class nav-btn to NEW buttons. 
    // Old buttons just had `tabs button` selector.
    // Let's standardise selector.

    this.init();
  }

  async init() {
    this.updateAdminVersion();
    this.setupAuth();
    this.setupTabs();
    this.setupStoreSwitching();

    // Global Helper for Mobile Preview Close
    window.closePreview = () => {
      document.getElementById('mobilePreview')?.classList.add('hidden');
    };
  }

  updateAdminVersion() {
    if (this.adminVersionPill) {
      this.adminVersionPill.textContent = `Admin v${ADMIN_VERSION}`;
    }
  }

  setupAuth() {
    onAuthStateChanged(auth, async user => {
      this.authScreen.hidden = !!user;
      this.mainApp.hidden = !user;
      if (user) {
        try {
          const hostname = getHostname();
          const hqHost = isHqAdminHost(hostname);
          const hostCompanyId = getCompanyIdFromHost(hostname);

          const profile = await getUserProfile(user.uid);
          const isLegacyAdmin = !profile;
          const role = profile?.role || 'admin';
          const companyId = profile?.companyId || COMPANY_ID;

          this.userProfile = {
            userId: user.uid,
            email: user.email || profile?.email || '',
            ...profile,
            role,
            companyId
          };

          // Superadmin powers only on the HQ admin domain (oako.kg).
          // Legacy admins (no users/{uid} profile) are treated like superadmins on HQ host to avoid breaking existing access.
          this.isSuperAdmin = hqHost && (role === 'superadmin' || isLegacyAdmin);

          // Hard block: HQ admin portal is only for Kyrgyz Organic (plus superadmins).
          // Store admins should use their own store subdomain (e.g. dailybread.oako.kg).
          const isProdHqHost = hostname === 'oako.kg' || hostname === 'www.oako.kg';
          if (isProdHqHost && !this.isSuperAdmin && companyId !== COMPANY_ID) {
            throw new Error(`This admin portal is for Kyrgyz Organic only. Please log in on your store website (for example: https://${companyId}.oako.kg/admin/admin.html).`);
          }

          // Load stored selection (superadmin) or force to the user's company.
          loadSelectedCompany();

          if (!hqHost) {
            // Store subdomains: always lock the admin to that store.
            const forcedCompanyId = hostCompanyId || companyId;

            // If this isn't a superadmin account, ensure they only log into their own store domain.
            if (role !== 'superadmin' && hostCompanyId && companyId && hostCompanyId !== companyId) {
              throw new Error(`This admin portal is for "${hostCompanyId}". Please log in on the correct store website.`);
            }

            setSelectedCompany(forcedCompanyId, { persist: false });
          } else if (!this.isSuperAdmin) {
            // Regular admins always stay within their store, even on HQ domain.
            setSelectedCompany(companyId, { persist: false });
          } else if (!getSelectedCompanyId()) {
            // Superadmin on HQ domain: default to Kyrgyz Organic if nothing was saved.
            setSelectedCompany(COMPANY_ID, { persist: false });
          }

          await ensureBaseCompanies().catch(err => {
            console.warn("Base company seed skipped:", err);
          });

          await this.loadCompaniesForUi().catch(err => {
            console.warn("Company list load skipped:", err);
          });

          this.applyRoleUi();
          this.updateStorePill();
          this.onLogin();
        } catch (err) {
          console.error("Company context failed:", err);
          const errorP = document.getElementById('loginError');
          if (errorP) errorP.textContent = err?.message ? String(err.message) : 'Login Failed';
          this.authScreen.hidden = false;
          this.mainApp.hidden = true;
          await signOut(auth);
        }
      }
    });

    this.logoutBtn?.addEventListener('click', () => signOut(auth));

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const pwd = document.getElementById('loginPwd').value;
        const errorP = document.getElementById('loginError');

        try {
          await login(email, pwd);
          this.loginForm.reset();
          if (errorP) errorP.textContent = '';
        } catch (err) {
          console.error(err);
          if (errorP) errorP.textContent = "Login Failed: " + err.message;
        }
      });
    }
  }

  setupStoreSwitching() {
    if (this.selectStoreBtn) {
      this.selectStoreBtn.addEventListener('click', () => this.openStoreModal());
    }

    if (this.storeModalClose) {
      this.storeModalClose.addEventListener('click', () => this.closeStoreModal());
    }

    if (this.storeModal) {
      this.storeModal.addEventListener('click', (e) => {
        if (e.target === this.storeModal) this.closeStoreModal();
      });
    }

    if (this.storeSearchInput) {
      this.storeSearchInput.addEventListener('input', () => this.renderStoreSwitchList());
    }

    window.addEventListener('oako:store-changed', () => {
      this.updateStorePill();
      Object.values(this.tabs).forEach((tab) => {
        if (typeof tab?.onStoreChanged === 'function') {
          tab.onStoreChanged();
        }
      });
    });
  }

  applyRoleUi() {
    const showSuperAdmin = !!this.isSuperAdmin;

    if (this.selectStoreBtn) {
      this.selectStoreBtn.style.display = showSuperAdmin ? '' : 'none';
    }

    if (this.storesTabBtn) {
      this.storesTabBtn.style.display = showSuperAdmin ? '' : 'none';
    }
  }

  async loadCompaniesForUi() {
    if (!this.isSuperAdmin) return;

    const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    this.companiesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    this.renderStoreSwitchList();
  }

  getCompanyDisplayName(companyId) {
    const match = this.companiesCache.find((c) => c.companyId === companyId || c.id === companyId);
    if (match) return match.name || match.slug || match.companyId || match.id;
    return companyId || COMPANY_ID;
  }

  updateStorePill() {
    if (!this.storePill) return;
    const selected = getSelectedCompanyId();
    this.storePill.textContent = `Store: ${this.getCompanyDisplayName(selected)}`;
  }

  openStoreModal() {
    if (!this.isSuperAdmin) return;
    if (!this.storeModal) return;
    this.renderStoreSwitchList();
    this.storeModal.classList.remove('hidden');
    if (this.storeSearchInput) this.storeSearchInput.focus();
  }

  closeStoreModal() {
    if (!this.storeModal) return;
    this.storeModal.classList.add('hidden');
    if (this.storeSearchInput) this.storeSearchInput.value = '';
  }

  renderStoreSwitchList() {
    if (!this.storeSwitchList) return;

    const term = (this.storeSearchInput?.value || '').trim().toLowerCase();
    const items = (Array.isArray(this.companiesCache) ? this.companiesCache : []).filter((store) => {
      if (!term) return true;
      const blob = `${store.name || ''} ${store.contactName || ''} ${store.phone || ''} ${store.address || ''} ${store.companyId || store.id || ''}`.toLowerCase();
      return blob.includes(term);
    });

    const selected = getSelectedCompanyId();

    this.storeSwitchList.innerHTML = '';
    items.forEach((store) => {
      const id = store.companyId || store.id;
      const el = document.createElement('div');
      el.className = 'list-item';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.15rem;">
          <strong>${store.name || id}</strong>
          <span style="font-size:0.85rem; color:#666;">${store.plan || 'free'} • ${store.phone || ''}</span>
        </div>
        <div style="font-size:0.85rem; color:${id === selected ? '#2e7d32' : '#888'}; font-weight:700;">
          ${id === selected ? 'Selected' : 'Select'}
        </div>
      `;
      el.addEventListener('click', () => {
        setSelectedCompany(id);
        this.closeStoreModal();
      });
      this.storeSwitchList.appendChild(el);
    });
  }

  setupTabs() {
    // Instantiate Tabs
    this.tabs['categories'] = new CategoriesTab();
    this.tabs['products'] = new ProductsTab();
    this.tabs['banners'] = new BannersTab();
    this.tabs['content'] = new ContentTab();
    this.tabs['inventory'] = new InventoryTab();
    this.tabs['settings'] = new SettingsTab();
    this.tabs['orders'] = new OrdersTab();
    this.tabs['audit'] = new AuditTab();
    this.tabs['analytics'] = new AnalyticsTab();
    this.tabs['campaigns'] = new CampaignsTab();
    this.tabs['stores'] = new StoresTab();

    // Listeners for Tab Switching
    // Support both .tabs button and .nav-btn
    const buttons = document.querySelectorAll('.tabs button, .nav-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        if (!tabName) return;

        // UI Toggle
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Module Show
        if (this.tabs[tabName]) {
          this.tabs[tabName].show();
        } else {
          // Fallback for any tab not yet refactored or simple
          document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
          const section = document.getElementById(tabName);
          if (section) section.style.display = 'block';
        }
      });
    });
  }

  async onLogin() {
    console.log("Admin Logged In");

    // Initialize all tabs (or lazy load?)
    // Let's init generic stuff

    // Initialize the Active Tab?
    // Find active button
    const activeBtn = document.querySelector('.tabs button.active') || document.querySelector('.nav-btn.active');
    if (activeBtn) activeBtn.click();

    // Pre-load critical data if needed?
    // Tabs handle their own init() on show().
  }
}

// Start
window.adminApp = new AdminApp();
