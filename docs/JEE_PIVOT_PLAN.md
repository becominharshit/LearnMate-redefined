# LearnMate → LearnMate JEE: Pivot Plan

_Prepared 3 Nov 2026. Read together with `docs/AUDIT_REPORT.md` (bugs and flaws in the current code)._

---

## 1. The idea in one line

**An AI mentor for JEE aspirants that knows your syllabus, your coaching material, your mistakes and your exam date, and tells you exactly what to do next.**

LearnMate today is a general "upload anything, learn anything" app. For JEE it should become narrow and deep: Physics, Chemistry and Maths only, the official syllabus, the official exam pattern, and a daily loop built around mocks, mistakes and revision.

---

## 2. Key dates (verified 3 Nov 2026)

| Event | Date | Source |
|---|---|---|
| JEE Main 2027 Session 1 registration | 24 Oct – **22 Nov 2026** (late fee to 26 Nov) | NTA Information Bulletin, 24 Oct 2026 |
| City intimation slip / admit card | 30 Dec 2026 / 13 Jan 2027 | NTA bulletin |
| **JEE Main 2027 Session 1** | **20, 21, 22, 23, 24 and 28 Jan 2027** (≈ 11 weeks away) | NTA bulletin |
| Session 2 registration | 5 Jan – 3 Feb 2027 | NTA bulletin |
| **JEE Main 2027 Session 2** | **2 – 7 Apr 2027** | NTA bulletin |
| **JEE Advanced 2027** | Expected mid/late May 2027 (organiser expected: IIT Delhi, not yet official) | Coaching/news sites; brochure not yet out |

**JEE Main 2027 Paper 1 pattern (official):** 75 questions, 300 marks, 3 hours. Each subject has 25 questions: Section A has 20 MCQs (single correct) and Section B has 5 numerical-value questions (answer rounded to the nearest integer, typed on an on-screen keypad). **+4 / −1 for both sections**, 0 for unanswered. Offered in 13 languages.

**JEE Advanced:** two compulsory 3-hour papers. Question types change every year: single-correct, multiple-correct with partial marking (+4/+3/+2/+1, −2), numerical/integer, matching (List-I/List-II) and paragraph-based. Wait for the 2027 brochure before hard-coding anything.

**What this means:** we cannot build everything before Session 1. The plan is a focused MVP in front of real students by about **1 Dec 2026**. After that, improve it through Session 1, then Session 2 and Advanced.

---

## 3. Market reality: who you are up against

| Competitor | What they do well | Price |
|---|---|---|
| **NTA Abhyas** (official) | Free mocks in the real exam interface | Free |
| **SATHEE** (IIT Kanpur / MoE) | Lectures, mocks, AI doubt bot in 13 languages | Free |
| **Google Gemini / NotebookLM** | Free JEE Main mocks, Guided Learning, chat with your own notes | Free |
| **PW AI Guru / PW Books app** | Hinglish doubt solving from text, voice or photo; PYQs; modules | Bundled with PW |
| **MARKS (MathonGo)** | Largest chapter-wise PYQ bank (JEE Main back to 2002) | Freemium |
| **Allen / Embibe** | Improvement Book (re-attempt mistakes), All-India rank, deep analytics | Coaching fee |
| **JeeHub, Edvio Prep, QANDA, ChatGPT Study mode** | Focus tools, PDF→quiz, photo-solve, hint-based tutoring | ₹0–399/month |
| **GPAI** (gpai.app) | College STEM: multi-model **verified** solutions, twin-problem generator, TikZ/chemistry figures, LMS sync. **Not JEE-specific** | $2.99–29.99/month |

**Hard truth:** "Upload a PDF and chat with it" is free everywhere (NotebookLM, Gemini). Video lectures belong to PW and Unacademy. The biggest PYQ bank belongs to MARKS. LearnMate must **not** compete on those.

