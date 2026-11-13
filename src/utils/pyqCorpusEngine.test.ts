import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_PYQ_PAPERS,
  OFFICIAL_PYQ_QUESTIONS,
  getCorpusCollections,
  resolveCorpusQuestionById,
  migrateLegacyAttemptQuestionIds,
  scoreCbtSubmissionBatch,
  type PyqCorpusQuestion,
} from './pyqCorpusEngine';
import { getExamRuleVersion } from './examRegistry';

test('PYQ corpus contains zero synthetic historical shift assignments and exposes explicit rights metadata', () => {
  for (const q of OFFICIAL_PYQ_QUESTIONS) {
    assert.equal(q.verificationMetadata.isFakeShiftAssignment, false);
    assert.equal(q.sourceCategory, 'ORIGINAL_EDITORIAL');
    assert.ok(q.verificationMetadata.rightsStatus, `Question ${q.id} missing rightsStatus`);
    assert.ok(
      q.verificationMetadata.sourceVerificationUrl,
      `Question ${q.id} missing sourceVerificationUrl`
    );
  }

  const historicalPapers = OFFICIAL_PYQ_PAPERS.filter((p) => p.isOfficialPastPaper);
  assert.equal(historicalPapers.length, 6);
  for (const p of historicalPapers) {
    assert.equal(p.publicationStatus, 'incomplete_pending_official_import');
    assert.equal(p.questionIds.length, 0);
  }

  const collections = getCorpusCollections();
  assert.equal(collections.officialVerifiedPyqs.length, 0);
  assert.ok(collections.originalEditorialPractice.length >= 84);
});

test('migrateLegacyAttemptQuestionIds preserves old saved attempts across provenance ID cleanup', () => {
  const legacyAttempts = [
    { id: 'att-1', questionId: 'pyq-main-jee-phy-01', score: 4 },
    { id: 'att-2', questionId: 'jee-phy-02', score: -1 },
    { id: 'att-3', questionId: 'adv-2024-p1-math-1', score: 3 },
  ];

  const migrated = migrateLegacyAttemptQuestionIds(legacyAttempts);
  assert.equal(migrated[0].questionId, 'orig-main-jee-phy-01');
  assert.equal(migrated[0].migratedFromLegacyId, 'pyq-main-jee-phy-01');
  assert.equal(migrated[1].questionId, 'orig-main-jee-phy-02');
  assert.equal(migrated[1].migratedFromLegacyId, 'jee-phy-02');
  assert.equal(migrated[2].questionId, 'orig-adv-math-1');
  assert.equal(migrated[2].migratedFromLegacyId, 'adv-2024-p1-math-1');

  // Re-running migration is idempotent
  const migratedTwice = migrateLegacyAttemptQuestionIds(migrated);
  assert.deepEqual(migratedTwice, migrated);
});

test('Versioned CBT scoring distinguishes 2021 (0 Sec B penalty) vs 2022-2024 (-1 Sec B penalty) and enforces archival 5-attempt cap', () => {
  const rule2021 = getExamRuleVersion('jee-main-2021-v1');
  const rule2022_24 = getExamRuleVersion('jee-main-2022-2024-v1');
  assert.equal(rule2021.sectionsPerSubject.find((s) => s.sectionId === 'B')?.negativeMarks, 0);
  assert.equal(rule2022_24.sectionsPerSubject.find((s) => s.sectionId === 'B')?.negativeMarks, 1);

  const templateNum = resolveCorpusQuestionById('orig-main-jee-phy-22');
  assert.ok(templateNum);

  // Build 10 archival Section B numericals for Physics (attempt 7, exceed limit of 5)
  const tenSecBQuestions: PyqCorpusQuestion[] = Array.from({ length: 10 }, (_, idx) => ({
    ...templateNum,
    id: `archival-phy-num-${idx + 1}`,
    section: 'B',
    format: 'numerical_integer',
    numericalAnswer: 100 + idx,
    correctNumericalValue: 100 + idx,
    numericalTolerance: 0,
  }));

  // Student gets Q1..Q5 wrong (or mixed), Q6..Q7 right -> Q6..Q7 must be ignored under 5-attempt cap!
  const responses = [
    { questionId: 'archival-phy-num-1', numericalValue: 999 }, // wrong (1st attempt)
    { questionId: 'archival-phy-num-2', numericalValue: 999 }, // wrong (2nd attempt)
    { questionId: 'archival-phy-num-3', numericalValue: 102 }, // right (+4, 3rd attempt)
    { questionId: 'archival-phy-num-4', numericalValue: 103 }, // right (+4, 4th attempt)
    { questionId: 'archival-phy-num-5', numericalValue: 999 }, // wrong (5th attempt)
    { questionId: 'archival-phy-num-6', numericalValue: 105 }, // WOULD be right (+4), ignored overflow!
    { questionId: 'archival-phy-num-7', numericalValue: 106 }, // WOULD be right (+4), ignored overflow!
  ];

  // Under 2021 rule: 2 right (+8), 3 wrong (0 penalty) = 8 out of 20
  const batch2021 = scoreCbtSubmissionBatch(tenSecBQuestions, responses, {
    ruleVersionId: 'jee-main-2021-v1',
  });
  assert.equal(batch2021.totalMarks, 8);
  assert.equal(batch2021.maxMarks, 20);
  assert.deepEqual(batch2021.ignoredOverflowQuestionIds, [
    'archival-phy-num-6',
    'archival-phy-num-7',
  ]);

  // Under 2022-2024 rule: 2 right (+8), 3 wrong (-3) = 5 out of 20
  const batch2024 = scoreCbtSubmissionBatch(tenSecBQuestions, responses, {
    ruleVersionId: 'jee-main-2022-2024-v1',
  });
  assert.equal(batch2024.totalMarks, 5);
  assert.equal(batch2024.maxMarks, 20);
  assert.deepEqual(batch2024.ignoredOverflowQuestionIds, [
    'archival-phy-num-6',
    'archival-phy-num-7',
  ]);
});
