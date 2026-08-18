export const THEME_PRESETS = {
    organic: {
        label: "Organic Market",
        primaryColor: "#2F6B2F",
        secondaryColor: "#F3F7EA",
        accentColor: "#D4A017",
        backgroundColor: "#FFFFFF",
        textColor: "#1F2A1F",
        fontFamily: "Outfit",
        borderRadius: "14px",
        buttonStyle: "rounded"
    },
    bakery: {
        label: "Bakery",
        primaryColor: "#C47A2C",
        secondaryColor: "#FFF3E0",
        accentColor: "#8B4513",
        backgroundColor: "#FFF9F0",
        textColor: "#2B1B10",
        fontFamily: "Playfair Display",
        borderRadius: "10px",
        buttonStyle: "rounded"
    },
    cafe: {
        label: "Cafe",
        primaryColor: "#5B3A29",
        secondaryColor: "#F7EFE7",
        accentColor: "#D59A57",
        backgroundColor: "#FFFCF7",
        textColor: "#2A1A12",
        fontFamily: "Lora",
        borderRadius: "18px",
        buttonStyle: "rounded"
    },
    luxury: {
        label: "Luxury",
        primaryColor: "#111111",
        secondaryColor: "#F5E7BF",
        accentColor: "#C9A227",
        backgroundColor: "#FCFAF4",
        textColor: "#181818",
        fontFamily: "Playfair Display",
        borderRadius: "4px",
        buttonStyle: "minimal"
    },
    minimal: {
        label: "Minimal",
        primaryColor: "#263238",
        secondaryColor: "#F4F6F7",
        accentColor: "#607D8B",
        backgroundColor: "#FFFFFF",
        textColor: "#263238",
        fontFamily: "Nunito",
        borderRadius: "6px",
        buttonStyle: "sharp"
    },
    editorial: {
        label: "Editorial / Spiritual",
        primaryColor: "#A85F35",
        secondaryColor: "#F2DDC2",
        accentColor: "#C78052",
        backgroundColor: "#FBF2E4",
        textColor: "#261B16",
        fontFamily: "Cormorant Garamond",
        borderRadius: "22px",
        buttonStyle: "rounded",
        siteStyle: "editorial"
    }
};

