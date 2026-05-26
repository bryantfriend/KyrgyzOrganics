import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var OpenGamesDashboardIntent = {
  type: "OpenGamesDashboardIntent",
  description: "Opens the games dashboard.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateOpenGamesDashboard: validators.validateOpenGamesDashboard
    },
    Normalize: {
      normalizeOpenGamesDashboard: normalizers.normalizeOpenGamesDashboard
    },
    AddContext: {
      addOpenGamesDashboardContext: contextProviders.addOpenGamesDashboardContext
    },
    Authorize: {
      authorizeOpenGamesDashboard: authorizers.authorizeOpenGamesDashboard
    },
    Process: {
      processOpenGamesDashboard: processors.processOpenGamesDashboard
    },
    Emit: {
      emitOpenGamesDashboard: emitters.emitOpenGamesDashboard
    }
  }
};

export default OpenGamesDashboardIntent;
