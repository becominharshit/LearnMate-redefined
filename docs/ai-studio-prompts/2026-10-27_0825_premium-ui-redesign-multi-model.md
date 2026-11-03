# LEARNMATE 2.0 — COMPLETE PREMIUM UI REDESIGN, MULTI-MODEL AI INTEGRATION & PRODUCTION REPAIR

## YOUR ROLE

Act as a Principal AI Architect, Senior React/TypeScript Engineer, Google Cloud Engineer, Firebase Security Architect, Android Web Performance Specialist, Educational Product Designer, and QA Automation Engineer.

## THE MISSION

Transform my EXISTING LearnMate application into a fully functional, professional, scalable AI education platform using the TEN attached screenshots as the exact new visual design references.

This is a complete UI redesign combined with backend stabilization and feature integration.

**Do not create a new application. Modify my existing LearnMate project.**

Implement the complete upgrade in one coordinated development request. Organize the work internally as necessary, but don't stop at a plan or ask for individual feature prompts.

### Non-negotiable requirements

- Preserve existing users, Firebase documents, study materials, quiz attempts, saved notes, conversations and progress.
- Preserve every existing working feature.
- Do not replace functional implementations with mock interfaces.
- Do not display fabricated results, fake analytics, fictional generated assets or unverified source references.
- Do not hardcode the example student data or dates shown in the screenshots.
- All navigation buttons and interactive controls must perform real actions.
- Do not expose organization-provided API credentials in client-side code.
- Never claim an external API succeeded unless a real provider response was received and validated.
- No expensive external media requests without an authorized budget.
- Make the complete website responsive and highly usable on Android smartphones.
- Run real build, integration and regression tests before reporting completion.

---

# PART 1 — EXACT NEW UI DESIGN

## Visual identity

The uploaded screenshots are the new canonical design reference.

Replace the previous visually busy Google-gradient styling with this refined editorial learning interface.

### Design characteristics

- Warm white and very light ivory backgrounds.
- Deep navy/near-black text.
- Restrained terracotta/red-orange accents.
- Elegant serif headlines.
- Highly readable sans-serif controls and body text.
- Fine borders.
- Soft neutral surfaces.
- Delicate shadows.
- Large, open reading spaces.
- Minimal decorations.
- Clear content hierarchy.
- Professional educational and academic appearance.

Suggested tokens, adjusted to match screenshots:

- Background: #FCFBF9
- Paper: #FFFFFF
- Primary text: #121827
- Secondary text: #606B7C
- Accent: #C84428
- Accent light: #FBECE6
- Border: #E8E6E2

Typography:
- Editorial headings: Newsreader, Fraunces or a visually equivalent serif.
- UI and long-form digital controls: DM Sans or Inter.
- PDF/document content: preserve authentic source typography where applicable.
- Sticky notes: Kalam.
- Mathematical notation: KaTeX or MathJax.

Do not blindly use serif fonts everywhere. Prioritize legibility.

### Responsive design

Desktop layouts should match the reference screenshots closely.

Tablet and Android layouts must adapt intelligently rather than shrinking the entire desktop interface.

Use reusable layout primitives, CSS Grid/Flexbox, responsive tokens and semantic components.

Avoid:
- Fixed desktop-only widths.
- Inaccessible sidebars.
- Overlapping floating controls.
- Tiny clickable targets.
- Horizontal page overflow.
- Overly dense panels.
- Dialogs hidden behind the phone keyboard.

---

# PART 2 — TEN REFERENCE IMAGE MAPPINGS

## IMAGE 1 — REVISION / STICKY NOTES

Replicate the new Revision interface.

Visual details:
- Large elegant title "Revise with clarity."
- Small subject/chapter breadcrumb.
- Tabs for Sticky Notes, Flashcards, Mind Map and One-Page Revision.
- Optional collapsible document/topic navigation sidebar.
- Spacious note grid.
- Pastel yellow, pink, blue and green sticky-note cards.
- Handwritten Kalam typography.
- Real page references.
- Compact edit, copy and delete icons.
- Add Note, Print and Regenerate controls.

All actions must work.

Sticky notes must derive from actual uploaded material or explicitly selected course content.

