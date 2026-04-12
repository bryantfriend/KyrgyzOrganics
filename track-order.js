import { db, functions, httpsCallable } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initMobileMenu, setupLanguage, t } from './common.js';
import { formatPrice } from './shop-utils.js';
import { COMPANY_ID } from './company-config.js';

const root = document.getElementById('orderTrackingRoot');
const whatsAppSupportBtn = document.getElementById('whatsAppSupportBtn');

const STATUS_TEXT = {
    pending_payment: 'Awaiting payment',
    pending_verification: 'Payment submitted',
    paid: 'Payment verified',
    preparing: 'Preparing your order',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
};

async function init() {
    setupLanguage();
    initMobileMenu();
    updateWhatsAppSupportButton();

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId') || '';
    const token = params.get('token') || '';

    if (!orderId || !token) {
        renderError('Missing order link details.');
        return;
    }

    try {
        const getOrderStatus = httpsCallable(functions, 'getOrderStatus');
        const result = await getOrderStatus({ orderId, orderToken: token });
        renderOrder(result.data);
    } catch (error) {
        console.error(error);
        renderError(error.message || 'We could not load this order.');
    }
}

async function updateWhatsAppSupportButton() {
    if (!whatsAppSupportBtn) return;

    try {
        const snap = await getDoc(doc(db, 'shop_settings', 'checkout'));
        const data = snap.exists() ? snap.data() : {};
        if (data.companyId && data.companyId !== COMPANY_ID) {
            console.warn('Checkout settings companyId mismatch');
            whatsAppSupportBtn.hidden = true;
            return;
        }
        if (snap.exists() && !data.companyId) console.warn('Checkout settings missing companyId');
        const phone = String(data.supportWhatsappNumber || '').replace(/[^\d]/g, '');

        if (!phone) {
            whatsAppSupportBtn.hidden = true;
            return;
        }

        const message = encodeURIComponent('Hello, I need help with my order.');
        whatsAppSupportBtn.href = `https://wa.me/${phone}?text=${message}`;
        whatsAppSupportBtn.textContent = t('contact_support_whatsapp');
        whatsAppSupportBtn.hidden = false;
    } catch (error) {
        console.warn('WhatsApp support button unavailable:', error);
        whatsAppSupportBtn.hidden = true;
    }
}

function renderError(message) {
    root.innerHTML = `
        <div class="order-tracking-layout">
            <div class="order-summary-panel">
                <a href="index.html" class="text-link-inline">${t('back_to_catalog')}</a>
                <h1 class="section-title" style="margin-top:1rem;">Track Order</h1>
                <p>${message}</p>
            </div>
        </div>
    `;
}

function renderOrder(order) {
    const statusText = STATUS_TEXT[order.status] || order.status;
    const createdAt = formatDateTime(order.createdAtMillis);
    const trackingSteps = (order.trackingEvents || []).map((event) => `
        <div class="tracking-step ${event.completed ? 'is-complete' : ''}">
            <div class="tracking-step-dot"></div>
            <div>
                <div class="tracking-step-title">${event.label}</div>
                <div class="tracking-step-time">${formatDateTime(event.atMillis) || 'Waiting'}</div>
            </div>
        </div>
    `).join('');

    const itemsHtml = (order.items || []).map((item) => `
        <article class="tracking-item">
            <img src="${item.imageUrl || 'https://placehold.co/120x120'}" alt="${item.name}">
            <div>
                <div class="tracking-item-title">${item.name}</div>
                <div class="tracking-item-meta">${item.weight || ''}</div>
                <div class="tracking-item-meta">${item.quantity} x ${formatPrice(item.unitPrice)} ${t('price_currency')}</div>
            </div>
            <div class="tracking-item-price">${formatPrice(item.lineTotal)} ${t('price_currency')}</div>
        </article>
    `).join('');

    root.innerHTML = `
        <div class="order-tracking-layout">
            <section class="order-summary-panel">
                <a href="index.html" class="text-link-inline">${t('back_to_catalog')}</a>
                <div class="order-summary-top">
                    <div>
                        <p class="tracking-eyebrow">Order Tracking</p>
                        <h1 class="product-page-title" style="margin-bottom:0.5rem;">Order #${order.orderId}</h1>
                        <p class="tracking-muted">Placed ${createdAt || 'recently'}</p>
                    </div>
                    <span class="tracking-status-pill status-${order.status}">${statusText}</span>
                </div>

                <div class="cart-summary-card" style="margin-top:1rem;">
                    <div class="cart-summary-row">
                        <span>${t('subtotal')}</span>
                        <strong>${formatPrice(order.subtotal)} ${t('price_currency')}</strong>
                    </div>
                    <div class="cart-summary-row">
                        <span>${t('delivery_fee')}</span>
                        <strong>${order.deliveryFee === 0 ? t('free_delivery') : `${formatPrice(order.deliveryFee)} ${t('price_currency')}`}</strong>
                    </div>
                    <div class="cart-summary-row total">
                        <span>${t('total')}</span>
                        <strong>${formatPrice(order.total)} ${t('price_currency')}</strong>
                    </div>
                </div>

                <div class="tracking-customer-grid">
                    <div class="tracking-detail-card">
                        <div class="tracking-detail-label">Customer</div>
                        <div>${order.customerName || 'Guest'}</div>
                        <div>${order.customerPhone || ''}</div>
                    </div>
                    <div class="tracking-detail-card">
                        <div class="tracking-detail-label">${order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</div>
                        <div>${order.deliveryMethod === 'pickup' ? 'Pickup order' : (order.customerAddress || 'Address not provided')}</div>
                    </div>
                </div>

                <div class="tracking-panel">
                    <div class="tracking-panel-title">${t('order_items')}</div>
                    <div class="tracking-items">${itemsHtml}</div>
                </div>
            </section>

            <aside class="tracking-panel">
                <div class="tracking-panel-title">Status Timeline</div>
                <div class="tracking-steps">${trackingSteps}</div>
                <button type="button" id="refreshOrderStatusBtn" class="secondary-pill" style="margin-top:1rem; width:100%;">Refresh Status</button>
            </aside>
        </div>
    `;

    const refreshBtn = document.getElementById('refreshOrderStatusBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => window.location.reload());
    }
}

function formatDateTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString();
}

init();
