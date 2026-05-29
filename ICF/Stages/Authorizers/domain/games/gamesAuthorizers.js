import resultHelpers from "../../../../engine/resultHelpers.js";

function authorizeOpenGamesDashboard(intent) {
  return authorizeAdminActor(intent);
}

function authorizeOpenGameDetail(intent) {
  return authorizeAdminActor(intent);
}

function authorizeLoadGameConfig(intent) {
  return authorizeAdminActor(intent);
}

function authorizeLoadGameSettings(intent) {
  return authorizeReadOnlyGameActor(intent);
}

function authorizeSaveDailyLoginBonuses(intent) {
  return authorizeAdminActor(intent);
}

function authorizeLoadGameAnalytics(intent) {
  return authorizeAdminActor(intent);
}

function authorizeLoadSpinImages(intent) {
  return authorizeReadOnlyGameActor(intent);
}

function authorizeAddSpinImage(intent) {
  return authorizeAdminActor(intent);
}

function authorizeRemoveSpinImage(intent) {
  return authorizeAdminActor(intent);
}

function authorizeOpenPayoutModal(intent) {
  return authorizeAdminActor(intent);
}

function authorizeClosePayoutModal(intent) {
  return authorizeAdminActor(intent);
}

function authorizeLoadPayoutRules(intent) {
  return authorizeReadOnlyGameActor(intent);
}

function authorizeAddPayoutRule(intent) {
  return authorizeAdminActor(intent);
}

function authorizeUpdatePayoutRule(intent) {
  return authorizeAdminActor(intent);
}

function authorizeRemovePayoutRule(intent) {
  return authorizeAdminActor(intent);
}

function authorizeTogglePayoutRule(intent) {
  return authorizeAdminActor(intent);
}

function authorizeReadOnlyGameActor(intent) {
  var source = intent.context && intent.context.source ? intent.context.source : "admin";
  var role = getActorRole(intent);

  if (source === "game" && (role === "system" || role === "admin" || role === "superadmin")) {
    return resultHelpers.success(intent);
  }

  return authorizeAdminActor(intent);
}

function authorizeAdminActor(intent) {
  var role = getActorRole(intent);

  if (role === "admin" || role === "superadmin") {
    return resultHelpers.success(intent);
  }

  return resultHelpers.authorizationFailure("Only admins can manage games.");
}

function getActorRole(intent) {
  if (!intent.actor || !intent.actor.role) {
    return "";
  }

  return String(intent.actor.role);
}

export {
  authorizeOpenGamesDashboard,
  authorizeOpenGameDetail,
  authorizeLoadGameConfig,
  authorizeLoadGameSettings,
  authorizeSaveDailyLoginBonuses,
  authorizeLoadGameAnalytics,
  authorizeLoadSpinImages,
  authorizeAddSpinImage,
  authorizeRemoveSpinImage,
  authorizeOpenPayoutModal,
  authorizeClosePayoutModal,
  authorizeLoadPayoutRules,
  authorizeAddPayoutRule,
  authorizeUpdatePayoutRule,
  authorizeRemovePayoutRule,
  authorizeTogglePayoutRule
};
