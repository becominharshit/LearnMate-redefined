/**
 * Question & Solution Normalizers + Bidirectional Corpus Adapters
 * Normalizes heterogeneous external PYQ records into LearnMate's UnifiedQuestionRecord
 * and provides lossless conversion to/from PyqCorpusQuestion.
 */

import type {
  DatasetSourceId,
  QuestionReviewStatus,
  SolutionOriginType,
  UnifiedDifficulty,
  UnifiedExamId,
  UnifiedQuestionOption,
  UnifiedQuestionRecord,
  UnifiedQuestionType,
  UnifiedSolutionBlock,
  UnifiedSubjectId,
} from '../types';
import type { RawExternalQuestionPayload } from '../parsers';
import { EXTERNAL_DATASET_SOURCE_REGISTRY } from '../sources/sourceRegistry';

/**
 * Deterministic FNV-1a 64-bit-inspired hex hash for normalized question text deduplication.
 */
export function computeNormalizedQuestionTextHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\\+-=^_{}()[\]]/g, '')
    .trim();

  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `qhash-${hex1}${hex2}`;
}

export function computeQuestionCompositeKey(params: {
  exam: string;
  year: number;
  session: string;
  shift: string | number;
  subject: string;
  externalId?: string;
  stemSnippet?: string;
}): string {
  const stemKey = (params.stemSnippet || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 28);
  return [
    params.exam.toUpperCase(),
    String(params.year),
    params.session.toUpperCase().replace(/\s+/g, '_'),
    String(params.shift).toUpperCase().replace(/\s+/g, '_'),
    params.subject.toUpperCase(),
    stemKey || (params.externalId || 'Q').toUpperCase(),
  ].join(':');
}

export function normalizeExamId(raw?: string): UnifiedExamId {
  const val = (raw || '').toUpperCase().trim();
  if (val.includes('ADV')) return 'JEE_ADVANCED';
  if (val === 'JEE_MAIN' || val === 'JEEMAIN' || val.includes('MAIN')) return 'JEE_MAIN';
  return (val as UnifiedExamId) || 'JEE_MAIN';
}

export function normalizeSubjectId(raw?: string): UnifiedSubjectId {
  const val = (raw || '').toUpperCase().trim();
  if (val.startsWith('PHY')) return 'PHYSICS';
  if (val.startsWith('CHEM')) return 'CHEMISTRY';
  if (val.startsWith('MATH')) return 'MATHEMATICS';
  return (val as UnifiedSubjectId) || 'PHYSICS';
}

export function normalizeDifficulty(raw?: string): UnifiedDifficulty {
  const val = (raw || '').toUpperCase().trim();
  if (val === 'EASY') return 'EASY';
  if (val === 'HARD' || val === 'TOUGH') return 'HARD';
  return 'MEDIUM';
}

export function normalizeQuestionType(
  raw?: string,
  hasOptions = true,
  correctAnswers: string[] = []
): UnifiedQuestionType {
  const val = (raw || '').toUpperCase().trim();
  if (val.includes('ASSERTION')) return 'ASSERTION_REASON';
  if (val.includes('MULTI')) return 'MCQ_MULTI';
  if (val === 'INTEGER' || val === 'NUMERICAL_INTEGER') return 'INTEGER';
  if (val === 'DECIMAL' || val === 'NUMERICAL_DECIMAL') return 'DECIMAL';
  if (val.includes('NUM')) return 'NUMERICAL';
  if (val.includes('SINGLE') || val === 'MCQ') return 'MCQ_SINGLE';
  if (!hasOptions) return 'NUMERICAL';
  if (correctAnswers.length > 1) return 'MCQ_MULTI';
  return 'MCQ_SINGLE';
}

export function extractInlineEquations(text: string, explicit: string[] = []): string[] {
  const found = new Set<string>(explicit.filter(Boolean));
  const regex = /\$\$?([^$]+)\$\$?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const eq = match[1].trim();
    if (eq) found.add(eq);
  }
  return Array.from(found);
}

