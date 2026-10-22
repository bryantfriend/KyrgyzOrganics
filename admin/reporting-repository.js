import { auth, db } from '../firebase-config.js';
import { collection, doc, getDoc, query, where, getDocs, getCountFromServer, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { hasCanonicalDates } from '../read-model-readiness.mjs';
import { createReportingRepository } from './reporting-repository.mjs';

// DO NOT enable canonicalDates until the documented backfill/writer/index gates pass.
// Compatibility reads preserve legacy missing fields without guessing their store.
export const reportingRepository = createReportingRepository({
  db,
  firestore: { collection, doc, getDoc, query, where, getDocs, getCountFromServer, orderBy, limit },
  hasCanonicalDates
});

// Report data must never be reused by a subsequent signed-in account.
onAuthStateChanged(auth, () => reportingRepository.invalidate());
