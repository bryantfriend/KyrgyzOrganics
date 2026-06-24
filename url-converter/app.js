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

  function setStatus(message, isError) {
    statusText.textContent = message;
    statusCard.classList.toggle("error", Boolean(isError));
  }

  function parseGlovoUrl(rawValue) {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error("Paste a Glovo product URL first.");
    }

    let url;
    try {
      url = new URL(trimmed);
    } catch (error) {
      throw new Error("That does not look like a valid URL.");
    }

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
      url,
      canonical: canonicalizeGlovoUrl(url),
      storeSlug,
      productId,
      externalProductId,
      content: url.searchParams.get("content") || "",
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
    url.hostname = "glovoapp.com.";
    return url.href;
  }

  function buildLandingUrl(canonicalUrl, settings) {
    const openUrl = new URL("open.html", window.location.href);
    openUrl.searchParams.set("u", canonicalUrl);
    openUrl.searchParams.set("lid", buildLinkId(canonicalUrl, settings));
    openUrl.searchParams.set("cid", settings.companyId);
    openUrl.searchParams.set("brand", settings.brand);
    openUrl.searchParams.set("label", settings.product);
    openUrl.searchParams.set("code", settings.code);
    return openUrl.href;
  }

  function buildSocialShortUrl(parsed, settings) {
    const base = window.location.pathname.includes("/url-converter/") ? "../q/" : "q/";
    const shortUrl = new URL(base, window.location.href);
    shortUrl.searchParams.set("s", parsed.storeSlug);
    shortUrl.searchParams.set("c", parsed.content);
    shortUrl.searchParams.set("p", decimalToBase36(parsed.productId));
    shortUrl.searchParams.set("e", decimalToBase36(parsed.externalProductId));

    if (settings.companyId && settings.companyId !== defaultStyle.companyId) {
      shortUrl.searchParams.set("cid", settings.companyId);
    }

    return shortUrl.href;
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
    const productId = fields.productId.textContent !== "-" ? fields.productId.textContent : "";
    const externalProductId = fields.externalProductId.textContent !== "-" ? fields.externalProductId.textContent : "";
    const storeSlug = fields.storeSlug.textContent !== "-" ? fields.storeSlug.textContent : "";
    const brand = getText("brandName", "Product QR");
    const product = getText("productName", storeSlug ? humanizeSlug(storeSlug) : "Glovo product");
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
      .split("-")
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
        errorCorrectionLevel: "H",
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
    drawFittedText(context, "Scan for product", width / 2, footerY, width * 0.76, width * 0.042, 900, textColor);

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
    if (!currentCanonicalUrl || !currentParsedUrl) return;
    const settings = getQrSettings();
    landingUrl.value = buildLandingUrl(currentCanonicalUrl, settings);
    socialShortUrl.value = buildSocialShortUrl(currentParsedUrl, settings);
    if (shortUrlStats) {
      shortUrlStats.textContent = `Short link length: ${socialShortUrl.value.length} characters.`;
    }
  }

  function downloadQrCode() {
    if (!socialShortUrl.value && !landingUrl.value) return;

    const settings = getQrSettings();
    const productId = fields.productId.textContent && fields.productId.textContent !== "-"
      ? fields.productId.textContent
      : "glovo-product";
    const link = document.createElement("a");
    link.download = `${slugify(settings.brand)}-${slugify(settings.product)}-${productId}-qr.png`;
    link.href = qrCanvas.toDataURL("image/png");
    link.click();
    setStatus("QR downloaded", false);
  }

  function fillDefaultProductFields(parsed) {
    if (!brandControls.productCode.value.trim()) {
      brandControls.productCode.value = parsed.externalProductId ? `SKU ${parsed.externalProductId}` : "";
    }

    if (!brandControls.productName.value.trim() && parsed.storeSlug) {
      brandControls.productName.value = humanizeSlug(parsed.storeSlug);
    }
  }

  function convert() {
    try {
      const parsed = parseGlovoUrl(sourceUrl.value);
      currentCanonicalUrl = parsed.canonical;
      currentParsedUrl = parsed;
      trailingDotUrl.value = buildTrailingDotUrl(parsed.canonical);

      fields.storeSlug.textContent = parsed.storeSlug;
      fields.productId.textContent = parsed.productId;
      fields.externalProductId.textContent = parsed.externalProductId;
      fields.contentPath.textContent = parsed.content || "-";
      fillDefaultProductFields(parsed);
      refreshLandingUrl();

      results.hidden = false;
      drawQrCode(socialShortUrl.value || landingUrl.value);
      setStatus("Converted with analytics ID", false);
    } catch (error) {
      results.hidden = true;
      currentCanonicalUrl = "";
      currentParsedUrl = null;
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
    refreshLandingUrl();
    if (!results.hidden && landingUrl.value) {
      drawQrCode(socialShortUrl.value || landingUrl.value);
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
    setStatus("Ready", false);
    sourceUrl.focus();
  });
  resetStyleButton.addEventListener("click", resetStyle);
  downloadQrButton.addEventListener("click", downloadQrCode);
  copyQrUrlButton.addEventListener("click", () => copyValue("socialShortUrl"));

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyValue(button.dataset.copyTarget));
  });

  sourceUrl.addEventListener("input", () => {
    if (sourceUrl.value.trim()) setStatus("Ready to convert", false);
    else setStatus("Ready", false);
  });

  Object.values(brandControls).forEach((control) => {
    control.addEventListener("input", refreshQr);
  });

  window.addEventListener("load", () => {
    if (!results.hidden && landingUrl.value) {
      drawQrCode(socialShortUrl.value || landingUrl.value);
    }
  });
})();
