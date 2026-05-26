var DEFAULT_STORE_ID = "kyrgyz-organics";
var DEFAULT_GAME_ID = "hamster-spin";
var MIN_SPIN_IMAGES = 4;
var MIN_SPIN_MESSAGE = "Spinning mode must have at least 4 pictures.";

function createGamesBaseContext(options) {
  var safeOptions = options || {};

  return {
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
  };
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

function compareSpinImageRecords(leftRecord, rightRecord) {
  var left = typeof leftRecord.sortOrder === "number" ? leftRecord.sortOrder : 0;
  var right = typeof rightRecord.sortOrder === "number" ? rightRecord.sortOrder : 0;

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

function comparePayoutRuleRecords(leftRecord, rightRecord) {
  var left = typeof leftRecord.sortOrder === "number" ? leftRecord.sortOrder : 0;
  var right = typeof rightRecord.sortOrder === "number" ? rightRecord.sortOrder : 0;

  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
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
    validateDailyLoginBonus(errors, bonuses[index] || {}, index);
    index = index + 1;
  }
}

function validateDailyLoginBonus(errors, bonus, index) {
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
    normalized.push(normalizeDailyLoginBonus(bonuses[index] || {}, index));
    index = index + 1;
  }

  return normalized.sort(compareDailyLoginBonuses);
}

function normalizeDailyLoginBonus(bonus, index) {
  var day = isFinite(Number(bonus.day)) ? Number(bonus.day) : index + 1;
  var spins = isFinite(Number(bonus.spins)) ? Number(bonus.spins) : 0;
  var seeds = bonus.seeds || {};

  return {
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
  };
}

function getSafeSeedAmount(seeds, key) {
  var amount = seeds && isFinite(Number(seeds[key])) ? Number(seeds[key]) : 0;
  return Math.max(0, amount);
}

function compareDailyLoginBonuses(leftBonus, rightBonus) {
  var left = typeof leftBonus.sortOrder === "number" ? leftBonus.sortOrder : leftBonus.day;
  var right = typeof rightBonus.sortOrder === "number" ? rightBonus.sortOrder : rightBonus.day;

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
  DEFAULT_STORE_ID,
  DEFAULT_GAME_ID,
  MIN_SPIN_IMAGES,
  MIN_SPIN_MESSAGE,
  createGamesBaseContext,
  normalizeSpinImageRecord,
  normalizePayoutRuleRecord,
  normalizePayoutRuleData,
  buildPayoutRuleData,
  applyManagedOrFallback,
  normalizeFallbackImages,
  normalizeFallbackPayoutRules,
  getActiveImages,
  countActiveImages,
  getActivePayoutRules,
  findSpinImage,
  findPayoutRule,
  findGame,
  sortSpinImageRecords,
  sortPayoutRuleRecords,
  isValidRewardType,
  buildPayoutLabel,
  validateDailyLoginBonuses,
  normalizeDailyLoginBonuses,
  buildGameAnalytics
};
