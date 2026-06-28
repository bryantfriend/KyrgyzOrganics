(function () {
  function getConfig() {
    return window.QR_ANALYTICS_CONFIG || {};
  }

  function compactPayload(payload) {
    const now = new Date();
    const dayId = getBishkekDateId(now);
    const linkId = sanitize(payload.linkId, 120) || "qr-unknown";
    return {
      actionType: sanitize(getConfig().actionType || "qr_click", 80),
      companyId: sanitize(payload.companyId || "kyrgyz-organics", 80),
      campaignId: linkId,
      sessionId: getSessionId(),
      linkId,
      brand: sanitize(payload.brand, 120),
      label: sanitize(payload.label, 160),
      code: sanitize(payload.code, 120),
      platform: sanitize(payload.platform, 80),
      targetUrl: sanitize(payload.targetUrl, 1200),
      targetHost: getTargetHost(payload.targetUrl),
      productId: sanitize(payload.productId, 120),
      externalProductId: sanitize(payload.externalProductId, 120),
      landingPath: sanitize(payload.landingPath || window.location.pathname, 200),
      referrer: sanitize(document.referrer, 300),
      userAgent: sanitize(navigator.userAgent, 300),
      dayId,
      weekId: getWeekStartId(dayId),
      monthId: dayId.slice(0, 7),
      timestamp: now.toISOString(),
    };
  }

  function sanitize(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function getTargetHost(value) {
    try {
      return sanitize(new URL(value).hostname.replace(/\.$/, "").toLowerCase(), 120);
    } catch (error) {
      return "";
    }
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

  function toFirestoreDocument(payload) {
    return {
      fields: {
        companyId: firestoreString(payload.companyId),
        campaignId: firestoreString(payload.campaignId),
        sessionId: firestoreString(payload.sessionId),
        actionType: firestoreString(payload.actionType),
        linkId: firestoreString(payload.linkId),
        brand: firestoreString(payload.brand),
        label: firestoreString(payload.label),
        code: firestoreString(payload.code),
        platform: firestoreString(payload.platform),
        targetUrl: firestoreString(payload.targetUrl),
        targetHost: firestoreString(payload.targetHost),
        productId: firestoreString(payload.productId),
        externalProductId: firestoreString(payload.externalProductId),
        landingPath: firestoreString(payload.landingPath),
        referrer: firestoreString(payload.referrer),
        userAgent: firestoreString(payload.userAgent),
        dayId: firestoreString(payload.dayId),
        weekId: firestoreString(payload.weekId),
        monthId: firestoreString(payload.monthId),
        timestamp: { timestampValue: payload.timestamp },
        createdAt: { timestampValue: payload.timestamp },
      },
    };
  }

  function getFirestoreEndpoint(config) {
    const projectId = sanitize(config.projectId, 120);
    const apiKey = sanitize(config.apiKey, 160);
    const collection = sanitize(config.collection || "campaign_events", 120);
    if (!projectId || !apiKey || !collection) return "";
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}?key=${encodeURIComponent(apiKey)}`;
  }

  function trackClick(payload) {
    const endpoint = getFirestoreEndpoint(getConfig());
    if (!endpoint) {
      return Promise.resolve(false);
    }

    const body = JSON.stringify(toFirestoreDocument(compactPayload(payload || {})));
    return fetch(endpoint, {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).then((response) => response.ok).catch(() => false);
  }

  window.QRAnalytics = { trackClick };
})();
