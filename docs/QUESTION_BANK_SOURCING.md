# Getting JEE Main questions legally: past papers, mocks and test series

> Researched 3 Nov 2026; links checked on that date. **This is not legal advice.** Before you publish a
> public question bank, book a one-hour consultation with an Indian IP (copyright) lawyer.

## The short answer

| What you want | Can LearnMate use it? | How |
|---|---|---|
| **NTA past papers (PYQs)** | Yes, **with NTA's written permission** | Only the 2026 Session 2 papers are public. Ask NTA for permission, credit NTA, and write your own solutions. |
| **NTA answer keys** | Yes, with permission and credit | Text PDFs for 2020, 2021, 2023, 2025 and 2026. They map each Question ID to the answer, so matching can be automated. |
| **Official NTA mocks** (NTA Abhyas app, nta.ac.in/Quiz) | **Link only** | NTA copyright. Send students there; don't copy the questions. |
| **SATHEE** PYQs and mocks (IIT Kanpur / Ministry of Education) | **Link, or ask for a partnership** | SATHEE copyright, no open licence. |
| **Allen, Aakash, FIITJEE, PW, Motion, Resonance test series** | **No** | None of them offers a licence. Copying their papers is copyright infringement. |
| **Open datasets** | Some, with care | See section 2. Their licences cover the compilers' work, not NTA's questions. |
| **Your own original questions** (AI-drafted, expert-checked) | **Yes, fully yours** | Your best long-term asset. See section 6. |

---

## 1. Official NTA sources

