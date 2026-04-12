import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { uploadImage } from '../utils.js';
import { COMPANY_ID, matchesCompanyId } from '../../company-config.js';
import {
    collection, addDoc, deleteDoc, doc, query, orderBy, getDocs, getDoc, setDoc, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class SettingsTab extends BaseTab {
    constructor() {
        super('settings');
        this.list = document.getElementById('methodsList');
        this.form = document.getElementById('paymentForm');
        this.deliveryFee = document.getElementById('checkoutDeliveryFee');
        this.freeThreshold = document.getElementById('checkoutFreeThreshold');
        this.supportWhatsappNumber = document.getElementById('supportWhatsappNumber');
        this.saveCheckoutBtn = document.getElementById('saveCheckoutSettings');
    }

    async init() {
        window.deletePaymentMethod = this.deletePaymentMethod.bind(this);

        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        if (this.saveCheckoutBtn) this.saveCheckoutBtn.addEventListener('click', () => this.saveCheckoutSettings());
        this.loadMethods();
        this.loadCheckoutSettings();
    }

    // Refresh on tab switch
    onShow() {
        this.loadMethods();
        this.loadCheckoutSettings();
    }

    async loadMethods() {
        if (!this.list) return;
        this.list.innerHTML = '<p>Loading...</p>';

        try {
            let snap;
            try {
                snap = await getDocs(query(collection(db, 'payment_methods'), orderBy('name', 'asc')));
            } catch (e) {
                snap = await getDocs(collection(db, 'payment_methods'));
            }

            this.list.innerHTML = '';
            snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(m => matchesCompanyId(m, `payment_methods/${m.id}`))
                .forEach(m => {
                const el = document.createElement('div');
                el.className = 'list-item';
                el.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${m.qrUrl ? `<img src="${m.qrUrl}" style="width:40px; height:40px; object-fit:contain; border:1px solid #eee;">` : ''}
                        <div>
                           <strong>${m.name}</strong><br>
                           <span style="font-size:0.85em; color:#666;">${m.number || ''} (${m.accountName || ''})</span>
                        </div>
                    </div>
                    <div>
                         <button onclick="deletePaymentMethod('${m.id}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
                    </div>
                `;
                this.list.appendChild(el);
            });
        } catch (e) {
            console.error(e);
            this.list.innerHTML = '<p style="color:red">Error loading methods</p>';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
            const file = document.getElementById('methodQrImg').files[0];
            let qrUrl = "";
            if (file) {
                qrUrl = await uploadImage(file, 'brand');
            }

            await addDoc(collection(db, 'payment_methods'), {
                companyId: COMPANY_ID,
                name: document.getElementById('methodBank').value,
                accountName: document.getElementById('methodAccountName').value,
                number: document.getElementById('methodNumber').value,
                qrUrl,
                active: true,
                createdAt: serverTimestamp()
            });

            alert("Added!");
            e.target.reset();
            this.loadMethods();
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = oldText;
        }
    }

    async deletePaymentMethod(id) {
        if (confirm("Delete?")) {
            await deleteDoc(doc(db, 'payment_methods', id));
            this.loadMethods();
        }
    }

    async loadCheckoutSettings() {
        try {
            const snap = await getDoc(doc(db, 'shop_settings', 'checkout'));
            const data = snap.exists() ? snap.data() : {};
            if (data.companyId && data.companyId !== COMPANY_ID) {
                console.warn('Checkout settings companyId mismatch');
                return;
            }
            if (snap.exists() && !data.companyId) console.warn('Checkout settings missing companyId');

            if (this.deliveryFee) this.deliveryFee.value = data.deliveryFee ?? 200;
            if (this.freeThreshold) this.freeThreshold.value = data.freeDeliveryThreshold ?? 3000;
            if (this.supportWhatsappNumber) this.supportWhatsappNumber.value = data.supportWhatsappNumber ?? '';
        } catch (error) {
            console.error(error);
        }
    }

    async saveCheckoutSettings() {
        try {
            await setDoc(doc(db, 'shop_settings', 'checkout'), {
                companyId: COMPANY_ID,
                deliveryFee: Number(this.deliveryFee?.value || 0),
                freeDeliveryThreshold: Number(this.freeThreshold?.value || 0),
                supportWhatsappNumber: String(this.supportWhatsappNumber?.value || '').trim(),
                pickupEnabled: true,
                updatedAt: serverTimestamp()
            }, { merge: true });

            alert('Checkout settings saved');
        } catch (error) {
            alert(error.message);
        }
    }
}
