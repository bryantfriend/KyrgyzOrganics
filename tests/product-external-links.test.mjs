import assert from 'node:assert/strict';
import {
  buildYandexEatsBrowserUrl,
  buildYandexGoSmartUrl,
  getProductExternalLinkCtaLabel,
  getProductExternalLinkNavigation,
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

const exactGlovoUrl = 'https://glovoapp.com/en/kg/bishkek/stores/glovo-express-bsk?content=hleb-vypechka-sc.565402%2Fsvezhiy-hleb-c.565405&productId=4611686018428247882&externalProductId=43USVC';
const glovoNavigation = getProductExternalLinkNavigation(validLink({ type: 'glovo', url: exactGlovoUrl }));
assert.equal(glovoNavigation.kind, 'form');
assert.equal(glovoNavigation.action, 'https://glovoapp.com/en/kg/bishkek/stores/glovo-express-bsk');
assert.deepEqual(glovoNavigation.fields, [
  { name: 'content', value: 'hleb-vypechka-sc.565402/svezhiy-hleb-c.565405' },
  { name: 'productId', value: '4611686018428247882' },
  { name: 'externalProductId', value: '43USVC' }
]);

const requestedGlovoUrl = 'https://glovoapp.com/en/kg/bishkek/stores/glovo-express-bsk?content=hleb-vypechka-sc.42969216%2Fsvezhiy-hleb-c.42969150&search=biscot&productId=4611686018602342914&externalProductId=470024';
const requestedGlovoNavigation = getProductExternalLinkNavigation(validLink({ type: 'glovo', url: requestedGlovoUrl }));
assert.equal(requestedGlovoNavigation.kind, 'form');
assert.deepEqual(requestedGlovoNavigation.fields, [
  { name: 'content', value: 'hleb-vypechka-sc.42969216/svezhiy-hleb-c.42969150' },
  { name: 'search', value: 'biscot' },
  { name: 'productId', value: '4611686018602342914' },
  { name: 'externalProductId', value: '470024' }
]);
assert.equal(requestedGlovoNavigation.loginAction, 'https://glovoapp.com/en/login');
assert.deepEqual(requestedGlovoNavigation.loginFields, [{
  name: 'returnPath',
  value: '/en/kg/bishkek/stores/glovo-express-bsk?content=hleb-vypechka-sc.42969216%2Fsvezhiy-hleb-c.42969150&search=biscot&productId=4611686018602342914&externalProductId=470024'
}]);

const wwwGlovoNavigation = getProductExternalLinkNavigation(validLink({ type: 'glovo', url: 'https://www.glovoapp.com/en/kg/bishkek/stores/glovo-express-bsk' }));
assert.equal(wwwGlovoNavigation.kind, 'form');
assert.equal(wwwGlovoNavigation.action, 'https://glovoapp.com/en/kg/bishkek/stores/glovo-express-bsk');

const glovoShortLinkNavigation = getProductExternalLinkNavigation(validLink({ type: 'glovo', url: 'https://glovo.go.link/open?link_type=store' }));
assert.equal(glovoShortLinkNavigation.kind, 'link');

const regularNavigation = getProductExternalLinkNavigation(validLink({ type: 'website', url: 'https://example.com/product' }));
assert.equal(regularNavigation.kind, 'link');
assert.equal(regularNavigation.loginAction, '');
assert.deepEqual(regularNavigation.loginFields, []);
assert.equal(regularNavigation.url, 'https://example.com/product');

const normalYandexSearchUrl = 'https://eda.yandex.kg/en-kg/search?hideSelector=true&query=%D0%B1%D0%B8%D1%81%D0%BA%D0%BE%D1%82%D1%82%D0%B8&type=all';
const yandexBrowserUrl = buildYandexEatsBrowserUrl(normalYandexSearchUrl);
const yandexBrowser = new URL(yandexBrowserUrl);
assert.equal(yandexBrowser.origin, 'https://eda.yandex.kg');
assert.equal(yandexBrowser.pathname, '/en-kg/search');
assert.equal(yandexBrowser.searchParams.has('hideSelector'), false);
assert.equal(yandexBrowser.searchParams.get('query'), 'бискотти');
assert.equal(buildYandexEatsBrowserUrl(yandexBrowserUrl), yandexBrowserUrl);
assert.equal(buildYandexGoSmartUrl(normalYandexSearchUrl), yandexBrowserUrl);

const legacyYandexAdjust = new URL('https://8jxm.adj.st/external');
const legacyYandexNative = new URL('yandextaxi://external');
legacyYandexNative.searchParams.set('service', 'eats');
legacyYandexNative.searchParams.set('href', 'https://eda.yandex.kg/search?query=бискотти');
legacyYandexAdjust.searchParams.set('adj_deeplink', legacyYandexNative.toString());
legacyYandexAdjust.searchParams.set('adjust_t', 'gm2aavy_wjqyew0');
legacyYandexAdjust.searchParams.set('adj_fallback', normalYandexSearchUrl);
assert.equal(buildYandexEatsBrowserUrl(legacyYandexAdjust.toString()), yandexBrowserUrl);

const yandexNavigation = getProductExternalLinkNavigation(validLink({ type: 'yandex', url: normalYandexSearchUrl }));
assert.equal(yandexNavigation.kind, 'form');
assert.equal(yandexNavigation.url, yandexBrowserUrl);
assert.equal(yandexNavigation.action, 'https://eda.yandex.kg/en-kg/search');
assert.deepEqual(yandexNavigation.fields, [
  { name: 'query', value: 'бискотти' }
]);
assert.equal(yandexNavigation.loginAction, '');
assert.equal(yandexNavigation.openInNewTab, false);

const legacyYandexNavigation = getProductExternalLinkNavigation(validLink({ type: 'yandex', url: legacyYandexAdjust.toString() }));
assert.equal(legacyYandexNavigation.kind, 'form');
assert.equal(legacyYandexNavigation.url, yandexBrowserUrl);

const yandexRestaurantNavigation = getProductExternalLinkNavigation(validLink({ type: 'yandex', url: 'https://eda.yandex.kg/en-kg/r/faiza_1706873280' }));
assert.equal(yandexRestaurantNavigation.url, 'https://eda.yandex.kg/en-kg/r/faiza_1706873280');
assert.equal(yandexRestaurantNavigation.openInNewTab, true);

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
