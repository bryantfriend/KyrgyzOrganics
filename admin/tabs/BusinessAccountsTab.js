import { auth, db } from '../../firebase-config.js';
import { logAudit } from '../utils.js';
import { BaseTab } from './BaseTab.js';
import {
    collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class BusinessAccountsTab extends BaseTab {
    constructor() {
        super('businessAccounts');
        this.list = document.getElementById('businessApplicationsList');
        this.unsubscribe = null;
        this.applications = [];
    }

    async init() {
        window.approveBusinessAccount = this.approveBusinessAccount.bind(this);
        window.rejectBusinessAccount = this.rejectBusinessAccount.bind(this);
        this.loadApplications();
    }

    loadApplications() {
        if (this.unsubscribe) this.unsubscribe();

        const q = query(
            collection(db, 'users'),
            where('accountType', '==', 'business'),
            where('businessStatus', '==', 'pending')
        );

        this.unsubscribe = onSnapshot(q, function (snapshot) {
            this.applications = snapshot.docs.map(function (docSnap) {
                return Object.assign({ id: docSnap.id }, docSnap.data());
            });
            this.renderApplications();
        }.bind(this));
    }

    renderApplications() {
        if (!this.list) return;

        if (!this.applications.length) {
            this.list.innerHTML = '<p style="color:#666; padding:1rem;">No pending business applications.</p>';
            return;
        }

        this.list.innerHTML = this.applications.map(function (profile) {
            return `
                <div class="list-item">
                    <div style="flex:1;">
                        <strong>${profile.businessName || profile.displayName || profile.email || profile.id}</strong>
                        <div style="color:#666; font-size:0.9rem;">${profile.email || ''} · ${profile.businessPhone || profile.phone || ''}</div>
                        <div style="color:#666; font-size:0.9rem;">${profile.businessType || 'Business'} · ${profile.businessAddress || ''}</div>
                        ${profile.businessNotes ? `<div style="color:#777; font-size:0.85rem;">${profile.businessNotes}</div>` : ''}
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button type="button" class="btn-primary" onclick="approveBusinessAccount('${profile.id}')">Approve</button>
                        <button type="button" class="btn-danger" onclick="rejectBusinessAccount('${profile.id}')">Reject</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async approveBusinessAccount(uid) {
        if (!confirm('Approve this business account for business pricing?')) return;

        await updateDoc(doc(db, 'users', uid), {
            businessStatus: 'approved',
            approvedAt: serverTimestamp(),
            approvedBy: auth.currentUser ? auth.currentUser.uid : '',
            updatedAt: serverTimestamp()
        });

        await logAudit('Business Account Approved', uid);
    }

    async rejectBusinessAccount(uid) {
        if (!confirm('Reject this business account application?')) return;

        await updateDoc(doc(db, 'users', uid), {
            businessStatus: 'rejected',
            updatedAt: serverTimestamp()
        });

        await logAudit('Business Account Rejected', uid);
    }
}
