export async function addSaaelSettingsContext(intent) {
 var identity = await intent.context.repository.loadIdentity();
 intent.context.identity = identity;
 return { ok: true, intent: intent };
}