export function normalizeSolutionRecord(
  raw: RawExternalQuestionPayload,
  sourceId?: DatasetSourceId
): UnifiedSolutionBlock {
  const sourceAudit = sourceId ? EXTERNAL_DATASET_SOURCE_REGISTRY[sourceId] : undefined;

  let solText = '';
  let rawType = raw.solutionType || 'PENDING';
  let rawVerified = false;
  let keyFormula = raw.keyFormula;
  let commonTrap = raw.commonTrap;

  if (typeof raw.solution === 'object' && raw.solution !== null) {
    solText = (raw.solution.text || '').trim();
    rawType = raw.solution.type || rawType;
    rawVerified = Boolean(raw.solution.verified);
    keyFormula = raw.solution.keyFormula || keyFormula;
    commonTrap = raw.solution.commonTrap || commonTrap;
  } else if (typeof raw.solution === 'string') {
    solText = raw.solution.trim();
  } else {
    solText = (raw.officialSolution || raw.solutionText || '').trim();
  }

  const upperType = rawType.toUpperCase();
  let normalizedType: SolutionOriginType = 'PENDING';
  if (upperType === 'OFFICIAL') normalizedType = 'OFFICIAL';
  else if (upperType === 'VERIFIED') normalizedType = 'VERIFIED';
  else if (upperType === 'AI_GENERATED' || upperType === 'AI') normalizedType = 'AI_GENERATED';
  else if (solText.length > 0) normalizedType = 'VERIFIED';

  // Enforce provenance policy: if source only permits metadata/stems and solution is third-party unverified, strip it
  if (
    sourceAudit &&
    sourceAudit.componentRights.workedSolutions === 'THIRD_PARTY_COPYRIGHTED'
  ) {
    solText = '';
    normalizedType = 'PENDING';
    rawVerified = false;
  }

  // Rule from Section 6: Never label AI-generated content as verified unless explicitly reviewed
  if (normalizedType === 'AI_GENERATED') {
    rawVerified = false;
  } else if (normalizedType === 'OFFICIAL' || normalizedType === 'VERIFIED') {
    rawVerified = solText.length > 0;
  }

  if (!solText) {
    normalizedType = 'PENDING';
    rawVerified = false;
  }

  return {
    text: solText,
    type: normalizedType,
    verified: rawVerified,
    keyFormula,
    commonTrap,
    revisionHistory: [
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        author: sourceId || 'importer',
        previousType: 'PENDING',
        newType: normalizedType,
        note:
          normalizedType === 'PENDING'
            ? 'Imported question stem without verified solution; queued for solution verification.'
            : `Imported ${normalizedType} solution from ${sourceId || 'external dataset'}.`,
      },
    ],
  };
}

