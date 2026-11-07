# LearnMate JEE — full project handoff prompt

You are taking over as the coding agent for **LearnMate JEE**, a web app for Indian students preparing for **JEE Main 2027 Session 1**.

Repository: `C:\Users\LOQ\LearnMate`
Branch: `main`
Latest commit: `b2e41e1` — “Add public onboarding, guest sample and private profile sync”
Snapshot date: 7 November 2026. The working tree was clean at the Phase 2 commit; this handoff document is the only new file.

Read this entire brief before touching code. Then read these documents, which are the source of truth for details:

- `docs/PHASE2_PLAN.md` — approved phase plan, current status, launch prerequisites.
- `docs/JEE_PIVOT_PLAN.md` — product strategy, exam facts, feature decisions, timeline.
- `docs/AUDIT_REPORT.md` — original bugs, what was fixed, what is still open.
- `docs/QUESTION_BANK_SOURCING.md` — legal question-bank sourcing plan.
- `docs/HIGGSFIELD_AGE_EXCEPTION_EMAIL.md` — drafted age-exception request.

Do not rely on this brief alone. Inspect the code and docs before making decisions.

---

## 1. What we are building

LearnMate is an **AI mentor for JEE aspirants**. It should know the student’s syllabus, their own coaching material, their mistakes and their exam date, and tell them exactly what to do next.

- **Audience:** Class 11, Class 12 and dropper students, mostly 16–18 years old, often studying on Android phones over mobile data.
- **Subjects:** Physics, Chemistry and Mathematics only.
- **Exam scope now:** JEE Main 2027 Session 1. JEE Advanced is added later, after the official 2027 brochure is published (expected February–May 2027). Do not hard-code Advanced patterns yet.
- **Language:** English by default, with one-tap Hinglish.
- **Core daily loop:** Plan → Learn/Doubt → Practice → Mistake DNA → Revise → Re-plan.
- **Where we can win:** mistake diagnosis, an exam-date planner, verified answers, bringing your own coaching material, Hinglish and mobile-first low cost.
- **Where we do not compete:** generic “chat with any PDF”, video lectures, or the largest PYQ bank. Those are already free or owned by bigger players.

### Official exam facts to respect

- **JEE Main Paper 1:** 75 questions, 300 marks, 3 hours. Each subject has 25 questions: 20 MCQs and 5 numerical-value questions.
- **Marking:** +4 for a correct answer and −1 for an incorrect answer in **both** MCQ and numerical sections; 0 for unattempted.
- **Session 1 dates:** 20, 21, 22, 23, 24 and 28 January 2027.
- **Session 1 registration:** 24 October – 22 November 2026; late-fee window to 26 November 2026.
- **Session 2:** 2–7 April 2027.
- **JEE Advanced 2027:** expected mid/late May 2027; brochure not yet official.

Always verify exam-related text against the official NTA bulletin before shipping. Do not claim affiliation with NTA or use NTA/IIT logos.

**Known content bug:** the landing page and sample chapter currently say numerical answers are **+4 / 0** (`src/components/LandingPage.tsx`, `src/components/SamplePractice.tsx`, `src/components/SampleChapterPage.tsx`). That is wrong. Numerical questions also carry −1. Fix this before or during Phase 3.

---

## 2. Non-negotiable rules

These are product, legal and safety constraints. Do not trade them away for speed.

1. **Claude is the only AI provider.**
   - Smart tier: `claude-sonnet-5-5` (Sonnet).
   - Fast tier: `claude-haiku-5-5` (Haiku).
   - Failover runs Sonnet → Haiku for smart tasks and Haiku → Sonnet for fast tasks.
   - Only retry on failures another model can plausibly fix: timeouts, 404, 429, 5xx, network errors, empty output, invalid JSON, unknown model id.
   - Stop immediately on auth errors, billing/quota errors, refusals, max-token cutoffs and `NO_API_KEY`.
   - **Never add Gemini calls.** Gemini’s API terms require developers to be 18+ and forbid apps likely accessed by under-18s. That is why Gemini is disabled in code even though a key exists.
   - The Anthropic key stays server-side. Never expose it to the browser or logs.

