/**
 * Turns Firebase Auth error codes into short messages for students.
 * Returns null when nothing should be shown (e.g. the student closed the Google pop-up).
 */
export function describeAuthError(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please use a stronger password (at least 8 characters).';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'Please enter a valid email address.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your network and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not switched on yet. Please try another one.';
    case 'auth/unauthorized-domain':
      return 'Sign-in is not allowed on this web address yet.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for help.';
    default:
      return 'Sign-in did not work. Please try again.';
  }
}

/** Client-side password rule (Firebase's own minimum is 6 characters). */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use both letters and numbers.';
  return null;
}
