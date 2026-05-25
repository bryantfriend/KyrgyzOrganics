export var HAMSTER_DEFAULT_PAYOUT_RULES = [
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
