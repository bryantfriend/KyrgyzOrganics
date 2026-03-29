import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { uploadImage } from '../utils.js';

export class CampaignsTab {
  constructor() {
    this.section = document.getElementById('campaigns');
    this.form = document.getElementById('campaignForm');
    
    // 1. Basic Inputs
    this.isActive = document.getElementById('campActive');
    this.glovoLink = document.getElementById('campGlovo');
    this.startDate = document.getElementById('campStart');
    this.endDate = document.getElementById('campEnd');

    // 2. Content & Multi-Lang
    this.headline = document.getElementById('campHeadline');
    this.headlineEN = document.getElementById('campHeadlineEN');
    this.headlineKG = document.getElementById('campHeadlineKG');
    this.subheadline = document.getElementById('campSubheadline');
    this.optionalLine = document.getElementById('campOptional');

    // 3. Assets
    this.logoFile = document.getElementById('campLogoFile');
    this.logoWidth = document.getElementById('logoWidth');
    this.imageFile = document.getElementById('campImage');
    this.imgScale = document.getElementById('imgScale');

    // 4. Appearance
    this.bgColor = document.getElementById('bgColor');
    this.bgTexture = document.getElementById('bgTexture');
    this.entranceAnim = document.getElementById('entranceAnim');
    this.bgParticles = document.getElementById('bgParticles');
    this.headlineFont = document.getElementById('headlineFont');
    this.headlineSize = document.getElementById('headlineSize');
    this.btnColor = document.getElementById('btnColor');
    this.btnPulse = document.getElementById('btnPulse');

    // UI Elements
    this.statClicks = document.getElementById('statClicks');
    this.logoPreview = document.getElementById('campLogoPreview');
    this.imagePreview = document.getElementById('campPreview');
    this.qrImg = document.getElementById('campQR');
    this.urlLink = document.getElementById('campUrlLink');
    this.copyBtn = document.getElementById('copyCampLink');

    // Mock Elements
    this.mockLanding = document.getElementById('mockLanding');
    this.mockLogo = document.getElementById('mockLogo');
    this.mockHeadline = document.getElementById('mockHeadline');
    this.mockSubheadline = document.getElementById('mockSubheadline');
    this.mockImage = document.getElementById('mockImage');
    this.mockOptional = document.getElementById('mockOptional');
    this.mockBtn = document.getElementById('mockBtn');
    
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
    ];
    
    allInputs.forEach(input => {
      input.addEventListener('input', () => this.updateLivePreview());
    });

