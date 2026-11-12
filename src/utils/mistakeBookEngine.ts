import type { FlashcardItem, QuickReviseBundle } from '../types/study';
import { studyStorage } from '../services/storageService';

export type MistakeClassificationTag =
  | 'Conceptual Gap'
  | 'Formula Slip'
  | 'Calculation Error'
  | 'Misread Stem'
  | 'Guessed Under Time Pressure';

export type MistakeTriggerReason = 'incorrect' | 'unattempted_visited' | 'overtime_180s';

export interface MistakeBookEntry {
  id: string;
  questionId: string;
  examTitle: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapterTitle: string;
  topic: string;
  questionText: string;
  studentResponseLabel: string;
  correctAnswerLabel: string;
  keyFormula: string;
  solutionSteps: string;
  timeSpentSeconds: number;
  triggerReason: MistakeTriggerReason;
  outcomeType?: MistakeTriggerReason;
  errorCategory: MistakeClassificationTag;
  convertedToSm2: boolean;
  sm2CardId?: string;
  neuronzStage: 'Day 1' | 'Day 3' | 'Day 7' | 'Mastered';
  createdAt: string;
}

const MISTAKE_BOOK_STORAGE_KEY = 'learnmate_mistake_book_v1';
const SM2_MISTAKE_DECK_STORAGE_KEY = 'learnmate_sm2_mistake_deck_v1';

export const MISTAKE_CLASSIFICATION_TAGS: MistakeClassificationTag[] = [
  'Conceptual Gap',
  'Formula Slip',
  'Calculation Error',
  'Misread Stem',
  'Guessed Under Time Pressure',
];

