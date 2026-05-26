// ICF/Stages/Processors/processors.js

import doNothingModule from "./Core/doNothing.js";
import passProcessModule from "./Core/passProcess.js";
import setResultDataModule from "./Core/setResultData.js";
import addPayloadToResultDataModule from "./Core/addPayloadToResultData.js";
import addContextToResultDataModule from "./Core/addContextToResultData.js";
import exampleSetCreatedProductResultModule from "./Core/exampleSetCreatedProductResult.js";
import * as demoProcessors from "./domain/demo/demoProcessors.js";
import * as gamesProcessors from "./domain/games/gamesProcessors.js";
import * as hamsterSpinImageProcessors from "./domain/hamster/hamsterSpinImageProcessors.js";

/**
 * Processors
 *
 * This file gathers all processor functions and processor factories
 * into one readable object.
 *
 * Intent files should import this file, then choose the processors they need.
 *
 * Process should perform the main state change.
 */

var processors = {
  doNothing: doNothingModule.doNothing,
  passProcess: passProcessModule.passProcess,
  setDemoResult: demoProcessors.setDemoResult,
  exampleSetCreatedProductResult:
    exampleSetCreatedProductResultModule.exampleSetCreatedProductResult,

  createSetResultDataProcessor:
    setResultDataModule.createSetResultDataProcessor,

  addPayloadToResultData:
    addPayloadToResultDataModule.addPayloadToResultData,

  addContextToResultData:
    addContextToResultDataModule.addContextToResultData,

  processOpenGamesDashboard: gamesProcessors.processOpenGamesDashboard,
  processOpenGameDetail: gamesProcessors.processOpenGameDetail,
  processLoadGameConfig: gamesProcessors.processLoadGameConfig,
  processLoadGameSettings: gamesProcessors.processLoadGameSettings,
  processSaveDailyLoginBonuses: gamesProcessors.processSaveDailyLoginBonuses,
  processLoadGameAnalytics: gamesProcessors.processLoadGameAnalytics,
  processLoadSpinImages: gamesProcessors.processLoadSpinImages,
  processAddSpinImage: gamesProcessors.processAddSpinImage,
  processRemoveSpinImage: gamesProcessors.processRemoveSpinImage,
  processOpenPayoutModal: gamesProcessors.processOpenPayoutModal,
  processClosePayoutModal: gamesProcessors.processClosePayoutModal,
  processLoadPayoutRules: gamesProcessors.processLoadPayoutRules,
  processAddPayoutRule: gamesProcessors.processAddPayoutRule,
  processUpdatePayoutRule: gamesProcessors.processUpdatePayoutRule,
  processRemovePayoutRule: gamesProcessors.processRemovePayoutRule,
  processTogglePayoutRule: gamesProcessors.processTogglePayoutRule,

  processLoadHamsterSpinImages: hamsterSpinImageProcessors.processLoadHamsterSpinImages,
  processAddHamsterSpinImage: hamsterSpinImageProcessors.processAddHamsterSpinImage,
  processRemoveHamsterSpinImage: hamsterSpinImageProcessors.processRemoveHamsterSpinImage,
  processUpdateHamsterSpinImage: hamsterSpinImageProcessors.processUpdateHamsterSpinImage
};

export default processors;
