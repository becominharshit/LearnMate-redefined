import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSIONED_EXAM_RULES,
  getExamRuleVersion,
  normalizeNumericalResponse,
  GLOBAL_EXAM_REGISTRY,
  listVerifiedGlobalExams,
  formatLocalizedCurrency,
  formatLocalizedDate,
  auditSyllabusIntegrity,
} from './examRegistry';
import {
  OFFICIAL_PYQ_PAPERS,
  getCorpusCollections,
  resolveCorpusQuestionById,
  scorePyqQuestionResponse,
  predictShiftPercentileAndAir,
  getPyqCorpusCoverageAudit,
} from './pyqCorpusEngine';
import { estimateJeePercentileWithMetadata } from './jeeQuestionBank';
import { unifiedToPyqCorpusQuestion } from '../ingestion';
import type { UnifiedQuestionRecord } from '../ingestion/types';

test('JEE Main 2027 Paper 1 rules enforce 75 compulsory questions, -1 negative on Section B, and nearest-integer rounding', () => {
  const rule2027 = getExamRuleVersion('jee-main-2027-p1-v1');
  assert.equal(rule2027.isCurrentOfficialPattern, true);
  assert.equal(rule2027.totalQuestions, 75);
  assert.equal(rule2027.compulsoryQuestions, 75);
  assert.equal(rule2027.totalMarks, 300);
  const secB = rule2027.sectionsPerSubject.find((s) => s.sectionId === 'B');
  assert.ok(secB);
  assert.equal(secB.compulsoryAttemptCount, 5);
  assert.equal(secB.negativeMarks, 1);
  assert.equal(secB.numericalRounding, 'nearest_integer');

  const archival2021 = getExamRuleVersion('jee-main-2021-v1');
  assert.equal(archival2021.totalQuestions, 90);
  assert.equal(archival2021.compulsoryQuestions, 75);
  assert.equal(archival2021.sectionsPerSubject.find((s) => s.sectionId === 'B')?.negativeMarks, 0);

  const archival2022_24 = getExamRuleVersion('jee-main-2022-2024-v1');
  assert.equal(archival2022_24.totalQuestions, 90);
  assert.equal(archival2022_24.compulsoryQuestions, 75);
  assert.equal(archival2022_24.sectionsPerSubject.find((s) => s.sectionId === 'B')?.negativeMarks, 1);

  const archival = VERSIONED_EXAM_RULES['jee-main-2021-2024-v1'];
  assert.equal(archival.totalQuestions, 90);
  assert.equal(archival.compulsoryQuestions, 75);
  assert.equal(archival.isCurrentOfficialPattern, false);

  const rounded = normalizeNumericalResponse('14.6', 'nearest_integer');
  assert.equal(rounded.valid, true);
  assert.equal(rounded.value, 15);
  assert.equal(rounded.roundedNearestInteger, 15);

  const dec = normalizeNumericalResponse('3.14159', 'decimal_2dp');
  assert.equal(dec.valid, true);
  assert.equal(dec.value, 3.14);
});

test('PYQ Corpus separates 5 collections honestly, removes fake shift assignment, and preserves legacy question IDs', () => {
  const collections = getCorpusCollections();
  assert.equal(collections.officialVerifiedPyqs.length, 0);
  assert.equal(collections.reconstructedPendingReview.length, 0);
  assert.ok(collections.originalEditorialPractice.length >= 84);
  assert.equal(collections.aiGeneratedPractice.length, 0);
  assert.equal(collections.rejectedOrRestricted.length, 0);

  for (const q of collections.originalEditorialPractice) {
    assert.equal(q.sourceCategory, 'ORIGINAL_EDITORIAL');
    assert.equal(q.verificationMetadata.isFakeShiftAssignment, false);
  }

  // Legacy ID compatibility
  const byLegacy = resolveCorpusQuestionById('pyq-main-jee-phy-01');
  const byRaw = resolveCorpusQuestionById('jee-phy-01');
  const byNew = resolveCorpusQuestionById('orig-main-jee-phy-01');
  assert.ok(byLegacy);
  assert.ok(byRaw);
  assert.ok(byNew);
  assert.equal(byLegacy.id, byNew.id);
  assert.equal(byRaw.id, byNew.id);

  // Historical shift slots remain honest empty catalogs pending verified import
  const historicalSlots = OFFICIAL_PYQ_PAPERS.filter((p) => p.isOfficialPastPaper);
  assert.equal(historicalSlots.length, 6);
  for (const slot of historicalSlots) {
    assert.equal(slot.publicationStatus, 'incomplete_pending_official_import');
    assert.equal(slot.questionIds.length, 0);
  }

  const audit = getPyqCorpusCoverageAudit();
  assert.equal(audit.officialVerifiedQuestionsCount, 0);
  assert.equal(audit.originalEditorialQuestionsCount, 84);
  assert.equal(audit.incompleteHistoricalPapersCount, 6);
});

