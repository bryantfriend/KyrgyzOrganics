import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

var DEFAULT_STORE_ID = "kyrgyz-organics";
var DEFAULT_GAME_ID = "hamster-spin";
var MIN_SPIN_IMAGES = 4;
var MIN_SPIN_MESSAGE = "Spinning mode must have at least 4 pictures.";

function createOpenGamesDashboardIntent(actor, payload, options) {
  return createGamesIntent("OpenGamesDashboardIntent", actor, payload, options);
}

function createOpenGameDetailIntent(actor, payload, options) {
  return createGamesIntent("OpenGameDetailIntent", actor, payload, options);
}

function createLoadGameConfigIntent(actor, payload, options) {
  return createGamesIntent("LoadGameConfigIntent", actor, payload, options);
}

function createLoadSpinImagesIntent(actor, payload, options) {
  return createGamesIntent("LoadSpinImagesIntent", actor, payload, options);
}

function createAddSpinImageIntent(actor, payload, options) {
  return createGamesIntent("AddSpinImageIntent", actor, payload, options);
}

function createRemoveSpinImageIntent(actor, payload, options) {
  return createGamesIntent("RemoveSpinImageIntent", actor, payload, options);
}

function createOpenPayoutModalIntent(actor, payload, options) {
  return createGamesIntent("OpenPayoutModalIntent", actor, payload, options);
}

function createClosePayoutModalIntent(actor, payload, options) {
  return createGamesIntent("ClosePayoutModalIntent", actor, payload, options);
}

function createGamesIntent(type, actor, payload, options) {
  var safeOptions = options || {};

  return {
    type: type,
    actor: actor || { id: "unknown", role: "unknown" },
    payload: payload || {},
    context: {
      db: safeOptions.db || null,
      storeId: safeOptions.storeId || DEFAULT_STORE_ID,
      gameId: safeOptions.gameId || DEFAULT_GAME_ID,
      availableGames: safeOptions.availableGames || getDefaultGames(),
      fallbackImages: safeOptions.fallbackImages || [],
      minActiveImages: safeOptions.minActiveImages || MIN_SPIN_IMAGES,
      payouts: safeOptions.payouts || getDefaultPayouts(),
      source: safeOptions.source || "admin"
    },
    meta: {
      createdAt: Date.now(),
      source: safeOptions.source || "admin"
    },
    stages: {
      Validate: {
        validateGamesPayload: validateGamesPayload
      },
      Normalize: {
        normalizeGamesPayload: normalizeGamesPayload
      },
      AddContext: {
        addGamesContext: addGamesContext
      },
      Authorize: {
        authorizeGamesActor: authorizeGamesActor
      },
      Process: {
        processGamesIntent: processGamesIntent
      },
      Emit: {
        emitGamesResult: emitGamesResult
      }
    }
  };
}

function validateGamesPayload(intent) {
  var errors = [];
  var payload = intent.payload || {};
  var needsStore = intent.type !== "OpenGamesDashboardIntent";
  var needsGame = intent.type !== "OpenGamesDashboardIntent";

  if (!intent.actor || !intent.actor.id) {
    errors.push("Actor is required.");
  }

  if (needsStore && !payload.storeId && !intent.context.storeId) {
    errors.push("storeId is required.");
  }

  if (needsGame && !payload.gameId && !intent.context.gameId) {
    errors.push("gameId is required.");
  }

  if (intent.type === "AddSpinImageIntent" && !payload.imageUrl) {
    errors.push("imageUrl is required when adding a spin picture.");
  }

  if (intent.type === "RemoveSpinImageIntent" && !payload.id) {
    errors.push("Spin image id is required.");
  }

  if ((intent.type === "LoadSpinImagesIntent" || intent.type === "AddSpinImageIntent" || intent.type === "RemoveSpinImageIntent" || intent.type === "LoadGameConfigIntent") && !intent.context.db) {
    errors.push("Firestore database context is required.");
  }

  if (errors.length > 0) {
    return {
      ok: false,
      stage: "Validate",
      errors: errors
    };
  }

  return {
    ok: true,
    intent: intent
  };
}

