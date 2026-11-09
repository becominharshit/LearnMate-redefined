import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectEducationalSubject,
  computeProjectileKinematics,
  computeQuadraticProperties,
  VERIFIED_VSEPR_MOLECULES,
  buildEducationalGameSpec,
  buildEducationalSceneSpec,
  buildMiniAppSpecFromPrompt,
  evaluateMiniAppFormulas,
  buildAnimatedExplanationScenes,
  validateAndSanitizeAnimatedExplanation,
  getSceneSpecForProgressiveStep,
  createInitialScenePlayerState,
  transitionScenePlayerState,
  normalizeAndGradeNumericalAnswer,
  buildDeterministicSceneConceptCheck,
  buildDeterministicSceneReteaching,
  getHighlightedDiagramSpecForReteaching,
  validateAndSanitizeConceptCheck,
  evaluateConceptCheckSubmission,
  createInitialSceneMasteryMap,
  skipSceneConceptCheck,
  integrateConceptCheckWithMistakeDna,
  computeLessonMasteryAndRecommendation,
  mergeConceptCheckAttempts,
  mergeSceneMasteryState,
  mergeTopicMasteryMaps,
} from './educationalSpecsEngine';
import { serializeDiagramSpecToSvg } from './diagramEngine';
import { gradeJeeExamAttempt } from './learnmate2Engine';
import { studyStorage } from '../services/storageService';
import { normalizePdfText } from './pdfGenerator';

test('detectEducationalSubject classifies Mathematics, Physics, Chemistry, Biology, and Programming topics accurately', () => {
  assert.equal(detectEducationalSubject('Projectile Motion & Kinematics'), 'Physics');
  assert.equal(detectEducationalSubject('VSEPR Molecular Geometry & Methane'), 'Chemistry');
  assert.equal(detectEducationalSubject('Eukaryotic Cell Organelles & Mitochondria'), 'Biology');
  assert.equal(detectEducationalSubject('Binary Search & Recursion Algorithms'), 'Programming');
  assert.equal(detectEducationalSubject('Conditional Probability & Bayes Theorem'), 'Mathematics');
});

test('computeProjectileKinematics computes exact range, max height, and flight time', () => {
  // v0 = 20 m/s, angle = 45 deg, g = 10 m/s^2 -> Range R = 400 * 1 / 10 = 40 m, H_max = 200 / 20 = 10 m
  const res = computeProjectileKinematics({ v0: 20, angleDeg: 45, gravity: 10 });
  assert.equal(res.rangeMeters, 40);
  assert.equal(res.maxHeightMeters, 10);
  assert.ok(res.trajectoryPoints.length > 10);
  assert.equal(res.trajectoryPoints[0].x, 0);
  assert.equal(res.trajectoryPoints[0].y, 0);
});

test('computeQuadraticProperties computes exact vertex, discriminant, and real roots', () => {
  // y = x^2 - 4x + 3 -> vertex (2, -1), discriminant = 16 - 12 = 4, roots = [1, 3]
  const quad = computeQuadraticProperties({ a: 1, b: -4, c: 3 });
  assert.equal(quad.discriminant, 4);
  assert.equal(quad.vertexX, 2);
  assert.equal(quad.vertexY, -1);
  assert.deepEqual(quad.realRoots, [1, 3]);
});

test('VERIFIED_VSEPR_MOLECULES contains scientifically accurate bond angles and geometries', () => {
  assert.equal(VERIFIED_VSEPR_MOLECULES.CH4.bondAngleDeg, 109.5);
  assert.equal(VERIFIED_VSEPR_MOLECULES.H2O.bondAngleDeg, 104.5);
  assert.equal(VERIFIED_VSEPR_MOLECULES.CO2.bondAngleDeg, 180.0);
  assert.equal(VERIFIED_VSEPR_MOLECULES.NH3.bondAngleDeg, 107.0);
});

test('buildEducationalGameSpec generates playable subject-specific games with matching pairs and rounds', () => {
  const physGame = buildEducationalGameSpec({ topic: 'Projectile Motion', subject: 'Physics' });
  assert.equal(physGame.subject, 'Physics');
  assert.equal(physGame.templateType, 'physics_projectile_challenge');
  assert.ok(physGame.matchingPairs.length >= 4);
  assert.ok(physGame.rounds.length >= 3);

  const chemGame = buildEducationalGameSpec({ topic: 'Chemical Equations', subject: 'Chemistry' });
  assert.equal(chemGame.subject, 'Chemistry');
  assert.ok(chemGame.rounds[0].prompt.includes('CH₄'));
});

test('buildEducationalSceneSpec creates parameter-controlled 3D/2D scene specs for all 4 lab categories', () => {
  const mathScene = buildEducationalSceneSpec({ topic: 'Quadratic Paraboloid', category: 'math_surface_3d' });
  assert.equal(mathScene.supports3D, true);
  assert.equal(mathScene.supports2DPlot, true);
  assert.ok(mathScene.parameterControls.length >= 3);

  const physScene = buildEducationalSceneSpec({ topic: 'Projectile Motion' });
  assert.equal(physScene.category, 'physics_projectile_3d');
  assert.ok(physScene.parameterControls.some((c) => c.id === 'v0'));
});

test('buildMiniAppSpecFromPrompt and evaluateMiniAppFormulas compute live student app outputs', () => {
  const projApp = buildMiniAppSpecFromPrompt({ promptOrTopic: 'Projectile Range Calculator' });
  assert.equal(projApp.templateId, 'projectile_kinematics');
  const evaluated = evaluateMiniAppFormulas(projApp, { v0: 20, angleDeg: 45, gravity: 10 });
  assert.equal(evaluated.rangeMeters.value, 40);
  assert.equal(evaluated.maxHeightMeters.value, 10);

  const bayesApp = buildMiniAppSpecFromPrompt({ promptOrTopic: 'Bayes Theorem Diagnostic Calculator' });
  assert.equal(bayesApp.templateId, 'bayes_posterior');
  const bayesEval = evaluateMiniAppFormulas(bayesApp, {
    priorPct: 1,
    sensitivityPct: 99,
    falsePositivePct: 5,
  });
  assert.equal(bayesEval.posteriorPct.value, 16.67);
});

