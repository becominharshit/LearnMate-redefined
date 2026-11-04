import { getApiIdToken } from '../firebase';

/**
 * fetch() for LearnMate's own API: attaches the signed-in student's login token and, if the
 * server says the token is no longer valid, retries once with a freshly issued token.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = async (forceRefresh: boolean) => {
    const headers = new Headers(init.headers);
    const token = await getApiIdToken(forceRefresh);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const response = await send(false);
  const signedIn = Boolean(await getApiIdToken().catch(() => null));
  return response.status === 401 && signedIn ? send(true) : response;
}