function normalizeGamesPayload(intent) {
  var payload = intent.payload || {};
  var context = intent.context || {};
  var normalized = {};
  var key;

  for (key in payload) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      normalized[key] = payload[key];
    }
  }

  normalized.storeId = String(payload.storeId || context.storeId || DEFAULT_STORE_ID).trim();
  normalized.gameId = String(payload.gameId || context.gameId || DEFAULT_GAME_ID).trim();

  if (typeof payload.imageUrl === "string") {
    normalized.imageUrl = payload.imageUrl.trim();
  }

  if (typeof payload.label === "string") {
    normalized.label = payload.label.trim();
  }

  if (typeof payload.id === "string") {
    normalized.id = payload.id.trim();
  }

  if (payload.active === false) {
    normalized.active = false;
  } else {
    normalized.active = true;
  }

  if (typeof payload.sortOrder === "number" && isFinite(payload.sortOrder)) {
    normalized.sortOrder = payload.sortOrder;
  }

  intent.payload = normalized;
  intent.context.storeId = normalized.storeId;
  intent.context.gameId = normalized.gameId;

  return {
    ok: true,
    intent: intent
  };
}

async function addGamesContext(intent) {
  var context = intent.context;
  var payload = intent.payload;

  context.game = findGame(context.availableGames, payload.gameId);
  context.settingsRef = doc(context.db, "stores", payload.storeId, "games", payload.gameId, "settings", "main");
  context.spinImagesCollectionRef = collection(context.db, "stores", payload.storeId, "games", payload.gameId, "spinImages");

  if (intent.type === "LoadGameConfigIntent") {
    context.settingsSnapshot = await getDoc(context.settingsRef);
    context.spinImages = await loadSpinImageRecords(context.spinImagesCollectionRef, false);
  }

  if (intent.type === "LoadSpinImagesIntent") {
    context.spinImages = await loadSpinImageRecords(context.spinImagesCollectionRef, intent.payload.includeInactive !== true);
    context.activeSpinImageCount = countActiveImages(context.spinImages);
  }

  if (intent.type === "RemoveSpinImageIntent") {
    context.spinImages = await loadSpinImageRecords(context.spinImagesCollectionRef, false);
    context.activeSpinImageCount = countActiveImages(context.spinImages);
    context.targetSpinImage = findSpinImage(context.spinImages, payload.id);
  }

  return {
    ok: true,
    intent: intent
  };
}

function authorizeGamesActor(intent) {
  var role = intent.actor && intent.actor.role ? String(intent.actor.role) : "";
  var source = intent.context && intent.context.source ? intent.context.source : "admin";
  var readOnlyGameLoad = source === "game" && intent.type === "LoadSpinImagesIntent";

  if (readOnlyGameLoad && (role === "system" || role === "admin" || role === "superadmin")) {
    return {
      ok: true,
      intent: intent
    };
  }

  if (role === "admin" || role === "superadmin") {
    return {
      ok: true,
      intent: intent
    };
  }

  return {
    ok: false,
    stage: "Authorize",
    errors: ["Only admins can manage games."]
  };
}

async function processGamesIntent(intent) {
  if (intent.type === "OpenGamesDashboardIntent") {
    return processOpenGamesDashboard(intent);
  }

  if (intent.type === "OpenGameDetailIntent") {
    return processOpenGameDetail(intent);
  }

  if (intent.type === "LoadGameConfigIntent") {
    return processLoadGameConfig(intent);
  }

  if (intent.type === "LoadSpinImagesIntent") {
    return processLoadSpinImages(intent);
  }

  if (intent.type === "AddSpinImageIntent") {
    return processAddSpinImage(intent);
  }

  if (intent.type === "RemoveSpinImageIntent") {
    return processRemoveSpinImage(intent);
  }

  if (intent.type === "OpenPayoutModalIntent") {
    return processOpenPayoutModal(intent);
  }

  if (intent.type === "ClosePayoutModalIntent") {
    return processClosePayoutModal(intent);
  }

  return {
    ok: false,
    stage: "Process",
    errors: ["Unknown games intent."]
  };
}

function processOpenGamesDashboard(intent) {
  intent.context.resultData = {
    view: "dashboard",
    games: intent.context.availableGames
  };

  return {
    ok: true,
    intent: intent
  };
}

