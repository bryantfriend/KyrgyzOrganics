import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var OpenGameDetailIntent = {
  type: "OpenGameDetailIntent",
  description: "Opens one game detail view.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateOpenGameDetail: validators.validateOpenGameDetail
    },
    Normalize: {
      normalizeOpenGameDetail: normalizers.normalizeOpenGameDetail
    },
    AddContext: {
      addOpenGameDetailContext: contextProviders.addOpenGameDetailContext
    },
    Authorize: {
      authorizeOpenGameDetail: authorizers.authorizeOpenGameDetail
    },
    Process: {
      processOpenGameDetail: processors.processOpenGameDetail
    },
    Emit: {
      emitOpenGameDetail: emitters.emitOpenGameDetail
    }
  }
};

export default OpenGameDetailIntent;
