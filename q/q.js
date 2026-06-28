(function () {
  const params = new URLSearchParams(window.location.search);
  const message = document.getElementById("message");
  const fallbackForm = document.getElementById("fallbackForm");

  function fail(text) {
    message.textContent = text;
    fallbackForm.hidden = true;
  }

  function requireValue(key, label) {
    const value = String(params.get(key) || "").trim();
    if (!value) throw new Error(`${label} is missing.`);
    return value;
  }

  function base36ToDecimal(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (!/^[0-9a-z]+$/.test(clean)) throw new Error("Invalid compact product code.");
    let result = 0n;
    for (const char of clean) {
      const code = char >= "0" && char <= "9"
        ? BigInt(char.charCodeAt(0) - 48)
        : BigInt(char.charCodeAt(0) - 87);
      if (code < 0n || code >= 36n) throw new Error("Invalid compact product code.");
      result = result * 36n + code;
    }
    return result.toString(10);
  }

  function sanitizeSlug(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,120}$/.test(clean)) throw new Error("Invalid store slug.");
    return clean;
  }

  function sanitizeYandexSlug(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,120}$/.test(clean)) throw new Error("Invalid Yandex Eats restaurant slug.");
    return clean;
  }

  function normalizeCompanyId(value) {
    const clean = String(value || "kyrgyz-organics")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return clean || "kyrgyz-organics";
  }

  function humanizeSlug(slug) {
    return slug
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function buildTargetUrl() {
    if (params.has("y")) {
      const storeSlug = sanitizeYandexSlug(requireValue("y", "Yandex Eats restaurant slug"));
      const route = params.get("yr") === "restaurant" ? "restaurant" : "r";
      const target = new URL(`https://eda.yandex.kg/${route}/${storeSlug}`);
      return {
        platform: "yandex-eats",
        target,
        storeSlug,
        productId: "",
        externalProductId: "",
      };
    }

    const storeSlug = sanitizeSlug(requireValue("s", "Store slug"));
    const content = requireValue("c", "Content path");
    const productId = base36ToDecimal(requireValue("p", "Product ID"));
    const externalProductId = base36ToDecimal(requireValue("e", "External product ID"));
    const target = new URL(`https://glovoapp.com/en/kg/bishkek/stores/${storeSlug}`);
    target.searchParams.set("content", content);
    target.searchParams.set("productId", productId);
    target.searchParams.set("externalProductId", externalProductId);
    return { platform: "glovo", target, storeSlug, productId, externalProductId };
  }

  function getOpenPageUrl() {
    const openPath = window.location.pathname.startsWith("/q/")
      ? "/url-converter/open.html"
      : "../open.html";
    return new URL(openPath, window.location.href);
  }

  function buildOpenUrl(built) {
    const companyId = normalizeCompanyId(params.get("cid"));
    const label = humanizeSlug(built.storeSlug);
    const code = built.platform === "yandex-eats" ? "Yandex Eats" : `SKU ${built.externalProductId}`;
    const linkId = `qr-${hashString(`${companyId}|${built.target.href}`)}`;
    const openUrl = getOpenPageUrl();

    openUrl.searchParams.set("u", built.target.href);
    openUrl.searchParams.set("lid", linkId);
    openUrl.searchParams.set("cid", companyId);
    openUrl.searchParams.set("platform", built.platform);
    openUrl.searchParams.set("brand", companyId);
    openUrl.searchParams.set("label", label);
    openUrl.searchParams.set("code", code);
    return openUrl;
  }

  function setFallback(openUrl) {
    fallbackForm.action = openUrl.origin + openUrl.pathname;
    openUrl.searchParams.forEach((value, key) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      fallbackForm.appendChild(input);
    });
    fallbackForm.hidden = false;
  }

  function start() {
    let built;
    try {
      built = buildTargetUrl();
    } catch (error) {
      fail(error.message || "This short link is invalid.");
      return;
    }

    const openUrl = buildOpenUrl(built);
    setFallback(openUrl);
    message.textContent = built.platform === "yandex-eats"
      ? "Opening the Yandex Eats restaurant through the OAKO landing page."
      : "Opening the exact Glovo web product through the OAKO landing page.";

    window.setTimeout(() => {
      window.location.replace(openUrl.href);
    }, 150);
  }

  start();
})();

