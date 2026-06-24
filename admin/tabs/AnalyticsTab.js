import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getSelectedCompanyId } from '../../store-context.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function toDate(value) {
    if (!value) return null;
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function localDateId(date) {
    if (!date) return 'Unknown';
    return date.toISOString().slice(0, 10);
}

function bishkekDateId(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function getWeekStartId(dayId) {
    const [year, month, day] = String(dayId || '').split('-').map(Number);
    if (!year || !month || !day) return 'Unknown';
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - weekday + 1);
    return date.toISOString().slice(0, 10);
}

function money(value) {
    const n = Number(value || 0);
    return `${Math.round(Number.isFinite(n) ? n : 0).toLocaleString()} som`;
}

function number(value) {
    const n = Number(value || 0);
    return Math.round(Number.isFinite(n) ? n : 0).toLocaleString();
}

function inc(map, key, amount = 1) {
    const clean = key || 'unknown';
    map[clean] = (map[clean] || 0) + amount;
}

function topRows(map, limit = 6) {
    return Object.entries(map || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
}

export class AnalyticsTab extends BaseTab {
    constructor() {
        super('analytics');
        this.reportDiv = document.getElementById('analyticsReport');
        this.btnRefresh = document.getElementById('btnRefreshAnalytics');
        this.rangeSelect = document.getElementById('analyticsRange');
        this.scopeSelect = document.getElementById('analyticsScope');
    }

    async init() {
        if (this.btnRefresh) this.btnRefresh.addEventListener('click', () => this.generateReport());
        if (this.rangeSelect) this.rangeSelect.addEventListener('change', () => this.generateReport());
        if (this.scopeSelect) this.scopeSelect.addEventListener('change', () => this.generateReport());
        this.generateReport();
    }

    onShow() {
        this.generateReport();
    }

    getCutoff() {
        const value = this.rangeSelect?.value || '30';
        if (value === 'all') return null;
        const days = Number(value || 30);
        return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    async getDocsSafe(collectionName, companyId, scope) {
        try {
            if (scope === 'all') {
                const snap = await getDocs(collection(db, collectionName));
                return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            }

            const snap = await getDocs(query(collection(db, collectionName), where('companyId', '==', companyId)));
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.warn(`${collectionName} analytics load skipped:`, error);
            return [];
        }
    }

    async generateReport() {
        if (!this.reportDiv) return;

        const selectedCompanyId = getSelectedCompanyId();
        const scope = this.scopeSelect?.value || 'selected';
        const cutoff = this.getCutoff();
        const scopeLabel = scope === 'all' ? 'All Stores' : selectedCompanyId;

        this.reportDiv.innerHTML = `
            <div class="analytics-loading">
                <strong>Building analytics...</strong>
                <span>Reading orders, products, stores, QR clicks, and storefront events for ${escapeHtml(scopeLabel)}.</span>
            </div>
        `;

        try {
            const [ordersRaw, productsRaw, eventsRaw, campaignEventsRaw, storesRaw] = await Promise.all([
                this.getDocsSafe('orders', selectedCompanyId, scope),
                this.getDocsSafe('products', selectedCompanyId, scope),
                this.getDocsSafe('storefront_events', selectedCompanyId, scope),
                this.getDocsSafe('campaign_events', selectedCompanyId, scope),
                getDocs(collection(db, 'companies')).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => [])
            ]);

            const orders = ordersRaw.filter((order) => {
                const createdAt = toDate(order.createdAt || order.date);
                return !cutoff || (createdAt && createdAt >= cutoff);
            });
            const events = eventsRaw.filter((event) => {
                const createdAt = toDate(event.createdAt || event.timestamp);
                return !cutoff || !createdAt || createdAt >= cutoff;
            });
            const qrEvents = campaignEventsRaw.filter((event) => {
                if ((event.actionType || event.type) !== 'qr_click') return false;
                const createdAt = toDate(event.createdAt || event.timestamp);
                return !cutoff || !createdAt || createdAt >= cutoff;
            });
            const products = productsRaw;

            this.reportDiv.innerHTML = this.renderReport({
                scope,
                selectedCompanyId,
                stores: storesRaw,
                orders,
                products,
                events,
                qrEvents
            });
        } catch (e) {
            console.error(e);
            this.reportDiv.innerHTML = `<div class="inline-alert error">Analytics error: ${escapeHtml(e.message)}</div>`;
        }
    }

    renderReport({ scope, selectedCompanyId, stores, orders, products, events, qrEvents }) {
        const revenue = orders.reduce((sum, order) => {
            const value = Number(order.total ?? order.price ?? order.amount ?? 0);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const pageViews = events.filter((event) => (event.actionType || event.type) === 'page_view').length;
        const conversion = pageViews > 0 ? `${((orders.length / pageViews) * 100).toFixed(1)}%` : 'n/a';
        const activeProducts = products.filter((product) => product.active !== false).length;
        const averageOrder = orders.length ? revenue / orders.length : 0;

        const daily = {};
        const status = {};
        const storeRevenue = {};
        const eventTypes = {};
        const productDemand = {};
        const qrDaily = {};
        const qrWeekly = {};
        const qrMonthly = {};
        const qrLinkTotals = {};
        const qrLinkLabels = {};

        orders.forEach((order) => {
            const companyId = order.companyId || selectedCompanyId;
            const createdAt = toDate(order.createdAt || order.date);
            const total = Number(order.total ?? order.price ?? order.amount ?? 0) || 0;
            const day = localDateId(createdAt);

            if (!daily[day]) daily[day] = { orders: 0, revenue: 0 };
            daily[day].orders += 1;
            daily[day].revenue += total;

            inc(status, order.status || 'unknown');
            inc(storeRevenue, companyId, total);

            (Array.isArray(order.items) ? order.items : []).forEach((item) => {
                const name = item.name || item.name_en || item.productName || item.productId || item.id || 'Product';
                const qty = Number(item.quantity ?? item.qty ?? 1);
                inc(productDemand, name, Number.isFinite(qty) ? qty : 1);
            });
        });

        events.forEach((event) => inc(eventTypes, event.actionType || event.type || 'event'));

        qrEvents.forEach((event) => {
            const createdAt = toDate(event.createdAt || event.timestamp);
            const day = event.dayId || (createdAt ? bishkekDateId(createdAt) : 'Unknown');
            const week = event.weekId || getWeekStartId(day);
            const month = event.monthId || (day.length >= 7 ? day.slice(0, 7) : 'Unknown');
            const linkId = event.linkId || event.campaignId || 'unknown';
            inc(qrDaily, day);
            inc(qrWeekly, week);
            inc(qrMonthly, month);
            inc(qrLinkTotals, linkId);
            if (!qrLinkLabels[linkId]) {
                qrLinkLabels[linkId] = {
                    label: event.label || event.code || linkId,
                    brand: event.brand || '-',
                    code: event.code || '-',
                };
            }
        });

        const totalQrClicks = qrEvents.length;
        const todayQrClicks = qrDaily[bishkekDateId()] || 0;
        const topQrLinks = topRows(qrLinkTotals, 10).map(([linkId, clicks]) => {
            const link = qrLinkLabels[linkId] || {};
            return [link.label || linkId, number(clicks), link.brand || '-', link.code || '-', linkId];
        });

        return `
            <div class="analytics-kpi-grid">
                ${this.renderKpi('Revenue', money(revenue), `Avg order ${money(averageOrder)}`)}
                ${this.renderKpi('Orders', orders.length, `${Object.keys(status).length || 0} statuses`)}
                ${this.renderKpi('QR Clicks', number(totalQrClicks), `${number(todayQrClicks)} today`)}
                ${this.renderKpi('Visits', pageViews, `${events.length} total events`)}
                ${this.renderKpi('Conversion', conversion, 'Orders / visits')}
                ${this.renderKpi('Products', products.length, `${activeProducts} active`)}
                ${this.renderKpi('Stores', scope === 'all' ? stores.length : 1, scope === 'all' ? 'Compared below' : selectedCompanyId)}
            </div>

            <div class="analytics-grid">
                ${this.renderTable('QR Clicks by Day', ['Date', 'Clicks'], Object.entries(qrDaily)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 14)
                    .map(([date, clicks]) => [date, number(clicks)]))}

                ${this.renderTable('Top QR Links', ['Product/Campaign', 'Clicks', 'Brand', 'Code', 'Link ID'], topQrLinks)}

                ${this.renderTable('QR Clicks by Week', ['Week Starting', 'Clicks'], Object.entries(qrWeekly)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 12)
                    .map(([week, clicks]) => [week, number(clicks)]))}

                ${this.renderTable('QR Clicks by Month', ['Month', 'Clicks'], Object.entries(qrMonthly)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 12)
                    .map(([month, clicks]) => [month, number(clicks)]))}

                ${this.renderTable('Revenue Trend', ['Date', 'Orders', 'Revenue'], Object.entries(daily)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 14)
                    .map(([date, stat]) => [date, stat.orders, money(stat.revenue)]))}

                ${this.renderTable('Order Status', ['Status', 'Orders'], topRows(status).map(([name, count]) => [name, count]))}

                ${this.renderTable('Store Comparison', ['Store', 'Revenue'], topRows(storeRevenue, 10).map(([companyId, value]) => [
                    stores.find((store) => (store.companyId || store.id) === companyId)?.name || companyId,
                    money(value)
                ]))}

                ${this.renderTable('Top Products', ['Product', 'Qty'], topRows(productDemand, 10))}

                ${this.renderTable('Storefront Events', ['Event', 'Count'], topRows(eventTypes, 10))}
            </div>
        `;
    }

    renderKpi(label, value, hint) {
        return `
            <article class="analytics-kpi-card">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
                <small>${escapeHtml(hint)}</small>
            </article>
        `;
    }

    renderTable(title, headers, rows) {
        const body = rows.length
            ? rows.map((row) => `
                <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
            `).join('')
            : `<tr><td colspan="${headers.length}">No data yet.</td></tr>`;

        return `
            <section class="analytics-panel">
                <h4>${escapeHtml(title)}</h4>
                <table>
                    <thead>
                        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </section>
        `;
    }
}
