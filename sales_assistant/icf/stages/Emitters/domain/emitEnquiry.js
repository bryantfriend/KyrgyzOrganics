export function emitEnquiry(intent) {
    intent.context.resultData = intent.context.saved;
    return { ok: true, intent: intent };
}
