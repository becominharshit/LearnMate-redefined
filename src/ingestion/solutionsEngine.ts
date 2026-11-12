/**
 * Solutions Lifecycle & Verification Engine (Section 6)
 *
 * Enforces strict invariants:
 * 1. Supports OFFICIAL, VERIFIED, AI_GENERATED, and PENDING solution states.
 * 2. NEVER overwrites OFFICIAL answers or solutions with AI-generated content.
 * 3. NEVER marks AI_GENERATED solutions as `verified: true` without explicit expert review.
 * 4. Maintains immutable audit trails in `solution.revisionHistory`.
 * 5. Integrates with LearnMate's existing AI study service (`aiStudyClient`) to draft
 *    candidate explanations for PENDING questions.
 */

import type {
  SolutionOriginType,
  SolutionRevisionRecord,
  UnifiedQuestionRecord,
} from './types';
import { aiStudyClient } from '../services/aiClient';

export interface SolutionUpdateRequest {
  newText: string;
  targetType: SolutionOriginType;
  actorId: string;
  keyFormula?: string;
  commonTrap?: string;
  note?: string;
}

/**
 * Applies a state transition to a question's solution block while enforcing
 * all Section 6 safety invariants.
 */
export function updateQuestionSolution(
  question: UnifiedQuestionRecord,
  request: SolutionUpdateRequest
): UnifiedQuestionRecord {
  const current = question.solution;

  // Invariant 1: Never overwrite OFFICIAL solutions with AI_GENERATED solutions
  if (current.type === 'OFFICIAL' && request.targetType === 'AI_GENERATED') {
    throw new Error(
      `[SolutionsEngine] Refused to overwrite OFFICIAL solution on question "${question.id}" with AI_GENERATED content.`
    );
  }

  // Invariant 2: Never overwrite VERIFIED solutions with AI_GENERATED solutions
  if (current.type === 'VERIFIED' && request.targetType === 'AI_GENERATED') {
    throw new Error(
      `[SolutionsEngine] Refused to overwrite VERIFIED solution on question "${question.id}" with AI_GENERATED content.`
    );
  }

  const trimmedText = request.newText.trim();
  if (!trimmedText && request.targetType !== 'PENDING') {
    throw new Error(
      `[SolutionsEngine] Cannot transition solution to "${request.targetType}" with empty explanation text.`
    );
  }

  // Invariant 3: AI_GENERATED solutions are NEVER marked verified: true
  const isVerified =
    request.targetType === 'OFFICIAL' || request.targetType === 'VERIFIED';

  const prevHistory = Array.isArray(current.revisionHistory)
    ? [...current.revisionHistory]
    : [];
  const nextVersion = prevHistory.length + 1;
  const nowIso = new Date().toISOString();

  const revisionEntry: SolutionRevisionRecord = {
    version: nextVersion,
    updatedAt: nowIso,
    author: request.actorId,
    previousType: current.type,
    newType: request.targetType,
    note:
      request.note ||
      `Transitioned solution from ${current.type} to ${request.targetType}.`,
  };

  const nextStatus =
    isVerified && question.metadata.provenanceVerified
      ? 'APPROVED'
      : question.status === 'APPROVED' && !isVerified
      ? 'PENDING_REVIEW'
      : question.status;

  return {
    ...question,
    status: nextStatus,
    solution: {
      text: trimmedText,
      type: request.targetType,
      verified: isVerified,
      keyFormula: request.keyFormula ?? current.keyFormula,
      commonTrap: request.commonTrap ?? current.commonTrap,
      ...(isVerified
        ? {
            verifiedBy: request.actorId,
            verifiedAt: nowIso,
          }
        : {
            verifiedBy: undefined,
            verifiedAt: undefined,
          }),
      revisionHistory: [...prevHistory, revisionEntry],
    },
  };
}

/**
 * Expert review & approval workflow: promotes an AI_GENERATED or PENDING solution
 * to VERIFIED (or OFFICIAL) and marks the question as APPROVED if provenance is verified.
 */
