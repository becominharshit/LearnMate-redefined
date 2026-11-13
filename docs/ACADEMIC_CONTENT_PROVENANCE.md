# Academic Content Provenance & Exam Specifications

## 1. Resolution of Historical PYQ Attribution Defect

Previously, `src/utils/pyqCorpusEngine.ts` distributed items from `DEFAULT_JEE_75_QUESTION_PAPER` into historical shift slots (`2021–2025`), making non-official editorial questions appear as verified historical NTA past-year questions. That behavior has been eliminated.

### Strict `QuestionSourceCategory` Taxonomy (`src/utils/pyqCorpusEngine.ts`)
Every item in the question bank carries an explicit `sourceCategory`:
1. `OFFICIAL_VERIFIED`: Genuine NTA / IIT historical question with verified official source & answer-key provenance.
2. `OFFICIAL_RECONSTRUCTED_PENDING_REVIEW`: Memory-based/reconstructed shift item awaiting editorial review.
3. `ORIGINAL_EDITORIAL`: LearnMate-authored practice question (not claimed as a historical NTA question).
4. `AI_GENERATED_REVIEWED`: AI-drafted question that passed schema + rubric review.
5. `AI_GENERATED_UNVERIFIED`: Unreviewed AI-drafted drill item (excluded from official mock papers).
6. `SOURCE_RESTRICTED`: Excluded from redistribution due to licensing/copyright checks.
7. `REJECTED`: Removed due to ambiguity, syllabus mismatch, or answer-key error.

---

## 2. Current Live Corpus Inventory (Verified via `/api/pyq/provenance`)

| Collection | Count | Notes |
|---|---:|---|
| `officialVerifiedPyqs` | **0** | Pending verified licensed/public-domain NTA JSON dataset import via `scripts/ingestPyqDatasets.ts` and `src/ingestion/`. |
| `reconstructedPendingReview` | **0** | Separated queue for memory-based review. |
| `originalEditorialPractice` | **84** | Includes LearnMate 75-Q NTA-pattern JEE Main 2027 editorial mock (`#1`) + JEE Advanced multi-correct/matrix/comprehension items (plus editorial BITSAT/VITEEE items in `commercialScaleEngine.ts`). |
| `aiGeneratedPractice` | **0** | Generated dynamically from student notes with clear AI provenance labels. |
| `incompleteHistoricalPapersCount` | **6** | Historical shifts (`2021–2025`) are surfaced explicitly as catalog slots (`0 loaded` / pending official import) and never silently padded with unrelated mock items unless the student explicitly clicks `"Assemble 75-Q Mock"` / `"Launch Pattern Sim"`. |

### Backward Compatibility Migration
- Legacy question IDs used in prior saved student attempts are mapped safely through `resolveCorpusQuestionById()` (`src/utils/pyqCorpusEngine.ts`) so existing Mistake Book entries and quiz scores do not break.

---

## 3. Versioned Exam Rule Specifications (`src/utils/examRegistry.ts`)

Exam rules are versioned instead of hard-coded globally:
- **JEE Main 2027 (`NTA_JEE_MAIN_2025_PLUS` / `v2025.1`–`2027`):**
  - 3 subjects (Physics, Chemistry, Mathematics) × (20 SCQ + 5 **compulsory** Numerical) = **75 questions**, **300 max marks**, **180 minutes**.
  - Marking: `+4` correct, `-1` incorrect (including Section B numericals), `0` unattempted; official nearest-integer / 2-decimal configurable tolerance matching NTA answer-key rules.
- **Historical JEE Main (`2021–2024` Blueprint):**
  - Explicitly modeled separately as 20 SCQ + 10 Section B numericals (attempt any 5; 90 questions on paper, 300 max marks) so 2027 rules are never retroactively misapplied to 2021–2024 papers.
- **JEE Advanced (`Paper 1` Multi-Format):**
  - Year/paper-specific rules supporting Single Correct, Multi-Correct partial credit (`+4 / +3 / +2 / +1 / 0 / -2` zero-tolerance negative rule), Integer/Numerical, Comprehension Passages, and Matrix Matching.
- **JEE Main 2027 Syllabus Reconciliation:**
  - `src/data/expandedNta58Chapters.ts` & `src/data/jeeSyllabusAndNotes.ts` align with NTA's reduced 2024–2027 unit structure (`Physics 20 units`, `Chemistry 20 units`, `Mathematics 14 units` reconciled against legacy chapter IDs).

---

## 4. Score, Percentile & AIR Estimation Disclaimers

- `predictShiftPercentileAndAir()` (`src/utils/pyqCorpusEngine.ts`) explicitly attaches:
  - `isEmpiricalNtaData: false`
  - `heuristicEstimatorModelVersion`
  - `confidenceBandMarks` & `methodologyDisclaimer`
- `JeeCbtExamModal.tsx` displays raw score (`out of 300`) separately from heuristic percentile bands and warns students that predictions are non-official approximations rather than real NTA shift-normalized AIRs.