export function getStoredMistakeBookEntries(): MistakeBookEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(MISTAKE_BOOK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMistakeBookEntries(entries: MistakeBookEntry[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(MISTAKE_BOOK_STORAGE_KEY, JSON.stringify(entries.slice(0, 400)));
  } catch {
    // ignore storage quota errors
  }
}

export function inferDefaultMistakeCategory(params: {
  triggerReason: MistakeTriggerReason;
  timeSpentSeconds: number;
}): MistakeClassificationTag {
  if (params.triggerReason === 'overtime_180s' || params.timeSpentSeconds > 180) {
    return 'Calculation Error';
  }
  if (params.triggerReason === 'unattempted_visited') {
    return 'Conceptual Gap';
  }
  if (params.timeSpentSeconds < 35) {
    return 'Guessed Under Time Pressure';
  }
  return 'Formula Slip';
}

export function extractMistakesFromCbtAttempt(params: {
  examId?: string;
  examTitle: string;
  completedAt?: string;
  questions: Array<{
    id: string;
    questionNumber?: number;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapterTitle?: string;
    topic: string;
    questionText: string;
    format?: string;
    commonTrap?: string;
    keyFormula: string;
    solutionSteps: string;
    options?: string[];
    correctOptionIndex?: number;
    correctOptionIndices?: number[];
    correctNumericalValue?: number;
  }>;
  responses: Record<
    string,
    {
      questionId?: string;
      status: string;
      selectedOptionIndex: number | null;
      selectedOptionIndices?: number[];
      numericalInput?: string;
      timeSpentSeconds: number;
      isCorrect?: boolean;
    }
  >;
}): MistakeBookEntry[] {
  const existing = getStoredMistakeBookEntries();
  const byQuestionId = new Map<string, MistakeBookEntry>();
  for (const item of existing) {
    byQuestionId.set(item.questionId, item);
  }

  const newlyExtracted: MistakeBookEntry[] = [];

  for (const q of params.questions) {
    const r = params.responses[q.id];
    if (!r) continue;

    const isAnswered = r.status === 'answered' || r.status === 'answered_and_marked';
    const isVisitedUnanswered =
      r.status === 'not_answered' || r.status === 'marked_for_review';
    const isOvertime = (r.timeSpentSeconds || 0) > 180;

    const rawNumerical = typeof r.numericalInput === 'string' ? r.numericalInput.trim() : '';
    let isCorrect = Boolean(r.isCorrect);
    if (r.isCorrect === undefined && isAnswered) {
      if (q.correctNumericalValue !== undefined && rawNumerical !== '') {
        isCorrect = Math.abs(Number(rawNumerical) - q.correctNumericalValue) <= 0.05;
      } else if (typeof q.correctOptionIndex === 'number') {
        isCorrect = r.selectedOptionIndex === q.correctOptionIndex;
      }
    }

    let triggerReason: MistakeTriggerReason | null = null;
    if (isAnswered && !isCorrect) {
      triggerReason = 'incorrect';
    } else if (!isAnswered && isVisitedUnanswered && (r.timeSpentSeconds || 0) > 0) {
      triggerReason = 'unattempted_visited';
    } else if (isOvertime) {
      triggerReason = 'overtime_180s';
    }

    if (!triggerReason) continue;

    const studentResponseLabel = !isAnswered
      ? 'Unattempted (Visited)'
      : rawNumerical !== ''
      ? rawNumerical
      : r.selectedOptionIndices && r.selectedOptionIndices.length > 0
      ? r.selectedOptionIndices.map((i) => ['A', 'B', 'C', 'D'][i] || String(i + 1)).join(', ')
      : typeof r.selectedOptionIndex === 'number' && r.selectedOptionIndex >= 0
      ? `${['A', 'B', 'C', 'D'][r.selectedOptionIndex]}: ${q.options?.[r.selectedOptionIndex] || ''}`
      : 'Attempted';

    const correctAnswerLabel =
      q.correctNumericalValue !== undefined
        ? String(q.correctNumericalValue)
        : q.correctOptionIndices && q.correctOptionIndices.length > 0
        ? q.correctOptionIndices.map((i) => ['A', 'B', 'C', 'D'][i] || String(i + 1)).join(', ')
        : typeof q.correctOptionIndex === 'number'
        ? `${['A', 'B', 'C', 'D'][q.correctOptionIndex]}: ${q.options?.[q.correctOptionIndex] || ''}`
        : 'Verified Official Key';

    const prev = byQuestionId.get(q.id);
    const entry: MistakeBookEntry = {
      id: prev?.id || `mistake-${q.id}-${Date.now()}`,
      questionId: q.id,
      examTitle: params.examTitle,
      subject: q.subject,
      chapterTitle: q.chapterTitle || q.topic,
      topic: q.topic,
      questionText: q.questionText,
      studentResponseLabel,
      correctAnswerLabel,
      keyFormula: q.keyFormula || q.topic,
      solutionSteps: q.solutionSteps,
      timeSpentSeconds: r.timeSpentSeconds || 0,
      triggerReason,
      outcomeType: triggerReason,
      errorCategory:
        prev?.errorCategory ||
        inferDefaultMistakeCategory({
          triggerReason,
          timeSpentSeconds: r.timeSpentSeconds || 0,
        }),
      convertedToSm2: prev?.convertedToSm2 ?? false,
      sm2CardId: prev?.sm2CardId,
      neuronzStage: prev?.neuronzStage || 'Day 1',
      createdAt: new Date().toISOString(),
    };

    byQuestionId.set(q.id, entry);
    newlyExtracted.push(entry);
  }

  const merged = Array.from(byQuestionId.values());
  saveMistakeBookEntries(merged);
  return merged;
}

export const getStoredMistakeBook = getStoredMistakeBookEntries;

export function updateMistakeClassification(
  entryId: string,
  errorCategory: MistakeClassificationTag
): MistakeBookEntry[] {
  const entries = getStoredMistakeBookEntries();
  const updated = entries.map((e) => (e.id === entryId ? { ...e, errorCategory } : e));
  saveMistakeBookEntries(updated);
  return updated;
}

/**
 * Converts Mistake Book entries into SuperMemo SM-2 Flashcards with NeuronZ 1-3-7 day
 * priority scheduling and persists them into both the global SM-2 deck and active document bundle.
 */
export function convertMistakeEntriesToSm2Flashcards(
  entriesToConvert?: MistakeBookEntry[],
  activeDocumentId?: string
): {
  convertedCount: number;
  flashcards: FlashcardItem[];
  updatedEntries: MistakeBookEntry[];
} {
  const allEntries = getStoredMistakeBookEntries();
  const targets = entriesToConvert || allEntries;
  const sourceList = allEntries.length > 0 ? allEntries : targets;
  const nowIso = new Date().toISOString();

  const existingDeckRaw =
    typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(SM2_MISTAKE_DECK_STORAGE_KEY)
      : null;
  const existingDeck: FlashcardItem[] = existingDeckRaw ? JSON.parse(existingDeckRaw) : [];
  const cardById = new Map<string, FlashcardItem>();
  for (const c of existingDeck) {
    cardById.set(c.id, c);
  }

  let convertedCount = 0;
  const targetIdSet = new Set(targets.map((t) => t.id));

  const updatedEntries = sourceList.map((entry) => {
    if (!targetIdSet.has(entry.id)) return entry;
    const cardId = entry.sm2CardId || `sm2-mistake-${entry.questionId}`;
    const card: FlashcardItem = {
      id: cardId,
      frontQuestion: `[${entry.subject} · ${entry.errorCategory}] ${entry.questionText}`,
      backAnswer: `Correct Answer: ${entry.correctAnswerLabel}\nKey Formula: ${entry.keyFormula}\nNeuronZ Fix (${entry.neuronzStage}): ${entry.solutionSteps}`,
      topic: entry.topic,
      sourcePage: 1,
      sourceLabel: `Mistake Book · ${entry.examTitle}`,
      status: 'review_again',
      repetitionCount: 0,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 1,
      nextReviewDate: nowIso,
      nextReviewAt: nowIso,
      lastReviewedAt: nowIso,
    };
    cardById.set(cardId, card);
    convertedCount += 1;
    return {
      ...entry,
      convertedToSm2: true,
      sm2CardId: cardId,
    };
  });

  const mergedCards = Array.from(cardById.values());
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SM2_MISTAKE_DECK_STORAGE_KEY, JSON.stringify(mergedCards));
    } catch {
      // ignore
    }
  }

  // Also inject into active document's QuickReviseBundle so it appears immediately in Revise tab
  const docId = activeDocumentId || studyStorage.getActiveDocumentId();
  if (docId) {
    const existingBundle = studyStorage.getQuickReviseBundle(docId);
    const prevCards = existingBundle?.flashcards || [];
    const existingIds = new Set(prevCards.map((c) => c.id));
    const newCardsToInject = mergedCards.filter((c) => !existingIds.has(c.id));
    const nextBundle: QuickReviseBundle = {
      documentId: docId,
      contentVersion: existingBundle?.contentVersion || 'v1',
      stickyNotes: existingBundle?.stickyNotes || [],
      flashcards: [...newCardsToInject, ...prevCards],
      mindMap: existingBundle?.mindMap || null,
      onePageRevision: existingBundle?.onePageRevision || null,
      updatedAt: nowIso,
    };
    studyStorage.saveQuickReviseBundle(nextBundle);
  }

  saveMistakeBookEntries(updatedEntries);
  return {
    convertedCount,
    flashcards: mergedCards,
    updatedEntries,
  };
}
