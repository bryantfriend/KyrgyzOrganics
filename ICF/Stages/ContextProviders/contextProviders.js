// ICF/Stages/ContextProviders/contextProviders.js

import passContextModule from "./Core/passContext.js";
import passAddContextModule from "./Core/passAddContext.js";
import addTimestampContextModule from "./Core/addTimestampContext.js";
import addSourceContextModule from "./Core/addSourceContext.js";
import addActorRoleContextModule from "./Core/addActorRoleContext.js";
import addStaticContextValueModule from "./Core/addStaticContextValue.js";
import * as gamesContextProviders from "./domain/games/gamesContextProviders.js";
import * as hamsterSpinImageContextProviders from "./domain/hamster/hamsterSpinImageContextProviders.js";

/**
 * Context Providers
 *
 * This file gathers all context provider functions and factories into one
 * readable object.
 *
 * Intent files should import this file, then choose the context providers
 * they need.
 *
 * AddContext should attach trusted system data needed by later stages.
 */

var contextProviders = {
  passContext: passContextModule.passContext,
  passAddContext: passAddContextModule.passAddContext,

  addTimestampContext: addTimestampContextModule.addTimestampContext,
  addSourceContext: addSourceContextModule.addSourceContext,
  addActorRoleContext: addActorRoleContextModule.addActorRoleContext,

  createAddStaticContextValueProvider:
    addStaticContextValueModule.createAddStaticContextValueProvider,

  addOpenGamesDashboardContext: gamesContextProviders.addOpenGamesDashboardContext,
  addOpenGameDetailContext: gamesContextProviders.addOpenGameDetailContext,
  addLoadGameConfigContext: gamesContextProviders.addLoadGameConfigContext,
  addLoadGameSettingsContext: gamesContextProviders.addLoadGameSettingsContext,
  addSaveDailyLoginBonusesContext: gamesContextProviders.addSaveDailyLoginBonusesContext,
  addLoadGameAnalyticsContext: gamesContextProviders.addLoadGameAnalyticsContext,
  addLoadSpinImagesContext: gamesContextProviders.addLoadSpinImagesContext,
  addAddSpinImageContext: gamesContextProviders.addAddSpinImageContext,
  addRemoveSpinImageContext: gamesContextProviders.addRemoveSpinImageContext,
  addOpenPayoutModalContext: gamesContextProviders.addOpenPayoutModalContext,
  addClosePayoutModalContext: gamesContextProviders.addClosePayoutModalContext,
  addLoadPayoutRulesContext: gamesContextProviders.addLoadPayoutRulesContext,
  addAddPayoutRuleContext: gamesContextProviders.addAddPayoutRuleContext,
  addUpdatePayoutRuleContext: gamesContextProviders.addUpdatePayoutRuleContext,
  addRemovePayoutRuleContext: gamesContextProviders.addRemovePayoutRuleContext,
  addTogglePayoutRuleContext: gamesContextProviders.addTogglePayoutRuleContext,

  addLoadHamsterSpinImagesContext: hamsterSpinImageContextProviders.addLoadHamsterSpinImagesContext,
  addAddHamsterSpinImageContext: hamsterSpinImageContextProviders.addAddHamsterSpinImageContext,
  addRemoveHamsterSpinImageContext: hamsterSpinImageContextProviders.addRemoveHamsterSpinImageContext,
  addUpdateHamsterSpinImageContext: hamsterSpinImageContextProviders.addUpdateHamsterSpinImageContext
};

export default contextProviders;
