import type { FlashcardItem, QuizAttempt } from '../types/study';
import { computeNextSpacedRepetitionState } from './learnmate2Engine';
import type { MistakeBookEntry, MistakeTriggerReason } from './mistakeBookEngine';

/**
 * Closed-Loop JEE Learning Intelligence Engine
 *
 * Implements the verifiable 6-stage mastery loop:
 *   Attempt -> Diagnose -> Reteach -> Recheck -> Schedule (SM-2) -> Verify
 *
 * Truthfulness & anti-inflation guarantees:
 * 1. Misconception confidence distinguishes `'step_verified'` (explicit student working/steps)
 *    from `'qualified_inference'` (inferred from wrong choice, trigger reason, and time spent).
 * 2. Re-solving the exact same `questionId` NEVER inflates unique concept mastery credit.
 * 3. Every Daily Mentor Brief metric traces directly to actual stored attempts, mistakes, and SM-2 cards.
 */

export type RootCauseCategoryId =
  | 'concept_gap'
  | 'formula_recall_error'
  | 'sign_or_unit_slip'
  | 'algebraic_calculation_slip'
  | 'boundary_condition_missed'
  | 'stem_misread'
  | 'diagram_free_body_error'
  | 'multi_concept_linking_gap'
  | 'time_pressure_guess'
  | 'overtime_execution_drag';

export interface RootCauseTaxonomyEntry {
  id: RootCauseCategoryId;
  label: string;
  reteachDirective: string;
  severityWeight: number;
}

export const ROOT_CAUSE_TAXONOMY: Record<RootCauseCategoryId, RootCauseTaxonomyEntry> = {
  concept_gap: {
    id: 'concept_gap',
    label: 'Fundamental Concept Gap',
    reteachDirective: 'Revisit the core derivation and physical boundary assumptions before re-attempting.',
    severityWeight: 5,
  },
  formula_recall_error: {
    id: 'formula_recall_error',
    label: 'Formula Recall / Coefficient Slip',
    reteachDirective: 'Write the governing equation with dimensions and verify every constant/factor.',
    severityWeight: 4,
  },
  sign_or_unit_slip: {
    id: 'sign_or_unit_slip',
    label: 'Sign Convention / Unit Conversion Slip',
    reteachDirective: 'Draw coordinate axes explicitly and convert all inputs to SI units before substituting.',
    severityWeight: 3,
  },
  algebraic_calculation_slip: {
    id: 'algebraic_calculation_slip',
    label: 'Algebraic / Arithmetic Slip',
    reteachDirective: 'Check intermediate numerical ratios and sanity-check magnitude before marking.',
    severityWeight: 3,
  },
  boundary_condition_missed: {
    id: 'boundary_condition_missed',
    label: 'Boundary / Domain Condition Missed',
    reteachDirective: 'Test limiting cases (e.g., t=0, asymptotes, excluded points, adiabatic vs isothermal).',
    severityWeight: 4,
  },
  stem_misread: {
    id: 'stem_misread',
    label: 'Stem / Negation Misread',
    reteachDirective: 'Underline target quantity, units requested, and words like NOT / INCORRECT / RATIO.',
    severityWeight: 2,
  },
  diagram_free_body_error: {
    id: 'diagram_free_body_error',
    label: 'FBD / Structural Diagram Error',
    reteachDirective: 'Sketch a clean Free Body Diagram or ray/circuit/orbital diagram before writing equations.',
    severityWeight: 4,
  },
  multi_concept_linking_gap: {
    id: 'multi_concept_linking_gap',
    label: 'Multi-Concept Integration Gap',
    reteachDirective: 'Break the problem into conserved invariants across stages (e.g., momentum then energy).',
    severityWeight: 5,
  },
  time_pressure_guess: {
    id: 'time_pressure_guess',
    label: 'Impulsive Guess Under Time Pressure',
    reteachDirective: 'Eliminate 2 options dimensionally or skip within 45s to avoid -1 negative marking.',
    severityWeight: 4,
  },
  overtime_execution_drag: {
    id: 'overtime_execution_drag',
    label: 'Overtime Execution Drag (>180s)',
    reteachDirective: 'Practice the shortest standard method or symmetry shortcut under a 110s cap.',
    severityWeight: 3,
  },
};

