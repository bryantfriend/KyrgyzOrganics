import { db } from '../firebase-config.js';
import {
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { normalizeOrderStatus, STATUS_LABELS } from '../services/orderActions.js';
import { formatTimeRemaining, getEstimatedMinutes } from '../utils/timeUtils.js';

const STATUS_PROGRESS = {
    new: 10,
    accepted: 25,
    preparing: 50,
    ready: 70,
    delivery: 90,
    completed: 100,
    cancelled: 100
};

const STEPS = [
    ['new', 'Order Received'],
    ['preparing', 'Preparing'],
    ['ready', 'Ready'],
    ['delivery', 'Out for Delivery'],
    ['completed', 'Completed']
];

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('orderId') || params.get('id');
    if (queryId) return queryId;

    const hashId = window.location.hash.replace(/^#\/?/, '').trim();
    if (hashId) return hashId;

    const segments = window.location.pathname.split('/').filter(Boolean);
    const trackIndex = segments.findIndex((segment) => segment === 'track');
    return trackIndex >= 0 ? segments[trackIndex + 1] : '';
}

function getStepState(stepStatus, currentStatus) {
    const currentProgress = STATUS_PROGRESS[currentStatus] || 0;
    const stepProgress = STATUS_PROGRESS[stepStatus] || 0;
    if (currentStatus === 'cancelled') return 'pending';
    if (currentProgress > stepProgress) return 'done';
    if (currentProgress === stepProgress) return 'current';
    return 'pending';
}

function renderOrder(orderId, order) {
    const root = document.getElementById('trackingRoot');
    const status = normalizeOrderStatus(order.status, order);
    const progress = STATUS_PROGRESS[status] || 10;
    const total = Number(order.total ?? order.price ?? 0);
    const items = Array.isArray(order.items) && order.items.length
        ? order.items.map((item) => `${Number(item.quantity || 1)} x ${item.name_en || item.name_ru || item.name_kg || item.productName || item.productId || 'Item'}`).join(', ')
        : order.productName || order.productId || 'Your order';

    root.innerHTML = `
        <div class="tracking-header">
            <span class="tracking-live-dot">Live</span>
            <p>Order #${escapeHtml(orderId.slice(0, 10))}</p>
            <h1>${escapeHtml(STATUS_LABELS[status] || status)}</h1>
            <p>${status === 'completed' ? 'Your order is complete.' : `Estimated time: ${getEstimatedMinutes(order)} minutes • ${formatTimeRemaining(order)}`}</p>
        </div>

        <div class="tracking-progress">
            <div class="tracking-progress-fill" style="width:${progress}%"></div>
        </div>

        <div class="tracking-steps">
            ${STEPS.map(([stepStatus, label]) => `
                <div class="tracking-step ${getStepState(stepStatus, status)}">
                    <span></span>
                    <strong>${escapeHtml(label)}</strong>
                </div>
            `).join('')}
        </div>

        <div class="tracking-details">
            <div>
                <small>Items</small>
                <strong>${escapeHtml(items)}</strong>
            </div>
            <div>
                <small>Total</small>
                <strong>${Number.isFinite(total) ? total : 0} som</strong>
            </div>
            <div>
                <small>Customer</small>
                <strong>${escapeHtml(order.customerName || 'Guest')}</strong>
            </div>
        </div>
    `;
}

function renderError(message) {
    const root = document.getElementById('trackingRoot');
    root.innerHTML = `
        <div class="tracking-header">
            <span class="tracking-live-dot error">Offline</span>
            <h1>Order unavailable</h1>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

const orderId = getOrderIdFromUrl();

if (!orderId) {
    renderError('Missing order number. Please scan the QR code again or ask the store for a new link.');
} else {
    let activeOrder = null;
    let archivedOrder = null;

    const renderBestAvailableOrder = () => {
        if (activeOrder) {
            renderOrder(orderId, activeOrder);
            return;
        }
        if (archivedOrder) {
            renderOrder(orderId, archivedOrder);
            return;
        }
        renderError('We could not find this order yet.');
    };

    onSnapshot(
        doc(db, 'orders', orderId),
        (snapshot) => {
            activeOrder = snapshot.exists() ? snapshot.data() : null;
            renderBestAvailableOrder();
        },
        (error) => {
            console.warn('Active tracking listener failed:', error);
            renderError('Live tracking could not connect. Please refresh in a moment.');
        }
    );

    onSnapshot(
        doc(db, 'orders_archive', orderId),
        (snapshot) => {
            archivedOrder = snapshot.exists() ? snapshot.data() : null;
            renderBestAvailableOrder();
        },
        (error) => {
            console.warn('Archived tracking listener failed:', error);
        }
    );
}
