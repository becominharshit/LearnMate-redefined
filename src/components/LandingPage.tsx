import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Flag,
  GraduationCap,
  HeartHandshake,
  Languages,
  Layers,
  Lock,
  MessageCircleQuestion,
  PenLine,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import {
  SAMPLE_FLASHCARDS,
  SAMPLE_QUESTIONS,
  type SampleLanguage,
  type SampleMcq,
  type SampleNumerical,
} from '../data/sampleChapter';
import {
  LanguageToggle,
  SampleFlashcardCard,
  SampleQuestionCard,
} from './SamplePractice';
import { getNextJeeCountdown, JEE_MAIN_2027_KEY_DATES } from '../utils/jeeCalendar';

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim();

interface LandingPageProps {
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
  onOpenSample: () => void;
  onOpenDashboard: () => void;
  onOpenSafety: () => void;
  onOpenLegal: (page: 'privacy' | 'terms' | 'contact') => void;
}

const STEPS = [
  {
    icon: Upload,
    title: 'Add your own chapter',
    body: 'Upload a PDF, photograph handwritten notes, paste text, or bring a YouTube lecture with its transcript. Your original PDF stays on your device.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Ask until it makes sense',
    body: 'Get step-by-step explanations in English or Hinglish, with the page it came from. Switch between “only my notes” and “notes + JEE knowledge”.',
  },
  {
    icon: Target,
    title: 'Practise JEE-style questions',
    body: 'Solve MCQs and numerical questions with JEE Main marking (+4 correct, −1 wrong), then see exactly where your reasoning went wrong.',
  },
  {
    icon: Layers,
    title: 'Revise what is weak',
    body: 'Turn the chapter into flashcards, a formula sheet and a short revision plan that targets the topics you keep missing.',
  },
];

const LIMITS = [
  'AI answers can be wrong. Every answer cites pages; check important steps and use Report when something looks off.',
  'We are building for JEE Main 2027 Session 1 first. JEE Advanced support comes after the February session, once its pattern is confirmed.',
  'A full 75-question, 3-hour mock test is not built yet. That is the next phase after practice and revision.',
  'NTA bans calculators and every electronic device in the exam hall. The calculator inside LearnMate is only for practice at home.',
  'YouTube import uses the official player and a transcript you paste. LearnMate does not download or re-upload videos.',
  'Image and video generation stays paused for under-18 accounts because the providers’ terms do not allow it. Claude-written study help is unaffected.',
  'LearnMate is independent. It is not affiliated with NTA, IITs or any coaching institute, and it cannot promise a rank.',
];

const PRIVACY_POINTS = [
  {
    icon: Lock,
    title: 'Private to your account',
    body: 'Your notes, questions, quiz results and profile are readable only by you. Automated tests prove another student cannot open them.',
  },
  {
    icon: FileText,
    title: 'Your PDF stays on your device',
    body: 'The original file is kept locally. Only the pages needed to answer a question are sent to Claude when you ask.',
  },
  {
    icon: ShieldCheck,
    title: 'No ads. No selling data.',
    body: 'LearnMate has no advertising, no public profiles and no leaderboards. Your material is never sold.',
  },
  {
    icon: HeartHandshake,
    title: 'Built with under-18s in mind',
    body: 'Every AI request carries safety rules. We ask for an age band, and students under 18 should study with a parent or teacher aware of it.',
  },
];

const RESOURCES = [
  {
    title: 'SATHEE',
    detail: 'Free JEE video lessons and practice from IIT Kanpur.',
    href: 'https://sathee.iitk.ac.in/',
  },
  {
    title: 'NTA Abhyas',
    detail: 'Official mock papers from the National Testing Agency.',
    href: 'https://nta.ac.in/Abhyas',
  },
  {
    title: 'JEE Main portal',
    detail: 'Registration, syllabus, admit card and official notices.',
    href: 'https://jeemain.nta.nic.in/',
  },
  {
    title: 'NCERT textbooks',
    detail: 'Free chapter-wise PDFs for Classes 11 and 12.',
    href: 'https://ncert.nic.in/textbook.php',
  },
];

