import validators from "../../Stages/Validators/validators.js";
import normalizers from "../../Stages/Normalizers/normalizers.js";
import contextProviders from "../../Stages/ContextProviders/contextProviders.js";
import authorizers from "../../Stages/Authorizers/authorizers.js";
import processors from "../../Stages/Processors/processors.js";
import emitters from "../../Stages/Emitters/emitters.js";

var LoadGameAnalyticsIntent = {
  type: "LoadGameAnalyticsIntent",
  description: "Loads game analytics.",

  stages: {
    Validate: {
      requireBaseIntentShape: validators.requireBaseIntentShape,
      validateLoadGameAnalytics: validators.validateLoadGameAnalytics
    },
    Normalize: {
      normalizeLoadGameAnalytics: normalizers.normalizeLoadGameAnalytics
    },
    AddContext: {
      addLoadGameAnalyticsContext: contextProviders.addLoadGameAnalyticsContext
    },
    Authorize: {
      authorizeLoadGameAnalytics: authorizers.authorizeLoadGameAnalytics
    },
    Process: {
      processLoadGameAnalytics: processors.processLoadGameAnalytics
    },
    Emit: {
      emitLoadGameAnalytics: emitters.emitLoadGameAnalytics
    }
  }
};

export default LoadGameAnalyticsIntent;
