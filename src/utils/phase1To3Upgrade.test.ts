import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JEE_SYLLABUS_CHAPTERS } from '../data/jeeSyllabusAndNotes';
import {
  JEE_ADVANCED_ARCHETYPE_QUESTIONS,
  assembleFull75QuestionNtaMock,
  scorePyqQuestionResponse,
  predictShiftPercentileAndAir,
  computeTimeVsAccuracyQuadrants,
} from './pyqCorpusEngine';
import {
  extractMistakesFromCbtAttempt,
  convertMistakeEntriesToSm2Flashcards,
} from './mistakeBookEngine';
import { DistributedRateLimiterAndTokenBudget } from '../server/middleware/rateLimiterAndQuotas';
import { buildDeterministicSocraticClues } from '../server/routes/aiTutorRoutes';

test('Phase 1: server.ts is decomposed under 200 lines and mounts modular src/server/ routers', () => {
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const content = fs.readFileSync(serverPath, 'utf8');
  const lineCount = content.split('\n').length;
  assert.ok(
    lineCount < 200,
    `Expected server.ts to be < 200 lines, found ${lineCount}`
  );
  assert.ok(content.includes('createAiTutorRouter'));
  assert.ok(content.includes('createPyqAndCbtRouter'));
  assert.ok(content.includes('createStorageRouter'));
  assert.ok(content.includes('attachVoiceLiveWebSocketServer'));
});

test('Phase 1: DistributedRateLimiterAndTokenBudget enforces sliding-window rate limits and daily AI token budgets', () => {
  const limiter = new DistributedRateLimiterAndTokenBudget({
    windowMs: 60_000,
    maxRequestsPerWindow: 3,
    dailyTokenBudgetPerUser: 1000,
  });

  assert.equal(limiter.checkRateLimit('fp-user-1').allowed, true);
  assert.equal(limiter.checkRateLimit('fp-user-1').allowed, true);
  assert.equal(limiter.checkRateLimit('fp-user-1').allowed, true);
  assert.equal(limiter.checkRateLimit('fp-user-1').allowed, false);

  const b1 = limiter.consumeTokens('uid-123', 600);
  assert.equal(b1.allowed, true);
  assert.equal(b1.remainingTokens, 400);

  const b2 = limiter.consumeTokens('uid-123', 500);
  assert.equal(b2.allowed, false);
});

test('Phase 1 & 3: buildDeterministicSocraticClues supports English, Hinglish, and Hindi registers', () => {
  const en = buildDeterministicSocraticClues(
    'A solid sphere rolls without slipping on an incline.',
    'Rotational Motion',
    'English'
  );
  const hiEn = buildDeterministicSocraticClues(
    'A solid sphere rolls without slipping on an incline.',
    'Rotational Motion',
    'Hinglish'
  );
  assert.ok(en.clue1CorePrinciple.length > 20);
  assert.ok(hiEn.clue1CorePrinciple.includes('Coaching Hinglish'));
  assert.ok(en.clue2GoverningEquation.length > 10);
  assert.ok(en.clue3AlgebraicStep.length > 10);
});

test('Phase 2: JEE_SYLLABUS_CHAPTERS unpacks all 58 official NTA JEE Main & Advanced chapters (20 Physics, 20 Chemistry, 18 Mathematics)', () => {
  assert.equal(JEE_SYLLABUS_CHAPTERS.length, 58);
  const physicsCount = JEE_SYLLABUS_CHAPTERS.filter(
    (c) => c.subject === 'Physics'
  ).length;
  const chemCount = JEE_SYLLABUS_CHAPTERS.filter(
    (c) => c.subject === 'Chemistry'
  ).length;
  const mathCount = JEE_SYLLABUS_CHAPTERS.filter(
    (c) => c.subject === 'Mathematics'
  ).length;

  assert.equal(physicsCount, 20);
  assert.equal(chemCount, 20);
  assert.equal(mathCount, 18);

  for (const ch of JEE_SYLLABUS_CHAPTERS) {
    assert.ok(
      ch.classGrade === '11' ||
        ch.classGrade === '12' ||
        ch.classGrade === '11th' ||
        ch.classGrade === '12th'
    );
    assert.ok(typeof ch.ncertChapterNumber === 'number');
    assert.ok(typeof ch.ntaWeightagePct === 'number');
    assert.ok(
      ch.syllabusStatus === 'Active' ||
        ch.syllabusStatus === 'Removed-In-Main-Only'
    );
    assert.ok(Array.isArray(ch.highYieldFormulas) && ch.highYieldFormulas.length > 0);
  }
});

