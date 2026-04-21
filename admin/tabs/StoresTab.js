import { BaseTab } from './BaseTab.js';
import { db, storage } from '../../firebase-config.js';
import { COMPANY_ID } from '../../company-config.js';
import { getSelectedCompanyId, setSelectedCompany } from '../../store-context.js';
import { getInventoryDocId } from '../../firestore-paths.js';
import { THEME_PRESETS, getFallbackStoreConfig } from '../../storefront/defaults/default-store-config.js';
import { ACTIVE_ORDER_STATUSES } from '../../services/orderArchiveService.js';
import { logAudit } from '../utils.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString()} som`;
}

function getStorePreviewPath(companyId) {
  if (!companyId || companyId === COMPANY_ID) return '/';
  return `/${String(companyId).replace(/^\/+|\/+$/g, '')}/`;
}

function safeFileName(name) {
  const fallback = 'asset';
  const cleaned = String(name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

export class StoresTab extends BaseTab {
  constructor() {
    super('stores');

    this.searchInput = document.getElementById('storesSearch');
    this.table = document.getElementById('storesTable');
    this.addStoreBtn = document.getElementById('addStoreBtn');
    this.startBakeryOnboardingBtn = document.getElementById('startBakeryOnboardingBtn');
    this.startOrganicOnboardingBtn = document.getElementById('startOrganicOnboardingBtn');
    this.startBlankOnboardingBtn = document.getElementById('startBlankOnboardingBtn');
    this.refreshMetricsBtn = document.getElementById('refreshStoreMetrics');
    this.previewFrame = document.getElementById('storePreviewFrame');
    this.previewShell = document.getElementById('storePreviewShell');
    this.previewRefreshBtn = document.getElementById('storePreviewRefreshBtn');
    this.previewOpenBtn = document.getElementById('storePreviewOpenBtn');
    this.refreshActivityBtn = document.getElementById('refreshStoreActivityBtn');
    this.activityTimeline = document.getElementById('storeActivityTimeline');
    this.healthAlerts = document.getElementById('storeHealthAlerts');
    this.refreshHealthBtn = document.getElementById('refreshStoreHealthBtn');
    this.mediaType = document.getElementById('storeMediaType');
    this.mediaUpload = document.getElementById('storeMediaUpload');
    this.mediaUploadBtn = document.getElementById('storeMediaUploadBtn');
    this.mediaLibrary = document.getElementById('storeMediaLibrary');
    this.mediaScope = document.getElementById('storeMediaScope');

    this.formTitle = document.getElementById('storeFormTitle');
    this.formCard = document.getElementById('storeFormCard');
    this.form = document.getElementById('storeForm');
    this.editId = document.getElementById('storeEditId');
    this.companyId = document.getElementById('storeCompanyId');
    this.name = document.getElementById('storeName');
    this.plan = document.getElementById('storePlan');
    this.launchStatus = document.getElementById('storeLaunchStatus');
    this.contactName = document.getElementById('storeContactName');
    this.phone = document.getElementById('storePhone');
    this.address = document.getElementById('storeAddress');
    this.twoGisLink = document.getElementById('storeTwoGis');
    this.website = document.getElementById('storeWebsite');
    this.email = document.getElementById('storeEmail');
    this.whatsapp = document.getElementById('storeWhatsapp');
    this.instagram = document.getElementById('storeInstagram');
    this.openingHours = document.getElementById('storeOpeningHours');
    this.customDomain = document.getElementById('storeCustomDomain');
    this.githubTarget = document.getElementById('storeGithubTarget');
    this.dnsStatus = document.getElementById('storeDnsStatus');
    this.hostingNotes = document.getElementById('storeHostingNotes');
    this.domainPurchased = document.getElementById('storeDomainPurchased');
    this.dnsConfigured = document.getElementById('storeDnsConfigured');
    this.hostingConnected = document.getElementById('storeHostingConnected');
    this.sslActive = document.getElementById('storeSslActive');
    this.finalTested = document.getElementById('storeFinalTested');
    this.tags = document.getElementById('storeTags');
    this.notes = document.getElementById('storeNotes');
    this.active = document.getElementById('storeActive');
    this.cancelBtn = document.getElementById('storeCancelBtn');
    this.themePreset = document.getElementById('storeThemePreset');
    this.applyPresetBtn = document.getElementById('storeApplyPresetBtn');
    this.previewBtn = document.getElementById('storePreviewBtn');
    this.wizardBakeryBtn = document.getElementById('storeWizardBakeryBtn');
    this.wizardOrganicBtn = document.getElementById('storeWizardOrganicBtn');
    this.themePrimary = document.getElementById('storeThemePrimary');
    this.themeSecondary = document.getElementById('storeThemeSecondary');
    this.themeAccent = document.getElementById('storeThemeAccent');
    this.themeBackground = document.getElementById('storeThemeBackground');
    this.themeText = document.getElementById('storeThemeText');
    this.themeFont = document.getElementById('storeThemeFont');
    this.themeRadius = document.getElementById('storeThemeRadius');
    this.buttonStyle = document.getElementById('storeButtonStyle');
    this.logoUrl = document.getElementById('storeLogoUrl');
    this.logoUpload = document.getElementById('storeLogoUpload');
    this.seoTitle = document.getElementById('storeSeoTitle');
    this.seoDescription = document.getElementById('storeSeoDescription');
    this.seoImage = document.getElementById('storeSeoImage');
    this.seoKeywords = document.getElementById('storeSeoKeywords');
    this.featureCampaign = document.getElementById('storeFeatureCampaign');
    this.featureInvestment = document.getElementById('storeFeatureInvestment');
    this.featureQuickActions = document.getElementById('storeFeatureQuickActions');
    this.featureDelivery = document.getElementById('storeFeatureDelivery');
    this.featureCart = document.getElementById('storeFeatureCart');
    this.featureWhatsapp = document.getElementById('storeFeatureWhatsapp');
    this.featureSubscriptions = document.getElementById('storeFeatureSubscriptions');
    this.layoutHero = document.getElementById('storeLayoutHero');
    this.layoutQuickActions = document.getElementById('storeLayoutQuickActions');
    this.layoutCampaign = document.getElementById('storeLayoutCampaign');
    this.layoutProducts = document.getElementById('storeLayoutProducts');
    this.layoutCta = document.getElementById('storeLayoutCta');
    this.layoutOrder = document.getElementById('storeLayoutOrder');
    this.homepageBuilderPreview = document.getElementById('storeHomepageBuilderPreview');
    this.heroTitle = document.getElementById('storeHeroTitle');
    this.heroSubtitle = document.getElementById('storeHeroSubtitle');
    this.heroCta = document.getElementById('storeHeroCta');
    this.heroImage = document.getElementById('storeHeroImage');
    this.productHeading = document.getElementById('storeProductHeading');
    this.availableTitle = document.getElementById('storeAvailableTitle');
    this.availableLabel = document.getElementById('storeAvailableLabel');
    this.deliveryTitle = document.getElementById('storeDeliveryTitle');
    this.deliverySubtitle = document.getElementById('storeDeliverySubtitle');
    this.ctaTitle = document.getElementById('storeCtaTitle');
    this.ctaText = document.getElementById('storeCtaText');
    this.ctaButton = document.getElementById('storeCtaButton');
    this.ctaHref = document.getElementById('storeCtaHref');
    this.productView = document.getElementById('storeProductView');
    this.productCardSize = document.getElementById('storeProductCardSize');
    this.productShowPrice = document.getElementById('storeProductShowPrice');
    this.productShowBadges = document.getElementById('storeProductShowBadges');
    this.productShowStock = document.getElementById('storeProductShowStock');
    this.quickActions = [
      document.getElementById('storeQuickAction1'),
      document.getElementById('storeQuickAction2'),
      document.getElementById('storeQuickAction3'),
      document.getElementById('storeQuickAction4')
    ];
    this.launchChecklist = document.getElementById('storeLaunchChecklist');

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
    this.mediaPickerTarget = null;
  }

  async init() {
    this.bindEvents();
    this.subscribeStores();
    this.hydrateUserCompanyInput();
    this.loadUsersForSelectedCompany();
    this.loadStoreActivityTimeline();

    window.addEventListener('oako:store-changed', () => {
      this.hydrateUserCompanyInput();
      this.loadUsersForSelectedCompany();
      this.renderStoreHealthAlerts();
      this.loadMediaLibrary();
      this.loadStoreActivityTimeline();
      this.render();
    });

    window.oakoOpenMediaPicker = (options = {}) => this.openMediaPicker(options);
  }

  onShow() {
    this.hydrateUserCompanyInput();
    this.refreshPreview();
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
    this.renderStoreHealthAlerts();
    this.loadMediaLibrary();
    this.loadStoreActivityTimeline();
    this.render();
  }

  onStoreChanged() {
    // Called by AdminApp on global store change.
    this.hydrateUserCompanyInput();
    this.loadUsersForSelectedCompany();
    this.refreshPreview();
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
    this.renderStoreHealthAlerts();
    this.loadMediaLibrary();
    this.loadStoreActivityTimeline();
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
        this.renderStoreHealthAlerts({ force: true });
        this.render();
      });
    }

    if (this.refreshHealthBtn) {
      this.refreshHealthBtn.addEventListener('click', () => this.renderStoreHealthAlerts({ force: true }));
    }

    if (this.mediaUploadBtn) {
      this.mediaUploadBtn.addEventListener('click', () => this.uploadMediaAsset());
    }

    if (this.mediaLibrary) {
      this.mediaLibrary.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('button[data-copy-url]');
        if (!btn) return;
        this.copyText(btn.dataset.copyUrl || '');
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
        if (action === 'products' || action === 'categories') {
          setSelectedCompany(id);
          window.dispatchEvent(new CustomEvent('oako:navigate-admin-tab', { detail: { tab: action } }));
        }
        if (action === 'metrics') this.openMetricsPanel(id);
        if (action === 'preview') window.open(getStorePreviewPath(id), '_blank', 'noopener');
      });
    }

    if (this.addStoreBtn) {
      this.addStoreBtn.addEventListener('click', () => {
        this.resetForm();
        this.showStoreForm();
      });
    }

    if (this.startBakeryOnboardingBtn) {
      this.startBakeryOnboardingBtn.addEventListener('click', () => this.startOnboarding('bakery'));
    }

    if (this.startOrganicOnboardingBtn) {
      this.startOrganicOnboardingBtn.addEventListener('click', () => this.startOnboarding('organic'));
    }

    if (this.startBlankOnboardingBtn) {
      this.startBlankOnboardingBtn.addEventListener('click', () => this.startOnboarding('blank'));
    }

    if (this.previewRefreshBtn) {
      this.previewRefreshBtn.addEventListener('click', () => this.refreshPreview());
    }

    if (this.refreshActivityBtn) {
      this.refreshActivityBtn.addEventListener('click', () => this.loadStoreActivityTimeline());
    }

    document.addEventListener('click', (e) => {
      const mediaInputBtn = e.target?.closest?.('[data-media-input]');
      if (mediaInputBtn) {
        this.openMediaPicker({
          inputId: mediaInputBtn.dataset.mediaInput,
          previewId: mediaInputBtn.dataset.mediaPreview,
          containerId: mediaInputBtn.dataset.mediaContainer,
          labelId: mediaInputBtn.dataset.mediaLabel,
          previewMode: mediaInputBtn.dataset.mediaPreviewMode
        });
      }

      const campaignBtn = e.target?.closest?.('[data-media-campaign]');
      if (campaignBtn) {
        this.openMediaPicker({
          eventName: 'oako:campaign-media-selected',
          target: campaignBtn.dataset.mediaCampaign
        });
      }

      const previewModeBtn = e.target?.closest?.('[data-preview-mode]');
      if (previewModeBtn) {
        this.setPreviewMode(previewModeBtn.dataset.previewMode || 'desktop');
      }
    });

    if (this.previewOpenBtn) {
      this.previewOpenBtn.addEventListener('click', () => {
        const companyId = String(this.companyId?.value || getSelectedCompanyId()).trim();
        window.open(getStorePreviewPath(companyId), '_blank', 'noopener');
      });
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => this.saveStore(e));
      this.form.addEventListener('input', () => {
        this.renderLaunchChecklist();
        this.renderHomepageBuilderPreview();
      });
      this.form.addEventListener('change', () => {
        this.renderLaunchChecklist();
        this.renderHomepageBuilderPreview();
      });
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.resetForm());
    }

    if (this.applyPresetBtn) {
      this.applyPresetBtn.addEventListener('click', () => this.applySelectedThemePreset());
    }

    if (this.previewBtn) {
      this.previewBtn.addEventListener('click', () => {
        const companyId = String(this.companyId?.value || getSelectedCompanyId()).trim();
        window.open(getStorePreviewPath(companyId), '_blank', 'noopener');
      });
    }

    if (this.wizardBakeryBtn) {
      this.wizardBakeryBtn.addEventListener('click', () => this.applyStarter('bakery'));
    }

    if (this.wizardOrganicBtn) {
      this.wizardOrganicBtn.addEventListener('click', () => this.applyStarter('organic'));
    }

    if (this.logoUpload) {
      this.logoUpload.addEventListener('change', () => this.uploadLogo());
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
        this.renderStoreHealthAlerts();
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
      const blob = `${store.name || ''} ${store.contactName || ''} ${store.phone || ''} ${store.address || ''} ${store.email || ''} ${store.companyId || store.id || ''}`.toLowerCase();
      return blob.includes(term);
    });
  }

  getSelectedStore() {
    const companyId = getSelectedCompanyId();
    return this.stores.find((store) => (store.companyId || store.id) === companyId) || null;
  }

  async renderStoreHealthAlerts({ force = false } = {}) {
    if (!this.healthAlerts) return;

    const companyId = getSelectedCompanyId();
    const store = this.getSelectedStore();
    if (this.mediaScope) {
      this.mediaScope.textContent = companyId || 'Selected store';
    }

    if (!companyId) {
      this.healthAlerts.innerHTML = '<div class="inline-alert error">No store is selected.</div>';
      return;
    }

    const cached = this.metricsCache.get(companyId);
    if (!cached || force) {
      this.healthAlerts.innerHTML = `
        <div class="store-health-alert info">
          <strong>Checking ${escapeHtml(companyId)}...</strong>
          <span>Loading products, orders, inventory, and launch signals.</span>
        </div>
      `;
      await this.getMetricsForCompany(companyId, { force });
    }

    const metrics = this.metricsCache.get(companyId) || {};
    const alerts = this.buildStoreHealthAlerts(companyId, store, metrics);
    this.healthAlerts.innerHTML = alerts.map((alert) => `
      <div class="store-health-alert ${alert.level}">
        <div>
          <strong>${escapeHtml(alert.title)}</strong>
          <span>${escapeHtml(alert.detail)}</span>
        </div>
        <small>${escapeHtml(alert.label)}</small>
      </div>
    `).join('');
  }

  buildStoreHealthAlerts(companyId, store = {}, metrics = {}) {
    const alerts = [];
    const hosting = store?.hosting || {};
    const contact = store?.contact || {};
    const dnsStatus = hosting.dnsStatus || store?.dnsStatus || 'not_started';
    const website = store?.website || store?.customDomain || hosting.customDomain || '';

    const push = (level, title, detail, label) => alerts.push({ level, title, detail, label });

    if (!store) {
      push('critical', 'Store profile missing', `No companies document was found for ${companyId}.`, 'Setup');
      return alerts;
    }

    if (store.active === false || store.status === 'inactive') {
      push('critical', 'Store is inactive', 'Customers may not be able to access this storefront.', 'Visibility');
    }

    if (metrics.error) {
      push('warning', 'Metrics unavailable', 'Firestore rules or network state blocked product/order health checks.', 'Data');
    } else {
      if (Number(metrics.productsCount || 0) === 0) {
        push('critical', 'No products yet', 'Add products before sharing this store with customers.', 'Catalog');
      }

      if (Number(metrics.lowInventoryCount || 0) > 0) {
        push('warning', 'Low inventory detected', `${metrics.lowInventoryCount} inventory item(s) are at or below the low stock threshold.`, 'Inventory');
      }

      if (metrics.noOrders3d === true) {
        push('warning', 'No orders in 3 days', 'This store has not received recent orders. Check traffic, products, and checkout.', 'Sales');
      }
    }

    if (!website) {
      push('warning', 'Website not configured', 'Add a path or future custom domain so this store can be shared clearly.', 'Hosting');
    }

    if ((store.customDomain || hosting.customDomain) && dnsStatus !== 'connected') {
      push('warning', 'Domain not connected', `DNS status is ${dnsStatus}. Finish the hosting checklist before launch.`, 'DNS');
    }

    if (!store.logoUrl) {
      push('warning', 'Missing logo', 'Upload a logo or brand mark so this storefront feels complete.', 'Brand');
    }

    if (!(store.phone || contact.phone || contact.whatsapp || store.whatsapp)) {
      push('warning', 'Missing public contact', 'Add a phone or WhatsApp number so customers can reach the store.', 'Contact');
    }

    if (!store.launchStatus || store.launchStatus === 'draft') {
      push('warning', 'Launch status is draft', 'Move this store to ready or live when the checklist is complete.', 'Launch');
    }

    if (!alerts.length) {
      push('ok', 'Store looks healthy', 'No urgent issues found for the selected store.', 'Healthy');
    }

    return alerts;
  }

  async uploadMediaAsset() {
    const companyId = getSelectedCompanyId();
    const file = this.mediaUpload?.files?.[0];
    const type = String(this.mediaType?.value || 'other');

    if (!companyId) return alert('Select a store before uploading media.');
    if (!file) return alert('Choose an image to upload.');
    if (!String(file.type || '').startsWith('image/')) return alert('Only image uploads are supported here.');
    if (file.size > 5 * 1024 * 1024) return alert('Please upload an image smaller than 5MB.');

    const fileName = `${Date.now()}-${safeFileName(file.name)}`;
    const path = `stores/${companyId}/media/${type}/${fileName}`;

    if (this.mediaLibrary) {
      this.mediaLibrary.innerHTML = `
        <div class="store-health-alert info">
          <strong>Uploading asset...</strong>
          <span>${escapeHtml(file.name)}</span>
        </div>
      `;
    }

    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'store_media'), {
        companyId,
        type,
        name: file.name,
        path,
        url,
        contentType: file.type,
        size: file.size,
        createdAt: serverTimestamp()
      });

      if (this.mediaUpload) this.mediaUpload.value = '';
      await this.loadMediaLibrary();
      await logAudit('Media Asset Uploaded', `${type}: ${file.name}`);
      await this.loadStoreActivityTimeline();
      alert('Media asset uploaded.');
    } catch (err) {
      console.error('Media upload failed:', err);
      if (this.mediaLibrary) {
        this.mediaLibrary.innerHTML = `
          <div class="inline-alert error">
            Upload failed: ${escapeHtml(err.message)}. Check Storage rules for stores/{companyId}/media and Firestore rules for store_media.
          </div>
        `;
      }
    }
  }

  async loadMediaLibrary() {
    if (!this.mediaLibrary) return;

    const companyId = getSelectedCompanyId();
    if (this.mediaScope) this.mediaScope.textContent = companyId || 'Selected store';
    if (!companyId) {
      this.mediaLibrary.innerHTML = '<div class="inline-alert">Select a store to view its media.</div>';
      return;
    }

    this.mediaLibrary.innerHTML = '<div class="skeleton-row"></div>';

    try {
      let snap;
      try {
        snap = await getDocs(query(
          collection(db, 'store_media'),
          where('companyId', '==', companyId),
          orderBy('createdAt', 'desc')
        ));
      } catch (indexedErr) {
        snap = await getDocs(query(collection(db, 'store_media'), where('companyId', '==', companyId)));
      }

      const assets = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = toDate(a.createdAt)?.getTime() || 0;
          const bTime = toDate(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });

      if (!assets.length) {
        this.mediaLibrary.innerHTML = `
          <div class="store-media-empty">
            <strong>No assets yet</strong>
            <span>Upload logos, hero images, QR codes, and campaign assets for ${escapeHtml(companyId)}.</span>
          </div>
        `;
        return;
      }

      this.mediaLibrary.innerHTML = `
        <div class="store-media-grid">
          ${assets.map((asset) => this.renderMediaAsset(asset)).join('')}
        </div>
      `;
    } catch (err) {
      console.warn('Media library load failed:', err);
      this.mediaLibrary.innerHTML = `
        <div class="inline-alert error">
          Media library could not load: ${escapeHtml(err.message)}. Check Firestore rules for store_media.
        </div>
      `;
    }
  }

  renderMediaAsset(asset) {
    const createdAt = toDate(asset.createdAt);
    const created = createdAt ? createdAt.toLocaleDateString([], { dateStyle: 'medium' }) : 'Recently';
    const kb = Math.max(1, Math.round(Number(asset.size || 0) / 1024));
    const url = String(asset.url || '');

    return `
      <article class="store-media-card">
        <div class="store-media-thumb">
          ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(asset.name || 'Store media')}">` : '<span>No preview</span>'}
        </div>
        <div class="store-media-meta">
          <strong>${escapeHtml(asset.name || 'Untitled asset')}</strong>
          <span>${escapeHtml(asset.type || 'other')} • ${kb} KB • ${escapeHtml(created)}</span>
        </div>
        <button type="button" class="btn-secondary" data-copy-url="${escapeHtml(url)}">Copy URL</button>
      </article>
    `;
  }

  async copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      alert('URL copied.');
    } catch (err) {
      window.prompt('Copy this URL:', text);
    }
  }

  getOrCreateMediaPickerModal() {
    let modal = document.getElementById('storeMediaPickerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'storeMediaPickerModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-panel store-media-picker-panel">
        <div class="modal-header">
          <div>
            <div class="eyebrow">Media Library</div>
            <h3>Choose an asset</h3>
          </div>
          <button type="button" id="closeStoreMediaPicker" class="icon-button" aria-label="Close media picker">x</button>
        </div>
        <div class="store-media-picker-search">
          <input type="text" id="storeMediaPickerSearch" placeholder="Search by name or type...">
        </div>
        <div id="storeMediaPickerBody" class="store-media-picker-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.closeMediaPicker();
      const asset = event.target?.closest?.('[data-media-url]');
      if (!asset) return;
      this.applyPickedMedia(asset.dataset.mediaUrl || '');
    });
    modal.querySelector('#closeStoreMediaPicker')?.addEventListener('click', () => this.closeMediaPicker());
    modal.querySelector('#storeMediaPickerSearch')?.addEventListener('input', () => this.renderMediaPickerAssets());

    return modal;
  }

  async openMediaPicker(options = {}) {
    this.mediaPickerTarget = options;
    const modal = this.getOrCreateMediaPickerModal();
    const body = modal.querySelector('#storeMediaPickerBody');
    if (body) body.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';
    modal.classList.remove('hidden');
    await this.renderMediaPickerAssets();
  }

  closeMediaPicker() {
    document.getElementById('storeMediaPickerModal')?.classList.add('hidden');
  }

  async getMediaAssetsForSelectedStore() {
    const companyId = getSelectedCompanyId();
    if (!companyId) return [];

    let snap;
    try {
      snap = await getDocs(query(
        collection(db, 'store_media'),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      ));
    } catch (err) {
      snap = await getDocs(query(collection(db, 'store_media'), where('companyId', '==', companyId)));
    }

    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
  }

  async renderMediaPickerAssets() {
    const modal = this.getOrCreateMediaPickerModal();
    const body = modal.querySelector('#storeMediaPickerBody');
    const search = String(modal.querySelector('#storeMediaPickerSearch')?.value || '').trim().toLowerCase();
    if (!body) return;

    try {
      const assets = (await this.getMediaAssetsForSelectedStore()).filter((asset) => {
        if (!search) return true;
        return `${asset.name || ''} ${asset.type || ''}`.toLowerCase().includes(search);
      });

      if (!assets.length) {
        body.innerHTML = '<div class="inline-alert">No matching media assets for this store yet.</div>';
        return;
      }

      body.innerHTML = `
        <div class="store-media-picker-grid">
          ${assets.map((asset) => `
            <button type="button" class="store-media-picker-card" data-media-url="${escapeHtml(asset.url || '')}">
              <img src="${escapeHtml(asset.url || '')}" alt="${escapeHtml(asset.name || 'Media asset')}">
              <strong>${escapeHtml(asset.name || 'Untitled asset')}</strong>
              <span>${escapeHtml(asset.type || 'other')}</span>
            </button>
          `).join('')}
        </div>
      `;
    } catch (err) {
      body.innerHTML = `<div class="inline-alert error">Could not load media assets: ${escapeHtml(err.message)}</div>`;
    }
  }

  applyPickedMedia(url) {
    const target = this.mediaPickerTarget || {};

    if (target.inputId) {
      const input = document.getElementById(target.inputId);
      if (input) {
        input.value = url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const preview = document.getElementById(target.previewId);
      if (preview) {
        if (target.previewMode === 'background') {
          preview.innerHTML = `<img src="${escapeHtml(url)}" style="max-height:100px; max-width:100%; object-fit:contain;">`;
        } else {
          preview.src = url;
        }
      }

      const container = document.getElementById(target.containerId);
      if (container) container.style.display = 'flex';

      const label = document.getElementById(target.labelId);
      if (label) label.textContent = 'Media Library Asset';
    }

    if (target.eventName) {
      window.dispatchEvent(new CustomEvent(target.eventName, {
        detail: { url, target: target.target || '' }
      }));
    }

    this.closeMediaPicker();
  }

  setPreviewMode(mode = 'desktop') {
    if (!this.previewShell) return;
    this.previewShell.classList.remove('desktop', 'tablet', 'mobile');
    this.previewShell.classList.add(['desktop', 'tablet', 'mobile'].includes(mode) ? mode : 'desktop');
  }

  async loadStoreActivityTimeline() {
    if (!this.activityTimeline) return;
    const companyId = getSelectedCompanyId();
    this.activityTimeline.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';

    try {
      let snap;
      try {
        snap = await getDocs(query(
          collection(db, 'audit_logs'),
          where('companyId', '==', companyId),
          orderBy('timestamp', 'desc'),
          limit(12)
        ));
      } catch (err) {
        snap = await getDocs(query(collection(db, 'audit_logs'), where('companyId', '==', companyId)));
      }

      const logs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.timestamp)?.getTime() || 0) - (toDate(a.timestamp)?.getTime() || 0))
        .slice(0, 12);

      if (!logs.length) {
        this.activityTimeline.innerHTML = '<div class="inline-alert">No activity logged for this store yet.</div>';
        return;
      }

      this.activityTimeline.innerHTML = logs.map((log) => {
        const date = toDate(log.timestamp);
        const displayDate = date ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown time';
        return `
          <div class="store-activity-item">
            <span></span>
            <div>
              <strong>${escapeHtml(log.action || 'Activity')}</strong>
              <small>${escapeHtml(log.details || '')}</small>
            </div>
            <time>${escapeHtml(displayDate)}</time>
          </div>
        `;
      }).join('');
    } catch (err) {
      this.activityTimeline.innerHTML = `<div class="inline-alert error">Could not load activity: ${escapeHtml(err.message)}</div>`;
    }
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
      const pageViews = metrics?.pageViews ?? '...';

      const alertParts = [];
      if (store.active === false) alertParts.push('Inactive');
      if (metrics?.noOrders3d === true) alertParts.push('No orders 3d');
      if (typeof metrics?.lowInventoryCount === 'number' && metrics.lowInventoryCount > 0) alertParts.push(`Low inv: ${metrics.lowInventoryCount}`);

      const alerts = alertParts.length ? alertParts.join(' • ') : 'OK';
      const isSelected = id === selected;
      const readiness = this.getStoreReadiness(store, metrics);

      return `
        <tr>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
              <strong>${store.name || id}</strong>
              <span style="font-size:0.85rem; color:#666;">${id}${isSelected ? ' • selected' : ''} • ${store.launchStatus || store.status || 'live'}</span>
              <span style="font-size:0.8rem; color:${readiness.score >= 80 ? '#2e7d32' : readiness.score >= 55 ? '#92400e' : '#c62828'}; font-weight:800;">Launch ready: ${readiness.score}%</span>
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
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
              ${store.website ? `<a href="${store.website.startsWith('http') ? store.website : `https://${store.website}`}" target="_blank" rel="noopener" style="color:#2e7d32; font-weight:700; text-decoration:none;">${store.website}</a>` : ''}
              ${store.customDomain || store.hosting?.customDomain ? `<span style="font-size:0.85rem; color:#666;">Domain: ${store.customDomain || store.hosting.customDomain}</span>` : ''}
              ${store.hosting?.dnsStatus ? `<span style="font-size:0.8rem; color:#888;">DNS: ${store.hosting.dnsStatus}</span>` : ''}
            </div>
          </td>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; flex-direction:column; gap:0.15rem;">
              <span><strong>${ordersCount}</strong> orders</span>
              <span><strong>${revenue}</strong> revenue</span>
              <span><strong>${productsCount}</strong> products</span>
              <span><strong>${pageViews}</strong> visits</span>
            </div>
          </td>
          <td style="padding:10px; border-bottom:1px solid #eee; color:${alerts === 'OK' ? '#2e7d32' : '#c62828'}; font-weight:700;">${alerts}</td>
          <td style="padding:10px; border-bottom:1px solid #eee;">
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn-secondary" data-action="switch" data-id="${id}">Switch</button>
              <button type="button" class="btn-secondary" data-action="products" data-id="${id}">Products</button>
              <button type="button" class="btn-secondary" data-action="categories" data-id="${id}">Categories</button>
              <button type="button" class="btn-secondary" data-action="edit" data-id="${id}">Edit</button>
              <button type="button" class="btn-secondary" data-action="preview" data-id="${id}">Preview</button>
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

  async getMetricsForCompany(companyId, { force = false } = {}) {
    if (!companyId) return null;
    if (!force && this.metricsCache.has(companyId)) {
      return this.metricsCache.get(companyId);
    }

    await this.loadMetricsForCompany(companyId);
    this.render();
    return this.metricsCache.get(companyId);
  }

  getOrCreateMetricsModal() {
    let modal = document.getElementById('storeMetricsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'storeMetricsModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-panel store-metrics-panel">
        <div class="modal-header">
          <div>
            <div class="eyebrow">Store Analytics</div>
            <h3 id="storeMetricsTitle">Metrics</h3>
          </div>
          <button type="button" id="closeStoreMetricsModal" class="icon-button" aria-label="Close metrics">x</button>
        </div>
        <div id="storeMetricsBody" class="store-metrics-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.closeMetricsPanel();
      const actionButton = event.target?.closest?.('button[data-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.action;
      const companyId = actionButton.dataset.id;
      if ((action === 'products' || action === 'categories') && companyId) {
        setSelectedCompany(companyId);
        this.closeMetricsPanel();
        window.dispatchEvent(new CustomEvent('oako:navigate-admin-tab', { detail: { tab: action } }));
      }
    });
    modal.querySelector('#closeStoreMetricsModal')?.addEventListener('click', () => this.closeMetricsPanel());

    return modal;
  }

  closeMetricsPanel() {
    document.getElementById('storeMetricsModal')?.classList.add('hidden');
  }

  async openMetricsPanel(companyId) {
    const modal = this.getOrCreateMetricsModal();
    const title = modal.querySelector('#storeMetricsTitle');
    const body = modal.querySelector('#storeMetricsBody');
    const store = this.stores.find((s) => (s.companyId || s.id) === companyId) || { companyId };

    if (title) title.textContent = `${store.name || companyId} metrics`;
    if (body) {
      body.innerHTML = `
        <div class="store-metrics-loading">
          <strong>Loading analytics...</strong>
          <span>Pulling orders, products, inventory, and storefront events.</span>
        </div>
      `;
    }

    modal.classList.remove('hidden');

    const metrics = await this.getMetricsForCompany(companyId, { force: true });
    if (body) body.innerHTML = this.renderMetricsPanel(companyId, store, metrics);
  }

  renderMetricsPanel(companyId, store, metrics = {}) {
    if (!metrics || metrics.error) {
      return `<div class="inline-alert error">Metrics could not load for ${escapeHtml(companyId)}.</div>`;
    }

    const conversion = metrics.pageViews > 0 ? `${((metrics.ordersCount / metrics.pageViews) * 100).toFixed(1)}%` : 'n/a';
    const lastOrder = metrics.lastOrderAt ? new Date(metrics.lastOrderAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No orders yet';
    const updated = metrics.updatedAt ? new Date(metrics.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now';

    const statusRows = Object.entries(metrics.ordersByStatus || {})
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => `<div class="store-metric-row"><span>${escapeHtml(status || 'unknown')}</span><strong>${count}</strong></div>`)
      .join('') || '<div class="store-metric-row muted"><span>No order statuses yet</span><strong>0</strong></div>';

    const eventRows = Object.entries(metrics.eventsByType || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => `<div class="store-metric-row"><span>${escapeHtml(type || 'event')}</span><strong>${count}</strong></div>`)
      .join('') || '<div class="store-metric-row muted"><span>No storefront events yet</span><strong>0</strong></div>';

    const topProducts = (metrics.topProducts || [])
      .map((item) => `<div class="store-metric-row"><span>${escapeHtml(item.name)}</span><strong>${item.qty}</strong></div>`)
      .join('') || '<div class="store-metric-row muted"><span>No product signals yet</span><strong>0</strong></div>';

    return `
      <div class="store-metrics-summary">
        <div>
          <span class="metric-label">Orders</span>
          <strong>${metrics.ordersCount}</strong>
          <small>${metrics.recentOrders3d} in last 3 days</small>
        </div>
        <div>
          <span class="metric-label">Revenue</span>
          <strong>${formatMoney(metrics.revenue)}</strong>
          <small>Avg order ${formatMoney(metrics.averageOrderValue)}</small>
        </div>
        <div>
          <span class="metric-label">Visits</span>
          <strong>${metrics.pageViews}</strong>
          <small>${metrics.analyticsEvents} total events</small>
        </div>
        <div>
          <span class="metric-label">Conversion</span>
          <strong>${conversion}</strong>
          <small>Orders / visits</small>
        </div>
      </div>

      <div class="store-metrics-grid">
        <section class="store-metrics-card">
          <h4>Catalog Health</h4>
          <div class="store-metric-row"><span>Total products</span><strong>${metrics.productsCount}</strong></div>
          <div class="store-metric-row"><span>Active products</span><strong>${metrics.activeProducts}</strong></div>
          <div class="store-metric-row"><span>Hidden / inactive</span><strong>${metrics.inactiveProducts}</strong></div>
          <div class="store-metric-row"><span>Low inventory items</span><strong>${metrics.lowInventoryCount ?? 0}</strong></div>
        </section>

        <section class="store-metrics-card">
          <h4>Order Status</h4>
          ${statusRows}
        </section>

        <section class="store-metrics-card">
          <h4>Storefront Events</h4>
          ${eventRows}
        </section>

        <section class="store-metrics-card">
          <h4>Top Ordered Products</h4>
          ${topProducts}
        </section>
      </div>

      <div class="store-metrics-footer">
        <span>Last order: ${escapeHtml(lastOrder)}</span>
        <span>Updated ${escapeHtml(updated)}</span>
        <button type="button" class="btn-secondary" data-action="products" data-id="${escapeHtml(companyId)}">Manage Products</button>
        <button type="button" class="btn-secondary" data-action="categories" data-id="${escapeHtml(companyId)}">Manage Categories</button>
      </div>
    `;
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
          if (companyId === getSelectedCompanyId()) this.renderStoreHealthAlerts();
          this.render();
          this.processMetricsQueue();
        });
    }
  }

  async loadMetricsForCompany(companyId) {
    try {
      const ordersBase = query(
        collection(db, 'orders'),
        where('companyId', '==', companyId),
        where('status', 'in', ACTIVE_ORDER_STATUSES),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const productsBase = query(collection(db, 'products'), where('companyId', '==', companyId));
      const eventsBase = query(collection(db, 'storefront_events'), where('companyId', '==', companyId));

      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const [ordersSnap, productsSnap, eventsSnap, lowInv] = await Promise.all([
        getDocs(ordersBase),
        getDocs(productsBase),
        getDocs(eventsBase).catch(() => ({ docs: [] })),
        this.computeLowInventory(companyId).catch(() => null)
      ]);

      const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const ordersCount = orders.length;
      const productsCount = products.length;
      const activeProducts = products.filter((product) => product.active !== false).length;
      const inactiveProducts = Math.max(0, productsCount - activeProducts);
      const revenue = orders.reduce((sum, order) => {
        const value = Number(order.total ?? order.price ?? 0);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      const averageOrderValue = ordersCount ? revenue / ordersCount : 0;

      const recentCount = orders.filter((order) => {
        const createdAt = toDate(order.createdAt);
        return createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) && createdAt >= cutoff;
      }).length;
      const noOrders3d = ordersCount > 0 ? recentCount === 0 : true;
      const lastOrderAt = orders
        .map((order) => toDate(order.createdAt))
        .filter(Boolean)
        .sort((a, b) => b.getTime() - a.getTime())[0]?.getTime() || null;
      const ordersByStatus = orders.reduce((acc, order) => {
        const status = String(order.status || 'unknown');
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      const eventsByType = events.reduce((acc, event) => {
        const type = String(event.actionType || event.type || 'event');
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      const pageViews = events.filter((event) => (event.actionType || event.type) === 'page_view').length;
      const productDemand = new Map();

      orders.forEach((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item) => {
          const name = item.name || item.name_en || item.productName || item.productId || item.id || 'Product';
          const qty = Number(item.quantity ?? item.qty ?? 1);
          productDemand.set(name, (productDemand.get(name) || 0) + (Number.isFinite(qty) ? qty : 1));
        });
      });

      const topProducts = Array.from(productDemand.entries())
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      this.metricsCache.set(companyId, {
        ordersCount,
        revenue,
        averageOrderValue,
        productsCount,
        activeProducts,
        inactiveProducts,
        pageViews,
        analyticsEvents: events.length,
        recentOrders3d: recentCount,
        noOrders3d,
        lowInventoryCount: lowInv,
        lastOrderAt,
        ordersByStatus,
        eventsByType,
        topProducts,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Metrics load failed for', companyId, e);
      this.metricsCache.set(companyId, {
        ordersCount: 'ERR',
        revenue: 'ERR',
        productsCount: 'ERR',
        pageViews: 'ERR',
        error: true,
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
    if (this.launchStatus) this.launchStatus.value = 'draft';
    this.applyStorefrontConfigToForm(getFallbackStoreConfig(COMPANY_ID));
    this.refreshPreview();
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
    this.hideStoreForm();
  }

  showStoreForm() {
    if (this.formCard) this.formCard.hidden = false;
  }

  hideStoreForm() {
    if (this.formCard) this.formCard.hidden = true;
  }

  refreshPreview() {
    if (!this.previewFrame) return;
    const companyId = String(this.companyId?.value || getSelectedCompanyId()).trim();
    this.previewFrame.src = `${getStorePreviewPath(companyId)}?preview=${Date.now()}`;
  }

  async editStore(companyId) {
    const store = this.stores.find((s) => (s.companyId || s.id) === companyId);
    if (!store) return;

    if (this.editId) this.editId.value = companyId;
    if (this.companyId) {
      this.companyId.value = companyId;
      this.companyId.disabled = true;
    }
    if (this.name) this.name.value = store.name || '';
    if (this.plan) this.plan.value = store.plan || 'free';
    if (this.launchStatus) this.launchStatus.value = store.launchStatus || store.status || 'live';
    if (this.contactName) this.contactName.value = store.contactName || '';
    if (this.phone) this.phone.value = store.phone || '';
    if (this.address) this.address.value = store.address || '';
    if (this.twoGisLink) this.twoGisLink.value = store.twoGisLink || '';
    if (this.website) this.website.value = store.website || '';
    if (this.email) this.email.value = store.contact?.email || store.email || '';
    if (this.whatsapp) this.whatsapp.value = store.contact?.whatsapp || store.whatsapp || store.phone || '';
    if (this.instagram) this.instagram.value = store.social?.instagram || store.instagram || '';
    if (this.openingHours) this.openingHours.value = store.contact?.openingHours || store.openingHours || '';
    if (this.customDomain) this.customDomain.value = store.hosting?.customDomain || store.customDomain || '';
    if (this.githubTarget) this.githubTarget.value = store.hosting?.githubTarget || '';
    if (this.dnsStatus) this.dnsStatus.value = store.hosting?.dnsStatus || 'not_started';
    if (this.hostingNotes) this.hostingNotes.value = store.hosting?.notes || '';
    const checklist = store.hosting?.checklist || {};
    if (this.domainPurchased) this.domainPurchased.checked = checklist.domainPurchased === true;
    if (this.dnsConfigured) this.dnsConfigured.checked = checklist.dnsConfigured === true;
    if (this.hostingConnected) this.hostingConnected.checked = checklist.hostingConnected === true;
    if (this.sslActive) this.sslActive.checked = checklist.sslActive === true;
    if (this.finalTested) this.finalTested.checked = checklist.finalTested === true;
    if (this.tags) this.tags.value = Array.isArray(store.tags) ? store.tags.join(', ') : '';
    if (this.notes) this.notes.value = store.notes || '';
    if (this.active) this.active.checked = store.active !== false;
    if (this.formTitle) this.formTitle.textContent = `Edit Store: ${store.name || companyId}`;
    this.showStoreForm();
    const publicConfig = await this.loadStorefrontConfig(companyId, store);
    this.applyStorefrontConfigToForm(publicConfig);
    this.refreshPreview();
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
    this.form?.scrollIntoView?.({ behavior: 'smooth' });
  }

  async loadStorefrontConfig(companyId, store = {}) {
    const fallback = {
      ...getFallbackStoreConfig(companyId),
      name: store.name || getFallbackStoreConfig(companyId).name,
      domain: store.website || getFallbackStoreConfig(companyId).domain
    };

    try {
      const snap = await getDoc(doc(db, 'storefront_configs', companyId));
      if (!snap.exists()) return fallback;
      const data = snap.data() || {};
      return {
        ...fallback,
        ...data,
        theme: { ...fallback.theme, ...(data.theme || {}) },
        features: { ...fallback.features, ...(data.features || {}) },
        content: {
          ...fallback.content,
          ...(data.content || {}),
          hero: { ...(fallback.content?.hero || {}), ...(data.content?.hero || {}) }
        }
      };
    } catch (err) {
      console.warn('Storefront config load failed:', err);
      return fallback;
    }
  }

  applyStorefrontConfigToForm(config = {}) {
    const theme = config.theme || {};
    const features = config.features || {};
    const hero = config.content?.hero || {};
    const seo = config.seo || {};
    const productDisplay = config.productDisplay || {};
    const layout = Array.isArray(config.layout) ? config.layout : [];
    const hasSection = (type, fallback = false) => {
      const section = layout.find((item) => item.type === type);
      return section ? section.enabled !== false : fallback;
    };

    if (this.themePreset) this.themePreset.value = '';
    if (this.themePrimary) this.themePrimary.value = theme.primaryColor || '#76bc21';
    if (this.themeSecondary) this.themeSecondary.value = theme.secondaryColor || '#f3f7ea';
    if (this.themeAccent) this.themeAccent.value = theme.accentColor || '#f57c00';
    if (this.themeBackground) this.themeBackground.value = theme.backgroundColor || '#f9f9f9';
    if (this.themeText) this.themeText.value = theme.textColor || '#333333';
    if (this.themeFont) this.themeFont.value = theme.fontFamily || 'Outfit';
    if (this.themeRadius) this.themeRadius.value = theme.borderRadius || '8px';
    if (this.buttonStyle) this.buttonStyle.value = theme.buttonStyle || 'rounded';
    if (this.logoUrl) this.logoUrl.value = config.logoUrl || config.content?.logoUrl || '';
    if (this.seoTitle) this.seoTitle.value = seo.title || '';
    if (this.seoDescription) this.seoDescription.value = seo.description || '';
    if (this.seoImage) this.seoImage.value = seo.imageUrl || '';
    if (this.seoKeywords) this.seoKeywords.value = Array.isArray(seo.keywords) ? seo.keywords.join(', ') : (seo.keywords || '');

    if (this.featureCampaign) this.featureCampaign.checked = features.campaign === true;
    if (this.featureInvestment) this.featureInvestment.checked = features.investmentSection === true;
    if (this.featureQuickActions) this.featureQuickActions.checked = features.quickActions === true;
    if (this.featureDelivery) this.featureDelivery.checked = features.deliveryBanner !== false;
    if (this.featureCart) this.featureCart.checked = features.cart !== false;
    if (this.featureWhatsapp) this.featureWhatsapp.checked = features.whatsappSupport !== false;
    if (this.featureSubscriptions) this.featureSubscriptions.checked = features.subscriptions === true;

    if (this.layoutHero) this.layoutHero.checked = hasSection('hero', true);
    if (this.layoutQuickActions) this.layoutQuickActions.checked = hasSection('quickActions', features.quickActions === true);
    if (this.layoutCampaign) this.layoutCampaign.checked = hasSection('campaign', features.campaign === true);
    if (this.layoutProducts) this.layoutProducts.checked = hasSection('products', true);
    if (this.layoutCta) this.layoutCta.checked = hasSection('cta', features.investmentSection === true);
    if (this.layoutOrder) {
      const order = layout.length ? layout.map((item) => item.type).join(',') : 'hero,quickActions,campaign,products,cta';
      this.layoutOrder.value = order;
    }

    if (this.heroTitle) this.heroTitle.value = hero.title || '';
    if (this.heroSubtitle) this.heroSubtitle.value = hero.subtitle || '';
    if (this.heroCta) this.heroCta.value = hero.ctaText || '';
    if (this.heroImage) this.heroImage.value = hero.imageUrl || '';
    if (this.productHeading) this.productHeading.value = config.content?.productHeading || '';
    if (this.availableTitle) this.availableTitle.value = config.content?.availableTodayTitle || '';
    if (this.availableLabel) this.availableLabel.value = config.content?.availableTodayLabel || '';
    if (this.deliveryTitle) this.deliveryTitle.value = config.content?.deliveryBanner?.title || '';
    if (this.deliverySubtitle) this.deliverySubtitle.value = config.content?.deliveryBanner?.subtitle || '';
    if (this.ctaTitle) this.ctaTitle.value = config.content?.cta?.title || '';
    if (this.ctaText) this.ctaText.value = config.content?.cta?.text || '';
    if (this.ctaButton) this.ctaButton.value = config.content?.cta?.buttonText || '';
    if (this.ctaHref) this.ctaHref.value = config.content?.cta?.href || '';

    if (this.productView) this.productView.value = productDisplay.view || 'grid';
    if (this.productCardSize) this.productCardSize.value = productDisplay.cardSize || 'medium';
    if (this.productShowPrice) this.productShowPrice.checked = productDisplay.showPrice !== false;
    if (this.productShowBadges) this.productShowBadges.checked = productDisplay.showBadges !== false;
    if (this.productShowStock) this.productShowStock.checked = productDisplay.showStock !== false;

    const quickActions = Array.isArray(config.content?.quickActions) ? config.content.quickActions : [];
    this.quickActions.forEach((input, index) => {
      if (!input) return;
      const action = quickActions[index] || {};
      input.value = [action.icon, action.title].filter(Boolean).join(' ').trim();
    });
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
  }

  applyThemePreset(presetKey) {
    const preset = THEME_PRESETS[presetKey];
    if (!preset) return false;

    if (this.themePreset) this.themePreset.value = presetKey;
    if (this.themePrimary) this.themePrimary.value = preset.primaryColor;
    if (this.themeSecondary) this.themeSecondary.value = preset.secondaryColor;
    if (this.themeAccent) this.themeAccent.value = preset.accentColor;
    if (this.themeBackground) this.themeBackground.value = preset.backgroundColor;
    if (this.themeText) this.themeText.value = preset.textColor;
    if (this.themeFont) this.themeFont.value = preset.fontFamily;
    if (this.themeRadius) this.themeRadius.value = preset.borderRadius;
    if (this.buttonStyle) this.buttonStyle.value = preset.buttonStyle;
    return true;
  }

  applySelectedThemePreset() {
    const presetKey = this.themePreset?.value;
    if (!presetKey) return alert('Choose a theme preset first.');
    this.applyThemePreset(presetKey);
  }

  async uploadLogo() {
    const file = this.logoUpload?.files?.[0];
    if (!file) return;

    const companyId = String(this.companyId?.value || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!companyId) {
      this.logoUpload.value = '';
      return alert('Enter a Company ID before uploading a logo.');
    }

    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const logoRef = ref(storage, `stores/${companyId}/branding/logo-${Date.now()}.${ext}`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      if (this.logoUrl) this.logoUrl.value = url;
      this.renderLaunchChecklist();
      alert('Logo uploaded. Save the store to publish it.');
    } catch (err) {
      console.error(err);
      alert('Logo upload failed: ' + err.message);
    }
  }

  applyStarter(type) {
    const starter = type === 'organic'
      ? getFallbackStoreConfig(COMPANY_ID)
      : getFallbackStoreConfig('dailybread');

    this.applyStorefrontConfigToForm(starter);
    this.applyThemePreset(type === 'organic' ? 'organic' : 'bakery');

    if (this.layoutHero) this.layoutHero.checked = true;
    if (this.layoutProducts) this.layoutProducts.checked = true;
    if (this.layoutQuickActions) this.layoutQuickActions.checked = type === 'organic';
    if (this.layoutCampaign) this.layoutCampaign.checked = type === 'organic';
    if (this.layoutCta) this.layoutCta.checked = type === 'organic';
    if (this.layoutOrder) this.layoutOrder.value = type === 'organic'
      ? 'hero,campaign,quickActions,products,cta'
      : 'hero,products,quickActions,campaign,cta';

    if (this.featureCampaign) this.featureCampaign.checked = type === 'organic';
    if (this.featureInvestment) this.featureInvestment.checked = type === 'organic';
    if (this.featureQuickActions) this.featureQuickActions.checked = type === 'organic';
    if (this.featureDelivery) this.featureDelivery.checked = true;
    if (this.featureCart) this.featureCart.checked = true;
    if (this.featureWhatsapp) this.featureWhatsapp.checked = true;

    if (this.heroTitle && !this.heroTitle.value.trim()) {
      this.heroTitle.value = type === 'organic' ? 'Organic groceries from Kyrgyzstan' : 'Fresh Bread Daily';
    }
    if (this.productHeading) this.productHeading.value = type === 'organic' ? 'Full Catalog' : 'Fresh from Daily Bread';
    if (this.availableTitle) this.availableTitle.value = type === 'organic' ? 'Available Today' : 'Baked Today';
    if (this.availableLabel) this.availableLabel.value = type === 'organic' ? 'Fresh Stock' : 'Warm from the oven';
    if (this.deliveryTitle) this.deliveryTitle.value = type === 'organic' ? 'Delivery across Bishkek and nearby areas' : 'Fresh bread delivered around Bishkek';
    if (this.deliverySubtitle) this.deliverySubtitle.value = type === 'organic' ? 'Eco-friendly local producers at your doorstep' : 'Order today for soft, fresh bakery favorites';
    if (this.ctaTitle) this.ctaTitle.value = type === 'organic' ? 'Invest in Biscotti Miste' : 'Need a custom bakery order?';
    if (this.ctaText) this.ctaText.value = type === 'organic' ? 'Join our community of investors and support local organic production.' : 'Message us for office boxes, events, and special bread orders.';
    if (this.ctaButton) this.ctaButton.value = type === 'organic' ? 'Learn More' : 'Contact Us';
    if (this.ctaHref) this.ctaHref.value = type === 'organic' ? 'biscotti.html' : '#products';
    if (this.seoTitle) this.seoTitle.value = type === 'organic' ? 'OA Kyrgyz Organic | Organic groceries in Bishkek' : 'Daily Bread | Fresh bread in Bishkek';
    if (this.seoDescription) this.seoDescription.value = type === 'organic'
      ? 'Fresh local organic products from Kyrgyzstan delivered around Bishkek.'
      : 'Fresh bread baked daily and delivered around Bishkek.';
    if (this.seoKeywords) this.seoKeywords.value = type === 'organic'
      ? 'organic, groceries, Bishkek, Kyrgyzstan'
      : 'bread, bakery, Bishkek, daily bread';
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
  }

  startOnboarding(type) {
    this.resetForm();
    this.showStoreForm();

    if (type === 'bakery') {
      this.applyStarter('bakery');
      if (this.name && !this.name.value) this.name.value = 'Daily Bread';
      if (this.tags) this.tags.value = 'bakery, cafe';
      if (this.plan) this.plan.value = 'free';
    } else if (type === 'organic') {
      this.applyStarter('organic');
      if (this.name && !this.name.value) this.name.value = 'New Organic Store';
      if (this.tags) this.tags.value = 'organic, grocery';
      if (this.plan) this.plan.value = 'pro';
    } else {
      this.applyStorefrontConfigToForm(getFallbackStoreConfig(COMPANY_ID));
      if (this.plan) this.plan.value = 'free';
    }

    if (this.launchStatus) this.launchStatus.value = 'draft';
    this.renderLaunchChecklist();
    this.renderHomepageBuilderPreview();
    this.companyId?.focus();
    this.form?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  renderLaunchChecklist() {
    if (!this.launchChecklist) return;

    const checks = this.getLaunchChecklistItems();
    const complete = checks.filter(([, ok]) => ok).length;
    const score = Math.round((complete / Math.max(1, checks.length)) * 100);
    const missing = checks.filter(([, ok]) => !ok).slice(0, 3).map(([label]) => label);

    this.launchChecklist.innerHTML = `
      <div class="launch-score-card">
        <div>
          <strong>Launch Readiness</strong>
          <span>${complete}/${checks.length} complete${missing.length ? ` • Next: ${missing.join(', ')}` : ''}</span>
        </div>
        <div class="launch-score-number">${score}%</div>
      </div>
      <div class="launch-progress"><span style="width:${score}%;"></span></div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:0.4rem; margin-top:0.75rem;">
        ${checks.map(([label, ok]) => `
          <div style="color:${ok ? '#2e7d32' : '#777'}; font-weight:${ok ? '700' : '500'};">
            ${ok ? '&check;' : '&cir;'} ${label}
          </div>
        `).join('')}
      </div>
    `;
  }

  getLaunchChecklistItems() {
    return [
      ['Company ID added', !!String(this.companyId?.value || '').trim()],
      ['Store name added', !!String(this.name?.value || '').trim()],
      ['Contact phone added', !!String(this.phone?.value || '').trim()],
      ['Logo added', !!String(this.logoUrl?.value || '').trim()],
      ['Hero title added', !!String(this.heroTitle?.value || '').trim()],
      ['Products section enabled', this.layoutProducts?.checked !== false],
      ['Cart enabled', this.featureCart?.checked !== false],
      ['WhatsApp support enabled', this.featureWhatsapp?.checked !== false],
      ['Delivery copy added', !!String(this.deliveryTitle?.value || '').trim()],
      ['SEO title added', !!String(this.seoTitle?.value || '').trim()],
      ['SEO description added', !!String(this.seoDescription?.value || '').trim()],
      ['Domain plan started', !!String(this.customDomain?.value || this.website?.value || '').trim()],
      ['Theme selected', !!String(this.themePrimary?.value || '').trim() && !!String(this.themeFont?.value || '').trim()],
      ['Preview checked', !!this.previewFrame?.src]
    ];
  }

  getStoreReadiness(store = {}, metrics = {}) {
    const hosting = store.hosting || {};
    const contact = store.contact || {};
    const checks = [
      Boolean(store.companyId || store.id),
      Boolean(store.name),
      Boolean(store.phone || contact.whatsapp),
      Boolean(store.website || store.customDomain || hosting.customDomain),
      store.active !== false,
      Boolean(store.launchStatus && store.launchStatus !== 'draft'),
      metrics?.productsCount === 'ERR' ? false : Number(metrics?.productsCount || 0) > 0,
      metrics?.lowInventoryCount === 'ERR' ? false : Number(metrics?.lowInventoryCount || 0) === 0
    ];
    const complete = checks.filter(Boolean).length;
    return { score: Math.round((complete / checks.length) * 100), complete, total: checks.length };
  }

  renderHomepageBuilderPreview() {
    if (!this.homepageBuilderPreview) return;

    const order = String(this.layoutOrder?.value || 'hero,quickActions,campaign,products,cta')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const enabled = {
      hero: this.layoutHero?.checked !== false,
      quickActions: this.layoutQuickActions?.checked === true,
      campaign: this.layoutCampaign?.checked === true,
      products: this.layoutProducts?.checked !== false,
      cta: this.layoutCta?.checked === true
    };
    const labels = {
      hero: this.heroTitle?.value || 'Hero',
      quickActions: 'Quick Actions',
      campaign: 'Campaign',
      products: this.productHeading?.value || 'Products',
      cta: this.ctaTitle?.value || 'CTA'
    };
    const allSections = ['hero', 'quickActions', 'campaign', 'products', 'cta'];
    const finalOrder = [
      ...order.filter((type) => allSections.includes(type)),
      ...allSections.filter((type) => !order.includes(type))
    ];

    this.homepageBuilderPreview.innerHTML = `
      <div class="homepage-builder-header">
        <strong>Homepage Builder</strong>
        <span>Order and visibility preview</span>
      </div>
      <div class="homepage-section-stack">
        ${finalOrder.map((type, index) => `
          <div class="homepage-section-pill ${enabled[type] ? 'is-enabled' : 'is-disabled'}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(labels[type])}</strong>
            <small>${escapeHtml(type)} ${enabled[type] ? 'on' : 'off'}</small>
          </div>
        `).join('')}
      </div>
    `;
  }

  parseQuickActionInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const [first, ...rest] = raw.split(/\s+/);
    const title = rest.join(' ').trim();

    if (!title) return { icon: '', title: raw };

    return { icon: first, title };
  }

  buildStorefrontConfig(companyId, storeData) {
    const fallback = getFallbackStoreConfig(companyId);
    const layoutMap = {
      hero: { type: 'hero', variant: companyId === COMPANY_ID ? 'carousel' : 'image', enabled: this.layoutHero ? this.layoutHero.checked : true },
      quickActions: { type: 'quickActions', variant: 'cards', enabled: this.layoutQuickActions ? this.layoutQuickActions.checked : false },
      campaign: { type: 'campaign', variant: 'timeline', enabled: this.layoutCampaign ? this.layoutCampaign.checked : false },
      products: { type: 'products', variant: this.productView?.value || 'grid', enabled: this.layoutProducts ? this.layoutProducts.checked : true },
      cta: { type: 'cta', variant: 'investment', enabled: this.layoutCta ? this.layoutCta.checked : false }
    };
    const requestedOrder = String(this.layoutOrder?.value || 'hero,quickActions,campaign,products,cta')
      .split(',')
      .map((type) => type.trim())
      .filter((type, index, arr) => layoutMap[type] && arr.indexOf(type) === index);
    const finalOrder = requestedOrder.length ? requestedOrder : ['hero', 'quickActions', 'campaign', 'products', 'cta'];
    const layout = [
      ...finalOrder.map((type) => layoutMap[type]),
      ...Object.keys(layoutMap).filter((type) => !finalOrder.includes(type)).map((type) => layoutMap[type])
    ];

    return {
      companyId,
      name: storeData.name || fallback.name,
      slug: storeData.slug || companyId,
      domain: storeData.website || fallback.domain,
      customDomain: storeData.customDomain || '',
      hosting: storeData.hosting || {},
      contact: storeData.contact || {},
      social: storeData.social || {},
      address: storeData.address || '',
      twoGisLink: storeData.twoGisLink || '',
      seo: {
        title: String(this.seoTitle?.value || `${storeData.name || fallback.name} | Oako`).trim(),
        description: String(this.seoDescription?.value || fallback.seo?.description || '').trim(),
        imageUrl: String(this.seoImage?.value || '').trim(),
        keywords: String(this.seoKeywords?.value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20)
      },
      status: storeData.active === false ? 'inactive' : 'active',
      launchStatus: storeData.launchStatus || 'draft',
      logoUrl: String(this.logoUrl?.value || '').trim(),
      theme: {
        primaryColor: this.themePrimary?.value || fallback.theme.primaryColor,
        secondaryColor: this.themeSecondary?.value || fallback.theme.secondaryColor,
        accentColor: this.themeAccent?.value || fallback.theme.accentColor,
        backgroundColor: this.themeBackground?.value || fallback.theme.backgroundColor,
        textColor: this.themeText?.value || fallback.theme.textColor,
        fontFamily: this.themeFont?.value || fallback.theme.fontFamily,
        borderRadius: this.themeRadius?.value || fallback.theme.borderRadius,
        buttonStyle: this.buttonStyle?.value || fallback.theme.buttonStyle
      },
      layout,
      features: {
        campaign: this.featureCampaign ? this.featureCampaign.checked : false,
        subscriptions: this.featureSubscriptions ? this.featureSubscriptions.checked : false,
        investmentSection: this.featureInvestment ? this.featureInvestment.checked : companyId === COMPANY_ID,
        quickActions: this.featureQuickActions ? this.featureQuickActions.checked : companyId === COMPANY_ID,
        deliveryBanner: this.featureDelivery ? this.featureDelivery.checked : true,
        cart: this.featureCart ? this.featureCart.checked : true,
        whatsappSupport: this.featureWhatsapp ? this.featureWhatsapp.checked : true
      },
      productDisplay: {
        ...fallback.productDisplay,
        view: this.productView?.value || fallback.productDisplay.view,
        cardSize: this.productCardSize?.value || fallback.productDisplay.cardSize,
        showPrice: this.productShowPrice ? this.productShowPrice.checked : true,
        showBadges: this.productShowBadges ? this.productShowBadges.checked : true,
        showStock: this.productShowStock ? this.productShowStock.checked : true
      },
      content: {
        ...fallback.content,
        logoUrl: String(this.logoUrl?.value || '').trim(),
        productHeading: String(this.productHeading?.value || fallback.content.productHeading || '').trim(),
        availableTodayTitle: String(this.availableTitle?.value || fallback.content.availableTodayTitle || '').trim(),
        availableTodayLabel: String(this.availableLabel?.value || fallback.content.availableTodayLabel || '').trim(),
        loadingText: String(fallback.content.loadingText || '').trim(),
        deliveryBanner: {
          ...(fallback.content.deliveryBanner || {}),
          title: String(this.deliveryTitle?.value || fallback.content.deliveryBanner?.title || '').trim(),
          subtitle: String(this.deliverySubtitle?.value || fallback.content.deliveryBanner?.subtitle || '').trim()
        },
        hero: {
          ...fallback.content.hero,
          title: String(this.heroTitle?.value || fallback.content.hero.title || '').trim(),
          subtitle: String(this.heroSubtitle?.value || fallback.content.hero.subtitle || '').trim(),
          imageUrl: String(this.heroImage?.value || '').trim(),
          ctaText: String(this.heroCta?.value || fallback.content.hero.ctaText || '').trim(),
          ctaTarget: fallback.content.hero.ctaTarget || '#products'
        },
        cta: {
          ...(fallback.content.cta || {}),
          title: String(this.ctaTitle?.value || fallback.content.cta?.title || '').trim(),
          text: String(this.ctaText?.value || fallback.content.cta?.text || '').trim(),
          buttonText: String(this.ctaButton?.value || fallback.content.cta?.buttonText || '').trim(),
          href: String(this.ctaHref?.value || fallback.content.cta?.href || '').trim()
        },
        quickActions: this.quickActions
          .map((input) => this.parseQuickActionInput(input?.value))
          .filter(Boolean)
      },
      updatedAt: serverTimestamp()
    };
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
      launchStatus: String(this.launchStatus?.value || 'draft'),
      contactName: String(this.contactName?.value || '').trim(),
      phone: String(this.phone?.value || '').trim(),
      address: String(this.address?.value || '').trim(),
      twoGisLink: String(this.twoGisLink?.value || '').trim(),
      website: String(this.website?.value || '').trim(),
      email: String(this.email?.value || '').trim(),
      whatsapp: String(this.whatsapp?.value || '').trim(),
      instagram: String(this.instagram?.value || '').trim(),
      openingHours: String(this.openingHours?.value || '').trim(),
      contact: {
        name: String(this.contactName?.value || '').trim(),
        phone: String(this.phone?.value || '').trim(),
        email: String(this.email?.value || '').trim(),
        whatsapp: String(this.whatsapp?.value || '').trim(),
        openingHours: String(this.openingHours?.value || '').trim()
      },
      social: {
        instagram: String(this.instagram?.value || '').trim()
      },
      hosting: {
        customDomain: String(this.customDomain?.value || '').trim(),
        githubTarget: String(this.githubTarget?.value || '').trim(),
        dnsStatus: String(this.dnsStatus?.value || 'not_started'),
        notes: String(this.hostingNotes?.value || '').trim(),
        checklist: {
          domainPurchased: this.domainPurchased ? this.domainPurchased.checked : false,
          dnsConfigured: this.dnsConfigured ? this.dnsConfigured.checked : false,
          hostingConnected: this.hostingConnected ? this.hostingConnected.checked : false,
          sslActive: this.sslActive ? this.sslActive.checked : false,
          finalTested: this.finalTested ? this.finalTested.checked : false
        }
      },
      customDomain: String(this.customDomain?.value || '').trim(),
      logoUrl: String(this.logoUrl?.value || '').trim(),
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

      let storefrontSaved = true;
      try {
        await setDoc(doc(db, 'storefront_configs', companyId), this.buildStorefrontConfig(companyId, storeData), { merge: true });
      } catch (storefrontErr) {
        storefrontSaved = false;
        console.warn('Store saved, but storefront config save failed:', storefrontErr);
      }

      alert(storefrontSaved
        ? 'Store saved.'
        : 'Store saved, but storefront customization did not save. Check Firestore rules for storefront_configs.');
      await logAudit(existing.exists() || isEdit ? 'Store Updated' : 'Store Created', `${storeData.name || companyId} (${storeData.launchStatus})`);
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
