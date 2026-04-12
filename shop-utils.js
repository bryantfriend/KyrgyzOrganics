import { createOrder } from './order-utils.js';

export const CART_KEY = 'oa_kyrgyz_organic_cart_v1';
export const CART_DAY_KEY = 'oa_kyrgyz_organic_cart_day_v1';

export const DEFAULT_CHECKOUT_SETTINGS = {
    deliveryFee: 200,
    freeDeliveryThreshold: 3000,
    pickupEnabled: true
};

export function loadCart() {
    try {
        const raw = localStorage.getItem(CART_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item) => ({
                productId: String(item.productId || ''),
                quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1)
            }))
            .filter((item) => item.productId);
    } catch (error) {
        console.warn('Failed to load cart:', error);
        return [];
    }
}

export function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function loadCartDay() {
    try {
        return localStorage.getItem(CART_DAY_KEY) || '';
    } catch (error) {
        console.warn('Failed to load cart day:', error);
        return '';
    }
}

export function saveCartDay(dayKey) {
    localStorage.setItem(CART_DAY_KEY, dayKey || '');
}

export function addCartItem(cart, productId, quantity = 1) {
    const next = [...cart];
    const index = next.findIndex((item) => item.productId === productId);

    if (index === -1) {
        next.push({ productId, quantity: Math.max(1, quantity) });
    } else {
        next[index] = {
            ...next[index],
            quantity: Math.max(1, next[index].quantity + quantity)
        };
    }

    return next;
}

export function updateCartItemQuantity(cart, productId, quantity) {
    const nextQuantity = Math.max(0, Number.parseInt(quantity, 10) || 0);

    if (nextQuantity <= 0) {
        return cart.filter((item) => item.productId !== productId);
    }

    return cart.map((item) =>
        item.productId === productId
            ? { ...item, quantity: nextQuantity }
            : item
    );
}

export function removeCartItem(cart, productId) {
    return cart.filter((item) => item.productId !== productId);
}

export function clearCart() {
    saveCart([]);
    return [];
}

export function getCartItemCount(cart) {
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

export function parsePrice(value) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;

    const digits = String(value || '').replace(/[^\d.]/g, '');
    const fallback = Number(digits);
    return Number.isNaN(fallback) ? 0 : fallback;
}

export function formatPrice(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(parsePrice(value));
}

export function getCartDetailedItems(cart, products) {
    const productMap = new Map(products.map((product) => [product.id, product]));

    return cart
        .map((item) => {
            const product = productMap.get(item.productId);
            if (!product) return null;

            const price = parsePrice(product.price);
            const quantity = Math.max(1, Number(item.quantity) || 1);

            return {
                productId: item.productId,
                product,
                quantity,
                unitPrice: price,
                lineTotal: price * quantity
            };
        })
        .filter(Boolean);
}

export function calculateDeliveryFee(subtotal, deliveryMethod, settings = DEFAULT_CHECKOUT_SETTINGS) {
    if (deliveryMethod === 'pickup') return 0;
    if (settings.freeDeliveryThreshold && subtotal >= settings.freeDeliveryThreshold) return 0;
    return parsePrice(settings.deliveryFee);
}

export function calculateCartTotals(cart, products, deliveryMethod = 'delivery', settings = DEFAULT_CHECKOUT_SETTINGS) {
    const items = getCartDetailedItems(cart, products);
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const deliveryFee = calculateDeliveryFee(subtotal, deliveryMethod, settings);

    return {
        items,
        itemCount,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee
    };
}

export async function checkout(cartItems) {
    if (!cartItems || cartItems.length === 0) {
        alert("Cart is empty");
        return null;
    }

    try {
        const orderId = await createOrder(cartItems);

        saveCart([]);

        alert("Order placed successfully!");
        console.log("Order ID:", orderId);

        return orderId;
    } catch (error) {
        console.error("Order failed:", error);
        alert("Failed to place order");
        return null;
    }
}
