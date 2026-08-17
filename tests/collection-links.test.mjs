import assert from 'node:assert/strict';
import { setCompanyId } from '../company-config.js';
import { buildCollectionPageUrl } from '../product-utils.js';

setCompanyId('kyrgyz-organics');
assert.equal(
  buildCollectionPageUrl({ id: 'collection-1', slug: 'best-sellers' }),
  '/collection.html?slug=best-sellers'
);
assert.equal(
  buildCollectionPageUrl({ id: 'collection-1' }),
  '/collection.html?id=collection-1'
);

setCompanyId('dailybread');
assert.equal(
  buildCollectionPageUrl({ id: 'collection-2', slug: 'breakfast' }),
  '/collection.html?slug=breakfast&company=dailybread'
);

console.log('collection link tests passed');
