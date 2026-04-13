import { COMPANY_ID } from './company-config.js';

export function getCompanyScopedId(companyId, id) {
  const cid = companyId || COMPANY_ID;
  return `${cid}__${id}`;
}

export function getInventoryDocId(companyId, dateId) {
  return getCompanyScopedId(companyId, dateId);
}

export function getCheckoutSettingsDocId(companyId) {
  return getCompanyScopedId(companyId, 'checkout');
}

export function getPageDocId(companyId, pageId) {
  return getCompanyScopedId(companyId, pageId);
}

