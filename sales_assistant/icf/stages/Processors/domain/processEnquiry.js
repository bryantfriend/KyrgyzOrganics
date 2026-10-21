import { friendlyError } from '../../../../repository-core.mjs';
export async function processEnquiry(intent) {
    try { intent.context.saved = await intent.context.repository.save(intent.payload, intent.context.identity); }
    catch (error) { return { ok: false, errors: [friendlyError(error)] }; }
    return { ok: true, intent: intent };
}
