import React, { useMemo, useState } from 'react';
import {
  Atom,
  BarChart2,
  TrendingUp,
  Award,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  RotateCcw,
  Download,
  Printer,
  Timer,
  Flame,
  FlaskConical,
  Sigma,
} from 'lucide-react';
import type { StudyDocument, QuizAttempt, RevisionTask } from '../types/study';
import {
  computeTopicProgress,
  computeOverallProgressSummary,
  generateStudyProgressReportText,
} from '../utils/quizGrading';
import {
  JEE_SUBJECTS,
  JeeSubject,
  classifyJeeSubject,
  computeStudyStreak,
} from '../utils/jeeSubjects';
import { studyStorage } from '../services/storageService';

interface ProgressViewProps {
  documents: StudyDocument[];
  attempts: QuizAttempt[];
  onStartQuizForDocument: (doc: StudyDocument, mode: 'quiz' | 'adaptive') => void;
  onResetProgress: () => void;
}

const SUBJECT_STYLE: Record<
  JeeSubject,
  { icon: React.ComponentType<{ className?: string }>; text: string; soft: string; bar: string }
> = {
  Physics: { icon: Atom, text: 'text-physics', soft: 'bg-physics-soft', bar: 'bg-physics' },
  Chemistry: {
    icon: FlaskConical,
    text: 'text-chemistry',
    soft: 'bg-chemistry-soft',
    bar: 'bg-chemistry',
  },
  Mathematics: { icon: Sigma, text: 'text-maths', soft: 'bg-maths-soft', bar: 'bg-maths' },
};

