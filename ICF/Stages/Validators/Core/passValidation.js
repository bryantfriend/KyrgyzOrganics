// ICF/Stages/Validators/Core/passValidation.js

import resultHelpers from "../../../Engine/resultHelpers.js";

/**
 * Explicit pass-through validator.
 *
 * Use this when the Validate stage is required but no validation is needed yet.
 *
 * @param {Object} intent - Current Intent.
 * @returns {Object} Success result.
 */
function passValidation(intent) {
  return resultHelpers.success(intent);
}

export default {
  passValidation: passValidation
};