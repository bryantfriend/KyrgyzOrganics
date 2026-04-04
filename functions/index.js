const crypto = require("crypto");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const DEFAULT_CHECKOUT_SETTINGS = {
    deliveryFee: 200,
    freeDeliveryThreshold: 3000
};

function asTrimmedString(value, maxLength = 500) {
    return String(value || '').trim().slice(0, maxLength);
}

function readMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function validateDateString(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid date string');
    }
}

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Cart is empty');
    }

    const merged = new Map();

    items.forEach((item) => {
        const productId = asTrimmedString(item?.productId, 120);
        const quantity = Math.max(0, Number.parseInt(item?.quantity, 10) || 0);

        if (!productId || quantity <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid cart item');
        }

        merged.set(productId, (merged.get(productId) || 0) + quantity);
    });

    return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function calculateDeliveryFee(subtotal, deliveryMethod, settings) {
    if (deliveryMethod === 'pickup') return 0;
    if (settings.freeDeliveryThreshold && subtotal >= readMoney(settings.freeDeliveryThreshold)) return 0;
    return readMoney(settings.deliveryFee);
}

async function getCheckoutSettings() {
    try {
        const snap = await db.doc('shop_settings/checkout').get();
        return snap.exists
            ? { ...DEFAULT_CHECKOUT_SETTINGS, ...snap.data() }
            : { ...DEFAULT_CHECKOUT_SETTINGS };
    } catch (error) {
        console.warn('Checkout settings fallback:', error);
        return { ...DEFAULT_CHECKOUT_SETTINGS };
    }
}

function getOrderDisplayName(item) {
    return item.name_en || item.name_ru || item.name_kg || item.productName || 'Product';
}

function ensureOrderToken(order, orderToken) {
    if (!orderToken || order.orderToken !== orderToken) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid order token');
    }
}

function getOrderLineItems(order) {
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items.map((item) => ({
            productId: item.productId,
            quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1)
        }));
    }

    if (order.productId) {
        return [{ productId: order.productId, quantity: 1 }];
    }

    return [];
}

async function releaseInventory(tx, dateStr, items) {
    if (!dateStr || !items.length) return;

    const inventoryRef = db.doc(`inventory/${dateStr}`);
    const inventorySnap = await tx.get(inventoryRef);
    if (!inventorySnap.exists) return;

    const inventoryData = inventorySnap.data() || {};
    const inventoryUpdates = {};

    items.forEach((item) => {
        const current = inventoryData[item.productId] || {};
        const available = Number(current.available || 0);
        const sold = Number(current.sold || 0);

        inventoryUpdates[`${item.productId}.available`] = available + item.quantity;
        inventoryUpdates[`${item.productId}.sold`] = Math.max(0, sold - item.quantity);
    });

    tx.update(inventoryRef, inventoryUpdates);
}

exports.createOrder = functions.https.onCall(async (data) => {
    const dateStr = asTrimmedString(data?.dateStr, 20);
    const deliveryMethod = data?.fulfillment?.method === 'pickup' ? 'pickup' : 'delivery';
    const customerName = asTrimmedString(data?.customer?.name, 120);
    const customerPhone = asTrimmedString(data?.customer?.phone, 60);
    const customerAddress = asTrimmedString(data?.customer?.address, 300);
    const customerNotes = asTrimmedString(data?.customer?.notes, 500);
    const normalizedItems = normalizeItems(data?.items);

    validateDateString(dateStr);

    if (!customerName) {
        throw new functions.https.HttpsError('invalid-argument', 'Customer name is required');
    }
    if (!customerPhone) {
        throw new functions.https.HttpsError('invalid-argument', 'Customer phone is required');
    }
    if (deliveryMethod === 'delivery' && !customerAddress) {
        throw new functions.https.HttpsError('invalid-argument', 'Delivery address is required');
    }

    const checkoutSettings = await getCheckoutSettings();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return db.runTransaction(async (tx) => {
        const inventoryRef = db.doc(`inventory/${dateStr}`);
        const inventorySnap = await tx.get(inventoryRef);

        if (!inventorySnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Inventory is not available for this date');
        }

        const inventoryData = inventorySnap.data() || {};
        const productSnaps = await Promise.all(
            normalizedItems.map((item) => tx.get(db.doc(`products/${item.productId}`)))
        );

        const inventoryUpdates = {};
        const orderItems = [];
        let subtotal = 0;
        let itemCount = 0;

        normalizedItems.forEach((item, index) => {
            const productSnap = productSnaps[index];
            if (!productSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Product not found');
            }

            const product = productSnap.data();
            if (product.active === false) {
                throw new functions.https.HttpsError('failed-precondition', 'One of the products is inactive');
            }

            const inventoryItem = inventoryData[item.productId];
            if (!inventoryItem || Number(inventoryItem.available || 0) < item.quantity) {
                throw new functions.https.HttpsError('failed-precondition', 'Insufficient stock for one of the products');
            }

            const unitPrice = readMoney(product.price || inventoryItem.price);
            const lineTotal = unitPrice * item.quantity;

            orderItems.push({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice,
                lineTotal,
                imageUrl: product.imageUrl || '',
                weight: product.weight || '',
                name_en: product.name_en || '',
                name_ru: product.name_ru || '',
                name_kg: product.name_kg || ''
            });

            subtotal += lineTotal;
            itemCount += item.quantity;
            inventoryUpdates[`${item.productId}.available`] = Number(inventoryItem.available || 0) - item.quantity;
            inventoryUpdates[`${item.productId}.sold`] = Number(inventoryItem.sold || 0) + item.quantity;
        });

        const deliveryFee = calculateDeliveryFee(subtotal, deliveryMethod, checkoutSettings);
        const total = subtotal + deliveryFee;
        const orderRef = db.collection('orders').doc();
        const orderToken = crypto.randomBytes(24).toString('hex');

        tx.update(inventoryRef, inventoryUpdates);
        tx.set(orderRef, {
            date: dateStr,
            itemCount,
            items: orderItems,
            subtotal,
            deliveryFee,
            total,
            currency: 'KGS',
            deliveryMethod,
            customerName,
            customerPhone,
            customerAddress: deliveryMethod === 'delivery' ? customerAddress : '',
            customerNotes,
            status: 'pending_payment',
            paymentStatus: 'unpaid',
            orderToken,
            expiresAt: Timestamp.fromDate(expiresAt),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return {
            orderId: orderRef.id,
            orderToken,
            subtotal,
            deliveryFee,
            total,
            deliveryMethod,
            expiresAtMillis: expiresAt.getTime(),
            items: orderItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                name: getOrderDisplayName(item)
            }))
        };
    });
});

