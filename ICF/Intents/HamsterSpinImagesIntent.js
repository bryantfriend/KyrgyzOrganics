import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

var COLLECTION_NAME = "hamster_spin_images";
var MIN_ACTIVE_IMAGES = 4;
var MINIMUM_MESSAGE = "Spinning mode must have at least 4 pictures.";

function createLoadHamsterSpinImagesIntent(actor, payload, options) {
  return createHamsterSpinImagesIntent("LoadHamsterSpinImagesIntent", actor, payload, options);
}

function createAddHamsterSpinImageIntent(actor, payload, options) {
  return createHamsterSpinImagesIntent("AddHamsterSpinImageIntent", actor, payload, options);
}

function createRemoveHamsterSpinImageIntent(actor, payload, options) {
  return createHamsterSpinImagesIntent("RemoveHamsterSpinImageIntent", actor, payload, options);
}

function createUpdateHamsterSpinImageIntent(actor, payload, options) {
  return createHamsterSpinImagesIntent("UpdateHamsterSpinImageIntent", actor, payload, options);
}

function createHamsterSpinImagesIntent(type, actor, payload, options) {
  var safeOptions = getSafeOptions(options);

  return {
    type: type,
    actor: actor || { id: "unknown", role: "guest" },
    payload: payload || {},
    context: {
      db: safeOptions.db,
      companyId: safeOptions.companyId,
      fallbackImages: safeOptions.fallbackImages,
      minActiveImages: safeOptions.minActiveImages,
      collectionName: COLLECTION_NAME
    },
    meta: {
      createdAt: Date.now(),
      source: safeOptions.source
    },
    stages: {
      Validate: {
        validateBaseShape: validateBaseShape,
        validateHamsterSpinPayload: validateHamsterSpinPayload,
        validateRemovalMinimum: validateRemovalMinimum
      },

      Normalize: {
        normalizeHamsterSpinPayload: normalizeHamsterSpinPayload
      },

      AddContext: {
        addHamsterSpinImageContext: addHamsterSpinImageContext
      },

      Authorize: {
        authorizeHamsterSpinImageActor: authorizeHamsterSpinImageActor
      },

      Process: {
        processHamsterSpinImageIntent: processHamsterSpinImageIntent
      },

      Emit: {
        emitHamsterSpinImageResult: emitHamsterSpinImageResult
      }
    }
  };
}

function getSafeOptions(options) {
  var safeOptions = options || {};

  return {
    db: safeOptions.db || null,
    companyId: safeOptions.companyId || "kyrgyz-organics",
    fallbackImages: Array.isArray(safeOptions.fallbackImages) ? safeOptions.fallbackImages : [],
    minActiveImages: safeOptions.minActiveImages || MIN_ACTIVE_IMAGES,
    source: safeOptions.source || "system"
  };
}

function validateBaseShape(intent) {
  var errors = [];

  if (!intent.actor) {
    errors.push("Intent actor is required.");
  }

  if (!intent.payload) {
    errors.push("Intent payload is required.");
  }

  if (!intent.context) {
    errors.push("Intent context is required.");
  }

  if (!intent.context.db) {
    errors.push("Firestore database context is required.");
  }

  if (!intent.context.companyId) {
    errors.push("Company context is required.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors
    };
  }

  return {
    ok: true,
    intent: intent
  };
}

function validateHamsterSpinPayload(intent) {
  var errors = [];
  var payload = intent.payload || {};

  if (intent.type === "AddHamsterSpinImageIntent" || intent.type === "UpdateHamsterSpinImageIntent") {
    if (intent.type === "AddHamsterSpinImageIntent" && !payload.imageUrl) {
      errors.push("Image URL is required.");
    }

    if (payload.imageUrl && typeof payload.imageUrl !== "string") {
      errors.push("Image URL must be text.");
    }
  }

  if (intent.type === "RemoveHamsterSpinImageIntent" || intent.type === "UpdateHamsterSpinImageIntent") {
    if (!payload.id) {
      errors.push("Spin image id is required.");
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors
    };
  }

  return {
    ok: true,
    intent: intent
  };
}

