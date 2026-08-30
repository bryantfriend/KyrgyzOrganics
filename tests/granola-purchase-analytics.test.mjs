import assert from 'node:assert/strict';
import {
    buildGranolaTimeline,
    GRANOLA_PROVIDER_SELECT,
    GRANOLA_PURCHASE_CLICK,
    isGranolaAnalyticsEvent,
    summarizeGranolaAnalytics
} from '../granola-purchase-analytics.mjs';

const events = [
    { actionType: GRANOLA_PROVIDER_SELECT, platform: 'glovo', sessionId: 'a', dayId: '2026-08-30' },
    { actionType: GRANOLA_PURCHASE_CLICK, platform: 'glovo', sessionId: 'a', dayId: '2026-08-30', productId: 'nuts-500', label: 'Nut Paradise · 500 g', code: 'Organic granola' },
    { actionType: GRANOLA_PURCHASE_CLICK, platform: 'glovo', sessionId: 'b', dayId: '2026-08-30', productId: 'nuts-500', label: 'Nut Paradise · 500 g', code: 'Organic granola' },
    { actionType: GRANOLA_PROVIDER_SELECT, platform: 'yandex', sessionId: 'b', dayId: '2026-08-29' },
    { actionType: GRANOLA_PURCHASE_CLICK, platform: 'yandex', sessionId: 'b', dayId: '2026-08-29', productId: 'honey-nuts', label: 'Honey and Nuts', code: 'Kyrgyz Organic гранола обжаренная с медом и орехами' },
    { actionType: 'qr_click', platform: 'glovo', sessionId: 'ignored' }
];

assert.equal(isGranolaAnalyticsEvent(events[0]), true);
assert.equal(isGranolaAnalyticsEvent(events.at(-1)), false);

const summary = summarizeGranolaAnalytics(events);
assert.equal(summary.totalClicks, 5);
assert.equal(summary.selections, 2);
assert.equal(summary.launches, 3);
assert.equal(summary.uniqueSessions, 2);
assert.deepEqual(summary.providerRows, [
    { provider: 'Glovo', selections: 1, launches: 2, total: 3 },
    { provider: 'Yandex Go', selections: 1, launches: 1, total: 2 }
]);
assert.equal(summary.productRows[0].product, 'Nut Paradise · 500 g');
assert.equal(summary.productRows[0].clicks, 2);
assert.deepEqual(summary.dailyRows, [
    { date: '2026-08-30', selections: 1, launches: 2, total: 3 },
    { date: '2026-08-29', selections: 1, launches: 1, total: 2 }
]);

const timelineEvents = [
    { actionType: GRANOLA_PROVIDER_SELECT, platform: 'glovo', timestamp: '2026-08-30T04:00:00.000Z' },
    { actionType: GRANOLA_PURCHASE_CLICK, platform: 'glovo', timestamp: '2026-08-30T05:00:00.000Z' },
    { actionType: GRANOLA_PURCHASE_CLICK, platform: 'yandex', timestamp: '2026-08-23T05:00:00.000Z' },
    { actionType: 'qr_click', platform: 'yandex', timestamp: '2026-08-30T05:00:00.000Z' }
];
const dailyTimeline = buildGranolaTimeline(timelineEvents, 'day', new Date('2026-08-30T06:00:00.000Z'));
assert.equal(dailyTimeline.length, 30);
assert.deepEqual(dailyTimeline.at(-1), {
    key: '2026-08-30',
    label: 'Aug 30',
    yandexLaunches: 0,
    glovoLaunches: 1,
    providerSelections: 1,
    totalClicks: 2
});
const weeklyTimeline = buildGranolaTimeline(timelineEvents, 'week', new Date('2026-08-30T06:00:00.000Z'));
assert.equal(weeklyTimeline.length, 12);
assert.equal(weeklyTimeline.reduce((total, bucket) => total + bucket.totalClicks, 0), 3);

console.log('granola purchase analytics tests passed');
