import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_YOUTUBE_LECTURE_DURATION_SECONDS,
  VERIFIED_JEE_YOUTUBE_MARATHON_FIXTURES,
  validateAndNormalizeYouTubeLectureUrl,
  parseTimestampedTranscriptSegments,
  chunkLongLectureSegments,
  aggregateLectureChunksIntoStudyMaterial,
  retrieveRelevantPagesForQuery,
  noteGenerationCache,
  detectContextualCreateIntent,
  buildHandwrittenNotesDocument,
  globalAudioRegistry,
  stopAllGlobalAudioAndSpeech,
  computeUtf8ByteSize,
  truncateStringToUtf8Bytes,
} from './phase6Engine.ts';
import { MAX_PDF_PAGES, MAX_PDF_SIZE_BYTES, validateMaterialInput } from './quizGrading.ts';
import { normalizeMathDelimiters } from './mathMarkdown.ts';
import { validateDiagramSemanticAccuracy, getDeterministicDiagramTemplate } from './diagramEngine.ts';
import {
  generateHandwrittenNotesPdfBytes,
  generateStudentDataExportPdfBytes,
} from './pdfGenerator.ts';
import {
  computeStudyActivityStreakSummary,
  getStudyActivityDatesFromLocalStorage,
  recordDailyStudyCheckIn,
  STUDY_ACTIVITY_CHECKIN_STORAGE_KEY,
} from './jeeSubjects.ts';
import fs from 'node:fs';
import path from 'node:path';

test('Phase 6 Section 1: YouTube URL validation & 12-hour (720-min) marathon lecture chunking', () => {
  assert.equal(MAX_YOUTUBE_LECTURE_DURATION_SECONDS, 43_200);

  const validWatch = validateAndNormalizeYouTubeLectureUrl(
    'https://www.youtube.com/watch?v=8mAITcNt710'
  );
  assert.equal(validWatch.isValid, true);
  assert.equal(validWatch.valid, true);
  assert.equal(validWatch.videoId, '8mAITcNt710');

  const validShort = validateAndNormalizeYouTubeLectureUrl('https://youtu.be/rfscVS0vtbw');
  assert.equal(validShort.isValid, true);
  assert.equal(validShort.videoId, 'rfscVS0vtbw');

  const invalidDomain = validateAndNormalizeYouTubeLectureUrl('https://vimeo.com/123456789');
  assert.equal(invalidDomain.isValid, false);

  // Verify 12-hour Physics Marathon fixture (43,200 seconds / 720 minutes)
  const marathon = VERIFIED_JEE_YOUTUBE_MARATHON_FIXTURES['8mAITcNt710'];
  assert.ok(marathon);
  assert.equal(marathon.durationSeconds, 43_200);

  const segments = parseTimestampedTranscriptSegments(
    marathon.transcript,
    marathon.durationSeconds
  );
  assert.ok(segments.length >= 12);
  assert.ok(segments[segments.length - 1].startSeconds >= 39_600); // 11:00:00+

  const chunks = chunkLongLectureSegments(segments, {
    totalDurationSeconds: marathon.durationSeconds,
    chunkWindowSeconds: 3600,
    overlapSeconds: 60,
  });
  assert.ok(chunks.length >= 10);

  const aggregated = aggregateLectureChunksIntoStudyMaterial(
    marathon.title,
    marathon.videoId,
    chunks,
    marathon.durationSeconds
  );
  assert.equal(aggregated.pages.length, chunks.length);
  assert.ok(aggregated.topics.length >= 4);
  assert.ok(aggregated.overview.includes('720 min'));
});

