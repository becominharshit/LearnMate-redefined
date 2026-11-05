import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Flag,
  GraduationCap,
  HeartHandshake,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim();

type LegalKind = 'privacy' | 'terms' | 'contact';

interface LegalPageProps {
  page: LegalKind;
  onBack: () => void;
  onOpenSafety: () => void;
  onOpenPage: (page: LegalKind) => void;
}

interface LegalSection {
  title: string;
  paragraphs?: string[];
  points?: string[];
}

const LAST_UPDATED = '4 November 2026';

const PRIVACY: LegalSection[] = [
  {
    title: '1. Who we are and what this covers',
    paragraphs: [
      'LearnMate is an independent study tool for students preparing for JEE Main. This policy explains what we collect, why we collect it, where it goes and what control you have. It covers the website, the student dashboard and the AI study features.',
      'It is written to be read. If something is unclear, tell us using the contact page.',
    ],
  },
  {
    title: '2. What we collect',
    points: [
      'Account details: your name, email address, profile photo if you use Google, and whether your email is verified.',
      'Setup and profile: your class, exam session, preferred language and age band. School, board, subjects and goals are optional.',
      'Study data: text from material you add, your notes, questions you ask, quiz answers, flashcards, revision plans and focus-timer sessions.',
      'AI requests: the question you ask and the excerpts from your material needed to answer it. We also record which model answered and basic usage counts.',
      'Device preferences: theme, accessibility settings and language. The original PDF file stays in your browser on your device.',
      'Technical records: sign-in status and rate-limit counters. Server logs are designed not to contain your name, email, notes or login token.',
    ],
  },
  {
    title: '3. Why we use it',
    points: [
      'To sign you in and keep your material separate from every other student.',
      'To explain your notes, write practice questions, make revision material and show your progress.',
      'To enforce daily limits, prevent abuse and fix errors.',
      'To answer support requests and investigate reports about a wrong or unsafe AI answer.',
    ],
  },
  {
    title: '4. AI processing',
    paragraphs: [
      'AI features currently use Claude, made by Anthropic. When you ask a question, LearnMate sends Claude your question and only the relevant pages or notes needed to answer it, together with safety instructions. It does not send your whole library by default.',
      'Anthropic’s commercial terms state that it does not train its models on this data and normally deletes it within 30 days. We do not send your material to Gemini, Higgsfield or any image/video generator. Those integrations are disabled.',
    ],
  },
  {
    title: '5. Where your data is stored',
    paragraphs: [
      'Your account and study data are stored in Google Firebase (Cloud Firestore) under your own user ID. Firestore security rules allow only your verified account to read or write that area. Automated tests check that another student cannot open your material.',
      'Your browser also keeps a local copy so the app works smoothly. On a shared device, signing out removes private study data from that browser.',
      'No internet service can promise perfect security. We use HTTPS, security headers, sign-in checks, request-size limits and per-student usage limits, and we keep the amount of data we collect to what the study features need.',
    ],
  },
  {
    title: '6. Students under 18',
    points: [
      'We ask for an age band, not a date of birth. This helps us apply the right safeguards and provider rules.',
      'Students under 18 should use LearnMate with a parent, guardian or teacher aware of it. A parent/guardian approval flow for extra features is being built.',
      'We do not show advertising, sell data, publish public profiles or run leaderboards.',
      'Image and video generation stays off for under-18 accounts because the available providers require adult users.',
      'If you are a parent or guardian and want to review, correct or remove a student’s data, contact us.',
    ],
  },
  {
    title: '7. Who we share it with',
    points: [
      'Google Firebase: sign-in and the private database.',
      'Anthropic: the AI answer, using only the material needed for your request.',
      'Our hosting provider: to run the website and server.',
      'Authorities: only when the law requires it, or to protect a student from serious harm.',
      'We do not sell your data, rent it to advertisers or use it to build a public profile of you.',
    ],
  },
  {
    title: '8. How long we keep it',
    paragraphs: [
      'Account and study data stay while your account is active, so your library and progress are available when you return. Local data stays in your browser until you sign out or clear it. AI providers keep their copy only for the short period described in their commercial terms.',
      'Account deletion and a “download my data” control are planned before public launch. Until they are live, contact us if you need data removed and we will handle it manually.',
    ],
  },
  {
    title: '9. Your choices and rights',
    points: [
      'You can change your name, class, language, age band and optional profile details in Profile.',
      'You can delete individual study documents from your library.',
      'You can ask us for a copy of your data, correct it or delete it by contacting us.',
      'You can withdraw consent for optional features by not using them and asking us to delete the related data.',
      'You can complain to us first, and to the appropriate data-protection authority if we do not resolve it.',
    ],
  },
  {
    title: '10. Changes to this policy',
    paragraphs: [
      'If we change how the service handles data, we will update this page and change the date at the top. Material changes that affect students will be explained in the app before they take effect.',
    ],
  },
];

