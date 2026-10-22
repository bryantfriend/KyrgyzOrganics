import { addDoc as rawAddDoc, updateDoc as rawUpdateDoc, deleteDoc as rawDeleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCurrentCompanyId } from '../company-config.js';
import { invalidateCatalogueCache } from '../storefront/catalogue-repository.js';
import { reportingRepository } from './reporting-repository.js';
import { createCatalogueMutations } from './catalogue-mutations.mjs';

export function invalidateEditedCatalogue(companyId) {
  invalidateCatalogueCache(companyId);
  reportingRepository.invalidate({ companyId });
}

export const { addDoc, updateDoc, deleteDoc } = createCatalogueMutations({
  sdk: { addDoc: rawAddDoc, updateDoc: rawUpdateDoc, deleteDoc: rawDeleteDoc },
  getCompanyId: getCurrentCompanyId,
  invalidate: invalidateEditedCatalogue
});
