import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  type User,
} from '../firebase';
import type {
  StudyDocument,
  TutorMessage,
  VoiceTurn,
  QuizQuestion,
  QuizAttempt,
  MistakeInsight,
  RevisionTask,
  QuickReviseBundle,
  YouTubeRecommendation,
  StudyTimerState,
  FocusSessionRecord,
  ThemeMode,
  SourceControlMode,
  LearnMateNotification,
  NotebookEntry,
  CreativeAsset,
  StudyPlannerTask,
  AccessibilitySettings,
  CourseLibraryItem,
  PdfAnnotationItem,
  StudentAcademicProfile,
} from '../types/study';
import { computeContentVersion } from '../utils/quizGrading';
import {
  DEFAULT_STUDENT_PROFILE,
  isProfileSetupComplete,
  normalizeStudentProfile,
  profileNeedsMigration,
} from '../utils/studentProfile';
import {
  integrateConceptCheckWithMistakeDna,
  mergeConceptCheckAttempts,
  mergeTopicMasteryMaps,
  type ConceptCheckAttemptRecord,
  type SceneConceptMasteryState,
} from '../utils/educationalSpecsEngine';
import {
  computeUtf8ByteSize,
  truncateStringToUtf8Bytes,
  type HandwrittenNoteDocument,
} from '../utils/phase6Engine';
import { indexedDbStorage } from './indexedDbStorage';

export { DEFAULT_STUDENT_PROFILE } from '../utils/studentProfile';

export interface StudentDataExportArchive {
  schemaVersion: string;
  exportedAt: string;
  ownerUid: string | null;
  studentProfile: StudentAcademicProfile;
  documents: StudyDocument[];
  quizAttempts: QuizAttempt[];
  conceptCheckAttempts: ConceptCheckAttemptRecord[];
  handwrittenNotes: HandwrittenNoteDocument[];
  creativeAssets: CreativeAsset[];
  notebookEntries: NotebookEntry[];
  studyPlannerTasks: StudyPlannerTask[];
  focusSessions: FocusSessionRecord[];
  perDocumentState: Record<
    string,
    {
      tutorMessages: TutorMessage[];
      voiceTutorMessages: VoiceTurn[];
      mistakes: MistakeInsight[];
      revisionPlan: RevisionTask[];
      quickRevise: QuickReviseBundle | null;
      pdfAnnotations: PdfAnnotationItem[];
    }
  >;
}

export interface AccountDeletionResult {
  deletedLocalKeysCount: number;
  deletedIndexedDbRecordsCount: number;
  deletedCloudDocumentsCount: number;
  completedAt: string;
}

export type CloudSyncState = 'local_only' | 'synced' | 'pending_offline' | 'sync_failed';

export interface CloudSyncStatus {
  state: CloudSyncState;
  pendingDocumentIds: string[];
  lastSyncedAt: string | null;
  lastError: string | null;
}

/**
 * Storage repository interface supporting both local browser persistence
 * and authenticated Cloud Firestore persistence with automatic migration.
 */
export interface IStudyStorageRepository {
  getDocuments(): StudyDocument[];
  getDocumentById(id: string): StudyDocument | null;
  saveDocument(doc: StudyDocument): void;
  renameDocument(id: string, newTitle: string): StudyDocument | null;
  deleteDocument(id: string): void;
  getActiveDocumentId(): string | null;
  setActiveDocumentId(id: string | null): void;

  getTutorMessages(documentId: string): TutorMessage[];
  saveTutorMessages(documentId: string, messages: TutorMessage[]): void;

  getCachedQuiz(documentId: string, mode: string): QuizQuestion[] | null;
  saveCachedQuiz(documentId: string, mode: string, questions: QuizQuestion[]): void;

  getQuizAttempts(documentId?: string): QuizAttempt[];
  saveQuizAttempt(attempt: QuizAttempt): void;

  getMistakeInsights(documentId: string): MistakeInsight[];
  saveMistakeInsights(documentId: string, mistakes: MistakeInsight[]): void;

  getRevisionPlan(documentId: string): RevisionTask[];
  saveRevisionPlan(documentId: string, tasks: RevisionTask[]): void;

  getQuickReviseBundle(documentId: string, contentVersion?: string): QuickReviseBundle | null;
  saveQuickReviseBundle(bundle: QuickReviseBundle): void;

  getCachedYouTubeRecommendations(cacheKey: string): YouTubeRecommendation[] | null;
  saveCachedYouTubeRecommendations(cacheKey: string, videos: YouTubeRecommendation[]): void;

  getStudyTimerState(): StudyTimerState;
  saveStudyTimerState(state: StudyTimerState): void;

  getFocusSessions(documentId?: string): FocusSessionRecord[];
  saveFocusSession(session: FocusSessionRecord): void;

  getThemeMode(): ThemeMode;
  saveThemeMode(mode: ThemeMode): void;

  getSourceControlMode(): SourceControlMode;
  saveSourceControlMode(mode: SourceControlMode): void;

  getNotifications(): LearnMateNotification[];
  addNotification(notification: Omit<LearnMateNotification, 'id' | 'createdAt' | 'read'>): LearnMateNotification;
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  clearNotifications(): void;

  getNotebookEntries(): NotebookEntry[];
  saveNotebookEntry(entry: NotebookEntry): void;
  deleteNotebookEntry(id: string): void;

  getCreativeAssets(documentId?: string): CreativeAsset[];
  saveCreativeAsset(asset: CreativeAsset): void;
  deleteCreativeAsset(id: string): void;

  getStudyPlannerTasks(): StudyPlannerTask[];
  saveStudyPlannerTasks(tasks: StudyPlannerTask[]): void;

  getAccessibilitySettings(): AccessibilitySettings;
  saveAccessibilitySettings(settings: AccessibilitySettings): void;

  getPdfAnnotations(documentId: string): PdfAnnotationItem[];
  savePdfAnnotations(documentId: string, annotations: PdfAnnotationItem[]): void;

  getVoiceTutorMessages(documentId: string): VoiceTurn[];
  saveVoiceTutorMessages(documentId: string, messages: VoiceTurn[]): void;

  getStudentProfile(): StudentAcademicProfile;
  saveStudentProfile(profile: StudentAcademicProfile): StudentAcademicProfile;

  getConceptCheckAttempts(documentId?: string, topic?: string): ConceptCheckAttemptRecord[];
  saveConceptCheckAttempt(
    attempt: ConceptCheckAttemptRecord,
    sceneState: SceneConceptMasteryState
  ): {
    evidenceLevel:
      | 'no_evidence_skipped'
      | 'positive_mastery'
      | 'recovered_after_reteaching'
      | 'limited_single_error'
      | 'repeated_misconception';
    mistakeDnaUpdated: boolean;
  };
  getLessonMasteryState(
    documentId: string,
    topic: string
  ): Record<number, SceneConceptMasteryState> | null;
  saveLessonMasteryState(
    documentId: string,
    topic: string,
    state: Record<number, SceneConceptMasteryState>
  ): void;

  /** Saves a student's report about an AI answer to their private area for review. */
  submitAiReport(report: AiContentReport): Promise<void>;

  /** Phase 6 Section 8 — Handwritten Notes Library */
  getHandwrittenNotes(documentId?: string): HandwrittenNoteDocument[];
  saveHandwrittenNote(noteDoc: HandwrittenNoteDocument): void;
  deleteHandwrittenNote(id: string): void;

  /** Phase 6 Section 10 — Student Data Control (Export & Self-Serve Account Deletion) */
  exportStudentDataArchive(): StudentDataExportArchive;
  deleteStudentAccountAndData(): Promise<AccountDeletionResult>;

  /** Returns honest cloud synchronization status and any queued offline documents. */
  getCloudSyncStatus(): CloudSyncStatus;
  /** Retries any pending offline/failed per-document studyState cloud writes. */
  retryPendingCloudSync(): Promise<void>;
  /** Non-destructively archives current account session and switches active local namespace to `uid`. */
  switchLocalAccountSession(uid: string | null): void;

  clearAllProgress(): void;
  syncWithCloudUser(user: User | null): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export type AiReportKind =
  | 'tutor_answer'
  | 'practice_question'
  | 'diagram'
  | 'animated_explanation'
  | 'concept_check';
export type AiReportReason = 'wrong' | 'unclear' | 'inappropriate' | 'other';

export interface AiContentReport {
  kind: AiReportKind;
  reason: AiReportReason;
  note?: string;
  /** The AI text being reported (trimmed to 2,000 characters). */
  excerpt: string;
  documentId?: string;
}

const KEYS = {
  DOCUMENTS: 'learnmate_documents_v1',
  ACTIVE_DOC_ID: 'learnmate_active_doc_id_v1',
  TUTOR_PREFIX: 'learnmate_tutor_v1_',
  VOICE_TUTOR_PREFIX: 'learnmate_voice_tutor_v1_',
  QUIZ_CACHE_PREFIX: 'learnmate_quiz_cache_v1_',
  ATTEMPTS: 'learnmate_quiz_attempts_v1',
  MISTAKES_PREFIX: 'learnmate_mistakes_v1_',
  REVISION_PREFIX: 'learnmate_revision_v1_',
  QUICK_REVISE_PREFIX: 'learnmate_quick_revise_v1_',
  YT_REC_PREFIX: 'learnmate_yt_rec_v1_',
  TIMER_STATE: 'learnmate_study_timer_v1',
  FOCUS_SESSIONS: 'learnmate_focus_sessions_v1',
  THEME: 'learnmate_theme_v1',
  SOURCE_CONTROL_MODE: 'learnmate_source_control_v2',
  NOTIFICATIONS: 'learnmate_notifications_v2',
  NOTEBOOK: 'learnmate_notebook_v2',
  CREATIVE_ASSETS: 'learnmate_creative_assets_v2',
  HANDWRITTEN_NOTES: 'learnmate_handwritten_notes_v1',
  STUDY_PLANNER: 'learnmate_study_planner_v2',
  ACCESSIBILITY: 'learnmate_accessibility_v2',
  PDF_ANNOTATIONS_PREFIX: 'learnmate_pdf_annotations_v1_',
  STUDENT_PROFILE: 'learnmate_student_profile_v1',
  CONCEPT_ATTEMPTS: 'learnmate_concept_attempts_v1',
  CONCEPT_MASTERY_PREFIX: 'learnmate_concept_mastery_v1_',
  PENDING_SYNC_DOCS: 'learnmate_pending_sync_docs_v1',
  ACCOUNT_ARCHIVE_PREFIX: 'learnmate_account_archive_v1_',
  // UID of the signed-in account that owns the private data currently in localStorage.
  OWNER_UID: 'learnmate_owner_uid_v1',
};

const DEFAULT_TIMER_STATE: StudyTimerState = {
  mode: 'study',
  durationMinutes: 25,
  breakMinutes: 5,
  remainingSeconds: 25 * 60,
  isRunning: false,
  targetEndTimestamp: null,
  soundEnabled: true,
  completedSessionsCount: 0,
  activeLofiPresetId: 'rainy-night',
  lofiPlaying: false,
  lofiVolume: 0.45,
};

const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  fontSize: 'normal',
  readingWidth: 'standard',
  highContrast: false,
  reducedMotion: false,
};