Print must open a real print dialog.

Download PDF must create genuine PDF binary output, not a .txt file renamed to .pdf.

Flashcards must flip, save and support active recall.

Mind maps must render real connected concept nodes.

One-page revision must produce a readable A4 document.

On Android, collapse the sidebar and use a comfortable one-column note layout.

## IMAGE 2 — PERSONALIZED DASHBOARD

Replicate the dashboard styling and composition.

Headline:
"Your learning, at a glance."

Include:
- Student profile.
- Active course/subject.
- Learning streak.
- Pages completed.
- Revision due.
- Quiz accuracy.
- Current material.
- Topic-level progress.
- Weekly study activity.
- Recent activity.
- Upcoming revision.
- Performance charts.

ALL data must come from the authenticated student's actual history.

For a new user, show an attractive empty state, not fabricated progress.

Use real current dates and correct user identity.

Provide clear Continue Learning actions.

## IMAGE 3 — PDF STUDY SPACE

This is one of the most important interfaces.

Replicate the immersive digital-textbook appearance.

Use:
- Large chapter headline.
- Subject breadcrumb.
- Main document canvas.
- Real PDF page controls.
- Zoom percentage.
- Highlight tool.
- Pen/annotation tool where supported.
- Eraser.
- Text note tool.
- Page-related AI explanation panel on the right.

The PDF must be rendered from the actual uploaded file, not reconstructed as fictional HTML content.

Use a reliable PDF rendering library such as PDF.js, retaining page coordinates and selectable text layers where available.

### Important PDF learning features

Students must be able to:
- Navigate individual pages.
- Search the document.
- Highlight important lines.
- View automatically suggested important headings and concepts.
- Add personal annotations.
- Open an explanation for a selected passage.
- Ask questions about the current page.
- Jump from source citations to the correct page.
- Save highlights and annotations.
- Reopen the same page later.

Automatic highlights must be visually distinguishable from user-created highlights.

Don't silently alter original PDF content.

## IMAGE 4 — ANNOTATION-TO-EXPLANATION CONNECTION

Follow this reference for linking selected text to the AI explanation panel.

When a student selects text or taps a highlighted passage:

1. Identify the exact document ID, page and text range.
2. Open the contextual AI panel.
3. Use only that material in Material Only mode.
4. Generate a concise page-aware explanation.
5. Show the correct page citation.
6. Preserve mathematical formatting.
7. Allow follow-up questions.

The highlighted passage and explanation should remain visually connected.

Save annotations in source-relative coordinates so they continue aligning after resizing or zooming.

### Page-wise content understanding

Provide a page overview containing:
- Main ideas.
- Important headings.
- Key definitions.
- Formulas.
- Examples.
- What the page is teaching.

This overview must summarize the actual page, not simply repeat all extracted text.

Do not hallucinate missing content.

## IMAGE 5 — STUDY TOOLS MODAL

Match the refined calculator modal.

Include working tabs:
- Scientific Calculator.
- Unit Converter.
- Statistics.
- Formulas.
- Graphing.

Use real deterministic calculation libraries and verified formulas.

Support proper mathematical notation and fractions.

Do not hardcode results shown in reference screenshots; calculate every result correctly.

The modal must:
- Open from Study Space.
- Center properly.
- Close on Escape/close button.
- Be responsive.
- Preserve current study position.
- Work on Android.
- Never cover essential mobile controls without a usable dismissal path.

## IMAGE 6 — SCAN NOTES

Replicate the beautiful side-by-side scanner interface.

Left:
Original photographed/scanned notebook page.

Right:
Cleaned editable digital notes.

Workflow:
1. Capture with Android camera or upload image.
2. Crop and rotate.
3. Enhance readability.
4. Extract handwriting and mathematics.
5. Reconstruct headings, lists, diagrams and formulas where feasible.
6. Display the actual original alongside the editable interpretation.
7. Flag uncertain extracted text.
8. Allow manual correction.
9. Save to My Notebook.
10. Convert to flashcards or other learning resources.

Preserve the original image permanently unless the user deletes it.

Allow multi-page scans.

Do not invent content that the scanner cannot recognize.

On phones, use vertically stacked panels or an Original / Digital toggle.

