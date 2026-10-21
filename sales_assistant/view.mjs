// Escape all external values before composing screen markup.
import { STATUSES, FIELD_LABELS, customerName, productName, missingDetails, ambiguities, matchCustomers, matchProducts, today, isOpen } from "./domain.mjs";
function escape(value) {
  return String(value === void 0 || value === null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
function pill(status) {
  return '<span class="pill ' + (status === "Needs clarification" ? "amber" : status === "Closed lost" ? "gray" : "green") + '">' + escape(status) + "</span>";
}
function statusOptions(selected) {
  return STATUSES.map((status) => "<option" + (selected === status ? " selected" : "") + ">" + escape(status) + "</option>").join("");
}
function dateLabel(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bishkek", day: "numeric", month: "short", year: "numeric" }).format(/* @__PURE__ */ new Date(value + "T12:00:00+06:00"));
}
function timestamp(value) {
  if (!value || !value.toDate) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bishkek", dateStyle: "medium", timeStyle: "short" }).format(value.toDate());
}
function issueList(review) {
  const missing = missingDetails(review);
  return missing.length ? '<div class="issue-box"><strong>'
    + missing.length
    + " details need clarification</strong><p>An incomplete enquiry can be saved. Nothing missing will be guessed.</p><ul>"
    + missing.map((item) => "<li>"
    + escape(item)
    + "</li>").join("")
    + "</ul></div>" : '<div class="success-box">Required enquiry details and catalog links are present. Check field confirmations before relying on them.</div>';
}
function dashboardRows(records, filters) {
  const query = filters.search.trim().toLowerCase();
  const currentDate = today();
  const filtered = records.filter((record) => {
    const review = record.review;
    const searchable = [review.buyer.companyName, review.buyer.name, review.buyer.phone, review.buyer.email, ...review.products.map((item) => item.requestedName), record.id].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (!filters.status || review.status === filters.status) && (!filters.followUp || isOpen(review.status) && (filters.followUp === "unscheduled" ? !review.followUpDate : review.followUpDate && (filters.followUp === "today" ? review.followUpDate === currentDate : review.followUpDate <= currentDate)));
  });
  return '<div class="table-caption">'
    + filtered.length
    + " of "
    + records.length
    + " enquiries</div>"
    + (filtered.length ? '<div class="table-wrap"><table><thead><tr><th>Buyer / contact</th><th>Requested products</th><th>Status</th><th>Follow-up \xB7 Bishkek</th><th></th></tr></thead><tbody>'
    + filtered.map((record) => {
    const review = record.review;
    return '<tr><td><a class="row-link" href="#enquiry/'
    + escape(record.id)
    + '">'
    + escape(review.buyer.companyName || "Business not specified")
    + "</a><small>"
    + escape([review.buyer.name, review.buyer.phone || review.buyer.email].filter(Boolean).join(" \xB7 "))
    + "</small></td><td>"
    + escape(review.products.map((item) => item.requestedName || "Unspecified product").join(", ") || "Not specified")
    + "</td><td>"
    + pill(review.status)
    + '</td><td class="'
    + (review.followUpDate && review.followUpDate <= currentDate && isOpen(review.status) ? "due" : "")
    + '">'
    + escape(dateLabel(review.followUpDate))
    + '</td><td><a class="text-link" href="#enquiry/'
    + escape(record.id)
    + '">Open \u2192</a></td></tr>';
  }).join("")
    + "</tbody></table></div>" : '<div class="empty"><span class="empty-symbol">\u25CE</span><h2>'
    + (records.length ? "No matching enquiries" : "Your next conversation starts here")
    + "</h2><p>"
    + (records.length ? "Try another search or filter." : "Paste a WhatsApp message and turn it into a reviewed B2B enquiry.")
    + '</p><a class="button primary" href="#new">+ New enquiry</a></div>');
}
function dashboard(records, followUps) {
  const open = records.filter((record) => isOpen(record.review.status));
  const due = open.filter((record) => record.review.followUpDate && record.review.followUpDate <= today());
  return '<div class="page-heading"><div><p class="eyebrow">SHARED SALES WORKSPACE</p><h1>'
    + (followUps ? "Follow-ups" : "Enquiries")
    + '</h1><p>Every conversation, with a clear next step.</p></div><div class="actions"><button id="reload" class="secondary">\u21BB Refresh</button><a class="button primary" href="#new">+ New enquiry</a></div></div><div class="stats"><div><span>Open enquiries</span><strong>'
    + open.length
    + '</strong></div><div class="stat-amber"><span>Needs clarification</span><strong>'
    + records.filter((record) => record.review.status === "Needs clarification").length
    + '</strong></div><div class="stat-red"><span>Due & overdue</span><strong>'
    + due.length
    + '</strong></div></div><section class="card"><div class="filters"><label class="search-label">Search<input id="search" type="search" placeholder="Buyers, contacts, products or enquiry ID\u2026"></label><label>Status<select id="filter-status"><option value="">All statuses</option>'
    + statusOptions("")
    + '</select></label><label>Follow-up<select id="filter-followup"><option value="">All follow-ups</option><option value="due"'
    + (followUps ? " selected" : "")
    + '>Due & overdue</option><option value="today">Today</option><option value="unscheduled">Not scheduled</option></select></label></div><div id="dashboard-list"></div></section><p class="muted">All enquiries are shared with authorized CRM staff. Refresh to see recent changes from colleagues.</p>';
}
function stepper(phase) {
  return '<ol class="stepper">' + ["Message & JSON", "Review details", "Confirm matches"].map((label, index) => '<li class="' + (index + 1 === phase ? "current" : index + 1 < phase ? "complete" : "") + '"><span>' + (index + 1) + "</span>" + label + "</li>").join("") + "</ol>";
}
function intake(draft) {
  return '<div class="two-columns"><section class="card padded"><div class="section-heading"><h2>Original WhatsApp message</h2><span class="tag">Manual intake</span></div><p>Copy the customer\u2019s message exactly, including any relevant conversation context.</p><label>Customer message<textarea id="original-message" dir="auto" maxlength="20000" rows="16" placeholder="Paste the incoming WhatsApp message here\u2026">'
    + escape(draft.originalMessage)
    + '</textarea></label><p class="hint">The original message is preserved after saving. It is never replaced by extracted data.</p></section><section class="card padded"><h2>Manual ChatGPT extraction</h2><div class="instruction-box"><ol><li>Copy the extraction prompt with the message.</li><li>Paste it into ChatGPT and copy its JSON response.</li><li>Paste the response below, then validate.</li></ol><button id="copy-prompt" class="secondary">\u25A3 Copy extraction prompt</button><details><summary>Preview extraction prompt</summary><pre id="prompt-preview"></pre></details></div><label>ChatGPT JSON response<textarea id="raw-json" class="code" maxlength="50000" rows="11" spellcheck="false" placeholder="Paste only the JSON object\u2026">'
    + escape(draft.rawJson)
    + '</textarea></label><div id="json-errors" class="error-box" role="alert" hidden></div><button id="validate-json" class="primary">Validate JSON & review \u2192</button></section></div>';
}
function field(review, key, value) {
  const date = key === "firstDeliveryDate";
  const limit = key === 'messageEnglish' ? 20000 : key === 'notes' ? 2000 : key === 'sourceLanguage' || key === 'replyLanguage' ? 80 : 500;
  const control = key === 'messageEnglish' || key === 'notes'
    ? `<textarea data-field="${key}" maxlength="${limit}" rows="${key === 'messageEnglish' ? 6 : 2}" placeholder="Not specified">${escape(value)}</textarea>`
    : `<input data-field="${key}" type="${date ? 'date' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}" maxlength="${limit}" value="${escape(value)}" placeholder="Not specified">`;
  return '<div class="review-field' + (key === 'messageEnglish' ? ' wide-field' : '') + '"><label>'
    + FIELD_LABELS[key]
    + control
    + '</label><label class="check"><input type="checkbox" data-confirm="'
    + key
    + '"'
    + (review.confirmed[key] ? " checked" : "")
    + (!value ? " disabled" : "")
    + "><span>"
    + (review.confirmed[key] ? "Confirmed" : value ? "Suggested \xB7 confirm" : "Missing")
    + "</span></label></div>";
}
function reviewForm(draft) {
  const review = draft.review;
  return '<div class="review-layout"><aside><section class="card padded source-card"><h2>Original message</h2><p class="source-text" dir="auto">'
    + escape(draft.originalMessage)
    + '</p><span class="tag">Source preserved</span>'
    + (!draft.id ? '<button id="back-intake" class="text-button">\u2190 Message & JSON</button>' : "")
    + "<details><summary>Original JSON</summary><pre>"
    + escape(draft.rawJson)
    + '</pre></details></section><div id="review-issues">'
    + issueList(review)
    + '</div></aside><section class="card padded"><div class="section-heading"><h2>Extracted details</h2><span class="tag">Review and correct</span></div><p class="hint">A suggestion becomes confirmed only when you check it. Editing a confirmed field clears its confirmation.</p><div class="field-grid">'
    + Object.keys(FIELD_LABELS).map((key) => field(review, key, key in review.buyer ? review.buyer[key] : review[key])).join("")
    + '</div><hr><div class="section-heading"><h2>Requested products</h2><button id="add-product" class="secondary">+ Add product</button></div><div id="product-editor">'
    + review.products.map((item, index) => '<div class="product-editor"><label>Requested product<input data-product-field="requestedName" data-index="'
    + index
    + '" value="'
    + escape(item.requestedName)
    + '" maxlength="500"></label><label>Quantity<input type="number" min="0.001" max="1000000" step="any" data-product-field="quantity" data-index="'
    + index
    + '" value="'
    + escape(item.quantity)
    + '" placeholder="Unknown"></label><label>Unit / pack size<input data-product-field="unit" data-index="'
    + index
    + '" value="'
    + escape(item.unit)
    + '" placeholder="e.g. 500 g bags" maxlength="500"></label><label class="check"><input type="checkbox" data-confirm-request="'
    + index
    + '"'
    + (item.detailsConfirmed ? " checked" : "")
    + '>Known request details confirmed</label><button class="text-button danger" data-remove-product="'
    + index
    + '" aria-label="Remove product '
    + (index
    + 1)
    + '">Remove</button></div>').join("")
    + "</div>"
    + (ambiguities(review).length ? '<h3>Ambiguities from extraction</h3><p class="hint">Resolve through staff review or customer clarification; leave unchecked if still uncertain.</p>'
    + ambiguities(review).map((item) => '<label class="check ambiguity"><input type="checkbox" data-ambiguity="'
    + escape(item.id)
    + '"'
    + (review.resolvedAmbiguities.includes(item.id) ? " checked" : "")
    + ">"
    + escape(item.message)
    + "</label>").join("") : "")
    + "<hr>"
    + trackingForm(review)
    + '<div class="form-actions"><button id="save-incomplete" class="secondary">Save incomplete enquiry</button><button id="continue-match" class="primary">Continue to matching \u2192</button></div></section></div>';
}
function trackingForm(review) {
  return '<div class="field-grid"><label>Status<select id="enquiry-status">'
    + statusOptions(review.status)
    + '</select></label><label>Next follow-up \xB7 Bishkek<input id="followup-date" type="date" value="'
    + escape(review.followUpDate)
    + '"></label></div><label>Follow-up note<textarea id="followup-note" rows="2" maxlength="2000" placeholder="What needs to happen next?">'
    + escape(review.followUpNote)
    + "</textarea></label>";
}
function matching(draft, catalogs) {
  const review = draft.review;
  const matches = matchCustomers(review.buyer, catalogs.customers);
  const selected = catalogs.customers.find((customer) => customer.id === review.customerId);
  return '<div class="two-columns"><section class="card padded"><div class="section-heading"><h2>Customer match</h2><button id="refresh-matches" class="text-button">\u21BB Refresh records</button></div><p>Review the CRM record before explicitly linking it. Existing customer details will not be overwritten.</p>'
    + (selected && review.customerConfirmed ? '<div class="success-box"><b>Confirmed customer link</b><p>'
    + escape(customerName(selected))
    + " \xB7 "
    + escape(selected.phone || selected.email || "")
    + '</p><button id="clear-customer" class="secondary">Remove link</button></div>' : "")
    + '<div class="match-list">'
    + (matches.length ? matches.slice(0, 8).map((match) => '<article class="match-card"><strong>'
    + escape(customerName(match.customer))
    + "</strong><p>"
    + escape([match.customer.name, match.customer.phone, match.customer.email, match.customer.address].filter(Boolean).join(" \xB7 "))
    + '</p><span class="tag">'
    + escape(match.reasons.join(" \xB7 "))
    + '</span><button class="secondary" data-link-customer="'
    + escape(match.customer.id)
    + '">Confirm customer link</button></article>').join("") : '<div class="empty compact">No suggested customer match. Search the CRM or save without a link.</div>')
    + '</div><label>Search all active CRM customers<input id="customer-search" type="search" placeholder="Business, name, phone or email"></label><div id="customer-results"></div><details class="new-customer"'
    + (review.createCustomer ? " open" : "")
    + '><summary>Create a new CRM customer</summary><p>Creates a contact in the invoice CRM. Review all populated buyer fields and check their confirmations first.</p><label>CRM category<select id="customer-category">'
    + ["C", "B", "A"].map((category) => "<option"
    + (review.category === category ? " selected" : "")
    + ">"
    + category
    + "</option>").join("")
    + '</select></label><label>Company PIN \xB7 existing CRM format<input id="customer-pin" inputmode="numeric" maxlength="6" pattern="1[0-9]{5}" value="'
    + escape(review.pinCode)
    + '" placeholder="Six digits starting with 1"></label><label class="check"><input id="create-customer" type="checkbox"'
    + (review.createCustomer ? " checked" : "")
    + '>I reviewed the CRM and explicitly confirm creation of a new customer.</label><p class="hint">If a duplicate is found at save time, creation is blocked.</p></details></section><section class="card padded"><h2>Product matching</h2><p>Suggestions use existing OAKO catalog records. Confirm each exact product and variant.</p>'
    + (review.products.length ? review.products.map((item, index) => {
    const suggestions = matchProducts(item.requestedName, catalogs.products);
    const ordered = [...suggestions.map((match) => match.product), ...catalogs.products.filter((product) => !suggestions.some((match) => match.product.id === product.id))];
    return '<article class="product-match"><h3>'
    + escape(item.requestedName || "Unspecified product")
    + "</h3><p>"
    + escape(item.quantity || "Quantity unknown")
    + " \xB7 "
    + escape(item.unit || "Unit unknown")
    + '</p><label>Catalog product<select data-product-select="'
    + index
    + '"><option value="">Keep unmatched</option>'
    + ordered.map((product) => '<option value="'
    + escape(product.id)
    + '"'
    + (item.productId === product.id ? " selected" : "")
    + ">"
    + escape(productName(product)
    + (product.weight ? " \xB7 "
    + product.weight : ""))
    + "</option>").join("")
    + "</select></label>"
    + (suggestions.length > 1 ? '<p class="hint amber-text">Several possible matches. Check the exact variant.</p>' : "")
    + '<button data-confirm-product="'
    + index
    + '" class="'
    + (item.productConfirmed ? "confirmed-button" : "secondary")
    + '">'
    + (item.productConfirmed ? "\u2713 Catalog link confirmed" : "Confirm catalog link")
    + "</button></article>";
  }).join("") : '<div class="empty compact">No requested products yet. You can save and clarify later.</div>')
    + '<div class="instruction-box">No records are linked or created until you confirm and save the enquiry.</div><div class="form-actions"><button id="back-review" class="secondary">\u2190 Review details</button><button id="save-enquiry" class="primary">Save enquiry</button></div></section></div>';
}
function detail(record, activity, catalogs) {
  const review = record.review;
  const customer = catalogs.customers.find((item) => item.id === review.customerId);
  return '<div class="page-heading"><div><a class="text-link" href="#dashboard">\u2190 All enquiries</a><p class="eyebrow">ENQUIRY \xB7 '
    + escape(record.id.slice(0, 8).toUpperCase())
    + "</p><h1>"
    + escape(review.buyer.companyName || "Business not specified")
    + "</h1><p>Updated "
    + escape(timestamp(record.updatedAt))
    + " \xB7 Revision "
    + record.revision
    + '</p></div><div class="actions">'
    + pill(review.status)
    + '<button id="edit-enquiry" class="secondary">Edit details & matches</button></div></div><div class="detail-layout"><div><section class="card padded"><h2>Reviewed buyer details</h2><dl class="details-grid">'
    + Object.keys(FIELD_LABELS).map((key) => "<div><dt>"
    + FIELD_LABELS[key]
    + "</dt><dd>"
    + escape((key in review.buyer ? review.buyer[key] : review[key]) || "Not specified")
    + ' <span class="tag '
    + (review.confirmed[key] ? "confirmed-tag" : "")
    + '">'
    + (review.confirmed[key] ? "Confirmed" : (key in review.buyer ? review.buyer[key] : review[key]) ? "Suggested" : "Missing")
    + "</span></dd></div>").join("")
    + '</dl><div class="instruction-box"><b>CRM link:</b> '
    + escape(review.customerId ? customer ? customerName(customer)
    + " \xB7 confirmed" : "Linked record unavailable / archived" : "Not linked")
    + "</div><h3>Requested products</h3>"
    + (review.products.length ? review.products.map((item) => '<div class="product-summary"><b>'
    + escape(item.requestedName || "Unspecified product")
    + "</b><span>"
    + escape(item.quantity || "?")
    + " "
    + escape(item.unit || "unit unknown")
    + '</span><span class="tag '
    + (item.detailsConfirmed ? "confirmed-tag" : "")
    + '">'
    + (item.detailsConfirmed ? "Request confirmed" : "Request suggested")
    + '</span><span class="tag '
    + (item.productConfirmed ? "confirmed-tag" : "")
    + '">'
    + (item.productConfirmed ? "Catalog link confirmed" : "Unmatched")
    + "</span></div>").join("") : "<p>Not specified</p>")
    + '</section><section class="card padded"><h2>Original WhatsApp message</h2><p class="source-text" dir="auto">'
    + escape(record.originalMessage)
    + '</p><span class="tag">Source preserved \xB7 immutable</span><details><summary>Original JSON extraction</summary><pre>'
    + escape(record.rawJson)
    + '</pre></details></section><section class="card padded"><h2>Activity timeline</h2><ol class="timeline">'
    + activity.map((item) => "<li><strong>"
    + escape(item.action)
    + "</strong><small>"
    + escape(timestamp(item.createdAt))
    + " \xB7 "
    + escape(item.actorId)
    + "</small><span>"
    + escape(item.status)
    + (item.customerCreated ? " \xB7 CRM customer created" : item.customerId ? " \xB7 Customer linked" : "")
    + "</span></li>").join("")
    + '</ol></section></div><aside><section class="card padded"><h2>Next follow-up</h2>'
    + trackingForm(review)
    + '<button id="save-followup" class="primary full">Save status, language & follow-up</button></section>'
    + replyPanel(review)
    + issueList(review)
    + "</aside></div>";
}
function replyPanel(review) {
  return `<section class="card padded">
    <div class="section-heading"><h2>Draft questions</h2><span class="tag">Manual translation</span></div>
    <label>English working draft<textarea id="reply-draft" rows="9" maxlength="20000"></textarea></label>
    <label>Customer reply language<input id="reply-language" maxlength="80" value="${escape(review.replyLanguage || '')}" placeholder="e.g. Russian, Urdu (Latin script)"></label>
    <p class="hint">Source language: ${escape(review.sourceLanguage || 'Not recorded')}. Confirm the customer’s preferred language and script. Records stay in English.</p>
    <button id="copy-reply-prompt" class="secondary full">Copy ChatGPT translation prompt</button>
    <label>Customer-language reply<textarea id="reply-translated" dir="auto" rows="9" maxlength="20000" placeholder="Paste ChatGPT’s translated reply, then review it…"></textarea></label>
    <label class="check"><input id="reply-reviewed" type="checkbox">I reviewed this reply in the selected customer language.</label>
    <button id="copy-reply" class="primary full">▣ Copy for WhatsApp</button>
    <p class="hint">For non-English replies, copy the translation prompt to ChatGPT and paste its result here. Changing the English draft or language clears the previous translation. Drafts are not saved; language changes save with the enquiry. Copying does not mark a follow-up complete.</p>
  </section>`;
}
export {
  dashboard,
  dashboardRows,
  dateLabel,
  detail,
  escape,
  intake,
  issueList,
  matching,
  pill,
  reviewForm,
  statusOptions,
  stepper,
  timestamp,
  trackingForm
};