if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStore.set(key, String(value)),
    removeItem: (key: string) => memoryStore.delete(key),
    clear: () => memoryStore.clear(),
    key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
    get length() {
      return memoryStore.size;
    },
  } as Storage;
}

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('localStorage write warning:', err);
  }
}

function readOwnerUid(): string | null {
  try {
    return localStorage.getItem(KEYS.OWNER_UID);
  } catch {
    return null;
  }
}

function writeOwnerUid(uid: string): void {
  try {
    localStorage.setItem(KEYS.OWNER_UID, uid);
  } catch {
    // ignore in restricted storage
  }
}

export class HybridCloudStudyRepository implements IStudyStorageRepository {
  private currentUser: User | null = null;
  private previousUid: string | null = null;
  private cloudUnsubscribers: Array<() => void> = [];
  private listeners = new Set<() => void>();
  private cloudSyncState: CloudSyncState = 'local_only';
  private lastSyncedAt: string | null = null;
  private lastSyncError: string | null = null;

  constructor() {
    this.ensureSeeded();
    if (typeof window !== 'undefined') {
      void indexedDbStorage.initializeAndMigrateFromLocalStorage(readOwnerUid() || 'guest');
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('online', () => {
          void this.retryPendingCloudSync();
        });
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // ignore listener error
      }
    }
  }

  private unsubscribeCloudListeners(): void {
    while (this.cloudUnsubscribers.length > 0) {
      const unsub = this.cloudUnsubscribers.pop();
      if (unsub) {
        try {
          unsub();
        } catch {
          // ignore
        }
      }
    }
  }

  private getPendingSyncDocIds(): string[] {
    return safeReadJson<string[]>(KEYS.PENDING_SYNC_DOCS, []);
  }

  private markDocumentPendingSync(documentId: string, errorMessage?: string): void {
    if (!documentId) return;
    const pending = new Set(this.getPendingSyncDocIds());
    pending.add(documentId);
    safeWriteJson(KEYS.PENDING_SYNC_DOCS, Array.from(pending));
    const isOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    this.cloudSyncState = isOffline ? 'pending_offline' : 'sync_failed';
    if (errorMessage) {
      this.lastSyncError = errorMessage;
    }
  }

  private clearDocumentPendingSync(documentId: string): void {
    const pending = this.getPendingSyncDocIds().filter((id) => id !== documentId);
    safeWriteJson(KEYS.PENDING_SYNC_DOCS, pending);
    if (pending.length === 0 && this.currentUser) {
      this.cloudSyncState = 'synced';
      this.lastSyncedAt = new Date().toISOString();
      this.lastSyncError = null;
    }
  }

  getCloudSyncStatus(): CloudSyncStatus {
    const pendingDocumentIds = this.getPendingSyncDocIds();
    let state: CloudSyncState = this.cloudSyncState;
    if (!this.currentUser) {
      state = pendingDocumentIds.length > 0 ? 'pending_offline' : 'local_only';
    } else if (pendingDocumentIds.length > 0 && state === 'synced') {
      state = 'pending_offline';
    }
    return {
      state,
      pendingDocumentIds,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastSyncError,
    };
  }

  async retryPendingCloudSync(): Promise<void> {
    if (!this.currentUser) return;
    const pending = this.getPendingSyncDocIds();
    for (const docId of pending) {
      await this.persistStudyStateToCloud(docId);
    }
  }

  /**
   * Archives all private `learnmate_*` keys belonging to `uid` into a per-account local snapshot
   * so signing out or switching accounts never destructively loses unsynced local work.
   */
  private archivePrivateUserCachesForUid(uid: string): void {
    if (!uid) return;
    try {
      const preservedKeys = new Set<string>([
        KEYS.THEME,
        KEYS.ACCESSIBILITY,
        KEYS.SOURCE_CONTROL_MODE,
        KEYS.OWNER_UID,
      ]);
      const archive: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (preservedKeys.has(key)) continue;
        if (key.startsWith(KEYS.ACCOUNT_ARCHIVE_PREFIX)) continue;
        if (key.startsWith('learnmate_')) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            archive[key] = val;
          }
        }
      }
      safeWriteJson(`${KEYS.ACCOUNT_ARCHIVE_PREFIX}${uid}`, archive);
    } catch {
      // ignore in restricted storage
    }
  }

  /**
   * Restores a previously archived per-account local snapshot for `uid` into active storage.
   */
  private restorePrivateUserCachesForUid(uid: string): void {
    if (!uid) return;
    try {
      const archive = safeReadJson<Record<string, string> | null>(
        `${KEYS.ACCOUNT_ARCHIVE_PREFIX}${uid}`,
        null
      );
      if (!archive || typeof archive !== 'object') return;
      for (const [k, v] of Object.entries(archive)) {
        if (
          k.startsWith('learnmate_') &&
          !k.startsWith(KEYS.ACCOUNT_ARCHIVE_PREFIX) &&
          typeof v === 'string'
        ) {
          localStorage.setItem(k, v);
        }
      }
    } catch {
      // ignore in restricted storage
    }
  }

  /**
   * Clears private user study data, attempts, tutor history, and caches on sign-out or account
   * switch, while preserving device preferences and per-UID encrypted/isolated archives.
   */
  private clearPrivateUserCaches(): void {
    try {
      const preservedKeys = new Set<string>([
        KEYS.THEME,
        KEYS.ACCESSIBILITY,
        KEYS.SOURCE_CONTROL_MODE,
      ]);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (preservedKeys.has(key)) continue;
        if (key.startsWith(KEYS.ACCOUNT_ARCHIVE_PREFIX)) continue;
        if (key.startsWith('learnmate_')) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
      this.ensureSeeded();
    } catch {
      // ignore in restricted storage
    }
  }

  /**
   * Non-destructively archives the previous student's local session and switches the active
   * local namespace to `uid` (or signed-out guest when `uid === null`).
   */
  switchLocalAccountSession(uid: string | null): void {
    const activeOwnerUid = this.previousUid || readOwnerUid();
    if (activeOwnerUid && activeOwnerUid !== uid) {
      this.archivePrivateUserCachesForUid(activeOwnerUid);
      this.clearPrivateUserCaches();
    } else if (!uid && activeOwnerUid) {
      this.archivePrivateUserCachesForUid(activeOwnerUid);
      this.clearPrivateUserCaches();
    }

    if (!uid) {
      this.currentUser = null;
      this.previousUid = null;
      this.cloudSyncState = 'local_only';
      this.ensureSeeded();
      this.notifyListeners();
      return;
    }

    if (activeOwnerUid !== uid) {
      // If switching from guest or another account, clear unowned workspace before restoring target UID
      if (!activeOwnerUid) {
        this.clearPrivateUserCaches();
      }
      this.restorePrivateUserCachesForUid(uid);
    }
    this.previousUid = uid;
    writeOwnerUid(uid);
    this.ensureSeeded();
    this.notifyListeners();
  }

  private ensureSeeded(): void {
    try {
      const existingDocs = safeReadJson<StudyDocument[] | null>(KEYS.DOCUMENTS, null);
      if (existingDocs === null) {
        safeWriteJson(KEYS.DOCUMENTS, []);
      }
      const existingNotifs = safeReadJson<LearnMateNotification[] | null>(
        KEYS.NOTIFICATIONS,
        null
      );
      if (existingNotifs === null) {
        safeWriteJson(KEYS.NOTIFICATIONS, STARTER_NOTIFICATIONS);
      }
      const existingPlanner = safeReadJson<StudyPlannerTask[] | null>(
        KEYS.STUDY_PLANNER,
        null
      );
      if (existingPlanner === null) {
        safeWriteJson(KEYS.STUDY_PLANNER, STARTER_PLANNER_TASKS);
      }
    } catch {
      // ignore in SSR / restricted storage
    }
  }

  private getAllLessonMasteryForDocument(
    documentId: string
  ): Record<string, Record<number, SceneConceptMasteryState>> {
    const map: Record<string, Record<number, SceneConceptMasteryState>> = {};
    if (!documentId) return map;
    const prefix = `${KEYS.CONCEPT_MASTERY_PREFIX}${documentId}__`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const slug = key.slice(prefix.length);
          const state = safeReadJson<Record<number, SceneConceptMasteryState> | null>(key, null);
          if (slug && state && typeof state === 'object') {
            map[slug] = state;
          }
        }
      }
    } catch {
      // ignore
    }
    return map;
  }

  private saveAllLessonMasteryForDocument(
    documentId: string,
    topicMap: Record<string, Record<number, SceneConceptMasteryState>>
  ): void {
    if (!documentId || !topicMap || typeof topicMap !== 'object') return;
    for (const [slug, state] of Object.entries(topicMap)) {
      if (!slug || !state || typeof state !== 'object') continue;
      safeWriteJson(`${KEYS.CONCEPT_MASTERY_PREFIX}${documentId}__${slug}`, state);
    }
  }

  private async persistStudyStateToCloud(documentId: string): Promise<void> {
    if (!documentId) return;
    if (!this.currentUser) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.markDocumentPendingSync(documentId, 'Device is currently offline; changes queued for sync.');
      return;
    }
    const uid = this.currentUser.uid;
    const statePath = `users/${uid}/studyState/${documentId}`;
    try {
      const tutorMessages = this.getTutorMessages(documentId);
      const mistakes = this.getMistakeInsights(documentId);
      const revisionPlan = this.getRevisionPlan(documentId);
      const cachedQuiz = this.getCachedQuiz(documentId, 'diagnostic');
      const quickRevise = this.getQuickReviseBundle(documentId);
      const conceptAttempts = this.getConceptCheckAttempts(documentId);
      const conceptMastery = this.getAllLessonMasteryForDocument(documentId);
      const creativeAssets = this.getCreativeAssets(documentId);

      await setDoc(doc(db, 'users', uid, 'studyState', documentId), {
        documentId,
        uid,
        tutorMessagesJson: truncateStringToUtf8Bytes(JSON.stringify(tutorMessages), 145000),
        mistakesJson: truncateStringToUtf8Bytes(JSON.stringify(mistakes), 95000),
        revisionPlanJson: truncateStringToUtf8Bytes(JSON.stringify(revisionPlan), 95000),
        cachedQuizJson: truncateStringToUtf8Bytes(JSON.stringify(cachedQuiz || []), 95000),
        quickReviseJson: quickRevise
          ? truncateStringToUtf8Bytes(JSON.stringify(quickRevise), 145000)
          : '',
        conceptAttemptsJson: truncateStringToUtf8Bytes(JSON.stringify(conceptAttempts), 115000),
        conceptMasteryJson: truncateStringToUtf8Bytes(JSON.stringify(conceptMastery), 75000),
        creativeAssetsJson: truncateStringToUtf8Bytes(JSON.stringify(creativeAssets), 145000),
        updatedAt: new Date().toISOString(),
      });
      this.clearDocumentPendingSync(documentId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud write failed';
      this.markDocumentPendingSync(documentId, msg);
      handleFirestoreError(err, OperationType.WRITE, statePath);
    }
  }

  private async persistProfileToCloud(profile: StudentAcademicProfile): Promise<void> {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    const profilePath = `users/${uid}`;
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          profileJson: truncateStringToUtf8Bytes(JSON.stringify(profile), 19_500),
          displayName: this.currentUser.displayName || profile.fullName || 'LearnMate Student',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, profilePath);
    }
  }

  private async persistDocumentToCloud(studyDoc: StudyDocument): Promise<void> {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    const docPath = `users/${uid}/documents/${studyDoc.id}`;
    try {
      // Ensure serialized pagesJson fits strictly within 680,000 UTF-8 bytes so total Firestore doc < 880 KB
      let serializedPages = JSON.stringify(studyDoc.pages);
      if (computeUtf8ByteSize(serializedPages) > 680_000) {
        const compactPages = studyDoc.pages.map((p) => ({
          ...p,
          content: truncateStringToUtf8Bytes(p.content, Math.floor(620_000 / Math.max(1, studyDoc.pages.length))),
        }));
        serializedPages = truncateStringToUtf8Bytes(JSON.stringify(compactPages), 680_000);
      }

      const payload: Record<string, unknown> = {
        id: studyDoc.id,
        uid,
        title: truncateStringToUtf8Bytes(studyDoc.title, 280),
        sourceType: studyDoc.sourceType,
        pageCount: Math.max(1, Math.min(120, studyDoc.pageCount)),
        pagesJson: serializedPages,
        topicsJson: truncateStringToUtf8Bytes(JSON.stringify(studyDoc.topics), 140_000),
        overview: truncateStringToUtf8Bytes(studyDoc.overview || '', 9500),
        createdAt: studyDoc.createdAt,
        lastStudiedAt: studyDoc.lastStudiedAt,
      };
      if (studyDoc.youtubeUrl) {
        payload.youtubeUrl = studyDoc.youtubeUrl.slice(0, 1000);
      }
      if (studyDoc.videoId) {
        payload.videoId = studyDoc.videoId.slice(0, 60);
      }
      await setDoc(doc(db, 'users', uid, 'documents', studyDoc.id), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docPath);
    }
  }

  private async persistAttemptToCloud(attempt: QuizAttempt): Promise<void> {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    const attemptPath = `users/${uid}/attempts/${attempt.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'attempts', attempt.id), {
        id: attempt.id,
        uid,
        documentId: attempt.documentId,
        documentTitle: attempt.documentTitle.slice(0, 280),
        mode: attempt.mode,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage,
        attemptJson: JSON.stringify(attempt).slice(0, 480000),
        completedAt: attempt.completedAt,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, attemptPath);
    }
  }

  private mergeDocumentStudyStateSnapshot(
    docId: string,
    sData: Record<string, unknown>,
    uid: string
  ): boolean {
    let changed = false;
    try {
      const localTutor = this.getTutorMessages(docId);
      if (localTutor.length === 0 && typeof sData.tutorMessagesJson === 'string' && sData.tutorMessagesJson) {
        const cloudTutor = JSON.parse(sData.tutorMessagesJson);
        if (Array.isArray(cloudTutor) && cloudTutor.length > 0) {
          safeWriteJson(`${KEYS.TUTOR_PREFIX}${docId}`, cloudTutor);
          changed = true;
        }
      }

      if (typeof sData.mistakesJson === 'string' && sData.mistakesJson) {
        const cloudMistakes = JSON.parse(sData.mistakesJson) as MistakeInsight[];
        if (Array.isArray(cloudMistakes) && cloudMistakes.length > 0) {
          const localMistakes = this.getMistakeInsights(docId);
          const mistakeMap = new Map<string, MistakeInsight>();
          for (const m of cloudMistakes) {
            if (m && m.questionId) mistakeMap.set(m.questionId, m);
          }
          for (const m of localMistakes) {
            if (m && m.questionId) mistakeMap.set(m.questionId, m);
          }
          if (mistakeMap.size !== localMistakes.length) {
            safeWriteJson(`${KEYS.MISTAKES_PREFIX}${docId}`, Array.from(mistakeMap.values()));
            changed = true;
          }
        }
      }

      if (typeof sData.revisionPlanJson === 'string' && sData.revisionPlanJson) {
        const cloudPlan = JSON.parse(sData.revisionPlanJson) as RevisionTask[];
        if (Array.isArray(cloudPlan) && cloudPlan.length > 0) {
          const localPlan = this.getRevisionPlan(docId);
          const planMap = new Map<string, RevisionTask>();
          for (const t of cloudPlan) {
            if (t && t.id) planMap.set(t.id, t);
          }
          for (const t of localPlan) {
            if (t && t.id) {
              const existing = planMap.get(t.id);
              const existingTs = existing ? Date.parse(existing.updatedAt) || 0 : 0;
              const localTs = Date.parse(t.updatedAt) || 0;
              if (!existing || localTs >= existingTs) {
                planMap.set(t.id, t);
              }
            }
          }
          if (planMap.size !== localPlan.length) {
            safeWriteJson(`${KEYS.REVISION_PREFIX}${docId}`, Array.from(planMap.values()));
            changed = true;
          }
        }
      }

      const localQuick = this.getQuickReviseBundle(docId);
      if (!localQuick && typeof sData.quickReviseJson === 'string' && sData.quickReviseJson) {
        const cloudQuick = JSON.parse(sData.quickReviseJson);
        if (cloudQuick && cloudQuick.documentId) {
          safeWriteJson(`${KEYS.QUICK_REVISE_PREFIX}${docId}`, cloudQuick);
          changed = true;
        }
      }

      if (typeof sData.conceptAttemptsJson === 'string' && sData.conceptAttemptsJson) {
        const cloudConceptAttempts = JSON.parse(sData.conceptAttemptsJson) as ConceptCheckAttemptRecord[];
        if (Array.isArray(cloudConceptAttempts) && cloudConceptAttempts.length > 0) {
          const allLocal = safeReadJson<ConceptCheckAttemptRecord[]>(KEYS.CONCEPT_ATTEMPTS, []);
          const otherDocsLocal = allLocal.filter((a) => a.documentId !== docId);
          const thisDocLocal = allLocal.filter((a) => a.documentId === docId);
          const mergedDocAttempts = mergeConceptCheckAttempts(
            thisDocLocal,
            cloudConceptAttempts,
            uid
          );
          if (mergedDocAttempts.length !== thisDocLocal.length) {
            const combined = [...mergedDocAttempts, ...otherDocsLocal]
              .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
              .slice(0, 500);
            safeWriteJson(KEYS.CONCEPT_ATTEMPTS, combined);
            changed = true;
          }
        }
      }

      if (typeof sData.conceptMasteryJson === 'string' && sData.conceptMasteryJson) {
        const cloudMastery = JSON.parse(sData.conceptMasteryJson) as Record<
          string,
          Record<number, SceneConceptMasteryState>
        >;
        if (cloudMastery && typeof cloudMastery === 'object') {
          const localMastery = this.getAllLessonMasteryForDocument(docId);
          const mergedMastery = mergeTopicMasteryMaps(localMastery, cloudMastery);
          this.saveAllLessonMasteryForDocument(docId, mergedMastery);
          changed = true;
        }
      }

      if (typeof sData.creativeAssetsJson === 'string' && sData.creativeAssetsJson) {
        const cloudAssets = JSON.parse(sData.creativeAssetsJson) as CreativeAsset[];
        if (Array.isArray(cloudAssets) && cloudAssets.length > 0) {
          const allLocalAssets = safeReadJson<CreativeAsset[]>(KEYS.CREATIVE_ASSETS, []);
          const assetMap = new Map<string, CreativeAsset>();
          for (const a of allLocalAssets) {
            if (a && a.id) assetMap.set(a.id, a);
          }
          for (const ca of cloudAssets) {
            if (ca && ca.id) {
              const existing = assetMap.get(ca.id);
              const existingTs = existing ? Date.parse(existing.createdAt) || 0 : 0;
              const cloudTs = Date.parse(ca.createdAt) || 0;
              if (!existing || cloudTs > existingTs) {
                assetMap.set(ca.id, ca);
                changed = true;
              }
            }
          }
          if (changed) {
            const sortedAssets = Array.from(assetMap.values()).sort(
              (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
            );
            safeWriteJson(KEYS.CREATIVE_ASSETS, sortedAssets);
          }
        }
      }
    } catch {
      // ignore malformed cloud studyState JSON
    }
    return changed;
  }

  /**
   * Synchronizes local browser progress and documents with Cloud Firestore for the authenticated user.
   * Properly cleans up listeners and non-destructively isolates private data on sign-out or account switch.
   */
  async syncWithCloudUser(user: User | null): Promise<void> {
    this.unsubscribeCloudListeners();

    const storedOwnerUid = readOwnerUid();

    if (!user) {
      const activeUid = this.previousUid || storedOwnerUid;
      if (activeUid) {
        this.archivePrivateUserCachesForUid(activeUid);
        this.clearPrivateUserCaches();
      } else {
        this.ensureSeeded();
      }
      this.currentUser = null;
      this.previousUid = null;
      this.cloudSyncState = 'local_only';
      this.notifyListeners();
      return;
    }

    // Never merge (and upload) another account's local data into this account;
    // archive the previous account first, then restore this account's local snapshot if any.
    const previousOwnerUid = this.previousUid || storedOwnerUid;
    if (previousOwnerUid && previousOwnerUid !== user.uid) {
      this.archivePrivateUserCachesForUid(previousOwnerUid);
      this.clearPrivateUserCaches();
      this.restorePrivateUserCachesForUid(user.uid);
    } else if (!previousOwnerUid) {
      this.restorePrivateUserCachesForUid(user.uid);
    }

    this.currentUser = user;
    this.previousUid = user.uid;
    writeOwnerUid(user.uid);

    const uid = user.uid;
    try {
      // 1. Merge the private academic profile
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const cloudData = userSnap.exists() ? userSnap.data() : null;

      let cloudProfile: StudentAcademicProfile | null = null;
      if (cloudData && typeof cloudData.profileJson === 'string' && cloudData.profileJson) {
        try {
          cloudProfile = normalizeStudentProfile(JSON.parse(cloudData.profileJson));
        } catch {
          cloudProfile = null;
        }
      }

      const localProfile = this.getStudentProfile();
      let profileToUse = localProfile;
      if (cloudProfile) {
        const cloudUpdated = Date.parse(cloudProfile.updatedAt) || 0;
        const localUpdated = Date.parse(localProfile.updatedAt) || 0;
        if (
          (cloudProfile.setupCompleted && !localProfile.setupCompleted) ||
          cloudUpdated > localUpdated
        ) {
          profileToUse = cloudProfile;
        }
      }
      if (profileToUse !== localProfile) {
        safeWriteJson(KEYS.STUDENT_PROFILE, profileToUse);
      }

      const cloudActiveDoc =
        cloudData && typeof cloudData.activeDocumentId === 'string'
          ? cloudData.activeDocumentId
          : '';
      const activeDocumentId = this.getActiveDocumentId() || cloudActiveDoc;
      if (activeDocumentId) {
        try {
          localStorage.setItem(KEYS.ACTIVE_DOC_ID, activeDocumentId);
        } catch {
          // ignore restricted storage
        }
      }

      const profileJson =
        profileToUse.setupCompleted || profileToUse.fullName.trim()
          ? JSON.stringify(profileToUse)
          : '';
      await setDoc(
        userRef,
        {
          uid,
          email: user.email || '',
          displayName: user.displayName || profileToUse.fullName || 'LearnMate Student',
          photoURL: user.photoURL || '',
          ...(activeDocumentId ? { activeDocumentId } : {}),
          ...(profileJson ? { profileJson } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Fetch Cloud Documents and merge with local documents
      const cloudDocsSnap = await getDocs(collection(db, 'users', uid, 'documents'));
      const localDocs = this.getDocuments();
      const docMap = new Map<string, StudyDocument>();
      for (const lDoc of localDocs) {
        docMap.set(lDoc.id, lDoc);
      }

      cloudDocsSnap.forEach((snap) => {
        const d = snap.data();
        try {
          const parsedDoc: StudyDocument = {
            id: d.id,
            title: d.title,
            sourceType:
              d.sourceType === 'pdf' ||
              d.sourceType === 'youtube' ||
              d.sourceType === 'scanned_notes' ||
              d.sourceType === 'voice_note' ||
              d.sourceType === 'course'
                ? d.sourceType
                : 'text',
            youtubeUrl: d.youtubeUrl || undefined,
            videoId: d.videoId || undefined,
            pageCount: d.pageCount,
            pages: JSON.parse(d.pagesJson || '[]'),
            topics: JSON.parse(d.topicsJson || '[]'),
            overview: d.overview || '',
            createdAt: d.createdAt,
            lastStudiedAt: d.lastStudiedAt,
            pdfDataUrl: docMap.get(d.id)?.pdfDataUrl,
          };
          const existing = docMap.get(d.id);
          if (
            !existing ||
            new Date(parsedDoc.lastStudiedAt).getTime() >=
              new Date(existing.lastStudiedAt).getTime()
          ) {
            docMap.set(d.id, parsedDoc);
          }
        } catch {
          // ignore malformed document
        }
      });

      const mergedDocs = Array.from(docMap.values()).sort(
        (a, b) => new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
      );
      safeWriteJson(KEYS.DOCUMENTS, mergedDocs);

      // Upload any local-only documents to Cloud
      const cloudDocIds = new Set(cloudDocsSnap.docs.map((d) => d.id));
      for (const mDoc of mergedDocs) {
        if (!cloudDocIds.has(mDoc.id)) {
          await this.persistDocumentToCloud(mDoc);
        }
      }

      // 3. Fetch Cloud Quiz Attempts and merge with local attempts
      const cloudAttemptsSnap = await getDocs(collection(db, 'users', uid, 'attempts'));
      const localAttempts = this.getQuizAttempts();
      const attemptMap = new Map<string, QuizAttempt>();
      for (const att of localAttempts) {
        attemptMap.set(att.id, att);
      }

      cloudAttemptsSnap.forEach((snap) => {
        const d = snap.data();
        try {
          const parsedAttempt = JSON.parse(d.attemptJson) as QuizAttempt;
          if (parsedAttempt && parsedAttempt.id) {
            attemptMap.set(parsedAttempt.id, parsedAttempt);
          }
        } catch {
          // ignore
        }
      });

      const mergedAttempts = Array.from(attemptMap.values()).sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );
      safeWriteJson(KEYS.ATTEMPTS, mergedAttempts);

      const cloudAttemptIds = new Set(cloudAttemptsSnap.docs.map((d) => d.id));
      for (const att of mergedAttempts) {
        if (!cloudAttemptIds.has(att.id)) {
          await this.persistAttemptToCloud(att);
        }
      }

      // 4. Sync per-document studyState (tutor history, mistakes, revision plans, quick revise, concept checks, mastery, creative assets)
      for (const mDoc of mergedDocs) {
        const stateRef = doc(db, 'users', uid, 'studyState', mDoc.id);
        const stateSnap = await getDoc(stateRef);
        const localTutor = this.getTutorMessages(mDoc.id);
        const localMistakes = this.getMistakeInsights(mDoc.id);
        const localPlan = this.getRevisionPlan(mDoc.id);
        const localQuick = this.getQuickReviseBundle(mDoc.id);
        const localConceptAttempts = this.getConceptCheckAttempts(mDoc.id);
        const localConceptMastery = this.getAllLessonMasteryForDocument(mDoc.id);
        const localCreativeAssets = this.getCreativeAssets(mDoc.id);

        if (stateSnap.exists()) {
          const sData = stateSnap.data();
          this.mergeDocumentStudyStateSnapshot(mDoc.id, sData, uid);
          // Push back merged state if local had newer concept attempts, mastery, or creative assets
          if (
            localConceptAttempts.length > 0 ||
            Object.keys(localConceptMastery).length > 0 ||
            localCreativeAssets.length > 0
          ) {
            await this.persistStudyStateToCloud(mDoc.id);
          }
        } else if (
          localTutor.length > 0 ||
          localMistakes.length > 0 ||
          localPlan.length > 0 ||
          localQuick ||
          localConceptAttempts.length > 0 ||
          Object.keys(localConceptMastery).length > 0 ||
          localCreativeAssets.length > 0
        ) {
          await this.persistStudyStateToCloud(mDoc.id);
        }
      }

      // Flush any queued offline document syncs
      await this.retryPendingCloudSync();

      // 5. Subscribe to real-time Cloud updates for this user and clean up on sign-out
      const docsUnsub = onSnapshot(
        collection(db, 'users', uid, 'documents'),
        (snap) => {
          if (!this.currentUser || this.currentUser.uid !== uid) return;
          const currentLocal = this.getDocuments();
          const map = new Map<string, StudyDocument>();
          for (const d of currentLocal) map.set(d.id, d);
          let changed = false;
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            try {
              const parsedDoc: StudyDocument = {
                id: d.id,
                title: d.title,
                sourceType:
                  d.sourceType === 'pdf' ||
                  d.sourceType === 'youtube' ||
                  d.sourceType === 'scanned_notes' ||
                  d.sourceType === 'voice_note' ||
                  d.sourceType === 'course'
                    ? d.sourceType
                    : 'text',
                youtubeUrl: d.youtubeUrl || undefined,
                videoId: d.videoId || undefined,
                pageCount: d.pageCount,
                pages: JSON.parse(d.pagesJson || '[]'),
                topics: JSON.parse(d.topicsJson || '[]'),
                overview: d.overview || '',
                createdAt: d.createdAt,
                lastStudiedAt: d.lastStudiedAt,
                pdfDataUrl: map.get(d.id)?.pdfDataUrl,
              };
              const existing = map.get(d.id);
              if (
                !existing ||
                new Date(parsedDoc.lastStudiedAt).getTime() >
                  new Date(existing.lastStudiedAt).getTime()
              ) {
                map.set(d.id, parsedDoc);
                changed = true;
              }
            } catch {
              // ignore
            }
          });
          if (changed) {
            const updated = Array.from(map.values()).sort(
              (a, b) => new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
            );
            safeWriteJson(KEYS.DOCUMENTS, updated);
            this.notifyListeners();
          }
        },
        () => {
          // ignore snapshot permission error during sign-out transition
        }
      );

      const attemptsUnsub = onSnapshot(
        collection(db, 'users', uid, 'attempts'),
        (snap) => {
          if (!this.currentUser || this.currentUser.uid !== uid) return;
          const currentLocal = this.getQuizAttempts();
          const map = new Map<string, QuizAttempt>();
          for (const a of currentLocal) map.set(a.id, a);
          let changed = false;
          snap.forEach((attSnap) => {
            const d = attSnap.data();
            try {
              const parsed = JSON.parse(d.attemptJson) as QuizAttempt;
              if (parsed && parsed.id && !map.has(parsed.id)) {
                map.set(parsed.id, parsed);
                changed = true;
              }
            } catch {
              // ignore
            }
          });
          if (changed) {
            const updated = Array.from(map.values()).sort(
              (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
            );
            safeWriteJson(KEYS.ATTEMPTS, updated);
            this.notifyListeners();
          }
        },
        () => {
          // ignore snapshot permission error during sign-out transition
        }
      );

      const studyStateUnsub = onSnapshot(
        collection(db, 'users', uid, 'studyState'),
        (snap) => {
          if (!this.currentUser || this.currentUser.uid !== uid) return;
          let anyChanged = false;
          snap.forEach((stateSnap) => {
            const sData = stateSnap.data();
            const docId = typeof sData.documentId === 'string' ? sData.documentId : stateSnap.id;
            if (this.mergeDocumentStudyStateSnapshot(docId, sData, uid)) {
              anyChanged = true;
            }
          });
          if (anyChanged) {
            this.notifyListeners();
          }
        },
        () => {
          // ignore snapshot permission error during sign-out transition
        }
      );

      this.cloudUnsubscribers.push(docsUnsub, attemptsUnsub, studyStateUnsub);
      this.cloudSyncState = this.getPendingSyncDocIds().length > 0 ? 'pending_offline' : 'synced';
      this.lastSyncedAt = new Date().toISOString();
      this.notifyListeners();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud sync failed';
      this.cloudSyncState = 'sync_failed';
      this.lastSyncError = msg;
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }
  }

  getDocuments(): StudyDocument[] {
    const docs = safeReadJson<StudyDocument[]>(KEYS.DOCUMENTS, []);
    const hydrated = docs.map((d) => {
      if (!d || !d.id) return d;
      const idbPdf = indexedDbStorage.getPdfBinarySync(d.id);
      const idbPages = indexedDbStorage.getDocumentPagesSync(d.id);
      return {
        ...d,
        pdfDataUrl: d.pdfDataUrl || idbPdf,
        pages: idbPages && idbPages.length >= (d.pages?.length || 0) ? idbPages : d.pages,
      };
    });
    return [...hydrated].sort(
      (a, b) => new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
    );
  }

  getDocumentById(id: string): StudyDocument | null {
    const docs = this.getDocuments();
    return docs.find((d) => d.id === id) || null;
  }

  saveDocument(studyDoc: StudyDocument): void {
    const ownerUid = this.currentUser?.uid || this.previousUid || readOwnerUid() || 'guest';
    const enriched: StudyDocument = {
      ...studyDoc,
      contentVersion: studyDoc.contentVersion || computeContentVersion(studyDoc),
    };

    // Persist large PDF binaries and 60-page sets into IndexedDB + memory cache
    if (enriched.pdfDataUrl) {
      void indexedDbStorage.savePdfBinary(enriched.id, enriched.pdfDataUrl, ownerUid);
    }
    if (Array.isArray(enriched.pages) && enriched.pages.length > 0) {
      void indexedDbStorage.saveDocumentPages(enriched.id, enriched.pages, ownerUid);
    }

    const docs = safeReadJson<StudyDocument[]>(KEYS.DOCUMENTS, []);
    // Strip multi-megabyte pdfDataUrl (>150KB) from the localStorage JSON copy if IndexedDB is supported
    const localStorageCopy: StudyDocument =
      enriched.pdfDataUrl &&
      enriched.pdfDataUrl.length > 150_000 &&
      typeof globalThis.indexedDB !== 'undefined'
        ? { ...enriched, pdfDataUrl: undefined }
        : enriched;

    const index = docs.findIndex((d) => d.id === enriched.id);
    if (index >= 0) {
      docs[index] = localStorageCopy;
    } else {
      docs.unshift(localStorageCopy);
    }
    safeWriteJson(KEYS.DOCUMENTS, docs);
    void this.persistDocumentToCloud(enriched);
    this.notifyListeners();
  }

  renameDocument(id: string, newTitle: string): StudyDocument | null {
    const trimmed = newTitle.trim();
    if (!trimmed) return null;
    const docs = this.getDocuments();
    const idx = docs.findIndex((d) => d.id === id);
    if (idx < 0) return null;
    const updated: StudyDocument = {
      ...docs[idx],
      title: trimmed,
      lastStudiedAt: new Date().toISOString(),
    };
    docs[idx] = updated;
    safeWriteJson(KEYS.DOCUMENTS, docs);
    void this.persistDocumentToCloud(updated);
    this.notifyListeners();
    return updated;
  }

  deleteDocument(id: string): void {
    const docs = this.getDocuments().filter((d) => d.id !== id);
    safeWriteJson(KEYS.DOCUMENTS, docs);
    void indexedDbStorage.deleteDocumentAssets(id);
    try {
      localStorage.removeItem(`${KEYS.PDF_ANNOTATIONS_PREFIX}${id}`);
    } catch {
      // ignore
    }
    if (this.getActiveDocumentId() === id) {
      this.setActiveDocumentId(docs[0]?.id || null);
    }
    if (this.currentUser) {
      const uid = this.currentUser.uid;
      deleteDoc(doc(db, 'users', uid, 'documents', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/documents/${id}`)
      );
    }
    this.notifyListeners();
  }

  getActiveDocumentId(): string | null {
    try {
      return localStorage.getItem(KEYS.ACTIVE_DOC_ID);
    } catch {
      return null;
    }
  }

  setActiveDocumentId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(KEYS.ACTIVE_DOC_ID, id);
      } else {
        localStorage.removeItem(KEYS.ACTIVE_DOC_ID);
      }
      if (this.currentUser && id) {
        const uid = this.currentUser.uid;
        setDoc(
          doc(db, 'users', uid),
          { uid, activeDocumentId: id, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`));
      }
    } catch {
      // ignore
    }
  }

  getTutorMessages(documentId: string): TutorMessage[] {
    return safeReadJson<TutorMessage[]>(`${KEYS.TUTOR_PREFIX}${documentId}`, []);
  }

  saveTutorMessages(documentId: string, messages: TutorMessage[]): void {
    safeWriteJson(`${KEYS.TUTOR_PREFIX}${documentId}`, messages);
    void this.persistStudyStateToCloud(documentId);
  }

  getVoiceTutorMessages(documentId: string): VoiceTurn[] {
    return safeReadJson<VoiceTurn[]>(`${KEYS.VOICE_TUTOR_PREFIX}${documentId}`, []);
  }

  saveVoiceTutorMessages(documentId: string, messages: VoiceTurn[]): void {
    safeWriteJson(`${KEYS.VOICE_TUTOR_PREFIX}${documentId}`, messages);
  }

  getCachedQuiz(documentId: string, mode: string): QuizQuestion[] | null {
    return safeReadJson<QuizQuestion[] | null>(
      `${KEYS.QUIZ_CACHE_PREFIX}${documentId}_${mode}`,
      null
    );
  }

  saveCachedQuiz(documentId: string, mode: string, questions: QuizQuestion[]): void {
    safeWriteJson(`${KEYS.QUIZ_CACHE_PREFIX}${documentId}_${mode}`, questions);
    void this.persistStudyStateToCloud(documentId);
  }

  getQuizAttempts(documentId?: string): QuizAttempt[] {
    const all = safeReadJson<QuizAttempt[]>(KEYS.ATTEMPTS, []);
    const filtered = documentId ? all.filter((a) => a.documentId === documentId) : all;
    return [...filtered].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }

  saveQuizAttempt(attempt: QuizAttempt): void {
    const all = safeReadJson<QuizAttempt[]>(KEYS.ATTEMPTS, []);
    const idx = all.findIndex((a) => a.id === attempt.id);
    if (idx >= 0) {
      all[idx] = attempt;
    } else {
      all.push(attempt);
    }
    safeWriteJson(KEYS.ATTEMPTS, all);
    void this.persistAttemptToCloud(attempt);
  }

  getMistakeInsights(documentId: string): MistakeInsight[] {
    return safeReadJson<MistakeInsight[]>(`${KEYS.MISTAKES_PREFIX}${documentId}`, []);
  }

  saveMistakeInsights(documentId: string, mistakes: MistakeInsight[]): void {
    safeWriteJson(`${KEYS.MISTAKES_PREFIX}${documentId}`, mistakes);
    void this.persistStudyStateToCloud(documentId);
  }

  getRevisionPlan(documentId: string): RevisionTask[] {
    return safeReadJson<RevisionTask[]>(`${KEYS.REVISION_PREFIX}${documentId}`, []);
  }

  saveRevisionPlan(documentId: string, tasks: RevisionTask[]): void {
    safeWriteJson(`${KEYS.REVISION_PREFIX}${documentId}`, tasks);
    void this.persistStudyStateToCloud(documentId);
  }

  getQuickReviseBundle(documentId: string, contentVersion?: string): QuickReviseBundle | null {
    const bundle = safeReadJson<QuickReviseBundle | null>(
      `${KEYS.QUICK_REVISE_PREFIX}${documentId}`,
      null
    );
    if (!bundle) return null;
    if (contentVersion && bundle.contentVersion && bundle.contentVersion !== contentVersion) {
      return null;
    }
    return bundle;
  }

  saveQuickReviseBundle(bundle: QuickReviseBundle): void {
    safeWriteJson(`${KEYS.QUICK_REVISE_PREFIX}${bundle.documentId}`, bundle);
    void this.persistStudyStateToCloud(bundle.documentId);
  }

  getCachedYouTubeRecommendations(cacheKey: string): YouTubeRecommendation[] | null {
    return safeReadJson<YouTubeRecommendation[] | null>(
      `${KEYS.YT_REC_PREFIX}${cacheKey}`,
      null
    );
  }

  saveCachedYouTubeRecommendations(cacheKey: string, videos: YouTubeRecommendation[]): void {
    safeWriteJson(`${KEYS.YT_REC_PREFIX}${cacheKey}`, videos);
  }

  getStudyTimerState(): StudyTimerState {
    return safeReadJson<StudyTimerState>(KEYS.TIMER_STATE, DEFAULT_TIMER_STATE);
  }

  saveStudyTimerState(state: StudyTimerState): void {
    safeWriteJson(KEYS.TIMER_STATE, state);
  }

  getFocusSessions(documentId?: string): FocusSessionRecord[] {
    const all = safeReadJson<FocusSessionRecord[]>(KEYS.FOCUS_SESSIONS, []);
    const filtered = documentId ? all.filter((s) => s.documentId === documentId) : all;
    return [...filtered].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }

  saveFocusSession(session: FocusSessionRecord): void {
    const all = safeReadJson<FocusSessionRecord[]>(KEYS.FOCUS_SESSIONS, []);
    all.push(session);
    safeWriteJson(KEYS.FOCUS_SESSIONS, all);
  }

  getThemeMode(): ThemeMode {
    try {
      const raw = localStorage.getItem(KEYS.THEME);
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        return raw;
      }
      return 'light';
    } catch {
      return 'light';
    }
  }

  saveThemeMode(mode: ThemeMode): void {
    try {
      localStorage.setItem(KEYS.THEME, mode);
      if (typeof document !== 'undefined') {
        const isDark =
          mode === 'dark' ||
          (mode === 'system' &&
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  getSourceControlMode(): SourceControlMode {
    try {
      const raw = localStorage.getItem(KEYS.SOURCE_CONTROL_MODE);
      if (raw === 'extended_knowledge' || raw === 'material_only') {
        return raw;
      }
      return 'material_only';
    } catch {
      return 'material_only';
    }
  }

  saveSourceControlMode(mode: SourceControlMode): void {
    try {
      localStorage.setItem(KEYS.SOURCE_CONTROL_MODE, mode);
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  getNotifications(): LearnMateNotification[] {
    const list = safeReadJson<LearnMateNotification[]>(
      KEYS.NOTIFICATIONS,
      STARTER_NOTIFICATIONS
    );
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  addNotification(
    notification: Omit<LearnMateNotification, 'id' | 'createdAt' | 'read'>
  ): LearnMateNotification {
    const item: LearnMateNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const existing = this.getNotifications();
    const updated = [item, ...existing].slice(0, 35);
    safeWriteJson(KEYS.NOTIFICATIONS, updated);
    this.notifyListeners();
    return item;
  }

  markNotificationRead(id: string): void {
    const updated = this.getNotifications().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    safeWriteJson(KEYS.NOTIFICATIONS, updated);
    this.notifyListeners();
  }

  markAllNotificationsRead(): void {
    const updated = this.getNotifications().map((n) => ({ ...n, read: true }));
    safeWriteJson(KEYS.NOTIFICATIONS, updated);
    this.notifyListeners();
  }

  clearNotifications(): void {
    safeWriteJson(KEYS.NOTIFICATIONS, []);
    this.notifyListeners();
  }

  getNotebookEntries(): NotebookEntry[] {
    const list = safeReadJson<NotebookEntry[]>(KEYS.NOTEBOOK, []);
    return [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  saveNotebookEntry(entry: NotebookEntry): void {
    const list = this.getNotebookEntries();
    const idx = list.findIndex((item) => item.id === entry.id);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
    }
    safeWriteJson(KEYS.NOTEBOOK, list);
    this.notifyListeners();
  }

  deleteNotebookEntry(id: string): void {
    const list = this.getNotebookEntries().filter((item) => item.id !== id);
    safeWriteJson(KEYS.NOTEBOOK, list);
    this.notifyListeners();
  }

  getCreativeAssets(documentId?: string): CreativeAsset[] {
    const list = safeReadJson<CreativeAsset[]>(KEYS.CREATIVE_ASSETS, []);
    const filtered = documentId ? list.filter((a) => a.documentId === documentId) : list;
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  saveCreativeAsset(asset: CreativeAsset): void {
    const list = safeReadJson<CreativeAsset[]>(KEYS.CREATIVE_ASSETS, []);
    const idx = list.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      list[idx] = asset;
    } else {
      list.unshift(asset);
    }
    safeWriteJson(KEYS.CREATIVE_ASSETS, list);
    if (asset.documentId) {
      void this.persistStudyStateToCloud(asset.documentId);
    }
    this.notifyListeners();
  }

  deleteCreativeAsset(id: string): void {
    const existing = safeReadJson<CreativeAsset[]>(KEYS.CREATIVE_ASSETS, []);
    const target = existing.find((a) => a.id === id);
    const list = existing.filter((a) => a.id !== id);
    safeWriteJson(KEYS.CREATIVE_ASSETS, list);
    if (target?.documentId) {
      void this.persistStudyStateToCloud(target.documentId);
    }
    this.notifyListeners();
  }

  getStudyPlannerTasks(): StudyPlannerTask[] {
    return safeReadJson<StudyPlannerTask[]>(
      KEYS.STUDY_PLANNER,
      STARTER_PLANNER_TASKS
    );
  }

  saveStudyPlannerTasks(tasks: StudyPlannerTask[]): void {
    safeWriteJson(KEYS.STUDY_PLANNER, tasks);
    this.notifyListeners();
  }

  getAccessibilitySettings(): AccessibilitySettings {
    return safeReadJson<AccessibilitySettings>(
      KEYS.ACCESSIBILITY,
      DEFAULT_ACCESSIBILITY
    );
  }

  saveAccessibilitySettings(settings: AccessibilitySettings): void {
    safeWriteJson(KEYS.ACCESSIBILITY, settings);
    this.notifyListeners();
  }

  getPdfAnnotations(documentId: string): PdfAnnotationItem[] {
    return safeReadJson<PdfAnnotationItem[]>(
      `${KEYS.PDF_ANNOTATIONS_PREFIX}${documentId}`,
      []
    );
  }

  savePdfAnnotations(documentId: string, annotations: PdfAnnotationItem[]): void {
    safeWriteJson(`${KEYS.PDF_ANNOTATIONS_PREFIX}${documentId}`, annotations);
    this.notifyListeners();
  }

  getStudentProfile(): StudentAcademicProfile {
    const stored = safeReadJson<Partial<StudentAcademicProfile> | null>(
      KEYS.STUDENT_PROFILE,
      null
    );
    const normalized = normalizeStudentProfile(stored);
    // Remove fake defaults saved by older builds once, then keep the cleaned copy.
    if (profileNeedsMigration(stored)) {
      safeWriteJson(KEYS.STUDENT_PROFILE, normalized);
    }
    return normalized;
  }

  saveStudentProfile(profile: StudentAcademicProfile): StudentAcademicProfile {
    const updated: StudentAcademicProfile = {
      ...normalizeStudentProfile(profile),
      setupCompleted: profile.setupCompleted || isProfileSetupComplete(profile),
      updatedAt: new Date().toISOString(),
    };
    safeWriteJson(KEYS.STUDENT_PROFILE, updated);
    void this.persistProfileToCloud(updated);
    this.notifyListeners();
    return updated;
  }

  async submitAiReport(report: AiContentReport): Promise<void> {
    const user = this.currentUser;
    if (!user) throw new Error('Please sign in to send a report.');
    const id = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(doc(db, 'users', user.uid, 'reports', id), {
      id,
      uid: user.uid,
      kind: report.kind,
      reason: report.reason,
      note: (report.note || '').trim().slice(0, 500),
      excerpt: report.excerpt.slice(0, 2000),
      documentId: (report.documentId || '').slice(0, 160),
      createdAt: new Date().toISOString(),
    });
  }

  getConceptCheckAttempts(documentId?: string, topic?: string): ConceptCheckAttemptRecord[] {
    const all = safeReadJson<ConceptCheckAttemptRecord[]>(KEYS.CONCEPT_ATTEMPTS, []);
    const activeUid = this.currentUser?.uid || this.previousUid || readOwnerUid();
    const normalizedTopic = topic ? topic.trim().toLowerCase() : '';
    const filtered = all.filter((item) => {
      if (
        activeUid &&
        item.studentUid &&
        item.studentUid !== 'local-student' &&
        item.studentUid !== activeUid
      ) {
        return false;
      }
      if (documentId && item.documentId !== documentId) return false;
      if (normalizedTopic && item.topic.trim().toLowerCase() !== normalizedTopic) return false;
      return true;
    });
    return [...filtered].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  saveConceptCheckAttempt(
    attempt: ConceptCheckAttemptRecord,
    sceneState: SceneConceptMasteryState
  ): {
    evidenceLevel:
      | 'no_evidence_skipped'
      | 'positive_mastery'
      | 'recovered_after_reteaching'
      | 'limited_single_error'
      | 'repeated_misconception';
    mistakeDnaUpdated: boolean;
  } {
    const activeUid = this.currentUser?.uid || this.previousUid || readOwnerUid();
    const enrichedAttempt: ConceptCheckAttemptRecord = {
      ...attempt,
      studentUid: activeUid || attempt.studentUid || 'local-student',
    };
    const all = safeReadJson<ConceptCheckAttemptRecord[]>(KEYS.CONCEPT_ATTEMPTS, []);
    const merged = mergeConceptCheckAttempts([enrichedAttempt], all, activeUid || undefined);
    safeWriteJson(KEYS.CONCEPT_ATTEMPTS, merged.slice(0, 500));

    // Update Mistake DNA, Revision Plan, and student weakAreas when evidence warrants it
    const existingMistakes = this.getMistakeInsights(enrichedAttempt.documentId);
    const existingPlan = this.getRevisionPlan(enrichedAttempt.documentId);
    const currentProfile = this.getStudentProfile();

    const dnaResult = integrateConceptCheckWithMistakeDna({
      documentId: enrichedAttempt.documentId,
      attempt: enrichedAttempt,
      sceneState,
      existingMistakes,
      existingRevisionPlan: existingPlan,
      existingWeakAreas: currentProfile.weakAreas,
    });

    if (dnaResult.mistakeDnaUpdated) {
      this.saveMistakeInsights(enrichedAttempt.documentId, dnaResult.updatedMistakes);
      this.saveRevisionPlan(enrichedAttempt.documentId, dnaResult.updatedRevisionPlan);
      if (dnaResult.updatedWeakAreas.length !== currentProfile.weakAreas.length) {
        this.saveStudentProfile({
          ...currentProfile,
          weakAreas: dnaResult.updatedWeakAreas,
        });
      }
    } else {
      void this.persistStudyStateToCloud(enrichedAttempt.documentId);
      this.notifyListeners();
    }

    return {
      evidenceLevel: dnaResult.evidenceLevel,
      mistakeDnaUpdated: dnaResult.mistakeDnaUpdated,
    };
  }

  private makeLessonMasteryKey(documentId: string, topic: string): string {
    const slug = (topic || 'default')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80);
    return `${KEYS.CONCEPT_MASTERY_PREFIX}${documentId}__${slug}`;
  }

  getLessonMasteryState(
    documentId: string,
    topic: string
  ): Record<number, SceneConceptMasteryState> | null {
    return safeReadJson<Record<number, SceneConceptMasteryState> | null>(
      this.makeLessonMasteryKey(documentId, topic),
      null
    );
  }

  saveLessonMasteryState(
    documentId: string,
    topic: string,
    state: Record<number, SceneConceptMasteryState>
  ): void {
    safeWriteJson(this.makeLessonMasteryKey(documentId, topic), state);
    if (documentId) {
      void this.persistStudyStateToCloud(documentId);
    }
    this.notifyListeners();
  }

  getHandwrittenNotes(documentId?: string): HandwrittenNoteDocument[] {
    const list = safeReadJson<HandwrittenNoteDocument[]>(KEYS.HANDWRITTEN_NOTES, []);
    const filtered = documentId ? list.filter((n) => n.documentId === documentId) : list;
    return [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  saveHandwrittenNote(noteDoc: HandwrittenNoteDocument): void {
    const list = safeReadJson<HandwrittenNoteDocument[]>(KEYS.HANDWRITTEN_NOTES, []);
    const idx = list.findIndex((n) => n.id === noteDoc.id);
    if (idx >= 0) {
      list[idx] = noteDoc;
    } else {
      list.unshift(noteDoc);
    }
    safeWriteJson(KEYS.HANDWRITTEN_NOTES, list);
    this.notifyListeners();
  }

  deleteHandwrittenNote(id: string): void {
    const list = safeReadJson<HandwrittenNoteDocument[]>(KEYS.HANDWRITTEN_NOTES, []).filter(
      (n) => n.id !== id
    );
    safeWriteJson(KEYS.HANDWRITTEN_NOTES, list);
    this.notifyListeners();
  }

  exportStudentDataArchive(): StudentDataExportArchive {
    const ownerUid = this.currentUser?.uid || this.previousUid || readOwnerUid();
    const docs = this.getDocuments();
    const perDocumentState: StudentDataExportArchive['perDocumentState'] = {};
    for (const d of docs) {
      perDocumentState[d.id] = {
        tutorMessages: this.getTutorMessages(d.id),
        voiceTutorMessages: this.getVoiceTutorMessages(d.id),
        mistakes: this.getMistakeInsights(d.id),
        revisionPlan: this.getRevisionPlan(d.id),
        quickRevise: this.getQuickReviseBundle(d.id),
        pdfAnnotations: this.getPdfAnnotations(d.id),
      };
    }

    return {
      schemaVersion: 'learnmate-student-archive-v6.0',
      exportedAt: new Date().toISOString(),
      ownerUid,
      studentProfile: this.getStudentProfile(),
      documents: docs.map((d) => ({
        ...d,
        // Omit multi-MB raw pdfDataUrl binary from JSON metadata export if huge
        pdfDataUrl: d.pdfDataUrl && d.pdfDataUrl.length > 250_000 ? '[Stored in IndexedDB]' : d.pdfDataUrl,
      })),
      quizAttempts: this.getQuizAttempts(),
      conceptCheckAttempts: this.getConceptCheckAttempts(),
      handwrittenNotes: this.getHandwrittenNotes(),
      creativeAssets: this.getCreativeAssets(),
      notebookEntries: this.getNotebookEntries(),
      studyPlannerTasks: this.getStudyPlannerTasks(),
      focusSessions: this.getFocusSessions(),
      perDocumentState,
    };
  }

  async deleteStudentAccountAndData(): Promise<AccountDeletionResult> {
    const uid = this.currentUser?.uid || this.previousUid || readOwnerUid();
    const docs = this.getDocuments();
    const attempts = this.getQuizAttempts();
    let deletedCloudDocumentsCount = 0;

    // 1. Delete Cloud Firestore records if signed in
    if (this.currentUser && uid) {
      try {
        for (const d of docs) {
          await deleteDoc(doc(db, 'users', uid, 'documents', d.id)).catch(() => {});
          await deleteDoc(doc(db, 'users', uid, 'studyState', d.id)).catch(() => {});
          deletedCloudDocumentsCount += 2;
        }
        for (const att of attempts) {
          await deleteDoc(doc(db, 'users', uid, 'attempts', att.id)).catch(() => {});
          deletedCloudDocumentsCount += 1;
        }
        const reportsSnap = await getDocs(collection(db, 'users', uid, 'reports')).catch(() => null);
        if (reportsSnap) {
          for (const rep of reportsSnap.docs) {
            await deleteDoc(rep.ref).catch(() => {});
            deletedCloudDocumentsCount += 1;
          }
        }
        const liSnap = await getDocs(collection(db, 'users', uid, 'learningIntelligence')).catch(() => null);
        if (liSnap) {
          for (const liDoc of liSnap.docs) {
            await deleteDoc(liDoc.ref).catch(() => {});
            deletedCloudDocumentsCount += 1;
          }
        }
        await deleteDoc(doc(db, 'users', uid)).catch(() => {});
        deletedCloudDocumentsCount += 1;
      } catch {
        // Continue with local cleanup even if offline
      }
    }

    // 2. Delete IndexedDB binaries and page sets for this account
    const deletedIndexedDbRecordsCount = await indexedDbStorage.clearAllForOwner(uid);

    // 3. Delete all localStorage keys belonging to this account (including archived snapshots)
    let deletedLocalKeysCount = 0;
    try {
      const keysToDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith('learnmate_') &&
          k !== KEYS.THEME &&
          k !== KEYS.ACCESSIBILITY &&
          (!uid || !k.startsWith(KEYS.ACCOUNT_ARCHIVE_PREFIX) || k === `${KEYS.ACCOUNT_ARCHIVE_PREFIX}${uid}`)
        ) {
          keysToDelete.push(k);
        }
      }
      for (const k of keysToDelete) {
        localStorage.removeItem(k);
        deletedLocalKeysCount += 1;
      }
    } catch {
      // ignore
    }

    this.unsubscribeCloudListeners();
    this.currentUser = null;
    this.previousUid = null;
    this.cloudSyncState = 'local_only';
    this.ensureSeeded();
    this.notifyListeners();

    return {
      deletedLocalKeysCount,
      deletedIndexedDbRecordsCount,
      deletedCloudDocumentsCount,
      completedAt: new Date().toISOString(),
    };
  }

  clearAllProgress(): void {
    try {
      const docs = this.getDocuments();
      const attempts = this.getQuizAttempts();
      localStorage.removeItem(KEYS.ATTEMPTS);
      localStorage.removeItem(KEYS.CONCEPT_ATTEMPTS);
      localStorage.removeItem(KEYS.FOCUS_SESSIONS);
      localStorage.removeItem('learnmate_rewards_ledger_v1');
      localStorage.removeItem('learnmate_daily_coach_completed_v1');
      const toRemoveMastery: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(KEYS.CONCEPT_MASTERY_PREFIX)) {
          toRemoveMastery.push(k);
        }
      }
      for (const k of toRemoveMastery) {
        localStorage.removeItem(k);
      }
      for (const d of docs) {
        localStorage.removeItem(`${KEYS.MISTAKES_PREFIX}${d.id}`);
        localStorage.removeItem(`${KEYS.REVISION_PREFIX}${d.id}`);
        localStorage.removeItem(`${KEYS.QUIZ_CACHE_PREFIX}${d.id}_diagnostic`);
        if (this.currentUser) {
          void this.persistStudyStateToCloud(d.id);
        }
      }
      if (this.currentUser) {
        const uid = this.currentUser.uid;
        for (const att of attempts) {
          deleteDoc(doc(db, 'users', uid, 'attempts', att.id)).catch((err) =>
            handleFirestoreError(err, OperationType.DELETE, `users/${uid}/attempts/${att.id}`)
          );
        }
      }
    } catch {
      // ignore
    }
  }
}

export const STARTER_NOTIFICATIONS: LearnMateNotification[] = [
  {
    id: 'notif-starter-welcome',
    title: 'Welcome to LearnMate JEE',
    message:
      'Upload a chapter, your coaching module or your notes, then ask the AI tutor your doubts step by step.',
    category: 'resource',
    read: false,
    createdAt: new Date().toISOString(),
    actionTab: 'home',
  },
  {
    id: 'notif-starter-registration',
    title: 'JEE Main Session 1 registration closes 22 Nov',
    message:
      'Apply on jeemain.nta.nic.in before 22 Nov 2026 (late fee window until 26 Nov). Exams run 20 to 28 Jan 2027.',
    category: 'goal',
    read: false,
    createdAt: new Date().toISOString(),
    actionTab: 'dashboard',
  },
];

/** A new account starts with a blank planner; tasks are created from the student's own work. */
export const STARTER_PLANNER_TASKS: StudyPlannerTask[] = [];

export const COURSE_LIBRARY_CATALOG: CourseLibraryItem[] = [
  {
    id: 'course-jee-physics-mechanics',
    title: 'JEE Advanced Physics: Rotational Dynamics & Gravitation',
    category: 'Competitive Exams',
    level: 'Advanced',
    durationEstimate: '4 Modules • 3.5 hrs',
    description:
      'Master Moment of Inertia, Torque, Angular Momentum Conservation, Rolling Motion, and Kepler Orbital Mechanics with exam-grade derivations.',
    badgeColor: 'blue',
    modules: [
      {
        id: 'mod-moment-of-inertia',
        title: 'Moment of Inertia & Parallel/Perpendicular Axis Theorems',
        summary: 'Rotational inertia I = Σ mᵢrᵢ², Parallel Axis Theorem I = I_cm + Md², and standard rigid body formulas.',
        keyConcepts: ['I = Σ mᵢrᵢ²', 'Parallel Axis Theorem I = I_cm + Md²', 'Radius of Gyration k = √(I/M)', 'Thin Rod & Solid Sphere Inertia'],
        content: `1. Rotational Inertia (Moment of Inertia)
For a system of discrete particles rotating about an axis, the Moment of Inertia I is:
  I = Σ mᵢ rᵢ²
For a continuous rigid body:
  I = ∫ r² dm
where r is the perpendicular distance from the axis of rotation.

2. Fundamental Axis Theorems
• Parallel Axis Theorem: For any axis parallel to an axis passing through the center of mass (CM) at distance d:
  I = I_cm + M d²
• Perpendicular Axis Theorem (for planar 2D laminae only, lying in the xy-plane):
  I_z = I_x + I_y

3. Standard Moments of Inertia (about Center of Mass)
• Uniform Ring of radius R: I = M R²
• Uniform Disc / Solid Cylinder of radius R: I = ½ M R²
• Solid Sphere of radius R: I = (2/5) M R²
• Hollow Thin Spherical Shell of radius R: I = (2/3) M R²
• Uniform Thin Rod of length L (perpendicular to length at center): I = (1/12) M L²`,
      },
      {
        id: 'mod-torque-angular-momentum',
        title: 'Torque, Angular Momentum & Rolling Without Slipping',
        summary: 'Covers τ = r × F = Iα, conservation of angular momentum L = Iω, and pure rolling constraint v_cm = Rω.',
        keyConcepts: ['Torque τ = r × F = dL/dt', 'Conservation of L = Iω', 'Pure Rolling v_cm = Rω', 'Acceleration on Inclined Plane'],
        content: `1. Torque and Angular Acceleration
Torque τ is the rotational analogue of force:
  τ = r × F,  with magnitude τ = r F sin(θ).
For rotation about a fixed axis or the center of mass:
  τ_net = I α = dL / dt.

2. Angular Momentum Conservation
Angular momentum of a rigid body about a symmetry axis is L = I ω.
If net external torque about an axis is zero (Σ τ_ext = 0), then total angular momentum L is conserved:
  I₁ ω₁ = I₂ ω₂.

3. Rolling Without Slipping on an Incline
Pure rolling occurs when the point of contact is instantaneously at rest relative to the surface:
  v_cm = R ω   and   a_cm = R α.
Total Kinetic Energy of a rolling body:
  K_total = ½ M v_cm² + ½ I_cm ω² = ½ M v_cm² (1 + k² / R²)
where k is the radius of gyration (I_cm = M k²).
Acceleration down an incline of angle θ without slipping:
  a_cm = (g sin θ) / (1 + k² / R²).`,
      },
    ],
  },
  {
    id: 'course-organic-chemistry-mechanisms',
    title: 'Organic Chemistry: Reaction Mechanisms (SN1, SN2, E1, E2)',
    category: 'Science',
    level: 'Intermediate',
    durationEstimate: '3 Modules • 2.5 hrs',
    description:
      'Understand Nucleophilic Substitution and Elimination pathways, stereochemistry, carbocation stability, and solvent effects.',
    badgeColor: 'green',
    modules: [
      {
        id: 'mod-sn1-sn2',
        title: 'SN2 Backside Attack vs SN1 Carbocation Pathway',
        summary: 'Rate laws, Walden inversion vs racemization, substrate steric hindrance, and polar protic vs aprotic solvents.',
        keyConcepts: ['SN2 Concerted Backside Attack', 'Walden Inversion of Configuration', 'SN1 Carbocation Intermediate', 'Polar Aprotic vs Protic Solvents'],
        content: `1. Bimolecular Nucleophilic Substitution (SN2)
• Mechanism: Concerted, single-step backside attack with a pentacoordinate transition state.
• Rate Law: Rate = k [Substrate][Nucleophile] (2nd order).
• Stereochemistry: 100% Inversion of configuration (Walden Inversion).
• Substrate Reactivity: Methyl > 1° > 2° >> 3° (steric hindrance blocks backside attack).
• Best Conditions: Strong nucleophile + Polar Aprotic solvent (DMSO, Acetone, DMF).

2. Unimolecular Nucleophilic Substitution (SN1)
• Mechanism: Two-step process via a planar sp² carbocation intermediate. Step 1 (leaving group departure) is rate-determining.
• Rate Law: Rate = k [Substrate] (1st order, independent of nucleophile concentration).
• Stereochemistry: Racemization (both retention and inversion occur as nucleophile attacks either face of planar carbocation).
• Substrate Reactivity: 3° > 2° >> 1° > Methyl (governed by carbocation stability and hyperconjugation/inductive effect).
• Rearrangements: 1,2-hydride or 1,2-alkyl shifts occur if a more stable carbocation can form.`,
      },
    ],
  },
  {
    id: 'course-dsa-algorithms',
    title: 'Data Structures & Algorithms: Graphs, Trees & Dynamic Programming',
    category: 'Programming',
    level: 'Intermediate',
    durationEstimate: '4 Modules • 4 hrs',
    description:
      'Core computer science foundations covering BFS/DFS, Dijkstra Shortest Path, Binary Search Trees, and Memoization vs Tabulation.',
    badgeColor: 'yellow',
    modules: [
      {
        id: 'mod-graphs-dijkstra',
        title: 'Graph Traversals (BFS/DFS) & Dijkstra Shortest Path',
        summary: 'Adjacency lists, time complexity O(V + E), topological sort, and greedy shortest paths with non-negative weights.',
        keyConcepts: ['BFS Queue O(V + E)', 'DFS Recursion & Cycle Detection', 'Dijkstra Min-Heap O((V+E) log V)', 'Non-Negative Edge Weight Constraint'],
        content: `1. Graph Representations & Traversals
For a graph G = (V, E) with |V| vertices and |E| edges, an Adjacency List uses O(V + E) space.
• Breadth-First Search (BFS): Uses a FIFO Queue. Explores level-by-level and guarantees shortest path in unweighted graphs in O(V + E) time.
• Depth-First Search (DFS): Uses a Call Stack. Used for cycle detection, connected components, and topological sorting of DAGs in O(V + E) time.

2. Dijkstra's Shortest Path Algorithm
Finds single-source shortest paths in graphs with NON-NEGATIVE edge weights (w(u, v) ≥ 0).
• Maintain a priority queue (min-heap) of tentative distances d[v], initialized to d[source] = 0 and ∞ for all other vertices.
• Relaxation step: If d[u] + w(u, v) < d[v], update d[v] = d[u] + w(u, v).
• Time Complexity with Binary Min-Heap: O((V + E) log V).
• Pitfall: Dijkstra fails on negative weight edges; use Bellman-Ford O(V·E) when negative weights exist.`,
      },
    ],
  },
  {
    id: 'course-linear-algebra-ml',
    title: 'Linear Algebra for Machine Learning & Engineering',
    category: 'Mathematics',
    level: 'Intermediate',
    durationEstimate: '3 Modules • 3 hrs',
    description:
      'Vector spaces, Rank-Nullity Theorem, Eigenvalues & Eigenvectors, Symmetric Matrices, and Singular Value Decomposition (SVD).',
    badgeColor: 'red',
    modules: [
      {
        id: 'mod-eigen-svd',
        title: 'Eigenvalues, Spectral Theorem & Singular Value Decomposition',
        summary: 'Characteristic polynomial det(A − λI) = 0, orthogonal diagonalization of symmetric matrices, and PCA via SVD.',
        keyConcepts: ['Av = λv', 'Characteristic Equation det(A − λI) = 0', 'Trace = Σ λᵢ & Det = Π λᵢ', 'Spectral Theorem A = QΛQᵀ'],
        content: `1. Eigenvalues and Eigenvectors
For an n × n square matrix A, a non-zero vector v is an eigenvector with eigenvalue λ if:
  A v = λ v   ⇔   (A − λI) v = 0.
Eigenvalues are roots of the characteristic polynomial:
  det(A − λI) = 0.

Key Matrix Identities:
• Trace(A) = a₁₁ + a₂₂ + ... + aₙₙ = λ₁ + λ₂ + ... + λₙ (sum of eigenvalues)
• det(A) = λ₁ · λ₂ · ... · λₙ (product of eigenvalues).

2. The Real Spectral Theorem
Every real symmetric matrix A (where A = Aᵀ) has:
1) Strictly real eigenvalues.
2) Orthogonal eigenvectors for distinct eigenvalues.
3) Orthogonal diagonalization: A = Q Λ Qᵀ, where Q is an orthogonal matrix (QᵀQ = I).`,
      },
    ],
  },
  {
    id: 'course-cell-biology-genetics',
    title: 'High School Biology: Cellular Respiration & Molecular Genetics',
    category: 'School',
    level: 'Beginner',
    durationEstimate: '3 Modules • 2 hrs',
    description:
      'Clear visual walkthrough of Glycolysis, Krebs Cycle, Electron Transport Chain ATP yield, DNA Replication, and Central Dogma.',
    badgeColor: 'green',
    modules: [
      {
        id: 'mod-central-dogma',
        title: 'DNA Replication, Transcription & Translation (Central Dogma)',
        summary: 'Semiconservative replication, Helicase & DNA Polymerase III, mRNA splicing, and ribosomal tRNA translation.',
        keyConcepts: ['Semiconservative Replication (5\' → 3\')', 'Okazaki Fragments on Lagging Strand', 'RNA Polymerase Transcription', 'Codon to Anticodon Translation'],
        content: `1. DNA Structure & Semiconservative Replication
