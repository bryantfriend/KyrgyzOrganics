import { auth, db } from './firebase-config.js';
import { collection, addDoc, doc, getDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import pipeline from './ICF/engine/pipeline.js';
import {
    normalizeProductExternalLinkInput,
    normalizeProductExternalLinks,
    sanitizeProductExternalUrl,
    sortProductExternalLinks,
    validateProductExternalLinkInput
} from './product-external-links.mjs';

var LINK_MUTATION_INTENTS = [
    'AddProductExternalLinkIntent',
    'UpdateProductExternalLinkIntent',
    'DeleteProductExternalLinkIntent',
    'ToggleProductExternalLinkIntent',
    'ReorderProductExternalLinksIntent'
];

export function addProductExternalLinkIntent(payload) {
    return runProductExternalLinkIntent('AddProductExternalLinkIntent', payload || {});
}

export function updateProductExternalLinkIntent(payload) {
    return runProductExternalLinkIntent('UpdateProductExternalLinkIntent', payload || {});
}

export function deleteProductExternalLinkIntent(payload) {
    return runProductExternalLinkIntent('DeleteProductExternalLinkIntent', payload || {});
}

export function toggleProductExternalLinkIntent(payload) {
    return runProductExternalLinkIntent('ToggleProductExternalLinkIntent', payload || {});
}

export function reorderProductExternalLinksIntent(payload) {
    return runProductExternalLinkIntent('ReorderProductExternalLinksIntent', payload || {});
}

export function trackProductExternalLinkClickIntent(payload) {
    return runProductExternalLinkIntent('TrackProductExternalLinkClickIntent', payload || {});
}

function runProductExternalLinkIntent(type, payload) {
    var intent = createProductExternalLinkIntent(type, getCurrentActor(), payload);
    return pipeline.run(intent).then(function (result) {
        if (!result.ok) {
            throw new Error((result.errors || []).join(' ') || 'Product link action failed.');
        }
        return result;
    });
}

function createProductExternalLinkIntent(type, actor, payload) {
    return {
        type: type,
        actor: actor,
        payload: payload || {},
        context: {},
        meta: {
            createdAt: Date.now(),
            source: 'ui'
        },
        stages: {
            Validate: {
                validateProductExternalLinkIntent: validateProductExternalLinkIntent
            },
            Normalize: {
                normalizeProductExternalLinkIntentPayload: normalizeProductExternalLinkIntentPayload
            },
            AddContext: {
                addProductExternalLinkContext: addProductExternalLinkContext
            },
            Authorize: {
                authorizeProductExternalLinkIntent: authorizeProductExternalLinkIntent
            },
            Process: {
                processProductExternalLinkIntent: processProductExternalLinkIntent
            },
            Emit: {
                emitProductExternalLinkIntent: emitProductExternalLinkIntent
            }
        }
    };
}

function getCurrentActor() {
    var user = auth.currentUser;
    if (!user) {
        return {
            id: 'public',
            role: 'public'
        };
    }

    return {
        id: user.uid,
        role: 'admin'
    };
}

function validateProductExternalLinkIntent(intent) {
    var errors = [];
    var payload = intent.payload || {};

    if (!intent.type) errors.push('Intent type is required.');
    if (!intent.actor) errors.push('Intent actor is required.');

    if (LINK_MUTATION_INTENTS.indexOf(intent.type) >= 0) {
        if (!payload.productId) errors.push('Product ID is required.');
        if (!payload.companyId) errors.push('Company ID is required.');
    }

    if (intent.type === 'AddProductExternalLinkIntent' || intent.type === 'UpdateProductExternalLinkIntent') {
        var validation = validateProductExternalLinkInput(payload.link || {});
        errors = errors.concat(validation.errors);
        if (intent.type === 'UpdateProductExternalLinkIntent' && !payload.linkId) {
            errors.push('Link ID is required.');
        }
    }

    if (intent.type === 'DeleteProductExternalLinkIntent' && !payload.linkId) {
        errors.push('Link ID is required.');
    }

    if (intent.type === 'ToggleProductExternalLinkIntent') {
        if (!payload.linkId) errors.push('Link ID is required.');
        if (typeof payload.isEnabled !== 'boolean') errors.push('Enabled state is required.');
    }

    if (intent.type === 'ReorderProductExternalLinksIntent' && !Array.isArray(payload.linkIds)) {
        errors.push('Link order is required.');
    }

    if (intent.type === 'TrackProductExternalLinkClickIntent') {
        if (!payload.productId) errors.push('Product ID is required.');
        if (!payload.companyId) errors.push('Company ID is required.');
        if (!payload.linkId) errors.push('Link ID is required.');
        if (!sanitizeProductExternalUrl(payload.destinationUrl)) errors.push('Destination URL is invalid.');
    }

    if (errors.length) {
        return {
            ok: false,
            errors: errors
        };
    }

    return {
        ok: true,
        intent: intent
    };
}

function normalizeProductExternalLinkIntentPayload(intent) {
    var payload = intent.payload || {};
    var now = new Date().toISOString();

    if (payload.link) {
        payload.link = normalizeProductExternalLinkInput(payload.link, {
            now: now,
            sortOrder: payload.sortOrder || 1
        });
    }

    if (payload.companyId) payload.companyId = String(payload.companyId).trim();
    if (payload.productId) payload.productId = String(payload.productId).trim();
    if (payload.linkId) payload.linkId = String(payload.linkId).trim();
    if (payload.destinationUrl) payload.destinationUrl = sanitizeProductExternalUrl(payload.destinationUrl);

    intent.payload = payload;
    intent.context.now = now;

    return {
        ok: true,
        intent: intent
    };
}

async function addProductExternalLinkContext(intent) {
    if (intent.type === 'TrackProductExternalLinkClickIntent') {
        return {
            ok: true,
            intent: intent
        };
    }

    var productRef = doc(db, 'products', intent.payload.productId);
    var productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        return {
            ok: false,
            errors: ['Product was not found.']
        };
    }

    var product = {
        id: productSnap.id,
        ...productSnap.data()
    };

    intent.context.productRef = productRef;
    intent.context.product = product;
    intent.context.externalLinks = normalizeProductExternalLinks(product);

    return {
        ok: true,
        intent: intent
    };
}

