import { escapeText } from './map.js';

export function mountAvailabilityEditor(editor, content, getServices) {
 var section = document.createElement('details');
 section.className = 'sa-availability-editor';
 section.innerHTML = '<summary>Availability & pricing</summary><p>Set each service’s price and duration in Services. Add dates and time windows here; a window can apply to all services or just one. Session start times are spaced by the selected service’s duration and must fit within the window. Remove a window to withdraw that availability.</p><div class="sa-admin-fields"><label class="sa-admin-field"><span>Currency (three-letter code, e.g. KGS, USD, EUR)</span><input name="sa-currency" maxlength="3" value="' + escapeText(content.currency) + '" placeholder="Choose your currency"></label><label class="sa-admin-field"><span>Calendar time zone</span><input name="sa-timeZone" value="' + escapeText(content.timeZone) + '" placeholder="Asia/Bishkek"></label></div><div class="sa-availability-windows"></div><button type="button" data-add-window>Add availability window</button><p>Availability is displayed publicly after Save Store. This calendar does not accept reservations or take payments yet.</p>';
 editor.querySelectorAll('details')[1].before(section);
 var windows = section.querySelector('.sa-availability-windows');
 var titleLabel = document.createElement('label'); titleLabel.className = 'sa-admin-field';
 var titleText = document.createElement('span'); titleText.textContent = 'Calendar heading';
 var titleInput = document.createElement('input'); titleInput.name = 'sa-calendarTitle'; titleInput.value = content.calendarTitle;
 titleLabel.append(titleText, titleInput); section.querySelector('.sa-admin-fields').prepend(titleLabel);
 function refreshServices() {
  var services = getServices();
  windows.querySelectorAll('select').forEach(function refresh(select) {
   var selected = select.value;
   select.innerHTML = '<option value="">All services</option>' + services.filter(function named(item) { return item.id; }).map(function option(item) { return '<option value="' + escapeText(item.id) + '">' + escapeText(item.title || item.id) + '</option>'; }).join('');
   if (selected && !services.some(function match(item) { return item.id === selected; })) {
    var missing = document.createElement('option'); missing.value = selected; missing.textContent = 'Missing service: ' + selected + ' — choose another'; select.appendChild(missing);
   }
   select.value = selected;
  });
 }
 function addWindow(item) {
  var record = document.createElement('fieldset'); record.className = 'sa-admin-record';
  record.innerHTML = '<legend>Available date & time</legend><div class="sa-admin-fields"><label class="sa-admin-field"><span>Date</span><input name="date" type="date" value="' + escapeText(item.date || '') + '"></label><label class="sa-admin-field"><span>From</span><input name="start" type="time" value="' + escapeText(item.start || '') + '"></label><label class="sa-admin-field"><span>Until</span><input name="end" type="time" value="' + escapeText(item.end || '') + '"></label><label class="sa-admin-field"><span>Available for</span><select name="serviceId"><option value="' + escapeText(item.serviceId || '') + '">Loading services</option></select></label></div><button type="button" data-remove-window>Remove availability</button>';
  windows.appendChild(record); refreshServices();
 }
 content.availability.forEach(addWindow);
 section.addEventListener('click', function editAvailability(event) {
  var button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-add-window')) addWindow({});
  if (button.hasAttribute('data-remove-window')) button.closest('fieldset').remove();
  editor.dispatchEvent(new Event('input', { bubbles: true }));
 });
 editor.addEventListener('input', refreshServices);
 editor.addEventListener('change', refreshServices);
 return { read: function readAvailability() {
  return Array.from(windows.children).map(function read(record) {
   return { date: record.querySelector('[name=date]').value, start: record.querySelector('[name=start]').value, end: record.querySelector('[name=end]').value, serviceId: record.querySelector('[name=serviceId]').value };
  });
 }};
}
