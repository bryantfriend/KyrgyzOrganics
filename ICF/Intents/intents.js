// ICF/Intents/intents.js

import intentRegistry from "../Engine/intentRegistry.js";

import demoIntentModule from "./DemoIntent.js";
import gamesIntentModule from "./GamesIntent.js";

/**
 * Registers all project Intents.
 *
 * Add new Intent registrations here as the project grows.
 *
 * @returns {Object} Registration result.
 */
function registerProjectIntents() {
  return intentRegistry.registerIntents({
    DemoIntent: demoIntentModule.createDemoIntent,
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
    TogglePayoutRuleIntent: gamesIntentModule.createTogglePayoutRuleIntent
  });
}

export default {
  registerProjectIntents: registerProjectIntents
};