test('Phase 5.2: buildAnimatedExplanationScenes creates 4-6 source-grounded scenes for Physics, Chemistry, and Mathematics with progressive diagram steps', () => {
  // 1. Physics (Inclined Plane FBD with source material pages)
  const physicsContext = `[Page 1]\nInclined plane mechanics: A block of mass m on a wedge of angle theta experiences gravity mg downward.\n[Page 2]\nFree-body diagram on the inclined plane: resolving weight into mg sin(theta) along the slope and mg cos(theta) normal to the slope with kinetic friction mu_k N.`;
  const physScenes = buildAnimatedExplanationScenes('Inclined Plane Free-Body Diagram', physicsContext, [1, 2], [1, 2]);
  assert.ok(physScenes.length >= 4 && physScenes.length <= 6);
  assert.equal(physScenes[0].spec.subject, 'Physics');
  assert.ok(physScenes[0].teachingPoint.length > 10);
  assert.ok(physScenes.some((s) => s.keyFormula.includes('mg')));
  assert.deepEqual(physScenes[0].citedPages, [1, 2]);
  assert.equal(physScenes[0].isSupportedByMaterial, true);
  assert.equal(physScenes[0].progressiveSteps.length, 3);
  // Progressive steps strictly increase visible elements up to full diagram
  const step0Spec = getSceneSpecForProgressiveStep(physScenes[0], 0);
  const step2Spec = getSceneSpecForProgressiveStep(physScenes[0], 2);
  assert.ok(step0Spec.elements.length >= 1);
  assert.ok(step2Spec.elements.length >= step0Spec.elements.length);
  assert.equal(step2Spec.elements.length, physScenes[0].spec.elements.length);
  const svgMarkup = serializeDiagramSpecToSvg(step2Spec, false);
  assert.ok(svgMarkup.includes('<svg'));

  // 2. Chemistry (VSEPR lone-pair repulsion when active document is Mathematics -> unsupported by uploaded pages)
  const mathOnlyContext = `[Page 1]\nConditional Probability P(A|B) = P(A and B)/P(B).\n[Page 2]\nBayes Theorem posterior probability calculation.`;
  const chemScenes = buildAnimatedExplanationScenes('VSEPR Geometry & Lone Pair Repulsion in H2O vs CH4', mathOnlyContext, [1, 2], [1, 2]);
  assert.ok(chemScenes.length >= 4 && chemScenes.length <= 6);
  assert.equal(chemScenes[0].spec.subject, 'Chemistry');
  assert.equal(chemScenes[0].animationMode, 'molecule_bonds');
  assert.deepEqual(chemScenes[0].citedPages, []);
  assert.equal(chemScenes[0].isSupportedByMaterial, false);
  assert.ok(chemScenes.some((s) => s.keyFormula.includes('104.5') || s.narration.includes('104.5')));

  // 3. Mathematics (Conditional Probability & Bayes Theorem grounded in the sample chapter)
  const mathScenes = buildAnimatedExplanationScenes('Conditional Probability & Bayes Theorem', mathOnlyContext, [1, 2], [1, 2]);
  assert.ok(mathScenes.length >= 4 && mathScenes.length <= 6);
  assert.equal(mathScenes[0].spec.subject, 'Mathematics');
  assert.deepEqual(mathScenes[0].citedPages, [1, 2]);
  assert.equal(mathScenes[0].isSupportedByMaterial, true);
  assert.ok(mathScenes.some((s) => s.keyFormula.includes('P(A | E)') || s.keyFormula.includes('P(E')));
});

test('Phase 5.2: validateAndSanitizeAnimatedExplanation sanitizes malformed AI output, strips XSS, filters hallucinated page citations, and enforces 4-6 scenes', () => {
  const sampleContext = `[Page 1]\nConditional probability P(A|B) and Bayes theorem.\n[Page 2]\nTree diagrams and total probability.`;

  // Case A: Completely malformed non-object or <4 scenes triggers verified fallback
  const fallbackResult = validateAndSanitizeAnimatedExplanation(
    { scenes: 'not-an-array' },
    {
      topic: 'Bayes Theorem',
      contextText: sampleContext,
      citedPages: [1, 2],
      validPageNumbers: [1, 2],
    }
  );
  assert.equal(fallbackResult.isFallback, true);
  assert.ok(fallbackResult.scenes.length >= 4 && fallbackResult.scenes.length <= 6);

  // Case B: 4-scene AI output with <script> tags, NaN coordinates, and hallucinated page 99
  const malformedFourScenesRaw = {
    topic: 'Bayes Theorem <script>alert(1)</script>',
    subject: 'Mathematics',
    scenes: [1, 2, 3, 4].map((num) => ({
      sceneNumber: num,
      heading: `Scene ${num} <script>evil()</script>`,
      teachingPoint: `Partition sample space step ${num}.`,
      narration: `Narration for step ${num} of Bayes theorem.`,
      keyFormula: 'P(B_1|A) = P(B_1)P(A|B_1)/P(A)',
      citedPages: [1, 99, -5],
      spec: {
        title: `Tree ${num} <script>`,
        category: 'scientific_diagram',
        viewBox: { width: 700, height: 420 },
        elements: [
          { id: 'n1', kind: 'circle', cx: 100, cy: 190, r: 14, label: 'Start <script>' },
          { id: 'n2', kind: 'arrow', startX: 114, startY: 190, endX: Number.NaN, endY: 120, label: 'P(B1)' },
          { id: 'n3', kind: 'arrow', startX: 114, startY: 190, endX: 280, endY: 260, label: 'P(B2)' },
          { id: 'n4', kind: 'rect', x: 300, y: 100, width: 140, height: 50, label: 'Posterior' },
        ],
      },
      progressiveSteps: [
        { stepNumber: 1, label: 'Root', description: 'Start node', visibleElementIds: ['n1', 'nonexistent_id'] },
        { stepNumber: 2, label: 'Branches', description: 'Prior branches', visibleElementIds: ['n1', 'n2'] },
        { stepNumber: 3, label: 'Full', description: 'All nodes', visibleElementIds: ['n1', 'n2', 'n3', 'n4'] },
      ],
    })),
  };

  const sanitized = validateAndSanitizeAnimatedExplanation(malformedFourScenesRaw, {
    topic: 'Bayes Theorem <script>alert(1)</script>',
    contextText: sampleContext,
    citedPages: [1, 2],
    validPageNumbers: [1, 2],
  });
  assert.equal(sanitized.valid, true);
  assert.equal(sanitized.isFallback, false);
  assert.equal(sanitized.scenes.length, 4);
  assert.ok(!sanitized.topic.includes('<script>'));
  assert.ok(!sanitized.scenes[0].heading.includes('<script>'));
  // Hallucinated page 99 and -5 must be stripped; only page 1 survives
  assert.deepEqual(sanitized.scenes[0].citedPages, [1]);
  // Progressive steps must end with all valid elements visible
  const validElementIdSet = new Set(sanitized.scenes[0].spec.elements.map((el) => el.id));
  assert.ok(
    sanitized.scenes[0].progressiveSteps.every((st) =>
      st.visibleElementIds.every((id) => validElementIdSet.has(id))
    )
  );
  assert.equal(
    sanitized.scenes[0].progressiveSteps[2].visibleElementIds.length,
    sanitized.scenes[0].spec.elements.length
  );
});

