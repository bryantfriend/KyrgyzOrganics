import resultHelpers from "../../../../Engine/resultHelpers.js";

function emitLoadHamsterSpinImages(intent) {
  return emitHamsterSpinImageResult(intent);
}

function emitAddHamsterSpinImage(intent) {
  return emitHamsterSpinImageResult(intent);
}

function emitRemoveHamsterSpinImage(intent) {
  return emitHamsterSpinImageResult(intent);
}

function emitUpdateHamsterSpinImage(intent) {
  return emitHamsterSpinImageResult(intent);
}

function emitHamsterSpinImageResult(intent) {
  if (!intent.context.events) {
    intent.context.events = [];
  }

  intent.context.events.push({
    type: intent.type + "Completed",
    companyId: intent.context.companyId,
    timestamp: Date.now()
  });

  return resultHelpers.success(intent);
}

export {
  emitLoadHamsterSpinImages,
  emitAddHamsterSpinImage,
  emitRemoveHamsterSpinImage,
  emitUpdateHamsterSpinImage
};
