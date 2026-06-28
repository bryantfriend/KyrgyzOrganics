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

  function buildAction(link, action, icon, primary, hub) {
    const anchor = document.createElement("a");
    anchor.className = "action-card" + (primary ? " primary" : "");
    anchor.href = safeHref(link.convertedUrl || link.originalUrl);
    anchor.rel = "noopener noreferrer";
    anchor.innerHTML = '<span class="action-icon"></span><span><strong></strong><span></span></span><span class="chevron" aria-hidden="true">›</span>';
    anchor.querySelector(".action-icon").textContent = icon;
    anchor.querySelector("strong").textContent = text(link.buttonLabel, action);
    anchor.querySelector("span span").textContent = text(link.helperText, "Open delivery link");
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

  function renderHub(hub) {
    if (!hub || hub.active === false) {
      showState("Product unavailable", "This product link is not active right now.");
      return;
    }
    const brand = text(hub.brandName || hub.companyName, "Local bakery");
    const product = text(hub.productName, "Fresh product");
    const locations = Array.isArray(hub.locations) ? hub.locations.filter(function (location) { return location.active !== false; }) : [];
    root.innerHTML = '<article class="hub-page"><header class="hub-top"><span class="brand-badge"></span><div><strong></strong><span></span></div></header><section class="hero-card"><div class="hero-image"></div><div class="hero-body"><p class="badge"></p><h1></h1><p class="description"></p><span class="price"></span></div></section><section class="action-list" aria-label="Order options"></section><section class="location-panel" id="locationPanel"></section><section class="info-strip"></section><p class="footer-note">Thank you for supporting local.</p></article>';
    root.querySelector(".brand-badge").textContent = initials(brand);
    root.querySelector(".hub-top strong").textContent = brand;
    root.querySelector(".hub-top span").textContent = text(hub.campaignName, "Product order hub");
    root.querySelector(".badge").textContent = text(hub.heroBadgeText, "Made fresh daily");
    root.querySelector("h1").textContent = product;
    root.querySelector(".description").textContent = text(hub.productDescription, "Choose delivery or pickup in a few seconds.");
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
      button.innerHTML = '<span class="action-icon">M</span><span><strong>View map locations</strong><span>Find pickup near you</span></span><span class="chevron" aria-hidden="true">›</span>';
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
    if (!actions.children.length) showState("Product link not ready", "No order or pickup action is available yet.");
    root.querySelector(".info-strip").innerHTML = '<span>Delivery available when provider buttons are shown.</span><span>Pickup available when locations are listed.</span>';
    recordLocal("page_view", hub);
  }

  try {
    const hub = decodeHubPayload(params.get("h"));
    if (!hub) showState("Product link not found", "This hub link is missing its product data.");
    else renderHub(hub);
  } catch (error) {
    showState("Product link not found", "This hub link could not be opened.");
  }
})();