test('Phase 5.2: transitionScenePlayerState cancels narration on scene change, pause, mute, leaving Create, and closing player', () => {
  const scenes = buildAnimatedExplanationScenes('Projectile Motion in Physics');
  let cancelCallbacks = 0;
  const onCancel = () => {
    cancelCallbacks += 1;
  };

  let state = createInitialScenePlayerState();
  assert.equal(state.activeSceneIndex, 0);
  assert.equal(state.activeStepIndex, 0);
  assert.equal(state.isPlaying, false);

  // Start playing
  state = transitionScenePlayerState(state, { type: 'PLAY' }, onCancel);
  assert.equal(state.isPlaying, true);

  // Step forward within scene 0 does not change scene index
  state = transitionScenePlayerState(
    state,
    { type: 'NEXT_STEP', totalSteps: 3, totalScenes: scenes.length },
    onCancel
  );
  assert.equal(state.activeSceneIndex, 0);
  assert.equal(state.activeStepIndex, 1);

  // Changing to next scene cancels queued narration and resets progressive step to 0
  const beforeNextCancel = cancelCallbacks;
  state = transitionScenePlayerState(
    state,
    { type: 'NEXT_SCENE', totalScenes: scenes.length },
    onCancel
  );
  assert.equal(state.activeSceneIndex, 1);
  assert.equal(state.activeStepIndex, 0);
  assert.equal(cancelCallbacks, beforeNextCancel + 1);
  assert.equal(state.speechCancelCount, 1);

  // Muting while playing cancels speech immediately
  state = transitionScenePlayerState(state, { type: 'TOGGLE_MUTE' }, onCancel);
  assert.equal(state.isMuted, true);
  assert.equal(cancelCallbacks, beforeNextCancel + 2);

  // Leaving Create tab stops playback and cancels speech
  state = transitionScenePlayerState(state, { type: 'LEAVE_CREATE' }, onCancel);
  assert.equal(state.isPlaying, false);
  assert.equal(cancelCallbacks, beforeNextCancel + 3);

  // Closing player closes state and cancels speech
  state = transitionScenePlayerState(state, { type: 'CLOSE_PLAYER' }, onCancel);
  assert.equal(state.isOpen, false);
  assert.equal(state.isPlaying, false);
  assert.equal(cancelCallbacks, beforeNextCancel + 4);
});

// ============================================================================
// PHASE 5.3 — INTERACTIVE CONCEPT MASTERY & ADAPTIVE VISUAL LEARNING TESTS
// ============================================================================

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

test('Phase 5.3 (1 & 2): normalizeAndGradeNumericalAnswer normalizes decimals, fractions, scientific notation, and trailing units', () => {
  // Exact and tolerance decimals
  const dec = normalizeAndGradeNumericalAnswer('16.67%', 16.7, 0.25);
  assert.equal(dec.validInput, true);
  assert.equal(dec.isCorrect, true);
  assert.equal(dec.normalizedValue, 16.67);

  // Fractions like 1/6 for Bayes probability
  const frac = normalizeAndGradeNumericalAnswer('1/6', 0.167, 0.01);
  assert.equal(frac.validInput, true);
  assert.equal(frac.isCorrect, true);

  // Scientific notation like 1.6e-19 or 1.6 x 10^-19
  const sci1 = normalizeAndGradeNumericalAnswer('1.6e-19 C', 1.6e-19, 1e-21, ['C']);
  assert.equal(sci1.validInput, true);
  assert.equal(sci1.isCorrect, true);

  const sci2 = normalizeAndGradeNumericalAnswer('1.6 × 10^-19', 1.6e-19, 1e-21);
  assert.equal(sci2.validInput, true);
  assert.equal(sci2.isCorrect, true);

  // Trailing units like "10 N" or "104.5°"
  const units = normalizeAndGradeNumericalAnswer('10 N', 10, 0.2);
  assert.equal(units.validInput, true);
  assert.equal(units.isCorrect, true);

  // Out of tolerance wrong numerical answer
  const wrongNum = normalizeAndGradeNumericalAnswer('20 N', 10, 0.2);
  assert.equal(wrongNum.validInput, true);
  assert.equal(wrongNum.isCorrect, false);

  // Malformed non-numeric input
  const invalid = normalizeAndGradeNumericalAnswer('not-a-number', 10, 0.2);
  assert.equal(invalid.validInput, false);
  assert.equal(invalid.isCorrect, false);
});

