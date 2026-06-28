# Product Link & QR Hub

Static Smart Product Link Hub for creating one customer-facing product page and one branded QR code for Glovo, Yandex, and pickup locations.

The app still preserves the original Glovo exact web product behavior, but the QR/Instagram/TikTok link now points to your own public product hub page first.

## Customer Flow

```text
QR / Instagram / TikTok link
  -> public product hub page
  -> Order on Glovo, Order on Yandex, or View map locations
```

## What it does

- Builds a product hub with product name, description, image URL, SKU, campaign, badge, price text, brand colors, and QR styling.
- Keeps the working Glovo product URL parser for `productId`, `externalProductId`, store slug, and content path.
- Uses the existing compact Glovo `/q/?s=...&c=...&p=...&e=...` route for the Glovo action so exact web product behavior is preserved.
- Accepts conservative Yandex-related URLs, including `yandex.*`, `eda.yandex.kg`, `ya.cc`, and `yandexgo.*`, and preserves the pasted URL unless a simple Eats restaurant route can safely use `/q/?y=...`.
- Adds pickup locations with name, address, hours, phone, latitude, longitude, and map URL.
- Generates a public `/p/?h=...` product hub link and renders the QR from that hub link.
- Provides a mobile-first public product page with action cards for Glovo, Yandex, and pickup.
- Stores admin history/drafts in `localStorage` through `storageAdapter.js`.
- Records public page interactions locally for MVP testing. Provider redirects still use existing QR/open analytics where applicable.

## Files

- `index.html` - admin builder for product details, delivery links, pickup locations, brand controls, QR preview, and history.
- `app.js` - URL parsing, product hub model creation, public hub link generation, QR rendering, download, copy, and history wiring.
- `storageAdapter.js` - localStorage adapter for product hubs and local analytics events.
- `p/index.html` - public product hub route.
- `p/product-hub.js` - decodes the hub payload, renders the customer page, handles map/geolocation behavior, and records local click events.
- `p/product-hub.css` - mobile-first public hub styling.
- `q/index.html` and `q/q.js` - compact provider link expander used by Glovo and supported Yandex Eats restaurant links.
- `open.html` and `open.js` - browser-preserving provider redirect page with analytics.
- `analytics-config.js` and `analytics.js` - existing Firestore click analytics client.
- `styles.css` - admin styling and responsive layout.
- `vendor/qrcode.min.js` - bundled browser build of `qrcode@1.5.3`.

## Public Hub Links

The generated customer link uses:

```text
/p/?h=URL_SAFE_ENCODED_HUB_DATA
```

This keeps the MVP static and shareable without adding Firebase, Supabase, or a server. The tradeoff is that rich hubs can create longer URLs than a backend-backed `/p/{slug}` route would.

For production at scale, the next persistence upgrade should store hubs by slug in a backend and make the QR point to:

```text
/p/{slug}
```

The code is structured so that can be added behind a future storage adapter.

## Glovo Behavior

Glovo product links continue to require `productId` and `externalProductId`. The public hub's Glovo button uses the compact `/q/` route, which reconstructs the exact Glovo web product URL and opens it through the existing redirect/analytics flow.

Native Glovo exact product deep linking is intentionally not forced because testing did not find a reliable supported route.

## Yandex Behavior

Yandex is conservative in this MVP:

- Safe Yandex URLs are accepted and preserved.
- Clean Yandex Eats restaurant URLs can use the compact `/q/?y=...` route.
- Product-level Yandex support is not claimed unless the pasted URL itself opens the exact product.
- No private APIs, scraping, or order automation are used.

## Pickup Locations

If one pickup location exists, the public map button opens its `mapUrl` directly. If multiple locations exist, the public page opens a locations panel. Browser geolocation is requested only after the customer taps the map action, and locations with coordinates are sorted by distance when permission is granted.

## Manual Testing

1. Create a hub with only a Glovo product URL.
2. Create a hub with only a Yandex URL.
3. Create a hub with only one pickup location.
4. Create a hub with Glovo + Yandex + pickup.
5. Confirm the QR preview renders and downloads as PNG.
6. Copy the public product hub link and open it on desktop.
7. Open the same link at mobile width around 360px.
8. Tap Order on Glovo and confirm it reaches the existing Glovo web product flow.
9. Tap Order on Yandex and confirm it opens the saved Yandex URL.
10. Tap View map locations with one and multiple pickup locations.
11. Test geolocation allowed and denied.
12. Test invalid URLs and a hub with no usable action.

## Limitations

- Public hubs are encoded into the URL for this static MVP, so very rich hubs can create long links.
- Admin history is local to the browser until a backend storage adapter is added.
- Public hub view/click analytics are local-only in this MVP, while provider redirects continue to use the existing analytics flow.
