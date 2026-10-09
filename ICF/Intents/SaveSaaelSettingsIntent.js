import { validateSaaelSettings } from '../Stages/Validators/domain/saael/validateSaaelSettings.js';
import { normalizeSaaelSettings } from '../Stages/Normalizers/domain/saael/normalizeSaaelSettings.js';
import { addSaaelSettingsContext } from '../Stages/ContextProviders/domain/saael/addSaaelSettingsContext.js';
import { authorizeSaaelSettings } from '../Stages/Authorizers/domain/saael/authorizeSaaelSettings.js';
import { processSaaelSettings } from '../Stages/Processors/domain/saael/processSaaelSettings.js';
import { emitSaaelSettings } from '../Stages/Emitters/domain/saael/emitSaaelSettings.js';
export function createSaveSaaelSettingsIntent(options) {
 return {
  type: 'SaveSaaelSettingsIntent', actor: options.actor, payload: { config: options.config },
  context: { repository: options.repository }, meta: { source: 'admin', createdAt: Date.now() },
  stages: {
   Validate: { validateSaaelSettings: validateSaaelSettings },
   Normalize: { normalizeSaaelSettings: normalizeSaaelSettings },
   AddContext: { addSaaelSettingsContext: addSaaelSettingsContext },
   Authorize: { authorizeSaaelSettings: authorizeSaaelSettings },
   Process: { processSaaelSettings: processSaaelSettings },
   Emit: { emitSaaelSettings: emitSaaelSettings }
  }
 };
}
