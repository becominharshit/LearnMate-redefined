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
} from './educationalSpecsEngine';
import { serializeDiagramSpecToSvg } from './diagramEngine';

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

