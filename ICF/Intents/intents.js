// ICF/Intents/intents.js

import intentRegistry from "../engine/intentRegistry.js";

import demoIntentModule from "./DemoIntent.js";
import gamesIntentModule from "./GamesIntent.js";
import hamsterSpinImagesIntentModule from "./HamsterSpinImagesIntent.js";

/**
 * Registers all project Intents.
 *
 * Add new Intent registrations here as the project grows.
 *
 * @returns {Object} Registration result.
 */
function registerProjectIntents() {
  return intentRegistry.registerIntents({
    DemoIntent: createDemoIntent,
    OpenGamesDashboardIntent: gamesIntentModule.createOpenGamesDashboardIntent,
    OpenGameDetailIntent: gamesIntentModule.createOpenGameDetailIntent,
    LoadGameConfigIntent: gamesIntentModule.createLoadGameConfigIntent,
    LoadGameSettingsIntent: gamesIntentModule.createLoadGameSettingsIntent,
    SaveDailyLoginBonusesIntent: gamesIntentModule.createSaveDailyLoginBonusesIntent,
    LoadGameAnalyticsIntent: gamesIntentModule.createLoadGameAnalyticsIntent,
    LoadSpinImagesIntent: gamesIntentModule.createLoadSpinImagesIntent,
    AddSpinImageIntent: gamesIntentModule.createAddSpinImageIntent,
    RemoveSpinImageIntent: gamesIntentModule.createRemoveSpinImageIntent,
    OpenPayoutModalIntent: gamesIntentModule.createOpenPayoutModalIntent,
    ClosePayoutModalIntent: gamesIntentModule.createClosePayoutModalIntent,
    LoadPayoutRulesIntent: gamesIntentModule.createLoadPayoutRulesIntent,
    AddPayoutRuleIntent: gamesIntentModule.createAddPayoutRuleIntent,
    UpdatePayoutRuleIntent: gamesIntentModule.createUpdatePayoutRuleIntent,
    RemovePayoutRuleIntent: gamesIntentModule.createRemovePayoutRuleIntent,
    TogglePayoutRuleIntent: gamesIntentModule.createTogglePayoutRuleIntent,
    LoadHamsterSpinImagesIntent: hamsterSpinImagesIntentModule.createLoadHamsterSpinImagesIntent,
    AddHamsterSpinImageIntent: hamsterSpinImagesIntentModule.createAddHamsterSpinImageIntent,
    RemoveHamsterSpinImageIntent: hamsterSpinImagesIntentModule.createRemoveHamsterSpinImageIntent,
    UpdateHamsterSpinImageIntent: hamsterSpinImagesIntentModule.createUpdateHamsterSpinImageIntent
  });
}

function createDemoIntent(actor, payload, options) {
  var safeOptions = options || {};

  return {
    type: demoIntentModule.type,
    description: demoIntentModule.description,
    actor: actor || { id: "system", role: "system" },
    payload: payload || {},
    context: safeOptions.context || {},
    meta: {
      createdAt: Date.now(),
      source: safeOptions.source || "system"
    },
    stages: demoIntentModule.stages
  };
}

export default {
  registerProjectIntents: registerProjectIntents
};
