function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeHref(value = '') {
    const href = String(value || '').trim();
    if (!href) return '#';
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(href)) return href;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
    return '#';
}

export function renderLinkCardsSection({ root, store }) {
    if (!root) return false;

    const cards = Array.isArray(store?.content?.linkCards) ? store.content.linkCards.slice(0, 12) : [];
    root.innerHTML = cards.map((card, index) => {
        const imageUrl = String(card.imageUrl || '').trim();
        const cardId = String(card.id || card.title || `card-${index + 1}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const media = imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">`
            : '<span class="store-link-card-placeholder" aria-hidden="true"></span>';

        return `
            <a class="store-link-card" id="${escapeHtml(cardId)}" href="${escapeHtml(safeHref(card.href))}">
                <span class="store-link-card-copy">
                    ${card.icon ? `<span class="store-link-card-icon" aria-hidden="true">${escapeHtml(card.icon)}</span>` : ''}
                    <strong>${escapeHtml(card.title || '')}</strong>
                    ${card.text ? `<span>${escapeHtml(card.text)}</span>` : ''}
                </span>
                <span class="store-link-card-media">${media}</span>
            </a>
        `;
    }).join('');

    root.hidden = cards.length === 0;
    return cards.length > 0;
}
