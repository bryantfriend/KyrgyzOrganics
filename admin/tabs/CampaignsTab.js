import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
    this.glovoLink = get('campGlovo');
    this.startDate = get('campStart');
    this.endDate = get('campEnd');

    // 2. Content & Multi-Lang
    this.headline = get('campHeadline');
    this.headlineEN = get('campHeadlineEN');
    this.headlineKG = get('campHeadlineKG');
    this.subheadline = get('campSubheadline');
    this.optionalLine = get('campOptional');

    // 3. Assets
    this.logoFile = get('campLogoFile');
    this.logoWidth = get('logoWidth');
    this.imageFile = get('campImage');
    this.imgScale = get('imgScale');

    // 4. Appearance
    this.bgColor = get('bgColor');
    this.bgTexture = get('bgTexture');
    this.entranceAnim = get('entranceAnim');
    this.bgParticles = get('bgParticles');
    this.headlineFont = get('headlineFont');
    this.headlineSize = get('headlineSize');
    this.btnColor = get('btnColor');
    this.btnPulse = get('btnPulse');

    // UI Elements
    this.statClicks = get('statClicks');
    this.logoPreview = get('campLogoPreview');
    this.imagePreview = get('campPreview');
    this.qrImg = get('campQR');
    this.urlLink = get('campUrlLink');
    this.copyBtn = get('copyCampLink');

    // Mock Elements
    this.mockLanding = get('mockLanding');
    this.mockLogo = get('mockLogo');
    this.mockHeadline = get('mockHeadline');
    this.mockSubheadline = get('mockSubheadline');
    this.mockImage = get('mockImage');
    this.mockOptional = get('mockOptional');
    this.mockBtn = get('mockBtn');
    
    this.currentImageUrl = '';
    this.currentLogoUrl = '';
    
    this.bindEvents();
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
      this.logoWidth, this.imgScale, this.bgColor, this.bgTexture, 
      this.headlineFont, this.headlineSize, this.btnColor, this.btnPulse
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
  }

  updateLivePreview() {
    // Text
    if (this.mockHeadline && this.headline) {
      this.mockHeadline.textContent = this.headline.value || 'Headline';
      if (this.headlineFont) this.mockHeadline.style.fontFamily = this.headlineFont.value;
      if (this.headlineSize) this.mockHeadline.style.fontSize = `${this.headlineSize.value}rem`;
      this.mockHeadline.style.color = '#d4af37';
    }

    if (this.mockSubheadline && this.subheadline) this.mockSubheadline.textContent = this.subheadline.value || 'Subheadline';
    if (this.mockOptional && this.optionalLine) this.mockOptional.textContent = this.optionalLine.value || 'Optional Line';

    // Scaling
    if (this.mockLogo && this.logoWidth) this.mockLogo.style.width = `${this.logoWidth.value}px`;
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
        where("campaignId", "==", "prime-mun"), 
        where("actionType", "==", "click_glovo")
      );

      this.statsUnsubscribe = onSnapshot(q, (snap) => {
        this.statClicks.textContent = snap.size;
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
        if (this.glovoLink) this.glovoLink.value = data.glovoLink || '';
        if (this.headline) this.headline.value = data.headline || '';
        if (this.headlineEN) this.headlineEN.value = data.headlineEN || '';
        if (this.headlineKG) this.headlineKG.value = data.headlineKG || '';
        if (this.subheadline) this.subheadline.value = data.subheadline || '';
        if (this.optionalLine) this.optionalLine.value = data.optionalLine || '';
        
        this.currentImageUrl = data.imageUrl || '';
        this.currentLogoUrl = data.logoUrl || '';
        if (this.imagePreview) this.imagePreview.src = this.currentImageUrl;
        if (this.mockImage) this.mockImage.src = this.currentImageUrl;
        if (this.logoPreview) this.logoPreview.src = this.currentLogoUrl;
        if (this.mockLogo) this.mockLogo.src = this.currentLogoUrl;

        // Apply Styles
        if (this.logoWidth) this.logoWidth.value = s.logoWidth || 120;
        if (this.imgScale) this.imgScale.value = s.imgScale || 100;
        if (this.bgColor) this.bgColor.value = s.bgColor || '#0c0b0a';
        if (this.bgTexture) this.bgTexture.value = s.bgTexture || 'none';
        if (this.entranceAnim) this.entranceAnim.value = s.entranceAnim || 'fadeUp';
        if (this.bgParticles) this.bgParticles.value = s.bgParticles || 'none';
        if (this.headlineFont) this.headlineFont.value = s.headlineFont || "'Playfair Display', serif";
        if (this.headlineSize) this.headlineSize.value = s.headlineSize || 2.2;
        if (this.btnColor) this.btnColor.value = s.btnColor || '#00c3a5';
        if (this.btnPulse) this.btnPulse.checked = s.btnPulse || false;

        if (data.startDate && this.startDate) this.startDate.value = data.startDate.toDate().toISOString().slice(0, 16);
        if (data.endDate && this.endDate) this.endDate.value = data.endDate.toDate().toISOString().slice(0, 16);

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

      if (this.imageFile && this.imageFile.files[0]) finalImageUrl = await uploadImage(this.imageFile.files[0], 'campaigns');
      if (this.logoFile && this.logoFile.files[0]) finalLogoUrl = await uploadImage(this.logoFile.files[0], 'campaigns');

      const data = {
        isActive: this.isActive ? this.isActive.checked : false,
        headline: this.headline ? this.headline.value : '',
        headlineEN: this.headlineEN ? this.headlineEN.value : '',
        headlineKG: this.headlineKG ? this.headlineKG.value : '',
        subheadline: this.subheadline ? this.subheadline.value : '',
        imageUrl: finalImageUrl,
        logoUrl: finalLogoUrl,
        glovoLink: this.glovoLink ? this.glovoLink.value : '',
        optionalLine: this.optionalLine ? this.optionalLine.value : '',
        startDate: (this.startDate && this.startDate.value) ? new Date(this.startDate.value) : null,
        endDate: (this.endDate && this.endDate.value) ? new Date(this.endDate.value) : null,
        styles: {
          logoWidth: this.logoWidth ? parseInt(this.logoWidth.value) : 120,
          imgScale: this.imgScale ? parseInt(this.imgScale.value) : 100,
          bgColor: this.bgColor ? this.bgColor.value : '#0c0b0a',
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

      btn.textContent = "Live Update Successful!";
      setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
    } catch (err) {
      alert("Error saving: " + err.message);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}
