export var PRODUCT_EXTERNAL_LINK_TYPES = [
    'whatsapp',
    'telegram',
    'glovo',
    'yandex',
    'map',
    'website',
    'other'
];

export var DEFAULT_PRODUCT_LINK_LABELS = {
    whatsapp: 'Order on WhatsApp',
    telegram: 'Order on Telegram',
    glovo: 'Order on Glovo',
    yandex: 'Order on Yandex',
    map: 'View Location',
    website: 'Order on Website',
    other: 'Open Link'
};

export var PRODUCT_LINK_TYPE_LABELS = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    glovo: 'Glovo',
    yandex: 'Yandex',
    map: 'Map / Physical Location',
    website: 'Website',
    other: 'Other'
};

export function getDefaultProductLinkLabel(type) {
    return DEFAULT_PRODUCT_LINK_LABELS[type] || DEFAULT_PRODUCT_LINK_LABELS.other;
}

export function isSupportedProductLinkType(type) {
    return PRODUCT_EXTERNAL_LINK_TYPES.indexOf(String(type || '').trim().toLowerCase()) >= 0;
}

export function isUnsafeProductLinkProtocol(value) {
    var raw = String(value || '').trim().toLowerCase();
    return raw.indexOf('javascript:') === 0
        || raw.indexOf('data:') === 0
        || raw.indexOf('file:') === 0
        || raw.indexOf('vbscript:') === 0;
}

export function sanitizeProductExternalUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    if (isUnsafeProductLinkProtocol(raw)) return '';

    try {
        var url = new URL(raw);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
        return url.toString();
    } catch (error) {
        return '';
    }
}

export function validateProductExternalLinkInput(link) {
    var errors = [];
    var type = String(link && link.type ? link.type : '').trim().toLowerCase();
    var label = String(link && link.label ? link.label : '').trim();
    var url = String(link && link.url ? link.url : '').trim();

    if (!type) {
        errors.push('Link type is required.');
    } else if (!isSupportedProductLinkType(type)) {
        errors.push('Link type is not supported.');
    }

    if (!label) {
        errors.push('Link label is required.');
    }

    if (!url) {
        errors.push('Link URL is required.');
    } else if (isUnsafeProductLinkProtocol(url)) {
        errors.push('Link URL uses an unsafe protocol.');
    } else if (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0) {
        errors.push('Link URL must start with http:// or https://.');
    } else if (!sanitizeProductExternalUrl(url)) {
        errors.push('Link URL is not valid.');
    }

    return {
        ok: errors.length === 0,
        errors: errors
    };
}

export function createProductExternalLinkId() {
    return 'link_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function normalizeProductExternalLinkInput(link, options) {
    var opts = options || {};
    var now = opts.now || new Date().toISOString();
    var type = String(link && link.type ? link.type : 'other').trim().toLowerCase();
    if (!isSupportedProductLinkType(type)) type = 'other';

    return {
        id: String(link && link.id ? link.id : createProductExternalLinkId()),
        type: type,
        label: String(link && link.label ? link.label : getDefaultProductLinkLabel(type)).trim(),
        url: sanitizeProductExternalUrl(link && link.url ? link.url : ''),
        isEnabled: link && Object.prototype.hasOwnProperty.call(link, 'isEnabled') ? link.isEnabled === true : true,
        sortOrder: Number.isFinite(Number(link && link.sortOrder)) ? Number(link.sortOrder) : Number(opts.sortOrder || 1),
        createdAt: String(link && link.createdAt ? link.createdAt : now),
        updatedAt: now
    };
}

export function normalizeProductExternalLinks(productOrLinks) {
    var source = Array.isArray(productOrLinks)
        ? productOrLinks
        : productOrLinks && productOrLinks.externalLinks;

    if (Array.isArray(source)) {
        return source
            .filter(function filterLink(link) {
                return link && typeof link === 'object';
            })
            .map(function mapLink(link, index) {
                return normalizeStoredProductExternalLink(link, index + 1);
            })
            .sort(sortProductExternalLinks);
    }

    if (source && typeof source === 'object') {
        return normalizeLegacyProductExternalLinks(source);
    }

    return [];
}

export function getProductExternalLinks(product) {
    return normalizeProductExternalLinks(product)
        .filter(function filterEnabledLinks(link) {
            return link && link.isEnabled === true && Boolean(sanitizeProductExternalUrl(link.url));
        })
        .sort(sortProductExternalLinks);
}

export function sortProductExternalLinks(firstLink, secondLink) {
    var firstOrder = Number(firstLink && firstLink.sortOrder);
    var secondOrder = Number(secondLink && secondLink.sortOrder);
    if (!Number.isFinite(firstOrder)) firstOrder = 0;
    if (!Number.isFinite(secondOrder)) secondOrder = 0;
    return firstOrder - secondOrder;
}

function normalizeStoredProductExternalLink(link, sortOrder) {
    var type = String(link.type || 'other').trim().toLowerCase();
    if (!isSupportedProductLinkType(type)) type = 'other';
    var url = sanitizeProductExternalUrl(link.url || link.restaurantUrl || '');
    var now = new Date().toISOString();
    return {
        id: String(link.id || createProductExternalLinkId()),
        type: type,
        label: String(link.label || getDefaultProductLinkLabel(type)).trim(),
        url: url,
        isEnabled: link.isEnabled === true || link.enabled === true,
        sortOrder: Number.isFinite(Number(link.sortOrder)) ? Number(link.sortOrder) : sortOrder,
        createdAt: String(link.createdAt || now),
        updatedAt: String(link.updatedAt || link.createdAt || now)
    };
}

function normalizeLegacyProductExternalLinks(links) {
    var normalized = [];
    appendLegacyLink(normalized, links.glovo, 'glovo', 1);
    appendLegacyLink(normalized, links.yandex, 'yandex', 2);
    appendLegacyLink(normalized, links.map, 'map', 3);
    return normalized.sort(sortProductExternalLinks);
}

function appendLegacyLink(target, link, type, sortOrder) {
    if (!link || typeof link !== 'object') return;
    var url = sanitizeProductExternalUrl(link.restaurantUrl || link.url || '');
    if (!url && link.enabled !== true) return;

    target.push({
        id: String(link.id || 'legacy_' + type),
        type: type,
        label: String(link.label || getDefaultProductLinkLabel(type)).trim(),
        url: url,
        isEnabled: link.enabled === true && Boolean(url),
        sortOrder: sortOrder,
        createdAt: String(link.createdAt || ''),
        updatedAt: String(link.updatedAt || link.createdAt || '')
    });
}
