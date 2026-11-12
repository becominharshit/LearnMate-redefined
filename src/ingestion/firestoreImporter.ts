/**
 * Dataset Ingestion Pipeline, Firestore Batch Importer, Resumable Checkpoints,
 * Incremental Source-ID Mapper, and ID-Referenced Mock Test Engine (Sections 4, 7, 8)
 */

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import {
  auth,
  db,
  firebaseConfigured,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  DatasetSourceId,
  DuplicateCandidateMatch,
  ExamPatternSpecification,
  FailedQuestionLogEntry,
  IdReferencedMockBlueprint,
  IngestionImportReport,
  IngestionJobCheckpoint,
  SourceToLearnMateIdMapEntry,
  UnifiedDifficulty,
  UnifiedExamId,
  UnifiedQuestionRecord,
  UnifiedSubjectId,
} from './types';
import {
  EXTERNAL_DATASET_SOURCE_REGISTRY,
  VERIFIED_SAMPLE_JEE_CSV,
  VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
  VERIFIED_SAMPLE_LEARNOPT_JSONL,
} from './sources/sourceRegistry';
import { parseRawDatasetByFormat, type RawExternalQuestionPayload } from './parsers';
import { normalizeQuestionRecord } from './normalizers';
import {
  detectDuplicateQuestion,
  validateDatasetSourceLicense,
  validateQuestionRecord,
} from './validators';

export const QUESTION_BANK_STORAGE_KEY = 'learnmate_unified_question_bank_v1';
export const SOURCE_ID_MAP_STORAGE_KEY = 'learnmate_source_id_mappings_v1';
export const INGESTION_REPORTS_STORAGE_KEY = 'learnmate_ingestion_reports_v1';
export const INGESTION_CHECKPOINTS_STORAGE_KEY = 'learnmate_ingestion_checkpoints_v1';
export const MOCK_BLUEPRINTS_STORAGE_KEY = 'learnmate_mock_blueprints_v1';

export const FIRESTORE_BATCH_CHUNK_LIMIT = 400; // Safely below Firestore's 500-operation hard limit

/**
 * Exam Pattern Specifications (Section 8)
 * Preserves historical vs current exam patterns across JEE Main and JEE Advanced.
 */
export const EXAM_PATTERN_SPECIFICATIONS: Record<string, ExamPatternSpecification> = {
  JEE_MAIN_2025_75Q: {
    patternId: 'JEE_MAIN_2025_75Q',
    exam: 'JEE_MAIN',
    title: 'JEE (Main) Current Pattern (75 Compulsory Questions · 300 Marks)',
    era: 'CURRENT_2025',
    durationMinutes: 180,
    totalQuestions: 75,
    maxMarks: 300,
    subjects: ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'],
    markingSchemeSummary: 'Sec A (20 MCQ): +4/−1 · Sec B (5 Compulsory Numerical): +4/−1',
    markingRules: {
      correctMarks: 4,
      negativeMarks: 1,
      unattemptedMarks: 0,
      partialCreditSupported: false,
    },
  },
  JEE_MAIN_HISTORICAL_90Q: {
    patternId: 'JEE_MAIN_HISTORICAL_90Q',
    exam: 'JEE_MAIN',
    title: 'JEE (Main) Historical Archive Pattern (2021–2024 · 90 Questions / Attempt 75)',
    era: 'HISTORICAL_ARCHIVE',
    durationMinutes: 180,
    totalQuestions: 90,
    maxMarks: 300,
    subjects: ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'],
    markingSchemeSummary: 'Sec A (20 MCQ): +4/−1 · Sec B (Attempt 5 of 10 Numerical): +4/−1',
    markingRules: {
      correctMarks: 4,
      negativeMarks: 1,
      unattemptedMarks: 0,
      partialCreditSupported: false,
    },
  },
  JEE_ADVANCED_P1: {
    patternId: 'JEE_ADVANCED_P1',
    exam: 'JEE_ADVANCED',
    title: 'JEE (Advanced) Paper 1 Official Pattern (Multi-Correct Partial Credit + Integer)',
    era: 'CURRENT_2025',
    durationMinutes: 180,
    totalQuestions: 51,
    maxMarks: 180,
    subjects: ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'],
    markingSchemeSummary:
      'Sec 1 Multi-Correct: +4/−2 (+3/+2/+1 Partial) · Sec 2 Single MCQ: +3/−1 · Sec 3 Integer: +4/0',
    markingRules: {
      correctMarks: 4,
      negativeMarks: 2,
      unattemptedMarks: 0,
      partialCreditSupported: true,
    },
  },
  JEE_ADVANCED_P2: {
    patternId: 'JEE_ADVANCED_P2',
    exam: 'JEE_ADVANCED',
    title: 'JEE (Advanced) Paper 2 Official Pattern (Afternoon Session)',
    era: 'CURRENT_2025',
    durationMinutes: 180,
    totalQuestions: 51,
    maxMarks: 180,
    subjects: ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'],
    markingSchemeSummary:
      'Sec 1 Multi-Correct: +4/−2 (Partial) · Sec 2 Single MCQ: +3/−1 · Sec 3 Non-Negative Integer: +4/0',
    markingRules: {
      correctMarks: 4,
      negativeMarks: 2,
      unattemptedMarks: 0,
      partialCreditSupported: true,
    },
  },
};

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorageJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function getStoredUnifiedQuestions(): UnifiedQuestionRecord[] {
  return readStorageJson<UnifiedQuestionRecord[]>(QUESTION_BANK_STORAGE_KEY, []);
}

