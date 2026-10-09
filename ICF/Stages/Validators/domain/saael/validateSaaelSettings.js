import { validateSaaelContent } from '../../../../../storefront/brands/saael/validation.js';
export function validateSaaelSettings(intent) {
 var errors = validateSaaelContent(intent.payload.config.content.saael);
 if (intent.payload.config.companyId !== 'saael-s') errors.push('SaaEl settings belong to saael-s only.');
 return { ok: errors.length === 0, errors: errors, intent: intent };
}