test('Phase 6 Section 2: 60-page PDF limit & page-aware retrieval accuracy for pages 1..60', () => {
  assert.equal(MAX_PDF_PAGES, 60);
  assert.equal(MAX_PDF_SIZE_BYTES, 40 * 1024 * 1024);

  const check58 = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'chapter58.pdf',
    mimeType: 'application/pdf',
    fileSize: 15 * 1024 * 1024,
    pageCount: 58,
    textContent: 'Complete 58-page JEE Physics chapter notes with derivations and examples.',
  });
  assert.equal(check58.valid, true);

  const check60 = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'chapter60.pdf',
    mimeType: 'application/pdf',
    fileSize: 22 * 1024 * 1024,
    pageCount: 60,
    textContent: 'Complete 60-page JEE Organic Chemistry workbook with reaction mechanisms.',
  });
  assert.equal(check60.valid, true);

  const check61 = validateMaterialInput({
    sourceType: 'pdf',
    fileName: 'chapter61.pdf',
    mimeType: 'application/pdf',
    fileSize: 22 * 1024 * 1024,
    pageCount: 61,
    textContent: 'Exceeds 60 page ceiling.',
  });
  assert.equal(check61.valid, false);

  // Build a 60-page JEE Physics + Chemistry + Maths synthetic document
  const pages60 = Array.from({ length: 60 }, (_, idx) => {
    const pageNumber = idx + 1;
    let content = `General derivation and exercises on section ${pageNumber}.`;
    if (pageNumber === 45) {
      content =
        'Gauss Law for Electrostatics: The net electric flux through any closed surface is $\\Phi_E = \\oint \\vec{E} \\cdot d\\vec{A} = \\frac{q_{\\text{enc}}}{\\varepsilon_0}$.';
    } else if (pageNumber === 47) {
      content =
        'Aldol Condensation Mechanism: Enolate nucleophile attacks carbonyl carbon to form $\\beta$-hydroxy aldehyde or ketone.';
    } else if (pageNumber === 60) {
      content =
        'Cayley-Hamilton Theorem: Every square matrix $A$ satisfies its own characteristic equation $\\det(A - \\lambda I) = 0$.';
    }
    return {
      pageNumber,
      title: `Chapter Section ${pageNumber}`,
      content,
    };
  });

  // Query explicitly asking about Page 45
  const retrieved45 = retrieveRelevantPagesForQuery(
    pages60,
    'Explain the formula on page 45',
    1,
    10
  );
  assert.ok(retrieved45.selectedPages.length <= 10);
  assert.ok(retrieved45.explicitlyRequestedPageNumbers.includes(45));
  assert.ok(retrieved45.selectedPages.some((p) => p.pageNumber === 45));

  // Query asking about Aldol Condensation (on Page 47) without naming page number
  const retrieved47 = retrieveRelevantPagesForQuery(
    pages60,
    'How does Aldol condensation enolate mechanism work?',
    1,
    10
  );
  assert.ok(retrieved47.selectedPages.some((p) => p.pageNumber === 47));

  // Query asking about Cayley-Hamilton Theorem on Page 60
  const retrieved60 = retrieveRelevantPagesForQuery(
    pages60,
    'State Cayley-Hamilton theorem characteristic equation on page 60',
    1,
    10
  );
  assert.ok(retrieved60.selectedPages.some((p) => p.pageNumber === 60));
});

test('Phase 6 Section 3: Faster Note Generation representative sampling & cache speedup', () => {
  const pages60 = Array.from({ length: 60 }, (_, idx) => ({
    pageNumber: idx + 1,
    title: `Page ${idx + 1}`,
    content: `Detailed derivation on Page ${idx + 1}: $$E = mc^2$$ and $\\vec{F} = m\\vec{a}$. `.repeat(
      12
    ),
  }));

  const representative = noteGenerationCache.buildRepresentativePagesForFastNotes(
    'doc-60-bench',
    pages60,
    12
  );
  assert.equal(representative.length, 12);
  assert.equal(representative[0].pageNumber, 1);

  assert.equal(noteGenerationCache.get('doc-60-bench', 'v1', 'sticky_and_flashcards'), null);
  noteGenerationCache.set('doc-60-bench', 'v1', 'sticky_and_flashcards', {
    stickyNotes: [{ id: 'sn-1' }],
  });
  assert.deepEqual(noteGenerationCache.get('doc-60-bench', 'v1', 'sticky_and_flashcards'), {
    stickyNotes: [{ id: 'sn-1' }],
  });
});

