import assert from 'node:assert/strict';
import {
    buildWhatsAppOrderMessage,
    buildWhatsAppOrderRecord,
    buildWhatsAppOrderUrl,
    buildWhatsAppReplyUrl,
    normalizeWhatsAppPhone
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
