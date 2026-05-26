import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var LoadPayoutRulesIntent = {
  type: "LoadPayoutRulesIntent",
  description: "Loads payout rules.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateLoadPayoutRules: validators.validateLoadPayoutRules
    },
    Normalize: {
      normalizeLoadPayoutRules: normalizers.normalizeLoadPayoutRules
    },
    AddContext: {
      addLoadPayoutRulesContext: contextProviders.addLoadPayoutRulesContext
    },
    Authorize: {
      authorizeLoadPayoutRules: authorizers.authorizeLoadPayoutRules
    },
    Process: {
      processLoadPayoutRules: processors.processLoadPayoutRules
    },
    Emit: {
      emitLoadPayoutRules: emitters.emitLoadPayoutRules
    }
  }
};

export default LoadPayoutRulesIntent;