function processOpenGameDetail(intent) {
  if (!intent.context.game) {
    return {
      ok: false,
      stage: "Process",
      errors: ["Game not found."]
    };
  }

  intent.context.resultData = {
    view: "detail",
    game: intent.context.game,
    sections: ["Spin Pictures", "Payouts / Rewards", "Game Settings"]
  };

  return {
    ok: true,
    intent: intent
  };
}

function processLoadGameConfig(intent) {
  var settings = {};

  if (intent.context.settingsSnapshot && intent.context.settingsSnapshot.exists()) {
    settings = intent.context.settingsSnapshot.data() || {};
  }

  intent.context.resultData = {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    game: intent.context.game,
    settings: settings,
    spinImages: applyManagedOrFallback(intent.context.spinImages, intent.context.fallbackImages, intent.context.minActiveImages),
    activeCount: countActiveImages(intent.context.spinImages),
    minActiveImages: intent.context.minActiveImages
  };

  return {
    ok: true,
    intent: intent
  };
}

function processLoadSpinImages(intent) {
  var managedImages = intent.context.spinImages || [];
  var activeManagedImages = getActiveImages(managedImages);
  var source = "firestore";
  var images = managedImages;

  if (activeManagedImages.length < intent.context.minActiveImages) {
    images = normalizeFallbackImages(intent.context.fallbackImages);
    source = "fallback";
  }

  intent.context.resultData = {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    images: getActiveImages(images),
    managedImages: managedImages,
    source: source,
    activeCount: activeManagedImages.length,
    minActiveImages: intent.context.minActiveImages
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processAddSpinImage(intent) {
  var payload = intent.payload;
  var imageRef = doc(intent.context.spinImagesCollectionRef);
  var now = serverTimestamp();
  var label = payload.label || "Spin picture";
  var sortOrder = payload.sortOrder || Date.now();

  // Managed spin pictures live under the store/game path so future games can
  // add their own image collections without sharing hamster-specific data.
  await setDoc(imageRef, {
    id: imageRef.id,
    storeId: payload.storeId,
    gameId: payload.gameId,
    imageUrl: payload.imageUrl,
    label: label,
    active: payload.active !== false,
    sortOrder: sortOrder,
    createdAt: now,
    updatedAt: now
  });

  intent.context.resultData = {
    id: imageRef.id,
    storeId: payload.storeId,
    gameId: payload.gameId,
    imageUrl: payload.imageUrl,
    label: label,
    active: payload.active !== false,
    sortOrder: sortOrder
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processRemoveSpinImage(intent) {
  var activeCount = intent.context.activeSpinImageCount || 0;

  if (!intent.context.targetSpinImage) {
    return {
      ok: false,
      stage: "Process",
      errors: ["Spin image not found."]
    };
  }

  if (intent.context.targetSpinImage.active !== false && activeCount <= intent.context.minActiveImages) {
    return {
      ok: false,
      stage: "Process",
      errors: [MIN_SPIN_MESSAGE]
    };
  }

  // Removal keeps the record but deactivates it, preserving legacy references.
  await updateDoc(doc(intent.context.spinImagesCollectionRef, intent.payload.id), {
    active: false,
    updatedAt: serverTimestamp()
  });

  intent.context.resultData = {
    id: intent.payload.id,
    removed: true,
    activeCountBeforeRemove: activeCount,
    activeCountAfterRemove: activeCount - 1
  };

  return {
    ok: true,
    intent: intent
  };
}

function processOpenPayoutModal(intent) {
  intent.context.resultData = {
    modal: "payouts",
    open: true,
    payouts: intent.context.payouts
  };

  return {
    ok: true,
    intent: intent
  };
}

function processClosePayoutModal(intent) {
  intent.context.resultData = {
    modal: "payouts",
    open: false
  };

  return {
    ok: true,
    intent: intent
  };
}

function emitGamesResult(intent) {
  var eventType = intent.type.replace("Intent", "");

  intent.context.events = [
    {
      type: eventType,
      storeId: intent.payload.storeId || intent.context.storeId,
      gameId: intent.payload.gameId || intent.context.gameId,
      createdAt: Date.now()
    }
  ];

  return {
    ok: true,
    intent: intent
  };
}

async function loadSpinImageRecords(collectionRef, activeOnly) {
  var records = [];
  var spinQuery = activeOnly ? query(collectionRef, where("active", "==", true)) : query(collectionRef, orderBy("sortOrder", "asc"));
  var snap = await getDocs(spinQuery);
  var index = 0;

  while (index < snap.docs.length) {
    records.push(normalizeSpinImageRecord(snap.docs[index]));
    index = index + 1;
  }

  return sortSpinImageRecords(records);
}

function normalizeSpinImageRecord(snapshot) {
  var data = snapshot.data() || {};

  return {
    id: data.id || snapshot.id,
    storeId: data.storeId || "",
    gameId: data.gameId || "",
    imageUrl: data.imageUrl || "",
    label: data.label || data.name || "Spin picture",
    active: data.active !== false,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    source: "firestore"
  };
}

function applyManagedOrFallback(managedImages, fallbackImages, minActiveImages) {
  if (countActiveImages(managedImages) >= minActiveImages) {
    return managedImages;
  }

  return normalizeFallbackImages(fallbackImages);
}

function normalizeFallbackImages(fallbackImages) {
  var images = [];
  var index = 0;

  while (index < fallbackImages.length) {
    var item = fallbackImages[index] || {};
    images.push({
      id: item.id || "fallback_" + index,
      imageUrl: item.imageUrl || item.img || "",
      label: item.label || item.name || "Fallback picture",
      active: item.active !== false,
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index + 1,
      source: "fallback"
    });
    index = index + 1;
  }

  return images;
}

function getActiveImages(images) {
  var activeImages = [];
  var index = 0;

  while (index < images.length) {
    if (images[index] && images[index].active !== false && images[index].imageUrl) {
      activeImages.push(images[index]);
    }
    index = index + 1;
  }

  return activeImages;
}

function countActiveImages(images) {
  return getActiveImages(images || []).length;
}

function findSpinImage(images, id) {
  var index = 0;

  while (index < images.length) {
    if (images[index].id === id) {
      return images[index];
    }
    index = index + 1;
  }

  return null;
}

function findGame(games, gameId) {
  var index = 0;

  while (index < games.length) {
    if (games[index].id === gameId) {
      return games[index];
    }
    index = index + 1;
  }

  return null;
}

function sortSpinImageRecords(records) {
  return records.sort(compareSpinImageRecords);
}

function compareSpinImageRecords(a, b) {
  var left = typeof a.sortOrder === "number" ? a.sortOrder : 0;
  var right = typeof b.sortOrder === "number" ? b.sortOrder : 0;

  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function getDefaultGames() {
  return [
    {
      id: DEFAULT_GAME_ID,
      title: "Hamster Spin Game",
      status: "Active",
      description: "Manage spin images, payouts, rewards, and game settings."
    }
  ];
}

function getDefaultPayouts() {
  return [
    { line: "2 matching spin pictures", reward: "Small seed prize" },
    { line: "3 matching spin pictures", reward: "Larger seed prize" },
    { line: "Jackpot match", reward: "Premium reward tier" }
  ];
}

export {
  createOpenGamesDashboardIntent,
  createOpenGameDetailIntent,
  createLoadGameConfigIntent,
  createLoadSpinImagesIntent,
  createAddSpinImageIntent,
  createRemoveSpinImageIntent,
  createOpenPayoutModalIntent,
  createClosePayoutModalIntent
};

export default {
  createOpenGamesDashboardIntent: createOpenGamesDashboardIntent,
  createOpenGameDetailIntent: createOpenGameDetailIntent,
  createLoadGameConfigIntent: createLoadGameConfigIntent,
  createLoadSpinImagesIntent: createLoadSpinImagesIntent,
  createAddSpinImageIntent: createAddSpinImageIntent,
  createRemoveSpinImageIntent: createRemoveSpinImageIntent,
  createOpenPayoutModalIntent: createOpenPayoutModalIntent,
  createClosePayoutModalIntent: createClosePayoutModalIntent
};
