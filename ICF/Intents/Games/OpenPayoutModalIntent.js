import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var OpenPayoutModalIntent = {
  type: "OpenPayoutModalIntent",
  description: "Opens the payout modal.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateOpenPayoutModal: validators.validateOpenPayoutModal
    },
    Normalize: {
      normalizeOpenPayoutModal: normalizers.normalizeOpenPayoutModal
    },
    AddContext: {
      addOpenPayoutModalContext: contextProviders.addOpenPayoutModalContext
    },
    Authorize: {
      authorizeOpenPayoutModal: authorizers.authorizeOpenPayoutModal
    },
    Process: {
      processOpenPayoutModal: processors.processOpenPayoutModal
    },
    Emit: {
      emitOpenPayoutModal: emitters.emitOpenPayoutModal
    }
  }
};

export default OpenPayoutModalIntent;
