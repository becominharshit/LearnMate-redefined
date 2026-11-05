# LearnMate JEE, Phase 2 build plan

> Updated 3 Nov 2026 after your review. Recommendations approved with the changes below. We build
> phase by phase; each phase ends with a check-in before the next one starts.

## 1. Your decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Login | **Google + email/password** for now (no phone OTP). |
| 2 | Guest preview | **Yes**, "Try a sample chapter" without login (no AI cost). |
| 3 | Firebase | **New, clean projects of your own** (dev + production). I prepare everything; you do a 10-minute console setup (section 4). |
| 4 | Create for 16–17-year-olds | **Reconsidered**: Claude makes Create work for every student. Higgsfield stays 18+ because its terms forbid younger users; a **parental-approval system** (Phase 2) covers services that do allow minors with consent, and unlocks Higgsfield only if Higgsfield grants a written exception (section 5). |
| 5 | Plan format | **Phases**, listing every existing feature that changes (section 3). |
| 6 | Tools and timer | **Keep all tools** (calculator, units, statistics, graph, formulas) behind a **small movable icon**. The **timer is movable** and can be **switched off in Settings**. |
| 7 | YouTube | **Free option**: official YouTube player + the student pastes the transcript. |
| 8 | AI provider | **Claude only.** Gemini switched off. Tested fast enough (section 2). |

## 2. Test results

| Area | Result |
|---|---|
| PDF upload | ✅ Claude split a 2-page Physics PDF into 5 topics with correct pages in ~5 s. |
| Tutor (Hinglish) | ✅ Natural Hinglish, all formulas rendered. ⚠️ ~15 s with nothing shown while waiting; refused a derivation in "only my notes" mode. |
| **Claude-only speed with streaming** | ✅ **First words after 1.2–1.3 s**, full step-by-step answer in ~4.5 s (Sonnet, low and medium effort). |
| YouTube via Gemini | ❌ Fails with your Google setup (403), and Gemini's terms don't allow under-18 apps anyway. |
| Profile banner | ❌ Bug reproduced (only checks the name; saves made-up weak areas). |
| Formula sheet today | ❌ Shows 6 of 14 lines with "=", misses page 2, no topics. |
| Formula Book with Claude | ✅ 13/13 formulas, 2 topics, 0 rendering errors, 5 s, under 0.1 US cent. |
| Graph plotter prototype | ✅ 8/8 typed equations plotted correctly, including circle, ellipse, hyperbola and y² = 4x. |
| **Claude diagrams (for Create)** | ✅ Inclined plane free-body diagram, ellipse (foci, directrices, latus rectum to scale) and methane (wedge/dash bonds, 109.5°) were **accurate and labelled** in **7–10 s** each (Sonnet); no unsafe content. Haiku was slower and more cluttered. |
| Security | ✅ Database rules are already per-user. ❌ AI endpoints have no login check or limits. |
| Speed of first load | ⚠️ 984 KB of compressed JavaScript before anything shows (target ~300 KB). |

## 3. Phases: what changes in the app

Each table lists **what exists today → what it becomes**. "New" rows are additions.

### Phase 1: Accounts, security and Claude-only

| Existing | Change |
|---|---|
| Firebase project `substantial-griffin-001d-609b6` from the original repo (`firebase-applet-config.json`) | Your own projects **LearnMate JEE Dev** and **LearnMate JEE**. Config comes from `.env` (`VITE_FIREBASE_*`), so dev and production stay separate. Google Analytics off (no tracking of minors). |
| Sign-in: Google pop-up, optional; the whole app works without an account | **Google + email/password** (email verification, "forgot password"). **An account is required** for your own material and every AI feature; the guest preview (Phase 2) is the only exception. |
| AI endpoints (`/api/study/*`, `/api/create/*`, voice socket) are open to anyone | Every request carries the student's login token and the **server verifies it**. **Per-student limits**: a per-minute rate limit and a daily allowance (e.g. 40 tutor questions, 5 practice sets, 10 diagrams), with a friendly "you've reached today's limit" message. |
| No security headers; 15 MB request limit everywhere; no CORS rules | Helmet security headers and a Content-Security-Policy, requests only from your own domain, a size limit per route, a link allow-list (YouTube only), and logs that never contain names, notes or tokens. |
| Firestore rules (already owner-only) | Kept, with **stricter field checks**, plus **automated tests** on the local emulator proving student A can't read or write student B's data. |
| AI: Claude, with Gemini as fallback | **Claude only.** Gemini is switched off now (even if Google keys exist); its leftover modules and environment settings are removed in Phase 3. Voice answers use Claude plus the browser's speech, and YouTube is rebuilt in Phase 3. |
| No safeguards for minors | Anthropic's requirements for apps serving minors: "You're chatting with an AI" labels, a safety instruction in every prompt, a **"Report"** button on AI answers (saved for review), and a public safety statement page. |
| Usage stats for the admin only | Plus per-student usage counters, so you can see the cost per student. |
| Create (Higgsfield) open to everyone | **Switched off** until the age question exists (Phase 2), then **18+ only**, checked on the server (Phase 5). |

