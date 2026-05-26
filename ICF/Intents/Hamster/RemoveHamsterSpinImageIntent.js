import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var RemoveHamsterSpinImageIntent = {
  type: "RemoveHamsterSpinImageIntent",
  description: "Removes a hamster spin image.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateRemoveHamsterSpinImage: validators.validateRemoveHamsterSpinImage
    },
    Normalize: {
      normalizeRemoveHamsterSpinImage: normalizers.normalizeRemoveHamsterSpinImage
    },
    AddContext: {
      addRemoveHamsterSpinImageContext: contextProviders.addRemoveHamsterSpinImageContext
    },
    Authorize: {
      authorizeRemoveHamsterSpinImage: authorizers.authorizeRemoveHamsterSpinImage
    },
    Process: {
      processRemoveHamsterSpinImage: processors.processRemoveHamsterSpinImage
    },
    Emit: {
      emitRemoveHamsterSpinImage: emitters.emitRemoveHamsterSpinImage
    }
  }
};

export default RemoveHamsterSpinImageIntent;