exports.submitPaymentProof = functions.https.onCall(async (data) => {
    const orderId = asTrimmedString(data?.orderId, 120);
    const orderToken = asTrimmedString(data?.orderToken, 120);
    const paymentMethodId = asTrimmedString(data?.paymentMethodId, 120);
    const receiptPath = asTrimmedString(data?.receiptPath, 400);

    if (!orderId || !orderToken || !receiptPath) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing order payment details');
    }

    if (!receiptPath.startsWith(`order_receipts/${orderId}/`)) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid receipt path');
    }

    if (paymentMethodId) {
        const methodSnap = await db.doc(`payment_methods/${paymentMethodId}`).get();
        if (!methodSnap.exists || methodSnap.data()?.active === false) {
            throw new functions.https.HttpsError('failed-precondition', 'Payment method is unavailable');
        }
    }

    const file = admin.storage().bucket().file(receiptPath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new functions.https.HttpsError('not-found', 'Receipt upload not found');
    }

    let receiptUrl = '';
    try {
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'
        });
        receiptUrl = signedUrl;
    } catch (error) {
        console.warn('Receipt URL generation failed:', error);
    }

    return db.runTransaction(async (tx) => {
        const orderRef = db.doc(`orders/${orderId}`);
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }

        const order = orderSnap.data();
        ensureOrderToken(order, orderToken);

        if (!['pending_payment', 'reserved'].includes(order.status)) {
            throw new functions.https.HttpsError('failed-precondition', 'Order is not awaiting payment');
        }

        if (order.expiresAt?.toDate && order.expiresAt.toDate().getTime() < Date.now()) {
            throw new functions.https.HttpsError('deadline-exceeded', 'Order has expired');
        }

        tx.update(orderRef, {
            status: 'pending_verification',
            paymentStatus: 'submitted',
            paymentMethodId: paymentMethodId || null,
            receiptPath,
            receiptUrl: receiptUrl || null,
            paymentSubmittedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return { ok: true };
    });
});

exports.cancelOrder = functions.https.onCall(async (data) => {
    const orderId = asTrimmedString(data?.orderId, 120);
    const orderToken = asTrimmedString(data?.orderToken, 120);
    const reason = asTrimmedString(data?.reason, 120) || 'user_cancelled';

    if (!orderId || !orderToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing order cancellation details');
    }

    return db.runTransaction(async (tx) => {
        const orderRef = db.doc(`orders/${orderId}`);
        const orderSnap = await tx.get(orderRef);

        if (!orderSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found');
        }

        const order = orderSnap.data();
        ensureOrderToken(order, orderToken);

        if (!['pending_payment', 'reserved'].includes(order.status)) {
            throw new functions.https.HttpsError('failed-precondition', 'Order can no longer be cancelled');
        }

        await releaseInventory(tx, order.date, getOrderLineItems(order));

        tx.update(orderRef, {
            status: 'cancelled',
            paymentStatus: 'cancelled',
            cancelledAt: FieldValue.serverTimestamp(),
            reason,
            updatedAt: FieldValue.serverTimestamp()
        });

        return { ok: true };
    });
});