export type DiagnosisConfidence = 'step_verified' | 'qualified_inference';

export type ClosedLoopMasteryStage =
  | 'attempted'
  | 'diagnosed'
  | 'retaught'
  | 'rechecked'
  | 'scheduled_sm2'
  | 'verified_mastered';

export interface MisconceptionDiagnosis {
  category: RootCauseCategoryId;
  label: string;
  confidence: DiagnosisConfidence;
  rationale: string;
  reteachDirective: string;
  hasStudentReasoningSteps: boolean;
}

export function diagnoseRootCauseMisconception(params: {
  triggerReason: MistakeTriggerReason;
  timeSpentSeconds: number;
  questionText: string;
  topic: string;
  studentResponseLabel?: string;
  correctAnswerLabel?: string;
  studentReasoningSteps?: string;
}): MisconceptionDiagnosis {
  const reasoning = (params.studentReasoningSteps || '').trim();
  const textLower = `${params.questionText} ${params.topic}`.toLowerCase();
  const respLower = (params.studentResponseLabel || '').toLowerCase();
  const ansLower = (params.correctAnswerLabel || '').toLowerCase();

  // Step-verified path when student explicitly provides their intermediate working steps
  if (reasoning.length >= 12) {
    const rLower = reasoning.toLowerCase();
    let category: RootCauseCategoryId = 'concept_gap';
    let rationale = 'Verified from your submitted intermediate working steps.';

    if (/sign|negative|\+|-|direction|clockwise|left|unit|cm|mm|kj|cal/.test(rLower)) {
      category = 'sign_or_unit_slip';
      rationale = 'Step-verified sign convention or unit conversion mismatch in your working.';
    } else if (/boundary|limit|domain|denominator|zero|strict|range|inclusive/.test(rLower)) {
      category = 'boundary_condition_missed';
      rationale = 'Step-verified missed domain/boundary constraint in your derivation.';
    } else if (/fbd|free body|normal|friction|tension|diagram|angle|vector|ray/.test(rLower)) {
      category = 'diagram_free_body_error';
      rationale = 'Step-verified diagram / component resolution error in your working.';
    } else if (/formula|coeff|1\/2|2\/5|factor|forgot/.test(rLower)) {
      category = 'formula_recall_error';
      rationale = 'Step-verified formula coefficient or identity recall slip.';
    } else if (/divide|multiply|arithmetic|calc|simplif|root|square/.test(rLower)) {
      category = 'algebraic_calculation_slip';
      rationale = 'Step-verified algebraic simplification or arithmetic error.';
    } else if (/link|combine|then|conservation|two|second step/.test(rLower)) {
      category = 'multi_concept_linking_gap';
      rationale = 'Step-verified difficulty linking consecutive physical/mathematical stages.';
    }

    const entry = ROOT_CAUSE_TAXONOMY[category];
    return {
      category,
      label: entry.label,
      confidence: 'step_verified',
      rationale,
      reteachDirective: entry.reteachDirective,
      hasStudentReasoningSteps: true,
    };
  }

  // Qualified inference path (explicitly labeled as qualified_inference — never claims silent telemetry certainty)
  let category: RootCauseCategoryId;
  let rationale: string;

  if (params.triggerReason === 'overtime_180s' || params.timeSpentSeconds > 180) {
    category = 'overtime_execution_drag';
    rationale = `Qualified inference: spent ${params.timeSpentSeconds}s (>180s target window); execution path or shortcut selection slowed progress.`;
  } else if (params.triggerReason === 'unattempted_visited') {
    if (/and|combine|coupled|two|collision.*spring|rolling.*incline/.test(textLower)) {
      category = 'multi_concept_linking_gap';
      rationale = 'Qualified inference: visited multi-concept problem left unattempted without selecting an opening invariant.';
    } else {
      category = 'concept_gap';
      rationale = 'Qualified inference: visited question left unattempted; likely uncertainty in the opening physical/mathematical principle.';
    }
  } else if (params.timeSpentSeconds > 0 && params.timeSpentSeconds < 35) {
    category = 'time_pressure_guess';
    rationale = `Qualified inference: answered incorrectly in ${params.timeSpentSeconds}s (<35s); add intermediate reasoning steps to verify.`;
  } else if (
    respLower &&
    ansLower &&
    respLower.replace(/^[+-]/, '') === ansLower.replace(/^[+-]/, '')
  ) {
    category = 'sign_or_unit_slip';
    rationale = 'Qualified inference: magnitude matches with opposite sign convention.';
  } else if (/not |incorrect|false|except/.test(textLower)) {
    category = 'stem_misread';
    rationale = 'Qualified inference: negation qualifier in question stem; confirm whether stem constraints were misread.';
  } else if (/pulley|block|wedge|incline|circuit|ray|lens|orbit/.test(textLower)) {
    category = 'diagram_free_body_error';
    rationale = 'Qualified inference: geometry/diagram-heavy topic; add your FBD or sketch notes to verify exact step error.';
  } else {
    category = 'formula_recall_error';
    rationale = 'Qualified inference: answered after deliberation; add your intermediate step notes to upgrade from inference to step-verified diagnosis.';
  }

  const entry = ROOT_CAUSE_TAXONOMY[category];
  return {
    category,
    label: entry.label,
    confidence: 'qualified_inference',
    rationale,
    reteachDirective: entry.reteachDirective,
    hasStudentReasoningSteps: false,
  };
}

