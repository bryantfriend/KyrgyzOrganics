import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import resultHelpers from "../../../../engine/resultHelpers.js";
import {
  COLLECTION_NAME,
  countActiveRecords,
  findRecordById,
  normalizeRecord,
  sortRecords
} from "../../../Processors/domain/hamster/hamsterSpinImageHelpers.js";

function addLoadHamsterSpinImagesContext(intent) {
  return resultHelpers.success(intent);
}

function addAddHamsterSpinImageContext(intent) {
  return resultHelpers.success(intent);
}

async function addRemoveHamsterSpinImageContext(intent) {
  return addTargetSpinImageContext(intent);
}

async function addUpdateHamsterSpinImageContext(intent) {
  return addTargetSpinImageContext(intent);
}

async function addTargetSpinImageContext(intent) {
  var records = await loadCompanySpinImageRecords(intent.context.db, intent.context.companyId, true);
  var imageId = String(intent.payload.id || "");

  intent.context.spinImageRecords = records;
  intent.context.activeSpinImageCount = countActiveRecords(records);
  intent.context.targetSpinImage = imageId ? findRecordById(records, imageId) : null;

  return resultHelpers.success(intent);
}

async function loadCompanySpinImageRecords(db, companyId, includeInactive) {
  var records = [];
  var q;
  var snap;
  var docIndex;

  if (includeInactive) {
    q = query(collection(db, COLLECTION_NAME), where("companyId", "==", companyId));
  } else {
    q = query(collection(db, COLLECTION_NAME), where("active", "==", true));
  }

  snap = await getDocs(q);

  docIndex = 0;
  while (docIndex < snap.docs.length) {
    var docSnap = snap.docs[docIndex];
    var data = docSnap.data() || {};

    if (data.companyId === companyId) {
      records.push(normalizeRecord(docSnap.id, data));
    }

    docIndex = docIndex + 1;
  }

  sortRecords(records);

  return records;
}

export {
  addLoadHamsterSpinImagesContext,
  addAddHamsterSpinImageContext,
  addRemoveHamsterSpinImageContext,
  addUpdateHamsterSpinImageContext,
  loadCompanySpinImageRecords
};