**Question papers**
- The "Question Papers" menu on [jeemain.nta.nic.in](https://jeemain.nta.nic.in) links only the **9 B.Tech shifts of 2026 Session 2**, released on 9 Apr 2026. Example: [2 Apr 2026, Shift 1](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604092096865379.pdf).
- In these PDFs the questions and options are **images** (one paper has about 30 pages and 315 images). The Question IDs and Option IDs are selectable text.
- The 2019–2025 papers and 2026 Session 1 were never posted publicly. They were shown only to logged-in candidates during the answer-key challenge, and the 2027 bulletin describes the same process.
- **After 28 Jan 2027**, check whether NTA publishes the 2027 Session 1 papers, as it did for 2026 Session 2.

**Final answer keys**
- Text PDFs on the [documents page](https://jeemain.nta.nic.in/documents/), mapping Question ID → correct Option ID, integer answer, or "Drop". Example: the [2026 Session 2 final key](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260420409057044.pdf).
- Available for 2020, 2021, 2023, 2025 and 2026. No keys were found for 2019, 2022 or 2024.

**Syllabus and exam pattern**
- [JEE Main 2027 Information Bulletin](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/10/202610241890224107.pdf) and the [syllabus PDF](https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/10/20261024683680768.pdf) (machine-readable text).
- Pattern: 75 questions, 300 marks, 3 hours. Per subject: 20 MCQs and 5 numerical questions (answer rounded to the nearest integer). Marking is +4 / −1 in both sections.

**NTA's reuse rules**
- The [copyright policy](https://jeemain.nta.nic.in/copyright-policy/) says material "may be reproduced free of charge after taking proper permission from NTA". It must be reproduced accurately, with the source credited.
- The [hyperlink policy](https://jeemain.nta.nic.in/hyperlink-policy/) even asks you to request permission before linking. Include linking in your permission email (template in section 9).

**Free official practice (link out, don't copy)**
- [nta.ac.in/Quiz](https://nta.ac.in/Quiz) mock tests and the [NTA Abhyas app](https://play.google.com/store/apps/details?id=com.abhyas.nta.com): full, subject-wise and chapter-wise tests with solutions. "© All Rights Reserved".
- [SATHEE JEE PYQs](https://sathee.iitk.ac.in/sathee-jee/jee-pyq/) for 2013–2025, plus mocks. "© SATHEE", with no open licence.

---

## 2. Open datasets you can start with

| Dataset | Contents | Licence | Use it? |
|---|---|---|---|
| [soughed/jee-main-questions](https://huggingface.co/datasets/soughed/jee-main-questions) (eQOURSE) | 2,307 **original JEE-Main-style** questions from 28 test papers: LaTeX, diagrams, answers, **worked solutions**, topic, difficulty | CC-BY-4.0 | **Best starter set.** Credit eQOURSE, and confirm the origin with them before commercial use (unverified). |
| [PhysicsWallahAI/JEE-Main-2025-Math](https://huggingface.co/datasets/PhysicsWallahAI/JEE-Main-2025-Math) | 475 maths questions from 19 JEE Main 2025 papers, in LaTeX, with options and answers but no solutions | Apache-2.0 | The questions themselves are still NTA's, so treat them like PYQs: you need NTA permission. |
| [JEEBench](https://github.com/dair-iitd/jeebench) | 515 JEE **Advanced** problems (2016–2023), LaTeX, answers, no diagrams | MIT | For the February Advanced phase. The questions are still IIT copyright. |
| [mmJEE-Eval](https://huggingface.co/datasets/ArkaMukherjee/mmJEE-Eval) | 1,460 JEE Advanced questions (2019–2025), as images | MIT on the card, but the authors say "not for commercial assessment tools" | Avoid in the product; fine for testing your AI internally. |

**Avoid:** `ruh-ai/grafite-jee-mains-qna-no-img` (no licence, appears scraped), `HostServer001/jee_mains_pyqs_data_base` (its README says it was "reverse engineered" from a subscription site), and `nitish-bhai/JEE-MAINS-CONTENT` (no licence).

---

## 3. Allen and other coaching test series

- No coaching institute (Allen, Aakash, FIITJEE, PW, Motion, Resonance, Vibrant) has a public licensing programme or API. Their business deals are school tie-ups and franchises. [Allen's terms](https://allen.in/tnc) grant users no licence.
- Using their papers, solutions or question banks without written permission is **copyright infringement** (Copyright Act 1957, s.51). Don't use their brand names in your marketing either.
- **Legal alternatives that give you "test series" quality:**
  1. Buy original questions from a content vendor such as [eQOURSE](https://www.eqourse.com/national-test-prep-content-samples), with a written **guarantee that the content is original, plus an indemnity**.
  2. Pay subject experts (IIT/NIT students, experienced JEE teachers) per question to write and review questions.
  3. Generate questions with AI and have experts check them (section 6).
- **Students' own coaching papers:** LearnMate already lets a student upload *their own* module or test for *their own* study, and keeps it private to them. That fits the personal-use exception. Never share uploads between students, never add them to a common bank, and never train on them. If students can upload, publish a takedown and grievance process.

---

## 4. The legal position in plain words

- **Exam papers are copyrighted.** In *Rupendra Kashyap v Jiwan Publishing* (Delhi HC, 1996) the court held that CBSE owns its question papers and stopped a publisher from reprinting them, rejecting "public interest" and "private study" arguments. NTA is also a registered society under the Ministry of Education, so it very likely owns JEE Main papers.
- **Government works are not public domain in India.** The s.52(1)(q) exception covers Acts, judgments and the like, not exam papers.
- **The "examination" exception (s.52(1)(i)) has never been tested** for commercial mock-test or PYQ apps.
- **What helps:** in *OUP v Narendera* (Delhi HC, 2008, interim order), reproducing textbook questions **with your own step-by-step solutions** was treated as likely fair dealing for review.
- **Industry practice:** MathonGo/MARKS, PW, Allen, Vedantu and Careers360 all publish PYQs with their own solutions. No NTA licence or enforcement action was found. It is common practice, but untested in court.
- **Lowest-risk route:** written NTA permission, accurate reproduction, credit "Source: National Testing Agency", and your own solutions. Never claim to be "official"; never use NTA or IIT logos.

---

## 5. Turning question-paper PDFs into app questions

1. **Split** each paper PDF by Question ID (the IDs are text, so this can be scripted).
2. **Crop** the question and option images.
3. **Convert to LaTeX/JSON** with [Mathpix](https://mathpix.com/pricing/api): about $0.002 per image or $0.005 per PDF page, plus a one-time $19.99 setup fee. All nine 2026 Session 2 papers come to well under $30. Use Claude vision (already wired into LearnMate's notes scanner) as a **second reader** and flag every disagreement.
4. **Match answers** automatically from the final key (Question ID → Option ID).
5. **Human review of every question.** Show the rendered LaTeX next to the original image. Watch for signs, subscripts and exponents, matrices, options attached to the wrong question, organic structures and diagrams. Re-solve each question as a check.
6. **Write your own solutions** (AI draft plus expert check). Your solutions are your copyright and your differentiator.

Open-source tools if you prefer: [olmOCR](https://github.com/allenai/olmocr) (Apache-2.0); [DECIMER](https://github.com/Kohulan/DECIMER-Image_Transformer) and [MolScribe](https://github.com/thomas0809/MolScribe) (MIT) for chemical structures. Avoid Nougat for commercial use (CC-BY-NC weights). Marker's weights are free only below $5M in funding or revenue.

---

## 6. Writing original questions with AI, safely

AI-written questions are fully yours, but they need checking. In one study GPT-4o's MCQs had 6% factual errors and 11 items per 100 with no correct answer or several. Even top models get 16–23% of JEE Advanced items wrong.

1. **Plan from the official syllabus:** chapter weightage, MCQ versus numerical, and difficulty mix (for example 30% easy, 50% medium, 20% hard).
2. **Solution first:** for numericals, write a parameterised template, compute the answer with code (SymPy), then generate the wording around it.
3. **Automatic checks:**
   - Two independent solves agree, for example Claude Sonnet and Claude Opus, or Claude and Gemini.
   - Exactly one option is correct.
   - Numerical answers are integers.
   - Units are consistent.
   - Wrong options come from real mistakes (sign errors, missed factor of 2, wrong formula).
4. **Expert review** before a question goes live. Publish only reviewed questions in full mocks.
5. **Stay original:** never paste coaching or NTA questions into the prompt as "examples to copy". Screen new questions for similarity against PYQs.
6. **Keep improving:** a "Report error" button on every question, plus difficulty recalibration from real student answers.

LearnMate's quiz generator already applies part of this: JEE-style prompt, solution-first instruction, and rejection of malformed questions. A dedicated question-bank pipeline is the next step.

---

## 7. How bank questions should be stored (proposed format)

```ts
interface BankQuestion {
  id: string;                         // e.g. "nta-2026s2-0402s1-6911211" or "orig-phy-000123"
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  chapter: string;                    // official syllabus unit name
  type: 'mcq' | 'numerical';          // JEE Main: 20 MCQ + 5 numerical per subject
  question: string;                   // Markdown + LaTeX ($...$, \ce{...}), rendered by <MathText>
  images?: string[];                  // diagrams, stored in your own storage
  options?: [string, string, string, string]; // MCQ only
  correctIndex?: number;              // MCQ only
  numericalAnswer?: number;           // numerical only (rounded to the nearest integer)
  solution: string;                   // your own worked solution
  difficulty: 'easy' | 'medium' | 'hard';
  source: {
    kind: 'pyq' | 'open_dataset' | 'licensed_vendor' | 'original_ai' | 'original_expert';
    label: string;                    // shown to students, e.g. "JEE Main 2026 · 2 Apr Shift 1"
    licence: string;                  // e.g. "NTA permission (ref …)", "CC-BY-4.0 · eQOURSE"
    url?: string;
  };
  status: 'draft' | 'auto_checked' | 'expert_reviewed' | 'published' | 'retired';
  reviewedBy?: string;
  reportCount: number;
}
```

Always show the source label to students (for example "PYQ 2026 · 2 Apr Shift 1", "LearnMate original · expert-checked" or "From your notes").

---

## 8. Plan: the next 4 weeks, then until the exam

| When | What |
|---|---|
| **Week 1 (3–9 Nov)** | Send the NTA and SATHEE emails (section 9) and book the IP lawyer. Build the question-bank format (section 7) and import the eQOURSE set with attribution. |
| **Week 2 (10–16 Nov)** | Digitise the nine 2026 Session 2 papers, match them to the keys, review them and write solutions. **Keep them unpublished** until NTA or your lawyer clears them. |
| **Week 3 (17–23 Nov)** | Run the AI question pipeline. Target: chapter tests for the top 30 chapters, and the first 3 original full mocks (225 expert-checked questions). |
| **Week 4 (24–30 Nov)** | Launch mocks in the exact 2027 format (75 questions, 180 min, +4/−1, MCQ + numerical) with a takedown policy. Start collecting answer data. |
| **Dec – 19 Jan** | One new full mock every week (about 10 in total), daily chapter practice, and an error log from wrong answers. Add NTA PYQs as soon as permission arrives. |
| **After 28 Jan** | Check for the 2027 Session 1 papers and update the bank. Start JEE Advanced preparation (JEEBench for internal testing, [jeeadv.ac.in archive](https://jeeadv.ac.in/archive.html) with permission). |

---

## 9. Email templates

Check the current addresses on nta.ac.in and sathee.iitk.ac.in before sending.

**To NTA (genadmin@nta.ac.in)**

> **Subject:** Request for permission to reproduce JEE (Main) question papers and answer keys
>
> Dear Sir/Madam,
>
> I am [name], founder of LearnMate, a web app that helps JEE (Main) aspirants practise with step-by-step explanations ([URL]).
>
> Under NTA's copyright policy, I request written permission to:
> 1. reproduce the JEE (Main) 2026 Session 2 question papers and final answer keys published on jeemain.nta.nic.in, accurately and with the credit "Source: National Testing Agency"; and
> 2. link to NTA's official mock tests (nta.ac.in/Quiz and NTA Abhyas).
>
> Solutions will be written by our own team. We will not use NTA's name or logo to suggest any affiliation, and we will remove any content on request.
>
> Regards,
> [Name, organisation, phone]

**To SATHEE (sathee@iitk.ac.in)**

> **Subject:** Partnership request: linking SATHEE JEE resources from LearnMate
>
> Dear SATHEE team,
>
> LearnMate is a JEE (Main) practice web app ([URL]). We would like to link our students to SATHEE's PYQs and mock tests, and to discuss whether a content partnership is possible (for example, reproducing PYQs with credit to SATHEE).
>
> Could you let us know the terms, or the right contact for this?
>
> Regards,
> [Name]