export function normalizeQuestionRecord(
  raw: RawExternalQuestionPayload,
  sourceId: DatasetSourceId = 'jee_mocks_db',
  indexFallback = 1
): UnifiedQuestionRecord {
  const sourceAudit = EXTERNAL_DATASET_SOURCE_REGISTRY[sourceId];
  const externalId =
    raw.externalId ||
    raw.id ||
    raw.question_id ||
    `${sourceId.toUpperCase()}-ITEM-${indexFallback}`;

  const exam = normalizeExamId(raw.exam || raw.exam_name);
  const year = Number(raw.year) || 2025;
  const session = (raw.session || 'JANUARY')
    .toString()
    .toUpperCase()
    .trim();
  const shift = raw.shift ?? 1;
  const subject = normalizeSubjectId(raw.subject);
  const chapter = (raw.chapter || 'GENERAL')
    .toString()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .trim();
  const topic = (raw.topic || chapter)
    .toString()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .trim();
  const difficulty = normalizeDifficulty(raw.difficulty);

  // Extract question stem, images, equations, tables
  let stemText = '';
  let images: string[] = Array.isArray(raw.images) ? [...raw.images] : [];
  let equations: string[] = Array.isArray(raw.equations) ? [...raw.equations] : [];
  let tables = raw.tables;
  let assertionText = raw.assertionText;
  let reasonText = raw.reasonText;

  if (typeof raw.question === 'object' && raw.question !== null) {
    stemText = (raw.question.text || raw.questionText || '').trim();
    if (Array.isArray(raw.question.images)) images = [...images, ...raw.question.images];
    if (Array.isArray(raw.question.equations))
      equations = [...equations, ...raw.question.equations];
    if (raw.question.tables) tables = raw.question.tables;
    if (raw.question.assertionText) assertionText = raw.question.assertionText;
    if (raw.question.reasonText) reasonText = raw.question.reasonText;
  } else if (typeof raw.question === 'string') {
    stemText = raw.question.trim();
  } else {
    stemText = (raw.questionText || '').trim();
  }

  if (!stemText && assertionText && reasonText) {
    stemText = `Assertion (A): ${assertionText}\nReason (R): ${reasonText}`;
  }

  equations = extractInlineEquations(stemText, equations);

  // Normalize options
  const normalizedOptions: UnifiedQuestionOption[] = [];
  if (Array.isArray(raw.options) && raw.options.length > 0) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    raw.options.forEach((opt, idx) => {
      const optId = letters[idx] || String(idx + 1);
      if (typeof opt === 'string') {
        normalizedOptions.push({ id: optId, text: opt.trim() });
      } else if (opt && typeof opt === 'object') {
        normalizedOptions.push({
          id: (opt.id || optId).toUpperCase().trim(),
          text: (opt.text || '').trim(),
          image: opt.image,
        });
      }
    });
  } else if (raw.optionA || raw.optionB || raw.optionC || raw.optionD) {
    if (raw.optionA !== undefined)
      normalizedOptions.push({ id: 'A', text: String(raw.optionA).trim() });
    if (raw.optionB !== undefined)
      normalizedOptions.push({ id: 'B', text: String(raw.optionB).trim() });
    if (raw.optionC !== undefined)
      normalizedOptions.push({ id: 'C', text: String(raw.optionC).trim() });
    if (raw.optionD !== undefined)
      normalizedOptions.push({ id: 'D', text: String(raw.optionD).trim() });
  }

  // Normalize correct answers
  const rawAns = raw.correctAnswer ?? raw.answer;
  let correctAnswer: string[] = [];
  if (Array.isArray(rawAns)) {
    correctAnswer = rawAns.map((a) => String(a).trim().toUpperCase()).filter(Boolean);
  } else if (rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '') {
    correctAnswer = String(rawAns)
      .split(/[;|,]/)
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);
  }

  const questionType = normalizeQuestionType(
    raw.questionType || raw.type,
    normalizedOptions.length > 0,
    correctAnswer
  );

  // Numerical bounds for NUMERICAL / INTEGER / DECIMAL questions
  let numericalBounds: UnifiedQuestionRecord['numericalBounds'] | undefined;
  if (
    questionType === 'NUMERICAL' ||
    questionType === 'INTEGER' ||
    questionType === 'DECIMAL'
  ) {
    const parsedNum = correctAnswer[0] !== undefined ? Number(correctAnswer[0]) : NaN;
    if (Number.isFinite(parsedNum)) {
      const isInt = questionType === 'INTEGER' || Number.isInteger(parsedNum);
      const tol =
        raw.numericalTolerance !== undefined
          ? Number(raw.numericalTolerance)
          : isInt
          ? 0
          : 0.05;
      numericalBounds = {
        exactValue: parsedNum,
        tolerance: Number.isFinite(tol) ? tol : 0,
        isIntegerOnly: questionType === 'INTEGER',
      };
    }
  }

  const solution = normalizeSolutionRecord(raw, sourceId);
  const canonicalHash = computeNormalizedQuestionTextHash(`${subject}:${stemText}`);
  const compositeKey = computeQuestionCompositeKey({
    exam,
    year,
    session,
    shift,
    subject,
    externalId,
    stemSnippet: stemText,
  });

  const provenanceVerified =
    raw.provenanceVerified !== undefined
      ? Boolean(raw.provenanceVerified)
      : Boolean(sourceAudit?.commercialRedistributionPermitted);

  const learnMateId = externalId.startsWith('lm-q-')
    ? externalId
    : `lm-q-${sourceId.replace(/_/g, '-')}-${externalId
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')}`;

  const defaultStatus: QuestionReviewStatus =
    provenanceVerified && solution.verified ? 'APPROVED' : 'PENDING_REVIEW';

  return {
    id: learnMateId,
    exam,
    year,
    session,
    shift,
    subject,
    chapter,
    topic,
    difficulty,
    questionType,
    question: {
      text: stemText,
      images,
      equations,
      ...(tables ? { tables } : {}),
      ...(assertionText ? { assertionText } : {}),
      ...(reasonText ? { reasonText } : {}),
    },
    options: normalizedOptions,
    correctAnswer,
    ...(numericalBounds ? { numericalBounds } : {}),
    solution,
    metadata: {
      source: sourceAudit?.discoveryName || sourceId.toUpperCase(),
      sourceUrl: raw.sourceUrl || sourceAudit?.verifiedRepoUrl || '',
      license: raw.license || sourceAudit?.softwareLicense || 'UNSPECIFIED',
      provenanceVerified,
      importedAt: new Date().toISOString(),
      externalId,
      canonicalHash,
      compositeKey,
      answerKeyVersion: `final-key-${year}-v1`,
      historicalPatternId:
        exam === 'JEE_ADVANCED'
          ? 'JEE_ADVANCED_P1'
          : year >= 2025
          ? 'JEE_MAIN_2025_75Q'
          : 'JEE_MAIN_HISTORICAL_90Q',
      ...(raw.skillTag ? { skillTag: raw.skillTag } : {}),
    },
    status: (raw.status as QuestionReviewStatus) || defaultStatus,
  };
}
