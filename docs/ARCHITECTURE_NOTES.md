# LearnMate JEE — Architecture & Provenance Notes

## 1. System Architecture Overview
LearnMate JEE is a local-first, full-featured JEE Main & Advanced academic study workbench built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **KaTeX**, **PDF.js (`pdfjs-dist`)**, and **Firebase Auth / Firestore** cloud synchronization.

### Core Modules
- **Top Navigation & Global Utilities (`src/App.tsx`, `src/components/CompactStudyUtilitiesWidget.tsx`)**:
  - Primary workspaces: `Home` (`dashboard`), `Study` (`study`), `Practice` (`practice`), `Revise` (`revise`), `Progress` (`analytics`), and `Create` (`create`).
  - Single unified **Focus Timer** in the top bar backed by `studyStorage.getStudyTimerState()` / `studyStorage.saveStudyTimerState()`, alongside the **Study Tools** slide-over drawer (Scientific Calculator, Cartesian Function Grapher, JEE Formula Sheet, Unit Converter, Scratchpad) and **Night Owl** dark-mode toggle.
- **Unified Study Workbench & Whitish Editorial AI Tutor (`src/components/StudyView.tsx`)**:
  - Integrates `Syllabus`, `Chapter Notes`, `My Materials`, `AI Tutor`, `Create`, and `Resources`.
  - Features a clean, anti-AI-slop whitish academic consultation UI (`#FFFFFF` primary sheet, `#FAFAFA` structural header/footer strips, `1px solid #E2E8F0` hairline dividers, rectangular source-scope controls, and unboxed typographic provenance labels).
  - Supports live streaming responses (`streamDocumentQuestion`), verifiable page citations, Feynman recall (`Teach It Back`), Chapter Diagnostic Quizzes, Adaptive Drills, and one-click contextual handoff to the **Visual Concept Studio**.
- **Creative Studio (`src/components/CreateStudioView.tsx`, `src/utils/diagramEngine.ts`, `src/utils/visualLearningEngine.ts`)**:
  - Deterministic scientific SVG diagram generator (Free-Body Diagrams, Ray Optics, RC/RLC Circuits, VSEPR/Electrochemistry, Conics/Calculus) with progressive step-by-step build, interactive concept checks, misconception reteaching, and Web Speech narration.
- **Practice & NTA CBT Exam Simulator (`src/components/PracticeWorkspaceView.tsx`, `src/components/JeeCbtExamModal.tsx`, `src/utils/pyqCorpusEngine.ts`, `src/utils/jeeQuestionBank.ts`)**:
  - Supports Topic Drills, NTA JEE Main / Advanced CBT Mocks, Mistake Replay, and Official Past Paper (PYQ) reconstruction with `resolveMarkingRule()` (`+4/-1` MCQ, `+4/0` Numerical, and JEE Advanced partial marking).

---

## 2. Local & Cloud Persistence Schema (`src/services/storageService.ts`)
All study state persists deterministically in `localStorage` with optional real-time Firestore synchronization (`src/services/firebaseClient.ts`):
- `learnmate_documents_v2`: Uploaded PDFs, YouTube lectures, scanned notes, and built-in JEE reference packs.
- `learnmate_quiz_attempts_v2`: Diagnostic quizzes and full CBT mock attempts (including `questions`, `answers`, `weakTopics`, `strongTopics`).
- `learnmate_flashcards_v2`: SM-2 spaced repetition flashcards.
- `learnmate_mistakes_v1`: Mistake notebook entries with error-tag taxonomy (`conceptual`, `formula`, `calculation`, `sign_unit`, `reading`).
- `learnmate_study_timer_v1`: Unified Focus Timer state (`mode`, `durationSeconds`, `remainingSeconds`, `isRunning`, `lastTickEpochMs`, `completedSessionsToday`).
- `learnmate_rewards_ledger_v1` & `learnmate_streak_Freeze_v1`: Gamified XP ledger, daily study streak calendar, and milestone badges.

---

## 3. Content Provenance & Honest Labeling
- Built-in syllabus chapters cover **58 NTA JEE Main & Advanced chapters** (`20` Physics, `19` Chemistry, `19` Mathematics) with full theory notes, derivations, worked examples, and quick revision sheets (`src/utils/jeeSyllabusCatalog.ts`, `src/utils/jeeChapterNotesCatalog.ts`).
- Built-in PYQ papers in `src/utils/pyqCorpusEngine.ts` are explicitly labeled with `getPyqCorpusCoverageAudit()` and exported as `LearnMate Reconstructed PDF (N Verified Local Corpus Questions)` so reconstructed practice subsets are never misrepresented as full 75-question scanned NTA booklets.
