import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var TogglePayoutRuleIntent = {
  type: "TogglePayoutRuleIntent",
  description: "Toggles a payout rule.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateTogglePayoutRule: validators.validateTogglePayoutRule
    },
    Normalize: {
      normalizeTogglePayoutRule: normalizers.normalizeTogglePayoutRule
    },
    AddContext: {
      addTogglePayoutRuleContext: contextProviders.addTogglePayoutRuleContext
    },
    Authorize: {
      authorizeTogglePayoutRule: authorizers.authorizeTogglePayoutRule
    },
    Process: {
      processTogglePayoutRule: processors.processTogglePayoutRule
    },
    Emit: {
      emitTogglePayoutRule: emitters.emitTogglePayoutRule
    }
  }
};

export default TogglePayoutRuleIntent;
