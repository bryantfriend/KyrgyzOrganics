export const GRANOLA_PROVIDER_SELECT = 'granola_provider_select';
export const GRANOLA_PURCHASE_CLICK = 'granola_purchase_click';
export const GRANOLA_ANALYTICS_SERIES = [
    { key: 'yandexLaunches', label: 'Yandex launches', color: '#e9b000' },
    { key: 'glovoLaunches', label: 'Glovo launches', color: '#ff5f52' },
    { key: 'providerSelections', label: 'Provider choices', color: '#315c45' }
];

const TRACKED_ACTIONS = new Set([GRANOLA_PROVIDER_SELECT, GRANOLA_PURCHASE_CLICK]);
const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;

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

function analyticsDate(value) {
    if (!value) return null;
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function startOfUtcWeek(date) {
    const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
    const weekday = result.getUTCDay() || 7;
    result.setUTCDate(result.getUTCDate() - weekday + 1);
    return result;
}

function periodStart(date, granularity) {
    if (granularity === 'year') return new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12));
    if (granularity === 'month') return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
    if (granularity === 'week') return startOfUtcWeek(date);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
}

function addPeriod(date, granularity, amount) {
    const result = new Date(date);
    if (granularity === 'year') result.setUTCFullYear(result.getUTCFullYear() + amount);
    else if (granularity === 'month') result.setUTCMonth(result.getUTCMonth() + amount);
    else result.setUTCDate(result.getUTCDate() + amount * (granularity === 'week' ? 7 : 1));
    return result;
}

function periodKey(date, granularity) {
    if (granularity === 'year') return String(date.getUTCFullYear());
    if (granularity === 'month') return date.toISOString().slice(0, 7);
    return date.toISOString().slice(0, 10);
}

function periodLabel(date, granularity) {
    if (granularity === 'year') return String(date.getUTCFullYear());
    if (granularity === 'month') return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
    if (granularity === 'week') return `Wk ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)}`;
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export function isGranolaAnalyticsEvent(event) {
    return TRACKED_ACTIONS.has(clean(event?.actionType || event?.type));
}

export function buildGranolaTimeline(sourceEvents = [], granularity = 'day', now = new Date()) {
    const supported = ['day', 'week', 'month', 'year'];
    const selected = supported.includes(granularity) ? granularity : 'day';
    const periodCount = { day: 30, week: 12, month: 12, year: 5 }[selected];
    const currentStart = periodStart(new Date(now.getTime() + BISHKEK_OFFSET_MS), selected);
    const firstStart = addPeriod(currentStart, selected, -(periodCount - 1));
    const buckets = [];
    const bucketByKey = new Map();

    for (let index = 0; index < periodCount; index += 1) {
        const date = addPeriod(firstStart, selected, index);
        const bucket = {
            key: periodKey(date, selected),
            label: periodLabel(date, selected),
            yandexLaunches: 0,
            glovoLaunches: 0,
            providerSelections: 0,
            totalClicks: 0
        };
        buckets.push(bucket);
        bucketByKey.set(bucket.key, bucket);
    }

    sourceEvents.filter(isGranolaAnalyticsEvent).forEach((event) => {
        const date = analyticsDate(event.createdAt || event.timestamp);
        if (!date) return;
        const bishkekDate = new Date(date.getTime() + BISHKEK_OFFSET_MS);
        const bucket = bucketByKey.get(periodKey(periodStart(bishkekDate, selected), selected));
        if (!bucket) return;

        bucket.totalClicks += 1;
        const action = clean(event.actionType || event.type);
        if (action === GRANOLA_PROVIDER_SELECT) {
            bucket.providerSelections += 1;
        } else if (clean(event.platform).toLowerCase() === 'yandex') {
            bucket.yandexLaunches += 1;
        } else if (clean(event.platform).toLowerCase() === 'glovo') {
            bucket.glovoLaunches += 1;
        }
    });

    return buckets;
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
