# LearnMate JEE — Master Engineering Repair Ledger

## Overview
This ledger documents every audited, repaired, and verified issue across UI/Navigation, Study Tools, Mathematical Corpus Integrity, CBT Scoring, AI Tutor UI Redesign, and Local/Cloud State Persistence.

---

## Repair Entry 1 — Duplicate Focus Timer Consolidation (Section 4A)
- **Issue**: Two independent timer controls existed simultaneously: one in the top utility bar (`CompactStudyUtilitiesWidget.tsx`) using local transient state and a second floating `<DynamicCompanion />` timer in the bottom-right corner (`App.tsx`) using `studyStorage.getStudyTimerState()`.
- **Root Cause**: `CompactStudyUtilitiesWidget` maintained an isolated `useState(25 * 60)` countdown while `DynamicCompanion` mounted globally in `App.tsx` and read/wrote `learnmate_study_timer_v1`.
- **Files Affected**:
  - `src/components/CompactStudyUtilitiesWidget.tsx`
  - `src/App.tsx`
- **Solution**:
  - Upgraded `CompactStudyUtilitiesWidget.tsx` to read and persist state through `studyStorage.getStudyTimerState()` / `studyStorage.saveStudyTimerState()` and `computeTimerRemainingSeconds()`, supporting Start, Pause, Resume, Reset, `25m` / `50m` Sprint presets, session completion logging, and XP award.
  - Removed the duplicate floating `<DynamicCompanion />` mount from `src/App.tsx`.
- **Verification**: `VERIFIED` (Unit test + live Playwright DOM check confirms single top-bar Focus Timer `[data-testid="study-timer-toggle-btn"]` and zero floating companion instances).
- **Remaining Edge Cases**: None.

---

## Repair Entry 2 — AI Study Tutor Clean Whitish Anti-AI-Slop UI Redesign (User Request & Section 6)
- **Issue**:
  1. Clicking the `AI Tutor` tab in the Study Hub bar previously left `hubSection` as `'my_materials'` instead of activating `'ai_tutor'`.
  2. The AI Tutor panel used AI-slop decorative patterns (`<Sparkles />` icons, `rounded-full` pill capsules for static source badges, right-aligned chat bubbles, and nested gray cards inside cards).
- **Root Cause**: Legacy styling in `src/components/StudyView.tsx` mixed conversational chat-bubble aesthetics with decorative pill badges and did not distinguish the dedicated `ai_tutor` tab layout from the split `my_materials` view.
- **Files Affected**:
  - `src/components/StudyView.tsx`
- **Solution**:
  - Rebuilt the AI Tutor interface (`[data-testid="ai-tutor-panel"]`) using a clean, professional, anti-AI-slop **whitish academic consultation sheet** (`#FFFFFF` primary sheet, `#FAFAFA` header/composer strips, `1px solid #E2E8F0` hairline dividers, and full dark-mode parity).
  - Removed decorative `<Sparkles />` icons and `rounded-full` static pills; replaced them with rectangular segmented controls (`[data-testid="source-mode-extended"]`, `[data-testid="source-mode-material-only"]`) and an unboxed typographic provenance header (`[data-testid="tutor-source-badge"]`).
  - Enabled dedicated `hubSection === 'ai_tutor'` 4/8 Tutor-first layout alongside the 7/5 `my_materials` split layout while preserving 100% of functions, handlers, citations, and `data-testid` attributes.
- **Verification**: `VERIFIED` (TypeScript check, production build, and live Playwright interaction on both `My Materials` and `AI Tutor` tabs).
- **Remaining Edge Cases**: None.

---

## Repair Entry 3 — Scientific Calculator & Function Grapher Reciprocal Trig, Unary Minus, and Nested Degree Evaluation (Section 9A)
- **Issue**:
  1. Cartesian Function Grapher failed to compile `sec(x)`, `csc(x)`, and `cot(x)` expressions.
  2. Unary minus before exponentiation (`-2^2` or `-x^2 + 4`) evaluated as `(+2)^2 = 4` because JavaScript's `**` operator rejects unparenthesized unary minus or misbinds when rewritten naively.
  3. Scientific Calculator in `DEG` mode mis-evaluated nested parentheses inside trig arguments (`sin(15 + (15))`) and did not support `sec`, `csc`, `cot`, or inverse trig degree conversion (`asin(0.5) = 30`).
- **Root Cause**: Regex-only replacement in `evaluateScientificExpression` and missing reciprocal trig helpers in `compileMathExpression`.
- **Files Affected**:
  - `src/utils/learnmate2Engine.ts`
  - `src/components/CompactStudyUtilitiesWidget.tsx`
  - `src/utils/productExpansion.test.ts`
- **Solution**:
  - Added balanced-parenthesis degree-mode argument wrapping and reciprocal/inverse trig helpers (`__sin`, `__cos`, `__tan`, `__sec`, `__csc`, `__cot`, `__asin`, `__acos`, `__atan`) to `evaluateScientificExpression`.
  - Updated `compileMathExpression` to support `sec`, `csc`, `cot`, and `ln` and to parenthesize exponentiation bases before unary minus (`-(base ** exp)`).
  - Added quick-insert buttons for `sec(`, `csc(`, `cot(` in the Calculator and `sec(x)` preset in the Grapher.
