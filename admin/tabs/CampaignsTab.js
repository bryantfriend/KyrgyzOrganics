import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class CampaignsTab {
  constructor() {
    this.section = document.getElementById('campaigns');
    this.form = document.getElementById('campaignForm');
    
    // Inputs
    this.isActive = document.getElementById('campActive');
    this.headline = document.getElementById('campHeadline');
    this.subheadline = document.getElementById('campSubheadline');
    this.imageUrl = document.getElementById('campImage');
    this.glovoLink = document.getElementById('campGlovo');
    this.optionalLine = document.getElementById('campOptional');
    this.startDate = document.getElementById('campStart');
    this.endDate = document.getElementById('campEnd');
    
    this.bindEvents();
  }

  bindEvents() {
    if(this.form) {
      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveCampaign();
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
        this.imageUrl.value = data.imageUrl || '';
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
    const data = {
      isActive: this.isActive.checked,
      headline: this.headline.value,
      subheadline: this.subheadline.value,
      imageUrl: this.imageUrl.value,
      glovoLink: this.glovoLink.value,
      optionalLine: this.optionalLine.value,
      startDate: this.startDate.value ? new Date(this.startDate.value) : null,
      endDate: this.endDate.value ? new Date(this.endDate.value) : null
    };

    try {
      const btn = this.form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = "Saving...";
      btn.disabled = true;

      await setDoc(doc(db, 'campaigns', 'prime-mun'), data);
      
      btn.textContent = "Saved!";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
      
    } catch (err) {
      console.error("Error saving campaign", err);
      alert("Error saving campaign: " + err.message);
      this.form.querySelector('button[type="submit"]').disabled = false;
    }
  }
}
