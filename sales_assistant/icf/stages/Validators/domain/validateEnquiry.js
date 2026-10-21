import { validateSave } from '../../../../domain.mjs';
export function validateEnquiry(intent) {
    var errors = validateSave(intent.payload);
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, intent: intent };
}