const TERMS: LegalSection[] = [
  {
    title: '1. Agreement',
    paragraphs: [
      'By creating an account or using LearnMate, you agree to these Terms and the Privacy Policy. If you are under 18, a parent or guardian should review them with you.',
    ],
  },
  {
    title: '2. What LearnMate is',
    paragraphs: [
      'LearnMate is an AI-assisted study companion for JEE Main. It helps you understand your own material, practise questions and revise. It is not a coaching institute, a school, an exam centre or an official NTA service.',
      'LearnMate is not affiliated with the National Testing Agency, IITs, NCERT or any coaching institute. Always confirm exam dates, the syllabus and rules on the official NTA website.',
    ],
  },
  {
    title: '3. Accounts',
    points: [
      'Give accurate information and keep your password and device secure.',
      'One person should use one account. Do not share an account or sell access.',
      'You are responsible for activity under your account. Tell us promptly if you think someone else has access.',
      'We may suspend an account that is used to abuse the service, bypass limits or harm another person.',
    ],
  },
  {
    title: '4. Acceptable use',
    points: [
      'Use LearnMate for your own study and revision.',
      'Only upload material you own or are allowed to use. Do not upload someone else’s copyrighted book or paid course without permission.',
      'Do not use the AI to cheat in a live exam, test or assessed assignment.',
      'Do not attempt to break the security rules, access another student’s data, scrape the service or overload the server.',
      'Do not use the service to create or share illegal, harmful, abusive or sexually explicit content.',
    ],
  },
  {
    title: '5. AI answers can be wrong',
    paragraphs: [
      'The tutor, practice questions, flashcards, summaries and diagrams are generated by an AI model. They can be incomplete, outdated or simply wrong. Every AI answer is labelled, and important steps should be checked against your textbook or teacher.',
      'Use the Report button when an answer looks wrong or inappropriate. We review reports, but we cannot guarantee that every mistake will be found or corrected before you see it.',
    ],
  },
  {
    title: '6. Your content',
    paragraphs: [
      'You keep ownership of the material you upload and the notes you write. You give LearnMate permission to store, process and display that material only to provide the study features you ask for. This permission ends when you delete the material or your account, apart from short-lived backups and provider retention.',
    ],
  },
  {
    title: '7. Free service and limits',
    paragraphs: [
      'LearnMate is currently free to use. AI features have daily allowances so one account cannot create unlimited cost or overload the service. We may change the allowances, features or availability, and we will explain meaningful changes in the app.',
      'We do not promise uninterrupted availability. Maintenance, provider outages or network problems can make a feature temporarily unavailable.',
    ],
  },
  {
    title: '8. Third-party services',
    paragraphs: [
      'LearnMate uses Google Firebase for sign-in and storage, Anthropic for AI answers, and official YouTube embeds for video. Their terms and privacy policies also apply. LearnMate does not control their availability or their own data practices beyond the settings we choose.',
    ],
  },
  {
    title: '9. No guarantee of results',
    paragraphs: [
      'LearnMate does not guarantee a score, rank, admission or improvement. Your result depends on your own study, teaching, exam conditions and many factors outside the app.',
    ],
  },
  {
    title: '10. Limitation of liability',
    paragraphs: [
      'To the extent permitted by law, LearnMate is provided “as is” and is not liable for indirect or consequential loss, lost data, or decisions you make from an AI answer. Nothing in these Terms limits rights that cannot be limited under applicable law.',
    ],
  },
  {
    title: '11. Ending use',
    paragraphs: [
      'You may stop using LearnMate at any time. We may suspend or end access if these Terms are seriously or repeatedly broken, or if continuing would harm another student or the service. Account deletion is being built; until then, contact us to request it.',
    ],
  },
  {
    title: '12. Changes and governing law',
    paragraphs: [
      'We may update these Terms; the date at the top will change. Continued use after an update means you accept the new version. These Terms are governed by the laws of India, and disputes are subject to the courts of India.',
    ],
  },
];

const LEGAL_TITLES: Record<LegalKind, { title: string; intro: string }> = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'What LearnMate collects, why it needs it, where it goes and how you can control it. Written for students and parents, not just lawyers.',
  },
  terms: {
    title: 'Terms of Use',
    intro:
      'The rules for using LearnMate, what the AI can and cannot promise, and what we expect from each other.',
  },
  contact: {
    title: 'Contact & grievance',
    intro:
      'How to reach a human about a bug, a wrong AI answer, privacy, safety or a complaint.',
  },
};

