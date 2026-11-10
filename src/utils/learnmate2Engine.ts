/**
 * LearnMate 2.0 Pure Domain Logic & Deterministic Utilities Engine
 * Covers:
 * 1. Strict Source-Control Mode ("Material Only" vs "Extended Knowledge") verification
 * 2. SM-2 Spaced Repetition scheduling for Flashcards
 * 3. JEE-Style Mock Exam Simulator scoring (with optional negative marking & question palette stats)
 * 4. Deterministic Study Utilities (Scientific Calculator, Unit Converter, Statistics Calculator)
 * 5. Teach-It-Back concept coverage evaluator
 * 6. Instrumental Lo-Fi Focus Radio prompt sanitizer & vocal guard
 */

import type { StudyPage, FlashcardItem, QuizQuestion } from '../types/study';

/* ============================================================================
 * 1. STRICT SOURCE-CONTROL MODE ("material_only" | "extended_knowledge")
 * ============================================================================ */

export type SourceControlMode = 'material_only' | 'extended_knowledge';

export interface StrictSourceCheckResult {
  coveredInMaterial: boolean;
  matchedPages: Array<{
    pageNumber: number;
    section: string;
    quote: string;
    matchScore: number;
  }>;
  enforcedAnswer: string;
}

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'does', 'is', 'are', 'was', 'were', 'the', 'and', 'for', 'with', 'from',
  'that', 'this', 'explain', 'define', 'tell', 'about', 'can', 'you', 'your',
  'between', 'difference', 'formula', 'mean', 'meaning', 'notes', 'material',
  'page', 'give', 'more', 'another', 'extra', 'step', 'simple', 'simply',
  'example', 'examples', 'according', 'uploaded', 'document', 'chapter',
]);

