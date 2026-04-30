import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ensureBaseCompanies, getUserProfile, login } from '../tenant-auth.js';
import { COMPANY_ID } from '../company-config.js';
import { getSelectedCompanyId, loadSelectedCompany, setSelectedCompany } from '../store-context.js';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { CategoriesTab } from './tabs/CategoriesTab.js';
import { OverviewTab } from './tabs/OverviewTab.js';
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

const ADMIN_VERSION = '3.1';

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

function getCompanyIdFromPathname(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return null;
  if (parts[0] === 'admin') return null;
  return parts[0].toLowerCase();
}

function getCompanyIdFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const storeId = String(params.get('store') || params.get('companyId') || '').trim().toLowerCase();
    return storeId || null;
  } catch (_) {
    return null;
  }
}

class AdminApp {
  constructor() {
    this.authScreen = document.getElementById('authScreen');
    this.mainApp = document.getElementById('mainApp');
    this.loginForm = document.getElementById('loginForm');
    this.loginSubmitBtn = document.getElementById('loginSubmitBtn');
    this.loginStatus = document.getElementById('loginStatus');
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
    this.authRecoveryTimer = null;
    this.lastStableUser = null;
    this.logoutRequested = false;
    this.hasResolvedInitialAuth = false;
    this.reconnectToastShown = false;
    this.loginAttemptInFlight = false;
    this.authBootstrapInFlight = false;
    this.loginAttemptTimer = null;

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
      if (user) {
        this.clearLoginAttemptTimer();
        this.hasResolvedInitialAuth = true;
        this.lastStableUser = user;
        this.logoutRequested = false;
        this.clearAuthRecoveryTimer();
        this.reconnectToastShown = false;
        this.loginAttemptInFlight = false;
        this.authBootstrapInFlight = true;
        this.setLoginUiState({ pending: true, status: 'Loading your admin workspace...' });
        this.applySignedInShell();

        try {
          const hostname = getHostname();
          const hqHost = isHqAdminHost(hostname);
          const hostCompanyId = getCompanyIdFromHost(hostname);
          const pathCompanyId = getCompanyIdFromPathname(window.location.pathname);
          const queryCompanyId = getCompanyIdFromQuery();
          const routedCompanyId = pathCompanyId || queryCompanyId;

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

          // HQ root admin portal is only for Kyrgyz Organic (plus superadmins).
          // Store admins can still use a store-scoped admin path such as
          // /dailybread/admin/admin.html on the shared host.
          const isProdHqHost = hostname === 'oako.kg' || hostname === 'www.oako.kg';
          if (isProdHqHost && !this.isSuperAdmin && companyId !== COMPANY_ID && !routedCompanyId) {
            throw new Error(`This admin portal is for Kyrgyz Organic only. Please use your store path instead, for example: https://oako.kg/${companyId}/admin/admin.html`);
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
            // Regular admins always stay within their store. On the HQ host we support
            // either the root Kyrgyz Organic admin or a store-scoped path such as
            // /dailybread/admin/admin.html.
            if (routedCompanyId && companyId && routedCompanyId !== companyId) {
              throw new Error(`This admin portal is for "${routedCompanyId}". Please log in on the correct store admin path.`);
            }
            setSelectedCompany(routedCompanyId || companyId, { persist: false });
          } else if (!getSelectedCompanyId()) {
            // Superadmin on HQ domain: if a store path is open, keep the context on that store.
            setSelectedCompany(routedCompanyId || COMPANY_ID, { persist: false });
          }

          await ensureBaseCompanies().catch(err => {
            console.warn("Base company seed skipped:", err);
          });

          await this.loadCompaniesForUi().catch(err => {
            console.warn("Company list load skipped:", err);
          });

          this.applyRoleUi();
          await this.refreshHeaderContext();
          this.authBootstrapInFlight = false;
          this.resumeLiveTabs();
          this.onLogin();
          this.loginForm?.reset();
          this.setLoginUiState({ pending: false, status: '' });
        } catch (err) {
          this.authBootstrapInFlight = false;
          console.error("Company context failed:", err);
          const message = err?.message ? String(err.message) : 'Login Failed';
          const errorP = document.getElementById('loginError');
          if (errorP) errorP.textContent = message;
          this.setLoginUiState({ pending: false, status: '' });
          this.authScreen.hidden = true;
          this.mainApp.hidden = false;
          this.pauseLiveTabs('Session reconnecting...');
          this.showToast(`Session kept active. ${message}`, 'error');
        }
      } else {
        this.handleSignedOutState();
      }
    });

    this.logoutBtn?.addEventListener('click', () => {
      this.logoutRequested = true;
      signOut(auth);
    });

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (this.loginAttemptInFlight || this.authBootstrapInFlight) return;

        const email = document.getElementById('loginEmail').value;
        const pwd = document.getElementById('loginPwd').value;
        const errorP = document.getElementById('loginError');

        try {
          this.loginAttemptInFlight = true;
          this.authBootstrapInFlight = false;
          this.clearLoginAttemptTimer();
          this.setLoginUiState({ pending: true, status: 'Signing you in...', error: '' });
          await login(email, pwd);
          if (errorP) errorP.textContent = '';
          this.setLoginUiState({ pending: true, status: 'Loading your admin workspace...' });
          this.loginAttemptTimer = window.setTimeout(() => {
            this.loginAttemptTimer = null;
            if (auth.currentUser) {
              this.setLoginUiState({ pending: true, status: 'Still loading your workspace...' });
              return;
            }
            this.loginAttemptInFlight = false;
            this.authBootstrapInFlight = false;
            this.setLoginUiState({
              pending: false,
              status: '',
              error: 'We could not finish signing you in. Please try again.'
            });
          }, 10000);
        } catch (err) {
          this.clearLoginAttemptTimer();
          this.loginAttemptInFlight = false;
          this.authBootstrapInFlight = false;
          console.error(err);
          const message = "Login Failed: " + err.message;
          if (errorP) errorP.textContent = message;
          this.setLoginUiState({ pending: false, status: '', error: message });
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

  applySignedInShell() {
    this.authScreen.hidden = true;
    this.mainApp.hidden = false;
    const errorP = document.getElementById('loginError');
    if (errorP) errorP.textContent = '';
  }

  applySignedOutShell() {
    this.authScreen.hidden = false;
    this.mainApp.hidden = true;
  }

  clearAuthRecoveryTimer() {
    if (!this.authRecoveryTimer) return;
    window.clearTimeout(this.authRecoveryTimer);
    this.authRecoveryTimer = null;
  }

  clearLoginAttemptTimer() {
    if (!this.loginAttemptTimer) return;
    window.clearTimeout(this.loginAttemptTimer);
    this.loginAttemptTimer = null;
  }

  setLoginUiState({ pending = false, status = '', error = null } = {}) {
    if (this.loginSubmitBtn) {
      this.loginSubmitBtn.disabled = pending;
      this.loginSubmitBtn.textContent = pending ? 'Signing In...' : 'Sign In';
      this.loginSubmitBtn.setAttribute('aria-busy', pending ? 'true' : 'false');
    }

    if (this.loginStatus) {
      this.loginStatus.textContent = status || '';
      this.loginStatus.hidden = !status;
    }

    if (error !== null) {
      const errorP = document.getElementById('loginError');
      if (errorP) errorP.textContent = error || '';
    }
  }

  hasActiveSession() {
    return !!auth.currentUser;
  }

  handleSignedOutState() {
    this.pauseLiveTabs('Session reconnecting...');

    if (this.loginAttemptInFlight || this.authBootstrapInFlight) {
      this.applySignedOutShell();
      this.setLoginUiState({ pending: true, status: 'Signing you in...' });
      return;
    }

    if (this.logoutRequested) {
      this.clearAuthRecoveryTimer();
      this.clearLoginAttemptTimer();
      this.lastStableUser = null;
      this.reconnectToastShown = false;
      this.loginAttemptInFlight = false;
      this.authBootstrapInFlight = false;
      this.setLoginUiState({ pending: false, status: '', error: '' });
      this.applySignedOutShell();
      return;
    }

    const hasPriorSession = !!this.lastStableUser;
    if (!hasPriorSession && !this.hasResolvedInitialAuth) {
      this.hasResolvedInitialAuth = true;
      this.reconnectToastShown = false;
      this.setLoginUiState({ pending: false, status: '', error: '' });
      this.applySignedOutShell();
      return;
    }

    const initialGraceMs = 0;
    const recoveryGraceMs = hasPriorSession ? 12000 : initialGraceMs;

    if (recoveryGraceMs <= 0) {
      this.lastStableUser = null;
      this.setLoginUiState({ pending: false, status: '', error: '' });
      this.applySignedOutShell();
      return;
    }

    this.applySignedInShell();
    if (!this.reconnectToastShown) {
      this.showToast('Reconnecting your session...', 'warning');
      this.reconnectToastShown = true;
    }

    if (this.authRecoveryTimer) return;

    this.authRecoveryTimer = window.setTimeout(() => {
      this.authRecoveryTimer = null;
      if (auth.currentUser) return;
      this.lastStableUser = null;
      this.reconnectToastShown = false;
      this.loginAttemptInFlight = false;
      this.authBootstrapInFlight = false;
      this.applySignedOutShell();
      const errorP = document.getElementById('loginError');
      const nextMessage = errorP?.textContent ? errorP.textContent : 'Session expired. Please sign in again.';
      this.setLoginUiState({ pending: false, status: '', error: nextMessage });
    }, recoveryGraceMs);
  }

  pauseLiveTabs(message = 'Session reconnecting...') {
    Object.values(this.tabs).forEach((tab) => {
      if (typeof tab?.pauseLiveUpdates === 'function') {
        tab.pauseLiveUpdates(message);
      }
    });
  }

  resumeLiveTabs() {
    Object.values(this.tabs).forEach((tab) => {
      if (typeof tab?.resumeLiveUpdates === 'function') {
        tab.resumeLiveUpdates();
      }
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
    this.tabs['overview'] = new OverviewTab();
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
  }

  async loadOverview() {
    return this.tabs['overview']?.refresh?.();
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
