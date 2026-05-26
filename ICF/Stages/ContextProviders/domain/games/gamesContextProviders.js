import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import resultHelpers from "../../../../Engine/resultHelpers.js";
import {
  countActiveImages,
  findGame,
  findPayoutRule,
  findSpinImage,
  normalizePayoutRuleRecord,
  normalizeSpinImageRecord,
  sortPayoutRuleRecords,
  sortSpinImageRecords
} from "../../../Processors/domain/games/gamesHelpers.js";

function addOpenGamesDashboardContext(intent) {
  return resultHelpers.success(intent);
}

function addOpenGameDetailContext(intent) {
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  return resultHelpers.success(intent);
}

async function addLoadGameConfigContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.settingsSnapshot = await getDoc(intent.context.settingsRef);
  intent.context.spinImages = await loadSpinImageRecords(intent.context.spinImagesCollectionRef, false);
  return resultHelpers.success(intent);
}

async function addLoadGameSettingsContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.settingsSnapshot = await getDoc(intent.context.settingsRef);
  intent.context.spinImages = await loadSpinImageRecords(intent.context.spinImagesCollectionRef, false);
  return resultHelpers.success(intent);
}

async function addSaveDailyLoginBonusesContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.settingsSnapshot = await getDoc(intent.context.settingsRef);
  intent.context.spinImages = await loadSpinImageRecords(intent.context.spinImagesCollectionRef, false);
  return resultHelpers.success(intent);
}

async function addLoadGameAnalyticsContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.customersSnapshot = await getDocs(collection(intent.context.db, "individual_customers"));
  intent.context.spinImages = await loadSpinImageRecords(intent.context.spinImagesCollectionRef, false);
  intent.context.payoutRules = await loadPayoutRuleRecords(intent.context.payoutRulesCollectionRef, false);
  intent.context.settingsSnapshot = await getDoc(intent.context.settingsRef);
  return resultHelpers.success(intent);
}

async function addLoadSpinImagesContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.spinImages = await loadSpinImageRecords(intent.context.spinImagesCollectionRef, intent.payload.includeInactive !== true);
  intent.context.activeSpinImageCount = countActiveImages(intent.context.spinImages);
  return resultHelpers.success(intent);
}

function addAddSpinImageContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  return resultHelpers.success(intent);
}

async function addRemoveSpinImageContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.spinImages = await loadSpinImageRecords(intent.context.spinImagesCollectionRef, false);
  intent.context.activeSpinImageCount = countActiveImages(intent.context.spinImages);
  intent.context.targetSpinImage = findSpinImage(intent.context.spinImages, intent.payload.id);
  return resultHelpers.success(intent);
}

function addOpenPayoutModalContext(intent) {
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  return resultHelpers.success(intent);
}

function addClosePayoutModalContext(intent) {
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  return resultHelpers.success(intent);
}

async function addLoadPayoutRulesContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.payoutRules = await loadPayoutRuleRecords(intent.context.payoutRulesCollectionRef, intent.payload.includeInactive !== true);
  return resultHelpers.success(intent);
}

function addAddPayoutRuleContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  return resultHelpers.success(intent);
}

async function addUpdatePayoutRuleContext(intent) {
  return addTargetPayoutRuleContext(intent);
}

async function addRemovePayoutRuleContext(intent) {
  return addTargetPayoutRuleContext(intent);
}

async function addTogglePayoutRuleContext(intent) {
  return addTargetPayoutRuleContext(intent);
}

async function addTargetPayoutRuleContext(intent) {
  addGameRefs(intent);
  intent.context.game = findGame(intent.context.availableGames, intent.payload.gameId);
  intent.context.payoutRules = await loadPayoutRuleRecords(intent.context.payoutRulesCollectionRef, false);
  intent.context.targetPayoutRule = findPayoutRule(intent.context.payoutRules, intent.payload.id);
  return resultHelpers.success(intent);
}

function addGameRefs(intent) {
  var context = intent.context;
  var payload = intent.payload;

  context.settingsRef = doc(context.db, "stores", payload.storeId, "games", payload.gameId, "settings", "main");
  context.spinImagesCollectionRef = collection(context.db, "stores", payload.storeId, "games", payload.gameId, "spinImages");
  context.payoutRulesCollectionRef = collection(context.db, "stores", payload.storeId, "games", payload.gameId, "payouts");
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

export {
  addOpenGamesDashboardContext,
  addOpenGameDetailContext,
  addLoadGameConfigContext,
  addLoadGameSettingsContext,
  addSaveDailyLoginBonusesContext,
  addLoadGameAnalyticsContext,
  addLoadSpinImagesContext,
  addAddSpinImageContext,
  addRemoveSpinImageContext,
  addOpenPayoutModalContext,
  addClosePayoutModalContext,
  addLoadPayoutRulesContext,
  addAddPayoutRuleContext,
  addUpdatePayoutRuleContext,
  addRemovePayoutRuleContext,
  addTogglePayoutRuleContext
};
