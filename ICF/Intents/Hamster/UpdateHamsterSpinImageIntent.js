import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var UpdateHamsterSpinImageIntent = {
  type: "UpdateHamsterSpinImageIntent",
  description: "Updates a hamster spin image.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateUpdateHamsterSpinImage: validators.validateUpdateHamsterSpinImage
    },
    Normalize: {
      normalizeUpdateHamsterSpinImage: normalizers.normalizeUpdateHamsterSpinImage
    },
    AddContext: {
      addUpdateHamsterSpinImageContext: contextProviders.addUpdateHamsterSpinImageContext
    },
    Authorize: {
      authorizeUpdateHamsterSpinImage: authorizers.authorizeUpdateHamsterSpinImage
    },
    Process: {
      processUpdateHamsterSpinImage: processors.processUpdateHamsterSpinImage
    },
    Emit: {
      emitUpdateHamsterSpinImage: emitters.emitUpdateHamsterSpinImage
    }
  }
};

export default UpdateHamsterSpinImageIntent;
