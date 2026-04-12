import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { COMPANY_ID } from './company-config.js';

function readPrice(item) {
    const value = item.price ?? item.unitPrice ?? item.product?.price ?? 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function readName(item) {
    return item.name
        || item.product?.name_en
        || item.product?.name_ru
        || item.product?.name_kg
        || item.productName
        || "";
}

export async function createOrder(cartItems) {
    const items = (Array.isArray(cartItems) ? cartItems : []).map(item => ({
        productId: item.productId,
        name: readName(item),
        price: readPrice(item),
        quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1)
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderData = {
        companyId: COMPANY_ID,
        items,
        total,
        status: "pending",
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);

    return docRef.id;
}
