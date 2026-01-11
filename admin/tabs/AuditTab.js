import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class AuditTab extends BaseTab {
    constructor() {
        super('audit'); // Ensure 'audit' section exists in HTML
        this.list = document.getElementById('auditList');
        this.btnRefresh = document.getElementById('btnRefreshAudit');
    }

    async init() {
        if (this.btnRefresh) this.btnRefresh.addEventListener('click', () => this.loadLogs());
        this.loadLogs();
    }

    // Refresh on tab switch
    onShow() {
        this.loadLogs();
    }

    async loadLogs() {
        if (!this.list) return;
        this.list.innerHTML = '<p>Loading logs...</p>';

        try {
            // Fetch last 50 logs
            const q = query(
                collection(db, 'audit_logs'),
                orderBy('timestamp', 'desc'),
                limit(50)
            );

            const snap = await getDocs(q);

            if (snap.empty) {
                this.list.innerHTML = '<p style="color:#666;">No logs found.</p>';
                return;
            }

            this.list.innerHTML = '';
            snap.forEach(d => {
                const log = d.data();
                const date = log.timestamp ? log.timestamp.toDate().toLocaleString() : 'Unknown Time';

                const el = document.createElement('div');
                el.className = 'list-item';
                el.style.fontSize = '0.9rem';
                el.innerHTML = `
                    <div style="width:140px; color:#666;">${date}</div>
                    <div style="flex:1;">
                        <strong>${log.action}</strong> 
                        <span style="color:#444;">${log.details || ''}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#888;">${log.user || 'System'}</div>
                `;
                this.list.appendChild(el);
            });

        } catch (e) {
            console.error(e);
            this.list.innerHTML = `<p style="color:red">Error loading logs: ${e.message}</p>`;
        }
    }
}
