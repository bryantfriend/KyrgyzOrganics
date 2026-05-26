import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var LoadGameSettingsIntent = {
  type: "LoadGameSettingsIntent",
  description: "Loads game settings.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateLoadGameSettings: validators.validateLoadGameSettings
    },
    Normalize: {
      normalizeLoadGameSettings: normalizers.normalizeLoadGameSettings
    },
    AddContext: {
      addLoadGameSettingsContext: contextProviders.addLoadGameSettingsContext
    },
    Authorize: {
      authorizeLoadGameSettings: authorizers.authorizeLoadGameSettings
    },
    Process: {
      processLoadGameSettings: processors.processLoadGameSettings
    },
    Emit: {
      emitLoadGameSettings: emitters.emitLoadGameSettings
    }
  }
};

export default LoadGameSettingsIntent;
