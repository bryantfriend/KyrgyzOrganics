// ICF/Stages/Emitters/emitters.js

import passEmitModule from "./Core/passEmit.js";
import addSuccessMessageModule from "./Core/addSuccessMessage.js";
import addEventModule from "./Core/addEvent.js";
import addResultMessageModule from "./Core/addResultMessage.js";
import addDebugSummaryModule from "./Core/addDebugSummary.js";
import * as demoEmitters from "./domain/demo/demoEmitters.js";
import * as gamesEmitters from "./domain/games/gamesEmitters.js";
import * as hamsterSpinImageEmitters from "./domain/hamster/hamsterSpinImageEmitters.js";

/**
 * Emitters
 *
 * This file gathers all emitter functions and emitter factories into one
 * readable object.
 *
 * Intent files should import this file, then choose the emitters they need.
 *
 * Emit should prepare useful result data, events, logs, notifications,
 * analytics instructions, or UI feedback instructions.
 */

var emitters = {
  passEmit: passEmitModule.passEmit,
  addDemoSuccessMessage: demoEmitters.addDemoSuccessMessage,
  addDemoCompletedEvent: demoEmitters.addDemoCompletedEvent,

  createAddSuccessMessageEmitter:
    addSuccessMessageModule.createAddSuccessMessageEmitter,

  createAddEventEmitter:
    addEventModule.createAddEventEmitter,

  createAddResultMessageEmitter:
    addResultMessageModule.createAddResultMessageEmitter,

  addDebugSummary:
    addDebugSummaryModule.addDebugSummary,

  emitOpenGamesDashboard: gamesEmitters.emitOpenGamesDashboard,
  emitOpenGameDetail: gamesEmitters.emitOpenGameDetail,
  emitLoadGameConfig: gamesEmitters.emitLoadGameConfig,
  emitLoadGameSettings: gamesEmitters.emitLoadGameSettings,
  emitSaveDailyLoginBonuses: gamesEmitters.emitSaveDailyLoginBonuses,
  emitLoadGameAnalytics: gamesEmitters.emitLoadGameAnalytics,
  emitLoadSpinImages: gamesEmitters.emitLoadSpinImages,
  emitAddSpinImage: gamesEmitters.emitAddSpinImage,
  emitRemoveSpinImage: gamesEmitters.emitRemoveSpinImage,
  emitOpenPayoutModal: gamesEmitters.emitOpenPayoutModal,
  emitClosePayoutModal: gamesEmitters.emitClosePayoutModal,
  emitLoadPayoutRules: gamesEmitters.emitLoadPayoutRules,
  emitAddPayoutRule: gamesEmitters.emitAddPayoutRule,
  emitUpdatePayoutRule: gamesEmitters.emitUpdatePayoutRule,
  emitRemovePayoutRule: gamesEmitters.emitRemovePayoutRule,
  emitTogglePayoutRule: gamesEmitters.emitTogglePayoutRule,

  emitLoadHamsterSpinImages: hamsterSpinImageEmitters.emitLoadHamsterSpinImages,
  emitAddHamsterSpinImage: hamsterSpinImageEmitters.emitAddHamsterSpinImage,
  emitRemoveHamsterSpinImage: hamsterSpinImageEmitters.emitRemoveHamsterSpinImage,
  emitUpdateHamsterSpinImage: hamsterSpinImageEmitters.emitUpdateHamsterSpinImage
};

export default emitters;
