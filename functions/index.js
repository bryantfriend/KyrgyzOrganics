const crypto = require("crypto");
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;
const COMPANY_ID = "kyrgyz-organics";
const COMPANY_ID_PATTERN = /^[a-z0-9-]{2,80}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPER_ADMIN_ROLES = new Set(['superadmin', 'super_admin']);
const STORE_OWNER_CLAIMS = (companyId) => ({
    role: 'admin',
    permissionPreset: 'owner',
    companyId
});

const DEFAULT_CHECKOUT_SETTINGS = {
    deliveryFee: 200,
    freeDeliveryThreshold: 3000
};

function ensureCompanyDoc(data, label, id, expectedCompanyId = COMPANY_ID) {
    if (data?.companyId && data.companyId !== expectedCompanyId) {
        throw new functions.https.HttpsError('permission-denied', `${label} belongs to another company`);
    }

    if (!data?.companyId) {
        console.warn(`${label} missing companyId:`, id);
        if (expectedCompanyId !== COMPANY_ID) {
            throw new functions.https.HttpsError('permission-denied', `${label} is missing company ownership`);
        }
    }
}

function asTrimmedString(value, maxLength = 500) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizeYandexImageUri(uri) {
    const clean = asTrimmedString(uri, 500);
    if (!clean) return '';
    const sized = clean.replace('{w}', '600').replace('{h}', '600');
    if (sized.startsWith('http://') || sized.startsWith('https://')) return sized;
    if (sized.startsWith('/')) return `https://eda.yandex${sized}`;
    return sized;
}

function parseYandexRestaurantSlug(rawUrl) {
    const value = asTrimmedString(rawUrl, 500);
    if (!value) {
        throw new functions.https.HttpsError('invalid-argument', 'Yandex restaurant URL is required');
    }

    let url;
    try {
        url = new URL(value);
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid Yandex restaurant URL');
    }

    const host = url.hostname.replace(/.$/, '').toLowerCase();
    if (!['eda.yandex.kg', 'eda.yandex.ru', 'eda.yandex.com'].includes(host)) {
        throw new functions.https.HttpsError('invalid-argument', 'Use a Yandex Eats restaurant URL');
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const restaurantIndex = parts.indexOf('r');
    const slug = restaurantIndex >= 0 ? parts[restaurantIndex + 1] : '';
    if (!slug || !/^[a-z0-9_-]{2,140}$/i.test(slug)) {
        throw new functions.https.HttpsError('invalid-argument', 'Could not find the restaurant slug');
    }

    return { slug, originalUrl: url.toString() };
}

function getYandexMenuSlugCandidates(restaurantSlug) {
    const candidates = [restaurantSlug];
    const trimmedNumericSuffix = restaurantSlug.replace(/_d+$/, '_');
    if (trimmedNumericSuffix && trimmedNumericSuffix !== restaurantSlug) candidates.push(trimmedNumericSuffix);
    const beforeLastUnderscore = restaurantSlug.replace(/_[^_]+$/, '_');
    if (beforeLastUnderscore && !candidates.includes(beforeLastUnderscore)) candidates.push(beforeLastUnderscore);
    return candidates;
}

function flattenYandexMenu(menuJson, restaurantUrl, restaurantSlug, menuSlug) {
    const categories = Array.isArray(menuJson?.payload?.categories) ? menuJson.payload.categories : [];
    const products = [];

    categories.forEach((category) => {
        const items = Array.isArray(category?.items) ? category.items : [];
        items.forEach((item) => {
            products.push({
                provider: 'yandex',
                restaurantUrl,
                restaurantSlug,
                menuSlug,
                categoryId: String(category.id || ''),
                categoryName: asTrimmedString(category.name, 160),
                itemId: String(item.id || ''),
                publicId: asTrimmedString(item.publicId, 160),
                name: asTrimmedString(item.name, 180),
                description: asTrimmedString(item.description, 500),
                price: Number(item.price || 0) || 0,
                decimalPrice: asTrimmedString(item.decimalPrice, 80),
                weight: asTrimmedString(item.weight, 120),
                available: item.available !== false,
                imageUrl: normalizeYandexImageUri(item?.picture?.uri)
            });
        });
    });

    return products.filter((product) => product.itemId && product.name);
}

function normalizeRole(role) {
    return asTrimmedString(role, 80).toLowerCase();
}

function isSuperAdminRole(role) {
    return SUPER_ADMIN_ROLES.has(normalizeRole(role));
}

function requireValidEmail(email) {
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }

    if (!EMAIL_PATTERN.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid email address');
    }
}