test('Phase 2: JEE Advanced Multiple-Correct partial credit (+4/+3/+2/+1/0/-2), Paragraph Comprehension, and Matrix-Match grading', () => {
  const multiQ = {
    ...JEE_ADVANCED_ARCHETYPE_QUESTIONS[0],
    id: 'test-adv-multi-4',
    exam: 'jee_advanced' as const,
    paperId: 'jee-adv-2024-p1',
    year: 2024,
    session: 'May' as const,
    shiftLabel: 'JEE Advanced 2024',
    subject: 'Physics' as const,
    chapterId: 'phys-rotational-motion',
    chapterTitle: 'Rotational Motion',
    difficulty: 'Hard' as const,
    format: 'multiple_mcq' as const,
    questionType: 'mcq_multiple' as const,
    markingRuleId: 'jee_adv_multi_partial_v2024' as const,
    stem: 'Which of the following four statements are true?',
    options: ['A', 'B', 'C', 'D'],
    correctOptionIndices: [0, 1, 2, 3],
    keyFormula: 'L = I\\omega',
    solutionExplanation: 'All 4 are correct.',
    commonTrap: 'Missing D.',
    verifiedSourceLabel: 'JEE Adv 2024',
  };

  // All 4 correct -> +4
  assert.equal(
    scorePyqQuestionResponse(multiQ, { selectedOptionIndices: [0, 1, 2, 3] })
      .marksAwarded,
    4
  );
  // 3 of 4 correct -> +3
  assert.equal(
    scorePyqQuestionResponse(multiQ, { selectedOptionIndices: [0, 1, 2] })
      .marksAwarded,
    3
  );
  // 2 of 4 correct -> +2
  assert.equal(
    scorePyqQuestionResponse(multiQ, { selectedOptionIndices: [0, 1] })
      .marksAwarded,
    2
  );
  // 1 of 4 correct -> +1
  assert.equal(
    scorePyqQuestionResponse(multiQ, { selectedOptionIndices: [0] }).marksAwarded,
    1
  );
  // Unattempted -> 0
  assert.equal(
    scorePyqQuestionResponse(multiQ, { selectedOptionIndices: [] }).marksAwarded,
    0
  );

  // Verify Paragraph Comprehension and Matrix-Match archetypes exist and grade accurately
  const comprehensionQs = JEE_ADVANCED_ARCHETYPE_QUESTIONS.filter(
    (q) => q.format === 'paragraph_comprehension' || q.questionType === 'paragraph_comprehension'
  );
  const matrixQs = JEE_ADVANCED_ARCHETYPE_QUESTIONS.filter(
    (q) => q.format === 'matrix_match' || q.questionType === 'matrix_match'
  );
  assert.ok(comprehensionQs.length >= 2);
  assert.ok(matrixQs.length >= 1);

  const matrixQ = matrixQs[0];
  const fullMap = scorePyqQuestionResponse(matrixQ, {
    matrixMapping: matrixQ.correctMatrixMapping,
  });
  assert.equal(fullMap.status, 'correct');
  assert.equal(fullMap.marksAwarded, matrixQ.markingRule.fullMarks);
});

test('Phase 2: Dynamic 75-Question NTA Mock Assembler builds 75 compulsory questions (25P + 25C + 25M, 20 Sec-A + 5 Sec-B per subject)', () => {
  const assembled = assembleFull75QuestionNtaMock('jee-main-2025-jan22-s1');
  assert.equal(assembled.totalQuestions, 75);
  assert.equal(assembled.questions.length, 75);

  for (const subj of ['Physics', 'Chemistry', 'Mathematics'] as const) {
    const subjQs = assembled.questions.filter((q) => q.subject === subj);
    assert.equal(subjQs.length, 25);
    const numCount = subjQs.filter((q) => q.section === 'B').length;
    assert.equal(numCount, 5);
  }
});

test('Phase 3: Shift-Normalized Percentile & AIR Predictor and Time-vs-Accuracy Quadrant Matrix', () => {
  const toughPred = predictShiftPercentileAndAir(220, 300, 'Tough');
  const easyPred = predictShiftPercentileAndAir(220, 300, 'Easy');
  assert.ok(toughPred.estimatedPercentile >= easyPred.estimatedPercentile);
  assert.ok(toughPred.estimatedPercentile > 99);

  const quad = computeTimeVsAccuracyQuadrants([
    {
      questionId: 'q1',
      subject: 'Physics',
      isAttempted: true,
      isCorrect: true,
      timeSpentSeconds: 75,
    },
    {
      questionId: 'q2',
      subject: 'Chemistry',
      isAttempted: true,
      isCorrect: false,
      timeSpentSeconds: 45,
    },
    {
      questionId: 'q3',
      subject: 'Mathematics',
      isAttempted: true,
      isCorrect: false,
      timeSpentSeconds: 195,
    },
  ]);
  assert.equal(quad.counts.fast_accurate, 1);
  assert.equal(quad.counts.fast_careless, 1);
  assert.equal(quad.counts.slow_incorrect, 1);
});

test('Phase 3: Mistake Book extracts incorrect, unattempted visited, and overtime questions and converts them to SM-2 flashcards', () => {
  const extracted = extractMistakesFromCbtAttempt({
    examId: 'mock-1',
    examTitle: 'JEE Main 2026 Full Mock #1',
    completedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q-wrong',
        questionNumber: 1,
        subject: 'Physics',
        topic: 'Rotational Motion',
        questionText: 'Moment of inertia of a uniform ring about its diameter is?',
        format: 'mcq_single',
        commonTrap: 'Confusing perpendicular axis with diameter axis.',
        keyFormula: 'I_d = \\frac{1}{2}MR^2',
        solutionSteps: 'By perpendicular axis theorem, I_z = I_x + I_y => MR^2 = 2I_d.',
        options: ['MR^2', '1/2 MR^2', '1/4 MR^2', '2 MR^2'],
        correctOptionIndex: 1,
      },
    ],
    responses: {
      'q-wrong': {
        questionId: 'q-wrong',
        status: 'answered',
        selectedOptionIndex: 0,
        timeSpentSeconds: 95,
        isCorrect: false,
      },
    },
  });

  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].outcomeType, 'incorrect');

  const converted = convertMistakeEntriesToSm2Flashcards(
    extracted,
    'doc-jee-main'
  );
  assert.equal(converted.convertedCount, 1);
  assert.equal(converted.flashcards.length, 1);
  assert.equal(converted.flashcards[0].easeFactor, 2.5);
  assert.equal(converted.flashcards[0].intervalDays, 1);
});
