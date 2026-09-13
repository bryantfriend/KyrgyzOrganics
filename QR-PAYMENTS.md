# Product QR payments

In Admin → Products, edit a product and enable **Accept QR payments for this product**. Upload the original bank QR image (PNG/JPG/WebP under 5 MB), enter the recipient name, set a positive retail price, and save.

The product page offers a single-item payment: customer name and phone → bank QR and server-calculated retail price → image/PDF receipt. Shipping is excluded and no delivery inventory is reserved. Use this for services such as therapy sessions; it does not schedule an appointment. Orders enter pending verification for manual review under Admin → Orders. Submitting a receipt never marks an order paid automatically.

## Production release: Website 2.15.0 / Admin 3.30

- Firebase functions use the installed SDK's second-generation callable request format. All seven local functions are deployed; the separate existing `reserveOrder` function is preserved.
- Anonymous sign-in is enabled. Customers can upload receipts only for orders belonging to their authenticated UID. Product/branding image uploads and invoice reads require a staff profile.
- The Storage service agent has `roles/firebaserules.firestoreServiceAgent` for ownership and staff lookups. The runtime service account has `roles/iam.serviceAccountTokenCreator` on itself for receipt URL signing; the IAM Credentials API is enabled.
- Firestore rules were synchronized from the active production rules before adding the QR-order restriction. Customers cannot bypass the callable by directly changing QR orders to pending verification.
- `oako.kg` publishes from GitHub Pages (`main`, repository root). The Firebase Hosting copy is also updated. Both must be published for a complete release.
- Production smoke verification passed: guest sign-in, server pricing, owner receipt upload, receipt privacy, blocked guest bank-image uploads, blocked direct order updates, submission retries, and signed receipt viewing. Temporary products, orders, receipts and guest accounts were removed. No money was transferred.

This repository ignores `storage.rules`; preserve the deployed staff restrictions and the receipt rule below when editing rules in Firebase Console. Production rules use a staff profile lookup rather than treating every signed-in customer as an admin.

Add inside `match /b/{bucket}/o`, alongside the existing rules (using the existing `isSignedIn`, `isImageUnder5MB`, and `isPdfUnder5MB` helpers):

```text
match /qr_receipts/{uid}/{orderId}/{fileName} {
  allow create: if isSignedIn() && request.auth.uid == uid
    && (isImageUnder5MB() || isPdfUnder5MB())
    && firestore.get(/databases/(default)/documents/orders/$(orderId)).data.customerUid == uid
    && firestore.get(/databases/(default)/documents/orders/$(orderId)).data.status == 'pending_payment';
  allow read: if isSignedIn() && request.auth.uid == uid;
}
```

Verification: `node --test --experimental-test-isolation=none tests/*.test.mjs`.

Explicit production smoke test: `node tests/qr-payment-smoke.mjs`, with an authorized Google Cloud access token supplied through `QR_DEPLOY_ACCESS_TOKEN`. Never store the token in source control. This creates isolated test data and removes it in `finally`.
