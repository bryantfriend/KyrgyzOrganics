import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var AddHamsterSpinImageIntent = {
  type: "AddHamsterSpinImageIntent",
  description: "Adds a hamster spin image.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateAddHamsterSpinImage: validators.validateAddHamsterSpinImage
    },
    Normalize: {
      normalizeAddHamsterSpinImage: normalizers.normalizeAddHamsterSpinImage
    },
    AddContext: {
      addAddHamsterSpinImageContext: contextProviders.addAddHamsterSpinImageContext
    },
    Authorize: {
      authorizeAddHamsterSpinImage: authorizers.authorizeAddHamsterSpinImage
    },
    Process: {
      processAddHamsterSpinImage: processors.processAddHamsterSpinImage
    },
    Emit: {
      emitAddHamsterSpinImage: emitters.emitAddHamsterSpinImage
    }
  }
};

export default AddHamsterSpinImageIntent;
