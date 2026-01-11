import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class AnalyticsTab extends BaseTab {
    constructor() {
        super('analytics');
        this.reportDiv = document.getElementById('analyticsReport');
        this.btnRefresh = document.getElementById('btnRefreshAnalytics');
    }

    async init() {
        if (this.btnRefresh) this.btnRefresh.addEventListener('click', () => this.generateReport());
        this.generateReport();
    }

    onShow() {
        this.generateReport();
    }

    async generateReport() {
        if (!this.reportDiv) return;
        this.reportDiv.innerHTML = '<p>Loading analytics...</p>';

        try {
            // Fetch verified (paid) orders
            const q = query(
                collection(db, 'orders'),
                where('status', '==', 'paid'),
                orderBy('date', 'desc')
            );

            // Note: Composite index (status + date) might be needed. 
            // Fallback: fetch all paid and sort client side if index err.
            let docs = [];
            try {
                const snap = await getDocs(q);
                docs = snap.docs;
            } catch (e) {
                if (e.message.includes("index")) {
                    const q2 = query(collection(db, 'orders'), where('status', '==', 'paid'));
                    const snap = await getDocs(q2);
                    docs = snap.docs.sort((a, b) => b.data().date.localeCompare(a.data().date));
                } else throw e;
            }

            if (docs.length === 0) {
                this.reportDiv.innerHTML = '<p>No confirmed sales data yet.</p>';
                return;
            }

            // Aggregate by Date
            const dailyStats = {};

            docs.forEach(d => {
                const o = d.data();
                const day = o.date || 'Unknown';
                if (!dailyStats[day]) dailyStats[day] = { count: 0, revenue: 0 };

                dailyStats[day].count += 1;
                dailyStats[day].revenue += (Number(o.price) || 0);
            });

            // Render Table
            let html = `
                <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
                    <thead>
                        <tr style="background:#f5f5f5; text-align:left;">
                            <th style="padding:10px; border-bottom:2px solid #ddd;">Date</th>
                            <th style="padding:10px; border-bottom:2px solid #ddd;">Orders</th>
                            <th style="padding:10px; border-bottom:2px solid #ddd;">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            Object.keys(dailyStats).sort().reverse().forEach(date => {
                const stat = dailyStats[date];
                html += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${date}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${stat.count}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee;"><strong>${stat.revenue} som</strong></td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            this.reportDiv.innerHTML = html;

        } catch (e) {
            console.error(e);
            this.reportDiv.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
        }
    }
}