## IMAGE 7 — AI STUDY TUTOR

Replicate the elegant three-column desktop tutoring experience:

Left:
Current source and chapter navigation.

Center:
Readable conversation, explanations, formulas, citations and follow-up actions.

Right:
Quick Explanation, Key Idea, Formula and relevant summaries.

Maintain:
- Gemini tutoring.
- Source-grounded answers.
- General knowledge opt-in.
- Accurate source citations.
- Simplify / Explain Deeper.
- Follow-up questions.
- Chat history.
- Text input.
- Existing Voice Tutor access.

Do not replace the working Gemini Live voice implementation.

On phones, conversation becomes primary while document context and explanations become accessible through drawers or tabs.

## IMAGE 8 — EXPLORE

Replicate the editorial learning-resource discovery layout.

Use:
- Large headline "Explore beyond the notes."
- Topic search.
- Topic filters.
- Recommended educational videos.
- Articles.
- Quick references.
- Saved resources.

YouTube recommendations must use real verified results.

Never invent videos or article URLs.

Use source context and topic relevance ranking.

Include optional entries for:
- LearnMate Daily current affairs.
- Educational Maps.
- Course Library.

These secondary experiences must follow the same visual design language.

## IMAGE 9 — FULL PRACTICE QUESTION INTERFACE

Replicate the spacious examination layout.

Include:
- Selected source/chapter.
- Large question text.
- Properly formatted math.
- Clear answer options.
- Progress indicator.
- Previous/Next.
- Save for Later.
- Submit and review controls.

Support objective and appropriate question types.

Use deterministic scoring.

On Android, question content must remain readable with thumb-friendly controls.

Preserve exam-state autosave.

## IMAGE 10 — PRACTICE SET BUILDER

Replicate the custom practice configuration layout.

Allow students to choose:

Source:
- My Notes.
- Courses/Chapters.
- Licensed Past Papers.

Configuration:
- Topics.
- Number of questions.
- Difficulty.
- Time limit.
- Practice/Exam mode.
- Scoring scheme.

Display real recent attempts, practice performance and weak-topic recommendations.

Support a configurable JEE-style examination experience.

Never fabricate past-paper questions or claim official exam affiliation.

---

# PART 3 — REPLACE INVALID MODEL CONFIGURATION

I want fast responses and a reliable multi-provider architecture.

Do not use an invented model ID.

### Gemini

Use `gemini-3.1-flash-lite` as the preferred low-latency, economical default for appropriate routine educational tasks where available.

Use an actually available higher-capability Gemini Flash model for complex tasks when necessary.

Validate model access and supported features through current official documentation.

Do not change the existing Live API model unless required to resolve a confirmed issue.

### Claude

My organization provides an Anthropic Claude API.

Integrate Claude as an optional server-side provider for:
- Complex educational reasoning.
- Structured game specifications.
- Complex code-related explanations.
- Mini-app specification generation.
- Difficult misconception analysis.
- Quality checking when justified.

Use the official Anthropic SDK.

Read credentials securely from `ANTHROPIC_API_KEY` or approved workload identity configuration.

Do not call Claude on every simple request.

Use configurable model routing based on complexity, availability, latency and cost.

Do not automatically send private uploaded student content to Claude without appropriate user disclosure and authorization.

### Higgsfield

My organization may provide paid Higgsfield API access.

Prepare an actual provider adapter for the official Higgsfield API.

Do not assume that a Higgsfield plugin inside ChatGPT automatically gives the deployed LearnMate backend an API key.

When actual API credentials are supplied:
- Validate model catalog access.
- Submit generation jobs.
- Track provider job status.
- Retrieve actual media.
- Store media securely.
- Display real generated files.

If the API isn't available, show a clear unconfigured state and preserve working deterministic educational animations.

### Provider routing

Create a central AI provider registry.

Separate:
- Text reasoning.
- Source understanding.
- Speech/Live.
- Images.
- Video.
- Music.
- Transcription.

Never send a media-generation request to a text-only model.

Cache reusable source analysis.

Use bounded retries, rate limiting and clear billing errors.

---

# PART 4 — RESTORE AND COMPLETE ALL LEARNMATE FEATURES

