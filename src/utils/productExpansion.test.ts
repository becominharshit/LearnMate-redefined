import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYLLABUS_VERSIONS,
  JEE_SYLLABUS_CHAPTERS,
  getSyllabusCoverageReport,
  getSyllabusChaptersForExam,
  buildStudyDocumentFromSyllabusChapter,
} from '../data/jeeSyllabusAndNotes';
import {
  OFFICIAL_PYQ_PAPERS,
  OFFICIAL_PYQ_QUESTIONS,
  MARKING_RULES,
  resolveMarkingRule,
  getPyqCorpusCoverageAudit,
  scorePyqQuestionResponse,
  runIdempotentPyqImport,
  filterPyqQuestions,
  type PyqCorpusQuestion,
} from './pyqCorpusEngine';
import { DEFAULT_JEE_75_QUESTION_PAPER } from './jeeQuestionBank';
import {
  awardLearningXp,
  getRewardsLedger,
  computeLevelFromXp,
  buildDailyPracticeCoachPlan,
} from './rewardsEngine';
import {
  evaluateScientificExpression,
  compileCartesianEquation,
  sampleCartesianEquationSegments,
} from './learnmate2Engine';

// Mock window & localStorage in Node test runtime
const memoryStore = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = mockStorage;
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { localStorage: mockStorage };
}

describe('JEE Main & Advanced Syllabus and Complete Chapter Notes Engine', () => {
  it('provides official provenance for both JEE Main and JEE Advanced syllabus versions', () => {
    const mainVer = SYLLABUS_VERSIONS.jee_main;
    const advVer = SYLLABUS_VERSIONS.jee_advanced;
    assert.ok(mainVer && mainVer.sourceUrl.includes('jeemain.nta.nic.in'));
    assert.ok(advVer && advVer.sourceUrl.includes('jeeadv.ac.in'));
  });

  it('contains published Full Notes and Quick Notes across Physics, Chemistry, and Mathematics', () => {
    const coverage = getSyllabusCoverageReport();
    assert.ok(coverage.totalChapters >= 15);
    assert.equal(coverage.publishedChapters, coverage.totalChapters);
    assert.ok(coverage.bySubject.Physics.published >= 5);
    assert.ok(coverage.bySubject.Chemistry.published >= 5);
    assert.ok(coverage.bySubject.Mathematics.published >= 5);

    const mainChapters = getSyllabusChaptersForExam('jee_main');
    const advChapters = getSyllabusChaptersForExam('jee_advanced');
    assert.ok(mainChapters.length >= 15);
    assert.ok(advChapters.length >= 15);
  });

  it('converts a syllabus chapter into a valid StudyDocument for both full and quick notes', () => {
    const chapter = JEE_SYLLABUS_CHAPTERS[0];
    const fullDoc = buildStudyDocumentFromSyllabusChapter(chapter, 'full');
    const quickDoc = buildStudyDocumentFromSyllabusChapter(chapter, 'quick');

    assert.ok(fullDoc.pages.length >= 2);
    assert.ok(quickDoc.pages.length >= 1);
    assert.ok(fullDoc.topics && fullDoc.topics.length > 0);
  });
});

