import assert from 'node:assert/strict';
import { rulesSource } from './rules-source.cjs';
import { dependency } from './dependencies.cjs';
import { createRepository } from '../../sales_assistant/repository-core.mjs';
import { parseExtraction, newReview, STAFF_ROLES } from '../../sales_assistant/domain.mjs';
const { initializeTestEnvironment, assertFails, assertSucceeds } = dependency('@firebase/rules-unit-testing');
const sdk = dependency('firebase/firestore');
const env = await initializeTestEnvironment({ projectId: 'demo-sales-assistant', firestore: { host: '127.0.0.1', port: 8088, rules: rulesSource() } });
let checks = 0;
async function check(name, callback) { await callback(); checks++; console.log('PASS:', name); }
function payload(message = 'Please send weekly granola prices.') {
    const rawJson = JSON.stringify({ buyer: { companyName: 'Ala-Too Cafe', name: 'Aida', phone: '+996555000123' }, products: [{ requestedName: 'Granola', quantity: null, unit: null }] });
    return { originalMessage: message, rawJson, review: newReview(parseExtraction(rawJson).data) };
}
function repo(uid) { return createRepository(sdk, env.authenticatedContext(uid).firestore(), { currentUser: { uid } }); }
const staffRepo = repo('staff');
try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await Promise.all([
            sdk.setDoc(sdk.doc(db, 'users/staff'), { role: 'manager' }),
            sdk.setDoc(sdk.doc(db, 'users/customer'), { role: 'customer' }),
            sdk.setDoc(sdk.doc(db, 'users/orders'), { role: 'orders' }),
            sdk.setDoc(sdk.doc(db, 'customers/existing'), { companyName: 'Ala-Too Cafe', name: 'Aida', phone: '+996555000123' }),
            sdk.setDoc(sdk.doc(db, 'customers/archived'), { companyName: 'Archived Cafe', archived: true }),
            sdk.setDoc(sdk.doc(db, 'products/granola'), { companyId: 'kyrgyz-organics', name_en: 'Granola', active: true }),
            sdk.setDoc(sdk.doc(db, 'products/inactive'), { name_en: 'Old product', active: false }),
            sdk.setDoc(sdk.doc(db, 'products/other'), { companyId: 'dailybread', name_en: 'Other store', active: true }),
            ...STAFF_ROLES.map(role => sdk.setDoc(sdk.doc(db, 'users/role-' + role), { role }))
        ]);
    });
    await check('all existing CRM staff roles can read CRM and enquiries; forged token roles cannot', async () => {
        for (const role of STAFF_ROLES) {
            assert.equal((await repo('role-' + role).loadIdentity()).role, role);
            await assertSucceeds(sdk.getDocsFromServer(sdk.collection(env.authenticatedContext('role-' + role).firestore(), 'sales_enquiries')));
        }
        const forged = env.authenticatedContext('customer', { role: 'admin' }).firestore();
        await assertFails(sdk.getDocsFromServer(sdk.collection(forged, 'customers')));
    });
    await check('anonymous, customer, unprofiled and non-CRM staff cannot read or write enquiries', async () => {
        const contexts = [env.unauthenticatedContext(), env.authenticatedContext('customer'), env.authenticatedContext('unknown'), env.authenticatedContext('orders')];
        for (const context of contexts) {
            const db = context.firestore();
            await assertFails(sdk.getDocsFromServer(sdk.collection(db, 'sales_enquiries')));
            await assertFails(sdk.setDoc(sdk.doc(db, 'sales_enquiries', 'a'.repeat(64)), { originalMessage: 'Private', updatedBy: 'customer' }));
            await assertFails(sdk.getDocsFromServer(sdk.collection(db, 'sales_enquiries', 'a'.repeat(64), 'activity')));
        }
        await assert.rejects(repo('customer').list(), /CRM staff access/);
    });
    let saved;
    await check('incomplete enquiry saves and reloads with immutable source and an atomic activity event', async () => {
        const input = payload();
        saved = await staffRepo.save(input, { uid: 'staff' });
        const record = await staffRepo.get(saved.id);
        assert.equal(record.originalMessage, input.originalMessage); assert.equal(record.rawJson, input.rawJson);
        assert.equal(record.review.products[0].quantity, null); assert.equal(record.revision, 1);
        assert.equal((await staffRepo.activity(saved.id)).length, 1);
        assert.equal((await staffRepo.list()).length, 1);
    });
    await check('duplicate original message cannot create a second enquiry', async () => {
        await assert.rejects(staffRepo.save(payload(), { uid: 'staff' }), /already has an enquiry/);
        assert.equal((await staffRepo.list()).length, 1);
    });
    await check('confirmed existing customer and product links survive reload; follow-up updates are audited', async () => {
        const record = await staffRepo.get(saved.id);
        record.review.customerId = 'existing'; record.review.customerConfirmed = true;
        record.review.products[0].productId = 'granola'; record.review.products[0].productConfirmed = true;
        record.review.status = 'Needs clarification'; record.review.followUpDate = '2026-10-22';
        await staffRepo.save(record, { uid: 'staff' });
        const fresh = await staffRepo.get(saved.id);
        assert.equal(fresh.review.customerId, 'existing'); assert.equal(fresh.review.products[0].productId, 'granola'); assert.equal(fresh.review.followUpDate, '2026-10-22');
        assert.equal(fresh.revision, 2); assert.equal((await staffRepo.activity(saved.id)).length, 2);
    });
    await check('concurrent revision changes, source replacement, missing/archived customers and inactive/other-store products fail', async () => {
        const original = await staffRepo.get(saved.id);
        const stale = structuredClone(original); stale.revision = 1;
        await assert.rejects(staffRepo.save(stale, { uid: 'staff' }), /Another staff member/);
        const replaced = structuredClone(original); replaced.originalMessage = 'Changed source';
        await assert.rejects(staffRepo.save(replaced, { uid: 'staff' }), /immutable/);
        for (const customerId of ['missing', 'archived']) {
            const bad = structuredClone(original); bad.review.customerId = customerId;
            await assert.rejects(staffRepo.save(bad, { uid: 'staff' }), /missing or archived/);
        }
        for (const productId of ['missing', 'inactive', 'other']) {
            const bad = structuredClone(original); bad.review.products[0].productId = productId;
            await assert.rejects(staffRepo.save(bad, { uid: 'staff' }), /linked product/);
        }
        assert.equal((await staffRepo.get(saved.id)).revision, 2);
    });
    await check('customer creation copies confirmed CRM fields, is atomic, and never stores the CRM PIN in enquiry', async () => {
        const input = payload('New buyer needs granola.');
        Object.assign(input.review.buyer, { companyName: 'New Cafe', name: 'New Contact', phone: '+996555000999' });
        Object.assign(input.review, { createCustomer: true, newCustomerConfirmed: true, pinCode: '123456', category: 'C' });
        Object.keys(input.review.buyer).forEach(key => { input.review.confirmed[key] = true; });
        const result = await staffRepo.save(input, { uid: 'staff' });
        const fresh = await staffRepo.get(result.id);
        assert.match(fresh.review.customerId, /^sa_[a-f0-9]{64}$/); assert.equal(fresh.review.pinCode, '');
        assert.equal(fresh.review.createCustomer, false);
        const customer = await sdk.getDocFromServer(sdk.doc(env.authenticatedContext('staff').firestore(), 'customers', fresh.review.customerId));
        assert.equal(customer.data().pinCode, '123456'); assert.equal(customer.data().companyName, 'New Cafe');
        const duplicate = payload('Different message from same buyer.'); duplicate.review = structuredClone(input.review);
        await assert.rejects(staffRepo.save(duplicate, { uid: 'staff' }), /matching CRM customer/);
    });
    await check('concurrent creation of one customer cannot produce two CRM records', async () => {
        const first = payload('Concurrent buyer first message.');
        Object.assign(first.review.buyer, { companyName: 'Concurrent Cafe', phone: '+996555000888' });
        Object.assign(first.review, { createCustomer: true, newCustomerConfirmed: true, pinCode: '111111' });
        const second = structuredClone(first); second.originalMessage = 'Concurrent buyer second message.';
        const results = await Promise.allSettled([staffRepo.save(first, { uid: 'staff' }), staffRepo.save(second, { uid: 'staff' })]);
        assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
        const all = await staffRepo.catalogs(); assert.equal(all.customers.filter(customer => customer.phone === '+996555000888').length, 1);
    });
    await check('security rules require activity, prevent fabricated actors/source changes, deletion and activity rewrites', async () => {
        const db = env.authenticatedContext('staff').firestore();
        const ref = sdk.doc(db, 'sales_enquiries', saved.id);
        const original = (await sdk.getDocFromServer(ref)).data();
        await assertFails(sdk.updateDoc(ref, { originalMessage: 'Overwrite', revision: 3, updatedAt: sdk.serverTimestamp() }));
        await assertFails(sdk.updateDoc(ref, { revision: 3, updatedAt: sdk.serverTimestamp(), updatedBy: 'forged' }));
        await assertFails(sdk.updateDoc(ref, { revision: 3, updatedAt: sdk.serverTimestamp() }));
        await assertFails(sdk.setDoc(sdk.doc(db, 'sales_enquiries', 'b'.repeat(64)), { ...original, revision: 1, createdAt: sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp() }));
        await assertFails(sdk.deleteDoc(ref));
        await assertFails(sdk.updateDoc(sdk.doc(db, 'sales_enquiries', saved.id, 'activity', '1'), { action: 'Enquiry updated' }));
    });
    await check('legacy enquiries accept language metadata without changing immutable original extraction', async () => {
        const input = payload('Здравствуйте, нам нужна гранола.');
        const savedLegacy = await staffRepo.save(input, { uid: 'staff' });
        const oldExtracted = parseExtraction(input.rawJson).data;
        const oldReview = structuredClone(input.review);
        for (const key of ['sourceLanguage', 'replyLanguage', 'messageEnglish']) { delete oldExtracted[key]; delete oldReview[key]; }
        await env.withSecurityRulesDisabled(context => sdk.updateDoc(sdk.doc(context.firestore(), 'sales_enquiries', savedLegacy.id), { extracted: oldExtracted, review: oldReview }));
        const record = await staffRepo.get(savedLegacy.id);
        Object.assign(record.review, { sourceLanguage: 'Russian', replyLanguage: 'Russian', messageEnglish: 'Hello, we need granola.' });
        await staffRepo.save(record, { uid: 'staff' });
        const fresh = await staffRepo.get(savedLegacy.id);
        assert.equal(fresh.originalMessage, input.originalMessage);
        assert.deepEqual(fresh.extracted, oldExtracted);
        assert.equal(fresh.review.replyLanguage, 'Russian');
        assert.equal(fresh.review.messageEnglish, 'Hello, we need granola.');
    });
    await check('permission changes fail closed for reads and writes; shared product/CRM rules remain intact', async () => {
        await env.withSecurityRulesDisabled(context => sdk.updateDoc(sdk.doc(context.firestore(), 'users/staff'), { role: 'customer' }));
        await assert.rejects(staffRepo.list(), /CRM staff access/);
        await assert.rejects(staffRepo.save(payload('No permission'), { uid: 'staff' }), /CRM staff access/);
        const anonymous = env.unauthenticatedContext().firestore();
        await assertSucceeds(sdk.getDocFromServer(sdk.doc(anonymous, 'products/granola')));
        await assertFails(sdk.getDocFromServer(sdk.doc(anonymous, 'customers/existing')));
    });
    console.log('PASS:', checks, 'Firebase / repository integration groups');
} finally { await env.cleanup(); }
