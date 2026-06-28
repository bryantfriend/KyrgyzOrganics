# Product QR URL Converter

Static utility for turning a Glovo web product URL or Yandex Eats restaurant URL into a compact OAKO short link,
a branded downloadable QR PNG, and an analytics-ready product/restaurant link.

## What it does

- Validates Glovo product URLs that include `productId` and `externalProductId`.
- Validates Yandex Eats restaurant URLs such as `https://eda.yandex.kg/r/faiza_1706873280`. Yandex product-level links are intentionally unsupported until an exact public item route is confirmed.
- Generates compact OAKO short links for Instagram, TikTok, and QR codes: `q/?s=...&c=...&p=...&e=...` for Glovo products and `q/?y=...` for Yandex Eats restaurants.
- Keeps the full `open.html?u=...` landing URL as a debugging fallback.
- Creates a branded QR PNG with company name, product or campaign label, SKU or batch note, center badge, custom colors, and selectable export size.
- Records anonymous QR clicks directly to Firestore using the existing `campaign_events` analytics collection configured in `analytics-config.js`.
- Includes the QR generation library locally in `vendor/qrcode.min.js`, so the tool does not depend on a live CDN at runtime.

## Files

- `index.html` - paste a Glovo product URL or Yandex Eats restaurant URL, customize the brand kit, and export the QR.
- `app.js` - validates/parses supported platform URLs, builds converted URLs, renders the branded QR, and downloads PNG files.
- `q/index.html` - compact social-safe short-link landing page that reconstructs supported destination URLs.
- `q/q.js` - short-link decoder, analytics tracker, and redirect script.
- `open.html` - long-form browser-preserving fallback landing page for QR codes.
- `open.js` - validates the target URL, records a QR click, auto-navigates with `window.location.replace()`, and provides an HTML GET form fallback.
- `analytics-config.js` - Firebase project and analytics collection configuration.
- `analytics.js` - browser client that sends anonymous QR click events.
- `styles.css` - shared styling and responsive layout.
- `vendor/qrcode.min.js` - bundled browser build of `qrcode@1.5.3`.
- `vendor/qrcode.LICENSE.txt` - MIT license for the bundled QR library.

## Compact Link Format

The generated Glovo social-safe URL uses:

- `s` - Glovo store slug.
- `c` - Glovo content/category path.
- `p` - base-36 product ID.
- `e` - base-36 external product ID.
- `cid` - optional analytics company/store ID when it is not `kyrgyz-organics`.

For the tested Glovo Express product, the production URL is about 114 characters:

```text
https://oako.kg/q/?s=glovo-express-bsk&c=hleb-vypechka-sc.42969216%2Fsvezhiy-hleb-c.42969150&p=z1ci99mfcz0e&e=a2nu
```

Yandex Eats restaurant links use:

- `y` - Yandex Eats restaurant/brand slug, usually from `/r/{brandSlug}`.
- `yr` - optional `restaurant` value for legacy `/restaurant/{slug}` links. Omitted links use canonical `/r/{brandSlug}`.
- `cid` - optional analytics company/store ID when it is not `kyrgyz-organics`.

Example Yandex Eats restaurant QR URL:

```text
https://oako.kg/q/?y=faiza_1706873280
```

## Analytics

For OAKO, the compact short-link page writes `actionType: "qr_click"` events to the existing `campaign_events` collection. The OAKO Admin Analytics tab displays daily, weekly, monthly, and top-link QR counts.

To use a different Firebase project, change `projectId`, `apiKey`, or `collection` in `analytics-config.js`. If those values are empty, QR generation still works but clicks are not recorded.

## Recommended Output

Use the generated compact `https://oako.kg/q/?...` URL for Instagram, TikTok, and QR codes. It keeps the first hop on your own landing page, records the anonymous click, reconstructs the destination URL, then opens Glovo or Yandex Eats in the browser and provides a one-tap form fallback.

Do not use the long fallback URL, normal anchors, or HTTP redirects as the primary flow; emulator testing showed those can hand Android to app-level routes instead of the intended browser page.

## Brand Controls

Companies can use the brand kit fields to create unique QR codes for products, brands, shelves, events, or campaigns. The QR payload stays the converted compact link; the brand name, product text, badge, and colors affect the visual PNG and analytics labels.
