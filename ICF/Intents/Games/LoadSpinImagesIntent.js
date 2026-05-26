import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var LoadSpinImagesIntent = {
  type: "LoadSpinImagesIntent",
  description: "Loads spin images.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateLoadSpinImages: validators.validateLoadSpinImages
    },
    Normalize: {
      normalizeLoadSpinImages: normalizers.normalizeLoadSpinImages
    },
    AddContext: {
      addLoadSpinImagesContext: contextProviders.addLoadSpinImagesContext
    },
    Authorize: {
      authorizeLoadSpinImages: authorizers.authorizeLoadSpinImages
    },
    Process: {
      processLoadSpinImages: processors.processLoadSpinImages
    },
    Emit: {
      emitLoadSpinImages: emitters.emitLoadSpinImages
    }
  }
};

export default LoadSpinImagesIntent;
