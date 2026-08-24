import { COMPANY_ID } from '../company-config.js';

export function ensureAbsoluteStoreUrl(value, origin = globalThis.location?.origin || '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  try {
    if (raw.startsWith('/')) return new URL(raw, origin).href;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return `https://${raw.replace(/^\/+/, '')}`;
    return new URL(raw, origin).href;
  } catch (_) {
    return `https://${raw.replace(/^\/+/, '')}`;
  }
}

export function getStorePublicUrl(store = {}, companyId = '', origin = globalThis.location?.origin || '') {
  const launchStatus = String(store.launchStatus || store.status || '').toLowerCase();
  const explicitUrl = launchStatus && launchStatus !== 'live'
    ? store.previewUrl || store.website || store.publicUrl || store.domain || store.customDomain
    : store.website || store.publicUrl || store.previewUrl || store.domain || store.customDomain;
  if (explicitUrl) return ensureAbsoluteStoreUrl(explicitUrl, origin);

  const slug = String(store.slug || store.storeSlug || companyId || '').trim();
  if (!slug || slug === COMPANY_ID) return ensureAbsoluteStoreUrl('/', origin);

  const params = new URLSearchParams({ company: slug });
  if (launchStatus && launchStatus !== 'live') params.set('preview', '1');
  return ensureAbsoluteStoreUrl(`/?${params.toString()}`, origin);
}
