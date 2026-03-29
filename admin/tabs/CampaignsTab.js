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
    this.imageUrl = document.getElementById('campImage'); // Now a file input
    this.glovoLink = document.getElementById('campGlovo');
    this.optionalLine = document.getElementById('campOptional');
    this.startDate = document.getElementById('campStart');
    this.endDate = document.getElementById('campEnd');

    // UI Feedback
    this.preview = document.getElementById('campPreview');
    this.fileNameDisp = document.getElementById('fNameCamp');
    this.currentImageUrl = '';
    
    this.bindEvents();
  }

  bindEvents() {
    if(this.form) {
      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveCampaign();
      });
    }

    if (this.imageUrl) {
      this.imageUrl.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.fileNameDisp.textContent = file.name;
          const reader = new FileReader();
          reader.onload = (ev) => this.preview.src = ev.target.result;
          reader.readAsDataURL(file);
        }
      });
    }
  }

  async show() {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    this.section.style.display = 'block';
    
    await this.loadCampaign();
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
        this.currentImageUrl = data.imageUrl || '';
        this.preview.src = this.currentImageUrl;
        this.imageUrl.value = ''; // Reset file input
        this.fileNameDisp.textContent = 'No file chosen';
        this.glovoLink.value = data.glovoLink || '';
        this.optionalLine.value = data.optionalLine || '';
        
        if (data.startDate) {
          const d = data.startDate.toDate();
          // Format to YYYY-MM-DDTHH:mm
          const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
          const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, -1);
          this.startDate.value = localISOTime;
        }
        if (data.endDate) {
          const d = data.endDate.toDate();
          const tzOffset = d.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, -1);
          this.endDate.value = localISOTime;
        }
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

      // Handle new file upload
      const file = this.imageUrl.files[0];
      if (file) {
        finalImageUrl = await uploadImage(file, 'campaigns');
      }

      const data = {
        isActive: this.isActive.checked,
        headline: this.headline.value,
        subheadline: this.subheadline.value,
        imageUrl: finalImageUrl,
        glovoLink: this.glovoLink.value,
        optionalLine: this.optionalLine.value,
        startDate: this.startDate.value ? new Date(this.startDate.value) : null,
        endDate: this.endDate.value ? new Date(this.endDate.value) : null
      };

      await setDoc(doc(db, 'campaigns', 'prime-mun'), data);
      
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