async function validateRemovalMinimum(intent) {
  if (intent.type !== "RemoveHamsterSpinImageIntent" && !isDeactivatingUpdate(intent)) {
    return {
      ok: true,
      intent: intent
    };
  }

  var db = intent.context.db;
  var companyId = intent.context.companyId;
  var imageId = String(intent.payload.id || "");
  var records = await loadCompanySpinImageRecords(db, companyId, true);
  var activeCount = countActiveRecords(records);
  var targetRecord = findRecordById(records, imageId);

  if (targetRecord && targetRecord.active !== false && activeCount <= getMinimum(intent)) {
    return {
      ok: false,
      errors: [
        MINIMUM_MESSAGE
      ]
    };
  }

  return {
    ok: true,
    intent: intent
  };
}

function normalizeHamsterSpinPayload(intent) {
  var payload = intent.payload || {};
  var normalizedPayload = {};
  var key;

  for (key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      normalizedPayload[key] = payload[key];
    }
  }

  if (normalizedPayload.id) {
    normalizedPayload.id = String(normalizedPayload.id).trim();
  }

  if (normalizedPayload.imageUrl) {
    normalizedPayload.imageUrl = String(normalizedPayload.imageUrl).trim();
  }

  if (normalizedPayload.label) {
    normalizedPayload.label = String(normalizedPayload.label).trim();
  }

  if (!normalizedPayload.label && normalizedPayload.imageUrl) {
    normalizedPayload.label = "Spin picture";
  }

  if (Object.prototype.hasOwnProperty.call(normalizedPayload, "active")) {
    normalizedPayload.active = normalizedPayload.active === true;
  }

  if (Object.prototype.hasOwnProperty.call(normalizedPayload, "sortOrder")) {
    normalizedPayload.sortOrder = Number(normalizedPayload.sortOrder);
    if (!Number.isFinite(normalizedPayload.sortOrder)) {
      normalizedPayload.sortOrder = Date.now();
    }
  }

  intent.payload = normalizedPayload;

  return {
    ok: true,
    intent: intent
  };
}

async function addHamsterSpinImageContext(intent) {
  if (intent.type === "LoadHamsterSpinImagesIntent") {
    return {
      ok: true,
      intent: intent
    };
  }

  var db = intent.context.db;
  var companyId = intent.context.companyId;
  var records = await loadCompanySpinImageRecords(db, companyId, true);
  var imageId = String(intent.payload.id || "");

  intent.context.spinImageRecords = records;
  intent.context.activeSpinImageCount = countActiveRecords(records);
  intent.context.targetSpinImage = imageId ? findRecordById(records, imageId) : null;

  return {
    ok: true,
    intent: intent
  };
}

function authorizeHamsterSpinImageActor(intent) {
  if (intent.type === "LoadHamsterSpinImagesIntent") {
    return {
      ok: true,
      intent: intent
    };
  }

  if (!isAdminActor(intent.actor)) {
    return {
      ok: false,
      errors: [
        "Only admins can manage hamster spin images."
      ]
    };
  }

  return {
    ok: true,
    intent: intent
  };
}

