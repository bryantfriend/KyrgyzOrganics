import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ensureBaseCompanies, getUserProfile, login } from '../tenant-auth.js';
import { COMPANY_ID } from '../company-config.js';
import { getSelectedCompanyId, loadSelectedCompany, setSelectedCompany } from '../store-context.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ACTIVE_ORDER_STATUSES } from '../services/orderArchiveService.js';
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

const ADMIN_VERSION = '3.0';

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
    this.activeTabName = 'overview';

    // Store Switch UI (superadmin only)
    this.storePill = document.getElementById('storePill');
    this.headerRoleLabel = document.getElementById('headerRoleLabel');
    this.headerStoreLogo = document.getElementById('headerStoreLogo');
    this.headerStoreName = document.getElementById('headerStoreName');
    this.headerStoreDomain = document.getElementById('headerStoreDomain');
    this.headerStatusBadge = document.getElementById('headerStatusBadge');
    this.selectStoreBtn = document.getElementById('selectStoreBtn');
    this.viewStorefrontBtn = document.getElementById('viewStorefrontBtn');
    this.saveCurrentSectionBtn = document.getElementById('saveCurrentSectionBtn');
    this.sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    this.storesTabBtn = document.getElementById('storesTabBtn');
    this.storeWorkspaceLabel = document.getElementById('storeWorkspaceLabel');
    this.adminVersionPill = document.getElementById('adminVersionPill');
    this.storeModal = document.getElementById('storeSwitchModal');
    this.storeModalClose = document.getElementById('closeStoreModal');
    this.storeSearchInput = document.getElementById('storeSearchInput');
    this.storeSwitchList = document.getElementById('storeSwitchList');
    this.toast = document.getElementById('adminToast');
    this.overviewRefreshBtn = document.getElementById('overviewRefreshBtn');
    this.overviewViewSiteBtn = document.getElementById('overviewViewSiteBtn');

    this.userProfile = null;
    this.isSuperAdmin = false;
    this.companiesCache = [];
    this.currentStore = null;
    this.currentStorefrontConfig = null;

    this.init();
  }

  async init() {
    this.updateAdminVersion();
    this.restoreSidebarPreference();
    this.setupAuth();
    this.setupTabs();
    this.setupStoreSwitching();
    this.setupHeaderActions();

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
          this.isSuperAdmin = hqHost && (role === 'superadmin' || role === 'super_admin' || isLegacyAdmin);

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
            if (role !== 'superadmin' && role !== 'super_admin' && hostCompanyId && companyId && hostCompanyId !== companyId) {
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
          await this.refreshHeaderContext();
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
      this.refreshHeaderContext();
      this.loadOverview();
      Object.values(this.tabs).forEach((tab) => {
        if (typeof tab?.onStoreChanged === 'function') {
          tab.onStoreChanged();
        }
      });
    });
  }

  setupHeaderActions() {
    this.sidebarCollapseBtn?.addEventListener('click', () => this.toggleSidebar());
    this.viewStorefrontBtn?.addEventListener('click', () => this.openSelectedStorefront());
    this.overviewViewSiteBtn?.addEventListener('click', () => this.openSelectedStorefront());
    this.overviewRefreshBtn?.addEventListener('click', () => this.loadOverview());
    this.saveCurrentSectionBtn?.addEventListener('click', () => this.saveCurrentSection());
  }

  restoreSidebarPreference() {
    try {
      if (localStorage.getItem('admin_sidebar_collapsed') === 'true') {
        this.mainApp?.classList.add('sidebar-collapsed');
      }
    } catch (_) {
      // ignore storage issues
    }
    this.updateSidebarToggle();
  }

  toggleSidebar() {
    this.mainApp?.classList.toggle('sidebar-collapsed');
    this.updateSidebarToggle();
    try {
      localStorage.setItem('admin_sidebar_collapsed', this.mainApp?.classList.contains('sidebar-collapsed') ? 'true' : 'false');
    } catch (_) {
      // ignore storage issues
    }
  }

  updateSidebarToggle() {
    if (!this.sidebarCollapseBtn) return;
    const collapsed = this.mainApp?.classList.contains('sidebar-collapsed');
    this.sidebarCollapseBtn.innerHTML = `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="3.25" y="4" width="13.5" height="12" rx="2.25"></rect>
        <path d="${collapsed ? 'M10 4v12' : 'M8 4v12'}"></path>
      </svg>
    `;
    this.sidebarCollapseBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    this.sidebarCollapseBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  }

  getStorefrontPath(companyId = getSelectedCompanyId()) {
    if (!companyId || companyId === COMPANY_ID) return '/';
    return `/${String(companyId).replace(/^\/+|\/+$/g, '')}/`;
  }

  openSelectedStorefront() {
    window.open(this.getStorefrontPath(), '_blank', 'noopener');
  }

  saveCurrentSection() {
    const formMap = {
      stores: 'storeForm',
      products: 'productForm',
      categories: 'categoryForm',
      banners: 'bannerForm',
      content: 'contentForm',
      settings: 'paymentForm',
      campaigns: 'campaignForm'
    };
    const formId = formMap[this.activeTabName];
    const form = formId ? document.getElementById(formId) : null;

    if (!form || form.closest('[hidden]')) {
      this.showToast('Nothing to save on this page yet.', 'warning');
      return;
    }

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    this.showToast('Save action sent.', 'success');
  }

  showToast(message, type = 'success') {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.dataset.type = type;
    this.toast.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast?.classList.remove('show');
    }, 2600);
  }

  applyRoleUi() {
    const showSuperAdmin = !!this.isSuperAdmin;

    if (this.selectStoreBtn) {
      this.selectStoreBtn.style.display = showSuperAdmin ? '' : 'none';
    }

    document.querySelectorAll('[data-role-nav="super"]').forEach((item) => {
      // The current Settings screen is store-scoped, so avoid showing a duplicate
      // "Global Settings" entry until a true platform settings page exists.
      item.hidden = !showSuperAdmin || item.dataset.tab === 'settings';
    });

    document.querySelectorAll('[data-role-nav="store"]').forEach((item) => {
      item.hidden = false;
    });

    const superGroup = document.querySelector('[data-nav-group="super"]');
    const storeGroup = document.querySelector('[data-nav-group="store"]');
    if (superGroup) superGroup.hidden = !showSuperAdmin;
    if (storeGroup) storeGroup.hidden = false;

    if (this.headerRoleLabel) {
      this.headerRoleLabel.textContent = showSuperAdmin ? 'Super Admin' : 'Store Admin';
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

  async refreshHeaderContext() {
    const selected = getSelectedCompanyId();
    const store = await this.getStoreDetails(selected);
    const config = await this.getStorefrontConfig(selected);
    const displayName = store?.name || config?.name || this.getCompanyDisplayName(selected);
    const status = store?.launchStatus || config?.launchStatus || (store?.active === false ? 'inactive' : 'live');
    const logoUrl = store?.logoUrl || config?.logoUrl || config?.content?.logoUrl || '';
    const domain = store?.customDomain || store?.hosting?.customDomain || store?.website || config?.customDomain || config?.domain || this.getStorefrontPath(selected);

    this.currentStore = store || { companyId: selected, name: displayName };
    this.currentStorefrontConfig = config || {};

    if (this.storePill) this.storePill.textContent = `Store: ${selected}`;
    if (this.headerStoreName) this.headerStoreName.textContent = displayName;
    if (this.headerStoreDomain) this.headerStoreDomain.textContent = domain;
    if (this.headerStatusBadge) {
      const isHealthy = status === 'live' || status === 'active' || store?.active === true;
      this.headerStatusBadge.textContent = isHealthy ? 'Active' : status;
      this.headerStatusBadge.className = `status-badge ${isHealthy ? 'success' : 'warning'}`;
    }
    if (this.headerStoreLogo) {
      this.headerStoreLogo.innerHTML = logoUrl
        ? `<img src="${logoUrl}" alt="${displayName} logo">`
        : String(displayName || selected).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    }
    if (this.storeWorkspaceLabel) {
      this.storeWorkspaceLabel.textContent = this.isSuperAdmin ? `Selected Store: ${displayName}` : 'Store Workspace';
    }
  }

  async getStoreDetails(companyId) {
    const cached = this.companiesCache.find((c) => c.companyId === companyId || c.id === companyId);
    if (cached) return cached;
    try {
      const snap = await getDoc(doc(db, 'companies', companyId));
      if (snap.exists()) return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.warn('Store details load skipped:', err);
    }
    return null;
  }

  async getStorefrontConfig(companyId) {
    try {
      const snap = await getDoc(doc(db, 'storefront_configs', companyId));
      if (snap.exists()) return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.warn('Storefront config load skipped:', err);
    }
    return null;
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
    if (!items.length) {
      this.storeSwitchList.innerHTML = '<div class="inline-alert">No stores found for that search.</div>';
      return;
    }

    items.forEach((store) => {
      const id = store.companyId || store.id;
      const el = document.createElement('div');
      el.className = 'store-switch-item';
      el.innerHTML = `
        <div class="store-switch-avatar">${String(store.name || id).slice(0, 2).toUpperCase()}</div>
        <div class="store-switch-copy">
          <strong>${store.name || id}</strong>
          <span>${store.launchStatus || (store.active === false ? 'inactive' : 'active')} • ${store.plan || 'free'}</span>
        </div>
        <span class="status-dot ${id === selected ? 'selected' : ''}"></span>
      `;
      el.addEventListener('click', () => {
        setSelectedCompany(id);
        this.closeStoreModal();
        this.showToast(`Switched to ${store.name || id}.`, 'success');
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
    const buttons = document.querySelectorAll('.tabs button[data-tab], .nav-btn[data-tab]');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => this.openTab(btn.dataset.tab, btn));
    });

    window.addEventListener('oako:navigate-admin-tab', (event) => {
      this.openTab(event.detail?.tab);
    });
  }

  openTab(tabName, sourceButton = null) {
    if (!tabName) return;

    const buttons = document.querySelectorAll('.tabs button[data-tab], .nav-btn[data-tab]');
    const targetButton = sourceButton || Array.from(buttons).find((btn) => btn.dataset.tab === tabName && !btn.hidden);

    buttons.forEach(b => b.classList.remove('active'));
    if (targetButton) targetButton.classList.add('active');

    this.activeTabName = tabName;
    this.updateActivePageChrome(tabName);

    if (this.tabs[tabName]) {
      this.tabs[tabName].show();
    } else {
      // Fallback for any tab not yet refactored or simple.
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      const section = document.getElementById(tabName);
      if (section) section.style.display = 'block';
    }
  }

  updateActivePageChrome(tabName) {
    const titles = {
      overview: 'Store Overview',
      stores: 'Stores',
      products: 'Products',
      categories: 'Categories',
      banners: 'Banners',
      content: 'Content',
      inventory: 'Inventory',
      settings: 'Settings',
      orders: 'Orders',
      audit: 'Audit Logs',
      analytics: 'Analytics',
      campaigns: 'Campaigns'
    };
    document.title = `${titles[tabName] || 'Admin'} | Oako Admin`;
    this.saveCurrentSectionBtn?.classList.toggle('is-muted', !['stores', 'products', 'categories', 'banners', 'content', 'settings', 'campaigns'].includes(tabName));
    if (tabName === 'overview') this.loadOverview();
  }

  async loadOverview() {
    const companyId = getSelectedCompanyId();
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
        el.classList.remove('skeleton-text');
      }
    };

    setText('overviewTitle', `${this.getCompanyDisplayName(companyId)} dashboard`);
    const updatedAt = document.getElementById('overviewUpdatedAt');
    if (updatedAt) updatedAt.textContent = 'Refreshing...';

    try {
      const [store, config, productsSnap, ordersSnap] = await Promise.all([
        this.getStoreDetails(companyId),
        this.getStorefrontConfig(companyId),
        getDocs(query(collection(db, 'products'), where('companyId', '==', companyId))),
        getDocs(query(
          collection(db, 'orders'),
          where('companyId', '==', companyId),
          where('status', 'in', ACTIVE_ORDER_STATUSES),
          orderBy('createdAt', 'desc'),
          limit(100)
        )).catch(() => ({ docs: [] }))
      ]);

      const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const revenue = orders.reduce((sum, order) => {
        const value = Number(order.total ?? order.price ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      const checks = [
        ['Store is active', store?.active !== false && (store?.launchStatus || config?.launchStatus || 'live') !== 'paused'],
        ['Products added', productsSnap.docs.length > 0],
        ['Domain planned', Boolean(store?.customDomain || store?.hosting?.customDomain || store?.website || config?.domain)],
        ['SEO configured', Boolean(config?.seo?.title && config?.seo?.description)],
        ['WhatsApp/contact ready', Boolean(store?.contact?.whatsapp || store?.whatsapp || store?.phone)]
      ];
      const passed = checks.filter(([, ok]) => ok).length;
      const health = passed === checks.length ? 'Excellent' : passed >= 3 ? 'Good' : 'Needs work';

      setText('overviewProductsCount', String(productsSnap.docs.length));
      setText('overviewOrdersCount', String(orders.length));
      setText('overviewRevenue', `${revenue} som`);
      setText('overviewHealth', health);

      const badge = document.getElementById('overviewLaunchBadge');
      if (badge) {
        badge.textContent = passed === checks.length ? 'Ready' : 'Review';
        badge.className = `status-badge ${passed === checks.length ? 'success' : 'warning'}`;
      }

      const checklist = document.getElementById('overviewChecklist');
      if (checklist) {
        checklist.innerHTML = checks.map(([label, ok]) => `
          <div class="checklist-item ${ok ? 'ok' : 'warn'}">
            <span>${ok ? '✓' : '!'}</span>
            <strong>${label}</strong>
            <small>${ok ? 'Connected' : 'Missing data'}</small>
          </div>
        `).join('');
      }

      const activity = document.getElementById('overviewActivity');
      if (activity) {
        activity.innerHTML = `
          <div class="activity-item"><span class="status-dot selected"></span><div><strong>${orders.length} orders recorded</strong><small>Revenue total: ${revenue} som</small></div></div>
          <div class="activity-item"><span class="status-dot"></span><div><strong>${productsSnap.docs.length} products in catalog</strong><small>Keep availability updated daily</small></div></div>
          <div class="activity-item"><span class="status-dot"></span><div><strong>${store?.launchStatus || config?.launchStatus || 'live'} storefront status</strong><small>${store?.website || config?.domain || this.getStorefrontPath(companyId)}</small></div></div>
        `;
      }

      if (updatedAt) updatedAt.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (err) {
      console.warn('Overview load failed:', err);
      setText('overviewHealth', 'Error');
      const activity = document.getElementById('overviewActivity');
      if (activity) activity.innerHTML = `<div class="inline-alert error">Overview could not load: ${err.message}</div>`;
      if (updatedAt) updatedAt.textContent = 'Error';
    }
  }

  async onLogin() {
    console.log("Admin Logged In");

    // Initialize all tabs (or lazy load?)
    // Let's init generic stuff

    // Initialize the Active Tab?
    // Find active button
    const targetTab = this.isSuperAdmin ? 'stores' : 'overview';
    this.openTab(targetTab);

    // Pre-load critical data if needed?
    // Tabs handle their own init() on show().
  }
}

// Start
window.adminApp = new AdminApp();
