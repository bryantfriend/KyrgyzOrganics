// Wall-clock availability is displayed in the configured business time zone.
export function dateKey(year, month, day) {
 return String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}
export function zonedNow(timeZone, now) {
 var parts = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now || new Date());
 var values = {};
 parts.forEach(function part(item) { values[item.type] = item.value; });
 return { date: values.year + '-' + values.month + '-' + values.day, time: values.hour + ':' + values.minute };
}
export function minutesFromTime(time) {
 if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
 return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
export function timeFromMinutes(minutes) {
 return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
export function isValidDate(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 var parsed = new Date(value + 'T12:00:00Z');
 return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function availableTimes(content, service, date, now) {
 if (!service || !Number.isInteger(service.durationMinutes) || service.durationMinutes < 5) return [];
 var current = zonedNow(content.timeZone, now);
 if (date < current.date) return [];
 var times = new Set();
 (content.availability || []).forEach(function window(item) {
  if (item.date !== date || (item.serviceId && item.serviceId !== service.id)) return;
  var start = minutesFromTime(item.start), end = minutesFromTime(item.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  for (var minute = start; minute + service.durationMinutes <= end; minute += service.durationMinutes) {
   var time = timeFromMinutes(minute);
   if (date > current.date || time > current.time) times.add(time);
  }
 });
 return Array.from(times).sort();
}
export function formatServicePrice(service, currency) {
 if (!service || service.price == null || !currency) return 'Price to be confirmed';
 try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency }).format(service.price); }
 catch { return 'Price to be confirmed'; }
}
export function validateScheduling(content) {
 var errors = [];
 var services = Array.isArray(content.services) ? content.services : [];
 if (typeof content.currency !== 'string' || (content.currency && !/^[A-Z]{3}$/.test(content.currency))) errors.push('Use a three-letter currency code, such as KGS, USD or EUR.');
 if (typeof content.timeZone !== 'string' || !content.timeZone.trim()) errors.push('Choose the calendar time zone.');
 try { new Intl.DateTimeFormat('en', { timeZone: content.timeZone }).format(); }
 catch { errors.push('Enter a valid time zone, such as Asia/Bishkek.'); }
 services.forEach(function service(item) {
  if (!item) return;
  if (item.price != null && (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0 || item.price > 100000000)) errors.push('Service prices must be positive numbers or zero. Leave blank for unconfirmed prices.');
  if (item.price != null && !content.currency) errors.push('Choose a currency before publishing service prices.');
  if (item.durationMinutes != null && (!Number.isInteger(item.durationMinutes) || item.durationMinutes < 5 || item.durationMinutes > 1440)) errors.push('Service duration must be a whole number from 5 to 1440 minutes.');
 });
 if (!Array.isArray(content.availability) || content.availability.length > 366) { errors.push('Use at most 366 availability windows.'); return errors; }
 content.availability.forEach(function window(item) {
  if (!item || !isValidDate(item.date) || !Number.isFinite(minutesFromTime(item.start)) || !Number.isFinite(minutesFromTime(item.end)) || item.start >= item.end) { errors.push('Each availability window needs a valid date and an end time later than its start time.'); return; }
  if (typeof item.serviceId !== 'string' || (item.serviceId && !services.some(function match(service) { return service && service.id === item.serviceId; }))) errors.push('An availability window refers to a missing service. Choose an existing service or all services.');
 });
 return errors;
}
