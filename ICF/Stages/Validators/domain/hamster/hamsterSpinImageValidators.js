import resultHelpers from "../../../../engine/resultHelpers.js";

function validateLoadHamsterSpinImages(intent) {
  return validateBaseHamsterSpinImageShape(intent);
}

function validateAddHamsterSpinImage(intent) {
  var errors = getBaseErrors(intent);
  var payload = intent.payload || {};

  if (!payload.imageUrl) {
    errors.push("Image URL is required.");
  }

  if (payload.imageUrl && typeof payload.imageUrl !== "string") {
    errors.push("Image URL must be text.");
  }

  return createValidationResult(intent, errors);
}

function validateRemoveHamsterSpinImage(intent) {
  var errors = getBaseErrors(intent);
  var payload = intent.payload || {};

  if (!payload.id) {
    errors.push("Spin image id is required.");
  }

  return createValidationResult(intent, errors);
}

function validateUpdateHamsterSpinImage(intent) {
  var errors = getBaseErrors(intent);
  var payload = intent.payload || {};

  if (!payload.id) {
    errors.push("Spin image id is required.");
  }

  if (payload.imageUrl && typeof payload.imageUrl !== "string") {
    errors.push("Image URL must be text.");
  }

  return createValidationResult(intent, errors);
}

function validateBaseHamsterSpinImageShape(intent) {
  return createValidationResult(intent, getBaseErrors(intent));
}

function getBaseErrors(intent) {
  var errors = [];

  if (!intent.actor) {
    errors.push("Intent actor is required.");
  }

  if (!intent.payload) {
    errors.push("Intent payload is required.");
  }

  if (!intent.context) {
    errors.push("Intent context is required.");
    return errors;
  }

  if (!intent.context.db) {
    errors.push("Firestore database context is required.");
  }

  if (!intent.context.companyId) {
    errors.push("Company context is required.");
  }

  return errors;
}

function createValidationResult(intent, errors) {
  if (errors.length > 0) {
    return resultHelpers.validationFailure(errors);
  }

  return resultHelpers.success(intent);
}

export {
  validateLoadHamsterSpinImages,
  validateAddHamsterSpinImage,
  validateRemoveHamsterSpinImage,
  validateUpdateHamsterSpinImage
};
