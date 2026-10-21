import pipeline from '../../ICF/engine/pipeline.js';
import registry from '../../ICF/engine/intentRegistry.js';
import { createSaveEnquiryIntent } from './intent.js';
registry.registerIntent('SaveSalesEnquiryIntent', createSaveEnquiryIntent);
export async function saveEnquiry(options) {
    var created = registry.createIntent('SaveSalesEnquiryIntent', options);
    if (!created.ok) return created;
    return pipeline.run(created.intent);
}
