import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Languages,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Target,
  UserRound,
} from 'lucide-react';
import {
  createAccountWithEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
} from '../firebase';
import { describeAuthError, passwordProblem } from '../utils/authErrors';
import { getNextJeeCountdown } from '../utils/jeeCalendar';

type AuthMode = 'signin' | 'signup' | 'reset';

interface AuthScreenProps {
  onOpenSafety: () => void;
  onBack?: () => void;
  onOpenLegal?: (page: 'privacy' | 'terms' | 'contact') => void;
  initialMode?: 'signin' | 'signup';
  /** Explains why the student was sent here, e.g. to add the sample chapter. */
  notice?: string | null;
}

const VALUE_POINTS = [
  { icon: BookOpenCheck, text: 'Study from your own chapters, coaching modules and notes.' },
  { icon: Languages, text: 'Step-by-step explanations in English or Hinglish.' },
  { icon: Target, text: 'JEE-style practice and revision made from your material.' },
];

/** Sign-in and sign-up page shown to everyone who is not signed in. */
export const AuthScreen: React.FC<AuthScreenProps> = ({
  onOpenSafety,
  onBack,
  onOpenLegal,
  initialMode = 'signin',
  notice: entryNotice = null,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'google' | 'email'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const countdown = useMemo(() => getNextJeeCountdown(), []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'signup') {
      const problem = passwordProblem(password);
      if (problem) {
        setError(problem);
        return;
      }
    }

    setBusy('email');
    try {
      if (mode === 'reset') {
        await sendPasswordReset(email);
        // Same message whether or not the account exists, so emails can't be probed.
        setNotice('If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.');
      } else if (mode === 'signup') {
        await createAccountWithEmail(name, email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setBusy(null);
    }
  };

  const title =
    mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back';
  const submitLabel =
    mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in';

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row">
      {/* Value panel */}
      <section className="relative overflow-hidden bg-linear-to-br from-brand via-indigo-600 to-violet-600 text-white px-6 py-6 sm:px-10 lg:w-[46%] lg:py-14 flex flex-col justify-between gap-4 lg:gap-8">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <GraduationCap className="w-5 h-5" />
          </span>
          <span className="font-display font-extrabold text-xl tracking-tight">LearnMate</span>
          <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-bold tracking-wider">JEE</span>
        </div>

        <div className="relative space-y-3 lg:space-y-5 max-w-md">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Turn your own JEE notes into explanations, practice and revision.
          </h1>
          {/* On phones the sign-in form must stay above the fold, so the details show on desktop only. */}
          <ul className="hidden lg:block space-y-3">
            {VALUE_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-indigo-50">
                <span className="w-8 h-8 rounded-lg bg-white/15 grid place-items-center shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-sm sm:text-base leading-snug pt-1">{text}</span>
              </li>
            ))}
          </ul>
          {countdown && (
            <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm font-semibold">
              {countdown.inProgress
                ? `${countdown.label} is happening now`
                : `${countdown.daysLeft} days to ${countdown.label}`}
            </p>
          )}
        </div>

        <p className="relative text-xs text-indigo-100 max-w-md">
          The tutor is an AI and can make mistakes. Not affiliated with NTA.
        </p>
      </section>

      {/* Sign-in card */}
      <main className="flex-1 flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to LearnMate
            </button>
          )}

          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
            <p className="text-sm text-muted">
              {mode === 'reset'
                ? 'Enter your email and we will send you a link to choose a new password.'
                : 'Your notes, practice and progress stay private to your account.'}
            </p>
          </div>

          {entryNotice && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-soft px-3.5 py-2.5 text-xs font-medium leading-relaxed text-brand"
            >
              <BookOpenCheck className="w-4 h-4 shrink-0 mt-0.5" />
              {entryNotice}
            </p>
          )}

          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-line bg-white hover:bg-soft text-sm font-semibold text-ink transition-colors cursor-pointer disabled:opacity-60"
              >
                {busy === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or use email
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {mode === 'signup' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink">Your name</span>
                <span className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-white focus-within:border-brand">
                  <UserRound className="w-4 h-4 text-muted shrink-0" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                  />
                </span>
              </label>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-ink">Email</span>
              <span className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-white focus-within:border-brand">
                <Mail className="w-4 h-4 text-muted shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                />
              </span>
            </label>

            {mode !== 'reset' && (
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-semibold text-ink">
                  Password
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="font-semibold text-brand hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </span>
                <span className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line bg-white focus-within:border-brand">
                  <Lock className="w-4 h-4 text-muted shrink-0" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    placeholder={mode === 'signup' ? 'At least 8 characters, letters and numbers' : 'Your password'}
                    className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                  />
                </span>
              </label>
            )}

            {error && (
              <p role="alert" className="text-sm text-danger bg-danger-soft rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-success bg-success-soft rounded-xl px-3 py-2">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy !== null || !email.trim() || (mode !== 'reset' && !password)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl lm-btn-accent text-sm cursor-pointer"
            >
              {busy === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {submitLabel}
            </button>
          </form>

          <p className="text-sm text-muted text-center">
            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-brand hover:underline cursor-pointer">
                  Sign in
                </button>
              </>
            ) : mode === 'reset' ? (
              <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-brand hover:underline cursor-pointer">
                Back to sign in
              </button>
            ) : (
              <>
                New to LearnMate?{' '}
                <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-brand hover:underline cursor-pointer">
                  Create an account
                </button>
              </>
            )}
          </p>

          <p className="flex items-start gap-2 text-xs text-muted leading-relaxed border-t border-line pt-4">
            <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <span>
              Each student's material and results are private to their own account. Read how we keep
              students safe in our{' '}
              <button type="button" onClick={onOpenSafety} className="font-semibold text-brand hover:underline cursor-pointer">
                AI &amp; safety statement
              </button>
              .
            </span>
          </p>

          {onOpenLegal && (
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted">
              <button type="button" onClick={() => onOpenLegal('privacy')} className="hover:text-brand cursor-pointer">
                Privacy
              </button>
              <button type="button" onClick={() => onOpenLegal('terms')} className="hover:text-brand cursor-pointer">
                Terms
              </button>
              <button type="button" onClick={() => onOpenLegal('contact')} className="hover:text-brand cursor-pointer">
                Contact
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