**AI accuracy is the real gap.** Published benchmarks show even top paid models get only about 77–84% of held-out JEE Advanced questions right (open-source models 37–45%). Asking a model to re-check its own answer fixes only about 5% of errors. Diagrams and organic structures are the weakest areas. Students lose trust after one wrong "answer key".

### Where LearnMate can win

1. **Mistake DNA for JEE.** After every test, diagnose *why* marks were lost (concept gap, formula recall, calculation, misread question, time pressure, guess), track it across mocks, and schedule re-attempts. Your existing Mistake DNA, revision-plan and spaced-repetition code is the right base.
2. **Planner tied to the exam date.** A plan worked backwards from 20 Jan / 2 Apr / May, weighted by chapter importance and the student's weak areas, and re-planned every week.
3. **Verified answers.** Solve twice independently (different models or prompts), run the numbers with code execution, and show a "verified" badge only when they agree. Otherwise show "unverified — check with your teacher". Use official answer keys for PYQs.
4. **Bring your own coaching material.** Most aspirants already have Allen, Aakash or PW modules as PDFs. LearnMate turns their own modules into chapter-wise practice, doubt-solving and mistake tracking. The PDF pipeline already exists and is an asset.
5. **Hinglish, mobile-first, cheap.** Most aspirants study on Android phones over mobile data.

---

## 4. The core daily loop

```
Plan (today's targets) → Learn/Doubt (AI tutor on your material) → Practice (chapter test / PYQs / mock)
      ↑                                                                              ↓
Re-plan weekly  ←  Revise (formula sheets + spaced flashcards)  ←  Mistake DNA (why marks were lost)
```

Every screen should feed this loop. Anything that doesn't is cut or parked.

---

## 5. Feature decisions: keep, adapt, cut, build

| Current feature | Decision | What changes for JEE |
|---|---|---|
| AI Tutor (text) | **ADAPT** | JEE-tuned prompts, LaTeX/KaTeX rendering, Hinglish option, retrieval instead of sending the whole PDF, "verified" badge on numeric answers |
| PDF Study Space | **ADAPT** | Support 300-page coaching modules (store in Firebase Storage, not localStorage), let Gemini read PDFs natively (equations and diagrams), ask about a selected passage |
| Diagnostic quiz + Mistake DNA + revision plan | **ADAPT (core)** | JEE question types (MCQ + numerical first), JEE error taxonomy, chapter heatmap, "Improvement Book" re-attempts |
| Exam simulator / practice | **REBUILD (core)** | Exact NTA-style CBT: 3 subjects × (20 MCQ + 5 NAT), +4/−1, 180 min, question palette with the 5 NTA states, numeric keypad, resume after refresh, detailed analysis |
| Quick Revise (flashcards, mind map, sheets) | **ADAPT** | Chapter formula sheets, named reactions, NCERT inorganic one-liners, spaced-repetition flashcards |
| Teach It Back | **KEEP** | Good for derivations and theory chapters |
| Voice tutor (Gemini Live) | **ADAPT / later** | Hinglish voice; paid or limited because it costs about $0.02/min |
| Focus timer + lo-fi radio | **KEEP (light)** | Keep only the free built-in synth; drop paid Lyria generation |
| Concept 3D Lab | **ADAPT / later** | JEE simulations only: projectile, SHM, rotation, ray optics, field lines, VSEPR/hybridization, stereochemistry, 3D vectors |
| Scan Notes / Lecture capture | **ADAPT** | Turn into "Photo → doubt solver" (snap a question, get a verified step-by-step solution plus similar PYQs) |
| Study Tools calculator / unit converter | **CUT from practice** | JEE allows **no calculator**; practising with one builds the wrong habit. Keep the formula sheet and scratchpad |
| LearnMate Daily (current affairs) | **REPLACE** | "JEE Daily": one Daily Practice Problem per subject, streaks, real NTA notices. Current affairs are not in JEE |
| Educational Maps | **CUT** | Irrelevant for JEE (and currently fake) |
| Course Library (general) | **REPLACE** | JEE syllabus map: the official chapter list with weightage and the student's status per chapter |
| PlayLab games, Mini App Builder | **CUT / park** | Not core; Mini App Builder is also a security risk |
| AI image / AI video / Higgsfield | **CUT / park** | Expensive (video ≈ $0.10/sec), slow, low JEE value; Higgsfield was never implemented |
| Vertex AI probe / AI usage dashboards | **HIDE** | Developer-only tools; must not be public endpoints |