async function processHamsterSpinImageIntent(intent) {
  if (intent.type === "LoadHamsterSpinImagesIntent") {
    return processLoadHamsterSpinImages(intent);
  }

  if (intent.type === "AddHamsterSpinImageIntent") {
    return processAddHamsterSpinImage(intent);
  }

  if (intent.type === "RemoveHamsterSpinImageIntent") {
    return processRemoveHamsterSpinImage(intent);
  }

  if (intent.type === "UpdateHamsterSpinImageIntent") {
    return processUpdateHamsterSpinImage(intent);
  }

  return {
    ok: false,
    errors: [
      "Unknown hamster spin image Intent."
    ]
  };
}

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

  return {
    ok: true,
    intent: intent
  };
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

  // Spin images are added through ICF so every Firestore mutation has validation,
  // context, authorization, processing, and emitted result data.
  await setDoc(imageRef, record);

  intent.context.resultData = {
    image: copyPublicRecord(record),
    message: "Spin image added."
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processRemoveHamsterSpinImage(intent) {
  var target = intent.context.targetSpinImage;

  if (!target) {
    return {
      ok: false,
      errors: [
        "Spin image was not found."
      ]
    };
  }

  if (target.active !== false && intent.context.activeSpinImageCount <= getMinimum(intent)) {
    return {
      ok: false,
      errors: [
        MINIMUM_MESSAGE
      ]
    };
  }

  // Removing a spin image means deactivating the managed record; the image stays
  // auditable while the game stops using it for spinning mode.
  await updateDoc(doc(intent.context.db, COLLECTION_NAME, target.id), {
    active: false,
    updatedAt: serverTimestamp()
  });

  intent.context.resultData = {
    id: target.id,
    message: "Spin image removed."
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processUpdateHamsterSpinImage(intent) {
  var target = intent.context.targetSpinImage;
  var payload = intent.payload;
  var data = {
    updatedAt: serverTimestamp()
  };

  if (!target) {
    return {
      ok: false,
      errors: [
        "Spin image was not found."
      ]
    };
  }

  if (Object.prototype.hasOwnProperty.call(payload, "active") && payload.active === false) {
    if (target.active !== false && intent.context.activeSpinImageCount <= getMinimum(intent)) {
      return {
        ok: false,
        errors: [
          MINIMUM_MESSAGE
        ]
      };
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

  // Spin image edits are validated here before updating the managed Firestore doc.
  await updateDoc(doc(intent.context.db, COLLECTION_NAME, target.id), data);

  intent.context.resultData = {
    id: target.id,
    message: "Spin image updated."
  };

  return {
    ok: true,
    intent: intent
  };
}

function emitHamsterSpinImageResult(intent) {
  if (!intent.context.events) {
    intent.context.events = [];
  }

  intent.context.events.push({
    type: intent.type + "Completed",
    companyId: intent.context.companyId,
    timestamp: Date.now()
  });

  return {
    ok: true,
    intent: intent
  };
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

function normalizeRecord(id, data) {
  return {
    id: data.id || id,
    imageUrl: data.imageUrl || "",
    label: data.label || data.name || "Spin picture",
    active: data.active !== false,
    sortOrder: Number(data.sortOrder || 0),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    source: "firestore"
  };
}

function normalizeFallbackImages(images) {
  var normalized = [];
  var index = 0;

  while (index < images.length) {
    var item = images[index] || {};
    normalized.push({
      id: item.id || "fallback_" + index,
      imageUrl: item.imageUrl || item.img || "",
      label: item.label || item.name || "Spin picture",
      active: item.active !== false,
      sortOrder: Number(item.sortOrder || index),
      fallback: item.fallback || "🎁",
      source: "fallback"
    });
    index = index + 1;
  }

  sortRecords(normalized);

  return normalized;
}

function sortRecords(records) {
  records.sort(compareRecords);
}

function compareRecords(left, right) {
  var leftOrder = Number(left.sortOrder || 0);
  var rightOrder = Number(right.sortOrder || 0);

  if (leftOrder < rightOrder) {
    return -1;
  }

  if (leftOrder > rightOrder) {
    return 1;
  }

  return String(left.label || "").localeCompare(String(right.label || ""));
}

function getActiveRecords(records) {
  var active = [];
  var index = 0;

  while (index < records.length) {
    if (records[index].active !== false) {
      active.push(records[index]);
    }
    index = index + 1;
  }

  return active;
}

function countActiveRecords(records) {
  return getActiveRecords(records).length;
}

function findRecordById(records, id) {
  var index = 0;

  while (index < records.length) {
    if (String(records[index].id) === String(id)) {
      return records[index];
    }
    index = index + 1;
  }

  return null;
}

function isDeactivatingUpdate(intent) {
  return intent.type === "UpdateHamsterSpinImageIntent"
    && intent.payload
    && intent.payload.active === false;
}

function isAdminActor(actor) {
  var role = "";

  if (actor && actor.role) {
    role = String(actor.role).toLowerCase();
  }

  return role === "admin" || role === "superadmin" || role === "super_admin";
}

function getMinimum(intent) {
  return Number(intent.context.minActiveImages || MIN_ACTIVE_IMAGES);
}

function copyPublicRecord(record) {
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    label: record.label,
    active: record.active,
    sortOrder: record.sortOrder
  };
}

export default {
  createLoadHamsterSpinImagesIntent: createLoadHamsterSpinImagesIntent,
  createAddHamsterSpinImageIntent: createAddHamsterSpinImageIntent,
  createRemoveHamsterSpinImageIntent: createRemoveHamsterSpinImageIntent,
  createUpdateHamsterSpinImageIntent: createUpdateHamsterSpinImageIntent
};
