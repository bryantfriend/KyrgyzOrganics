import { renderHeroSection } from './sections/HeroSection.js';
import { renderQuickActionsSection } from './sections/QuickActionsSection.js';
import { renderFeatureSection } from './sections/FeatureSection.js';
import { renderCampaignSection } from './sections/CampaignSection.js';
import { renderProductSection } from './sections/ProductSection.js';
import { renderCtaSection } from './sections/CtaSection.js';

export const sectionRegistry = {
    hero: renderHeroSection,
    quickActions: renderQuickActionsSection,
    features: renderFeatureSection,
    campaign: renderCampaignSection,
    products: renderProductSection,
    cta: renderCtaSection
};
