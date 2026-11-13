# Security & Data Isolation Architecture

**Standard Alignment Target:** OWASP ASVS 5.0 (Architecture, Auth, Access Control, Validation, Session/Token Hygiene)

---

## 1. Identity, Authentication & Role Boundaries

- **Student Authentication (`src/server/studentAuth.ts`, `src/server/middleware/authAndSecurity.ts`):**
  - Protected routes parse `Authorization: Bearer <Firebase ID Token>`.
  - In production mode (`NODE_ENV === 'production'`), unverified or missing tokens fail closed unless explicit Firebase Admin verification succeeds.
  - Dev/local autostart fallback (`dev-student-local` via `?autostart=1`) is explicitly guarded by `!import.meta.env.PROD` on client (`src/App.tsx`) and `NODE_ENV !== 'production'` on server.
- **Administrative Access (`firestore.rules`, `src/server/middleware/authAndSecurity.ts`):**
  - Removed hardcoded personal maintainer email (`harshitkumar7407@gmail.com`) from `firestore.rules`.
  - Admin operations require `request.auth.token.admin == true` custom claims, an `/admins/{uid}` record (write-disabled to clients), or a timing-safe server-side `ADMIN_TOKEN` header (`x-admin-token` or bearer secret checked via `crypto.timingSafeEqual`).
- **Minor Safety & Age-Band Privacy:**
  - `FirstRunSetupModal` and `studentProfile` record age bands (`13-17` vs `18+`). External generative image/video features remain gated off for under-18 students (`SafetyStatementPage.tsx`).
  - Parent/mentor weekly summaries (`buildConsentGatedParentMentorSummary` in `src/utils/learningIntelligenceEngine.ts`) are disabled by default unless explicit student/guardian consent (`parentConsentGranted === true`) is stored.

---

## 2. Cross-Tenant Isolation Matrix

| Surface | Enforcement Mechanism | Verified Behavior |
|---|---|---|
| Storage signed URLs (`/api/storage/signed-url`, `/api/storage/upload`, `/api/storage/download`) | `uid` ownership bound inside signed HMAC token (`fileOwnerUid === req.student.uid`) + path traversal rejection | User B attempting to use User A's download token or path receives `403`. |
| RAG Workspace (`/api/commercial/rag/index`, `/api/commercial/rag/query`) | `buildTenantScopedCacheContext(uid, docId)` prefixes index keys by authenticated `uid` | User B cannot retrieve chunks indexed from User A's notes (`0` cross-tenant hits). |
| Semantic AI Cache (`/api/commercial/cache/lookup`, `/api/commercial/cache/store`) | Cache keys bind `(uid, docId, mode, promptHash)` | Cache lookup from another `uid` strictly misses. |
| Background Jobs (`/api/commercial/jobs/*`) | `BackgroundJobRegistry` validates `job.ownerUid === req.student.uid` | Accessing/updating another user's job returns `403` / `404`. |
| Share Snapshots (`/api/commercial/shares/*`) | Cryptographic 256-bit random tokens hashed via SHA-256 at rest, configurable TTL expiry & revocation flag, owner check on revoke | Unauthenticated token guessing is computationally infeasible; expired/revoked links return `410` / `404`. |
| Entitlements (`/api/commercial/tiers`, `/api/commercial/webhook/*`) | Free-tier default (`free_explorer`), client tier-selection endpoint returns `403`, webhooks require HMAC-SHA256 signature + timestamp window + durable idempotency key store | Replayed webhook IDs are ignored idempotently; invalid signatures return `401`. |

---

## 3. Input Validation, SSRF & XSS Protections

- **XSS (`src/utils/commercialScaleEngine.ts`, `src/components/MathText.tsx`):**
  - `sanitizeSharedString()` strips `<script>` tags, `javascript:` URIs, and both quoted and **unquoted** inline `on*=` event handlers (e.g., `<img src=x onerror=alert(1)>`). Tested directly in `src/server/wave2And3Security.test.ts`.
  - Markdown/LaTeX output renders through `react-markdown` + `rehype-katex` without `rehype-raw`.
- **SSRF & Remote URL Validation (`src/server/requestGuards.ts`, `src/server/services/youtubeService.ts`):**
  - Rejects private IPv4/IPv6 loopback, link-local (`169.254.0.0/16`), RFC1918, and localhost URLs before outbound server fetches.
  - YouTube service restricts input hosts strictly to `youtube.com` / `youtu.be` and rejects arbitrary URLs with `400`.
- **Upload & Abuse Controls (`server.ts`, `src/server/middleware/rateLimiterAndQuotas.ts`):**
  - `helmet` security headers & CSP configured in `server.ts`.
  - Body size limits bounded; IP-level burst limiter (`180 req/min` default) verified returning `429` with zero `5xx` under live `benchmarkConcurrency.ts` load.
- **WebSocket Auth (`src/server/ws/voiceLiveServer.ts`):**
  - Upgrades check origin and require authenticated student credentials when outside dev fallback, enforcing idle timeouts and clean teardown.

---

## 4. Firestore Rules & Data Erasure

- Updated `firestore.rules` & `firebase-blueprint.json`:
  - `/admins/{adminId}`: read self, client writes denied (`allow write: if false`).
  - `/users/{userId}/entitlements/{entitlementId}`: owner read-only; client writes denied (`allow write: if false`) so only Firebase Admin / backend webhooks can modify billing entitlements.
  - `/users/{userId}/learningIntelligence/{recordId}`: owner read/write with schema validation.
  - `/shared_snapshots/{shareId}`: owner create/revoke; sanitized public read by token.
- `deleteStudentAccountAndData()` in `src/services/storageService.ts` deletes IndexedDB, `localStorage`, and Firestore `documents`, `attempts`, `flashcards`, `reports`, and `learningIntelligence` subcollections.

### Known Verification Gap
- `npm run test:rules` (`tests/rules/firestore.rules.test.ts`) was not executed in this environment because the Firebase Firestore Java Emulator was not running. Run `firebase emulators:exec --only firestore "npm run test:rules"` before staging/GA sign-off.
