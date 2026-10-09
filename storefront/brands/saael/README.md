# UNIVERSE OF SaaEl

This implementation continues the existing `saael-s` tenant in the shared KyrgyzOrganics storefront. It reuses its Firebase login, Stores editor, storefront configuration document and deployment architecture. The separate Saikal prototype has in-memory mock services/bookings, so it is not a live booking integration.

## Saikal's editing workflow

1. Sign in at `/admin/admin.html?companyId=saael-s` using an existing authorized admin account.
2. Open Stores and edit the SaaEl store.
3. Open **UNIVERSE OF SaaEl settings** at the top of the form.
4. Change homepage copy, navigation and booking labels, colours, fonts, starting Map/List view, and animation preference. Each destination has editable title, subtitle, introduction, pigment colour and visibility.
5. Add, edit or remove services, library readings and gallery artwork. Each service has its own price and duration in minutes; leave either blank when unconfirmed. Zero is a valid price. Gallery and logo fields accept complete HTTP/HTTPS image URLs. The existing media library can supply uploaded artwork URLs. Every service needs a unique reference ID. Keep the sample label checked until the offering is confirmed.
6. Click **Save Store**, then refresh the storefront. Changes are stored in `storefront_configs/saael-s.content.saael`.

## Calendar, availability and pricing

All Book a session and View availability entry points open a month calendar. Opening it from a service detail preselects that service. Visitors can browse months, return to Today, select an available date and time, and view the service's price and duration. Past dates and elapsed start times cannot be selected. No availability or price is invented when settings are empty.

In **Availability & pricing**, set the currency (KGS, USD, EUR or another three-letter code) and calendar time zone. The editable starting time zone is Asia/Bishkek. Add a date and a same-day From/Until window, then select all services or a specific service. Remove a window to withdraw it. Set each offering's separate price and duration under **Services**, then Save Store. Calendar times are spaced by that service's duration and only shown when the entire session fits inside a published window. Duplicate start times are combined.

Availability, currency, time zone and numeric prices/durations use the existing validated ICF settings save. The visitor's date/time selection is a local preview; it does not reserve inventory, submit a booking or take payment. Reservation conflict checks, external calendars, daylight-saving transition handling for live reservations and payment processing remain part of the future booking integration.

Brand spelling remains UNIVERSE OF SaaEl. Region geometry is interface code; colours, content and visibility are settings. Booking preview warnings remain visible until real booking is implemented. Existing general Stores settings continue to manage SEO, hosting, contacts and launch status. Configure the website's palette and fonts in the SaaEl-specific editor.

Settings saves run through the registered SaveSaaelSettingsIntent: Validate, Normalize, AddContext, Authorize, Process and Emit. Admin identity is loaded from the signed-in user's Firestore profile. The existing Firestore rules remain the final authorization boundary. No account credentials or permissions were changed.

## Run locally

From the Website v1.2 workspace:

```powershell
node KyrgyzOrganics/tests/saael-preview/serve.cjs
```

Open `http://127.0.0.1:19828/tests/saael-preview/index.html` for an isolated frontend preview without Firebase data. The preview uses the exact presentation modules used by the storefront. The preview server and browser-check snippets live in `tests/saael-preview`, which Firebase hosting excludes. Screenshots stay in the ignored `output/playwright` directory.

For the actual tenant and login integration, use the project's Firebase Hosting emulator or existing hosting deployment and open `/index.html?companyId=saael-s&preview=1`. The launch status gate is preserved; production continues to require live launch status.

## Verification

```powershell
node KyrgyzOrganics/tests/saael-settings.test.mjs
node KyrgyzOrganics/tests/saael-calendar.test.mjs
```

Browser checks used the local Playwright CLI. Reusable CLI snippets are in `tests/saael-preview/saael-browser-check.js`, `saael-admin-check.js` and `saael-calendar-check.js`. Settings checks use a test repository, not production Firestore. Desktop and phone calendar screenshots show test services/prices and test availability; those fixtures are not published in the site defaults.

Manual check:

1. Select each of the seven map destinations, close its panel, and select a different destination from the panel navigation.
2. Switch to List and open the same destinations.
3. Open Services, enter a matching and non-matching search, and open a service detail.
4. Open Library and read an entry; open Art Gallery and enlarge an artwork.
5. Open each booking button, browse next/previous months and Today, select a service and confirm its price/duration. Add availability in admin, then check that only the applicable services have times on those dates. Select a day/time and confirm the preview summary; nothing is reserved or submitted.
6. Tab to a map region, press Enter or Space, navigate the dialog, press Escape and confirm focus returns to the initiating control.
7. Check a phone viewport and reduced-motion preference. Test empty service/reading/gallery collections and unavailable artwork.
8. In admin, edit content, add and remove entries, disable a destination, save and refresh the public site. Production login and Firestore persistence require an authorized account and deployed code; these were not exercised with a live account.

## Business details still needed

Confirmed offerings, descriptions, durations, prices and currency; practitioner information; scheduling provider, time zone, availability, buffers and booking rules; payment provider and cancellation/refund terms. No live reservations, messages or payments are submitted.

The original logo and sketch were recovered from the related concept chat. Concept #4's generated image was not available, so the composition follows the written brief and original sketch; an exact comparison to that image remains pending.
