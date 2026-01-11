import { auth } from '../firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { CategoriesTab } from './tabs/CategoriesTab.js';
import { ProductsTab } from './tabs/ProductsTab.js';
import { BannersTab } from './tabs/BannersTab.js';
import { ContentTab } from './tabs/ContentTab.js';
import { InventoryTab } from './tabs/InventoryTab.js';
import { SettingsTab } from './tabs/SettingsTab.js';
import { OrdersTab } from './tabs/OrdersTab.js';
import { AuditTab } from './tabs/AuditTab.js';
import { AnalyticsTab } from './tabs/AnalyticsTab.js';

class AdminApp {
  constructor() {
    this.authScreen = document.getElementById('authScreen');
    this.mainApp = document.getElementById('mainApp');
    this.loginForm = document.getElementById('loginForm');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.tabs = {};

    // Navigation
    this.navButtons = document.querySelectorAll('.nav-btn'); // Assuming I added class nav-btn to all? 
    // Wait, I only added class nav-btn to NEW buttons. 
    // Old buttons just had `tabs button` selector.
    // Let's standardise selector.

    this.init();
  }

  async init() {
    this.setupAuth();
    this.setupTabs();

    // Global Helper for Mobile Preview Close
    window.closePreview = () => {
      document.getElementById('mobilePreview')?.classList.add('hidden');
    };
  }

  setupAuth() {
    onAuthStateChanged(auth, user => {
      this.authScreen.hidden = !!user;
      this.mainApp.hidden = !user;
      if (user) {
        this.onLogin();
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
          await signInWithEmailAndPassword(auth, email, pwd);
          this.loginForm.reset();
          if (errorP) errorP.textContent = '';
        } catch (err) {
          console.error(err);
          if (errorP) errorP.textContent = "Login Failed: " + err.message;
        }
      });
    }
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
