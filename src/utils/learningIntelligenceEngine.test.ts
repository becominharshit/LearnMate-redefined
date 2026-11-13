import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT_CAUSE_TAXONOMY,
  diagnoseRootCauseMisconception,
  advanceClosedLoopStage,
  recordConceptQuestionAttempt,
  buildDailyMentorBrief,
  buildConsentGatedParentMentorSummary,
} from './learningIntelligenceEngine';
import type { MistakeBookEntry } from './mistakeBookEngine';
import type { QuizAttempt, FlashcardItem } from '../types/study';

test('Wave 4: 10-category taxonomy distinguishes step_verified from qualified_inference honestly', () => {
  assert.equal(Object.keys(ROOT_CAUSE_TAXONOMY).length, 10);

  // Without explicit student reasoning steps, confidence MUST be qualified_inference
  const inferred = diagnoseRootCauseMisconception({
    triggerReason: 'incorrect',
    timeSpentSeconds: 22,
    questionText: 'Find acceleration down an incline',
    topic: 'Rotational Motion',
    studentResponseLabel: '10',
    correctAnswerLabel: '-10',
  });
  assert.equal(inferred.confidence, 'qualified_inference');
  assert.equal(inferred.hasStudentReasoningSteps, false);
  assert.equal(inferred.category, 'time_pressure_guess');

  // With explicit student reasoning steps, confidence upgrades to step_verified
  const verified = diagnoseRootCauseMisconception({
    triggerReason: 'incorrect',
    timeSpentSeconds: 95,
    questionText: 'Find electric flux through cube',
    topic: 'Electrostatics',
    studentReasoningSteps: 'I forgot the minus sign for inward normal direction and used cm instead of m.',
  });
  assert.equal(verified.confidence, 'step_verified');
  assert.equal(verified.hasStudentReasoningSteps, true);
  assert.equal(verified.category, 'sign_or_unit_slip');
});

test('Wave 4: Anti-inflation seenQuestionIds prevents re-solving identical question from inflating unique mastery', () => {
  const first = recordConceptQuestionAttempt(null, {
    conceptKey: 'rotational-inertia',
    chapterTitle: 'Rotational Motion',
    subject: 'Physics',
    questionId: 'q-rot-1',
    isCorrect: true,
    masteredChaptersSet: new Set(['Laws of Motion']),
  });
  assert.equal(first.uniqueAttemptedCount, 1);
  assert.equal(first.uniqueCorrectCount, 1);
  assert.equal(first.repeatPracticeCount, 0);
  assert.deepEqual(first.unmetPrerequisites, ['Work, Energy and Power']);

  // Re-solving identical questionId q-rot-1 must NOT increase uniqueAttemptedCount or uniqueCorrectCount
  const repeat = recordConceptQuestionAttempt(first, {
    conceptKey: 'rotational-inertia',
    chapterTitle: 'Rotational Motion',
    subject: 'Physics',
    questionId: 'q-rot-1',
    isCorrect: true,
    masteredChaptersSet: new Set(['Laws of Motion']),
  });
  assert.equal(repeat.uniqueAttemptedCount, 1);
  assert.equal(repeat.uniqueCorrectCount, 1);
  assert.equal(repeat.repeatPracticeCount, 1);
  assert.equal(repeat.masteryPct, first.masteryPct);

  // Valid closed-loop stage progression
  assert.equal(advanceClosedLoopStage('diagnosed', 'retaught').allowed, true);
  assert.equal(advanceClosedLoopStage('attempted', 'scheduled_sm2').allowed, false);
});

test('Wave 4: Daily Mentor Brief answers all 6 questions truthfully and enforces parent consent gate', () => {
  const emptyBrief = buildDailyMentorBrief({ attempts: [], mistakes: [], flashcards: [] });
  assert.equal(emptyBrief.verifiedPracticeAttemptsCount, 0);
  assert.ok(emptyBrief.q3HowAmIProgressing.includes('0 graded practice attempts'));
  assert.ok(emptyBrief.q6AmIExamReady.includes('Insufficient practice volume'));

  const attempts: QuizAttempt[] = [
    {
      id: 'att-1',
      documentId: 'doc-1',
      documentTitle: 'Electrostatics Notes',
      mode: 'adaptive',
      score: 6,
      totalQuestions: 10,
      percentage: 60,
      questions: [],
      answers: [],
      weakTopics: ['Gauss Law'],
      strongTopics: [],
      completedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
    {
      id: 'att-2',
      documentId: 'doc-1',
      documentTitle: 'Electrostatics Notes',
      mode: 'adaptive',
      score: 8,
      totalQuestions: 10,
      percentage: 80,
      questions: [],
      answers: [],
      weakTopics: ['Gauss Law'],
      strongTopics: ['Coulomb Law'],
      completedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    },
  ];
  const mistakes: MistakeBookEntry[] = [
    {
      id: 'm1',
      questionId: 'q1',
      examTitle: 'Mock 1',
      subject: 'Physics',
      chapterTitle: 'Electrostatics',
      topic: 'Gauss Law',
      questionText: 'Flux',
      studentResponseLabel: '0',
      correctAnswerLabel: 'q/eps0',
      keyFormula: 'Phi = q/eps0',
      solutionSteps: 'Apply Gauss law',
      timeSpentSeconds: 90,
      triggerReason: 'incorrect',
      errorCategory: 'Formula Slip',
      rootCauseLabel: 'Formula Recall / Coefficient Slip',
      convertedToSm2: false,
      neuronzStage: 'Day 1',
      createdAt: new Date().toISOString(),
    },
  ];
  const flashcards: FlashcardItem[] = [
    {
      id: 'fc-1',
      frontQuestion: 'State Gauss Law',
      backAnswer: 'q/eps0',
      topic: 'Gauss Law',
      sourcePage: 1,
      sourceLabel: 'Notes p.1',
      status: 'review_again',
    },
  ];

  const activeBrief = buildDailyMentorBrief({ attempts, mistakes, flashcards });
  assert.ok(activeBrief.q1WhatToStudyToday.includes('Gauss Law'));
  assert.ok(activeBrief.q2WhyThisNow.includes('Formula Recall'));
  assert.ok(activeBrief.q3HowAmIProgressing.includes('80%'));
  assert.ok(activeBrief.q4WhereLosingMarks.includes('Physics'));
  assert.ok(activeBrief.q5DueForRevisionToday.includes('1 SM-2 flashcard'));
  assert.equal(activeBrief.dueItemsCount, 2);

  const blockedReport = buildConsentGatedParentMentorSummary({
    consent: { enabled: false, guardianLabel: 'Parent', shareScope: 'summary_only' },
    studentDisplayName: 'Aarav',
    attempts,
    mistakes,
  });
  assert.equal(blockedReport.allowed, false);

  const allowedReport = buildConsentGatedParentMentorSummary({
    consent: { enabled: true, guardianLabel: 'Parent', shareScope: 'summary_only' },
    studentDisplayName: 'Aarav',
    attempts,
    mistakes,
  });
  assert.equal(allowedReport.allowed, true);
  if (allowedReport.allowed) {
    assert.equal(allowedReport.summary.averageScorePct, 70);
    assert.equal(allowedReport.summary.attemptsCompletedLast7Days, 2);
  }
});
