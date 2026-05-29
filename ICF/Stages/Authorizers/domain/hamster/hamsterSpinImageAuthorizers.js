import resultHelpers from "../../../../engine/resultHelpers.js";
import { isAdminActor } from "../../../Processors/domain/hamster/hamsterSpinImageHelpers.js";

function authorizeLoadHamsterSpinImages(intent) {
  return resultHelpers.success(intent);
}

function authorizeAddHamsterSpinImage(intent) {
  return authorizeHamsterSpinImageManager(intent);
}

function authorizeRemoveHamsterSpinImage(intent) {
  return authorizeHamsterSpinImageManager(intent);
}

function authorizeUpdateHamsterSpinImage(intent) {
  return authorizeHamsterSpinImageManager(intent);
}

function authorizeHamsterSpinImageManager(intent) {
  if (isAdminActor(intent.actor)) {
    return resultHelpers.success(intent);
  }

  return resultHelpers.authorizationFailure("Only admins can manage hamster spin images.");
}

export {
  authorizeLoadHamsterSpinImages,
  authorizeAddHamsterSpinImage,
  authorizeRemoveHamsterSpinImage,
  authorizeUpdateHamsterSpinImage
};
