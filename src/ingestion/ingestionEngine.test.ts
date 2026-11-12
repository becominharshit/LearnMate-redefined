import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTERNAL_DATASET_SOURCE_REGISTRY,
  EXAM_PATTERN_SPECIFICATIONS,
  VERIFIED_SAMPLE_JEE_CSV,
  VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
  VERIFIED_SAMPLE_LEARNOPT_JSONL,
  approveSolutionByExpert,
  computeNormalizedQuestionTextHash,
  computeQuestionSimilarity,
  detectDuplicateQuestion,
  generateIdReferencedMockBlueprint,
  normalizeQuestionRecord,
  parseCsvDataset,
  parseJsonDataset,
  parseJsonlDataset,
  parsePdfExtractedDataset,
  pyqCorpusToUnifiedQuestion,
  resolveQuestionsForMockBlueprint,
  runDatasetImportPipeline,
  unifiedToPyqCorpusQuestion,
  updateQuestionSolution,
  validateDatasetSourceLicense,
  validateLatexMathFormatting,
  validateQuestionRecord,
  type UnifiedQuestionRecord,
  type SourceToLearnMateIdMapEntry,
} from './index';
import { OFFICIAL_PYQ_QUESTIONS } from '../utils/pyqCorpusEngine';

describe('Open-Source PYQ Dataset & Question Bank Integration Engine', () => {
  it('1. Audits external dataset sources and separates software licenses from content rights', () => {
    const jeeMocksDb = EXTERNAL_DATASET_SOURCE_REGISTRY.jee_mocks_db;
    assert.equal(jeeMocksDb.clearanceStatus, 'APPROVED_FOR_IMPORT');
    assert.equal(jeeMocksDb.commercialRedistributionPermitted, true);

    const learnOpt = EXTERNAL_DATASET_SOURCE_REGISTRY.learnopt;
    assert.equal(learnOpt.clearanceStatus, 'APPROVED_FOR_IMPORT');
    assert.equal(learnOpt.commercialRedistributionPermitted, true);

    const qpe = EXTERNAL_DATASET_SOURCE_REGISTRY.qpe;
    assert.equal(
      qpe.clearanceStatus,
      'APPROVED_METADATA_AND_PUBLIC_EXAM_STEMS_ONLY'
    );
    assert.equal(qpe.commercialRedistributionPermitted, true);

    // HostServer001/jee_mains_pyqs_data_base has no open license and contains reverse-engineered API solutions
    const rejectedSource = EXTERNAL_DATASET_SOURCE_REGISTRY.jee_main_pyq;
    assert.equal(
      rejectedSource.clearanceStatus,
      'REJECTED_UNCLEAR_PROPRIETARY_RIGHTS'
    );
    assert.equal(rejectedSource.commercialRedistributionPermitted, false);

    const gateCheck = validateDatasetSourceLicense('jee_main_pyq');
    assert.equal(gateCheck.allowed, false);
    assert.match(gateCheck.reason, /REJECTED/i);
  });

  it('2. Parses JSON, JSONL, RFC-4180 CSV, and QPE PDF-extracted text formats accurately', () => {
    const jsonRecords = parseJsonDataset(VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON);
    assert.equal(jsonRecords.length, 3);
    assert.equal(jsonRecords[0].exam, 'JEE_MAIN');
    assert.equal(jsonRecords[1].questionType, 'ASSERTION_REASON');
    assert.equal(jsonRecords[2].questionType, 'INTEGER');

    const jsonlRecords = parseJsonlDataset(VERIFIED_SAMPLE_LEARNOPT_JSONL);
    assert.equal(jsonlRecords.length, 3);
    assert.equal(jsonlRecords[0].exam, 'JEE_ADVANCED');
    assert.equal(jsonlRecords[1].exam, 'JEE_ADVANCED');
    assert.equal(jsonlRecords[1].subject, 'CHEMISTRY');
    assert.equal(jsonlRecords[2].subject, 'MATHEMATICS');

    const csvRecords = parseCsvDataset(VERIFIED_SAMPLE_JEE_CSV);
    assert.equal(csvRecords.length, 3);
    assert.equal(csvRecords[0].exam, 'JEE_MAIN');
    assert.equal(csvRecords[0].subject, 'PHYSICS');
    assert.deepEqual(csvRecords[0].correctAnswer, ['D']);

    const pdfSample = [
      'Q1. [JEE_MAIN | 2025 | PHYSICS | KINEMATICS]',
      'A particle starts from rest with acceleration $a = 4\\text{ m/s}^2$. Find distance in $3\\text{ s}$.',
      '(A) $12\\text{ m}$',
      '(B) $18\\text{ m}$',
      '(C) $24\\text{ m}$',
      '(D) $36\\text{ m}$',
      'Answer: B',
      'Solution: $s = \\frac{1}{2}at^2 = \\frac{1}{2}(4)(9) = 18\\text{ m}$.',
    ].join('\n');
    const pdfRecords = parsePdfExtractedDataset(pdfSample);
    assert.equal(pdfRecords.length, 1);
    assert.equal(pdfRecords[0].exam, 'JEE_MAIN');
    assert.deepEqual(pdfRecords[0].correctAnswer, ['B']);
  });

  it('3. Normalizes questions into the Unified Question Schema with inline equation extraction', () => {
    const raw = parseJsonDataset(VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON)[0];
    const normalized = normalizeQuestionRecord(raw, 'jee_mocks_db', 1);

    assert.equal(normalized.exam, 'JEE_MAIN');
    assert.equal(normalized.year, 2025);
    assert.equal(normalized.subject, 'PHYSICS');
    assert.equal(normalized.chapter, 'ROTATIONAL_MOTION');
    assert.equal(normalized.topic, 'ANGULAR_MOMENTUM');
    assert.equal(normalized.questionType, 'MCQ_SINGLE');
    assert.equal(normalized.options.length, 4);
    assert.deepEqual(normalized.correctAnswer, ['B']);
    assert.equal(normalized.solution.type, 'OFFICIAL');
    assert.equal(normalized.solution.verified, true);
    assert.equal(normalized.status, 'APPROVED');
    assert.ok(normalized.question.equations.length >= 2);
  });

  it('4. Detects malformed question records, invalid answer keys, broken images, and invalid LaTeX math', () => {
    // 4a. Missing question text + fewer than 4 options + invalid answer reference
    const malformed = normalizeQuestionRecord(
      {
        externalId: 'BAD-1',
        exam: 'JEE_MAIN',
        year: 2025,
        subject: 'PHYSICS',
        questionType: 'MCQ_SINGLE',
        questionText: 'Short',
        options: [{ id: 'A', text: 'Only one option' }],
        correctAnswer: ['Z'],
        provenanceVerified: true,
      },
      'jee_mocks_db',
      1
    );
    const val1 = validateQuestionRecord(malformed);
    assert.equal(val1.isValid, false);
    assert.equal(val1.recommendedStatus, 'FAILED_VALIDATION');
    const codes1 = val1.issues.map((i) => i.code);
    assert.ok(codes1.includes('MISSING_QUESTION_TEXT'));
    assert.ok(codes1.includes('MALFORMED_OPTIONS'));
    assert.ok(codes1.includes('INVALID_CORRECT_ANSWER_REF'));

    // 4b. Invalid subject for exam (ASTRONOMY in JEE_MAIN)
    const wrongSubject = normalizeQuestionRecord(
      {
        externalId: 'BAD-SUBJ',
        exam: 'JEE_MAIN',
        year: 2025,
        subject: 'ASTRONOMY',
        questionType: 'MCQ_SINGLE',
        questionText: 'Which spectral classification corresponds to the hottest main-sequence stars?',
        optionA: 'Class O',
        optionB: 'Class G',
        optionC: 'Class M',
        optionD: 'Class K',
        correctAnswer: ['A'],
        provenanceVerified: true,
      },
      'jee_mocks_db',
      2
    );
    const val2 = validateQuestionRecord(wrongSubject);
    assert.equal(val2.isValid, false);
    assert.ok(val2.issues.some((i) => i.code === 'INVALID_EXAM_OR_SUBJECT'));

    // 4c. Non-integer answer on INTEGER question + unbalanced LaTeX + broken image
    const badMathAndInt = normalizeQuestionRecord(
      {
        externalId: 'BAD-MATH-INT',
        exam: 'JEE_ADVANCED',
        year: 2024,
        subject: 'MATHEMATICS',
        questionType: 'INTEGER',
        questionText:
          'Evaluate the integral $\\int_0^1 x^2 dx + \\left( x + 1$ with broken delimiter.',
        images: ['file:///C:/Users/local/image.png'],
        correctAnswer: ['3.1415'],
        provenanceVerified: true,
      },
      'learnopt',
      3
    );
    const val3 = validateQuestionRecord(badMathAndInt);
    assert.equal(val3.isValid, false);
    const codes3 = val3.issues.map((i) => i.code);
    assert.ok(codes3.includes('INVALID_CORRECT_ANSWER_REF'));
    assert.ok(codes3.includes('BROKEN_IMAGE_REFERENCE'));
    assert.ok(codes3.includes('INVALID_MATH_LATEX'));

    assert.ok(validateLatexMathFormatting('$x^2 + y^2 = r^2$') === null);
    assert.ok(validateLatexMathFormatting('$x^2 + y^2') !== null);
  });

  it('5. Flags incomplete solutions as PENDING_REVIEW without failing valid stems', () => {
    const noSol = normalizeQuestionRecord(
      {
        externalId: 'PENDING-SOL-1',
        exam: 'JEE_MAIN',
        year: 2025,
        subject: 'CHEMISTRY',
        questionType: 'MCQ_SINGLE',
        questionText:
          'Which of the following oxoacids of phosphorus is a monoprotic (monobasic) acid in aqueous solution?',
        optionA: '$H_3PO_4$',
        optionB: '$H_3PO_3$',
        optionC: '$H_3PO_2$',
        optionD: '$H_4P_2O_7$',
        correctAnswer: ['C'],
        solutionText: '',
        solutionType: 'PENDING',
        provenanceVerified: true,
      },
      'jee_mocks_db',
      1
    );

    const val = validateQuestionRecord(noSol);
    assert.equal(val.isValid, true);
    assert.equal(val.canApproveDirectly, false);
    assert.equal(val.recommendedStatus, 'PENDING_REVIEW');
    assert.ok(val.issues.some((i) => i.code === 'MISSING_SOLUTION' && i.severity === 'WARNING'));
  });

  it('6. Performs 3-stage duplicate detection (Exact Hash, Composite Key, and Near-Duplicate Similarity without auto-merging)', () => {
    const baseQ = normalizeQuestionRecord(
      parseJsonDataset(VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON)[0],
      'jee_mocks_db',
      1
    );

    // Stage 1: Exact normalized hash duplicate
    const exactCopy = {
      ...baseQ,
      id: 'lm-q-duplicate-copy',
    };
    const exactMatch = detectDuplicateQuestion(exactCopy, [baseQ]);
    assert.ok(exactMatch);
    assert.equal(exactMatch.matchType, 'EXACT_HASH');
    assert.equal(exactMatch.resolutionStatus, 'SKIPPED_EXACT');

    // Stage 3: Near-duplicate (same physical setup, different numerical values)
    const nearDup = normalizeQuestionRecord(
      {
        externalId: 'NEAR-DUP-ROT-1',
        exam: 'JEE_MAIN',
        year: 2024,
        session: 'APRIL',
        shift: 2,
        subject: 'PHYSICS',
        chapter: 'ROTATIONAL_MOTION',
        topic: 'ANGULAR_MOMENTUM',
        questionType: 'MCQ_SINGLE',
        questionText:
          'A thin uniform circular disc of mass $M = 4\\text{ kg}$ and radius $R = 0.5\\text{ m}$ is rotating freely about a vertical axis passing through its center and perpendicular to its plane with angular velocity $\\omega_0 = 18\\text{ rad/s}$. A point mass $m = 1.0\\text{ kg}$ is gently placed at the rim of the disc. What is the final angular velocity $\\omega$ of the system?',
        optionA: '$6\\text{ rad/s}$',
        optionB: '$12\\text{ rad/s}$',
        optionC: '$9\\text{ rad/s}$',
        optionD: '$15\\text{ rad/s}$',
        correctAnswer: ['B'],
        officialSolution: 'By conservation of angular momentum...',
        solutionType: 'OFFICIAL',
        provenanceVerified: true,
      },
      'jee_mocks_db',
      2
    );

    const simScore = computeQuestionSimilarity(
      baseQ.question.text,
      nearDup.question.text
    );
    assert.ok(simScore >= 0.68 && simScore < 1.0);

    const nearMatch = detectDuplicateQuestion(nearDup, [baseQ]);
    assert.ok(nearMatch);
    assert.equal(nearMatch.matchType, 'NEAR_DUPLICATE_SIMILARITY');
    assert.equal(nearMatch.requiresHumanReview, true);
    assert.equal(nearMatch.resolutionStatus, 'FLAGGED_FOR_HUMAN_REVIEW');
  });

  it('7. Enforces Solutions Engine safety rules: never overwrite OFFICIAL with AI_GENERATED and never mark AI_GENERATED as verified', () => {
    const officialQ = normalizeQuestionRecord(
      parseJsonDataset(VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON)[0],
      'jee_mocks_db',
      1
    );
    assert.equal(officialQ.solution.type, 'OFFICIAL');
    assert.equal(officialQ.solution.verified, true);

    // Attempting to overwrite OFFICIAL with AI_GENERATED must throw
    assert.throws(() => {
      updateQuestionSolution(officialQ, {
        newText: 'AI generated replacement text',
        targetType: 'AI_GENERATED',
        actorId: 'ai-bot',
      });
    }, /Refused to overwrite OFFICIAL solution/);

    // Creating an AI_GENERATED solution on a PENDING question must set verified: false and status: PENDING_REVIEW
    const pendingQ = normalizeQuestionRecord(
      {
        externalId: 'SOL-TEST-1',
        exam: 'JEE_MAIN',
        year: 2024,
        subject: 'CHEMISTRY',
        questionType: 'MCQ_SINGLE',
        questionText:
          'Which of the following coordination complexes exhibits geometrical (cis-trans) isomerism?',
        optionA: '$[\\text{Pt}(\\text{NH}_3)_2\\text{Cl}_2]$',
        optionB: '$[\\text{Ni}(\\text{CO})_4]$',
        optionC: '$[\\text{Co}(\\text{NH}_3)_6]^{3+}$',
        optionD: '$[\\text{Zn}(\\text{NH}_3)_4]^{2+}$',
        correctAnswer: ['A'],
        solutionText: '',
        solutionType: 'PENDING',
        provenanceVerified: true,
      },
      'jee_mocks_db',
      1
    );

    const withAiDraft = updateQuestionSolution(pendingQ, {
      newText: 'Square planar $[\\text{Pt}(\\text{NH}_3)_2\\text{Cl}_2]$ exhibits cis (platin) and trans isomers.',
      targetType: 'AI_GENERATED',
      actorId: 'learnmate-ai-tutor',
    });
    assert.equal(withAiDraft.solution.type, 'AI_GENERATED');
    assert.equal(withAiDraft.solution.verified, false);
    assert.equal(withAiDraft.status, 'PENDING_REVIEW');

    // Expert approval promotes to VERIFIED (verified: true) and status: APPROVED
    const expertApproved = approveSolutionByExpert(withAiDraft, {
      reviewerEmailOrUid: 'harshitkumar7407@gmail.com',
      reviewNote: 'Verified against NCERT Class 12 Chemistry Chapter 9.',
    });
    assert.equal(expertApproved.solution.type, 'VERIFIED');
    assert.equal(expertApproved.solution.verified, true);
    assert.equal(expertApproved.status, 'APPROVED');
    assert.ok((expertApproved.solution.revisionHistory?.length ?? 0) >= 3);
  });

  it('8. Supports dry-run, resumable checkpoints, incremental updates, and blocks unlicensed sources', async () => {
    let corpus: UnifiedQuestionRecord[] = [];
    let idMap: Record<string, SourceToLearnMateIdMapEntry> = {};

    // 8a. Rejects unlicensed source (jee_main_pyq)
    const rejectedRun = await runDatasetImportPipeline({
      sourceId: 'jee_main_pyq',
      format: 'JSON',
      rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
      dryRun: false,
      existingCorpusOverride: corpus,
      idMapOverride: idMap,
      persistToStorage: false,
    });
    assert.equal(rejectedRun.report.checkpoint.status, 'REJECTED_BY_LICENSE');
    assert.equal(rejectedRun.resultingCorpus.length, 0);

    // 8b. Dry-run does not mutate corpus
    const dryRunRes = await runDatasetImportPipeline({
      sourceId: 'jee_mocks_db',
      format: 'JSON',
      rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
      dryRun: true,
      existingCorpusOverride: corpus,
      idMapOverride: idMap,
      persistToStorage: false,
    });
    assert.equal(dryRunRes.report.importedApprovedCount, 3);
    assert.equal(dryRunRes.resultingCorpus.length, 0);

    // 8c. Partial import with checkpoint (process first 2 of 3 records)
    const part1 = await runDatasetImportPipeline({
      sourceId: 'jee_mocks_db',
      format: 'JSON',
      rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
      dryRun: false,
      jobId: 'resumable-job-1',
      startIndex: 0,
      maxRecordsToProcess: 2,
      existingCorpusOverride: corpus,
      idMapOverride: idMap,
      persistToStorage: false,
    });
    assert.equal(part1.report.checkpoint.status, 'PAUSED_INTERRUPTED');
    assert.equal(part1.report.checkpoint.lastProcessedIndex, 1);
    assert.equal(part1.resultingCorpus.length, 2);

    corpus = part1.resultingCorpus;
    idMap = part1.resultingIdMap;

    // 8d. Resume from lastProcessedIndex + 1 (index 2)
    const part2 = await runDatasetImportPipeline({
      sourceId: 'jee_mocks_db',
      format: 'JSON',
      rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
      dryRun: false,
      jobId: 'resumable-job-1',
      startIndex: part1.report.checkpoint.lastProcessedIndex + 1,
      existingCorpusOverride: corpus,
      idMapOverride: idMap,
      persistToStorage: false,
    });
    assert.equal(part2.report.checkpoint.status, 'COMPLETED');
    assert.equal(part2.resultingCorpus.length, 3);

    corpus = part2.resultingCorpus;
    idMap = part2.resultingIdMap;

    // 8e. Re-running same dataset performs idempotent incremental update via sourceIdMap without creating duplicates
    const incrementalRes = await runDatasetImportPipeline({
      sourceId: 'jee_mocks_db',
      format: 'JSON',
      rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
      dryRun: false,
      existingCorpusOverride: corpus,
      idMapOverride: idMap,
      persistToStorage: false,
    });
    assert.equal(incrementalRes.report.updatedIncrementalCount, 3);
    assert.equal(incrementalRes.resultingCorpus.length, 3);
  });

  it('9. Generates ID-referenced Mock Blueprints for JEE Main and JEE Advanced and converts losslessly to CBT questions', async () => {
    let corpus: UnifiedQuestionRecord[] = [];
    let idMap: Record<string, SourceToLearnMateIdMapEntry> = {};

    for (const job of [
      {
        sourceId: 'jee_mocks_db' as const,
        format: 'JSON' as const,
        rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
      },
      {
        sourceId: 'learnopt' as const,
        format: 'JSONL' as const,
        rawContent: VERIFIED_SAMPLE_LEARNOPT_JSONL,
      },
      {
        sourceId: 'jee_mocks_db' as const,
        format: 'CSV' as const,
        rawContent: VERIFIED_SAMPLE_JEE_CSV,
      },
    ]) {
      const res = await runDatasetImportPipeline({
        ...job,
        dryRun: false,
        existingCorpusOverride: corpus,
        idMapOverride: idMap,
        persistToStorage: false,
      });
      corpus = res.resultingCorpus;
      idMap = res.resultingIdMap;
    }

    assert.equal(corpus.length, 9);

    // Generate JEE Advanced ID-referenced mock blueprint
    const advBlueprint = generateIdReferencedMockBlueprint({
      exam: 'JEE_ADVANCED',
      generationMode: 'FULL_LENGTH',
      availableQuestions: corpus,
    });
    assert.equal(advBlueprint.exam, 'JEE_ADVANCED');
    assert.equal(advBlueprint.patternId, 'JEE_ADVANCED_P1');
    assert.equal(advBlueprint.questionIds.length, 3);
    assert.equal(
      EXAM_PATTERN_SPECIFICATIONS.JEE_ADVANCED_P1.markingRules.correctMarks,
      4
    );
    assert.equal(
      EXAM_PATTERN_SPECIFICATIONS.JEE_ADVANCED_P1.markingRules.negativeMarks,
      2
    );

    const resolvedAdv = resolveQuestionsForMockBlueprint(advBlueprint, corpus);
    assert.equal(resolvedAdv.length, 3);

    // Convert between UnifiedQuestionRecord and PyqCorpusQuestion
    const cbtReady = unifiedToPyqCorpusQuestion(resolvedAdv[0], 1);
    assert.ok(cbtReady.id);
    assert.ok(cbtReady.stem.length > 10);

    const roundTrip = pyqCorpusToUnifiedQuestion(OFFICIAL_PYQ_QUESTIONS[0]);
    assert.equal(roundTrip.exam, 'JEE_MAIN');
    assert.equal(roundTrip.status, 'APPROVED');
    assert.ok(computeNormalizedQuestionTextHash(roundTrip.question.text).startsWith('qhash-'));
  });
});