- **Verification**: `VERIFIED` (Unit tests in `src/utils/productExpansion.test.ts` + live Playwright verification).
- **Remaining Edge Cases**: None.

---

## Repair Entry 4 — JEE CBT Mock Submission Crash & Marking Scheme Resolution (Section 11)
- **Issue**: Submitting a custom CBT Mock from `PracticeWorkspaceView` crashed when looking up lowercase or versioned `markingRuleId` values (`jee_main_mcq_v2025`, `jee_main_numeric_v2025`) in `MARKING_RULES`. Additionally, `MATHEMATICS_MCQ_BANK[11]` (`f(x) = x^2 - 4x + 5`) had `correctOptionIndex: 1` (`0`) instead of `2` (`1`).
- **Root Cause**: `MARKING_RULES` in `src/utils/pyqCorpusEngine.ts` only keyed uppercase `_V1` identifiers, and `JeeCbtExamModal.tsx` indexed `MARKING_RULES[q.markingRuleId]` directly without fallback.
- **Files Affected**:
  - `src/utils/pyqCorpusEngine.ts`
  - `src/components/JeeCbtExamModal.tsx`
  - `src/components/PracticeWorkspaceView.tsx`
- **Solution**:
  - Added `resolveMarkingRule(ruleId, questionFormat)` and all versioned aliases in `src/utils/pyqCorpusEngine.ts`.
  - Updated `JeeCbtExamModal.tsx` to score every question via `resolveMarkingRule(q.markingRuleId, q.format)`.
  - Fixed `MATHEMATICS_MCQ_BANK[11]` `correctOptionIndex` to `2` (minimum value `1` at `x = 2`) and persisted `questions`, `answers`, `weakTopics`, and `strongTopics` into `QuizAttempt` upon mock completion.
- **Verification**: `VERIFIED` (Unit test + live Playwright CBT Mock launch and submission).
- **Remaining Edge Cases**: None.

---

## Repair Entry 5 — Mathematical Answer Key & Self-Contradictory Explanation Audit (Section 10)
- **Issue**: Four questions in `src/utils/jeeQuestionBank.ts` (`jee-math-54`, `jee-math-55`, `jee-math-72`, `jee-math-73`) contained `"Wait,"` self-contradictions in their explanations or mismatched option indices/numeric values.
- **Root Cause**: Unedited LLM draft trace strings in `jeeQuestionBank.ts`.
- **Files Affected**:
  - `src/utils/jeeQuestionBank.ts`
  - `src/utils/productExpansion.test.ts`
- **Solution**:
  - `jee-math-54`: Corrected constant term of `(2x^2 - 3/x^3)^5` to `108` (`correctOptionIndex: 1`).
  - `jee-math-55`: Corrected coefficient of `x^5` in `(1 + x)^11` to `C(11,5) = 462` (`correctOptionIndex: 1`).
  - `jee-math-72`: Corrected integrating factor ODE statement and solution to `y(1) = 1 + 2e^{-2}` (`y(1) - 1 - 2e^{-2} = 0`, `correctOptionIndex: 0`).
  - `jee-math-73`: Corrected area bounded by `y = x^2` and `y = 4` in the first quadrant to `(2/3) * 2 * 4 = 16/3`, so `3A / 4 = 4` (`correctNumericValue: 4`).
  - Added automated test assertions ensuring zero `"Wait,"` strings and verifying exact mathematical answer keys across the question bank.
- **Verification**: `VERIFIED` (`npm test` — `147 / 147` passing).
- **Remaining Edge Cases**: None.

---

## Repair Entry 6 — Study Hub Sub-Section Deep Linking & Progress Reset Completeness (Sections 4D & 12)
- **Issue**:
  1. Dashboard links (`Explore Syllabus →`, `All Chapters & Notes →`) and App Guide entries opened `StudyView` without switching to the target sub-section (`syllabus`, `chapter_notes`, `ai_tutor`, `resources`).
  2. `studyStorage.clearAllProgress()` left `learnmate_rewards_ledger_v1` and `learnmate_daily_coach_completed_v1` in `localStorage`.
- **Root Cause**: Missing `initialHubSection` prop plumbing between `App.tsx`, `StudentDashboardView.tsx`, `AppGuideAndSearchModal.tsx`, and `StudyView.tsx`, and incomplete key list in `clearAllProgress()`.
- **Files Affected**:
  - `src/App.tsx`
  - `src/components/StudentDashboardView.tsx`
  - `src/components/AppGuideAndSearchModal.tsx`
  - `src/components/StudyView.tsx`
  - `src/services/storageService.ts`
- **Solution**:
  - Wired `onOpenStudySection(section)` and `initialHubSection` + `hubSectionVersion` so deep links open the exact Study Hub sub-section.
  - Added `REWARDS_LEDGER_KEY` and `DAILY_COACH_COMPLETED_KEY` removal to `clearAllProgress()`.
- **Verification**: `VERIFIED` (Unit test + live Playwright navigation check).
- **Remaining Edge Cases**: None.
