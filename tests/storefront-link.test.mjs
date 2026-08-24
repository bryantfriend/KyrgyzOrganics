import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getStorePublicUrl } from '../admin/storefront-link.js';

const ORIGIN = 'https://oako.kg';

test('uses the query-string route supported by the production host', () => {
  assert.equal(
    getStorePublicUrl({}, 'jamelias-kitchen-kg', ORIGIN),
    'https://oako.kg/?company=jamelias-kitchen-kg'
  );
});

test('adds preview mode for stores that are not marked live', () => {
  assert.equal(
    getStorePublicUrl({ launchStatus: 'active' }, 'jamelias-kitchen-kg', ORIGIN),
    'https://oako.kg/?company=jamelias-kitchen-kg&preview=1'
  );
});

test('prefers an explicit preview URL for a non-live store', () => {
  assert.equal(
    getStorePublicUrl({ launchStatus: 'draft', previewUrl: '/?company=demo&preview=1' }, 'demo', ORIGIN),
    'https://oako.kg/?company=demo&preview=1'
  );
});

test('keeps the default storefront at the site root', () => {
  assert.equal(getStorePublicUrl({}, 'kyrgyz-organics', ORIGIN), 'https://oako.kg/');
});
