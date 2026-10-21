import { friendlyError } from '../../../../repository-core.mjs';
export async function addEnquiryContext(intent) {
    try { intent.context.identity = await intent.context.repository.loadIdentity(); }
    catch (error) { return { ok: false, errors: [friendlyError(error)] }; }
    return { ok: true, intent: intent };
}
