import { COMPANY_ID, setCompanyId } from './company-config.js';

const STORAGE_KEY = 'selected_company';

export let SELECTED_COMPANY_ID = COMPANY_ID;

export function setSelectedCompany(companyId, { persist = true } = {}) {
  SELECTED_COMPANY_ID = companyId || COMPANY_ID;

  // Keep existing company-config consumers (admin tabs, helpers) in sync.
  setCompanyId(SELECTED_COMPANY_ID);

  try {
    if (persist) {
      localStorage.setItem(STORAGE_KEY, SELECTED_COMPANY_ID);
    }
  } catch (_) {
    // ignore storage failures
  }

  try {
    window.dispatchEvent(new CustomEvent('oako:store-changed', { detail: { companyId: SELECTED_COMPANY_ID } }));
  } catch (_) {
    // ignore if CustomEvent not available
  }
}

export function loadSelectedCompany() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSelectedCompany(saved, { persist: false });
    } else {
      setSelectedCompany(COMPANY_ID, { persist: false });
    }
  } catch (_) {
    setSelectedCompany(COMPANY_ID, { persist: false });
  }
}

export function getSelectedCompanyId() {
  return SELECTED_COMPANY_ID || COMPANY_ID;
}

export function matchesSelectedCompany(data, id = 'document') {
  const selected = getSelectedCompanyId();

  // Safe migration: legacy docs without companyId belong to the default company only.
  if (!data?.companyId) {
    console.warn('Missing companyId:', id);
    return selected === COMPANY_ID;
  }

  return data.companyId === selected;
}

