import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { uploadImage } from '../utils.js';

export class CampaignsTab {
  constructor() {
    this.section = document.getElementById('campaigns');
    this.form = document.getElementById('campaignForm');
    
    // Inputs
    this.isActive = document.getElementById('campActive');
    this.headline = document.getElementById('campHeadline');
    this.subheadline = document.getElementById('campSubheadline');
    this.logoFile = document.getElementById('campLogoFile');
    this.imageFile = document.getElementById('campImage');
    this.glovoLink = document.getElementById('campGlovo');
    this.optionalLine = document.getElementById('campOptional');
    this.startDate = document.getElementById('campStart');
    this.endDate = document.getElementById('campEnd');
    
    // UI Elements
    this.logoPreview = document.getElementById('campLogoPreview');
    this.imagePreview = document.getElementById('campPreview');
    this.fNameLogo = document.getElementById('fNameLogo');
    this.fNameCamp = document.getElementById('fNameCamp');
    this.qrImg = document.getElementById('campQR');
    this.urlLink = document.getElementById('campUrlLink');
    this.copyBtn = document.getElementById('copyCampLink');

    // Mock Preview Elements
    this.mockLogo = document.getElementById('mockLogo');
    this.mockHeadline = document.getElementById('mockHeadline');
    this.mockSubheadline = document.getElementById('mockSubheadline');
    this.mockImage = document.getElementById('mockImage');
    this.mockOptional = document.getElementById('mockOptional');
    
    this.currentImageUrl = '';
    this.currentLogoUrl = '';
    
    this.bindEvents();
  }

  bindEvents() {
    if(this.form) {
      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveCampaign();
      });

      // Real-time Preview Listeners
      const liveFields = [this.headline, this.subheadline, this.optionalLine];
      liveFields.forEach(field => {
        field.addEventListener('input', () => this.updateLivePreview());
      });

      // Logo File Change
      this.logoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.fNameLogo.textContent = file.name;
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.logoPreview.src = ev.target.result;
            this.mockLogo.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });

      // Product Image File Change
      this.imageFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.fNameCamp.textContent = file.name;
          const reader = new FileReader();
          reader.onload = (ev) => {
            this.imagePreview.src = ev.target.result;
            this.mockImage.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });

      // Copy Link
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
    this.mockHeadline.textContent = this.headline.value || 'PRIME MUN BOX';
    this.mockSubheadline.textContent = this.subheadline.value || 'Limited for 3 days';
    this.mockOptional.textContent = this.optionalLine.value || '🎁 Free dessert included';
  }

  async show() {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    this.section.style.display = 'block';
    
    await this.loadCampaign();
    this.initSharing();
  }

  initSharing() {
    const campaignUrl = `${window.location.origin}/prime-mun/`;
    this.urlLink.href = campaignUrl;
    this.urlLink.textContent = campaignUrl;
    
    // Generate QR
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(campaignUrl)}`;
    this.qrImg.src = qrApi;
  }

  async loadCampaign() {
    try {
      const docRef = doc(db, 'campaigns', 'prime-mun');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        this.isActive.checked = data.isActive;
        this.headline.value = data.headline || '';
        this.subheadline.value = data.subheadline || '';
        this.glovoLink.value = data.glovoLink || '';
        this.optionalLine.value = data.optionalLine || '';
        
        this.currentImageUrl = data.imageUrl || '';
        this.currentLogoUrl = data.logoUrl || '';
        
        this.imagePreview.src = this.currentImageUrl;
        this.mockImage.src = this.currentImageUrl;
        
        this.logoPreview.src = this.currentLogoUrl;
        this.mockLogo.src = this.currentLogoUrl;

        this.imageFile.value = '';
        this.logoFile.value = '';
        this.fNameCamp.textContent = 'No file chosen';
        this.fNameLogo.textContent = 'No file chosen';

        if (data.startDate) {
          const d = data.startDate.toDate();
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, -1);
          this.startDate.value = localISOTime;
        }
        if (data.endDate) {
          const d = data.endDate.toDate();
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, -1);
          this.endDate.value = localISOTime;
        }

        this.updateLivePreview();
      }
    } catch (err) {
      console.error("Error loading campaign data", err);
    }
  }

  async saveCampaign() {
    const btn = this.form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
      let finalImageUrl = this.currentImageUrl;
      let finalLogoUrl = this.currentLogoUrl;

      // Handle file uploads
      if (this.imageFile.files[0]) {
        finalImageUrl = await uploadImage(this.imageFile.files[0], 'campaigns');
      }
      if (this.logoFile.files[0]) {
        finalLogoUrl = await uploadImage(this.logoFile.files[0], 'campaigns');
      }

      const data = {
        isActive: this.isActive.checked,
        headline: this.headline.value,
        subheadline: this.subheadline.value,
        imageUrl: finalImageUrl,
        logoUrl: finalLogoUrl,
        glovoLink: this.glovoLink.value,
        optionalLine: this.optionalLine.value,
        startDate: this.startDate.value ? new Date(this.startDate.value) : null,
        endDate: this.endDate.value ? new Date(this.endDate.value) : null
      };

      await setDoc(doc(db, 'campaigns', 'prime-mun'), data);
      
      this.currentImageUrl = finalImageUrl;
      this.currentLogoUrl = finalLogoUrl;

      btn.textContent = "Saved!";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
      
    } catch (err) {
      console.error("Error saving campaign", err);
      alert("Error saving campaign: " + err.message);
      btn.disabled = false;
    }
  }
}
