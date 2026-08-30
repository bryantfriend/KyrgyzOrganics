export const GRANOLA_PROVIDER_SELECT = 'granola_provider_select';
export const GRANOLA_PURCHASE_CLICK = 'granola_purchase_click';

const TRACKED_ACTIONS = new Set([GRANOLA_PROVIDER_SELECT, GRANOLA_PURCHASE_CLICK]);

function clean(value, fallback = '') {
    return String(value ?? fallback).trim();
}

function providerLabel(value) {
    const provider = clean(value).toLowerCase();
    if (provider === 'yandex') return 'Yandex Go';
    if (provider === 'glovo') return 'Glovo';
    return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
}

function eventDateId(event) {
    if (event?.dayId) return clean(event.dayId);
    const value = event?.createdAt || event?.timestamp;
    if (!value) return 'Unknown';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.toISOString().slice(0, 10)
        : 'Unknown';
}

function increment(map, key, seed) {
    if (!map.has(key)) map.set(key, seed());
    return map.get(key);
}

export function isGranolaAnalyticsEvent(event) {
    return TRACKED_ACTIONS.has(clean(event?.actionType || event?.type));
}

export function summarizeGranolaAnalytics(sourceEvents = []) {
    const events = sourceEvents.filter(isGranolaAnalyticsEvent);
    const sessions = new Set();
    const providers = new Map();
    const products = new Map();
    const days = new Map();
    let selections = 0;
    let launches = 0;

    events.forEach((event) => {
        const action = clean(event.actionType || event.type);
        const providerKey = clean(event.platform, 'unknown').toLowerCase();
        const provider = increment(providers, providerKey, () => ({
            provider: providerLabel(providerKey),
            selections: 0,
            launches: 0,
            total: 0
        }));
        const dayId = eventDateId(event);
        const day = increment(days, dayId, () => ({ date: dayId, selections: 0, launches: 0, total: 0 }));
        const sessionId = clean(event.sessionId);
        if (sessionId) sessions.add(sessionId);

        provider.total += 1;
        day.total += 1;
        if (action === GRANOLA_PROVIDER_SELECT) {
            selections += 1;
            provider.selections += 1;
            day.selections += 1;
            return;
        }

        launches += 1;
        provider.launches += 1;
        day.launches += 1;
        const productId = clean(event.productId, 'unknown');
        const label = clean(event.label || event.productName, productId || 'Product');
        const productKey = `${providerKey}:${productId}:${label}`;
        const product = increment(products, productKey, () => ({
            productId,
            product: label,
            provider: providerLabel(providerKey),
            search: clean(event.code),
            clicks: 0
        }));
        product.clicks += 1;
    });

    return {
        totalClicks: events.length,
        selections,
        launches,
        uniqueSessions: sessions.size,
        providerRows: [...providers.values()].sort((a, b) => b.total - a.total || a.provider.localeCompare(b.provider)),
        productRows: [...products.values()].sort((a, b) => b.clicks - a.clicks || a.product.localeCompare(b.product)),
        dailyRows: [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
    };
}
