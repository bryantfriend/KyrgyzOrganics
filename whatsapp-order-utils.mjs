export const WHATSAPP_ORDER_SOURCE = 'whatsapp';

export function normalizeWhatsAppPhone(value = '') {
    return String(value || '').replace(/\D/g, '');
}

export function buildWhatsAppOrderMessage({ productName, productId = '', quantity = 1, sourceUrl = '' } = {}) {
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

export function buildWhatsAppOrderUrl({ phone, productName, productId = '', quantity = 1, sourceUrl = '' } = {}) {
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    if (!normalizedPhone) return '';
    const message = buildWhatsAppOrderMessage({ productName, productId, quantity, sourceUrl });
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
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
