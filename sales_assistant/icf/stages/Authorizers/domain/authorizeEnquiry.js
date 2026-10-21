import { isStaff } from '../../../../domain.mjs';
export function authorizeEnquiry(intent) {
    var identity = intent.context.identity;
    if (!isStaff(identity) || !intent.actor || identity.uid !== intent.actor.id) return { ok: false, errors: ['A verified CRM staff session is required.'] };
    return { ok: true, intent: intent };
}