const ContactBody: React.FC<{ onOpenSafety: () => void }> = ({ onOpenSafety }) => (
  <div className="space-y-6">
    <section className="lm-card-editorial space-y-3 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <Mail className="h-4 w-4" />
        </span>
        Email support
      </h2>
      {SUPPORT_EMAIL ? (
        <>
          <p className="text-sm leading-relaxed text-body">
            Write to{' '}
            <a
              className="font-semibold text-brand hover:underline"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            . Please include:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-body">
            <li>The email address on your LearnMate account (never send your password).</li>
            <li>What you were doing and what went wrong.</li>
            <li>The device and browser, if the problem is visual or technical.</li>
            <li>For a wrong AI answer, the question and a screenshot if you can.</li>
          </ul>
          <p className="text-sm leading-relaxed text-body">
            We aim to reply within a few working days. Grievances made under India’s IT Rules will
            be acknowledged and handled within the timelines those rules require.
          </p>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-body">
          The support email will be published here before public launch. Until then, use the
          Report button next to any AI answer for content problems, and check back on this page for
          the contact address.
        </p>
      )}
    </section>

    <section className="lm-card-editorial space-y-3 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <Flag className="h-4 w-4" />
        </span>
        Grievance officer
      </h2>
      <p className="text-sm leading-relaxed text-body">
        For a formal grievance about privacy, safety or content, use the support email with
        “Grievance” in the subject. Name and postal details of the grievance officer will be
        published here before public launch, as required for an Indian intermediary.
      </p>
    </section>

    <section className="lm-card-editorial space-y-3 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <ShieldCheck className="h-4 w-4" />
        </span>
        Safety and exam stress
      </h2>
      <p className="text-sm leading-relaxed text-body">
        If something on LearnMate feels unsafe, tell us immediately through the Report button or
        email. For a wrong answer, the Report button is faster than a general email.
      </p>
      <p className="text-sm leading-relaxed text-body">
        Exam stress can feel overwhelming. Talk to a parent, teacher or friend you trust.
        Tele-MANAS, the Government of India’s free mental health helpline, is available 24×7 on
        14416 or 1-800-891-4416.
      </p>
      <button
        type="button"
        onClick={onOpenSafety}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline cursor-pointer"
      >
        Read the full AI &amp; safety statement
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>

    <section className="lm-card-editorial space-y-3 p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <HeartHandshake className="h-4 w-4" />
        </span>
        Official exam help
      </h2>
      <p className="text-sm leading-relaxed text-body">
        LearnMate cannot change an NTA application, admit card or result. Use the official portal
        for those:
      </p>
      <a
        href="https://jeemain.nta.nic.in/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
      >
        jeemain.nta.nic.in
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </section>
  </div>
);

/** Privacy, Terms and Contact pages, readable without an account. */
export const LegalPage: React.FC<LegalPageProps> = ({
  page,
  onBack,
  onOpenSafety,
  onOpenPage,
}) => {
  const meta = LEGAL_TITLES[page];
  const sections = page === 'privacy' ? PRIVACY : page === 'terms' ? TERMS : [];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-muted hover:bg-soft hover:text-ink cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-extrabold tracking-tight">LearnMate</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="space-y-2">
          <p className="lm-kicker">Legal</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {meta.title}
          </h1>
          <p className="text-sm leading-relaxed text-muted">{meta.intro}</p>
          <p className="text-xs text-muted">Last updated {LAST_UPDATED}</p>
        </header>

        {page === 'contact' ? (
          <ContactBody onOpenSafety={onOpenSafety} />
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <section key={section.title} className="lm-card-editorial space-y-3 p-5 sm:p-6">
                <h2 className="font-display text-lg font-bold text-ink">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-body">
                    {paragraph}
                  </p>
                ))}
                {section.points && (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-body">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        {page === 'privacy' && (
          <p className="flex items-start gap-2 rounded-xl border border-line bg-white p-4 text-xs leading-relaxed text-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            If you are under 18, read this with a parent or guardian. If you want a copy of your
            data or want it deleted, use the contact page.
          </p>
        )}

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-xs font-semibold text-muted">
          {(
            [
              { id: 'privacy' as const, label: 'Privacy Policy' },
              { id: 'terms' as const, label: 'Terms of Use' },
              { id: 'contact' as const, label: 'Contact & grievance' },
            ]
          )
            .filter((item) => item.id !== page)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenPage(item.id)}
                className="hover:text-brand cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          <button
            type="button"
            onClick={onOpenSafety}
            className="hover:text-brand cursor-pointer"
          >
            AI &amp; safety
          </button>
        </nav>

        <p className="text-[11px] leading-relaxed text-muted">
          LearnMate is an independent study tool, not affiliated with NTA or any coaching
          institute. This page is product information, not legal advice to you.
        </p>
      </main>
    </div>
  );
};
