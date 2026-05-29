import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import resultHelpers from "../../../../engine/resultHelpers.js";
import {
  COLLECTION_NAME,
  MINIMUM_MESSAGE,
  copyPublicRecord,
  getActiveRecords,
  getMinimum,
  normalizeFallbackImages
} from "./hamsterSpinImageHelpers.js";
import { loadCompanySpinImageRecords } from "../../../ContextProviders/domain/hamster/hamsterSpinImageContextProviders.js";

async function processLoadHamsterSpinImages(intent) {
  var includeInactive = intent.payload && intent.payload.includeInactive === true;
  var records = await loadCompanySpinImageRecords(intent.context.db, intent.context.companyId, includeInactive);
  var activeRecords = getActiveRecords(records);
  var source = "firestore";
  var images = activeRecords;

  if (activeRecords.length < getMinimum(intent)) {
    images = normalizeFallbackImages(intent.context.fallbackImages);
    source = "fallback";
  }

  intent.context.resultData = {
    images: images,
    managedImages: records,
    activeCount: activeRecords.length,
    source: source,
    minActiveImages: getMinimum(intent),
    collection: COLLECTION_NAME
  };

  return resultHelpers.success(intent);
}

async function processAddHamsterSpinImage(intent) {
  var db = intent.context.db;
  var payload = intent.payload;
  var imageRef = doc(collection(db, COLLECTION_NAME));
  var now = serverTimestamp();
  var sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : Date.now();
  var record = {
    id: imageRef.id,
    companyId: intent.context.companyId,
    imageUrl: payload.imageUrl,
    label: payload.label || "Spin picture",
    active: true,
    sortOrder: sortOrder,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(imageRef, record);

  intent.context.resultData = {
    image: copyPublicRecord(record),
    message: "Spin image added."
  };

  return resultHelpers.success(intent);
}

async function processRemoveHamsterSpinImage(intent) {
  var target = intent.context.targetSpinImage;

  if (!target) {
    return resultHelpers.processFailure(["Spin image was not found."]);
  }

  if (target.active !== false && intent.context.activeSpinImageCount <= getMinimum(intent)) {
    return resultHelpers.processFailure([MINIMUM_MESSAGE]);
  }

  await updateDoc(doc(intent.context.db, COLLECTION_NAME, target.id), {
    active: false,
    updatedAt: serverTimestamp()
  });

  intent.context.resultData = {
    id: target.id,
    message: "Spin image removed."
  };

  return resultHelpers.success(intent);
}

async function processUpdateHamsterSpinImage(intent) {
  var target = intent.context.targetSpinImage;
  var payload = intent.payload;
  var data = {
    updatedAt: serverTimestamp()
  };

  if (!target) {
    return resultHelpers.processFailure(["Spin image was not found."]);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "active") && payload.active === false) {
    if (target.active !== false && intent.context.activeSpinImageCount <= getMinimum(intent)) {
      return resultHelpers.processFailure([MINIMUM_MESSAGE]);
    }
  }

  if (payload.imageUrl) {
    data.imageUrl = payload.imageUrl;
  }

  if (payload.label) {
    data.label = payload.label;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "active")) {
    data.active = payload.active;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "sortOrder")) {
    data.sortOrder = payload.sortOrder;
  }

  await updateDoc(doc(intent.context.db, COLLECTION_NAME, target.id), data);

  intent.context.resultData = {
    id: target.id,
    message: "Spin image updated."
  };

  return resultHelpers.success(intent);
}

export {
  processLoadHamsterSpinImages,
  processAddHamsterSpinImage,
  processRemoveHamsterSpinImage,
  processUpdateHamsterSpinImage
};
