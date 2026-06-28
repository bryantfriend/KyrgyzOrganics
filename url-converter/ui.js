(function () {
  const body = document.body;
  const sourceUrl = document.getElementById("sourceUrl");
  const results = document.getElementById("results");
  const clearButton = document.getElementById("clearButton");
  const toast = document.querySelector(".mobile-toast");
  const openClasses = ["mobile-menu-open", "mobile-modal-brand", "mobile-modal-details"];
  let toastTimer = null;

  function closeSurfaces() {
    openClasses.forEach((className) => body.classList.remove(className));
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function openSurface(surface) {
    if (surface === "details" && results && results.hidden) {
      showToast("Convert a supported URL first to see details.");
      sourceUrl && sourceUrl.focus();
      return;
    }

    closeSurfaces();
    if (surface === "menu") body.classList.add("mobile-menu-open");
    if (surface === "brand") body.classList.add("mobile-modal-brand");
    if (surface === "details") body.classList.add("mobile-modal-details");
  }

  async function pasteFromClipboard() {
    if (!sourceUrl || !navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
      showToast("Clipboard paste is not available here.");
      sourceUrl && sourceUrl.focus();
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast("Clipboard is empty.");
        sourceUrl.focus();
        return;
      }
      sourceUrl.value = text.trim();
      sourceUrl.dispatchEvent(new Event("input", { bubbles: true }));
      sourceUrl.focus();
      showToast("URL pasted.");
    } catch (error) {
      showToast("Allow clipboard access, then try again.");
      sourceUrl.focus();
    }
  }

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => openSurface(button.dataset.openModal));
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeSurfaces);
  });

  document.querySelectorAll("[data-paste-url]").forEach((button) => {
    button.addEventListener("click", pasteFromClipboard);
  });

  document.querySelectorAll(".side-nav a").forEach((link) => {
    link.addEventListener("click", closeSurfaces);
  });

  clearButton && clearButton.addEventListener("click", closeSurfaces);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSurfaces();
  });
})();
