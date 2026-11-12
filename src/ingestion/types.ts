/**
 * Unified Question Bank & Open-Source PYQ Dataset Ingestion Types
 * Supports JEE Main and JEE Advanced across all question formats,
 * provenance verification, multi-stage validation, and solution lifecycle states.
 */

export type UnifiedExamId = 'JEE_MAIN' | 'JEE_ADVANCED';

export type UnifiedSubjectId = 'PHYSICS' | 'CHEMISTRY' | 'MATHEMATICS';

export type UnifiedDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type UnifiedQuestionType =
  | 'MCQ_SINGLE'
  | 'MCQ_MULTI'
  | 'NUMERICAL'
  | 'INTEGER'
  | 'DECIMAL'
  | 'ASSERTION_REASON';

export type SolutionOriginType = 'OFFICIAL' | 'VERIFIED' | 'AI_GENERATED' | 'PENDING';

export type QuestionReviewStatus =
  | 'APPROVED'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'FAILED_VALIDATION';

export interface UnifiedQuestionOption {
  id: 'A' | 'B' | 'C' | 'D' | string;
  text: string;
  image?: string;
}

export interface UnifiedQuestionTable {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export interface SolutionRevisionRecord {
  version: number;
  updatedAt: string;
  author: string;
  previousType: SolutionOriginType;
  newType: SolutionOriginType;
  note: string;
}

export interface UnifiedSolutionBlock {
  text: string;
  type: SolutionOriginType;
  verified: boolean;
  keyFormula?: string;
  commonTrap?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  revisionHistory?: SolutionRevisionRecord[];
}

export interface UnifiedQuestionMetadata {
  source: string;
  sourceUrl: string;
  license: string;
  provenanceVerified: boolean;
  importedAt: string | null;
  externalId?: string;
  canonicalHash?: string;
  compositeKey?: string;
  answerKeyVersion?: string;
  historicalPatternId?: string;
  skillTag?: string;
}

export interface UnifiedQuestionRecord {
  id: string;
  exam: UnifiedExamId;
  year: number;
  session: string;
  shift: number | string;
  subject: UnifiedSubjectId;
  chapter: string;
  topic: string;
  difficulty: UnifiedDifficulty;
  questionType: UnifiedQuestionType;
  question: {
    text: string;
    images: string[];
    equations: string[];
    tables?: UnifiedQuestionTable[];
    assertionText?: string;
    reasonText?: string;
  };
  options: UnifiedQuestionOption[];
  correctAnswer: string[];
  numericalBounds?: {
    exactValue: number;
    tolerance: number;
    isIntegerOnly: boolean;
  };
  solution: UnifiedSolutionBlock;
  metadata: UnifiedQuestionMetadata;
  status: QuestionReviewStatus;
}

/**
 * External Dataset Source & Provenance Audit Types (Section 2)
 */
export type DatasetSourceId =
  | 'jee_mocks_db'
  | 'jee_main_pyq'
  | 'learnopt'
  | 'qpe';

export type ProvenanceClearanceStatus =
  | 'APPROVED_FOR_IMPORT'
  | 'APPROVED_METADATA_AND_PUBLIC_EXAM_STEMS_ONLY'
  | 'REJECTED_UNCLEAR_PROPRIETARY_RIGHTS';

export interface ComponentRightsBreakdown {
  questionStems: 'PUBLIC_EXAM_RECORD' | 'PROPRIETARY_OR_SCRAPED' | 'METADATA_ONLY';
  officialAnswerKeys: 'PUBLIC_EXAM_RECORD' | 'UNVERIFIED_THIRD_PARTY' | 'MISSING';
  workedSolutions: 'AUTHORED_PERMISSIVE' | 'THIRD_PARTY_COPYRIGHTED' | 'NONE';
  diagramsAndMedia: 'ORIGINAL_SVG_OR_NONE' | 'EXTERNAL_CDN_HOTLINKED' | 'PROPRIETARY_SCANS';
}

export interface ExternalDatasetSourceAudit {
  sourceId: DatasetSourceId;
  displayName: string;
  discoveryName: string;
  verifiedRepoUrl: string;
  companionDatasetUrl?: string;
  dataFormats: Array<'JSON' | 'JSONL' | 'CSV' | 'PDF'>;
  softwareLicense: string;
  contentProvenanceSummary: string;
  commercialRedistributionPermitted: boolean;
  componentRights: ComponentRightsBreakdown;
  clearanceStatus: ProvenanceClearanceStatus;
  rejectionOrRestrictionReason: string;
  supportedExams: UnifiedExamId[];
  lastAuditedAt: string;
}

/**
 * Validation & Multi-Stage Duplicate Detection Types (Section 5)
 */
export type ValidationRuleCode =
  | 'MISSING_QUESTION_TEXT'
  | 'MALFORMED_OPTIONS'
  | 'INVALID_CORRECT_ANSWER_REF'
  | 'MISSING_SOLUTION'
  | 'INVALID_EXAM_OR_SUBJECT'
  | 'DUPLICATE_QUESTION'
  | 'BROKEN_IMAGE_REFERENCE'
  | 'INVALID_MATH_LATEX'
  | 'INCORRECT_METADATA'
  | 'LICENSE_PROVENANCE_REJECTED';

export interface ValidationIssue {
  code: ValidationRuleCode;
  severity: 'ERROR' | 'WARNING';
  field: string;
  message: string;
}

export interface QuestionValidationResult {
  isValid: boolean;
  canApproveDirectly: boolean;
  recommendedStatus: QuestionReviewStatus;
  issues: ValidationIssue[];
}

export interface DuplicateCandidateMatch {
  incomingQuestionId: string;
  existingQuestionId: string;
  matchType: 'EXACT_HASH' | 'COMPOSITE_KEY' | 'NEAR_DUPLICATE_SIMILARITY';
  similarityScore: number; // 0.0 to 1.0
  incomingExcerpt: string;
  existingExcerpt: string;
  requiresHumanReview: boolean;
  resolutionStatus: 'SKIPPED_EXACT' | 'FLAGGED_FOR_HUMAN_REVIEW' | 'APPROVED_DISTINCT';
}

/**
 * Importer, Checkpoint, and Report Types (Section 4)
 */
export interface FailedQuestionLogEntry {
  externalId: string;
  sourceId: string;
  rawExcerpt: string;
  issues: ValidationIssue[];
  failedAt: string;
}

export interface SourceToLearnMateIdMapEntry {
  mappingKey: string; // `${sourceId}:${externalId}`
  sourceId: string;
  externalId: string;
  learnMateQuestionId: string;
  canonicalHash: string;
  importedAt: string;
  lastUpdatedAt: string;
}

export interface IngestionJobCheckpoint {
  jobId: string;
  sourceId: DatasetSourceId;
  format: 'JSON' | 'JSONL' | 'CSV' | 'PDF';
  totalRecords: number;
  lastProcessedIndex: number;
  status: 'IN_PROGRESS' | 'PAUSED_INTERRUPTED' | 'COMPLETED' | 'REJECTED_BY_LICENSE';
  startedAt: string;
  updatedAt: string;
}

export interface IngestionImportReport {
  jobId: string;
  sourceId: DatasetSourceId;
  sourceUrl: string;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  totalInspected: number;
  importedApprovedCount: number;
  importedPendingReviewCount: number;
  updatedIncrementalCount: number;
  skippedExactDuplicateCount: number;
  flaggedNearDuplicateCount: number;
  failedValidationCount: number;
  firestoreBatchesCommitted: number;
  checkpoint: IngestionJobCheckpoint;
  failedRecords: FailedQuestionLogEntry[];
  duplicateMatches: DuplicateCandidateMatch[];
}

/**
 * Mock Test & Exam Pattern Specification Types (Section 8)
 */
export interface ExamPatternSpecification {
  patternId: string;
  exam: UnifiedExamId;
  title: string;
  era: 'CURRENT_2025' | 'HISTORICAL_ARCHIVE';
  durationMinutes: number;
  totalQuestions: number;
  maxMarks: number;
  subjects: UnifiedSubjectId[];
  markingSchemeSummary: string;
  markingRules: {
    correctMarks: number;
    negativeMarks: number;
    unattemptedMarks: number;
    partialCreditSupported: boolean;
  };
}

export interface IdReferencedMockBlueprint {
  id: string;
  title: string;
  exam: UnifiedExamId;
  patternId: string;
  generationMode:
    | 'FULL_LENGTH'
    | 'SUBJECT_WISE'
    | 'CHAPTER_WISE'
    | 'TOPIC_WISE'
    | 'DIFFICULTY_BASED'
    | 'CUSTOM_FILTER';
  durationMinutes: number;
  totalMarks: number;
  /** Strictly stores question IDs only — never duplicates full question objects */
  questionIds: string[];
  filtersUsed: {
    subjects?: UnifiedSubjectId[];
    chapters?: string[];
    topics?: string[];
    difficulties?: UnifiedDifficulty[];
    years?: number[];
  };
  createdAt: string;
}
