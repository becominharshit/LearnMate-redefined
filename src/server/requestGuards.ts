/**
 * Request checks that run before any API handler.
 */
import type { UsageCategory } from './usageLimits.ts';

/** API paths that need no student login. Admin diagnostics are protected by ADMIN_TOKEN instead. */
const PUBLIC_API_PATHS = new Set(['/api/health']);
const ADMIN_API_PREFIXES = ['/api/usage', '/api/capabilities', '/api/vertex'];

export function isPublicApiPath(path: string): boolean {
  return PUBLIC_API_PATHS.has(path) || ADMIN_API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Daily allowance bucket for each AI route; routes not listed only get the per-minute limit. */
const ROUTE_CATEGORIES: Record<string, UsageCategory> = {
  '/api/study/ask': 'tutor',
  '/api/study/ask-stream': 'tutor',
  '/api/study/quiz': 'practice',
  '/api/study/mistakes-and-plan': 'revise',
  '/api/study/quick-revise': 'revise',
  '/api/study/teach-it-back': 'revise',
  '/api/study/youtube-recommendations': 'revise',
  '/api/study/analyze': 'upload',
  '/api/study/scan-notes': 'upload',
  '/api/study/youtube-analyze': 'upload',
  '/api/study/transcribe-audio': 'upload',
  '/api/create/visualize': 'create',
  '/api/create/video-lesson': 'create',
  '/api/create/3d-model': 'create',
  '/api/create/lofi-music': 'create',
  '/api/explore/daily-news': 'revise',
  '/api/explore/educational-maps': 'revise',
};

export function usageCategoryForPath(method: string, path: string): UsageCategory | undefined {
  if (method !== 'POST') return undefined;
  return ROUTE_CATEGORIES[path];
}

/**
 * Browsers send an Origin header on cross-site requests. Only our own site (or an origin listed
 * in ALLOWED_ORIGINS) may call the API; requests without an Origin (same-origin navigation, curl)
 * still need a valid login token.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  extraAllowed: string[]
): boolean {
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (host && parsed.host === host) return true;
  return extraAllowed.some((allowed) => {
    try {
      return new URL(allowed).origin === parsed.origin;
    } catch {
      return false;
    }
  });
}
