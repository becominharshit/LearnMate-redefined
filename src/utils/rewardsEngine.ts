/**
 * Auditable, Idempotent Points (XP), Levels, Streaks, Achievements & Daily Practice Coach Engine
 * Covers:
 * - Section 18: XP, Levels, Study Streaks, Achievements, Daily Challenges, Weekly Challenges, Rewards History
 * - Idempotent reward assignment via unique event IDs (prevents duplicate XP on refresh, retry, or re-open)
 * - Section 12: AI Practice Coach & Daily Plan (connects Mistake DNA, due flashcards, syllabus progress, and mock attempts)
 */

import type { QuizAttempt, StudyDocument } from '../types/study';
import { JEE_SYLLABUS_CHAPTERS, type ExamTrackId } from '../data/jeeSyllabusAndNotes';
import {
  computeStudyStreak,
  getStudyActivityDatesFromLocalStorage,
  localDayKey,
} from './jeeSubjects';

export type RewardEventCategory =
  | 'practice_completed'
  | 'mock_completed'
  | 'flashcard_due_reviewed'
  | 'mistake_remediated'
  | 'chapter_notes_completed'
  | 'daily_challenge_completed'
  | 'weekly_challenge_completed'
  | 'focus_session_completed'
  | 'pyq_solved'
  | 'flashcard_reviewed'
  | string;

export interface RewardLedgerEntry {
  eventId: string; // deterministic idempotent key, e.g. "practice:attempt-123"
  category: RewardEventCategory;
  actionType?: string;
  title: string;
  label?: string;
  xpAwarded: number;
  xpDelta?: number;
  xp: number;
  awardedAt: string;
  timestamp?: string;
  metadata?: Record<string, string | number>;
}

export interface StudentLevelInfo {
  level: number;
  title: string;
  rankTier: string;
  currentXp: number;
  levelFloorXp: number;
  nextLevelXp: number;
  progressPct: number;
}

export interface ChallengeProgressItem {
  id: string;
  cadence: 'daily' | 'weekly';
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  actionTab: 'dashboard' | 'study' | 'practice' | 'revision' | 'analytics';
}

export interface AchievementBadgeItem {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  xpBonus: number;
  progress: number;
  target: number;
}

export interface DailyCoachTask {
  id: string;
  title: string;
  subtitle: string;
  reason: string;
  rationale: string;
  estimatedMinutes: number;
  xpReward: number;
  category: 'mistake_recovery' | 'due_revision' | 'chapter_study' | 'pyq_practice';
  completed: boolean;
  targetTab: 'study' | 'practice' | 'revision' | 'analytics';
  chapterId?: string;
}

export const REWARDS_LEDGER_STORAGE_KEY = 'learnmate_rewards_ledger_v1';
export const DAILY_COACH_COMPLETION_KEY = 'learnmate_daily_coach_completed_v1';

const LEVEL_THRESHOLDS: Array<{ level: number; minXp: number; title: string }> = [
  { level: 1, minXp: 0, title: 'Foundation Builder' },
  { level: 2, minXp: 150, title: 'Concept Explorer' },
  { level: 3, minXp: 400, title: 'Problem Solver' },
  { level: 4, minXp: 800, title: 'PYQ Challenger' },
  { level: 5, minXp: 1400, title: 'Chapter Strategist' },
  { level: 6, minXp: 2200, title: 'Achiever' },
  { level: 7, minXp: 3200, title: 'Rank Contender' },
  { level: 8, minXp: 4500, title: 'JEE Scholar' },
];

export function computeLevelFromXp(totalXp: number): StudentLevelInfo {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let current = LEVEL_THRESHOLDS[0];
  let next = LEVEL_THRESHOLDS[1];

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (safeXp >= LEVEL_THRESHOLDS[i].minXp) {
      current = LEVEL_THRESHOLDS[i];
      next = LEVEL_THRESHOLDS[i + 1] || {
        level: current.level + 1,
        minXp: current.minXp + 1500,
        title: 'JEE Master',
      };
    }
  }

  const span = Math.max(1, next.minXp - current.minXp);
  const intoLevel = Math.max(0, safeXp - current.minXp);
  const progressPct = Math.min(100, Math.round((intoLevel / span) * 100));

  return {
    level: current.level,
    title: current.title,
    rankTier: `L${current.level} — ${current.title}`,
    currentXp: safeXp,
    levelFloorXp: current.minXp,
    nextLevelXp: next.minXp,
    progressPct,
  };
}