DNA consists of two antiparallel polynucleotide strands coiled in a double helix with complementary base pairing: Adenine (A) pairs with Thymine (T) via 2 hydrogen bonds; Guanine (G) pairs with Cytosine (C) via 3 hydrogen bonds.
• DNA Polymerase synthesizes new DNA exclusively in the 5' → 3' direction.
• Leading strand is synthesized continuously; Lagging strand is synthesized discontinuously as Okazaki fragments joined by DNA Ligase.

2. The Central Dogma of Molecular Biology
  DNA  ──(Transcription)──►  mRNA  ──(Translation)──►  Polypeptide (Protein)
• Transcription: RNA Polymerase reads the 3' → 5' DNA template strand to synthesize complementary mRNA (using Uracil U instead of Thymine T). In eukaryotes, introns are spliced out and exons are joined.
• Translation: Ribosomes read mRNA triplets (codons). Start codon is AUG (Methionine); stop codons are UAA, UAG, UGA.`,
      },
    ],
  },
  {
    id: 'course-macroeconomics-college',
    title: 'College Macroeconomics: Monetary Policy, GDP & Inflation',
    category: 'College',
    level: 'Beginner',
    durationEstimate: '3 Modules • 2.5 hrs',
    description:
      'National income accounting Y = C + I + G + NX, Fiscal multipliers, Central Bank interest rate policy, and the Phillips Curve.',
    badgeColor: 'blue',
    modules: [
      {
        id: 'mod-gdp-monetary',
        title: 'GDP Accounting, Fiscal Multiplier & Central Bank Policy',
        summary: 'Nominal vs Real GDP, Keynesian multiplier 1/(1 − MPC), open market operations, and inflation targeting.',
        keyConcepts: ['Y = C + I + G + NX', 'Keynesian Multiplier 1/(1 − MPC)', 'Real vs Nominal GDP Deflator', 'Open Market Operations'],
        content: `1. Gross Domestic Product (GDP) Expenditure Identity
GDP measures the market value of all final goods and services produced within a country in a given period:
  Y = C + I + G + (X − M)
where C = Consumption, I = Investment, G = Government Purchases, and (X − M) = Net Exports.

2. Real vs. Nominal GDP & The Keynesian Multiplier
• Nominal GDP uses current-year prices; Real GDP uses constant base-year prices to isolate real output growth.
• GDP Deflator = (Nominal GDP / Real GDP) × 100.
• Simple Autonomous Spending Multiplier: With Marginal Propensity to Consume (MPC), an initial spending change ΔG changes equilibrium output by:
  ΔY = [ 1 / (1 − MPC) ] · ΔG.`,
      },
    ],
  },
];

export const studyStorage: IStudyStorageRepository = new HybridCloudStudyRepository();
export const storageService: IStudyStorageRepository = studyStorage;