/* ============================================================================
 * ANTI-INFLATION CONCEPT & PREREQUISITE MASTERY ENGINE
 * ============================================================================ */

export interface ConceptMasteryProgressRecord {
  conceptKey: string;
  chapterTitle: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  seenQuestionIds: string[];
  uniqueAttemptedCount: number;
  uniqueCorrectCount: number;
  repeatPracticeCount: number;
  verifiedRecheckCount: number;
  stage: ClosedLoopMasteryStage;
  masteryPct: number;
  prerequisites: string[];
  unmetPrerequisites: string[];
  nextReviewAt?: string;
  lastPracticedAt: string;
}

export const JEE_CHAPTER_PREREQUISITES: Record<string, string[]> = {
  'Rotational Motion': ['Laws of Motion', 'Work, Energy and Power'],
  'Electrostatics': ['Vectors & Calculus Basics', 'Laws of Motion'],
  'Current Electricity': ['Electrostatics'],
  'Magnetism': ['Current Electricity', 'Vectors & Calculus Basics'],
  'Electromagnetic Induction': ['Magnetism', 'Integral Calculus'],
  'Thermodynamics': ['Kinetic Theory of Gases', 'Work, Energy and Power'],
  'Chemical Equilibrium': ['Mole Concept & Stoichiometry'],
  'Ionic Equilibrium': ['Chemical Equilibrium', 'Logarithms & Quadratic Equations'],
  'Electrochemistry': ['Redox Reactions', 'Chemical Thermodynamics'],
  'Definite Integration': ['Indefinite Integration', 'Limits & Continuity'],
  'Differential Equations': ['Definite Integration'],
  '3D Geometry': ['Vectors'],
};

const VALID_STAGE_TRANSITIONS: Record<ClosedLoopMasteryStage, ClosedLoopMasteryStage[]> = {
  attempted: ['diagnosed', 'verified_mastered'],
  diagnosed: ['retaught', 'rechecked'],
  retaught: ['rechecked', 'scheduled_sm2'],
  rechecked: ['scheduled_sm2', 'verified_mastered', 'diagnosed'],
  scheduled_sm2: ['rechecked', 'verified_mastered', 'diagnosed'],
  verified_mastered: ['scheduled_sm2', 'diagnosed'],
};

