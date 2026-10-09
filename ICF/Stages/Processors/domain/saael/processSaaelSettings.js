export async function processSaaelSettings(intent) {
 // Repository makes one document write; Firestore rules enforce authorization.
 await intent.context.repository.save(intent.payload.config);
 return { ok: true, intent: intent };
}