export const ProgressView: React.FC<ProgressViewProps> = ({
  documents,
  attempts,
  onStartQuizForDocument,
  onResetProgress,
}) => {
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all');

  const filteredAttempts =
    selectedDocFilter === 'all'
      ? attempts
      : attempts.filter((a) => a.documentId === selectedDocFilter);

  const allFocusSessions = studyStorage.getFocusSessions();
  const filteredFocusSessions =
    selectedDocFilter === 'all'
      ? allFocusSessions
      : allFocusSessions.filter((s) => s.documentId === selectedDocFilter);

  const totalFocusMinutes = filteredFocusSessions.reduce(
    (sum, s) => sum + (s.durationMinutes || 0),
    0
  );

  const streak = useMemo(
    () =>
      computeStudyStreak([
        ...attempts.map((a) => new Date(a.completedAt)),
        ...allFocusSessions.map((s) => new Date(s.completedAt)),
      ]),
    [attempts, allFocusSessions]
  );

  const subjectStats = useMemo(() => {
    const answers = filteredAttempts.flatMap((attempt) =>
      attempt.answers
        .filter((a) => a.selectedIndex >= 0)
        .map((answer) => ({ ...answer, documentTitle: attempt.documentTitle }))
    );
    return JEE_SUBJECTS.map((subject) => {
      const subjectAnswers = answers.filter(
        (a) => classifyJeeSubject(`${a.topic} ${a.documentTitle}`) === subject
      );
      const subjectCorrect = subjectAnswers.filter((a) => a.isCorrect).length;
      return {
        subject,
        attempted: subjectAnswers.length,
        accuracy:
          subjectAnswers.length > 0
            ? Math.round((subjectCorrect / subjectAnswers.length) * 100)
            : null,
      };
    });
  }, [filteredAttempts]);

  const summary = computeOverallProgressSummary(filteredAttempts);
  const topicComparisons = computeTopicProgress(filteredAttempts);

  const handleDownloadReport = () => {
    const targetDocs =
      selectedDocFilter === 'all'
        ? documents
        : documents.filter((d) => d.id === selectedDocFilter);

    const revisionTasks: RevisionTask[] = [];
    for (const doc of targetDocs) {
      revisionTasks.push(...studyStorage.getRevisionPlan(doc.id));
    }

    const filterLabel =
      selectedDocFilter === 'all'
        ? 'All Study Materials'
        : targetDocs[0]?.title || 'Selected Study Material';

    const reportContent = generateStudyProgressReportText({
      attempts: filteredAttempts,
      revisionTasks,
      focusSessions: filteredFocusSessions,
      filterLabel,
    });

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeSlug = filterLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `LearnMate_Progress_Report_${safeSlug}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-6 space-y-6" data-testid="progress-view">
      {/* Header & Material Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="lm-kicker">Analytics &amp; Stats</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            JEE Study Progress
          </h1>
          <p className="text-sm text-muted mt-1">
            Real quiz attempts, subject accuracy, study streak, and topic-level mastery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lm-no-print">
          <label htmlFor="progress-doc-filter" className="text-xs font-semibold text-muted">
            Material:
          </label>
          <select
            id="progress-doc-filter"
            value={selectedDocFilter}
            onChange={(e) => setSelectedDocFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:border-brand max-w-[220px] truncate"
          >
            <option value="all">All Materials ({attempts.length} attempts)</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white hover:bg-soft text-ink text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl lm-btn-accent text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>

          {(attempts.length > 0 || allFocusSessions.length > 0) && (
            <button
              type="button"
              onClick={onResetProgress}
              title="Clear saved quiz history"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:text-danger hover:border-danger/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Top stats strip moved from Home: Study Streak, Focus Time, Subject Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subjectStats.map(({ subject, attempted, accuracy }) => {
          const style = SUBJECT_STYLE[subject];
          const Icon = style.icon;
          return (
            <div key={subject} className="lm-card-editorial p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
                  <span
                    className={`w-7 h-7 rounded-lg ${style.soft} ${style.text} flex items-center justify-center`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  {subject}
                </span>
                <span className="text-xs font-bold text-ink tabular-nums">
                  {accuracy !== null ? `${accuracy}% accuracy` : 'No attempts yet'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-soft overflow-hidden">
                <div
                  className={`h-full ${style.bar} transition-all`}
                  style={{ width: `${accuracy !== null ? Math.max(6, accuracy) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-muted tabular-nums">
                {attempted > 0
                  ? `${attempted} question${attempted === 1 ? '' : 's'} answered`
                  : 'Solve a practice set in this subject to see accuracy.'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="lm-card-editorial p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-warning-soft text-warning flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink tabular-nums">
              {streak} {streak === 1 ? 'day' : 'days'} active study streak
            </p>
            <p className="text-xs text-muted">
              Counted from real completed quizzes and focus timer sessions
            </p>
          </div>
        </div>

        <div className="lm-card-editorial p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink tabular-nums">
              {filteredFocusSessions.length} Focus{' '}
              {filteredFocusSessions.length === 1 ? 'Session' : 'Sessions'} ({totalFocusMinutes}{' '}
              mins)
            </p>
            <p className="text-xs text-muted">
              {filteredFocusSessions[0]
                ? `Latest session on ${new Date(
                    filteredFocusSessions[0].completedAt
                  ).toLocaleDateString()}`
                : 'Start the focus timer while studying to log time.'}
            </p>
          </div>
        </div>
      </div>

      {/* Honest Empty State when no quizzes have been submitted yet */}
      {filteredAttempts.length === 0 ? (
        <div className="lm-card-editorial p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-success-soft text-success flex items-center justify-center mx-auto">
            <BarChart2 className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-lg font-bold text-ink">
              No Quiz Attempts Recorded Yet
            </h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              LearnMate never invents statistics. Complete a practice set or chapter quiz on your
              study material to track real scores and topic-level improvement over time.
            </p>
          </div>
          {documents[0] && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onStartQuizForDocument(documents[0], 'quiz')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Take Quiz on {documents[0].title}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#F3F7FE] border border-blue-100 space-y-1">
              <span className="text-xs font-semibold text-slate-500">Total Completed Quizzes</span>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {summary.totalAttempts}
              </p>
              <p className="text-xs text-slate-600 tabular-nums">
                {summary.diagnosticCount} diagnostic · {summary.adaptiveCount} adaptive
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-success-soft border border-emerald-100 space-y-1">
              <span className="text-xs font-semibold text-slate-500">Average Accuracy</span>
              <p className="text-3xl font-extrabold text-success tabular-nums">
                {summary.averageScorePct}%
              </p>
              <p className="text-xs text-slate-600 tabular-nums">
                Latest score: {summary.latestAttemptPct}%
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-warning-soft border border-amber-100 space-y-1">
              <span className="text-xs font-semibold text-slate-500">First → Latest Improvement</span>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums flex items-center gap-1.5">
                <span>
                  {summary.overallDeltaPct !== null && summary.overallDeltaPct >= 0
                    ? `+${summary.overallDeltaPct}%`
                    : `${summary.overallDeltaPct ?? 0}%`}
                </span>
                <TrendingUp className="w-5 h-5 text-success" />
              </p>
              <p className="text-xs text-slate-600 tabular-nums">
                {summary.firstAttemptPct}% initial → {summary.latestAttemptPct}% latest
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#FDF4F4] border border-red-100 space-y-1">
              <span className="text-xs font-semibold text-slate-500">Topic Mastery Status</span>
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {summary.masteredTopicsCount} Mastered
              </p>
              <p className="text-xs text-slate-600 tabular-nums">
                {summary.weakTopicsCount} topic(s) need focused review
              </p>
            </div>
          </div>

          {/* Topic-Level Improvement Breakdown */}
          <div className="lm-card-editorial p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">
                  Topic-Level Mastery &amp; Improvement
                </h2>
                <p className="text-xs text-muted">
                  Comparing your first attempt on each topic against your most recent attempt.
                </p>
              </div>
            </div>

            <div className="divide-y divide-line">
              {topicComparisons.map((item) => (
                <div
                  key={item.topic}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-ink">{item.topic}</span>
                      <span className="text-xs text-muted tabular-nums">
                        · {item.totalCorrect}/{item.totalQuestions} correct across {item.attemptsCount}{' '}
                        {item.attemptsCount === 1 ? 'attempt' : 'attempts'}
                      </span>
                      {item.status === 'mastered' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mastered
                        </span>
                      )}
                      {item.status === 'improved' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                          <Award className="w-3.5 h-3.5" /> Improved (+{item.deltaPct}%)
                        </span>
                      )}
                      {item.status === 'needs-work' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                          <AlertCircle className="w-3.5 h-3.5" /> Needs Practice
                        </span>
                      )}
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full max-w-md h-2.5 rounded-full bg-soft overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.latestScorePct >= 80
                            ? 'bg-success'
                            : item.latestScorePct >= 50
                              ? 'bg-warning'
                              : 'bg-danger'
                        }`}
                        style={{ width: `${Math.max(6, item.latestScorePct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right tabular-nums">
                      <p className="text-xs text-muted">First → Latest</p>
                      <p className="text-sm font-bold text-ink">
                        {item.firstScorePct}% → {item.latestScorePct}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attempt History Log */}
          <div className="lm-card-editorial p-6 space-y-4">
            <h2 className="text-base font-bold text-ink">Attempt History</h2>
            <div className="divide-y divide-line">
              {filteredAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">{attempt.documentTitle}</span>
                      <span className="text-xs font-semibold text-brand">
                        · {attempt.mode === 'adaptive' ? 'Adaptive Practice' : 'Diagnostic Quiz'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(attempt.completedAt).toLocaleString()}</span>
                      {attempt.weakTopics.length > 0 && (
                        <span>· Focus areas: {attempt.weakTopics.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span
                      className={`text-sm font-extrabold ${
                        attempt.percentage >= 80
                          ? 'text-emerald-700'
                          : attempt.percentage >= 50
                            ? 'text-amber-700'
                            : 'text-red-600'
                      }`}
                    >
                      {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
