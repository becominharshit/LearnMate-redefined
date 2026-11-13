/**
 * Question Bank Integration Engine — Barrel Export & Legacy Corpus Adapters
 */

export * from './types';
export * from './sources/sourceRegistry';
export * from './parsers';
export * from './normalizers';
export * from './validators';
export * from './solutionsEngine';
export * from './firestoreImporter';

import type {
  UnifiedDifficulty,
  UnifiedExamId,
  UnifiedQuestionRecord,
  UnifiedSubjectId,
} from './types';
import {
  MARKING_RULES,
  type PyqCorpusQuestion,
} from '../utils/pyqCorpusEngine';
import type { JeeSubject } from '../utils/jeeSubjects';
import type { ExamTrackId } from '../data/jeeSyllabusAndNotes';

/**
 * Converts a UnifiedQuestionRecord into a PyqCorpusQuestion so existing CBT and PYQ solvers
 * can render and grade imported questions (JEE Main and JEE Advanced).
 */
export function unifiedToPyqCorpusQuestion(
  record: UnifiedQuestionRecord,
  questionNumber = 1
): PyqCorpusQuestion {
  const examTrack: ExamTrackId =
    record.exam === 'JEE_ADVANCED' ? 'jee_advanced' : 'jee_main';

  const legacySubject: JeeSubject =
    record.subject === 'PHYSICS'
      ? 'Physics'
      : record.subject === 'CHEMISTRY'
      ? 'Chemistry'
      : 'Mathematics';

  const isMulti = record.questionType === 'MCQ_MULTI';
  const isNumerical =
    record.questionType === 'NUMERICAL' ||
    record.questionType === 'INTEGER' ||
    record.questionType === 'DECIMAL';

  const format: PyqCorpusQuestion['format'] = isMulti
    ? 'multiple_mcq'
    : isNumerical
    ? record.questionType === 'INTEGER'
      ? 'numerical_integer'
      : 'numerical_decimal'
    : 'single_mcq';

  const questionType: PyqCorpusQuestion['questionType'] = isMulti
    ? 'mcq_multiple'
    : isNumerical
    ? 'numerical'
    : 'mcq_single';

  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  const correctOptionIndices = !isNumerical
    ? record.correctAnswer
        .map((ans) => letterToIndex[ans.toUpperCase()] ?? Number(ans))
        .filter((n) => Number.isInteger(n) && n >= 0)
    : undefined;

  const numVal = isNumerical
    ? record.numericalBounds?.exactValue ?? Number(record.correctAnswer[0] ?? 0)
    : undefined;

  const rule =
    record.exam === 'JEE_ADVANCED'
      ? isMulti
        ? MARKING_RULES.jee_adv_multi
        : isNumerical
        ? MARKING_RULES.jee_adv_integer
        : MARKING_RULES.jee_adv_single
      : isNumerical
      ? MARKING_RULES.jee_main_numerical
      : MARKING_RULES.jee_main_mcq;

  const prettyChapter = record.chapter
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const prettyTopic = record.topic
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const examBadge =
    record.exam === 'JEE_ADVANCED'
      ? `JEE Advanced ${record.year} · ${record.session}`
      : `JEE Main ${record.year} · ${record.session} · Shift ${record.shift}`;

  const diffCap: 'Easy' | 'Medium' | 'Hard' =
    record.difficulty === 'EASY'
      ? 'Easy'
      : record.difficulty === 'HARD'
      ? 'Hard'
      : 'Medium';

  const isOfficialVerified =
    Boolean(record.metadata.provenanceVerified) &&
    (record.solution.type === 'OFFICIAL' || record.solution.type === 'VERIFIED');

  const sourceCategory: PyqCorpusQuestion['sourceCategory'] = isOfficialVerified
    ? 'OFFICIAL_VERIFIED'
    : 'OFFICIAL_RECONSTRUCTED_PENDING_REVIEW';

  const collectionKind: PyqCorpusQuestion['collectionKind'] = isOfficialVerified
    ? 'official_pyq'
    : 'reconstructed_pyq';

  const solutionOrigin: PyqCorpusQuestion['solutionOrigin'] = isOfficialVerified
    ? 'LearnMate Reviewed Editorial Solution (Verified against Official Final Answer Key)'
    : 'LearnMate Reconstructed Editorial Solution (Pending Official Archive Audit)';

  return {
    id: record.id,
    canonicalHash: record.metadata.canonicalHash || `qhash-${record.id}`,
    paperId: `imported-${record.exam.toLowerCase()}-${record.year}`,
    exam: examTrack,
    year: record.year,
    session: record.session,
    examDate: `${record.year}-01-25`,
    shift: `Shift ${record.shift}`,
    shiftLabel: examBadge,
    paperNumber: 1,
    subject: legacySubject,
    section: isNumerical ? 'B' : 'A',
    chapterId: `ch-${record.subject.toLowerCase()}-${record.chapter.toLowerCase()}`,
    chapterName: prettyChapter,
    chapterTitle: prettyChapter,
    topicName: prettyTopic,
    format,
    questionType,
    questionNumber,
    officialQuestionId: record.metadata.externalId || record.id.toUpperCase(),
    sourceCategory,
    collectionKind,
    verificationMetadata: {
      provenanceVerified: isOfficialVerified,
      verificationConfidence: isOfficialVerified ? 0.95 : 0.6,
      reviewerStatus: isOfficialVerified ? 'verified_official' : 'pending_review',
      officialExamId: record.exam,
      officialYear: record.year,
      officialSession: record.session,
      officialShift: `Shift ${record.shift}`,
      solutionSource: record.metadata.source || 'External PYQ Ingestion',
      licenseStatus: isOfficialVerified ? 'PUBLIC_EXAM_RECORD' : 'UNVERIFIED',
      isFakeShiftAssignment: false,
    },
    prompt: record.question.text,
    stem: record.question.text,
    options: record.options.map((o) => o.text),
    correctOptionIndices,
    numericalAnswer: numVal,
    correctNumericalValue: numVal,
    numericalTolerance: record.numericalBounds?.tolerance ?? 0,
    keyStatus: 'normal',
    markingRule: rule,
    markingRuleId: rule.id,
    answerKeyVersion: record.metadata.answerKeyVersion || 'final-key-v1.0',
    solutionOrigin,
    detailedSolution:
      record.solution.text || 'Solution pending expert verification.',
    solutionExplanation:
      record.solution.text || 'Solution pending expert verification.',
    keyFormula: record.solution.keyFormula || prettyTopic,
    commonMistakeTrap:
      record.solution.commonTrap || `Verify units and sign conventions in ${prettyTopic}.`,
    commonTrap:
      record.solution.commonTrap || `Verify units and sign conventions in ${prettyTopic}.`,
    difficulty: diffCap,
    sourceProvenance: `${record.metadata.source} (${record.metadata.license})`,
    versionHistory: (record.solution.revisionHistory || []).map((r) => ({
      version: `${r.version}.0`,
      date: r.updatedAt.slice(0, 10),
      note: r.note,
    })),
  };
}

