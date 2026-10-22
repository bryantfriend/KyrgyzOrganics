/** Bounded, successful-results-only cache. Invalidation also supersedes pending work. */
export function createReportCache({ ttlMs = 60_000, maxEntries = 40, maxDocuments = 50_000, now = Date.now } = {}) {
  const values = new Map();
  const pending = new Map();
  let documents = 0;
  const remove = (key) => {
    const entry = values.get(key);
    if (entry) documents -= entry.weight;
    values.delete(key);
  };
  return {
    get(key, loader, { force = false, weight = (value) => Array.isArray(value) ? value.length : 1 } = {}) {
      if (pending.has(key)) return pending.get(key).promise;
      const cached = values.get(key);
      if (!force && cached && cached.expires > now()) {
        values.delete(key);
        values.set(key, cached);
        return Promise.resolve(cached.value);
      }
      remove(key);
      const operation = {};
      operation.promise = Promise.resolve().then(loader).then((value) => {
        if (pending.get(key) === operation) {
          const size = weight(value);
          if (size <= maxDocuments && maxEntries > 0) {
            values.set(key, { value, weight: size, expires: now() + ttlMs });
            documents += size;
            while (values.size > maxEntries || documents > maxDocuments) remove(values.keys().next().value);
          }
        }
        return value;
      }).finally(() => {
        if (pending.get(key) === operation) pending.delete(key);
      });
      pending.set(key, operation);
      return operation.promise;
    },
    invalidate(predicate = () => true) {
      for (const key of values.keys()) if (predicate(key)) remove(key);
      for (const key of pending.keys()) if (predicate(key)) pending.delete(key);
    },
    get size() { return values.size; },
    get documents() { return documents; }
  };
}

export function reportDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

export function filterReportRange(rows, collectionName, cutoff) {
  if (!cutoff) return rows;
  const orders = collectionName === 'orders';
  return rows.filter((row) => {
    // Preserve existing precedence, including an invalid, truthy createdAt overriding a fallback.
    const date = reportDate(row.createdAt || (orders ? row.date : row.timestamp));
    return date ? date >= cutoff : !orders;
  });
}

/**
 * Firebase is injected so compatibility, query shape and read budgets are testable.
 * hasCanonicalDates is deliberately false in production until a full data/writer audit.
 * Each enabled collection must have reportingDate: Timestamp|null on EVERY document.
 * Null means the historical effective date was absent/invalid. Missing companyId is
 * never inferred: selected-store equality excludes it, explicit all-stores includes it.
 */
export function createReportingRepository({ db, firestore, hasCanonicalDates = () => false, cache = createReportCache() }) {
  const { collection, doc, getDoc, query, where, getDocs, getCountFromServer, orderBy, limit } = firestore;
  const scopeKey = ({ scope = 'selected', companyId }) => {
    if (scope !== 'selected' && scope !== 'all') throw new Error('Invalid report scope');
    if (scope === 'selected' && !companyId) throw new Error('Select a store before loading reports');
    return [scope, scope === 'all' ? null : companyId];
  };
  const scopedQuery = (name, options, constraints = []) => {
    scopeKey(options);
    return query(collection(db, name), ...(options.scope === 'all' ? [] : [where('companyId', '==', options.companyId)]), ...constraints);
  };
  const rows = (snap) => snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  let version = 0;
  const repository = {
    get version() { return version; },
    async getRows(collectionName, options = {}) {
      const { cutoff = null, force = false } = options;
      const scope = scopeKey(options);
      const dated = !!cutoff && hasCanonicalDates(collectionName);
      const key = JSON.stringify(['rows', collectionName, ...scope, dated ? cutoff.toISOString() : 'all']);
      const result = await cache.get(key, async () => {
        if (!dated) return rows(await getDocs(scopedQuery(collectionName, options)));
        const queries = [scopedQuery(collectionName, options, [where('reportingDate', '>=', cutoff)])];
        // Events with no valid date historically count in EVERY range; orders do not.
        if (collectionName !== 'orders') queries.push(scopedQuery(collectionName, options, [where('reportingDate', '==', null)]));
        const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
        return Array.from(new Map(snapshots.flatMap(rows).map((row) => [row.id, row])).values());
      }, { force });
      return filterReportRange(result, collectionName, cutoff);
    },
    getStores(options = {}) {
      const key = JSON.stringify(['stores', ...scopeKey(options)]);
      return cache.get(key, async () => {
        if (options.scope === 'all') return rows(await getDocs(collection(db, 'companies')));
        const snap = await getDoc(doc(db, 'companies', options.companyId));
        return snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
      }, { force: options.force });
    },
    getProductCounts(companyId, { force = false } = {}) {
      const options = { companyId, scope: 'selected' };
      const key = JSON.stringify(['productCounts', ...scopeKey(options)]);
      return cache.get(key, async () => {
        const [total, inactive] = await Promise.all([
          getCountFromServer(scopedQuery('products', options)),
          getCountFromServer(scopedQuery('products', options, [where('active', '==', false)]))
        ]);
        const productsCount = total.data().count;
        const inactiveProducts = inactive.data().count;
        if (inactiveProducts > productsCount) throw new Error('Catalog changed while loading counts. Refresh to retry.');
        return { productsCount, inactiveProducts, activeProducts: productsCount - inactiveProducts };
      }, { force });
    },
    getEventSummary(companyId, { force = false } = {}) {
      const options = { companyId, scope: 'selected' };
      const key = JSON.stringify(['eventSummary', ...scopeKey(options)]);
      return cache.get(key, async () => {
        const [total, canonicalViews, legacyViews] = await Promise.all([
          getCountFromServer(scopedQuery('storefront_events', options)),
          getCountFromServer(scopedQuery('storefront_events', options, [where('actionType', '==', 'page_view')])),
          // Missing actionType cannot be queried with == null. Fetch only the legacy
          // page-view candidates, then apply the original actionType || type precedence.
          getDocs(scopedQuery('storefront_events', options, [where('type', '==', 'page_view')]))
        ]);
        const analyticsEvents = total.data().count;
        const pageViews = canonicalViews.data().count + rows(legacyViews).filter((event) => !event.actionType).length;
        if (pageViews > analyticsEvents) throw new Error('Events changed while loading counts. Refresh to retry.');
        return { analyticsEvents, pageViews, eventsByType: null };
      }, { force });
    },
    getActiveOrders(companyId, statuses, { force = false } = {}) {
      const options = { companyId, scope: 'selected' };
      const key = JSON.stringify(['activeOrders', ...scopeKey(options), statuses]);
      // Preserve the operational last-100-active-orders sample; the UI labels this explicitly.
      return cache.get(key, async () => rows(await getDocs(scopedQuery('orders', options, [where('status', 'in', statuses), orderBy('createdAt', 'desc'), limit(100)]))), { force });
    },
    invalidate({ companyId, scope } = {}) {
      version += 1;
      cache.invalidate((key) => {
        const parts = JSON.parse(key);
        const scopeIndex = parts[0] === 'rows' ? 2 : 1;
        return !companyId || scope === 'all' || parts[scopeIndex] === 'all' || parts[scopeIndex + 1] === companyId;
      });
    },
    cache
  };
  return repository;
}