test('Phase 5.3 (3, 5, 6): validateAndSanitizeConceptCheck rejects malformed/duplicate-option questions, strips XSS, and strips hallucinated PDF page citations', () => {
  const physScenes = buildAnimatedExplanationScenes(
    'Block on an Inclined Plane',
    '[Page 1]\nInclined plane normal reaction mg cos theta.',
    [1],
    [1, 2]
  );
  const scene0 = physScenes[0];

  // Case A: Duplicate options in MCQ -> rejected and replaced by deterministic verified check
  const duplicateOptionsRaw = {
    questionType: 'mcq',
    difficulty: 'standard',
    statement: 'What is the normal force on an incline of angle theta?',
    options: ['mg', 'mg', 'mg sin(theta)', '0'],
    correctIndex: 0,
    explanation: 'Duplicate options test explanation for validation.',
  };
  const rejectedDup = validateAndSanitizeConceptCheck(duplicateOptionsRaw, scene0, {
    topic: 'Block on an Inclined Plane',
    subject: 'Physics',
    validPageNumbers: [1, 2],
  });
  assert.equal(rejectedDup.isFallback, true);
  assert.equal(rejectedDup.valid, false);
  assert.equal(rejectedDup.question.provenance, 'deterministic_fallback');

  // Case B: Out-of-bounds correctIndex -> rejected and replaced by deterministic fallback
  const badIndexRaw = {
    questionType: 'mcq',
    difficulty: 'standard',
    statement: 'Which component balances the normal reaction N on an inclined plane?',
    options: ['mg', 'mg cos(theta)', 'mg sin(theta)', 'mg tan(theta)'],
    correctIndex: 9,
    explanation: 'mg cos(theta) balances N perpendicular to the incline.',
  };
  const rejectedIdx = validateAndSanitizeConceptCheck(badIndexRaw, scene0, {
    topic: 'Block on an Inclined Plane',
    subject: 'Physics',
    validPageNumbers: [1, 2],
  });
  assert.equal(rejectedIdx.isFallback, true);
  assert.equal(rejectedIdx.valid, false);

  // Case C: Valid AI MCQ with <script> tags and hallucinated page 88 -> sanitized and page 88 stripped
  const validButDirtyRaw = {
    questionType: 'mcq',
    difficulty: 'standard',
    statement:
      'On a smooth incline of angle θ, why is N = mg cos θ instead of mg? <script>alert(1)</script>',
    options: [
      'Because gravity acts perpendicular to the incline',
      'Because only the component of weight perpendicular to the incline presses into the surface <img onerror=evil()>',
      'Because friction cancels the rest of weight',
      'Because normal force is always zero on an incline',
    ],
    correctIndex: 1,
    explanation:
      'Only mg cos θ acts along the normal axis perpendicular to the surface. javascript:evil()',
    misconceptions: [
      {
        id: 'phys-inc-normal-equals-mg',
        distractorIndex: 0,
        misconceptionSummary: 'Assuming N = mg <script>',
        whyIncorrect: 'Gravity acts vertically downward, not perpendicular to the incline.',
        coreConceptFix: 'Resolve weight into mg cos θ perpendicular to the ramp.',
      },
    ],
  };
  const sanitized = validateAndSanitizeConceptCheck(validButDirtyRaw, scene0, {
    topic: 'Block on an Inclined Plane',
    subject: 'Physics',
    contextText: '[Page 1]\nInclined plane normal reaction mg cos theta.',
    citedPages: [1, 88, -3],
    validPageNumbers: [1, 2],
  });
  assert.equal(sanitized.isFallback, false);
  assert.equal(sanitized.valid, true);
  assert.ok(!sanitized.question.statement.includes('<script>'));
  assert.ok(!sanitized.question.options?.[1].includes('onerror'));
  assert.ok(!sanitized.question.explanation.includes('javascript:'));
  assert.deepEqual(sanitized.question.citedPages, [1]);
});

test('Phase 5.3 (4): Targeted Misconception Detection accurately identifies Physics, Chemistry, and Mathematics misconceptions', () => {
  // 1. Physics: Block on an Inclined Plane — student assumes normal reaction N = mg instead of mg cos(theta)
  const physScenes = buildAnimatedExplanationScenes(
    'Block on an Inclined Plane',
    '[Page 1]\nInclined plane normal reaction N = mg cos(theta).',
    [1],
    [1]
  );
  const physScene3 = physScenes[2]; // Scene 3: Normal equilibrium N = mg cos(theta)
  const physCheck = buildDeterministicSceneConceptCheck(physScene3, {
    topic: 'Block on an Inclined Plane',
    subject: 'Physics',
    difficulty: 'standard',
  });
  assert.equal(physCheck.questionType, 'mcq');
  assert.equal(physCheck.correctIndex, 0); // N = mg cos(theta) and f_s,max = mu_s mg cos(theta)

  // Student selects option 1 ("N = mg and f_s,max = mu_s mg")
  const physMastery0 = createInitialSceneMasteryMap(physScenes)[physScene3.sceneNumber];
  const physEvalWrong = evaluateConceptCheckSubmission({
    question: physCheck,
    previousSceneState: physMastery0,
    selectedOptionIndex: 1,
  });
  assert.equal(physEvalWrong.validSubmission, true);
  assert.equal(physEvalWrong.attemptRecord?.isCorrect, false);
  assert.equal(physEvalWrong.attemptRecord?.detectedMisconception?.id, 'phys-inc-normal-equals-mg');
  assert.ok(physEvalWrong.attemptRecord?.detectedMisconception?.summary.includes('mg cos θ'));
  assert.ok(physEvalWrong.attemptRecord?.detectedMisconception?.whyIncorrect.includes('mg cos θ'));

  // 2. Chemistry: VSEPR Theory — student assumes NH3 and CH4 have identical 109.5° bond angles because both have 4 electron domains
  const chemScenes = buildAnimatedExplanationScenes('VSEPR Theory & Molecular Geometry', '', [], []);
  const chemScene3 = chemScenes[2]; // Scene 3: CH4 (109.5°) vs NH3 (107.0°) vs H2O (104.5°)
  const chemCheck = buildDeterministicSceneConceptCheck(chemScene3, {
    topic: 'VSEPR Theory',
    subject: 'Chemistry',
    difficulty: 'standard',
  });
  assert.equal(chemCheck.questionType, 'mcq');
  assert.equal(chemCheck.correctIndex, 0);
  assert.equal(chemCheck.isSupportedByMaterial, false);
  assert.deepEqual(chemCheck.citedPages, []);

  // Student selects option 1 ("Correct — any molecule with 4 electron domains (sp³) always has an exact 109.5° bond angle regardless of lone pairs")
  const chemMastery0 = createInitialSceneMasteryMap(chemScenes)[chemScene3.sceneNumber];
  const chemEvalWrong = evaluateConceptCheckSubmission({
    question: chemCheck,
    previousSceneState: chemMastery0,
    selectedOptionIndex: 1,
  });
  assert.equal(chemEvalWrong.attemptRecord?.isCorrect, false);
  assert.equal(
    chemEvalWrong.attemptRecord?.detectedMisconception?.id,
    'chem-vsepr-nh3-ch4-identical-angles'
  );
  assert.ok(chemEvalWrong.attemptRecord?.detectedMisconception?.whyIncorrect.includes('107.0°'));

  // 3. Mathematics: Conditional Probability — student confuses P(A|B) with P(B|A)
  const mathScenes = buildAnimatedExplanationScenes(
    'Conditional Probability & Bayes Theorem',
    '[Page 1]\nConditional probability P(A|B).',
    [1],
    [1]
  );
  const mathScene2 = mathScenes[1]; // Scene 2: P(A|B) vs P(B|A)
  const mathCheck = buildDeterministicSceneConceptCheck(mathScene2, {
    topic: 'Conditional Probability',
    subject: 'Mathematics',
    difficulty: 'standard',
  });
  assert.equal(mathCheck.questionType, 'mcq');
  assert.equal(mathCheck.correctIndex, 0);

  // Student selects option 1 ("No error — P(A | B) is always equal to P(B | A) for conditional probabilities")
  const mathMastery0 = createInitialSceneMasteryMap(mathScenes)[mathScene2.sceneNumber];
  const mathEvalWrong = evaluateConceptCheckSubmission({
    question: mathCheck,
    previousSceneState: mathMastery0,
    selectedOptionIndex: 1,
  });
  assert.equal(mathEvalWrong.attemptRecord?.isCorrect, false);
  assert.equal(
    mathEvalWrong.attemptRecord?.detectedMisconception?.id,
    'math-prob-pab-vs-pba-confusion'
  );
  assert.ok(mathEvalWrong.attemptRecord?.detectedMisconception?.summary.includes('P(A | B)'));
});