test('Numerical integer grading applies nearest-integer normalization and reports exact maxMarks for dropped questions', () => {
  const numQ = resolveCorpusQuestionById('orig-main-jee-phy-21');
  assert.ok(numQ);
  const exactExpected = numQ.correctNumericalValue ?? numQ.numericalAnswer ?? 0;

  // Input within 0.4 of integer should round to nearest integer under JEE Main nearest_integer convention
  const res = scorePyqQuestionResponse(numQ, {
    numericalValue: exactExpected + 0.3,
  });
  assert.equal(res.status, 'correct');
  assert.equal(res.marksAwarded, 4);

  const droppedRes = scorePyqQuestionResponse(
    { ...numQ, keyStatus: 'dropped_bonus' },
    { numericalValue: null }
  );
  assert.equal(droppedRes.status, 'bonus_dropped');
  assert.equal(droppedRes.marksAwarded, droppedRes.maxMarks);
  assert.ok(droppedRes.explanationNote.includes(`(+${droppedRes.maxMarks})`));
});

test('Percentile & AIR predictors explicitly declare non-empirical heuristic status', () => {
  const pred = predictShiftPercentileAndAir(195, 300, 'Moderate');
  assert.equal(pred.isEmpiricalNtaData, false);
  assert.equal(pred.modelType, 'heuristic_piecewise_reference_curve');
  assert.ok(pred.limitationDisclaimer.toLowerCase().includes('not derived from an empirical official nta'));

  const metaEst = estimateJeePercentileWithMetadata(195);
  assert.equal(metaEst.isEmpiricalNtaData, false);
  assert.ok(metaEst.disclaimer.toLowerCase().includes('illustrative heuristic'));
});

test('Global multi-exam registry sets truthful isVerifiedCoverage flags, localization works, and 58-chapter syllabus audit passes', () => {
  assert.equal(GLOBAL_EXAM_REGISTRY.jee_main.isVerifiedCoverage, true);
  assert.equal(GLOBAL_EXAM_REGISTRY.jee_advanced.isVerifiedCoverage, true);
  assert.equal(GLOBAL_EXAM_REGISTRY.bitsat.isVerifiedCoverage, false);
  assert.equal(GLOBAL_EXAM_REGISTRY.viteee.isVerifiedCoverage, false);
  assert.equal(GLOBAL_EXAM_REGISTRY.neet_ug.isVerifiedCoverage, false);
  assert.equal(GLOBAL_EXAM_REGISTRY.sat_digital.isVerifiedCoverage, false);
  assert.equal(GLOBAL_EXAM_REGISTRY.ib_dp.isVerifiedCoverage, false);
  assert.equal(GLOBAL_EXAM_REGISTRY.a_levels.isVerifiedCoverage, false);

  const verified = listVerifiedGlobalExams();
  assert.deepEqual(
    verified.map((e) => e.examId).sort(),
    ['jee_advanced', 'jee_main']
  );

  assert.ok(formatLocalizedCurrency(299, 'INR', 'en-IN').includes('299'));
  assert.ok(formatLocalizedCurrency(19, 'USD', 'en-US').includes('$19'));
  assert.ok(formatLocalizedCurrency(15, 'GBP', 'en-GB').includes('£15'));
  assert.ok(formatLocalizedDate('2027-01-24T00:00:00Z', 'en-IN').includes('2027'));

  const syllabusAudit = auditSyllabusIntegrity();
  assert.equal(syllabusAudit.passed, true);
  assert.equal(syllabusAudit.totalChapters, 58);
  assert.equal(syllabusAudit.physicsCount, 20);
  assert.equal(syllabusAudit.chemistryCount, 20);
  assert.equal(syllabusAudit.mathematicsCount, 18);
});

test('unifiedToPyqCorpusQuestion classifies unverified ingestion honestly as OFFICIAL_RECONSTRUCTED_PENDING_REVIEW and verified official as OFFICIAL_VERIFIED', () => {
  const baseRecord: UnifiedQuestionRecord = {
    id: 'ing-q-1',
    exam: 'JEE_MAIN',
    year: 2025,
    session: 'JANUARY',
    shift: 1,
    subject: 'PHYSICS',
    chapter: 'ELECTROSTATICS',
    topic: 'GAUSS_LAW',
    difficulty: 'MEDIUM',
    questionType: 'MCQ_SINGLE',
    question: { text: 'Test electric flux question?', images: [], equations: [] },
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '2' },
      { id: 'C', text: '3' },
      { id: 'D', text: '4' },
    ],
    correctAnswer: ['A'],
    solution: { text: 'By Gauss Law...', type: 'PENDING', verified: false },
    metadata: {
      source: 'Community Upload',
      sourceUrl: 'https://example.com',
      license: 'CC-BY-4.0',
      provenanceVerified: false,
      importedAt: '2026-11-12T00:00:00.000Z',
    },
    status: 'PENDING_REVIEW',
  };

  const pending = unifiedToPyqCorpusQuestion(baseRecord, 1);
  assert.equal(pending.sourceCategory, 'OFFICIAL_RECONSTRUCTED_PENDING_REVIEW');
  assert.equal(pending.collectionKind, 'reconstructed_pyq');

  const official = unifiedToPyqCorpusQuestion(
    {
      ...baseRecord,
      solution: { text: 'Official solution', type: 'OFFICIAL', verified: true },
      metadata: { ...baseRecord.metadata, provenanceVerified: true },
      status: 'APPROVED',
    },
    1
  );
  assert.equal(official.sourceCategory, 'OFFICIAL_VERIFIED');
  assert.equal(official.collectionKind, 'official_pyq');
});
