export const WHATSAPP_ORDER_SOURCE = 'whatsapp';

export function normalizeWhatsAppPhone(value = '') {
    return String(value || '').replace(/\D/g, '');
}

export function formatSom(value) {
    return normalizeMoney(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function normalizeMessageItems(items = []) {
    return (Array.isArray(items) ? items : []).map((item) => {
        const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
        const unitPrice = normalizeMoney(item.unitPrice ?? item.price);
        return {
            productId: String(item.productId || item.id || '').trim(),
            productName: String(item.productName || item.name || '').trim(),
            quantity,
            unitPrice,
            lineTotal: normalizeMoney(quantity * unitPrice)
        };
    }).filter((item) => item.productName);
}

export function buildWhatsAppOrderMessage({
    productName,
    productId = '',
    quantity = 1,
    items = [],
    customerName = '',
    customerPhone = '',
    customerAddress = '',
    sourceUrl = ''
} = {}) {
    const orderItems = normalizeMessageItems(items);
    if (orderItems.length) {
        const subtotal = normalizeMoney(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
        const lines = [
            'Hello! I would like to place a granola order with Kyrgyz Organic.',
            '',
            'ORDER DETAILS'
        ];

        orderItems.forEach((item, index) => {
            lines.push(
                `${index + 1}. ${item.productName}`,
                `   ${item.quantity} × ${formatSom(item.unitPrice)} som = ${formatSom(item.lineTotal)} som`
            );
        });

        lines.push(
            '',
            `Sub-total: ${formatSom(subtotal)} som`,
            'Final total: Confirmed after delivery is arranged.',
            '',
            'CUSTOMER DETAILS',
            `Name: ${String(customerName || '').trim()}`,
            `Phone: ${String(customerPhone || '').trim()}`,
            `Delivery address: ${String(customerAddress || '').trim()}`,
            'Delivery method: Yandex Delivery',
            '',
            'Please confirm availability and the final total, including delivery.'
        );

        if (sourceUrl) lines.push('', `Order source: ${String(sourceUrl).trim()}`);
        return lines.join('\n');
    }

    const name = String(productName || '').trim() || 'Kyrgyz Organic granola';
    const safeQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1);
    const lines = [
        'Hello! I would like to place an order with Kyrgyz Organic.',
        '',
        `Product: ${name}`,
        `Quantity: ${safeQuantity}`
    ];

    if (productId) lines.push(`Product code: ${String(productId).trim()}`);

    lines.push(
        '',
        'Name:',
        'Delivery address in Bishkek:',
        'Preferred delivery time:',
        '',
        'Please confirm availability, product total, and delivery price.'
    );

    if (sourceUrl) lines.push('', `Product page: ${String(sourceUrl).trim()}`);
    return lines.join('\n');
}

export function buildWhatsAppOrderUrl(options = {}) {
    const { phone } = options;
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) return '';
    const message = buildWhatsAppOrderMessage(options);
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function parseWhatsAppOrderMessage(value = '') {
    const lines = String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const result = {
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        deliveryMethod: 'yandex_delivery',
        items: []
    };

    for (let index = 0; index < lines.length; index += 1) {
        const itemMatch = lines[index].match(/^\d+\.\s+(.+)$/);
        const priceMatch = lines[index + 1]?.match(/^(\d+)\s*[×x]\s*([\d,.]+)\s*som\s*=\s*([\d,.]+)\s*som$/i);
        if (itemMatch && priceMatch) {
            result.items.push({
                productId: '',
                productName: itemMatch[1].trim(),
                quantity: Math.max(1, Number.parseInt(priceMatch[1], 10) || 1),
                unitPrice: normalizeMoney(priceMatch[2].replace(/,/g, ''))
            });
            index += 1;
            continue;
        }
        if (/^Name:/i.test(lines[index])) result.customerName = lines[index].replace(/^Name:\s*/i, '').trim();
        if (/^Phone:/i.test(lines[index])) result.customerPhone = lines[index].replace(/^Phone:\s*/i, '').trim();
        if (/^Delivery address:/i.test(lines[index])) result.customerAddress = lines[index].replace(/^Delivery address:\s*/i, '').trim();
    }

    return result;
}

export function buildWhatsAppReplyUrl({ phone, orderId = '', customerName = '' } = {}) {
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) return '';
    const greeting = String(customerName || '').trim() ? `Hello ${String(customerName).trim()}!` : 'Hello!';
    const reference = String(orderId || '').trim() ? ` Your Kyrgyz Organic order reference is ${String(orderId).trim()}.` : '';
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(`${greeting}${reference} We are confirming your order now.`)}`;
}

export function normalizeMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

export function buildWhatsAppOrderRecord(input = {}) {
    const companyId = String(input.companyId || '').trim();
    const customerName = String(input.customerName || '').trim();
    const customerPhone = String(input.customerPhone || '').trim();
    const items = (Array.isArray(input.items) ? input.items : []).map((item) => {
        const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
        const unitPrice = normalizeMoney(item.unitPrice);
        return {
            productId: String(item.productId || '').trim(),
            productName: String(item.productName || item.name || '').trim(),
            name: String(item.productName || item.name || '').trim(),
            quantity,
            unitPrice,
            lineTotal: normalizeMoney(unitPrice * quantity)
        };
    }).filter((item) => item.productName);

    if (!companyId) throw new Error('Missing store');
    if (!customerName) throw new Error('Customer name is required');
    if (!normalizeWhatsAppPhone(customerPhone)) throw new Error('Customer WhatsApp number is required');
    if (!items.length) throw new Error('Add at least one product');

    const subtotal = normalizeMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const deliveryFee = normalizeMoney(input.deliveryFee);
    const paymentState = String(input.paymentStatus || 'unpaid').trim().toLowerCase();
    const paymentStatus = paymentState === 'paid' ? 'paid' : paymentState === 'collect_on_delivery' ? 'collect_on_delivery' : 'unpaid';

    return {
        companyId,
        storeId: companyId,
        source: WHATSAPP_ORDER_SOURCE,
        channel: WHATSAPP_ORDER_SOURCE,
        orderOrigin: 'whatsapp_manual',
        status: 'new',
        paymentStatus,
        paymentMethod: String(input.paymentMethod || paymentStatus).trim(),
        pricingMode: 'retail',
        customerName,
        customerPhone,
        phone: customerPhone,
        customerAddress: String(input.customerAddress || '').trim(),
        deliveryMethod: String(input.deliveryMethod || 'yandex_delivery').trim(),
        deliveryType: String(input.deliveryMethod || 'yandex_delivery').trim(),
        deliveryFee,
        subtotal,
        total: normalizeMoney(subtotal + deliveryFee),
        items,
        notes: String(input.notes || '').trim(),
        sourcePage: '/buy-granola/',
        estimatedTime: Math.max(0, Number.parseInt(input.estimatedTime, 10) || 60)
    };
}