2. **Higgsfield stays paused.**
   - Its terms require end users to be 18+ and publish no education/parental-consent exception.
   - `HIGGSFIELD_PAUSED = true` on the server. No request from an under-18 account may ever reach Higgsfield.
   - It is unlocked only if Higgsfield gives a **written** exception. The drafted email is in `docs/HIGGSFIELD_AGE_EXCEPTION_EMAIL.md`.

3. **No fake or demo content presented as real.**
   - If AI is unavailable, show an honest error and a retry.
   - Never show template content as if it came from AI.
   - Never show invented streaks, progress, questions, analytics or study history as the student’s own.
   - New accounts start empty. The fixed sample chapter is added only when the student taps “Add to my account”.

4. **Privacy is per-student and owner-only.**
   - Firestore rules are owner-only; there are no public profiles.
   - The academic profile syncs as `profileJson` in the user root document, maximum 20,000 characters.
   - Signing out clears private study data from that browser.
   - Logs must never contain names, emails, notes, tokens or other PII.
   - Use the student’s Firebase ID token on every API request; the server verifies it.

5. **Minors are the default audience.**
   - The first-run setup collects an age band: under 16, 16–17, 18+.
   - Every AI answer has a “you are chatting with an AI” label.
   - Every AI prompt includes the safety instruction.
   - Every AI answer has a Report button, saved privately for review.
   - A public AI & safety statement exists.
   - Parental approval by email is planned, but **deferred** because no email-delivery provider has been chosen. Do not fake it.
   - Keep India’s DPDP Act 2023 / DPDP Rules 2025 in mind: verifiable parental consent for under-18s is required from about May 2027. Do not add behavioural tracking or ads.

6. **JEE practice must be honest about tools.**
   - NTA bans calculators of any kind in JEE Main.
   - The app may keep a calculator as a general tool, but it must carry a clear “not allowed in JEE Main” note and must not be promoted during practice.
   - Do not build habits that will hurt students in the real exam.

7. **Mobile-first, accessible, clean.**
   - Check at 390 px width as well as desktop.
   - No horizontal overflow.
   - Keep contrast, focus states, labels and keyboard access.
   - The design is editorial and calm, not a generic dashboard. Phase 4 adds the dark theme.
   - Default English; Hinglish must be one tap away.

8. **Phase gates.**
   - We build phase by phase.
   - Each phase ends with verification and a user check-in.
   - Do not start a later phase without explicit approval.
   - Do not expand scope silently. If a task belongs to Phase 4–6, note it and leave it.

9. **Cost and safety caps.**
   - Per-student daily allowances and per-minute burst limits stay in place.
   - Watch AI cost per active student.
   - Free NTA/SATHEE/NCERT resources only. Verified links:
     - `https://sathee.iitk.ac.in/`
     - `https://nta.in/Abhyas`
     - `https://jeemain.nta.nic.in/`
     - `https://ncert.nic.in/textbook.php`

---

## 3. Tech stack and architecture

- **Front end:** React 19, Vite 8, Tailwind CSS 4, TypeScript, KaTeX + mhchem, Three.js, `motion`.
- **Server:** Express 4 in `server.ts`, running Vite middleware in development.
- **Auth and data:** Firebase Auth (Google + email/password) and Firestore.
- **AI:** Anthropic Messages API through raw `fetch` in `src/utils/anthropicClient.ts`, with structured JSON via `output_config.format`.
- **Tests:** `node:test` via `tsx` for unit tests; Firebase emulator tests for Firestore rules.
- **Deployment:** `render.yaml` and Firebase project settings are prepared; production setup is still pending.

### Important files