**Done when:** a script without a login gets "401"; student A cannot see B's data (automated test); the server log shows Claude only.
**You do:** the Firebase console steps in section 4.

**Status (4 Nov 2026):** ✅ Built and verified.
- Sign-in checks, per-student limits, security headers, origin checks, request-size limits and the AI Report button are in place.
- Firestore rules are stricter and covered by 5 emulator tests (student A cannot read, list, change or delete student B's data; unverified, anonymous and signed-out accounts get nothing).
- The full end-to-end check passed: no login → 401, forged token → 401, unverified email → 403, daily limit → 429, another site's origin → 403, oversized upload → 413, another student's video job → 404, voice socket without login → refused.
- Gemini is switched off in code; its old modules and environment variables are removed in Phase 3 with the features that used them.
- Creating the Firebase projects is still the one step only you can do (section 4). Until then the app runs against the local emulator.

### Phase 2: First impression (landing page, sample chapter, profile)

| Existing | Change |
|---|---|
| Everyone lands on the dashboard | **Public landing page** for signed-out visitors: headline, a real worked example (English/Hinglish switch, one MCQ, one numerical question, one flashcard), "how it works" in 4 steps, honest limits, privacy promises, free NTA resources, FAQ, sign-in buttons. |
| Three sample documents (Probability, Sets & Relations, off-syllabus Statistics) put into every account | **Removed.** One **JEE sample chapter** that we write ourselves: a guest preview with pre-made explanations, questions and flashcards (no AI cost), which can be added to the account with one tap. |
| Default profile with made-up details (school "National Public School", weak areas "Conditional Probability, Bayes Theorem…", a probability goal) | **Empty defaults.** The made-up values already saved on devices are cleaned up. The name is pre-filled from Google. |
| "Set up your JEE profile" banner stays until the name is changed (bug) | Shown **until the first-run setup is completed**, then gone. |
| Long profile form (education stage, board, school, university, goals…) | **First-run setup with 4 questions**: name, class and exam session, language, age band. Everything else is optional under "More about you". The profile syncs privately to the student's account. |
| No legal pages | **Privacy policy, Terms, AI & safety statement, contact / grievance officer.** |
| No age or parental-approval system | **First-run age band** (under 16 / 16–17 / 18+). A 16–17-year-old can ask a parent or guardian to approve by email link; the approval, its date and what it covers are stored privately with the student's profile. Approval unlocks only features whose provider allows minors with consent — **Higgsfield stays blocked** unless it grants a written exception (section 5). |

**Done when:** a new visitor reaches a first explanation within 60 seconds, and the banner disappears after setup.

**Status (5 Nov 2026):** ✅ Built and verified.
- The public landing page has the English/Hinglish worked example, four-step explanation, honest limits, privacy promises, free NTA/SATHEE/NCERT links, FAQ and account buttons.
- The guest sample is a fixed Probability chapter with four concepts, four JEE-style questions and six flashcards. It uses no AI and can be added to an account after sign-in.
- New accounts start empty. The fake starter documents, planner tasks and profile values have been removed; older devices are cleaned when the profile is read.
- First-run setup asks the four approved questions (name, class/session, language, age band), waits for the private cloud profile to load, and can be postponed. The dashboard banner stays until setup is saved, then disappears.
- Privacy, Terms, Contact/grievance and the AI & safety statement are public pages. They degrade honestly while `VITE_SUPPORT_EMAIL` and the grievance-officer details are still unset.
- The profile syncs privately as owner-only `profileJson` in the user root document. Signing out clears private study data from that browser.
- Verification: 81 unit tests, 6 Firestore emulator rules tests, TypeScript and the production build pass. Manual browser checks covered landing → sample → add → sign-up → email verification → sample auto-add, first-run setup and postponement, profile save/sync, legal-page back navigation, sign-out cleanup and the signed-in dashboard.
- Mobile check at 390 px: landing, sample, sign-up, legal pages and the four setup steps have no horizontal overflow. The landing header was compacted for small screens, the setup modal now top-aligns when it is taller than the viewport, and section links leave room for the sticky header. Lighthouse on the landing page is 100 accessibility, 100 best practices and 100 SEO; `public/robots.txt` is included and the muted/success colours were darkened to pass contrast.
- Still open before public launch: set `VITE_SUPPORT_EMAIL`, publish the grievance officer's name and postal details, choose an email-delivery provider for parental approval, and complete the real-project Firebase setup in section 4. Higgsfield remains paused and Gemini remains disabled. The configured Anthropic key can list the two Claude models but currently returns “credit balance is too low”, so add credits and run one real AI request before launch.

### Phase 3: Clean home and navigation

| Existing | Change |
|---|---|
| Upload page hidden behind profile menu → "Upload study material" | **"Add study material" box at the top of Home** (drag and drop) plus a **"+ Add material"** button on every page. Choices: PDF · Photo of notes · YouTube link · Paste text. |
| Home: big hero, stats, subjects, continue, recent practice, focus areas, revision, key dates | **Compact countdown**, Add material, **Continue** card, **My materials** library (subject, topics, last opened, delete), **Due today**, an **"Ask a doubt"** box, and a "What you can do" guide until the first upload. Stats move to Progress. |
| Top bar: Home, Study, Practice, AI Tutor, Revise, Create, Progress, plus 7 profile-menu items | **Home · Study · Practice · Revise · Progress** (phone: Home · Study · Practice · Revise · Me). Profile menu: Profile, Settings, Resources, Create, Sign out. |
| "Study" and "AI Tutor" are separate tabs showing the same document | **One Study screen**: reader and tutor side by side; a "Read / Ask" switch on phones. |
| Tutor waits ~15 s, then shows the whole answer; defaults to "only my notes" | **Streams** (first words ~1.3 s); defaults to **"Notes + JEE knowledge"** (clearly labelled when it goes beyond the notes); **"Report a mistake"** button. |
| Mistake analysis and revision plan hidden as Study sub-modes | Moved to **Revise**. |
| Quick Revise: sticky notes, flashcards, mind map, one-page sheet | **Flashcards** (sticky notes merged in), **Mind map**, **Summary sheet**, **Mistakes**, and the **Formula Book** (Phase 4). |
| YouTube import through Gemini (broken) | **Official YouTube player + paste the transcript** (3 illustrated steps: "… → Show transcript → copy"). Claude turns it into notes with timestamps and every feature works on it. |
| Scan notes in the profile menu and Create | **Add material → Photo of notes.** |
| PDF annotation studio in the profile menu | **"Annotate"** button inside Study. |
| Create tabs: PlayLab Games, Mini App Builder, Concept 3D Lab, Notebook, Voice note, Study planner | **Removed.** |
| Explore tabs: News, Course library, Maps | **Removed.** Official resources stay as **Resources**. |
| Timer island's second AI chat and lo-fi music | AI chat **removed** (the tutor does this). Music becomes an option in timer settings, off by default. |
| Unused timer component `StudyTimerFocusBar` | Deleted (its music presets move with the timer). |

**Done when:** every screen is reachable in at most 2 taps from the 5 sections, and nothing removed is still referenced.

### Phase 4: Tools, timer, settings and dark theme

| Existing | Change |
|---|---|
| "Study Tools" button in the top bar opening a panel | A **small floating Tools icon you can drag** to any corner (remembers its place). The panel keeps **all tools**: calculator (with a small "not allowed in JEE Main" note), unit converter, statistics, graph and formulas. Can be hidden in Settings. |
| Graph: 4 fixed curves on a made-up scale | **Real graph plotter**: type any equation (y = …, circles, conics, \|x\|, eˣ), several coloured curves, zoom/pan, coordinates on hover, presets. Input is checked against an allow-list. |
| Formulas: first 6 lines containing "=" from the open document | **Formula Book**: Claude extracts formulas from **every upload**, grouped **Subject → syllabus unit → topic**, with the source page, search and "add to flashcards". The Tools icon shows formulas from the material you're studying. |
| Timer island: fixed bottom-right pill (timer + chat + music) | **Small movable timer**: drag it, it snaps to corners, minimises to a ring showing time left, a "Move to…" menu and arrow keys, never covers the tab bar. **Settings → Show focus timer on/off.** |
| No Settings page | **Settings**: Theme, Show focus timer, Show tools icon, Language, Tutor mode, Account (download / delete). |
| Light theme only | **Light / Dark / Match device**, a soft navy dark theme, no white flash on load, formulas and diagrams follow the theme, optional "Dark PDF". |

**Done when:** every screen is checked in light and dark mode; the timer and tools icon can be moved, minimised and hidden.

### Phase 5: Create, safe for 16–17-year-olds

| Existing | Change |
|---|---|
| "Visualize Concept": Higgsfield image models (terms require 18+) | **Claude Diagram Maker for everyone**: accurate, labelled diagrams (free-body diagrams, circuits, ray optics, conics, molecule shapes…) drawn as clean SVG, checked for safety, downloadable and attachable to notes. *(Tested: 7–10 s, accurate.)* |
| "AI Video Lessons": Higgsfield Kling video (18+) | **Animated explanations for everyone**: Claude writes 4–6 short scenes. Each scene has a diagram that builds up step by step, a key formula, and narration read aloud by the browser. It is a narrated, animated slideshow, not a filmed video, and builds on the existing scene player, which today only has 4 fixed animations. |
| Higgsfield used for every student, trains on inputs by default, files kept 7 days | **Only for accounts aged 18+**, as an extra for photo-style images and short videos. Training opt-out on; files removed from Higgsfield after download; every result labelled **"AI-generated"**. |

**Done when:** a 16-year-old account can create diagrams and animated explanations, and no request from an under-18 account ever reaches Higgsfield (checked on the server, not just hidden in the app).

### Phase 6: Storage, speed and launch

| Existing | Change |
|---|---|
| PDF files saved as text-encoded data in localStorage (5 MB cap, readable by any script on the page) | Stored in **IndexedDB** on the device. Extracted text, topics, progress and profile sync to the student's private cloud area. |
| No account controls | **Download my data** and **Delete my account** (cloud data, device data and login). |
| One 984 KB (compressed) JavaScript file | **Landing page under ~300 KB**; each screen loads when opened. |
| No launch checks | Test on a low-end Android phone, budget alerts on Anthropic, Higgsfield and Google Cloud, backups, final privacy review. |

**Done when:** the landing page shows within 3 s on a slow-phone profile and account deletion removes everything.

**After Phase 6:** JEE mock-test mode (75 questions, 3 hours, +4/−1, numerical answers) and the question bank from `QUESTION_BANK_SOURCING.md`.

## 4. Firebase setup (only you can do this; about 10 minutes)

I can't create projects in your Google account. Please:
1. Open <https://console.firebase.google.com>, **Create project** → name it `LearnMate JEE Dev` → **turn Google Analytics off**.
2. **Build → Authentication → Get started → Sign-in method**: enable **Google** (pick your support email) and **Email/Password**.
3. **Build → Firestore Database → Create database** → **Production mode** → location **asia-south1 (Mumbai)**.
4. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `web` → copy the `firebaseConfig` values. They aren't secret. Add them to `.env` like this, then restart `npm run dev`:
   ```
   VITE_FIREBASE_API_KEY="…apiKey…"
   VITE_FIREBASE_AUTH_DOMAIN="…authDomain…"
   VITE_FIREBASE_PROJECT_ID="…projectId…"
   VITE_FIREBASE_STORAGE_BUCKET="…storageBucket…"
   VITE_FIREBASE_MESSAGING_SENDER_ID="…messagingSenderId…"
   VITE_FIREBASE_APP_ID="…appId…"
   ```
5. Later, repeat 1–4 for the production project `LearnMate JEE` and add your website domain under **Authentication → Settings → Authorized domains**.

The same keys are documented in `.env.example` with short explanations. **Emulator mode** lets me test without a project: set `VITE_FIREBASE_USE_EMULATOR="true"` and `VITE_FIREBASE_PROJECT_ID="demo-learnmate"`, then run `npm run emulators` in a second terminal. The emulator rules tests run with `npm run test:rules`.

To deploy the security rules, run `npx firebase-tools login` once in a terminal (it opens your browser). I handle the rest. Until then I build and test against the local Firebase emulator.

## 5. Create for 16–17-year-olds (reconsidered)

**What each service's terms say** (official terms pages checked 3 Nov 2026; not legal advice):

| Service | Can 16–17-year-olds use it? |
|---|---|
| Higgsfield | ❌ End users must be 18+ (API Terms §4.6). No education or parental-consent exception is published. |
| Gemini API, Google Vertex AI (Imagen, Veo) | ❌ Apps "likely to be accessed by individuals under the age of 18" are not allowed. |
| **Claude** | ✅ Allowed with safeguards: age check, moderation, "you're chatting with an AI" label, a public safety statement. Diagram code (SVG) is ordinary code generation. |
| OpenAI image API | ✅ With parental consent (separate OpenAI key needed). OpenAI's video API has been shut down. |
| Ideogram (images), Luma (video) | ⚠️ Probably, with parental consent; written confirmation needed first. |

India's IT Rules amendment (in force 20 Feb 2026) also requires **realistic** AI images and videos to carry a prominent "AI-generated" label and embedded metadata. Labelled diagrams are probably outside it.

**Recommendation:**
1. **Claude powers Create for every student**, through the Diagram Maker and animated explanations (Phase 5).
   - Tested: accurate, labelled diagrams in 7–10 s for a few US cents.
   - For JEE this is better than image generators, which often misspell labels and get physics wrong.
2. **Higgsfield stays only for accounts aged 18+** (from the age band in the first-run setup). It is an extra for photo-style images and short videos:
   - training opt-out switched on;
   - files removed from Higgsfield soon after the student downloads them;
   - every image and video labelled **"AI-generated"**.
3. **Parental approval (built in Phase 2), as you asked.** A 16–17-year-old can send a parent or guardian an email link; once the parent approves, the consent is recorded privately with the student's profile, including its date and what it covers. This unlocks only providers that allow minors with parental consent. It does **not** override a provider's age limit.
4. **Higgsfield exception:** I have drafted an email asking Higgsfield to confirm in writing whether supervised classroom use by 16–17-year-olds, with verified parental consent, is allowed (`docs/HIGGSFIELD_AGE_EXCEPTION_EMAIL.md`). If they agree, the same parental-approval record unlocks Higgsfield. If they refuse or do not reply, Higgsfield remains 18+ — letting younger students use it could get your account closed.
5. **Later, only if needed and funded:** photo-style images and short videos for 16–17-year-olds via a provider whose terms allow minors with parental consent (for example OpenAI's image API). India's DPDP Act requires verifiable parental consent for under-18s from about May 2027 anyway.

**You do now:** in your Higgsfield Workspace settings, switch on the **training opt-out** (up to 10 business days to apply). If you want the age exception, send the drafted email from your Higgsfield account address and keep the reply.

## 6. How private data flows

```
Student signs in (Google / email)
      │ login token on every request
      ▼
Express server ── verifies token + per-student limits ──► Claude (no training; deleted ≤30 days)
      │
      ▼
Firestore  users/{their uid}/…   ← only the owner can read or write (rules + automated tests)
Device     IndexedDB             ← the original PDF never leaves the phone or laptop
```

## 7. Running costs (rough; confirm in beta from the `[AI]` server logs)
- **Firebase (free Spark plan):** Google and email login are free; the database free tier (1 GiB, 50,000 reads a day) is enough for a beta.
- **Claude:**
  - Tutor answer: about 2–7 US cents on a full 20-page chapter, less once only the relevant pages are sent.
  - Formula extraction: under 0.1 cent per upload.
  - Diagram: a few cents each.
  - The daily allowance caps the worst case per student.
- **Higgsfield (18+ accounts only):** about $0.03 per image, about $0.21 per 5-second video.
