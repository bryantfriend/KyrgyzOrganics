import { validateExtraction, DETAIL_FIELDS } from '../../../../domain.mjs';
export function normalizeEnquiry(intent) {
    var review = intent.payload.review;
    var source = { buyer: review.buyer, products: [], ambiguities: review.ambiguities };
    DETAIL_FIELDS.forEach(function (key) { source[key] = review[key]; });
    review.products.forEach(function (item) {
        source.products.push({ requestedName: item.requestedName, quantity: item.quantity, unit: item.unit, ambiguities: item.ambiguities });
    });
    var typed = validateExtraction(source).data;
    review.buyer = typed.buyer;
    DETAIL_FIELDS.forEach(function (key) { review[key] = typed[key]; });
    review.products.forEach(function (item, index) {
        item.requestedName = typed.products[index].requestedName;
        item.unit = typed.products[index].unit;
    });
    review.followUpNote = review.followUpNote.trim();
    // Preserve original message and JSON exactly as staff supplied them.
    return { ok: true, intent: intent };
}
