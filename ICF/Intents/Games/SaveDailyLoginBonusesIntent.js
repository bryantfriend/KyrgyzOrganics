import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var SaveDailyLoginBonusesIntent = {
  type: "SaveDailyLoginBonusesIntent",
  description: "Saves daily login bonuses.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateSaveDailyLoginBonuses: validators.validateSaveDailyLoginBonuses
    },
    Normalize: {
      normalizeSaveDailyLoginBonuses: normalizers.normalizeSaveDailyLoginBonuses
    },
    AddContext: {
      addSaveDailyLoginBonusesContext: contextProviders.addSaveDailyLoginBonusesContext
    },
    Authorize: {
      authorizeSaveDailyLoginBonuses: authorizers.authorizeSaveDailyLoginBonuses
    },
    Process: {
      processSaveDailyLoginBonuses: processors.processSaveDailyLoginBonuses
    },
    Emit: {
      emitSaveDailyLoginBonuses: emitters.emitSaveDailyLoginBonuses
    }
  }
};

export default SaveDailyLoginBonusesIntent;
