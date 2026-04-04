import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { uploadImage } from '../utils.js';

export class CampaignsTab {
  constructor() {
    this.section = document.getElementById('campaigns');
    this.form = document.getElementById('campaignForm');
    
    // Helper to log missing elements
    const get = (id) => {
      const el = document.getElementById(id);
      if (!el) console.warn(`CampaignsTab: Element with id "${id}" not found.`);
      return el;
    };

    // 1. Basic Inputs
    this.isActive = get('campActive');
    this.whatsappNumber = get('campWhatsapp');
    this.startDate = get('campStart');
    this.endDate = get('campEnd');
    this.limitEnabled = get('campLimitEnabled');
    this.maxSales = get('campMaxSales');
    this.sellOneBtn = get('campSellOneBtn');
    this.undoSaleBtn = get('campUndoSaleBtn');
    this.showCountdown = get('campShowCountdown');
    this.countdownVariant = get('campCountdownVariant');
    this.showDeliveryInfo = get('campShowDeliveryInfo');
    this.deliveryInfoText = get('campDeliveryInfoText');

    // 2. Content & Multi-Lang
    this.headline = get('campHeadline');
    this.headlineEN = get('campHeadlineEN');
    this.headlineKG = get('campHeadlineKG');
    this.subheadline = get('campSubheadline');
    this.optionalLine = get('campOptional');
    this.headlineUseImage = get('campHeadlineUseImage');
    this.headlineImageFile = get('campHeadlineImageFile');
    this.headlineImageBtn = get('campHeadlineImageBtn');
    this.headlineImagePreview = get('campHeadlineImagePreview');
    this.subheadlineUseImage = get('campSubheadlineUseImage');
    this.subheadlineImageFile = get('campSubheadlineImageFile');
    this.subheadlineImageBtn = get('campSubheadlineImageBtn');
    this.subheadlineImagePreview = get('campSubheadlineImagePreview');
    this.optionalUseImage = get('campOptionalUseImage');
    this.optionalImageFile = get('campOptionalImageFile');
    this.optionalImageBtn = get('campOptionalImageBtn');
    this.optionalImagePreview = get('campOptionalImagePreview');

    // 3. Assets
    this.logoFile = get('campLogoFile');
    this.logoWidth = get('logoWidth');
    this.imageFile = get('campImage');
    this.imgScale = get('imgScale');

    // 4. Appearance
    this.bgColor = get('bgColor');
    this.textColor = get('textColor');
    this.bgTexture = get('bgTexture');
    this.entranceAnim = get('entranceAnim');
    this.bgParticles = get('bgParticles');
    this.headlineFont = get('headlineFont');
    this.headlineSize = get('headlineSize');
    this.btnColor = get('btnColor');
    this.btnPulse = get('btnPulse');

    // UI Elements
    this.statClicks = get('statClicks');
    this.statSold = get('statSold');
    this.statLeft = get('statLeft');
    this.logoPreview = get('campLogoPreview');
    this.imagePreview = get('campPreview');
    this.qrImg = get('campQR');
    this.urlLink = get('campUrlLink');
    this.copyBtn = get('copyCampLink');

    // Mock Elements
    this.mockLanding = get('mockLanding');
    this.mockParticleBg = get('mockParticleBg');
    this.mockLogo = get('mockLogo');
    this.mockHeadline = get('mockHeadline');
    this.mockHeadlineImage = get('mockHeadlineImage');
    this.mockSubheadline = get('mockSubheadline');
    this.mockSubheadlineImage = get('mockSubheadlineImage');
    this.mockImage = get('mockImage');
    this.mockOptional = get('mockOptional');
    this.mockOptionalImage = get('mockOptionalImage');
    this.mockBtn = get('mockBtn');
    
    this.currentImageUrl = '';
    this.currentLogoUrl = '';
    this.currentHeadlineImageUrl = '';
    this.currentSubheadlineImageUrl = '';
    this.currentOptionalImageUrl = '';
    this.currentSoldCount = 0;
    this.mockParticleAnimations = [];
    this.mockEntranceAnimation = null;
    
    this.bindEvents();
    this.updateFieldStates();
  }

