import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Languages,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type {
  JeeExamSession,
  StudentAcademicProfile,
  StudentAgeBand,
} from '../types/study';

export interface FirstRunAnswers {
  fullName: string;
  schoolClass: 'Class 11' | 'Class 12' | 'Dropper';
  examSession: Exclude<JeeExamSession, ''>;
  preferredLanguage: 'English' | 'Hindi + English (Hinglish)';
  ageBand: Exclude<StudentAgeBand, ''>;
}

interface FirstRunSetupModalProps {
  isOpen: boolean;
  initialName: string;
  profile: StudentAcademicProfile;
  onComplete: (answers: FirstRunAnswers) => void;
  onDismiss: () => void;
  onOpenFullProfile: () => void;
}

const TOTAL_STEPS = 4;

const CLASS_OPTIONS: { id: FirstRunAnswers['schoolClass']; label: string; hint: string }[] = [
  { id: 'Class 11', label: 'Class 11', hint: 'Two years to JEE Main 2027' },
  { id: 'Class 12', label: 'Class 12', hint: 'Preparing alongside boards' },
  { id: 'Dropper', label: 'Dropper', hint: 'Focused full-time preparation' },
];

const LANGUAGE_OPTIONS: {
  id: FirstRunAnswers['preferredLanguage'];
  label: string;
  hint: string;
}[] = [
  {
    id: 'English',
    label: 'English',
    hint: 'Explanations, questions and flashcards in English',
  },
  {
    id: 'Hindi + English (Hinglish)',
    label: 'Hinglish',
    hint: 'English terms with Hindi explanations, the way most students speak',
  },
];

const AGE_OPTIONS: { id: FirstRunAnswers['ageBand']; label: string; hint: string }[] = [
  {
    id: 'under_16',
    label: 'Under 16',
    hint: 'Please study with a parent or guardian. Image and video generation stays off.',
  },
  {
    id: '16_17',
    label: '16–17',
    hint: 'You can use LearnMate. Parent/guardian approval for extra features is being added.',
  },
  {
    id: '18_plus',
    label: '18 or older',
    hint: 'Full access to the features available today. Image generation stays paused for now.',
  },
];

