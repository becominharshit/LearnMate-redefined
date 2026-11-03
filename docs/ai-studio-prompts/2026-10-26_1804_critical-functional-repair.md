# LEARNMATE 2.0 — CRITICAL FUNCTIONAL REPAIR, EDUCATIONAL AI REDESIGN & PRODUCTION STABILIZATION

You are a Principal Full-Stack Engineer, Google Cloud/Vertex AI Architect, AI Media Engineer, Three.js Developer, Educational Simulation Designer, Audio Engineer, and Senior QA Specialist.

## YOUR MISSION

My LearnMate 2.0 application contains many recently added features, but several do not work correctly or do not match their intended educational purpose.

Inspect the actual existing code, diagnose every failure, repair the integrations, improve the learning experiences, and verify the complete application.

**THIS IS A FUNCTIONAL REPAIR, NOT A PROJECT REBUILD.**

Do not stop after writing a plan or adding attractive interfaces. Implement real working functionality.

Complete this as one coordinated development task without asking me to submit a separate prompt for each feature.

## NON-NEGOTIABLE RULES

1. Preserve all existing student data, Firebase accounts, learning records, study materials, and progress.
2. Preserve the current LearnMate branding, Google-color design, navigation, and existing successful functionality.
3. Do not replace functional components unnecessarily.
4. Never make fake API calls or display simulated generated media as genuine AI output.
5. Never silently create placeholder images, music, videos, games, or models and claim generation succeeded.
6. Use official, currently supported API models and SDK methods.
7. Inspect actual API errors and backend logs before changing code.
8. Keep API keys, credentials, and generated-media operations secure on the server.
9. Do not automatically enable expensive paid services or incur unexpected media-generation charges without administrator approval.
10. Implement safe alternatives when paid AI services are unavailable, clearly distinguish their capabilities, and preserve the intended learning experience where possible.
11. Test actual application behavior, not just compilation.
12. Never report a feature as working unless it has passed an appropriate real test.

---

# 1. FULL APPLICATION DIAGNOSIS

Before changes, inspect:

- React frontend and UI components.
- All backend endpoints.
- AI service providers and model selection.
- Google GenAI SDK configuration.
- Vertex AI integration.
- Firebase Authentication and Firestore.
- Cloud Storage.
- Generated-media processing.
- Three.js and game-rendering systems.
- Audio processing and playback.
- Video rendering and retrieval.
- Job queues and asynchronous task states.
- Error handling and request logging.
- Environment variables and runtime configuration.

For each newly added feature, identify:

- Its frontend component.
- Its backend route.
- The actual provider/model called.
- The input and output formats.
- Whether authentication succeeds.
- Whether the request reaches the provider.
- Whether generation succeeds.
- Whether the generated asset is stored.
- Whether the UI renders the real returned content.
- Why it is currently failing or producing inadequate results.

Distinguish coding bugs, unsupported models, billing restrictions, exhausted quotas, permission failures, incorrect prompts, and missing runtime infrastructure.

Do not hide any failures.

---

# 2. REPAIR VERTEX AI AUTHENTICATION

Current situation:

- Google Cloud organization policy prevents downloadable service-account JSON key creation.
- The existing app previously requested a GOOGLE_VERTEX_CREDENTIALS-style secret.
- I have a Google Cloud Free Trial project with credits.
- I want to use eligible Vertex AI services without service-account key files.

## Correct authentication

Use Application Default Credentials (ADC) through a secure Google Cloud runtime where available.

For Cloud Run:
- Identify the attached runtime service account.
- Use the Google Cloud metadata server's credential mechanism.
- Configure the official @google/genai SDK with Vertex AI mode.
- Read GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.
- Use the region/global endpoint supported by the selected model.
- Request only the required IAM permissions.
- Remove custom service-account JSON key requirements from the Cloud Run authentication path.

Do not disable iam.disableServiceAccountKeyCreation.

Do not embed Google Cloud private keys in source code, frontend variables, or Firebase records.

