const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.reserveOrder = functions.https.onCall(async (data, context) => {
    // Validate request
    const { productId, dateStr, customerName, customerPhone } = data;
    if (!productId || !dateStr) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing productId or dateStr');
    }

    return db.runTransaction(async (tx) => {
        // 1. Get Inventory Doc
        const invRef = db.doc(`inventory/${dateStr}`);
        const invDoc = await tx.get(invRef);

        if (!invDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Inventory date not found');
        }

        const inventoryData = invDoc.data();
        const item = inventoryData[productId];

        // 2. Check Availability
        if (!item || item.available <= 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Sold out');
        }

        // 3. Decrement Stock
        tx.update(invRef, {
            [`${productId}.available`]: item.available - 1,
            [`${productId}.sold`]: (item.sold || 0) + 1
        });

        // 4. Create Order
        const orderRef = db.collection('orders').doc();
        tx.set(orderRef, {
            productId,
            productName: data.productName || 'Unknown Product', // Pass from client or fetch? Client passed is risky but easy. 
            // Ideally we fetch product name from DB products collection to be safe, but for now let's trust client or just use ID.
            // Actually, let's fetch product details if possible? 
            // No, let's stick to user pseudo-code but add basic fields.
            price: item.price || 0,
            date: dateStr,
            customerName: customerName || 'Guest',
            customerPhone: customerPhone || '',
            status: 'reserved',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { orderId: orderRef.id };
    });
});
