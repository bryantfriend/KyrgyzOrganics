import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import resultHelpers from "../../../../engine/resultHelpers.js";
import {
  MIN_SPIN_MESSAGE,
  applyManagedOrFallback,
  buildGameAnalytics,
  buildPayoutLabel,
  buildPayoutRuleData,
  countActiveImages,
  getActiveImages,
  getActivePayoutRules,
  normalizeDailyLoginBonuses,
  normalizeFallbackImages,
  normalizeFallbackPayoutRules,
  normalizePayoutRuleData
} from "./gamesHelpers.js";

function processOpenGamesDashboard(intent) {
  intent.context.resultData = {
    view: "dashboard",
    games: intent.context.availableGames
  };

  return resultHelpers.success(intent);
}

function processOpenGameDetail(intent) {
  if (!intent.context.game) {
    return resultHelpers.processFailure(["Game not found."]);
  }

  intent.context.resultData = {
    view: "detail",
    game: intent.context.game,
    sections: ["Spin Pictures", "Payouts / Rewards", "Game Settings"]
  };

  return resultHelpers.success(intent);
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

  return resultHelpers.success(intent);
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

  return resultHelpers.success(intent);
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

  return resultHelpers.success(intent);
}

function processLoadGameAnalytics(intent) {
  intent.context.resultData = {
    storeId: intent.payload.storeId,
    gameId: intent.payload.gameId,
    analytics: buildGameAnalytics(intent)
  };

  return resultHelpers.success(intent);
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

  return resultHelpers.success(intent);
}

async function processAddSpinImage(intent) {
  var payload = intent.payload;
  var imageRef = doc(intent.context.spinImagesCollectionRef);
  var now = serverTimestamp();
  var label = payload.label || "Spin picture";
  var sortOrder = payload.sortOrder || Date.now();

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

  return resultHelpers.success(intent);
}

async function processRemoveSpinImage(intent) {
  var activeCount = intent.context.activeSpinImageCount || 0;

  if (!intent.context.targetSpinImage) {
    return resultHelpers.processFailure(["Spin image not found."]);
  }

  if (intent.context.targetSpinImage.active !== false && activeCount <= intent.context.minActiveImages) {
    return resultHelpers.processFailure([MIN_SPIN_MESSAGE]);
  }

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

  return resultHelpers.success(intent);
}

function processOpenPayoutModal(intent) {
  intent.context.resultData = {
    modal: "payouts",
    open: true,
    payouts: intent.context.payouts
  };

  return resultHelpers.success(intent);
}

function processClosePayoutModal(intent) {
  intent.context.resultData = {
    modal: "payouts",
    open: false
  };

  return resultHelpers.success(intent);
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

  return resultHelpers.success(intent);
}

async function processAddPayoutRule(intent) {
  var payload = intent.payload;
  var payoutRef = doc(intent.context.payoutRulesCollectionRef);
  var rule = buildPayoutRuleData(payload, payoutRef.id, serverTimestamp(), serverTimestamp());

  await setDoc(payoutRef, rule);

  intent.context.resultData = normalizePayoutRuleData(rule);

  return resultHelpers.success(intent);
}

async function processUpdatePayoutRule(intent) {
  var payload = intent.payload;
  var existing = intent.context.targetPayoutRule;

  if (!existing) {
    return resultHelpers.processFailure(["Payout rule not found."]);
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

  return resultHelpers.success(intent);
}

async function processRemovePayoutRule(intent) {
  if (!intent.context.targetPayoutRule) {
    return resultHelpers.processFailure(["Payout rule not found."]);
  }

  await deleteDoc(doc(intent.context.payoutRulesCollectionRef, intent.payload.id));

  intent.context.resultData = {
    id: intent.payload.id,
    removed: true
  };

  return resultHelpers.success(intent);
}

async function processTogglePayoutRule(intent) {
  var existing = intent.context.targetPayoutRule;

  if (!existing) {
    return resultHelpers.processFailure(["Payout rule not found."]);
  }

  await updateDoc(doc(intent.context.payoutRulesCollectionRef, intent.payload.id), {
    active: existing.active === false,
    updatedAt: serverTimestamp()
  });

  intent.context.resultData = {
    id: intent.payload.id,
    active: existing.active === false
  };

  return resultHelpers.success(intent);
}

export {
  processOpenGamesDashboard,
  processOpenGameDetail,
  processLoadGameConfig,
  processLoadGameSettings,
  processSaveDailyLoginBonuses,
  processLoadGameAnalytics,
  processLoadSpinImages,
  processAddSpinImage,
  processRemoveSpinImage,
  processOpenPayoutModal,
  processClosePayoutModal,
  processLoadPayoutRules,
  processAddPayoutRule,
  processUpdatePayoutRule,
  processRemovePayoutRule,
  processTogglePayoutRule
};