IMPORTANT:
Google AI Studio Build preview may not provide Cloud Run ADC.

Do not assume Vertex authentication will work in an environment without an attached identity.

Identify the actual runtime and support a secure, correctly configured backend deployment.

## Provider support

Create a shared provider configuration layer that can distinguish:

- Gemini Developer API with API key.
- Google Cloud Vertex AI / Gemini Enterprise Agent Platform with ADC.
- Unsupported or unconfigured services.

Do not assume every Gemini model is available through both APIs.

Do not send Developer API request formats blindly to Vertex AI endpoints.

Check model IDs, SDK methods, supported locations, input/output formats, billing access, and permissions.

## Diagnostics

Run one low-cost text-generation smoke test.

Report the actual status and error details.

Do not claim that Google Cloud Free Trial credits cover a specific model unless billing eligibility is confirmed.

Do not automatically migrate expensive image/video/music features without checking availability and expected charges.

---

# 3. CENTRALIZED AI CAPABILITY REGISTRY

Build a capability registry that identifies which real operations are available.

Examples:

- Text generation
- Document understanding
- Image generation
- Video generation
- Music generation
- Audio transcription
- Gemini Live
- External search grounding

For each capability maintain:

provider
modelId
endpoint
authenticationType
enabled
configured
available
supportsStreaming
supportsAsyncJobs
estimatedCostOrBillingCategory
lastCheckedStatus
lastError

Do not expose credentials in this registry.

Use this to prevent unsupported model calls.

If a paid feature is unavailable, show:

"AI media generation requires configuration or paid model access."

Offer a meaningful non-AI alternative when technically feasible, not a fake AI-generated result.

Do not display success until the actual output has been generated and validated.

---

# 4. REDESIGN AI LEARNING GAMES — MAKE THEM EDUCATIONAL

Current problem:
The AI Learning Game feature is confusing, and it is unclear what students are supposed to generate or learn.

## New purpose

LearnMate PlayLab must turn the CURRENT STUDY TOPIC into a playable educational activity.

The student should not need game-development knowledge.

## Student workflow

1. Student selects a PDF, lecture, course or topic.
2. LearnMate extracts source-supported key concepts.
3. It recommends suitable game mechanics.
4. Student chooses difficulty and game type.
5. A working game is created.
6. Student plays it.
7. Learning feedback and explanations appear.
8. Optional results are saved to the correct student profile.

## Game templates

Mathematics:
- Graph matching
- Equation-solving race
- Coordinate challenges
- Geometry puzzles
- Formula matching
- Probability experiments

Physics:
- Projectile trajectory challenge
- Force and motion simulator
- Circuit matching
- Energy conservation puzzle
- Pendulum parameter challenge

Chemistry:
- Molecule builder with validated bonds
- Periodic table challenges
- Chemical equation balancing
- Atom and element matching
- Reaction classification

Biology:
- Cell organelle labeling
- Anatomy identification
- Biological sequence puzzles

Programming:
- Code output prediction
- Debugging challenges
- Algorithm sequence puzzles
- Data structure sorting visualizers

Use real mathematical/game logic, validated rules and deterministic scoring.

## 2D vs 3D

Use lightweight interactive 2D games by default.

Only offer 3D gameplay when 3D spatial interaction directly helps explain the concept.

Do not generate random games unrelated to the student's material.

## Game generation architecture

Gemini should produce a validated declarative GameSpec containing:

- Source ID and topic.
- Learning objective.
- Game template type.
- Difficulty.
- Verified concepts.
- Game parameters.
- Questions or interaction targets.
- Answer/evaluation criteria.
- Source citations.

Render the validated GameSpec using existing trusted game components.

Do not execute unrestricted AI-generated JavaScript in the main app.

Games must be genuinely playable, not screenshots or static mockups.

Test using mathematics, physics, chemistry and programming examples.

If a topic is unsuitable, explain why and suggest an appropriate interactive alternative.

---

