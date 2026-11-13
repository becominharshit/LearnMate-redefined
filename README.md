# LearnMate JEE — Commercial Study Workspace & NTA CBT Platform

LearnMate JEE is a full-stack study workbench for JEE Main, JEE Advanced, BITSAT, and VITEEE aspirants built with React 19, Vite, Tailwind CSS, Express + WebSockets, Firebase Auth/Firestore, KaTeX math rendering, and Gemini AI tutoring.

## Core Architecture

- **Frontend (Vercel)**: React + TypeScript + Vite SPA proxying `/api/*` via `vercel.json` to the Render Express backend, with offline PWA caching (`public/sw.js`) and IndexedDB lazy-loaded practice packs (`public/pyq-packs/`).
- **Backend (Render)**: Node.js + Express (`server.ts`) hosting Gemini AI routes (`GEMINI_MODEL_FAST`, `GEMINI_MODEL_THINKING`, `GEMINI_MODEL_LIVE` with automatic `404`/`429` fallback chain), Socratic hints, OCR doubts, YouTube transcript extraction, live Voice Tutor WebSocket (`/api/live`), commercial quotas & waitlist, and health checks (`/api/health`).
- **Auth & Persistence (Firebase)**: Firebase Auth (Google OAuth popup + `signInWithRedirect` fallback + email verification + password reset) and owner-isolated Firestore & Firebase Storage (`firestore.rules`, `storage.rules`).

## Key Features

- **Study Workbench & Syllabus Notes**: Full KaTeX-rendered Physics, Chemistry, and Mathematics chapter notes (`<MathText>`), formulas, worked examples, common mistakes, and revision checkpoints.
- **Practice Hub & CBT Exam Simulator**:
  - Full 75-question NTA JEE Main 2027 mock blueprint (`+4 / -1` Section A & B) and JEE Advanced multi-correct (`+4 / +3 / +2 / +1 / -2`), comprehension, and matrix-match papers.
  - 22 lazy-loaded, shift-tagged Original Editorial Practice Packs (550 questions) cached locally in IndexedDB with strict provenance tracking (`ORIGINAL_EDITORIAL`, `isFakeShiftAssignment: false`).
- **Revision Studio**: Flashcards with spaced repetition, crisp wrapping Mind Maps (`#learnmate-mindmap-svg`), Formula Book, and exportable sheets.
- **Study Tools Lab**: Interactive 2D/3D function graphing, matrix calculator, geometry sandbox, and scientific calculator.
- **AI Tutor & Voice Tutor**: Grounded page-citation explanations, OCR photo doubt solving, Socratic hints, and live streaming voice tutoring.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and populate your Gemini & Firebase credentials.
3. Run the full-stack server (Express + Vite middlewares on port `3000`):
   ```bash
   npm run dev
   ```
4. Run unit tests & type checks:
   ```bash
   npm test
   npm run lint
   ```
5. Build for production:
   ```bash
   npm run build
   ```

## Deployment (Vercel + Render + Firebase)

- **Backend (Render)**: Uses `render.yaml` (`npm install && npm run build`, `npm start` -> `node server.ts`, health check `/api/health`). Set `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_THINKING`, `GEMINI_MODEL_LIVE`, `ALLOWED_ORIGINS`, and Firebase Admin env vars.
- **Frontend (Vercel)**: Update the destination Render backend URL in `vercel.json`, and configure `VITE_FIREBASE_*` and `VITE_WS_BASE_URL` environment variables in Vercel.
- **Load Testing**: Execute `k6 run load-tests/k6-study-api.js` against a staging or local instance.
