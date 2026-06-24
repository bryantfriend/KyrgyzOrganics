(function () {
  const ANALYTICS = {
    projectId: "oa-kyrgyz-organic",
    apiKey: "AIzaSyB2azgMx3VRCqKTVj4zhdqv51o6w1cAtxI",
    collection: "campaign_events",
    actionType: "qr_click",
  };

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
      .split("-")
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

  function getSessionId() {
    try {
      const key = "qr_analytics_session_id";
      const existing = window.sessionStorage.getItem(key);
      if (existing) return existing;
      const next = `qr-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(key, next);
      return next;
    } catch (error) {
      return `qr-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function getBishkekDateId(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bishkek",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function getWeekStartId(dayId) {
    const parts = dayId.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - weekday + 1);
    return date.toISOString().slice(0, 10);
  }

  function firestoreString(value) {
    return { stringValue: String(value || "") };
  }

  function trackClick(payload) {
    const now = new Date();
    const dayId = getBishkekDateId(now);
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(ANALYTICS.projectId)}/databases/(default)/documents/${encodeURIComponent(ANALYTICS.collection)}?key=${encodeURIComponent(ANALYTICS.apiKey)}`;
    const body = JSON.stringify({
      fields: {
        companyId: firestoreString(payload.companyId),
        campaignId: firestoreString(payload.linkId),
        sessionId: firestoreString(getSessionId()),
        actionType: firestoreString(ANALYTICS.actionType),
        linkId: firestoreString(payload.linkId),
        brand: firestoreString(payload.brand),
        label: firestoreString(payload.label),
        code: firestoreString(payload.code),
        targetUrl: firestoreString(payload.targetUrl),
        targetHost: firestoreString("glovoapp.com"),
        productId: firestoreString(payload.productId),
        externalProductId: firestoreString(payload.externalProductId),
        landingPath: firestoreString(window.location.pathname),
        referrer: firestoreString(document.referrer),
        userAgent: firestoreString(navigator.userAgent),
        dayId: firestoreString(dayId),
        weekId: firestoreString(getWeekStartId(dayId)),
        monthId: firestoreString(dayId.slice(0, 7)),
        timestamp: { timestampValue: now.toISOString() },
        createdAt: { timestampValue: now.toISOString() },
      },
    });

    return fetch(endpoint, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => false);
  }

  function buildTargetUrl() {
    const storeSlug = sanitizeSlug(requireValue("s", "Store slug"));
    const content = requireValue("c", "Content path");
    const productId = base36ToDecimal(requireValue("p", "Product ID"));
    const externalProductId = base36ToDecimal(requireValue("e", "External product ID"));
    const target = new URL(`https://glovoapp.com/en/kg/bishkek/stores/${storeSlug}`);
    target.searchParams.set("content", content);
    target.searchParams.set("productId", productId);
    target.searchParams.set("externalProductId", externalProductId);
    return { target, storeSlug, productId, externalProductId };
  }

  function start() {
    let built;
    try {
      built = buildTargetUrl();
    } catch (error) {
      fail(error.message || "This short link is invalid.");
      return;
    }

    const companyId = normalizeCompanyId(params.get("cid"));
    const linkId = `qr-${hashString(`${companyId}|${built.target.href}`)}`;
    const label = humanizeSlug(built.storeSlug);
    const code = `SKU ${built.externalProductId}`;

    fallbackForm.action = built.target.origin + built.target.pathname;
    built.target.searchParams.forEach((value, key) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      fallbackForm.appendChild(input);
    });
    fallbackForm.hidden = false;

    message.textContent = "Opening the exact Glovo web product. Use the button if your browser blocks the automatic navigation.";

    Promise.race([
      trackClick({
        companyId,
        linkId,
        brand: companyId,
        label,
        code,
        targetUrl: built.target.href,
        productId: built.productId,
        externalProductId: built.externalProductId,
      }),
      new Promise((resolve) => window.setTimeout(resolve, 350)),
    ]).finally(() => {
      window.setTimeout(() => window.location.replace(built.target.href), 150);
    });
  }

  start();
})();