# 5. REBUILD CONCEPT 3D LAB AROUND THE STUDY TOPIC

Current problem:
The 3D feature is not sufficiently grounded in the concept being studied.

## Core requirement

Only create a 3D model when a genuine educational 3D representation is useful for the current topic.

This is NOT a generic AI 3D asset generator.

## Supported learning experiences

### Mathematics

Create real mathematical visualizations:
- 3D coordinate axes.
- Functions z = f(x,y).
- Paraboloids and surfaces.
- Plane intersections.
- Geometric solids.
- Vectors.
- Transformations.
- Calculus surfaces and gradients.

For ordinary 2D functions, offer an accurate interactive 2D graph instead of forcing a 3D representation.

Use mathematical expressions to calculate geometry.

Do not use an image-generation model to guess the shape of a mathematical graph.

### Physics

Create parameter-based simulations:
- Projectile trajectories.
- Velocity and acceleration.
- Forces and vectors.
- Inclined planes.
- Pendulum motion.
- Simple circuits.
- Wave propagation.
- Orbits where appropriate.

Use verified equations and real parameter controls.

### Chemistry

Create molecular visualizations:
- Atoms.
- Bonds.
- Common molecular geometries.
- Orbital or electronic structure concepts where appropriately modeled.
- Molecule rotation and labels.

Use verified molecular data or a curated scientific structure library where available.

Do not invent chemical bonds or molecular geometry based solely on a text prompt.

### Biology

Use vetted structures for:
- Cells.
- Organelles.
- Selected anatomical structures.

If accurate geometry is unavailable, show a labeled explanatory diagram instead.

## Technical design

Use Three.js or React Three Fiber as appropriate.

Generate structured SceneSpecs containing:
- Topic.
- Model type.
- Validated geometry parameters.
- Source references.
- Labels.
- Interactions.
- Explanations.

Every model must support:
- Rotate.
- Zoom.
- Pan.
- Reset view.
- Labels.
- Simple concept explanations.
- Appropriate parameter changes.
- Responsive layout.

Do not claim that a procedurally rendered diagram is a photorealistic reconstruction.

Test actual mathematical accuracy using known sample functions and physics parameters.

## Expected example

Student studies "Projectile Motion".

The app should create a real 3D or 2D trajectory visualization with adjustable initial velocity, angle, gravity, and resulting range.

Changing parameters must update the trajectory correctly.

That is a real educational model.

---

# 6. OPTIMIZE MINI APP BUILDER

Current problem:
The Mini App Builder does not create the type of application I intended.

## Intended purpose

Let students create small, genuinely useful personal web applications based on their studies.

It should feel like a simplified no-code student app builder.

## Student experience

1. Choose an existing study material or subject.
2. Describe the app they want in ordinary English.
3. Choose from suggested templates.
4. Generate a functional application.
5. Open the live preview.
6. Edit its text, inputs, formulas, questions, layout and colors.
7. Save to My Library.
8. Open and use the app later.
9. Export/share where secure and supported.

## Example applications

- Personal formula calculator.
- Physics equation solver.
- Revision planner.
- Flashcard organizer.
- Vocabulary trainer.
- Periodic table explorer.
- Probability experiment calculator.
- Custom chapter quiz app.
- Study progress planner.
- Subject-specific cheat-sheet viewer.

## Actual implementation

Use a validated AppSpec schema rather than allowing unrestricted code generation and execution.

Supported building blocks:
- Input fields.
- Numbers.
- Selectors.
- Buttons.
- Cards.
- Lists.
- Tables.
- Charts.
- Calculated outputs.
- Quiz controls.
- Local persistent state.
- Read-only selected study material.

Define calculations through a safe expression parser or trusted built-in functions.

Do not use unrestricted eval or arbitrary code execution.

Create real functional interactions.

For example:

"Build a projectile range calculator."

The generated app should accept initial velocity, angle, and gravitational acceleration, then compute and display range using validated logic.

It must not merely display a nonfunctional calculator design.