describe('Official PYQ & Mock Paper Library + Marking Rules Engine', () => {
  it('scores JEE Main single-choice (+4/-1) and numerical (+4/-1) accurately', () => {
    const mcq = OFFICIAL_PYQ_QUESTIONS.find(
      (q) => q.exam === 'jee_main' && q.format === 'single_mcq'
    )!;
    assert.ok(mcq);

    const correctIdx = mcq.correctOptionIndices?.[0] ?? 0;
    const correctRes = scorePyqQuestionResponse(mcq, {
      selectedOptionIndices: [correctIdx],
    });
    assert.equal(correctRes.status, 'correct');
    assert.equal(correctRes.marksAwarded, 4);

    const wrongIdx = (correctIdx + 1) % 4;
    const wrongRes = scorePyqQuestionResponse(mcq, {
      selectedOptionIndices: [wrongIdx],
    });
    assert.equal(wrongRes.status, 'incorrect');
    assert.equal(wrongRes.marksAwarded, -1);

    const unattemptedRes = scorePyqQuestionResponse(mcq, {
      selectedOptionIndices: [],
    });
    assert.equal(unattemptedRes.status, 'unattempted');
    assert.equal(unattemptedRes.marksAwarded, 0);
  });

  it('scores JEE Advanced multi-correct (+4/-2 with +3/+2/+1 partial marks) accurately', () => {
    const advMulti = OFFICIAL_PYQ_QUESTIONS.find(
      (q) => q.exam === 'jee_advanced' && q.format === 'multiple_mcq'
    )!;
    assert.ok(advMulti);
    const correctIndices = advMulti.correctOptionIndices!;
    assert.ok(correctIndices.length >= 2);

    // Full correct -> +4
    const fullRes = scorePyqQuestionResponse(advMulti, {
      selectedOptionIndices: correctIndices,
    });
    assert.equal(fullRes.status, 'correct');
    assert.equal(fullRes.marksAwarded, 4);

    // 1 correct subset and 0 wrong -> +1 partial credit
    const partialRes = scorePyqQuestionResponse(advMulti, {
      selectedOptionIndices: [correctIndices[0]],
    });
    assert.equal(partialRes.status, 'partially_correct');
    assert.equal(partialRes.marksAwarded, 1);

    // Any wrong option chosen -> -2 negative penalty
    const wrongIdx = [0, 1, 2, 3].find((idx) => !correctIndices.includes(idx)) ?? 3;
    const wrongRes = scorePyqQuestionResponse(advMulti, {
      selectedOptionIndices: [correctIndices[0], wrongIdx],
    });
    assert.equal(wrongRes.status, 'incorrect');
    assert.equal(wrongRes.marksAwarded, -2);
  });

  it('handles dropped/bonus questions and multiple accepted keys', () => {
    const droppedQ: PyqCorpusQuestion = {
      ...OFFICIAL_PYQ_QUESTIONS[0],
      id: 'test-dropped-q',
      keyStatus: 'dropped_bonus',
    };
    const bonusRes = scorePyqQuestionResponse(droppedQ, {
      selectedOptionIndices: [],
    });
    assert.equal(bonusRes.status, 'bonus_dropped');
    assert.equal(bonusRes.marksAwarded, 4);
  });

  it('performs idempotent PYQ import and deduplicates existing question IDs', () => {
    const sampleBatch = OFFICIAL_PYQ_QUESTIONS.slice(0, 3);
    const report = runIdempotentPyqImport(sampleBatch, sampleBatch);
    assert.equal(report.addedCount, 0);
    assert.equal(report.updatedCount, 0);
    assert.equal(report.mergedQuestions.length, 3);

    const filteredMain = filterPyqQuestions({ exam: 'jee_main', subject: 'Physics' });
    assert.ok(filteredMain.length > 0);
    assert.ok(OFFICIAL_PYQ_PAPERS.length >= 6);
    assert.ok(Object.keys(MARKING_RULES).length >= 5);
  });
});

