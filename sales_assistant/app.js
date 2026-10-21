import { repository, signIn, logout, observeSession } from "./repository.js";
import { isStaff, parseExtraction, newReview, extractionPrompt, followUpDraft, replyTranslationPrompt, isEnglishLanguage, BUYER_FIELDS, productName, customerName, normalized } from "./domain.mjs";
import { friendlyError } from "./repository-core.mjs";
import { saveEnquiry } from "./icf/workflow.js";
import * as view from "./view.mjs";
const $ = (selector) => document.querySelector(selector);
const content = $("#content");
let identity = null;
let epoch = 0;
let routeNumber = 0;
let draft = null;
let catalogs = { customers: [], products: [] };
let dirty = false;
let saving = false;
let currentHash = location.hash || "#dashboard";
let phase = 1;
let renderedPhase = 0;
function notice(message, error = false) {
  $("#notice").textContent = message;
  $("#notice").classList.toggle("error", error);
  $("#notice").hidden = !message;
}
function markDirty() {
  dirty = true;
}
function on(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
}
function renderError(error) {
  content.innerHTML = '<section class="card padded"><p class="eyebrow">WORKSPACE UNAVAILABLE</p><h1>Could not load this view</h1><p>' + view.escape(friendlyError(error)) + '</p><button id="retry-view" class="primary">Retry</button> <a href="#dashboard">Back to dashboard</a></section>';
  on("retry-view", "click", route);
}
function loading(label = "Loading workspace\u2026") {
  content.innerHTML = '<div class="loading" role="status"><span class="spinner"></span>' + view.escape(label) + "</div>";
}
async function copy(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    notice("Copied. Review the text before sending it manually.");
  } catch {
    const old = document.getElementById("copy-fallback");
    if (old) old.remove();
    const panel = document.createElement("section");
    panel.id = "copy-fallback";
    panel.className = "card padded copy-fallback";
    const heading = document.createElement("h2");
    heading.textContent = "Select and copy manually";
    const area = document.createElement("textarea");
    area.value = value;
    area.rows = 10;
    const close = document.createElement("button");
    close.textContent = "Close";
    close.onclick = () => {
      panel.remove();
      if (button) button.focus();
    };
    panel.append(heading, area, close);
    content.prepend(panel);
    area.focus();
    area.select();
    notice("Clipboard access was unavailable. Use the selected text to copy manually.");
  }
}
on("login-form", "submit", async (event) => {
  event.preventDefault();
  $("#login-button").disabled = true;
  $("#auth-status").textContent = "Signing in\u2026";
  try {
    await signIn($("#login-email").value.trim(), $("#login-password").value);
    $("#login-password").value = "";
  } catch {
    $("#auth-status").textContent = "Sign-in failed. Check your email, password, and connection.";
  } finally {
    $("#login-button").disabled = false;
  }
});
async function signOut() {
  if (saving) {
    notice("Wait for the current save to finish before signing out.");
    return;
  }
  if (dirty && !window.confirm("Discard your unsaved changes and sign out?")) return;
  try {
    await logout();
  } catch (error) {
    notice(friendlyError(error), true);
  }
}
on("logout", "click", signOut);
on("auth-signout", "click", signOut);
window.addEventListener("beforeunload", (event) => {
  if (dirty || saving) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("offline", () => notice("You are offline. Keep this tab open. Saves require a connection to Firebase.", true));
window.addEventListener("online", () => notice("Connection restored. Refresh records before saving if your session was interrupted."));
window.addEventListener("hashchange", () => {
  if ((dirty || saving) && location.hash !== currentHash) {
    if (saving || !window.confirm("Discard unsaved changes and leave this enquiry?")) {
      history.replaceState(null, "", currentHash);
      return;
    }
  }
  currentHash = location.hash || "#dashboard";
  dirty = false;
  draft = null;
  route();
});
observeSession((profile, error, pending) => {
  $("#login-button").disabled = pending;
  $("#login-button").textContent = pending ? "Checking session\u2026" : "Sign in";
  if (!isStaff(profile)) {
    identity = null;
    epoch += 1;
    routeNumber += 1;
    draft = null;
    catalogs = { customers: [], products: [] };
    dirty = false;
    saving = false;
    content.replaceChildren();
    $("#identity-label").textContent = "";
    $("#notice").textContent = "";
    $("#notice").hidden = true;
    $("#workspace").hidden = true;
    $("#auth-screen").hidden = false;
    $("#auth-signout").hidden = !profile && !error;
    $("#auth-status").textContent = pending ? "Verifying your staff profile with Firebase\u2026" : error ? friendlyError(error) : profile ? "This account does not have CRM staff access. Contact your administrator." : "Sign in with your existing OAKO CRM staff account.";
    return;
  }
  const changed = !identity || identity.uid !== profile.uid;
  identity = profile;
  $("#auth-screen").hidden = true;
  $("#workspace").hidden = false;
  $("#identity-label").textContent = profile.displayName || profile.email || "Staff";
  if (changed) {
    epoch += 1;
    route();
  }
});
async function route() {
  if (!identity) return;
  const ticket = ++routeNumber;
  const session = epoch;
  notice("");
  loading();
  const hash = location.hash || "#dashboard";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const selected = hash === "#" + link.dataset.nav;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  try {
    if (hash === "#new") {
      const loaded = await repository.catalogs();
      if (ticket !== routeNumber || session !== epoch) return;
      catalogs = loaded;
      draft = { originalMessage: "", rawJson: "", review: null };
      phase = 1;
      renderedPhase = 0;
      renderWizard();
    } else if (hash.startsWith("#enquiry/")) {
      const id = hash.slice("#enquiry/".length);
      const [record, activity, loaded] = await Promise.all([repository.get(id), repository.activity(id), repository.catalogs()]);
      if (ticket !== routeNumber || session !== epoch) return;
      catalogs = loaded;
      draft = structuredClone(record);
      renderDetail(record, activity);
    } else if (hash === "#dashboard" || hash === "#follow-ups" || hash === "") {
      const records = await repository.list();
      if (ticket !== routeNumber || session !== epoch) return;
      renderDashboard(records, hash === "#follow-ups");
    } else {
      content.innerHTML = '<section class="card padded"><h1>View not found</h1><a href="#dashboard">Back to dashboard</a></section>';
    }
    if (ticket === routeNumber && session === epoch) {
      content.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  } catch (error) {
    if (ticket === routeNumber && session === epoch) renderError(error);
  }
}
function renderDashboard(records, followUps) {
  content.innerHTML = view.dashboard(records, followUps);
  function update() {
    $("#dashboard-list").innerHTML = view.dashboardRows(records, { search: $("#search").value, status: $("#filter-status").value, followUp: $("#filter-followup").value });
  }
  on("search", "input", update);
  on("filter-status", "change", update);
  on("filter-followup", "change", update);
  on("reload", "click", route);
  update();
}
function renderWizard() {
  const phaseChanged = renderedPhase !== phase;
  renderedPhase = phase;
  content.innerHTML = '<div class="page-heading"><div><p class="eyebrow">' + (draft.id ? "EDIT ENQUIRY" : "MANUAL WHATSAPP INTAKE") + "</p><h1>" + (phase === 1 ? "New enquiry" : phase === 2 ? "Review extraction" : "Confirm matches") + "</h1><p>" + (draft.id ? "Original source stays intact. Your review and links can be updated." : "From customer message to a reviewed B2B enquiry.") + "</p></div></div>" + view.stepper(phase) + (phase === 1 ? view.intake(draft) : phase === 2 ? view.reviewForm(draft) : view.matching(draft, catalogs));
  if (phase === 1) bindIntake();
  if (phase === 2) bindReview();
  if (phase === 3) bindMatching();
  content.focus({ preventScroll: true });
  if (phaseChanged) window.scrollTo(0, 0);
}
function bindIntake() {
  function updatePrompt() {
    $("#prompt-preview").textContent = extractionPrompt(draft.originalMessage);
  }
  on("original-message", "input", (event) => {
    draft.originalMessage = event.target.value;
    markDirty();
    updatePrompt();
  });
  on("raw-json", "input", (event) => {
    draft.rawJson = event.target.value;
    markDirty();
  });
  on("copy-prompt", "click", (event) => {
    if (!draft.originalMessage.trim()) return notice("Paste the original WhatsApp message first.", true);
    copy(extractionPrompt(draft.originalMessage), event.target);
  });
  on("validate-json", "click", () => {
    const parsed = parseExtraction(draft.rawJson);
    const errors = [...draft.originalMessage.trim() ? [] : ["Paste the original message first."], ...parsed.errors];
    $("#json-errors").hidden = !errors.length;
    $("#json-errors").textContent = errors.join("\n");
    if (errors.length) return;
    draft.review = newReview(parsed.data);
    phase = 2;
    markDirty();
    renderWizard();
  });
  updatePrompt();
}
function bindTracking() {
  on("enquiry-status", "change", (event) => {
    draft.review.status = event.target.value;
    markDirty();
  });
  on("followup-date", "change", (event) => {
    draft.review.followUpDate = event.target.value;
    markDirty();
  });
  on("followup-note", "input", (event) => {
    draft.review.followUpNote = event.target.value;
    markDirty();
  });
}
function bindReview() {
  const review = draft.review;
  content.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("input", () => {
    const key = input.dataset.field;
    if (BUYER_FIELDS.includes(key)) {
      review.buyer[key] = input.value;
      review.customerId = "";
      review.customerConfirmed = false;
      review.createCustomer = false;
      review.newCustomerConfirmed = false;
    } else review[key] = input.value;
    review.confirmed[key] = false;
    const checkbox = content.querySelector('[data-confirm="' + key + '"]');
    checkbox.checked = false;
    checkbox.disabled = !input.value;
    checkbox.nextElementSibling.textContent = input.value ? "Suggested \xB7 confirm" : "Missing";
    markDirty();
    $("#review-issues").innerHTML = view.issueList(review);
  }));
  content.querySelectorAll("[data-confirm]").forEach((input) => input.addEventListener("change", () => {
    review.confirmed[input.dataset.confirm] = input.checked;
    input.nextElementSibling.textContent = input.checked ? "Confirmed" : "Suggested \xB7 confirm";
    markDirty();
  }));
  content.querySelectorAll("[data-product-field]").forEach((input) => input.addEventListener("input", () => {
    const item = review.products[Number(input.dataset.index)];
    const key = input.dataset.productField;
    item[key] = key === "quantity" ? input.value === "" ? null : Number(input.value) : input.value;
    item.productId = "";
    item.productConfirmed = false;
    item.detailsConfirmed = false;
    const confirmation = content.querySelector('[data-confirm-request="' + input.dataset.index + '"]');
    if (confirmation) confirmation.checked = false;
    markDirty();
    $("#review-issues").innerHTML = view.issueList(review);
  }));
  content.querySelectorAll("[data-confirm-request]").forEach((input) => input.addEventListener("change", () => {
    review.products[Number(input.dataset.confirmRequest)].detailsConfirmed = input.checked;
    markDirty();
  }));
  on("back-intake", "click", () => {
    phase = 1;
    renderWizard();
  });
  on("add-product", "click", () => {
    if (review.products.length >= 30) return notice("An enquiry can contain at most 30 requested products.", true);
    review.products.push({ requestedName: "", quantity: null, unit: "", ambiguities: [] });
    markDirty();
    renderWizard();
  });
  content.querySelectorAll("[data-remove-product]").forEach((button) => button.addEventListener("click", () => {
    const removed = Number(button.dataset.removeProduct);
    review.products.splice(removed, 1);
    review.resolvedAmbiguities = review.resolvedAmbiguities.filter((id) => !id.startsWith("product-"));
    markDirty();
    renderWizard();
  }));
  content.querySelectorAll("[data-ambiguity]").forEach((input) => input.addEventListener("change", () => {
    review.resolvedAmbiguities = review.resolvedAmbiguities.filter((id) => id !== input.dataset.ambiguity);
    if (input.checked) review.resolvedAmbiguities.push(input.dataset.ambiguity);
    markDirty();
    $("#review-issues").innerHTML = view.issueList(review);
  }));
  bindTracking();
  on("continue-match", "click", () => {
    phase = 3;
    renderWizard();
  });
  on("save-incomplete", "click", save);
}
function bindMatching() {
  const review = draft.review;
  function link(id) {
    review.customerId = id;
    review.customerConfirmed = true;
    review.createCustomer = false;
    review.newCustomerConfirmed = false;
    markDirty();
    renderWizard();
  }
  content.querySelectorAll("[data-link-customer]").forEach((button) => button.addEventListener("click", () => link(button.dataset.linkCustomer)));
  on("clear-customer", "click", () => {
    review.customerId = "";
    review.customerConfirmed = false;
    markDirty();
    renderWizard();
  });
  on("customer-search", "input", (event) => {
    const query = normalized(event.target.value);
    const results = query ? catalogs.customers.filter((customer) => normalized([customer.companyName, customer.name, customer.phone, customer.email].join(" ")).includes(query)).slice(0, 12) : [];
    $("#customer-results").innerHTML = results.map((customer) => '<div class="search-result"><span><b>' + view.escape(customerName(customer)) + "</b><small>" + view.escape(customer.phone || customer.email || "") + '</small></span><button class="secondary" data-search-link="' + view.escape(customer.id) + '">Confirm link</button></div>').join("") || (query ? '<p class="hint">No matching active CRM customer.</p>' : "");
    content.querySelectorAll("[data-search-link]").forEach((button) => button.addEventListener("click", () => link(button.dataset.searchLink)));
  });
  on("customer-pin", "input", (event) => {
    review.pinCode = event.target.value;
    markDirty();
  });
  on("customer-category", "change", (event) => {
    review.category = event.target.value;
    markDirty();
  });
  on("create-customer", "change", (event) => {
    review.createCustomer = event.target.checked;
    review.newCustomerConfirmed = event.target.checked;
    if (event.target.checked) {
      review.customerId = "";
      review.customerConfirmed = false;
    }
    markDirty();
  });
  content.querySelectorAll("[data-product-select]").forEach((select) => select.addEventListener("change", () => {
    const item = review.products[Number(select.dataset.productSelect)];
    item.productId = select.value;
    item.productConfirmed = false;
    markDirty();
    const button = content.querySelector('[data-confirm-product="' + select.dataset.productSelect + '"]');
    button.textContent = "Confirm catalog link";
    button.className = "secondary";
  }));
  content.querySelectorAll("[data-confirm-product]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.confirmProduct);
    const item = review.products[index];
    if (!item.productId) return notice("Choose a catalog product before confirming its link. You may leave unknown products unmatched.", true);
    item.productConfirmed = true;
    markDirty();
    button.textContent = "\u2713 Catalog link confirmed";
    button.className = "confirmed-button";
  }));
  on("refresh-matches", "click", async (event) => {
    const ticket = routeNumber;
    const session = epoch;
    event.target.disabled = true;
    try {
      const loaded = await repository.catalogs();
      if (ticket !== routeNumber || session !== epoch) return;
      catalogs = loaded;
      renderWizard();
      notice("CRM and catalog records refreshed.");
    } catch (error) {
      if (session === epoch) notice(friendlyError(error), true);
    } finally {
      event.target.disabled = false;
    }
  });
  on("back-review", "click", () => {
    phase = 2;
    renderWizard();
  });
  on("save-enquiry", "click", save);
}
function renderDetail(record, activity) {
  content.innerHTML = view.detail(record, activity, catalogs);
  bindTracking();
  $("#reply-draft").value = followUpDraft(draft.review);
  function resetTranslation() {
    const english = isEnglishLanguage(draft.review.replyLanguage);
    $("#reply-translated").value = english ? $("#reply-draft").value : '';
    $("#reply-reviewed").checked = false;
    $("#copy-reply-prompt").hidden = english;
  }
  resetTranslation();
  on('reply-draft', 'input', resetTranslation);
  on('reply-translated', 'input', () => { $('#reply-reviewed').checked = false; });
  on('reply-language', 'input', event => {
    draft.review.replyLanguage = event.target.value.trim();
    draft.review.confirmed.replyLanguage = false;
    markDirty(); resetTranslation();
  });
  on('copy-reply-prompt', 'click', event => {
    const prompt = replyTranslationPrompt(draft.review, $('#reply-draft').value, draft.originalMessage);
    if (!prompt) return notice('Confirm the customer reply language first. Do not assume English.', true);
    if (!$('#reply-draft').value.trim()) return notice('Write an English draft before translating.', true);
    copy(prompt, event.target);
  });
  on("copy-reply", "click", event => {
    if (!draft.review.replyLanguage || !$('#reply-translated').value.trim() || !$('#reply-reviewed').checked) {
      return notice('Select the customer language, supply a reply in that language, and confirm your review before copying.', true);
    }
    copy($("#reply-translated").value, event.target);
  });
  on("save-followup", "click", save);
  on("edit-enquiry", "click", () => {
    phase = 2;
    renderWizard();
  });
}
async function save() {
  if (saving || !identity || !draft) return;
  const session = epoch;
  saving = true;
  content.querySelectorAll("button, input, select, textarea").forEach((element) => {
    element.disabled = true;
  });
  content.setAttribute("aria-busy", "true");
  notice("Saving to Firebase. Keep this tab open\u2026");
  try {
    const result = await saveEnquiry({ actor: { id: identity.uid, role: identity.role }, payload: structuredClone(draft), repository });
    if (session !== epoch) return;
    if (!result.ok) {
      notice((result.errors || ["The enquiry could not be saved."]).join("\n"), true);
      return;
    }
    const saved = result.data;
    dirty = false;
    draft = null;
    const hash = "#enquiry/" + saved.id;
    currentHash = hash;
    history.replaceState(null, "", hash);
    await route();
    notice("Enquiry saved to Firebase.");
  } catch (error) {
    if (session === epoch) notice(friendlyError(error), true);
  } finally {
    saving = false;
    content.removeAttribute("aria-busy");
    if (session === epoch) {
      content.querySelectorAll("button, input, select, textarea").forEach((element) => {
        element.disabled = false;
      });
      content.querySelectorAll("[data-confirm]").forEach((element) => {
        const key = element.dataset.confirm;
        element.disabled = !(BUYER_FIELDS.includes(key) ? draft.review.buyer[key] : draft.review[key]);
      });
    }
  }
}
