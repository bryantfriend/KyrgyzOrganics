import assert from 'node:assert/strict';
import {
  buildCollectionTimeline,
  classifyCollectionEvent,
  getCollectionEvents,
  getCollectionSummary,
  getProductCollectionBreakdown
} from '../collection-analytics.mjs';

assert.equal(classifyCollectionEvent({ actionType: 'collection_open_click' }), 'collectionClicks');
assert.equal(classifyCollectionEvent({ actionType: 'collection_page_view' }), 'visits');
assert.equal(classifyCollectionEvent({ actionType: 'collection_product_click' }), 'productClicks');
assert.equal(classifyCollectionEvent({ actionType: 'product_external_link_click', linkType: 'glovo' }), 'glovoClicks');
assert.equal(classifyCollectionEvent({ actionType: 'product_external_link_click', linkType: 'website' }), 'otherBuyClicks');

const events = getCollectionEvents([
  {
    actionType: 'collection_open_click',
    collectionId: 'breakfast',
    createdAt: '2026-08-19T08:00:00.000Z'
  },
  {
    actionType: 'collection_page_view',
    collectionId: 'breakfast',
    createdAt: '2026-08-19T08:00:01.000Z'
  },
  {
    actionType: 'collection_product_click',
    collectionId: 'breakfast',
    productId: 'granola-light',
    productName: 'Granola Light',
    createdAt: '2026-08-19T08:01:00.000Z'
  }
], [
  {
    actionType: 'product_external_link_click',
    collectionId: 'breakfast',
    productId: 'granola-light',
    productName: 'Granola Light',
    linkType: 'glovo',
    createdAt: '2026-08-19T08:02:00.000Z'
  },
  {
    actionType: 'product_external_link_click',
    productId: 'not-attributed',
    linkType: 'glovo',
    createdAt: '2026-08-19T08:03:00.000Z'
  }
]);

assert.equal(events.length, 4, 'external clicks without collection context are excluded');
assert.deepEqual(getCollectionSummary(events), {
  collectionClicks: 1,
  visits: 1,
  productClicks: 1,
  glovoClicks: 1,
  otherBuyClicks: 0,
  linkCopies: 0
});

const daily = buildCollectionTimeline(events, 'day', new Date('2026-08-20T12:00:00.000Z'));
assert.equal(daily.length, 30);
assert.equal(daily.at(-2).key, '2026-08-19');
assert.equal(daily.at(-2).collectionClicks, 1);
assert.equal(daily.at(-2).glovoClicks, 1);

const aroundMidnight = getCollectionEvents([{
  actionType: 'collection_page_view',
  collectionId: 'breakfast',
  createdAt: '2026-08-19T20:30:00.000Z'
}], []);
const bishkekDaily = buildCollectionTimeline(aroundMidnight, 'day', new Date('2026-08-20T12:00:00.000Z'));
assert.equal(bishkekDaily.at(-1).visits, 1, 'daily buckets use Bishkek time');

assert.deepEqual(getProductCollectionBreakdown(events, []), [{
  productId: 'granola-light',
  productName: 'Granola Light',
  productClicks: 1,
  glovoClicks: 1,
  otherBuyClicks: 0
}]);

console.log('collection analytics tests passed');