  bindEvents() {
    if(!this.form) return;

    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveCampaign();
    });

    // Unified Live Preview Trigger
    const allInputs = [
      this.headline, this.headlineEN, this.headlineKG, this.subheadline, this.optionalLine,
      this.logoWidth, this.imgScale, this.bgColor, this.textColor, this.bgTexture, 
      this.headlineFont, this.headlineSize, this.btnColor, this.btnPulse,
      this.limitEnabled, this.maxSales, this.showCountdown, this.countdownVariant,
      this.headlineUseImage, this.subheadlineUseImage, this.optionalUseImage,
      this.showDeliveryInfo, this.deliveryInfoText
    ].filter(el => el !== null); // Only bind to existing elements
    
    allInputs.forEach(input => {
      input.addEventListener('input', () => this.updateLivePreview());
      // For selects, 'change' is sometimes better
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', () => this.updateLivePreview());
      }
    });

    // File Preview - Logo
    if (this.logoFile) {
      this.logoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (this.logoPreview) this.logoPreview.src = ev.target.result;
            if (this.mockLogo) this.mockLogo.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // File Preview - Product
    if (this.imageFile) {
      this.imageFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (this.imagePreview) this.imagePreview.src = ev.target.result;
            if (this.mockImage) this.mockImage.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    this.bindContentImagePreview(this.headlineImageFile, this.headlineImagePreview, this.mockHeadlineImage);
    this.bindContentImagePreview(this.subheadlineImageFile, this.subheadlineImagePreview, this.mockSubheadlineImage);
    this.bindContentImagePreview(this.optionalImageFile, this.optionalImagePreview, this.mockOptionalImage);
    this.bindContentImageButton(this.headlineImageBtn, this.headlineImageFile, this.headlineUseImage);
    this.bindContentImageButton(this.subheadlineImageBtn, this.subheadlineImageFile, this.subheadlineUseImage);
    this.bindContentImageButton(this.optionalImageBtn, this.optionalImageFile, this.optionalUseImage);

    if (this.copyBtn && this.urlLink) {
      this.copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(this.urlLink.href).then(() => {
          const originalText = this.copyBtn.textContent;
          this.copyBtn.textContent = 'Copied!';
          setTimeout(() => this.copyBtn.textContent = originalText, 2000);
        });
      });
    }

    if (this.limitEnabled) {
      this.limitEnabled.addEventListener('change', () => {
        this.updateFieldStates();
        this.updateSalesStats();
      });
    }

    if (this.maxSales) {
      this.maxSales.addEventListener('input', () => this.updateSalesStats());
    }

    if (this.showCountdown) {
      this.showCountdown.addEventListener('change', () => this.updateFieldStates());
    }

    if (this.showDeliveryInfo) {
      this.showDeliveryInfo.addEventListener('change', () => this.updateFieldStates());
    }

    if (this.sellOneBtn) {
      this.sellOneBtn.addEventListener('click', async () => {
        await this.adjustSoldCount(1);
      });
    }

    if (this.undoSaleBtn) {
      this.undoSaleBtn.addEventListener('click', async () => {
        await this.adjustSoldCount(-1);
      });
    }
  }

  bindContentImagePreview(fileInput, previewEl, mockEl) {
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (previewEl) previewEl.src = ev.target.result;
        if (mockEl) mockEl.src = ev.target.result;
        this.updateLivePreview();
      };
      reader.readAsDataURL(file);
    });
  }

  bindContentImageButton(buttonEl, fileInput, toggleEl) {
    if (!buttonEl || !fileInput) return;

    buttonEl.addEventListener('click', () => {
      if (toggleEl && !toggleEl.checked) {
        toggleEl.checked = true;
        this.updateFieldStates();
        this.updateLivePreview();
      }

      fileInput.click();
    });
  }

  updateFieldStates() {
    if (this.maxSales) {
      this.maxSales.disabled = !this.limitEnabled?.checked;
    }

    if (this.countdownVariant) {
      this.countdownVariant.disabled = !this.showCountdown?.checked;
    }

    if (this.deliveryInfoText) {
      this.deliveryInfoText.disabled = !this.showDeliveryInfo?.checked;
    }

    if (this.headlineImageFile) {
      this.headlineImageFile.disabled = !this.headlineUseImage?.checked;
    }
    if (this.subheadlineImageFile) {
      this.subheadlineImageFile.disabled = !this.subheadlineUseImage?.checked;
    }
    if (this.optionalImageFile) {
      this.optionalImageFile.disabled = !this.optionalUseImage?.checked;
    }

    const limitEnabled = !!this.limitEnabled?.checked;
    if (this.sellOneBtn) this.sellOneBtn.disabled = !limitEnabled;
    if (this.undoSaleBtn) this.undoSaleBtn.disabled = !limitEnabled;

    this.updateSalesStats();
  }

  updateSalesStats(soldCount = this.currentSoldCount, maxSales = Number.parseInt(this.maxSales?.value || '0', 10) || 0) {
    this.currentSoldCount = Math.max(0, soldCount || 0);
    if (this.statSold) this.statSold.textContent = String(this.currentSoldCount);

    const left = this.limitEnabled?.checked && maxSales > 0
      ? Math.max(0, maxSales - this.currentSoldCount)
      : null;

    if (this.statLeft) {
      this.statLeft.textContent = left === null ? '-' : String(left);
    }
  }

  async adjustSoldCount(delta) {
    const maxSales = Number.parseInt(this.maxSales?.value || '0', 10) || 0;
    const limitEnabled = !!this.limitEnabled?.checked;
    if (!limitEnabled) {
      alert('Enable "Limit Total Orders" first.');
      return;
    }

    const docRef = doc(db, 'campaigns', 'prime-mun');
    try {
      const nextSoldCount = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(docRef);
        if (!snap.exists()) throw new Error('Campaign not found.');

        const currentSold = Math.max(0, Number(snap.data().soldCount || 0));
        const proposed = currentSold + delta;
        if (proposed < 0) return currentSold;
        if (delta > 0 && maxSales > 0 && proposed > maxSales) return currentSold;

        transaction.set(docRef, { soldCount: proposed }, { merge: true });
        return proposed;
      });

      this.updateSalesStats(nextSoldCount, maxSales);
    } catch (error) {
      alert(`Could not update sold count: ${error.message}`);
    }
  }

  clearMockParticleAnimations() {
    if (Array.isArray(this.mockParticleAnimations)) {
      this.mockParticleAnimations.forEach((animation) => {
        try {
          animation.cancel();
        } catch (_) {
          // ignore stale animation handles
        }
      });
    }
    this.mockParticleAnimations = [];
  }

  renderMockParticles() {
    if (!this.mockParticleBg) return;

    this.clearMockParticleAnimations();
    this.mockParticleBg.innerHTML = '';

    const type = this.bgParticles?.value || 'none';
    if (type === 'none') return;

    const icons = {
      sparkles: '✨',
      float: '🍃',
      snow: '🌸'
    };
    const icon = icons[type] || '•';
    const color = this.textColor?.value || '#f9e29f';

    for (let i = 0; i < 18; i += 1) {
      const particle = document.createElement('div');
      particle.textContent = icon;
      particle.style.position = 'absolute';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = '100%';
      particle.style.fontSize = `${Math.random() * 1.2 + 0.55}rem`;
      particle.style.color = color;
      particle.style.opacity = '0';
      particle.style.pointerEvents = 'none';
      this.mockParticleBg.appendChild(particle);

      const drift = (Math.random() - 0.5) * 40;
      const animation = particle.animate(
        [
          { transform: 'translate3d(0, 20px, 0) scale(0.4) rotate(0deg)', opacity: 0 },
          { transform: `translate3d(${drift * 0.2}px, -40px, 0) scale(0.7) rotate(90deg)`, opacity: 0.65, offset: 0.2 },
          { transform: `translate3d(${drift * 0.7}px, -180px, 0) scale(0.95) rotate(240deg)`, opacity: 0.65, offset: 0.8 },
          { transform: `translate3d(${drift}px, -260px, 0) scale(1.1) rotate(360deg)`, opacity: 0 }
        ],
        {
          duration: 7000 + Math.random() * 5000,
          delay: Math.random() * 2500,
          iterations: Infinity,
          easing: 'linear'
        }
      );
      this.mockParticleAnimations.push(animation);
    }
  }

  runMockEntranceAnimation() {
    if (!this.mockLanding || !this.mockLanding.animate) return;

    if (this.mockEntranceAnimation) {
      try {
        this.mockEntranceAnimation.cancel();
      } catch (_) {
        // ignore stale animation handles
      }
    }

    const variant = this.entranceAnim?.value || 'fadeUp';
    const presets = {
      fadeUp: {
        keyframes: [
          { opacity: 0, transform: 'translateY(28px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        options: { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      },
      zoomIn: {
        keyframes: [
          { opacity: 0, transform: 'scale(0.88)' },
          { opacity: 1, transform: 'scale(1)' }
        ],
        options: { duration: 800, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      },
      reveal: {
        keyframes: [
          { opacity: 0, clipPath: 'inset(0 50% 0 50%)' },
          { opacity: 1, clipPath: 'inset(0 0 0 0)' }
        ],
        options: { duration: 950, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
      },
      bounce: {
        keyframes: [
          { opacity: 0, transform: 'scale(0.3)' },
          { opacity: 0.9, transform: 'scale(1.08)', offset: 0.55 },
          { opacity: 1, transform: 'scale(0.94)', offset: 0.75 },
          { opacity: 1, transform: 'scale(1)' }
        ],
        options: { duration: 950, easing: 'cubic-bezier(0.28, 0.84, 0.42, 1)' }
      }
    };

    const preset = presets[variant] || presets.fadeUp;
    this.mockLanding.style.opacity = '1';
    this.mockLanding.style.transform = 'none';
    this.mockLanding.style.clipPath = 'inset(0 0 0 0)';
    this.mockEntranceAnimation = this.mockLanding.animate(preset.keyframes, {
      fill: 'both',
      ...preset.options
    });
  }

  updateLivePreview() {
    // Text
    if (this.mockHeadline && this.headline) {
      this.mockHeadline.textContent = this.headline.value || 'Headline';
      if (this.headlineFont) this.mockHeadline.style.fontFamily = this.headlineFont.value;
      if (this.headlineSize) this.mockHeadline.style.fontSize = `${this.headlineSize.value}rem`;
      if (this.textColor) this.mockHeadline.style.color = this.textColor.value;
    }
    if (this.mockHeadline && this.mockHeadlineImage) {
      const useHeadlineImage = !!this.headlineUseImage?.checked && !!(this.headlineImageFile?.files[0] || this.currentHeadlineImageUrl || this.headlineImagePreview?.src);
      this.mockHeadline.style.display = useHeadlineImage ? 'none' : 'block';
      this.mockHeadlineImage.style.display = useHeadlineImage ? 'block' : 'none';
      if (useHeadlineImage && !this.mockHeadlineImage.src) {
        this.mockHeadlineImage.src = this.currentHeadlineImageUrl || this.headlineImagePreview?.src || '';
      }
    }

    if (this.mockSubheadline && this.subheadline) {
        this.mockSubheadline.textContent = this.subheadline.value || 'Subheadline';
        if (this.textColor) this.mockSubheadline.style.color = this.textColor.value;
    }
    if (this.mockSubheadline && this.mockSubheadlineImage) {
        const useSubheadlineImage = !!this.subheadlineUseImage?.checked && !!(this.subheadlineImageFile?.files[0] || this.currentSubheadlineImageUrl || this.subheadlineImagePreview?.src);
        this.mockSubheadline.style.display = useSubheadlineImage ? 'none' : 'block';
        this.mockSubheadlineImage.style.display = useSubheadlineImage ? 'block' : 'none';
        if (useSubheadlineImage && !this.mockSubheadlineImage.src) {
          this.mockSubheadlineImage.src = this.currentSubheadlineImageUrl || this.subheadlineImagePreview?.src || '';
        }
    }
    if (this.mockOptional && this.optionalLine) {
        this.mockOptional.textContent = this.optionalLine.value || 'Optional Line';
        if (this.textColor) this.mockOptional.style.color = this.textColor.value;
    }
    if (this.mockOptional && this.mockOptionalImage) {
        const useOptionalImage = !!this.optionalUseImage?.checked && !!(this.optionalImageFile?.files[0] || this.currentOptionalImageUrl || this.optionalImagePreview?.src);
        this.mockOptional.style.display = useOptionalImage ? 'none' : 'block';
        this.mockOptionalImage.style.display = useOptionalImage ? 'block' : 'none';
        if (useOptionalImage && !this.mockOptionalImage.src) {
          this.mockOptionalImage.src = this.currentOptionalImageUrl || this.optionalImagePreview?.src || '';
        }
    }

    // Scaling
    if (this.mockLogo && this.logoWidth) {
      this.mockLogo.style.width = `${this.logoWidth.value}px`;
      this.mockLogo.style.height = 'auto';
    }
    if (this.mockImage && this.imgScale) this.mockImage.style.transform = `scale(${this.imgScale.value / 100})`;

    // Backgrounds
    if (this.mockLanding && this.bgColor) {
      this.mockLanding.style.backgroundColor = this.bgColor.value;
      if (this.bgTexture && this.bgTexture.value !== 'none') {
          this.mockLanding.style.backgroundImage = 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 100%)';
      } else {
          this.mockLanding.style.backgroundImage = 'none';
      }
    }

    this.renderMockParticles();
    this.runMockEntranceAnimation();

    // Button
    if (this.mockBtn && this.btnColor) {
      this.mockBtn.style.backgroundColor = this.btnColor.value;
      this.mockBtn.style.color = '#fff';
      if (this.btnPulse && this.btnPulse.checked) {
          this.mockBtn.style.animation = 'pulse-glow 2s infinite'; // Match style.css name
      } else {
          this.mockBtn.style.animation = 'none';
      }
    }
  }

  async show() {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    if (this.section) this.section.style.display = 'block';
    
    await this.loadCampaign();
    this.updateFieldStates();
    this.initStatsListener(); // Real-time stats
    this.initSharing();
  }

  initSharing() {
    const campaignUrl = `${window.location.origin}/prime-mun/`;
    if (this.urlLink) {
      this.urlLink.href = campaignUrl;
      this.urlLink.textContent = campaignUrl;
    }
    if (this.qrImg) {
      const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(campaignUrl)}`;
      this.qrImg.src = qrApi;
    }
  }

  initStatsListener() {
    if (!this.statClicks) return;
    
    // Cleanup previous listener if any
    if (this.statsUnsubscribe) this.statsUnsubscribe();

    try {
      const q = query(
        collection(db, "campaign_events"), 
        where("campaignId", "==", "prime-mun")
      );

      this.statsUnsubscribe = onSnapshot(q, (snap) => {
        const totalClicks = snap.docs.filter((docSnap) => {
          const actionType = docSnap.data().actionType;
          return actionType === 'cta_click' || actionType === 'click_whatsapp' || actionType === 'click_glovo';
        }).length;
        this.statClicks.textContent = totalClicks;
      });
    } catch(err) { console.error("Real-time Stats error:", err); }
  }

  async loadCampaign() {
    try {
      const docRef = doc(db, 'campaigns', 'prime-mun');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const s = data.styles || {};

        if (this.isActive) this.isActive.checked = data.isActive;
        if (this.whatsappNumber) this.whatsappNumber.value = data.whatsappNumber || '';
        if (this.limitEnabled) this.limitEnabled.checked = !!data.limitSalesEnabled;
        if (this.maxSales) this.maxSales.value = data.maxSales || 50;
        this.updateSalesStats(Number(data.soldCount || 0), Number(data.maxSales || 50));
        if (this.showCountdown) this.showCountdown.checked = data.showCountdown !== false;
        if (this.countdownVariant) this.countdownVariant.value = data.countdownVariant || 'classic';
        if (this.showDeliveryInfo) this.showDeliveryInfo.checked = !!data.showDeliveryInfo;
        if (this.deliveryInfoText) this.deliveryInfoText.value = data.deliveryInfoText || 'Delivery in under 60 minutes';
        if (this.headlineUseImage) this.headlineUseImage.checked = !!data.headlineUseImage;
        if (this.subheadlineUseImage) this.subheadlineUseImage.checked = !!data.subheadlineUseImage;
        if (this.optionalUseImage) this.optionalUseImage.checked = !!data.optionalUseImage;
        if (this.headline) this.headline.value = data.headline || '';
        if (this.headlineEN) this.headlineEN.value = data.headlineEN || '';
        if (this.headlineKG) this.headlineKG.value = data.headlineKG || '';
        if (this.subheadline) this.subheadline.value = data.subheadline || '';
        if (this.optionalLine) this.optionalLine.value = data.optionalLine || '';
        
        this.currentImageUrl = data.imageUrl || '';
        this.currentLogoUrl = data.logoUrl || '';
        this.currentHeadlineImageUrl = data.headlineImageUrl || '';
        this.currentSubheadlineImageUrl = data.subheadlineImageUrl || '';
        this.currentOptionalImageUrl = data.optionalImageUrl || '';
        if (this.imagePreview) this.imagePreview.src = this.currentImageUrl;
        if (this.mockImage) this.mockImage.src = this.currentImageUrl;
        if (this.logoPreview) this.logoPreview.src = this.currentLogoUrl;
        if (this.mockLogo) this.mockLogo.src = this.currentLogoUrl;
        if (this.headlineImagePreview) this.headlineImagePreview.src = this.currentHeadlineImageUrl;
        if (this.mockHeadlineImage) this.mockHeadlineImage.src = this.currentHeadlineImageUrl;
        if (this.subheadlineImagePreview) this.subheadlineImagePreview.src = this.currentSubheadlineImageUrl;
        if (this.mockSubheadlineImage) this.mockSubheadlineImage.src = this.currentSubheadlineImageUrl;
        if (this.optionalImagePreview) this.optionalImagePreview.src = this.currentOptionalImageUrl;
        if (this.mockOptionalImage) this.mockOptionalImage.src = this.currentOptionalImageUrl;

        // Apply Styles
        if (this.logoWidth) this.logoWidth.value = s.logoWidth || 120;
        if (this.imgScale) this.imgScale.value = s.imgScale || 100;
        if (this.bgColor) this.bgColor.value = s.bgColor || '#0c0b0a';
        if (this.textColor) this.textColor.value = s.textColor || '#f9e29f';
        if (this.bgTexture) this.bgTexture.value = s.bgTexture || 'none';
        if (this.entranceAnim) this.entranceAnim.value = s.entranceAnim || 'fadeUp';
        if (this.bgParticles) this.bgParticles.value = s.bgParticles || 'none';
        if (this.headlineFont) this.headlineFont.value = s.headlineFont || "'Playfair Display', serif";
        if (this.headlineSize) this.headlineSize.value = s.headlineSize || 2.2;
        if (this.btnColor) this.btnColor.value = s.btnColor || '#00c3a5';
        if (this.btnPulse) this.btnPulse.checked = s.btnPulse || false;

        if (data.startDate && this.startDate) this.startDate.value = data.startDate.toDate().toISOString().slice(0, 16);
        if (data.endDate && this.endDate) this.endDate.value = data.endDate.toDate().toISOString().slice(0, 16);

        this.updateFieldStates();
        this.updateLivePreview();
      }
    } catch (err) { console.error("Load error:", err); }
  }

  async saveCampaign() {
    if (!this.form) return;
    const btn = this.form.querySelector('button[type="submit"]');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = "Updating Command Center...";
    btn.disabled = true;

    try {
      let finalImageUrl = this.currentImageUrl;
      let finalLogoUrl = this.currentLogoUrl;
      let finalHeadlineImageUrl = this.currentHeadlineImageUrl;
      let finalSubheadlineImageUrl = this.currentSubheadlineImageUrl;
      let finalOptionalImageUrl = this.currentOptionalImageUrl;

      if (this.imageFile && this.imageFile.files[0]) finalImageUrl = await uploadImage(this.imageFile.files[0], 'campaigns');
      if (this.logoFile && this.logoFile.files[0]) finalLogoUrl = await uploadImage(this.logoFile.files[0], 'campaigns');
      if (this.headlineImageFile && this.headlineImageFile.files[0]) finalHeadlineImageUrl = await uploadImage(this.headlineImageFile.files[0], 'campaigns');
      if (this.subheadlineImageFile && this.subheadlineImageFile.files[0]) finalSubheadlineImageUrl = await uploadImage(this.subheadlineImageFile.files[0], 'campaigns');
      if (this.optionalImageFile && this.optionalImageFile.files[0]) finalOptionalImageUrl = await uploadImage(this.optionalImageFile.files[0], 'campaigns');

      const data = {
        isActive: this.isActive ? this.isActive.checked : false,
        headline: this.headline ? this.headline.value : '',
        headlineEN: this.headlineEN ? this.headlineEN.value : '',
        headlineKG: this.headlineKG ? this.headlineKG.value : '',
        subheadline: this.subheadline ? this.subheadline.value : '',
        headlineUseImage: this.headlineUseImage ? this.headlineUseImage.checked : false,
        headlineImageUrl: finalHeadlineImageUrl,
        subheadlineUseImage: this.subheadlineUseImage ? this.subheadlineUseImage.checked : false,
        subheadlineImageUrl: finalSubheadlineImageUrl,
        imageUrl: finalImageUrl,
        logoUrl: finalLogoUrl,
        whatsappNumber: this.whatsappNumber ? this.whatsappNumber.value.trim() : '',
        limitSalesEnabled: this.limitEnabled ? this.limitEnabled.checked : false,
        maxSales: this.maxSales ? parseInt(this.maxSales.value, 10) || 0 : 0,
        soldCount: this.currentSoldCount || 0,
        showCountdown: this.showCountdown ? this.showCountdown.checked : true,
        countdownVariant: this.countdownVariant ? this.countdownVariant.value : 'classic',
        showDeliveryInfo: this.showDeliveryInfo ? this.showDeliveryInfo.checked : false,
        deliveryInfoText: this.deliveryInfoText ? this.deliveryInfoText.value.trim() : '',
        optionalLine: this.optionalLine ? this.optionalLine.value : '',
        optionalUseImage: this.optionalUseImage ? this.optionalUseImage.checked : false,
        optionalImageUrl: finalOptionalImageUrl,
        startDate: (this.startDate && this.startDate.value) ? new Date(this.startDate.value) : null,
        endDate: (this.endDate && this.endDate.value) ? new Date(this.endDate.value) : null,
        styles: {
          logoWidth: this.logoWidth ? parseInt(this.logoWidth.value) : 120,
          imgScale: this.imgScale ? parseInt(this.imgScale.value) : 100,
          bgColor: this.bgColor ? this.bgColor.value : '#0c0b0a',
          textColor: this.textColor ? this.textColor.value : '#f9e29f',
          bgTexture: this.bgTexture ? this.bgTexture.value : 'none',
          entranceAnim: this.entranceAnim ? this.entranceAnim.value : 'fadeUp',
          bgParticles: this.bgParticles ? this.bgParticles.value : 'none',
          headlineFont: this.headlineFont ? this.headlineFont.value : "'Playfair Display', serif",
          headlineSize: this.headlineSize ? parseFloat(this.headlineSize.value) : 2.2,
          btnColor: this.btnColor ? this.btnColor.value : '#00c3a5',
          btnPulse: this.btnPulse ? this.btnPulse.checked : false
        }
      };

      await setDoc(doc(db, 'campaigns', 'prime-mun'), data);
      this.currentImageUrl = finalImageUrl;
      this.currentLogoUrl = finalLogoUrl;
      this.currentHeadlineImageUrl = finalHeadlineImageUrl;
      this.currentSubheadlineImageUrl = finalSubheadlineImageUrl;
      this.currentOptionalImageUrl = finalOptionalImageUrl;
      this.updateFieldStates();

      btn.textContent = "Live Update Successful!";
      setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
    } catch (err) {
      alert("Error saving: " + err.message);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