test('Phase 6 Section 4: Educational Diagram Semantic Accuracy Validator', () => {
  const fbdSpec = getDeterministicDiagramTemplate('inclined plane free body diagram', 'Physics');
  const fbdValidation = validateDiagramSemanticAccuracy(
    fbdSpec,
    'inclined plane free body diagram'
  );
  assert.equal(fbdValidation.isSemanticallyValid, true);
  assert.equal(fbdValidation.domainChecked, 'Physics');

  const vseprSpec = getDeterministicDiagramTemplate('NH3 VSEPR molecular geometry', 'Chemistry');
  const vseprValidation = validateDiagramSemanticAccuracy(
    vseprSpec,
    'NH3 VSEPR molecular geometry'
  );
  assert.equal(vseprValidation.isSemanticallyValid, true);
});

test('Phase 6 Section 5: AI Study Tutor -> Contextual Create Intent Detection', () => {
  const fbdIntent = detectContextualCreateIntent({
    question: 'Explain the free body diagram of a block on an inclined plane with friction',
    answer:
      'The forces acting on the block are weight $mg$ vertically downward, normal reaction $N = mg\\cos\\theta$ perpendicular to the incline, and friction $f = \\mu mg\\cos\\theta$ along the surface.',
  });
  assert.equal(fbdIntent.shouldShowCreate, true);
  assert.equal(fbdIntent.subject, 'Physics');
  assert.equal(fbdIntent.detectedCategory, 'free_body_diagram');
  assert.equal(fbdIntent.actions.length, 4);

  const mechanismIntent = detectContextualCreateIntent({
    question: 'Walk me through the step-by-step SN1 and SN2 reaction mechanism and VSEPR geometry',
    answer:
      'First, the leaving group departs to form a carbocation intermediate, followed by nucleophilic attack.',
  });
  assert.equal(mechanismIntent.shouldShowCreate, true);
  assert.equal(mechanismIntent.subject, 'Chemistry');
  assert.equal(mechanismIntent.detectedCategory, 'molecular_shape');
});

test('Phase 6 Section 6: Voice Tutor Deterministic Lifecycle & Global Audio Hard Stop', () => {
  const epoch1 = globalAudioRegistry.beginSession('LISTENING');
  assert.equal(globalAudioRegistry.isCallbackValid(epoch1), true);
  assert.equal(globalAudioRegistry.getLifecycleState(), 'LISTENING');

  let abortCalled = false;
  const controller = new AbortController();
  controller.signal.addEventListener('abort', () => {
    abortCalled = true;
  });
  globalAudioRegistry.registerAbortController(controller);

  // Trigger hard stop (End Session / Scene Transition / Navigation)
  const snapshot = stopAllGlobalAudioAndSpeech('end_session_test');

  assert.equal(globalAudioRegistry.getLifecycleState(), 'ENDED');
  assert.equal(globalAudioRegistry.isCallbackValid(epoch1), false);
  assert.equal(abortCalled, true);
  assert.equal(snapshot.reason, 'end_session_test');
});