/**
 * Converts an existing LearnMate PyqCorpusQuestion into a UnifiedQuestionRecord.
 */
export function pyqCorpusToUnifiedQuestion(
  corpusQ: PyqCorpusQuestion
): UnifiedQuestionRecord {
  const exam: UnifiedExamId =
    corpusQ.exam === 'jee_advanced' ? 'JEE_ADVANCED' : 'JEE_MAIN';
  const subject: UnifiedSubjectId =
    corpusQ.subject === 'Physics'
      ? 'PHYSICS'
      : corpusQ.subject === 'Chemistry'
      ? 'CHEMISTRY'
      : 'MATHEMATICS';
  const difficulty: UnifiedDifficulty =
    corpusQ.difficulty === 'Easy'
      ? 'EASY'
      : corpusQ.difficulty === 'Hard'
      ? 'HARD'
      : 'MEDIUM';

  const isMulti = corpusQ.questionType === 'mcq_multiple';
  const isNumerical = corpusQ.questionType === 'numerical';
  const questionType: UnifiedQuestionRecord['questionType'] = isMulti
    ? 'MCQ_MULTI'
    : isNumerical
    ? corpusQ.format === 'numerical_integer'
      ? 'INTEGER'
      : 'NUMERICAL'
    : 'MCQ_SINGLE';

  const letters = ['A', 'B', 'C', 'D'];
  const options = (corpusQ.options || []).map((text, idx) => ({
    id: letters[idx] || String(idx + 1),
    text,
  }));

  const correctAnswer = isNumerical
    ? [String(corpusQ.correctNumericalValue ?? corpusQ.numericalAnswer ?? 0)]
    : (corpusQ.correctOptionIndices || [0]).map((idx) => letters[idx] || String(idx + 1));

  return {
    id: corpusQ.id,
    exam,
    year: corpusQ.year,
    session: corpusQ.session.toUpperCase(),
    shift: corpusQ.shift.includes('2') ? 2 : 1,
    subject,
    chapter: corpusQ.chapterName.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
    topic: corpusQ.topicName.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
    difficulty,
    questionType,
    question: {
      text: corpusQ.stem || corpusQ.prompt,
      images: [],
      equations: corpusQ.keyFormula ? [corpusQ.keyFormula] : [],
    },
    options,
    correctAnswer,
    ...(isNumerical
      ? {
          numericalBounds: {
            exactValue: Number(correctAnswer[0]),
            tolerance: corpusQ.numericalTolerance ?? 0,
            isIntegerOnly: corpusQ.format === 'numerical_integer',
          },
        }
      : {}),
    solution: {
      text: corpusQ.solutionExplanation || corpusQ.detailedSolution,
      type: 'OFFICIAL',
      verified: true,
      keyFormula: corpusQ.keyFormula,
      commonTrap: corpusQ.commonTrap,
      revisionHistory: [
        {
          version: 1,
          updatedAt: `${corpusQ.examDate}T00:00:00.000Z`,
          author: 'LearnMate Editorial Board',
          previousType: 'PENDING',
          newType: 'OFFICIAL',
          note: corpusQ.sourceProvenance,
        },
      ],
    },
    metadata: {
      source: 'LearnMate Verified Archive',
      sourceUrl: 'https://jeemain.nta.nic.in/',
      license: 'Public Examination Record',
      provenanceVerified: true,
      importedAt: `${corpusQ.examDate}T00:00:00.000Z`,
      externalId: corpusQ.officialQuestionId,
      canonicalHash: corpusQ.canonicalHash,
      answerKeyVersion: corpusQ.answerKeyVersion,
    },
    status: 'APPROVED',
  };
}
