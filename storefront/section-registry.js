import { renderHeroSection } from './sections/HeroSection.js';
import { renderQuickActionsSection } from './sections/QuickActionsSection.js';

export const sectionRegistry = {
    hero: renderHeroSection,
    quickActions: renderQuickActionsSection
};