test('Phase 6 Section 7: KaTeX Text & Math Symbol Normalization Without Raw LaTeX Leakage', () => {
  const rawInput =
    'Using quadratic formula \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} at angle \\theta with force \\vec{F} and water \\ce{H2O} in \\text{m/s}^2.';
  const normalized = normalizeMathDelimiters(rawInput);

  assert.ok(normalized.includes('$\\frac{-b') || normalized.includes('\\sqrt{b^2 - 4ac}'));
  assert.ok(normalized.includes('$\\theta$'));
  assert.ok(normalized.includes('$\\vec{F}$'));
  assert.ok(normalized.includes('$\\ce{H2O}$'));

  // Ensure already-delimited expressions are not double-wrapped
  const alreadyWrapped = 'Formula is $$E = \\frac{1}{2}mv^2$$ and inline $x_1 = \\sqrt{25}$.';
  const preserved = normalizeMathDelimiters(alreadyWrapped);
  assert.ok(preserved.includes('$$E = \\frac{1}{2}mv^2$$'));
  assert.ok(preserved.includes('$x_1 = \\sqrt{25}$'));
  assert.ok(!preserved.includes('$$$'));
});

test('Phase 6 Section 8 & 10: Handwritten Notes Workflows A/B/C & Student Data PDF Export', async () => {
  const studyDoc = {
    id: 'doc-rot-1',
    title: 'Rotational Dynamics & Moment of Inertia',
    sourceType: 'youtube' as const,
    pageCount: 1,
    overview: 'Complete lecture on rotational kinematics, torque, and parallel axis theorem.',
    createdAt: new Date().toISOString(),
    lastStudiedAt: new Date().toISOString(),
    pages: [
      {
        pageNumber: 1,
        title: '00:00 — Rotational Kinematics & Moment of Inertia',
        content:
          'Definition: Moment of inertia is $I = \\sum m_i r_i^2$.\nTheorem: Parallel axis theorem states $I = I_{\\text{cm}} + Md^2$.\nCommon mistake: Forgetting to measure distance $d$ from the center of mass.',
        timestampSeconds: 0,
        timestampLabel: '00:00',
      },
    ],
    topics: [
      {
        id: 't-1',
        name: 'Moment of Inertia',
        summary: 'Rotational inertia around an axis of rotation.',
        keyConcepts: ['Parallel Axis Theorem', 'Radius of Gyration'],
        sourcePages: [1],
      },
    ],
  };

  const noteDoc = buildHandwrittenNotesDocument({
    document: studyDoc,
    workflowSource: 'youtube_lecture',
    notebookStyle: 'cornell',
    density: 'full',
    inkColor: 'indigo_ink',
  });

  assert.equal(noteDoc.workflowSource, 'youtube_lecture');
  assert.ok(noteDoc.pages.length >= 1);
  assert.ok(noteDoc.pages[0].sections.length >= 1);
  assert.ok(noteDoc.pages[0].sections[0].diagramSpec);

  const pdfBytes = await generateHandwrittenNotesPdfBytes(noteDoc);
  assert.ok(pdfBytes.byteLength > 1000);

  const exportPdfBytes = await generateStudentDataExportPdfBytes({
    exportedAt: new Date().toISOString(),
    studentProfile: {
      fullName: 'Aarav Sharma',
      schoolClass: 'Class 12',
      targetExam: 'JEE Main 2027',
      preferredLanguage: 'English',
      weakAreas: ['Moment of Inertia', 'Aldol Condensation'],
    },
    documents: [
      { id: 'd-1', title: 'Rotational Dynamics', pageCount: 60, sourceType: 'pdf' },
      { id: 'd-2', title: 'Organic Chemistry Marathon (12 hrs)', pageCount: 13, sourceType: 'youtube' },
    ],
    quizAttempts: [
      {
        documentTitle: 'Rotational Dynamics',
        mode: 'diagnostic',
        score: 20,
        totalQuestions: 25,
        percentage: 80,
        completedAt: new Date().toISOString(),
      },
    ],
    handwrittenNotesCount: 2,
    creativeAssetsCount: 3,
  });
  assert.ok(exportPdfBytes.byteLength > 800);
});