## Required features

- Live preview.
- Editable structure.
- Functional controls.
- Save and reopen.
- Delete.
- Duplicate.
- Rename.
- Validation messages.
- Mobile-friendly rendering.
- User-scoped persistence.
- Secure export where possible.

Do not allow student-created mini-apps to access API secrets, other users' data, or arbitrary internal backend endpoints.

If advanced custom code generation is offered, execute it only inside a properly isolated, permission-limited sandbox.

Test a generated calculator, quiz app and revision planner end to end.

---

# 7. FIX AI IMAGE GENERATION

Current requirement:
Images must explain the actual material a student is studying.

Use a currently supported image-generation model such as Nano Banana 2.1, subject to actual access.

## Correct pipeline

Student selects:
- Learning material.
- Chapter/page.
- Concept.
- Visualization format.

Learning engine extracts and validates relevant concepts.

Generate a source-grounded VisualSpec containing:
- Subject.
- Concept.
- Required objects.
- Labels.
- Relationships.
- Important constraints.
- Source references.

Then generate the image from that structured specification.

## Supported images

- Chemistry diagrams.
- Biology illustrations.
- Historical scene reconstructions clearly labeled as illustrative.
- Concept comparisons.
- Physics concept illustrations.
- Educational infographics.

For accurate mathematical plots, scientific charts and circuits, prefer deterministic SVG/Canvas rendering or specialized libraries instead of AI image generation.

Use image AI for illustration, not for determining mathematical truth.

## Required output

- Actual returned image.
- Loading/error states.
- Save to Library.
- Regenerate.
- Download.
- Source context.
- AI-generated label.

No generic stock images.

Never claim a generated illustration is a verified scientific diagram unless its accuracy has been checked.

---

# 8. REPAIR AI VIDEO GENERATION — HIGH PRIORITY

Current problem:
The app is not generating videos.

## Diagnose before editing

Check:
- Actual video model ID.
- Whether the endpoint still exists.
- Whether the model is enabled for this project.
- Whether the provider supports the chosen method.
- Billing requirements.
- IAM permissions.
- Input format.
- Duration limits.
- Output format.
- Asynchronous job handling.
- Result retrieval.
- Storage permissions.
- Browser playback.
- Error reporting.

IMPORTANT:
The Gemini Developer API Veo 3.1 Preview endpoints were retired on October 22, 2026.

If the project still uses retired endpoints such as veo-3.1-generate-preview, replace them with currently supported models and API methods.

Check Gemini Omni Flash support for the actual provider and environment.

Do not assume a model available through the Developer API is available with identical configuration through Vertex AI.

## Correct educational video purpose

Generate short animations explaining the topic the student selected.

Examples:
- Projectile motion trajectory.
- Molecular bonding concept.
- Cell division overview.
- How a Python algorithm works.
- Geometry transformation.
- Probability experiment.

Do not generate irrelevant cinematic scenes.

## Educational workflow

1. Student chooses a source-backed topic.
2. Extract relevant concepts.
3. Generate a factual narration/explanation.
4. Validate equations, terminology and source grounding.
5. Construct a concise storyboard.
6. Generate the supported short video.
7. Wait for actual provider completion.
8. Retrieve and validate the returned video.
9. Store the real media asset.
10. Display a working player.
11. Allow replay/download where permitted.

For concepts requiring exact diagrams, use deterministic educational animation built with SVG, Canvas or Three.js and a real rendering/export process.

This deterministic animation may be offered as a useful alternative to AI video generation, but label it "Animated Explanation", not "AI-generated video".

## Backend requirements

Use persistent jobs with statuses:
queued
processing
completed
failed

Store job identifiers and completion results.

Poll or subscribe to actual status.

Do not infer progress percentages that the provider does not supply.

Do not discard completed work when the student navigates away.

Handle:
- Unsupported model.
- Billing required.
- Rate limiting.
- Permission denied.
- Job timeout.
- Content blocked.
- Invalid output.
- Missing storage permissions.

