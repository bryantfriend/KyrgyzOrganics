export const COLLECTION_ANALYTICS_SERIES = [
    { key: 'collectionClicks', label: 'Collection link clicks', color: '#174a35' },
    { key: 'visits', label: 'Collection visits', color: '#315c45' },
    { key: 'productClicks', label: 'Product clicks', color: '#d2932c' },
    { key: 'glovoClicks', label: 'Buy Now on Glovo', color: '#f6c344' },
    { key: 'otherBuyClicks', label: 'Other buy buttons', color: '#6f8fb7' },
    { key: 'linkCopies', label: 'Link copies', color: '#a56cc1' }
];

const BISHKEK_OFFSET_MS = 6 * 60 * 60 * 1000;

export function analyticsDate(value) {
    if (!value) return null;
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

export function classifyCollectionEvent(event) {
    const actionType = event?.actionType || event?.eventType || event?.type || '';
    if (actionType === 'collection_open_click') return 'collectionClicks';
    if (actionType === 'collection_page_view') return 'visits';
    if (actionType === 'collection_product_click') return 'productClicks';
    if (actionType === 'collection_copy_link_click') return 'linkCopies';
    if (actionType === 'product_external_link_click') {
        return String(event?.linkType || '').toLowerCase() === 'glovo' ? 'glovoClicks' : 'otherBuyClicks';
    }
    return '';
}

export function collectionEventIdentity(event) {
    return String(event?.collectionId || event?.collectionSlug || '').trim();
}

export function getCollectionEvents(storefrontEvents = [], campaignEvents = []) {
    return [...storefrontEvents, ...campaignEvents]
        .map((event) => ({
            ...event,
            analyticsSeries: classifyCollectionEvent(event),
            analyticsDate: analyticsDate(event.createdAt || event.timestamp)
        }))
        .filter((event) => event.analyticsSeries && collectionEventIdentity(event));
}

export function getCollectionSummary(events = []) {
    return events.reduce((summary, event) => {
        if (event.analyticsSeries && Object.prototype.hasOwnProperty.call(summary, event.analyticsSeries)) {
            summary[event.analyticsSeries] += 1;
        }
        return summary;
    }, {
        collectionClicks: 0,
        visits: 0,
        productClicks: 0,
        glovoClicks: 0,
        otherBuyClicks: 0,
        linkCopies: 0
    });
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

export function buildCollectionTimeline(events = [], granularity = 'day', now = new Date()) {
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
            collectionClicks: 0,
            visits: 0,
            productClicks: 0,
            glovoClicks: 0,
            otherBuyClicks: 0,
            linkCopies: 0
        };
        buckets.push(bucket);
        bucketByKey.set(bucket.key, bucket);
    }

    events.forEach((event) => {
        const date = event.analyticsDate || analyticsDate(event.createdAt || event.timestamp);
        if (!date || !event.analyticsSeries) return;
        const bishkekDate = new Date(date.getTime() + BISHKEK_OFFSET_MS);
        const bucket = bucketByKey.get(periodKey(periodStart(bishkekDate, selected), selected));
        if (bucket && Object.prototype.hasOwnProperty.call(bucket, event.analyticsSeries)) {
            bucket[event.analyticsSeries] += 1;
        }
    });

    return buckets;
}

export function getProductCollectionBreakdown(events = [], products = []) {
    const productById = new Map(products.map((product) => [String(product.id), product]));
    const rows = new Map();

    events.forEach((event) => {
        const productId = String(event.productId || event.actionValue || '').trim();
        if (!productId || !['productClicks', 'glovoClicks', 'otherBuyClicks'].includes(event.analyticsSeries)) return;
        const product = productById.get(productId) || {};
        if (!rows.has(productId)) {
            rows.set(productId, {
                productId,
                productName: event.productName || product.name_en || product.name_ru || product.name || productId,
                productClicks: 0,
                glovoClicks: 0,
                otherBuyClicks: 0
            });
        }
        rows.get(productId)[event.analyticsSeries] += 1;
    });

    return [...rows.values()].sort((first, second) => {
        const firstTotal = first.productClicks + first.glovoClicks + first.otherBuyClicks;
        const secondTotal = second.productClicks + second.glovoClicks + second.otherBuyClicks;
        return secondTotal - firstTotal || first.productName.localeCompare(second.productName);
    });
}