const FAQS = [
  {
    question: 'Is LearnMate free?',
    answer:
      'Creating an account and reading your own material is free. AI features have a fair daily allowance so one heavy user cannot run up an unlimited bill. The exact limits are shown in the app.',
  },
  {
    question: 'Do I need to upload my coaching notes?',
    answer:
      'No. You can paste text, photograph a page or start with the free sample chapter. If you do upload material, only upload what you are allowed to use.',
  },
  {
    question: 'Will it work for JEE Advanced?',
    answer:
      'Not yet. We are focusing on JEE Main 2027 Session 1 first. JEE Advanced is planned for after the February session, when the official dates and pattern are available.',
  },
  {
    question: 'Can it replace my coaching or school teacher?',
    answer:
      'No. LearnMate is a study companion. It explains, quizzes and helps you revise, but a teacher can still spot mistakes that an AI misses.',
  },
  {
    question: 'What happens to my data when I sign out?',
    answer:
      'Private study data is removed from that browser, so the next person on a shared laptop cannot open it. Signing back in restores it from your account.',
  },
  {
    question: 'Why can’t I generate images or videos?',
    answer:
      'The image and video providers we can access require adult users. Since most JEE students are under 18, those features stay paused. Diagrams and study explanations are being built with Claude instead.',
  },
  {
    question: 'How do I report a wrong answer?',
    answer:
      'Use the Report button next to any AI answer. The report is saved privately for review. For a serious concern, use the contact page.',
  },
];

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  // Leave room for the sticky header so the section heading is not hidden underneath it.
  const top = target.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

const SectionHeading: React.FC<{
  kicker: string;
  title: string;
  description?: string;
}> = ({ kicker, title, description }) => (
  <div className="max-w-2xl space-y-2">
    <p className="lm-kicker">{kicker}</p>
    <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
      {title}
    </h2>
    {description && <p className="text-sm sm:text-base text-muted leading-relaxed">{description}</p>}
  </div>
);

