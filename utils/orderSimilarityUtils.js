function normalizeItemName(value = '') {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function getItemName(item = {}) {
    return item.name_en || item.name_ru || item.name_kg || item.productName || item.productId || item.name || '';
}

export function getOrderItemSignature(order = {}) {
    if (Array.isArray(order.items) && order.items.length) {
        return order.items
            .map(getItemName)
            .map(normalizeItemName)
            .filter(Boolean)
            .sort()
            .slice(0, 3)
            .join('|');
    }

    return normalizeItemName(order.productName || order.productId || '');
}

export function getSimilarOrderCounts(orders = []) {
    const signatureCounts = new Map();

    orders.forEach((order) => {
        const signature = getOrderItemSignature(order);
        if (!signature) return;
        signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
    });

    return orders.reduce((counts, order) => {
        const signature = getOrderItemSignature(order);
        const count = signature ? signatureCounts.get(signature) || 0 : 0;
        counts[order.id] = Math.max(0, count - 1);
        return counts;
    }, {});
}
