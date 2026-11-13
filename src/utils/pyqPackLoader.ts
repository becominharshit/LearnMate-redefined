import type { ExamTrackId } from '../data/jeeSyllabusAndNotes';
import {
  MARKING_RULES,
  type PyqCorpusQuestion,
  type PyqQuestionFormat,
} from './pyqCorpusEngine';
import type { JeeSubject } from './jeeSubjects';

export interface PyqPackIndexEntry {
  packId: string;
  title: string;
  exam: 'jee_main' | 'jee_advanced';
  year: number;
  session: string;
  shift: string;
  questionCount: number;
  file: string;
  collectionKind: 'original_practice';
  sourceCategory: 'ORIGINAL_EDITORIAL';
}

export interface PyqPackIndex {
  version: string;
  totalPacks: number;
  totalQuestions: number;
  provenanceNote: string;
  packs: PyqPackIndexEntry[];
}

export interface PyqPackQuestionItem {
  id: string;
  subject: JeeSubject;
  section: 'A' | 'B' | 'Section 1' | 'Section 2' | 'Section 3';
  chapterId: string;
  chapterName: string;
  topicName: string;
  format: PyqQuestionFormat;
  questionType: 'mcq_single' | 'mcq_multiple' | 'numerical';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prompt: string;
  options?: string[];
  correctOptionIndices?: number[];
  numericalAnswer?: number;
  numericalTolerance?: number;
  detailedSolution: string;
  keyFormula: string;
  commonMistakeTrap: string;
}

export interface PyqPackFile {
  packId: string;
  title: string;
  exam: 'jee_main' | 'jee_advanced';
  year: number;
  session: string;
  examDate: string;
  shift: string;
  collectionKind: 'original_practice';
  sourceCategory: 'ORIGINAL_EDITORIAL';
  isFakeShiftAssignment: false;
  questions: PyqPackQuestionItem[];
}

const IDB_NAME = 'learnmate_pyq_packs_v1';
const IDB_STORE = 'packs';
const memoryPackCache = new Map<string, PyqPackFile>();
let cachedIndex: PyqPackIndex | null = null;

function openPackDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'packId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readPackFromIdb(packId: string): Promise<PyqPackFile | null> {
  const db = await openPackDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(packId);
      req.onsuccess = () => resolve((req.result as PyqPackFile | undefined) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writePackToIdb(pack: PyqPackFile): Promise<void> {
  const db = await openPackDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(pack);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function fetchPyqPackIndex(forceRefresh = false): Promise<PyqPackIndex> {
  if (cachedIndex && !forceRefresh) {
    return cachedIndex;
  }
  const resp = await fetch('/pyq-packs/index.json');
  if (!resp.ok) {
    throw new Error(`Failed to fetch PYQ pack index (${resp.status})`);
  }
  const data = (await resp.json()) as PyqPackIndex;
  cachedIndex = data;
  return data;
}

export async function loadPyqPack(
  entryOrPackId: PyqPackIndexEntry | string
): Promise<PyqPackFile> {
  const packId = typeof entryOrPackId === 'string' ? entryOrPackId : entryOrPackId.packId;
  const memHit = memoryPackCache.get(packId);
  if (memHit) return memHit;

  const idbHit = await readPackFromIdb(packId);
  if (idbHit && Array.isArray(idbHit.questions) && idbHit.questions.length > 0) {
    memoryPackCache.set(packId, idbHit);
    return idbHit;
  }

  let filePath = typeof entryOrPackId === 'string' ? `/pyq-packs/${packId}.json` : entryOrPackId.file;
  if (!filePath.startsWith('/')) {
    filePath = `/pyq-packs/${filePath}`;
  }

  const resp = await fetch(filePath);
  if (!resp.ok) {
    throw new Error(`Failed to load PYQ pack ${packId} (${resp.status})`);
  }
  const pack = (await resp.json()) as PyqPackFile;
  // Enforce strict provenance flags on read
  const normalized: PyqPackFile = {
    ...pack,
    collectionKind: 'original_practice',
    sourceCategory: 'ORIGINAL_EDITORIAL',
    isFakeShiftAssignment: false,
  };
  memoryPackCache.set(packId, normalized);
  await writePackToIdb(normalized);
  return normalized;
}

export function packQuestionToCorpusQuestion(
  item: PyqPackQuestionItem,
  pack: PyqPackFile,
  indexNumber: number
): PyqCorpusQuestion {
  const isAdvanced = pack.exam === 'jee_advanced';
  const examTrack: ExamTrackId = isAdvanced ? 'jee_advanced' : 'jee_main';

  const markingRule =
    item.questionType === 'mcq_multiple'
      ? MARKING_RULES.jee_adv_multi
      : item.questionType === 'numerical'
      ? isAdvanced
        ? MARKING_RULES.jee_adv_integer
        : MARKING_RULES.jee_main_numerical
      : isAdvanced
      ? MARKING_RULES.jee_adv_single
      : MARKING_RULES.jee_main_mcq;

  return {
    id: item.id,
    canonicalHash: `pack-${pack.packId}-${item.id}`,
    paperId: pack.packId,
    exam: examTrack,
    year: pack.year,
    session: pack.session,
    examDate: pack.examDate,
    shift: pack.shift,
    shiftLabel: `${isAdvanced ? 'JEE Advanced' : 'JEE Main'} ${pack.year} · ${pack.shift} (Practice Pack)`,
    subject: item.subject,
    section: item.section,
    chapterId: item.chapterId,
    chapterName: item.chapterName,
    chapterTitle: `${item.subject} · ${item.chapterName}`,
    topicName: item.topicName,
    format: item.format,
    questionType: item.questionType,
    questionNumber: indexNumber,
    officialQuestionId: item.id.toUpperCase(),
    sourceCategory: 'ORIGINAL_EDITORIAL',
    collectionKind: 'original_practice',
    verificationMetadata: {
      provenanceVerified: false,
      verificationConfidence: 0.9,
      reviewerStatus: 'editorial_reviewed',
      solutionSource: 'LearnMate Original Editorial Practice Pack',
      licenseStatus: 'ORIGINAL_EDITORIAL_MIT',
      rightsStatus: 'ORIGINAL_EDITORIAL_MIT',
      isFakeShiftAssignment: false,
    },
    prompt: item.prompt,
    stem: item.prompt,
    options: item.options ? [...item.options] : undefined,
    correctOptionIndices: item.correctOptionIndices ? [...item.correctOptionIndices] : undefined,
    numericalAnswer: item.numericalAnswer,
    correctNumericalValue: item.numericalAnswer,
    numericalTolerance: item.numericalTolerance ?? 0.05,
    keyStatus: 'normal',
    markingRule,
    markingRuleId: markingRule.id,
    answerKeyVersion: `editorial-pack-${pack.packId}-v1`,
    solutionOrigin: 'LearnMate Original Editorial Solution',
    detailedSolution: item.detailedSolution,
    solutionExplanation: item.detailedSolution,
    keyFormula: item.keyFormula,
    commonMistakeTrap: item.commonMistakeTrap,
    commonTrap: item.commonMistakeTrap,
    difficulty: item.difficulty,
    sourceProvenance: `${pack.title} · Original Editorial Shift-Pattern Practice`,
    versionHistory: [
      {
        version: '1.0',
        date: pack.examDate,
        note: 'Loaded from lazy static PYQ practice pack (strictly ORIGINAL_EDITORIAL provenance).',
      },
    ],
  };
}

export function clearPyqPackMemoryCache(): void {
  memoryPackCache.clear();
  cachedIndex = null;
}
