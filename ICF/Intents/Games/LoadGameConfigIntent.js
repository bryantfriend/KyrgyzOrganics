import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var LoadGameConfigIntent = {
  type: "LoadGameConfigIntent",
  description: "Loads game configuration.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateLoadGameConfig: validators.validateLoadGameConfig
    },
    Normalize: {
      normalizeLoadGameConfig: normalizers.normalizeLoadGameConfig
    },
    AddContext: {
      addLoadGameConfigContext: contextProviders.addLoadGameConfigContext
    },
    Authorize: {
      authorizeLoadGameConfig: authorizers.authorizeLoadGameConfig
    },
    Process: {
      processLoadGameConfig: processors.processLoadGameConfig
    },
    Emit: {
      emitLoadGameConfig: emitters.emitLoadGameConfig
    }
  }
};

export default LoadGameConfigIntent;
