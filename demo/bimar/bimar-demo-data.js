window.BIMAR_DEMO_DATA = {
  branches: [
    {
      id: "bishkek-south",
      name: "Bishkek South",
      pickup: "Bishkek South pickup desk, 12 Chui Avenue",
      localOffer: "10% off ready meals after 18:00"
    },
    {
      id: "asia-mall",
      name: "Asia Mall",
      pickup: "Asia Mall food court entrance pickup point",
      localOffer: "Fresh bread bundle with every breakfast set"
    },
    {
      id: "tokmok",
      name: "Tokmok",
      pickup: "Tokmok main branch, central checkout",
      localOffer: "Family grill pack available for pickup today"
    },
    {
      id: "osh-market",
      name: "Osh Market",
      pickup: "Osh Market branch, counter 4",
      localOffer: "Market produce basket from 499 KGS"
    },
    {
      id: "dordoi-area",
      name: "Dordoi Area",
      pickup: "Dordoi Area express pickup window",
      localOffer: "Bulk bakery orders ready in 30 minutes"
    }
  ],
  categories: [
    "Fresh Meat",
    "Turkish Bakery",
    "Ready Meals",
    "Drinks",
    "Fresh Produce",
    "Gift Certificates"
  ],
  products: [
    {
      id: "beef-steak",
      name: "Prime Beef Steak",
      category: "Fresh Meat",
      price: 890,
      points: 89,
      tone: "meat",
      description: "Premium butcher-cut beef steak for quick grilling, dinner kits, and campaign bundles.",
      availability: ["bishkek-south", "asia-mall", "tokmok", "dordoi-area"],
      related: ["bbq-bundle", "ayran", "tomato-cucumber-box"]
    },
    {
      id: "lamb-ribs",
      name: "Marinated Lamb Ribs",
      category: "Fresh Meat",
      price: 740,
      points: 74,
      tone: "meat",
      description: "Ready-to-cook lamb ribs with a house spice marinade for family dinners.",
      availability: ["bishkek-south", "osh-market", "tokmok"],
      related: ["flatbread", "summer-greens", "compote"]
    },
    {
      id: "chicken-skewers",
      name: "Chicken Skewers",
      category: "Fresh Meat",
      price: 420,
      points: 42,
      tone: "meat",
      description: "Prepared chicken skewers for pickup, delivery, or QR-driven in-store upsell.",
      availability: ["bishkek-south", "asia-mall", "osh-market", "dordoi-area"],
      related: ["bbq-bundle", "ayran", "baklava-box"]
    },
    {
      id: "fresh-bread",
      name: "Fresh Turkish Bread",
      category: "Turkish Bakery",
      price: 95,
      points: 10,
      tone: "bakery",
      description: "Warm daily bread designed for high-frequency orders and campaign happy hours.",
      availability: ["bishkek-south", "asia-mall", "tokmok", "osh-market", "dordoi-area"],
      related: ["breakfast-set", "ayran", "honey-cake"]
    },
    {
      id: "baklava-box",
      name: "Baklava Gift Box",
      category: "Turkish Bakery",
      price: 620,
      points: 62,
      tone: "bakery",
      description: "Layered pistachio baklava packaged for gifting, delivery links, and QR campaigns.",
      availability: ["bishkek-south", "asia-mall", "dordoi-area"],
      related: ["gift-1000", "turkish-coffee", "honey-cake"]
    },
    {
      id: "honey-cake",
      name: "Honey Cake Slice",
      category: "Turkish Bakery",
      price: 180,
      points: 18,
      tone: "bakery",
      description: "Soft honey cake slice that works as a checkout add-on or campaign cross-sell.",
      availability: ["asia-mall", "osh-market", "dordoi-area"],
      related: ["turkish-coffee", "baklava-box", "fresh-bread"]
    },
    {
      id: "plov-tray",
      name: "Family Plov Tray",
      category: "Ready Meals",
      price: 1250,
      points: 125,
      tone: "meal",
      description: "A sharable ready meal for family ordering, offices, and campaign bundles.",
      availability: ["bishkek-south", "tokmok", "osh-market"],
      related: ["compote", "summer-greens", "fresh-bread"]
    },
    {
      id: "breakfast-set",
      name: "Turkish Breakfast Set",
      category: "Ready Meals",
      price: 690,
      points: 69,
      tone: "meal",
      description: "Breakfast set with bread, cheese, olives, tomatoes, and tea pairing suggestions.",
      availability: ["bishkek-south", "asia-mall", "dordoi-area"],
      related: ["fresh-bread", "turkish-coffee", "tomato-cucumber-box"]
    },
    {
      id: "bbq-bundle",
      name: "Summer BBQ Bundle",
      category: "Ready Meals",
      price: 1850,
      points: 185,
      tone: "meal",
      description: "A complete grill-ready bundle that demonstrates campaign pricing and cross-channel orders.",
      availability: ["bishkek-south", "tokmok", "dordoi-area"],
      related: ["beef-steak", "chicken-skewers", "ayran"]
    },
    {
      id: "ayran",
      name: "Cold Ayran",
      category: "Drinks",
      price: 85,
      points: 9,
      tone: "drink",
      description: "Fresh ayran positioned as an easy add-on in product pages and checkout flows.",
      availability: ["bishkek-south", "asia-mall", "tokmok", "osh-market", "dordoi-area"],
      related: ["fresh-bread", "chicken-skewers", "plov-tray"]
    },
    {
      id: "turkish-coffee",
      name: "Turkish Coffee",
      category: "Drinks",
      price: 140,
      points: 14,
      tone: "drink",
      description: "Demo beverage item for pickup, shelf QR, and cafe-style promotional bundles.",
      availability: ["asia-mall", "dordoi-area"],
      related: ["baklava-box", "honey-cake", "breakfast-set"]
    },
    {
      id: "compote",
      name: "House Compote",
      category: "Drinks",
      price: 120,
      points: 12,
      tone: "drink",
      description: "House drink that can be promoted through receipts, posters, and social deep links.",
      availability: ["bishkek-south", "tokmok", "osh-market"],
      related: ["plov-tray", "lamb-ribs", "summer-greens"]
    },
    {
      id: "tomato-cucumber-box",
      name: "Tomato and Cucumber Box",
      category: "Fresh Produce",
      price: 260,
      points: 26,
      tone: "produce",
      description: "Fresh produce box for quick branch-specific stock visibility.",
      availability: ["bishkek-south", "asia-mall", "osh-market"],
      related: ["breakfast-set", "beef-steak", "summer-greens"]
    },
    {
      id: "summer-greens",
      name: "Summer Greens Pack",
      category: "Fresh Produce",
      price: 190,
      points: 19,
      tone: "produce",
      description: "Greens pack that changes availability by branch and supports campaign bundles.",
      availability: ["bishkek-south", "tokmok", "osh-market", "dordoi-area"],
      related: ["plov-tray", "lamb-ribs", "tomato-cucumber-box"]
    },
    {
      id: "gift-1000",
      name: "1,000 KGS Gift Certificate",
      category: "Gift Certificates",
      price: 1000,
      points: 100,
      tone: "gift",
      description: "Digital gift certificate concept for loyalty, campaigns, and measurable referral traffic.",
      availability: ["bishkek-south", "asia-mall", "tokmok", "osh-market", "dordoi-area"],
      related: ["baklava-box", "breakfast-set", "fresh-bread"]
    }
  ],
  campaigns: [
    {
      id: "family-dinner",
      title: "Family Dinner Bundle",
      description: "Ready meals, bread, drinks, and dessert in one measurable order flow.",
      offer: "Bundle from 1,990 KGS",
      countdown: "2d 04h",
      products: ["plov-tray", "fresh-bread", "compote", "honey-cake"],
      stats: { views: "18,420", clicks: "3,210", orders: "428", conversion: "13.3%" }
    },
    {
      id: "bread-happy-hour",
      title: "Fresh Bread Happy Hour",
      description: "Turn daily bakery traffic into timed pickup and delivery orders.",
      offer: "Buy 3, pay for 2",
      countdown: "06h 18m",
      products: ["fresh-bread", "ayran", "honey-cake"],
      stats: { views: "9,840", clicks: "1,118", orders: "246", conversion: "22.0%" }
    },
    {
      id: "summer-bbq",
      title: "Summer BBQ Festival",
      description: "Branch-aware grill bundles with WhatsApp, Glovo, and pickup options.",
      offer: "Save 15%",
      countdown: "4d 11h",
      products: ["bbq-bundle", "beef-steak", "chicken-skewers", "summer-greens"],
      stats: { views: "31,520", clicks: "5,904", orders: "712", conversion: "12.1%" }
    },
    {
      id: "turkish-breakfast",
      title: "Turkish Breakfast Set",
      description: "A shareable campaign landing page for cafe-style morning orders.",
      offer: "690 KGS set",
      countdown: "1d 09h",
      products: ["breakfast-set", "fresh-bread", "turkish-coffee", "tomato-cucumber-box"],
      stats: { views: "12,060", clicks: "2,008", orders: "331", conversion: "16.5%" }
    },
    {
      id: "ramadan-box",
      title: "Ramadan Box",
      description: "Giftable box concept with branch pickup and campaign analytics.",
      offer: "From 2,400 KGS",
      countdown: "9d 02h",
      products: ["gift-1000", "baklava-box", "plov-tray", "ayran"],
      stats: { views: "15,780", clicks: "2,540", orders: "289", conversion: "11.4%" }
    }
  ],
  dashboard: {
    metrics: [
      ["Today's Revenue", "1,284,000 сом"],
      ["Orders", "3,142"],
      ["Average Order", "547 сом"],
      ["Conversion Rate", "7.3%"],
      ["Top Branch", "Bishkek South"],
      ["Top Product", "Fresh Bread"],
      ["Top Campaign", "Summer BBQ Festival"],
      ["Top Referral", "Instagram"],
      ["Top External Link", "WhatsApp"]
    ],
    channels: [
      ["Website", 92],
      ["WhatsApp", 78],
      ["Glovo", 64],
      ["Telegram", 44],
      ["Yandex", 38]
    ],
    funnel: [
      ["Views", "42.8k", 100],
      ["Clicks", "7.3k", 72],
      ["Orders", "3.1k", 46],
      ["Repeat", "1.2k", 28]
    ]
  }
};