export function getRewardsLedger(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): RewardLedgerEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(REWARDS_LEDGER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Deduplicate by eventId on read to guarantee integrity even after legacy imports
    const seen = new Set<string>();
    const clean: RewardLedgerEntry[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item.eventId === 'string' &&
        typeof item.xpAwarded === 'number' &&
        !seen.has(item.eventId)
      ) {
        seen.add(item.eventId);
        clean.push({
          ...item,
          label: item.label || item.title,
          xpDelta: item.xpDelta ?? item.xpAwarded,
          xp: item.xp ?? item.xpAwarded,
          timestamp: item.timestamp || item.awardedAt,
        } as RewardLedgerEntry);
      }
    }
    return clean;
  } catch {
    return [];
  }
}

export interface AwardXpInput {
  eventId: string;
  category?: RewardEventCategory;
  actionType?: RewardEventCategory;
  title?: string;
  label?: string;
  xpAwarded?: number;
  xpDelta?: number;
  xp?: number;
  subject?: string;
  chapterId?: string;
  awardedAt?: string;
  metadata?: Record<string, string | number>;
}

/**
 * Idempotently awards XP for a learning action.
 * If `eventId` already exists in the ledger, returns `{ awarded: false }` and never duplicates XP.
 */
export function awardLearningXp(
  entry: AwardXpInput,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): {
  awarded: boolean;
  entry: RewardLedgerEntry;
  totalXp: number;
  levelInfo: StudentLevelInfo;
} {
  const ledger = getRewardsLedger(storage);
  const existing = ledger.find((e) => e.eventId === entry.eventId);

  if (existing) {
    const totalXp = ledger.reduce((sum, e) => sum + e.xpAwarded, 0);
    return {
      awarded: false,
      entry: existing,
      totalXp,
      levelInfo: computeLevelFromXp(totalXp),
    };
  }

  const xpVal = Math.max(0, Math.round(entry.xpAwarded ?? entry.xpDelta ?? entry.xp ?? 10));
  const titleVal = entry.title || entry.label || 'Learning Milestone';
  const categoryVal = entry.category || entry.actionType || 'practice_completed';
  const nowIso = entry.awardedAt || new Date().toISOString();

  const finalEntry: RewardLedgerEntry = {
    eventId: entry.eventId,
    category: categoryVal,
    actionType: categoryVal,
    title: titleVal,
    label: titleVal,
    xpAwarded: xpVal,
    xpDelta: xpVal,
    xp: xpVal,
    awardedAt: nowIso,
    timestamp: nowIso,
    metadata: entry.metadata,
  };

  const nextLedger = [finalEntry, ...ledger];
  if (storage) {
    try {
      storage.setItem(REWARDS_LEDGER_STORAGE_KEY, JSON.stringify(nextLedger));
    } catch {
      // Ignore storage quota errors
    }
  }

  const totalXp = nextLedger.reduce((sum, e) => sum + e.xpAwarded, 0);
  return {
    awarded: true,
    entry: finalEntry,
    totalXp,
    levelInfo: computeLevelFromXp(totalXp),
  };
}

/**
 * Syncs baseline ledger entries from real existing student quiz attempts and focus sessions
 * so existing accounts immediately reflect their true earned XP without synthetic numbers.
 */
