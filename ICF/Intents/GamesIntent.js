import {
  collection,
  deleteDoc,
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

function createLoadGameSettingsIntent(actor, payload, options) {
  return createGamesIntent("LoadGameSettingsIntent", actor, payload, options);
}

function createSaveDailyLoginBonusesIntent(actor, payload, options) {
  return createGamesIntent("SaveDailyLoginBonusesIntent", actor, payload, options);
}

function createLoadGameAnalyticsIntent(actor, payload, options) {
  return createGamesIntent("LoadGameAnalyticsIntent", actor, payload, options);
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

function createLoadPayoutRulesIntent(actor, payload, options) {
  return createGamesIntent("LoadPayoutRulesIntent", actor, payload, options);
}

function createAddPayoutRuleIntent(actor, payload, options) {
  return createGamesIntent("AddPayoutRuleIntent", actor, payload, options);
}

function createUpdatePayoutRuleIntent(actor, payload, options) {
  return createGamesIntent("UpdatePayoutRuleIntent", actor, payload, options);
}

function createRemovePayoutRuleIntent(actor, payload, options) {
  return createGamesIntent("RemovePayoutRuleIntent", actor, payload, options);
}

function createTogglePayoutRuleIntent(actor, payload, options) {
  return createGamesIntent("TogglePayoutRuleIntent", actor, payload, options);
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
      fallbackPayoutRules: safeOptions.fallbackPayoutRules || getDefaultPayoutRules(),
      fallbackDailyLoginBonuses: safeOptions.fallbackDailyLoginBonuses || getDefaultDailyLoginBonuses(),
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

  if (isPayoutWriteIntent(intent.type) && !payload.rewardName && intent.type !== "RemovePayoutRuleIntent" && intent.type !== "TogglePayoutRuleIntent") {
    errors.push("rewardName is required.");
  }

  if (isPayoutWriteIntent(intent.type) && !isValidRewardType(payload.rewardType) && intent.type !== "RemovePayoutRuleIntent" && intent.type !== "TogglePayoutRuleIntent") {
    errors.push("rewardType is invalid.");
  }

  if ((intent.type === "AddPayoutRuleIntent" || intent.type === "UpdatePayoutRuleIntent") && payload.requiredMatches === undefined) {
    errors.push("requiredMatches is required.");
  }

  if (isPayoutWriteIntent(intent.type) && payload.requiredMatches !== undefined && (!isFinite(Number(payload.requiredMatches)) || Number(payload.requiredMatches) <= 0)) {
    errors.push("requiredMatches must be a positive number.");
  }

  if ((intent.type === "AddPayoutRuleIntent" || intent.type === "UpdatePayoutRuleIntent") && payload.payoutAmount === undefined) {
    errors.push("payoutAmount is required.");
  }

  if (isPayoutWriteIntent(intent.type) && payload.payoutAmount !== undefined && (!isFinite(Number(payload.payoutAmount)) || Number(payload.payoutAmount) < 0)) {
    errors.push("payoutAmount must be a non-negative number.");
  }

  if ((intent.type === "UpdatePayoutRuleIntent" || intent.type === "RemovePayoutRuleIntent" || intent.type === "TogglePayoutRuleIntent") && !payload.id) {
    errors.push("Payout rule id is required.");
  }

  if (intent.type === "SaveDailyLoginBonusesIntent" && !Array.isArray(payload.dailyLoginBonuses)) {
    errors.push("dailyLoginBonuses must be a list.");
  }

  if (intent.type === "SaveDailyLoginBonusesIntent") {
    validateDailyLoginBonuses(errors, payload.dailyLoginBonuses || []);
  }

  if ((intent.type === "LoadSpinImagesIntent" || intent.type === "AddSpinImageIntent" || intent.type === "RemoveSpinImageIntent" || intent.type === "LoadGameConfigIntent" || intent.type === "LoadGameSettingsIntent" || intent.type === "SaveDailyLoginBonusesIntent" || intent.type === "LoadGameAnalyticsIntent" || intent.type === "LoadPayoutRulesIntent" || isPayoutWriteIntent(intent.type)) && !intent.context.db) {
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

  if (typeof payload.rewardName === "string") {
    normalized.rewardName = payload.rewardName.trim();
  }

  if (typeof payload.rewardType === "string") {
    normalized.rewardType = payload.rewardType.trim();
  }

  if (typeof payload.matchType === "string") {
    normalized.matchType = payload.matchType.trim();
  }

  if (typeof payload.payoutLabel === "string") {
    normalized.payoutLabel = payload.payoutLabel.trim();
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

  if (payload.requiredMatches !== undefined && isFinite(Number(payload.requiredMatches))) {
    normalized.requiredMatches = Number(payload.requiredMatches);
  }

  if (payload.payoutAmount !== undefined && isFinite(Number(payload.payoutAmount))) {
    normalized.payoutAmount = Number(payload.payoutAmount);
  }

  if (Array.isArray(payload.dailyLoginBonuses)) {
    normalized.dailyLoginBonuses = normalizeDailyLoginBonuses(payload.dailyLoginBonuses);
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
  context.payoutRulesCollectionRef = collection(context.db, "stores", payload.storeId, "games", payload.gameId, "payouts");

  if (intent.type === "LoadGameConfigIntent" || intent.type === "LoadGameSettingsIntent" || intent.type === "SaveDailyLoginBonusesIntent") {
    context.settingsSnapshot = await getDoc(context.settingsRef);
    context.spinImages = await loadSpinImageRecords(context.spinImagesCollectionRef, false);
  }

  if (intent.type === "LoadGameAnalyticsIntent") {
    context.customersSnapshot = await getDocs(collection(context.db, "individual_customers"));
    context.spinImages = await loadSpinImageRecords(context.spinImagesCollectionRef, false);
    context.payoutRules = await loadPayoutRuleRecords(context.payoutRulesCollectionRef, false);
    context.settingsSnapshot = await getDoc(context.settingsRef);
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

  if (intent.type === "LoadPayoutRulesIntent") {
    context.payoutRules = await loadPayoutRuleRecords(context.payoutRulesCollectionRef, intent.payload.includeInactive !== true);
  }

  if (intent.type === "UpdatePayoutRuleIntent" || intent.type === "RemovePayoutRuleIntent" || intent.type === "TogglePayoutRuleIntent") {
    context.payoutRules = await loadPayoutRuleRecords(context.payoutRulesCollectionRef, false);
    context.targetPayoutRule = findPayoutRule(context.payoutRules, payload.id);
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
  var readOnlyPayoutLoad = source === "game" && intent.type === "LoadPayoutRulesIntent";
  var readOnlySettingsLoad = source === "game" && intent.type === "LoadGameSettingsIntent";

  if ((readOnlyGameLoad || readOnlyPayoutLoad || readOnlySettingsLoad) && (role === "system" || role === "admin" || role === "superadmin")) {
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

  if (intent.type === "LoadGameSettingsIntent") {
    return processLoadGameSettings(intent);
  }

  if (intent.type === "SaveDailyLoginBonusesIntent") {
    return processSaveDailyLoginBonuses(intent);
  }

  if (intent.type === "LoadGameAnalyticsIntent") {
    return processLoadGameAnalytics(intent);
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

  if (intent.type === "LoadPayoutRulesIntent") {
    return processLoadPayoutRules(intent);
  }

  if (intent.type === "AddPayoutRuleIntent") {
    return processAddPayoutRule(intent);
  }

  if (intent.type === "UpdatePayoutRuleIntent") {
    return processUpdatePayoutRule(intent);
  }

  if (intent.type === "RemovePayoutRuleIntent") {
    return processRemovePayoutRule(intent);
  }

  if (intent.type === "TogglePayoutRuleIntent") {
    return processTogglePayoutRule(intent);
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

function processLoadGameSettings(intent) {
  var settings = {};
  var dailyLoginBonuses;

  if (intent.context.settingsSnapshot && intent.context.settingsSnapshot.exists()) {
    settings = intent.context.settingsSnapshot.data() || {};
  }

  dailyLoginBonuses = Array.isArray(settings.dailyLoginBonuses)
    ? normalizeDailyLoginBonuses(settings.dailyLoginBonuses)
    : normalizeDailyLoginBonuses(intent.context.fallbackDailyLoginBonuses);

  intent.context.resultData = {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    settings: settings,
    dailyLoginBonuses: dailyLoginBonuses,
    source: Array.isArray(settings.dailyLoginBonuses) ? "firestore" : "fallback"
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processSaveDailyLoginBonuses(intent) {
  await setDoc(intent.context.settingsRef, {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    dailyLoginBonuses: intent.payload.dailyLoginBonuses,
    updatedAt: serverTimestamp()
  }, { merge: true });

  intent.context.resultData = {
    saved: true,
    dailyLoginBonuses: intent.payload.dailyLoginBonuses
  };

  return {
    ok: true,
    intent: intent
  };
}

function processLoadGameAnalytics(intent) {
  var analytics = buildGameAnalytics(intent);

  intent.context.resultData = {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    analytics: analytics
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

function processLoadPayoutRules(intent) {
  var managedRules = intent.context.payoutRules || [];
  var activeManagedRules = getActivePayoutRules(managedRules);
  var source = "firestore";
  var rules = managedRules;

  if (!activeManagedRules.length) {
    rules = normalizeFallbackPayoutRules(intent.context.fallbackPayoutRules);
    source = "fallback";
  }

  intent.context.resultData = {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    payoutRules: intent.payload.includeInactive === true ? rules : getActivePayoutRules(rules),
    managedPayoutRules: managedRules,
    source: source,
    activeCount: activeManagedRules.length
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processAddPayoutRule(intent) {
  var payload = intent.payload;
  var payoutRef = doc(intent.context.payoutRulesCollectionRef);
  var rule = buildPayoutRuleData(payload, payoutRef.id, serverTimestamp(), serverTimestamp());

  await setDoc(payoutRef, rule);

  intent.context.resultData = normalizePayoutRuleData(rule);

  return {
    ok: true,
    intent: intent
  };
}

async function processUpdatePayoutRule(intent) {
  var payload = intent.payload;
  var existing = intent.context.targetPayoutRule;

  if (!existing) {
    return {
      ok: false,
      stage: "Process",
      errors: ["Payout rule not found."]
    };
  }

  await updateDoc(doc(intent.context.payoutRulesCollectionRef, payload.id), {
    rewardName: payload.rewardName,
    rewardType: payload.rewardType,
    matchType: payload.matchType || "matches",
    requiredMatches: payload.requiredMatches || 1,
    payoutAmount: payload.payoutAmount || 0,
    payoutLabel: payload.payoutLabel || buildPayoutLabel(payload.payoutAmount, payload.rewardType),
    active: payload.active !== false,
    sortOrder: payload.sortOrder || existing.sortOrder || Date.now(),
    updatedAt: serverTimestamp()
  });

  intent.context.resultData = {
    id: payload.id,
    updated: true
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processRemovePayoutRule(intent) {
  if (!intent.context.targetPayoutRule) {
    return {
      ok: false,
      stage: "Process",
      errors: ["Payout rule not found."]
    };
  }

  await deleteDoc(doc(intent.context.payoutRulesCollectionRef, intent.payload.id));

  intent.context.resultData = {
    id: intent.payload.id,
    removed: true
  };

  return {
    ok: true,
    intent: intent
  };
}

async function processTogglePayoutRule(intent) {
  var existing = intent.context.targetPayoutRule;

  if (!existing) {
    return {
      ok: false,
      stage: "Process",
      errors: ["Payout rule not found."]
    };
  }

  await updateDoc(doc(intent.context.payoutRulesCollectionRef, intent.payload.id), {
    active: existing.active === false,
    updatedAt: serverTimestamp()
  });

  intent.context.resultData = {
    id: intent.payload.id,
    active: existing.active === false
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

async function loadPayoutRuleRecords(collectionRef, activeOnly) {
  var records = [];
  var payoutQuery = activeOnly ? query(collectionRef, where("active", "==", true)) : query(collectionRef, orderBy("sortOrder", "asc"));
  var snap = await getDocs(payoutQuery);
  var index = 0;

  while (index < snap.docs.length) {
    records.push(normalizePayoutRuleRecord(snap.docs[index]));
    index = index + 1;
  }

  return sortPayoutRuleRecords(records);
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

function normalizePayoutRuleRecord(snapshot) {
  var data = snapshot.data() || {};
  var rule = normalizePayoutRuleData(data);

  rule.id = data.id || snapshot.id;
  rule.source = "firestore";

  return rule;
}

function normalizePayoutRuleData(data) {
  return {
    id: data.id || "",
    storeId: data.storeId || "",
    gameId: data.gameId || "",
    rewardName: data.rewardName || "",
    rewardType: data.rewardType || "poppy",
    matchType: data.matchType || "matches",
    requiredMatches: typeof data.requiredMatches === "number" ? data.requiredMatches : 1,
    payoutAmount: typeof data.payoutAmount === "number" ? data.payoutAmount : 0,
    payoutLabel: data.payoutLabel || buildPayoutLabel(data.payoutAmount, data.rewardType),
    active: data.active !== false,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    source: data.source || "firestore"
  };
}

function buildPayoutRuleData(payload, id, createdAt, updatedAt) {
  return {
    id: id,
    storeId: payload.storeId,
    gameId: payload.gameId,
    rewardName: payload.rewardName,
    rewardType: payload.rewardType,
    matchType: payload.matchType || "matches",
    requiredMatches: payload.requiredMatches || 1,
    payoutAmount: payload.payoutAmount || 0,
    payoutLabel: payload.payoutLabel || buildPayoutLabel(payload.payoutAmount, payload.rewardType),
    active: payload.active !== false,
    sortOrder: payload.sortOrder || Date.now(),
    createdAt: createdAt,
    updatedAt: updatedAt
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

function normalizeFallbackPayoutRules(fallbackRules) {
  var rules = [];
  var index = 0;

  while (index < fallbackRules.length) {
    var item = fallbackRules[index] || {};
    rules.push({
      id: item.id || "fallback_payout_" + index,
      storeId: item.storeId || DEFAULT_STORE_ID,
      gameId: item.gameId || DEFAULT_GAME_ID,
      rewardName: item.rewardName || "Fallback Reward",
      rewardType: item.rewardType || "poppy",
      matchType: item.matchType || "matches",
      requiredMatches: typeof item.requiredMatches === "number" ? item.requiredMatches : 1,
      payoutAmount: typeof item.payoutAmount === "number" ? item.payoutAmount : 0,
      payoutLabel: item.payoutLabel || buildPayoutLabel(item.payoutAmount, item.rewardType),
      active: item.active !== false,
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index + 1,
      source: "fallback"
    });
    index = index + 1;
  }

  return sortPayoutRuleRecords(rules);
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

function getActivePayoutRules(rules) {
  var activeRules = [];
  var index = 0;

  while (index < rules.length) {
    if (rules[index] && rules[index].active !== false) {
      activeRules.push(rules[index]);
    }
    index = index + 1;
  }

  return activeRules;
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

function findPayoutRule(rules, id) {
  var index = 0;

  while (index < rules.length) {
    if (rules[index].id === id) {
      return rules[index];
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

function sortPayoutRuleRecords(records) {
  return records.sort(comparePayoutRuleRecords);
}

function comparePayoutRuleRecords(a, b) {
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

function isPayoutWriteIntent(type) {
  return type === "AddPayoutRuleIntent"
    || type === "UpdatePayoutRuleIntent"
    || type === "RemovePayoutRuleIntent"
    || type === "TogglePayoutRuleIntent";
}

function isValidRewardType(rewardType) {
  return rewardType === "poppy"
    || rewardType === "sesame"
    || rewardType === "almond"
    || rewardType === "walnut"
    || rewardType === "seed"
    || rewardType === "seeds";
}

function buildPayoutLabel(amount, rewardType) {
  var safeAmount = isFinite(Number(amount)) ? Number(amount) : 0;
  var safeType = rewardType || "seed";

  if (safeType === "poppy" || safeType === "seed" || safeType === "seeds") {
    safeType = safeAmount === 1 ? "seed" : "seeds";
  }

  return String(safeAmount) + " " + safeType;
}

function validateDailyLoginBonuses(errors, bonuses) {
  var index = 0;

  while (index < bonuses.length) {
    var bonus = bonuses[index] || {};
    var label = "Daily login bonus " + String(index + 1) + ": ";

    if (!isFinite(Number(bonus.day)) || Number(bonus.day) <= 0) {
      errors.push(label + "day must be a positive number.");
    }

    if (!bonus.title || typeof bonus.title !== "string") {
      errors.push(label + "title is required.");
    }

    if (bonus.spins !== undefined && (!isFinite(Number(bonus.spins)) || Number(bonus.spins) < 0)) {
      errors.push(label + "spins must be a non-negative number.");
    }

    validateSeedAmount(errors, bonus, "poppy", label);
    validateSeedAmount(errors, bonus, "sesame", label);
    validateSeedAmount(errors, bonus, "almond", label);
    validateSeedAmount(errors, bonus, "walnut", label);

    index = index + 1;
  }
}

function validateSeedAmount(errors, bonus, key, label) {
  if (bonus.seeds && bonus.seeds[key] !== undefined && (!isFinite(Number(bonus.seeds[key])) || Number(bonus.seeds[key]) < 0)) {
    errors.push(label + key + " must be a non-negative number.");
  }
}

function normalizeDailyLoginBonuses(bonuses) {
  var normalized = [];
  var index = 0;

  while (index < bonuses.length) {
    var bonus = bonuses[index] || {};
    var day = isFinite(Number(bonus.day)) ? Number(bonus.day) : index + 1;
    var spins = isFinite(Number(bonus.spins)) ? Number(bonus.spins) : 0;
    var seeds = bonus.seeds || {};

    normalized.push({
      day: day,
      title: typeof bonus.title === "string" ? bonus.title.trim() : "Day " + String(day),
      imageUrl: typeof bonus.imageUrl === "string" ? bonus.imageUrl.trim() : "",
      spins: Math.max(0, spins),
      seeds: {
        poppy: getSafeSeedAmount(seeds, "poppy"),
        sesame: getSafeSeedAmount(seeds, "sesame"),
        almond: getSafeSeedAmount(seeds, "almond"),
        walnut: getSafeSeedAmount(seeds, "walnut")
      },
      active: bonus.active !== false,
      sortOrder: isFinite(Number(bonus.sortOrder)) ? Number(bonus.sortOrder) : day * 10
    });

    index = index + 1;
  }

  return normalized.sort(compareDailyLoginBonuses);
}

function getSafeSeedAmount(seeds, key) {
  var amount = seeds && isFinite(Number(seeds[key])) ? Number(seeds[key]) : 0;
  return Math.max(0, amount);
}

function compareDailyLoginBonuses(a, b) {
  var left = typeof a.sortOrder === "number" ? a.sortOrder : a.day;
  var right = typeof b.sortOrder === "number" ? b.sortOrder : b.day;

  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function buildGameAnalytics(intent) {
  var docs = intent.context.customersSnapshot ? intent.context.customersSnapshot.docs : [];
  var stats = {
    totalPlayers: docs.length,
    totalSpins: 0,
    totalWins: 0,
    totalRewards: 0,
    pendingRewards: 0,
    activeSpinPictures: countActiveImages(intent.context.spinImages || []),
    activePayoutRules: getActivePayoutRules(intent.context.payoutRules || []).length,
    dailyBonusDays: 0,
    seedBankValue: 0,
    longestStreak: 0
  };
  var index = 0;

  if (intent.context.settingsSnapshot && intent.context.settingsSnapshot.exists()) {
    var settings = intent.context.settingsSnapshot.data() || {};
    stats.dailyBonusDays = Array.isArray(settings.dailyLoginBonuses) ? settings.dailyLoginBonuses.length : 0;
  }

  while (index < docs.length) {
    addCustomerAnalytics(stats, docs[index].data() || {});
    index = index + 1;
  }

  return stats;
}

function addCustomerAnalytics(stats, customer) {
  var customerStats = customer.stats || {};
  var rewards = Array.isArray(customer.rewards) ? customer.rewards : [];
  var seeds = customer.seeds || {};
  var loginBonus = customer.loginBonus || {};
  var index = 0;

  stats.totalSpins = stats.totalSpins + safeNumber(customerStats.totalSpins);
  stats.totalWins = stats.totalWins + safeNumber(customerStats.totalWins);
  stats.totalRewards = stats.totalRewards + rewards.length;
  stats.seedBankValue = stats.seedBankValue
    + safeNumber(seeds.poppy)
    + safeNumber(seeds.sesame) * 5
    + safeNumber(seeds.almond) * 50
    + safeNumber(seeds.walnut) * 1000;
  stats.longestStreak = Math.max(stats.longestStreak, safeNumber(loginBonus.longestStreak));

  while (index < rewards.length) {
    if (rewards[index] && rewards[index].status === "pending_approval") {
      stats.pendingRewards = stats.pendingRewards + 1;
    }
    index = index + 1;
  }
}

function safeNumber(value) {
  return isFinite(Number(value)) ? Number(value) : 0;
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

function getDefaultPayoutRules() {
  return [
    {
      id: "fallback_two_matches",
      rewardName: "Two Matches",
      rewardType: "poppy",
      matchType: "matches",
      requiredMatches: 2,
      payoutAmount: 1,
      payoutLabel: "1 seed",
      active: true,
      sortOrder: 10
    },
    {
      id: "fallback_three_matches",
      rewardName: "Three Matches",
      rewardType: "poppy",
      matchType: "matches",
      requiredMatches: 3,
      payoutAmount: 5,
      payoutLabel: "5 seeds",
      active: true,
      sortOrder: 20
    },
    {
      id: "fallback_four_matches",
      rewardName: "Four Matches",
      rewardType: "poppy",
      matchType: "matches",
      requiredMatches: 4,
      payoutAmount: 20,
      payoutLabel: "20 seeds",
      active: true,
      sortOrder: 30
    },
    {
      id: "fallback_jackpot",
      rewardName: "Jackpot",
      rewardType: "poppy",
      matchType: "jackpot",
      requiredMatches: 3,
      payoutAmount: 100,
      payoutLabel: "100 seeds",
      active: true,
      sortOrder: 40
    }
  ];
}

function getDefaultDailyLoginBonuses() {
  return [
    { day: 1, spins: 1, seeds: {}, title: "1 вращение", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 10 },
    { day: 2, spins: 0, seeds: { poppy: 10 }, title: "10 маковых семян", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 20 },
    { day: 3, spins: 0, seeds: { sesame: 1 }, title: "1 кунжутное семя", imageUrl: "./assets/seeds/seed-sesame.png", active: true, sortOrder: 30 },
    { day: 4, spins: 2, seeds: {}, title: "2 вращения", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 40 },
    { day: 5, spins: 0, seeds: { poppy: 25 }, title: "25 маковых семян", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 50 },
    { day: 6, spins: 0, seeds: { sesame: 1 }, title: "1 кунжутное семя", imageUrl: "./assets/seeds/seed-sesame.png", active: true, sortOrder: 60 },
    { day: 7, spins: 0, seeds: { almond: 1 }, title: "1 миндальное семя", imageUrl: "./assets/seeds/seed-almond.png", active: true, sortOrder: 70 },
    { day: 8, spins: 3, seeds: {}, title: "3 вращения", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 80 },
    { day: 9, spins: 0, seeds: { poppy: 40 }, title: "40 маковых семян", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 90 },
    { day: 10, spins: 0, seeds: { sesame: 2 }, title: "2 кунжутных семени", imageUrl: "./assets/seeds/seed-sesame.png", active: true, sortOrder: 100 },
    { day: 11, spins: 4, seeds: {}, title: "4 вращения", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 110 },
    { day: 12, spins: 0, seeds: { almond: 1 }, title: "1 миндальное семя", imageUrl: "./assets/seeds/seed-almond.png", active: true, sortOrder: 120 },
    { day: 13, spins: 2, seeds: { poppy: 75 }, title: "75 маковых семян и 2 вращения", imageUrl: "./assets/seeds/seed-poppy.png", active: true, sortOrder: 130 },
    { day: 14, spins: 10, seeds: { sesame: 5, walnut: 1 }, title: "Грецкий орех, 5 кунжутных семян и 10 вращений", imageUrl: "./assets/seeds/seed-walnut.png", active: true, sortOrder: 140 }
  ];
}

export {
  createOpenGamesDashboardIntent,
  createOpenGameDetailIntent,
  createLoadGameConfigIntent,
  createLoadGameSettingsIntent,
  createSaveDailyLoginBonusesIntent,
  createLoadGameAnalyticsIntent,
  createLoadSpinImagesIntent,
  createAddSpinImageIntent,
  createRemoveSpinImageIntent,
  createOpenPayoutModalIntent,
  createClosePayoutModalIntent,
  createLoadPayoutRulesIntent,
  createAddPayoutRuleIntent,
  createUpdatePayoutRuleIntent,
  createRemovePayoutRuleIntent,
  createTogglePayoutRuleIntent
};

export default {
  createOpenGamesDashboardIntent: createOpenGamesDashboardIntent,
  createOpenGameDetailIntent: createOpenGameDetailIntent,
  createLoadGameConfigIntent: createLoadGameConfigIntent,
  createLoadGameSettingsIntent: createLoadGameSettingsIntent,
  createSaveDailyLoginBonusesIntent: createSaveDailyLoginBonusesIntent,
  createLoadGameAnalyticsIntent: createLoadGameAnalyticsIntent,
  createLoadSpinImagesIntent: createLoadSpinImagesIntent,
  createAddSpinImageIntent: createAddSpinImageIntent,
  createRemoveSpinImageIntent: createRemoveSpinImageIntent,
  createOpenPayoutModalIntent: createOpenPayoutModalIntent,
  createClosePayoutModalIntent: createClosePayoutModalIntent,
  createLoadPayoutRulesIntent: createLoadPayoutRulesIntent,
  createAddPayoutRuleIntent: createAddPayoutRuleIntent,
  createUpdatePayoutRuleIntent: createUpdatePayoutRuleIntent,
  createRemovePayoutRuleIntent: createRemovePayoutRuleIntent,
  createTogglePayoutRuleIntent: createTogglePayoutRuleIntent
};