Every feature below must remain available and have a working implementation.

## A. Learning Games — PlayLab

The game must come from a student's selected study topic.

Allow:
- Select Study Material.
- Or Select Subject → Topic when no material is uploaded.
- Choose 2D or appropriate 3D.
- Choose difficulty.
- Generate and play.

Examples:
- Mathematics: graph puzzles and equations.
- Physics: projectile challenges and circuits.
- Chemistry: molecular matching and equation balancing.
- Biology: cell labeling.
- Programming: debugging puzzles.

Use trusted playable templates with Gemini/Claude generating validated content and configuration.

Do not execute arbitrary AI-generated JavaScript inside the main app.

Include real scoring, hints, explanations and replay.

Save games under the correct user.

## B. Concept 3D Lab

Only generate 3D experiences where the selected topic benefits from spatial understanding.

Support:
- Interactive geometry.
- Mathematical 2D/3D graphs.
- Projectile motion.
- Physics vectors.
- Molecules with validated chemical structures.
- Selected biological models.
- Appropriate circuit demonstrations.

Use Three.js and verified numerical/scientific data.

Support rotation, zoom, labels and parameter changes.

Do not fabricate scientific accuracy.

If 3D is inappropriate, generate a correct 2D interactive visualization.

## C. Mini App Builder

This must create actual functioning personalized mini-apps, not decorative mockups.

Allow students to describe an app in natural language.

Examples:
- Formula calculator.
- Physics solver.
- Revision planner.
- Custom quiz tool.
- Vocabulary trainer.
- Study tracker.
- Flashcard manager.

Use validated structured specifications, a safe renderer and real working calculations.

Support preview, edits, saving, reopening and secure sharing/export where supported.

Run untrusted generated logic only in an isolated sandbox.

## D. AI Images

Generate study-related visuals from verified concepts.

Use authorized Nano Banana or compatible Higgsfield image models.

For mathematically precise graphs and formulas, prefer deterministic SVG or Canvas rendering.

Never generate unrelated decorations instead of explaining the selected topic.

Save and export actual results.

## E. AI Educational Video

Use Gemini Omni Flash or the authorized Higgsfield API.

Workflow:
Selected topic → source analysis → fact-checked script → storyboard → video generation → real playback.

Support asynchronous jobs.

Handle failures, rate limits and missing billing properly.

For exact mathematical or physics animations, offer deterministic rendered animations using validated equations.

Do not show a pretend video player with fake output.

## F. Lo-fi Focus Radio

Provide soothing, instrumental-only lo-fi music.

Use authorized Lyria music generation where available.

Presets:
- Rainy Library.
- Cozy Café.
- Midnight Coding.
- Warm Piano.
- Ambient Focus.
- Gentle Vinyl.

Aim for soft dynamics, restrained melodies and no singing or lyrics.

Allow preview, save, loop, skip and volume control.

Provide a genuinely playable licensed or procedurally generated instrumental fallback when paid generation is unavailable, clearly labeled as non-AI.

## G. Voice Tutor

Preserve the currently working Gemini Live voice tutor.

Do not redesign its modal or rewrite its microphone implementation unnecessarily.

Keep:
- Real conversations.
- Microphone controls.
- Existing avatar.
- Captions.
- Saved transcript/history.
- Source awareness.

Apply only verified reliability and performance improvements.

## H. Lecture Capture & Notebook

Allow recording voice notes, transcription, photo notes and manual notes.

Provide editable transcripts and the ability to convert saved content into study materials.

Use authorized transcription endpoints.

Separate genuine streaming transcription from delayed recording transcription.

## I. Current Affairs & Maps

LearnMate Daily:
- Verified dated headlines.
- Newspaper-style layout.
- Source citations.
- Exam-relevant current affairs quizzes.
- Clear update timestamps.

Educational Maps:
- Optional location permission.
- Libraries, museums, science centers, historical sites.
- Relevant connections to selected subjects.

Never fabricate current news or places.

## J. Courses & Exams

Provide a browsable Course Library containing original or properly licensed learning resources.

Support:
- Different grades and subjects.
- Programming and college topics.
- Competitive-exam preparation.
- Course progress.
- Custom practice sizes.
- JEE-style timed examinations.

