const FONT_LINK_ID = 'store-theme-font';

function normalizeFontFamily(fontFamily) {
    return String(fontFamily || 'Outfit').trim();
}

function buildFontStack(fontFamily) {
    const cleanFont = normalizeFontFamily(fontFamily).replace(/^['"]|['"]$/g, '');
    return `'${cleanFont}', 'Outfit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
}

function loadGoogleFont(fontFamily) {
    const cleanFont = normalizeFontFamily(fontFamily).replace(/^['"]|['"]$/g, '');
    if (!cleanFont || cleanFont === 'Outfit') return;

    let link = document.getElementById(FONT_LINK_ID);
    if (!link) {
        link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }

    const family = cleanFont.replace(/\s+/g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800&display=swap`;
}

export function applyStoreTheme(store) {
    const theme = store?.theme || {};
    const root = document.documentElement;
    const body = document.body;

    const primary = theme.primaryColor || '#76bc21';
    const primaryDark = theme.primaryDarkColor || theme.accentColor || primary;
    const secondary = theme.secondaryColor || '#f3f7ea';
    const accent = theme.accentColor || '#f57c00';
    const background = theme.backgroundColor || '#f9f9f9';
    const text = theme.textColor || '#333333';
    const radius = theme.borderRadius || '8px';
    const fontFamily = normalizeFontFamily(theme.fontFamily);

    root.style.setProperty('--primary', primary);
    root.style.setProperty('--secondary', secondary);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--bg', background);
    root.style.setProperty('--text', text);
    root.style.setProperty('--radius', radius);

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-dark', primaryDark);
    root.style.setProperty('--color-primary-light', secondary);
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty('--color-bg', background);
    root.style.setProperty('--color-text', text);
    root.style.setProperty('--color-border', theme.borderColor || secondary);
    root.style.setProperty('--font-main', buildFontStack(fontFamily));
    root.style.setProperty('--button-radius', theme.buttonStyle === 'sharp' ? '4px' : theme.buttonStyle === 'minimal' ? '8px' : '999px');

    body.dataset.storeId = store?.companyId || store?.id || '';
    body.dataset.buttonStyle = theme.buttonStyle || 'rounded';

    loadGoogleFont(fontFamily);
}
