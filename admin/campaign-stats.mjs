import { createReportCache } from './reporting-repository.mjs';

export const CONVERSION_ACTIONS = Object.freeze(['cta_click', 'click_whatsapp', 'click_glovo']);

// Dependency-injected: tests never initialize Firebase or contact production.
export function createCampaignStatsRepository({ db, firestore, defaultCompanyId,
  hasCanonicalCompanyIds = () => false, cache = createReportCache() }) {
  const { collection, query, where, getCountFromServer, getDocs } = firestore;
  const count = async (constraints) => (await getCountFromServer(query(collection(db, 'campaign_events'), ...constraints))).data().count;
  return {
    getConversionCount(companyId, { force = false } = {}) {
      if (!companyId) throw new Error('Select a store before loading campaign counts');
      return cache.get(JSON.stringify(['campaign-conversions', companyId]), async () => {
        const campaign = where('campaignId', '==', 'prime-mun');
        if (companyId !== defaultCompanyId || hasCanonicalCompanyIds('campaign_events')) {
          return count([campaign, where('companyId', '==', companyId), where('actionType', 'in', CONVERSION_ACTIONS)]);
        }
        // Legacy semantics are !companyId || companyId === defaultCompanyId.
        // not-in excludes missing and null fields; excluding every other falsy
        // Firestore value makes the subtraction retain those legacy documents.
        // Split action types because Firestore cannot combine in with not-in.
        // Only aggregate numbers cross the wire, never event histories.
        const counts = await Promise.all(CONVERSION_ACTIONS.map(async (action) => {
          const base = [campaign, where('actionType', '==', action)];
          const [total, foreign, legacyNaN] = await Promise.all([
            count(base),
            count([...base, where('companyId', 'not-in', [defaultCompanyId, '', false, 0])]),
            // NaN in a not-in array is inconsistent in the emulator. Explicit
            // equality compiles to IS_NAN, preserving the JS-falsy legacy case.
            count([...base, where('companyId', '==', NaN)])
          ]);
          if (foreign > total) throw new Error('Campaign changed while counting. Please refresh.');
          return total - foreign + legacyNaN;
        }));
        return counts.reduce((sum, value) => sum + value, 0);
      }, { force });
    },
    // Compatibility is explicit/manual, never an automatic retry on an index error.
    // Keep the legacy data accurate until indexes are separately approved/deployed.
    getLegacyConversionCount(companyId, { force = false } = {}) {
      if (!companyId) throw new Error('Select a store before loading campaign counts');
      return cache.get(JSON.stringify(['campaign-conversions-legacy', companyId]), async () => {
        const constraints = [where('campaignId', '==', 'prime-mun')];
        if (companyId !== defaultCompanyId) constraints.push(where('companyId', '==', companyId));
        const snap = await getDocs(query(collection(db, 'campaign_events'), ...constraints));
        return snap.docs.filter((doc) => {
          const event = doc.data();
          const matches = event.companyId ? event.companyId === companyId : companyId === defaultCompanyId;
          return matches && CONVERSION_ACTIONS.includes(event.actionType);
        }).length;
      }, { force });
    },
    invalidate() { cache.invalidate(); }
  };
}