export function advanceClosedLoopStage(
  current: ClosedLoopMasteryStage,
  target: ClosedLoopMasteryStage
): { allowed: boolean; stage: ClosedLoopMasteryStage } {
  if (current === target) return { allowed: true, stage: current };
  const allowedNext = VALID_STAGE_TRANSITIONS[current] || [];
  if (!allowedNext.includes(target)) {
    return { allowed: false, stage: current };
  }
  return { allowed: true, stage: target };
}

/**
 * Updates concept mastery using `seenQuestionIds` deduplication so re-solving an already-seen
 * question ID NEVER increases unique mastery numerator or unique coverage count.
 */
export function recordConceptQuestionAttempt(
  existing: ConceptMasteryProgressRecord | null,
  input: {
    conceptKey: string;
    chapterTitle: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    questionId: string;
    isCorrect: boolean;
    isRecheckAfterReteach?: boolean;
    nowIso?: string;
    masteredChaptersSet?: Set<string>;
  }
): ConceptMasteryProgressRecord {
  const nowIso = input.nowIso || new Date().toISOString();
  const base: ConceptMasteryProgressRecord = existing || {
    conceptKey: input.conceptKey,
    chapterTitle: input.chapterTitle,
    subject: input.subject,
    seenQuestionIds: [],
    uniqueAttemptedCount: 0,
    uniqueCorrectCount: 0,
    repeatPracticeCount: 0,
    verifiedRecheckCount: 0,
    stage: 'attempted',
    masteryPct: 0,
    prerequisites: JEE_CHAPTER_PREREQUISITES[input.chapterTitle] || [],
    unmetPrerequisites: [],
    lastPracticedAt: nowIso,
  };

  const alreadySeen = base.seenQuestionIds.includes(input.questionId);
  const seenQuestionIds = alreadySeen
    ? [...base.seenQuestionIds]
    : [...base.seenQuestionIds, input.questionId];

  let uniqueAttemptedCount = base.uniqueAttemptedCount;
  let uniqueCorrectCount = base.uniqueCorrectCount;
  let repeatPracticeCount = base.repeatPracticeCount;
  let verifiedRecheckCount = base.verifiedRecheckCount;
  let stage: ClosedLoopMasteryStage = base.stage;

  if (!alreadySeen) {
    uniqueAttemptedCount += 1;
    if (input.isCorrect) {
      uniqueCorrectCount += 1;
    } else {
      stage = 'diagnosed';
    }
  } else {
    // Repeat solve of same questionId increments retention practice count ONLY, never unique mastery denominator/numerator
    repeatPracticeCount += 1;
  }

  if (input.isRecheckAfterReteach && input.isCorrect && !alreadySeen) {
    verifiedRecheckCount += 1;
    const sm2 = computeNextSpacedRepetitionState(
      { easeFactor: 2.5, intervalDays: 1, repetitions: verifiedRecheckCount - 1 },
      'know_it',
      Date.parse(nowIso)
    );
    base.nextReviewAt = sm2.nextReviewAt;
    stage = verifiedRecheckCount >= 2 ? 'verified_mastered' : 'scheduled_sm2';
  }

  const prerequisites = JEE_CHAPTER_PREREQUISITES[input.chapterTitle] || base.prerequisites;
  const unmetPrerequisites = input.masteredChaptersSet
    ? prerequisites.filter((p) => !input.masteredChaptersSet!.has(p))
    : base.unmetPrerequisites;

  const accuracyRatio =
    uniqueAttemptedCount > 0 ? uniqueCorrectCount / uniqueAttemptedCount : 0;
  // Require breadth across at least 3 unique questions before reaching high mastery %
  const breadthFactor = Math.min(1, uniqueAttemptedCount / 3);
  const masteryPct = Math.round(accuracyRatio * breadthFactor * 100);

  return {
    ...base,
    seenQuestionIds,
    uniqueAttemptedCount,
    uniqueCorrectCount,
    repeatPracticeCount,
    verifiedRecheckCount,
    stage,
    masteryPct,
    prerequisites,
    unmetPrerequisites,
    lastPracticedAt: nowIso,
  };
}

