import React, { useEffect, useState } from 'react';
import { Loader2, MailCheck, RefreshCw, Settings2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { refreshCurrentUser, resendVerificationEmail, signOutUser } from '../firebase';
import { describeAuthError } from '../utils/authErrors';

const RESEND_COOLDOWN_SECONDS = 60;

/** Shown to email/password accounts until they open the verification link. */
export const VerifyEmailScreen: React.FC<{ user: User; onVerified: () => void }> = ({ user, onVerified }) => {
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const refreshed = await refreshCurrentUser();
      if (refreshed?.emailVerified) {
        onVerified();
      } else {
        setMessage({ tone: 'info', text: 'Not verified yet. Open the link in the email, then try again.' });
      }
    } catch (err) {
      setMessage({ tone: 'error', text: describeAuthError(err) || 'Please try again.' });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setMessage(null);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({ tone: 'info', text: 'A new link is on its way. Check your spam folder too.' });
    } catch (err) {
      setMessage({ tone: 'error', text: describeAuthError(err) || 'Could not send the email. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5">
      <div className="w-full max-w-md lm-card-editorial p-7 space-y-5 text-center">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-brand-soft text-brand grid place-items-center">
          <MailCheck className="w-6 h-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold text-ink">Check your inbox</h1>
          <p className="text-sm text-body">
            We sent a verification link to <strong className="text-ink">{user.email}</strong>. Open it,
            then come back here.
          </p>
        </div>

        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`text-sm rounded-xl px-3 py-2 ${
              message.tone === 'error' ? 'text-danger bg-danger-soft' : 'text-body bg-soft'
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl lm-btn-accent text-sm cursor-pointer"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            I've verified my email
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="w-full px-4 py-2.5 rounded-xl border border-line bg-white hover:bg-soft text-sm font-semibold text-ink cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
          </button>
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="w-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink cursor-pointer"
          >
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
};

/** Shown when .env has no Firebase project yet, instead of a broken sign-in page. */
export const FirebaseSetupScreen: React.FC = () => (
  <div className="min-h-screen bg-canvas flex items-center justify-center px-5">
    <div className="w-full max-w-lg lm-card-editorial p-7 space-y-4">
      <span className="w-12 h-12 rounded-2xl bg-warning-soft text-warning grid place-items-center">
        <Settings2 className="w-6 h-6" />
      </span>
      <h1 className="font-display text-2xl font-bold text-ink">Sign-in is not set up yet</h1>
      <p className="text-sm text-body leading-relaxed">
        Add your Firebase project's web settings (<code>VITE_FIREBASE_API_KEY</code>,{' '}
        <code>VITE_FIREBASE_PROJECT_ID</code> and the others) to <code>.env</code>, then restart{' '}
        <code>npm run dev</code>. The steps are in <code>docs/PHASE2_PLAN.md</code>, section 4.
      </p>
      <p className="text-sm text-body leading-relaxed">
        For local testing without a project, set <code>VITE_FIREBASE_USE_EMULATOR=true</code> and run{' '}
        <code>npm run emulators</code>.
      </p>
    </div>
  </div>
);
