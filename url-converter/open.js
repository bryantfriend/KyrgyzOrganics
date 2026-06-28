(function () {
  const params = new URLSearchParams(window.location.search);
  const encodedTarget = params.get("u");
  const message = document.getElementById("message");
  const fallbackForm = document.getElementById("fallbackForm");

  function fail(text) {
    message.textContent = text;
    fallbackForm.hidden = true;
  }

  if (!encodedTarget) {
    fail("No target URL was provided.");
    return;
  }

  let target;
  try {
    target = new URL(encodedTarget);
  } catch (error) {
    fail("The target URL is invalid.");
    return;
  }

  const normalizedHost = target.hostname.replace(/\.$/, "").toLowerCase();
  function isAllowedHost(host) {
    return host === "glovoapp.com" || host === "www.glovoapp.com" || host === "ya.cc" || /(^|\.)yandex\.[a-z.]+$/i.test(host) || /(^|\.)yandexgo\.[a-z.]+$/i.test(host);
  }

  if ((target.protocol !== "https:" && target.protocol !== "http:") || !isAllowedHost(normalizedHost)) {
    fail("Only Glovo and Yandex destination URLs are allowed.");
    return;
  }

  fallbackForm.action = target.origin + target.pathname;
  target.searchParams.forEach((value, key) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    fallbackForm.appendChild(input);
  });

  function trackClick() {
    if (!window.QRAnalytics || typeof window.QRAnalytics.trackClick !== "function") {
      return Promise.resolve(false);
    }

    return window.QRAnalytics.trackClick({
      linkId: params.get("lid") || "",
      companyId: params.get("cid") || "kyrgyz-organics",
      brand: params.get("brand") || "",
      label: params.get("label") || "",
      code: params.get("code") || "",
      platform: params.get("platform") || (normalizedHost === "eda.yandex.kg" ? "yandex-eats" : "glovo"),
      targetUrl: target.href,
      productId: target.searchParams.get("productId") || "",
      externalProductId: target.searchParams.get("externalProductId") || "",
      landingPath: window.location.pathname,
    });
  }

  function redirectSoon() {
    window.location.replace(target.href);
  }

  message.textContent = normalizedHost === "eda.yandex.kg"
    ? "Opening the Yandex Eats restaurant. Use the button if your browser blocks the automatic navigation."
    : "Opening the exact Glovo web product. Use the button if your browser blocks the automatic navigation.";

  Promise.race([
    trackClick(),
    new Promise((resolve) => window.setTimeout(resolve, 350)),
  ]).finally(() => {
    window.setTimeout(redirectSoon, 150);
  });
})();