export function syncRewardsFromActualStudentActivity(params: {
  attempts: QuizAttempt[];
  focusSessionsCount?: number;
  focusSessions?: number | unknown[];
  documentsCount?: number;
  streakDays?: number;
  reviewedFlashcardsCount?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}): {
  ledger: RewardLedgerEntry[];
  recentEvents: RewardLedgerEntry[];
  totalXp: number;
  level: number;
  levelTitle: string;
  rankTier: string;
  levelInfo: StudentLevelInfo;
  challenges: ChallengeProgressItem[];
  achievements: AchievementBadgeItem[];
} {
  const {
    attempts,
    focusSessionsCount: rawFocusCount,
    focusSessions,
    reviewedFlashcardsCount = 0,
    storage = typeof window !== 'undefined' ? window.localStorage : null,
  } = params;
  const focusSessionsCount =
    rawFocusCount ??
    (Array.isArray(focusSessions) ? focusSessions.length : typeof focusSessions === 'number' ? focusSessions : 0);

  for (const att of attempts) {
    const answeredCount = att.answers ? att.answers.filter((a) => a.selectedIndex >= 0).length : 0;
    if (answeredCount > 0) {
      const isMock = att.totalQuestions >= 15 || att.documentTitle.toLowerCase().includes('mock');
      awardLearningXp(
        {
          eventId: `attempt:${att.id}`,
          category: isMock ? 'mock_completed' : 'practice_completed',
          title: `${isMock ? 'Completed Mock' : 'Completed Practice Set'}: ${att.documentTitle}`,
          xpAwarded: isMock ? 80 : 35,
          awardedAt: att.completedAt,
        },
        storage
      );
    }
  }

  const ledger = getRewardsLedger(storage);
  const totalXp = ledger.reduce((sum, e) => sum + e.xpAwarded, 0);
  const levelInfo = computeLevelFromXp(totalXp);

  const totalQuestionsSolved = attempts.reduce(
    (sum, a) => sum + (a.answers ? a.answers.filter((ans) => ans.selectedIndex >= 0).length : 0),
    0
  );

  const todayKey = localDayKey(new Date());
  const todayQuestionsSolved = attempts
    .filter((a) => (a.completedAt || '').slice(0, 10) === todayKey)
    .reduce(
      (sum, a) => sum + (a.answers ? a.answers.filter((ans) => ans.selectedIndex >= 0).length : 0),
      0
    );

  const streakDays = computeStudyStreak([
    ...getStudyActivityDatesFromLocalStorage(storage),
    ...attempts.map((a) => new Date(a.completedAt)),
  ]);

  const challenges: ChallengeProgressItem[] = [
    {
      id: `daily-solve-10-${todayKey}`,
      cadence: 'daily',
      title: 'Solve 10 JEE Questions Today',
      description: 'Complete at least 10 PYQ or chapter practice questions today.',
      targetCount: 10,
      currentCount: Math.min(10, todayQuestionsSolved),
      target: 10,
      current: Math.min(10, todayQuestionsSolved),
      xpReward: 40,
      completed: todayQuestionsSolved >= 10,
      actionTab: 'practice',
    },
    {
      id: 'weekly-solve-50-qs',
      cadence: 'weekly',
      title: 'Solve 50 JEE Questions',
      description: 'Build speed and accuracy across Physics, Chemistry, and Mathematics.',
      targetCount: 50,
      currentCount: Math.min(50, totalQuestionsSolved),
      target: 50,
      current: Math.min(50, totalQuestionsSolved),
      xpReward: 120,
      completed: totalQuestionsSolved >= 50,
      actionTab: 'practice',
    },
    {
      id: 'weekly-focus-sessions',
      cadence: 'weekly',
      title: 'Complete 5 Focus Sessions',
      description: 'Use the 25-minute Pomodoro timer for distraction-free study blocks.',
      targetCount: 5,
      currentCount: Math.min(5, focusSessionsCount),
      target: 5,
      current: Math.min(5, focusSessionsCount),
      xpReward: 75,
      completed: focusSessionsCount >= 5,
      actionTab: 'study',
    },
    {
      id: 'weekly-revise-cards',
      cadence: 'weekly',
      title: 'Review 15 Spaced-Repetition Flashcards',
      description: 'Keep key formulas and reactions active in memory.',
      targetCount: 15,
      currentCount: Math.min(15, reviewedFlashcardsCount),
      target: 15,
      current: Math.min(15, reviewedFlashcardsCount),
      xpReward: 60,
      completed: reviewedFlashcardsCount >= 15,
      actionTab: 'revision',
    },
  ];

  const achievements: AchievementBadgeItem[] = [
    {
      id: 'ach-first-attempt',
      title: 'First Practice Set',
      description: 'Completed your first JEE practice or diagnostic test.',
      unlocked: attempts.length >= 1,
      unlockedAt: attempts[0]?.completedAt,
      xpBonus: 25,
      progress: Math.min(1, attempts.length),
      target: 1,
    },
    {
      id: 'ach-streak-3',
      title: 'Consistent Scholar',
      description: 'Maintained a consecutive study streak of 3 or more days.',
      unlocked: streakDays >= 3,
      xpBonus: 50,
      progress: Math.min(3, streakDays),
      target: 3,
    },
    {
      id: 'ach-accuracy-80',
      title: 'High Precision',
      description: 'Achieved 80% or higher accuracy on a JEE practice set.',
      unlocked: attempts.some((a) => a.percentage >= 80 && a.totalQuestions >= 4),
      xpBonus: 60,
      progress: attempts.some((a) => a.percentage >= 80 && a.totalQuestions >= 4) ? 1 : 0,
      target: 1,
    },
    {
      id: 'ach-focus-champion',
      title: 'Deep Focus',
      description: 'Completed at least 1 timed Focus session.',
      unlocked: focusSessionsCount >= 1,
      xpBonus: 30,
      progress: Math.min(1, focusSessionsCount),
      target: 1,
    },
  ];

  return {
    ledger,
    recentEvents: ledger,
    totalXp,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    rankTier: levelInfo.rankTier,
    levelInfo,
    challenges,
    achievements,
  };
}