| File | Responsibility |
|---|---|
| `src/App.tsx` | Routing, auth gating, public hash routes, pending sample intent, first-run setup, sign-out redirect. |
| `src/components/LandingPage.tsx` | Public landing page, worked example, limits, resources, FAQ. |
| `src/components/SampleChapterPage.tsx` | Guest sample reader and add-to-account flow. |
| `src/components/SamplePractice.tsx` | Shared bilingual practice UI for the sample. |
| `src/components/FirstRunSetupModal.tsx` | Four-step first-run setup. |
| `src/components/LegalPage.tsx` | Privacy, Terms, Contact/grievance. |
| `src/components/StudentDashboardView.tsx` | Current dashboard/Home. Phase 3 rebuilds it. |
| `src/services/storageService.ts` | Local storage + Firestore sync, profile persistence, sign-out cleanup. |
| `src/utils/studentProfile.ts` | Profile normalization, empty defaults, legacy cleanup, setup-complete logic. |
| `src/utils/anthropicClient.ts` | Anthropic Messages API client and JSON-schema conversion. |
| `src/utils/claudeFailover.ts` | Model attempt plan and retry/stop classifier. |
| `src/data/sampleChapter.ts` | Fixed bilingual sample content and numerical-answer helpers. |
| `src/utils/stabilityEngine.ts` | AI concurrency/quota helpers. |
| `src/utils/pdfExtractor.ts` | PDF text extraction. |
| `src/utils/pdfGenerator.ts` | PDF export. Known formula-corruption bug. |
| `server.ts` | Express app, auth middleware, quotas, Claude routes, YouTube jobs, paused Higgsfield. |
| `firestore.rules` | Owner-only rules, including `profileJson` limits. |
| `tests/rules/firestore.rules.test.ts` | Emulator rules tests. |

### Data model, briefly

- Firestore root document: `users/{uid}` with `uid`, `updatedAt`, and optional `email`, `displayName`, `photoURL`, `activeDocumentId`, `profileJson`.
- Study documents and related data live under the same owner-only user tree.
- `profileJson` is a string, ≤20,000 characters, and must be validated by rules.
- `updatedAt` and `setupCompleted` decide which profile copy wins during sync.
- Local browser storage holds a private cache; sign-out clears it.

### AI call flow

1. Browser sends the request with the Firebase ID token.
2. `server.ts` verifies the token, applies burst and daily limits, validates input and size.
3. The server calls Claude with the correct tier, effort, system prompt and optional JSON schema.
4. On a retryable failure, it tries the other Claude model; on a stop-class failure, it returns a clear error.
5. Logs are PII-free and include model, tier, latency and outcome only.

---

## 4. What is already done

Phases 1 and 2 of the six-phase plan are complete. Treat them as shipped unless a regression is found.

### Phase 1 — accounts, security, Claude-only

- Google + email/password sign-in, email verification and password reset.
- Account required for private material and every AI feature; the guest sample is the only exception.
- Server verifies the Firebase ID token on AI routes.
- Per-student per-minute rate limit and daily allowances, with friendly limit messages.
- Helmet security headers, origin checks, request-size limits, link allow-list.
- Firestore rules are stricter and covered by emulator tests: student A cannot read, list, update or delete student B’s data; unverified, anonymous and signed-out accounts get nothing.
- Safety labels, safety instruction in prompts, Report button, public safety statement.
- Gemini disabled in code; Higgsfield paused.
- Full end-to-end checks passed: no login → 401, forged token → 401, unverified email → 403, daily limit → 429, another origin → 403, oversized upload → 413, another student’s video job → 404, voice socket without login → refused.

### Phase 2 — first impression

- Public landing page with:
  - English/Hinglish worked example.
  - “How it works” in four steps.
  - Honest limits.
  - Privacy promises.
  - Free NTA/SATHEE/NCERT resources.
  - FAQ.
  - Sign-in and create-account buttons.
- Guest sample chapter:
  - Fixed Probability mini-chapter written by us.
  - Four concepts, four JEE-style questions, six flashcards, four study pages.
  - Uses no AI, so it costs nothing.
  - “Add to my account” after sign-in; pending intent survives the auth flow.
- New accounts start empty:
  - Old fake starter documents, planner tasks and profile values removed.
  - Legacy values are cleaned when the profile is read.
- Four-question first-run setup:
  - Name.
  - Class and exam session.
  - Language.
  - Age band.
  - Waits for the cloud profile to sync; can be postponed; `setupCompleted` dismisses the banner.