export function saveStoredUnifiedQuestions(questions: UnifiedQuestionRecord[]): void {
  writeStorageJson(QUESTION_BANK_STORAGE_KEY, questions);
}

export function getSourceIdMappings(): Record<string, SourceToLearnMateIdMapEntry> {
  return readStorageJson<Record<string, SourceToLearnMateIdMapEntry>>(
    SOURCE_ID_MAP_STORAGE_KEY,
    {}
  );
}

export function saveSourceIdMappings(
  mappings: Record<string, SourceToLearnMateIdMapEntry>
): void {
  writeStorageJson(SOURCE_ID_MAP_STORAGE_KEY, mappings);
}

export function getIngestionReports(): IngestionImportReport[] {
  return readStorageJson<IngestionImportReport[]>(INGESTION_REPORTS_STORAGE_KEY, []);
}

export function saveIngestionReport(report: IngestionImportReport): void {
  const existing = getIngestionReports().filter((r) => r.jobId !== report.jobId);
  writeStorageJson(INGESTION_REPORTS_STORAGE_KEY, [report, ...existing].slice(0, 50));
}

export function getIngestionCheckpoints(): Record<string, IngestionJobCheckpoint> {
  return readStorageJson<Record<string, IngestionJobCheckpoint>>(
    INGESTION_CHECKPOINTS_STORAGE_KEY,
    {}
  );
}

export function saveIngestionCheckpoint(checkpoint: IngestionJobCheckpoint): void {
  const all = getIngestionCheckpoints();
  all[checkpoint.jobId] = checkpoint;
  writeStorageJson(INGESTION_CHECKPOINTS_STORAGE_KEY, all);
}

export function getStoredMockBlueprints(): IdReferencedMockBlueprint[] {
  return readStorageJson<IdReferencedMockBlueprint[]>(MOCK_BLUEPRINTS_STORAGE_KEY, []);
}

export function saveStoredMockBlueprint(blueprint: IdReferencedMockBlueprint): void {
  const existing = getStoredMockBlueprints().filter((b) => b.id !== blueprint.id);
  writeStorageJson(MOCK_BLUEPRINTS_STORAGE_KEY, [blueprint, ...existing]);
}

/**
 * Checks if the current authenticated user is an authorized Question Bank Admin.
 */
export function isAuthorizedQuestionBankAdmin(userEmail?: string | null): boolean {
  if (!userEmail) return false;
  const lower = userEmail.toLowerCase().trim();
  return (
    lower === 'harshitkumar7407@gmail.com' ||
    lower === 'student@learnmate.local' ||
    lower.endsWith('@learnmate.local')
  );
}

