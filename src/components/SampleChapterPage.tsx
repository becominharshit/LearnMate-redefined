import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  MessageCircleQuestion,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  SAMPLE_CHAPTER_SUBJECT,
  SAMPLE_CHAPTER_TITLE,
  SAMPLE_CONCEPTS,
  SAMPLE_FLASHCARDS,
  SAMPLE_QUESTIONS,
  sampleText,
  type SampleLanguage,
} from '../data/sampleChapter';
import {
  LanguageToggle,
  SampleFlashcardCard,
  SampleQuestionCard,
} from './SamplePractice';

interface SampleChapterPageProps {
  isSignedIn: boolean;
  sampleAdded: boolean;
  onBack: () => void;
  onAddToAccount: () => void;
  onOpenInLibrary: () => void;
  onSignUp: () => void;
  onOpenSafety: () => void;
  onOpenLegal: (page: 'privacy' | 'terms' | 'contact') => void;
}

const CHECKLIST = [
  'Conditional probability divides by the condition’s probability, not by P(A).',
  'Bayes needs the total probability in the denominator.',
  'Check whether events are independent before multiplying.',
  'Mutually exclusive and independent are not the same thing.',
  'A probability answer must lie between 0 and 1.',
];

/** Public guest preview of the fixed sample chapter. No login and no AI call. */
export const SampleChapterPage: React.FC<SampleChapterPageProps> = ({
  isSignedIn,
  sampleAdded,
  onBack,
  onAddToAccount,
  onOpenInLibrary,
  onSignUp,
  onOpenSafety,
  onOpenLegal,
}) => {
  const [language, setLanguage] = useState<SampleLanguage>('en');

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-muted hover:bg-soft hover:text-ink cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-extrabold tracking-tight">LearnMate</span>
            <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">
              SAMPLE
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle value={language} onChange={setLanguage} />
            {sampleAdded ? (
              <button
                type="button"
                onClick={onOpenInLibrary}
                className="hidden items-center gap-1.5 rounded-xl lm-btn-accent px-3.5 py-2 text-xs font-semibold sm:inline-flex cursor-pointer"
              >
                Open in my library
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onAddToAccount}
                className="hidden items-center gap-1.5 rounded-xl lm-btn-accent px-3.5 py-2 text-xs font-semibold sm:inline-flex cursor-pointer"
              >
                {isSignedIn ? 'Add to my account' : 'Sign in to add'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero */}
        <section className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-soft px-3 py-1 text-[11px] font-bold text-success">
              <Sparkles className="h-3.5 w-3.5" />
              Free sample · no AI used · no login needed
            </span>
            <span className="rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold text-muted">
              {SAMPLE_CHAPTER_SUBJECT}
            </span>
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {SAMPLE_CHAPTER_TITLE}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-body sm:text-base">
              A complete mini-chapter written by LearnMate: four concepts, four JEE-style questions
              and six flashcards. Every answer has a worked explanation, so you can see how the app
              teaches before creating an account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {sampleAdded ? (
              <button
                type="button"
                onClick={onOpenInLibrary}
                className="inline-flex items-center gap-2 rounded-xl lm-btn-accent px-4 py-2.5 text-sm cursor-pointer"
              >
                <BookOpenCheck className="h-4 w-4" />
                Open in my library
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAddToAccount}
                  className="inline-flex items-center gap-2 rounded-xl lm-btn-accent px-4 py-2.5 text-sm cursor-pointer"
                >
                  <BookOpenCheck className="h-4 w-4" />
                  {isSignedIn ? 'Add to my account' : 'Sign in to add to my account'}
                </button>
                {!isSignedIn && (
                  <button
                    type="button"
                    onClick={onSignUp}
                    className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-soft cursor-pointer"
                  >
                    Create free account
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            The sample is fixed text. It does not call AI, and adding it does not upload anything
            new. Your own material stays private when you sign in.
          </p>
        </section>

        {/* What is inside */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: BookOpenCheck, value: '4', label: 'concepts' },
            { icon: PenLine, value: '4', label: 'JEE questions' },
            { icon: Layers, value: '6', label: 'flashcards' },
            { icon: FileText, value: '4', label: 'study pages' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="lm-card-editorial flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block font-display text-xl font-extrabold text-ink">{value}</span>
                <span className="block text-[11px] text-muted">{label}</span>
              </span>
            </div>
          ))}
        </section>

        {/* Concepts */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="lm-kicker">Concepts</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              The four ideas this chapter is built on
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SAMPLE_CONCEPTS.map((concept) => (
              <article key={concept.id} className="lm-card-editorial space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-ink">
                    {sampleText(concept.title, language)}
                  </h3>
                  <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Page {concept.page}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-body">
                  {sampleText(concept.body, language)}
                </p>
                <div className="rounded-lg border border-brand-200 bg-brand-soft px-3 py-2 font-mono text-xs font-semibold text-brand">
                  {concept.formula}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Practice */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="lm-kicker">Practice</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              Four questions, with full explanations
            </h2>
            <p className="text-sm text-muted">
              Marking is +4 for a correct answer and −1 for a wrong one, for both MCQs and numerical answers, just like JEE Main.
            </p>
          </div>
          <div className="grid gap-4">
            {SAMPLE_QUESTIONS.map((question) => (
              <SampleQuestionCard key={question.id} question={question} language={language} />
            ))}
          </div>
        </section>

        {/* Flashcards */}
        <section className="space-y-4">
          <div className="space-y-1">
            <p className="lm-kicker">Revision</p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              Six flashcards for the last minute
            </h2>
            <p className="text-sm text-muted">
              Tap a card to reveal the answer. These are the same cards the app saves to your
              account.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_FLASHCARDS.map((card) => (
              <SampleFlashcardCard key={card.id} card={card} language={language} />
            ))}
          </div>
        </section>

        {/* Checklist */}
        <section className="lm-card-editorial space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-success-soft text-success">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="lm-kicker text-[10px]">Exam checklist</p>
              <h2 className="font-display text-lg font-bold text-ink">
                Five mistakes to catch before the answer sheet
              </h2>
            </div>
          </div>
          <ul className="grid gap-2 text-sm leading-relaxed text-body sm:grid-cols-2">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="rounded-3xl bg-linear-to-br from-brand via-indigo-600 to-violet-600 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">
                Now do this with your own chapter.
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-indigo-100">
                Add a PDF, a photo of your notes or a YouTube transcript. LearnMate explains it in
                English or Hinglish, makes practice questions and tracks what to revise.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {sampleAdded ? (
                <button
                  type="button"
                  onClick={onOpenInLibrary}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-indigo-50 cursor-pointer"
                >
                  Open in my library
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onAddToAccount}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand hover:bg-indigo-50 cursor-pointer"
                >
                  {isSignedIn ? 'Add this sample' : 'Sign in and add this sample'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {!isSignedIn && (
                <button
                  type="button"
                  onClick={onSignUp}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer"
                >
                  Create free account
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-5 text-xs text-muted">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            AI answers can make mistakes. This sample is fixed and written by us; AI features are
            labelled inside the app.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-brand cursor-pointer"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-brand cursor-pointer"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('contact')}
              className="hover:text-brand cursor-pointer"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={onOpenSafety}
              className="hover:text-brand cursor-pointer"
            >
              AI &amp; safety
            </button>
          </div>
          <p className="text-[11px]">
            Not affiliated with NTA or any coaching institute. NTA bans calculators and electronic
            devices in the exam hall.
          </p>
        </section>
      </main>
    </div>
  );
};
