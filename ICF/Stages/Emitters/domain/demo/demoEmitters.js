import resultHelpers from "../../../../engine/resultHelpers.js";

function addDemoSuccessMessage(intent) {
  var resultData = resultHelpers.getResultData(intent);
  var updatedResultData = copyObject(resultData);

  updatedResultData.message = "Demo Intent completed successfully.";
  intent.context.resultData = updatedResultData;

  return resultHelpers.success(intent);
}

function addDemoCompletedEvent(intent) {
  var event = resultHelpers.createEvent("DemoIntentCompleted", {
    category: "demo",
    intentType: intent.type,
    actorId: intent.actor.id,
    actorRole: intent.actor.role
  });

  resultHelpers.addEventToIntent(intent, event);

  return resultHelpers.success(intent);
}

function copyObject(sourceObject) {
  var copiedObject = {};
  var keys;
  var keyIndex;

  if (!sourceObject) {
    return copiedObject;
  }

  keys = Object.keys(sourceObject);
  keyIndex = 0;

  while (keyIndex < keys.length) {
    var key = keys[keyIndex];
    copiedObject[key] = sourceObject[key];
    keyIndex = keyIndex + 1;
  }

  return copiedObject;
}

export {
  addDemoSuccessMessage,
  addDemoCompletedEvent
};