### New features to build

| Feature | Priority | Notes |
|---|---|---|
| JEE profile + onboarding | P0 | Target exam(s), attempt year, class 11 / 12 / dropper, coaching, daily hours, target percentile or college, language |
| Official syllabus map | P0 | JEE Main 2027 chapter tree for P/C/M with weightage and status (not started → done → revised) |
| NTA-style mock engine | P0 | See table above. Start with chapter tests, then full 75-question mocks |
| Question bank v1 | P0 | Every question tagged (subject, chapter, concept, difficulty, source: PYQ / AI-verified / user). LaTeX everywhere |
| Photo → doubt solver with verification | P0 | Step-by-step solution, verified badge, "similar PYQs" |
| Countdown + adaptive planner | P0 | Backward plan to the exam date; re-plans weekly from mock results |
| Score → percentile → rank estimate | P1 | Based on published marks-vs-percentile data from past sessions; always shown as a range with a caveat |
| Twin-problem generator | P1 | "Give me 5 variations of this PYQ", each with a verified solution (GPAI's most-loved idea, made JEE-specific) |
| Response-sheet score calculator | P1 (late Jan) | After the exam, NTA publishes response sheets and provisional keys. Students paste theirs and get score plus percentile estimate. **Huge traffic moment** |
| JEE Advanced engine | P2 (Feb–May) | Multi-correct partial marking, matching, paragraph, integer/decimal with tolerance, Paper 1 + Paper 2 |
| College predictor (JoSAA) | P2 (June) | Based on past opening and closing ranks |

---

## 6. Timeline

| When | Goal |
|---|---|
| **Week 1** (3–9 Nov) | **Phase 0: make it honest and stable.** ✅ Done on branch `fix/phase0-honesty-stability`: fake fallbacks removed, login persistence, shared-device privacy, diagnostics locked, iPhone crash, fake Practice questions and analytics. ⏳ Still to do: fake Dashboard numbers, static Study Space lesson, KaTeX, auth and rate limits on AI endpoints, JEE profile |
| **Weeks 2–4** (10–30 Nov) | **JEE MVP:** syllabus map, question schema (MCQ + NAT), NTA-style test engine, question bank v1, JEE Mistake DNA, planner, photo doubt-solver. **Beta with 20–50 real aspirants by ~1 Dec** |
| **December** | Iterate on beta feedback: full-length mocks, Hinglish, percentile estimate, formula sheets + spaced repetition, mobile performance |
| **1–19 Jan** | Feature freeze. "Final revision mode", daily mock, stability only |
| **20 Jan – early Feb** | Response-sheet score calculator; Session 2 plan for each user |
| **Feb – May** | JEE Advanced engine, Advanced-style mocks, college predictor ahead of JoSAA |

---

## 7. Technical changes the pivot needs

1. **Honest AI everywhere.** Never show template content as if it came from AI (details in the audit report). If AI is down, say so and offer a retry.
2. **Accounts and data.** Keep login across refreshes, add guest mode that merges on sign-in, and clear local data on logout so users never see each other's data. Store PDFs in Firebase Storage and structured data in Firestore, not huge JSON strings in localStorage.
3. **Server security.** Verify the Firebase ID token on every `/api` call, add per-user rate limits and daily AI quotas, validate inputs, and make `/api/vertex/*`, `/api/usage` and `/api/capabilities` admin-only.
4. **Retrieval instead of whole-document prompts.** Chunk documents, embed them (`gemini-embedding-2`), and send only the most relevant chunks. This cuts cost by 10–30× and makes 300-page modules possible.
5. **Math and chemistry rendering.** KaTeX plus the mhchem extension, rendered through a safe Markdown renderer.
6. **Code health.** Split `server.ts` (≈4,000 lines) into routes and services, split the 2,000–3,400-line components, and code-split the 2.9 MB JavaScript bundle (slow on mobile data).
7. **Tests.** API tests for each endpoint, and an end-to-end test of the full mock-test flow (start → answer → submit → analysis).

---

## 8. Content strategy (the most important non-code decision)

A JEE product lives or dies on **question quality**. Options, best first:

1. **PYQs with official answer keys.** Highest trust. Legal reuse rights need research (see the research prompts). Needs digitising into LaTeX.
2. **AI-generated "twin" questions, verified.** Generate from a PYQ or concept, solve independently twice, run the numbers with code execution, and keep only questions where everything agrees. Label them "AI-generated, verified".
3. **The student's own material.** Questions extracted from their coaching modules, used only for that student and never shared.
4. **Teacher review.** Even 1–2 part-time IIT/NIT student reviewers checking flagged questions adds a lot of trust.

Always show the source label (PYQ 2024 Shift 2 / AI-verified / From your module) and give every question a "Report error" button.

---

## 9. AI model routing and cost (prices from the official Gemini pricing page, 3 Nov 2026)

| Model | Use for | Price per 1M tokens (input / output) |
|---|---|---|
| `gemini-3.1-flash-lite` | Default: topic extraction, flashcards, error classification | $0.25 / $1.50 |
| `gemini-3.8-flash` | Tutoring, solutions, question generation | $0.75 / $3.75 → **$1.50 / $7.50 from 1 Jan 2027** |
| `gemini-4-argon` | Only to verify hard or disputed problems | $2 / $10 → **$4 / $20 from 1 Dec 2026**, no free tier |
| `gemini-3.8-live` | Voice tutor | ≈ $0.023 per minute (audio in + out) |
| `gemini-omni-1.1-flash` | Video | ≈ $0.10 per second of video, so **cut** |

**Example:** a 200-page module is about 120k tokens. The current code sends the whole document with every question, which costs about **$0.18 per question** on 3.8 Flash at 2027 prices. With retrieval (about 4k tokens) it costs about **$0.01**, or about **$0.002 on Flash-Lite**. Retrieval is not optional.

**Free-tier warning:** on Gemini's free tier, prompts are used to improve Google's products. With student (mostly minor) data, use the paid tier in production.

---

## 10. Legal and compliance notes (research before launch)

- **DPDP Act 2023 and DPDP Rules 2025.** Most aspirants are under 18. Processing children's data generally needs verifiable parental consent and restricts tracking or behavioural monitoring. Research how this applies to an edtech app.
- **No affiliation claims.** Say "exam-like interface", not "official NTA". Never use NTA or IIT logos.
- **Copyright.** Coaching modules are copyrighted. Personal-use upload only, never shared between users. Check PYQ reuse rights before building a public bank.

---

## 11. Metrics to watch from day one

Weekly active students · tests completed per student per week · % of wrong answers re-attempted · score change across mocks · D7/D30 retention · AI cost per active student · "Report error" rate per 100 questions.

---

## 12. Google research prompts (copy, paste, bring back the results)

Search each prompt and paste back the **links, PDFs or screenshots** listed under "Bring back". ⭐ = do these first.

### A. Official exam information
1. ⭐ `JEE Main 2027 syllabus PDF site:jeemain.nta.nic.in`
   Bring back: the official syllabus PDF (needed for the chapter tree).
2. ⭐ `JEE Advanced 2026 information brochure question paper pattern marking scheme paper 1 paper 2`
   Bring back: the 2026 Advanced pattern tables (question types, marks, partial marking).
3. `JEE Advanced 2027 information brochure jeeadv.ac.in` (repeat in Dec 2026)
   Bring back: the official 2027 pattern and dates once published.
4. ⭐ `NTA JEE Main mock test interface question palette not visited not answered marked for review screenshot`
   Bring back: screenshots of the official CBT screen and instructions page (we copy the behaviour, not the logos).
5. ⭐ `JEE Main 2026 marks vs percentile session 1 session 2` and `JEE Main 2025 percentile vs rank`
   Bring back: tables of marks → percentile → rank (for the estimator).
6. `JEE Main chapter wise weightage 2024 2025 2026 physics chemistry maths`
   Bring back: 2–3 weightage tables from different sources (we will cross-check them).
7. `JEE Main 2026 total registered candidates session 1 session 2`
   Bring back: number of candidates (market size, percentile maths).
8. `JoSAA 2026 opening closing rank PDF IIT NIT`
   Bring back: link to the official opening/closing rank data (for the college predictor, later).

### B. Questions and content (legal and data)
9. ⭐ `are JEE Main question papers copyrighted NTA reuse previous year papers commercial app`
   Bring back: anything official about reuse rights of NTA/IIT question papers.
10. ⭐ `JEEBench dataset github license dair-iitd` and `mmJEE-Eval benchmark dataset JEE Advanced`
    Bring back: dataset links and licence text (possible starting data and an accuracy test set).
11. `JEE Main previous year questions dataset huggingface latex`
    Bring back: any open datasets with licences.
12. `NCERT textbook copyright terms reuse commercial`
    Bring back: NCERT's official copyright or permission page.

### C. Competitors and students
13. ⭐ `PW AI Guru features` · `MARKS app MathonGo premium price` · `JeeHub app features` · `Embibe JEE score prediction`
    Bring back: feature lists and prices (screenshots are fine).
14. ⭐ `reddit JEE aspirants best app for mock test analysis` and `reddit JEE which AI do you use for doubts`
    Bring back: the 10 most common complaints or wishes you see (r/JEENEETards, r/JEE).
15. `gpai.app pricing India` and `GPAI twin problem generator review`
    Bring back: pricing in India and what users like or dislike.

### D. Technology
16. `Gemini API code execution verify math answer` (ai.google.dev)
    Bring back: the doc link (used for verified solutions).
17. `KaTeX mhchem React chemistry equations rendering`
    Bring back: the setup guide link.
18. `RDKit.js React render SMILES structure`
    Bring back: the guide link (for organic structures, later).

### E. Legal and business
19. ⭐ `DPDP Rules 2025 children verifiable parental consent edtech exemption tracking`
    Bring back: the official Rules PDF or a law-firm summary.
20. `Razorpay subscriptions UPI autopay integration` (only when we add payments)

### F. Talk to real students (more valuable than any search)
Message 10 JEE aspirants (Class 12 or droppers) and ask:
1. Which apps do you open every day, and which do you pay for?
2. What do you do after a mock test? What is painful about it?
3. Where do you get doubts solved at 11 pm?
4. How do you revise formulas?
5. Would you upload your coaching modules to an app? Why or why not?
6. What would you pay per month for something that actually raises your mock score?

---

## 13. Decisions needed from you

1. **Platform:** web app (installable PWA) first, Android app later? (Recommended.)
2. **Scope for Session 1:** JEE Main only, with Advanced from February? (Recommended.)
3. **Language:** English + Hinglish from the start?
4. **Business model:** free beta now, ₹99–299/month later?
5. **Content:** can you get PYQ data or 1–2 student reviewers (IIT/NIT)?
6. **API key:** do you have a Gemini API key with billing enabled? Real AI features can't be tested without one.
7. **Team and time:** who is building, and how many hours per week?