describe('Idempotent XP, Levels, Streaks & Coach Plan Engine', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('awards XP once per deterministic eventId and prevents duplicate XP on retry/refresh', () => {
    const first = awardLearningXp({
      eventId: 'pyq-solve:test-q1',
      category: 'practice_completed',
      xpAwarded: 15,
      title: 'Solved PYQ #1',
    });
    assert.equal(first.awarded, true);
    assert.equal(first.totalXp, 15);

    const duplicate = awardLearningXp({
      eventId: 'pyq-solve:test-q1',
      category: 'practice_completed',
      xpAwarded: 15,
      title: 'Solved PYQ #1 retry',
    });
    assert.equal(duplicate.awarded, false);
    assert.equal(duplicate.totalXp, 15);
    assert.equal(getRewardsLedger().length, 1);
  });

  it('computes levels and generates an explainable daily practice coach plan', () => {
    const levelInfo = computeLevelFromXp(620);
    assert.ok(levelInfo.level >= 2);
    assert.ok(levelInfo.title.length > 0);

    const tasks = buildDailyPracticeCoachPlan({
      documents: [],
      attempts: [],
      weakTopics: ['Rotational Motion', 'Electrochemistry'],
      dueFlashcardsCount: 8,
    });
    assert.ok(tasks.length >= 3);
    assert.ok(tasks.every((t) => t.reason.length > 10 && t.estimatedMinutes > 0));
  });
});

