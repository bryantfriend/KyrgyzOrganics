import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var ClosePayoutModalIntent = {
  type: "ClosePayoutModalIntent",
  description: "Closes the payout modal.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateClosePayoutModal: validators.validateClosePayoutModal
    },
    Normalize: {
      normalizeClosePayoutModal: normalizers.normalizeClosePayoutModal
    },
    AddContext: {
      addClosePayoutModalContext: contextProviders.addClosePayoutModalContext
    },
    Authorize: {
      authorizeClosePayoutModal: authorizers.authorizeClosePayoutModal
    },
    Process: {
      processClosePayoutModal: processors.processClosePayoutModal
    },
    Emit: {
      emitClosePayoutModal: emitters.emitClosePayoutModal
    }
  }
};

export default ClosePayoutModalIntent;
