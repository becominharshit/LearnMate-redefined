import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMaterialInput,
  splitTextIntoPages,
  gradeQuizSubmission,
  updateRevisionPlanWithAttempt,
  computeTopicProgress,
  computeOverallProgressSummary,
  generateStudyProgressReportText,
  parseYouTubeUrl,
  isValidYouTubeVideoId,
  formatTimestamp,
  computeTimerRemainingSeconds,
  buildGroundedStickyNotesAndFlashcards,
  buildGroundedMindMapAndRevisionSheet,
  parseTranscriptIntoTimestampedPages,
} from './quizGrading';
import type { QuizQuestion, RevisionTask } from '../types/study';

test('isValidYouTubeVideoId accepts only 11-character ids', () => {
  assert.equal(isValidYouTubeVideoId('dQw4w9WgXcQ'), true);
  assert.equal(isValidYouTubeVideoId('abc_-123456'), true);
  assert.equal(isValidYouTubeVideoId('short'), false);
  assert.equal(isValidYouTubeVideoId('https://evil.example'), false);
  assert.equal(isValidYouTubeVideoId('dQw4w9WgXcQ/../evil'), false);
  assert.equal(isValidYouTubeVideoId(undefined), false);
});

test('validateMaterialInput enforces PDF page count and file type limits', () => {
  const validPdf = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'notes.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 500,
    pageCount: 12,
    textContent: 'This is a valid PDF document with plenty of extracted text on page 1.',
  });
  assert.equal(validPdf.valid, true);

  const sixtyPagePdf = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'chapter60.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 1024 * 15,
    pageCount: 60,
    textContent: 'This is a valid 60-page JEE study PDF with plenty of extracted text on page 1.',
  });
  assert.equal(sixtyPagePdf.valid, true);

  const tooManyPages = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'textbook.pdf',
    mimeType: 'application/pdf',
    pageCount: 65,
    textContent: 'Valid text content here for testing.',
  });
  assert.equal(tooManyPages.valid, false);
  assert.match(tooManyPages.error || '', /up to 60 pages/);

  const wrongType = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'image.png',
    mimeType: 'image/png',
  });
  assert.equal(wrongType.valid, false);
});

test('splitTextIntoPages respects explicit page markers and logical paragraph chunks', () => {
  const raw = `--- Page 1 ---
Introduction to Conditional Probability
Conditional probability measures the probability of an event given that another event has occurred.

--- Page 2 ---
Bayes Theorem
Bayes theorem describes the probability of an event based on prior knowledge of conditions.`;

  const pages = splitTextIntoPages(raw);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].pageNumber, 1);
  assert.equal(pages[1].pageNumber, 2);
  assert.match(pages[1].content, /Bayes Theorem/);
});

test('gradeQuizSubmission deterministically grades answers and identifies weak topics', () => {
  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      topic: 'Bayes Theorem',
      question: 'What is P(A|B)?',
      options: ['P(A)P(B)', 'P(B|A)P(A)/P(B)', 'P(A)+P(B)', 'P(A)/P(B)'],
      correctIndex: 1,
      explanation: 'Bayes formula divides joint probability by P(B).',
      sourcePage: 2,
      sourceQuote: 'P(A|B) = P(B|A)P(A) / P(B)',
      difficulty: 'medium',
    },
    {
      id: 'q2',
      topic: 'Random Variables',
      question: 'What is the sum of probabilities in a valid PMF?',
      options: ['0', '0.5', '1', 'Infinity'],
      correctIndex: 2,
      explanation: 'All probabilities in a PMF sum to 1.',
      sourcePage: 3,
      sourceQuote: 'The sum over all x of P(X=x) equals 1.',
      difficulty: 'easy',
    },
  ];

  const attempt = gradeQuizSubmission({
    attemptId: 'att-1',
    documentId: 'doc-1',
    documentTitle: 'Probability Notes.pdf',
    mode: 'diagnostic',
    questions,
    selectedIndices: { q1: 0, q2: 2 }, // q1 wrong, q2 right
    completedAt: '2026-10-23T05:00:00.000Z',
  });

  assert.equal(attempt.score, 1);
  assert.equal(attempt.totalQuestions, 2);
  assert.equal(attempt.percentage, 50);
  assert.deepEqual(attempt.weakTopics, ['Bayes Theorem']);
  assert.deepEqual(attempt.strongTopics, ['Random Variables']);
});

