import React, { useMemo } from 'react';
import {
  ArrowRight,
  Atom,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  FlaskConical,
  ListChecks,
  MessageCircleQuestion,
  Sigma,
  Target,
  TrendingUp,
  Upload,
  UserRound,
} from 'lucide-react';
import { StudyDocument, StudentAcademicProfile } from '../types/study';
import { studyStorage } from '../services/storageService';
import { getNextJeeCountdown, JEE_MAIN_2027_KEY_DATES } from '../utils/jeeCalendar';
import {
  JEE_SUBJECTS,
  JeeSubject,
  classifyJeeSubject,
  computeStudyStreak,
  localDayKey,
} from '../utils/jeeSubjects';
import type { ActiveTab } from './Navbar';
import type { StudySubMode } from './StudyView';

interface StudentDashboardViewProps {
  studentName?: string;
  documents: StudyDocument[];
  activeDoc: StudyDocument | null;
  onSelectDoc: (doc: StudyDocument, mode?: StudySubMode) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  studentProfile?: StudentAcademicProfile;
  /** True while the private cloud profile is still loading after sign-in. */
  isProfileSyncing?: boolean;
  onOpenProfileModal?: () => void;
}

const SUBJECT_STYLE: Record<
  JeeSubject,
  { icon: React.ComponentType<{ className?: string }>; text: string; soft: string; bar: string }