export function findSupportingMaterialPages(
  question: string,
  pages: StudyPage[]
): Array<{ pageNumber: number; section: string; quote: string; matchScore: number }> {
  if (!pages || pages.length === 0 || !question.trim()) return [];

  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  if (tokens.length === 0) return [];

  const results: Array<{
    pageNumber: number;
    section: string;
    quote: string;
    matchScore: number;
  }> = [];

  for (const page of pages) {
    const combined = `${page.title} ${page.content}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (combined.includes(tok)) {
        score += 1;
      }
    }
    if (score > 0) {
      const lines = page.content
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 20);
      const bestLine =
        lines.find((line) => tokens.some((tok) => line.toLowerCase().includes(tok))) ||
        lines[0] ||
        page.content.slice(0, 160);

      results.push({
        pageNumber: page.pageNumber,
        section: page.title || `Page ${page.pageNumber}`,
        quote: bestLine.slice(0, 180),
        matchScore: score,
      });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Enforces strict source-control mode rules:
 * - In 'material_only' mode: if the question is not supported by the uploaded pages,
 *   returns a strict statement that the topic is not covered in the uploaded material
 *   without silently supplementing general knowledge.
 */
export function enforceSourceControlPolicy(params: {
  mode: SourceControlMode;
  question?: string;
  pages?: StudyPage[];
  validPageNumbers?: Set<number>;
  rawAnswer?: string;
  foundInMaterial?: boolean;
  citations?: Array<{ pageNumber: number; section: string; quote: string }>;
}): {
  answer: string;
  foundInMaterial: boolean;
  sourceType: 'material' | 'general' | 'both';
  citations: Array<{ pageNumber: number; section: string; quote: string }>;
} {
  const {
    mode,
    question = '',
    pages = [],
    validPageNumbers,
    rawAnswer = '',
    foundInMaterial,
    citations = [],
  } = params;
  const validPageSet = validPageNumbers ?? new Set(pages.map((p) => p.pageNumber));
  const verifiedCitations = citations.filter((c) => validPageSet.has(c.pageNumber));
  const localMatches = pages.length > 0 && question ? findSupportingMaterialPages(question, pages) : [];

  const hasValidSupport =
    (foundInMaterial !== false && verifiedCitations.length > 0) || localMatches.length > 0;

  const finalCitations =
    verifiedCitations.length > 0
      ? verifiedCitations
      : localMatches.slice(0, 2).map((m) => ({
          pageNumber: m.pageNumber,
          section: m.section,
          quote: m.quote,
        }));

  if (mode === 'material_only') {
    if (!hasValidSupport) {
      return {
        answer:
          'This topic is not covered in your selected study material. Switch to **Extended Knowledge** mode above if you would like a general-knowledge explanation or external web grounding.',
        foundInMaterial: false,
        sourceType: 'material',
        citations: [],
      };
    }

    // Strip any accidental "General knowledge expansion" section if in strict material_only mode
    const cleanedAnswer = rawAnswer
      .split(/\*\*General knowledge/i)[0]
      .trim();

    const fallbackMaterialText = localMatches
      .slice(0, 2)
      .map((m) => `**Page ${m.pageNumber} (${m.section}):** ${m.quote}`)
      .join('\n\n');

    return {
      answer: cleanedAnswer || `**From your material:**\n\n${fallbackMaterialText}`,
      foundInMaterial: true,
      sourceType: 'material',
      citations: finalCitations,
    };
  }

  // Extended Knowledge mode
  if (!hasValidSupport) {
    const prefix = rawAnswer.toLowerCase().includes('not covered in your material')
      ? ''
      : '**Note:** This topic is not covered directly in your uploaded material. Below is an Extended Knowledge explanation:\n\n';
    return {
      answer: `${prefix}${rawAnswer}`.trim(),
      foundInMaterial: false,
      sourceType: 'general',
      citations: [],
    };
  }

  return {
    answer: rawAnswer,
    foundInMaterial: true,
    sourceType: rawAnswer.toLowerCase().includes('general knowledge') ? 'both' : 'material',
    citations: finalCitations,
  };
}

/* ============================================================================
 * 2. SPACED REPETITION (SM-2 ALGORITHM FOR FLASHCARDS)
 * ============================================================================ */

export interface SpacedRepetitionMetadata {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: string;
  lastReviewedAt: string;
}

/**
 * Updates flashcard scheduling using an evidence-based SM-2 spaced repetition algorithm.
 * quality:
 *  - 'know_it' -> quality 4 (confident recall)
 *  - 'review_again' -> quality 1 (needs immediate re-review)
 */
export function computeNextSpacedRepetitionSchedule(
  current: Partial<SpacedRepetitionMetadata> | undefined,
  rating: 'know_it' | 'review_again',
  nowMs: number = Date.now()
): SpacedRepetitionMetadata {
  const prevReps = current?.repetitions ?? 0;
  const prevInterval = current?.intervalDays ?? 0;
  const prevEase = current?.easeFactor ?? 2.5;

  if (rating === 'review_again') {
    const nextEase = Math.max(1.3, Number((prevEase - 0.2).toFixed(2)));
    // Due again in 10 minutes (0 days interval) for active study session
    const nextDue = new Date(nowMs + 10 * 60 * 1000).toISOString();
    return {
      repetitions: 0,
      intervalDays: 0,
      easeFactor: nextEase,
      nextReviewAt: nextDue,
      lastReviewedAt: new Date(nowMs).toISOString(),
    };
  }

  // rating === 'know_it'
  const repetitions = prevReps + 1;
  let intervalDays = 1;
  if (repetitions === 1) {
    intervalDays = 1;
  } else if (repetitions === 2) {
    intervalDays = 3;
  } else {
    intervalDays = Math.max(1, Math.round(prevInterval * prevEase));
  }

  const nextEase = Math.min(3.0, Math.max(1.3, Number((prevEase + 0.1).toFixed(2))));
  const nextDue = new Date(nowMs + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    repetitions,
    intervalDays,
    easeFactor: nextEase,
    nextReviewAt: nextDue,
    lastReviewedAt: new Date(nowMs).toISOString(),
  };
}

export function isFlashcardDueForReview(
  card: FlashcardItem & { sr?: SpacedRepetitionMetadata },
  nowMs: number = Date.now()
): boolean {
  if (card.status === 'unreviewed' || card.status === 'review_again') return true;
  if (!card.sr?.nextReviewAt) return true;
  return new Date(card.sr.nextReviewAt).getTime() <= nowMs;
}

export function computeNextSpacedRepetitionState(
  card: Partial<FlashcardItem & SpacedRepetitionMetadata> | undefined,
  rating: 'unreviewed' | 'know_it' | 'review_again',
  nowMs: number = Date.now()
): SpacedRepetitionMetadata {
  const effectiveRating = rating === 'know_it' ? 'know_it' : 'review_again';
  return computeNextSpacedRepetitionSchedule(
    {
      repetitions: card?.repetitions ?? card?.repetitionCount ?? 0,
      intervalDays: card?.intervalDays ?? 0,
      easeFactor: card?.easeFactor ?? 2.5,
      nextReviewAt: card?.nextReviewAt ?? card?.nextReviewDate,
      lastReviewedAt: card?.lastReviewedAt,
    },
    effectiveRating,
    nowMs
  );
}

/* ============================================================================
 * 3. JEE-STYLE EXAM SIMULATOR SCORING & PALETTE ENGINE
 * ============================================================================ */

export type ExamQuestionPaletteState =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_and_marked';

export interface ExamScoringConfig {
  marksPerCorrect: number; // e.g., +4 for JEE Main style or +1 for standard
  negativeMarksPerWrong: number; // e.g., 1 (deducts 1 mark) or 0 (no negative marking)
}

export interface ExamQuestionResult {
  questionId: string;
  topic: string;
  sourcePage: number;
  selectedIndex: number; // -1 if unattempted
  correctIndex: number;
  status: 'correct' | 'incorrect' | 'unattempted';
  marksAwarded: number;
  markedForReview: boolean;
}

export interface ExamSimulationSummary {
  totalQuestions: number;
  attemptedCount: number;
  unattemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  positiveMarks: number;
  negativeMarksDeducted: number;
  netScore: number;
  maxPossibleScore: number;
  accuracyPct: number;
  percentageScore: number;
  weakTopics: string[];
  strongTopics: string[];
  questionResults: ExamQuestionResult[];
}

export function gradeExamSimulation(params: {
  questions: QuizQuestion[];
  selectedIndices: Record<string, number>;
  markedForReviewIds?: string[];
  config?: ExamScoringConfig;
}): ExamSimulationSummary {
  const {
    questions,
    selectedIndices,
    markedForReviewIds = [],
    config = { marksPerCorrect: 4, negativeMarksPerWrong: 1 },
  } = params;

  const markedSet = new Set(markedForReviewIds);
  const questionResults: ExamQuestionResult[] = [];
  const topicPerf = new Map<string, { correct: number; total: number }>();

  let attemptedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let positiveMarks = 0;
  let negativeMarksDeducted = 0;

  for (const q of questions) {
    const sel = selectedIndices[q.id];
    const isAttempted = typeof sel === 'number' && sel >= 0 && sel <= 3;
    let status: ExamQuestionResult['status'] = 'unattempted';
    let marksAwarded = 0;

    if (isAttempted) {
      attemptedCount += 1;
      if (sel === q.correctIndex) {
        status = 'correct';
        correctCount += 1;
        marksAwarded = config.marksPerCorrect;
        positiveMarks += config.marksPerCorrect;
      } else {
        status = 'incorrect';
        incorrectCount += 1;
        marksAwarded = -Math.abs(config.negativeMarksPerWrong);
        negativeMarksDeducted += Math.abs(config.negativeMarksPerWrong);
      }
    }

    const stat = topicPerf.get(q.topic) || { correct: 0, total: 0 };
    stat.total += 1;
    if (status === 'correct') stat.correct += 1;
    topicPerf.set(q.topic, stat);

    questionResults.push({
      questionId: q.id,
      topic: q.topic,
      sourcePage: q.sourcePage,
      selectedIndex: isAttempted ? sel : -1,
      correctIndex: q.correctIndex,
      status,
      marksAwarded,
      markedForReview: markedSet.has(q.id),
    });
  }

  const totalQuestions = questions.length;
  const unattemptedCount = totalQuestions - attemptedCount;
  const maxPossibleScore = totalQuestions * config.marksPerCorrect;
  const netScore = positiveMarks - negativeMarksDeducted;
  const accuracyPct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const percentageScore =
    maxPossibleScore > 0 ? Math.max(0, Math.round((netScore / maxPossibleScore) * 100)) : 0;

  const weakTopics: string[] = [];
  const strongTopics: string[] = [];
  for (const [topic, stat] of topicPerf.entries()) {
    if (stat.correct < stat.total) {
      weakTopics.push(topic);
    } else {
      strongTopics.push(topic);
    }
  }

  return {
    totalQuestions,
    attemptedCount,
    unattemptedCount,
    correctCount,
    incorrectCount,
    positiveMarks,
    negativeMarksDeducted,
    netScore,
    maxPossibleScore,
    accuracyPct,
    percentageScore,
    weakTopics,
    strongTopics,
    questionResults,
  };
}

export function getQuestionPaletteState(params: {
  questionId: string;
  visitedIds: Set<string>;
  selectedIndices: Record<string, number>;
  markedIds: Set<string>;
}): ExamQuestionPaletteState {
  const { questionId, visitedIds, selectedIndices, markedIds } = params;
  const hasAnswer = typeof selectedIndices[questionId] === 'number' && selectedIndices[questionId] >= 0;
  const isMarked = markedIds.has(questionId);

  if (hasAnswer && isMarked) return 'answered_and_marked';
  if (hasAnswer) return 'answered';
  if (isMarked) return 'marked_for_review';
  if (visitedIds.has(questionId)) return 'not_answered';
  return 'not_visited';
}

export interface JeeQuestionState {
  questionId: string;
  visited: boolean;
  selectedIndex: number | null;
  markedForReview: boolean;
}

export interface JeeExamGradingSummary extends ExamSimulationSummary {
  totalMarks: number;
  maxMarks: number;
  wrongCount: number;
  negativeMarksLost: number;
  unansweredCount: number;
}

export function deriveJeePaletteStatus(state: JeeQuestionState): ExamQuestionPaletteState {
  const hasAnswer = typeof state.selectedIndex === 'number' && state.selectedIndex >= 0;
  if (hasAnswer && state.markedForReview) return 'answered_and_marked';
  if (hasAnswer) return 'answered';
  if (state.markedForReview) return 'marked_for_review';
  if (state.visited) return 'not_answered';
  return 'not_visited';
}

export function gradeJeeExamAttempt(params: {
  questions: QuizQuestion[];
  statesByQuestionId: Record<string, JeeQuestionState>;
  negativeMarking?: boolean;
  marksPerCorrect?: number;
  negativeMarksPerWrong?: number;
}): JeeExamGradingSummary {
  const {
    questions,
    statesByQuestionId,
    negativeMarking = true,
    marksPerCorrect = 4,
    negativeMarksPerWrong = -1,
  } = params;

  const selectedIndices: Record<string, number> = {};
  const markedForReviewIds: string[] = [];

  for (const [qId, st] of Object.entries(statesByQuestionId)) {
    if (typeof st.selectedIndex === 'number' && st.selectedIndex >= 0) {
      selectedIndices[qId] = st.selectedIndex;
    }
    if (st.markedForReview) {
      markedForReviewIds.push(qId);
    }
  }

  const base = gradeExamSimulation({
    questions,
    selectedIndices,
    markedForReviewIds,
    config: {
      marksPerCorrect,
      negativeMarksPerWrong: negativeMarking ? Math.abs(negativeMarksPerWrong) : 0,
    },
  });

  return {
    ...base,
    totalMarks: base.netScore,
    maxMarks: base.maxPossibleScore,
    wrongCount: base.incorrectCount,
    negativeMarksLost: -base.negativeMarksDeducted,
    unansweredCount: base.unattemptedCount,
  };
}

/* ============================================================================
 * 4. DETERMINISTIC STUDY UTILITIES (NO GEMINI FOR ARITHMETIC)
 * ============================================================================ */

/**
 * Safely evaluates a mathematical/scientific expression deterministically
 * without using eval() on arbitrary JS code.
 * Supports: +, -, *, /, ^, (), sin, cos, tan, asin, acos, atan, sqrt, log, ln, abs, exp, pi, e
 */
function replaceUnaryMinusBeforeExponent(expr: string): string {
  // In JS, `-2**2` or `-x**2` is a SyntaxError; rewrite unary `-base^exp` at start or after `(`, `+`, `-`, `*`, `/`, `,` as `-(base**exp)` while preserving mathematical precedence `-x^2 = -(x^2)`.
  return expr.replace(
    /(^|[([+\-*/,]\s*)-\s*([a-zA-Z0-9_.]+|\([^()]+\))\s*\*\*\s*([a-zA-Z0-9_.]+|\([^()]+\))/g,
    '$1-(($2)**($3))'
  );
}

export function evaluateScientificExpression(
  rawExpr: string,
  angleMode: 'RAD' | 'DEG' = 'RAD'
): {
  valid: boolean;
  ok: boolean;
  result?: number;
  value: number | null;
  formatted?: string;
  error?: string;
} {
  const expr = (rawExpr || '').trim();
  if (!expr) {
    return { valid: false, ok: false, value: null, error: 'Enter an expression' };
  }

  // Reject any characters outside safe math tokens
  const sanitizedCheck = expr
    .replace(
      /\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|log|ln|abs|exp|floor|ceil|round|pi|PI|e|E)\b/g,
      ''
    )
    .replace(/[0-9+\-*/^().%\s,]/g, '');

  if (sanitizedCheck.length > 0) {
    return { valid: false, ok: false, value: null, error: 'Unsupported characters in expression' };
  }

  try {
    const jsMathExpr = replaceUnaryMinusBeforeExponent(
      expr
        .replace(/\bpi\b/gi, '(Math.PI)')
        .replace(/\be\b/g, '(Math.E)')
        .replace(/\basin\s*\(/gi, '__asin(')
        .replace(/\bacos\s*\(/gi, '__acos(')
        .replace(/\batan\s*\(/gi, '__atan(')
        .replace(/\bsinh\s*\(/gi, 'Math.sinh(')
        .replace(/\bcosh\s*\(/gi, 'Math.cosh(')
        .replace(/\btanh\s*\(/gi, 'Math.tanh(')
        .replace(/\bsin\s*\(/gi, '__sin(')
        .replace(/\bcos\s*\(/gi, '__cos(')
        .replace(/\btan\s*\(/gi, '__tan(')
        .replace(/\bsec\s*\(/gi, '__sec(')
        .replace(/\bcsc\s*\(/gi, '__csc(')
        .replace(/\bcot\s*\(/gi, '__cot(')
        .replace(/\bsqrt\s*\(/gi, 'Math.sqrt(')
        .replace(/\bcbrt\s*\(/gi, 'Math.cbrt(')
        .replace(/\blog\s*\(/gi, 'Math.log10(')
        .replace(/\bln\s*\(/gi, 'Math.log(')
        .replace(/\babs\s*\(/gi, 'Math.abs(')
        .replace(/\bexp\s*\(/gi, 'Math.exp(')
        .replace(/\bfloor\s*\(/gi, 'Math.floor(')
        .replace(/\bceil\s*\(/gi, 'Math.ceil(')
        .replace(/\bround\s*\(/gi, 'Math.round(')
        .replace(/\^/g, '**')
    );

    const toRad = (v: number) => (angleMode === 'DEG' ? (v * Math.PI) / 180 : v);
    const fromRad = (v: number) => (angleMode === 'DEG' ? (v * 180) / Math.PI : v);
    const __sin = (v: number) => Math.sin(toRad(v));
    const __cos = (v: number) => Math.cos(toRad(v));
    const __tan = (v: number) => {
      const c = Math.cos(toRad(v));
      return Math.abs(c) < 1e-12 ? NaN : Math.sin(toRad(v)) / c;
    };
    const __sec = (v: number) => {
      const c = Math.cos(toRad(v));
      return Math.abs(c) < 1e-12 ? NaN : 1 / c;
    };
    const __csc = (v: number) => {
      const s = Math.sin(toRad(v));
      return Math.abs(s) < 1e-12 ? NaN : 1 / s;
    };
    const __cot = (v: number) => {
      const s = Math.sin(toRad(v));
      return Math.abs(s) < 1e-12 ? NaN : Math.cos(toRad(v)) / s;
    };
    const __asin = (v: number) => fromRad(Math.asin(v));
    const __acos = (v: number) => fromRad(Math.acos(v));
    const __atan = (v: number) => fromRad(Math.atan(v));

    const fn = new Function(
      '__sin',
      '__cos',
      '__tan',
      '__sec',
      '__csc',
      '__cot',
      '__asin',
      '__acos',
      '__atan',
      `"use strict"; return (${jsMathExpr});`
    );
    const val = Number(fn(__sin, __cos, __tan, __sec, __csc, __cot, __asin, __acos, __atan));
    if (!Number.isFinite(val)) {
      return { valid: false, ok: false, value: null, error: 'Result is undefined or infinite' };
    }
    const rounded = Math.abs(val) < 1e-12 ? 0 : Number(val.toPrecision(12));
    return {
      valid: true,
      ok: true,
      result: rounded,
      value: rounded,
      formatted: String(rounded),
    };
  } catch {
    return { valid: false, ok: false, value: null, error: 'Invalid mathematical syntax' };
  }
}

export type UnitCategory = 'length' | 'mass' | 'temperature' | 'time' | 'energy';

const UNIT_TO_BASE: Record<UnitCategory, Record<string, number>> = {
  length: {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    mi: 1609.344,
    ft: 0.3048,
    in: 0.0254,
  },
  mass: {
    kg: 1,
    g: 0.001,
    mg: 1e-6,
    lb: 0.45359237,
    oz: 0.0283495231,
  },
  time: {
    s: 1,
    min: 60,
    hr: 3600,
    day: 86400,
    ms: 0.001,
  },
  energy: {
    J: 1,
    kJ: 1000,
    cal: 4.184,
    kcal: 4184,
    Wh: 3600,
    eV: 1.602176634e-19,
  },
  temperature: {
    C: 1,
    F: 1,
    K: 1,
  },
};

export function convertUnits(params: {
  category: UnitCategory;
  value: number;
  fromUnit: string;
  toUnit: string;
}): number | null {
  const { category, value, fromUnit, toUnit } = params;
  if (!Number.isFinite(value)) return null;

  if (category === 'temperature') {
    let celsius = value;
    if (fromUnit === 'F') celsius = ((value - 32) * 5) / 9;
    else if (fromUnit === 'K') celsius = value - 273.15;
    else if (fromUnit !== 'C') return null;

    if (toUnit === 'C') return Number(celsius.toFixed(4));
    if (toUnit === 'F') return Number(((celsius * 9) / 5 + 32).toFixed(4));
    if (toUnit === 'K') return Number((celsius + 273.15).toFixed(4));
    return null;
  }

  const table = UNIT_TO_BASE[category];
  if (!table || !(fromUnit in table) || !(toUnit in table)) return null;
  const baseValue = value * table[fromUnit];
  const converted = baseValue / table[toUnit];
  return Number(converted.toPrecision(8));
}

export interface StatisticsSummary {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  populationVariance: number;
  sampleVariance: number;
  populationStdDev: number;
  sampleStdDev: number;
}

export function computeStatisticsSummary(values: number[]): StatisticsSummary | null {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;

  const count = valid.length;
  const sum = valid.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const median =
    count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const sqDiffSum = valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
  const populationVariance = sqDiffSum / count;
  const sampleVariance = count > 1 ? sqDiffSum / (count - 1) : 0;

  return {
    count,
    sum: Number(sum.toFixed(6)),
    mean: Number(mean.toFixed(6)),
    median: Number(median.toFixed(6)),
    min: sorted[0],
    max: sorted[count - 1],
    populationVariance: Number(populationVariance.toFixed(6)),
    sampleVariance: Number(sampleVariance.toFixed(6)),
    populationStdDev: Number(Math.sqrt(populationVariance).toFixed(6)),
    sampleStdDev: Number(Math.sqrt(sampleVariance).toFixed(6)),
  };
}

export const calculateDatasetStatistics = computeStatisticsSummary;

export function convertStudyUnit(
  value: number,
  fromUnitRaw: string,
  toUnitRaw: string
): { ok: boolean; value: number | null; error?: string } {
  if (!Number.isFinite(value)) {
    return { ok: false, value: null, error: 'Invalid number' };
  }
  const fromLower = fromUnitRaw.toLowerCase();
  const toLower = toUnitRaw.toLowerCase();

  // Temperature
  if (['c', 'f', 'k'].includes(fromLower) && ['c', 'f', 'k'].includes(toLower)) {
    const res = convertUnits({
      category: 'temperature',
      value,
      fromUnit: fromLower.toUpperCase(),
      toUnit: toLower.toUpperCase(),
    });
    return res !== null ? { ok: true, value: res } : { ok: false, value: null, error: 'Unsupported conversion' };
  }

  // Speed
  const speedTable: Record<string, number> = {
    'm/s': 1,
    'km/h': 1 / 3.6,
    mph: 0.44704,
  };
  if (fromLower in speedTable && toLower in speedTable) {
    const mps = value * speedTable[fromLower];
    return { ok: true, value: Number((mps / speedTable[toLower]).toPrecision(7)) };
  }

  // Energy case-insensitive mapping
  const energyMap: Record<string, string> = {
    j: 'J',
    kj: 'kJ',
    cal: 'cal',
    kcal: 'kcal',
    wh: 'Wh',
    ev: 'eV',
  };
  if (fromLower in energyMap && toLower in energyMap) {
    const res = convertUnits({
      category: 'energy',
      value,
      fromUnit: energyMap[fromLower],
      toUnit: energyMap[toLower],
    });
    return res !== null ? { ok: true, value: res } : { ok: false, value: null, error: 'Unsupported conversion' };
  }

  for (const cat of ['length', 'mass', 'time'] as UnitCategory[]) {
    if (fromLower in UNIT_TO_BASE[cat] && toLower in UNIT_TO_BASE[cat]) {
      const res = convertUnits({
        category: cat,
        value,
        fromUnit: fromLower,
        toUnit: toLower,
      });
      return res !== null ? { ok: true, value: res } : { ok: false, value: null, error: 'Unsupported conversion' };
    }
  }

  return { ok: false, value: null, error: 'Incompatible units' };
}

/* ============================================================================
 * 5. TEACH-IT-BACK COVERAGE EVALUATOR
 * ============================================================================ */

export interface TeachItBackCoverageResult {
  coverageScorePct: number;
  scorePct: number;
  verdict: 'mastered' | 'good_understanding' | 'partial_gaps' | 'needs_review';
  coveredConcepts: string[];
  missingConcepts: string[];
  feedbackSummary: string;
}

export function evaluateTeachItBackCoverage(params: {
  topicName?: string;
  keyConcepts: string[];
  sourceSummary: string;
  studentExplanation: string;
}): TeachItBackCoverageResult {
  const { topicName = 'this topic', keyConcepts, sourceSummary, studentExplanation } = params;
  const studentLower = (studentExplanation || '').toLowerCase();

  const targetConcepts =
    keyConcepts && keyConcepts.length > 0
      ? keyConcepts
      : sourceSummary
          .split(/[.,;:]/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 5)
          .slice(0, 4);

  const coveredConcepts: string[] = [];
  const missingConcepts: string[] = [];

  for (const concept of targetConcepts) {
    const significantWords = concept
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

    const isCovered =
      significantWords.length === 0
        ? studentLower.includes(concept.toLowerCase())
        : significantWords.some((w) => studentLower.includes(w));

    if (isCovered) {
      coveredConcepts.push(concept);
    } else {
      missingConcepts.push(concept);
    }
  }

  const total = Math.max(1, targetConcepts.length);
  const coverageScorePct = Math.round((coveredConcepts.length / total) * 100);

  let verdict: TeachItBackCoverageResult['verdict'] = 'needs_review';
  if (coverageScorePct >= 85) verdict = 'mastered';
  else if (coverageScorePct >= 65) verdict = 'good_understanding';
  else if (coverageScorePct >= 40) verdict = 'partial_gaps';

  let feedbackSummary = '';
  if (coverageScorePct >= 80) {
    feedbackSummary = `Strong explanation of ${topicName}! You covered ${coveredConcepts.length} of ${total} core source concepts clearly.`;
  } else if (coverageScorePct >= 40) {
    feedbackSummary = `Good start on ${topicName}. Try expanding your explanation to include: ${missingConcepts.join(', ')}.`;
  } else {
    feedbackSummary = `Your explanation of ${topicName} is missing key concepts from the material (${missingConcepts.join(', ')}). Review the source section and try teaching it back again.`;
  }

  return {
    coverageScorePct,
    scorePct: coverageScorePct,
    verdict,
    coveredConcepts,
    missingConcepts,
    feedbackSummary,
  };
}

/* ============================================================================
 * 6. INSTRUMENTAL LO-FI FOCUS RADIO PROMPT SANITIZER
 * ============================================================================ */

export interface LofiPreset {
  id: string;
  name: string;
  description: string;
  bpm: number;
  baseFreq: number;
  chordProgression: number[][];
  prompt: string;
}

export const LOFI_INSTRUMENTAL_PRESETS: LofiPreset[] = [
  {
    id: 'rainy-night-study',
    name: 'Rainy Night Study',
    description: 'Warm Rhodes electric piano chords over soft rain and mellow boom-bap percussion.',
    bpm: 72,
    baseFreq: 220,
    chordProgression: [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 349.23], // Fmaj7
      [196.0, 246.94, 293.66, 349.23], // G7
      [164.81, 196.0, 246.94, 329.63], // Em7
    ],
    prompt:
      'Generate a strictly instrumental lo-fi hip-hop study beat at 72 BPM with warm Rhodes electric piano chords, subtle vinyl rain texture, and soft muted boom-bap drums. Strictly instrumental only. No vocals, no singing, no spoken words, no lyrics.',
  },
  {
    id: 'warm-vinyl-beats',
    name: 'Warm Vinyl Beats',
    description: 'Dusty jazz guitar voicings, gentle vinyl crackle, and relaxed head-nodding groove.',
    bpm: 76,
    baseFreq: 196,
    chordProgression: [
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [146.83, 185.0, 220.0, 261.63], // D7
    ],
    prompt:
      'Generate a strictly instrumental warm vinyl lo-fi beat at 76 BPM featuring mellow jazz guitar chords, subtle analog tape warmth, and soft snare brushes. Strictly instrumental only. No vocals, no singing, no spoken words.',
  },
  {
    id: 'soft-piano-lofi',
    name: 'Soft Piano Lo-fi',
    description: 'Delicate felt acoustic piano melodies with deep sub-bass and calm atmospheric pads.',
    bpm: 68,
    baseFreq: 261.63,
    chordProgression: [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 349.23], // G7
    ],
    prompt:
      'Generate a strictly instrumental soft felt piano lo-fi study track at 68 BPM with peaceful chord progressions and gentle ambient pad accompaniment. Strictly instrumental only. No vocals, no singing, no lyrics.',
  },
  {
    id: 'cozy-library',
    name: 'Cozy Library',
    description: 'Minimalist ambient acoustic plucks and warm harmonic drones for deep reading.',
    bpm: 64,
    baseFreq: 174.61,
    chordProgression: [
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 392.0],
      [220.0, 261.63, 329.63, 440.0],
      [164.81, 196.0, 246.94, 329.63],
    ],
    prompt:
      'Generate a strictly instrumental cozy library study ambient lo-fi track at 64 BPM with soft acoustic harp/guitar plucks and warm analog synthesizer pads. Strictly instrumental only. No vocals, no singing, no spoken words.',
  },
  {
    id: 'ambient-jazz-hop',
    name: 'Ambient Jazz-Hop',
    description: 'Smooth upright basslines and lush neo-soul Rhodes seventh chords.',
    bpm: 78,
    baseFreq: 233.08,
    chordProgression: [
      [233.08, 293.66, 349.23, 440.0], // Bbmaj7
      [196.0, 233.08, 293.66, 349.23], // Gm7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [164.81, 196.0, 233.08, 293.66], // Edim/C7
    ],
    prompt:
      'Generate a strictly instrumental ambient jazz-hop study beat at 78 BPM with upright bass and lush Rhodes seventh chords. Strictly instrumental only. No vocals, no singing, no spoken words.',
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Steady binaural-inspired harmonic synth pulses and distraction-free lo-fi rhythm.',
    bpm: 70,
    baseFreq: 207.65,
    chordProgression: [
      [207.65, 261.63, 311.13, 392.0], // Abmaj7
      [174.61, 207.65, 261.63, 311.13], // Fm7
      [155.56, 196.0, 233.08, 293.66], // Ebmaj7
      [196.0, 246.94, 293.66, 349.23], // G7
    ],
    prompt:
      'Generate a strictly instrumental deep focus lo-fi study track at 70 BPM with warm analog synth chords and steady minimal percussion. Strictly instrumental only. No vocals, no singing, no spoken words.',
  },
];

export function buildInstrumentalLofiPrompt(presetIdOrName: string): string {
  const preset =
    LOFI_INSTRUMENTAL_PRESETS.find(
      (p) => p.id === presetIdOrName || p.name.toLowerCase() === presetIdOrName.toLowerCase()
    ) || LOFI_INSTRUMENTAL_PRESETS[0];

  // Strip any accidental vocal words and append strict instrumental enforcement
  const cleaned = preset.prompt
    .replace(/\b(singing|lyrics|vocalist|rap|choir|spoken\s+word)\b/gi, 'instrumental')
    .trim();

  if (!cleaned.toLowerCase().includes('strictly instrumental only')) {
    return `${cleaned} Strictly instrumental only. No vocals, no singing, no spoken words.`;
  }
  return cleaned;
}

export const sanitizeInstrumentalLofiPrompt = buildInstrumentalLofiPrompt;

/* ============================================================================
 * 7. NUMERICAL & SYMBOLIC EQUATION GRAPHING ENGINE (SECTION 15)
 * ============================================================================ */

export interface GraphPoint2D {
  x: number;
  y: number;
}

export interface PlottedEquationResult {
  expression: string;
  normalizedRhs: string;
  valid: boolean;
  error?: string;
  /** Discontinuous branches are split into separate continuous polyline segments */
  segments: GraphPoint2D[][];
  discontinuityCount: number;
  samplePointsCount: number;
}

/**
 * Normalizes a user-typed equation such as:
 * - "y = x^2 - 4"
 * - "f(x) = sin(x) / x"
 * - "2x^2 - 3x + 1" (implicit multiplication 2x -> 2*x)
 * - "tan(x)" or "1 / (x - 2)"
 * Returns a safe executable evaluator or a clear unsupported-expression error.
 */
export function compileCartesianEquation(rawInput: string): {
  valid: boolean;
  normalizedRhs: string;
  error?: string;
  evaluateAt?: (x: number, parameterA?: number) => number;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { valid: false, normalizedRhs: '', error: 'Enter an equation in x (e.g., y = x^2 - 4)' };
  }

  // Strip optional leading "y =" or "f(x) ="
  let rhs = trimmed.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '').trim();

  // Check if user entered an unsupported implicit y^2 equation without solving for y
  if (/\by\b/i.test(rhs)) {
    return {
      valid: false,
      normalizedRhs: rhs,
      error: 'Enter an explicit function of x (e.g., y = sqrt(25 - x^2) or y = x^2 - 4)',
    };
  }

  if (!rhs) {
    return { valid: false, normalizedRhs: '', error: 'Equation right-hand side cannot be empty' };
  }

  // Insert implicit multiplication first: e.g. 2x -> 2*x, 3(x+1) -> 3*(x+1), (x+1)(x-1) -> (x+1)*(x-1), x sin(x) -> x*sin(x)
  const withImplicitMult = rhs
    .replace(
      /(\d|\bpi\b|\bx\b|\ba\b|\bk\b)\s*(?=(?:x|a|k|pi|sin|cos|tan|sec|csc|cot|asin|acos|atan|sqrt|cbrt|abs|log|ln|exp)\b)/gi,
      '$1*'
    )
    .replace(/(\d|\bpi\b|\bx\b|\ba\b|\bk\b|\))\s*(?=\()/gi, (m, g1) => {
      if (
        /\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|log|ln|exp|floor|ceil|round|sign)$/i.test(
          g1
        )
      ) {
        return m;
      }
      return `${g1}*`;
    })
    .replace(/\)\s*(?=[0-9xak])/gi, ')*');

  // Reject any unsafe tokens outside allowed math identifiers, x, parameter k/a, digits, and operators
  const tokenCheck = withImplicitMult
    .replace(
      /\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|sqrt|cbrt|abs|log|ln|exp|floor|ceil|round|sign|pi|PI|e|E|x|a|k)\b/g,
      ''
    )
    .replace(/[0-9+\-*/^().%\s,]/g, '');

  if (tokenCheck.length > 0) {
    return {
      valid: false,
      normalizedRhs: rhs,
      error: `Unsupported symbol "${tokenCheck.slice(0, 6)}" in equation`,
    };
  }

  const jsExpr = replaceUnaryMinusBeforeExponent(
    withImplicitMult
      .replace(/\bpi\b/gi, '(Math.PI)')
      .replace(/\be\b/g, '(Math.E)')
      .replace(/\basin\s*\(/gi, 'Math.asin(')
      .replace(/\bacos\s*\(/gi, 'Math.acos(')
      .replace(/\batan\s*\(/gi, 'Math.atan(')
      .replace(/\bsinh\s*\(/gi, 'Math.sinh(')
      .replace(/\bcosh\s*\(/gi, 'Math.cosh(')
      .replace(/\btanh\s*\(/gi, 'Math.tanh(')
      .replace(/\bsin\s*\(/gi, 'Math.sin(')
      .replace(/\bcos\s*\(/gi, 'Math.cos(')
      .replace(/\btan\s*\(/gi, 'Math.tan(')
      .replace(/\bsec\s*\(/gi, '__sec(')
      .replace(/\bcsc\s*\(/gi, '__csc(')
      .replace(/\bcot\s*\(/gi, '__cot(')
      .replace(/\bsqrt\s*\(/gi, 'Math.sqrt(')
      .replace(/\bcbrt\s*\(/gi, 'Math.cbrt(')
      .replace(/\babs\s*\(/gi, 'Math.abs(')
      .replace(/\blog\s*\(/gi, 'Math.log10(')
      .replace(/\bln\s*\(/gi, 'Math.log(')
      .replace(/\bexp\s*\(/gi, 'Math.exp(')
      .replace(/\bfloor\s*\(/gi, 'Math.floor(')
      .replace(/\bceil\s*\(/gi, 'Math.ceil(')
      .replace(/\bround\s*\(/gi, 'Math.round(')
      .replace(/\bsign\s*\(/gi, 'Math.sign(')
      .replace(/\^/g, '**')
  );

  const __sec = (v: number) => 1 / Math.cos(v);
  const __csc = (v: number) => 1 / Math.sin(v);
  const __cot = (v: number) => Math.cos(v) / Math.sin(v);

  try {
    const fn = new Function(
      'x',
      'a',
      'k',
      '__sec',
      '__csc',
      '__cot',
      `"use strict"; return Number(${jsExpr});`
    ) as (
      x: number,
      a: number,
      k: number,
      secFn: (v: number) => number,
      cscFn: (v: number) => number,
      cotFn: (v: number) => number
    ) => number;
    // Smoke-test compilation at x = 1.123
    fn(1.123, 1, 1, __sec, __csc, __cot);

    return {
      valid: true,
      normalizedRhs: rhs,
      evaluateAt: (x: number, paramA = 1) => {
        try {
          return fn(x, paramA, paramA, __sec, __csc, __cot);
        } catch {
          return NaN;
        }
      },
    };
  } catch {
    return {
      valid: false,
      normalizedRhs: rhs,
      error: 'Invalid mathematical syntax in equation',
    };
  }
}

/**
 * Samples y = f(x) over [xMin, xMax] and automatically detects undefined domains,
 * jump discontinuities, and vertical asymptotes (e.g. tan(x), 1/x, floor(x)),
 * splitting the curve into separate continuous segments so asymptotes are never bridged.
 */
export function sampleCartesianEquationSegments(params: {
  expression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  samples?: number;
  parameterA?: number;
}): PlottedEquationResult {
  const {
    expression,
    xMin,
    xMax,
    yMin,
    yMax,
    samples = 480,
    parameterA = 1,
  } = params;

  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) {
    return {
      expression,
      normalizedRhs: expression,
      valid: false,
      error: 'x min must be strictly less than x max',
      segments: [],
      discontinuityCount: 0,
      samplePointsCount: 0,
    };
  }

  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin >= yMax) {
    return {
      expression,
      normalizedRhs: expression,
      valid: false,
      error: 'y min must be strictly less than y max',
      segments: [],
      discontinuityCount: 0,
      samplePointsCount: 0,
    };
  }

  const compiled = compileCartesianEquation(expression);
  if (!compiled.valid || !compiled.evaluateAt) {
    return {
      expression,
      normalizedRhs: compiled.normalizedRhs,
      valid: false,
      error: compiled.error || 'Invalid equation',
      segments: [],
      discontinuityCount: 0,
      samplePointsCount: 0,
    };
  }

  const ySpan = Math.max(1e-6, yMax - yMin);
  const yCutoff = ySpan * 6;
  const step = (xMax - xMin) / samples;

  const segments: GraphPoint2D[][] = [];
  let currentSegment: GraphPoint2D[] = [];
  let discontinuityCount = 0;
  let samplePointsCount = 0;
  let prevY: number | null = null;
  let prevSlope: number | null = null;

  for (let i = 0; i <= samples; i += 1) {
    const x = xMin + i * step;
    const y = compiled.evaluateAt(x, parameterA);

    if (!Number.isFinite(y) || Math.abs(y - (yMin + yMax) / 2) > yCutoff) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
        discontinuityCount += 1;
      }
      prevY = null;
      prevSlope = null;
      continue;
    }

    if (prevY !== null) {
      const dy = y - prevY;
      const slope = dy / step;
      // Detect vertical asymptote or sudden jump discontinuity (e.g. tan(x) flipping from +large to -large, or 1/x, or floor(x))
      const jumpedAcrossViewport = Math.abs(dy) > ySpan * 0.75;
      const oppositeSteepSlopes =
        prevSlope !== null &&
        slope * prevSlope < 0 &&
        Math.abs(dy) > ySpan * 0.25;

      if (jumpedAcrossViewport || oppositeSteepSlopes) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        discontinuityCount += 1;
      }
      prevSlope = slope;
    }

    currentSegment.push({ x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) });
    samplePointsCount += 1;
    prevY = y;
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return {
    expression,
    normalizedRhs: compiled.normalizedRhs,
    valid: true,
    segments,
    discontinuityCount,
    samplePointsCount,
  };
}


