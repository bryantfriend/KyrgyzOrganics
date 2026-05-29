import resultHelpers from "../../../../engine/resultHelpers.js";

function emitOpenGamesDashboard(intent) {
  return emitGamesResult(intent);
}

function emitOpenGameDetail(intent) {
  return emitGamesResult(intent);
}

function emitLoadGameConfig(intent) {
  return emitGamesResult(intent);
}

function emitLoadGameSettings(intent) {
  return emitGamesResult(intent);
}

function emitSaveDailyLoginBonuses(intent) {
  return emitGamesResult(intent);
}

function emitLoadGameAnalytics(intent) {
  return emitGamesResult(intent);
}

function emitLoadSpinImages(intent) {
  return emitGamesResult(intent);
}

function emitAddSpinImage(intent) {
  return emitGamesResult(intent);
}

function emitRemoveSpinImage(intent) {
  return emitGamesResult(intent);
}

function emitOpenPayoutModal(intent) {
  return emitGamesResult(intent);
}

function emitClosePayoutModal(intent) {
  return emitGamesResult(intent);
}

function emitLoadPayoutRules(intent) {
  return emitGamesResult(intent);
}

function emitAddPayoutRule(intent) {
  return emitGamesResult(intent);
}

function emitUpdatePayoutRule(intent) {
  return emitGamesResult(intent);
}

function emitRemovePayoutRule(intent) {
  return emitGamesResult(intent);
}

function emitTogglePayoutRule(intent) {
  return emitGamesResult(intent);
}

function emitGamesResult(intent) {
  var eventType = intent.type.replace("Intent", "");

  intent.context.events = [
    {
      type: eventType,
      storeId: intent.payload.storeId || intent.context.storeId,
      gameId: intent.payload.gameId || intent.context.gameId,
      createdAt: Date.now()
    }
  ];

  return resultHelpers.success(intent);
}

export {
  emitOpenGamesDashboard,
  emitOpenGameDetail,
  emitLoadGameConfig,
  emitLoadGameSettings,
  emitSaveDailyLoginBonuses,
  emitLoadGameAnalytics,
  emitLoadSpinImages,
  emitAddSpinImage,
  emitRemoveSpinImage,
  emitOpenPayoutModal,
  emitClosePayoutModal,
  emitLoadPayoutRules,
  emitAddPayoutRule,
  emitUpdatePayoutRule,
  emitRemovePayoutRule,
  emitTogglePayoutRule
};
