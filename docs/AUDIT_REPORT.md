# LearnMate: Code Audit and Test Report

_Audit date: 3 Nov 2026 · Repository: `parth-thepale/learnmate-finale-forked` (branch `main`, commit `6927537`)_
_Fixes from this audit are on the local branch `fix/phase0-honesty-stability` (section 7)._

> **Line numbers** in sections 4–6 refer to the **original** code at commit `6927537`. View it with `git show main:<file>`.
> Items marked **✔ live** were reproduced by running the app or its API. All other items come from line-by-line code review.

---

## 1. What LearnMate is

LearnMate is an AI study companion. Students upload PDFs, notes, photos or YouTube lectures. It then offers an AI tutor (text and voice), quizzes with "Mistake DNA" analysis, revision plans, flashcards and mind maps, a PDF study space, practice and exam modes, creative tools (games, 3D lab, mini-apps, AI images and video), focus tools (timer, lo-fi radio) and explore features (news, course library, maps).

**Tech stack:** React 19 + Vite 8 + Tailwind 4 front end; an Express server (`server.ts`) calling Google Gemini through `@google/genai` (plus optional Anthropic Claude); Firebase Auth and Firestore; most user data in browser `localStorage`. It was generated with Google AI Studio from the prompts now kept in `docs/ai-studio-prompts/`.

---

## 2. How it was tested

| Check | Result |
|---|---|
| `git clone` | ✅ 13 commits, clean tree |
| `npm install` | ✅ 267 packages. 4 "high" advisories in `@grpc/grpc-js` via Firebase (server-side gRPC). **Do not** run `npm audit fix --force`: it downgrades Firebase to v9 |
| Type check (`tsc --noEmit`) | ✅ no errors |
| Unit tests (39 tests, `node:test` via `tsx`) | ✅ 39/39 pass. They only test small helper functions; no endpoint, UI or end-to-end tests exist |
| Production build (`vite build`) | ✅ builds, but the whole app is **one 2.9 MB JavaScript file** (875 KB gzipped) plus a 1.26 MB PDF worker. Slow on mobile data |
| Dev server + live API probes (no AI key) | ⚠ runs, but every AI feature returned **made-up content** instead of an error (section 4) |
| Browser walkthrough of every tab | ⚠ loads with no console errors. Fake data on the Dashboard, Practice and Study screens |
| Lighthouse | Accessibility 95, Best Practices 100, SEO 80 |
| 5 parallel deep code reviews | ~200 findings; the important ones are below |

**Model names:** at first glance names like `gemini-3.8-flash`, `gemini-4-argon`, `gemini-3.8-live`, `gemini-nano-banana-2.1`, `gemini-omni-1.1-flash` and `lyria-3-clip-preview` looked invented. **They are real models** in Google's official model list (checked 3 Nov 2026).

---

## 3. Verdict in one paragraph

The UI is polished and the code compiles, but **much of the app pretends to work**. When the AI is unavailable, or simply not configured, the server returns templates written for one probability demo PDF as if they were AI answers. Several screens show hard-coded demo data as the user's own: fake streaks, fake progress, canned probability questions with a pre-selected answer. The exam engine that would do JEE marking exists but is never called, and questions can only be 4-option single-correct. Nothing renders math. There were serious privacy problems on shared devices, a quiz crash on iPhone, and the AI endpoints have no login or rate limit. **For JEE students, wrong answers and fake data are worse than missing features.** That is why the first fixes (section 7) focus on honesty and safety.

---

## 4. Top 15 problems (ranked by harm to students)

