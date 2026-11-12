/**
 * Comprehensive 9-Point Question Validator, License Gatekeeper,
 * and Multi-Stage Duplicate Detector (Exact Hash, Composite Key, & Similarity)
 */

import type {
  DatasetSourceId,
  DuplicateCandidateMatch,
  QuestionReviewStatus,
  QuestionValidationResult,
  UnifiedExamId,
  UnifiedQuestionRecord,
  UnifiedSubjectId,
  ValidationIssue,
} from '../types';
import { EXTERNAL_DATASET_SOURCE_REGISTRY } from '../sources/sourceRegistry';

const VALID_EXAMS = new Set<UnifiedExamId>(['JEE_MAIN', 'JEE_ADVANCED']);
const VALID_SUBJECTS_BY_EXAM: Record<UnifiedExamId, Set<UnifiedSubjectId>> = {
  JEE_MAIN: new Set(['PHYSICS', 'CHEMISTRY', 'MATHEMATICS']),
  JEE_ADVANCED: new Set(['PHYSICS', 'CHEMISTRY', 'MATHEMATICS']),
};

/**
 * License & Provenance Gatekeeper (Section 2 & Section 4)
 * Never assumes a repository's software license covers third-party scraped content.
 */
export function validateDatasetSourceLicense(sourceId: DatasetSourceId): {
  allowed: boolean;
  reason: string;
} {
  const audit = EXTERNAL_DATASET_SOURCE_REGISTRY[sourceId];
  if (!audit) {
    return {
      allowed: false,
      reason: `Unknown dataset source "${sourceId}" has not completed provenance audit.`,
    };
  }
  if (
    !audit.commercialRedistributionPermitted ||
    audit.clearanceStatus === 'REJECTED_UNCLEAR_PROPRIETARY_RIGHTS'
  ) {
    return {
      allowed: false,
      reason: audit.rejectionOrRestrictionReason,
    };
  }
  return {
    allowed: true,
    reason: audit.rejectionOrRestrictionReason,
  };
}

/**
 * Validates mathematical and LaTeX syntax inside question stems, options, and solutions.
 * Checks balanced `$` delimiters, balanced `{}` braces, and matched `\left` / `\right`.
 */
export function validateLatexMathFormatting(text: string): string | null {
  if (!text) return null;

  // 1. Check unescaped single '$' count (after removing '$$')
  const strippedDoubleDollar = text.replace(/\$\$/g, '');
  let dollarCount = 0;
  for (let i = 0; i < strippedDoubleDollar.length; i++) {
    if (strippedDoubleDollar[i] === '$' && (i === 0 || strippedDoubleDollar[i - 1] !== '\\')) {
      dollarCount += 1;
    }
  }
  if (dollarCount % 2 !== 0) {
    return 'Unbalanced inline LaTeX math delimiter ($).';
  }

  // 2. Check balanced curly braces '{' and '}'
  let braceDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '';
    if (prev === '\\') continue;
    if (ch === '{') braceDepth += 1;
    else if (ch === '}') braceDepth -= 1;
    if (braceDepth < 0) {
      return 'Unbalanced closing brace "}" in LaTeX expression.';
    }
  }
  if (braceDepth !== 0) {
    return 'Unclosed opening brace "{" in LaTeX expression.';
  }

  // 3. Check matched \left and \right
  const leftMatches = (text.match(/\\left(?![a-zA-Z])/g) || []).length;
  const rightMatches = (text.match(/\\right(?![a-zA-Z])/g) || []).length;
  if (leftMatches !== rightMatches) {
    return `Unmatched LaTeX delimiter sizing commands (\\left count ${leftMatches} != \\right count ${rightMatches}).`;
  }

  return null;
}

/**
 * Validates image references to reject broken URLs, local filesystem paths, or hotlinked proprietary CDNs.
 */