Test one short real video generation only when API access and spending permission exist.

If model billing is unavailable, report BLOCKED_BY_BILLING and leave working topic-based deterministic animation as the available alternative.

Do not fabricate a video result.

---

# 9. REPAIR LO-FI MUSIC GENERATION AND QUALITY

Current problems:
- AI music generation fails.
- The generated music is poor.
- It does not feel like relaxing instrumental study lo-fi.

## Core product requirement

Create LearnMate Focus Radio.

This is a calming, instrumental-only lo-fi music experience integrated into Focus Mode.

Do not offer generic random music generation.

## Music styles

Provide curated presets:

1. Rainy Library — warm Rhodes piano, rain ambience, mellow drums.
2. Midnight Coding — minimal synth textures, soft bass, gentle percussion.
3. Cozy Café — soft jazzy chords, brushed drums, mellow piano.
4. Deep Focus — very subtle ambient lo-fi with restrained rhythm.
5. Sunset Revision — warm guitar, soft piano and slow beat.
6. Sleepy Vinyl — tape warmth, gentle keys, quiet vinyl texture.

## Audio design requirements

- Instrumental only.
- No lyrics.
- No singing.
- No spoken dialogue.
- No aggressive drops.
- No heavy EDM.
- No distracting lead melody.
- Soft, coherent transitions.
- Warm, balanced mixing.
- Minimal percussion.
- Reasonable BPM around 65–85, depending on preset.
- Smooth playback volume.
- Comfortable looping where possible.

## AI music provider

Use an available supported Lyria music model.

Verify the actual endpoint, model ID, request format and billing access.

Lyria 3 Clip and Lyria 3.5 have different output lengths.

For preset testing, use short instrumental previews before longer generation when access permits.

Use carefully structured prompts including:
- Genre.
- BPM.
- Instruments.
- Mood.
- Arrangement.
- Instrumental-only restriction.
- Desired duration.

Example prompt:

"Create a soft instrumental lo-fi hip-hop study track at approximately 75 BPM. Warm Rhodes electric piano, mellow seventh chords, soft brushed snare, quiet kick, warm round bass, subtle vinyl texture and gentle rain ambience. Minimal repetitive melody, relaxing and unobtrusive, smooth transitions, soft dynamics. No vocals, no lyrics, no speech, no rap, no aggressive drop, no sudden loud sounds. Suitable for deep focus and quiet studying."

## Quality controls

Allow the student to:
- Preview.
- Regenerate.
- Save favorites.
- Play/pause.
- Loop.
- Adjust volume.
- Skip tracks.
- Choose a different preset.

If a generation has unintended vocals or does not match the instrumental focus style, make regeneration available; where technically feasible, detect obvious vocal content.

Do not guarantee that prompts always eliminate vocals.

## Reliable fallback

If paid AI music is unavailable:

Provide a clearly labeled non-generative Focus Radio using:
- Properly licensed instrumental audio already available to the application; or
- A functional deterministic Web Audio-based lo-fi loop engine.

The deterministic engine may produce simple repeating chords, soft beats, and ambient textures.

Do not label this as AI-generated music.

Do not silently fetch or redistribute copyrighted tracks.

Focus Radio must still support reliable playback even without Lyria access.

Use actual audio buffers or generated waveforms, not silent placeholders.

---

# 10. FIX FLOATING TIMER POSITIONING

Current problem:
The timer is stuck at the bottom-left corner, obscures content, and looks visually awkward.

Redesign its positioning without changing its timer calculation logic.

## Desktop

- Use a small, elegant Dynamic Island-inspired timer pill.
- Prefer integration into the top Study toolbar or a dedicated top-center/right safe area.
- Do not overlay primary content or page headings.
- Expand only on click.
- Show time, start/pause and focus status.
- Use subtle Google-color accents.

## Mobile

- Place it in the header or a safe area above the bottom navigation.
- Respect safe-area insets.
- Never cover the keyboard, chat input, important buttons or bottom navigation.
- Use compact sizing.

