# LearnMate V1 — Open-Source PYQ Datasets & Question Bank Integration Engine

## 1. Existing Architecture Audit Summary

- **Frontend Stack**: React 19 + TypeScript + Tailwind CSS v4 + Vite 8 + KaTeX mathematical rendering (`MathText`).
- **Backend & Server**: Express (`server.ts`) serving server-side Gemini proxy routes (`/api/*`) and Vite middleware in development.
- **Database & Persistence**:
  - **Firebase Authentication & Cloud Firestore**: Configured in `src/firebase.ts` with schema definitions in `firebase-blueprint.json` and hardened Attribute-Based Access Control (ABAC) rules in `firestore.rules`.
  - **Local-First Persistence**: `src/services/storageService.ts` and `src/services/indexedDbStorage.ts` provide instant offline-capable storage synchronized with Firestore.
- **Existing Question & Mock Modules Preserved**:
  - `src/utils/jeeQuestionBank.ts`: 75-question verified NTA JEE Main baseline paper.
  - `src/utils/pyqCorpusEngine.ts`: Versioned JEE Main & JEE Advanced scoring engine (`+4/-1`, `+3/-1`, `+4/-2` with partial credit `+3/+2/+1`, non-negative integer `+4/0`, dropped/bonus questions, PDF export).
  - `src/components/PracticeWorkspaceView.tsx` & `src/components/JeeCbtExamModal.tsx`: Interactive chapter/year PYQ solver and NTA 5-state CBT simulator.

---

## 2. External Dataset Sources & Provenance Audit Matrix

Never assume a GitHub repository's software license (e.g., MIT) covers third-party question content, scraped API dumps, or copyrighted coaching solutions. Each investigated source was audited across four independent rights dimensions (**Question Stems**, **Official Answer Keys**, **Worked Solutions**, and **Diagrams/Media**):

| Discovery Name | Verified Repository URL | Formats | Software License | Component Rights Breakdown | Commercial Redistribution | Audit Decision |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **JEE Mocks DB** | `https://github.com/Samkarya/online-exam-questions` | `JSON`, `CSV` | MIT License | Stems: Public NTA Exam Record · Keys: Public NTA Record · Solutions: None · Media: Original/None | **Permitted** | `APPROVED_FOR_IMPORT` |
| **JEE Main PYQ** | `https://github.com/HostServer001/jee_mains_pyqs_data_base` | `JSON`, `JSONL` | **No License** (All Rights Reserved) | Stems: Scraped API · Keys: Unverified 3P · Solutions: Copyrighted 3P HTML · Media: Hotlinked CDN | **Forbidden** | `REJECTED_UNCLEAR_PROPRIETARY_RIGHTS` |
| **LearnOpt** | `https://github.com/joyboseroy/learnopt` (`huggingface.co/datasets/joyboseroy/...`) | `JSONL`, `CSV` | MIT (Code) · CC-BY-4.0 (Dataset) | Stems: Public Exam Record · Keys: Public Key · Solutions: Authored Permissive · Taxonomy: CC-BY-4.0 | **Permitted (with CC-BY-4.0 attribution)** | `APPROVED_FOR_IMPORT` |
| **QPE** | `https://github.com/SuperSat001/Question-Extractor` | `PDF`, `JSON` | MIT License (Extractor Utility) | Parser utility only; approved exclusively when extracting from official NTA / IIT JAB public bulletins | **Permitted (Public Official PDFs)** | `APPROVED_METADATA_AND_PUBLIC_EXAM_EXAM_STEMS_ONLY` |

---

## 3. Unified Question Schema (`UnifiedQuestionRecord`)

Defined in `src/ingestion/types.ts`:

```json
{
  "id": "lm-q-jee-mocks-db-jmdb-2025-jan-s1-phy-01",
  "exam": "JEE_MAIN",
  "year": 2025,
  "session": "JANUARY",
  "shift": 1,
  "subject": "PHYSICS",
  "chapter": "ROTATIONAL_MOTION",
  "topic": "ANGULAR_MOMENTUM",
  "difficulty": "MEDIUM",
  "questionType": "MCQ_SINGLE",
  "question": {
    "text": "A thin uniform circular disc of mass $M = 2\\text{ kg}$...",
    "images": [],
    "equations": ["L_i = L_f", "I_{\\text{disc}} = \\frac{1}{2}MR^2"]
  },
  "options": [
    { "id": "A", "text": "$6\\text{ rad/s}$" },
    { "id": "B", "text": "$8\\text{ rad/s}$" },
    { "id": "C", "text": "$9\\text{ rad/s}$" },
    { "id": "D", "text": "$10\\text{ rad/s}$" }
  ],
  "correctAnswer": ["B"],
  "solution": {
    "text": "By conservation of angular momentum...",
    "type": "OFFICIAL",
    "verified": true,
    "keyFormula": "I_1 \\omega_1 = (I_1 + mR^2)\\omega_2",
    "revisionHistory": []
  },
  "metadata": {
    "source": "JEE Mocks DB",
    "sourceUrl": "https://github.com/Samkarya/online-exam-questions",
    "license": "MIT / Public NTA Exam Record",
    "provenanceVerified": true,
    "importedAt": "2026-11-11T00:00:00.000Z",
    "externalId": "JMDB-2025-JAN-S1-PHY-01",
    "canonicalHash": "qhash-..."
  },
  "status": "APPROVED"
}
```

---

## 4. Ingestion Architecture & Module Layout

```text
src/ingestion/
  index.ts                    # Barrel exports & bidirectional PyqCorpusQuestion <-> UnifiedQuestionRecord adapters
  types.ts                    # UnifiedQuestionRecord, provenance, validation, duplicate, checkpoint & mock types
  sources/
    sourceRegistry.ts         # Verified GitHub source catalog, license/provenance audit & sample JSON/JSONL/CSV payloads
  parsers/
    index.ts                  # JSON, JSONL, RFC-4180 CSV, and QPE PDF-extracted text parsers
  normalizers/
    index.ts                  # Question & solution normalizers, equation extractor, FNV-1a hash & composite key builders
  validators/
    index.ts                  # 9-rule schema/math/image validator, license gatekeeper & 3-stage duplicate detector
  solutionsEngine.ts          # OFFICIAL / VERIFIED / AI_GENERATED / PENDING state machine & expert review workflow
  firestoreImporter.ts        # Chunked Firestore batch writer (<=400/batch), dry-run, resumable checkpoints & mock blueprints
  ingestionEngine.test.ts     # Comprehensive unit test suite
scripts/
  ingestPyqDatasets.ts        # Standalone CLI runner (--dry-run, --source)
src/components/
  AdminQuestionBankModal.tsx  # 5-tab Admin Question Bank & Provenance Console
```