export const DEFAULT_STORE_CONFIGS = {
    "kyrgyz-organics": {
        id: "kyrgyz-organics",
        companyId: "kyrgyz-organics",
        name: "OA Kyrgyz Organic",
        slug: "oako",
        domain: "oako.kg",
        launchStatus: "live",
        contact: {
            email: "",
            whatsapp: "",
            openingHours: ""
        },
        social: {
            instagram: ""
        },
        seo: {
            title: "OA Kyrgyz Organic | Organic groceries in Bishkek",
            description: "Fresh local organic products from Kyrgyzstan delivered around Bishkek.",
            imageUrl: "",
            keywords: ["organic", "groceries", "Bishkek", "Kyrgyzstan"]
        },
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
            { type: "quickActions", variant: "cards", enabled: true },
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
            logoUrl: "",
            loadingText: "Preparing OA Kyrgyz Organic.",
            productHeading: "Full Catalog",
            availableTodayTitle: "Available Today",
            availableTodayLabel: "Fresh Stock",
            deliveryBanner: {
                title: "Delivery across Bishkek and nearby areas",
                subtitle: "Eco-friendly local producers at your doorstep"
            },
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
                buttonText: "Learn More",
                href: "biscotti.html"
            }
        }
    },
    dailybread: {
        id: "dailybread",
        companyId: "dailybread",
        name: "Daily Bread",
        slug: "dailybread",
        domain: "oako.kg/dailybread",
        launchStatus: "live",
        contact: {
            email: "",
            whatsapp: "",
            openingHours: "Baked fresh daily"
        },
        social: {
            instagram: ""
        },
        seo: {
            title: "Daily Bread | Fresh bread in Bishkek",
            description: "Fresh bread baked daily and delivered around Bishkek.",
            imageUrl: "",
            keywords: ["bread", "bakery", "Bishkek", "daily bread"]
        },
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
            logoUrl: "",
            loadingText: "Preparing fresh bread.",
            productHeading: "Fresh from Daily Bread",
            availableTodayTitle: "Baked Today",
            availableTodayLabel: "Warm from the oven",
            deliveryBanner: {
                title: "Fresh bread delivered around Bishkek",
                subtitle: "Order today for soft, fresh bakery favorites"
            },
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
                buttonText: "Contact Us",
                href: "#products"
            }
        }
    },
    editorial: {
        id: "editorial",
        companyId: "editorial",
        name: "New Creative Studio",
        slug: "creative-studio",
        domain: "oako.kg/creative-studio",
        launchStatus: "draft",
        contact: {
            email: "",
            whatsapp: "",
            openingHours: ""
        },
        social: {
            instagram: ""
        },
        seo: {
            title: "Creative Studio | Art, guidance, and inner worlds",
            description: "Explore a living archive of art, stories, guidance, and creative offerings.",
            imageUrl: "",
            keywords: ["art", "spirituality", "creative practice", "guidance"]
        },
        theme: {
            primaryColor: "#A85F35",
            secondaryColor: "#F2DDC2",
            accentColor: "#C78052",
            backgroundColor: "#FBF2E4",
            textColor: "#261B16",
            fontFamily: "Cormorant Garamond",
            borderRadius: "22px",
            buttonStyle: "rounded",
            siteStyle: "editorial"
        },
        layout: [
            { type: "hero", variant: "editorial", enabled: true },
            { type: "linkCards", variant: "image-grid", enabled: true },
            { type: "products", variant: "grid", enabled: false },
            { type: "quickActions", variant: "cards", enabled: false },
            { type: "campaign", variant: "timeline", enabled: false },
            { type: "cta", variant: "investment", enabled: false }
        ],
        features: {
            campaign: false,
            subscriptions: false,
            investmentSection: false,
            deliveryBanner: false,
            quickActions: false,
            cart: false,
            whatsappSupport: false,
            headerSearch: false,
            categoryNavigation: false,
            languageSelector: false,
            customerAccount: false,
            featuredProducts: false,
            productCollections: false,
            footer: false
        },
        productDisplay: {
            view: "grid",
            cardSize: "medium",
            showPrice: false,
            showDiscount: false,
            showBadges: false,
            showStock: false
        },
        content: {
            logoUrl: "",
            loadingText: "Opening the creative studio.",
            productHeading: "Offerings",
            availableTodayTitle: "Featured Offerings",
            availableTodayLabel: "Explore",
            brandStrip: "ART  ·  PHILOSOPHY  ·  INTUITIVE PRACTICE  ·  STORYTELLING  ·  CONSCIOUS WORK",
            navigation: [
                { label: "Home", href: "/" },
                { label: "My Path", href: "#my-path" },
                { label: "Visual Worlds", href: "#visual-worlds" },
                { label: "Mythopoetic World", href: "#mythopoetic-world" },
                { label: "Intuitive Method", href: "#intuitive-method" },
                { label: "Inner Notes", href: "#inner-notes" },
                { label: "Conscious Work", href: "#conscious-work" },
                { label: "Work With Me", href: "#work-with-me" },
                { label: "Connect", href: "#connect" }
            ],
            deliveryBanner: {
                title: "",
                subtitle: ""
            },
            hero: {
                eyebrow: "Living archive of art & inner worlds",
                title: "Your Creative Universe",
                subtitle: "Art, philosophy, intuitive practice, and mythopoetic storytelling.",
                body: "Share your story, your work, and the inner world that gives it meaning.",
                note: "A quiet space for art, reflection, and conscious creation.",
                imageUrl: "",
                ctaText: "Explore the universe",
                ctaTarget: "#explore"
            },
            linkCards: [
                { icon: "✦", title: "My Path", text: "The story, values, and transformations that shape my work.", href: "#my-path", imageUrl: "" },
                { icon: "◉", title: "Visual Worlds", text: "Explore artworks and visual expressions from the seen and unseen.", href: "#visual-worlds", imageUrl: "" },
                { icon: "☼", title: "Mythopoetic World", text: "Step into a symbolic realm of stories, archetypes, and living mythology.", href: "#mythopoetic-world", imageUrl: "" },
                { icon: "⌁", title: "Intuitive Method", text: "Discover a practice that bridges intuition, symbols, and the creative soul.", href: "#intuitive-method", imageUrl: "" },
                { icon: "☾", title: "Inner Notes", text: "Writings, reflections, and philosophical whispers.", href: "#inner-notes", imageUrl: "" },
                { icon: "✺", title: "Conscious Work", text: "Meaningful projects, aligned business, and creative freedom.", href: "#conscious-work", imageUrl: "" },
                { icon: "✧", title: "Work With Me", text: "Offerings, collaborations, and mentorship for your journey.", href: "#work-with-me", imageUrl: "" },
                { icon: "❀", title: "Connect", text: "Let us connect and create something beautiful together.", href: "#connect", imageUrl: "" }
            ],
            quickActions: [],
            cta: {
                title: "Let us create something meaningful",
                text: "Explore collaborations, mentorship, and creative offerings.",
                buttonText: "Connect",
                href: "#connect"
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
        launchStatus: "draft",
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