> = {
  Physics: { icon: Atom, text: 'text-physics', soft: 'bg-physics-soft', bar: 'bg-physics' },
  Chemistry: { icon: FlaskConical, text: 'text-chemistry', soft: 'bg-chemistry-soft', bar: 'bg-chemistry' },
  Mathematics: { icon: Sigma, text: 'text-maths', soft: 'bg-maths-soft', bar: 'bg-maths' },
};

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86_400_000
  );
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function phaseTip(daysLeft: number, inProgress: boolean): string {
  if (inProgress) return 'Exam week: sleep well, revise your formula sheets and stay calm.';
  if (daysLeft <= 14) return 'Final stretch: revise formulas, analyse your mocks and avoid starting new topics.';
  if (daysLeft <= 45) return 'Practice phase: mix chapter tests with one full-length mock every week.';
  return 'Foundation phase: strengthen your weakest chapters with concepts and past-year questions.';
}

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  studentName,
  documents,
  activeDoc,
  onSelectDoc,
  onNavigateTab,
  studentProfile,
  isProfileSyncing = false,
  onOpenProfileModal,
}) => {
  const now = useMemo(() => new Date(), [documents]);
  const countdown = useMemo(() => getNextJeeCountdown(now), [now]);

  // Recomputed whenever App refreshes the documents list (after quizzes, uploads, etc.).
  const attempts = useMemo(
    () =>
      [...studyStorage.getQuizAttempts()].sort(
        (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)
      ),
    [documents]
  );
  const focusSessions = useMemo(() => studyStorage.getFocusSessions(), [documents]);
  const pendingRevision = useMemo(
    () =>
      documents.flatMap((doc) =>
        studyStorage
          .getRevisionPlan(doc.id)
          .filter((task) => !task.completed)
          .map((task) => ({ task, doc }))
      ),
    [documents]
  );

  const answers = attempts.flatMap((attempt) =>
    attempt.answers.map((answer) => ({ ...answer, documentTitle: attempt.documentTitle }))
  );
  const answered = answers.filter((a) => a.selectedIndex >= 0);
  const correct = answered.filter((a) => a.isCorrect).length;
  const accuracy = answered.length > 0 ? Math.round((correct / answered.length) * 100) : null;
  const streak = computeStudyStreak([
    ...attempts.map((a) => new Date(a.completedAt)),
    ...focusSessions.map((s) => new Date(s.completedAt)),
  ]);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const focusMinutesThisWeek = focusSessions
    .filter((s) => Date.parse(s.completedAt) >= weekAgo)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const subjectStats = JEE_SUBJECTS.map((subject) => {
    const subjectAnswers = answered.filter(
      (a) => classifyJeeSubject(`${a.topic} ${a.documentTitle}`) === subject
    );
    const subjectCorrect = subjectAnswers.filter((a) => a.isCorrect).length;
    return {
      subject,
      attempted: subjectAnswers.length,
      accuracy:
        subjectAnswers.length > 0 ? Math.round((subjectCorrect / subjectAnswers.length) * 100) : null,
    };
  });

  const weakTopics = (() => {
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const a of answered) {
      if (!a.topic) continue;
      const entry = byTopic.get(a.topic) || { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      byTopic.set(a.topic, entry);
    }
    return Array.from(byTopic.entries())
      .map(([topic, s]) => ({ topic, total: s.total, accuracy: Math.round((s.correct / s.total) * 100) }))
      .filter((t) => t.total >= 2 && t.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 4);
  })();

  const continueDoc = activeDoc || documents[0] || null;
  const name = studentName && studentName !== 'LearnMate Student' ? studentName.split(' ')[0] : '';
  // Do not flash the setup banner while the account's saved profile is still loading.
  const profileIncomplete = !isProfileSyncing && !studentProfile?.setupCompleted;
  const todayKey = localDayKey(now);
  const nextKeyDateIndex = JEE_MAIN_2027_KEY_DATES.findIndex((d) => d.date >= todayKey);

  return (
    <div className="space-y-6 pb-10 lm-fade-up">
      {/* Hero: greeting, countdown and primary actions */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand via-indigo-600 to-violet-600 text-white p-6 sm:p-8 shadow-lg">
        <div
          className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <p className="text-sm font-medium text-indigo-100">
              {greetingFor(now)}
              {name ? `, ${name}` : ''}
            </p>
            {countdown ? (
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {countdown.inProgress ? (
                  <>{countdown.label} is happening now</>
                ) : (
                  <>
                    <span className="tabular-nums">{countdown.daysLeft}</span> days to{' '}
                    {countdown.label}
                  </>
                )}
              </h1>
            ) : (
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Keep building your JEE preparation
              </h1>
            )}
            <p className="text-indigo-100 text-sm sm:text-base">
              {countdown ? phaseTip(countdown.daysLeft, countdown.inProgress) : 'Practise a little every day.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('ai-tutor')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-brand text-sm font-semibold shadow-sm hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <MessageCircleQuestion className="w-4 h-4" />
              Ask a doubt
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('practice')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <Target className="w-4 h-4" />
              Start practice
            </button>
          </div>
        </div>
      </section>

      {profileIncomplete && onOpenProfileModal && (
        <button
          type="button"
          onClick={onOpenProfileModal}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-brand-200 text-left hover:border-brand transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0">
            <UserRound className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-ink">Set up your JEE profile</span>
            <span className="block text-xs text-muted">
              Add your name, class, language and age band. School, board and goals stay optional.
            </span>
          </span>
          <ArrowRight className="w-4 h-4 text-brand shrink-0" />
        </button>
      )}

      {/* Real stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'Study streak',
            value: streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'days'}` : '0 days',
            hint: streak > 0 ? 'Keep it going today' : 'Practise today to start one',
            icon: Flame,
            tone: 'text-warning bg-warning-soft',
          },
          {
            label: 'Questions solved',
            value: answered.length.toString(),
            hint: answered.length > 0 ? `${attempts.length} practice ${attempts.length === 1 ? 'set' : 'sets'}` : 'No questions yet',
            icon: CheckCircle2,
            tone: 'text-success bg-success-soft',
          },
          {
            label: 'Accuracy',
            value: accuracy === null ? '—' : `${accuracy}%`,
            hint: accuracy === null ? 'Shows after your first quiz' : `${correct} of ${answered.length} correct`,
            icon: TrendingUp,
            tone: 'text-brand bg-brand-soft',
          },
          {
            label: 'Focus this week',
            value: focusMinutesThisWeek > 0 ? `${Math.round(focusMinutesThisWeek)} min` : '—',
            hint: focusMinutesThisWeek > 0 ? 'From your focus timer' : 'Use the focus timer',
            icon: Clock,
            tone: 'text-physics bg-physics-soft',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="lm-card-editorial p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">{stat.label}</span>
                <span className={`w-8 h-8 rounded-lg grid place-items-center ${stat.tone}`}>
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold text-ink tabular-nums">
                {stat.value}
              </div>
              <div className="text-xs text-muted mt-0.5">{stat.hint}</div>
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Subjects */}
          <section className="lm-card-editorial p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Your subjects</h2>
              <button
                type="button"
                onClick={() => onNavigateTab('analytics')}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Detailed progress
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {subjectStats.map(({ subject, attempted, accuracy: subjectAccuracy }) => {
                const style = SUBJECT_STYLE[subject];
                const Icon = style.icon;
                return (
                  <div key={subject} className="rounded-2xl border border-line p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-9 h-9 rounded-xl grid place-items-center ${style.soft} ${style.text}`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="font-semibold text-ink text-sm">{subject}</span>
                    </div>
                    {attempted > 0 && subjectAccuracy !== null ? (
                      <>
                        <div className="flex items-baseline justify-between">
                          <span className="font-display text-xl font-extrabold text-ink tabular-nums">
                            {subjectAccuracy}%
                          </span>
                          <span className="text-xs text-muted">{attempted} answered</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-soft overflow-hidden">
                          <div
                            className={`h-full rounded-full ${style.bar}`}
                            style={{ width: `${Math.max(4, subjectAccuracy)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted">No {subject.toLowerCase()} questions answered yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Continue studying */}
          <section className="lm-card-editorial p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-ink mb-4">Continue studying</h2>
            {continueDoc ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="w-12 h-12 rounded-2xl bg-brand-soft text-brand grid place-items-center shrink-0">
                  <BookOpen className="w-6 h-6" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink truncate">
                      {continueDoc.title.replace(/\.pdf$/i, '')}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {continueDoc.pageCount} {continueDoc.pageCount === 1 ? 'page' : 'pages'}
                    {continueDoc.lastStudiedAt
                      ? ` · Last opened ${relativeTime(continueDoc.lastStudiedAt, now)}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectDoc(continueDoc, 'explain')}
                    className="px-4 py-2 rounded-xl lm-btn-accent text-sm cursor-pointer"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDoc(continueDoc, 'quiz')}
                    className="px-4 py-2 rounded-xl border border-line bg-white hover:bg-soft text-sm font-semibold text-ink cursor-pointer"
                  >
                    Take a quiz
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted">Upload a chapter, your coaching module or notes to begin.</p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('home')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl lm-btn-accent text-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload study material
                </button>
              </div>
            )}
          </section>

          {/* Recent practice */}
          <section className="lm-card-editorial p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Recent practice</h2>
              {attempts.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('analytics')}
                  className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  View all
                </button>
              )}
            </div>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted">
                Your quizzes and practice sets will appear here with their scores.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {attempts.slice(0, 4).map((attempt) => {
                  const pct = Math.round((attempt.score / Math.max(1, attempt.totalQuestions)) * 100);
                  return (
                    <li key={attempt.id} className="py-3 flex items-center gap-3">
                      <span
                        className={`w-11 h-11 rounded-xl grid place-items-center text-sm font-bold tabular-nums shrink-0 ${
                          pct >= 70
                            ? 'bg-success-soft text-success'
                            : pct >= 40
                            ? 'bg-warning-soft text-warning'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        {pct}%
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink truncate">
                          {attempt.documentTitle.replace(/\.pdf$/i, '')}
                        </div>
                        <div className="text-xs text-muted">
                          {attempt.score}/{attempt.totalQuestions} correct · {relativeTime(attempt.completedAt, now)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Focus areas */}
          <section className="lm-card-editorial p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-ink">Focus areas</h2>
            {weakTopics.length === 0 ? (
              <p className="text-sm text-muted">
                Topics where you score below 60% will show up here after a few quizzes.
              </p>
            ) : (
              <ul className="space-y-3">
                {weakTopics.map((topic) => (
                  <li key={topic.topic} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-ink truncate">{topic.topic}</span>
                      <span className="text-xs font-bold text-danger tabular-nums">{topic.accuracy}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-soft overflow-hidden">
                      <div className="h-full rounded-full bg-danger" style={{ width: `${Math.max(4, topic.accuracy)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('practice')}
              className="w-full py-2.5 rounded-xl border border-line bg-white hover:bg-soft text-sm font-semibold text-ink cursor-pointer"
            >
              Practise weak topics
            </button>
          </section>

          {/* Revision due */}
          <section className="lm-card-editorial p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-brand" />
              <h2 className="font-display text-lg font-bold text-ink">Revision to do</h2>
            </div>
            {pendingRevision.length === 0 ? (
              <p className="text-sm text-muted">
                After a quiz, LearnMate builds a revision list from your mistakes.
              </p>
            ) : (
              <ul className="space-y-2">
                {pendingRevision.slice(0, 4).map(({ task, doc }) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onSelectDoc(doc, 'revision')}
                      className="w-full text-left p-3 rounded-xl border border-line hover:border-brand-200 hover:bg-brand-soft/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink truncate">{task.topic}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${
                            task.priority === 'high'
                              ? 'text-danger'
                              : task.priority === 'medium'
                              ? 'text-warning'
                              : 'text-muted'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <span className="block text-xs text-muted truncate mt-0.5">
                        {doc.title.replace(/\.pdf$/i, '')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Key dates */}
          <section className="lm-card-editorial p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-brand" />
              <h2 className="font-display text-lg font-bold text-ink">JEE Main 2027 dates</h2>
            </div>
            <ol className="space-y-2.5">
              {JEE_MAIN_2027_KEY_DATES.map((item, index) => {
                const past = item.date < todayKey;
                const isNext = index === nextKeyDateIndex;
                const [y, m, d] = item.date.split('-').map(Number);
                const label = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });
                return (
                  <li
                    key={item.label}
                    className={`flex items-start gap-3 p-2.5 rounded-xl ${isNext ? 'bg-brand-soft' : ''}`}
                  >
                    <span
                      className={`w-14 shrink-0 text-xs font-bold tabular-nums ${
                        past ? 'text-muted line-through' : isNext ? 'text-brand' : 'text-ink'
                      }`}
                    >
                      {label}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium ${past ? 'text-muted' : 'text-ink'}`}>
                        {item.label}
                      </span>
                      {'note' in item && item.note && (
                        <span className="block text-xs text-muted">{item.note}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="text-[11px] text-muted">Source: NTA Information Bulletin. Always confirm on jeemain.nta.nic.in.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
