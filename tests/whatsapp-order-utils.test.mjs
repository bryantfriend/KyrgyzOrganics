import assert from 'node:assert/strict';
import {
    buildWhatsAppOrderMessage,
    buildWhatsAppOrderRecord,
    buildWhatsAppOrderUrl,
    buildWhatsAppReplyUrl,
    formatSom,
    normalizeWhatsAppPhone,
    parseWhatsAppOrderMessage
} from '../whatsapp-order-utils.mjs';

assert.equal(normalizeWhatsAppPhone('+996 (555) 12-34-56'), '996555123456');

const message = buildWhatsAppOrderMessage({
    productName: 'Honey and Nuts Granola',
    productId: 'honey-nuts',
    quantity: 2,
    sourceUrl: 'https://oako.kg/buy-granola/?product=honey-nuts'
});
assert.match(message, /Product: Honey and Nuts Granola/);
assert.match(message, /Quantity: 2/);
assert.match(message, /Product code: honey-nuts/);
assert.match(message, /Delivery address in Bishkek:/);

const orderUrl = new URL(buildWhatsAppOrderUrl({
    phone: '+996 555 123 456',
    productName: 'Honey and Nuts Granola',
    productId: 'honey-nuts'
}));
assert.equal(orderUrl.hostname, 'wa.me');
assert.equal(orderUrl.pathname, '/996555123456');
assert.match(orderUrl.searchParams.get('text'), /Honey and Nuts Granola/);

const multiItemMessage = buildWhatsAppOrderMessage({
    items: [
        { productName: 'Strawberry Light Granola · 350 g', quantity: 2, unitPrice: 389 },
        { productName: 'Nuts Light Granola · 350 g', quantity: 1, unitPrice: 389 }
    ],
    customerName: 'Aida',
    customerPhone: '+996 555 123 456',
    customerAddress: 'Bishkek, 10 Kievskaya',
    sourceUrl: 'https://oako.kg/buy-granola/'
});
assert.match(multiItemMessage, /2 × 389 som = 778 som/);
assert.match(multiItemMessage, /Sub-total: 1,167 som/);
assert.match(multiItemMessage, /Phone: \+996 555 123 456/);
assert.match(multiItemMessage, /Delivery address: Bishkek, 10 Kievskaya/);
assert.equal(formatSom(1167), '1,167');
assert.deepEqual(parseWhatsAppOrderMessage(multiItemMessage), {
    customerName: 'Aida',
    customerPhone: '+996 555 123 456',
    customerAddress: 'Bishkek, 10 Kievskaya',
    deliveryMethod: 'yandex_delivery',
    items: [
        { productId: '', productName: 'Strawberry Light Granola · 350 g', quantity: 2, unitPrice: 389 },
        { productId: '', productName: 'Nuts Light Granola · 350 g', quantity: 1, unitPrice: 389 }
    ]
});

const replyUrl = new URL(buildWhatsAppReplyUrl({ phone: '+996 555 123 456', orderId: 'ABC123', customerName: 'Aida' }));
assert.match(replyUrl.searchParams.get('text'), /Hello Aida!/);
assert.match(replyUrl.searchParams.get('text'), /ABC123/);

const record = buildWhatsAppOrderRecord({
    companyId: 'kyrgyz-organics',
    customerName: 'Aida',
    customerPhone: '+996 555 123 456',
    customerAddress: 'Bishkek',
    items: [
        { productId: 'honey-nuts', productName: 'Honey and Nuts Granola', quantity: 2, unitPrice: 479 }
    ],
    deliveryFee: 200,
    deliveryMethod: 'yandex_delivery',
    paymentStatus: 'collect_on_delivery'
});
assert.equal(record.source, 'whatsapp');
assert.equal(record.status, 'new');
assert.equal(record.subtotal, 958);
assert.equal(record.total, 1158);
assert.equal(record.items[0].lineTotal, 958);

assert.throws(() => buildWhatsAppOrderRecord({ companyId: 'kyrgyz-organics', customerName: '', customerPhone: '+996555123456', items: [] }), /Customer name/);

console.log('whatsapp order utility tests passed');
