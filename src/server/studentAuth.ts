/**
 * Server-side check that a request comes from a signed-in student: verifies the Firebase ID
 * token sent as "Authorization: Bearer <token>". Only verified students may use AI features.
 */

export interface DecodedStudentToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
}

/** Verifies a Firebase ID token and returns its claims (throws if invalid or expired). */
export type IdTokenVerifier = (idToken: string) => Promise<DecodedStudentToken>;

export interface VerifiedStudent {
  uid: string;
  email?: string;
  emailVerified: boolean;
  signInProvider: string;
}

export type StudentAuthResult =
  | { ok: true; student: VerifiedStudent }
  | { ok: false; status: 401 | 403 | 503; code: string; message: string };

export function readBearerToken(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

export async function authenticateStudent(
  verify: IdTokenVerifier | null,
  idToken: string | null
): Promise<StudentAuthResult> {
  if (!verify) {
    return {
      ok: false,
      status: 503,
      code: 'auth_not_configured',
      message: 'Sign-in is not set up on this server yet (missing VITE_FIREBASE_PROJECT_ID).',
    };
  }
  if (!idToken) {
    return {
      ok: false,
      status: 401,
      code: 'auth_required',
      message: 'Please sign in to use this feature.',
    };
  }

  let decoded: DecodedStudentToken;
  try {
    decoded = await verify(idToken);
  } catch {
    return {
      ok: false,
      status: 401,
      code: 'auth_invalid',
      message: 'Your session has expired. Please sign in again.',
    };
  }

  const provider = decoded.firebase?.sign_in_provider || 'unknown';
  if (provider === 'anonymous' || !decoded.uid) {
    return {
      ok: false,
      status: 401,
      code: 'auth_required',
      message: 'Please sign in to use this feature.',
    };
  }
  // Email/password accounts must confirm they own the address before using the app.
  if (provider === 'password' && !decoded.email_verified) {
    return {
      ok: false,
      status: 403,
      code: 'email_unverified',
      message: 'Please verify your email address first. Check your inbox for the link we sent.',
    };
  }

  return {
    ok: true,
    student: {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      signInProvider: provider,
    },
  };
}