| # | Problem | Where (original lines) | Status |
|---|---|---|---|
| 1 | **Made-up AI output presented as real.** With no key or a timeout, the tutor said "verify that all resulting probabilities remain between 0 and 1" about rotational motion. Scan Notes returned probability formulas for a Thermodynamics photo. Transcription invented a transcript. Teach-It-Back scored by keyword match. The voice tutor read templates aloud. Fake `modelUsed: gemini-3.8-flash`. ✔ live | `server.ts` 623-835, 2967-2982, 3070-3080, 3164-3176, 1028-1036, 1525/1534 | **Fixed** |
| 2 | **Broken fallback quiz.** "Which statement is accurate?" where 3 of 4 options are true lines from the PDF, the answer cycles A/B/C/D, and probability distractors appear for any subject. Students were marked wrong for correct answers. ✔ live | `server.ts` 837-977 | **Fixed** (removed; honest error instead) |
| 3 | **Practice starts with 5 hard-coded probability questions, all with answer A**, and opens on Q2 with A pre-selected. AI questions are appended after them, so "5 questions" means the AI is never used. ✔ verified in code | `PracticeWorkspaceView.tsx` 39-120, 161-162, 213-248 | **Fixed** |
| 4 | **Account data leaks on shared devices.** Sign-out was never handled, and login didn't survive a refresh, so the next person saw the previous student's chats and scores, and they were **uploaded into the next person's account**. ✔ live (after fix) | `App.tsx` 118-137; `storageService.ts` 733-826; `firebase.ts` 27-61 | **Fixed** |
| 5 | **Dashboard (default landing page) shows invented numbers:** `streak = Math.max(5, …)`, "Pages Done" = 75%/50% of pages, topic progress hard-coded 100/65/30/0%, "Last studied 2 hours ago · Highlighted 'Conditional Probability'". ✔ live | `StudentDashboardView.tsx` 72, 88-90, 99-108, 128-204, 363, 403 | Open (rebuild for JEE) |
| 6 | **Study Space is a static probability lesson.** Every uploaded PDF opens to "Probability, one idea at a time" with a fixed formula box and fake "AI explanation". The empty chat shows an invented Q&A with citations to page 2 of whatever document is open. ✔ live | `StudyView.tsx` 628-1019, 2011-2178, 3349-3393 | Open |
| 7 | **No math or chemistry rendering anywhere** (no KaTeX/MathJax). LaTeX from Gemini shows as raw text. Blocks launch for JEE | whole UI | Open |
| 8 | **AI endpoints and the voice WebSocket require no login, rate limit or quota.** Anyone can spend your Gemini budget. Diagnostics exposed the cloud project ID and service-account email. ✔ live | `server.ts` 985-998, 1222+, 3855-3945 | Diagnostics **fixed**; AI endpoints open |
| 9 | **Fake "real-world" data:** Daily News = 4 invented articles stamped with today's date and `groundedWithSearch: true`; Educational Maps = 3 invented places for any city. ✔ live | `server.ts` 3634-3755, 3764-3818 | **Fixed** |
| 10 | **iPhone crash:** quiz proctoring calls `requestFullscreen()`, which iPhone Safari lacks. With no error boundary the whole app went blank | `QuizProctorOverlay.tsx` 30-31; `main.tsx` | **Fixed** |
| 11 | **Storage design breaks at real-world sizes:** PDFs stored as base64 in localStorage (about 5 MB limit), write failures swallowed, so documents silently vanish; 20-page PDF cap; pasted notes silently cut at ~22k characters; the whole document is sent to Gemini with every question (cost) | `pdfExtractor.ts` 94-98; `storageService.ts` 531-537; `quizGrading.ts` 19, 531-576 | Open |
| 12 | **No JEE exam support:** the JEE grader (+4/−1, palette) is dead code; Practice and Study score plain counts; blueprints are wrong (JEE Main = 15 Q / 30 min); question type = 4 options, 1 correct (no numerical, multi-correct, matching, paragraph) | `examSimulatorEngine.ts` 20-49, 153-228; `learnmate2Engine.ts` 321-504; `types/study.ts` 83-101 | Open (core of JEE plan) |
| 13 | **Voice tutor lifecycle bugs:** reconnects (new paid session) on almost every parent re-render; interruptions don't stop queued audio; questions sent twice; mic left on after errors; client ignores the "not configured" status | `VoiceTutorModal.tsx` 449-691; `StudyView.tsx` 307-313 | Server message **fixed**; client open |
| 14 | **Exported revision PDFs corrupt formulas:** "½mv²" becomes "12mv^2"; minus signs and Greek letters (φ, γ, η, ν, ∇) deleted | `pdfGenerator.ts` 17-117 | Open |
| 15 | **3D lab leaks graphics memory:** a new WebGL renderer and controls on every slider tick, never fully disposed, so phones crash after a few drags | `CreativeStudioView.tsx` 362-752 | Open (cut or rebuild for JEE) |

