import validators from "../Stages/Validators/validators.js";
import normalizers from "../Stages/Normalizers/normalizers.js";
import contextProviders from "../Stages/ContextProviders/contextProviders.js";
import authorizers from "../Stages/Authorizers/authorizers.js";
import processors from "../Stages/Processors/processors.js";
import emitters from "../Stages/Emitters/emitters.js";

// Confirms that the ICF pipeline is wired correctly.
var DemoIntent = {
  type: "DemoIntent",
  description: "Confirms that the ICF pipeline is wired correctly.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape
    },

    Normalize: {
      passNormalization: normalizers.passNormalization
    },

    AddContext: {
      addTimestampContext: contextProviders.addTimestampContext,
      addSourceContext: contextProviders.addSourceContext,
      addActorRoleContext: contextProviders.addActorRoleContext
    },

    Authorize: {
      allow: authorizers.allow
    },

    Process: {
      setDemoResult: processors.setDemoResult
    },

    Emit: {
      addDemoSuccessMessage: emitters.addDemoSuccessMessage,
      addDemoCompletedEvent: emitters.addDemoCompletedEvent,
      addDebugSummary: emitters.addDebugSummary
    }
  }
};

export default DemoIntent;