Do not redistribute copyrighted materials without permission.

## K. Focus Timer & Study Tools

The timer must not be permanently stuck in a corner obscuring content.

Use a compact Dynamic Island-inspired timer within the application chrome.

The Tools button should open the refined Study Tools modal shown in Image 5.

Neither should obstruct reading or controls.

Focus Mode can request fullscreen and detect when the student exits, but must never claim to prevent switching apps or browser tabs.

## L. Notifications

Fix the current notification bell.

Notifications should open properly and display only actual student reminders, saved job results or system updates.

## M. Spaced Repetition and Study Planning

Preserve and integrate:
- Personalized revision plans.
- Mistake DNA.
- Adaptive practice.
- Spaced repetition.
- Teach It Back.
- Study Planner.
- Progress analysis.
- Printable/PDF reports.

Every result should be associated with the actual current student, material and study history.

---

# PART 5 — SOURCE GROUNDING AND HALLUCINATION REDUCTION

Provide a clear toggle:

Material Only | Extended Knowledge

Default: Material Only.

In Material Only:
- Answer from selected source content.
- Verify source references.
- Explicitly say when the answer is not in the material.
- Do not invent page numbers, quotations or scientific statements.

In Extended Knowledge:
- Allow general explanations.
- Label externally sourced information.
- Use external search grounding only when appropriate and enabled.

For mathematics, physics, chemistry and programming:
- Validate calculations and formulas with deterministic code when possible.
- Validate structured AI output.
- Use real scientific data where needed.
- Never rely solely on visual plausibility.

Do not treat generated AI media as proof of factual accuracy.

---

# PART 6 — AUTHENTICATION & CLOUD BACKEND

Continue supporting Firebase Authentication with distinct private user identities.

Guest:
Firebase Anonymous Authentication with its own unique UID.

Permanent account:
Google Sign-In and supported account-linking.

On login/logout:
- Update UI immediately.
- Stop previous user's listeners.
- Clear sensitive in-memory cache.
- Load only the current user's records.

Use UID-scoped Firestore paths.

Apply restrictive Firestore and Storage security rules.

Verify Firebase ID tokens on protected server routes.

Preserve existing records through migration.

Do not create a separate physical database per student.

### Google Cloud

Where Vertex AI is used, prefer server-side Application Default Credentials through Cloud Run service identity.

Do not require downloadable service-account JSON keys.

Keep Google, Anthropic and Higgsfield secrets inside approved server-side secret management.

Never show them in browser responses, logs or client bundles.

---

# PART 7 — ANDROID OPTIMIZATION — HIGHEST UX PRIORITY

Treat Android phones as a first-class platform.

Test Chrome on common Android viewport sizes such as:
- 360 × 800.
- 393 × 873.
- 412 × 915.

Also test tablet and desktop sizes.

### Android navigation

Use:
- Compact top bar.
- Bottom navigation for primary destinations.
- More menu for secondary destinations.
- Clearly visible back navigation.
- Comfortable touch areas.
- Responsive side drawers.

### Study Space on Android

Do not squeeze PDF and AI explanation side by side.

Use a document-first reader.

Allow:
- PDF/Text tab.
- Ask AI tab.
- Highlights/Notes tab.
- Fullscreen reader.
- Bottom contextual selection toolbar.

Ensure highlights and touch gestures work without fighting page scrolling.

### Quiz on Android

Use large question text and full-width answer cards.

Keep Previous/Next reachable.

Handle the software keyboard correctly.

Preserve progress if the user changes tabs or briefly loses connectivity.

### Scanner on Android

Use camera capture where supported, with permission handling and file-upload fallback.

Support portrait capture, preview and editing.

### Creative tools on Android

Use adaptive Canvas/WebGL sizes, lower-cost graphics settings, and graceful fallback if 3D performance is poor.

Avoid huge upfront JavaScript bundles.

### Mobile performance

- Lazy-load heavy tools.
- Use code splitting.
- Reduce unnecessary React renders.
- Optimize images.
- Avoid blocking the UI thread.
- Preserve scroll position.
- Respect safe-area insets.
- Use dynamic viewport height units.
- Properly handle on-screen keyboard resizing.
- Avoid auto-playing audio.