/**
 * Builds realistic, editable Daily Tasks for the Home dashboard & AI Practice Coach
 * using actual student mistakes, due flashcards, syllabus progress, and target exam.
 */
export function buildDailyPracticeCoachPlan(params: {
  documents: StudyDocument[];
  attempts: QuizAttempt[];
  weakTopics: string[];
  dueFlashcardsCount: number;
  targetExam?: ExamTrackId;
  completedTaskIds?: string[];
}): DailyCoachTask[] {
  const {
    documents,
    attempts,
    weakTopics,
    dueFlashcardsCount,
    targetExam = 'jee_main',
    completedTaskIds = [],
  } = params;

  const doneSet = new Set(completedTaskIds);
  const tasks: DailyCoachTask[] = [];

  // 1. Mistake recovery task if student has recorded weak topics
  if (weakTopics.length > 0) {
    const topWeak = weakTopics[0];
    const id = `coach-weak-${topWeak.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const reason = `Flagged from your recent practice performance on ${topWeak}.`;
    tasks.push({
      id,
      title: `Remediate weak topic: ${topWeak}`,
      subtitle: 'Review concept notes & solve 5 targeted recovery questions',
      reason,
      rationale: reason,
      estimatedMinutes: 20,
      xpReward: 40,
      category: 'mistake_recovery',
      completed: doneSet.has(id),
      targetTab: 'practice',
    });
  } else {
    // Recommend starting with a high-yield chapter note
    const firstChapter = JEE_SYLLABUS_CHAPTERS[0];
    const id = `coach-study-${firstChapter.id}`;
    const reason = `High-weightage ${targetExam === 'jee_advanced' ? 'JEE Advanced' : 'JEE Main'} foundation chapter (${firstChapter.weightageQuestionsApprox[targetExam]}).`;
    tasks.push({
      id,
      title: `Study ${firstChapter.title} (${firstChapter.subject})`,
      subtitle: 'Read Full Notes & complete revision checkpoint',
      reason,
      rationale: reason,
      estimatedMinutes: 25,
      xpReward: 45,
      category: 'chapter_study',
      completed: doneSet.has(id),
      targetTab: 'study',
      chapterId: firstChapter.id,
    });
  }

  // 2. Spaced repetition / revision task
  if (dueFlashcardsCount > 0) {
    const id = 'coach-due-flashcards';
    const reason = 'Scheduled today based on your recall intervals.';
    tasks.push({
      id,
      title: `Review ${dueFlashcardsCount} due flashcard${dueFlashcardsCount === 1 ? '' : 's'}`,
      subtitle: 'SM-2 spaced repetition review in Revise',
      reason,
      rationale: reason,
      estimatedMinutes: 10,
      xpReward: 25,
      category: 'due_revision',
      completed: doneSet.has(id),
      targetTab: 'revision',
    });
  } else {
    const id = 'coach-mindmap-revise';
    const reason = 'Active recall strengthens retention before solving PYQs.';
    tasks.push({
      id,
      title: 'Run a 2-minute Concept Mind Map review',
      subtitle: 'Inspect key formulas, definitions & common traps',
      reason,
      rationale: reason,
      estimatedMinutes: 10,
      xpReward: 25,
      category: 'due_revision',
      completed: doneSet.has(id),
      targetTab: 'revision',
    });
  }

  // 3. Official PYQ / Mock Practice task
  const pyqTaskId = `coach-pyq-${targetExam}`;
  const pyqReason = 'Consistent timed PYQ practice builds exam-day speed and accuracy.';
  tasks.push({
    id: pyqTaskId,
    title:
      attempts.length === 0
        ? `Solve your first ${targetExam === 'jee_advanced' ? 'JEE Advanced' : 'JEE Main'} PYQ set`
        : `Solve 10 ${targetExam === 'jee_advanced' ? 'JEE Advanced' : 'JEE Main'} Official PYQs`,
    subtitle:
      documents.length > 0
        ? `Connected to ${documents[0].title.replace(/\.pdf$/i, '')} & syllabus archive`
        : 'Official multi-year paper archive with step-by-step solutions',
    reason: pyqReason,
    rationale: pyqReason,
    estimatedMinutes: 25,
    xpReward: 50,
    category: 'pyq_practice',
    completed: doneSet.has(pyqTaskId),
    targetTab: 'practice',
  });

  return tasks;
}