function requireValidCompanyId(companyId) {
    if (!companyId) {
        throw new functions.https.HttpsError('invalid-argument', 'Company is required');
    }

    if (!COMPANY_ID_PATTERN.test(companyId)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid company');
    }
}

async function requireStoreOwnerCreator(context) {
    if (!context?.auth?.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in is required');
    }

    const tokenRole = normalizeRole(context.auth.token?.role);
    if (isSuperAdminRole(tokenRole)) {
        return { uid: context.auth.uid, email: context.auth.token?.email || '' };
    }

    const callerSnap = await db.doc(`users/${context.auth.uid}`).get();
    const caller = callerSnap.exists ? callerSnap.data() : null;
    if (!caller || !isSuperAdminRole(caller.role)) {
        throw new functions.https.HttpsError('permission-denied', 'Only platform admins can create store owner users');
    }

    return {
        uid: context.auth.uid,
        email: context.auth.token?.email || caller.email || ''
    };
}

async function ensureCompanyExists(companyId) {
    const companySnap = await db.doc(`companies/${companyId}`).get();
    if (!companySnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Store not found');
    }
}

function resolveCompanyId(value) {
    const companyId = asTrimmedString(value, 80).toLowerCase();
    return COMPANY_ID_PATTERN.test(companyId) ? companyId : COMPANY_ID;
}

function getCompanyScopedId(companyId, id) {
    return `${companyId || COMPANY_ID}__${id}`;
}

async function getCompanyScopedDoc(collectionName, id, companyId) {
    const scopedRef = db.doc(`${collectionName}/${getCompanyScopedId(companyId, id)}`);
    const scopedSnap = await scopedRef.get();
    if (scopedSnap.exists || companyId !== COMPANY_ID) {
        return { ref: scopedRef, snap: scopedSnap };
    }

    const legacyRef = db.doc(`${collectionName}/${id}`);
    return { ref: legacyRef, snap: await legacyRef.get() };
}

function readMoney(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function hasOwnValue(source, key) {
    return source
        && Object.prototype.hasOwnProperty.call(source, key)
        && source[key] !== undefined
        && source[key] !== null
        && source[key] !== '';
}

function getRetailPrice(product) {
    if (hasOwnValue(product, 'priceRetail')) return readMoney(product.priceRetail);
    return readMoney(product.price);
}

function getBusinessPrice(product) {
    if (hasOwnValue(product, 'priceBusiness')) return readMoney(product.priceBusiness);
    return getRetailPrice(product);
}

function isApprovedBusinessProfile(profile) {
    return !!profile
        && profile.accountType === 'business'
        && profile.businessStatus === 'approved';
}

async function getPricingProfile(context) {
    if (!context || !context.auth || !context.auth.uid) return null;

    const userSnap = await db.doc(`users/${context.auth.uid}`).get();
    return userSnap.exists ? userSnap.data() : null;
}

function getDisplayPrice(product, pricingProfile) {
    if (isApprovedBusinessProfile(pricingProfile)) return getBusinessPrice(product);
    return getRetailPrice(product);
}

function getDisplayPriceType(pricingProfile) {
    return isApprovedBusinessProfile(pricingProfile) ? 'business' : 'retail';
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

async function getCheckoutSettings(companyId = COMPANY_ID) {
    try {
        const { snap } = await getCompanyScopedDoc('shop_settings', 'checkout', companyId);
        if (!snap.exists) return { ...DEFAULT_CHECKOUT_SETTINGS };

        const data = snap.data() || {};
        ensureCompanyDoc(data, 'Checkout settings', 'shop_settings/checkout', companyId);
        return { ...DEFAULT_CHECKOUT_SETTINGS, ...data };
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

function mapOrderItemsForClient(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        productId: item.productId || '',
        quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1),
        unitPrice: readMoney(item.unitPrice),
        priceType: item.priceType === 'business' ? 'business' : 'retail',
        lineTotal: readMoney(item.lineTotal),
        imageUrl: item.imageUrl || '',
        weight: item.weight || '',
        name: getOrderDisplayName(item)
    }));
}

function toMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return null;
}

function getTrackingEvents(order) {
    return [
        {
            key: 'pending_payment',
            label: 'Order placed',
            completed: true,
            atMillis: toMillis(order.createdAt)
        },
        {
            key: 'pending_verification',
            label: 'Payment submitted',
            completed: ['pending_verification', 'paid', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status),
            atMillis: toMillis(order.paymentSubmittedAt)
        },
        {
            key: 'paid',
            label: 'Payment verified',
            completed: ['paid', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status),
            atMillis: toMillis(order.paidAt || order.verifiedAt)
        },
        {
            key: 'preparing',
            label: 'Preparing order',
            completed: ['preparing', 'out_for_delivery', 'delivered'].includes(order.status),
            atMillis: toMillis(order.preparingAt)
        },
        {
            key: 'out_for_delivery',
            label: order.deliveryMethod === 'pickup' ? 'Ready for pickup' : 'Out for delivery',
            completed: ['out_for_delivery', 'delivered'].includes(order.status),
            atMillis: toMillis(order.outForDeliveryAt || order.readyForPickupAt)
        },
        {
            key: 'delivered',
            label: order.deliveryMethod === 'pickup' ? 'Picked up' : 'Delivered',
            completed: order.status === 'delivered',
            atMillis: toMillis(order.deliveredAt)
        }
    ];
}