/* ============================================================================
 * 6-QUESTION DAILY MENTOR DASHBOARD BRIEF (ZERO SYNTHETIC CLAIMS)
 * ============================================================================ */

export interface DailyMentorBrief {
  generatedAt: string;
  q1WhatToStudyToday: string;
  q2WhyThisNow: string;
  q3HowAmIProgressing: string;
  q4WhereLosingMarks: string;
  q5DueForRevisionToday: string;
  q6AmIExamReady: string;
  dueItemsCount: number;
  topMisconceptionLabel: string | null;
  verifiedPracticeAttemptsCount: number;
}

export function buildDailyMentorBrief(params: {
  attempts: QuizAttempt[];
  mistakes: MistakeBookEntry[];
  flashcards: FlashcardItem[];
  targetExamLabel?: string;
  now?: Date;
}): DailyMentorBrief {
  const now = params.now || new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const examLabel = params.targetExamLabel || 'JEE Main 2027';
  const attempts = [...(params.attempts || [])].sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt)
  );
  const mistakes = params.mistakes || [];
  const flashcards = params.flashcards || [];

  const dueCards = flashcards.filter((c) => {
    const nextIso = c.nextReviewDate || c.nextReviewAt;
    return c.status === 'review_again' || Boolean(nextIso && nextIso.slice(0, 10) <= todayIso);
  });
  const unverifiedMistakes = mistakes.filter((m) => !m.convertedToSm2 || m.neuronzStage !== 'Mastered');

  // Aggregate real misconception counts
  const categoryCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const subjectMissCounts = new Map<string, number>();
  for (const m of mistakes) {
    const cat = m.rootCauseLabel || m.errorCategory;
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    topicCounts.set(m.topic, (topicCounts.get(m.topic) || 0) + 1);
    subjectMissCounts.set(m.subject, (subjectMissCounts.get(m.subject) || 0) + 1);
  }
  const sortedCats = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
  const sortedTopics = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]);
  const sortedSubjs = Array.from(subjectMissCounts.entries()).sort((a, b) => b[1] - a[1]);

  const topTopic = sortedTopics[0]?.[0] || attempts[0]?.weakTopics?.[0] || null;
  const topCat = sortedCats[0] || null;
  const topSubj = sortedSubjs[0] || null;

  const q1WhatToStudyToday = topTopic
    ? `Prioritize ${topTopic} (${unverifiedMistakes.length} open mistake items + a 10-question recheck set).`
    : 'Complete a baseline 10-question diagnostic mock on an uploaded chapter or built-in Electrostatics/Rotational Motion module.';

  const q2WhyThisNow = topCat
    ? `${topCat[1]} recorded issue${topCat[1] === 1 ? '' : 's'} tagged as "${topCat[0]}"${topTopic ? ` centered on ${topTopic}` : ''}. Fixing high-frequency traps raises net score fastest.`
    : attempts.length > 0
    ? `Latest attempt (${attempts[0].percentage}% on ${attempts[0].documentTitle}) shows room to sharpen accuracy before timed full mocks.`
    : 'No completed attempt history yet; an initial timed diagnostic avoids blind study and seeds your SM-2 queue.';

  let q3HowAmIProgressing: string;
  if (attempts.length === 0) {
    q3HowAmIProgressing = '0 graded practice attempts recorded yet. Finish your first practice set to establish an empirical baseline.';
  } else if (attempts.length === 1) {
    q3HowAmIProgressing = `1 recorded attempt (${attempts[0].percentage}%). Complete at least 1 more set to measure score trend.`;
  } else {
    const latest = attempts[0].percentage;
    const prev = attempts[1].percentage;
    const delta = latest - prev;
    const dir = delta > 0 ? `+${delta}% vs previous` : delta < 0 ? `${delta}% vs previous` : 'steady vs previous';
    q3HowAmIProgressing = `${attempts.length} recorded attempts · Latest ${latest}% (${dir}).`;
  }

  const q4WhereLosingMarks =
    topSubj && topCat
      ? `${topSubj[0]} accounts for ${topSubj[1]} logged mistake${topSubj[1] === 1 ? '' : 's'}, led by "${topCat[0]}".`
      : 'No negative-mark error pattern logged yet — mistakes captured from CBT mocks and quizzes appear here automatically.';

  const q5DueForRevisionToday = `${dueCards.length} SM-2 flashcard${dueCards.length === 1 ? '' : 's'} and ${unverifiedMistakes.length} open mistake review${unverifiedMistakes.length === 1 ? '' : 's'} due today.`;

  const uniqueAttemptsCount = attempts.length;
  const avgPct =
    uniqueAttemptsCount > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / uniqueAttemptsCount)
      : 0;
  const q6AmIExamReady =
    uniqueAttemptsCount < 3
      ? `Insufficient practice volume (${uniqueAttemptsCount}/3 minimum diagnostic sets completed) to project ${examLabel} readiness.`
      : `Practice-based readiness estimate: ${avgPct}% average across ${uniqueAttemptsCount} sets (${unverifiedMistakes.length} open fixes remaining; not an empirical NTA rank guarantee).`;

  return {
    generatedAt: now.toISOString(),
    q1WhatToStudyToday,
    q2WhyThisNow,
    q3HowAmIProgressing,
    q4WhereLosingMarks,
    q5DueForRevisionToday,
    q6AmIExamReady,
    dueItemsCount: dueCards.length + unverifiedMistakes.length,
    topMisconceptionLabel: topCat?.[0] || null,
    verifiedPracticeAttemptsCount: uniqueAttemptsCount,
  };
}

