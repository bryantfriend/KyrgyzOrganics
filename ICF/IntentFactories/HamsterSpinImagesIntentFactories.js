import LoadHamsterSpinImagesIntent from "../Intents/Hamster/LoadHamsterSpinImagesIntent.js";
import AddHamsterSpinImageIntent from "../Intents/Hamster/AddHamsterSpinImageIntent.js";
import RemoveHamsterSpinImageIntent from "../Intents/Hamster/RemoveHamsterSpinImageIntent.js";
import UpdateHamsterSpinImageIntent from "../Intents/Hamster/UpdateHamsterSpinImageIntent.js";
import { createHamsterSpinImageContext } from "../Stages/Processors/domain/hamster/hamsterSpinImageHelpers.js";

function createLoadHamsterSpinImagesIntent(actor, payload, options) {
  return createIntentFromDefinition(LoadHamsterSpinImagesIntent, actor, payload, options);
}

function createAddHamsterSpinImageIntent(actor, payload, options) {
  return createIntentFromDefinition(AddHamsterSpinImageIntent, actor, payload, options);
}

function createRemoveHamsterSpinImageIntent(actor, payload, options) {
  return createIntentFromDefinition(RemoveHamsterSpinImageIntent, actor, payload, options);
}

function createUpdateHamsterSpinImageIntent(actor, payload, options) {
  return createIntentFromDefinition(UpdateHamsterSpinImageIntent, actor, payload, options);
}

function createIntentFromDefinition(intentDefinition, actor, payload, options) {
  var safeOptions = options || {};

  return {
    type: intentDefinition.type,
    description: intentDefinition.description,
    actor: actor || { id: "unknown", role: "guest" },
    payload: payload || {},
    context: createHamsterSpinImageContext(safeOptions),
    meta: {
      createdAt: Date.now(),
      source: safeOptions.source || "system"
    },
    stages: intentDefinition.stages
  };
}

export {
  createLoadHamsterSpinImagesIntent,
  createAddHamsterSpinImageIntent,
  createRemoveHamsterSpinImageIntent,
  createUpdateHamsterSpinImageIntent
};

export default {
  createLoadHamsterSpinImagesIntent: createLoadHamsterSpinImagesIntent,
  createAddHamsterSpinImageIntent: createAddHamsterSpinImageIntent,
  createRemoveHamsterSpinImageIntent: createRemoveHamsterSpinImageIntent,
  createUpdateHamsterSpinImageIntent: createUpdateHamsterSpinImageIntent
};
