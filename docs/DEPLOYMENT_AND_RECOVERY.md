# Deployment, Monitoring & Disaster Recovery Runbook

## 1. Environment Configuration (`.env.example`)

All secrets remain strictly server-side (`server.ts`, `src/server/*`); only `VITE_*` Firebase client public keys are exposed to the browser bundle.

| Variable | Required For | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Gemini Tutor, Vision OCR, Live Voice WS | Never exposed to frontend. |
| `ANTHROPIC_API_KEY` | Claude failover / diagrams | Optional if Gemini-only; keys remain server-side. |
| `ADMIN_TOKEN` | Protected `/api/commercial/admin/*` endpoints | Checked via timing-safe comparison alongside verified Firebase admin claims. |
| `YOUTUBE_API_KEY` | YouTube lecture metadata enrichment | Optional; transcripts never fabricated when unavailable. |
| `PAYMENT_WEBHOOK_SECRET` | Razorpay/Stripe webhook verification | Billing checkout stays disabled until configured. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` / ADC | Production Firebase Admin ID token verification & Firestore Admin writes | Without it, `GET /api/readiness` reports `firestoreAdminReady: false`. |
| `ALLOWED_ORIGINS` | Strict CORS allowlist in production | Required in production deployments. |
| `AI_REQUESTS_PER_MINUTE` | Server rate limiter threshold | Defaults to `180` IP burst / tier-derived user caps. |

---

## 2. Build, CI & Health Endpoints

- **CI Pipeline (`.github/workflows/ci.yml`):** Executes install (`npm ci` when lockfile present, else `npm install`), `npm run lint` (`tsc --noEmit`), `npm test` (`tsx --test "src/**/*.test.ts"`), `npm run build` (`vite build`), and `npm audit --omit=dev`.
- **Note on Dependency Audit:** Generate and commit `package-lock.json` (`npm install --package-lock-only`) prior to GA so `npm audit --omit=dev` runs cleanly (`npm audit` fails with `ENOLOCK` without a lockfile).
- **Latest Verified Build Output (`vite build`):**
  - Succeeded in `3.22s`.
  - Lazy route chunks verified: `StudyToolsWorkspaceView` (`629.36 kB`), `PracticeWorkspaceView` (`284.49 kB`), `QuickReviseView` (`126.79 kB`), `StudyView` (`76.33 kB`), `ProgressView` (`54.73 kB`), `JeeCbtExamModal` (`128.43 kB`).
  - Main bundle `index.js`: `3,273.10 kB` (`1,007.07 kB` gzip) — candidate for further vendor sub-chunking (`three`, `pdfjs-dist`, `pdf-lib`) before mobile-network GA.
- **Health & Readiness Probes:**
  - `GET /api/health`: Liveness + store mode (`durable_disk_store`), AI key presence, corpus provenance counts (`officialVerifiedQuestionsCount: 0`, `originalEditorialQuestionsCount: 84`, `incompleteHistoricalPapersCount: 6`).
  - `GET /api/readiness`: Reports component readiness (`persistence: true`, `firestoreAdminReady: false`, `billing: false` in unconfigured local mode).

---

## 3. Measured Load & Concurrency Baseline (`scripts/benchmarkConcurrency.ts`)

Measured locally against Express + Vite dev server on `http://127.0.0.1:3000`:

| Endpoint | Concurrency / Total | Measured RPS | p50 (ms) | p95 (ms) | Status Breakdown |
|---|---:|---:|---:|---:|---|
| `GET /api/health` | `c=20, n=120` | `540.9 RPS` | `18.32` | `53.60` | `120 x 200`, `0 x 5xx` |
| `GET /api/pyq/provenance` | `c=16, n=80` | `929.5 RPS` | `15.38` | `25.47` | `80 x 200`, `0 x 5xx` |
| `GET /api/pyq/questions?limit=15` | `c=16, n=80` | `906.5 RPS` | `14.32` | `24.93` | `80 x 200`, `0 x 5xx` |
| `POST /api/cbt/grade` | `c=12, n=60` | `621.6 RPS` | `11.71` | `46.73` | `20 x 200`, `40 x 429` (IP rate limiter engaged cleanly at 180 req/min) |

*Scope disclosure:* These measurements reflect single-node local loopback capacity against in-process/disk stores, not multi-pod cloud capacity or live Gemini/Firestore network latencies.

---

## 4. Backup, Disaster Recovery & Rollback

1. **Runtime Store Backup:** `.learnmate-runtime-data/*.json` uses atomic write-temp-then-rename (`durableStore.ts`). Schedule snapshot copies to object storage (GCS/S3) or swap the `DurableCollectionStore` adapter to Firestore Admin / PostgreSQL before multi-instance horizontal scaling.
2. **Firestore Indexes & Rules Deployment:** Deploy security rules with `firebase deploy --only firestore:rules` after validating `npm run test:rules` in the Firebase emulator. Document composite indexes alongside `firebase-blueprint.json`.
3. **Production Deployment & Rollback (`render.yaml` / Docker / Node):**
   - Build: `npm run build` (`NODE_ENV=production node server.ts` or `npm start`).
   - Pre-flight check: Confirm `/api/health` returns HTTP `200` and `NODE_ENV=production` rejects unauthenticated bearer tokens.
   - Rollback: Pin previous immutable image/commit tag, verify `/api/health`, and restore `.learnmate-runtime-data/` or Firestore point-in-time snapshot if a schema migration fails.
