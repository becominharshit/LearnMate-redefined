import React from 'react';
import { ArrowLeft, Bot, HeartHandshake, Lock, ShieldCheck, Flag } from 'lucide-react';

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim();

const SECTIONS = [
  {
    icon: Bot,
    title: 'You are talking to an AI',
    points: [
      'LearnMate\'s tutor, practice questions, flashcards and other study help are written by an AI model (Claude, made by Anthropic), not by a human teacher.',
      'AI can make mistakes. Check important answers against your textbook or teacher, and use the Report button whenever something looks wrong.',
      'LearnMate is not affiliated with the National Testing Agency (NTA) and does not guarantee any exam result.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'How we keep students safe',
    points: [
      'Most of our students are under 18, so every request to the AI includes rules to keep answers age-appropriate and focused on studying. Harmful requests are refused.',
      'You must sign in to use AI features, and each account has daily limits to prevent misuse.',
      'Every AI answer has a Report button. Reports are saved for the LearnMate team to review.',
      'Image and video generation is paused until age checks are in place, because some providers only allow adult users.',
    ],
  },
  {
    icon: Lock,
    title: 'Your data',
    points: [
      'Your uploaded material, notes, practice results and profile are private to your account. Other students can never see them.',
      'We do not show ads and we do not sell your data.',
      'To answer your questions, your question and the relevant part of your notes are sent to Anthropic. Anthropic\'s commercial terms say it does not train its models on this data, and it normally deletes it within 30 days.',
    ],
  },
  {
    icon: HeartHandshake,
    title: 'If exam stress feels too much',
    points: [
      'You are not alone. Talk to a parent, teacher or friend you trust.',
      'Tele-MANAS, the Government of India\'s free mental health helpline, is available 24×7: call 14416 or 1-800-891-4416.',
    ],
  },
];

/** Public page: what the AI is, how students are protected, and how data is handled. */
export const SafetyStatementPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="min-h-screen bg-canvas">
    <div className="max-w-3xl mx-auto px-5 py-8 sm:py-12 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <header className="space-y-2">
        <p className="lm-kicker">LearnMate JEE</p>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
          AI &amp; safety statement
        </h1>
        <p className="text-sm text-muted">Last updated 3 November 2026</p>
      </header>

      {SECTIONS.map(({ icon: Icon, title, points }) => (
        <section key={title} className="lm-card-editorial p-5 sm:p-6 space-y-3">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
            <span className="w-8 h-8 rounded-lg bg-brand-soft text-brand grid place-items-center">
              <Icon className="w-4 h-4" />
            </span>
            {title}
          </h2>
          <ul className="space-y-2 text-sm text-body leading-relaxed list-disc pl-5">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="lm-card-editorial p-5 sm:p-6 space-y-2">
        <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
          <span className="w-8 h-8 rounded-lg bg-brand-soft text-brand grid place-items-center">
            <Flag className="w-4 h-4" />
          </span>
          Contact us
        </h2>
        <p className="text-sm text-body leading-relaxed">
          {SUPPORT_EMAIL ? (
            <>
              Questions, complaints or a safety concern? Email{' '}
              <a className="font-semibold text-brand hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              . We aim to reply within a few working days.
            </>
          ) : (
            'Use the Report button on any AI answer to tell us about a problem.'
          )}
        </p>
      </section>
    </div>
  </div>
);
