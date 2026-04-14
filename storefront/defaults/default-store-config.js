export const DEFAULT_STORE_CONFIGS = {
    "kyrgyz-organics": {
        id: "kyrgyz-organics",
        companyId: "kyrgyz-organics",
        name: "OA Kyrgyz Organic",
        slug: "oako",
        domain: "oako.kg",
        theme: {
            primaryColor: "#2F6B2F",
            secondaryColor: "#F3F7EA",
            accentColor: "#D4A017",
            backgroundColor: "#FFFFFF",
            textColor: "#1F2A1F",
            fontFamily: "Outfit",
            borderRadius: "14px",
            buttonStyle: "rounded"
        },
        layout: [
            { type: "hero", variant: "carousel", enabled: true },
            { type: "campaign", variant: "timeline", enabled: true },
            { type: "products", variant: "grid", enabled: true },
            { type: "cta", variant: "investment", enabled: true }
        ],
        features: {
            campaign: true,
            subscriptions: false,
            investmentSection: true,
            deliveryBanner: true,
            quickActions: true,
            cart: true,
            whatsappSupport: true
        },
        productDisplay: {
            view: "grid",
            cardSize: "medium",
            showPrice: true,
            showDiscount: true,
            showBadges: true,
            showStock: true
        },
        content: {
            hero: {
                title: "Organic groceries from Kyrgyzstan",
                subtitle: "Fresh local products delivered to your door",
                imageUrl: "",
                ctaText: "Shop Now",
                ctaTarget: "#products"
            },
            quickActions: [
                { icon: "🚚", title: "Free Delivery" },
                { icon: "🌱", title: "Local Producers" },
                { icon: "♻️", title: "Eco Certified" },
                { icon: "🍂", title: "Seasonal" }
            ],
            cta: {
                title: "Invest in Biscotti Miste",
                text: "Join our community of investors and support local organic production.",
                buttonText: "Learn More"
            }
        }
    },
    dailybread: {
        id: "dailybread",
        companyId: "dailybread",
        name: "Daily Bread",
        slug: "dailybread",
        domain: "oako.kg/dailybread",
        theme: {
            primaryColor: "#C47A2C",
            secondaryColor: "#FFF3E0",
            accentColor: "#8B4513",
            backgroundColor: "#FFF9F0",
            textColor: "#2B1B10",
            fontFamily: "Playfair Display",
            borderRadius: "10px",
            buttonStyle: "rounded"
        },
        layout: [
            { type: "hero", variant: "image", enabled: true },
            { type: "features", variant: "cards", enabled: true },
            { type: "products", variant: "grid", enabled: true },
            { type: "campaign", variant: "timeline", enabled: false }
        ],
        features: {
            campaign: false,
            subscriptions: false,
            investmentSection: false,
            deliveryBanner: true,
            quickActions: false,
            cart: true,
            whatsappSupport: true
        },
        productDisplay: {
            view: "grid",
            cardSize: "medium",
            showPrice: true,
            showDiscount: true,
            showBadges: true,
            showStock: true
        },
        content: {
            hero: {
                title: "Fresh Bread Daily",
                subtitle: "Baked every morning in Bishkek",
                imageUrl: "",
                ctaText: "Shop Now",
                ctaTarget: "#products"
            },
            features: [
                {
                    title: "Fresh Daily",
                    text: "Baked every morning"
                },
                {
                    title: "Local Delivery",
                    text: "Delivered around Bishkek"
                }
            ],
            quickActions: [
                { icon: "🥖", title: "Fresh Daily" },
                { icon: "☕", title: "Perfect with Tea" },
                { icon: "📦", title: "Custom Orders" },
                { icon: "🚚", title: "Local Delivery" }
            ],
            cta: {
                title: "Need a custom order?",
                text: "Message us on WhatsApp",
                buttonText: "Contact Us"
            }
        }
    }
};

function cloneConfig(config) {
    return JSON.parse(JSON.stringify(config));
}

export function getFallbackStoreConfig(companyId = "kyrgyz-organics") {
    const config = DEFAULT_STORE_CONFIGS[companyId] || {
        ...DEFAULT_STORE_CONFIGS.dailybread,
        id: companyId,
        companyId,
        name: companyId,
        slug: companyId,
        domain: `oako.kg/${companyId}`,
        content: {
            ...DEFAULT_STORE_CONFIGS.dailybread.content,
            hero: {
                ...DEFAULT_STORE_CONFIGS.dailybread.content.hero,
                title: companyId
            }
        }
    };

    return cloneConfig(config);
}
