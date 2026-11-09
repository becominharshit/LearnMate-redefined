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
  Star,
  Target,
  XCircle,
  Minus,
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
  getStudyActivityDatesFromLocalStorage,
} from '../utils/jeeSubjects';
import { studyStorage } from '../services/storageService';
import { JEE_SYLLABUS_CHAPTERS } from '../data/jeeSyllabusAndNotes';
import { syncRewardsFromActualStudentActivity } from '../utils/rewardsEngine';

interface ProgressViewProps {
  documents: StudyDocument[];
  attempts: QuizAttempt[];
  onStartQuizForDocument: (doc: StudyDocument, mode: 'quiz' | 'adaptive') => void;
  onResetProgress: () => void;
  onNavigateTab?: (tab: string) => void;
}

type ProgressTab = 'overview' | 'mock_analysis' | 'mastery' | 'rewards';

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
  onNavigateTab,
}) => {
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all');
  const [activeProgressTab, setActiveProgressTab] = useState<ProgressTab>('overview');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>('');
  const [chapterSubjectFilter, setChapterSubjectFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');

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
        ...getStudyActivityDatesFromLocalStorage(),
        ...attempts.map((a) => new Date(a.completedAt)),
        ...allFocusSessions.map((s) => new Date(s.completedAt)),
      ]),
    [attempts, allFocusSessions]
  );

  // Sync XP, Level, Challenges & Achievements from real student activity
  const rewardsSummary = useMemo(
    () =>
      syncRewardsFromActualStudentActivity({
        attempts,
        focusSessions: allFocusSessions,
        documentsCount: documents.length,
        streakDays: streak,
      }),
    [attempts, allFocusSessions, documents.length, streak]
  );

  const subjectStats = useMemo(() => {
    const answers = filteredAttempts.flatMap((attempt) =>
      attempt.answers
        .filter((a) => a.selectedIndex >= 0)
        .map((answer) => ({ ...answer, documentTitle: attempt.documentTitle }))
    );
    return JEE_SUBJECTS.map((subject) => {
      const totalChaptersInSyllabus = JEE_SYLLABUS_CHAPTERS.filter(
        (ch) => ch.subject === subject
      ).length;
      const subjectAnswers = answers.filter(
        (a) => classifyJeeSubject(`${a.topic} ${a.documentTitle}`) === subject
      );
      const subjectCorrect = subjectAnswers.filter((a) => a.isCorrect).length;
      const practicedTopics = new Set(subjectAnswers.map((a) => a.topic)).size;
      return {
        subject,
        attempted: subjectAnswers.length,
        practicedChapters: Math.min(totalChaptersInSyllabus, practicedTopics),
        totalChapters: totalChaptersInSyllabus,
        accuracy:
          subjectAnswers.length > 0
            ? Math.round((subjectCorrect / subjectAnswers.length) * 100)
            : null,
      };
    });
  }, [filteredAttempts]);

  const summary = computeOverallProgressSummary(filteredAttempts);
  const topicComparisons = computeTopicProgress(filteredAttempts);

  // Currently selected attempt for Mock Analysis card
  const activeAttempt: QuizAttempt | null = useMemo(() => {
    if (filteredAttempts.length === 0) return null;
    if (selectedAttemptId) {
      const found = filteredAttempts.find((a) => a.id === selectedAttemptId);
      if (found) return found;
    }
    return filteredAttempts[0];
  }, [filteredAttempts, selectedAttemptId]);

  // Mathematically consistent metrics for activeAttempt
  const activeAttemptBreakdown = useMemo(() => {
    if (!activeAttempt) return null;
    const totalQ = Math.max(1, activeAttempt.totalQuestions);
    const hasDetailedAnswers = activeAttempt.answers && activeAttempt.answers.length > 0;

    let correct = activeAttempt.score;
    let skipped = 0;
    let incorrect = 0;

    if (hasDetailedAnswers) {
      correct = activeAttempt.answers.filter((a) => a.isCorrect).length;
      skipped = activeAttempt.answers.filter((a) => a.selectedIndex < 0).length;
      incorrect = Math.max(0, totalQ - correct - skipped);
    } else if (
      typeof activeAttempt.rawMarks === 'number' &&
      activeAttempt.negativeMarkingUsed
    ) {
      // Solve 4*correct - 1*incorrect = rawMarks => incorrect = 4*correct - rawMarks
      const derivedWrong = Math.max(0, 4 * correct - activeAttempt.rawMarks);
      incorrect = Math.min(totalQ - correct, derivedWrong);
      skipped = Math.max(0, totalQ - correct - incorrect);
    } else {
      incorrect = Math.max(0, totalQ - correct);
      skipped = 0;
    }

    const attempted = Math.max(1, correct + incorrect);
    // Documented denominator: Correct / Attempted
    const accuracyPct =
      correct + incorrect > 0
        ? Number(((correct / attempted) * 100).toFixed(1))
        : 0;

    const scoreDisplay =
      typeof activeAttempt.rawMarks === 'number'
        ? activeAttempt.rawMarks
        : correct * 4 - incorrect;
    const maxMarksDisplay =
      typeof activeAttempt.maxMarks === 'number'
        ? activeAttempt.maxMarks
        : totalQ * 4;
    const timeMinutes = activeAttempt.timeTakenSeconds
      ? Math.max(1, Math.round(activeAttempt.timeTakenSeconds / 60))
      : Math.max(1, Math.round(totalQ * 1.5));

    return {
      totalQ,
      correct,
      incorrect,
      skipped,
      attempted: correct + incorrect,
      accuracyPct,
      scoreDisplay,
      maxMarksDisplay,
      timeMinutes,
    };
  }, [activeAttempt]);

  // Chapter analysis rows from real attempts
  const chapterRows = useMemo(() => {
    const map = new Map<
      string,
      {
        chapter: string;
        subject: JeeSubject;
        correct: number;
        total: number;
      }
    >();

    for (const att of filteredAttempts) {
      for (const ans of att.answers) {
        const chName = ans.topic || att.documentTitle;
        const subj =
          classifyJeeSubject(`${chName} ${att.documentTitle}`) || 'Physics';
        const existing = map.get(chName) || {
          chapter: chName,
          subject: subj,
          correct: 0,
          total: 0,
        };
        existing.total += 1;
        if (ans.isCorrect) existing.correct += 1;
        map.set(chName, existing);
      }
    }

    const rows = Array.from(map.values()).map((r) => {
      const maxMarks = r.total * 4;
      const wrong = r.total - r.correct;
      const netMarks = Math.max(0, r.correct * 4 - wrong);
      const accuracyPct =
        r.total > 0 ? Number(((r.correct / r.total) * 100).toFixed(1)) : 0;
      const estMinutes = Math.max(2, r.total * 2);
      return {
        ...r,
        netMarks,
        maxMarks,
        accuracyPct,
        estMinutes,
      };
    });

    if (chapterSubjectFilter === 'All') return rows;
    return rows.filter((r) => r.subject === chapterSubjectFilter);
  }, [filteredAttempts, chapterSubjectFilter]);

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

  const focusHours = Math.floor(totalFocusMinutes / 60);
  const focusRemMins = totalFocusMinutes % 60;

  return (
    <div
      className="max-w-[1320px] mx-auto px-2 sm:px-4 py-2 space-y-6"
      data-testid="progress-view"
    >
      {/* Header & Material Filter matching Image 1 */}
      <div className="space-y-4 border-b border-line pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Progress
          </h1>

          <div className="flex flex-wrap items-center gap-2 lm-no-print">
            <label
              htmlFor="progress-doc-filter"
              className="text-xs font-semibold text-muted"
            >
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

        {/* Section Tabs matching Image 1: Overview | Mock Analysis | Mastery | Rewards */}
        <div
          role="tablist"
          aria-label="Progress Sections"
          className="flex items-center gap-4 sm:gap-6 overflow-x-auto"
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'mock_analysis', label: 'Mock Analysis' },
              { id: 'mastery', label: 'Mastery' },
              { id: 'rewards', label: 'Rewards' },
            ] as const
          ).map((tab) => {
            const isActive = activeProgressTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`progress-tab-${tab.id}`}
                onClick={() => setActiveProgressTab(tab.id)}
                className={`relative pb-3 pt-1 px-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-brand font-bold'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 3 Subject Mastery Cards matching Image 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subjectStats.map(
          ({ subject, attempted, practicedChapters, totalChapters, accuracy }) => {
            const style = SUBJECT_STYLE[subject];
            const Icon = style.icon;
            return (
              <div key={subject} className="lm-card-editorial p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2.5 text-base font-bold text-ink">
                    <span
                      className={`w-8 h-8 rounded-xl ${style.soft} ${style.text} flex items-center justify-center`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    {subject}
                  </span>
                  <span className="text-xl font-extrabold text-ink tabular-nums">
                    {accuracy !== null ? `${accuracy}%` : '—'}
                  </span>
                </div>
                <p className="text-xs text-muted tabular-nums">
                  Mastery • {practicedChapters}/{totalChapters} chapters{' '}
                  {attempted > 0 ? `(${attempted} Qs solved)` : '(No attempts yet)'}
                </p>
                <div className="h-2 rounded-full bg-soft overflow-hidden">
                  <div
                    className={`h-full ${style.bar} transition-all`}
                    style={{ width: `${accuracy !== null ? Math.max(6, accuracy) : 0}%` }}
                  />
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Main 12-Column Analytics & Rewards Grid matching Image 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 8 COLUMNS */}
        <div className="lg:col-span-8 space-y-6">
          {/* Mock Analysis Card */}
          {(activeProgressTab === 'overview' ||
            activeProgressTab === 'mock_analysis') && (
            <div className="lm-card-editorial p-5 sm:p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-ink">
                  Mock Analysis
                </h2>
                <span className="text-xs font-semibold text-brand">
                  {filteredAttempts.length} {filteredAttempts.length === 1 ? 'Attempt' : 'Attempts'} Recorded
                </span>
              </div>

              {!activeAttempt || !activeAttemptBreakdown ? (
                <div className="p-8 rounded-2xl bg-canvas border border-line text-center space-y-3">
                  <BarChart2 className="w-8 h-8 text-brand mx-auto" />
                  <h3 className="text-base font-bold text-ink">
                    No Mock or Practice Attempts Yet
                  </h3>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    LearnMate never invents scores or ranks. Complete a Practice set or Full JEE Mock Test to unlock your question-by-question and chapter-wise performance analysis.
                  </p>
                  {documents[0] && (
                    <button
                      type="button"
                      onClick={() => onStartQuizForDocument(documents[0], 'quiz')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Take Quiz on {documents[0].title}</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Attempt Selector Bar matching Image 1 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted pb-2 border-b border-line">
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        aria-label="Select Mock Attempt"
                        value={activeAttempt.id}
                        onChange={(e) => setSelectedAttemptId(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-line bg-canvas text-xs font-bold text-ink"
                      >
                        {filteredAttempts.map((att, idx) => (
                          <option key={att.id} value={att.id}>
                            {att.examTitle || att.documentTitle} (#{filteredAttempts.length - idx})
                          </option>
                        ))}
                      </select>

                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {new Date(activeAttempt.completedAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="tabular-nums">
                        {activeAttemptBreakdown.maxMarksDisplay} marks max
                      </span>
                    </div>

                    {onNavigateTab && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onNavigateTab('practice')}
                          className="font-semibold text-brand hover:underline cursor-pointer"
                        >
                          Full Question Review ›
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('revision')}
                          className="font-semibold text-brand hover:underline cursor-pointer"
                        >
                          Mistake Patterns ›
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3 Metric Cards: Score, Accuracy (Correct / Attempted), Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-brand-soft/60 border border-brand/20 flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white text-brand flex items-center justify-center shrink-0 shadow-2xs">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted">Score</div>
                        <div className="text-2xl font-extrabold text-ink tabular-nums">
                          {activeAttemptBreakdown.scoreDisplay}{' '}
                          <span className="text-sm font-medium text-muted">
                            / {activeAttemptBreakdown.maxMarksDisplay}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-success-soft/70 border border-emerald-200/80 flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white text-success flex items-center justify-center shrink-0 shadow-2xs">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <div
                          className="text-xs font-semibold text-muted"
                          title="Accuracy = Correct ÷ Attempted"
                        >
                          Accuracy (Correct/Attempted)
                        </div>
                        <div className="text-2xl font-extrabold text-ink tabular-nums">
                          {activeAttemptBreakdown.accuracyPct}%
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-200/70 flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted">Time</div>
                        <div className="text-2xl font-extrabold text-ink tabular-nums">
                          {activeAttemptBreakdown.timeMinutes} min
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mathematically Consistent Counts: Correct | Incorrect | Skipped */}
                  <div className="grid grid-cols-3 gap-4 py-3 border-y border-line">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-xs text-muted">Correct</div>
                        <div
                          data-testid="mock-analysis-correct-count"
                          className="text-xl font-extrabold text-ink tabular-nums"
                        >
                          {activeAttemptBreakdown.correct}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <XCircle className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-xs text-muted">Incorrect</div>
                        <div
                          data-testid="mock-analysis-incorrect-count"
                          className="text-xl font-extrabold text-ink tabular-nums"
                        >
                          {activeAttemptBreakdown.incorrect}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                        <Minus className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-xs text-muted">Skipped</div>
                        <div
                          data-testid="mock-analysis-skipped-count"
                          className="text-xl font-extrabold text-ink tabular-nums"
                        >
                          {activeAttemptBreakdown.skipped}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chapter Analysis Table matching Image 1 */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-ink">
                        Chapter Analysis
                      </h3>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted">View by Subject:</span>
                        {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map(
                          (subj) => (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => setChapterSubjectFilter(subj)}
                              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                                chapterSubjectFilter === subj
                                  ? 'text-brand underline font-bold'
                                  : 'text-muted hover:text-ink'
                              }`}
                            >
                              {subj}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {chapterRows.length === 0 ? (
                      <p className="text-xs text-muted">
                        Complete chapter-tagged practice questions to view per-chapter marks, time, and accuracy.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-line">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-canvas border-b border-line text-muted">
                              <th className="py-2.5 px-3 font-semibold">Chapter</th>
                              <th className="py-2.5 px-3 font-semibold">Marks (out of)</th>
                              <th className="py-2.5 px-3 font-semibold">Time</th>
                              <th className="py-2.5 px-3 font-semibold">Accuracy</th>
                              <th className="py-2.5 px-3 font-semibold text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {chapterRows.map((row) => (
                              <tr key={row.chapter} className="hover:bg-canvas/50">
                                <td className="py-3 px-3 font-bold text-ink">
                                  {row.chapter}
                                </td>
                                <td className="py-3 px-3 font-semibold text-ink tabular-nums">
                                  {row.netMarks} / {row.maxMarks}
                                </td>
                                <td className="py-3 px-3 text-muted tabular-nums">
                                  {row.estMinutes} min
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full font-bold tabular-nums ${
                                      row.accuracyPct >= 80
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : row.accuracyPct >= 60
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {row.accuracyPct}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    {onNavigateTab && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => onNavigateTab('practice')}
                                          className="px-2.5 py-1 rounded-lg border border-line bg-white hover:bg-canvas text-[11px] font-semibold text-ink cursor-pointer"
                                        >
                                          View Solutions
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onNavigateTab('revision')}
                                          className="px-2.5 py-1 rounded-lg bg-brand-soft text-brand hover:bg-brand hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                                        >
                                          Revise
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Topic Mastery & First -> Latest Comparison Section */}
          {(activeProgressTab === 'overview' || activeProgressTab === 'mastery') &&
            topicComparisons.length > 0 && (
              <div className="lm-card-editorial p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-ink">
                      Topic-Level Mastery &amp; First → Latest Improvement
                    </h2>
                    <p className="text-xs text-muted">
                      Comparing your first attempt on each topic against your most recent attempt ({summary.masteredTopicsCount} mastered).
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-line">
                  {topicComparisons.map((item) => (
                    <div
                      key={item.topic}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-ink">{item.topic}</span>
                          <span className="text-xs text-muted tabular-nums">
                            · {item.totalCorrect}/{item.totalQuestions} correct across{' '}
                            {item.attemptsCount}{' '}
                            {item.attemptsCount === 1 ? 'attempt' : 'attempts'}
                          </span>
                          {item.status === 'mastered' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mastered
                            </span>
                          )}
                          {item.status === 'improved' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand">
                              <TrendingUp className="w-3.5 h-3.5" /> Improved (+{item.deltaPct}%)
                            </span>
                          )}
                          {item.status === 'needs-work' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                              <AlertCircle className="w-3.5 h-3.5" /> Needs Practice
                            </span>
                          )}
                        </div>

                        <div className="w-full max-w-md h-2 rounded-full bg-soft overflow-hidden">
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

                      <div className="text-right tabular-nums shrink-0">
                        <p className="text-xs text-muted">First → Latest</p>
                        <p className="text-sm font-bold text-ink">
                          {item.firstScorePct}% → {item.latestScorePct}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Rewards & Auditable XP Ledger Tab */}
          {activeProgressTab === 'rewards' && (
            <div className="lm-card-editorial p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-ink">
                    Achievements &amp; Auditable XP Ledger
                  </h2>
                  <p className="text-xs text-muted">
                    Every XP award is tied to a unique, idempotent learning action (refreshing or retrying never duplicates XP).
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-brand-soft text-brand text-xs font-bold">
                  {rewardsSummary.rankTier}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rewardsSummary.achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-xl border space-y-1 ${
                      ach.unlocked
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-canvas border-line opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{ach.title}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          ach.unlocked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {ach.unlocked ? 'Unlocked' : `${ach.progress}/${ach.target}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted">{ach.description}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Recent Verified XP Events ({rewardsSummary.recentEvents.length})
                </h3>
                {rewardsSummary.recentEvents.length === 0 ? (
                  <p className="text-xs text-muted">
                    Complete a chapter checkpoint, flashcard review, PYQ, or mock test to log verified XP events.
                  </p>
                ) : (
                  <div className="divide-y divide-line rounded-xl border border-line bg-canvas px-4">
                    {rewardsSummary.recentEvents.slice(0, 8).map((ev) => (
                      <div
                        key={ev.eventId}
                        className="py-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-ink">{ev.label}</span>
                          <span className="text-muted ml-2">
                            ({new Date(ev.awardedAt).toLocaleDateString()})
                          </span>
                        </div>
                        <span className="font-extrabold text-brand tabular-nums">
                          +{ev.xp} XP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT 4 COLUMNS matching Image 1: 2x2 Summary Grid + Challenges */}
        <div className="lg:col-span-4 space-y-6">
          {/* 2x2 Summary Cards: Streak, Focus Sessions, XP, Level */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="lm-card-editorial p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-muted">Streak</div>
                <div className="text-lg font-extrabold text-ink tabular-nums">
                  {streak} {streak === 1 ? 'day' : 'days'}
                </div>
              </div>
            </div>

            <div className="lm-card-editorial p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-muted">Focus Sessions</div>
                <div className="text-sm font-extrabold text-ink tabular-nums">
                  {filteredFocusSessions.length}{' '}
                  <span className="text-xs font-normal text-muted">
                    ({focusHours}h {focusRemMins}m)
                  </span>
                </div>
              </div>
            </div>

            <div className="lm-card-editorial p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-muted">XP</div>
                <div
                  data-testid="progress-total-xp"
                  className="text-lg font-extrabold text-ink tabular-nums"
                >
                  {rewardsSummary.totalXp.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="lm-card-editorial p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-muted">Level</div>
                <div className="text-sm font-extrabold text-ink">
                  L{rewardsSummary.level} — {rewardsSummary.levelTitle}
                </div>
              </div>
            </div>
          </div>

          {/* Challenges Card matching Image 1 */}
          <div className="lm-card-editorial p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">
                Challenges
              </h2>
              <button
                type="button"
                onClick={() => setActiveProgressTab('rewards')}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                View All ›
              </button>
            </div>

            <div className="space-y-4">
              {rewardsSummary.challenges.map((ch) => {
                const pct = Math.min(
                  100,
                  Math.round((ch.current / Math.max(1, ch.target)) * 100)
                );
                return (
                  <div key={ch.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{ch.title}</span>
                      <span className="font-bold text-muted tabular-nums">
                        {ch.current} / {ch.target}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-soft overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