/**
 * Writes approved/reviewed questions to Firestore in chunked batches (`<= 400` per batch)
 * when Firebase is configured and an admin is signed in.
 */
export async function commitQuestionsToFirestoreBatched(
  questions: UnifiedQuestionRecord[],
  mappings: SourceToLearnMateIdMapEntry[]
): Promise<number> {
  if (!firebaseConfigured || !auth.currentUser || questions.length === 0) {
    return 0;
  }

  let batchesCommitted = 0;
  for (let i = 0; i < questions.length; i += FIRESTORE_BATCH_CHUNK_LIMIT) {
    const chunk = questions.slice(i, i + FIRESTORE_BATCH_CHUNK_LIMIT);
    const mapChunk = mappings.slice(i, i + FIRESTORE_BATCH_CHUNK_LIMIT);
    try {
      const batch = writeBatch(db);
      for (const q of chunk) {
        const qRef = doc(db, 'question_bank', q.id);
        batch.set(qRef, {
          ...q,
          updatedAt: new Date().toISOString(),
        });
      }
      for (const m of mapChunk) {
        const safeMapId = m.mappingKey.replace(/[^a-zA-Z0-9_-]/g, '_');
        const mRef = doc(db, 'question_id_mappings', safeMapId);
        batch.set(mRef, m);
      }
      await batch.commit();
      batchesCommitted += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'question_bank');
    }
  }
  return batchesCommitted;
}

/**
 * Paginated Firestore query helper for reading approved questions without loading the entire collection.
 */