test('Phase 5.3 (7 & 8): Retry flow, Adaptive Visual Reteaching state machine, diagram element highlighting, and skipped-question handling', () => {
  const physScenes = buildAnimatedExplanationScenes(
    'Block on an Inclined Plane',
    '[Page 1]\nInclined plane normal reaction.',
    [1],
    [1]
  );
  const scene = physScenes[2]; // Scene 3
  const initialMap = createInitialSceneMasteryMap(physScenes);
  let state = initialMap[scene.sceneNumber];

  // Skipping a concept check must NOT fabricate a correct attempt or positive mastery score
  const skippedState = skipSceneConceptCheck(state, scene.sceneNumber);
  assert.equal(skippedState.status, 'skipped');
  assert.equal(skippedState.attemptsCount, 0);
  assert.equal(skippedState.correctAttemptsCount, 0);
  assert.equal(skippedState.wrongAttemptsCount, 0);
  assert.equal(skippedState.skippedCount, 1);

  // 1st wrong answer -> status = 'in_progress', feedbackAction = 'targeted_explanation_and_replay', reteachingUnlocked = false
  const stdQuestion = scene.conceptCheck!;
  const eval1 = evaluateConceptCheckSubmission({
    question: stdQuestion,
    previousSceneState: state,
    selectedOptionIndex: 1, // Wrong option (N = mg)
  });
  state = eval1.nextSceneState;
  assert.equal(state.status, 'in_progress');
  assert.equal(eval1.feedbackAction, 'targeted_explanation_and_replay');
  assert.equal(state.reteachingUnlocked, false);
  assert.equal(state.wrongAttemptsCount, 1);

  // 2nd wrong answer -> status = 'needs_reteaching', feedbackAction = 'open_adaptive_visual_reteaching', reteachingUnlocked = true
  const eval2 = evaluateConceptCheckSubmission({
    question: stdQuestion,
    previousSceneState: state,
    selectedOptionIndex: 2, // Another wrong option (N = mg sin theta)
  });
  state = eval2.nextSceneState;
  assert.equal(state.status, 'needs_reteaching');
  assert.equal(eval2.feedbackAction, 'open_adaptive_visual_reteaching');
  assert.equal(state.reteachingUnlocked, true);
  assert.equal(state.wrongAttemptsCount, 2);

  // Adaptive Visual Reteaching highlights focus elements in the existing scene DiagramSpec
  const reteachingSpec =
    scene.reteaching ||
    buildDeterministicSceneReteaching(scene, {
      topic: 'Block on an Inclined Plane',
      subject: 'Physics',
    });
  const highlightedSpec = getHighlightedDiagramSpecForReteaching(
    scene.spec,
    reteachingSpec.highlightElementIds
  );
  assert.equal(highlightedSpec.elements.length, scene.spec.elements.length);
  assert.ok(
    highlightedSpec.elements.some(
      (el) => 'strokeWidth' in el && (el.strokeWidth ?? 0) >= 3.5
    )
  );

  // Student completes reteaching follow-up question correctly -> status = 'correct_after_retry', reteachingCompleted = true
  const eval3 = evaluateConceptCheckSubmission({
    question: reteachingSpec.followUpQuestion,
    previousSceneState: state,
    enteredNumericalText: '10 N', // m=2kg, g=10, theta=60 -> N = 20 * 0.5 = 10 N
  });
  state = eval3.nextSceneState;
  assert.equal(eval3.attemptRecord?.isCorrect, true);
  assert.equal(state.status, 'correct_after_retry');
  assert.equal(state.reteachingCompleted, true);
  assert.equal(eval3.feedbackAction, 'positive_advance_or_challenge');
});