/** Four-question setup shown once, after a student signs in for the first time. */
export const FirstRunSetupModal: React.FC<FirstRunSetupModalProps> = ({
  isOpen,
  initialName,
  profile,
  onComplete,
  onDismiss,
  onOpenFullProfile,
}) => {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [schoolClass, setSchoolClass] = useState<FirstRunAnswers['schoolClass'] | ''>('');
  const [examSession, setExamSession] =
    useState<FirstRunAnswers['examSession']>('jee_main_2027_session_1');
  const [language, setLanguage] = useState<FirstRunAnswers['preferredLanguage']>('English');
  const [ageBand, setAgeBand] = useState<FirstRunAnswers['ageBand'] | ''>('');

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setFullName(profile.fullName || initialName || '');
    setSchoolClass(
      profile.schoolClass === 'Class 11' ||
        profile.schoolClass === 'Class 12' ||
        profile.schoolClass === 'Dropper'
        ? profile.schoolClass
        : ''
    );
    setExamSession(
      profile.examSession === 'jee_main_2027_session_2'
        ? 'jee_main_2027_session_2'
        : 'jee_main_2027_session_1'
    );
    setLanguage(
      profile.preferredLanguage === 'Hindi + English (Hinglish)'
        ? 'Hindi + English (Hinglish)'
        : 'English'
    );
    setAgeBand(
      profile.ageBand === 'under_16' ||
        profile.ageBand === '16_17' ||
        profile.ageBand === '18_plus'
        ? profile.ageBand
        : ''
    );
  }, [isOpen, initialName, profile]);

  if (!isOpen) return null;

  const canContinue =
    step === 0
      ? fullName.trim().length >= 2
      : step === 1
        ? Boolean(schoolClass)
        : step === 2
          ? Boolean(language)
          : Boolean(ageBand);

  const finish = () => {
    if (!schoolClass || !ageBand) return;
    onComplete({
      fullName: fullName.trim(),
      schoolClass,
      examSession,
      preferredLanguage: language,
      ageBand,
    });
  };

  const next = () => {
    if (!canContinue) return;
    if (step === TOTAL_STEPS - 1) {
      finish();
      return;
    }
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  };

  const back = () => setStep((current) => Math.max(0, current - 1));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-xs sm:items-center"
    >
      <div className="my-6 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-line bg-canvas px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="lm-kicker text-[10px]">First-run setup</p>
              <h2 id="first-run-title" className="font-display text-lg font-bold text-ink">
                Let’s make LearnMate yours
              </h2>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-muted">
              {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full ${
                  index <= step ? 'bg-brand' : 'bg-line'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">What should we call you?</h3>
                <p className="text-xs leading-relaxed text-muted">
                  This is only used in your dashboard and explanations. It is saved privately to
                  your account.
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink">Your name</span>
                <span className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 focus-within:border-brand">
                  <UserRound className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    autoFocus
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
                  />
                </span>
              </label>
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                We do not show your name to other students. There are no public profiles.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">Where are you in your JEE journey?</h3>
                <p className="text-xs leading-relaxed text-muted">
                  This changes the countdown and the tone of your study plan.
                </p>
              </div>
              <div className="grid gap-2">
                {CLASS_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSchoolClass(option.id)}
                    aria-pressed={schoolClass === option.id}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                      schoolClass === option.id
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-white hover:border-brand-200 hover:bg-canvas'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        schoolClass === option.id
                          ? 'bg-brand text-white'
                          : 'border border-line bg-white text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="block text-[11px] text-muted">{option.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-ink">Which exam session?</span>
                <select
                  value={examSession}
                  onChange={(event) =>
                    setExamSession(event.target.value as FirstRunAnswers['examSession'])
                  }
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
                >
                  <option value="jee_main_2027_session_1">
                    JEE Main 2027 · Session 1 (20–28 Jan)
                  </option>
                  <option value="jee_main_2027_session_2">
                    JEE Main 2027 · Session 2 (2–7 Apr)
                  </option>
                </select>
              </label>
              <p className="text-[11px] leading-relaxed text-muted">
                JEE Advanced support is planned for after the February session. Session 1 is the
                current focus.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">How should we explain things?</h3>
                <p className="text-xs leading-relaxed text-muted">
                  You can switch language on any explanation, flashcard or practice question.
                </p>
              </div>
              <div className="grid gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setLanguage(option.id)}
                    aria-pressed={language === option.id}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                      language === option.id
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-white hover:border-brand-200 hover:bg-canvas'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        language === option.id
                          ? 'bg-brand text-white'
                          : 'border border-line bg-white text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <Languages className="h-3.5 w-3.5 text-brand" />
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">How old are you?</h3>
                <p className="text-xs leading-relaxed text-muted">
                  We ask because AI providers have different age rules. No date of birth is
                  collected.
                </p>
              </div>
              <div className="grid gap-2">
                {AGE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAgeBand(option.id)}
                    aria-pressed={ageBand === option.id}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                      ageBand === option.id
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-white hover:border-brand-200 hover:bg-canvas'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                        ageBand === option.id
                          ? 'bg-brand text-white'
                          : 'border border-line bg-white text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="block text-[11px] leading-relaxed text-muted">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-success/30 bg-success-soft px-3.5 py-3 text-[11px] leading-relaxed text-ink">
                <p className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Your answers are saved privately
                </p>
                <p className="mt-1 text-body">
                  You can change your name, class, language and age band later in Profile. Your
                  name is pre-filled from {initialName ? 'your account' : 'your sign-up'}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
          >
            I’ll do this later
          </button>
          <button
            type="button"
            onClick={onOpenFullProfile}
            className="hidden text-xs font-semibold text-brand hover:underline sm:inline cursor-pointer"
          >
            More about you
          </button>
          <div className="ml-auto flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-xs font-semibold text-ink hover:bg-soft cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl lm-btn-accent px-4 text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              {step === TOTAL_STEPS - 1 ? (
                <>
                  Start studying
                  <Sparkles className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
