# Product Link & QR Hub

Static Smart Product Link Hub for creating one customer-facing product page and one branded QR code for Glovo, Yandex, and pickup locations.

The converter also produces a validated **OAKO product URL** from a normal Glovo browser link. Paste that URL into an OAKO product external link and select **Glovo** as its link type. The OAKO product page renders the action as a user-submitted GET form, which preserves the exact product on mobile instead of handing a normal verified link to the Glovo app.

## Customer Flow

```text
QR / Instagram / TikTok link
  -> public product hub page
  -> Order on Glovo, Order on Yandex, or View map locations
```

## What it does

- Adds a provider link finder modal for Glovo and Yandex. It opens the provider website, supports an external-tab fallback, and lets the user paste or clipboard-capture the selected product/store URL for conversion.
- Builds a product hub with product name, description, image URL, SKU, campaign, badge, price text, brand colors, and QR styling.
- Keeps the working Glovo product URL parser for `productId`, `externalProductId`, store slug, and content path.
- Produces a canonical Glovo URL for the OAKO product editor while preserving all query parameters, including `content`, `search`, `productId`, and `externalProductId`.
- Renders Glovo actions in newly generated public hubs as browser-safe GET forms so exact web product behavior is preserved on phones.
- Adds a same-tab **Sign in first with Email** action whose Glovo `returnPath` contains the complete product query. This avoids the Google OAuth-to-app handoff that can lose the selected item on Android.
- Converts normal `eda.yandex.kg/.../search?query=...` URLs into a Bishkek-scoped Yandex Eats browser search. OAKO submits the link as a GET form so iPhones stay on the website and retain the product query.
- Accepts other conservative Yandex-related URLs, including `yandex.*`, `eda.yandex.kg`, `ya.cc`, and `yandexgo.*`, and preserves non-search links as pasted.
- Adds pickup locations with name, address, hours, phone, latitude, longitude, and map URL.
- Generates a public `/p/?h=...` product hub link and renders the QR from that hub link.
- Provides a mobile-first public product page with action cards for Glovo, Yandex, and pickup.
- Stores admin history/drafts in `localStorage` through `storageAdapter.js`.
- Records public page interactions locally for MVP testing. Provider redirects still use existing QR/open analytics where applicable.

## Files

- `index.html` - admin builder for product details, delivery links, provider link finder modal, pickup locations, brand controls, QR preview, and history.
- `app.js` - URL parsing, product hub model creation, public hub link generation, QR rendering, download, copy, and history wiring.
- `storageAdapter.js` - localStorage adapter for product hubs and local analytics events.
- `p/index.html` - public product hub route.
- `p/product-hub.js` - decodes the hub payload, renders the customer page, handles map/geolocation behavior, and records local click events.
- `p/product-hub.css` - premium mobile-first dashboard styling for the public QR destination.
- `q/index.html` and `q/q.js` - compact provider link expander used by Glovo and supported Yandex Eats restaurant links.
- `open.html` and `open.js` - browser-preserving provider redirect page with analytics.
- `analytics-config.js` and `analytics.js` - existing Firestore click analytics client.
- `styles.css` - admin styling and responsive layout.
- `vendor/qrcode.min.js` - bundled browser build of `qrcode@1.5.3`.

## Link Finder Workflow

The admin builder includes **Find on Glovo** and **Find on Yandex** buttons. The modal attempts to show the provider website and also offers an **Open website** button. After navigating to a product or store page, copy the browser URL, return to the modal, paste it, then click **Use this link**.

Browser security prevents this static app from reading the current URL inside a cross-origin Glovo/Yandex page automatically, and some provider pages block iframe embedding. The modal therefore uses the safest reliable workflow: open, navigate, paste/capture, validate, and convert.

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

Glovo product links continue to require `productId` and `externalProductId`. The converter's **OAKO product URL** is the validated canonical Glovo URL. It may look similar to the input because the mobile fix is intentionally applied by the OAKO button: choosing the **Glovo** link type makes that button submit a GET form instead of following a normal Android app link.

The public hub uses the same browser-safe form behavior. If the customer is logged out, they should use **Sign in first with Email** before ordering; after email authentication Glovo receives the complete exact-product return path. Google and Facebook authentication can still be claimed by the installed Glovo Android app because that callback is controlled by Glovo. Older generated hub payloads that contain the previous `open.html` wrapper are unwrapped at runtime when possible.

Native Glovo exact product deep linking is intentionally not forced because testing did not find a reliable supported route.

## Yandex iPhone Behavior

Yandex Go on Android accepts an Eats search in the `yandextaxi://external` route, but the iOS app launches and discards that nested search. The converter therefore generates `https://eda.yandex.kg/en-kg/Bishkek/search?query=...` instead of an Adjust app link. The city segment prevents a fresh Yandex session from redirecting to a generic home page and losing the query.

The OAKO storefront submits the search as a GET form rather than following a normal Universal Link. This keeps Safari on the Yandex website, where the customer can enter a delivery address while `query=бискотти` remains in the URL. Older OAKO products and generated hubs that still contain an `8jxm.adj.st` link are unwrapped at runtime and sent through the same browser-safe route.

## Yandex Behavior

Yandex is conservative in this MVP:

- Safe Yandex URLs are accepted and preserved.
- Clean Yandex Eats restaurant URLs can use the compact `/q/?y=...` route.
- Yandex search links preserve the product query; the matching Alma Go result is shown after Yandex has the customer's delivery area.
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
9. Tap Order on Yandex from an iPhone and confirm Safari stays open with `/en-kg/Bishkek/search?query=...`.
9. Tap Order on Yandex and confirm it opens the saved Yandex URL.
10. Tap View map locations with one and multiple pickup locations.
11. Test geolocation allowed and denied.
12. Test invalid URLs and a hub with no usable action.

## Limitations

- Public hubs are encoded into the URL for this static MVP, so very rich hubs can create long links.
- Admin history is local to the browser until a backend storage adapter is added.
- Public hub view/click analytics are local-only in this MVP, while provider redirects continue to use the existing analytics flow.


Production link rule: use the generated full OAKO landing page URL for Instagram, TikTok, QR codes, and packaging. Do not shorten it; provider buttons inside the hub use full landing/original URLs.
