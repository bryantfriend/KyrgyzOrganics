import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getCurrentCompanyId } from './company-config.js';
import { getRetailPrice } from './product-utils.js';

function readPrice(item) {
    let value = 0;
    if (item && item.price !== undefined && item.price !== null) value = item.price;
    else if (item && item.unitPrice !== undefined && item.unitPrice !== null) value = item.unitPrice;
    else if (item && item.product) value = getRetailPrice(item.product);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function readName(item) {
    return item.name
        || (item.product && item.product.name_en)
        || (item.product && item.product.name_ru)
        || (item.product && item.product.name_kg)
        || item.productName
        || "";
}

export async function createOrder(cartItems) {
    const items = (Array.isArray(cartItems) ? cartItems : []).map(function (item) {
        const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
        const unitPrice = readPrice(item);
        const priceType = item.priceType === 'business' ? 'business' : 'retail';

        return {
            productId: item.productId,
            name: readName(item),
            quantity,
            unitPrice,
            priceType,
            lineTotal: unitPrice * quantity
        };
    });

    const total = items.reduce(function (sum, item) {
        return sum + item.lineTotal;
    }, 0);
    const pricingMode = items.some(function (item) {
        return item.priceType === 'business';
    }) ? 'business' : 'retail';

    const orderData = {
        companyId: getCurrentCompanyId(),
        items,
        total,
        pricingMode,
        status: "pending",
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);

    return docRef.id;
}