export function validateImageReference(url: string): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return 'Empty image reference URL.';
  if (trimmed.startsWith('C:\\') || trimmed.startsWith('file://')) {
    return `Local filesystem image reference is not portable: "${trimmed}".`;
  }
  if (
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('/assets/') &&
    !trimmed.startsWith('data:image/')
  ) {
    return `Invalid or insecure image URL protocol: "${trimmed}".`;
  }
  if (
    trimmed.includes('broken-link') ||
    trimmed.includes('404') ||
    trimmed.endsWith('.tmp')
  ) {
    return `Broken image reference detected: "${trimmed}".`;
  }
  return null;
}

/**
 * Complete 9-Rule Question Record Validator (Section 5)
 */
export function validateQuestionRecord(
  record: UnifiedQuestionRecord
): QuestionValidationResult {
  const issues: ValidationIssue[] = [];

  // Rule 1: Missing question text
  const stem = (record.question?.text || '').trim();
  if (!stem || stem.length < 10) {
    issues.push({
      code: 'MISSING_QUESTION_TEXT',
      severity: 'ERROR',
      field: 'question.text',
      message: 'Question text is missing or shorter than 10 characters.',
    });
  }

  // Rule 5: Invalid subject or exam classification
  if (!VALID_EXAMS.has(record.exam)) {
    issues.push({
      code: 'INVALID_EXAM_OR_SUBJECT',
      severity: 'ERROR',
      field: 'exam',
      message: `Unsupported exam identifier "${String(record.exam)}". Must be JEE_MAIN or JEE_ADVANCED.`,
    });
  } else {
    const allowedSubjects = VALID_SUBJECTS_BY_EXAM[record.exam];
    if (!allowedSubjects.has(record.subject)) {
      issues.push({
        code: 'INVALID_EXAM_OR_SUBJECT',
        severity: 'ERROR',
        field: 'subject',
        message: `Subject "${record.subject}" is not valid for exam "${record.exam}".`,
      });
    }
  }

  // Rule 2: Missing or malformed options (for MCQ / Assertion-Reason types)
  const isMcqLike =
    record.questionType === 'MCQ_SINGLE' ||
    record.questionType === 'MCQ_MULTI' ||
    record.questionType === 'ASSERTION_REASON';

  const optionIds = new Set<string>();
  if (Array.isArray(record.options)) {
    for (const opt of record.options) {
      if (!opt.id || !opt.text || !opt.text.trim()) {
        issues.push({
          code: 'MALFORMED_OPTIONS',
          severity: 'ERROR',
          field: 'options',
          message: `Option "${opt.id || '?'}" has empty text.`,
        });
      }
      if (opt.id) {
        if (optionIds.has(opt.id)) {
          issues.push({
            code: 'MALFORMED_OPTIONS',
            severity: 'ERROR',
            field: 'options',
            message: `Duplicate option ID "${opt.id}" detected.`,
          });
        }
        optionIds.add(opt.id);
      }
    }
  }

  if (isMcqLike && (!Array.isArray(record.options) || record.options.length < 4)) {
    issues.push({
      code: 'MALFORMED_OPTIONS',
      severity: 'ERROR',
      field: 'options',
      message: `${record.questionType} requires at least 4 distinct options (found ${
        record.options?.length ?? 0
      }).`,
    });
  }

  // Rule 3: Invalid correct-answer references
  if (!Array.isArray(record.correctAnswer) || record.correctAnswer.length === 0) {
    issues.push({
      code: 'INVALID_CORRECT_ANSWER_REF',
      severity: 'ERROR',
      field: 'correctAnswer',
      message: 'correctAnswer array cannot be empty.',
    });
  } else if (isMcqLike) {
    if (record.questionType === 'MCQ_SINGLE' && record.correctAnswer.length !== 1) {
      issues.push({
        code: 'INVALID_CORRECT_ANSWER_REF',
        severity: 'ERROR',
        field: 'correctAnswer',
        message: `MCQ_SINGLE must have exactly 1 correct answer (found ${record.correctAnswer.length}).`,
      });
    }
    const validOptionSet =
      optionIds.size > 0 ? optionIds : new Set(['A', 'B', 'C', 'D']);
    for (const ansId of record.correctAnswer) {
      if (!validOptionSet.has(ansId)) {
        issues.push({
          code: 'INVALID_CORRECT_ANSWER_REF',
          severity: 'ERROR',
          field: 'correctAnswer',
          message: `Correct answer "${ansId}" does not match any option ID (${Array.from(
            validOptionSet
          ).join(', ')}).`,
        });
      }
    }
  } else {
    // Numerical / Integer / Decimal
    const rawNum = Number(record.correctAnswer[0]);
    if (!Number.isFinite(rawNum)) {
      issues.push({
        code: 'INVALID_CORRECT_ANSWER_REF',
        severity: 'ERROR',
        field: 'correctAnswer',
        message: `Numerical question has non-numeric correctAnswer "${record.correctAnswer[0]}".`,
      });
    } else if (record.questionType === 'INTEGER' && !Number.isInteger(rawNum)) {
      issues.push({
        code: 'INVALID_CORRECT_ANSWER_REF',
        severity: 'ERROR',
        field: 'correctAnswer',
        message: `INTEGER question requires an integer answer, but received "${record.correctAnswer[0]}".`,
      });
    }
  }

  // Rule 4: Missing solutions (flagged as WARNING -> forces PENDING_REVIEW)
  const solText = (record.solution?.text || '').trim();
  if (!solText || record.solution?.type === 'PENDING') {
    issues.push({
      code: 'MISSING_SOLUTION',
      severity: 'WARNING',
      field: 'solution.text',
      message:
        'Question has no worked solution yet; status set to PENDING_REVIEW until verified.',
    });
  }

  // Rule 7: Broken image references
  const allImages = [
    ...(record.question?.images || []),
    ...(record.options || []).map((o) => o.image).filter((img): img is string => Boolean(img)),
  ];
  for (const imgUrl of allImages) {
    const imgErr = validateImageReference(imgUrl);
    if (imgErr) {
      issues.push({
        code: 'BROKEN_IMAGE_REFERENCE',
        severity: 'ERROR',
        field: 'question.images',
        message: imgErr,
      });
    }
  }

  // Rule 8: Invalid mathematical or LaTeX formatting
  const textsToCheckMath: Array<{ field: string; text: string }> = [
    { field: 'question.text', text: stem },
    ...record.options.map((o) => ({ field: `options.${o.id}`, text: o.text })),
    ...(solText ? [{ field: 'solution.text', text: solText }] : []),
  ];
  for (const item of textsToCheckMath) {
    const mathErr = validateLatexMathFormatting(item.text);
    if (mathErr) {
      issues.push({
        code: 'INVALID_MATH_LATEX',
        severity: 'ERROR',
        field: item.field,
        message: mathErr,
      });
    }
  }

  // Rule 9: Incorrect question metadata
  if (
    !record.year ||
    !Number.isInteger(record.year) ||
    record.year < 1995 ||
    record.year > 2030
  ) {
    issues.push({
      code: 'INCORRECT_METADATA',
      severity: 'ERROR',
      field: 'year',
      message: `Invalid examination year "${String(record.year)}" (expected 1995–2030).`,
    });
  }
  if (!record.metadata?.source || !record.metadata?.license) {
    issues.push({
      code: 'INCORRECT_METADATA',
      severity: 'ERROR',
      field: 'metadata',
      message: 'Metadata must include source and license fields.',
    });
  }
  if (!record.metadata?.provenanceVerified) {
    issues.push({
      code: 'LICENSE_PROVENANCE_REJECTED',
      severity: 'ERROR',
      field: 'metadata.provenanceVerified',
      message: 'Question provenance is not verified for redistribution.',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'ERROR');
  const hasWarnings = issues.some((i) => i.severity === 'WARNING');

  let recommendedStatus: QuestionReviewStatus = 'APPROVED';
  if (hasErrors) {
    recommendedStatus = 'FAILED_VALIDATION';
  } else if (
    hasWarnings ||
    !record.solution.verified ||
    record.solution.type === 'AI_GENERATED' ||
    record.solution.type === 'PENDING'
  ) {
    recommendedStatus = 'PENDING_REVIEW';
  }

  return {
    isValid: !hasErrors,
    canApproveDirectly: !hasErrors && recommendedStatus === 'APPROVED',
    recommendedStatus,
    issues,
  };
}

/**
 * Tokenizes scientific/mathematical question text for similarity comparison.
 */
function tokenizeForSimilarity(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\\]+/g, ' ')
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !['the', 'and', 'for', 'with', 'are', 'from'].includes(t));
  return new Set(tokens);
}

