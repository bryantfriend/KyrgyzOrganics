import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  writeBatch,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COMPANY_ID = "kyrgyz-organics";
const BATCH_LIMIT = 400;
const RUN_PARAM = "runCompanyIdMigration";

const COLLECTIONS_TO_MIGRATE = [
  "products",
  "categories",
  "inventory",
  "orders",
  "banners",
  "payment_methods",
  "pages",
  "shop_settings",
  "campaigns",
  "campaign_events",
  "inventory_templates",
  "audit_logs"
];

async function migrateCollection(collectionName) {
  console.log(`Migrating ${collectionName}...`);

  const snap = await getDocs(collection(db, collectionName));
  let batch = writeBatch(db);
  let count = 0;
  let totalUpdated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (!data.companyId) {
      const ref = doc(db, collectionName, docSnap.id);

      batch.update(ref, {
        companyId: COMPANY_ID
      });

      count++;
      totalUpdated++;

      if (count >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`Committed batch of ${count} for ${collectionName}`);
        batch = writeBatch(db);
        count = 0;
      }
    } else {
      skipped++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${count} for ${collectionName}`);
  }

  console.log(`Finished ${collectionName}: ${totalUpdated} updated, ${skipped} already had companyId`);
  return totalUpdated;
}

async function runMigration() {
  console.log(`Starting companyId migration to "${COMPANY_ID}"...`);

  let totalUpdated = 0;

  for (const collectionName of COLLECTIONS_TO_MIGRATE) {
    totalUpdated += await migrateCollection(collectionName);
  }

  console.log(`Migration complete. Total documents updated: ${totalUpdated}`);
}

function shouldRunMigration() {
  const params = new URLSearchParams(window.location.search);
  return params.get(RUN_PARAM) === "true";
}

if (shouldRunMigration()) {
  const confirmed = window.confirm(
    `Run one-time companyId migration?\n\nThis will add companyId="${COMPANY_ID}" to documents missing companyId. Existing companyId values will not be changed.`
  );

  if (confirmed) {
    runMigration().catch((error) => {
      console.error("Migration failed:", error);
    });
  } else {
    console.log("Migration cancelled by user.");
  }
} else {
  console.log(`CompanyId migration script loaded but not run. Add ?${RUN_PARAM}=true to the URL to run it.`);
}