test('Phase 5.3 (9): Mistake DNA & Revision Plan integration distinguishes single errors from repeated misconceptions and recovery', () => {
  const physScenes = buildAnimatedExplanationScenes(
    'Block on an Inclined Plane',
    '[Page 1]\nNormal reaction N = mg cos(theta).',
    [1],
    [1]
  );
  const scene = physScenes[2]; // Scene 3
  const initialMap = createInitialSceneMasteryMap(physScenes);
  let state = initialMap[scene.sceneNumber];

  // 1st wrong answer -> 'limited_single_error': does NOT create permanent MistakeInsight or weakAreas entry yet
  const eval1 = evaluateConceptCheckSubmission({
    question: scene.conceptCheck!,
    previousSceneState: state,
    selectedOptionIndex: 1,
    documentId: 'doc-phys-1',
  });
  state = eval1.nextSceneState;

  const dnaAfter1 = integrateConceptCheckWithMistakeDna({
    documentId: 'doc-phys-1',
    attempt: eval1.attemptRecord!,
    sceneState: state,
    existingMistakes: [],
    existingRevisionPlan: [],
    existingWeakAreas: [],
  });
  assert.equal(dnaAfter1.evidenceLevel, 'limited_single_error');
  assert.equal(dnaAfter1.updatedMistakes.length, 0);
  assert.equal(dnaAfter1.updatedWeakAreas.length, 0);
  assert.equal(dnaAfter1.mistakeDnaUpdated, false);

  // 2nd wrong answer -> 'repeated_misconception': upserts MistakeInsight, high-priority RevisionTask, and weakAreas
  const eval2 = evaluateConceptCheckSubmission({
    question: scene.conceptCheck!,
    previousSceneState: state,
    selectedOptionIndex: 1,
    documentId: 'doc-phys-1',
  });
  state = eval2.nextSceneState;

  const dnaAfter2 = integrateConceptCheckWithMistakeDna({
    documentId: 'doc-phys-1',
    attempt: eval2.attemptRecord!,
    sceneState: state,
    existingMistakes: dnaAfter1.updatedMistakes,
    existingRevisionPlan: dnaAfter1.updatedRevisionPlan,
    existingWeakAreas: dnaAfter1.updatedWeakAreas,
  });
  assert.equal(dnaAfter2.evidenceLevel, 'repeated_misconception');
  assert.equal(dnaAfter2.updatedMistakes.length, 1);
  assert.ok(dnaAfter2.updatedMistakes[0].likelyMisconception.includes('mg cos θ'));
  assert.equal(dnaAfter2.updatedRevisionPlan.length, 1);
  assert.equal(dnaAfter2.updatedRevisionPlan[0].priority, 'high');
  assert.ok(dnaAfter2.updatedWeakAreas.length >= 1);

  // Correct answer after reteaching -> 'recovered_after_reteaching': downgrades RevisionTask priority to 'medium'
  const eval3 = evaluateConceptCheckSubmission({
    question: scene.reteaching!.followUpQuestion,
    previousSceneState: state,
    enteredNumericalText: '10 N',
    documentId: 'doc-phys-1',
  });
  state = eval3.nextSceneState;

  const dnaAfterRecovery = integrateConceptCheckWithMistakeDna({
    documentId: 'doc-phys-1',
    attempt: eval3.attemptRecord!,
    sceneState: state,
    existingMistakes: dnaAfter2.updatedMistakes,
    existingRevisionPlan: dnaAfter2.updatedRevisionPlan,
    existingWeakAreas: dnaAfter2.updatedWeakAreas,
  });
  assert.equal(dnaAfterRecovery.evidenceLevel, 'recovered_after_reteaching');
  assert.equal(dnaAfterRecovery.updatedRevisionPlan[0].priority, 'medium');
});

test('Phase 5.3 (10, 11, 12, 13): Smart Next-Action Recommendations, storage persistence & account isolation, speech cancellation, and untouched JEE mock scoring', () => {
  const mathScenes = buildAnimatedExplanationScenes(
    'Conditional Probability & Bayes Theorem',
    '[Page 1]\nBayes theorem.',
    [1],
    [1]
  );
  const masteryMap = createInitialSceneMasteryMap(mathScenes);

  // 1. Unstarted lesson -> recommends starting concept check on Scene 1
  const summary0 = computeLessonMasteryAndRecommendation(mathScenes, masteryMap);
  assert.equal(summary0.evidenceScorePct, 0);
  assert.equal(summary0.overallStatus, 'unstarted');
  assert.equal(summary0.recommendedAction.kind, 'resume_scene');
  assert.equal(summary0.recommendedAction.targetSceneNumber, 1);

  // 2. Repeated error on Scene 2 -> recommends adaptive visual reteaching first + adaptive practice secondary
  const evalWrong1 = evaluateConceptCheckSubmission({
    question: mathScenes[1].conceptCheck!,
    previousSceneState: masteryMap[2],
    selectedOptionIndex: 1,
    documentId: 'doc-math-1',
  });
  const evalWrong2 = evaluateConceptCheckSubmission({
    question: mathScenes[1].conceptCheck!,
    previousSceneState: evalWrong1.nextSceneState,
    selectedOptionIndex: 1,
    documentId: 'doc-math-1',
  });
  masteryMap[2] = evalWrong2.nextSceneState;

  const summaryReteach = computeLessonMasteryAndRecommendation(mathScenes, masteryMap);
  assert.equal(summaryReteach.overallStatus, 'repeated_misunderstanding');
  assert.equal(summaryReteach.recommendedAction.kind, 'open_visual_reteaching');
  assert.equal(summaryReteach.recommendedAction.targetSceneNumber, 2);

  // 3. Persistence & Account Isolation via studyStorage
  studyStorage.clearAllProgress();
  const savedSync = studyStorage.saveConceptCheckAttempt(
    evalWrong2.attemptRecord!,
    evalWrong2.nextSceneState
  );
  assert.equal(savedSync.evidenceLevel, 'repeated_misconception');
  studyStorage.saveLessonMasteryState(
    'doc-math-1',
    'Conditional Probability & Bayes Theorem',
    masteryMap
  );

  const loadedAttempts = studyStorage.getConceptCheckAttempts('doc-math-1');
  assert.equal(loadedAttempts.length, 1);
  assert.equal(
    loadedAttempts[0].detectedMisconception?.id,
    'math-prob-pab-vs-pba-confusion'
  );

  const loadedMastery = studyStorage.getLessonMasteryState(
    'doc-math-1',
    'Conditional Probability & Bayes Theorem'
  );
  assert.equal(loadedMastery?.[2].status, 'needs_reteaching');

  // Clearing progress on sign-out/account switch isolates student state completely
  studyStorage.clearAllProgress();
  const afterClearAttempts = studyStorage.getConceptCheckAttempts('doc-math-1');
  assert.equal(afterClearAttempts.length, 0);
  const afterClearMastery = studyStorage.getLessonMasteryState(
    'doc-math-1',
    'Conditional Probability & Bayes Theorem'
  );
  assert.equal(afterClearMastery, null);

  // 4. Speech synthesis cancellation on OPEN_CONCEPT_CHECK, START_RETEACHING, and REPLAY_SCENE
  let speechCancels = 0;
  let playerState = createInitialScenePlayerState();
  playerState = transitionScenePlayerState(playerState, { type: 'PLAY' });
  assert.equal(playerState.isPlaying, true);

  playerState = transitionScenePlayerState(playerState, { type: 'OPEN_CONCEPT_CHECK' }, () => {
    speechCancels += 1;
  });
  assert.equal(playerState.isPlaying, false);
  assert.equal(speechCancels, 1);

  playerState = transitionScenePlayerState(playerState, { type: 'START_RETEACHING' }, () => {
    speechCancels += 1;
  });
  assert.equal(speechCancels, 2);

  playerState = transitionScenePlayerState(playerState, { type: 'REPLAY_SCENE' }, () => {
    speechCancels += 1;
  });
  assert.equal(playerState.activeStepIndex, 0);
  assert.equal(speechCancels, 3);

  // 5. Official JEE Main mock-test scoring (+4 / -1 / 0) remains 100% untouched
  const mockGrade = gradeJeeExamAttempt({
    questions: [
      {
        id: 'q1',
        topic: 'Kinematics',
        question: 'Q1',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
        explanation: 'Exp',
        difficulty: 'medium',
        sourcePage: 1,
        sourceQuote: 'Quote',
      },
      {
        id: 'q2',
        topic: 'Bonding',
        question: 'Q2',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        explanation: 'Exp',
        difficulty: 'medium',
        sourcePage: 1,
        sourceQuote: 'Quote',
      },
      {
        id: 'q3',
        topic: 'Probability',
        question: 'Q3',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 2,
        explanation: 'Exp',
        difficulty: 'hard',
        sourcePage: 1,
        sourceQuote: 'Quote',
      },
    ],
    statesByQuestionId: {
      q1: { questionId: 'q1', visited: true, selectedIndex: 1, markedForReview: false }, // +4
      q2: { questionId: 'q2', visited: true, selectedIndex: 2, markedForReview: false }, // -1
      q3: { questionId: 'q3', visited: true, selectedIndex: null, markedForReview: false }, // 0
    },
  });
  assert.equal(mockGrade.totalMarks, 3);
  assert.equal(mockGrade.correctCount, 1);
  assert.equal(mockGrade.wrongCount, 1);
  assert.equal(mockGrade.unattemptedCount, 1);
});

