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

  getStudentProfile(): StudentAcademicProfile;
  saveStudentProfile(profile: StudentAcademicProfile): void;

  clearAllProgress(): void;
  syncWithCloudUser(user: User | null): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const KEYS = {
  DOCUMENTS: 'learnmate_documents_v1',
  ACTIVE_DOC_ID: 'learnmate_active_doc_id_v1',
  TUTOR_PREFIX: 'learnmate_tutor_v1_',
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
  STUDY_PLANNER: 'learnmate_study_planner_v2',
  ACCESSIBILITY: 'learnmate_accessibility_v2',
  PDF_ANNOTATIONS_PREFIX: 'learnmate_pdf_annotations_v1_',
  STUDENT_PROFILE: 'learnmate_student_profile_v1',
  SEEDED: 'learnmate_seeded_materials_v1',
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

export const DEFAULT_STUDENT_PROFILE: StudentAcademicProfile = {
  fullName: 'LearnMate Student',
  educationStage: 'school',
  schoolClass: 'Class 12',
  stream: 'PCM',
  schoolBoard: 'CBSE',
  schoolName: 'National Public School',
  collegeYear: '2nd Year',
  degreeCourse: 'B.Tech CSE / AI',
  universityName: 'Indian Institute of Technology',
  academicYear: '2026–2027',
  primaryGoal: 'competitive_exam',
  targetExam: 'jee_main',
  targetExamYear: '2027',
  subjectsStudied: ['Mathematics', 'Physics', 'Chemistry', 'Probability & Statistics'],
  weakAreas: ['Conditional Probability', 'Bayes Theorem', 'Rotational Dynamics'],
  preferredLanguage: 'English',
  personalGoalStatement: 'Master probability, calculus, and mechanics with 85%+ mock test accuracy.',
  dailyStudyMinutesGoal: 90,
  updatedAt: new Date().toISOString(),
};

/**
 * Starter study materials matching the 3 recent materials shown on the approved home design.
 * Note: Quiz attempts and progress metrics are NEVER pre-populated or fabricated.
 */
export const STARTER_DOCUMENTS: StudyDocument[] = [
  {
    id: 'doc-probability-notes',
    title: 'Probability Notes.pdf',
    sourceType: 'pdf',
    fileSize: 428500,
    pageCount: 4,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    lastStudiedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    overview:
      'Comprehensive lecture notes covering Sample Spaces, Axioms of Probability, Conditional Probability, Independence, Bayes Theorem, and Discrete Random Variables.',
    topics: [
      {
        id: 'top-axioms',
        name: 'Sample Spaces & Kolmogorov Axioms',
        summary:
          'Defines sample space Ω, events as subsets, and the three foundational probability axioms including additivity for mutually exclusive events.',
        keyConcepts: ['Sample Space (Ω)', 'Non-negativity P(E) ≥ 0', 'Normalization P(Ω) = 1', 'Disjoint Additivity'],
        sourcePages: [1],
      },
      {
        id: 'top-conditional',
        name: 'Conditional Probability & Independence',
        summary:
          'Explains how observing event B restricts the sample space via P(A|B) = P(A and B) / P(B), and defines statistical independence when P(A and B) = P(A)P(B).',
        keyConcepts: ['P(A|B) = P(A & B) / P(B)', 'Multiplication Rule', 'Statistical Independence', 'Disjoint vs Independent Confusion'],
        sourcePages: [2],
      },
      {
        id: 'top-bayes',
        name: 'Law of Total Probability & Bayes Theorem',
        summary:
          'Shows how to update prior beliefs P(A) with new evidence B using likelihood P(B|A) and marginal probability P(B), with diagnostic testing applications.',
        keyConcepts: ['Prior Probability P(A)', 'Likelihood P(B|A)', 'Posterior P(A|B)', 'False Positive Paradox'],
        sourcePages: [3],
      },
      {
        id: 'top-rv',
        name: 'Discrete Random Variables & Expectation',
        summary:
          'Covers Probability Mass Functions (PMF), Linearity of Expectation E[X], and Variance Var(X) = E[X²] - (E[X])².',
        keyConcepts: ['PMF normalization Σ p(x) = 1', 'Expected Value E[X]', 'Linearity of Expectation', 'Variance Formula'],
        sourcePages: [4],
      },
    ],
    pages: [
      {
        pageNumber: 1,
        title: 'Foundations: Sample Spaces & Kolmogorov Axioms',
        content: `1. Sample Spaces and Events
In probability theory, an experiment is any process that produces a well-defined outcome. The Sample Space (denoted Ω) is the set of all possible outcomes of a random experiment. An Event E is any subset of the sample space Ω.

Examples of Sample Spaces:
• Single coin toss: Ω = {Heads, Tails}
• Rolling a six-sided die: Ω = {1, 2, 3, 4, 5, 6}

2. Kolmogorov's Three Axioms of Probability
A probability measure P assigns a real number P(E) to every event E such that:
• Axiom 1 (Non-negativity): For any event E, P(E) ≥ 0.
• Axiom 2 (Normalization): The probability of the entire sample space is P(Ω) = 1.
• Axiom 3 (Countable Additivity): If E₁, E₂, ... are mutually exclusive (disjoint) events (meaning Eᵢ and Eⱼ have no overlap for i ≠ j), then:
  P(E₁ or E₂ or ...) = Σ P(Eᵢ).

3. Key Consequences of the Axioms
• Complement Rule: P(Eᶜ) = 1 − P(E)
• Empty Set: P({}) = 0
• Inclusion-Exclusion Principle (for any two events A and B):
  P(A or B) = P(A) + P(B) − P(A and B).
Common Pitfall: Students often forget to subtract P(A and B) when events A and B can occur together.`,
      },
      {
        pageNumber: 2,
        title: 'Conditional Probability & Statistical Independence',
        content: `1. Conditional Probability
Conditional probability measures the probability that event A occurs given that event B has already occurred. Provided P(B) > 0, it is defined as:
  P(A | B) = P(A and B) / P(B)

Intuition: Observing B restricts our universe of possibilities from the original sample space Ω down to B. Within B, only the overlap (A and B) corresponds to event A occurring.

2. The Multiplication Rule
Rearranging the definition of conditional probability gives the Multiplication Rule:
  P(A and B) = P(A | B) · P(B) = P(B | A) · P(A)

3. Statistical Independence
Two events A and B are statistically independent if and only if knowing that one occurred gives no information about whether the other occurred:
  P(A and B) = P(A) · P(B)   (or equivalently P(A | B) = P(A) when P(B) > 0).

CRITICAL DISTINCTION — Disjoint vs. Independent:
• Mutually Exclusive (Disjoint) means A and B cannot occur together, so P(A and B) = 0.
• If two events A and B have non-zero probabilities (P(A) > 0 and P(B) > 0) and are disjoint, they CANNOT be independent because knowing A happened guarantees B did NOT happen (P(B | A) = 0 ≠ P(B)).`,
      },
      {
        pageNumber: 3,
        title: 'Law of Total Probability & Bayes Theorem',
        content: `1. Partition of the Sample Space & Law of Total Probability
Suppose events A₁, A₂, ..., Aₙ form a partition of Ω (they are pairwise disjoint and their union is Ω). Then for any event B:
  P(B) = Σ P(B | Aᵢ) · P(Aᵢ)

For a binary partition {A, Aᶜ}:
  P(B) = P(B | A)P(A) + P(B | Aᶜ)P(Aᶜ)

2. Bayes' Theorem
Bayes' Theorem allows us to invert conditional probabilities—computing P(A | B) from P(B | A):
  P(A | B) = [ P(B | A) · P(A) ] / P(B)
           = [ P(B | A) · P(A) ] / [ P(B | A)P(A) + P(B | Aᶜ)P(Aᶜ) ]

Terminology:
• P(A): Prior probability (initial belief before observing evidence B)
• P(B | A): Likelihood (probability of observing evidence B given hypothesis A)
• P(B): Marginal probability / normalizing evidence
• P(A | B): Posterior probability (updated belief after observing B)

3. Clinical Diagnostic Example (Base Rate Fallacy)
Suppose a rare condition affects 1% of a population (P(D) = 0.01). A test has 99% sensitivity P(+ | D) = 0.99 and 95% specificity P(− | Dᶜ) = 0.95 (so false positive rate P(+ | Dᶜ) = 0.05).
By Bayes' Theorem:
  P(D | +) = (0.99 × 0.01) / (0.99 × 0.01 + 0.05 × 0.99) = 0.0099 / 0.0594 ≈ 16.7%.`,
      },
      {
        pageNumber: 4,
        title: 'Discrete Random Variables, Expectation & Variance',
        content: `1. Discrete Random Variables and PMF
A Random Variable X is a function that maps outcomes in the sample space Ω to real numbers. For a discrete random variable X, the Probability Mass Function (PMF) is p(x) = P(X = x).
Valid PMF properties:
• p(x) ≥ 0 for all x
• Σₓ p(x) = 1 (the sum over all possible values equals 1).

2. Expected Value (Mean)
The expected value E[X] (or μ) is the probability-weighted average of all possible values of X:
  E[X] = Σₓ x · P(X = x)

Linearity of Expectation:
For ANY random variables X and Y (even if they are dependent!) and constants a, b:
  E[aX + bY] = a·E[X] + b·E[Y].

3. Variance and Standard Deviation
Variance measures the spread of X around its mean μ = E[X]:
  Var(X) = E[(X − μ)²] = E[X²] − (E[X])²

Scaling Property of Variance:
For any constant a and shift b:
  Var(aX + b) = a² · Var(X).
Note that adding a constant shift b does not change the spread, whereas multiplying X by a scales the variance by a²!`,
      },
    ],
  },
  {
    id: 'doc-sets-relations',
    title: 'Sets and Relations',
    sourceType: 'text',
    pageCount: 3,
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    lastStudiedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    overview:
      'Core discrete mathematics study notes on Set Operations, Power Sets, Cartesian Products, Binary Relations, and Equivalence Relations.',
    topics: [
      {
        id: 'top-set-ops',
        name: 'Set Theory, Subsets & Power Sets',
        summary:
          'Covers set membership, subset definitions, De Morgan Laws, and Power Set cardinality |P(A)| = 2^n.',
        keyConcepts: ['Power Set |P(A)| = 2^n', 'De Morgan Laws', 'Cartesian Product A × B', 'Empty Set {}'],
        sourcePages: [1],
      },
      {
        id: 'top-relation-props',
        name: 'Properties of Binary Relations',
        summary:
          'Defines Reflexive, Symmetric, Antisymmetric, and Transitive relations on a set A with matrix and graph criteria.',
        keyConcepts: ['Reflexive (a,a) in R', 'Symmetric vs Antisymmetric', 'Transitive Closure', 'Relation Composition'],
        sourcePages: [2],
      },
      {
        id: 'top-equivalence',
        name: 'Equivalence Relations & Partial Orders',
        summary:
          'Explains how equivalence relations (RST) partition a set into disjoint equivalence classes, while partial orders (RAT) establish hierarchy.',
        keyConcepts: ['Equivalence Relation (RST)', 'Equivalence Classes [a]', 'Partial Order (Poset)', 'Congruence Modulo n'],
        sourcePages: [3],
      },
    ],
    pages: [
      {
        pageNumber: 1,
        title: 'Set Operations, De Morgan Laws & Power Sets',
        content: `1. Sets and Subsets
A set is an unordered collection of distinct objects called elements. Set A is a subset of B if every element of A is also an element of B. The empty set {} is a subset of every set.

2. Power Set Cardinality
The Power Set P(A) is the set of all subsets of A. If a finite set A has n elements (|A| = n), then its power set has:
  |P(A)| = 2ⁿ elements.

3. Set Operations & De Morgan's Laws
• Union (A or B): {x | x is in A or x is in B}
• Intersection (A and B): {x | x is in A and x is in B}
• Difference (A − B): {x | x is in A and x is not in B}
• De Morgan's Laws:
  (A union B)ᶜ = Aᶜ intersect Bᶜ
  (A intersect B)ᶜ = Aᶜ union Bᶜ

4. Cartesian Product
The Cartesian product of sets A and B is the set of all ordered pairs:
  A × B = {(a, b) | a in A and b in B}, with cardinality |A × B| = |A| · |B|.`,
      },
      {
        pageNumber: 2,
        title: 'Binary Relations and Core Properties',
        content: `1. Definition of a Binary Relation
A binary relation R from set A to set B is any subset of A × B. A relation on a single set A is a subset of A × A. Since |A × A| = n², there are 2^(n²) possible binary relations on a set of size n.

2. Four Fundamental Properties of Relations on Set A
• Reflexive: For every element a in A, (a, a) is in R. (Every vertex has a self-loop).
• Symmetric: For all a, b in A, if (a, b) is in R then (b, a) is in R.
• Antisymmetric: For all a, b in A, if (a, b) is in R and (b, a) is in R, then a = b.
  Note: Symmetric and Antisymmetric are NOT opposites! A relation can be both (e.g. the equality relation R = {(a,a)}) or neither.
• Transitive: For all a, b, c in A, if (a, b) is in R and (b, c) is in R, then (a, c) is in R.`,
      },
      {
        pageNumber: 3,
        title: 'Equivalence Relations, Partitions & Partial Orders',
        content: `1. Equivalence Relations
A relation R on set A is an Equivalence Relation if it is:
1) Reflexive
2) Symmetric
3) Transitive

Example: Congruence Modulo n on integers Z, where a ≡ b (mod n) iff n divides (a − b).

2. Equivalence Classes and Partitions
For an equivalence relation R, the equivalence class of an element a in A is:
  [a] = {x in A | (a, x) is in R}.
Fundamental Theorem: The equivalence classes of any equivalence relation on A form a Partition of A—every element of A belongs to exactly one equivalence class, and any two classes are either identical or disjoint.

3. Partial Orders (Posets)
A relation R on set A is a Partial Order if it is:
1) Reflexive
2) Antisymmetric
3) Transitive
Example: The divisibility relation (a | b) on positive integers Z⁺, or the subset relation on P(S).`,
      },
    ],
  },
  {
    id: 'doc-stats-chapter-3',
    title: 'Statistics Chapter 3',
    sourceType: 'text',
    pageCount: 3,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    lastStudiedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    overview:
      'Chapter 3 notes on Sampling Distributions, the Central Limit Theorem, Confidence Intervals, and Hypothesis Testing (Type I & II Errors and p-values).',
    topics: [
      {
        id: 'top-clt',
        name: 'Sampling Distributions & Central Limit Theorem',
        summary:
          'Explains standard error SE = σ / √n and why the sample mean X̄ approaches a normal distribution as sample size n grows.',
        keyConcepts: ['Standard Error σ / √n', 'Central Limit Theorem (CLT)', 'Sample Size Scaling (4x n → ½ SE)', 'Unbiased Estimator'],
        sourcePages: [1],
      },
      {
        id: 'top-ci',
        name: 'Confidence Intervals & Margin of Error',
        summary:
          'Covers constructing and properly interpreting (1 − α) confidence intervals X̄ ± z* · (σ / √n) and Student t-distributions.',
        keyConcepts: ['Margin of Error z* · SE', 'Correct Frequentist CI Interpretation', 'Confidence Level vs Width Tradeoff', 'Student t-distribution (df = n − 1)'],
        sourcePages: [2],
      },
      {
        id: 'top-hypothesis',
        name: 'Hypothesis Testing, p-values & Type I/II Errors',
        summary:
          'Details null H₀ vs alternative H₁ hypotheses, p-value definition, Type I error (α), Type II error (β), and statistical power (1 − β).',
        keyConcepts: ['p-value Definition', 'Type I Error (False Positive α)', 'Type II Error (False Negative β)', 'Statistical Power (1 − β)'],
        sourcePages: [3],
      },
    ],
    pages: [
      {
        pageNumber: 1,
        title: 'Sampling Distributions & The Central Limit Theorem',
        content: `1. Statistic vs. Parameter
A parameter (such as population mean μ or standard deviation σ) describes the entire population. A statistic (such as sample mean X̄ or sample standard deviation s) is computed from a random sample of size n.

2. Properties of the Sample Mean X̄
For i.i.d. observations X₁, X₂, ..., Xₙ with mean μ and variance σ²:
• Expected Value: E[X̄] = μ (X̄ is an unbiased estimator of μ)
• Variance of Sample Mean: Var(X̄) = σ² / n
• Standard Error (SE): SD(X̄) = σ / √n

Important Scaling Rule: To cut the standard error in half, you must quadruple (4×) the sample size n because of the square root √n in the denominator!

3. The Central Limit Theorem (CLT)
Regardless of the shape of the underlying population distribution (provided σ² is finite), as sample size n becomes large (typically n ≥ 30), the sampling distribution of the standardized sample mean converges to a Standard Normal distribution:
  Z = (X̄ − μ) / (σ / √n)  →  N(0, 1).`,
      },
      {
        pageNumber: 2,
        title: 'Confidence Intervals & Student t-Distribution',
        content: `1. Structure of a Confidence Interval
A (1 − α) confidence interval for a population mean μ with known σ is:
  X̄ ± z_(α/2) · (σ / √n)
where Margin of Error (ME) = z_(α/2) · (σ / √n). For a 95% confidence interval, z* ≈ 1.96.

2. Correct Interpretation of a 95% Confidence Interval
• CORRECT: If we repeated the random sampling process many times and built a 95% interval each time, approximately 95% of those constructed intervals would capture the true fixed population parameter μ.
• INCORRECT Misconception: "There is a 95% probability that the true mean μ moves around inside this specific fixed interval." Once computed, the interval is fixed and μ is a fixed constant—either μ is inside or it isn't.

3. Unknown Population Standard Deviation (Student's t)
When σ is unknown and estimated using sample standard deviation s, we use the t-distribution with n − 1 degrees of freedom:
  X̄ ± t_(α/2, n−1) · (s / √n).`,
      },
      {
        pageNumber: 3,
        title: 'Hypothesis Testing, p-values & Type I / II Errors',
        content: `1. Null and Alternative Hypotheses
• Null Hypothesis (H₀): Baseline claim of "no effect" or "no difference" (e.g. μ = μ₀).
• Alternative Hypothesis (H₁ or Hₐ): Research claim we seek evidence for (e.g. μ ≠ μ₀).

2. What a p-value Actually Means
The p-value is the probability, assuming the null hypothesis H₀ is TRUE, of observing a test statistic at least as extreme as the one actually observed:
  p-value = P(Test Statistic ≥ observed | H₀ is true).
• Common Misconception: The p-value is NOT the probability that the null hypothesis H₀ is true!
• Decision Rule: If p-value ≤ α (significance level, e.g. 0.05), we reject H₀.

3. Type I Error, Type II Error, and Power
• Type I Error (False Positive, rate = α): Rejecting H₀ when H₀ is actually true.
• Type II Error (False Negative, rate = β): Failing to reject H₀ when H₁ is actually true.
• Statistical Power = 1 − β: The probability of correctly rejecting a false null hypothesis.`,
      },
    ],
  },
];

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

const STARTER_DOCUMENT_IDS = new Set(STARTER_DOCUMENTS.map((d) => d.id));

export class HybridCloudStudyRepository implements IStudyStorageRepository {
  private currentUser: User | null = null;
  private previousUid: string | null = null;
  private cloudUnsubscribers: Array<() => void> = [];
  private listeners = new Set<() => void>();

  constructor() {
    this.ensureSeeded();
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

  /**
   * Clears private user study data, attempts, tutor history, and caches on sign-out or account switch,
   * while preserving public preferences like themeMode, then re-seeds clean starter documents.
   */
  private clearPrivateUserCaches(): void {
    try {
      // Device preferences survive; everything else under the learnmate_ prefix is private
      // (documents, attempts, chats, profile, annotations, notebook, saved resources, caches).
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

  private ensureSeeded(): void {
    try {
      const seeded = localStorage.getItem(KEYS.SEEDED);
      const existing = safeReadJson<StudyDocument[]>(KEYS.DOCUMENTS, []);
      if (!seeded && existing.length === 0) {
        safeWriteJson(KEYS.DOCUMENTS, STARTER_DOCUMENTS);
        localStorage.setItem(KEYS.SEEDED, 'true');
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

  private async persistStudyStateToCloud(documentId: string): Promise<void> {
    if (!this.currentUser) return;
    const uid = this.currentUser.uid;
    const statePath = `users/${uid}/studyState/${documentId}`;
    try {
      const tutorMessages = this.getTutorMessages(documentId);
      const mistakes = this.getMistakeInsights(documentId);
      const revisionPlan = this.getRevisionPlan(documentId);
      const cachedQuiz = this.getCachedQuiz(documentId, 'diagnostic');
      const quickRevise = this.getQuickReviseBundle(documentId);

      await setDoc(doc(db, 'users', uid, 'studyState', documentId), {
        documentId,
        uid,
        tutorMessagesJson: JSON.stringify(tutorMessages).slice(0, 580000),
        mistakesJson: JSON.stringify(mistakes).slice(0, 280000),
        revisionPlanJson: JSON.stringify(revisionPlan).slice(0, 280000),
        cachedQuizJson: JSON.stringify(cachedQuiz || []).slice(0, 280000),
        quickReviseJson: quickRevise
          ? JSON.stringify(quickRevise).slice(0, 480000)
          : '',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, statePath);
    }
  }

  private async persistDocumentToCloud(studyDoc: StudyDocument): Promise<void> {
    if (!this.currentUser) return;
    // Built-in sample documents are seeded locally on every device; they are not user data.
    if (STARTER_DOCUMENT_IDS.has(studyDoc.id)) return;
    const uid = this.currentUser.uid;
    const docPath = `users/${uid}/documents/${studyDoc.id}`;
    try {
      const payload: Record<string, unknown> = {
        id: studyDoc.id,
        uid,
        title: studyDoc.title.slice(0, 280),
        sourceType: studyDoc.sourceType,
        pageCount: Math.max(1, Math.min(50, studyDoc.pageCount)),
        pagesJson: JSON.stringify(studyDoc.pages).slice(0, 880000),
        topicsJson: JSON.stringify(studyDoc.topics).slice(0, 180000),
        overview: (studyDoc.overview || '').slice(0, 9500),
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

  /**
   * Synchronizes local browser progress and documents with Cloud Firestore for the authenticated user.
   * Properly cleans up listeners and isolates private data on sign-out or account switch.
   */
  async syncWithCloudUser(user: User | null): Promise<void> {
    this.unsubscribeCloudListeners();

    const storedOwnerUid = readOwnerUid();

    if (!user) {
      // Local data that belongs to an account must not stay visible to whoever uses the
      // browser next (shared family laptops, coaching-lab PCs). The owner UID survives
      // page reloads, unlike previousUid.
      const wasSignedIn = this.previousUid !== null || storedOwnerUid !== null;
      this.currentUser = null;
      this.previousUid = null;
      if (wasSignedIn) {
        this.clearPrivateUserCaches();
      } else {
        this.ensureSeeded();
      }
      this.notifyListeners();
      return;
    }

    // Never merge (and upload) another account's local data into this account.
    const belongsToAnotherAccount =
      (this.previousUid !== null && this.previousUid !== user.uid) ||
      (storedOwnerUid !== null && storedOwnerUid !== user.uid);
    if (belongsToAnotherAccount) {
      this.clearPrivateUserCaches();
    }

    this.currentUser = user;
    this.previousUid = user.uid;
    writeOwnerUid(user.uid);

    const uid = user.uid;
    try {
      // 1. Save User Profile
      await setDoc(
        doc(db, 'users', uid),
        {
          uid,
          email: user.email || '',
          displayName: user.displayName || 'LearnMate Student',
          photoURL: user.photoURL || '',
          activeDocumentId: this.getActiveDocumentId() || STARTER_DOCUMENTS[0].id,
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

      // 4. Sync per-document studyState (tutor history, mistakes, revision plans, quick revise)
      for (const mDoc of mergedDocs) {
        const stateRef = doc(db, 'users', uid, 'studyState', mDoc.id);
        const stateSnap = await getDoc(stateRef);
        const localTutor = this.getTutorMessages(mDoc.id);
        const localMistakes = this.getMistakeInsights(mDoc.id);
        const localPlan = this.getRevisionPlan(mDoc.id);
        const localQuick = this.getQuickReviseBundle(mDoc.id);

        if (stateSnap.exists()) {
          const sData = stateSnap.data();
          try {
            if (localTutor.length === 0 && sData.tutorMessagesJson) {
              const cloudTutor = JSON.parse(sData.tutorMessagesJson);
              if (Array.isArray(cloudTutor) && cloudTutor.length > 0) {
                safeWriteJson(`${KEYS.TUTOR_PREFIX}${mDoc.id}`, cloudTutor);
              }
            }
            if (localMistakes.length === 0 && sData.mistakesJson) {
              const cloudMistakes = JSON.parse(sData.mistakesJson);
              if (Array.isArray(cloudMistakes) && cloudMistakes.length > 0) {
                safeWriteJson(`${KEYS.MISTAKES_PREFIX}${mDoc.id}`, cloudMistakes);
              }
            }
            if (localPlan.length === 0 && sData.revisionPlanJson) {
              const cloudPlan = JSON.parse(sData.revisionPlanJson);
              if (Array.isArray(cloudPlan) && cloudPlan.length > 0) {
                safeWriteJson(`${KEYS.REVISION_PREFIX}${mDoc.id}`, cloudPlan);
              }
            }
            if (!localQuick && sData.quickReviseJson) {
              const cloudQuick = JSON.parse(sData.quickReviseJson);
              if (cloudQuick && cloudQuick.documentId) {
                safeWriteJson(`${KEYS.QUICK_REVISE_PREFIX}${mDoc.id}`, cloudQuick);
              }
            }
          } catch {
            // ignore
          }
        } else if (
          localTutor.length > 0 ||
          localMistakes.length > 0 ||
          localPlan.length > 0 ||
          localQuick
        ) {
          await this.persistStudyStateToCloud(mDoc.id);
        }
      }

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

      this.cloudUnsubscribers.push(docsUnsub, attemptsUnsub);
      this.notifyListeners();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }
  }

  getDocuments(): StudyDocument[] {
    const docs = safeReadJson<StudyDocument[]>(KEYS.DOCUMENTS, STARTER_DOCUMENTS);
    return [...docs].sort(
      (a, b) => new Date(b.lastStudiedAt).getTime() - new Date(a.lastStudiedAt).getTime()
    );
  }

  getDocumentById(id: string): StudyDocument | null {
    const docs = this.getDocuments();
    return docs.find((d) => d.id === id) || null;
  }

  saveDocument(studyDoc: StudyDocument): void {
    const enriched: StudyDocument = {
      ...studyDoc,
      contentVersion: studyDoc.contentVersion || computeContentVersion(studyDoc),
    };
    const docs = this.getDocuments();
    const index = docs.findIndex((d) => d.id === enriched.id);
    if (index >= 0) {
      docs[index] = enriched;
    } else {
      docs.unshift(enriched);
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
    this.notifyListeners();
  }

  deleteCreativeAsset(id: string): void {
    const list = safeReadJson<CreativeAsset[]>(KEYS.CREATIVE_ASSETS, []).filter(
      (a) => a.id !== id
    );
    safeWriteJson(KEYS.CREATIVE_ASSETS, list);
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
    // Merge with defaults so profiles saved by an older schema never miss newer fields.
    const stored = safeReadJson<Partial<StudentAcademicProfile> | null>(
      KEYS.STUDENT_PROFILE,
      null
    );
    return { ...DEFAULT_STUDENT_PROFILE, ...(stored || {}) };
  }

  saveStudentProfile(profile: StudentAcademicProfile): void {
    const updated: StudentAcademicProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    safeWriteJson(KEYS.STUDENT_PROFILE, updated);
    this.notifyListeners();
  }

  clearAllProgress(): void {
    try {
      const docs = this.getDocuments();
      const attempts = this.getQuizAttempts();
      localStorage.removeItem(KEYS.ATTEMPTS);
      localStorage.removeItem(KEYS.FOCUS_SESSIONS);
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

export const STARTER_PLANNER_TASKS: StudyPlannerTask[] = [
  {
    id: 'plan-task-1',
    title: 'Review Bayes Theorem & Total Probability (Pages 2–3)',
    dateIso: new Date().toISOString().slice(0, 10),
    durationMinutes: 25,
    category: 'revision',
    completed: false,
    documentId: 'doc-probability-notes',
  },
  {
    id: 'plan-task-2',
    title: 'Complete 10-Question Diagnostic Practice on Sets & Relations',
    dateIso: new Date().toISOString().slice(0, 10),
    durationMinutes: 20,
    category: 'practice',
    completed: false,
    documentId: 'doc-sets-relations',
  },
  {
    id: 'plan-task-3',
    title: 'Spaced Repetition Flashcard Check: Central Limit Theorem',
    dateIso: new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10),
    durationMinutes: 15,
    category: 'study',
    completed: false,
    documentId: 'doc-stats-chapter-3',
  },
];

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


