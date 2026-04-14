import { sectionRegistry } from './section-registry.js';

export function renderStoreSection(type, options = {}) {
    const renderer = sectionRegistry[type];
    if (!renderer) {
        console.warn('Unknown storefront section:', type);
        return false;
    }

    return renderer(options);
}
