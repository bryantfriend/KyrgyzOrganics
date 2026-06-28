(function () {
  const sampleUrl = "https://glovoapp.com/en/kg/bishkek/stores/glovo-express-bsk?content=hleb-vypechka-sc.42969216%2Fsvezhiy-hleb-c.42969150&productId=4611686018602341182&externalProductId=470010";

  const sourceUrl = document.getElementById("sourceUrl");
  const convertButton = document.getElementById("convertButton");
  const sampleButton = document.getElementById("sampleButton");
  const clearButton = document.getElementById("clearButton");
  const resetStyleButton = document.getElementById("resetStyleButton");
  const results = document.getElementById("results");
  const landingUrl = document.getElementById("landingUrl");
  const socialShortUrl = document.getElementById("socialShortUrl");
  const trailingDotUrl = document.getElementById("trailingDotUrl");
  const statusCard = document.getElementById("statusCard");
  const statusText = document.getElementById("statusText");
  const qrCanvas = document.getElementById("qrCanvas");
  const qrWarning = document.getElementById("qrWarning");
  const shortUrlStats = document.getElementById("shortUrlStats");
  const downloadQrButton = document.getElementById("downloadQrButton");
  const copyQrUrlButton = document.getElementById("copyQrUrlButton");
  const yandexUrl = document.getElementById("yandexUrl");
  const previewProductName = document.getElementById("previewProductName");
  const previewBrandName = document.getElementById("previewBrandName");
  const previewActionSummary = document.getElementById("previewActionSummary");
  const addLocationButton = document.getElementById("addLocationButton");
  const locationsList = document.getElementById("locationsList");
  const historyList = document.getElementById("historyList");
  const clearHistoryButton = document.getElementById("clearHistoryButton");

  const extraControls = {
    productDescription: document.getElementById("productDescription"),
    productImageUrl: document.getElementById("productImageUrl"),
    campaignName: document.getElementById("campaignName"),
    priceText: document.getElementById("priceText"),
    heroBadgeText: document.getElementById("heroBadgeText"),
  };

  const locationControls = {
    name: document.getElementById("locationName"),
    address: document.getElementById("locationAddress"),
    latitude: document.getElementById("locationLatitude"),
    longitude: document.getElementById("locationLongitude"),
    phone: document.getElementById("locationPhone"),
    hours: document.getElementById("locationHours"),
    mapUrl: document.getElementById("locationMapUrl"),
  };

  const brandControls = {
    brandName: document.getElementById("brandName"),
    companyId: document.getElementById("companyId"),
    productName: document.getElementById("productName"),
    productCode: document.getElementById("productCode"),
    badgeText: document.getElementById("badgeText"),
    qrColor: document.getElementById("qrColor"),
    backgroundColor: document.getElementById("backgroundColor"),
    accentColor: document.getElementById("accentColor"),
    qrSize: document.getElementById("qrSize"),
    productDescription: document.getElementById("productDescription"),
    productImageUrl: document.getElementById("productImageUrl"),
    campaignName: document.getElementById("campaignName"),
    priceText: document.getElementById("priceText"),
    heroBadgeText: document.getElementById("heroBadgeText"),
  };

  const defaultStyle = {
    brandName: "",
    companyId: "kyrgyz-organics",
    productName: "",
    productCode: "",
    badgeText: "",
    qrColor: "#1f2a24",
    backgroundColor: "#ffffff",
    accentColor: "#27724f",
    qrSize: "960",
    productDescription: "",
    productImageUrl: "",
    campaignName: "",
    priceText: "",
    heroBadgeText: "Made fresh daily",
  };

  const fields = {
    storeSlug: document.getElementById("storeSlug"),
    productId: document.getElementById("productId"),
    externalProductId: document.getElementById("externalProductId"),
    contentPath: document.getElementById("contentPath"),
  };

  let renderToken = 0;
  let currentCanonicalUrl = "";
  let currentParsedUrl = null;
  let currentGlovoParsed = null;
  let currentYandexParsed = null;
  let currentHub = null;
  let pickupLocations = [];
  const autoFilled = {
    productName: "",
    productCode: "",
  };

  function setStatus(message, isError) {
    statusText.textContent = message;
    statusCard.classList.toggle("error", Boolean(isError));
  }

  function parseSourceUrl(rawValue) {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error("Paste a Glovo product URL or Yandex delivery URL first.");
    }

    let url;
    try {
      url = new URL(trimmed);
    } catch (error) {
      throw new Error("That does not look like a valid URL.");
    }

    const normalizedHost = normalizeHost(url.hostname);
    if (normalizedHost === "glovoapp.com" || normalizedHost === "www.glovoapp.com") {
      return parseGlovoUrl(url);
    }

    if (isYandexLikeHost(normalizedHost)) {
      return parseYandexDeliveryUrl(url);
    }

    throw new Error("Use a glovoapp.com product URL or a Yandex delivery link.");
  }

  function parseGlovoUrl(url) {
    const normalizedHost = url.hostname.replace(/\.$/, "").toLowerCase();
    if (normalizedHost !== "glovoapp.com" && normalizedHost !== "www.glovoapp.com") {
      throw new Error("This converter expects a glovoapp.com product URL.");
    }

    const productId = url.searchParams.get("productId");
    const externalProductId = url.searchParams.get("externalProductId");
    if (!productId || !externalProductId) {
      throw new Error("The URL needs productId and externalProductId parameters.");
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const storesIndex = pathParts.indexOf("stores");
    const storeSlug = storesIndex >= 0 ? pathParts[storesIndex + 1] : "";
    if (!storeSlug) {
      throw new Error("Could not find the store slug in this Glovo URL.");
    }

    return {
      platform: "glovo",
      url,
      canonical: canonicalizeGlovoUrl(url),
      storeSlug,
      productId,
      externalProductId,
      content: url.searchParams.get("content") || "",
    };
  }

  function parseYandexEatsUrl(url) {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const routeParts = pathParts.length > 0 && /^[a-z]{2}-[a-z]{2}$/i.test(pathParts[0])
      ? pathParts.slice(1)
      : pathParts;
    const route = routeParts[0] || "";
    const slug = routeParts[1] || "";

    if (!slug) {
      throw new Error("Could not find a Yandex Eats restaurant slug in this URL.");
    }

    if (route !== "r" && route !== "restaurant") {
      throw new Error("Use a Yandex Eats restaurant URL such as https://eda.yandex.kg/r/faiza_1706873280.");
    }

    if (routeParts.length > 2 || url.searchParams.has("item") || url.searchParams.has("openItemCard") || url.searchParams.has("open_item_card")) {
      throw new Error("Yandex Eats product-level links are not supported yet. Use the restaurant page URL.");
    }

    const yandexSlug = sanitizeYandexSlug(slug);
    const canonical = new URL(`https://eda.yandex.kg/${route}/${yandexSlug}`);

    return {
      platform: "yandex-eats",
      url,
      canonical: canonical.href,
      route,
      storeSlug: yandexSlug,
      productId: "",
      externalProductId: "",
      content: route === "r" ? "Canonical Yandex Eats restaurant link" : "Legacy Yandex Eats restaurant link",
    };
  }

  function sanitizeYandexSlug(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,120}$/.test(clean)) {
      throw new Error("Invalid Yandex Eats restaurant slug.");
    }
    return clean;
  }

  function normalizeHost(value) {
    return String(value || "").replace(/\.$/, "").toLowerCase();
  }

  function isYandexLikeHost(host) {
    return /(^|.)yandex.[a-z.]+$/i.test(host) || /(^|.)yandexgo.[a-z.]+$/i.test(host) || host === "ya.cc";
  }

  function assertSafeHttpUrl(url, label) {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(label + " must start with http:// or https://.");
    }
    return url;
  }

  function parseYandexDeliveryUrl(value) {
    const url = value instanceof URL ? new URL(value.href) : new URL(String(value || "").trim());
    assertSafeHttpUrl(url, "Yandex link");
    const host = normalizeHost(url.hostname);
    if (!isYandexLikeHost(host)) {
      throw new Error("This does not look like a Yandex link, but you can still save it later as a custom delivery link.");
    }

    const isEatsRestaurant = (host === "eda.yandex.kg" || host === "www.eda.yandex.kg") && /^\/(?:[a-z]{2}-[a-z]{2}\/)?(?:r|restaurant)\//i.test(url.pathname);
    let parsed = null;
    if (isEatsRestaurant) {
      try {
        parsed = parseYandexEatsUrl(url);
      } catch (error) {
        parsed = null;
      }
    }
    return {
      platform: "yandex-eats",
      url,
      canonical: url.href,
      route: parsed ? parsed.route : "external",
      storeSlug: parsed ? parsed.storeSlug : host,
      productId: "",
      externalProductId: "",
      content: parsed ? parsed.content : "Yandex delivery link preserved as pasted",
      exactProductSupport: !isEatsRestaurant,
    };
  }

  function canonicalizeGlovoUrl(url) {
    const canonical = new URL(url.href);
    canonical.protocol = "https:";
    canonical.hostname = "glovoapp.com";
    return canonical.href;
  }

  function buildTrailingDotUrl(canonicalUrl) {
    const url = new URL(canonicalUrl);
    url.hostname = url.hostname.replace(/\.$/, "") + ".";
    return url.href;
  }

  function buildLandingUrl(canonicalUrl, settings, platform) {
    const openUrl = new URL("open.html", window.location.href);
    openUrl.searchParams.set("u", canonicalUrl);
    openUrl.searchParams.set("lid", buildLinkId(canonicalUrl, settings));
    openUrl.searchParams.set("cid", settings.companyId);
    openUrl.searchParams.set("brand", settings.brand);
    openUrl.searchParams.set("label", settings.product);
    openUrl.searchParams.set("code", settings.code);
    if (platform) openUrl.searchParams.set("platform", platform);
    return openUrl.href;
  }

  function buildSocialShortUrl(parsed, settings) {
    const base = window.location.pathname.includes("/url-converter/") ? "../q/" : "q/";
    const shortUrl = new URL(base, window.location.href);
    shortUrl.searchParams.set("op", window.location.pathname.includes("/url-converter/") ? "uc" : "root");
    if (parsed.platform === "yandex-eats") {
      shortUrl.searchParams.set("y", parsed.storeSlug);
      if (parsed.route === "restaurant") {
        shortUrl.searchParams.set("yr", "restaurant");
      }

      if (settings.companyId && settings.companyId !== defaultStyle.companyId) {
        shortUrl.searchParams.set("cid", settings.companyId);
      }

      return shortUrl.href;
    }

    shortUrl.searchParams.set("s", parsed.storeSlug);
    shortUrl.searchParams.set("c", parsed.content);
    shortUrl.searchParams.set("p", decimalToBase36(parsed.productId));
    shortUrl.searchParams.set("e", decimalToBase36(parsed.externalProductId));

    if (settings.companyId && settings.companyId !== defaultStyle.companyId) {
      shortUrl.searchParams.set("cid", settings.companyId);
    }

    return shortUrl.href;
  }


  function getControlValue(control) {
    return control ? control.value.trim() : "";
  }

  function isSafeOptionalUrl(value, label) {
    const clean = String(value || "").trim();
    if (!clean) return "";
    try {
      const url = new URL(clean);
      assertSafeHttpUrl(url, label);
      return url.href;
    } catch (error) {
      throw new Error(label + " must be a valid http or https URL.");
    }
  }

  function createProductHub(glovoParsed, yandexParsed, settings) {
    const now = new Date().toISOString();
    const productName = getControlValue(brandControls.productName) || settings.product;
    const slug = slugify(settings.companyId + "-" + (productName || "product") + "-" + (settings.code || Date.now().toString(36))).slice(0, 90);
    const productImageUrl = isSafeOptionalUrl(getControlValue(extraControls.productImageUrl), "Product image URL");
    const activeLocations = pickupLocations.filter(function (location) { return location.active !== false; });
    const glovoLink = glovoParsed ? {
      enabled: true,
      originalUrl: glovoParsed.url.href,
      convertedUrl: buildSocialShortUrl(glovoParsed, settings),
      buttonLabel: "Order on Glovo",
      helperText: "Open the product on Glovo",
      platformName: "Glovo",
      openMode: "browser-preserved",
      productId: glovoParsed.productId,
      externalProductId: glovoParsed.externalProductId,
      content: glovoParsed.content,
    } : { enabled: false };
    const yandexLink = yandexParsed ? {
      enabled: true,
      originalUrl: yandexParsed.url.href,
      convertedUrl: yandexParsed.route === "external" ? yandexParsed.canonical : buildSocialShortUrl(yandexParsed, settings),
      buttonLabel: "Order on Yandex",
      helperText: "Quick delivery to your door",
      platformName: "Yandex",
      openMode: "external-url",
    } : { enabled: false };

    if (!productName) {
      throw new Error("Add a product name before publishing the hub.");
    }
    if (!glovoLink.enabled && !yandexLink.enabled && activeLocations.length === 0) {
      throw new Error("Add at least one way for customers to order or find this product.");
    }

    return {
      id: "hub-" + hashString(slug + "|" + now),
      slug,
      companyName: settings.brand,
      brandName: settings.brand,
      productName,
      productDescription: getControlValue(extraControls.productDescription),
      productImageUrl,
      sku: settings.code,
      campaignName: getControlValue(extraControls.campaignName) || productName,
      analyticsId: settings.companyId,
      heroBadgeText: getControlValue(extraControls.heroBadgeText) || "Made fresh daily",
      priceText: getControlValue(extraControls.priceText),
      active: true,
      createdAt: currentHub && currentHub.createdAt ? currentHub.createdAt : now,
      updatedAt: now,
      glovoLink,
      yandexLink,
      locations: activeLocations,
      branding: {
        logoUrl: "",
        primaryColor: settings.qrColor,
        accentColor: settings.accentColor,
        backgroundColor: settings.backgroundColor,
        cardColor: "#ffffff",
        textColor: textColorFor(settings.backgroundColor),
        qrColor: settings.qrColor,
        qrBackgroundColor: settings.backgroundColor,
        centerBadgeText: settings.badge,
      },
      analytics: {
        viewCount: 0,
        glovoClickCount: 0,
        yandexClickCount: 0,
        mapClickCount: 0,
        lastClickedAt: "",
      },
    };
  }

  function toPublicHubPayload(hub) {
    function publicLink(link) {
      if (!link || !link.enabled) return { enabled: false };
      return {
        enabled: true,
        convertedUrl: link.convertedUrl,
        buttonLabel: link.buttonLabel,
        helperText: link.helperText,
        platformName: link.platformName,
      };
    }

    return {
      v: 1,
      id: hub.id,
      slug: hub.slug,
      companyName: hub.companyName,
      brandName: hub.brandName,
      productName: hub.productName,
      productDescription: hub.productDescription,
      productImageUrl: hub.productImageUrl,
      sku: hub.sku,
      campaignName: hub.campaignName,
      analyticsId: hub.analyticsId,
      heroBadgeText: hub.heroBadgeText,
      priceText: hub.priceText,
      active: hub.active,
      glovoLink: publicLink(hub.glovoLink),
      yandexLink: publicLink(hub.yandexLink),
      locations: hub.locations.map(function (location) {
        return {
          id: location.id,
          name: location.name,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          phone: location.phone,
          hours: location.hours,
          mapUrl: location.mapUrl,
          active: location.active,
        };
      }),
      branding: hub.branding,
    };
  }

  function encodeHubPayload(hub) {
    const json = JSON.stringify(toPublicHubPayload(hub));
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach(function (byte) {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function buildProductHubUrl(hub) {
    const base = window.location.pathname.includes("/url-converter/") ? "../p/" : "p/";
    const url = new URL(base, window.location.href);
    url.searchParams.set("h", encodeHubPayload(hub));
    return url.href;
  }

  function summarizeActions(hub) {
    const actions = [];
    if (hub.glovoLink && hub.glovoLink.enabled) actions.push("Glovo");
    if (hub.yandexLink && hub.yandexLink.enabled) actions.push("Yandex");
    if (hub.locations && hub.locations.length) actions.push("Pickup");
    return actions.join(", ") || "No actions yet";
  }

  function updateHubPreview(hub) {
    if (!hub) return;
    if (previewProductName) previewProductName.textContent = hub.productName || "Product landing page";
    if (previewBrandName) previewBrandName.textContent = hub.brandName || "Product Hub";
    if (previewActionSummary) previewActionSummary.textContent = summarizeActions(hub);
  }

  function saveHubToHistory(hub, publicUrl) {
    if (!window.ProductHubStorage) return;
    window.ProductHubStorage.saveProductHub(Object.assign({}, hub, { publicUrl }));
    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const hubs = window.ProductHubStorage ? window.ProductHubStorage.listProductHubs() : [];
    if (!hubs.length) {
      historyList.innerHTML = '<p class="helper-text">No product hubs saved yet.</p>';
      return;
    }
    historyList.innerHTML = "";
    hubs.slice(0, 12).forEach(function (hub) {
      const item = document.createElement("article");
      item.className = "history-item";
      const platforms = summarizeActions(hub);
      item.innerHTML = '<div><strong></strong><span></span><small></small></div><button type="button" class="copy-button">Copy Link</button>';
      item.querySelector("strong").textContent = hub.productName || "Untitled product";
      item.querySelector("span").textContent = (hub.brandName || hub.companyName || "Brand") + " - " + platforms;
      item.querySelector("small").textContent = hub.updatedAt ? new Date(hub.updatedAt).toLocaleDateString() : "Saved";
      item.querySelector("button").addEventListener("click", async function () {
        await navigator.clipboard.writeText(hub.publicUrl || "");
        setStatus("Hub link copied", false);
      });
      historyList.appendChild(item);
    });
  }

  function readLocationDraft() {
    const name = getControlValue(locationControls.name);
    const mapUrl = isSafeOptionalUrl(getControlValue(locationControls.mapUrl), "Map URL");
    if (!name && !mapUrl && !getControlValue(locationControls.address)) {
      throw new Error("Add a location name, address, or map URL first.");
    }
    return {
      id: "loc-" + hashString(name + "|" + Date.now()),
      name: name || "Pickup location",
      address: getControlValue(locationControls.address),
      latitude: Number.parseFloat(getControlValue(locationControls.latitude)) || null,
      longitude: Number.parseFloat(getControlValue(locationControls.longitude)) || null,
      phone: getControlValue(locationControls.phone),
      hours: getControlValue(locationControls.hours),
      mapUrl,
      active: true,
    };
  }

  function clearLocationDraft() {
    Object.values(locationControls).forEach(function (control) {
      if (control) control.value = "";
    });
  }

  function renderLocations() {
    if (!locationsList) return;
    locationsList.innerHTML = "";
    if (!pickupLocations.length) {
      locationsList.innerHTML = '<p class="helper-text">No pickup locations added yet.</p>';
      return;
    }
    pickupLocations.forEach(function (location) {
      const item = document.createElement("article");
      item.className = "location-item";
      item.innerHTML = '<div><strong></strong><span></span><small></small></div><button type="button" class="ghost">Remove</button>';
      item.querySelector("strong").textContent = location.name;
      item.querySelector("span").textContent = location.address || location.mapUrl || "Pickup available";
      item.querySelector("small").textContent = location.hours || location.phone || "";
      item.querySelector("button").addEventListener("click", function () {
        pickupLocations = pickupLocations.filter(function (candidate) { return candidate.id !== location.id; });
        renderLocations();
        refreshQr();
      });
      locationsList.appendChild(item);
    });
  }

  function decimalToBase36(value) {
    const clean = String(value || "").replace(/[^0-9]/g, "");
    return clean ? BigInt(clean).toString(36) : "0";
  }

  function getText(id, fallback) {
    const value = brandControls[id].value.trim();
    return value || fallback;
  }

  function getQrSettings() {
    const productId = fields.productId.textContent !== "-" && !fields.productId.textContent.startsWith("Not ") ? fields.productId.textContent : "";
    const externalProductId = fields.externalProductId.textContent !== "-" && !fields.externalProductId.textContent.startsWith("Not ") ? fields.externalProductId.textContent : "";
    const storeSlug = fields.storeSlug.textContent !== "-" ? fields.storeSlug.textContent : "";
    const brand = getText("brandName", "Product QR");
    const fallbackLabel = currentParsedUrl && currentParsedUrl.platform === "yandex-eats"
      ? "Yandex Eats restaurant"
      : "Glovo product";
    const product = getText("productName", storeSlug ? humanizeSlug(storeSlug) : fallbackLabel);
    const code = getText("productCode", externalProductId ? `SKU ${externalProductId}` : productId);
    const badge = getText("badgeText", initials(brand));

    return {
      brand,
      product,
      code,
      badge: badge.slice(0, 6).toUpperCase(),
      companyId: normalizeCompanyId(getText("companyId", defaultStyle.companyId)),
      qrColor: brandControls.qrColor.value || defaultStyle.qrColor,
      backgroundColor: brandControls.backgroundColor.value || defaultStyle.backgroundColor,
      accentColor: brandControls.accentColor.value || defaultStyle.accentColor,
      size: Number(brandControls.qrSize.value) || Number(defaultStyle.qrSize),
    };
  }

  function normalizeCompanyId(value) {
    return String(value || defaultStyle.companyId)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || defaultStyle.companyId;
  }

  function buildLinkId(canonicalUrl, settings) {
    const source = `${settings.companyId}|${canonicalUrl}|${settings.brand}|${settings.product}|${settings.code}`;
    return `qr-${hashString(source)}`;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function humanizeSlug(slug) {
    return slug
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function initials(value) {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("") || "QR";
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = clean.length === 3
      ? clean.split("").map((char) => char + char).join("")
      : clean;
    const number = Number.parseInt(value, 16);
    if (Number.isNaN(number)) {
      return { r: 255, g: 255, b: 255 };
    }
    return {
      r: (number >> 16) & 255,
      g: (number >> 8) & 255,
      b: number & 255,
    };
  }

  function textColorFor(hex) {
    const rgb = hexToRgb(hex);
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance > 0.58 ? "#1f2a24" : "#ffffff";
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawFittedText(context, text, x, y, maxWidth, fontSize, weight, color, align) {
    const minSize = Math.max(13, Math.round(fontSize * 0.66));
    let size = fontSize;
    context.textAlign = align || "center";
    context.textBaseline = "middle";
    context.fillStyle = color;

    do {
      context.font = `${weight || 700} ${size}px Inter, Arial, sans-serif`;
      if (context.measureText(text).width <= maxWidth || size <= minSize) {
        break;
      }
      size -= 2;
    } while (size > minSize);

    context.fillText(text, x, y, maxWidth);
  }

  function wrapText(context, text, maxWidth, maxLines) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    });

    if (line) {
      lines.push(line);
    }

    if (lines.length > maxLines) {
      const trimmed = lines.slice(0, maxLines);
      let last = trimmed[trimmed.length - 1];
      while (context.measureText(`${last}...`).width > maxWidth && last.length > 4) {
        last = last.slice(0, -1);
      }
      trimmed[trimmed.length - 1] = `${last}...`;
      return trimmed;
    }

    return lines;
  }

  function renderRawQr(canvas, value, options) {
    return new Promise((resolve, reject) => {
      window.QRCode.toCanvas(canvas, value, options, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async function drawQrCode(value) {
    const token = ++renderToken;
    const settings = getQrSettings();
    const width = settings.size;
    const height = Math.round(width * 1.28);
    const context = qrCanvas.getContext("2d");

    qrCanvas.width = width;
    qrCanvas.height = height;
    context.clearRect(0, 0, width, height);

    if (!window.QRCode || typeof window.QRCode.toCanvas !== "function") {
      qrWarning.hidden = false;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      drawFittedText(context, "QR library not loaded", width / 2, height / 2, width * 0.78, width * 0.04, 800, "#1f2a24");
      return;
    }

    const qrSize = Math.round(width * 0.66);
    const panelPad = Math.round(width * 0.035);
    const panelSize = qrSize + panelPad * 2;
    const panelX = Math.round((width - panelSize) / 2);
    const panelY = Math.round(width * 0.255);
    const qrX = panelX + panelPad;
    const qrY = panelY + panelPad;
    const rawQr = document.createElement("canvas");

    try {
      await renderRawQr(rawQr, value, {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: value.length > 1200 ? "M" : "H",
        color: {
          dark: settings.qrColor,
          light: "#ffffff",
        },
      });
    } catch (error) {
      qrWarning.hidden = false;
      setStatus("Could not generate QR", true);
      return;
    }

    if (token !== renderToken) return;

    const textColor = textColorFor(settings.backgroundColor);
    qrWarning.hidden = true;

    context.fillStyle = settings.backgroundColor;
    context.fillRect(0, 0, width, height);

    context.fillStyle = settings.accentColor;
    context.fillRect(0, 0, width, Math.max(10, Math.round(width * 0.018)));

    drawFittedText(context, settings.brand, width / 2, Math.round(width * 0.09), width * 0.82, width * 0.055, 900, textColor);

    context.font = `700 ${Math.round(width * 0.032)}px Inter, Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    wrapText(context, settings.product, width * 0.78, 2).forEach((line, index, lines) => {
      const lineHeight = Math.round(width * 0.042);
      const startY = Math.round(width * 0.148) - ((lines.length - 1) * lineHeight) / 2;
      context.fillText(line, width / 2, startY + index * lineHeight, width * 0.78);
    });

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.14)";
    context.shadowBlur = Math.round(width * 0.026);
    context.shadowOffsetY = Math.round(width * 0.012);
    context.fillStyle = "#ffffff";
    roundRect(context, panelX, panelY, panelSize, panelSize, Math.round(width * 0.035));
    context.fill();
    context.restore();

    context.drawImage(rawQr, qrX, qrY, qrSize, qrSize);

    if (settings.badge) {
      const badgeWidth = Math.round(qrSize * 0.22);
      const badgeHeight = Math.round(qrSize * 0.13);
      const badgeX = Math.round(qrX + qrSize / 2 - badgeWidth / 2);
      const badgeY = Math.round(qrY + qrSize / 2 - badgeHeight / 2);
      context.fillStyle = "#ffffff";
      roundRect(context, badgeX - 8, badgeY - 8, badgeWidth + 16, badgeHeight + 16, Math.round(badgeHeight * 0.42));
      context.fill();
      context.fillStyle = settings.accentColor;
      roundRect(context, badgeX, badgeY, badgeWidth, badgeHeight, Math.round(badgeHeight * 0.36));
      context.fill();
      drawFittedText(context, settings.badge, qrX + qrSize / 2, qrY + qrSize / 2, badgeWidth * 0.78, badgeHeight * 0.42, 900, textColorFor(settings.accentColor));
    }

    const footerY = panelY + panelSize + Math.round(width * 0.075);
    const footerText = "Scan for product hub";
    drawFittedText(context, footerText, width / 2, footerY, width * 0.76, width * 0.042, 900, textColor);

    if (settings.code) {
      drawFittedText(context, settings.code, width / 2, footerY + Math.round(width * 0.055), width * 0.74, width * 0.028, 700, textColor);
    }

    context.fillStyle = settings.accentColor;
    roundRect(context, Math.round(width * 0.28), height - Math.round(width * 0.075), Math.round(width * 0.44), Math.max(5, Math.round(width * 0.008)), Math.round(width * 0.004));
    context.fill();
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product";
  }

  function refreshLandingUrl() {
    if (!currentHub) return;
    const settings = getQrSettings();
    currentHub = createProductHub(currentGlovoParsed, currentYandexParsed, settings);
    const publicUrl = buildProductHubUrl(currentHub);
    landingUrl.value = currentGlovoParsed ? buildLandingUrl(currentGlovoParsed.canonical, settings, "glovo") : "";
    socialShortUrl.value = publicUrl;
    updateHubPreview(currentHub);
    if (shortUrlStats) {
      shortUrlStats.textContent = "Hub link length: " + socialShortUrl.value.length + " characters. Use the QR for long rich hubs.";
    }
  }

  function downloadQrCode() {
    if (!socialShortUrl.value) return;

    const settings = getQrSettings();
    const productId = fields.productId.textContent && fields.productId.textContent !== "-"
      ? fields.productId.textContent
      : currentParsedUrl && currentParsedUrl.platform === "yandex-eats"
        ? "yandex-restaurant"
        : "glovo-product";
    const link = document.createElement("a");
    link.download = `${slugify(settings.brand)}-${slugify(settings.product)}-${productId}-qr.png`;
    link.href = qrCanvas.toDataURL("image/png");
    link.click();
    setStatus("QR downloaded", false);
  }

  function setAutoFilledField(key, value) {
    const control = brandControls[key];
    if (!control) return;
    const current = control.value.trim();
    if (!current || current === autoFilled[key]) {
      control.value = value;
      autoFilled[key] = value;
    }
  }

  function fillDefaultProductFields(parsed) {
    if (parsed.platform === "yandex-eats") {
      setAutoFilledField("productCode", "Yandex Eats");
      if (parsed.storeSlug) {
        setAutoFilledField("productName", humanizeSlug(parsed.storeSlug));
      }
      return;
    }

    setAutoFilledField("productCode", parsed.externalProductId ? `SKU ${parsed.externalProductId}` : "");
    if (parsed.storeSlug) {
      setAutoFilledField("productName", humanizeSlug(parsed.storeSlug));
    }
  }

  function convert() {
    try {
      const sourceValue = sourceUrl.value.trim();
      const yandexValue = yandexUrl ? yandexUrl.value.trim() : "";
      let glovoParsed = null;
      let yandexParsed = null;

      if (sourceValue) {
        const parsed = parseSourceUrl(sourceValue);
        if (parsed.platform === "glovo") glovoParsed = parsed;
        else yandexParsed = parsed;
      }

      if (yandexValue) {
        yandexParsed = parseYandexDeliveryUrl(yandexValue);
      }

      const primaryParsed = glovoParsed || yandexParsed;
      currentCanonicalUrl = primaryParsed ? primaryParsed.canonical : "";
      currentParsedUrl = primaryParsed;
      currentGlovoParsed = glovoParsed;
      currentYandexParsed = yandexParsed;

      const settings = getQrSettings();
      currentHub = createProductHub(glovoParsed, yandexParsed, settings);
      const publicUrl = buildProductHubUrl(currentHub);

      trailingDotUrl.value = glovoParsed ? buildTrailingDotUrl(glovoParsed.canonical) : yandexParsed ? yandexParsed.canonical : "";
      landingUrl.value = glovoParsed ? buildLandingUrl(glovoParsed.canonical, settings, "glovo") : "";
      socialShortUrl.value = publicUrl;

      fields.storeSlug.textContent = primaryParsed ? primaryParsed.storeSlug : "-";
      fields.productId.textContent = glovoParsed ? glovoParsed.productId : "Not supported";
      fields.externalProductId.textContent = glovoParsed ? glovoParsed.externalProductId : "Not used";
      fields.contentPath.textContent = primaryParsed ? primaryParsed.content || "-" : "-";
      if (primaryParsed) fillDefaultProductFields(primaryParsed);
      updateHubPreview(currentHub);
      saveHubToHistory(currentHub, publicUrl);

      results.hidden = false;
      drawQrCode(publicUrl);
      if (shortUrlStats) {
        shortUrlStats.textContent = "Hub link length: " + publicUrl.length + " characters. Use the QR for long rich hubs.";
      }
      setStatus("Product hub ready", false);
    } catch (error) {
      results.hidden = true;
      currentCanonicalUrl = "";
      currentParsedUrl = null;
      currentGlovoParsed = null;
      currentYandexParsed = null;
      currentHub = null;
      setStatus(error.message, true);
    }
  }

  async function copyValue(targetId) {
    const target = document.getElementById(targetId);
    if (!target || !target.value) return;

    try {
      await navigator.clipboard.writeText(target.value);
      setStatus("Copied", false);
    } catch (error) {
      target.select();
      document.execCommand("copy");
      setStatus("Copied", false);
    }
  }

  function refreshQr() {
    try {
      refreshLandingUrl();
      if (!results.hidden && socialShortUrl.value) {
        drawQrCode(socialShortUrl.value);
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function resetStyle() {
    Object.entries(defaultStyle).forEach(([key, value]) => {
      brandControls[key].value = value;
    });
    refreshQr();
    setStatus("Style reset", false);
  }

  convertButton.addEventListener("click", convert);
  sampleButton.addEventListener("click", () => {
    sourceUrl.value = sampleUrl;
    convert();
  });
  clearButton.addEventListener("click", () => {
    sourceUrl.value = "";
    results.hidden = true;
    currentCanonicalUrl = "";
    currentParsedUrl = null;
    currentGlovoParsed = null;
    currentYandexParsed = null;
    currentHub = null;
    setStatus("Ready", false);
    sourceUrl.focus();
  });
  resetStyleButton.addEventListener("click", resetStyle);
  if (addLocationButton) {
    addLocationButton.addEventListener("click", function () {
      try {
        pickupLocations.push(readLocationDraft());
        clearLocationDraft();
        renderLocations();
        refreshQr();
        setStatus("Pickup location added", false);
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  }
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener("click", function () {
      if (window.ProductHubStorage) window.ProductHubStorage.clearProductHubs();
      renderHistory();
      setStatus("History cleared", false);
    });
  }
  downloadQrButton.addEventListener("click", downloadQrCode);
  copyQrUrlButton.addEventListener("click", () => copyValue("socialShortUrl"));

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyValue(button.dataset.copyTarget));
  });

  sourceUrl.addEventListener("input", function () {
    if (sourceUrl.value.trim()) setStatus("Ready to build", false);
    else setStatus("Ready", false);
  });

  if (yandexUrl) {
    yandexUrl.addEventListener("input", function () {
      if (yandexUrl.value.trim()) setStatus("Yandex link ready", false);
    });
  }

  Object.values(brandControls).forEach((control) => {
    control.addEventListener("input", refreshQr);
  });

  window.addEventListener("load", function () {
    renderLocations();
    renderHistory();
    if (!results.hidden && socialShortUrl.value) {
      drawQrCode(socialShortUrl.value);
    }
  });
})();