## Positioning

Use a reusable FloatingWidgetHost/OverlayManager for floating utilities.

Allow repositioning only within safe viewport bounds when floating mode is active.

Persist user placement when appropriate.

Clamp position after viewport resizing.

Support keyboard and touch access.

Prevent widget overlap.

Test desktop, tablet, and small-screen widths.

Timer must continue accurately when navigating between LearnMate pages.

Use timestamps to prevent countdown drift.

---

# 11. FIX FLOATING STUDY TOOLS

Current problem:
The study utilities widget also covers content and looks awkward.

Do NOT keep it as a permanent bottom-left overlay.

Create a compact Tools button with a proper popover or slide-out drawer.

Tools include:
- Calculator.
- Unit converter.
- Formula sheet.
- Scratchpad.
- Graphing utilities where supported.

Rules:
- Default closed.
- Open on explicit click.
- Do not obstruct main study content.
- Support outside-click/Escape close.
- Responsive panel.
- Correct stacking context.
- No overlap with timer.
- Suitable mobile keyboard handling.
- Keep calculator and unit calculations deterministic.

Use the shared OverlayManager or safe layout system.

Do not create multiple competing floating layers.

---

# 12. PRESERVE THE WORKING AI VOICE TUTOR

The existing Gemini Live Voice Tutor is working.

Do not redesign it.

Do not rewrite microphone capture, Live API transport, voice playback, or the avatar unless a specific confirmed bug requires it.

Only apply safe performance and cleanup improvements.

Preserve existing captions and conversation behavior.

Run regression tests for microphone permission, active conversation, disconnection, and text fallback.

---

# 13. AUDIT THE OTHER RECENTLY ADDED FEATURES

Review every LearnMate 2.0 feature introduced today.

### Scan Notes
Verify camera permission, image capture, digitization, editable text and save/export.

### Personal Notebook
Verify audio recordings, photo notes, saving, editing, reload and user-scoped persistence.

### Transcription
Verify recording, supported transcription API, actual transcript results, timestamps where available, and error handling.

### Current Affairs
Verify real sourced articles, refresh dates, article links and no fabricated headlines.

### Educational Maps
Verify optional location permission, valid Places/Maps results and useful educational destinations.

### Course Library
Verify actual available materials, enrollment, lesson loading and progress tracking.

### Exams
Verify custom question counts, timers, question palette, answers, scoring, autosave and fullscreen warnings.

### Notifications
Fix any broken bell-button click handler and ensure the panel opens reliably.

### Guest Authentication
Verify unique anonymous Firebase UID, private guest data, account linking and sign-in/out isolation.

### Material Only Mode
Ensure AI stays within the selected study source unless external/general knowledge is explicitly enabled.

### Reports and Revision
Verify PDF export, print, flashcards, mind maps, revision plans and saved learning history.

### Mobile
Verify every new section at mobile sizes. Prevent horizontal overflow, fixed-position obstruction and inaccessible controls.

Do not break previously functioning features.

---

# 14. CODE QUALITY, DATA FLOW AND SECURITY

Use one shared educational concept representation.

Suggested:

LearningSource
ConceptGraph
ValidatedConcept
EducationalGameSpec
EducationalSceneSpec
MiniAppSpec
VisualSpec
VideoStoryboard
MediaGenerationJob
SavedAsset

Schemas must contain source IDs, topic references, actual content and ownership where appropriate.

Avoid requesting the entire PDF or video repeatedly for every generated asset.

Use source-grounded concept analysis as the input to downstream features.

Reuse existing stored analysis when valid.

Server-side:
- Verify authentication for private operations.
- Enforce per-user data ownership.
- Secure media-generation requests.
- Limit concurrent expensive tasks.
- Prevent duplicate generation.
- Enforce upload and request limits.
- Sanitize generated content.
- Protect secrets.
- Track provider errors and cost-bearing requests.

