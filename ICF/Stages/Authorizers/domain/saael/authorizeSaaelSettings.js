export function authorizeSaaelSettings(intent) {
 var identity = intent.context.identity;
 var allowed = identity && identity.uid === intent.actor.id && ['admin', 'superadmin', 'owner', 'manager', 'super_admin'].includes(identity.role);
 return { ok: Boolean(allowed), errors: allowed ? [] : ['Sign in with an authorized admin account.'], intent: intent };
}
