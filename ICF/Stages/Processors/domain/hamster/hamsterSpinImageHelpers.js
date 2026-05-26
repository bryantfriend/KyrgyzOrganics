var COLLECTION_NAME = "hamster_spin_images";
var MIN_ACTIVE_IMAGES = 4;
var MINIMUM_MESSAGE = "Spinning mode must have at least 4 pictures.";

function createHamsterSpinImageContext(options) {
  var safeOptions = options || {};

  return {
    db: safeOptions.db || null,
    companyId: safeOptions.companyId || "kyrgyz-organics",
    fallbackImages: Array.isArray(safeOptions.fallbackImages) ? safeOptions.fallbackImages : [],
    minActiveImages: safeOptions.minActiveImages || MIN_ACTIVE_IMAGES,
    collectionName: COLLECTION_NAME
  };
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

export {
  COLLECTION_NAME,
  MIN_ACTIVE_IMAGES,
  MINIMUM_MESSAGE,
  createHamsterSpinImageContext,
  normalizeRecord,
  normalizeFallbackImages,
  sortRecords,
  getActiveRecords,
  countActiveRecords,
  findRecordById,
  isAdminActor,
  getMinimum,
  copyPublicRecord
};