function authorizeProductExternalLinkIntent(intent) {
    if (intent.type === 'TrackProductExternalLinkClickIntent') {
        return {
            ok: true,
            intent: intent
        };
    }

    if (!auth.currentUser) {
        return {
            ok: false,
            errors: ['You must be signed in to manage product links.']
        };
    }

    if (!intent.context.product || intent.context.product.companyId !== intent.payload.companyId) {
        return {
            ok: false,
            errors: ['This product is not available for your company.']
        };
    }

    return {
        ok: true,
        intent: intent
    };
}

async function processProductExternalLinkIntent(intent) {
    if (intent.type === 'TrackProductExternalLinkClickIntent') {
        await processProductExternalLinkClick(intent);
        return {
            ok: true,
            intent: intent
        };
    }

    var links = intent.context.externalLinks.slice();
    var nextLinks = links;

    if (intent.type === 'AddProductExternalLinkIntent') {
        var link = normalizeProductExternalLinkInput(intent.payload.link, {
            now: intent.context.now,
            sortOrder: getNextSortOrder(links)
        });
        link.sortOrder = getNextSortOrder(links);
        link.createdAt = intent.context.now;
        link.updatedAt = intent.context.now;
        nextLinks = links.concat([link]).sort(sortProductExternalLinks);
    }

    if (intent.type === 'UpdateProductExternalLinkIntent') {
        nextLinks = links.map(function (existingLink) {
            if (existingLink.id !== intent.payload.linkId) return existingLink;
            return {
                id: existingLink.id,
                type: intent.payload.link.type,
                label: intent.payload.link.label,
                url: intent.payload.link.url,
                isEnabled: intent.payload.link.isEnabled,
                sortOrder: existingLink.sortOrder,
                createdAt: existingLink.createdAt,
                updatedAt: intent.context.now
            };
        });
    }

    if (intent.type === 'DeleteProductExternalLinkIntent') {
        nextLinks = links.filter(function (existingLink) {
            return existingLink.id !== intent.payload.linkId;
        });
    }

    if (intent.type === 'ToggleProductExternalLinkIntent') {
        nextLinks = links.map(function (existingLink) {
            if (existingLink.id !== intent.payload.linkId) return existingLink;
            return {
                ...existingLink,
                isEnabled: intent.payload.isEnabled === true,
                updatedAt: intent.context.now
            };
        });
    }

    if (intent.type === 'ReorderProductExternalLinksIntent') {
        nextLinks = reorderLinks(links, intent.payload.linkIds, intent.context.now);
    }

    nextLinks = normalizeSortOrders(nextLinks, intent.context.now);
    await updateDoc(intent.context.productRef, {
        externalLinks: nextLinks,
        updatedAt: serverTimestamp()
    });

    intent.context.resultData = {
        productId: intent.payload.productId,
        externalLinks: nextLinks
    };

    return {
        ok: true,
        intent: intent
    };
}

