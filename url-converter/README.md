# Product QR URL Converter

Static utility for turning a Glovo web product URL into a QR-friendly browser
landing URL, a branded downloadable QR PNG, and an analytics-ready QR link.

## What it does

- Validates Glovo product URLs that include `productId` and `externalProductId`.
- Generates a browser-preserving `open.html?u=...` landing URL for QR codes.
- Adds a stable `lid` link ID and `cid` company ID to every generated QR URL so scans can be counted.
- Creates a branded QR PNG with company name, product or campaign label, SKU or
  batch note, center badge, custom colors, and selectable export size.
- Records anonymous QR clicks directly to Firestore using the existing `campaign_events` analytics collection configured in `analytics-config.js`.
- Includes the QR generation library locally in `vendor/qrcode.min.js`, so the
  tool does not depend on a live CDN at runtime.

## Files

- `index.html` - paste a Glovo product URL, customize the brand kit, and export the QR.
- `app.js` - validates/parses the Glovo URL, builds converted URLs, renders the branded QR, and downloads PNG files.
- `open.html` - browser-preserving landing page for QR codes.
- `open.js` - validates the target URL, records a QR click, auto-navigates with `window.location.replace()`, and provides an HTML GET form fallback.
- `analytics-config.js` - Firebase project and analytics collection configuration.
- `analytics.js` - tiny browser client that sends anonymous QR click events.
- `styles.css` - shared styling and responsive layout.
- `vendor/qrcode.min.js` - bundled browser build of `qrcode@1.5.3`.
- `vendor/qrcode.LICENSE.txt` - MIT license for the bundled QR library.

## Analytics

The generated QR URL includes:

- `lid` - stable QR link ID generated from company, product URL, brand, label, and code.
- `cid` - analytics company/store ID, such as `kyrgyz-organics`.
- `brand`, `label`, and `code` - display metadata used in reports.

For OAKO, `analytics-config.js` points to Firestore REST using the public Firebase web API key and the existing `campaign_events` collection. The QR event uses `actionType: "qr_click"`, and the OAKO Admin Analytics tab displays daily, weekly, monthly, and top-link QR counts.

To use a different Firebase project, change `projectId`, `apiKey`, or `collection` in `analytics-config.js`. If those values are empty, QR generation still works but clicks are not recorded.

## Recommended QR Output

Use the generated `open.html?u=...` URL for QR codes. It keeps the first hop on
your own landing page, records the anonymous click, then navigates to the exact
Glovo web product in the browser and provides a one-tap form fallback.

Do not use normal anchors or HTTP redirects as the primary flow; emulator
testing showed those hand Android to the Glovo app store page.

## Brand Controls

Companies can use the brand kit fields to create unique QR codes for products,
brands, shelves, events, or campaigns. The QR payload stays the converted
landing URL; the brand name, product text, badge, and colors affect the visual
PNG and analytics labels.
