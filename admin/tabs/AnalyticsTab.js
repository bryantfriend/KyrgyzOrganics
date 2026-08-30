import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getSelectedCompanyId } from '../../store-context.js';
import {
    COLLECTION_ANALYTICS_SERIES,
    buildCollectionTimeline,
    collectionEventIdentity,
    getCollectionEvents,
    getCollectionSummary,
    getProductCollectionBreakdown
} from '../../collection-analytics.mjs';
import {
    buildGranolaTimeline,
    GRANOLA_ANALYTICS_SERIES,
    isGranolaAnalyticsEvent,
    summarizeGranolaAnalytics
} from '../../granola-purchase-analytics.mjs';

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
        this.collectionAnalyticsData = { collections: [], products: [], events: [] };
        this.activeCollectionId = '';
        this.collectionGranularity = 'day';
        this.granolaAnalyticsEvents = [];
        this.granolaGranularity = 'day';
        this.granolaModalTrigger = null;
    }

    async init() {
        this.ensureCollectionAnalyticsModal();
        this.ensureGranolaAnalyticsModal();
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
            const [ordersRaw, productsRaw, eventsRaw, campaignEventsRaw, storesRaw, collectionsRaw] = await Promise.all([
                this.getDocsSafe('orders', selectedCompanyId, scope),
                this.getDocsSafe('products', selectedCompanyId, scope),
                this.getDocsSafe('storefront_events', selectedCompanyId, scope),
                this.getDocsSafe('campaign_events', selectedCompanyId, scope),
                getDocs(collection(db, 'companies')).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
                this.getDocsSafe('product_collections', selectedCompanyId, scope)
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
            const granolaEvents = campaignEventsRaw.filter((event) => {
                if (!isGranolaAnalyticsEvent(event)) return false;
                const createdAt = toDate(event.createdAt || event.timestamp);
                return !cutoff || !createdAt || createdAt >= cutoff;
            });
            this.granolaAnalyticsEvents = granolaEvents;
            const products = productsRaw;
            const allCollectionEvents = getCollectionEvents(eventsRaw, campaignEventsRaw);
            const collectionEvents = allCollectionEvents.filter((event) => !cutoff || !event.analyticsDate || event.analyticsDate >= cutoff);

            this.collectionAnalyticsData = {
                collections: collectionsRaw,
                products,
                events: allCollectionEvents
            };

            this.reportDiv.innerHTML = this.renderReport({
                scope,
                selectedCompanyId,
                stores: storesRaw,
                orders,
                products,
                events,
                qrEvents,
                granolaEvents,
                collections: collectionsRaw,
                collectionEvents
            });
            this.bindGranolaAnalyticsOverview();
            this.bindCollectionAnalyticsOverview();
        } catch (e) {
            console.error(e);
            this.reportDiv.innerHTML = `<div class="inline-alert error">Analytics error: ${escapeHtml(e.message)}</div>`;
        }
    }

    renderReport({ scope, selectedCompanyId, stores, orders, products, events, qrEvents, granolaEvents, collections, collectionEvents }) {
        const revenue = orders.reduce((sum, order) => {
            const value = Number(order.total ?? order.price ?? order.amount ?? 0);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        const pageViews = events.filter((event) => (event.actionType || event.type) === 'page_view').length;
        const conversion = pageViews > 0 ? `${((orders.length / pageViews) * 100).toFixed(1)}%` : 'n/a';
        const activeProducts = products.filter((product) => product.active !== false).length;
        const averageOrder = orders.length ? revenue / orders.length : 0;
        const granolaAnalytics = summarizeGranolaAnalytics(granolaEvents);

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
                ${this.renderKpi('Granola Clicks', number(granolaAnalytics.totalClicks), `${number(granolaAnalytics.launches)} app launches`)}
                ${this.renderKpi('Visits', pageViews, `${events.length} total events`)}
                ${this.renderKpi('Conversion', conversion, 'Orders / visits')}
                ${this.renderKpi('Products', products.length, `${activeProducts} active`)}
                ${this.renderKpi('Stores', scope === 'all' ? stores.length : 1, scope === 'all' ? 'Compared below' : selectedCompanyId)}
            </div>

            ${this.renderGranolaPurchaseAnalytics(granolaAnalytics)}

            ${this.renderCollectionAnalyticsOverview(collections, collectionEvents)}

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

    renderGranolaPurchaseAnalytics(summary) {
        const leadingProvider = summary.providerRows[0];
        return `
            <section class="collection-analytics-overview granola-purchase-analytics" aria-labelledby="granolaPurchaseAnalyticsHeading">
                <div class="collection-analytics-overview-header">
                    <div>
                        <span class="eyebrow">Granola Purchase Chooser</span>
                        <h4 id="granolaPurchaseAnalyticsHeading">Yandex and Glovo click performance</h4>
                        <p>Every delivery-app choice and every product button on the granola demo is counted here.</p>
                    </div>
                    <span class="collection-analytics-live-badge">Tracking live</span>
                </div>
                <div class="granola-analytics-preview">
                    <div class="granola-preview-stat featured">
                        <span>Total tracked clicks</span>
                        <strong>${number(summary.totalClicks)}</strong>
                        <small>${number(summary.launches)} purchase-app launches</small>
                    </div>
                    <div class="granola-preview-stat">
                        <span>Unique sessions</span>
                        <strong>${number(summary.uniqueSessions)}</strong>
                        <small>Approximate visitors</small>
                    </div>
                    <div class="granola-preview-stat">
                        <span>Leading channel</span>
                        <strong>${escapeHtml(leadingProvider?.provider || 'No data yet')}</strong>
                        <small>${number(leadingProvider?.launches || 0)} app launches</small>
                    </div>
                    <button type="button" class="granola-analytics-open" data-open-granola-analytics>
                        <span>Explore performance</span>
                        <strong>View analytics</strong>
                        <span aria-hidden="true">↗</span>
                    </button>
                </div>
            </section>
        `;
    }

    bindGranolaAnalyticsOverview() {
        this.reportDiv?.querySelector('[data-open-granola-analytics]')?.addEventListener('click', (event) => {
            this.granolaModalTrigger = event.currentTarget;
            this.openGranolaAnalytics();
        });
    }

    ensureGranolaAnalyticsModal() {
        if (document.getElementById('granolaAnalyticsModal')) return;
        const modal = document.createElement('div');
        modal.id = 'granolaAnalyticsModal';
        modal.className = 'modal hidden collection-analytics-modal granola-analytics-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-panel collection-analytics-panel granola-analytics-panel" role="dialog" aria-modal="true" aria-labelledby="granolaAnalyticsTitle">
                <div class="modal-header collection-analytics-modal-header granola-analytics-modal-header">
                    <div>
                        <span class="modal-kicker">Granola purchase intelligence</span>
                        <h3 id="granolaAnalyticsTitle">Yandex &amp; Glovo performance</h3>
                        <p id="granolaAnalyticsSubtitle">Clicks, product interest, and app launches over time.</p>
                    </div>
                    <button type="button" class="icon-button" data-close-granola-analytics aria-label="Close granola analytics">&times;</button>
                </div>
                <div id="granolaAnalyticsBody" class="collection-analytics-body granola-analytics-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal || event.target.closest('[data-close-granola-analytics]')) {
                this.closeGranolaAnalytics();
                return;
            }

            const rangeButton = event.target.closest('[data-granola-granularity]');
            if (rangeButton) {
                this.granolaGranularity = rangeButton.dataset.granolaGranularity || 'day';
                modal.querySelectorAll('[data-granola-granularity]').forEach((button) => {
                    button.classList.toggle('active', button === rangeButton);
                });
                this.drawGranolaAnalyticsChart();
            }
        });

        modal.addEventListener('change', (event) => {
            if (event.target.matches('[data-granola-series]')) this.drawGranolaAnalyticsChart();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.classList.contains('hidden')) this.closeGranolaAnalytics();
        });

        window.addEventListener('resize', () => {
            if (!modal.classList.contains('hidden')) this.drawGranolaAnalyticsChart();
        });
    }

    openGranolaAnalytics() {
        const modal = document.getElementById('granolaAnalyticsModal');
        const body = document.getElementById('granolaAnalyticsBody');
        if (!modal || !body) return;

        const summary = summarizeGranolaAnalytics(this.granolaAnalyticsEvents);
        const rangeLabel = this.rangeSelect?.selectedOptions?.[0]?.textContent?.trim() || 'selected period';
        this.granolaGranularity = 'day';
        document.getElementById('granolaAnalyticsSubtitle').textContent = `${rangeLabel} · Website clicks and app launches, grouped in Bishkek time.`;
        body.innerHTML = `
            <div class="collection-analytics-summary granola-modal-summary">
                ${this.renderCollectionMetric('All clicks', summary.totalClicks, 'Every tracked interaction', 'granola-total')}
                ${this.renderCollectionMetric('App launches', summary.launches, 'Product purchase buttons', 'granola-launch')}
                ${this.renderCollectionMetric('Provider choices', summary.selections, 'Yandex or Glovo selected')}
                ${this.renderCollectionMetric('Unique sessions', summary.uniqueSessions, 'Approximate visitors')}
                ${this.renderCollectionMetric('Products clicked', summary.productRows.length, 'Distinct product buttons')}
            </div>
            <section class="collection-chart-card granola-chart-card">
                <div class="collection-chart-toolbar">
                    <div>
                        <span class="eyebrow">Performance trend</span>
                        <h4>Delivery app engagement</h4>
                    </div>
                    <div class="collection-range-toggle granola-range-toggle" aria-label="Granola chart grouping">
                        ${['day', 'week', 'month', 'year'].map((range) => `<button type="button" data-granola-granularity="${range}" class="${range === 'day' ? 'active' : ''}">${range[0].toUpperCase() + range.slice(1)}</button>`).join('')}
                    </div>
                </div>
                <div class="collection-series-toggles granola-series-toggles" aria-label="Visible chart lines">
                    ${GRANOLA_ANALYTICS_SERIES.map((series) => `
                        <label style="--series-color:${series.color}">
                            <input type="checkbox" data-granola-series="${series.key}" checked>
                            <span></span>${escapeHtml(series.label)}
                        </label>
                    `).join('')}
                </div>
                <div class="collection-chart-wrap granola-chart-wrap">
                    <canvas id="granolaAnalyticsChart" height="340" role="img" aria-label="Line chart showing Yandex, Glovo, and provider selection clicks over time"></canvas>
                    <div id="granolaChartEmpty" class="collection-chart-empty" hidden>No granola clicks in this chart period yet.</div>
                </div>
                <p class="collection-chart-note">Day shows 30 days, week shows 12 weeks, month shows 12 months, and year shows 5 years. The Analytics date filter still applies.</p>
            </section>
            <section class="collection-product-breakdown granola-detail-card">
                <div>
                    <span class="eyebrow">Full click detail</span>
                    <h4>Channels, products, and recent activity</h4>
                </div>
                <div class="granola-breakdown-grid">
                    ${this.renderGranolaDataTable('Delivery apps', ['App', 'Choices', 'Launches', 'All clicks'], summary.providerRows.map((row) => [row.provider, number(row.selections), number(row.launches), number(row.total)]))}
                    ${this.renderGranolaDataTable('Recent activity', ['Date', 'Choices', 'Launches', 'All clicks'], summary.dailyRows.slice(0, 14).map((row) => [row.date, number(row.selections), number(row.launches), number(row.total)]))}
                    <div class="granola-product-table">
                        ${this.renderGranolaDataTable('Product buttons', ['Product', 'App', 'Clicks', 'Copied search'], summary.productRows.map((row) => [row.product, row.provider, number(row.clicks), row.search || '-']))}
                    </div>
                </div>
            </section>
        `;

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => this.drawGranolaAnalyticsChart());
        modal.querySelector('[data-close-granola-analytics]')?.focus();
    }

    closeGranolaAnalytics() {
        const modal = document.getElementById('granolaAnalyticsModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        this.granolaModalTrigger?.focus();
    }

    renderGranolaDataTable(title, headers, rows) {
        const tableRows = rows.length ? rows.map((row) => `
            <tr>${row.map((cell, index) => `<td>${index === 0 ? `<strong>${escapeHtml(cell)}</strong>` : escapeHtml(cell)}</td>`).join('')}</tr>
        `).join('') : `<tr><td colspan="${headers.length}">No tracked clicks yet.</td></tr>`;
        return `
            <div class="collection-product-table-wrap granola-data-table">
                <h5>${escapeHtml(title)}</h5>
                <table>
                    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    drawGranolaAnalyticsChart() {
        const canvas = document.getElementById('granolaAnalyticsChart');
        if (!canvas) return;

        const selectedSeries = [...document.querySelectorAll('#granolaAnalyticsModal [data-granola-series]:checked')].map((input) => input.dataset.granolaSeries);
        const timeline = buildGranolaTimeline(this.granolaAnalyticsEvents, this.granolaGranularity);
        const hasData = timeline.some((bucket) => selectedSeries.some((key) => bucket[key] > 0));
        const empty = document.getElementById('granolaChartEmpty');
        if (empty) empty.hidden = hasData;

        const cssWidth = Math.max(680, Math.round(canvas.parentElement?.clientWidth || 940));
        const cssHeight = 340;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = cssWidth * pixelRatio;
        canvas.height = cssHeight * pixelRatio;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const context = canvas.getContext('2d');
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);

        const padding = { top: 24, right: 28, bottom: 50, left: 48 };
        const chartWidth = cssWidth - padding.left - padding.right;
        const chartHeight = cssHeight - padding.top - padding.bottom;
        const maximum = Math.max(1, ...timeline.flatMap((bucket) => selectedSeries.map((key) => bucket[key] || 0)));
        const axisMaximum = maximum <= 5 ? 5 : Math.ceil(maximum / 5) * 5;

        context.font = '12px Inter, system-ui, sans-serif';
        context.textBaseline = 'middle';
        for (let grid = 0; grid <= 5; grid += 1) {
            const y = padding.top + (chartHeight * grid / 5);
            const value = Math.round(axisMaximum * (1 - grid / 5));
            context.strokeStyle = 'rgba(49, 92, 69, 0.12)';
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(padding.left, y);
            context.lineTo(cssWidth - padding.right, y);
            context.stroke();
            context.fillStyle = '#748078';
            context.textAlign = 'right';
            context.fillText(String(value), padding.left - 11, y);
        }

        const labelStep = Math.max(1, Math.ceil(timeline.length / 7));
        timeline.forEach((bucket, index) => {
            if (index % labelStep !== 0 && index !== timeline.length - 1) return;
            const x = padding.left + (timeline.length === 1 ? chartWidth / 2 : chartWidth * index / (timeline.length - 1));
            context.fillStyle = '#748078';
            context.textAlign = index === 0 ? 'left' : index === timeline.length - 1 ? 'right' : 'center';
            context.fillText(bucket.label, x, cssHeight - 22);
        });

        GRANOLA_ANALYTICS_SERIES.filter((series) => selectedSeries.includes(series.key)).forEach((series) => {
            const points = timeline.map((bucket, index) => ({
                value: bucket[series.key] || 0,
                x: padding.left + (timeline.length === 1 ? chartWidth / 2 : chartWidth * index / (timeline.length - 1)),
                y: padding.top + chartHeight - ((bucket[series.key] || 0) / axisMaximum) * chartHeight
            }));
            context.strokeStyle = series.color;
            context.lineWidth = series.key === 'providerSelections' ? 2.5 : 3.25;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.beginPath();
            points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
            context.stroke();

            points.filter((point) => point.value > 0).forEach((point) => {
                context.fillStyle = '#fff';
                context.strokeStyle = series.color;
                context.lineWidth = 2.5;
                context.beginPath();
                context.arc(point.x, point.y, 4.2, 0, Math.PI * 2);
                context.fill();
                context.stroke();
            });
        });
    }

    renderCollectionAnalyticsOverview(collections = [], events = []) {
        const rows = collections.map((collectionData) => {
            const collectionEvents = this.getEventsForCollection(collectionData, events);
            const summary = getCollectionSummary(collectionEvents);
            return { collectionData, summary };
        }).sort((first, second) => {
            const firstTotal = first.summary.collectionClicks + first.summary.visits + first.summary.productClicks + first.summary.glovoClicks;
            const secondTotal = second.summary.collectionClicks + second.summary.visits + second.summary.productClicks + second.summary.glovoClicks;
            return secondTotal - firstTotal || String(first.collectionData.name || '').localeCompare(String(second.collectionData.name || ''));
        });

        const body = rows.length ? rows.map(({ collectionData, summary }) => `
            <article class="collection-analytics-row">
                <div class="collection-analytics-name">
                    <span>${collectionData.active === false ? 'Inactive collection' : 'Collection'}</span>
                    <strong>${escapeHtml(collectionData.name || collectionData.slug || collectionData.id)}</strong>
                </div>
                <div class="collection-analytics-stat">
                    <span>Collection clicks</span>
                    <strong>${number(summary.collectionClicks)}</strong>
                </div>
                <div class="collection-analytics-stat">
                    <span>Product clicks</span>
                    <strong>${number(summary.productClicks)}</strong>
                </div>
                <div class="collection-analytics-stat glovo">
                    <span>Glovo clicks</span>
                    <strong>${number(summary.glovoClicks)}</strong>
                </div>
                <button type="button" class="btn-secondary collection-analytics-open" data-collection-analytics-id="${escapeHtml(collectionData.id)}">View analytics</button>
            </article>
        `).join('') : `
            <div class="collection-analytics-empty">
                <strong>No collections yet</strong>
                <span>Create a product collection and its activity will appear here.</span>
            </div>
        `;

        return `
            <section class="collection-analytics-overview" aria-labelledby="collectionAnalyticsHeading">
                <div class="collection-analytics-overview-header">
                    <div>
                        <span class="eyebrow">Collection Analytics</span>
                        <h4 id="collectionAnalyticsHeading">See what turns browsing into Glovo sales</h4>
                        <p>Collection visits, product interest, and every Buy Now on Glovo click are attributed here.</p>
                    </div>
                    <span class="collection-analytics-live-badge">Tracking live</span>
                </div>
                <div class="collection-analytics-list">${body}</div>
            </section>
        `;
    }

    bindCollectionAnalyticsOverview() {
        this.reportDiv?.querySelectorAll('[data-collection-analytics-id]').forEach((button) => {
            button.addEventListener('click', () => this.openCollectionAnalytics(button.dataset.collectionAnalyticsId));
        });
    }

    getEventsForCollection(collectionData, sourceEvents = this.collectionAnalyticsData.events) {
        const identities = new Set([String(collectionData?.id || ''), String(collectionData?.slug || '')].filter(Boolean));
        return (sourceEvents || []).filter((event) => identities.has(collectionEventIdentity(event)));
    }

    ensureCollectionAnalyticsModal() {
        if (document.getElementById('collectionAnalyticsModal')) return;
        const modal = document.createElement('div');
        modal.id = 'collectionAnalyticsModal';
        modal.className = 'modal hidden collection-analytics-modal';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-panel collection-analytics-panel" role="dialog" aria-modal="true" aria-labelledby="collectionAnalyticsTitle">
                <div class="modal-header collection-analytics-modal-header">
                    <div>
                        <span class="modal-kicker">Collection performance</span>
                        <h3 id="collectionAnalyticsTitle">Collection analytics</h3>
                        <p id="collectionAnalyticsSubtitle">Clicks and buying intent over time.</p>
                    </div>
                    <button type="button" class="icon-button" data-close-collection-analytics aria-label="Close collection analytics">&times;</button>
                </div>
                <div id="collectionAnalyticsBody" class="collection-analytics-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (event) => {
            if (event.target === modal || event.target.closest('[data-close-collection-analytics]')) {
                this.closeCollectionAnalytics();
                return;
            }

            const rangeButton = event.target.closest('[data-collection-granularity]');
            if (rangeButton) {
                this.collectionGranularity = rangeButton.dataset.collectionGranularity || 'day';
                modal.querySelectorAll('[data-collection-granularity]').forEach((button) => {
                    button.classList.toggle('active', button === rangeButton);
                });
                this.drawCollectionAnalyticsChart();
            }
        });

        modal.addEventListener('change', (event) => {
            if (event.target.matches('[data-collection-series]')) this.drawCollectionAnalyticsChart();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.classList.contains('hidden')) this.closeCollectionAnalytics();
        });
    }

    openCollectionAnalytics(collectionId) {
        const collectionData = this.collectionAnalyticsData.collections.find((item) => item.id === collectionId);
        const modal = document.getElementById('collectionAnalyticsModal');
        const body = document.getElementById('collectionAnalyticsBody');
        if (!collectionData || !modal || !body) return;

        this.activeCollectionId = collectionId;
        this.collectionGranularity = 'day';
        const collectionEvents = this.getEventsForCollection(collectionData);
        const summary = getCollectionSummary(collectionEvents);
        const productRows = getProductCollectionBreakdown(collectionEvents, this.collectionAnalyticsData.products);
        const buttonRows = this.getCollectionButtonBreakdown(collectionEvents);

        document.getElementById('collectionAnalyticsTitle').textContent = collectionData.name || collectionData.slug || 'Collection analytics';
        document.getElementById('collectionAnalyticsSubtitle').textContent = 'Track attention from the collection page through to external buying buttons.';
        body.innerHTML = `
            <div class="collection-analytics-summary">
                ${this.renderCollectionMetric('Collection link clicks', summary.collectionClicks, 'Homepage collection links')}
                ${this.renderCollectionMetric('Collection visits', summary.visits, 'Collection page loads')}
                ${this.renderCollectionMetric('Product clicks', summary.productClicks, 'Products explored')}
                ${this.renderCollectionMetric('Glovo clicks', summary.glovoClicks, 'Buy Now on Glovo', 'glovo')}
                ${this.renderCollectionMetric('Other buy clicks', summary.otherBuyClicks, 'Other external links')}
            </div>
            <section class="collection-chart-card">
                <div class="collection-chart-toolbar">
                    <div>
                        <span class="eyebrow">Click trend</span>
                        <h4>Engagement over time</h4>
                    </div>
                    <div class="collection-range-toggle" aria-label="Chart grouping">
                        ${['day', 'week', 'month', 'year'].map((range) => `<button type="button" data-collection-granularity="${range}" class="${range === 'day' ? 'active' : ''}">${range[0].toUpperCase() + range.slice(1)}</button>`).join('')}
                    </div>
                </div>
                <div class="collection-series-toggles" aria-label="Visible chart lines">
                    ${COLLECTION_ANALYTICS_SERIES.map((series) => `
                        <label style="--series-color:${series.color}">
                            <input type="checkbox" data-collection-series="${series.key}" checked>
                            <span></span>${escapeHtml(series.label)}
                        </label>
                    `).join('')}
                </div>
                <div class="collection-chart-wrap">
                    <canvas id="collectionAnalyticsChart" height="330" role="img" aria-label="Line chart showing collection clicks over time"></canvas>
                    <div id="collectionChartEmpty" class="collection-chart-empty" hidden>No tracked clicks in this period yet.</div>
                </div>
                <p class="collection-chart-note">Day shows 30 days, week shows 12 weeks, month shows 12 months, and year shows 5 years.</p>
            </section>
            <section class="collection-product-breakdown">
                <div>
                    <span class="eyebrow">Click detail</span>
                    <h4>Which products and buttons are getting clicked?</h4>
                </div>
                <div class="collection-breakdown-grid">
                    ${this.renderProductBreakdownTable(productRows)}
                    ${this.renderButtonBreakdownTable(buttonRows)}
                </div>
            </section>
        `;

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => this.drawCollectionAnalyticsChart());
        modal.querySelector('[data-close-collection-analytics]')?.focus();
    }

    closeCollectionAnalytics() {
        const modal = document.getElementById('collectionAnalyticsModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        this.activeCollectionId = '';
    }

    renderCollectionMetric(label, value, hint, tone = '') {
        return `
            <article class="collection-analytics-metric ${tone}">
                <span>${escapeHtml(label)}</span>
                <strong>${number(value)}</strong>
                <small>${escapeHtml(hint)}</small>
            </article>
        `;
    }

    renderProductBreakdownTable(rows) {
        const tableRows = rows.length ? rows.map((row) => `
            <tr>
                <td><strong>${escapeHtml(row.productName)}</strong><small>${escapeHtml(row.productId)}</small></td>
                <td>${number(row.productClicks)}</td>
                <td class="glovo-value">${number(row.glovoClicks)}</td>
                <td>${number(row.otherBuyClicks)}</td>
            </tr>
        `).join('') : '<tr><td colspan="4">No product clicks have been tracked for this collection yet.</td></tr>';

        return `
            <div class="collection-product-table-wrap">
                <h5>Products</h5>
                <table>
                    <thead><tr><th>Product</th><th>Product clicks</th><th>Glovo clicks</th><th>Other buy clicks</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    getCollectionButtonBreakdown(events) {
        const rows = new Map();
        events.forEach((event) => {
            if (event.analyticsSeries === 'visits') return;
            const typeLabel = ({
                collectionClicks: 'Collection link',
                productClicks: 'Product',
                glovoClicks: 'Glovo',
                otherBuyClicks: event.linkType || 'External link',
                linkCopies: 'Share'
            })[event.analyticsSeries] || 'Click';
            const buttonName = event.buttonName || event.linkLabel || event.source || typeLabel;
            const key = `${typeLabel}:${buttonName}`;
            if (!rows.has(key)) rows.set(key, { typeLabel, buttonName, clicks: 0 });
            rows.get(key).clicks += 1;
        });
        return [...rows.values()].sort((first, second) => second.clicks - first.clicks || first.buttonName.localeCompare(second.buttonName));
    }

    renderButtonBreakdownTable(rows) {
        const tableRows = rows.length ? rows.map((row) => `
            <tr>
                <td><strong>${escapeHtml(row.buttonName)}</strong><small>${escapeHtml(row.typeLabel)}</small></td>
                <td class="${row.typeLabel === 'Glovo' ? 'glovo-value' : ''}">${number(row.clicks)}</td>
            </tr>
        `).join('') : '<tr><td colspan="2">No button clicks have been tracked for this collection yet.</td></tr>';

        return `
            <div class="collection-product-table-wrap">
                <h5>Buttons</h5>
                <table>
                    <thead><tr><th>Button clicked</th><th>Clicks</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    drawCollectionAnalyticsChart() {
        const collectionData = this.collectionAnalyticsData.collections.find((item) => item.id === this.activeCollectionId);
        const canvas = document.getElementById('collectionAnalyticsChart');
        if (!collectionData || !canvas) return;

        const selectedSeries = [...document.querySelectorAll('#collectionAnalyticsModal [data-collection-series]:checked')].map((input) => input.dataset.collectionSeries);
        const timeline = buildCollectionTimeline(this.getEventsForCollection(collectionData), this.collectionGranularity);
        const hasData = timeline.some((bucket) => selectedSeries.some((key) => bucket[key] > 0));
        const empty = document.getElementById('collectionChartEmpty');
        if (empty) empty.hidden = hasData;

        const cssWidth = Math.max(640, Math.round(canvas.parentElement?.clientWidth || 900));
        const cssHeight = 330;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = cssWidth * pixelRatio;
        canvas.height = cssHeight * pixelRatio;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const context = canvas.getContext('2d');
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);

        const padding = { top: 22, right: 24, bottom: 48, left: 46 };
        const chartWidth = cssWidth - padding.left - padding.right;
        const chartHeight = cssHeight - padding.top - padding.bottom;
        const maximum = Math.max(1, ...timeline.flatMap((bucket) => selectedSeries.map((key) => bucket[key] || 0)));
        const axisMaximum = maximum <= 5 ? 5 : Math.ceil(maximum / 5) * 5;

        context.font = '12px Inter, system-ui, sans-serif';
        context.textBaseline = 'middle';
        for (let grid = 0; grid <= 5; grid += 1) {
            const y = padding.top + (chartHeight * grid / 5);
            const value = Math.round(axisMaximum * (1 - grid / 5));
            context.strokeStyle = '#e8eee9';
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(padding.left, y);
            context.lineTo(cssWidth - padding.right, y);
            context.stroke();
            context.fillStyle = '#718077';
            context.textAlign = 'right';
            context.fillText(String(value), padding.left - 10, y);
        }

        const labelStep = Math.max(1, Math.ceil(timeline.length / 7));
        timeline.forEach((bucket, index) => {
            if (index % labelStep !== 0 && index !== timeline.length - 1) return;
            const x = padding.left + (timeline.length === 1 ? chartWidth / 2 : chartWidth * index / (timeline.length - 1));
            context.fillStyle = '#718077';
            context.textAlign = index === 0 ? 'left' : index === timeline.length - 1 ? 'right' : 'center';
            context.fillText(bucket.label, x, cssHeight - 22);
        });

        COLLECTION_ANALYTICS_SERIES.filter((series) => selectedSeries.includes(series.key)).forEach((series) => {
            context.strokeStyle = series.color;
            context.fillStyle = series.color;
            context.lineWidth = series.key === 'glovoClicks' ? 3.5 : 2.5;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.beginPath();
            timeline.forEach((bucket, index) => {
                const x = padding.left + (timeline.length === 1 ? chartWidth / 2 : chartWidth * index / (timeline.length - 1));
                const y = padding.top + chartHeight - ((bucket[series.key] || 0) / axisMaximum) * chartHeight;
                if (index === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
            });
            context.stroke();

            timeline.forEach((bucket, index) => {
                if (!bucket[series.key]) return;
                const x = padding.left + (timeline.length === 1 ? chartWidth / 2 : chartWidth * index / (timeline.length - 1));
                const y = padding.top + chartHeight - (bucket[series.key] / axisMaximum) * chartHeight;
                context.beginPath();
                context.arc(x, y, series.key === 'glovoClicks' ? 4 : 3, 0, Math.PI * 2);
                context.fill();
            });
        });
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
