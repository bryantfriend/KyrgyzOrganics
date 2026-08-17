import assert from 'node:assert/strict';
import {
  getProductExternalLinkCtaLabel,
  getProductExternalLinks,
  normalizeProductExternalLinks,
  validateProductExternalLinkInput
} from '../product-external-links.mjs';

function validLink(overrides = {}) {
  return {
    type: 'whatsapp',
    label: 'Order on WhatsApp',
    url: 'https://wa.me/996555123456',
    isEnabled: true,
    sortOrder: 1,
    ...overrides
  };
}

function assertValid(overrides) {
  const result = validateProductExternalLinkInput(validLink(overrides));
  assert.equal(result.ok, true, result.errors.join(', '));
}

function assertInvalid(overrides) {
  const result = validateProductExternalLinkInput(validLink(overrides));
  assert.equal(result.ok, false, 'Expected invalid link');
}

assertValid({ url: 'https://example.com/order' });
assertValid({ url: 'http://example.com/order' });
assertValid({ type: 'optima_payda', label: 'Pay with Optima PayDa!', url: 'https://pay.optima.kg/order/abc' });
assertInvalid({ url: '' });
assertInvalid({ label: '' });
assertInvalid({ type: '' });
assertInvalid({ type: 'unsupported' });
assertInvalid({ url: 'javascript:alert(1)' });
assertInvalid({ url: 'data:text/html,hello' });
assertInvalid({ url: 'file:///tmp/order' });
assertInvalid({ url: 'vbscript:msgbox(1)' });

assert.equal(
  getProductExternalLinkCtaLabel(validLink({ type: 'glovo', label: 'Order on Glovo' })),
  'Buy now through Glovo'
);
assert.equal(
  getProductExternalLinkCtaLabel(validLink({ type: 'other', label: 'Order on Wildberries' })),
  'Buy now through Wildberries'
);
assert.equal(
  getProductExternalLinkCtaLabel(validLink({ type: 'other', label: '', url: 'https://shop.example.com/item' })),
  'Buy now through shop.example.com'
);
assert.equal(
  getProductExternalLinkCtaLabel(validLink({ type: 'map', label: 'View stockists' })),
  'View stockists'
);

assert.deepEqual(normalizeProductExternalLinks({ id: 'p1' }), []);

const productWithLinks = {
  externalLinks: [
    validLink({ id: 'b', type: 'telegram', label: 'Telegram', url: 'https://t.me/store', isEnabled: false, sortOrder: 2 }),
    validLink({ id: 'a', type: 'glovo', label: 'Glovo', url: 'https://glovoapp.com/store', isEnabled: true, sortOrder: 1 })
  ]
};

const normalized = normalizeProductExternalLinks(productWithLinks);
assert.equal(normalized.length, 2);
assert.equal(normalized[0].id, 'a');
assert.equal(normalized[1].id, 'b');

const publicLinks = getProductExternalLinks(productWithLinks);
assert.equal(publicLinks.length, 1);
assert.equal(publicLinks[0].id, 'a');

const legacyProduct = {
  externalLinks: {
    glovo: { enabled: true, url: 'https://glovoapp.com/store', label: 'Order on Glovo' },
    map: { enabled: false, url: 'https://maps.google.com/?q=oako', label: 'Map' }
  }
};

assert.equal(normalizeProductExternalLinks(legacyProduct).length, 2);
assert.equal(getProductExternalLinks(legacyProduct).length, 1);

console.log('product external link tests passed');
