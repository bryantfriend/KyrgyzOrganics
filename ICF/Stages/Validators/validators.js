// ICF/Stages/Validators/validators.js

import passValidationModule from "./Core/passValidation.js";
import passValidateModule from "./Core/passValidate.js";
import requireIntentTypeModule from "./Core/requireIntentType.js";
import requireActorModule from "./Core/requireActor.js";
import requirePayloadModule from "./Core/requirePayload.js";
import requireContextModule from "./Core/requireContext.js";
import requireActorRoleModule from "./Core/requireActorRole.js";
import requireBaseIntentShapeModule from "./Core/requireBaseIntentShape.js";
import exampleRequireStoreIdModule from "./Core/exampleRequireStoreId.js";
import * as gamesValidators from "./domain/games/gamesValidators.js";
import * as hamsterSpinImageValidators from "./domain/hamster/hamsterSpinImageValidators.js";

/**
 * Validators
 *
 * This file gathers all validator functions into one readable object.
 *
 * Intent files should import this file, then choose the validators they need.
 *
 * Example:
 *
 * Validate: {
 *   requireIntentType: validators.requireIntentType,
 *   requireActor: validators.requireActor,
 *   requirePayload: validators.requirePayload
 * }
 */

var validators = {
  passValidation: passValidationModule.passValidation,
  passValidate: passValidateModule.passValidate,

  requireIntentType: requireIntentTypeModule.requireIntentType,
  requireActor: requireActorModule.requireActor,
  requirePayload: requirePayloadModule.requirePayload,
  requireContext: requireContextModule.requireContext,
  requireBaseIntentShape: requireBaseIntentShapeModule.requireBaseIntentShape,
  exampleRequireStoreId: exampleRequireStoreIdModule.exampleRequireStoreId,

  createRequireActorRoleValidator: requireActorRoleModule.createRequireActorRoleValidator,

  validateOpenGamesDashboard: gamesValidators.validateOpenGamesDashboard,
  validateOpenGameDetail: gamesValidators.validateOpenGameDetail,
  validateLoadGameConfig: gamesValidators.validateLoadGameConfig,
  validateLoadGameSettings: gamesValidators.validateLoadGameSettings,
  validateSaveDailyLoginBonuses: gamesValidators.validateSaveDailyLoginBonuses,
  validateLoadGameAnalytics: gamesValidators.validateLoadGameAnalytics,
  validateLoadSpinImages: gamesValidators.validateLoadSpinImages,
  validateAddSpinImage: gamesValidators.validateAddSpinImage,
  validateRemoveSpinImage: gamesValidators.validateRemoveSpinImage,
  validateOpenPayoutModal: gamesValidators.validateOpenPayoutModal,
  validateClosePayoutModal: gamesValidators.validateClosePayoutModal,
  validateLoadPayoutRules: gamesValidators.validateLoadPayoutRules,
  validateAddPayoutRule: gamesValidators.validateAddPayoutRule,
  validateUpdatePayoutRule: gamesValidators.validateUpdatePayoutRule,
  validateRemovePayoutRule: gamesValidators.validateRemovePayoutRule,
  validateTogglePayoutRule: gamesValidators.validateTogglePayoutRule,

  validateLoadHamsterSpinImages: hamsterSpinImageValidators.validateLoadHamsterSpinImages,
  validateAddHamsterSpinImage: hamsterSpinImageValidators.validateAddHamsterSpinImage,
  validateRemoveHamsterSpinImage: hamsterSpinImageValidators.validateRemoveHamsterSpinImage,
  validateUpdateHamsterSpinImage: hamsterSpinImageValidators.validateUpdateHamsterSpinImage
};

export default validators;
