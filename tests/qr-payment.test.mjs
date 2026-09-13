import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const records = new Map();
const db = {
    doc: path => ({ path }),
    collection: name => ({ doc: () => ({ id: 'order1', path: `${name}/order1` }) }),
    runTransaction: fn => fn({
        get: async ref => ({ exists: records.has(ref.path), data: () => records.get(ref.path) }),
        set: (ref, value) => records.set(ref.path, value),
        update: (ref, value) => Object.assign(records.get(ref.path), value)
    })
};
let metadata = { size: 100, contentType: 'application/pdf' };
const firestore = Object.assign(() => db, { FieldValue: { serverTimestamp: () => 123 }, Timestamp: {} });
const admin = { initializeApp() {}, firestore, storage: () => ({ bucket: () => ({ file: () => ({
    exists: async () => [true], getMetadata: async () => [metadata], getSignedUrl: async () => ['https://example.com/receipt']
}) }) }) };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const sandbox = { exports: {}, console, require: name => ({ crypto, 'firebase-admin': admin,
    'firebase-functions': { https: { onCall: fn => (data, context = {}) => fn({ ...context, data }), HttpsError } } })[name] };
vm.runInNewContext(readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8'), sandbox);
const { createQrProductOrder, submitPaymentProof } = sandbox.exports;
const product = { companyId: 'saikal', active: true, name_en: 'Therapy session', priceRetail: 500,
    qrPayment: { enabled: true, qrUrl: 'https://example.com/qr.png', accountName: 'Saikal' } };
records.set('products/session', product);
const input = { productId: 'session', companyId: 'saikal', customerName: 'Test Customer', customerPhone: '+996555123456', total: 1 };
const context = { auth: { uid: 'customer1' } };
await assert.rejects(createQrProductOrder(input, {}), { code: 'unauthenticated' });
await assert.rejects(createQrProductOrder({ ...input, companyId: 'another-store' }, context), { code: 'permission-denied' });
product.qrPayment.enabled = false;
await assert.rejects(createQrProductOrder(input, context), { code: 'failed-precondition' });
product.qrPayment.enabled = true;
const result = await createQrProductOrder(input, context);
assert.equal(result.total, 500, 'Price comes from stored product, never client input');
assert.equal(records.get('orders/order1').inventoryReserved, false);
assert.equal(records.get('orders/order1').deliveryFee, 0);
const proof = { ...result, receiptPath: 'qr_receipts/customer1/order1/receipt' };
await assert.rejects(submitPaymentProof(proof, { auth: { uid: 'someone-else' } }), { code: 'permission-denied' });
await assert.rejects(submitPaymentProof({ ...proof, orderToken: 'bad' }, context), { code: 'permission-denied' });
metadata = { size: 6 * 1024 * 1024, contentType: 'application/pdf' };
await assert.rejects(submitPaymentProof(proof, context), { code: 'invalid-argument' });
metadata = { size: 100, contentType: 'application/pdf' };
await submitPaymentProof(proof, context);
assert.equal(records.get('orders/order1').status, 'pending_verification');
assert.equal(records.get('orders/order1').receiptContentType, 'application/pdf');
await submitPaymentProof(proof, context);
assert.equal(records.get('orders/order1').paymentStatus, 'submitted');
console.log('QR payment tests passed: server pricing, tenant isolation, ownership, validation, PDF submission and retry.');
