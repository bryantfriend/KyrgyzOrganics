import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var AddPayoutRuleIntent = {
  type: "AddPayoutRuleIntent",
  description: "Adds a payout rule.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateAddPayoutRule: validators.validateAddPayoutRule
    },
    Normalize: {
      normalizeAddPayoutRule: normalizers.normalizeAddPayoutRule
    },
    AddContext: {
      addAddPayoutRuleContext: contextProviders.addAddPayoutRuleContext
    },
    Authorize: {
      authorizeAddPayoutRule: authorizers.authorizeAddPayoutRule
    },
    Process: {
      processAddPayoutRule: processors.processAddPayoutRule
    },
    Emit: {
      emitAddPayoutRule: emitters.emitAddPayoutRule
    }
  }
};

export default AddPayoutRuleIntent;