---

## 5. File-by-file status

✅ works · ⚠ works with problems · ❌ broken, fake or misleading · 💀 dead code

| File | Status | Main problems |
|---|---|---|
| `server.ts` (3,973 lines) | ⚠ | Fake fallbacks (**fixed**). No auth or rate limits. Whole document sent per request. 9.5 s AI timeout. Only 2 concurrent AI calls for all users, and retries hold a slot. Unbounded `videoJobs` / `youtubeServerCache`. 8 s video timeout. News prompt without schema. Should be split into routes and services |
| `src/App.tsx` | ⚠ | Sign-out, stale closure, blank Create tab (**fixed**). Navigation callbacks drop page/quote/prompt. Active document not saved. Analytics page has no menu entry |
| `src/firebase.ts` | ⚠ | In-memory login (**fixed**). Logs uid/email/photo to console on sync errors. Popup-only sign-in fails in Android in-app browsers |
| `src/services/storageService.ts` | ❌ | Cross-account leak and demo docs uploaded to every account (**fixed**). Base64 PDFs in localStorage. Silent quota failures. Deletes never sync. Last device to write overwrites with blanks. `JSON.slice()` corrupts data. Unbounded growth. `subscribe()` never used. Dead course catalog |
| `src/services/aiClient.ts` | ✅ | — |
| `src/components/StudyView.tsx` (3,405) | ❌ | Static probability lesson and fake empty chat. No math rendering. Results from document A land in document B after switching. Failed mistake analysis shows "You answered 100%". Mode bar hidden in Study Space. Huge single component |
| `src/components/PracticeWorkspaceView.tsx` | ⚠ | Canned questions, pre-selected answer, fake analytics (**fixed**). No +4/−1. "Exam Mode" saved as `adaptive`. Difficulty / Chapters / Past Papers controls do nothing. Timer drifts; no resume after refresh |
| `src/components/QuizProctorOverlay.tsx` | ⚠ | iPhone crash (**fixed**). Phone lock or notification counts as a violation; one action can count twice; 3rd strike auto-submits; attached to the wrong screens |
| `src/components/QuickReviseView.tsx` | ⚠ | Spaced repetition never filters due cards. Demo probability chapter list. Venn diagram on every 6th note. New document never regenerates. Rule-based content not labelled |
| `src/components/PdfWorkspaceView.tsx` | ⚠ | Never shows the real PDF (text reflow), so annotations drift and export misplaces them. Mouse-only drawing (no stylus or touch). Scroll jump broken |
| `src/utils/pdfExtractor.ts` | ⚠ | 20-page cap, base64 storage, a new pdf.js worker per page render (leak), superscripts flattened, scanned PDFs rejected |
| `src/utils/pdfGenerator.ts` | ❌ | Formula corruption in exports (½ → "12", symbols deleted) |
| `src/components/StudentDashboardView.tsx` | ❌ | Almost all numbers fabricated (see #5) |
| `src/components/ProgressView.tsx` | ⚠ | The one honest analytics page, but unreachable from the menu; label and maths inconsistencies |
| `src/components/StudentProfileModal.tsx` | ⚠ | Profile barely used; claims it "calibrates practice"; droppers get college fields |
| `src/components/HomeView.tsx` | ⚠ | Invented "studied N days ago" labels; overlapping uploads possible |
| `src/components/Navbar.tsx` | ⚠ | Notifications never refresh; no Analytics entry |
| `src/components/CreativeStudioView.tsx` (2,810) | ❌ | WebGL leak. PlayLab and Mini Apps are keyword templates (correct answer always A). A biology cell is drawn under every AI 3D model. Fake scan demo (**fixed**) |
| `src/utils/educationalSpecsEngine.ts` | ❌ | Subject detector labels SHM, Electrostatics, Thermodynamics and more as "Mathematics"; `correctIndex: 0` everywhere; NH₃ geometry wrong |
| `src/utils/ai3dModelEngine.ts` | ⚠ | Bohr orbits all the same radius; placeholder shapes; no timeout on Claude |
| `src/components/ExploreWorkspaceView.tsx` | ⚠ | Hard-coded probability "resources" with wrong channel credits; Course Library is 3 stubs. Fake news and maps (**fixed**) |
| `src/components/ExploreFurtherView.tsx` | ⚠ | Shows the previous document's videos after switching; cache never expires |
| `src/components/VoiceTutorModal.tsx` | ❌ | Lifecycle bugs (#13); `en-US` only (no Hindi/Hinglish) |
| `src/components/NotebookAndScannerModal.tsx` | ⚠ | Demo image, notes and transcript; errors shown in green (**fixed**). Recorder not stopped on close; Safari records MP4 but code assumes WebM |
| `src/components/DynamicCompanion.tsx` | ⚠ | Each volume-slider step triggers a **paid** music generation; audio that can't be stopped; false "Claude & Gemini" badge; floats above modals and stays usable during tests |
| `src/components/StudyTimerFocusBar.tsx` | 💀 | Never rendered (only `LOFI_PRESETS` is imported) |
| `src/components/CompactStudyUtilitiesWidget.tsx` | ❌ | DEG mode ignored (sin 30 = −0.988); Planck's constant becomes 0; wrong unit symbols (MM, KJ). JEE allows no calculator |
| `src/components/LearnMateBuddyAvatar.tsx` | ✅ | — |
| `src/utils/stabilityEngine.ts` | ⚠ | Global 2-call limit; per-minute quota treated as daily; caption merge corrupts numbers ("answer is 2" + "2" drops a 2) |
| `src/utils/vertexAiRouter.ts` | ⚠ | ~770 lines of static tables for a feature disabled in production; misleading statuses (Higgsfield **fixed**) |
| `src/utils/learnmate2Engine.ts` | ⚠ | JEE grader unused; SM-2 constants wrong; calculator uses `new Function` (input whitelisted) |
| `src/utils/examSimulatorEngine.ts` | 💀 ❌ | Wrong blueprints and never used outside tests |
| `src/utils/quizGrading.ts` | ⚠ | Skipped counted as wrong; one question decides "weak" or "mastered" |
| `src/types/study.ts` | ⚠ | Question model only supports 4-option single-correct |
| `firestore.rules` | ⚠ | `score` must be 0–100 (JEE marks can be negative or out of 300); `pageCount ≤ 50`; extra fields allowed (`hasAll` without `hasOnly`) |
| `src/index.css` | ⚠ | `font-handwriting` class never generated; `xs` breakpoint missing; dark-mode variant mismatch |
| `public/assets/aistudio/*` | ❌ | Internal AI Studio prompts publicly downloadable (**moved** to `docs/ai-studio-prompts/`) |
| `package.json`, `.env.example`, `render.yaml` | ⚠ | No test script, Unix-only `clean`, package name "react-example", unused Higgsfield key (**fixed**) |

---

## 6. Findings by theme (condensed)

### 6.1 Honesty: content that only looks AI-generated
- Server fallbacks were written for one probability demo PDF and reused for every subject (#1, #2, #9). **Fixed.**
- Client-side demo data shown as the user's own: Dashboard (#5), Study Space (#6), Practice (#3, **fixed**), Quick Revise chapter list and Venn diagram, Explore resources, calculator history, Create and Notebook scan demos (**fixed**).
- "Generators" that are really keyword templates: PlayLab games (5 fixed packs), Mini App Builder ("Coulomb law calculator" becomes a Bayes calculator), video-lesson fallback (any physics topic gets the projectile script).
- Misleading labels: "Verified Solution", "Proctored Full Screen" when fullscreen was refused, "Claude 3.5 Sonnet" (it actually uses Haiku 4.5), and Higgsfield "WORKING_VERIFIED" (no Higgsfield code exists; **fixed**).

### 6.2 Exam and practice correctness (most important for JEE)
- Real JEE Main 2027 pattern: 3 × (20 MCQ + 5 numerical) = 75 questions, 300 marks, +4/−1 on both sections, 180 min. The app supports none of this in practice.
- No numerical-answer input, no multi-correct partial marking, no matching or paragraph questions, no "clear response", no NTA-style question palette, no resume after refresh, no time per question.
- Answer keys go to the browser before the student answers (fine for self-practice; impossible for ranked tests).
- Server silently "fixes" bad AI output: missing answer becomes option 0; missing options padded with the literal text "Option 2".

### 6.3 Data, privacy and accounts
- Fixed: cross-account leak, logout on refresh, demo docs synced to every account.
- Open: localStorage quota failures, deletes not syncing, study state overwritten with blanks, unparseable truncated JSON, unlimited growth, profile not synced, UTC dates (activity between 00:00 and 05:30 IST counts as the previous day).
- Compliance: most JEE aspirants are minors, so the DPDP Act 2023 and DPDP Rules 2025 apply (see the research prompts in the JEE plan). Gemini's free tier may use prompts to improve Google products, so use the paid tier in production.

### 6.4 Security and cost
- Open: no Firebase ID-token check on `/api/*` or `/api/live`; no per-user rate limits or quotas; 15 MB JSON body limit; WebSocket accepts messages up to 100 MiB; `videoJobs` keeps base64 MP4s forever.
- Fixed: diagnostics endpoints require `ADMIN_TOKEN` in production.
- Cost: the whole document goes into every prompt. A 200-page module is about 120k tokens, roughly **$0.18 per question** on `gemini-3.8-flash` at its 2027 price; retrieval would make it about $0.01. Lyria music is called on every volume-slider step.

### 6.5 Performance and mobile
- 2.9 MB single JavaScript bundle (three.js, pdf.js and the whole app load up front).
- pdf.js worker leak per page flip; WebGL leak in the 3D lab; voice tutor re-renders about 60 times per second.
- Mouse-only annotation; the companion bar covers modals; nested padding leaves about 230–250 px of text width on a 360 px phone.

### 6.6 Code health
- `server.ts` is ~4,000 lines and `StudyView.tsx` ~3,600 lines (about 40 state hooks). Neither is maintainable as is.
- Dead code: `StudyTimerFocusBar` (950 lines), `examSimulatorEngine` (unused), `COURSE_LIBRARY_CATALOG`, most of `vertexAiRouter`.
- The only tests cover small helpers; there are no API tests and no end-to-end test of the quiz flow.

---

## 7. What was fixed in this session (branch `fix/phase0-honesty-stability`)

| Area | Change | Files |
|---|---|---|
| Honest AI fallbacks | Tutor fallback now shows only matching passages from the student's notes, clearly labelled "AI unavailable – not an explanation", or an honest error. Removed the hard-coded Krebs/photosynthesis/Newton/ML answers and the probability templates. No fake `modelUsed` | `server.ts` |
| Quiz | Deleted the broken template quiz; generation failure returns an honest error (Study and Practice already show it with Retry) | `server.ts` |
| Mistake DNA / Teach It Back | No invented misconceptions; keyword scoring labelled as such | `server.ts` |
| Scan Notes / Transcribe | Honest errors instead of invented notes and transcripts; a typed transcript is kept unchanged | `server.ts` |
| News / Maps | No invented articles or places; honest messages plus a real Google Maps search link; `groundedWithSearch` only when search was used; article IDs fixed | `server.ts`, `ExploreWorkspaceView.tsx`, `aiClient.ts` |
| Voice tutor (server) | Honest status message; reads only matching lines from notes, or says it can't answer | `server.ts` |
| Clear errors | New message: "AI is not set up on this server yet (missing API key)"; startup warning when the key is missing | `stabilityEngine.ts` (+test), `server.ts` |
| Diagnostics lockdown | `/api/usage`, `/api/capabilities` and `/api/vertex/*` return 404 in production without `x-admin-token: $ADMIN_TOKEN` | `server.ts`, `.env.example`, `render.yaml` |
| Fake status | Higgsfield no longer reported as "WORKING_VERIFIED" | `vertexAiRouter.ts` |
| Login persistence | Students stay signed in across reloads (IndexedDB, then localStorage, then memory) | `firebase.ts` |
| Shared-device privacy | Local data tagged with its owner account; wiped on sign-out and when another account signs in; "Loading your account…" screen until auth resolves; demo documents never uploaded to user accounts; saved profiles merged with defaults | `storageService.ts`, `App.tsx` |
| Crash safety | Fullscreen calls feature-checked (iPhone); root error boundary with a recovery screen | `QuizProctorOverlay.tsx`, `AppErrorBoundary.tsx`, `main.tsx` |
| Practice | Removed the canned questions and pre-selected answer; loading and error screens; timer starts only with real questions; late AI replies ignored; analytics computed from real attempts with honest empty states | `PracticeWorkspaceView.tsx` |
| Scanners | Create-tab and Notebook scanners start empty, show real errors (in red), save only real OCR text and key concepts; transcription errors shown; no invented 45 s duration | `CreativeStudioView.tsx`, `NotebookAndScannerModal.tsx` |
| App shell | Create tab no longer blank without documents; sign-in/out errors caught | `App.tsx` |
| Repo hygiene | AI Studio prompts moved out of `public/`; `npm test` script; cross-platform `clean`; package renamed; `.env.example` documented | `docs/ai-studio-prompts/`, `package.json`, `.env.example` |

**Verification after the fixes:** type check ✅ · 39/39 tests ✅ · production build ✅ · live API probes for every endpoint above ✅ · voice WebSocket ✅ · production diagnostics lock (404 / 200 with token) ✅ · browser checks of Practice, AI Tutor, Explore News/Maps, Create scanner and the shared-device wipe ✅.

---

## 8. Remaining work, in priority order

**P0: before any real student uses it**
1. Replace the fabricated Dashboard numbers with real data or empty states (`StudentDashboardView.tsx`).
2. Replace the static Study Space lesson and fake empty chat (`StudyView.tsx`).
3. Add KaTeX + mhchem rendering for tutor answers, questions, explanations and flashcards.
4. Require Firebase ID tokens on all `/api` routes and `/api/live`; per-user rate limits and daily AI quotas.
5. Move PDFs to Firebase Storage or IndexedDB; show storage errors; switch to chunked retrieval so large modules work and cost stays low.
6. JEE question schema + NTA-style test engine + correct marking (replace the dead `examSimulatorEngine`).
7. Fix or hide the voice tutor until its lifecycle bugs are fixed.
8. Use a Unicode/math font in `pdfGenerator.ts`.

**P1**
Remove the calculator from practice; fix spaced repetition in Quick Revise; cut or rebuild the 3D lab, PlayLab and Mini App Builder for JEE; replace the Explore resources; sync deletes; field-level cloud merge; fix navigation callbacks; make Analytics reachable; JEE profile fields.

**P2**
Split `server.ts` and the giant components; code-split the bundle; Tailwind fixes (`font-handwriting`, `xs`, dark mode); accessibility; API tests and an end-to-end test of the full mock-test flow.

---

## 9. How to run locally

```powershell
cd C:\Users\LOQ\LearnMate
copy .env.example .env      # then put your real GEMINI_API_KEY in .env
npm install
npm run dev                 # http://localhost:3000
npm test                    # unit tests
npm run lint                # type check
npm run build               # production bundle
```

Without `GEMINI_API_KEY` the app still runs, but AI features now say clearly that AI is not set up instead of showing fake content.