    // File Preview - Logo
    this.logoFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.logoPreview.src = ev.target.result;
          this.mockLogo.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // File Preview - Product
    this.imageFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.imagePreview.src = ev.target.result;
          this.mockImage.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    this.copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(this.urlLink.href).then(() => {
        const originalText = this.copyBtn.textContent;
        this.copyBtn.textContent = 'Copied!';
        setTimeout(() => this.copyBtn.textContent = originalText, 2000);
      });
    });
  }

  updateLivePreview() {
    // Text
    this.mockHeadline.textContent = this.headline.value || 'Headline';
    this.mockHeadline.style.fontFamily = this.headlineFont.value;
    this.mockHeadline.style.fontSize = `${this.headlineSize.value}rem`;
    this.mockHeadline.style.color = '#d4af37'; // Luxury gold

    this.mockSubheadline.textContent = this.subheadline.value || 'Subheadline';
    this.mockOptional.textContent = this.optionalLine.value || 'Optional Line';

    // Scaling
    this.mockLogo.style.width = `${this.logoWidth.value}px`;
    this.mockImage.style.transform = `scale(${this.imgScale.value / 100})`;

    // Backgrounds
    this.mockLanding.style.backgroundColor = this.bgColor.value;
    // Simple texture overlay mock
    if(this.bgTexture.value !== 'none') {
        this.mockLanding.style.backgroundImage = 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 100%)';
    } else {
        this.mockLanding.style.backgroundImage = 'none';
    }

    // Button
    this.mockBtn.style.backgroundColor = this.btnColor.value;
    this.mockBtn.style.color = '#fff';
    if(this.btnPulse.checked) {
        this.mockBtn.style.animation = 'pulse 2s infinite';
    } else {
        this.mockBtn.style.animation = 'none';
    }
  }

  async show() {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    this.section.style.display = 'block';
    
    await this.loadCampaign();
    await this.loadStats();
    this.initSharing();
  }

  initSharing() {
    const campaignUrl = `${window.location.origin}/prime-mun/`;
    this.urlLink.href = campaignUrl;
    this.urlLink.textContent = campaignUrl;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(campaignUrl)}`;
    this.qrImg.src = qrApi;
  }

  async loadStats() {
    try {
      const q = query(collection(db, "campaign_events"), where("campaignId", "==", "prime-mun"), where("actionType", "==", "click_glovo"));
      const snap = await getDocs(q);
      this.statClicks.textContent = snap.size;
    } catch(err) { console.error("Stats error:", err); }
  }

  async loadCampaign() {
    try {
      const docRef = doc(db, 'campaigns', 'prime-mun');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const s = data.styles || {};

        this.isActive.checked = data.isActive;
        this.glovoLink.value = data.glovoLink || '';
        this.headline.value = data.headline || '';
        this.headlineEN.value = data.headlineEN || '';
        this.headlineKG.value = data.headlineKG || '';
        this.subheadline.value = data.subheadline || '';
        this.optionalLine.value = data.optionalLine || '';
        
        this.currentImageUrl = data.imageUrl || '';
        this.currentLogoUrl = data.logoUrl || '';
        this.imagePreview.src = this.currentImageUrl;
        this.mockImage.src = this.currentImageUrl;
        this.logoPreview.src = this.currentLogoUrl;
        this.mockLogo.src = this.currentLogoUrl;

        // Apply Styles
        this.logoWidth.value = s.logoWidth || 120;
        this.imgScale.value = s.imgScale || 100;
        this.bgColor.value = s.bgColor || '#0c0b0a';
        this.bgTexture.value = s.bgTexture || 'none';
        this.entranceAnim.value = s.entranceAnim || 'fadeUp';
        this.bgParticles.value = s.bgParticles || 'none';
        this.headlineFont.value = s.headlineFont || "'Playfair Display', serif";
        this.headlineSize.value = s.headlineSize || 2.2;
        this.btnColor.value = s.btnColor || '#00c3a5';
        this.btnPulse.checked = s.btnPulse || false;

        if (data.startDate) this.startDate.value = data.startDate.toDate().toISOString().slice(0, 16);
        if (data.endDate) this.endDate.value = data.endDate.toDate().toISOString().slice(0, 16);

        this.updateLivePreview();
      }
    } catch (err) { console.error("Load error:", err); }
  }

  async saveCampaign() {
    const btn = this.form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "Updating Command Center...";
    btn.disabled = true;

    try {
      let finalImageUrl = this.currentImageUrl;
      let finalLogoUrl = this.currentLogoUrl;

      if (this.imageFile.files[0]) finalImageUrl = await uploadImage(this.imageFile.files[0], 'campaigns');
      if (this.logoFile.files[0]) finalLogoUrl = await uploadImage(this.logoFile.files[0], 'campaigns');

      const data = {
        isActive: this.isActive.checked,
        headline: this.headline.value,
        headlineEN: this.headlineEN.value,
        headlineKG: this.headlineKG.value,
        subheadline: this.subheadline.value,
        imageUrl: finalImageUrl,
        logoUrl: finalLogoUrl,
        glovoLink: this.glovoLink.value,
        optionalLine: this.optionalLine.value,
        startDate: this.startDate.value ? new Date(this.startDate.value) : null,
        endDate: this.endDate.value ? new Date(this.endDate.value) : null,
        styles: {
          logoWidth: parseInt(this.logoWidth.value),
          imgScale: parseInt(this.imgScale.value),
          bgColor: this.bgColor.value,
          bgTexture: this.bgTexture.value,
          entranceAnim: this.entranceAnim.value,
          bgParticles: this.bgParticles.value,
          headlineFont: this.headlineFont.value,
          headlineSize: parseFloat(this.headlineSize.value),
          btnColor: this.btnColor.value,
          btnPulse: this.btnPulse.checked
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
    }
  }
}
