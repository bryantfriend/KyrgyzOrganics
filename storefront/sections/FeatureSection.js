function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function renderFeatureSection({ root, store }) {
    if (!root) return false;

    const features = Array.isArray(store?.content?.features) ? store.content.features : [];
    root.innerHTML = features.map((feature) => `
        <article class="store-feature-card">
            <h3>${escapeHtml(feature.title || '')}</h3>
            ${feature.text ? `<p>${escapeHtml(feature.text)}</p>` : ''}
        </article>
    `).join('');

    return true;
}
