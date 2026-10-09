import { auth, db } from '../../../firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import registry from '../../../ICF/engine/intentRegistry.js';
import pipeline from '../../../ICF/engine/pipeline.js';
import { createSaveSaaelSettingsIntent } from '../../../ICF/Intents/SaveSaaelSettingsIntent.js';

if (!registry.hasIntent('SaveSaaelSettingsIntent')) registry.registerIntent('SaveSaaelSettingsIntent', createSaveSaaelSettingsIntent);
export async function saveSaaelSettings(config) {
 var user = auth.currentUser;
 if (!user) throw new Error('Sign in before saving website settings.');
 var repository = {
  loadIdentity: async function loadIdentity() {
   var profile = await getDoc(doc(db, 'users', user.uid));
   return profile.exists() ? { uid: user.uid, role: profile.data().role } : null;
  },
  save: async function save(value) { await setDoc(doc(db, 'storefront_configs', 'saael-s'), value, { merge: true }); }
 };
 var created = registry.createIntent('SaveSaaelSettingsIntent', { actor: { id: user.uid }, config: config, repository: repository });
 if (!created.ok) throw new Error(created.errors.join(' '));
 var result = await pipeline.run(created.intent);
 if (!result.ok) throw new Error((result.errors || ['Unable to save settings.']).join(' '));
 return result;
}
