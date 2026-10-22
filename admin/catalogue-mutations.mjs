/** Invalidate only after a successful write, scoped to the store captured at start. */
export function createCatalogueMutations({ sdk, getCompanyId, invalidate }) {
  return Object.fromEntries(['addDoc', 'updateDoc', 'deleteDoc'].map((method) => [method, async (...args) => {
    const companyId = getCompanyId();
    const result = await sdk[method](...args);
    invalidate(companyId);
    return result;
  }]));
}
