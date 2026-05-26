import OpenGamesDashboardIntent from "../Intents/Games/OpenGamesDashboardIntent.js";
import OpenGameDetailIntent from "../Intents/Games/OpenGameDetailIntent.js";
import LoadGameConfigIntent from "../Intents/Games/LoadGameConfigIntent.js";
import LoadGameSettingsIntent from "../Intents/Games/LoadGameSettingsIntent.js";
import SaveDailyLoginBonusesIntent from "../Intents/Games/SaveDailyLoginBonusesIntent.js";
import LoadGameAnalyticsIntent from "../Intents/Games/LoadGameAnalyticsIntent.js";
import LoadSpinImagesIntent from "../Intents/Games/LoadSpinImagesIntent.js";
import AddSpinImageIntent from "../Intents/Games/AddSpinImageIntent.js";
import RemoveSpinImageIntent from "../Intents/Games/RemoveSpinImageIntent.js";
import OpenPayoutModalIntent from "../Intents/Games/OpenPayoutModalIntent.js";
import ClosePayoutModalIntent from "../Intents/Games/ClosePayoutModalIntent.js";
import LoadPayoutRulesIntent from "../Intents/Games/LoadPayoutRulesIntent.js";
import AddPayoutRuleIntent from "../Intents/Games/AddPayoutRuleIntent.js";
import UpdatePayoutRuleIntent from "../Intents/Games/UpdatePayoutRuleIntent.js";
import RemovePayoutRuleIntent from "../Intents/Games/RemovePayoutRuleIntent.js";
import TogglePayoutRuleIntent from "../Intents/Games/TogglePayoutRuleIntent.js";
import { createGamesBaseContext } from "../Stages/Processors/domain/games/gamesHelpers.js";

function createOpenGamesDashboardIntent(actor, payload, options) {
  return createIntentFromDefinition(OpenGamesDashboardIntent, actor, payload, options);
}

function createOpenGameDetailIntent(actor, payload, options) {
  return createIntentFromDefinition(OpenGameDetailIntent, actor, payload, options);
}

function createLoadGameConfigIntent(actor, payload, options) {
  return createIntentFromDefinition(LoadGameConfigIntent, actor, payload, options);
}

function createLoadGameSettingsIntent(actor, payload, options) {
  return createIntentFromDefinition(LoadGameSettingsIntent, actor, payload, options);
}

function createSaveDailyLoginBonusesIntent(actor, payload, options) {
  return createIntentFromDefinition(SaveDailyLoginBonusesIntent, actor, payload, options);
}

function createLoadGameAnalyticsIntent(actor, payload, options) {
  return createIntentFromDefinition(LoadGameAnalyticsIntent, actor, payload, options);
}

function createLoadSpinImagesIntent(actor, payload, options) {
  return createIntentFromDefinition(LoadSpinImagesIntent, actor, payload, options);
}

function createAddSpinImageIntent(actor, payload, options) {
  return createIntentFromDefinition(AddSpinImageIntent, actor, payload, options);
}

function createRemoveSpinImageIntent(actor, payload, options) {
  return createIntentFromDefinition(RemoveSpinImageIntent, actor, payload, options);
}

function createOpenPayoutModalIntent(actor, payload, options) {
  return createIntentFromDefinition(OpenPayoutModalIntent, actor, payload, options);
}

function createClosePayoutModalIntent(actor, payload, options) {
  return createIntentFromDefinition(ClosePayoutModalIntent, actor, payload, options);
}

function createLoadPayoutRulesIntent(actor, payload, options) {
  return createIntentFromDefinition(LoadPayoutRulesIntent, actor, payload, options);
}

function createAddPayoutRuleIntent(actor, payload, options) {
  return createIntentFromDefinition(AddPayoutRuleIntent, actor, payload, options);
}

function createUpdatePayoutRuleIntent(actor, payload, options) {
  return createIntentFromDefinition(UpdatePayoutRuleIntent, actor, payload, options);
}

function createRemovePayoutRuleIntent(actor, payload, options) {
  return createIntentFromDefinition(RemovePayoutRuleIntent, actor, payload, options);
}

function createTogglePayoutRuleIntent(actor, payload, options) {
  return createIntentFromDefinition(TogglePayoutRuleIntent, actor, payload, options);
}

function createIntentFromDefinition(intentDefinition, actor, payload, options) {
  var safeOptions = options || {};

  return {
    type: intentDefinition.type,
    description: intentDefinition.description,
    actor: actor || { id: "unknown", role: "unknown" },
    payload: payload || {},
    context: createGamesBaseContext(safeOptions),
    meta: {
      createdAt: Date.now(),
      source: safeOptions.source || "admin"
    },
    stages: intentDefinition.stages
  };
}

export {
  createOpenGamesDashboardIntent,
  createOpenGameDetailIntent,
  createLoadGameConfigIntent,
  createLoadGameSettingsIntent,
  createSaveDailyLoginBonusesIntent,
  createLoadGameAnalyticsIntent,
  createLoadSpinImagesIntent,
  createAddSpinImageIntent,
  createRemoveSpinImageIntent,
  createOpenPayoutModalIntent,
  createClosePayoutModalIntent,
  createLoadPayoutRulesIntent,
  createAddPayoutRuleIntent,
  createUpdatePayoutRuleIntent,
  createRemovePayoutRuleIntent,
  createTogglePayoutRuleIntent
};

export default {
  createOpenGamesDashboardIntent: createOpenGamesDashboardIntent,
  createOpenGameDetailIntent: createOpenGameDetailIntent,
  createLoadGameConfigIntent: createLoadGameConfigIntent,
  createLoadGameSettingsIntent: createLoadGameSettingsIntent,
  createSaveDailyLoginBonusesIntent: createSaveDailyLoginBonusesIntent,
  createLoadGameAnalyticsIntent: createLoadGameAnalyticsIntent,
  createLoadSpinImagesIntent: createLoadSpinImagesIntent,
  createAddSpinImageIntent: createAddSpinImageIntent,
  createRemoveSpinImageIntent: createRemoveSpinImageIntent,
  createOpenPayoutModalIntent: createOpenPayoutModalIntent,
  createClosePayoutModalIntent: createClosePayoutModalIntent,
  createLoadPayoutRulesIntent: createLoadPayoutRulesIntent,
  createAddPayoutRuleIntent: createAddPayoutRuleIntent,
  createUpdatePayoutRuleIntent: createUpdatePayoutRuleIntent,
  createRemovePayoutRuleIntent: createRemovePayoutRuleIntent,
  createTogglePayoutRuleIntent: createTogglePayoutRuleIntent
};
