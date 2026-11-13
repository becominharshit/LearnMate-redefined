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
  ListChecks,
  MessageCircleQuestion,
  Send,
  Sigma,
  Target,
  Trash2,
  UserRound,
  Star,
  Trophy,
  Plus,
  FileText,
  Camera,
  Youtube,
  Type,
  Info,
  Calculator,
  Calendar,
  ShieldCheck,
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
import type { AddMaterialMode } from './AddMaterialModal';
import { StreakTracker } from './StreakTracker';
import {
  syncRewardsFromActualStudentActivity,
  buildDailyPracticeCoachPlan,
  awardLearningXp,
  DAILY_COACH_COMPLETION_KEY,
} from '../utils/rewardsEngine';
import {
  JEE_SYLLABUS_CHAPTERS,
  buildStudyDocumentFromSyllabusChapter,
  type ExamTrackId,
} from '../data/jeeSyllabusAndNotes';
import { buildDailyMentorBrief } from '../utils/learningIntelligenceEngine';
import { getStoredMistakeBookEntries } from '../utils/mistakeBookEngine';

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
  isProfileSyncing?: boolean;
  onUpdateStudentProfile?: (profile: StudentAcademicProfile) => void;
  onOpenProfileModal?: () => void;
  onSaveDocument?: (doc: StudyDocument) => void;
  onOpenStudySection?: (section: 'my_materials' | 'syllabus' | 'chapter_notes' | 'ai_tutor' | 'resources') => void;
  onOpenMentorReportModal?: () => void;
  onOpenCommercialConsoleModal?: () => void;
  onOpenStudyToolsWorkspace?: (
    subTab?: 'graph2d' | 'matrix' | 'space3d' | 'geometry' | 'scientific'
  ) => void;
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
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
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
  onUpdateStudentProfile,
  onOpenProfileModal,
  onSaveDocument,
  onOpenStudySection,
  onOpenMentorReportModal,
  onOpenCommercialConsoleModal,
  onOpenStudyToolsWorkspace,
}) => {
  const [doubtInput, setDoubtInput] = useState('');
  const [doubtLang, setDoubtLang] = useState<'en' | 'hi'>(
    studentProfile?.preferredLanguage?.toLowerCase().includes('hindi') ? 'hi' : 'en'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedExamTrack, setSelectedExamTrack] = useState<ExamTrackId>(
    studentProfile?.targetExam === 'jee_advanced' ? 'jee_advanced' : 'jee_main'
  );

  React.useEffect(() => {
    if (studentProfile?.targetExam === 'jee_advanced' || studentProfile?.targetExam === 'jee_main') {
      setSelectedExamTrack(studentProfile.targetExam);
    }
  }, [studentProfile?.targetExam]);

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DAILY_COACH_COMPLETION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [customTasks, setCustomTasks] = useState<Array<{ id: string; title: string; done: boolean }>>([]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [showTaskReasonId, setShowTaskReasonId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), [documents]);
  const countdownExamTarget =
    studentProfile?.targetExam === 'bitsat' || studentProfile?.targetExam === 'viteee'
      ? studentProfile.targetExam
      : selectedExamTrack;
  const countdown = useMemo(
    () => getNextJeeCountdown(now, countdownExamTarget),
    [now, countdownExamTarget]
  );

  const allAttempts = useMemo(() => studyStorage.getQuizAttempts(), [documents]);
  const focusSessions = useMemo(() => studyStorage.getFocusSessions(), [documents]);

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
        (a, b) =>
          Date.parse(b.lastStudiedAt || b.createdAt) -
          Date.parse(a.lastStudiedAt || a.createdAt)
      ),
    [documents]
  );

  const continueDoc = activeDoc || sortedDocs[0] || null;

  const { dueTodayItems, totalDueFlashcards, reviewedFlashcardsCount } = useMemo(() => {
    const todayIso = now.toISOString().slice(0, 10);
    let dueCardsTotal = 0;
    let reviewedTotal = 0;
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
        reviewedTotal += bundle.flashcards.filter((c) => c.status === 'know_it').length;
        const dueCards = bundle.flashcards.filter((card) => {
          const nextIso = card.nextReviewDate || card.nextReviewAt;
          return (
            card.status === 'review_again' ||
            Boolean(nextIso && nextIso.slice(0, 10) <= todayIso)
          );
        });
        dueCardsTotal += dueCards.length;
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

    return {
      dueTodayItems: items.slice(0, 5),
      totalDueFlashcards: dueCardsTotal,
      reviewedFlashcardsCount: reviewedTotal,
    };
  }, [documents, now]);

  const rewardsSummary = useMemo(
    () =>
      syncRewardsFromActualStudentActivity({
        attempts: allAttempts,
        focusSessionsCount: focusSessions.length,
        reviewedFlashcardsCount,
      }),
    [allAttempts, focusSessions.length, reviewedFlashcardsCount, completedTaskIds]
  );

  const weakTopics = useMemo(() => {
    const set = new Set<string>();
    for (const att of allAttempts) {
      for (const w of att.weakTopics || []) {
        if (w) set.add(w);
      }
    }
    return Array.from(set);
  }, [allAttempts]);

  const dailyCoachTasks = useMemo(
    () =>
      buildDailyPracticeCoachPlan({
        documents,
        attempts: allAttempts,
        weakTopics,
        dueFlashcardsCount: totalDueFlashcards,
        targetExam: selectedExamTrack,
        completedTaskIds,
      }),
    [documents, allAttempts, weakTopics, totalDueFlashcards, selectedExamTrack, completedTaskIds]
  );

  const dailyMentorBrief = useMemo(() => {
    const allCards = documents.flatMap(
      (doc) => studyStorage.getQuickReviseBundle(doc.id)?.flashcards || []
    );
    const mistakes = getStoredMistakeBookEntries();
    return buildDailyMentorBrief({
      attempts: allAttempts,
      mistakes,
      flashcards: allCards,
      targetExamLabel: selectedExamTrack === 'jee_advanced' ? 'JEE Advanced 2027' : 'JEE Main 2027',
      now,
    });
  }, [allAttempts, documents, selectedExamTrack, now]);

  const toggleCoachTask = (taskId: string, title: string) => {
    setCompletedTaskIds((prev) => {
      const exists = prev.includes(taskId);
      const next = exists ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      try {
        localStorage.setItem(DAILY_COACH_COMPLETION_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      if (!exists) {
        awardLearningXp({
          eventId: `daily-task:${taskId}:${now.toISOString().slice(0, 10)}`,
          category: 'daily_challenge_completed',
          title: `Completed Daily Plan Task: ${title}`,
          xpAwarded: 20,
        });
      }
      return next;
    });
  };

  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskInput.trim();
    if (!trimmed) return;
    setCustomTasks((prev) => [...prev, { id: `custom-${Date.now()}`, title: trimmed, done: false }]);
    setNewTaskInput('');
  };

  const lastAttempt = allAttempts[0] || null;
  const dailyChallenge = rewardsSummary.challenges.find((c) => c.cadence === 'daily') || rewardsSummary.challenges[0];

  const setupDone = isProfileSetupComplete(studentProfile);
  const cleanName = (studentName || '').trim();

  const handleDoubtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = doubtInput.trim();
    if (!trimmed) return;
    const prefix = doubtLang === 'hi' ? '[Explain in Hinglish] ' : '';
    setDoubtInput('');
    onAskDoubt(`${prefix}${trimmed}`);
  };

  const handleExamTrackChange = (track: ExamTrackId) => {
    setSelectedExamTrack(track);
    if (studentProfile) {
      const updated: StudentAcademicProfile = {
        ...studentProfile,
        targetExam: track,
      };
      studyStorage.saveStudentProfile(updated);
      onUpdateStudentProfile?.(updated);
    }
  };

  return (
    <div className="space-y-8" data-testid="student-home-view">
      {/* 1. Compact Header: Greeting + Exam Track Switcher + Countdown */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {greetingFor(now)}
            {cleanName ? `, ${cleanName}` : ''}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <div
              data-testid="home-exam-track-switcher"
              className="inline-flex rounded-xl border border-line bg-white dark:bg-[#121A2E] p-0.5 text-xs font-semibold"
            >
              <button
                type="button"
                onClick={() => handleExamTrackChange('jee_main')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedExamTrack === 'jee_main'
                    ? 'bg-brand text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                JEE Main 2027
              </button>
              <button
                type="button"
                onClick={() => handleExamTrackChange('jee_advanced')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedExamTrack === 'jee_advanced'
                    ? 'bg-brand text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                JEE Advanced 2027
              </button>
            </div>
            {studentProfile?.schoolClass && (
              <span className="text-xs text-muted font-medium">
                · {studentProfile.schoolClass}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenStudyToolsWorkspace && (
            <button
              type="button"
              onClick={() => onOpenStudyToolsWorkspace('graph2d')}
              data-testid="home-open-study-tools-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink transition-colors cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-brand" />
              <span>Study Tools Lab</span>
            </button>
          )}
          {onOpenMentorReportModal && (
            <button
              type="button"
              onClick={onOpenMentorReportModal}
              data-testid="home-open-mentor-report-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-brand" />
              <span>Weekly Report</span>
            </button>
          )}
          {onOpenCommercialConsoleModal && (
            <button
              type="button"
              onClick={onOpenCommercialConsoleModal}
              data-testid="home-open-commercial-console-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              <span>Plans &amp; Quota</span>
            </button>
          )}
          {countdown && (
            <div
              data-testid="home-compact-countdown"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-warning-soft border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-900 dark:text-amber-300"
            >
              <Flame className="w-4 h-4 text-warning shrink-0" />
              <span>
                {countdown.inProgress
                  ? `${countdown.label} is live (${countdown.startDate})`
                  : `${countdown.daysLeft}d to ${countdown.label}`}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Optional profile setup reminder banner */}
      {!isProfileSyncing && !setupDone && onOpenProfileModal && (
        <div
          data-testid="profile-setup-banner"
          className="rounded-2xl border border-brand-200 dark:border-brand/30 bg-brand-soft/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-ink">
            <UserRound className="w-4 h-4 text-brand shrink-0" />
            <span>
              <strong>Personalize your JEE plan</strong> (name, class, preferred language).
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

      {/* Main 2-column grid matching Image 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (7 cols): My Tasks + Continue with + My Materials + Add Material */}
        <div className="lg:col-span-7 space-y-7">
          {/* 1. My Tasks (AI Practice Coach Daily Plan) */}
          <section
            aria-labelledby="my-tasks-heading"
            data-testid="home-my-tasks-card"
            className="lm-card-editorial p-6 lg:p-7 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 id="my-tasks-heading" className="font-display text-base font-bold text-ink">
                  My Tasks
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-bold">
                  {dailyCoachTasks.filter((t) => t.completed).length +
                    customTasks.filter((t) => t.done).length}
                  /{dailyCoachTasks.length + customTasks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onOpenStudySection) {
                    onOpenStudySection('syllabus');
                  } else {
                    onNavigateTab('study');
                  }
                }}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Explore Syllabus →
              </button>
            </div>

            <div className="divide-y divide-line">
              {dailyCoachTasks.map((task) => (
                <div
                  key={task.id}
                  data-testid={`coach-task-${task.id}`}
                  className="py-2.5 first:pt-0 last:pb-0 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleCoachTask(task.id, task.title)}
                        className="mt-0.5 w-4 h-4 rounded border-line accent-indigo-600 cursor-pointer"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block text-xs sm:text-sm font-semibold ${
                            task.completed ? 'line-through text-muted' : 'text-ink'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {task.subtitle} · ~{task.estimatedMinutes} min
                        </span>
                      </span>
                    </label>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setShowTaskReasonId((prev) => (prev === task.id ? null : task.id))
                        }
                        title="Why is this recommended?"
                        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-soft cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (task.chapterId && onSaveDocument) {
                            const ch = JEE_SYLLABUS_CHAPTERS.find((c) => c.id === task.chapterId);
                            if (ch) {
                              const doc = buildStudyDocumentFromSyllabusChapter(ch, 'full');
                              onSaveDocument(doc);
                              onSelectDoc(doc, 'explain');
                              return;
                            }
                          }
                          onNavigateTab(task.targetTab);
                        }}
                        className="px-3 py-1 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-brand cursor-pointer"
                      >
                        {task.targetTab === 'practice'
                          ? 'Practice'
                          : task.targetTab === 'revision'
                          ? 'Revise'
                          : 'Study'}
                      </button>
                    </div>
                  </div>
                  {showTaskReasonId === task.id && (
                    <p className="text-[11px] text-ink/80 bg-soft px-3 py-1.5 rounded-lg ml-6">
                      <strong>Coach rationale:</strong> {task.reason}
                    </p>
                  )}
                </div>
              ))}

              {customTasks.map((ct) => (
                <div key={ct.id} className="py-2.5 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={ct.done}
                      onChange={() =>
                        setCustomTasks((prev) =>
                          prev.map((item) =>
                            item.id === ct.id ? { ...item, done: !item.done } : item
                          )
                        )
                      }
                      className="w-4 h-4 rounded border-line accent-indigo-600 cursor-pointer"
                    />
                    <span className={ct.done ? 'line-through text-muted' : ''}>{ct.title}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomTasks((prev) => prev.filter((item) => item.id !== ct.id))
                    }
                    className="text-muted hover:text-danger p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add custom task form */}
            <form onSubmit={handleAddCustomTask} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                placeholder="Add a personal study goal for today…"
                data-testid="home-add-custom-task-input"
                className="flex-1 px-3 py-1.5 rounded-xl border border-line bg-canvas text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={!newTaskInput.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-brand" />
                <span>Add</span>
              </button>
            </form>
          </section>

          {/* 2. Continue with Card */}
          {continueDoc ? (
            <section
              aria-labelledby="continue-studying-heading"
              data-testid="home-continue-card"
              className="lm-card-editorial p-5 space-y-3.5 border-brand-200/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="lm-kicker" id="continue-studying-heading">
                    Continue with
                  </p>
                  <h2 className="font-display text-lg font-extrabold text-ink truncate">
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

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSelectDoc(continueDoc, 'explain')}
                  data-testid="continue-open-study-btn"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-brand" />
                  <span>Practice</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectDoc(continueDoc, 'explain');
                    onNavigateTab('revision');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                >
                  <ListChecks className="w-3.5 h-3.5 text-brand" />
                  <span>Revise</span>
                </button>
              </div>
            </section>
          ) : (
            <section
              data-testid="what-you-can-do-guide"
              className="lm-card-editorial p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="lm-kicker">Start Immediately</p>
                  <h2 className="font-display text-base font-bold text-ink">
                    Study Built-In JEE Syllabus Notes or Add Your Own Material
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAddMaterial('pdf')}
                    data-testid="home-upload-material-btn"
                    className="px-3.5 py-1.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-strong transition-colors cursor-pointer"
                  >
                    + Upload Material
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenStudySection) {
                        onOpenStudySection('syllabus');
                      } else {
                        onNavigateTab('study');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-line bg-white hover:bg-soft text-xs font-bold text-ink transition-colors cursor-pointer"
                  >
                    Open JEE Syllabus →
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted">
                Your personal library is completely clean. Upload your own PDF, handwritten photo notes, or YouTube lecture, or study from the separate built-in <strong>JEE Syllabus Notes</strong>.
              </p>
            </section>
          )}

          {/* 3. My Materials Library + Add Material Strip */}
          <section
            aria-labelledby="my-materials-heading"
            data-testid="home-materials-library"
            className="lm-card-editorial p-6 lg:p-7 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="my-materials-heading" className="font-display text-base font-bold text-ink">
                My Materials ({documents.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (onOpenStudySection) {
                    onOpenStudySection('chapter_notes');
                  } else {
                    onNavigateTab('study');
                  }
                }}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                All Chapters &amp; Notes →
              </button>
            </div>

            {sortedDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-5 text-center space-y-2">
                <p className="text-xs font-semibold text-ink">No personal files uploaded yet</p>
                <p className="text-xs text-muted">
                  Upload a PDF, photo of notes, YouTube lecture URL, or study directly from the built-in JEE Syllabus Notes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {sortedDocs.slice(0, 6).map((doc) => {
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
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
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
                        <p className="text-[11px] text-muted truncate">
                          {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                          {relativeTime(doc.lastStudiedAt || doc.createdAt, now)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectDoc(doc, 'explain')}
                          className="px-3 py-1 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                        >
                          Open
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
                              className="px-2.5 py-1 rounded-lg bg-danger text-white text-xs font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded-lg border border-line text-xs text-muted hover:text-ink cursor-pointer"
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
                            className="p-1.5 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-danger-soft text-muted hover:text-danger transition-colors cursor-pointer"
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

            {/* Compact Add Material Strip (PDF · Photo · YouTube · Paste Text) */}
            <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">Add Material:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { mode: 'pdf', label: 'PDF', icon: FileText },
                    { mode: 'photo', label: 'Photo', icon: Camera },
                    { mode: 'youtube', label: 'YouTube', icon: Youtube },
                    { mode: 'paste', label: 'Paste Text', icon: Type },
                  ] as const
                ).map((btn) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.mode}
                      type="button"
                      onClick={() => onOpenAddMaterial(btn.mode)}
                      data-testid={`home-quick-add-${btn.mode}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
                    >
                      <Icon className="w-3.5 h-3.5 text-brand" />
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): Compact Streak/XP/Level/Daily Challenge + Ask a Doubt + Due Today + Last Mock */}
        <div className="lg:col-span-5 space-y-7">
          {/* 1. Compact Streak, XP, Level & Daily Challenge Card (matching Image 10) */}
          <section
            data-testid="home-rewards-summary-card"
            className="lm-card-editorial p-6 lg:p-7 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-line bg-canvas flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-muted block">XP &amp; Level</span>
                  <span
                    data-testid="home-xp-value"
                    className="text-sm font-extrabold text-ink tabular-nums leading-snug break-words block"
                  >
                    {rewardsSummary.totalXp.toLocaleString()} XP · L{rewardsSummary.levelInfo.level}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('analytics')}
                className="p-3 rounded-xl border border-line bg-canvas hover:border-brand text-left flex items-center gap-2.5 cursor-pointer min-w-0"
              >
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-muted block">Rank Tier</span>
                  <span className="text-xs font-bold text-ink leading-snug break-words block">
                    {rewardsSummary.levelInfo.title}
                  </span>
                </div>
              </button>
            </div>

            {dailyChallenge && (
              <div className="p-3.5 rounded-xl border border-line bg-canvas space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-ink">{dailyChallenge.title}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <span className="font-mono font-bold text-brand whitespace-nowrap">
                      {dailyChallenge.currentCount}/{dailyChallenge.targetCount} (+{dailyChallenge.xpReward} XP)
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('practice')}
                      className="px-2.5 py-1 rounded-md bg-brand text-white text-[11px] font-semibold hover:bg-brand-strong whitespace-nowrap cursor-pointer"
                    >
                      Start →
                    </button>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-soft overflow-hidden">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((dailyChallenge.currentCount / dailyChallenge.targetCount) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 14-day Consecutive Study Activity Streak Tracker */}
            <StreakTracker supplementalDates={docActivityDates} />
          </section>

          {/* 2. Ask a Doubt Box with English | Hinglish Toggle */}
          <section
            aria-labelledby="ask-a-doubt-heading"
            data-testid="home-ask-doubt-box"
            className="lm-card-editorial p-6 lg:p-7 space-y-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <MessageCircleQuestion className="w-4 h-4" />
                </span>
                <h2 id="ask-a-doubt-heading" className="font-display text-base font-bold text-ink">
                  Ask a Doubt
                </h2>
              </div>

              <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDoubtLang('en')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    doubtLang === 'en' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setDoubtLang('hi')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer ${
                    doubtLang === 'hi' ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  Hinglish
                </button>
              </div>
            </div>

            <form onSubmit={handleDoubtSubmit} className="space-y-2.5">
              <textarea
                rows={2}
                value={doubtInput}
                onChange={(e) => setDoubtInput(e.target.value)}
                placeholder={
                  continueDoc
                    ? `Ask a doubt about ${continueDoc.title.replace(/\.pdf$/i, '')} or any JEE concept…`
                    : 'Type a Physics, Chemistry, or Mathematics doubt…'
                }
                data-testid="home-doubt-input"
                className="w-full rounded-xl border border-line bg-canvas p-3 text-xs sm:text-sm text-ink placeholder:text-muted focus:outline-none focus:bg-white dark:focus:bg-[#121A2E] focus:border-brand leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">Cites your notes &amp; JEE syllabus</span>
                <button
                  type="submit"
                  disabled={!doubtInput.trim()}
                  data-testid="home-doubt-submit-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl lm-btn-accent text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask Tutor</span>
                </button>
              </div>
            </form>
          </section>

          {/* 3. Due Today */}
          <section
            aria-labelledby="due-today-heading"
            data-testid="home-due-today"
            className="lm-card-editorial p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </span>
                <h2 id="due-today-heading" className="font-display text-base font-bold text-ink">
                  Due Today
                </h2>
              </div>
              {dueTodayItems.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-warning-soft text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold">
                  {dueTodayItems.length}
                </span>
              )}
            </div>

            {dueTodayItems.length === 0 ? (
              <div
                data-testid="home-due-today-empty"
                className="rounded-xl border border-dashed border-line bg-canvas p-4 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold text-ink">No flashcards or revision tasks due right now</p>
                  <p className="text-[11px] text-muted">
                    Review flashcards or generate a revision plan in Revise to schedule spaced repetition.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('revision')}
                  className="px-3 py-1.5 rounded-lg border border-line bg-white dark:bg-[#121A2E] hover:bg-soft text-xs font-semibold text-brand shrink-0 cursor-pointer"
                >
                  Open Revise →
                </button>
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

          {/* 4. Last Mock Summary Card */}
          <section
            aria-labelledby="last-mock-heading"
            data-testid="home-last-mock-card"
            className="lm-card-editorial p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="last-mock-heading" className="font-display text-base font-bold text-ink">
                Last Mock
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('analytics')}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Analysis →
              </button>
            </div>

            {lastAttempt ? (
              <div className="rounded-xl border border-line bg-canvas p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink truncate">
                    {lastAttempt.documentTitle}
                  </span>
                  <span className="text-xs font-extrabold text-brand tabular-nums shrink-0">
                    {lastAttempt.score}/{lastAttempt.totalQuestions} ({lastAttempt.percentage}%)
                  </span>
                </div>
                {lastAttempt.weakTopics.length > 0 && (
                  <p className="text-[11px] text-muted truncate">
                    Focus area: <strong className="text-ink">{lastAttempt.weakTopics[0]}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div
                data-testid="home-last-mock-empty"
                className="rounded-xl border border-dashed border-line bg-canvas p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-bold text-ink">No mock test attempted yet</p>
                  <p className="text-[11px] text-muted">
                    Take a JEE Main or JEE Advanced CBT mock in Practice to track your score and percentile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('practice')}
                  className="px-3 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Start Mock →
                </button>
              </div>
            )}
          </section>

          {/* 5. Daily Mentor Brief (6 empirical answers from real attempts, mistakes & SM-2 cards) */}
          <section
            aria-labelledby="daily-mentor-brief-heading"
            data-testid="home-daily-mentor-brief"
            className="lm-card-editorial p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="daily-mentor-brief-heading" className="font-display text-base font-bold text-ink">
                Daily Mentor Brief
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold">
                {dailyMentorBrief.verifiedPracticeAttemptsCount} Attempts · {dailyMentorBrief.dueItemsCount} Due
              </span>
            </div>
            <dl className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-canvas border border-line">
                <dt className="font-bold text-ink">1. What should I study today?</dt>
                <dd className="text-muted mt-0.5">{dailyMentorBrief.q1WhatToStudyToday}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-canvas border border-line">
                <dt className="font-bold text-ink">2. Why this now?</dt>
                <dd className="text-muted mt-0.5">{dailyMentorBrief.q2WhyThisNow}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-canvas border border-line">
                <dt className="font-bold text-ink">3. How am I progressing?</dt>
                <dd className="text-muted mt-0.5">{dailyMentorBrief.q3HowAmIProgressing}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-canvas border border-line">
                <dt className="font-bold text-ink">4. Where am I losing marks?</dt>
                <dd className="text-muted mt-0.5">{dailyMentorBrief.q4WhereLosingMarks}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-canvas border border-line">
                <dt className="font-bold text-ink">5. What is due for revision today?</dt>
                <dd className="text-muted mt-0.5">{dailyMentorBrief.q5DueForRevisionToday}</dd>
              </div>
              <div className="p-2.5 rounded-xl bg-canvas border border-line">
                <dt className="font-bold text-ink">6. Am I exam-ready?</dt>
                <dd className="text-muted mt-0.5">{dailyMentorBrief.q6AmIExamReady}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
};
