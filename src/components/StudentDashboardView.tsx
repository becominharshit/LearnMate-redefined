import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Atom,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  FlaskConical,
  Layers,
  ListChecks,
  MessageCircleQuestion,
  Send,
  Sigma,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react';
import { StudyDocument, StudentAcademicProfile } from '../types/study';
import { studyStorage } from '../services/storageService';
import { getNextJeeCountdown } from '../utils/jeeCalendar';
import {
  JeeSubject,
  classifyJeeSubject,
} from '../utils/jeeSubjects';
import { isProfileSetupComplete } from '../utils/studentProfile';
import type { ActiveTab } from './Navbar';
import type { StudySubMode } from './StudyView';
import { AddMaterialBox } from './AddMaterialBox';
import type { AddMaterialMode } from './AddMaterialModal';
import { StreakTracker } from './StreakTracker';

interface StudentDashboardViewProps {
  studentName?: string;
  documents: StudyDocument[];
  activeDoc: StudyDocument | null;
  onSelectDoc: (doc: StudyDocument, mode?: StudySubMode) => void;
  onDeleteDoc: (docId: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenAddMaterial: (mode: AddMaterialMode, file?: File) => void;
  onAskDoubt: (question: string) => void;
  onAddSampleChapter?: () => void;
  sampleIsAdded?: boolean;
  isProcessingMaterial?: boolean;
  studentProfile?: StudentAcademicProfile;
  /** True while the private cloud profile is still loading after sign-in. */
  isProfileSyncing?: boolean;
  onOpenProfileModal?: () => void;
}

const SUBJECT_STYLE: Record<
  JeeSubject,
  { icon: React.ComponentType<{ className?: string }>; text: string; soft: string }
> = {
  Physics: { icon: Atom, text: 'text-physics', soft: 'bg-physics-soft' },
  Chemistry: {
    icon: FlaskConical,
    text: 'text-chemistry',
    soft: 'bg-chemistry-soft',
  },
  Mathematics: { icon: Sigma, text: 'text-maths', soft: 'bg-maths-soft' },
};

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'recently';
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86_400_000
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  studentName,
  documents,
  activeDoc,
  onSelectDoc,
  onDeleteDoc,
  onNavigateTab,
  onOpenAddMaterial,
  onAskDoubt,
  onAddSampleChapter,
  sampleIsAdded = false,
  isProcessingMaterial = false,
  studentProfile,
  isProfileSyncing = false,
  onOpenProfileModal,
}) => {
  const [doubtInput, setDoubtInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), [documents]);
  const countdown = useMemo(() => getNextJeeCountdown(now), [now]);

  const docActivityDates = useMemo(() => {
    const dates: Date[] = [];
    for (const doc of documents) {
      if (doc.lastStudiedAt) dates.push(new Date(doc.lastStudiedAt));
      if (doc.createdAt) dates.push(new Date(doc.createdAt));
    }
    return dates;
  }, [documents]);

  const sortedDocs = useMemo(
    () =>
      [...documents].sort(
        (a, b) => Date.parse(b.lastStudiedAt || b.createdAt) - Date.parse(a.lastStudiedAt || a.createdAt)
      ),
    [documents]
  );

  const continueDoc = activeDoc || sortedDocs[0] || null;

  const dueTodayItems = useMemo(() => {
    const todayIso = now.toISOString().slice(0, 10);
    const items: Array<{
      id: string;
      kind: 'task' | 'flashcard';
      title: string;
      detail: string;
      doc: StudyDocument;
    }> = [];

    for (const doc of documents) {
      const tasks = studyStorage.getRevisionPlan(doc.id).filter((t) => !t.completed);
      for (const task of tasks.slice(0, 3)) {
        items.push({
          id: `task-${doc.id}-${task.id}`,
          kind: 'task',
          title: task.topic,
          detail: task.recommendedAction,
          doc,
        });
      }

      const bundle = studyStorage.getQuickReviseBundle(doc.id);
      if (bundle?.flashcards) {
        const dueCards = bundle.flashcards.filter((card) => {
          const nextIso = card.nextReviewDate || card.nextReviewAt;
          return (
            card.status === 'review_again' ||
            Boolean(nextIso && nextIso.slice(0, 10) <= todayIso)
          );
        });
        if (dueCards.length > 0) {
          items.push({
            id: `fc-${doc.id}`,
            kind: 'flashcard',
            title: `${dueCards.length} flashcard${dueCards.length === 1 ? '' : 's'} due`,
            detail: `From ${doc.title.replace(/\.pdf$/i, '')}`,
            doc,
          });
        }
      }
    }

    return items.slice(0, 5);
  }, [documents, now]);

  const setupDone = isProfileSetupComplete(studentProfile);
  const cleanName = (studentName || '').trim();

  const handleDoubtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = doubtInput.trim();
    if (!trimmed) return;
    setDoubtInput('');
    onAskDoubt(trimmed);
  };

  return (
    <div className="space-y-6" data-testid="student-home-view">
      {/* 1. Compact Countdown & Greeting Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {greetingFor(now)}
            {cleanName ? `, ${cleanName}` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            {studentProfile?.schoolClass ? `${studentProfile.schoolClass} · ` : ''}
            JEE Main 2027 Session 1 preparation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {countdown && (
            <div
              data-testid="home-compact-countdown"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-warning-soft border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-900 dark:text-amber-300"
            >
              <Flame className="w-4 h-4 text-warning shrink-0" />
              <span>
                {countdown.inProgress
                  ? `${countdown.label} is live (${countdown.startDate})`
                  : `${countdown.daysLeft} days to ${countdown.label} (${countdown.startDate})`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigateTab('analytics')}
            data-testid="home-view-progress-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink transition-colors cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-brand" />
            <span>Progress</span>
          </button>
        </div>
      </section>

      {/* Optional profile setup reminder banner (disappears once setupCompleted is true) */}
      {!isProfileSyncing && !setupDone && onOpenProfileModal && (
        <div
          data-testid="profile-setup-banner"
          className="rounded-2xl border border-brand-200 dark:border-brand/30 bg-brand-soft/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-ink">
            <UserRound className="w-4 h-4 text-brand shrink-0" />
            <span>
              <strong>Set up your JEE profile</strong> (4 quick questions: name, class, language, age band).
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="px-3.5 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold cursor-pointer"
          >
            Complete setup
          </button>
        </div>
      )}

      {/* Streak Tracker: Consecutive days of study activity retrieved from localStorage */}
      <StreakTracker supplementalDates={docActivityDates} />

      {/* 2. Add Study Material Box at the top of Home */}
      <AddMaterialBox
        isProcessing={isProcessingMaterial}
        onDropFile={(file) => {
          if (file.type.startsWith('image/')) {
            onOpenAddMaterial('photo', file);
          } else {
            onOpenAddMaterial('pdf', file);
          }
        }}
        onOpenMode={(mode) => onOpenAddMaterial(mode)}
      />

      {/* 3. "What you can do" Guide until the first upload */}
      {documents.length === 0 && (
        <section
          aria-labelledby="first-upload-guide-heading"
          data-testid="what-you-can-do-guide"
          className="lm-card-editorial p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="lm-kicker">Getting started</p>
              <h2
                id="first-upload-guide-heading"
                className="font-display text-lg sm:text-xl font-extrabold text-ink"
              >
                What you can do once you add a chapter
              </h2>
            </div>
            {onAddSampleChapter && !sampleIsAdded && (
              <button
                type="button"
                onClick={onAddSampleChapter}
                data-testid="home-try-sample-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-brand-200 bg-brand-soft text-brand text-xs font-bold hover:bg-brand hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Add the free Probability sample chapter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1.5">
              <span className="w-7 h-7 rounded-lg bg-brand-soft text-brand flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </span>
              <p className="font-bold text-ink">1. Read &amp; Ask side by side</p>
              <p className="text-muted leading-relaxed">
                Read your PDF or lecture notes alongside a streaming JEE tutor in English or Hinglish.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1.5">
              <span className="w-7 h-7 rounded-lg bg-success-soft text-success flex items-center justify-center">
                <Target className="w-4 h-4" />
              </span>
              <p className="font-bold text-ink">2. Practise JEE questions</p>
              <p className="text-muted leading-relaxed">
                Solve chapter MCQs and numerical questions with +4 / −1 JEE Main marking.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1.5">
              <span className="w-7 h-7 rounded-lg bg-warning-soft text-warning flex items-center justify-center">
                <ListChecks className="w-4 h-4" />
              </span>
              <p className="font-bold text-ink">3. Diagnose Mistake DNA</p>
              <p className="text-muted leading-relaxed">
                See whether you lost marks to a concept gap, formula slip, or sign error.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-1.5">
              <span className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </span>
              <p className="font-bold text-ink">4. Revise flashcards &amp; sheets</p>
              <p className="text-muted leading-relaxed">
                Review spaced-repetition flashcards, mind maps, and one-page summary sheets.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Main 2-column grid: Continue + My Materials on left, Ask a Doubt + Due Today on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* 4. Continue Card */}
          {continueDoc && (
            <section
              aria-labelledby="continue-studying-heading"
              data-testid="home-continue-card"
              className="lm-card-editorial p-5 sm:p-6 space-y-4 border-brand-200/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="lm-kicker" id="continue-studying-heading">
                    Continue studying
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-extrabold text-ink truncate">
                    {continueDoc.title.replace(/\.pdf$/i, '')}
                  </h2>
                  <p className="text-xs text-muted line-clamp-2">
                    {continueDoc.overview || `${continueDoc.pageCount} pages ready for study.`}
                  </p>
                </div>
                {(() => {
                  const subj =
                    classifyJeeSubject(
                      `${continueDoc.title} ${continueDoc.topics.map((t) => t.name).join(' ')}`
                    ) || 'Physics';
                  const style = SUBJECT_STYLE[subj];
                  const Icon = style.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${style.soft} ${style.text}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {subj}
                    </span>
                  );
                })()}
              </div>

              {continueDoc.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {continueDoc.topics.slice(0, 4).map((topic) => (
                    <span
                      key={topic.id}
                      className="px-2.5 py-1 rounded-full bg-soft text-ink text-[11px] font-medium"
                    >
                      {topic.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSelectDoc(continueDoc, 'explain')}
                  data-testid="continue-open-study-btn"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open in Study</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectDoc(continueDoc, 'explain');
                    onNavigateTab('practice');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-brand" />
                  <span>Practise questions</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectDoc(continueDoc, 'explain');
                    onNavigateTab('revision');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                >
                  <ListChecks className="w-3.5 h-3.5 text-brand" />
                  <span>Revise</span>
                </button>
              </div>
            </section>
          )}

          {/* 5. My Materials Library */}
          <section
            aria-labelledby="my-materials-heading"
            data-testid="home-materials-library"
            className="lm-card-editorial p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 id="my-materials-heading" className="font-display text-base font-bold text-ink">
                  My materials ({documents.length})
                </h2>
                <p className="text-xs text-muted">
                  Your uploaded PDFs, scanned notes, and YouTube lectures
                </p>
              </div>
            </div>

            {sortedDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-ink">Your library is empty</p>
                <p className="text-xs text-muted">
                  Use the box above to drop a PDF, scan handwritten notes, or paste a YouTube transcript.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {sortedDocs.map((doc) => {
                  const subj =
                    classifyJeeSubject(
                      `${doc.title} ${doc.topics.map((t) => t.name).join(' ')}`
                    ) || 'Physics';
                  const style = SUBJECT_STYLE[subj];
                  const Icon = style.icon;
                  const isActive = continueDoc?.id === doc.id;
                  const isConfirming = confirmDeleteId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      data-testid={`material-item-${doc.id}`}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${style.soft} ${style.text}`}
                          >
                            <Icon className="w-3 h-3" />
                            {subj}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectDoc(doc, 'explain')}
                            className="text-sm font-bold text-ink hover:text-brand truncate text-left cursor-pointer"
                          >
                            {doc.title.replace(/\.pdf$/i, '')}
                          </button>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span>
                            {doc.topics.length > 0
                              ? doc.topics
                                  .slice(0, 3)
                                  .map((t) => t.name)
                                  .join(' · ')
                              : `${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}`}
                          </span>
                          <span>
                            · Opened {relativeTime(doc.lastStudiedAt || doc.createdAt, now)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectDoc(doc, 'explain')}
                          className="px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                        >
                          Study
                        </button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteDoc(doc.id);
                                setConfirmDeleteId(null);
                              }}
                              data-testid={`confirm-delete-${doc.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-lg border border-line text-xs text-muted hover:text-ink cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            aria-label={`Delete ${doc.title}`}
                            data-testid={`delete-material-${doc.id}`}
                            className="p-1.5 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-danger-soft hover:border-danger/30 text-muted hover:text-danger transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column: Ask a doubt + Due today */}
        <div className="lg:col-span-5 space-y-6">
          {/* 6. Ask a Doubt Box */}
          <section
            aria-labelledby="ask-a-doubt-heading"
            data-testid="home-ask-doubt-box"
            className="lm-card-editorial p-5 sm:p-6 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <MessageCircleQuestion className="w-4 h-4" />
              </span>
              <div>
                <h2 id="ask-a-doubt-heading" className="font-display text-base font-bold text-ink">
                  Ask a JEE doubt
                </h2>
                <p className="text-xs text-muted">
                  Streams step by step from your notes + JEE knowledge
                </p>
              </div>
            </div>

            <form onSubmit={handleDoubtSubmit} className="space-y-2.5">
              <textarea
                rows={3}
                value={doubtInput}
                onChange={(e) => setDoubtInput(e.target.value)}
                placeholder={
                  continueDoc
                    ? `Ask anything about ${continueDoc.title.replace(/\.pdf$/i, '')} or a JEE concept…`
                    : 'e.g. Why is work done in an isothermal reversible expansion maximum?'
                }
                data-testid="home-doubt-input"
                className="w-full rounded-xl border border-line bg-canvas p-3 text-xs sm:text-sm text-ink placeholder:text-muted focus:outline-none focus:bg-white dark:focus:bg-[#121A2E] focus:border-brand leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  English or Hinglish · Cites your pages
                </span>
                <button
                  type="submit"
                  disabled={!doubtInput.trim()}
                  data-testid="home-doubt-submit-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask tutor</span>
                </button>
              </div>
            </form>
          </section>

          {/* 7. Due Today */}
          <section
            aria-labelledby="due-today-heading"
            data-testid="home-due-today"
            className="lm-card-editorial p-5 sm:p-6 space-y-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </span>
                <div>
                  <h2 id="due-today-heading" className="font-display text-base font-bold text-ink">
                    Due today
                  </h2>
                  <p className="text-xs text-muted">
                    Revision tasks &amp; flashcards ready for review
                  </p>
                </div>
              </div>
              {dueTodayItems.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-warning-soft text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold">
                  {dueTodayItems.length}
                </span>
              )}
            </div>

            {dueTodayItems.length === 0 ? (
              <div className="rounded-xl border border-line bg-canvas p-4 flex items-center gap-3 text-xs text-muted">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span>
                  Nothing overdue right now. Take a quick practice quiz or review flashcards in{' '}
                  <button
                    type="button"
                    onClick={() => onNavigateTab('revision')}
                    className="font-semibold text-brand hover:underline cursor-pointer"
                  >
                    Revise
                  </button>
                  .
                </span>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {dueTodayItems.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink truncate">{item.title}</p>
                      <p className="text-[11px] text-muted truncate">{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDoc(item.doc, 'explain');
                        onNavigateTab('revision');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-brand shrink-0 cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