/**
 * Computes Token Jaccard Similarity in [0, 1] between two question texts.
 */
export function computeQuestionSimilarity(textA: string, textB: string): number {
  const setA = tokenizeForSimilarity(textA);
  const setB = tokenizeForSimilarity(textB);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Number((intersection / union).toFixed(4));
}

/**
 * Multi-Stage Duplicate Detector (Section 5)
 * - Stage 1: Normalized text hash match (`EXACT_HASH`)
 * - Stage 2: Exam / Year / Shift / Question composite key match (`COMPOSITE_KEY`)
 * - Stage 3: Similarity detection for near-duplicates (`NEAR_DUPLICATE_SIMILARITY`)
 *   NOTE: Near-duplicates are NEVER auto-merged; they are flagged for human review.
 */
export function detectDuplicateQuestion(
  incoming: UnifiedQuestionRecord,
  existingCorpus: UnifiedQuestionRecord[],
  nearDuplicateThreshold = 0.68
): DuplicateCandidateMatch | null {
  let bestNearMatch: DuplicateCandidateMatch | null = null;

  for (const existing of existingCorpus) {
    if (existing.id === incoming.id) continue;

    // 1. Exact canonical normalized hash match
    if (
      incoming.metadata.canonicalHash &&
      existing.metadata.canonicalHash &&
      incoming.metadata.canonicalHash === existing.metadata.canonicalHash
    ) {
      return {
        incomingQuestionId: incoming.id,
        existingQuestionId: existing.id,
        matchType: 'EXACT_HASH',
        similarityScore: 1.0,
        incomingExcerpt: incoming.question.text.slice(0, 140),
        existingExcerpt: existing.question.text.slice(0, 140),
        requiresHumanReview: false,
        resolutionStatus: 'SKIPPED_EXACT',
      };
    }

    // 2. Composite key match (Exam + Year + Session + Shift + Subject + Stem prefix)
    if (
      incoming.metadata.compositeKey &&
      existing.metadata.compositeKey &&
      incoming.metadata.compositeKey === existing.metadata.compositeKey
    ) {
      return {
        incomingQuestionId: incoming.id,
        existingQuestionId: existing.id,
        matchType: 'COMPOSITE_KEY',
        similarityScore: 0.99,
        incomingExcerpt: incoming.question.text.slice(0, 140),
        existingExcerpt: existing.question.text.slice(0, 140),
        requiresHumanReview: false,
        resolutionStatus: 'SKIPPED_EXACT',
      };
    }

    // 3. Near-duplicate token Jaccard similarity within same subject
    if (existing.subject === incoming.subject) {
      const sim = computeQuestionSimilarity(incoming.question.text, existing.question.text);
      if (sim >= nearDuplicateThreshold) {
        if (!bestNearMatch || sim > bestNearMatch.similarityScore) {
          bestNearMatch = {
            incomingQuestionId: incoming.id,
            existingQuestionId: existing.id,
            matchType: 'NEAR_DUPLICATE_SIMILARITY',
            similarityScore: sim,
            incomingExcerpt: incoming.question.text.slice(0, 140),
            existingExcerpt: existing.question.text.slice(0, 140),
            requiresHumanReview: true,
            resolutionStatus: 'FLAGGED_FOR_HUMAN_REVIEW',
          };
        }
      }
    }
  }

  return bestNearMatch;
}