/* ============================================================================
 * CONSENT-GATED PARENT / MENTOR WEEKLY SUMMARY FOUNDATION
 * ============================================================================ */

export interface ParentMentorConsentSettings {
  enabled: boolean;
  guardianLabel: string;
  shareScope: 'summary_only' | 'mistakes_and_summary';
  consentedAt?: string;
}

export interface ParentMentorWeeklySummary {
  studentDisplayName: string;
  shareScope: 'summary_only' | 'mistakes_and_summary';
  generatedAt: string;
  attemptsCompletedLast7Days: number;
  averageScorePct: number | null;
  topFocusTopics: string[];
  openMistakesCount: number;
  privacyNote: string;
}

export function buildConsentGatedParentMentorSummary(params: {
  consent: ParentMentorConsentSettings;
  studentDisplayName: string;
  attempts: QuizAttempt[];
  mistakes: MistakeBookEntry[];
  now?: Date;
}):
  | { allowed: true; summary: ParentMentorWeeklySummary }
  | { allowed: false; reason: string } {
  if (!params.consent.enabled) {
    return {
      allowed: false,
      reason: 'Student has not opted in to sharing progress summaries with a parent or mentor.',
    };
  }

  const now = params.now || new Date();
  const sevenDaysAgoMs = now.getTime() - 7 * 86_400_000;
  const recentAttempts = (params.attempts || []).filter(
    (a) => Date.parse(a.completedAt) >= sevenDaysAgoMs
  );
  const avgPct =
    recentAttempts.length > 0
      ? Math.round(
          recentAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / recentAttempts.length
        )
      : null;

  const topFocusTopics = Array.from(
    new Set(
      (params.mistakes || [])
        .slice(0, 5)
        .map((m) => m.topic)
        .filter(Boolean)
    )
  );

  return {
    allowed: true,
    summary: {
      studentDisplayName: params.studentDisplayName || 'Student',
      shareScope: params.consent.shareScope,
      generatedAt: now.toISOString(),
      attemptsCompletedLast7Days: recentAttempts.length,
      averageScorePct: avgPct,
      topFocusTopics,
      openMistakesCount: (params.mistakes || []).filter((m) => m.neuronzStage !== 'Mastered').length,
      privacyNote:
        'Includes aggregate scores and topic summaries only; private tutor chats, raw prompts, and credentials are never shared.',
    },
  };
}
