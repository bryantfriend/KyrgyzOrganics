import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var LoadHamsterSpinImagesIntent = {
  type: "LoadHamsterSpinImagesIntent",
  description: "Loads hamster spin images.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateLoadHamsterSpinImages: validators.validateLoadHamsterSpinImages
    },
    Normalize: {
      normalizeLoadHamsterSpinImages: normalizers.normalizeLoadHamsterSpinImages
    },
    AddContext: {
      addLoadHamsterSpinImagesContext: contextProviders.addLoadHamsterSpinImagesContext
    },
    Authorize: {
      authorizeLoadHamsterSpinImages: authorizers.authorizeLoadHamsterSpinImages
    },
    Process: {
      processLoadHamsterSpinImages: processors.processLoadHamsterSpinImages
    },
    Emit: {
      emitLoadHamsterSpinImages: emitters.emitLoadHamsterSpinImages
    }
  }
};

export default LoadHamsterSpinImagesIntent;
