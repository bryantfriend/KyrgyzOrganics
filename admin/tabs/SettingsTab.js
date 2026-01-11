import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { uploadImage } from '../utils.js';
import {
    collection, addDoc, deleteDoc, doc, query, orderBy, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class SettingsTab extends BaseTab {
    constructor() {
        super('settings');
        this.list = document.getElementById('methodsList');
        this.form = document.getElementById('paymentForm');
    }

    async init() {
        window.deletePaymentMethod = this.deletePaymentMethod.bind(this);

        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.loadMethods();
    }

    // Refresh on tab switch
    onShow() {
        this.loadMethods();
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
            snap.forEach(d => {
                const m = d.data();
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
                         <button onclick="deletePaymentMethod('${d.id}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
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
                qrUrl = await uploadImage(file, 'payment_qrs');
            }

            await addDoc(collection(db, 'payment_methods'), {
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
}