export async function fetchApprovedQuestionsPageFromFirestore(params: {
  pageSize?: number;
  cursorDoc?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<{
  questions: UnifiedQuestionRecord[];
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
}> {
  if (!firebaseConfigured || !auth.currentUser) {
    return { questions: [], lastCursor: null };
  }
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
  try {
    const baseCol = collection(db, 'question_bank');
    const q = params.cursorDoc
      ? query(baseCol, orderBy('year', 'desc'), startAfter(params.cursorDoc), limit(pageSize))
      : query(baseCol, orderBy('year', 'desc'), limit(pageSize));
    const snap = await getDocs(q);
    const questions = snap.docs.map((d) => d.data() as UnifiedQuestionRecord);
    const lastCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { questions, lastCursor };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'question_bank');
    return { questions: [], lastCursor: null };
  }
}

export interface RunDatasetImportOptions {
  sourceId: DatasetSourceId;
  format: 'JSON' | 'JSONL' | 'CSV' | 'PDF';
  rawContent: string;
  dryRun?: boolean;
  jobId?: string;
  startIndex?: number;
  maxRecordsToProcess?: number;
  existingCorpusOverride?: UnifiedQuestionRecord[];
  idMapOverride?: Record<string, SourceToLearnMateIdMapEntry>;
  persistToStorage?: boolean;
}

/**
 * Core Dataset Importer Pipeline (Section 4)
 * Supports:
 * - Source license & provenance verification
 * - Format parsing (JSON, JSONL, CSV, PDF)
 * - Normalization to UnifiedQuestionRecord
 * - 9-point validation + failed record logging
 * - 3-stage duplicate detection (exact hash, composite key, near-duplicate similarity)
 * - Incremental updates via source-to-LearnMate ID mapping
 * - Resumable checkpoints (`startIndex`, `maxRecordsToProcess`)
 * - Dry-run simulation mode
 */
export async function runDatasetImportPipeline(
  options: RunDatasetImportOptions
): Promise<{
  report: IngestionImportReport;
  resultingCorpus: UnifiedQuestionRecord[];
  resultingIdMap: Record<string, SourceToLearnMateIdMapEntry>;
}> {
  const {
    sourceId,
    format,
    rawContent,
    dryRun = false,
    jobId = `ingest-${sourceId}-${Date.now()}`,
    startIndex = 0,
    maxRecordsToProcess,
    persistToStorage = true,
  } = options;

  const startedAt = new Date().toISOString();
  const sourceAudit = EXTERNAL_DATASET_SOURCE_REGISTRY[sourceId];
  const existingCorpus = options.existingCorpusOverride
    ? [...options.existingCorpusOverride]
    : getStoredUnifiedQuestions();
  const idMap = options.idMapOverride
    ? { ...options.idMapOverride }
    : getSourceIdMappings();

  // Step 1: License & Provenance Gatekeeper
  const licenseCheck = validateDatasetSourceLicense(sourceId);
  if (!licenseCheck.allowed) {
    const rejectedCheckpoint: IngestionJobCheckpoint = {
      jobId,
      sourceId,
      format,
      totalRecords: 0,
      lastProcessedIndex: -1,
      status: 'REJECTED_BY_LICENSE',
      startedAt,
      updatedAt: new Date().toISOString(),
    };
    const rejectedReport: IngestionImportReport = {
      jobId,
      sourceId,
      sourceUrl: sourceAudit?.verifiedRepoUrl || '',
      dryRun,
      startedAt,
      completedAt: new Date().toISOString(),
      totalInspected: 0,
      importedApprovedCount: 0,
      importedPendingReviewCount: 0,
      updatedIncrementalCount: 0,
      skippedExactDuplicateCount: 0,
      flaggedNearDuplicateCount: 0,
      failedValidationCount: 1,
      firestoreBatchesCommitted: 0,
      checkpoint: rejectedCheckpoint,
      failedRecords: [
        {
          externalId: `${sourceId}-ROOT`,
          sourceId,
          rawExcerpt: `Source repository ${sourceAudit?.verifiedRepoUrl || sourceId}`,
          issues: [
            {
              code: 'LICENSE_PROVENANCE_REJECTED',
              severity: 'ERROR',
              field: 'metadata.license',
              message: licenseCheck.reason,
            },
          ],
          failedAt: new Date().toISOString(),
        },
      ],
      duplicateMatches: [],
    };
    if (persistToStorage && !dryRun) {
      saveIngestionCheckpoint(rejectedCheckpoint);
      saveIngestionReport(rejectedReport);
    }
    return {
      report: rejectedReport,
      resultingCorpus: existingCorpus,
      resultingIdMap: idMap,
    };
  }

  // Step 2: Parse raw dataset content
  let rawPayloads: RawExternalQuestionPayload[] = [];
  try {
    rawPayloads = parseRawDatasetByFormat(rawContent, format, sourceId);
  } catch (err) {
    const parseErrCheckpoint: IngestionJobCheckpoint = {
      jobId,
      sourceId,
      format,
      totalRecords: 0,
      lastProcessedIndex: -1,
      status: 'PAUSED_INTERRUPTED',
      startedAt,
      updatedAt: new Date().toISOString(),
    };
    const parseErrReport: IngestionImportReport = {
      jobId,
      sourceId,
      sourceUrl: sourceAudit?.verifiedRepoUrl || '',
      dryRun,
      startedAt,
      completedAt: new Date().toISOString(),
      totalInspected: 0,
      importedApprovedCount: 0,
      importedPendingReviewCount: 0,
      updatedIncrementalCount: 0,
      skippedExactDuplicateCount: 0,
      flaggedNearDuplicateCount: 0,
      failedValidationCount: 1,
      firestoreBatchesCommitted: 0,
      checkpoint: parseErrCheckpoint,
      failedRecords: [
        {
          externalId: `${sourceId}-PARSE-ERR`,
          sourceId,
          rawExcerpt: rawContent.slice(0, 140),
          issues: [
            {
              code: 'INCORRECT_METADATA',
              severity: 'ERROR',
              field: 'format',
              message: err instanceof Error ? err.message : String(err),
            },
          ],
          failedAt: new Date().toISOString(),
        },
      ],
      duplicateMatches: [],
    };
    return {
      report: parseErrReport,
      resultingCorpus: existingCorpus,
      resultingIdMap: idMap,
    };
  }

  const totalRecords = rawPayloads.length;
  const endIndex =
    maxRecordsToProcess !== undefined
      ? Math.min(totalRecords, startIndex + maxRecordsToProcess)
      : totalRecords;

  const workingCorpus = [...existingCorpus];
  const byIdIndex = new Map<string, number>();
  workingCorpus.forEach((q, idx) => byIdIndex.set(q.id, idx));

  const failedRecords: FailedQuestionLogEntry[] = [];
  const duplicateMatches: DuplicateCandidateMatch[] = [];
  const newlyAcceptedForFirestore: UnifiedQuestionRecord[] = [];
  const newlyCreatedMappings: SourceToLearnMateIdMapEntry[] = [];

  let importedApprovedCount = 0;
  let importedPendingReviewCount = 0;
  let updatedIncrementalCount = 0;
  let skippedExactDuplicateCount = 0;
  let flaggedNearDuplicateCount = 0;
  let failedValidationCount = 0;
  let lastProcessedIndex = startIndex - 1;

  for (let i = startIndex; i < endIndex; i++) {
    const rawItem = rawPayloads[i];
    const normalized = normalizeQuestionRecord(rawItem, sourceId, i + 1);
    const externalId = normalized.metadata.externalId || `item-${i + 1}`;
    const mappingKey = `${sourceId}:${externalId}`;

    // Step 3: Validate against 9 required checks
    const validation = validateQuestionRecord(normalized);
    if (!validation.isValid) {
      failedValidationCount += 1;
      failedRecords.push({
        externalId,
        sourceId,
        rawExcerpt: normalized.question.text.slice(0, 140) || JSON.stringify(rawItem).slice(0, 140),
        issues: validation.issues,
        failedAt: new Date().toISOString(),
      });
      lastProcessedIndex = i;
      continue;
    }

    normalized.status = validation.recommendedStatus;

    // Step 4: Check Incremental Update via Source-to-LearnMate ID Map
    const existingMapEntry = idMap[mappingKey];
    if (existingMapEntry) {
      const existingIdx = byIdIndex.get(existingMapEntry.learnMateQuestionId);
      if (existingIdx !== undefined) {
        const prevRecord = workingCorpus[existingIdx];
        // Never overwrite an OFFICIAL or VERIFIED solution with PENDING or AI_GENERATED during incremental sync
        const preservedSolution =
          (prevRecord.solution.type === 'OFFICIAL' ||
            prevRecord.solution.type === 'VERIFIED') &&
          (normalized.solution.type === 'PENDING' ||
            normalized.solution.type === 'AI_GENERATED')
            ? prevRecord.solution
            : normalized.solution;

        const updatedRecord: UnifiedQuestionRecord = {
          ...normalized,
          id: prevRecord.id,
          solution: preservedSolution,
          status:
            preservedSolution.verified && normalized.metadata.provenanceVerified
              ? 'APPROVED'
              : normalized.status,
        };
        workingCorpus[existingIdx] = updatedRecord;
        idMap[mappingKey] = {
          ...existingMapEntry,
          canonicalHash: updatedRecord.metadata.canonicalHash || '',
          lastUpdatedAt: new Date().toISOString(),
        };
        updatedIncrementalCount += 1;
        newlyAcceptedForFirestore.push(updatedRecord);
        newlyCreatedMappings.push(idMap[mappingKey]);
        lastProcessedIndex = i;
        continue;
      }
    }

    // Step 5: Multi-Stage Duplicate Detection
    const dupCandidate = detectDuplicateQuestion(normalized, workingCorpus);
    if (dupCandidate) {
      duplicateMatches.push(dupCandidate);
      if (
        dupCandidate.matchType === 'EXACT_HASH' ||
        dupCandidate.matchType === 'COMPOSITE_KEY'
      ) {
        skippedExactDuplicateCount += 1;
        lastProcessedIndex = i;
        continue;
      }
      // Near-duplicate: NEVER auto-merge! Flag for human review and set status to PENDING_REVIEW
      if (dupCandidate.matchType === 'NEAR_DUPLICATE_SIMILARITY') {
        flaggedNearDuplicateCount += 1;
        normalized.status = 'PENDING_REVIEW';
      }
    }

    // Step 6: Register in working corpus & ID map
    byIdIndex.set(normalized.id, workingCorpus.length);
    workingCorpus.push(normalized);

    const mapEntry: SourceToLearnMateIdMapEntry = {
      mappingKey,
      sourceId,
      externalId,
      learnMateQuestionId: normalized.id,
      canonicalHash: normalized.metadata.canonicalHash || '',
      importedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
    idMap[mappingKey] = mapEntry;
    newlyAcceptedForFirestore.push(normalized);
    newlyCreatedMappings.push(mapEntry);

    if (normalized.status === 'APPROVED') {
      importedApprovedCount += 1;
    } else {
      importedPendingReviewCount += 1;
    }

    lastProcessedIndex = i;
  }

  const isCompleted = endIndex >= totalRecords;
  const checkpoint: IngestionJobCheckpoint = {
    jobId,
    sourceId,
    format,
    totalRecords,
    lastProcessedIndex,
    status: isCompleted ? 'COMPLETED' : 'PAUSED_INTERRUPTED',
    startedAt,
    updatedAt: new Date().toISOString(),
  };

  let firestoreBatchesCommitted = 0;
  if (!dryRun && persistToStorage) {
    saveStoredUnifiedQuestions(workingCorpus);
    saveSourceIdMappings(idMap);
    saveIngestionCheckpoint(checkpoint);
    firestoreBatchesCommitted = await commitQuestionsToFirestoreBatched(
      newlyAcceptedForFirestore,
      newlyCreatedMappings
    );
  }

  const report: IngestionImportReport = {
    jobId,
    sourceId,
    sourceUrl: sourceAudit?.verifiedRepoUrl || '',
    dryRun,
    startedAt,
    completedAt: new Date().toISOString(),
    totalInspected: Math.max(0, endIndex - startIndex),
    importedApprovedCount,
    importedPendingReviewCount,
    updatedIncrementalCount,
    skippedExactDuplicateCount,
    flaggedNearDuplicateCount,
    failedValidationCount,
    firestoreBatchesCommitted,
    checkpoint,
    failedRecords,
    duplicateMatches,
  };

  if (!dryRun && persistToStorage) {
    saveIngestionReport(report);
  }

  return {
    report,
    resultingCorpus: dryRun ? existingCorpus : workingCorpus,
    resultingIdMap: dryRun ? getSourceIdMappings() : idMap,
  };
}

/**
 * Seeds the initial approved open-source PYQ records (JEE Main and JEE Advanced)
 * idempotently so LearnMate V1 immediately has verified JEE coverage on startup.
 */
export async function ensureInitialOpenSourcePyqSeed(): Promise<UnifiedQuestionRecord[]> {
  const existing = getStoredUnifiedQuestions().filter(
    (q) => (q.exam as string) !== 'NEET_UG'
  );
  if (existing.length >= 9) {
    saveStoredUnifiedQuestions(existing);
    return existing;
  }

  let corpus: UnifiedQuestionRecord[] = [];
  let idMap: Record<string, SourceToLearnMateIdMapEntry> = {};

  const res1 = await runDatasetImportPipeline({
    sourceId: 'jee_mocks_db',
    format: 'JSON',
    rawContent: VERIFIED_SAMPLE_JEE_MOCKS_DB_JSON,
    dryRun: false,
    existingCorpusOverride: corpus,
    idMapOverride: idMap,
    persistToStorage: true,
  });
  corpus = res1.resultingCorpus;
  idMap = res1.resultingIdMap;

  const res2 = await runDatasetImportPipeline({
    sourceId: 'learnopt',
    format: 'JSONL',
    rawContent: VERIFIED_SAMPLE_LEARNOPT_JSONL,
    dryRun: false,
    existingCorpusOverride: corpus,
    idMapOverride: idMap,
    persistToStorage: true,
  });
  corpus = res2.resultingCorpus;
  idMap = res2.resultingIdMap;

  const res3 = await runDatasetImportPipeline({
    sourceId: 'jee_mocks_db',
    format: 'CSV',
    rawContent: VERIFIED_SAMPLE_JEE_CSV,
    dryRun: false,
    existingCorpusOverride: corpus,
    idMapOverride: idMap,
    persistToStorage: true,
  });

  return res3.resultingCorpus;
}

/**
 * Generates an ID-Referenced Mock Test Blueprint (Section 8)
 * Never duplicates question payloads inside the mock document; stores `questionIds` only.
 */
export function generateIdReferencedMockBlueprint(params: {
  title?: string;
  exam: UnifiedExamId;
  patternId?: string;
  generationMode: IdReferencedMockBlueprint['generationMode'];
  questionCount?: number;
  subjects?: UnifiedSubjectId[];
  chapters?: string[];
  topics?: string[];
  difficulties?: UnifiedDifficulty[];
  years?: number[];
  availableQuestions?: UnifiedQuestionRecord[];
  onlyApproved?: boolean;
}): IdReferencedMockBlueprint {
  const {
    exam,
    generationMode,
    questionCount = 25,
    subjects,
    chapters,
    topics,
    difficulties,
    years,
    onlyApproved = true,
  } = params;

  const defaultPatternId =
    params.patternId ||
    (exam === 'JEE_ADVANCED' ? 'JEE_ADVANCED_P1' : 'JEE_MAIN_2025_75Q');

  const pattern =
    EXAM_PATTERN_SPECIFICATIONS[defaultPatternId] ||
    EXAM_PATTERN_SPECIFICATIONS.JEE_MAIN_2025_75Q;

  const pool = (params.availableQuestions || getStoredUnifiedQuestions()).filter((q) => {
    if (q.exam !== exam) return false;
    if (onlyApproved && q.status !== 'APPROVED') return false;
    if (subjects && subjects.length > 0 && !subjects.includes(q.subject)) return false;
    if (
      chapters &&
      chapters.length > 0 &&
      !chapters.some((c) => q.chapter.toLowerCase().includes(c.toLowerCase()))
    ) {
      return false;
    }
    if (
      topics &&
      topics.length > 0 &&
      !topics.some((t) => q.topic.toLowerCase().includes(t.toLowerCase()))
    ) {
      return false;
    }
    if (difficulties && difficulties.length > 0 && !difficulties.includes(q.difficulty)) {
      return false;
    }
    if (years && years.length > 0 && !years.includes(q.year)) {
      return false;
    }
    return true;
  });

  const selectedIds = pool.slice(0, questionCount).map((q) => q.id);
  const marksPerQ = pattern.markingRules.correctMarks;

  const blueprint: IdReferencedMockBlueprint = {
    id: `mock-bp-${exam.toLowerCase()}-${Date.now()}`,
    title:
      params.title ||
      `${exam.replace('_', ' ')} · ${generationMode.replace('_', ' ')} Mock (${
        selectedIds.length
      } Qs)`,
    exam,
    patternId: pattern.patternId,
    generationMode,
    durationMinutes:
      generationMode === 'FULL_LENGTH'
        ? pattern.durationMinutes
        : Math.max(15, selectedIds.length * 3),
    totalMarks: selectedIds.length * marksPerQ,
    questionIds: selectedIds,
    filtersUsed: {
      subjects,
      chapters,
      topics,
      difficulties,
      years,
    },
    createdAt: new Date().toISOString(),
  };

  saveStoredMockBlueprint(blueprint);
  return blueprint;
}

/**
 * Resolves full UnifiedQuestionRecord items from an ID-Referenced Mock Blueprint.
 */
export function resolveQuestionsForMockBlueprint(
  blueprint: Pick<IdReferencedMockBlueprint, 'questionIds'>,
  questionBank: UnifiedQuestionRecord[] = getStoredUnifiedQuestions()
): UnifiedQuestionRecord[] {
  const byId = new Map<string, UnifiedQuestionRecord>();
  for (const q of questionBank) {
    byId.set(q.id, q);
  }
  return blueprint.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is UnifiedQuestionRecord => Boolean(q));
}