- Profile sync:
  - Owner-only `profileJson` in the user root document.
  - `updatedAt` decides the winning copy.
- Legal pages:
  - Privacy policy.
  - Terms.
  - Contact/grievance.
  - AI & safety statement.
  - They degrade honestly while `VITE_SUPPORT_EMAIL` and grievance-officer details are unset.
- Public hash routes: `#landing`, `#signin`, `#signup`, `#sample`, `#privacy`, `#terms`, `#contact`, `#safety`.
- Sign-out clears local private data and returns to the landing page.
- Mobile fixes:
  - 390 px checks passed on landing, sample, sign-up, legal pages and all four setup steps.
  - Header compacted; setup modal top-aligns when taller than the viewport; sticky-header scroll offset.
- Lighthouse on the landing page: **100 accessibility, 100 best practices, 100 SEO**.
- `public/robots.txt` added; muted and success colours darkened to pass contrast.

### Verification status at the Phase 2 commit

- `npx tsc --noEmit` passes.
- **81 unit tests** pass.
- **6 Firestore emulator rules tests** pass.
- `npm run build` passes.
- Manual browser checks passed:
  - Landing → sample → add → sign-up → email verification → sample auto-add.
  - First-run setup completion and postponement.
  - Profile save and cloud sync.
  - Legal-page back navigation.
  - Sign-out cleanup.
  - Signed-in dashboard.
  - Reload restores setup without reopening the modal.
  - Banner disappears after sync.
  - Emulator cloud store received the sample document and `profileJson`.

### Known unfixed issues

- **Anthropic billing:** the key is valid and `GET /v1/models` lists both configured models, but a real call returns HTTP 400 “Your credit balance is too low to access the Anthropic API.” Add credits before live AI testing. The failover classifier correctly stops on this billing error.
- **PDF export garbles formulas** in `src/utils/pdfGenerator.ts` (“½mv²” becomes “12mv^2”; some symbols are dropped).
- **Four high npm advisories** via Firebase gRPC. Do **not** run `npm audit fix --force`; it downgrades Firebase to v9.
- **CSP / `function-plot`:** the graph plotter uses `new Function`, so a strict CSP later needs `unsafe-eval` or a switch to JSXGraph.
- **Large bundle:** the audit measured roughly 984 KB compressed before code-splitting. Phase 6 addresses this.
- **Legacy screens:** the old Study, Create and Explore structures still exist. Phase 3 rebuilds Study and removes the non-JEE Create/Explore tabs; Phase 5 rebuilds Create.
- **Numerical marking text:** the UI currently says +4 / 0 for numerical questions; it must say +4 / −1.
- **Firebase project:** `.env` currently points at `learnmate-1441c`. The owner must confirm it is the intended dev project. Rules deployment needs `npx firebase-tools login`.
- **Contact details:** `VITE_SUPPORT_EMAIL` is empty, and the grievance officer’s name and postal address are unpublished.
- **Parental approval:** no email-delivery provider chosen, so the flow is deferred.
- **Higgsfield:** age-exception email not yet sent; service remains paused.

---

## 5. What comes next — Phase 3: clean home and navigation

This is the next approved phase. Do not start it until the owner confirms.

### Phase 3 scope

1. **Add study material everywhere**
   - Replace the hidden “Upload study material” item in the profile menu with an **“Add study material” box at the top of Home** that supports drag and drop.
   - Add a **“+ Add material”** button on every page.
   - Choices: PDF · Photo of notes · YouTube link · Paste text.

2. **Rebuild Home**
   - Compact countdown.
   - Add material box.
   - Continue card.
   - My materials library with subject, topics, last opened and delete.
   - Due today.
   - “Ask a doubt” box.
   - “What you can do” guide until the first upload.
   - Move stats to Progress.

3. **Simplify navigation**
   - Top bar: **Home · Study · Practice · Revise · Progress**.
   - Phone bar: **Home · Study · Practice · Revise · Me**.
   - Profile menu: Profile, Settings, Resources, Create, Sign out.

