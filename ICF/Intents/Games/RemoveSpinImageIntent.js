import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var RemoveSpinImageIntent = {
  type: "RemoveSpinImageIntent",
  description: "Removes a spin image.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateRemoveSpinImage: validators.validateRemoveSpinImage
    },
    Normalize: {
      normalizeRemoveSpinImage: normalizers.normalizeRemoveSpinImage
    },
    AddContext: {
      addRemoveSpinImageContext: contextProviders.addRemoveSpinImageContext
    },
    Authorize: {
      authorizeRemoveSpinImage: authorizers.authorizeRemoveSpinImage
    },
    Process: {
      processRemoveSpinImage: processors.processRemoveSpinImage
    },
    Emit: {
      emitRemoveSpinImage: emitters.emitRemoveSpinImage
    }
  }
};

export default RemoveSpinImageIntent;
