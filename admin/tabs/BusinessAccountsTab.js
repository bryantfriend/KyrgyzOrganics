import { auth, db } from '../../firebase-config.js';
import { getSelectedCompanyId, matchesSelectedCompany } from '../../store-context.js';
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
        if (this.list) {
            this.list.innerHTML = '<p style="color:#666; padding:1rem;">Loading business applications...</p>';
        }

        // Keep this query compatible with legacy applications that predate
        // companyId. matchesSelectedCompany assigns those records to the
        // default store until the companyId migration has been run.
        const q = query(
            collection(db, 'users'),
            where('businessStatus', '==', 'pending')
        );

        this.unsubscribe = onSnapshot(q, function (snapshot) {
            this.applications = snapshot.docs.map(function (docSnap) {
                return Object.assign({ id: docSnap.id }, docSnap.data());
            }).filter(function (profile) {
                return profile.accountType === 'business'
                    && matchesSelectedCompany(profile, profile.id);
            });
            this.renderApplications();
        }.bind(this), function (error) {
            console.error('Business applications failed to load:', error);
            if (this.list) {
                this.list.innerHTML = '<p style="color:#b3261e; padding:1rem;">Business applications could not be loaded. Check your access and try again.</p>';
            }
        }.bind(this));
    }

    onStoreChanged() {
        if (!this.isInitialized) return;
        this.loadApplications();
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
            companyId: getSelectedCompanyId(),
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
            companyId: getSelectedCompanyId(),
            businessStatus: 'rejected',
            updatedAt: serverTimestamp()
        });

        await logAudit('Business Account Rejected', uid);
    }
}
