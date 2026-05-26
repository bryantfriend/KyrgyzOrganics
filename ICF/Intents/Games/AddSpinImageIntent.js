import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var AddSpinImageIntent = {
  type: "AddSpinImageIntent",
  description: "Adds a spin image.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateAddSpinImage: validators.validateAddSpinImage
    },
    Normalize: {
      normalizeAddSpinImage: normalizers.normalizeAddSpinImage
    },
    AddContext: {
      addAddSpinImageContext: contextProviders.addAddSpinImageContext
    },
    Authorize: {
      authorizeAddSpinImage: authorizers.authorizeAddSpinImage
    },
    Process: {
      processAddSpinImage: processors.processAddSpinImage
    },
    Emit: {
      emitAddSpinImage: emitters.emitAddSpinImage
    }
  }
};

export default AddSpinImageIntent;
