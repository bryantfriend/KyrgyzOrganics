const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { dependency } = require('./dependencies.cjs');
const { chromium } = dependency('playwright');
const { initializeTestEnvironment } = dependency('@firebase/rules-unit-testing');
const sdk = dependency('firebase/firestore');
const esbuild = dependency('esbuild');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/sales-assistant');
const base = 'http://127.0.0.1:5088';
const rules = require('./rules-source.cjs').rulesSource();
const projectId = 'demo-sales-assistant';
const password = 'Synthetic-test-only-123!';
let checks = 0;
let diagnosticPage;
const diagnosticErrors = [];
async function check(name, callback) {
    try { await callback(); checks++; console.log('PASS:', name); }
    catch (error) {
        if (diagnosticPage) {
            console.error('Synthetic browser state:', await diagnosticPage.locator('body').innerText());
            console.error('Browser diagnostics:', diagnosticErrors);
            await diagnosticPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
        }
        throw error;
    }
}
async function account(email) {
    const response = await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    const body = await response.json(); if (!response.ok) throw new Error(JSON.stringify(body)); return body.localId;
}
async function main() {
    const { createRepository } = await import(pathToFileURL(path.join(root, 'sales_assistant/repository-core.mjs')));
    const { parseExtraction, newReview, today } = await import(pathToFileURL(path.join(root, 'sales_assistant/domain.mjs')));
    fs.mkdirSync(output, { recursive: true });
    const bundled = await esbuild.build({ stdin: { contents: "export * from 'firebase/app'; export * from 'firebase/auth'; export * from 'firebase/firestore';", resolveDir: root }, nodePaths: [process.env.SALES_TEST_MODULES || path.join(__dirname, 'node_modules')], bundle: true, format: 'esm', platform: 'browser', write: false });
    const browserSdk = bundled.outputFiles[0].text;
    const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8088, rules } });
    const browser = await chromium.launch({ headless: true });
    try {
        await env.clearFirestore();
        await fetch('http://127.0.0.1:9098/emulator/v1/projects/' + projectId + '/accounts', { method: 'DELETE' });
        const staffUid = await account('staff@sales.test');
        const customerUid = await account('customer@sales.test');
        await env.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            await Promise.all([
                sdk.setDoc(sdk.doc(db, 'users', staffUid), { role: 'manager', email: 'staff@sales.test', displayName: 'Sales team' }),
                sdk.setDoc(sdk.doc(db, 'users', customerUid), { role: 'customer' }),
                sdk.setDoc(sdk.doc(db, 'customers', 'cafe'), { companyName: 'Ala-Too Cafe', name: 'Aida', phone: '+996555000123', address: 'Bishkek' }),
                sdk.setDoc(sdk.doc(db, 'products', 'granola'), { name_en: 'Granola 500 g', companyId: 'kyrgyz-organics', active: true, weight: '500 g' }),
                sdk.setDoc(sdk.doc(db, 'products', 'biscotti'), { name_en: 'Biscotti classic', companyId: 'kyrgyz-organics', active: true })
            ]);
        });
        const repository = createRepository(sdk, env.authenticatedContext(staffUid).firestore(), { currentUser: { uid: staffUid } });
        for (const [index, name] of ['Sunrise Hotel', 'Nomad Mart', 'Bishkek Deli'].entries()) {
            const rawJson = JSON.stringify({ buyer: { companyName: name }, products: [{ requestedName: index === 0 ? 'Dried apricots' : 'Granola', quantity: null, unit: null }] });
            const review = newReview(parseExtraction(rawJson).data); review.status = index === 0 ? 'Needs clarification' : 'New'; review.followUpDate = today();
            await repository.save({ originalMessage: 'Synthetic enquiry from ' + name, rawJson, review }, { uid: staffUid });
        }
        const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block' });
        await context.route('https://www.gstatic.com/firebasejs/10.7.1/**', route => route.fulfill({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: "export * from '" + base + "/sales-test-sdk.mjs';" }));
        await context.route('**/sales-test-sdk.mjs', route => route.fulfill({ contentType: 'text/javascript', body: browserSdk }));
        await context.route('**/firebase-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `
            import {initializeApp, initializeFirestore, getAuth, connectFirestoreEmulator, connectAuthEmulator} from '/sales-test-sdk.mjs';
            const app=initializeApp({apiKey:'demo-key',projectId:'${projectId}',authDomain:'localhost'});
            export const db=initializeFirestore(app,{experimentalForceLongPolling:true,useFetchStreams:false});connectFirestoreEmulator(db,'127.0.0.1',8088);
            export const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9098',{disableWarnings:true});
        ` }));
        const page = await context.newPage();
        diagnosticPage = page;
        page.setDefaultTimeout(15000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (['warning', 'error'].includes(message.type())) diagnosticErrors.push(message.text()); });
        page.on('requestfailed', request => diagnosticErrors.push(new URL(request.url()).pathname + ': ' + request.failure().errorText));
        const visible = locator => locator.waitFor({ state: 'visible' });
        async function login(email) {
            await page.locator('#login-email').fill(email); await page.locator('#login-password').fill(password); await page.locator('#login-button').click();
        }
        await check('direct navigation, slash canonicalization, refresh and unauthenticated shell', async () => {
            await page.goto(base + '/sales_assistant'); await visible(page.locator('#login-button:not([disabled])'));
            assert.ok(new URL(page.url()).pathname.startsWith('/sales_assistant'));
            assert.equal(await page.locator('#workspace').isVisible(), false);
            await page.reload(); await visible(page.locator('#login-button:not([disabled])'));
            for (const route of ['/', '/admin/admin.html', '/dailybread/', '/product.html', '/hamster_game/', '/p/', '/q/']) {
                const response = await context.request.get(base + route); assert.equal(response.status(), 200, route);
                assert.match(await response.text(), /<!doctype html/i, route);
            }
        });
        await check('non-staff login fails closed and existing authorized staff can sign in', async () => {
            await login('customer@sales.test'); await visible(page.locator('#auth-signout'));
            assert.match(await page.locator('#auth-status').innerText(), /does not have CRM staff access/);
            assert.equal(await page.locator('#workspace').isVisible(), false);
            await page.locator('#auth-signout').click(); await login('staff@sales.test');
            await visible(page.getByRole('heading', { name: 'Enquiries', exact: true }));
        });
        await check('dashboard search, status and follow-up filters', async () => {
            await page.screenshot({ path: path.join(output, '01-dashboard.png'), fullPage: true });
            await page.locator('#search').fill('Sunrise'); assert.equal(await page.locator('tbody tr').count(), 1);
            await page.locator('#filter-status').selectOption('Qualified'); await visible(page.getByRole('heading', { name: 'No matching enquiries' }));
            await page.locator('#search').fill(''); await page.locator('#filter-status').selectOption('');
            await page.getByRole('link', { name: 'Follow-ups', exact: true }).click(); await visible(page.getByRole('heading', { name: 'Follow-ups', exact: true }));
            assert.equal(await page.locator('#filter-followup').inputValue(), 'due'); assert.equal(await page.locator('tbody tr').count(), 3);
        });
        const originalMessage = 'Hello, this is Aida from Ala-Too Cafe. We need granola and biscotti every week. Can you send wholesale prices?';
        const lead = { sourceLanguage: 'English', replyLanguage: 'English', messageEnglish: originalMessage, buyer: { companyName: 'Ala-Too Cafe', name: 'Aida', phone: '+996555000123', email: null, address: null }, products: [{ requestedName: 'Granola', quantity: null, unit: null, ambiguities: ['Which pack size?'] }, { requestedName: 'Biscotti', quantity: null, unit: null }], frequency: 'Weekly', ambiguities: ['First delivery date is unknown'] };
        await check('manual prompt copy, malformed JSON and missing/ambiguous extraction review', async () => {
            await page.getByRole('link', { name: 'New enquiry', exact: true }).click(); await visible(page.locator('#original-message'));
            await page.locator('#original-message').fill(originalMessage);
            await page.locator('#copy-prompt').click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /BEGIN CUSTOMER MESSAGE/);
            await page.locator('#raw-json').fill('{bad'); await page.locator('#validate-json').click(); assert.match(await page.locator('#json-errors').innerText(), /Invalid JSON/);
            await page.locator('#raw-json').fill(JSON.stringify(lead, null, 2));
            await page.screenshot({ path: path.join(output, '02-intake.png'), fullPage: true });
            await page.locator('#validate-json').click(); await visible(page.getByRole('heading', { name: 'Review extraction' }));
            assert.match(await page.locator('#review-issues').innerText(), /Ambiguous/);
            await page.locator('[data-confirm="companyName"]').check(); await page.locator('[data-confirm="name"]').check(); await page.locator('[data-confirm="phone"]').check();
            await page.screenshot({ path: path.join(output, '03-review.png'), fullPage: true });
        });
        await check('explicit CRM and catalog confirmation, save and detail reload', async () => {
            await page.locator('#continue-match').click(); await visible(page.locator('[data-link-customer="cafe"]'));
            await page.locator('[data-link-customer="cafe"]').click();
            await page.locator('[data-product-select="0"]').selectOption('granola'); await page.locator('[data-confirm-product="0"]').click();
            await page.locator('[data-product-select="1"]').selectOption('biscotti'); await page.locator('[data-confirm-product="1"]').click();
            await page.screenshot({ path: path.join(output, '04-matching.png'), fullPage: true });
            await page.locator('#save-enquiry').click(); await page.locator('#notice').filter({ hasText: 'Enquiry saved to Firebase.' }).waitFor(); await visible(page.getByRole('heading', { name: 'Reviewed buyer details' }));
            assert.equal(await page.locator('.source-text').innerText(), originalMessage);
            await page.locator('#enquiry-status').selectOption('Needs clarification'); await page.locator('#followup-date').fill('2026-10-22');
            await page.locator('#followup-note').fill('Confirm weekly quantities and delivery details.'); await page.locator('#save-followup').click();
            await page.locator('#notice').filter({ hasText: 'Enquiry saved to Firebase.' }).waitFor();
            await page.reload(); await visible(page.locator('#save-followup'));
            assert.equal(await page.locator('#followup-date').inputValue(), '2026-10-22');
            assert.equal(await page.locator('#enquiry-status').inputValue(), 'Needs clarification');
            assert.equal(await page.locator('.timeline li').count(), 2);
            await page.locator('#reply-reviewed').check(); await page.locator('#copy-reply').click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Hello Aida/);
            await page.screenshot({ path: path.join(output, '05-details.png'), fullPage: true });
        });
        await check('customer-language replies require manual translation and review; language changes clear stale translations', async () => {
            await page.locator('#reply-language').fill('Urdu (Latin script)');
            assert.equal(await page.locator('#reply-translated').inputValue(), '');
            await page.locator('#copy-reply-prompt').click();
            assert.match(await page.evaluate(() => navigator.clipboard.readText()), /into Urdu \(Latin script\)/);
            await page.locator('#reply-translated').fill('Salam Aida, aap ko har haftay kitni miqdaar chahiye?');
            await page.locator('#copy-reply').click();
            assert.match(await page.locator('#notice').innerText(), /confirm your review/);
            await page.locator('#reply-reviewed').check(); await page.locator('#copy-reply').click();
            assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^Salam Aida/);
            await page.locator('#reply-draft').fill('Please confirm the delivery location.');
            assert.equal(await page.locator('#reply-translated').inputValue(), '');
            assert.equal(await page.locator('#reply-reviewed').isChecked(), false);
            await page.locator('#reply-language').fill('Russian');
            await page.locator('#save-followup').click(); await page.locator('#notice').filter({ hasText: 'Enquiry saved to Firebase.' }).waitFor();
            await page.reload(); await visible(page.locator('#reply-language'));
            assert.equal(await page.locator('#reply-language').inputValue(), 'Russian');
            assert.equal(await page.locator('#reply-translated').inputValue(), '');
            assert.match(await page.locator('.source-text').innerText(), /Hello, this is Aida/);
        });
        await check('editing clears field and customer confirmation; navigation warns about unsaved edits', async () => {
            await page.locator('#edit-enquiry').click(); await page.locator('[data-field="companyName"]').fill('Corrected Cafe');
            assert.equal(await page.locator('[data-confirm="companyName"]').isChecked(), false);
            await page.locator('#continue-match').click(); assert.equal(await page.locator('#clear-customer').count(), 0);
            const dismissed = page.waitForEvent('dialog');
            const firstNavigation = page.getByRole('link', { name: 'Dashboard', exact: true }).click();
            await (await dismissed).dismiss(); await firstNavigation;
            await page.waitForFunction(() => location.hash.startsWith('#enquiry/'));
            await visible(page.getByRole('heading', { name: 'Confirm matches', exact: true }));
            const accepted = page.waitForEvent('dialog');
            const secondNavigation = page.getByRole('link', { name: 'Dashboard', exact: true }).click();
            await (await accepted).accept(); await secondNavigation;
            await visible(page.getByRole('heading', { name: 'Enquiries', exact: true }));
        });
        async function startLead(message, body) {
            await page.getByRole('link', { name: 'New enquiry', exact: true }).click(); await visible(page.locator('#original-message'));
            await page.locator('#original-message').fill(message); await page.locator('#raw-json').fill(JSON.stringify(body)); await page.locator('#validate-json').click();
            await visible(page.locator('#continue-match'));
        }
        await check('incomplete save and duplicate-message failure preserve the source and retry controls', async () => {
            await startLead('Incomplete synthetic lead', {}); await page.locator('#save-incomplete').click(); await page.locator('#notice').filter({ hasText: 'Enquiry saved to Firebase.' }).waitFor(); await visible(page.locator('#save-followup'));
            await startLead('Incomplete synthetic lead', {}); await page.locator('#save-incomplete').click();
            await page.locator('#notice').filter({ hasText: 'already has an enquiry' }).waitFor();
            assert.equal(await page.locator('#save-incomplete').isEnabled(), true);
            page.once('dialog', dialog => dialog.accept()); await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); await visible(page.locator('#search'));
        });
        await check('new CRM customer requires explicit creation and is visible after save', async () => {
            const body = { buyer: { companyName: 'New Concept Cafe', name: 'Sam', phone: '+996555000777' } };
            await startLead('New Concept Cafe asks for wholesale information.', body);
            for (const field of ['companyName', 'name', 'phone']) await page.locator('[data-confirm="' + field + '"]').check();
            await page.locator('#continue-match').click(); await page.getByText('Create a new CRM customer', { exact: true }).click();
            await page.locator('#customer-pin').fill('123456'); await page.locator('#create-customer').check();
            await page.locator('#save-enquiry').click(); await page.locator('#notice').filter({ hasText: 'Enquiry saved to Firebase.' }).waitFor(); await visible(page.locator('#save-followup'));
            const customers = await repository.catalogs(); assert.equal(customers.customers.filter(customer => customer.companyName === 'New Concept Cafe').length, 1);
        });
        await check('Firebase write denial is shown without losing the draft', async () => {
            await startLead('Denied synthetic save', {});
            const deniedRules = rules.replace('allow create: if isAdmin() && enquiryId.matches', 'allow create: if false && isAdmin() && enquiryId.matches');
            const changed = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8088, rules: deniedRules } });
            try {
                await page.locator('#save-incomplete').click(); await page.locator('#notice').filter({ hasText: 'Access denied by Firebase' }).waitFor();
                assert.match(await page.locator('.source-text').innerText(), /Denied synthetic save/);
                assert.equal(await page.locator('#save-incomplete').isEnabled(), true);
            } finally {
                const restored = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8088, rules } }); await restored.cleanup(); await changed.cleanup();
            }
        });
        await check('staff permission revocation clears private UI and memory', async () => {
            await env.withSecurityRulesDisabled(context => sdk.updateDoc(sdk.doc(context.firestore(), 'users', staffUid), { role: 'customer' }));
            await visible(page.locator('#auth-screen'));
            assert.equal(await page.locator('#workspace').isVisible(), false); assert.equal(await page.locator('#content').innerText(), '');
        });
        assert.deepEqual(errors, [], 'Uncaught browser errors');
        console.log('PASS:', checks, 'browser / hosting groups. Screenshots:', output);
        await context.close();
    } finally { await browser.close(); await env.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
