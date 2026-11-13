import { getApiIdToken } from '../firebase';

function readViteEnv(): Record<string, string | undefined> {
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env) {
    return (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
}

/**
 * Resolves the REST API base URL. Defaults to "" in production so `/api/*` flows through
 * Vercel rewrites (`vercel.json`), or uses `VITE_API_BASE_URL` when explicitly set.
 */
export function getApiBaseUrl(envOverride?: Record<string, string | undefined>): string {
  const env = envOverride || readViteEnv();
  const raw = (env.VITE_API_BASE_URL || '').trim();
  return raw ? raw.replace(/\/+$/, '') : '';
}

export function buildApiUrl(path: string, envOverride?: Record<string, string | undefined>): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl(envOverride);
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

/**
 * Resolves the Voice Tutor WebSocket URL. Uses `VITE_WS_BASE_URL` (e.g. `wss://YOUR_RENDER_BACKEND.onrender.com`)
 * in split Vercel+Render deployments, otherwise derives from `VITE_API_BASE_URL` or `window.location.host`.
 */
export function buildWsUrl(
  path = '/api/live',
  options?: {
    env?: Record<string, string | undefined>;
    location?: { protocol: string; host: string };
  }
): string {
  const env = options?.env || readViteEnv();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const explicitWsBase = (env.VITE_WS_BASE_URL || '').trim().replace(/\/+$/, '');
  if (explicitWsBase) {
    return `${explicitWsBase}${normalizedPath}`;
  }
  const apiBase = getApiBaseUrl(env);
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    return `${apiBase.replace(/^http/i, 'ws')}${normalizedPath}`;
  }
  const loc =
    options?.location ||
    (typeof window !== 'undefined' ? window.location : { protocol: 'http:', host: 'localhost:3000' });
  const wsProto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${loc.host}${normalizedPath}`;
}

/**
 * fetch() for LearnMate's own API: resolves split-brain deployment base URLs, attaches the
 * signed-in student's login token and retries once on 401 with a refreshed token.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const resolvedUrl = buildApiUrl(url);
  const send = async (forceRefresh: boolean) => {
    const headers = new Headers(init.headers);
    const token = await getApiIdToken(forceRefresh);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(resolvedUrl, { ...init, headers });
  };

  const response = await send(false);
  const signedIn = Boolean(await getApiIdToken().catch(() => null));
  return response.status === 401 && signedIn ? send(true) : response;
}