/** Public landing page for visitors who are not signed in. */
export const LandingPage: React.FC<LandingPageProps> = ({
  isSignedIn,
  onSignIn,
  onSignUp,
  onOpenSample,
  onOpenDashboard,
  onOpenSafety,
  onOpenLegal,
}) => {
  const [language, setLanguage] = useState<SampleLanguage>('en');
  const countdown = useMemo(() => getNextJeeCountdown(), []);
  const examWindow = JEE_MAIN_2027_KEY_DATES.find((date) => date.label === 'Session 1 exams');
  const registrationClose = JEE_MAIN_2027_KEY_DATES.find((date) =>
    date.label.includes('registration closes')
  );
  const exampleMcq = SAMPLE_QUESTIONS.find((question): question is SampleMcq => question.kind === 'mcq');
  const exampleNumerical = SAMPLE_QUESTIONS.find(
    (question): question is SampleNumerical => question.kind === 'numerical'
  );
  const exampleFlashcard = SAMPLE_FLASHCARDS[0];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="#landing" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight">
              LearnMate
            </span>
            <span className="hidden rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand sm:inline">
              JEE
            </span>
          </a>

          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Landing page sections">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-soft hover:text-ink cursor-pointer"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('worked-example')}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-soft hover:text-ink cursor-pointer"
            >
              Try a question
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-soft hover:text-ink cursor-pointer"
            >
              FAQ
            </button>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-0">
            {isSignedIn ? (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl lm-btn-accent px-3 py-2.5 text-sm cursor-pointer sm:px-4"
              >
                Open my dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold text-ink hover:bg-soft cursor-pointer sm:px-3"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={onSignUp}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl lm-btn-accent px-3 py-2.5 text-xs cursor-pointer sm:gap-1.5 sm:px-3.5 sm:text-sm"
                >
                  <span className="sm:hidden">Sign up</span>
                  <span className="hidden sm:inline">Create free account</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line bg-white">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-soft blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-violet-100 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  JEE Main 2027 · Session 1
                </span>
                {countdown && (
                  <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted">
                    {countdown.inProgress
                      ? `${countdown.label} is happening now`
                      : `${countdown.daysLeft} days to ${countdown.label}`}
                  </span>
                )}
              </div>

              <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl sm:leading-[1.06]">
                Your JEE notes, turned into a tutor that
                <span className="text-brand"> explains, quizzes and revises.</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-body sm:text-lg">
                Bring your own chapter. Learn it step by step in English or Hinglish, check
                yourself with JEE-style questions, then revise only what you keep getting wrong.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onOpenSample}
                  className="inline-flex items-center justify-center gap-2 rounded-xl lm-btn-accent px-5 py-3 text-sm cursor-pointer"
                >
                  <BookOpenCheck className="h-4 w-4" />
                  Try the free sample chapter
                </button>
                {!isSignedIn && (
                  <button
                    type="button"
                    onClick={onSignUp}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink hover:bg-soft cursor-pointer"
                  >
                    Create free account
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                No card needed. No ads. Your material stays private to your account.
              </p>
            </div>

            <div className="relative">
              <div className="lm-card-editorial overflow-hidden">
                <div className="flex items-center justify-between border-b border-line bg-canvas px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink">
                    <PenLine className="h-4 w-4 text-brand" />
                    Conditional probability
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Page 1
                  </span>
                </div>
                <div className="space-y-4 p-5">
                  <p className="text-sm leading-relaxed text-body">
                    If B has already happened, how likely is A? The sample space shrinks from every
                    outcome to just B.
                  </p>
                  <div className="rounded-xl border border-brand-200 bg-brand-soft px-4 py-3 font-mono text-sm font-semibold text-brand">
                    P(A | B) = P(A ∩ B) / P(B)
                  </div>
                  <div className="space-y-2 text-xs text-body">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Division by the condition, not by P(A).
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      P(A | B) and P(B | A) are different.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSample}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
                  >
                    Open the full sample chapter
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="hidden sm:flex absolute -bottom-5 -left-5 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-lg">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-success-soft text-success">
                  <Languages className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold text-ink">
                  English
                  <span className="text-muted"> / Hinglish</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Worked example */}
        <section id="worked-example" className="border-b border-line py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                kicker="No login needed"
                title="Try it on a real JEE question"
                description="This is the fixed sample chapter. One MCQ, one numerical answer and one flashcard — exactly what you get inside the app, minus the AI."
              />
              <LanguageToggle value={language} onChange={setLanguage} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {exampleMcq && (
                <SampleQuestionCard question={exampleMcq} language={language} compact />
              )}
              {exampleNumerical && (
                <SampleQuestionCard question={exampleNumerical} language={language} compact />
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              {exampleFlashcard && (
                <SampleFlashcardCard card={exampleFlashcard} language={language} />
              )}
              <div className="rounded-2xl border border-dashed border-line bg-white/60 p-5 flex flex-col justify-center gap-2">
                <p className="text-sm font-semibold text-ink">Want the whole chapter?</p>
                <p className="text-xs leading-relaxed text-muted">
                  The free sample includes four concepts, four JEE-style questions, six flashcards
                  and a page-by-page revision checklist.
                </p>
                <button
                  type="button"
                  onClick={onOpenSample}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  Read the sample chapter
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-line bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
            <SectionHeading
              kicker="How it works"
              title="Four steps from your chapter to a revision plan"
              description="LearnMate does not replace your books or coaching. It helps you get more out of the material you already have."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <div key={title} className="lm-card-editorial p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-2xl font-extrabold text-muted">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-ink">{title}</h3>
                  <p className="text-xs leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Honest limits */}
        <section className="border-b border-line py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <SectionHeading
                kicker="Honest limits"
                title="What LearnMate does — and does not do yet"
                description="You should know this before trusting a study tool. We would rather be clear now than surprise you later."
              />
              {registrationClose && (
                <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-xs leading-relaxed text-ink">
                  <p className="font-bold">JEE Main 2027 Session 1</p>
                  <p className="mt-1 text-body">
                    Registration closes{' '}
                    {new Date(registrationClose.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    . Exams run {examWindow?.note || '20 to 28 Jan 2027'}. Always confirm on the
                    official NTA portal.
                  </p>
                </div>
              )}
            </div>
            <ul className="space-y-2.5">
              {LIMITS.map((limit) => (
                <li
                  key={limit}
                  className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm leading-relaxed text-body"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span>{limit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy */}
        <section className="border-b border-line bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
            <SectionHeading
              kicker="Privacy"
              title="Private by default, not as an afterthought"
              description="Most students are under 18. Their notes and mistakes are not content for ads, feeds or leaderboards."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRIVACY_POINTS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-line bg-canvas p-5 space-y-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand shadow-xs">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="text-sm font-bold text-ink">{title}</h3>
                  <p className="text-xs leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              Read the full{' '}
              <button
                type="button"
                onClick={() => onOpenLegal('privacy')}
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={onOpenSafety}
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                AI &amp; safety statement
              </button>
              .
            </p>
          </div>
        </section>

        {/* Free official resources */}
        <section className="border-b border-line py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
            <SectionHeading
              kicker="Free official resources"
              title="Good material you can use without paying"
              description="These links open the official sites in a new tab. LearnMate is not connected to any of them."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {RESOURCES.map((resource) => (
                <a
                  key={resource.title}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group lm-card-editorial flex flex-col gap-2 p-5 transition-colors hover:border-brand-200"
                >
                  <span className="flex items-center justify-between text-sm font-bold text-ink">
                    {resource.title}
                    <ExternalLink className="h-3.5 w-3.5 text-muted group-hover:text-brand" />
                  </span>
                  <span className="text-xs leading-relaxed text-muted">{resource.detail}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-line bg-white py-12 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionHeading
              kicker="FAQ"
              title="Questions students and parents ask"
              description={
                SUPPORT_EMAIL
                  ? `Still unsure? Email ${SUPPORT_EMAIL} and we will answer honestly.`
                  : 'Still unsure? Use the contact page and we will answer honestly.'
              }
            />
            <div className="divide-y divide-line rounded-2xl border border-line bg-canvas">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <Plus className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-body">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand via-indigo-600 to-violet-600 p-6 text-white shadow-lg sm:p-10">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
                aria-hidden="true"
              />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    Start with one chapter you already have.
                  </h2>
                  <p className="max-w-xl text-sm leading-relaxed text-indigo-100">
                    Create a free account, add your material and ask your first doubt. The sample
                    chapter is there if you want to look around first.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  {isSignedIn ? (
                    <button
                      type="button"
                      onClick={onOpenDashboard}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white keep-white px-5 py-3 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 cursor-pointer"
                    >
                      Open my dashboard
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={onSignUp}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white keep-white px-5 py-3 text-sm font-semibold text-[#4F46E5] hover:bg-indigo-50 cursor-pointer"
                      >
                        Create free account
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={onOpenSample}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer"
                      >
                        Try the sample first
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-muted">
            <span className="font-display text-sm font-extrabold text-ink">LearnMate</span>
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
          <p className="max-w-4xl text-[11px] leading-relaxed text-muted">
            LearnMate is an independent study tool for JEE aspirants. It is not affiliated with the
            National Testing Agency (NTA), IITs or any coaching institute. AI answers can make
            mistakes; always verify important steps against your textbook or teacher. NTA bans
            calculators and all electronic devices in the exam hall.
          </p>
          {SUPPORT_EMAIL && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Flag className="h-3.5 w-3.5" />
              Questions or concerns:{' '}
              <a className="font-semibold text-brand hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          )}
          <p className="text-[11px] text-muted">
            © {new Date().getFullYear()} LearnMate · Built for JEE Main 2027 Session 1
          </p>
        </div>
      </footer>
    </div>
  );
};
