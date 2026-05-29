import resultHelpers from "../../../../engine/resultHelpers.js";

function setDemoResult(intent) {
  intent.context.resultData = {
    demoProcessed: true
  };

  return resultHelpers.success(intent);
}

export {
  setDemoResult
};
