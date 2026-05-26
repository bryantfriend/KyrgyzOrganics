// ICF/Stages/Normalizers/normalizers.js

import passNormalizationModule from "./Core/passNormalization.js";
import passNormalizeModule from "./Core/passNormalize.js";
import trimPayloadStringFieldModule from "./Core/trimPayloadStringField.js";
import normalizePayloadNumberFieldModule from "./Core/normalizePayloadNumberField.js";
import normalizePayloadBooleanFieldModule from "./Core/normalizePayloadBooleanField.js";
import normalizePayloadDateFieldModule from "./Core/normalizePayloadDateField.js";
import exampleTrimProductNameModule from "./Core/exampleTrimProductName.js";
import * as gamesNormalizers from "./domain/games/gamesNormalizers.js";
import * as hamsterSpinImageNormalizers from "./domain/hamster/hamsterSpinImageNormalizers.js";

/**
 * Normalizers
 *
 * This file gathers all normalizer functions and normalizer factories
 * into one readable object.
 *
 * Intent files should import this file, then choose the normalizers they need.
 */

var normalizers = {
  passNormalization: passNormalizationModule.passNormalization,
  passNormalize: passNormalizeModule.passNormalize,
  exampleTrimProductName: exampleTrimProductNameModule.exampleTrimProductName,

  createTrimPayloadStringFieldNormalizer:
    trimPayloadStringFieldModule.createTrimPayloadStringFieldNormalizer,

  createNormalizePayloadNumberFieldNormalizer:
    normalizePayloadNumberFieldModule.createNormalizePayloadNumberFieldNormalizer,

  createNormalizePayloadBooleanFieldNormalizer:
    normalizePayloadBooleanFieldModule.createNormalizePayloadBooleanFieldNormalizer,

  createNormalizePayloadDateFieldNormalizer:
    normalizePayloadDateFieldModule.createNormalizePayloadDateFieldNormalizer,

  normalizeOpenGamesDashboard: gamesNormalizers.normalizeOpenGamesDashboard,
  normalizeOpenGameDetail: gamesNormalizers.normalizeOpenGameDetail,
  normalizeLoadGameConfig: gamesNormalizers.normalizeLoadGameConfig,
  normalizeLoadGameSettings: gamesNormalizers.normalizeLoadGameSettings,
  normalizeSaveDailyLoginBonuses: gamesNormalizers.normalizeSaveDailyLoginBonuses,
  normalizeLoadGameAnalytics: gamesNormalizers.normalizeLoadGameAnalytics,
  normalizeLoadSpinImages: gamesNormalizers.normalizeLoadSpinImages,
  normalizeAddSpinImage: gamesNormalizers.normalizeAddSpinImage,
  normalizeRemoveSpinImage: gamesNormalizers.normalizeRemoveSpinImage,
  normalizeOpenPayoutModal: gamesNormalizers.normalizeOpenPayoutModal,
  normalizeClosePayoutModal: gamesNormalizers.normalizeClosePayoutModal,
  normalizeLoadPayoutRules: gamesNormalizers.normalizeLoadPayoutRules,
  normalizeAddPayoutRule: gamesNormalizers.normalizeAddPayoutRule,
  normalizeUpdatePayoutRule: gamesNormalizers.normalizeUpdatePayoutRule,
  normalizeRemovePayoutRule: gamesNormalizers.normalizeRemovePayoutRule,
  normalizeTogglePayoutRule: gamesNormalizers.normalizeTogglePayoutRule,

  normalizeLoadHamsterSpinImages: hamsterSpinImageNormalizers.normalizeLoadHamsterSpinImages,
  normalizeAddHamsterSpinImage: hamsterSpinImageNormalizers.normalizeAddHamsterSpinImage,
  normalizeRemoveHamsterSpinImage: hamsterSpinImageNormalizers.normalizeRemoveHamsterSpinImage,
  normalizeUpdateHamsterSpinImage: hamsterSpinImageNormalizers.normalizeUpdateHamsterSpinImage
};

export default normalizers;