test('updateRevisionPlanWithAttempt marks mastered tasks completed and computes progress deltas', () => {
  const initialPlan: RevisionTask[] = [
    {
      id: 'rev-1',
      documentId: 'doc-1',
      topic: 'Bayes Theorem',
      priority: 'high',
      reason: 'Missed in diagnostic quiz',
      recommendedAction: 'Review Page 2',
      conceptSummary: 'Posterior = Likelihood * Prior / Evidence',
      sourcePage: 2,
      completed: false,
      updatedAt: '2026-10-23T05:00:00.000Z',
    },
  ];

  const questions: QuizQuestion[] = [
    {
      id: 'q-adapt-1',
      topic: 'Bayes Theorem',
      question: 'In Bayes theorem, what is P(A) called?',
      options: ['Prior probability', 'Posterior probability', 'Likelihood', 'Marginal'],
      correctIndex: 0,
      explanation: 'P(A) is the prior probability before observing B.',
      sourcePage: 2,
      sourceQuote: 'P(A) is the prior probability.',
      difficulty: 'medium',
    },
  ];

  const diagnosticAttempt = gradeQuizSubmission({
    attemptId: 'att-1',
    documentId: 'doc-1',
    documentTitle: 'Probability Notes.pdf',
    mode: 'diagnostic',
    questions,
    selectedIndices: { 'q-adapt-1': 2 }, // 0%
    completedAt: '2026-10-23T05:00:00.000Z',
  });

  const adaptiveAttempt = gradeQuizSubmission({
    attemptId: 'att-2',
    documentId: 'doc-1',
    documentTitle: 'Probability Notes.pdf',
    mode: 'adaptive',
    questions,
    selectedIndices: { 'q-adapt-1': 0 }, // 100%
    completedAt: '2026-10-23T05:10:00.000Z',
  });

  const updatedPlan = updateRevisionPlanWithAttempt(initialPlan, adaptiveAttempt);
  assert.equal(updatedPlan[0].completed, true);

  const progress = computeTopicProgress([diagnosticAttempt, adaptiveAttempt]);
  assert.equal(progress.length, 1);
  assert.equal(progress[0].topic, 'Bayes Theorem');
  assert.equal(progress[0].firstScorePct, 0);
  assert.equal(progress[0].latestScorePct, 100);
  assert.equal(progress[0].deltaPct, 100);
  assert.equal(progress[0].status, 'mastered');

  const summary = computeOverallProgressSummary([diagnosticAttempt, adaptiveAttempt]);
  assert.equal(summary.totalAttempts, 2);
  assert.equal(summary.overallDeltaPct, 100);

  const reportText = generateStudyProgressReportText({
    attempts: [diagnosticAttempt, adaptiveAttempt],
    revisionTasks: updatedPlan,
    filterLabel: 'Probability Notes.pdf',
    generatedAt: '2026-10-23T06:00:00.000Z',
  });
  assert.match(reportText, /LEARNMATE STUDY PROGRESS REPORT/);
  assert.match(reportText, /Total Completed Quizzes : 2/);
  assert.match(reportText, /\[COMPLETED\] Bayes Theorem/);
});