test('Phase 5.4 Priority 3: normalizeAndGradeNumericalAnswer enforces strict physical unit compatibility and rejects dimensionally incompatible units', () => {
  // Compatible units for Force (N, newtons, kg m/s^2) are accepted
  const forceN = normalizeAndGradeNumericalAnswer('20 N', 20, 0.5, ['N', 'newtons']);
  assert.equal(forceN.validInput, true);
  assert.equal(forceN.isCorrect, true);

  const forceKgMs2 = normalizeAndGradeNumericalAnswer('20 kg m/s^2', 20, 0.5, ['N', 'newtons']);
  assert.equal(forceKgMs2.validInput, true);
  assert.equal(forceKgMs2.isCorrect, true);

  // Dimensionally incompatible units (m/s, kg, km/h) when expecting Force (N) are rejected
  const wrongUnitVelocity = normalizeAndGradeNumericalAnswer('20 m/s', 20, 0.5, ['N', 'newtons']);
  assert.equal(wrongUnitVelocity.validInput, false);
  assert.equal(wrongUnitVelocity.isCorrect, false);
  assert.match(wrongUnitVelocity.errorReason || '', /Incompatible physical unit/i);

  const wrongUnitMass = normalizeAndGradeNumericalAnswer('20 kg', 20, 0.5, ['N']);
  assert.equal(wrongUnitMass.validInput, false);
  assert.equal(wrongUnitMass.isCorrect, false);

  // Unscaled unit mismatch (km/h vs m/s) is rejected
  const unscaledVelocity = normalizeAndGradeNumericalAnswer('10 km/h', 10, 0.2, ['m/s']);
  assert.equal(unscaledVelocity.validInput, false);
  assert.equal(unscaledVelocity.isCorrect, false);
  assert.match(unscaledVelocity.errorReason || '', /Incompatible physical unit/i);

  // Angle unit mismatch (rad vs deg/°) is rejected
  const wrongAngleUnit = normalizeAndGradeNumericalAnswer('104.5 rad', 104.5, 0.2, ['deg', '°']);
  assert.equal(wrongAngleUnit.validInput, false);
  assert.equal(wrongAngleUnit.isCorrect, false);
});

test('Phase 5.4 Priority 1: Deterministic cloud merge & deduplication for concept-check attempts and scene mastery state', () => {
  const baseAttempt = {
    attemptId: 'att-sync-1',
    studentUid: 'local-student',
    documentId: 'doc-phys-1',
    documentTitle: 'Kinematics.pdf',
    topic: 'Block on Inclined Plane',
    subject: 'Physics' as const,
    sceneNumber: 1,
    teachingPoint: 'Rotate axes parallel and normal to incline',
    questionId: 'cc-phys-incline-s1-standard',
    questionType: 'mcq' as const,
    difficulty: 'standard' as const,
    provenance: 'deterministic_fallback' as const,
    selectedOptionIndex: 1,
    selectedOptionText: 'N acts vertically upward',
    correctAnswerDisplay: 'a_y = 0 along normal',
    isCorrect: false,
    skipped: false,
    attemptNumberForScene: 1,
    triggeredReteaching: false,
    completedReteaching: false,
    citedPages: [1],
    isSupportedByMaterial: true,
    timestamp: '2026-11-08T10:00:00.000Z',
  };

  const duplicateOlder = { ...baseAttempt, timestamp: '2026-11-08T09:59:00.000Z' };
  const foreignUserAttempt = {
    ...baseAttempt,
    attemptId: 'att-foreign-99',
    studentUid: 'other-student-uid',
    timestamp: '2026-11-08T10:05:00.000Z',
  };
  const secondValidAttempt = {
    ...baseAttempt,
    attemptId: 'att-sync-2',
    studentUid: 'alice-uid',
    isCorrect: true,
    attemptNumberForScene: 2,
    completedReteaching: true,
    timestamp: '2026-11-08T10:02:00.000Z',
  };

  const mergedAttempts = mergeConceptCheckAttempts(
    [baseAttempt, foreignUserAttempt],
    [duplicateOlder, secondValidAttempt],
    'alice-uid'
  );

  // Deduplicates att-sync-1, migrates 'local-student' -> 'alice-uid', rejects 'other-student-uid', orders newest first
  assert.equal(mergedAttempts.length, 2);
  assert.equal(mergedAttempts[0].attemptId, 'att-sync-2');
  assert.equal(mergedAttempts[1].attemptId, 'att-sync-1');
  assert.equal(mergedAttempts[1].studentUid, 'alice-uid');
  assert.equal(mergedAttempts[1].timestamp, '2026-11-08T10:00:00.000Z');

  // Merge scene mastery maps across devices without losing verified progress or misconception history
  const localSceneMap = {
    1: {
      sceneNumber: 1,
      status: 'needs_reteaching' as const,
      attemptsCount: 2,
      wrongAttemptsCount: 2,
      correctAttemptsCount: 0,
      skippedCount: 0,
      activeVariant: 'reteach' as const,
      reteachingUnlocked: true,
      reteachingCompleted: false,
      lastAttempt: baseAttempt,
    },
  };
  const cloudSceneMap = {
    1: {
      sceneNumber: 1,
      status: 'correct_after_retry' as const,
      attemptsCount: 3,
      wrongAttemptsCount: 2,
      correctAttemptsCount: 1,
      skippedCount: 0,
      activeVariant: 'reteach' as const,
      reteachingUnlocked: true,
      reteachingCompleted: true,
      lastAttempt: secondValidAttempt,
    },
  };

  const mergedTopicMap = mergeTopicMasteryMaps(
    { 'block-on-inclined-plane': localSceneMap },
    { 'block-on-inclined-plane': cloudSceneMap }
  );
  const mergedScene1 = mergedTopicMap['block-on-inclined-plane'][1];
  assert.equal(mergedScene1.status, 'correct_after_retry');
  assert.equal(mergedScene1.attemptsCount, 3);
  assert.equal(mergedScene1.wrongAttemptsCount, 2);
  assert.equal(mergedScene1.correctAttemptsCount, 1);
  assert.equal(mergedScene1.reteachingCompleted, true);
});

