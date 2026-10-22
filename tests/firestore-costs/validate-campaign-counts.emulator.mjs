// Run through run-emulator-validation.sh, which copies this file and the pure
// repository modules into an isolated temporary package. Never import app config.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, setDoc, getDocs,
  getCountFromServer, query, where, terminate
} from 'firebase/firestore';
import { createCampaignStatsRepository } from './campaign-stats.mjs';

const projectId = 'demo-cost-tests';
assert.equal(process.env.GCLOUD_PROJECT, projectId, 'Only the isolated demo project is allowed');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:18780', 'Only the local emulator is allowed');

const app = initializeApp({ projectId, apiKey: 'demo-emulator-only', appId: 'demo-cost-tests' });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 18780);
const defaultId = 'kyrgyz-organics';
const actions = ['cta_click', 'click_whatsapp', 'click_glovo'];
const samples = [
  ['missing', undefined], ['null', null], ['empty', ''], ['false', false],
  ['zero', 0], ['negative-zero', -0], ['nan', NaN], ['default', defaultId],
  ['other', 'dailybread'], ['true', true], ['one', 1],
  ['empty-array', []], ['empty-map', {}], ['string-zero', '0']
];
const expectedPerAction = samples.filter(([, value]) => !value || value === defaultId).length;

try {
  for (const actionType of actions) {
    for (const [id, value] of samples) {
      const data = { campaignId: 'prime-mun', actionType };
      if (value !== undefined) data.companyId = value;
      await setDoc(doc(db, 'campaign_events', `${actionType}_${id}`), data);
    }
  }
  await setDoc(doc(db, 'campaign_events', 'other-campaign'), {
    campaignId: 'other', actionType: 'cta_click', companyId: defaultId
  });
  await setDoc(doc(db, 'campaign_events', 'other-action'), {
    campaignId: 'prime-mun', actionType: 'page_view', companyId: defaultId
  });

  for (const actionType of actions) {
    const base = [where('campaignId', '==', 'prime-mun'), where('actionType', '==', actionType)];
    const count = async (extra = []) => (await getCountFromServer(
      query(collection(db, 'campaign_events'), ...base, ...extra)
    )).data().count;
    const [total, originalForeign, foreignWithoutNaN, nan] = await Promise.all([
      count(),
      count([where('companyId', 'not-in', [defaultId, '', false, 0, NaN])]),
      count([where('companyId', 'not-in', [defaultId, '', false, 0])]),
      count([where('companyId', '==', NaN)])
    ]);
    const corrected = total - foreignWithoutNaN + nan;
    assert.equal(corrected, expectedPerAction);
    console.log(JSON.stringify({ actionType, total, originalForeign, foreignWithoutNaN, nan,
      originalDerived: total - originalForeign, corrected, expected: expectedPerAction }));
  }

  const repository = createCampaignStatsRepository({
    db, defaultCompanyId: defaultId,
    firestore: { collection, query, where, getCountFromServer, getDocs }
  });
  assert.equal(await repository.getConversionCount(defaultId), expectedPerAction * actions.length);
  assert.equal(await repository.getConversionCount('dailybread'), actions.length);
  assert.equal(await repository.getLegacyConversionCount(defaultId), expectedPerAction * actions.length);
  console.log('PASS: current campaign repository and explicit NaN aggregation preserve all fixture semantics.');
} finally {
  await terminate(db);
  await deleteApp(app);
}
