(function () {
  const HUBS_KEY = "product_link_hub_entries_v1";
  const EVENTS_KEY = "product_link_hub_events_v1";

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function listProductHubs() {
    return readJson(HUBS_KEY, []).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });
  }

  function getProductHub(idOrSlug) {
    const key = String(idOrSlug || "");
    return listProductHubs().find(function (hub) {
      return hub.id === key || hub.slug === key;
    }) || null;
  }

  function saveProductHub(hub) {
    const hubs = listProductHubs().filter(function (candidate) {
      return candidate.id !== hub.id && candidate.slug !== hub.slug;
    });
    hubs.unshift(hub);
    writeJson(HUBS_KEY, hubs.slice(0, 60));
    return hub;
  }

  function clearProductHubs() {
    writeJson(HUBS_KEY, []);
  }

  function recordClick(event) {
    const events = readJson(EVENTS_KEY, []);
    events.unshift(Object.assign({ createdAt: new Date().toISOString() }, event || {}));
    writeJson(EVENTS_KEY, events.slice(0, 300));
  }

  window.ProductHubStorage = {
    saveProductHub,
    getProductHub,
    listProductHubs,
    clearProductHubs,
    recordClick,
  };
})();