Never execute untrusted arbitrary app code in the privileged main application context.

Use real generated assets stored in per-user Cloud Storage paths where appropriate.

Do not merge student accounts or overwrite their learning records.

---

# 15. TESTING — ACTUAL END-TO-END ACCEPTANCE

Run TypeScript, lint, production build and existing automated tests.

Add focused integration tests for the new features.

Use realistic sample materials.

## Mathematics test

Source topic: Quadratic functions / graphing.

Expected:
- A real graph.
- Correct plotted equations.
- Working graph-related game.
- Functional formula-based mini app.
- Accurate concept image or deterministic diagram.
- Optional relevant explanatory animation.

## Physics test

Source topic: Projectile motion.

Expected:
- Functional adjustable trajectory visualization.
- Correct mathematical calculations.
- Playable trajectory challenge.
- Functional mini calculator.
- Accurate concept illustration.

## Chemistry test

Source topic: Basic molecular geometry.

Expected:
- Verified 3D molecular structure.
- Atom and bond labels.
- Relevant question game.
- Correct source-grounded explanation.

## Media tests

- Successful real image-generation response when authorized.
- Correct billing/config error when not authorized.
- Real returned video asset when authorized.
- Correct async job completion.
- Functional generated music playback when authorized.
- Functional non-AI Focus Radio fallback.
- No invented files or results.

## UI tests

- Timer does not overlap content.
- Tools do not overlap content.
- Mobile navigation works.
- Popovers and drawers close properly.
- Timer continues between routes.
- Dark/light themes remain readable.
- Voice Tutor remains operational.

## Authentication tests

- Guest A and Guest B have separate records.
- Permanent Account A and B cannot access each other's private data.
- Guest upgrade preserves appropriate records.
- No old-account data flash after logout.

## Reliability tests

Test simulated:
- 403 permission denied.
- 429 quota exhausted.
- 503 temporary outage.
- Invalid AI JSON.
- Network disconnection.
- Job cancellation.
- Firestore permission denied.
- Repeated rapid button clicks.

Where actual cloud credentials and permissions are available, perform safe live smoke tests.

Never call mocked responses proof of live AI generation.

---

# 16. SUCCESS AND FAILURE REPORT

After implementation, provide a comprehensive table:

FEATURE
CURRENT ROOT CAUSE
FIX APPLIED
PROVIDER/MODEL
STATUS
TEST RESULT
REMAINING BLOCKER

Statuses must distinguish:
- WORKING_VERIFIED
- WORKING_WITH_NON_AI_FALLBACK
- IMPLEMENTED_NOT_LIVE_TESTED
- BLOCKED_BY_BILLING
- BLOCKED_BY_IAM
- BLOCKED_BY_MODEL_ACCESS
- FAILED
- NOT_IMPLEMENTED

Show actual evidence for completed tests.

Also report:
- Changed files.
- Supported API endpoints.
- Required environment variables.
- IAM setup.
- Real generation test results.
- Estimated media costs where documented.
- Unresolved UI issues.
- Security concerns.
- Actual performance measurements.
- Steps required before production deployment.

Do not claim every feature is fixed if external permissions or billing still prevent execution.

## FINAL SUCCESS CRITERIA

LearnMate should:

1. Turn the student's actual learning concepts into functional games and visualizations.
2. Render scientifically and mathematically accurate interactive models.
3. Generate useful personal mini-apps instead of decorative interfaces.
4. Produce real source-relevant images and videos when the respective model access exists.
5. Provide genuinely pleasant instrumental lo-fi music.
6. Remain useful through honest non-AI alternatives when paid generation is unavailable.
7. Have clean, non-obstructive floating timer and study tools.
8. Preserve existing student data and working Gemini Live voice features.
9. Operate correctly on mobile.
10. Provide accurate errors and transparent capability status.

**Build functional educational experiences—not merely an attractive collection of AI buttons.**

Inspect the complete existing application and implement the repairs now. Do not stop after producing a plan.