test('Phase 5.4 Priority 1: Non-destructive multi-student account session isolation (Student A vs Student B vs Signed-Out)', () => {
  studyStorage.clearAllProgress();
  studyStorage.switchLocalAccountSession('student-alice');

  const physicsScenes = buildAnimatedExplanationScenes(
    'Block on an Inclined Plane with Gravity mg, Normal Reaction N, and Friction',
    '[Page 1]\nN = mg cos theta.',
    [1],
    [1]
  );
  const aliceMastery = createInitialSceneMasteryMap(physicsScenes);
  const aliceEval = evaluateConceptCheckSubmission({
    question: physicsScenes[0].conceptCheck!,
    previousSceneState: aliceMastery[1],
    selectedOptionIndex: 0,
    documentId: 'doc-alice-1',
  });
  aliceMastery[1] = aliceEval.nextSceneState;

  studyStorage.saveConceptCheckAttempt(aliceEval.attemptRecord!, aliceEval.nextSceneState);
  studyStorage.saveLessonMasteryState('doc-alice-1', 'Inclined Plane', aliceMastery);
  studyStorage.saveCreativeAsset({
    id: 'asset-alice-1',
    type: 'video_lesson',
    title: 'Alice Inclined Plane Walkthrough',
    topic: 'Inclined Plane',
    difficulty: 'medium',
    documentId: 'doc-alice-1',
    createdAt: '2026-11-08T10:00:00.000Z',
    payload: { scenes: physicsScenes },
  });

  assert.equal(studyStorage.getConceptCheckAttempts('doc-alice-1').length, 1);
  assert.equal(studyStorage.getCreativeAssets('doc-alice-1').length, 1);

  // Switch to Student Bob -> Alice's records are completely hidden and isolated
  studyStorage.switchLocalAccountSession('student-bob');
  assert.equal(studyStorage.getConceptCheckAttempts('doc-alice-1').length, 0);
  assert.equal(studyStorage.getLessonMasteryState('doc-alice-1', 'Inclined Plane'), null);
  assert.equal(studyStorage.getCreativeAssets('doc-alice-1').length, 0);

  // Student Bob saves his own asset
  studyStorage.saveCreativeAsset({
    id: 'asset-bob-1',
    type: 'visual_diagram',
    title: 'Bob VSEPR Diagram',
    topic: 'VSEPR',
    difficulty: 'medium',
    documentId: 'doc-bob-1',
    createdAt: '2026-11-08T10:05:00.000Z',
    payload: {},
  });
  assert.equal(studyStorage.getCreativeAssets('doc-bob-1').length, 1);

  // Sign out to guest (null) -> Neither Alice's nor Bob's private data is exposed
  studyStorage.switchLocalAccountSession(null);
  assert.equal(studyStorage.getConceptCheckAttempts('doc-alice-1').length, 0);
  assert.equal(studyStorage.getCreativeAssets('doc-alice-1').length, 0);
  assert.equal(studyStorage.getCreativeAssets('doc-bob-1').length, 0);

  // Switch back to Student Alice -> Alice's local progress and saved assets are non-destructively restored!
  studyStorage.switchLocalAccountSession('student-alice');
  assert.equal(studyStorage.getConceptCheckAttempts('doc-alice-1').length, 1);
  assert.equal(
    studyStorage.getLessonMasteryState('doc-alice-1', 'Inclined Plane')?.[1].status,
    'correct_first_try'
  );
  assert.equal(studyStorage.getCreativeAssets('doc-alice-1').length, 1);
  assert.equal(studyStorage.getCreativeAssets('doc-bob-1').length, 0);

  // Clean up test session
  studyStorage.clearAllProgress();
  studyStorage.switchLocalAccountSession(null);
});

test('Phase 5.4 PDF Generator: normalizePdfText strips raw LaTeX delimiters and converts math macros cleanly', () => {
  const rawFormula = 'Torque $\\tau = I \\alpha$ and range $R = \\frac{u^2 \\sin 2\\theta}{g}$ with $\\sqrt{2gh}$';
  const cleaned = normalizePdfText(rawFormula);
  assert.equal(cleaned.includes('$'), false);
  assert.equal(cleaned.includes('\\frac'), false);
  assert.equal(cleaned.includes('\\tau'), false);
  assert.match(cleaned, /tau = I alpha/);
  assert.match(cleaned, /\(u\^2 \\?sin 2theta\)\/\(g\)/);
  assert.match(cleaned, /sqrt\(2gh\)/);
});



