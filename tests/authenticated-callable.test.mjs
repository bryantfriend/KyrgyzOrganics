import assert from 'node:assert/strict';
import test from 'node:test';

import { invokeAuthenticatedCallable } from '../authenticated-callable.js';

test('requires a current Firebase user before making a request', async () => {
  let fetchCalled = false;

  await assert.rejects(
    invokeAuthenticatedCallable({
      auth: { currentUser: null },
      projectId: 'oa-kyrgyz-organic',
      functionName: 'createStoreOwnerUser',
      data: {},
      fetchImpl: async () => {
        fetchCalled = true;
      }
    }),
    (error) => error.code === 'functions/unauthenticated'
  );

  assert.equal(fetchCalled, false);
});

test('refreshes the ID token and sends an authenticated callable request', async () => {
  const calls = [];
  const auth = {
    currentUser: {
      async getIdToken(forceRefresh) {
        assert.equal(forceRefresh, true);
        return 'fresh-id-token';
      }
    }
  };

  const result = await invokeAuthenticatedCallable({
    auth,
    projectId: 'oa-kyrgyz-organic',
    functionName: 'createStoreOwnerUser',
    data: { email: 'owner@example.com', companyId: 'sample-store' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { result: { uid: 'owner-uid' } };
        }
      };
    }
  });

  assert.deepEqual(result, { data: { uid: 'owner-uid' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://us-central1-oa-kyrgyz-organic.cloudfunctions.net/createStoreOwnerUser');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fresh-id-token');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    data: { email: 'owner@example.com', companyId: 'sample-store' }
  });
});

test('maps callable errors to Firebase-style error codes', async () => {
  await assert.rejects(
    invokeAuthenticatedCallable({
      auth: { currentUser: { getIdToken: async () => 'fresh-id-token' } },
      projectId: 'oa-kyrgyz-organic',
      functionName: 'createStoreOwnerUser',
      data: {},
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            status: 'PERMISSION_DENIED',
            message: 'Only platform admins can create store owner users'
          }
        })
      })
    }),
    (error) => (
      error.code === 'functions/permission-denied'
      && error.message === 'Only platform admins can create store owner users'
    )
  );
});
