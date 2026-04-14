function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const DEFAULT_ACTIONS = [
    { icon: '🚚', title: 'Free Delivery' },
    { icon: '🌱', title: 'Local Producers' },
    { icon: '♻️', title: 'Eco Certified' },
    { icon: '🍂', title: 'Seasonal' }
];

export function renderQuickActionsSection({ root, store }) {
    if (!root) return false;

    const actions = Array.isArray(store?.content?.quickActions) && store.content.quickActions.length
        ? store.content.quickActions
        : DEFAULT_ACTIONS;

    root.innerHTML = actions.slice(0, 6).map((action) => `
        <div class="action-card">
          <span class="action-icon">${escapeHtml(action.icon || '')}</span>
          <span>${escapeHtml(action.title || '')}</span>
        </div>
    `).join('');

    return true;
}
