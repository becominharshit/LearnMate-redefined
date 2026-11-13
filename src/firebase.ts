import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reload,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';

/**
 * Firebase settings come from .env (VITE_FIREBASE_*), so dev and production projects stay
 * separate. With VITE_FIREBASE_USE_EMULATOR=true the app uses the local Firebase emulators.
 */
const env =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof process !== 'undefined' && (process.env as unknown as Record<string, string | undefined>)) ||
  {};
export const usingFirebaseEmulator = env.VITE_FIREBASE_USE_EMULATOR === 'true';
const projectId = env.VITE_FIREBASE_PROJECT_ID || (usingFirebaseEmulator ? 'demo-learnmate' : '');

/** False when .env has no Firebase project yet; the app then shows setup instructions. */
export const firebaseConfigured = usingFirebaseEmulator || Boolean(env.VITE_FIREBASE_API_KEY && projectId);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId || 'demo-learnmate'}.firebaseapp.com`,
  projectId: projectId || 'demo-learnmate',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/**
 * Removes leftover Firebase Auth keys from localStorage and sessionStorage after sign-out.
 * The IndexedDB session store is cleared by Firebase's own signOut() and must not be
 * deleted while the Auth SDK still holds it open.
 */
function clearStaleFirebaseAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      if (!storage) continue;
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('firebase:')) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        storage.removeItem(key);
      }
    }
  } catch {
    // ignore in restricted storage environments
  }
}

const app = initializeApp(firebaseConfig);

function createSafeAuth(): Auth {
  if (typeof window !== 'undefined') {
    try {
      // Keep students signed in across reloads. Firebase uses the first persistence that is
      // available and falls back to memory in restricted environments (e.g. sandboxed iframes).
      return initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      return getAuth(app);
    }
  }
  return getAuth(app);
}

export const auth = createSafeAuth();
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (usingFirebaseEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Suppress noisy internal SDK connection retry warnings when operating in local-first mode
try {
  setLogLevel('silent');
} catch {
  // ignore
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/** Logged on sync errors. Deliberately contains no email, name or photo. */
export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  signedIn: boolean;
  emailVerified: boolean | undefined;
}

export function isAuthTokenServiceError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('token-service-api') ||
    lower.includes('securetoken.googleapis.com') ||
    lower.includes('fetching auth token failed') ||
    lower.includes('auth/invalid-user-token') ||
    lower.includes('auth/user-token-expired')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isAuthTokenServiceError(error)) {
    void firebaseSignOut(auth).catch(() => {});
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    // The path contains the account id; keep only its shape.
    path: path ? path.replace(/^users\/[^/]+/, 'users/{uid}') : null,
    signedIn: Boolean(auth.currentUser),
    emailVerified: auth.currentUser?.emailVerified,
  };
  console.warn('Firestore sync notice:', JSON.stringify(errInfo));
}

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(
      auth,
      googleProvider,
      browserPopupRedirectResolver
    );
    return result.user;
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
      return null;
    }
    throw err;
  }
}

export async function consumeGoogleRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth, browserPopupRedirectResolver);
    return result?.user || null;
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

/** Creates an email/password account and sends the verification email. */
export async function createAccountWithEmail(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }
  await sendEmailVerification(result.user);
  return result.user;
}

export async function resendVerificationEmail(): Promise<void> {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Reloads the account (e.g. after the student clicked the verification link) and refreshes its token. */
export async function refreshCurrentUser(): Promise<User | null> {
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  await user.getIdToken(true);
  return auth.currentUser;
}

/** Email/password accounts must verify their address before using the app; Google accounts are verified. */
export function needsEmailVerification(user: User | null): boolean {
  return Boolean(
    user && !user.emailVerified && user.providerData.some((p) => p.providerId === 'password')
  );
}

/** The signed-in student's ID token for API calls (refreshed automatically when it expires). */
export async function getApiIdToken(forceRefresh = false): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken(forceRefresh) : null;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
  clearStaleFirebaseAuthStorage();
}

export { onAuthStateChanged, type User };
