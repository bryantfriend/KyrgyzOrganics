import { validateEnquiry } from './stages/Validators/domain/validateEnquiry.js';
import { normalizeEnquiry } from './stages/Normalizers/domain/normalizeEnquiry.js';
import { addEnquiryContext } from './stages/ContextProviders/domain/addEnquiryContext.js';
import { authorizeEnquiry } from './stages/Authorizers/domain/authorizeEnquiry.js';
import { processEnquiry } from './stages/Processors/domain/processEnquiry.js';
import { emitEnquiry } from './stages/Emitters/domain/emitEnquiry.js';
export function createSaveEnquiryIntent(options) {
    return {
        type: 'SaveSalesEnquiryIntent', actor: options.actor, payload: options.payload,
        context: { repository: options.repository }, meta: { source: 'sales_assistant', createdAt: Date.now() },
        stages: {
            Validate: { validateEnquiry: validateEnquiry },
            Normalize: { normalizeEnquiry: normalizeEnquiry },
            AddContext: { addEnquiryContext: addEnquiryContext },
            Authorize: { authorizeEnquiry: authorizeEnquiry },
            Process: { processEnquiry: processEnquiry },
            Emit: { emitEnquiry: emitEnquiry }
        }
    };
}
