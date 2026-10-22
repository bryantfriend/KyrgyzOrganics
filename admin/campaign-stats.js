import { db, auth } from '../firebase-config.js';
import { collection, query, where, getCountFromServer, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { COMPANY_ID } from '../company-config.js';
import { hasCanonicalCompanyIds } from '../read-model-readiness.mjs';
import { createCampaignStatsRepository } from './campaign-stats.mjs';

export const campaignStats = createCampaignStatsRepository({
  db, firestore: { collection, query, where, getCountFromServer, getDocs },
  defaultCompanyId: COMPANY_ID, hasCanonicalCompanyIds
});
onAuthStateChanged(auth, () => campaignStats.invalidate());