4. **One Study screen**
   - Merge Study and AI Tutor, which currently show the same document separately.
   - Reader and tutor side by side.
   - On phones, a “Read / Ask” switch.

5. **Better tutor**
   - Stream the answer; first words in about 1.3 seconds instead of a silent ~15-second wait.
   - Default to “Notes + JEE knowledge”, clearly labelled when it goes beyond the notes.
   - Keep “Report a mistake”.

6. **Move revision work**
   - Mistake analysis and revision plan move out of Study sub-modes into **Revise**.

7. **Revise tabs**
   - Flashcards (merge sticky notes).
   - Mind map.
   - Summary sheet.
   - Mistakes.
   - Formula Book (built in Phase 4, but place the entry point here).

8. **YouTube**
   - Official YouTube player + student pastes the transcript.
   - Three illustrated steps: open description → Show transcript → copy.
   - Claude turns the transcript into notes with timestamps; every feature works on it.

9. **Notes and annotation**
   - Scan notes becomes **Add material → Photo of notes**.
   - PDF annotation studio becomes an **Annotate** button inside Study.

10. **Remove non-JEE surfaces**
    - Remove Create tabs: PlayLab Games, Mini App Builder, Concept 3D Lab, Notebook, Voice note, Study planner.
    - Remove Explore tabs: News, Course library, Maps. Official resources stay as **Resources**.
    - Remove the timer island’s second AI chat.
    - Make lo-fi music an off-by-default timer option.
    - Delete the unused `StudyTimerFocusBar` component, moving any music presets with the timer.

### Definition of done

- Every screen is reachable in at most 2 taps from the five sections.
- Nothing removed is still referenced anywhere.
- The tutor streams and labels “Notes + JEE knowledge” correctly.
- Add material works from Home and from every page for all four input types.
- No fake data, no dead links, no horizontal overflow at 390 px.
- TypeScript, unit tests, rules tests and the production build pass.
- Manual browser check and a short status update are completed.

---

## 6. Later phases — approved plan

### Phase 4 — tools, timer, settings and dark theme

- Small **draggable Tools icon** that remembers its corner; can be hidden in Settings.
- Keep all tools: calculator with a “not allowed in JEE Main” note, unit converter, statistics, real graph plotter, formulas.
- **Formula Book:** Claude extracts formulas from every upload, grouped Subject → syllabus unit → topic, with source page, search and “add to flashcards”.
- **Movable timer:** drag and snap to corners, minimise to a ring, “Move to…” menu and arrow keys, never covers the tab bar. Settings toggle to hide it.
- **Settings:** Theme, show focus timer, show tools icon, language, tutor mode, account download/delete.
- **Light / Dark / Match device**, soft navy dark theme, no white flash, formulas and diagrams follow the theme, optional dark PDF.
- Done when every screen is checked in both themes and the timer/tools can be moved, minimised and hidden.

### Phase 5 — Create, safe for 16–17-year-olds

- **Claude Diagram Maker for every student:** accurate labelled diagrams (free-body, circuits, ray optics, conics, molecule shapes) as clean SVG, safety-checked, downloadable and attachable to notes.
- **Animated explanations for every student:** Claude writes 4–6 short scenes; each has a step-by-step diagram, a key formula and browser-read narration. It is a narrated animated slideshow, not a filmed video.
- **Higgsfield only for 18+ accounts:** photo-style images and short videos, training opt-out on, files removed after download, every result labelled “AI-generated”.
- Done when a 16-year-old can create diagrams and animated explanations, and no under-18 request reaches Higgsfield — enforced on the server, not just hidden in the UI.

### Phase 6 — storage, speed and launch

- Store PDFs in **IndexedDB** on the device, not as base64 in localStorage.
- Sync extracted text, topics, progress and profile to the student’s private cloud area.
- Add **Download my data** and **Delete my account** (cloud, device and login).
- Landing page under ~300 KB; code-split each screen.
- Test on a low-end Android phone, set budget alerts on Anthropic/Higgsfield/Google Cloud, back up data, do a final privacy review.
- Done when the landing page shows within 3 seconds on a slow-phone profile and account deletion removes everything.

