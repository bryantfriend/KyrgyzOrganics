// Explicit production smoke test. Creates isolated test records and removes them in finally.
// Run only after deployment, with an authorized Google Cloud token in QR_DEPLOY_ACCESS_TOKEN.
import assert from 'node:assert/strict';
const project = 'oa-kyrgyz-organic';
const bucket = `${project}.firebasestorage.app`;
const apiKey = 'AIzaSyB2azgMx3VRCqKTVj4zhdqv51o6w1cAtxI';
const adminToken = process.env.QR_DEPLOY_ACCESS_TOKEN;
if (!adminToken) throw new Error('QR_DEPLOY_ACCESS_TOKEN is required.');
const firestore = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/`;
const unique = `qr-deploy-test-${Date.now()}`;
const productPath = `products/${unique}`;
const owner = [], objects = [];
let orderId;
const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'x-goog-user-project': project };
async function request(url, { token, method = 'GET', body, headers = {}, publicRequest = false } = {}) {
    const response = await fetch(url, { method, headers: { ...(publicRequest ? {} : token ? { Authorization: `Bearer ${token}` } : adminHeaders),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${new URL(url).pathname}: ${response.status} ${data.error?.message || ''}`);
    return data;
}
async function guest() {
    const data = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST', body: { returnSecureToken: true }, publicRequest: true
    });
    owner.push(data); return data;
}
async function callable(name, data, user) {
    return (await request(`https://us-central1-${project}.cloudfunctions.net/${name}`, {
        method: 'POST', token: user.idToken, body: { data }
    })).result;
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
try {
    await request(firestore + productPath, { method: 'PATCH', body: { fields: {
        companyId: { stringValue: 'qr-deploy-test' }, active: { booleanValue: true },
        name_en: { stringValue: 'Deployment verification only' }, priceRetail: { doubleValue: 1 },
        qrPayment: { mapValue: { fields: { enabled: { booleanValue: true },
            qrUrl: { stringValue: 'https://example.com/test-only-qr.png' }, accountName: { stringValue: 'Deployment test' } } } }
    } } });
    const customer = await guest();
    const other = await guest();
    const order = await callable('createQrProductOrder', { productId: unique, companyId: 'qr-deploy-test',
        customerName: 'DEPLOYMENT TEST — NO PAYMENT', customerPhone: '+996000000000', total: 999 }, customer);
    orderId = order.orderId;
    assert.equal(order.total, 1);
    const receiptPath = `qr_receipts/${customer.localId}/${orderId}/receipt.png`;
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(receiptPath)}`;
    const forbidden = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Firebase ${other.idToken}`, 'Content-Type': 'image/png' }, body: png });
    assert.equal(forbidden.status, 403, 'Other customers cannot upload to this order');
    const upload = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Firebase ${customer.idToken}`, 'Content-Type': 'image/png' }, body: png });
    if (!upload.ok) throw new Error(`Owner upload failed: ${upload.status} ${await upload.text()}`);
    objects.push(receiptPath);
    const privateRead = await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(receiptPath)}?alt=media`, {
        headers: { Authorization: `Firebase ${other.idToken}` }
    });
    assert.equal(privateRead.status, 403, 'Other customers cannot read receipts');
    const bankUpload = await fetch(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(`products/${unique}.png`)}`, {
        method: 'POST', headers: { Authorization: `Firebase ${customer.idToken}`, 'Content-Type': 'image/png' }, body: png
    });
    if (bankUpload.ok) objects.push(`products/${unique}.png`);
    assert.equal(bankUpload.status, 403, 'Guests cannot upload product bank QR images');
    const directUpdate = await fetch(firestore + `orders/${orderId}?updateMask.fieldPaths=status`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${customer.idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: { stringValue: 'pending_verification' } } })
    });
    assert.equal(directUpdate.status, 403, 'Customers must submit receipts through the callable');
    await callable('submitPaymentProof', { ...order, receiptPath }, customer);
    await callable('submitPaymentProof', { ...order, receiptPath }, customer);
    const saved = await request(firestore + `orders/${orderId}`);
    assert.equal(saved.fields.status.stringValue, 'pending_verification');
    assert.equal(saved.fields.paymentStatus.stringValue, 'submitted');
    const signedReceipt = await fetch(saved.fields.receiptUrl.stringValue);
    assert.equal(signedReceipt.status, 200, 'Admin receipt URL must be readable');
    console.log('LIVE PASS: guest sign-in, server pricing, owner upload, receipt privacy, blocked guest bank uploads, blocked direct order updates, proof submission, retry and signed receipt review.');
} finally {
    const cleanup = [];
    for (const path of objects) cleanup.push(request(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`, { method: 'DELETE' }));
    if (orderId) cleanup.push(request(firestore + `orders/${orderId}`, { method: 'DELETE' }));
    cleanup.push(request(firestore + productPath, { method: 'DELETE' }));
    for (const user of owner) cleanup.push(request(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
        method: 'POST', body: { idToken: user.idToken }, publicRequest: true
    }));
    const results = await Promise.allSettled(cleanup);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) throw new Error(`Test cleanup needs attention: ${failures.map(item => item.reason.message).join('; ')}`);
    console.log('Test products, orders, receipts and guest accounts cleaned up.');
}
