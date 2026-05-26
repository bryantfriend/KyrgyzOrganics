import resultHelpers from "../../../../Engine/resultHelpers.js";

function setDemoResult(intent) {
  intent.context.resultData = {
    demoProcessed: true
  };

  return resultHelpers.success(intent);
}

export {
  setDemoResult
};
