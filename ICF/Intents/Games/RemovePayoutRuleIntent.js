import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var RemovePayoutRuleIntent = {
  type: "RemovePayoutRuleIntent",
  description: "Removes a payout rule.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateRemovePayoutRule: validators.validateRemovePayoutRule
    },
    Normalize: {
      normalizeRemovePayoutRule: normalizers.normalizeRemovePayoutRule
    },
    AddContext: {
      addRemovePayoutRuleContext: contextProviders.addRemovePayoutRuleContext
    },
    Authorize: {
      authorizeRemovePayoutRule: authorizers.authorizeRemovePayoutRule
    },
    Process: {
      processRemovePayoutRule: processors.processRemovePayoutRule
    },
    Emit: {
      emitRemovePayoutRule: emitters.emitRemovePayoutRule
    }
  }
};

export default RemovePayoutRuleIntent;
