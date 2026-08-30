export var PRODUCT_EXTERNAL_LINK_TYPES = [
    'whatsapp',
    'telegram',
    'glovo',
    'yandex',
    'map',
    'optima_payda',
    'website',
    'other'
];

export var DEFAULT_PRODUCT_LINK_LABELS = {
    whatsapp: 'Buy now through WhatsApp',
    telegram: 'Buy now through Telegram',
    glovo: 'Buy now through Glovo',
    yandex: 'Buy now through Yandex',
    map: 'View Location',
    optima_payda: 'Buy now through Optima PayDa!',
    website: 'Buy now through Website',
    other: 'Buy now through this seller'
};

export var PRODUCT_LINK_TYPE_LABELS = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    glovo: 'Glovo',
    yandex: 'Yandex',
    map: 'Map / Physical Location',
    optima_payda: 'Optima PayDa!',
    website: 'Website',
    other: 'Other'
};

export function getDefaultProductLinkLabel(type) {
    return DEFAULT_PRODUCT_LINK_LABELS[type] || DEFAULT_PRODUCT_LINK_LABELS.other;
}

export function getProductExternalLinkCtaLabel(link) {
    var type = String(link && link.type ? link.type : 'other').trim().toLowerCase();
    var savedLabel = String(link && link.label ? link.label : '').trim();

    // Location links are informational rather than purchase actions.
    if (type === 'map') return savedLabel || getDefaultProductLinkLabel(type);

    var provider = getProductExternalLinkProviderName(link);
    return 'Buy now through ' + provider;
}

export function getProductExternalLinkProviderName(link) {
    var type = String(link && link.type ? link.type : 'other').trim().toLowerCase();
    if (type !== 'other' && PRODUCT_LINK_TYPE_LABELS[type]) {
        return PRODUCT_LINK_TYPE_LABELS[type];
    }

    var savedLabel = String(link && link.label ? link.label : '').trim();
    if (savedLabel && savedLabel !== DEFAULT_PRODUCT_LINK_LABELS.other) {
        var providerFromLabel = savedLabel
            .replace(/^(?:buy\s+now\s+|buy\s+|order\s+)(?:through|on|with|via)\s+/i, '')
            .replace(/^pay\s+with\s+/i, '')
            .replace(/^open\s+/i, '')
            .trim();
        if (providerFromLabel && providerFromLabel.toLowerCase() !== 'link') {
            return providerFromLabel;
        }
    }

    var url = sanitizeProductExternalUrl(link && link.url ? link.url : '');
    if (url) {
        try {
            return new URL(url).hostname.replace(/^www\./i, '');
        } catch (error) {
            // The URL was already sanitized; keep the generic fallback defensive.
        }
    }

    return 'this seller';
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

function getYandexSearchQuery(candidate) {
    var pathname = String(candidate && candidate.pathname ? candidate.pathname : '');
    if (!/(?:^|\/)search\/?$/i.test(pathname)) return '';
    return String(
        candidate.searchParams.get('query')
        || candidate.searchParams.get('text')
        || candidate.searchParams.get('search')
        || ''
    ).trim();
}

function getYandexSearchQueryFromUrl(source) {
    var query = getYandexSearchQuery(source);
    if (query) return query;

    var sourceHost = source.hostname.replace(/\.$/, '').toLowerCase();
    if (sourceHost !== '8jxm.adj.st' || source.pathname !== '/external') return '';

    var browserCandidates = [
        source.searchParams.get('adj_fallback'),
        source.searchParams.get('adj_redirect')
    ];
    for (var index = 0; index < browserCandidates.length; index += 1) {
        try {
            query = getYandexSearchQuery(new URL(browserCandidates[index] || ''));
            if (query) return query;
        } catch (error) {
            // Continue to the legacy native target below.
        }
    }

    try {
        var nativeTarget = new URL(source.searchParams.get('adj_deeplink') || '');
        var nestedHref = nativeTarget.searchParams.get('href');
        return nestedHref ? getYandexSearchQuery(new URL(nestedHref)) : '';
    } catch (error) {
        return '';
    }
}

export function buildYandexEatsBrowserUrl(value) {
    var safeUrl = sanitizeProductExternalUrl(value);
    if (!safeUrl) return '';

    try {
        var source = new URL(safeUrl);
        var sourceHost = source.hostname.replace(/\.$/, '').toLowerCase();
        if (
            sourceHost !== 'eda.yandex.kg'
            && sourceHost !== 'www.eda.yandex.kg'
            && sourceHost !== '8jxm.adj.st'
        ) {
            return '';
        }

        var query = getYandexSearchQueryFromUrl(source);
        if (!query) return '';

        // Yandex Go on iOS launches for the old Adjust link but drops the
        // nested Eats search. The city-prefixed route resolves to the home
        // page; Yandex's own search UI initially uses /en-kg/search?query=...
        // and adds internal display flags only after the page initializes.
        var browserUrl = new URL('https://eda.yandex.kg/en-kg/search');
        browserUrl.searchParams.set('query', query);
        return browserUrl.toString();
    } catch (error) {
        return '';
    }
}

// Backward-compatible export for code that imported the v3.12 helper name.
export function buildYandexGoSmartUrl(value) {
    return buildYandexEatsBrowserUrl(value);
}

export function getProductExternalLinkNavigation(link) {
    var url = sanitizeProductExternalUrl(link && link.url ? link.url : '');
    var type = String(link && link.type ? link.type : '').trim().toLowerCase();
    var glovoTarget = null;
    var yandexBrowserUrl = type === 'yandex' ? buildYandexEatsBrowserUrl(url) : '';

    if (yandexBrowserUrl) {
        var yandexTarget = new URL(yandexBrowserUrl);
        var yandexFields = [];
        yandexTarget.searchParams.forEach(function appendYandexField(value, name) {
            yandexFields.push({ name: name, value: value });
        });

        return {
            kind: 'form',
            url: yandexBrowserUrl,
            action: yandexTarget.origin + yandexTarget.pathname,
            fields: yandexFields,
            loginAction: '',
            loginFields: [],
            openInNewTab: false
        };
    }

    if (type === 'glovo' && url) {
        try {
            var candidate = new URL(url);
            var normalizedHost = candidate.hostname.replace(/\.$/, '').toLowerCase();
            if (normalizedHost === 'glovoapp.com' || normalizedHost === 'www.glovoapp.com') {
                candidate.protocol = 'https:';
                candidate.hostname = 'glovoapp.com';
                candidate.port = '';
                glovoTarget = candidate;
            }
        } catch (error) {
            glovoTarget = null;
        }
    }

    if (glovoTarget) {
        // Android hands normal links for this verified host to the Glovo app,
        // which currently drops product parameters. A user-submitted GET form
        // stays in the browser and preserves the exact product query.
        var fields = [];
        glovoTarget.searchParams.forEach(function appendField(value, name) {
            fields.push({ name: name, value: value });
        });

        var localeMatch = glovoTarget.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/i);
        var localePrefix = localeMatch ? '/' + localeMatch[1] : '/en';

        return {
            kind: 'form',
            url: glovoTarget.toString(),
            action: glovoTarget.origin + glovoTarget.pathname,
            fields: fields,
            loginAction: glovoTarget.origin + localePrefix + '/login',
            loginFields: [{
                name: 'returnPath',
                value: glovoTarget.pathname + glovoTarget.search
            }],
            openInNewTab: false
        };
    }

    return {
        kind: 'link',
        url: url,
        action: '',
        fields: [],
        loginAction: '',
        loginFields: [],
        openInNewTab: true
    };
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
