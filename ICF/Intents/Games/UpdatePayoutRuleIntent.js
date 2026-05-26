import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var UpdatePayoutRuleIntent = {
  type: "UpdatePayoutRuleIntent",
  description: "Updates a payout rule.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateUpdatePayoutRule: validators.validateUpdatePayoutRule
    },
    Normalize: {
      normalizeUpdatePayoutRule: normalizers.normalizeUpdatePayoutRule
    },
    AddContext: {
      addUpdatePayoutRuleContext: contextProviders.addUpdatePayoutRuleContext
    },
    Authorize: {
      authorizeUpdatePayoutRule: authorizers.authorizeUpdatePayoutRule
    },
    Process: {
      processUpdatePayoutRule: processors.processUpdatePayoutRule
    },
    Emit: {
      emitUpdatePayoutRule: emitters.emitUpdatePayoutRule
    }
  }
};

export default UpdatePayoutRuleIntent;