async function processProductExternalLinkClick(intent) {
    var payload = intent.payload || {};
    var now = intent.context.now || new Date().toISOString();
    var campaignId = String(payload.campaignId || payload.trackingSlug || ('product:' + payload.productId));

    await addDoc(collection(db, 'campaign_events'), {
        actionType: 'product_external_link_click',
        eventType: 'product_external_link_click',
        companyId: String(payload.companyId || ''),
        campaignId: campaignId,
        sessionId: getSessionId(),
        productId: String(payload.productId || ''),
        productName: String(payload.productName || ''),
        linkId: String(payload.linkId || ''),
        linkType: String(payload.linkType || ''),
        linkLabel: String(payload.linkLabel || ''),
        buttonName: String(payload.buttonName || payload.linkLabel || ''),
        destinationUrl: String(payload.destinationUrl || ''),
        collectionId: String(payload.collectionId || ''),
        collectionSlug: String(payload.collectionSlug || ''),
        collectionName: String(payload.collectionName || ''),
        trackingSlug: String(payload.trackingSlug || ''),
        influencerId: String(payload.influencerId || ''),
        source: String(payload.source || 'product_page'),
        timestamp: now,
        createdAt: now
    });

    intent.context.resultData = {
        tracked: true
    };
}

function emitProductExternalLinkIntent(intent) {
    intent.context.events = [
        {
            type: intent.type,
            createdAt: intent.context.now
        }
    ];

    return {
        ok: true,
        intent: intent
    };
}

function getNextSortOrder(links) {
    if (!links.length) return 1;
    return links.reduce(function (max, link) {
        var order = Number(link.sortOrder || 0);
        return order > max ? order : max;
    }, 0) + 1;
}

function normalizeSortOrders(links, now) {
    return links
        .slice()
        .sort(sortProductExternalLinks)
        .map(function (link, index) {
            return {
                ...link,
                sortOrder: index + 1,
                updatedAt: link.updatedAt || now
            };
        });
}

function reorderLinks(links, linkIds, now) {
    var lookup = {};
    links.forEach(function (link) {
        lookup[link.id] = link;
    });

    var ordered = [];
    linkIds.forEach(function (linkId) {
        if (lookup[linkId]) ordered.push(lookup[linkId]);
    });

    links.forEach(function (link) {
        if (linkIds.indexOf(link.id) < 0) ordered.push(link);
    });

    return ordered.map(function (link, index) {
        return {
            ...link,
            sortOrder: index + 1,
            updatedAt: now
        };
    });
}

function getSessionId() {
    try {
        var key = 'product_external_link_session_id';
        var existing = window.sessionStorage.getItem(key);
        if (existing) return existing;
        var next = 'product-link-session-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        window.sessionStorage.setItem(key, next);
        return next;
    } catch (error) {
        return 'product-link-session-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
}
