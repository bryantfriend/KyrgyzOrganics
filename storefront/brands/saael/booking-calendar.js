import { escapeText } from './map.js';
import { dateKey, zonedNow, availableTimes, formatServicePrice } from './calendar-data.js';

export function mountBookingCalendar(container, content, initialServiceId) {
 var today = zonedNow(content.timeZone);
 var year = Number(today.date.slice(0, 4)), month = Number(today.date.slice(5, 7)) - 1;
 var service = content.services.find(function match(item) { return item.id === initialServiceId; }) || content.services[0];
 var selectedDate = '', selectedTime = '';
 container.innerHTML = '<div class="sa-calendar"></div>';
 var calendar = container.firstElementChild;
 function render(focusSelector) {
  var monthName = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)));
  var firstDay = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  var dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  var cells = Array(firstDay).fill('<span aria-hidden="true"></span>').join('');
  var availableDays = 0;
  for (var day = 1; day <= dayCount; day += 1) {
   var date = dateKey(year, month, day), times = availableTimes(content, service, date);
   var hasTimes = times.length > 0;
   if (hasTimes) availableDays += 1;
   var label = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
   cells += '<button type="button" data-calendar-date="' + date + '" aria-label="' + escapeText(label + (hasTimes ? ', available' : ', unavailable')) + '" aria-pressed="' + String(selectedDate === date) + '" ' + (hasTimes ? '' : 'disabled') + (date === today.date ? ' aria-current="date"' : '') + '>' + day + (hasTimes ? '<span class="sa-date-dot" aria-hidden="true"></span>' : '') + '</button>';
  }
  calendar.innerHTML = '<label class="sa-calendar-service">Choose a service<select aria-label="Choose a service" ' + (content.services.length ? '' : 'disabled') + '>' + (content.services.length ? content.services.map(function option(item) { return '<option value="' + escapeText(item.id) + '" ' + (service && item.id === service.id ? 'selected' : '') + '>' + escapeText(item.title) + '</option>'; }).join('') : '<option>No services published</option>') + '</select></label><div class="sa-calendar-price"><strong>' + escapeText(formatServicePrice(service, content.currency)) + '</strong><span>' + escapeText(service && service.durationMinutes ? service.durationMinutes + ' minutes' : 'Duration to be confirmed') + '</span>' + (service && service.sample !== false ? '<small>Sample offering</small>' : '') + '</div><p class="sa-calendar-zone">All times in ' + escapeText(content.timeZone) + '</p><div class="sa-calendar-month"><button type="button" data-calendar-month="-1" aria-label="Previous month">‹</button><h3 aria-live="polite">' + monthName + '</h3><button type="button" data-calendar-month="1" aria-label="Next month">›</button></div><div class="sa-calendar-weekdays" aria-hidden="true">' + ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(function weekday(name) { return '<span>' + name + '</span>'; }).join('') + '</div><div class="sa-calendar-days" role="group" aria-label="' + monthName + ' availability">' + cells + '</div><div class="sa-calendar-legend"><span><i aria-hidden="true"></i> Available day</span><button type="button" data-calendar-today>Today</button></div><div class="sa-calendar-times" aria-live="polite">' + renderTimes(availableDays) + '</div><div class="sa-preview-notice"><strong>Booking preview — nothing is reserved or submitted.</strong><p>Browse Saikal’s published times and prices. Reservations and payments are not connected yet.</p></div>';
  if (focusSelector) { var target = calendar.querySelector(focusSelector); if (target) target.focus(); }
 }
 function renderTimes(availableDays) {
  if (!content.services.length) return '<p>No services have been published yet.</p>';
  if (!service.durationMinutes) return '<p>Saikal has not set a duration for this service yet. Available times will appear once its duration and availability are published.</p>';
  if (!selectedDate) return '<p>' + (availableDays ? 'Choose an available day to see session times.' : 'No availability has been published for this service this month. Browse another month or choose another service.') + '</p>';
  var times = availableTimes(content, service, selectedDate);
  var dateLabel = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(selectedDate + 'T12:00:00Z'));
  return '<h4>' + escapeText(dateLabel) + '</h4><div class="sa-time-options">' + times.map(function time(value) { return '<button type="button" data-calendar-time="' + value + '" aria-pressed="' + String(selectedTime === value) + '">' + value + '</button>'; }).join('') + '</div>' + (selectedTime ? '<p class="sa-calendar-selection">Selected: ' + escapeText(service.title) + ' · ' + escapeText(dateLabel) + ' · ' + selectedTime + ' (' + escapeText(content.timeZone) + ') · ' + escapeText(formatServicePrice(service, content.currency)) + '. This is a preview selection.</p>' : '');
 }
 calendar.addEventListener('change', function chooseService(event) {
  if (event.target.tagName !== 'SELECT') return;
  service = content.services.find(function match(item) { return item.id === event.target.value; }); selectedDate = ''; selectedTime = ''; render('select');
 });
 calendar.addEventListener('click', function selectDate(event) {
  var button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.calendarMonth) { var next = new Date(Date.UTC(year, month + Number(button.dataset.calendarMonth), 1)); year = next.getUTCFullYear(); month = next.getUTCMonth(); selectedDate = ''; selectedTime = ''; render('[data-calendar-month="' + button.dataset.calendarMonth + '"]'); }
  else if (button.hasAttribute('data-calendar-today')) { year = Number(today.date.slice(0, 4)); month = Number(today.date.slice(5, 7)) - 1; selectedDate = ''; selectedTime = ''; render('[data-calendar-today]'); }
  else if (button.dataset.calendarDate) { selectedDate = button.dataset.calendarDate; selectedTime = ''; render('[data-calendar-date="' + selectedDate + '"]'); }
  else if (button.dataset.calendarTime) { selectedTime = button.dataset.calendarTime; render('[data-calendar-time="' + selectedTime + '"]'); }
 });
 render();
}