Support PWA installability and offline access to cached permitted resources where feasible.

---

# PART 8 — COMPLETE ERROR & RELIABILITY AUDIT

Identify and fix the actual causes of:

- Authentication errors.
- Lost or shared study state.
- Gemini rate limits.
- Video generation failures.
- Image generation failures.
- Music generation failures.
- Incorrect model IDs.
- Missing API access.
- PDF viewer rendering failures.
- Broken PDF exports.
- Scanning/OCR failures.
- Broken notifications.
- Timer overlap.
- Tools/modal overlap.
- Incorrect quiz results.
- Stale React state.
- Failed Firestore writes.
- Inaccessible Android layouts.
- Unhandled promises.
- WebSocket cleanup errors.
- Incomplete background jobs.

Use centralized typed errors.

Distinguish:
- Configuration missing.
- Billing required.
- Quota exhausted.
- Permission denied.
- Unsupported model.
- Network failure.
- Invalid AI response.
- Persistence error.

Do not catch errors and silently display success.

Don't infinitely retry non-retryable errors.

Preserve successfully generated work when a regeneration fails.

---

# PART 9 — MANDATORY TESTING

Perform actual testing using the available development environment.

### Build quality
- TypeScript validation.
- Lint.
- Production build.
- Unit tests.
- Integration tests.
- Browser tests where available.

### Learning workflow
- Upload PDF.
- Read pages.
- Highlight.
- Ask a source-grounded question.
- Generate revision notes.
- Take a quiz.
- Identify weak topics.
- Generate adaptive practice.
- Save results.
- Reload and resume.

### Creative workflow
- Generate a playable topic-related 2D game.
- Generate a working 3D visualization.
- Create a functioning mini-app calculator.
- Generate a real image where authorized.
- Generate a real video where authorized.
- Generate/play actual lo-fi audio where authorized.
- Test the documented alternative when paid services are unavailable.

### Security
- Two different user accounts.
- Separate guest sessions.
- Login/logout.
- Data isolation.
- Protected API routes.
- Firestore Security Rules.
- Storage Security Rules.

### Android
- Homepage.
- Dashboard.
- PDF reader.
- AI Tutor.
- Practice.
- Revision.
- Scanner.
- Games.
- 3D canvas.
- Mini App Builder.
- Music controls.
- Timer.
- Notifications.
- Login.

### Performance
Measure:
- Initial page load.
- Time to first useful AI response.
- PDF rendering latency.
- React responsiveness.
- Cached generation behavior.
- API request counts.
- Model/provider errors.

Do not fabricate benchmark results.

---

# FINAL ACCEPTANCE RULES

The new LearnMate must visually follow all ten screenshots while maintaining real functional behavior.

The sample percentages, student names, dates and questions in reference screenshots are visual examples only.

Never populate a real student's account with fake data.

Every generated item must be traceable to either:
- The student's uploaded source;
- A selected real course/topic;
- An explicitly authorized external educational source.

Do not show decorative mockups as finished products.

No blank routes, dead buttons, hidden errors or pretend AI functionality.

If provider access is unavailable, make that limitation explicit and keep appropriate working non-AI functionality where possible.

## REQUIRED REPORT

After implementation, provide:

1. Updated UI components and routes.
2. Actual models selected and their model IDs.
3. Claude integration status.
4. Higgsfield integration status.
5. Google Cloud authentication status.
6. Firebase/data migration status.
7. Working features.
8. Features blocked by permissions or billing.
9. Bugs found and corrected.
10. Automated and live test results.
11. Android responsiveness results.
12. Remaining limitations.

Use statuses:
WORKING_VERIFIED
IMPLEMENTED_NOT_TESTED
WORKING_WITH_FALLBACK
BLOCKED_BY_BILLING
BLOCKED_BY_PERMISSION
FAILED

Do not report successful completion for untested features.

**FINAL GOAL: A premium, editorial-style, Android-optimized LearnMate learning platform where every feature serves real educational needs and the entire system operates securely, quickly and reliably.**

Inspect the existing project, follow all attached visual references, modify the real source code and execute the full upgrade.