export function normalizeSaaelSettings(intent) {
 // The form trims text. Retain deliberate empty strings and collections.
 return { ok: true, intent: intent };
}
