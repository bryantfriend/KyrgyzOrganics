(function () {
  const root = document.getElementById("hubRoot");
  const params = new URLSearchParams(window.location.search);

  function decodeHubPayload(value) {
    if (!value) return null;
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, function (char) { return char.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function text(value, fallback) {
    return String(value || fallback || "").trim();
  }

  function initials(value) {
    return text(value, "QR").split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase() || "QR";
  }

  function isSafeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (error) {
      return false;
    }
  }

  function safeHref(value) {
    return isSafeUrl(value) ? value : "#";
  }

  function recordLocal(action, hub) {
    try {
      const key = "product_link_hub_public_events_v1";
      const events = JSON.parse(window.localStorage.getItem(key) || "[]");
      events.unshift({ action, hubId: hub.id || "", slug: hub.slug || "", createdAt: new Date().toISOString() });
      window.localStorage.setItem(key, JSON.stringify(events.slice(0, 200)));
    } catch (error) {}
  }

  function showState(title, message) {
    root.innerHTML = '<section class="hub-state"><p class="hub-eyebrow">Product Hub</p><h1></h1><p></p></section>';
    root.querySelector("h1").textContent = title;
    root.querySelector("p:last-child").textContent = message;
  }

  function autoSubmitYandexSearch() {
    if (params.get("auto") !== "yandex") return;

    const form = root.querySelector('form.action-card-form[action^="https://eda.yandex.kg/"]');
    if (!form) return;

    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.querySelector("strong").textContent = "Opening Yandex…";
      button.querySelector("span span").textContent = "Tap here if Yandex does not open automatically";
    }

    // A form navigation keeps the Eats query in Safari on iOS. A normal
    // Universal Link can be handed to Yandex Go, where the query is lost.
    window.setTimeout(function () {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
    }, 250);
  }

  function iconClassFor(action) {
    if (action === "glovo_click") return "glovo";
    if (action === "yandex_click") return "yandex";
    return "map";
  }

  function getGlovoProductUrl(link) {
    const candidates = [link && link.originalUrl, link && link.convertedUrl];

    for (const value of candidates) {
      if (!value) continue;
      try {
        let candidate = new URL(value, window.location.href);
        const embeddedTarget = candidate.searchParams.get("u");
        const normalizedHost = candidate.hostname.replace(/\.$/, "").toLowerCase();

        // Older generated hubs stored an OAKO open.html wrapper. Unwrap its
        // target so those links also gain the browser-safe form navigation.
        if (normalizedHost !== "glovoapp.com" && normalizedHost !== "www.glovoapp.com" && embeddedTarget) {
          candidate = new URL(embeddedTarget);
        }

        const targetHost = candidate.hostname.replace(/\.$/, "").toLowerCase();
        if (targetHost !== "glovoapp.com" && targetHost !== "www.glovoapp.com") continue;
        if (candidate.protocol !== "https:" && candidate.protocol !== "http:") continue;

        candidate.protocol = "https:";
        candidate.hostname = "glovoapp.com";
        candidate.port = "";
        return candidate;
      } catch (error) {}
    }

    return null;
  }

  function getYandexSearchQuery(source) {
    if (!/(?:^|\/)search\/?$/i.test(source.pathname)) return "";
    return text(source.searchParams.get("query") || source.searchParams.get("text") || source.searchParams.get("search"));
  }

  function getYandexBrowserTarget(link) {
    const candidates = [link && link.convertedUrl, link && link.originalUrl];

    for (const value of candidates) {
      if (!value) continue;
      try {
        const source = new URL(value, window.location.href);
        const sourceHost = source.hostname.replace(/\.$/, "").toLowerCase();
        let query = getYandexSearchQuery(source);

        if (sourceHost === "8jxm.adj.st" && source.pathname === "/external") {
          const browserCandidates = [source.searchParams.get("adj_fallback"), source.searchParams.get("adj_redirect")];
          for (const browserCandidate of browserCandidates) {
            try {
              query = getYandexSearchQuery(new URL(browserCandidate || ""));
              if (query) break;
            } catch (error) {}
          }

          if (!query) {
            try {
              const nativeTarget = new URL(source.searchParams.get("adj_deeplink") || "");
              query = getYandexSearchQuery(new URL(nativeTarget.searchParams.get("href") || ""));
            } catch (error) {}
          }
        } else if (sourceHost !== "eda.yandex.kg" && sourceHost !== "www.eda.yandex.kg") {
          continue;
        }

        if (!query) continue;

        const browserTarget = new URL("https://eda.yandex.kg/en-kg/search");
        browserTarget.searchParams.set("hideSelector", "true");
        browserTarget.searchParams.set("query", query);
        return browserTarget;
      } catch (error) {}
    }

    return null;
  }

  function fillActionContent(control, action, icon, link) {
    control.innerHTML = '<span class="action-icon"></span><span><strong></strong><span></span></span><span class="chevron" aria-hidden="true">›</span>';
    const iconNode = control.querySelector(".action-icon");
    iconNode.classList.add(iconClassFor(action));
    iconNode.textContent = icon;
    control.querySelector("strong").textContent = text(link.buttonLabel, action);
    control.querySelector("span span").textContent = text(link.helperText, "Open delivery link");
  }

  function getGlovoLoginAction(glovoTarget) {
    const localeMatch = glovoTarget.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)(?:\/|$)/i);
    const localePrefix = localeMatch ? "/" + localeMatch[1] : "/en";
    return glovoTarget.origin + localePrefix + "/login";
  }

  function buildGlovoSignInOption(glovoTarget) {
    const panel = document.createElement("div");
    panel.className = "glovo-signin-option";

    const copy = document.createElement("p");
    copy.innerHTML = "<strong>Not signed in to Glovo?</strong><span>Start here and choose Email on Android. Google can open the app and lose the product.</span>";
    panel.appendChild(copy);

    const form = document.createElement("form");
    form.className = "glovo-signin-form";
    form.method = "get";
    form.action = getGlovoLoginAction(glovoTarget);

    const returnPath = document.createElement("input");
    returnPath.type = "hidden";
    returnPath.name = "returnPath";
    returnPath.value = glovoTarget.pathname + glovoTarget.search;
    form.appendChild(returnPath);

    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Sign in first with Email";
    form.appendChild(button);
    panel.appendChild(form);
    return panel;
  }

  function buildAction(link, action, icon, primary, hub) {
    const glovoTarget = action === "glovo_click" ? getGlovoProductUrl(link) : null;
    if (glovoTarget) {
      const stack = document.createElement("div");
      stack.className = "glovo-action-stack";
      const form = document.createElement("form");
      form.className = "action-card-form";
      form.method = "get";
      form.action = glovoTarget.origin + glovoTarget.pathname;
      glovoTarget.searchParams.forEach(function (value, name) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      const button = document.createElement("button");
      button.type = "submit";
      button.className = "action-card" + (primary ? " primary" : "");
      fillActionContent(button, action, icon, link);
      button.querySelector("span span").textContent = "Already signed in? Open the exact product";
      form.appendChild(button);
      form.addEventListener("submit", function () { recordLocal(action, hub); });
      stack.appendChild(form);
      stack.appendChild(buildGlovoSignInOption(glovoTarget));
      return stack;
    }

    const yandexTarget = action === "yandex_click" ? getYandexBrowserTarget(link) : null;
    if (yandexTarget) {
      const form = document.createElement("form");
      form.className = "action-card-form";
      form.method = "get";
      form.action = yandexTarget.origin + yandexTarget.pathname;
      yandexTarget.searchParams.forEach(function (value, name) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      const button = document.createElement("button");
      button.type = "submit";
      button.className = "action-card" + (primary ? " primary" : "");
      fillActionContent(button, action, icon, link);
      button.querySelector("span span").textContent = "Open this product search on the Yandex website";
      form.appendChild(button);
      form.addEventListener("submit", function () { recordLocal(action, hub); });
      return form;
    }

    const anchor = document.createElement("a");
    anchor.className = "action-card" + (primary ? " primary" : "");
    anchor.href = safeHref(link.convertedUrl || link.originalUrl);
    anchor.rel = "noopener noreferrer";
    fillActionContent(anchor, action, icon, link);
    anchor.addEventListener("click", function () { recordLocal(action, hub); });
    return anchor;
  }

  function distanceKm(a, b) {
    const toRad = function (value) { return value * Math.PI / 180; };
    const radius = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function renderLocations(panel, locations, hub) {
    panel.innerHTML = "";
    locations.forEach(function (location) {
      const card = document.createElement("article");
      card.className = "location-card";
      card.innerHTML = '<strong></strong><span></span><small></small><div class="location-actions"></div>';
      card.querySelector("strong").textContent = text(location.name, "Pickup location");
      card.querySelector("span").textContent = text(location.address, "Pickup available");
      card.querySelector("small").textContent = location.distanceText || text(location.hours, "");
      const actions = card.querySelector(".location-actions");
      if (location.mapUrl && isSafeUrl(location.mapUrl)) {
        const map = document.createElement("a");
        map.href = location.mapUrl;
        map.rel = "noopener noreferrer";
        map.textContent = "Open Maps";
        map.addEventListener("click", function () { recordLocal("location_map_click", hub); });
        actions.appendChild(map);
      }
      if (location.phone) {
        const call = document.createElement("a");
        call.className = "secondary";
        call.href = "tel:" + location.phone.replace(/[^+0-9]/g, "");
        call.textContent = "Call";
        call.addEventListener("click", function () { recordLocal("phone_click", hub); });
        actions.appendChild(call);
      }
      panel.appendChild(card);
    });
  }

  function renderLocationPreview(location) {
    if (!location) return "";
    const hours = text(location.hours, "Pickup available");
    return '<section class="location-preview"><div class="map-art"></div><div class="map-pin"><span>●</span></div><div class="location-preview-content"><span class="mini-label">Nearest location</span><strong></strong><span class="location-address"></span><small><span class="open-text">Open</span> · <span class="location-hours"></span></small></div></section>';
  }

  function hydrateLocationPreview(location) {
    const preview = root.querySelector(".location-preview");
    if (!preview || !location) return;
    preview.querySelector("strong").textContent = text(location.name, "Pickup location");
    preview.querySelector(".location-address").textContent = text(location.address, "Pickup available");
    preview.querySelector(".location-hours").textContent = text(location.hours, "Hours vary");
  }

  function renderHub(hub) {
    if (!hub || hub.active === false) {
      showState("Product unavailable", "This product link is not active right now.");
      return;
    }
    const brand = text(hub.brandName || hub.companyName, "Local bakery");
    const product = text(hub.productName, "Fresh product");
    const locations = Array.isArray(hub.locations) ? hub.locations.filter(function (location) { return location.active !== false; }) : [];
    const firstLocation = locations[0] || null;
    root.innerHTML = '<article class="hub-page"><section class="dashboard-card"><div class="hero-wrap"><div class="hero-image"></div><div class="top-row"><div class="brand-lock"><span class="brand-badge"></span><strong></strong><span></span></div><div class="fresh-badge">♡ <span></span></div></div><div class="hero-copy"><h1></h1><div class="wheat-rule">⌁</div><p class="description"></p><span class="price"></span></div></div><div class="content-stack"><section class="action-list" aria-label="Order options"></section><section class="location-preview-slot"></section><section class="location-panel" id="locationPanel"></section><section class="info-card"><div class="info-tile"><span class="info-icon">□</span><div><strong>Pickup</strong><span>Skip the wait. Order ahead & pick up.</span></div></div><div class="info-tile"><span class="info-icon">↗</span><div><strong>Delivery</strong><span>Fresh to your door. Fast & reliable.</span></div></div></section><p class="footer-note">♡ Thank you for supporting local</p></div></section></article>';
    root.querySelector(".brand-badge").textContent = initials(brand);
    root.querySelector(".brand-lock strong").textContent = brand;
    root.querySelector(".brand-lock span:last-child").textContent = "Bakery";
    root.querySelector(".fresh-badge span").textContent = text(hub.heroBadgeText, "Made fresh daily");
    root.querySelector("h1").textContent = product;
    root.querySelector(".description").textContent = text(hub.productDescription, "Get your favorite fresh product fast.");
    const price = root.querySelector(".price");
    price.textContent = text(hub.priceText, "");
    price.hidden = !price.textContent;
    const heroImage = root.querySelector(".hero-image");
    if (hub.productImageUrl && isSafeUrl(hub.productImageUrl)) {
      const img = document.createElement("img");
      img.src = hub.productImageUrl;
      img.alt = product;
      img.onerror = function () { heroImage.innerHTML = '<span class="image-fallback"></span>'; heroImage.querySelector("span").textContent = initials(product); };
      heroImage.appendChild(img);
    } else {
      heroImage.innerHTML = '<span class="image-fallback"></span>';
      heroImage.querySelector("span").textContent = initials(product);
    }

    const actions = root.querySelector(".action-list");
    let actionCount = 0;
    if (hub.glovoLink && hub.glovoLink.enabled) { actions.appendChild(buildAction(hub.glovoLink, "glovo_click", "G", actionCount === 0, hub)); actionCount += 1; }
    if (hub.yandexLink && hub.yandexLink.enabled) { actions.appendChild(buildAction(hub.yandexLink, "yandex_click", "Y", actionCount === 0, hub)); actionCount += 1; }
    if (locations.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-card" + (actionCount === 0 ? " primary" : "");
      button.innerHTML = '<span class="action-icon map">⌖</span><span><strong>View map locations</strong><span>Find us near you</span></span><span class="chevron" aria-hidden="true">›</span>';
      button.addEventListener("click", function () {
        recordLocal("map_click", hub);
        if (locations.length === 1 && locations[0].mapUrl && isSafeUrl(locations[0].mapUrl)) {
          window.location.href = locations[0].mapUrl;
          return;
        }
        const panel = root.querySelector("#locationPanel");
        panel.classList.add("is-open");
        renderLocations(panel, locations, hub);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function (position) {
            const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            const sorted = locations.slice().map(function (location) {
              if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
                const km = distanceKm(here, location);
                return Object.assign({}, location, { distance: km, distanceText: km.toFixed(1) + " km away" });
              }
              return location;
            }).sort(function (a, b) { return (a.distance || 999999) - (b.distance || 999999); });
            renderLocations(panel, sorted, hub);
          }, function () {
            renderLocations(panel, locations, hub);
          }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
        }
      });
      actions.appendChild(button);
    }
    if (firstLocation) {
      root.querySelector(".location-preview-slot").innerHTML = renderLocationPreview(firstLocation);
      hydrateLocationPreview(firstLocation);
    }
    if (!locations.length) {
      root.querySelector(".info-card .info-tile:first-child span:last-child").textContent = "Add a pickup location to show pickup details.";
    }
    if (!hub.glovoLink.enabled && !hub.yandexLink.enabled) {
      root.querySelector(".info-card .info-tile:last-child span:last-child").textContent = "Add Glovo or Yandex to show delivery details.";
    }
    if (!actions.children.length) showState("Product link not ready", "No order or pickup action is available yet.");
    recordLocal("page_view", hub);
    autoSubmitYandexSearch();
  }

  try {
    const hub = decodeHubPayload(params.get("h"));
    if (!hub) showState("Product link not found", "This hub link is missing its product data.");
    else renderHub(hub);
  } catch (error) {
    showState("Product link not found", "This hub link could not be opened.");
  }
})();
