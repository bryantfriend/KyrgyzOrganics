import resultHelpers from "../../../../engine/resultHelpers.js";

function normalizeLoadHamsterSpinImages(intent) {
  return normalizeHamsterSpinPayload(intent);
}

function normalizeAddHamsterSpinImage(intent) {
  return normalizeHamsterSpinPayload(intent);
}

function normalizeRemoveHamsterSpinImage(intent) {
  return normalizeHamsterSpinPayload(intent);
}

function normalizeUpdateHamsterSpinImage(intent) {
  return normalizeHamsterSpinPayload(intent);
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

  return resultHelpers.success(intent);
}

export {
  normalizeLoadHamsterSpinImages,
  normalizeAddHamsterSpinImage,
  normalizeRemoveHamsterSpinImage,
  normalizeUpdateHamsterSpinImage
};