async function releaseInventory(tx, dateStr, items, companyId = COMPANY_ID) {
    if (!dateStr || !items.length) return;

    let inventoryRef = db.doc(`inventory/${getCompanyScopedId(companyId, dateStr)}`);
    const inventorySnap = await tx.get(inventoryRef);
    let activeInventorySnap = inventorySnap;
    if (!activeInventorySnap.exists && companyId === COMPANY_ID) {
        inventoryRef = db.doc(`inventory/${dateStr}`);
        activeInventorySnap = await tx.get(inventoryRef);
    }
    if (!activeInventorySnap.exists) return;

    const inventoryData = activeInventorySnap.data() || {};
    ensureCompanyDoc(inventoryData, 'Inventory', dateStr, companyId);
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

exports.createStoreOwnerUser = functions.https.onCall(async (data, context) => {
    let createdUid = null;

    try {
        const caller = await requireStoreOwnerCreator(context);
        const email = asTrimmedString(data?.email, 254).toLowerCase();
        const displayName = asTrimmedString(data?.displayName || data?.name, 120);
        const companyId = asTrimmedString(data?.companyId || data?.storeId, 80).toLowerCase();
        const phoneNumber = asTrimmedString(data?.phoneNumber, 30);

        requireValidEmail(email);
        if (!displayName) {
            throw new functions.https.HttpsError('invalid-argument', 'Display name is required');
        }
        requireValidCompanyId(companyId);
        if (phoneNumber && !/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
            throw new functions.https.HttpsError('invalid-argument', 'Phone number must use E.164 format');
        }

        await ensureCompanyExists(companyId);

        try {
            await admin.auth().getUserByEmail(email);
            throw new functions.https.HttpsError('already-exists', 'An account with this email already exists');
        } catch (error) {
            if (error instanceof functions.https.HttpsError) throw error;
            if (error?.code !== 'auth/user-not-found') {
                console.error('Store owner duplicate check failed:', error);
                throw new functions.https.HttpsError('internal', 'Could not create store owner user');
            }
        }

        const authUser = await admin.auth().createUser({
            email,
            displayName,
            disabled: false,
            ...(phoneNumber ? { phoneNumber } : {})
        });
        createdUid = authUser.uid;

        const claims = STORE_OWNER_CLAIMS(companyId);
        await admin.auth().setCustomUserClaims(authUser.uid, claims);

        await db.doc(`users/${authUser.uid}`).set({
            uid: authUser.uid,
            email,
            displayName,
            ...(phoneNumber ? { phoneNumber } : {}),
            companyId,
            role: 'admin',
            permissionPreset: 'owner',
            status: 'active',
            active: true,
            createdAt: FieldValue.serverTimestamp(),
            createdBy: caller.uid,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        try {
            await db.collection('audit_logs').add({
                companyId,
                action: 'Store Owner User Created',
                details: `${email} created as Owner`,
                user: caller.email || caller.uid,
                timestamp: FieldValue.serverTimestamp()
            });
        } catch (auditError) {
            console.warn('Store owner audit log failed:', auditError);
        }

        return {
            ok: true,
            uid: authUser.uid,
            email,
            displayName,
            companyId,
            role: 'admin',
            permissionPreset: 'owner',
            passwordResetRequired: true
        };
    } catch (error) {
        if (createdUid && !(error instanceof functions.https.HttpsError)) {
            try {
                await admin.auth().deleteUser(createdUid);
            } catch (cleanupError) {
                console.error('Store owner create cleanup failed:', cleanupError);
            }
        }

        if (error instanceof functions.https.HttpsError) {
            throw error;
        }

        console.error('createStoreOwnerUser failed:', error);
        throw new functions.https.HttpsError('internal', 'Could not create store owner user');
    }
});

exports.createOrder = functions.https.onCall(async (data, context) => {
    const companyId = resolveCompanyId(data?.companyId);
    const dateStr = asTrimmedString(data?.dateStr, 20);
    const deliveryMethod = data?.fulfillment?.method === 'pickup' ? 'pickup' : 'delivery';
    const customerName = asTrimmedString(data?.customer?.name, 120);
    const customerPhone = asTrimmedString(data?.customer?.phone, 60);
    const customerAddress = asTrimmedString(data?.customer?.address, 300);
    const customerNotes = asTrimmedString(data?.customer?.notes, 500);
    const normalizedItems = normalizeItems(data?.items);
    const pricingProfile = await getPricingProfile(context);
    const priceType = getDisplayPriceType(pricingProfile);

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

    const checkoutSettings = await getCheckoutSettings(companyId);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return db.runTransaction(async (tx) => {
        let inventoryRef = db.doc(`inventory/${getCompanyScopedId(companyId, dateStr)}`);
        let inventorySnap = await tx.get(inventoryRef);
        if (!inventorySnap.exists && companyId === COMPANY_ID) {
            inventoryRef = db.doc(`inventory/${dateStr}`);
            inventorySnap = await tx.get(inventoryRef);
        }

        if (!inventorySnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Inventory is not available for this date');
        }

        const inventoryData = inventorySnap.data() || {};
        ensureCompanyDoc(inventoryData, 'Inventory', dateStr, companyId);
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
            ensureCompanyDoc(product, 'Product', item.productId, companyId);
            if (product.active === false) {
                throw new functions.https.HttpsError('failed-precondition', 'One of the products is inactive');
            }

            const inventoryItem = inventoryData[item.productId];
            if (!inventoryItem || Number(inventoryItem.available || 0) < item.quantity) {
                throw new functions.https.HttpsError('failed-precondition', 'Insufficient stock for one of the products');
            }

            // Pricing is validated server-side. Client-sent unit prices are only snapshots for display.
            const unitPrice = getDisplayPrice(product, pricingProfile);
            const lineTotal = unitPrice * item.quantity;

            orderItems.push({
                productId: item.productId,
                name: getOrderDisplayName(product),
                quantity: item.quantity,
                unitPrice,
                priceType,
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
            companyId,
            date: dateStr,
            itemCount,
            items: orderItems,
            pricingMode: priceType,
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
                name: getOrderDisplayName(item),
                unitPrice: item.unitPrice,
                priceType: item.priceType,
                lineTotal: item.lineTotal
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
        const orderCompanyId = order.companyId || COMPANY_ID;
        ensureCompanyDoc(order, 'Order', orderId, orderCompanyId);
        ensureOrderToken(order, orderToken);

        if (paymentMethodId) {
            const methodSnap = await tx.get(db.doc(`payment_methods/${paymentMethodId}`));
            const method = methodSnap.data() || {};
            if (!methodSnap.exists || method.active === false) {
                throw new functions.https.HttpsError('failed-precondition', 'Payment method is unavailable');
            }
            ensureCompanyDoc(method, 'Payment method', paymentMethodId, orderCompanyId);
        }

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
        const orderCompanyId = order.companyId || COMPANY_ID;
        ensureCompanyDoc(order, 'Order', orderId, orderCompanyId);
        ensureOrderToken(order, orderToken);

        if (!['pending_payment', 'reserved'].includes(order.status)) {
            throw new functions.https.HttpsError('failed-precondition', 'Order can no longer be cancelled');
        }

        await releaseInventory(tx, order.date, getOrderLineItems(order), orderCompanyId);

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

exports.getOrderStatus = functions.https.onCall(async (data) => {
    const orderId = asTrimmedString(data?.orderId, 120);
    const orderToken = asTrimmedString(data?.orderToken, 120);

    if (!orderId || !orderToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing order lookup details');
    }

    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Order not found');
    }

    const order = orderSnap.data();
    const orderCompanyId = order.companyId || COMPANY_ID;
    ensureCompanyDoc(order, 'Order', orderId, orderCompanyId);
    ensureOrderToken(order, orderToken);

    return {
        orderId,
        orderToken,
        status: order.status || 'pending_payment',
        paymentStatus: order.paymentStatus || 'unpaid',
        deliveryMethod: order.deliveryMethod || 'delivery',
        customerName: order.customerName || '',
        customerPhone: order.customerPhone || '',
        customerAddress: order.customerAddress || '',
        customerNotes: order.customerNotes || '',
        subtotal: readMoney(order.subtotal),
        deliveryFee: readMoney(order.deliveryFee),
        total: readMoney(order.total),
        pricingMode: order.pricingMode === 'business' ? 'business' : 'retail',
        itemCount: Math.max(0, Number.parseInt(order.itemCount, 10) || 0),
        expiresAtMillis: toMillis(order.expiresAt),
        createdAtMillis: toMillis(order.createdAt),
        paymentSubmittedAtMillis: toMillis(order.paymentSubmittedAt),
        paidAtMillis: toMillis(order.paidAt || order.verifiedAt),
        preparingAtMillis: toMillis(order.preparingAt),
        outForDeliveryAtMillis: toMillis(order.outForDeliveryAt || order.readyForPickupAt),
        deliveredAtMillis: toMillis(order.deliveredAt),
        cancelledAtMillis: toMillis(order.cancelledAt),
        items: mapOrderItemsForClient(order.items),
        trackingEvents: getTrackingEvents(order)
    };
});

exports.importYandexMenu = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Sign in to import a Yandex menu');
    }

    const { slug: restaurantSlug, originalUrl } = parseYandexRestaurantSlug(data?.restaurantUrl);
    let lastError = null;

    for (const menuSlug of getYandexMenuSlugCandidates(restaurantSlug)) {
        const endpoint = `https://eda.yandex.kg/api/v2/menu/retrieve/${encodeURIComponent(menuSlug)}`;
        try {
            const response = await fetch(endpoint, {
                headers: {
                    accept: 'application/json,text/plain,*/*',
                    'user-agent': 'Mozilla/5.0 OAKO Product Link Importer'
                }
            });

            if (!response.ok) {
                lastError = `Yandex returned ${response.status}`;
                continue;
            }

            const menuJson = await response.json();
            const products = flattenYandexMenu(menuJson, originalUrl, restaurantSlug, menuSlug);
            if (products.length) {
                return {
                    ok: true,
                    restaurantUrl: originalUrl,
                    restaurantSlug,
                    menuSlug,
                    productCount: products.length,
                    products
                };
            }

            lastError = 'No products found in Yandex menu response';
        } catch (error) {
            lastError = error.message || 'Yandex menu import failed';
        }
    }

    throw new functions.https.HttpsError('not-found', lastError || 'Could not import this Yandex menu');
});
