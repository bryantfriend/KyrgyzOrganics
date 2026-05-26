import resultHelpers from "../../../../Engine/resultHelpers.js";
import {
  isValidRewardType,
  validateDailyLoginBonuses
} from "../../../Processors/domain/games/gamesHelpers.js";

function validateOpenGamesDashboard(intent) {
  return resultHelpers.success(intent);
}

function validateOpenGameDetail(intent) {
  return validateStoreAndGame(intent);
}

function validateLoadGameConfig(intent) {
  return validateStoreGameAndDb(intent);
}

function validateLoadGameSettings(intent) {
  return validateStoreGameAndDb(intent);
}

function validateSaveDailyLoginBonuses(intent) {
  var errors = getStoreGameAndDbErrors(intent);
  var payload = intent.payload || {};

  if (!Array.isArray(payload.dailyLoginBonuses)) {
    errors.push("dailyLoginBonuses must be a list.");
  }

  validateDailyLoginBonuses(errors, payload.dailyLoginBonuses || []);

  return createValidationResult(intent, errors);
}

function validateLoadGameAnalytics(intent) {
  return validateStoreGameAndDb(intent);
}

function validateLoadSpinImages(intent) {
  return validateStoreGameAndDb(intent);
}

function validateAddSpinImage(intent) {
  var errors = getStoreGameAndDbErrors(intent);
  var payload = intent.payload || {};

  if (!payload.imageUrl) {
    errors.push("imageUrl is required when adding a spin picture.");
  }

  return createValidationResult(intent, errors);
}

function validateRemoveSpinImage(intent) {
  var errors = getStoreGameAndDbErrors(intent);
  var payload = intent.payload || {};

  if (!payload.id) {
    errors.push("Spin image id is required.");
  }

  return createValidationResult(intent, errors);
}

function validateOpenPayoutModal(intent) {
  return validateStoreAndGame(intent);
}

function validateClosePayoutModal(intent) {
  return validateStoreAndGame(intent);
}

function validateLoadPayoutRules(intent) {
  return validateStoreGameAndDb(intent);
}

function validateAddPayoutRule(intent) {
  var errors = getStoreGameAndDbErrors(intent);

  validatePayoutRuleFields(errors, intent.payload || {}, true);

  return createValidationResult(intent, errors);
}

function validateUpdatePayoutRule(intent) {
  var errors = getStoreGameAndDbErrors(intent);
  var payload = intent.payload || {};

  if (!payload.id) {
    errors.push("Payout rule id is required.");
  }

  validatePayoutRuleFields(errors, payload, true);

  return createValidationResult(intent, errors);
}

function validateRemovePayoutRule(intent) {
  var errors = getStoreGameAndDbErrors(intent);
  var payload = intent.payload || {};

  if (!payload.id) {
    errors.push("Payout rule id is required.");
  }

  validateOptionalPayoutNumbers(errors, payload);

  return createValidationResult(intent, errors);
}

function validateTogglePayoutRule(intent) {
  var errors = getStoreGameAndDbErrors(intent);
  var payload = intent.payload || {};

  if (!payload.id) {
    errors.push("Payout rule id is required.");
  }

  validateOptionalPayoutNumbers(errors, payload);

  return createValidationResult(intent, errors);
}

function validateStoreAndGame(intent) {
  return createValidationResult(intent, getStoreGameErrors(intent));
}

function validateStoreGameAndDb(intent) {
  return createValidationResult(intent, getStoreGameAndDbErrors(intent));
}

function getStoreGameAndDbErrors(intent) {
  var errors = getStoreGameErrors(intent);

  if (!intent.context || !intent.context.db) {
    errors.push("Firestore database context is required.");
  }

  return errors;
}

function getStoreGameErrors(intent) {
  var errors = [];
  var payload = intent.payload || {};
  var context = intent.context || {};

  if (!payload.storeId && !context.storeId) {
    errors.push("storeId is required.");
  }

  if (!payload.gameId && !context.gameId) {
    errors.push("gameId is required.");
  }

  return errors;
}

function validatePayoutRuleFields(errors, payload, requireCoreFields) {
  if (requireCoreFields && !payload.rewardName) {
    errors.push("rewardName is required.");
  }

  if (requireCoreFields && !isValidRewardType(payload.rewardType)) {
    errors.push("rewardType is invalid.");
  }

  if (requireCoreFields && payload.requiredMatches === undefined) {
    errors.push("requiredMatches is required.");
  }

  if (requireCoreFields && payload.payoutAmount === undefined) {
    errors.push("payoutAmount is required.");
  }

  validateOptionalPayoutNumbers(errors, payload);
}

function validateOptionalPayoutNumbers(errors, payload) {
  if (payload.requiredMatches !== undefined && (!isFinite(Number(payload.requiredMatches)) || Number(payload.requiredMatches) <= 0)) {
    errors.push("requiredMatches must be a positive number.");
  }

  if (payload.payoutAmount !== undefined && (!isFinite(Number(payload.payoutAmount)) || Number(payload.payoutAmount) < 0)) {
    errors.push("payoutAmount must be a non-negative number.");
  }
}

function createValidationResult(intent, errors) {
  if (errors.length > 0) {
    return resultHelpers.validationFailure(errors);
  }

  return resultHelpers.success(intent);
}

export {
  validateOpenGamesDashboard,
  validateOpenGameDetail,
  validateLoadGameConfig,
  validateLoadGameSettings,
  validateSaveDailyLoginBonuses,
  validateLoadGameAnalytics,
  validateLoadSpinImages,
  validateAddSpinImage,
  validateRemoveSpinImage,
  validateOpenPayoutModal,
  validateClosePayoutModal,
  validateLoadPayoutRules,
  validateAddPayoutRule,
  validateUpdatePayoutRule,
  validateRemovePayoutRule,
  validateTogglePayoutRule
};
