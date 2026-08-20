function createCallableError(status, message, details = undefined, cause = undefined) {
    const normalizedStatus = String(status || 'INTERNAL').trim().toLowerCase().replace(/_/g, '-');
    const error = new Error(message || 'Cloud function request failed');
    error.name = 'FirebaseError';
    error.code = `functions/${normalizedStatus}`;
    if (details !== undefined) error.details = details;
    if (cause !== undefined) error.cause = cause;
    return error;
}

function readCallableResult(payload) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'result')) return payload.result;
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'response')) return payload.response;
    throw createCallableError('INTERNAL', 'Cloud function returned an invalid response');
}

export async function invokeAuthenticatedCallable({
    auth,
    projectId,
    functionName,
    data,
    region = 'us-central1',
    fetchImpl = globalThis.fetch
}) {
    const user = auth?.currentUser;
    if (!user) {
        throw createCallableError('UNAUTHENTICATED', 'Sign in is required');
    }

    let idToken;
    try {
        // This action creates an Auth user, so use a freshly verified token instead
        // of relying on a potentially stale token cached by the callable SDK.
        idToken = await user.getIdToken(true);
    } catch (error) {
        throw createCallableError('UNAUTHENTICATED', 'Could not verify the current sign-in', undefined, error);
    }

    if (!idToken) {
        throw createCallableError('UNAUTHENTICATED', 'Could not verify the current sign-in');
    }
    if (!projectId || !/^[a-z0-9-]+$/i.test(projectId)) {
        throw createCallableError('INTERNAL', 'Firebase project is not configured');
    }
    if (!functionName || !/^[a-z0-9_-]+$/i.test(functionName)) {
        throw createCallableError('INTERNAL', 'Cloud function name is not configured');
    }
    if (typeof fetchImpl !== 'function') {
        throw createCallableError('INTERNAL', 'Network requests are not available');
    }

    const endpoint = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
    let response;
    try {
        response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify({ data })
        });
    } catch (error) {
        throw createCallableError('UNAVAILABLE', 'Could not reach the cloud function', undefined, error);
    }

    let payload;
    try {
        payload = await response.json();
    } catch (error) {
        throw createCallableError('INTERNAL', 'Cloud function returned an invalid response', undefined, error);
    }

    if (payload?.error) {
        throw createCallableError(
            payload.error.status || (response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL'),
            payload.error.message,
            payload.error.details
        );
    }
    if (!response.ok) {
        throw createCallableError(response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL', 'Cloud function request failed');
    }

    return { data: readCallableResult(payload) };
}