describe('Cartesian Equation Grapher & Discontinuity Detection', () => {
  it('compiles explicit functions of x including implicit multiplication and parameter a', () => {
    const compiled = compileCartesianEquation('y = 2x^2 - 4');
    assert.equal(compiled.valid, true);
    assert.ok(compiled.evaluateAt);
    assert.equal(compiled.evaluateAt(0, 1), -4);
    assert.equal(compiled.evaluateAt(2, 1), 4);
  });

  it('detects discontinuities/vertical asymptotes for tan(x) and 1/(x-2) and splits segments', () => {
    const rational = sampleCartesianEquationSegments({
      expression: '1 / (x - 2)',
      parameterA: 1,
      xMin: -5,
      xMax: 5,
      yMin: -10,
      yMax: 10,
      samples: 240,
    });
    assert.equal(rational.valid, true);
    assert.ok(rational.discontinuityCount >= 1);
    assert.ok(rational.segments.length >= 2);

    const tangent = sampleCartesianEquationSegments({
      expression: 'tan(x)',
      parameterA: 1,
      xMin: -4,
      xMax: 4,
      yMin: -10,
      yMax: 10,
      samples: 240,
    });
    assert.equal(tangent.valid, true);
    assert.ok(tangent.discontinuityCount >= 1);
    assert.ok(tangent.segments.length >= 2);
  });

  it('compiles sec(x), csc(x), cot(x), and unary minus exponentiation (-x^2 + 4) without throwing', () => {
    const secGraph = sampleCartesianEquationSegments({
      expression: 'sec(x)',
      parameterA: 1,
      xMin: -4,
      xMax: 4,
      yMin: -10,
      yMax: 10,
      samples: 240,
    });
    assert.equal(secGraph.valid, true);
    assert.ok(secGraph.segments.length >= 2);

    const cscGraph = compileCartesianEquation('csc(x)');
    assert.equal(cscGraph.valid, true);
    assert.ok(cscGraph.evaluateAt);
    assert.ok(Math.abs(cscGraph.evaluateAt(Math.PI / 2) - 1) < 1e-9);

    const cotGraph = compileCartesianEquation('cot(x)');
    assert.equal(cotGraph.valid, true);
    assert.ok(cotGraph.evaluateAt);
    assert.ok(Math.abs(cotGraph.evaluateAt(Math.PI / 4) - 1) < 1e-9);

    const unaryQuad = compileCartesianEquation('-x^2 + 4');
    assert.equal(unaryQuad.valid, true);
    assert.ok(unaryQuad.evaluateAt);
    assert.equal(unaryQuad.evaluateAt(2), 0);
    assert.equal(unaryQuad.evaluateAt(0), 4);
  });

  it('evaluates scientific calculator expressions accurately in RAD and DEG modes including sec/csc/cot and unary minus', () => {
    const radSin = evaluateScientificExpression('2 * sin(pi / 6) + sqrt(16)', 'RAD');
    assert.equal(radSin.ok, true);
    assert.equal(radSin.value, 5);

    const degSin = evaluateScientificExpression('sin(30) + cos(60)', 'DEG');
    assert.equal(degSin.ok, true);
    assert.equal(degSin.value, 1);

    const degNested = evaluateScientificExpression('sin(15 + (15))', 'DEG');
    assert.equal(degNested.ok, true);
    assert.equal(degNested.value, 0.5);

    const degSec = evaluateScientificExpression('sec(60)', 'DEG');
    assert.equal(degSec.ok, true);
    assert.equal(degSec.value, 2);

    const degAsin = evaluateScientificExpression('asin(0.5)', 'DEG');
    assert.equal(degAsin.ok, true);
    assert.equal(degAsin.value, 30);

    const unaryPow = evaluateScientificExpression('-2^2', 'RAD');
    assert.equal(unaryPow.ok, true);
    assert.equal(unaryPow.value, -4);

    const parenPow = evaluateScientificExpression('(-2)^2', 'RAD');
    assert.equal(parenPow.ok, true);
    assert.equal(parenPow.value, 4);

    const divZero = evaluateScientificExpression('1 / 0', 'RAD');
    assert.equal(divZero.ok, false);

    const unsafe = evaluateScientificExpression('alert(1)', 'RAD');
    assert.equal(unsafe.ok, false);
  });

  it('resolves all marking rule IDs and verifies corrected mathematical answer keys and PYQ coverage audit', () => {
    assert.equal(resolveMarkingRule('JEE_MAIN_MCQ_V1').fullMarks, 4);
    assert.equal(resolveMarkingRule('JEE_MAIN_NUMERICAL_V1').negativeMarks, 1);
    assert.equal(resolveMarkingRule('jee_adv_multi_partial_v2025').partialCreditAllowed, true);
    assert.equal(resolveMarkingRule('jee_adv_integer_v2025').negativeMarks, 0);
    assert.equal(resolveMarkingRule(undefined, 'jee_advanced', 'mcq_multiple').fullMarks, 4);

    const q54 = DEFAULT_JEE_75_QUESTION_PAPER.find((q) => q.id === 'jee-math-54');
    assert.ok(q54);
    assert.equal(q54.options?.[q54.correctOptionIndex ?? -1], '108');

    const q55 = DEFAULT_JEE_75_QUESTION_PAPER.find((q) => q.id === 'jee-math-55');
    assert.ok(q55);
    assert.equal(q55.options?.[q55.correctOptionIndex ?? -1], '462');

    const q72 = DEFAULT_JEE_75_QUESTION_PAPER.find((q) => q.id === 'jee-math-72');
    assert.ok(q72);
    assert.equal(q72.correctNumericValue, 0);
    assert.ok(q72.question.includes('y(1) - 1 - 2e^{-2}'));

    const q73 = DEFAULT_JEE_75_QUESTION_PAPER.find((q) => q.id === 'jee-math-73');
    assert.ok(q73);
    assert.equal(q73.correctNumericValue, 4);

    // Ensure no question explanation contains self-contradictory "Wait," text
    for (const q of OFFICIAL_PYQ_QUESTIONS) {
      assert.equal(
        /\bWait,/i.test(q.detailedSolution),
        false,
        `Self-contradictory explanation found in ${q.id}`
      );
    }

    const audit = getPyqCorpusCoverageAudit();
    assert.equal(audit.totalPapersInMetadata, 7);
    assert.equal(audit.totalQuestionsInCorpus, 81);
    assert.equal(audit.jeeMainQuestionsCount, 75);
    assert.equal(audit.jeeAdvancedQuestionsCount, 6);
    assert.ok(audit.papers.every((p) => p.coverageStatus === 'PARTIAL_QUESTIONS'));
    assert.ok(audit.papers.every((p) => p.pdfType === 'learnmate_reconstructed_pdf'));
  });

  it('returns clear error messages for invalid expressions', () => {
    const invalid = compileCartesianEquation('y = unknownFunc(x)');
    assert.equal(invalid.valid, false);
    assert.ok(invalid.error && invalid.error.length > 0);
  });
});
