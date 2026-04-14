function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function renderCtaSection({ root, store }) {
    if (!root) return false;

    const cta = store?.content?.cta || {};
    root.innerHTML = `
        <div class="cta-content">
            <h2>${escapeHtml(cta.title || '')}</h2>
            ${cta.text ? `<p>${escapeHtml(cta.text)}</p>` : ''}
            ${cta.buttonText ? `<a href="${escapeHtml(cta.href || '#products')}" class="cta-btn">${escapeHtml(cta.buttonText)}</a>` : ''}
        </div>
    `;

    return true;
}