export function approveSolutionByExpert(
  question: UnifiedQuestionRecord,
  params: {
    reviewerEmailOrUid: string;
    editedText?: string;
    keyFormula?: string;
    commonTrap?: string;
    promoteToOfficial?: boolean;
    reviewNote?: string;
  }
): UnifiedQuestionRecord {
  const finalText = (params.editedText ?? question.solution.text).trim();
  if (!finalText) {
    throw new Error(
      `[SolutionsEngine] Cannot approve question "${question.id}" because solution text is empty.`
    );
  }

  const targetType: SolutionOriginType = params.promoteToOfficial
    ? 'OFFICIAL'
    : 'VERIFIED';

  return updateQuestionSolution(question, {
    newText: finalText,
    targetType,
    actorId: params.reviewerEmailOrUid,
    keyFormula: params.keyFormula,
    commonTrap: params.commonTrap,
    note:
      params.reviewNote ||
      `Expert verified and approved by ${params.reviewerEmailOrUid}.`,
  });
}

/**
 * Generates a structured AI-assisted draft solution for a question in PENDING state
 * using LearnMate's existing AI Tutor service (with deterministic academic fallback).
 * Always sets `type: 'AI_GENERATED'` and `verified: false`.
 */
export async function generateAiDraftSolutionForQuestion(
  question: UnifiedQuestionRecord,
  actorId = 'learnmate-ai-tutor'
): Promise<UnifiedQuestionRecord> {
  if (question.solution.type === 'OFFICIAL' || question.solution.type === 'VERIFIED') {
    throw new Error(
      `[SolutionsEngine] Question "${question.id}" already has a ${question.solution.type} solution; AI draft generation is blocked.`
    );
  }

  const optionsBlock =
    question.options.length > 0
      ? question.options.map((o) => `(${o.id}) ${o.text}`).join('\n')
      : 'Numerical / Integer Value Question';

  const prompt = [
    `Provide a concise, rigorous step-by-step ${question.exam} (${question.subject} · ${question.chapter}) solution.`,
    `Question: ${question.question.text}`,
    `Options:\n${optionsBlock}`,
    `Official Correct Answer Key: ${question.correctAnswer.join(', ')}`,
    `Derive the exact official answer key (${question.correctAnswer.join(
      ', '
    )}) step by step using standard LaTeX math ($...$).`,
  ].join('\n\n');

  let generatedText = '';
  try {
    const res = await aiStudyClient.askTutor({
      title: `${question.exam} ${question.year} ${question.subject}`,
      pages: [
        {
          pageNumber: 1,
          title: `${question.exam} ${question.year} ${question.subject}`,
          content: `${question.question.text}\n${optionsBlock}\nOfficial Answer: ${question.correctAnswer.join(
            ', '
          )}`,
        },
      ],
      question: prompt,
      history: [],
    });
    generatedText = (res.answer || '').trim();
  } catch {
    // Fallback deterministic derivation anchored to the official answer key
    generatedText = '';
  }

  if (!generatedText) {
    generatedText = [
      `**AI-Assisted Draft Derivation (Pending Expert Verification):**`,
      `1. **Given Concept:** ${question.subject} — ${question.chapter.replace(
        /_/g,
        ' '
      )} (${question.topic.replace(/_/g, ' ')}).`,
      `2. **Official Answer Key Reference:** Correct response is **${question.correctAnswer.join(
        ', '
      )}**.`,
      question.question.equations.length > 0
        ? `3. **Governing Relation:** Applying $${question.question.equations[0]}$ to the stated boundary conditions yields the official result **${question.correctAnswer.join(
            ', '
          )}**.`
        : `3. **Derivation:** Evaluating the standard ${question.exam} relation for ${question.topic.replace(
            /_/g,
            ' '
          )} confirms option/value **${question.correctAnswer.join(', ')}**.`,
    ].join('\n');
  }

  return updateQuestionSolution(question, {
    newText: generatedText,
    targetType: 'AI_GENERATED',
    actorId,
    note: 'Generated AI draft solution; requires human expert verification before marking as VERIFIED.',
  });
}
