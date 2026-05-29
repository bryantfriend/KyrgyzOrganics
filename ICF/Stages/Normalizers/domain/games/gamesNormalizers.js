import resultHelpers from "../../../../engine/resultHelpers.js";
import { normalizeDailyLoginBonuses } from "../../../Processors/domain/games/gamesHelpers.js";

function normalizeOpenGamesDashboard(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeOpenGameDetail(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeLoadGameConfig(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeLoadGameSettings(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeSaveDailyLoginBonuses(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeLoadGameAnalytics(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeLoadSpinImages(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeAddSpinImage(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeRemoveSpinImage(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeOpenPayoutModal(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeClosePayoutModal(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeLoadPayoutRules(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeAddPayoutRule(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeUpdatePayoutRule(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeRemovePayoutRule(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeTogglePayoutRule(intent) {
  return normalizeGamesPayload(intent);
}

function normalizeGamesPayload(intent) {
  var payload = intent.payload || {};
  var context = intent.context || {};
  var normalized = {};
  var key;

  for (key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      normalized[key] = payload[key];
    }
  }

  normalized.storeId = String(payload.storeId || context.storeId || "kyrgyz-organics").trim();
  normalized.gameId = String(payload.gameId || context.gameId || "hamster-spin").trim();

  trimTextField(normalized, payload, "imageUrl");
  trimTextField(normalized, payload, "label");
  trimTextField(normalized, payload, "rewardName");
  trimTextField(normalized, payload, "rewardType");
  trimTextField(normalized, payload, "matchType");
  trimTextField(normalized, payload, "payoutLabel");
  trimTextField(normalized, payload, "id");

  if (payload.active === false) {
    normalized.active = false;
  } else {
    normalized.active = true;
  }

  if (typeof payload.sortOrder === "number" && isFinite(payload.sortOrder)) {
    normalized.sortOrder = payload.sortOrder;
  }

  if (payload.requiredMatches !== undefined && isFinite(Number(payload.requiredMatches))) {
    normalized.requiredMatches = Number(payload.requiredMatches);
  }

  if (payload.payoutAmount !== undefined && isFinite(Number(payload.payoutAmount))) {
    normalized.payoutAmount = Number(payload.payoutAmount);
  }

  if (Array.isArray(payload.dailyLoginBonuses)) {
    normalized.dailyLoginBonuses = normalizeDailyLoginBonuses(payload.dailyLoginBonuses);
  }

  intent.payload = normalized;
  intent.context.storeId = normalized.storeId;
  intent.context.gameId = normalized.gameId;

  return resultHelpers.success(intent);
}

function trimTextField(normalized, payload, key) {
  if (typeof payload[key] === "string") {
    normalized[key] = payload[key].trim();
  }
}

export {
  normalizeOpenGamesDashboard,
  normalizeOpenGameDetail,
  normalizeLoadGameConfig,
  normalizeLoadGameSettings,
  normalizeSaveDailyLoginBonuses,
  normalizeLoadGameAnalytics,
  normalizeLoadSpinImages,
  normalizeAddSpinImage,
  normalizeRemoveSpinImage,
  normalizeOpenPayoutModal,
  normalizeClosePayoutModal,
  normalizeLoadPayoutRules,
  normalizeAddPayoutRule,
  normalizeUpdatePayoutRule,
  normalizeRemovePayoutRule,
  normalizeTogglePayoutRule
};
