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
    LoadSpinImagesIntent: gamesIntentModule.createLoadSpinImagesIntent,
    AddSpinImageIntent: gamesIntentModule.createAddSpinImageIntent,
    RemoveSpinImageIntent: gamesIntentModule.createRemoveSpinImageIntent,
    OpenPayoutModalIntent: gamesIntentModule.createOpenPayoutModalIntent,
    ClosePayoutModalIntent: gamesIntentModule.createClosePayoutModalIntent
  });
}

export default {
  registerProjectIntents: registerProjectIntents
};