### After Phase 6

- JEE mock-test mode: 75 questions, 3 hours, +4/−1, numerical answers, NTA-style palette.
- Question bank from `docs/QUESTION_BANK_SOURCING.md`.

---

## 7. Launch blockers the owner must resolve

1. **Anthropic credits** — add credits, then run one real structured JSON call and one failover-path check.
2. **Firebase** — confirm `learnmate-1441c` is the intended dev project; run `npx firebase-tools login`; deploy rules.
3. **Support contact** — set `VITE_SUPPORT_EMAIL`; publish the grievance officer’s name and postal address.
4. **Parental approval** — choose an email-delivery provider before building the flow.
5. **Higgsfield** — send the drafted age-exception email if the owner still wants that route; otherwise keep it paused.
6. **Content correctness** — fix the numerical marking text; audit any other exam claims against the official bulletin.
7. **Known bugs** — PDF export formulas, npm advisories (do not force-fix), CSP/graph plotter, bundle size.

---

## 8. How to verify work

Run from `C:\Users\LOQ\LearnMate`:

```powershell
npx tsc --noEmit
npm test
npm run test:rules
npm run build
```

Notes:

- `npm run test:rules` starts its own Firestore emulator on port 8080. Stop any running emulator/dev server first if the port is taken.
- For local auth/Firestore testing:
  - Set `VITE_FIREBASE_USE_EMULATOR=true`.
  - Set `VITE_FIREBASE_PROJECT_ID=demo-learnmate`.
  - Run `npm run emulators` in a second terminal.
  - Run `npm run dev` in the main terminal; the app runs on `http://localhost:3000`.
- The real `.env` points at Firebase project `learnmate-1441c` and contains the Anthropic key. Restart `npm run dev` after editing `.env`.
- Never commit `.env` or any secret.
- For public-page changes, run Lighthouse on the landing page and check 390 px width manually.
- For UI changes, test both signed-out and signed-in states.

---

## 9. How to work with me

- **Read first.** Read the docs and inspect the relevant files before proposing changes.
- **Plan first.** For a new phase, reply with a short file-by-file plan, risks and order of work. Wait for my “go” before writing code.
- **One phase at a time.** Do not quietly start Phase 4 while finishing Phase 3.
- **Match the existing style.** Use the design tokens in `src/index.css` (`brand`, `ink`, `body`, `muted`, `line`, `canvas`, `soft`, subject colours) and existing component patterns. Keep the UI clean and editorial.
- **Explain in plain language.** I am directing the product; do not assume I know the codebase. Explain trade-offs briefly.
- **No new providers or dependencies without asking.** Especially AI providers, email providers and paid services.
- **Never invent data.** If something is unknown, say so or show an honest empty state.
- **Protect private data.** No PII in logs, no public profiles, no cross-account leakage.
- **Verify every change.** TypeScript, relevant tests, rules tests if rules changed, production build, and a browser check.
- **Update the docs.** If a phase status, blocker or decision changes, update `docs/PHASE2_PLAN.md` or the relevant doc.
- **Commit only after verification.** Keep commits scoped and descriptive.
- **If blocked, say exactly what you need.** Do not guess credentials, provider terms or Firebase project details.

---

## 10. Your first task

Do not write code yet.

1. Read `docs/PHASE2_PLAN.md`, `docs/JEE_PIVOT_PLAN.md` and `docs/AUDIT_REPORT.md`.
2. Inspect the current `src/App.tsx`, `src/components/StudentDashboardView.tsx`, the Study/Practice/Revise components, `src/components/Navbar.tsx` and `src/services/storageService.ts`.
3. Reply with:
   - A short confirmation of the current state.
   - A file-by-file Phase 3 implementation plan, including what will be reused, changed or deleted.
   - The main risks and dependencies.
   - The first three concrete tasks you would do.
4. Wait for my approval before starting Phase 3.

If I say “start Phase 3”, begin with the navigation and Home restructure plus the shared “Add material” entry point, then move to the unified Study screen and streaming tutor. Keep the build green at every step.