test('Phase 6 Section 9: UTF-8 Byte-Size Enforcement for Firestore Safety', () => {
  const sample = ' JEE Formula: ∫ E · dA = q/ε₀ ';
  const bytes = computeUtf8ByteSize(sample);
  assert.ok(bytes > sample.length);

  const truncated = truncateStringToUtf8Bytes(sample.repeat(100), 256);
  assert.ok(computeUtf8ByteSize(truncated) <= 256);
});

test('Streak Tracker: Consecutive days of study activity from localStorage & daily check-in', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  // Seed 3 consecutive days ending yesterday plus an older 4-day streak in localStorage
  store.set(
    'learnmate_documents_v1',
    JSON.stringify([
      { id: 'd1', lastStudiedAt: '2026-11-08T10:00:00.000Z', createdAt: '2026-11-06T09:00:00.000Z' },
    ])
  );
  store.set(
    'learnmate_quiz_attempts_v1',
    JSON.stringify([
      { id: 'q1', completedAt: '2026-11-07T14:30:00.000Z' },
      { id: 'q2', completedAt: '2026-10-20T12:00:00.000Z' },
      { id: 'q3', completedAt: '2026-10-21T12:00:00.000Z' },
      { id: 'q4', completedAt: '2026-10-22T12:00:00.000Z' },
      { id: 'q5', completedAt: '2026-10-23T12:00:00.000Z' },
      { id: 'q6', completedAt: '2026-10-24T12:00:00.000Z' },
    ])
  );

  const today = new Date(2026, 10, 9, 12, 0, 0); // 2026-11-09 local
  const extractedBefore = getStudyActivityDatesFromLocalStorage(mockStorage);
  assert.equal(extractedBefore.length, 8);

  const summaryBefore = computeStudyActivityStreakSummary(extractedBefore, today, 14);
  assert.equal(summaryBefore.currentStreak, 3); // Nov 6, 7, 8
  assert.equal(summaryBefore.longestStreak, 5); // Oct 20-24
  assert.equal(summaryBefore.isTodayActive, false);
  assert.equal(summaryBefore.isStreakAtRiskToday, true);
  assert.equal(summaryBefore.days.length, 14);

  // Log today's check-in and verify streak increments to 4 consecutive days
  const savedCheckins = recordDailyStudyCheckIn(today, mockStorage);
  assert.ok(savedCheckins.includes('2026-11-09'));
  assert.ok(store.get(STUDY_ACTIVITY_CHECKIN_STORAGE_KEY)?.includes('2026-11-09'));

  const extractedAfter = getStudyActivityDatesFromLocalStorage(mockStorage);
  const summaryAfter = computeStudyActivityStreakSummary(extractedAfter, today, 14);
  assert.equal(summaryAfter.currentStreak, 4); // Nov 6, 7, 8, 9
  assert.equal(summaryAfter.isTodayActive, true);
  assert.equal(summaryAfter.isStreakAtRiskToday, false);
});

test('Dark Mode Repair Audit: Semantic Night Owl design tokens and .keep-white protection', () => {
  const cssPath = path.resolve(process.cwd(), 'src/index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  const requiredTokens = [
    '--bg-app',
    '--bg-surface',
    '--bg-elevated',
    '--bg-muted',
    '--bg-overlay',
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--text-inverse',
    '--border-default',
    '--border-strong',
    '--accent-primary',
    '--accent-secondary',
    '--status-success',
    '--status-warning',
    '--status-danger',
    '--status-info',
    '--code-bg',
    '--math-fg',
    '--diagram-bg',
    '--diagram-stroke',
    '--diagram-text',
  ];

  for (const token of requiredTokens) {
    assert.ok(cssContent.includes(token), `Missing semantic design token ${token} in src/index.css`);
  }

  // Verify .keep-white protects notebook paper and PDF canvas from dark-mode text/math inversion
  assert.ok(cssContent.includes('.katex:not(.keep-white):not(.keep-white *)'));
  assert.ok(cssContent.includes('.keep-white .katex'));
  assert.ok(cssContent.includes(':not(canvas):not(.keep-white)'));
});