test('parseYouTubeUrl validates standard watch, short youtu.be, and rejects non-YouTube URLs', () => {
  const watch = parseYouTubeUrl('https://www.youtube.com/watch?v=aircAruvnKk&t=135s');
  assert.equal(watch.valid, true);
  assert.equal(watch.videoId, 'aircAruvnKk');
  assert.equal(watch.canonicalWatchUrl, 'https://www.youtube.com/watch?v=aircAruvnKk');
  assert.equal(watch.startSeconds, 135);

  const shortLink = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(shortLink.valid, true);
  assert.equal(shortLink.videoId, 'dQw4w9WgXcQ');

  const invalidDomain = parseYouTubeUrl('https://vimeo.com/123456789');
  assert.equal(invalidDomain.valid, false);
  assert.match(invalidDomain.error || '', /YouTube/i);

  assert.equal(formatTimestamp(135), '02:15');
  assert.equal(formatTimestamp(3665), '01:01:05');
});

test('computeTimerRemainingSeconds uses real timestamp deltas and never returns negative values', () => {
  const now = 1_700_000_000_000;
  const target = now + 90_000; // 90s ahead
  assert.equal(
    computeTimerRemainingSeconds({
      isRunning: true,
      targetEndTimestamp: target,
      fallbackRemainingSeconds: 1500,
      nowMs: now,
    }),
    90
  );

  // Past target -> clamps to 0
  assert.equal(
    computeTimerRemainingSeconds({
      isRunning: true,
      targetEndTimestamp: target,
      fallbackRemainingSeconds: 90,
      nowMs: target + 5000,
    }),
    0
  );

  // Paused -> returns fallbackRemainingSeconds
  assert.equal(
    computeTimerRemainingSeconds({
      isRunning: false,
      targetEndTimestamp: null,
      fallbackRemainingSeconds: 420,
      nowMs: now,
    }),
    420
  );
});

test('buildGroundedStickyNotesAndFlashcards & buildGroundedMindMapAndRevisionSheet generate structured study tools', () => {
  const pages = [
    {
      pageNumber: 1,
      title: 'Conditional Probability',
      content:
        '• Conditional Probability: P(A|B) = P(A and B) / P(B) when P(B) > 0.\n• Independence: Events A and B are independent when P(A and B) = P(A)P(B).',
      timestampSeconds: 125,
      timestampLabel: '02:05',
    },
  ];
  const topics = [
    {
      id: 't1',
      name: 'Conditional Probability',
      summary: 'Restricting sample space after observing event B.',
      keyConcepts: ['P(A|B)', 'Statistical Independence'],
      sourcePages: [1],
    },
  ];

  const { stickyNotes, flashcards } = buildGroundedStickyNotesAndFlashcards({
    sourceType: 'youtube',
    pages,
    topics,
  });
  assert.ok(stickyNotes.length >= 5);
  assert.ok(flashcards.length >= 5);
  assert.equal(stickyNotes[0].sourceLabel, '02:05');
  assert.equal(flashcards[0].status, 'unreviewed');

  const { mindMap, onePageRevision } = buildGroundedMindMapAndRevisionSheet({
    title: 'Probability Lecture',
    overview: 'Overview of conditional probability.',
    sourceType: 'youtube',
    pages,
    topics,
  });
  assert.equal(mindMap.centralTopic, 'Probability Lecture');
  assert.ok(mindMap.nodes.length >= 2);
  assert.equal(onePageRevision.chapterTitle, 'Probability Lecture');
  assert.ok(onePageRevision.essentialConcepts.length >= 1);
});

test('parseTranscriptIntoTimestampedPages parses YouTube timestamps and preserves lecture text', () => {
  const transcript = [
    '0:00',
    'Welcome to Rotational Motion for JEE Main.',
    '02:15 Moment of inertia of a uniform rod about its centre is ML^2 / 12.',
    '[05:40] Parallel axis theorem: I = I_cm + M d^2.',
  ].join('\n');

  const pages = parseTranscriptIntoTimestampedPages(transcript);
  assert.ok(pages.length >= 1);
  assert.equal(pages[0].timestampSeconds, 0);
  assert.equal(pages[0].timestampLabel, '00:00');
  assert.match(pages[0].content, /Rotational Motion/);
  assert.match(pages[0].content, /Parallel axis theorem/);
});

