/**
 * Pure, deterministic Educational Specifications Engine for LearnMate 2.0 Creative Studio:
 * - PlayLab 2D Educational Games (EducationalGameSpec)
 * - Concept 3D Lab & 2D Mathematical/Physics Simulators (EducationalSceneSpec)
 * - No-Code Student Mini App Builder & Safe Formula Evaluator (MiniAppSpec)
 * - Deterministic Animated Explanation Specs for Video Lessons (AnimatedExplanationSpec)
 */

import type { DiagramElement, StructuredDiagramSpec } from '../types/diagram';
import type { MistakeInsight, RevisionTask } from '../types/study';
import {
  clampNumber,
  getDeterministicDiagramTemplate,
  sanitizeString,
  validateAndSanitizeDiagramSpec,
} from './diagramEngine';


export type EducationalSubject =
  | 'Mathematics'
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'Programming';

export type GameTemplateType =
  | 'math_graph_and_formula'
  | 'physics_projectile_challenge'
  | 'chemistry_equation_and_vsepr'
  | 'biology_organelle_and_sequence'
  | 'programming_code_trace';

export interface EducationalGameRound {
  id: string;
  prompt: string;
  visualHint: string;
  formulaOrCode: string;
  options: [string, string, string, string];
  correctIndex: number;
  hint: string;
  stepByStepExplanation: string;
  targetParams?: {
    targetRangeMeters?: number;
    gravity?: number;
    quadA?: number;
    quadB?: number;
    quadC?: number;
  };
}

export interface EducationalGameSpec {
  id: string;
  title: string;
  subject: EducationalSubject;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  templateType: GameTemplateType;
  learningObjective: string;
  instructions: string;
  scoringRule: string;
  matchingPairs: Array<{
    id: string;
    term: string;
    match: string;
    category: string;
  }>;
  rounds: EducationalGameRound[];
}

export type SceneCategory =
  | 'math_surface_3d'
  | 'physics_projectile_3d'
  | 'chemistry_vsepr_3d'
  | 'biology_cell_3d'
  | 'custom_ai_3d';

export interface SceneParameterControl {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface SceneObjectLabel {
  id: string;
  title: string;
  formulaOrAngle: string;
  description: string;
  color: string;
  position3D: [number, number, number];
}

export interface EducationalSceneSpec {
  id: string;
  title: string;
  subject: EducationalSubject;
  topic: string;
  category: SceneCategory;
  supports3D: boolean;
  supports2DPlot: boolean;
  summary: string;
  governingEquations: string[];
  parameterControls: SceneParameterControl[];
  labels: SceneObjectLabel[];
  learningNotes: string[];
}

export interface MiniAppInputField {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface MiniAppFormulaOutput {
  id: string;
  label: string;
  unit: string;
  expression: string;
  description: string;
}

export interface MiniAppQuizItem {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface MiniAppPlannerItem {
  id: string;
  task: string;
  minutes: number;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

export interface MiniAppSpec {
  id: string;
  title: string;
  subtitle: string;
  subject: EducationalSubject;
  topic: string;
  templateId:
    | 'projectile_kinematics'
    | 'quadratic_solver'
    | 'bayes_posterior'
    | 'chapter_quiz_app'
    | 'revision_planner_app';
  accentColor: '#1A73E8' | '#34A853' | '#EA4335' | '#D97706' | '#7C3AED';
  inputs: MiniAppInputField[];
  outputs: MiniAppFormulaOutput[];
  quizItems: MiniAppQuizItem[];
  plannerItems: MiniAppPlannerItem[];
  studyTakeaway: string;
}

export interface AnimatedDiagramStep {
  stepNumber: number;
  label: string;
  description: string;
  visibleElementIds: string[];
}

export type ConceptCheckQuestionType = 'mcq' | 'numerical';
export type ConceptCheckDifficulty = 'standard' | 'reteach' | 'challenge';

export interface ConceptMisconceptionRule {
  id: string;
  distractorIndex?: number;
  wrongNumericalTarget?: number;
  wrongNumericalTolerance?: number;
  misconceptionSummary: string;
  whyIncorrect: string;
  coreConceptFix: string;
  highlightElementIds?: string[];
}

export interface SceneConceptCheckQuestion {
  id: string;
  sceneNumber: number;
  topic: string;
  subject: EducationalSubject;
  teachingPoint: string;
  questionType: ConceptCheckQuestionType;
  difficulty: ConceptCheckDifficulty;
  statement: string;
  options?: [string, string, string, string];
  correctIndex?: number;
  numericalAnswer?: number;
  numericalTolerance?: number;
  acceptedUnits?: string[];
  unitHint?: string;
  explanation: string;
  keyFormula: string;
  misconceptions: ConceptMisconceptionRule[];
  citedPages: number[];
  isSupportedByMaterial: boolean;
  sourceDocumentTitle?: string;
  provenance: 'ai_grounded' | 'deterministic_fallback';
}

export interface SceneReteachingSpec {
  sceneNumber: number;
  teachingPoint: string;
  alternativeExplanation: string;
  stepByStepBreakdown: string[];
  highlightElementIds: string[];
  keyFormula: string;
  followUpQuestion: SceneConceptCheckQuestion;
}

export interface ConceptCheckAttemptRecord {
  attemptId: string;
  studentUid: string;
  documentId: string;
  documentTitle: string;
  topic: string;
  subject: EducationalSubject;
  sceneNumber: number;
  teachingPoint: string;
  questionId: string;
  questionType: ConceptCheckQuestionType;
  provenance: 'ai_grounded' | 'deterministic_fallback';
  selectedOptionIndex?: number;
  selectedOptionText?: string;
  enteredNumericalText?: string;
  normalizedNumericalValue?: number | null;
  correctAnswerDisplay: string;
  isCorrect: boolean;
  skipped: boolean;
  attemptNumberForScene: number;
  detectedMisconception?: {
    id: string;
    summary: string;
    whyIncorrect: string;
    coreConceptFix: string;
    highlightElementIds?: string[];
  } | null;
  triggeredReteaching: boolean;
  completedReteaching: boolean;
  citedPages: number[];
  isSupportedByMaterial: boolean;
  timestamp: string;
}

export type SceneMasteryStatus =
  | 'unseen'
  | 'in_progress'
  | 'skipped'
  | 'correct_first_try'
  | 'correct_after_retry'
  | 'needs_reteaching'
  | 'struggling';

export interface SceneConceptMasteryState {
  sceneNumber: number;
  status: SceneMasteryStatus;
  attemptsCount: number;
  wrongAttemptsCount: number;
  correctAttemptsCount: number;
  skippedCount: number;
  activeVariant: ConceptCheckDifficulty;
  reteachingUnlocked: boolean;
  reteachingCompleted: boolean;
  lastAttempt?: ConceptCheckAttemptRecord | null;
}

export interface RecommendedNextAction {
  kind:
    | 'continue_next_scene'
    | 'try_challenge'
    | 'review_and_retry_scene'
    | 'open_visual_reteaching'
    | 'adaptive_practice'
    | 'quick_revise'
    | 'resume_scene';
  label: string;
  targetSceneNumber?: number;
  targetTab?: 'practice' | 'revision' | 'study';
}

export interface LessonMasterySummary {
  totalScenes: number;
  attemptedScenes: number;
  verifiedScenes: number;
  firstTryCorrectScenes: number;
  retryCorrectScenes: number;
  strugglingScenes: number[];
  skippedScenes: number[];
  uncompletedScenes: number[];
  checkpointCompletionPct: number;
  evidenceScorePct: number;
  estimatedConceptReadinessLabel: string;
  overallStatus:
    | 'unstarted'
    | 'incomplete'
    | 'strong'
    | 'some_errors'
    | 'repeated_misunderstanding';
  headline: string;
  rationale: string;
  recommendedAction: RecommendedNextAction;
  secondaryAction?: RecommendedNextAction;
}

export interface AnimatedExplanationScene {
  sceneNumber: number;
  durationSeconds: number;
  heading: string;
  teachingPoint: string;
  narration: string;
  visualCue: string;
  keyFormula: string;
  animationMode: 'projectile_arc' | 'quadratic_curve' | 'probability_tree' | 'molecule_bonds';
  highlightValues: string[];
  citedPages: number[];
  isSupportedByMaterial: boolean;
  spec: StructuredDiagramSpec;
  progressiveSteps: AnimatedDiagramStep[];
  conceptCheck?: SceneConceptCheckQuestion;
  reteaching?: SceneReteachingSpec;
}

export interface ValidatedAnimatedExplanationResult {
  valid: boolean;
  isFallback: boolean;
  topic: string;
  subject: EducationalSubject;
  scenes: AnimatedExplanationScene[];
  citedPages: number[];
  isSupportedByMaterial: boolean;
  warnings: string[];
}

export interface ScenePlayerState {
  isOpen: boolean;
  activeSceneIndex: number;
  activeStepIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
  speechCancelCount: number;
}

export type ScenePlayerAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'NEXT_SCENE'; totalScenes: number }
  | { type: 'PREV_SCENE'; totalScenes: number }
  | { type: 'SELECT_SCENE'; sceneIndex: number; totalScenes: number }
  | { type: 'NEXT_STEP'; totalSteps: number; totalScenes: number; autoAdvanceScene?: boolean }
  | { type: 'PREV_STEP'; totalSteps: number }
  | { type: 'SELECT_STEP'; stepIndex: number; totalSteps: number }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'OPEN_CONCEPT_CHECK' }
  | { type: 'START_RETEACHING'; totalSteps?: number }
  | { type: 'REPLAY_SCENE' }
  | { type: 'CLOSE_PLAYER' }
  | { type: 'LEAVE_CREATE' };

/**
 * Classifies a study topic or document title into one of the 5 core STEM subjects.
 */
export function detectEducationalSubject(topicOrTitle: string): EducationalSubject {
  const lower = (topicOrTitle || '').toLowerCase();
  if (
    lower.includes('projectile') ||
    lower.includes('kinematic') ||
    lower.includes('velocity') ||
    lower.includes('pendulum') ||
    lower.includes('newton') ||
    lower.includes('force') ||
    lower.includes('incline') ||
    lower.includes('wedge') ||
    lower.includes('friction') ||
    lower.includes('free-body') ||
    lower.includes('free body') ||
    lower.includes('fbd') ||
    lower.includes('gravity') ||
    lower.includes('mechanics') ||
    lower.includes('optic') ||
    lower.includes('circuit') ||
    lower.includes('physics')
  ) {
    return 'Physics';
  }
  if (
    lower.includes('molecule') ||
    lower.includes('vsepr') ||
    lower.includes('bond') ||
    lower.includes('stoichiometr') ||
    lower.includes('methane') ||
    lower.includes('periodic') ||
    lower.includes('acid') ||
    lower.includes('chemistry') ||
    lower.includes('chemical')
  ) {
    return 'Chemistry';
  }
  if (
    lower.includes('cell') ||
    lower.includes('organelle') ||
    lower.includes('mitochondr') ||
    lower.includes('dna') ||
    lower.includes('photosynthe') ||
    lower.includes('genetics') ||
    lower.includes('biology')
  ) {
    return 'Biology';
  }
  if (
    lower.includes('algorithm') ||
    lower.includes('recursion') ||
    lower.includes('array') ||
    lower.includes('binary search') ||
    lower.includes('python') ||
    lower.includes('javascript') ||
    lower.includes('code') ||
    lower.includes('programming')
  ) {
    return 'Programming';
  }
  return 'Mathematics';
}

/**
 * Computes exact projectile motion kinematics for Physics 3D/2D Lab & PlayLab games.
 */
export function computeProjectileKinematics(params: {
  v0: number;
  angleDeg: number;
  gravity: number;
}): {
  vx: number;
  vy0: number;
  flightTimeSeconds: number;
  rangeMeters: number;
  maxHeightMeters: number;
  trajectoryPoints: Array<{ t: number; x: number; y: number }>;
} {
  const v0 = Math.max(1, Math.min(150, Number(params.v0) || 25));
  const angleDeg = Math.max(5, Math.min(85, Number(params.angleDeg) || 45));
  const g = Math.max(1.6, Math.min(25, Number(params.gravity) || 9.8));

  const thetaRad = (angleDeg * Math.PI) / 180;
  const vx = v0 * Math.cos(thetaRad);
  const vy0 = v0 * Math.sin(thetaRad);
  const flightTimeSeconds = (2 * vy0) / g;
  const rangeMeters = (v0 * v0 * Math.sin(2 * thetaRad)) / g;
  const maxHeightMeters = (vy0 * vy0) / (2 * g);

  const steps = 40;
  const trajectoryPoints: Array<{ t: number; x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = (flightTimeSeconds * i) / steps;
    const x = vx * t;
    const y = Math.max(0, vy0 * t - 0.5 * g * t * t);
    trajectoryPoints.push({
      t: Number(t.toFixed(3)),
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    });
  }

  return {
    vx: Number(vx.toFixed(2)),
    vy0: Number(vy0.toFixed(2)),
    flightTimeSeconds: Number(flightTimeSeconds.toFixed(2)),
    rangeMeters: Number(rangeMeters.toFixed(2)),
    maxHeightMeters: Number(maxHeightMeters.toFixed(2)),
    trajectoryPoints,
  };
}

/**
 * Computes exact quadratic properties for y = a*x^2 + b*x + c.
 */
export function computeQuadraticProperties(params: {
  a: number;
  b: number;
  c: number;
}): {
  a: number;
  b: number;
  c: number;
  discriminant: number;
  vertexX: number;
  vertexY: number;
  realRoots: number[];
  rootsDescription: string;
  sampledPoints: Array<{ x: number; y: number }>;
} {
  const a = Math.abs(params.a) < 0.05 ? (params.a < 0 ? -0.5 : 1) : params.a;
  const b = Number(params.b) || 0;
  const c = Number(params.c) || 0;

  const discriminant = b * b - 4 * a * c;
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;

  let realRoots: number[] = [];
  let rootsDescription = 'No real roots (complex conjugate pair)';
  if (Math.abs(discriminant) < 1e-6) {
    realRoots = [Number(vertexX.toFixed(2))];
    rootsDescription = `One repeated real root at x = ${vertexX.toFixed(2)}`;
  } else if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    const r1 = (-b - sqrtD) / (2 * a);
    const r2 = (-b + sqrtD) / (2 * a);
    realRoots = [Number(Math.min(r1, r2).toFixed(2)), Number(Math.max(r1, r2).toFixed(2))];
    rootsDescription = `Two distinct real roots: x₁ = ${realRoots[0]}, x₂ = ${realRoots[1]}`;
  }

  const sampledPoints: Array<{ x: number; y: number }> = [];
  for (let x = -5; x <= 5; x += 0.25) {
    const y = a * x * x + b * x + c;
    sampledPoints.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  }

  return {
    a,
    b,
    c,
    discriminant: Number(discriminant.toFixed(2)),
    vertexX: Number(vertexX.toFixed(2)),
    vertexY: Number(vertexY.toFixed(2)),
    realRoots,
    rootsDescription,
    sampledPoints,
  };
}

/**
 * Verified VSEPR 3D Molecular Geometry data for Chemistry 3D Lab.
 */
export interface VseprMoleculeModel {
  id: 'CH4' | 'H2O' | 'CO2' | 'NH3';
  formula: string;
  name: string;
  geometryName: string;
  bondAngleDeg: number;
  hybridization: string;
  centralAtom: { element: string; color: number; radius: number };
  ligands: Array<{
    element: string;
    color: number;
    radius: number;
    direction: [number, number, number];
    bondOrder: 1 | 2;
  }>;
  lonePairsCount: number;
  description: string;
}

export const VERIFIED_VSEPR_MOLECULES: Record<'CH4' | 'H2O' | 'CO2' | 'NH3', VseprMoleculeModel> = {
  CH4: {
    id: 'CH4',
    formula: 'CH₄',
    name: 'Methane',
    geometryName: 'Tetrahedral (AX₄)',
    bondAngleDeg: 109.5,
    hybridization: 'sp³',
    centralAtom: { element: 'C', color: 0x334155, radius: 0.62 },
    ligands: [
      { element: 'H', color: 0x38bdf8, radius: 0.36, direction: [1, 1, 1], bondOrder: 1 },
      { element: 'H', color: 0x38bdf8, radius: 0.36, direction: [-1, -1, 1], bondOrder: 1 },
      { element: 'H', color: 0x38bdf8, radius: 0.36, direction: [-1, 1, -1], bondOrder: 1 },
      { element: 'H', color: 0x38bdf8, radius: 0.36, direction: [1, -1, -1], bondOrder: 1 },
    ],
    lonePairsCount: 0,
    description:
      'Four bonding electron pairs repel equally in 3D space, forming a symmetric tetrahedron with 109.5° H–C–H bond angles.',
  },
  H2O: {
    id: 'H2O',
    formula: 'H₂O',
    name: 'Water',
    geometryName: 'Bent / Angular (AX₂E₂)',
    bondAngleDeg: 104.5,
    hybridization: 'sp³',
    centralAtom: { element: 'O', color: 0xef4444, radius: 0.6 },
    ligands: [
      {
        element: 'H',
        color: 0xf8fafc,
        radius: 0.35,
        direction: [Math.sin((52.25 * Math.PI) / 180), -Math.cos((52.25 * Math.PI) / 180), 0],
        bondOrder: 1,
      },
      {
        element: 'H',
        color: 0xf8fafc,
        radius: 0.35,
        direction: [-Math.sin((52.25 * Math.PI) / 180), -Math.cos((52.25 * Math.PI) / 180), 0],
        bondOrder: 1,
      },
    ],
    lonePairsCount: 2,
    description:
      'Two lone pairs on Oxygen exert stronger repulsion than bonding pairs, compressing the H–O–H bond angle from 109.5° down to 104.5°.',
  },
  CO2: {
    id: 'CO2',
    formula: 'CO₂',
    name: 'Carbon Dioxide',
    geometryName: 'Linear (AX₂)',
    bondAngleDeg: 180.0,
    hybridization: 'sp',
    centralAtom: { element: 'C', color: 0x334155, radius: 0.6 },
    ligands: [
      { element: 'O', color: 0xef4444, radius: 0.54, direction: [-1, 0, 0], bondOrder: 2 },
      { element: 'O', color: 0xef4444, radius: 0.54, direction: [1, 0, 0], bondOrder: 2 },
    ],
    lonePairsCount: 0,
    description:
      'Two double bonds (C=O) with zero lone pairs on Carbon orient 180° apart in a symmetric linear geometry with zero net dipole.',
  },
  NH3: {
    id: 'NH3',
    formula: 'NH₃',
    name: 'Ammonia',
    geometryName: 'Trigonal Pyramidal (AX₃E₁)',
    bondAngleDeg: 107.0,
    hybridization: 'sp³',
    centralAtom: { element: 'N', color: 0x3b82f6, radius: 0.6 },
    ligands: [
      { element: 'H', color: 0xf8fafc, radius: 0.35, direction: [0.94, -0.34, 0], bondOrder: 1 },
      { element: 'H', color: 0xf8fafc, radius: 0.35, direction: [-0.47, -0.34, 0.81], bondOrder: 1 },
      { element: 'H', color: 0xf8fafc, radius: 0.35, direction: [-0.47, -0.34, -0.81], bondOrder: 1 },
    ],
    lonePairsCount: 1,
    description:
      'One apical lone pair on Nitrogen pushes the three N–H bonds downward into a trigonal pyramid with 107.0° H–N–H bond angles.',
  },
};

/**
 * Generates a validated, playable EducationalGameSpec tailored to the subject, topic, and difficulty.
 */
export function buildEducationalGameSpec(params: {
  topic: string;
  subject?: EducationalSubject;
  difficulty?: 'easy' | 'medium' | 'hard';
}): EducationalGameSpec {
  const topic = (params.topic || 'Core Study Topic').trim();
  const subject = params.subject || detectEducationalSubject(topic);
  const difficulty = params.difficulty || 'medium';

  if (subject === 'Physics') {
    return {
      id: `game-physics-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `Physics Lab Challenge: ${topic}`,
      subject: 'Physics',
      topic,
      difficulty,
      templateType: 'physics_projectile_challenge',
      learningObjective: `Master projectile kinematics R = (v₀² sin 2θ)/g, maximum height H = (v₀ sin θ)²/(2g), and vector decomposition for ${topic}.`,
      instructions:
        'Complete the Concept Matching Grid or launch projectiles and solve each kinematics round. Use hints if needed; streaks award +50 bonus XP!',
      scoringRule: '+100 XP per solved round (+50 streak bonus).',
      matchingPairs: [
        {
          id: 'p1',
          term: 'Horizontal Range R',
          match: '(v₀² · sin 2θ) / g — maximized at θ = 45°',
          category: 'Kinematics',
        },
        {
          id: 'p2',
          term: 'Maximum Height H_max',
          match: '(v₀ · sin θ)² / (2g) — vertical vy = 0 at apex',
          category: 'Kinematics',
        },
        {
          id: 'p3',
          term: 'Time of Flight T',
          match: '(2 · v₀ · sin θ) / g — total time in air on level ground',
          category: 'Kinematics',
        },
        {
          id: 'p4',
          term: 'Horizontal Velocity vx',
          match: 'v₀ · cos θ — remains constant (ax = 0 without drag)',
          category: 'Vectors',
        },
      ],
      rounds: [
        {
          id: 'phys-r1',
          prompt:
            'A projectile is launched with initial speed v₀ = 20 m/s at angle θ = 45° (take g = 10 m/s²). What is its horizontal range R?',
          visualHint: 'At θ = 45°, sin(2θ) = sin(90°) = 1.',
          formulaOrCode: 'R = (v₀² · sin(2θ)) / g',
          options: ['40.0 m', '20.0 m', '80.0 m', '10.0 m'],
          correctIndex: 0,
          hint: 'Substitute v₀ = 20, sin(90°) = 1, and g = 10 into R = v₀² sin(2θ) / g.',
          stepByStepExplanation:
            'Step 1: Compute v₀² = 20² = 400 m²/s². Step 2: sin(2 × 45°) = sin(90°) = 1. Step 3: Divide by g = 10 m/s² → R = 400 / 10 = 40.0 m.',
          targetParams: { targetRangeMeters: 40, gravity: 10 },
        },
        {
          id: 'phys-r2',
          prompt:
            'At the highest point (apex) of a 2D projectile trajectory launched at speed v₀ and angle θ, what are the velocity components (vx, vy)?',
          visualHint: 'Gravity acts strictly downward (ay = −g, ax = 0).',
          formulaOrCode: 'v(t) = (v₀ cos θ, v₀ sin θ − g·t)',
          options: [
            'vx = v₀ cos θ,  vy = 0',
            'vx = 0,  vy = 0',
            'vx = 0,  vy = v₀ sin θ',
            'vx = v₀ sin θ,  vy = −g',
          ],
          correctIndex: 0,
          hint: 'Does any horizontal force act on the projectile in ideal vacuum kinematics?',
          stepByStepExplanation:
            'At the apex, vertical motion momentarily reverses so vy = 0, while horizontal velocity vx = v₀ cos θ remains constant throughout flight.',
        },
        {
          id: 'phys-r3',
          prompt:
            'Two projectiles are launched with the same initial speed v₀ on level ground. If Projectile A is launched at 30°, which launch angle for Projectile B gives the exact same horizontal range R?',
          visualHint: 'Recall the trigonometric identity sin(2(90° − θ)) = sin(180° − 2θ) = sin(2θ).',
          formulaOrCode: 'θ₂ = 90° − θ₁',
          options: ['60°', '45°', '75°', '15°'],
          correctIndex: 0,
          hint: 'Complementary angles θ and (90° − θ) yield identical values of sin(2θ).',
          stepByStepExplanation:
            'Because sin(2 × 60°) = sin(120°) = √3/2 = sin(60°) = sin(2 × 30°), complementary launch angles 30° and 60° achieve the exact same range.',
        },
      ],
    };
  }

  if (subject === 'Chemistry') {
    return {
      id: `game-chem-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `Chemistry Reaction & VSEPR Challenge: ${topic}`,
      subject: 'Chemistry',
      topic,
      difficulty,
      templateType: 'chemistry_equation_and_vsepr',
      learningObjective: `Master stoichiometric equation balancing and 3D VSEPR molecular geometry for ${topic}.`,
      instructions:
        'Match each molecule or law with its VSEPR geometry, then balance chemical equations and bond angles in the interactive challenge rounds.',
      scoringRule: '+100 XP per balanced reaction or VSEPR diagnosis.',
      matchingPairs: [
        {
          id: 'c1',
          term: 'Methane (CH₄)',
          match: 'Tetrahedral (sp³, 109.5°, 0 lone pairs)',
          category: 'VSEPR',
        },
        {
          id: 'c2',
          term: 'Water (H₂O)',
          match: 'Bent / Angular (sp³, 104.5°, 2 lone pairs)',
          category: 'VSEPR',
        },
        {
          id: 'c3',
          term: 'Ammonia (NH₃)',
          match: 'Trigonal Pyramidal (sp³, 107.0°, 1 lone pair)',
          category: 'VSEPR',
        },
        {
          id: 'c4',
          term: 'Carbon Dioxide (CO₂)',
          match: 'Linear (sp, 180.0°, two C=O double bonds)',
          category: 'VSEPR',
        },
      ],
      rounds: [
        {
          id: 'chem-r1',
          prompt:
            'Balance the complete combustion of methane:  a CH₄ + b O₂  →  c CO₂ + d H₂O. What is the stoichiometric coefficient tuple (a, b, c, d)?',
          visualHint: 'Count C atoms first (1), then H atoms (4 → 2 H₂O), then O atoms (4 → 2 O₂).',
          formulaOrCode: '1 CH₄ + 2 O₂ → 1 CO₂ + 2 H₂O',
          options: ['(1, 2, 1, 2)', '(1, 1, 1, 2)', '(2, 3, 2, 4)', '(1, 3, 1, 2)'],
          correctIndex: 0,
          hint: '1 CO₂ and 2 H₂O contain a total of 2 + 2 = 4 oxygen atoms on the product side.',
          stepByStepExplanation:
            '1 C on left gives c = 1 CO₂. 4 H on left gives d = 2 H₂O. Total O on right = 2(1) + 2(1) = 4 oxygen atoms, requiring b = 2 O₂.',
        },
        {
          id: 'chem-r2',
          prompt:
            'Why is the H–O–H bond angle in Water (104.5°) smaller than the ideal tetrahedral angle in Methane (109.5°)?',
          visualHint: 'Lone pair–lone pair repulsion > lone pair–bonding pair > bonding pair–bonding pair.',
          formulaOrCode: 'AX₂E₂ (2 Bonding Pairs + 2 Lone Pairs)',
          options: [
            'Two lone pairs on Oxygen occupy more angular space and compress the O–H bonds',
            'Oxygen uses d-orbital hybridization in H₂O',
            'Hydrogen atoms attract each other via covalent H–H bonding',
            'Water has linear sp hybridization',
          ],
          correctIndex: 0,
          hint: 'According to VSEPR theory, how many lone pairs reside on the central Oxygen atom?',
          stepByStepExplanation:
            'Oxygen has 6 valence electrons: 2 shared in O–H bonds and 4 in two lone pairs. Lone pair electron domains repel more strongly, pushing the two O–H bonds closer to 104.5°.',
        },
        {
          id: 'chem-r3',
          prompt:
            'Balance the Haber-Bosch ammonia synthesis reaction:  a N₂ + b H₂  ⇌  c NH₃.',
          visualHint: 'Ensure 2 Nitrogen atoms and 6 Hydrogen atoms on both sides.',
          formulaOrCode: 'N₂ + 3 H₂ ⇌ 2 NH₃',
          options: ['(1, 3, 2)', '(1, 2, 2)', '(2, 3, 2)', '(1, 1, 1)'],
          correctIndex: 0,
          hint: '1 molecule of N₂ produces 2 molecules of NH₃, which requires 2 × 3 = 6 H atoms.',
          stepByStepExplanation:
            '1 N₂ + 3 H₂ → 2 NH₃ balances 2 N atoms and 6 H atoms on both reactant and product sides.',
        },
      ],
    };
  }

  if (subject === 'Biology') {
    return {
      id: `game-bio-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `Biology Organelle & Pathway Challenge: ${topic}`,
      subject: 'Biology',
      topic,
      difficulty,
      templateType: 'biology_organelle_and_sequence',
      learningObjective: `Identify eukaryotic cell organelle functions and biological pathway sequences for ${topic}.`,
      instructions:
        'Match each cellular organelle to its physiological role and solve the biological pathway sequence puzzles.',
      scoringRule: '+100 XP per organelle & pathway match.',
      matchingPairs: [
        {
          id: 'b1',
          term: 'Mitochondria',
          match: 'Site of oxidative phosphorylation & ATP synthesis (cristae inner membrane)',
          category: 'Organelle',
        },
        {
          id: 'b2',
          term: 'Rough Endoplasmic Reticulum',
          match: 'Ribosome-studded membrane network for secretory protein synthesis & folding',
          category: 'Organelle',
        },
        {
          id: 'b3',
          term: 'Golgi Apparatus',
          match: 'Post-translational glycosylation, sorting & vesicle packaging',
          category: 'Organelle',
        },
        {
          id: 'b4',
          term: 'Nucleus & Nucleolus',
          match: 'Houses chromatin DNA, transcriptional regulation & rRNA assembly',
          category: 'Organelle',
        },
      ],
      rounds: [
        {
          id: 'bio-r1',
          prompt:
            'What is the correct intracellular trafficking sequence for a secreted protein (such as insulin) from synthesis to exocytosis?',
          visualHint: 'Follow the endomembrane system from mRNA translation to the plasma membrane.',
          formulaOrCode: 'Ribosome (Rough ER) → Transport Vesicle → Golgi → Secretory Vesicle',
          options: [
            'Rough ER Ribosome → ER Lumen → Cis-Golgi → Trans-Golgi → Plasma Membrane',
            'Nucleolus → Mitochondria → Smooth ER → Lysosome → Plasma Membrane',
            'Free Cytosolic Ribosome → Peroxisome → Nucleus → Plasma Membrane',
            'Golgi Apparatus → Rough ER → Mitochondria → Plasma Membrane',
          ],
          correctIndex: 0,
          hint: 'Secreted proteins are co-translationally translocated into the Rough ER before reaching the Golgi.',
          stepByStepExplanation:
            'Polypeptides destined for secretion enter the Rough ER lumen, travel via vesicles to the cis-Golgi for modification, exit the trans-Golgi in secretory vesicles, and fuse with the plasma membrane.',
        },
        {
          id: 'bio-r2',
          prompt:
            'During cellular respiration, in which specific compartment does the proton motive force (H⁺ gradient) accumulate to drive ATP Synthase?',
          visualHint: 'The inner mitochondrial membrane is impermeable to H⁺ ions.',
          formulaOrCode: 'Intermembrane Space [H⁺] high → Matrix via F₀F₁ ATP Synthase',
          options: [
            'Mitochondrial intermembrane space (pumped across the inner membrane)',
            'Cytosol outside the outer mitochondrial membrane',
            'Nucleoplasm inside the nuclear envelope',
            'Smooth endoplasmic reticulum lumen',
          ],
          correctIndex: 0,
          hint: 'Complexes I, III, and IV reside in the inner mitochondrial membrane (cristae).',
          stepByStepExplanation:
            'The electron transport chain pumps protons (H⁺) from the mitochondrial matrix into the intermembrane space; chemiosmotic flow back into the matrix powers ATP Synthase.',
        },
      ],
    };
  }

  if (subject === 'Programming') {
    return {
      id: `game-prog-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: `Algorithm & Code Trace Arena: ${topic}`,
      subject: 'Programming',
      topic,
      difficulty,
      templateType: 'programming_code_trace',
      learningObjective: `Predict exact execution outputs, time complexity, and state invariants for ${topic}.`,
      instructions:
        'Match data structures to their time complexities and trace code execution step by step.',
      scoringRule: '+100 XP per verified code trace.',
      matchingPairs: [
        {
          id: 'cs1',
          term: 'Binary Search (Sorted Array)',
          match: 'O(log n) time, O(1) iterative space — halves search interval each step',
          category: 'Complexity',
        },
        {
          id: 'cs2',
          term: 'Hash Table Lookup',
          match: 'O(1) average time — maps keys via hash function to bucket index',
          category: 'Data Structures',
        },
        {
          id: 'cs3',
          term: 'Merge Sort',
          match: 'O(n log n) worst-case time, O(n) auxiliary space, stable divide-and-conquer',
          category: 'Sorting',
        },
        {
          id: 'cs4',
          term: 'Breadth-First Search (BFS)',
          match: 'O(V + E) time using a FIFO Queue — finds shortest unweighted path',
          category: 'Graphs',
        },
      ],
      rounds: [
        {
          id: 'cs-r1',
          prompt:
            'What is the exact output of the following recursive function call: f(4) where f(n) = (n <= 1) ? 1 : n + f(n - 1)?',
          visualHint: 'Trace the call stack: f(4) = 4 + f(3) = 4 + 3 + f(2) = 4 + 3 + 2 + f(1).',
          formulaOrCode: 'function f(n) { return n <= 1 ? 1 : n + f(n - 1); } // f(4)',
          options: ['10', '24', '9', '7'],
          correctIndex: 0,
          hint: 'Base case f(1) returns 1. Sum 4 + 3 + 2 + 1.',
          stepByStepExplanation:
            'f(1) = 1 → f(2) = 2 + 1 = 3 → f(3) = 3 + 3 = 6 → f(4) = 4 + 6 = 10.',
        },
        {
          id: 'cs-r2',
          prompt:
            'In Binary Search on a sorted array of N = 1,024 elements, what is the maximum number of comparisons required to locate a target or prove it is absent?',
          visualHint: 'Recall 2¹⁰ = 1,024.',
          formulaOrCode: 'max_steps = ⌊log₂(1024)⌋ + 1',
          options: ['11 comparisons', '512 comparisons', '100 comparisons', '32 comparisons'],
          correctIndex: 0,
          hint: 'Each comparison cuts the remaining search range in half.',
          stepByStepExplanation:
            'Since 1,024 = 2¹⁰, halving the interval takes at most log₂(1024) + 1 = 11 comparisons in the worst case.',
        },
      ],
    };
  }

  // Default: Mathematics (Probability, Quadratic Functions, Sets & Relations, Statistics)
  return {
    id: `game-math-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: `Mathematics Concept & Equation Arena: ${topic}`,
    subject: 'Mathematics',
    topic,
    difficulty,
    templateType: 'math_graph_and_formula',
    learningObjective: `Master governing formulas, graph transformations, and step-by-step problem solving for ${topic}.`,
    instructions:
      'Match each mathematical theorem or function to its exact formula, then solve the multi-step equation & probability rounds.',
    scoringRule: '+100 XP per solved round (+50 streak bonus).',
    matchingPairs: [
      {
        id: 'm1',
        term: "Bayes' Theorem Posterior P(A | B)",
        match: '[ P(B | A) · P(A) ] / P(B) — updates prior belief with likelihood',
        category: 'Probability',
      },
      {
        id: 'm2',
        term: 'Quadratic Vertex & Axis of Symmetry',
        match: 'x_v = −b / (2a),  Δ = b² − 4ac determines real root count',
        category: 'Algebra',
      },
      {
        id: 'm3',
        term: 'Standard Error of Sample Mean SE(X̄)',
        match: 'σ / √n — quadrupling sample size n cuts SE in half',
        category: 'Statistics',
      },
      {
        id: 'm4',
        term: 'Variance Scaling Property Var(aX + b)',
        match: 'a² · Var(X) — constant shift b does not change spread',
        category: 'Random Variables',
      },
    ],
    rounds: [
      {
        id: 'math-r1',
        prompt:
          'Given P(A) = 0.20, P(B | A) = 0.75, and marginal probability P(B) = 0.30, compute the exact posterior probability P(A | B) using Bayes’ Theorem.',
        visualHint: 'Numerator = P(B | A) × P(A) = 0.75 × 0.20 = 0.15.',
        formulaOrCode: 'P(A | B) = [ P(B | A) · P(A) ] / P(B)',
        options: ['0.50 (50%)', '0.25 (25%)', '0.15 (15%)', '0.75 (75%)'],
        correctIndex: 0,
        hint: 'Divide the joint probability P(A ∩ B) = 0.15 by P(B) = 0.30.',
        stepByStepExplanation:
          'Step 1: Joint probability P(A ∩ B) = P(B|A)·P(A) = 0.75 × 0.20 = 0.15. Step 2: Divide by P(B) = 0.30 → P(A|B) = 0.15 / 0.30 = 0.50 (50%).',
      },
      {
        id: 'math-r2',
        prompt:
          'For the quadratic function y = x² − 4x + 3, what are its vertex coordinates (h, k) and real roots (x-intercepts)?',
        visualHint: 'h = −b / (2a) = −(−4) / 2 = 2, and y = (x − 1)(x − 3).',
        formulaOrCode: 'y = x² − 4x + 3 = (x − 2)² − 1',
        options: [
          'Vertex (2, −1) and roots x = 1, x = 3',
          'Vertex (−2, 15) and roots x = −1, x = −3',
          'Vertex (2, 3) and no real roots',
          'Vertex (4, 3) and roots x = 0, x = 4',
        ],
        correctIndex: 0,
        hint: 'Evaluate y(2) = 2² − 4(2) + 3 to find the minimum value k.',
        stepByStepExplanation:
          'Completing the square gives y = (x − 2)² − 1, so the vertex is at (2, −1). Setting y = 0 factors as (x − 1)(x − 3) = 0, giving roots x = 1 and x = 3.',
        targetParams: { quadA: 1, quadB: -4, quadC: 3 },
      },
      {
        id: 'math-r3',
        prompt:
          'A random sample of size n = 25 is drawn from a population with standard deviation σ = 15. What is the Standard Error SE(X̄) of the sample mean, and what sample size is needed to reduce SE(X̄) to 1.5?',
        visualHint: 'SE = σ / √n. To halve SE from 3.0 to 1.5, how must n scale?',
        formulaOrCode: 'SE(X̄) = σ / √n',
        options: [
          'SE = 3.0; requires n = 100 (4× sample size)',
          'SE = 3.0; requires n = 50 (2× sample size)',
          'SE = 0.6; requires n = 50',
          'SE = 15.0; requires n = 225',
        ],
        correctIndex: 0,
        hint: '15 / √25 = 15 / 5 = 3.0. Solve 15 / √n = 1.5.',
        stepByStepExplanation:
          'At n = 25, SE = 15 / √25 = 3.0. To halve SE to 1.5, √n must double from 5 to 10, requiring n = 10² = 100 observations.',
      },
    ],
  };
}

/**
 * Generates a validated EducationalSceneSpec for the Concept 3D Lab + 2D Plotter.
 */
export function buildEducationalSceneSpec(params: {
  topic: string;
  category?: SceneCategory;
}): EducationalSceneSpec {
  const topic = (params.topic || 'Core Study Concept').trim();
  const inferredSubject = detectEducationalSubject(topic);
  const category: SceneCategory =
    params.category ||
    (inferredSubject === 'Physics'
      ? 'physics_projectile_3d'
      : inferredSubject === 'Chemistry'
      ? 'chemistry_vsepr_3d'
      : inferredSubject === 'Biology'
      ? 'biology_cell_3d'
      : 'math_surface_3d');

  if (category === 'physics_projectile_3d') {
    return {
      id: 'scene-physics-projectile',
      title: `3D Kinematics & Projectile Trajectory Lab (${topic})`,
      subject: 'Physics',
      topic,
      category: 'physics_projectile_3d',
      supports3D: true,
      supports2DPlot: true,
      summary:
        'Real-time 3D & 2D parabolic trajectory simulator showing launch velocity vector v₀, apex height H_max, horizontal range R, and gravity g.',
      governingEquations: [
        'x(t) = v₀ · cos(θ) · t',
        'y(t) = v₀ · sin(θ) · t − ½ g t²',
        'R = (v₀² · sin(2θ)) / g',
        'H_max = (v₀ · sin(θ))² / (2g)',
      ],
      parameterControls: [
        {
          id: 'v0',
          label: 'Launch Speed v₀',
          unit: 'm/s',
          min: 10,
          max: 50,
          step: 1,
          defaultValue: 26,
        },
        {
          id: 'angleDeg',
          label: 'Launch Angle θ',
          unit: '°',
          min: 15,
          max: 80,
          step: 1,
          defaultValue: 45,
        },
        {
          id: 'gravity',
          label: 'Gravity g',
          unit: 'm/s²',
          min: 1.6,
          max: 20,
          step: 0.2,
          defaultValue: 9.8,
        },
      ],
      labels: [
        {
          id: 'lbl-launch',
          title: 'Launch Origin & v₀ Vector',
          formulaOrAngle: 'v₀ = (v₀ cos θ, v₀ sin θ)',
          description: 'Initial velocity decomposed into constant horizontal vx and upward vy₀.',
          color: '#38bdf8',
          position3D: [-3.5, 0.4, 0],
        },
        {
          id: 'lbl-apex',
          title: 'Trajectory Apex (H_max)',
          formulaOrAngle: 'vy = 0,  vx = v₀ cos θ',
          description: 'Vertical velocity momentarily reaches zero at peak altitude.',
          color: '#facc15',
          position3D: [0, 2.4, 0],
        },
        {
          id: 'lbl-impact',
          title: 'Horizontal Range (R)',
          formulaOrAngle: 'R = v₀² sin(2θ) / g',
          description: 'Maximum horizontal displacement on level ground occurs at θ = 45°.',
          color: '#34d399',
          position3D: [3.5, 0.3, 0],
        },
      ],
      learningNotes: [
        'Horizontal velocity vx = v₀ cos θ is constant throughout flight when air resistance is negligible.',
        'Vertical velocity vy(t) = v₀ sin θ − g·t decreases linearly due to downward acceleration g.',
        'Try switching Gravity g to 1.6 m/s² (Moon) vs 9.8 m/s² (Earth) to see Range R scale inversely with g!',
      ],
    };
  }

  if (category === 'chemistry_vsepr_3d') {
    return {
      id: 'scene-chemistry-vsepr',
      title: `3D VSEPR Molecular Geometry & Bond Angle Lab (${topic})`,
      subject: 'Chemistry',
      topic,
      category: 'chemistry_vsepr_3d',
      supports3D: true,
      supports2DPlot: true,
      summary:
        'Verified 3D VSEPR molecular geometry viewer for Methane (CH₄, 109.5°), Water (H₂O, 104.5°), Ammonia (NH₃, 107.0°), and Carbon Dioxide (CO₂, 180.0°).',
      governingEquations: [
        'Steric Number SN = (Bonding Domains) + (Lone Pairs)',
        'CH₄: AX₄ → sp³ Tetrahedral (109.5°)',
        'H₂O: AX₂E₂ → sp³ Bent (104.5°)',
        'CO₂: AX₂ → sp Linear (180.0°)',
      ],
      parameterControls: [
        {
          id: 'bondScale',
          label: 'Bond Length Scale',
          unit: 'Å',
          min: 0.7,
          max: 1.6,
          step: 0.05,
          defaultValue: 1.1,
        },
        {
          id: 'vibrationAmp',
          label: 'Thermal Bond Vibration',
          unit: 'x',
          min: 0,
          max: 1,
          step: 0.1,
          defaultValue: 0.2,
        },
      ],
      labels: [
        {
          id: 'lbl-central',
          title: 'Central Atom Core',
          formulaOrAngle: 'Hybridized Valence Shell',
          description: 'Minimizes electron-pair repulsion across 3D steric domains.',
          color: '#ef4444',
          position3D: [0, 0.5, 0],
        },
        {
          id: 'lbl-angle',
          title: 'Equilibrium Bond Angle',
          formulaOrAngle: 'LP–LP > LP–BP > BP–BP repulsion',
          description: 'Lone pairs occupy larger angular volume, compressing adjacent covalent bonds.',
          color: '#38bdf8',
          position3D: [1.5, -0.8, 0],
        },
      ],
      learningNotes: [
        'Valence Shell Electron Pair Repulsion (VSEPR) positions electron domains as far apart in 3D space as possible.',
        'Compare CH₄ (0 lone pairs → 109.5°), NH₃ (1 lone pair → 107.0°), and H₂O (2 lone pairs → 104.5°).',
      ],
    };
  }

  if (category === 'biology_cell_3d') {
    return {
      id: 'scene-biology-cell',
      title: `3D Eukaryotic Cell & Organelle Cross-Section (${topic})`,
      subject: 'Biology',
      topic,
      category: 'biology_cell_3d',
      supports3D: true,
      supports2DPlot: true,
      summary:
        'Interactive 3D cross-section of a eukaryotic cell highlighting the Nucleus, Mitochondria, Endoplasmic Reticulum, Golgi Apparatus, and Selective Plasma Membrane.',
      governingEquations: [
        'Cellular Respiration: C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + ~30–32 ATP',
        'Central Dogma: DNA (Nucleus) → mRNA → Ribosome / Rough ER (Protein)',
      ],
      parameterControls: [
        {
          id: 'membraneOpacity',
          label: 'Cross-Section Depth',
          unit: '%',
          min: 15,
          max: 85,
          step: 5,
          defaultValue: 35,
        },
        {
          id: 'organelleScale',
          label: 'Organelle Magnification',
          unit: 'x',
          min: 0.8,
          max: 1.4,
          step: 0.05,
          defaultValue: 1.0,
        },
      ],
      labels: [
        {
          id: 'lbl-nucleus',
          title: 'Nucleus & Nucleolus',
          formulaOrAngle: 'Double Nuclear Envelope',
          description: 'Stores genomic chromatin DNA and coordinates transcription and ribosome assembly.',
          color: '#a855f7',
          position3D: [0, 0.8, 0],
        },
        {
          id: 'lbl-mito',
          title: 'Mitochondria (Cristae)',
          formulaOrAngle: 'Oxidative Phosphorylation',
          description: 'Generates ATP via the inner-membrane electron transport chain and chemiosmosis.',
          color: '#ef4444',
          position3D: [1.5, 0.2, 0.9],
        },
        {
          id: 'lbl-er',
          title: 'Endoplasmic Reticulum & Golgi',
          formulaOrAngle: 'Endomembrane Trafficking',
          description: 'Synthesizes, folds, glycosylates, and packages proteins into vesicles.',
          color: '#38bdf8',
          position3D: [-1.4, -0.2, 1.0],
        },
      ],
      learningNotes: [
        'Compartmentalization allows incompatible biochemical processes (e.g., lysosomal hydrolysis vs. DNA replication) to occur simultaneously.',
        'Mitochondria possess their own circular DNA and 70S ribosomes, supporting the endosymbiotic theory.',
      ],
    };
  }

  if (category === 'custom_ai_3d') {
    return {
      id: 'scene-custom-ai-3d',
      title: `AI 3D Model Creator (${topic})`,
      subject: inferredSubject,
      topic,
      category: 'custom_ai_3d',
      supports3D: true,
      supports2DPlot: false,
      summary:
        'Interactive AI-synthesized 3D spatial model powered by Claude 3.5 & Three.js with full orbit, pan, zoom, and wireframe controls.',
      governingEquations: [
        'Mesh vertices (x, y, z) generated from educational spatial graphs',
        'Shader: ACESFilmicToneMapping + PMREM Environment Illumination',
      ],
      parameterControls: [],
      labels: [],
      learningNotes: [
        'Interact with the 3D model using mouse/touch: Left-drag to orbit, right-drag to pan, scroll/pinch to zoom.',
        'Toggle wireframe mode to inspect the geometric polygon mesh and underlying spatial primitives.',
      ],
    };
  }

  // Default: Mathematics 3D Surface z = f(x, y) + 2D Function Graph y = ax^2 + bx + c
  return {
    id: 'scene-math-surface',
    title: `3D Mathematical Surface z = f(x, y) & 2D Quadratic Graph (${topic})`,
    subject: 'Mathematics',
    topic,
    category: 'math_surface_3d',
    supports3D: true,
    supports2DPlot: true,
    summary:
      'Interactive 3D multivariate surface mesh z = a·x² + b·y² (paraboloid, saddle surface, or wave interference) paired with an exact 2D quadratic graph plotter y = a·x² + b·x + c.',
    governingEquations: [
      '3D Surface: z(x, y) = a·x² + b·y²  (Elliptic Paraboloid when a,b > 0; Hyperbolic Saddle when a·b < 0)',
      '2D Parabola: y(x) = a·x² + b·x + c,   Vertex x_v = −b / (2a),   Discriminant Δ = b² − 4ac',
    ],
    parameterControls: [
      {
        id: 'quadA',
        label: 'Curvature Coefficient a',
        unit: '',
        min: -2.0,
        max: 2.0,
        step: 0.25,
        defaultValue: 1.0,
      },
      {
        id: 'quadB',
        label: 'Linear / Y-Curvature b',
        unit: '',
        min: -4.0,
        max: 4.0,
        step: 0.5,
        defaultValue: -2.0,
      },
      {
        id: 'quadC',
        label: 'Vertical Shift c',
        unit: '',
        min: -4.0,
        max: 4.0,
        step: 0.5,
        defaultValue: -3.0,
      },
    ],
    labels: [
      {
        id: 'lbl-vertex',
        title: 'Critical Point / Vertex (∇f = 0)',
        formulaOrAngle: '∂z/∂x = 0, ∂z/∂y = 0',
        description: 'Local minimum, maximum, or saddle point depending on the Hessian determinant.',
        color: '#facc15',
        position3D: [0, 0.2, 0],
      },
      {
        id: 'lbl-axes',
        title: '3D Coordinate Axes (X, Y, Z)',
        formulaOrAngle: 'Domain (x, y) ∈ [−3, 3]²',
        description: 'Color-coded wireframe surface elevation showing rate of change and concavity.',
        color: '#38bdf8',
        position3D: [2.2, 1.4, 0],
      },
    ],
    learningNotes: [
      'In 3D Mode: Set a > 0 and b > 0 for an upward Elliptic Paraboloid; set a > 0 and b < 0 to observe a Hyperbolic Paraboloid (Saddle Point)!',
      'In 2D Graph Mode: Adjust a, b, and c to watch the vertex (h, k), axis of symmetry, and real roots update in real time.',
    ],
  };
}

/**
 * Safe deterministic formula evaluator for Student Mini Apps.
 * Evaluates mathematical expressions over a key-value input map without `eval`.
 */
export function evaluateMiniAppFormulas(
  spec: MiniAppSpec,
  inputValues: Record<string, number>
): Record<string, { value: number; formatted: string }> {
  const vars: Record<string, number> = {};
  for (const field of spec.inputs) {
    const raw = inputValues[field.id];
    vars[field.id] = typeof raw === 'number' && Number.isFinite(raw) ? raw : field.defaultValue;
  }

  const results: Record<string, { value: number; formatted: string }> = {};

  if (spec.templateId === 'projectile_kinematics') {
    const kin = computeProjectileKinematics({
      v0: vars.v0 ?? 25,
      angleDeg: vars.angleDeg ?? 45,
      gravity: vars.gravity ?? 9.8,
    });
    results.rangeMeters = {
      value: kin.rangeMeters,
      formatted: `${kin.rangeMeters.toFixed(2)} m`,
    };
    results.maxHeightMeters = {
      value: kin.maxHeightMeters,
      formatted: `${kin.maxHeightMeters.toFixed(2)} m`,
    };
    results.flightTimeSeconds = {
      value: kin.flightTimeSeconds,
      formatted: `${kin.flightTimeSeconds.toFixed(2)} s`,
    };
    results.vx = {
      value: kin.vx,
      formatted: `${kin.vx.toFixed(2)} m/s`,
    };
    return results;
  }

  if (spec.templateId === 'quadratic_solver') {
    const quad = computeQuadraticProperties({
      a: vars.a ?? 1,
      b: vars.b ?? -4,
      c: vars.c ?? 3,
    });
    results.discriminant = {
      value: quad.discriminant,
      formatted: `${quad.discriminant.toFixed(2)}`,
    };
    results.vertex = {
      value: quad.vertexY,
      formatted: `(${quad.vertexX.toFixed(2)}, ${quad.vertexY.toFixed(2)})`,
    };
    results.roots = {
      value: quad.realRoots.length,
      formatted: quad.rootsDescription,
    };
    return results;
  }

  // Default / bayes_posterior & custom numeric formulas
  const prior = (vars.priorPct ?? 10) / 100;
  const sens = (vars.sensitivityPct ?? 95) / 100;
  const fp = (vars.falsePositivePct ?? 5) / 100;
  const marginalB = sens * prior + fp * (1 - prior);
  const posterior = marginalB > 0 ? (sens * prior) / marginalB : 0;

  results.marginalPct = {
    value: Number((marginalB * 100).toFixed(2)),
    formatted: `${(marginalB * 100).toFixed(2)}%`,
  };
  results.posteriorPct = {
    value: Number((posterior * 100).toFixed(2)),
    formatted: `${(posterior * 100).toFixed(1)}%`,
  };
  results.likelihoodRatio = {
    value: fp > 0 ? Number((sens / fp).toFixed(2)) : 99,
    formatted: fp > 0 ? `${(sens / fp).toFixed(1)}×` : '∞',
  };

  return results;
}

/**
 * Generates a complete, validated MiniAppSpec from a student's natural-language prompt or template selection.
 */
export function buildMiniAppSpecFromPrompt(params: {
  promptOrTopic: string;
  templateOverride?: MiniAppSpec['templateId'];
}): MiniAppSpec {
  const text = (params.promptOrTopic || 'Interactive Study Calculator').trim();
  const lower = text.toLowerCase();

  const templateId: MiniAppSpec['templateId'] =
    params.templateOverride ||
    (lower.includes('projectile') ||
    lower.includes('range') ||
    lower.includes('kinematic') ||
    lower.includes('velocity') ||
    lower.includes('physics')
      ? 'projectile_kinematics'
      : lower.includes('quadratic') ||
        lower.includes('parabola') ||
        lower.includes('equation') ||
        lower.includes('vertex') ||
        lower.includes('root')
      ? 'quadratic_solver'
      : lower.includes('quiz') || lower.includes('mcq') || lower.includes('test')
      ? 'chapter_quiz_app'
      : lower.includes('plan') || lower.includes('flashcard') || lower.includes('schedule')
      ? 'revision_planner_app'
      : 'bayes_posterior');

  if (templateId === 'projectile_kinematics') {
    return {
      id: `app-proj-${Date.now()}`,
      title: 'Projectile Range & Kinematics Calculator',
      subtitle: 'Interactive 2D Physics Launch Simulator with Live Trajectory Curve',
      subject: 'Physics',
      topic: text,
      templateId: 'projectile_kinematics',
      accentColor: '#1A73E8',
      inputs: [
        {
          id: 'v0',
          label: 'Initial Launch Velocity (v₀)',
          unit: 'm/s',
          min: 5,
          max: 100,
          step: 1,
          defaultValue: 30,
        },
        {
          id: 'angleDeg',
          label: 'Launch Angle (θ)',
          unit: 'deg',
          min: 5,
          max: 85,
          step: 1,
          defaultValue: 45,
        },
        {
          id: 'gravity',
          label: 'Gravitational Acceleration (g)',
          unit: 'm/s²',
          min: 1.6,
          max: 24.8,
          step: 0.2,
          defaultValue: 9.8,
        },
      ],
      outputs: [
        {
          id: 'rangeMeters',
          label: 'Horizontal Range (R)',
          unit: 'm',
          expression: '(v₀² · sin(2θ)) / g',
          description: 'Total horizontal distance traveled before returning to launch elevation.',
        },
        {
          id: 'maxHeightMeters',
          label: 'Maximum Apex Height (H_max)',
          unit: 'm',
          expression: '(v₀ · sin θ)² / (2g)',
          description: 'Peak vertical altitude where vertical velocity vy = 0.',
        },
        {
          id: 'flightTimeSeconds',
          label: 'Total Time of Flight (T)',
          unit: 's',
          expression: '(2 · v₀ · sin θ) / g',
          description: 'Duration in the air from launch to landing.',
        },
        {
          id: 'vx',
          label: 'Constant Horizontal Speed (vx)',
          unit: 'm/s',
          expression: 'v₀ · cos θ',
          description: 'Horizontal component of velocity (constant when air drag is zero).',
        },
      ],
      quizItems: [],
      plannerItems: [],
      studyTakeaway:
        'For any fixed initial speed v₀ on level ground, horizontal range R is maximized at θ = 45° because sin(2θ) reaches its peak value of 1.',
    };
  }

  if (templateId === 'quadratic_solver') {
    return {
      id: `app-quad-${Date.now()}`,
      title: 'Quadratic Formula, Discriminant & Vertex Solver',
      subtitle: 'Solves y = ax² + bx + c with Real-Time Parabola Plot & Root Analysis',
      subject: 'Mathematics',
      topic: text,
      templateId: 'quadratic_solver',
      accentColor: '#7C3AED',
      inputs: [
        {
          id: 'a',
          label: 'Quadratic Coefficient (a)',
          unit: '',
          min: -5,
          max: 5,
          step: 0.5,
          defaultValue: 1,
        },
        {
          id: 'b',
          label: 'Linear Coefficient (b)',
          unit: '',
          min: -10,
          max: 10,
          step: 0.5,
          defaultValue: -4,
        },
        {
          id: 'c',
          label: 'Constant Intercept (c)',
          unit: '',
          min: -10,
          max: 10,
          step: 0.5,
          defaultValue: 3,
        },
      ],
      outputs: [
        {
          id: 'discriminant',
          label: 'Discriminant (Δ)',
          unit: '',
          expression: 'b² − 4ac',
          description: 'Δ > 0: two real roots · Δ = 0: one repeated root · Δ < 0: complex roots.',
        },
        {
          id: 'vertex',
          label: 'Parabola Vertex (h, k)',
          unit: '',
          expression: 'h = −b/(2a), k = f(h)',
          description: 'Turning point and axis of symmetry x = h.',
        },
        {
          id: 'roots',
          label: 'Real Roots (x₁, x₂)',
          unit: '',
          expression: '(−b ± √Δ) / (2a)',
          description: 'x-intercepts where the parabola crosses y = 0.',
        },
      ],
      quizItems: [],
      plannerItems: [],
      studyTakeaway:
        'Completing the square rewrites y = ax² + bx + c into vertex form y = a(x − h)² + k where h = −b/(2a).',
    };
  }

  if (templateId === 'chapter_quiz_app') {
    return {
      id: `app-quiz-${Date.now()}`,
      title: `Custom Chapter Quiz App: ${text.slice(0, 48)}`,
      subtitle: 'Self-Grading Interactive Practice App with Instant Explanations',
      subject: detectEducationalSubject(text),
      topic: text,
      templateId: 'chapter_quiz_app',
      accentColor: '#EA4335',
      inputs: [],
      outputs: [],
      quizItems: [
        {
          id: 'q1',
          question:
            'If events A and B have non-zero probabilities and are mutually exclusive (disjoint), can they be statistically independent?',
          options: [
            'No — knowing A occurred guarantees B did not occur, so P(A ∩ B) = 0 ≠ P(A)P(B)',
            'Yes — disjoint events are always statistically independent',
            'Only when P(A) + P(B) = 1',
            'Only when the sample space is infinite',
          ],
          correctIndex: 0,
          explanation:
            'Disjoint means P(A ∩ B) = 0, whereas independence requires P(A ∩ B) = P(A)P(B) > 0.',
        },
        {
          id: 'q2',
          question:
            'By what factor must you multiply the sample size n to cut the Standard Error SE(X̄) = σ/√n in half?',
          options: ['Quadruple n (4×)', 'Double n (2×)', 'Multiply n by 8×', 'Halve n (0.5×)'],
          correctIndex: 0,
          explanation: 'Because √(4n) = 2√n in the denominator, quadrupling n halves SE(X̄).',
        },
        {
          id: 'q3',
          question:
            'For any random variable X and constants a, b, what is Var(aX + b)?',
          options: ['a² · Var(X)', 'a · Var(X) + b', 'a² · Var(X) + b²', 'Var(X) / a²'],
          correctIndex: 0,
          explanation:
            'Adding a constant shift b does not change spread, while scaling by a multiplies variance by a².',
        },
      ],
      plannerItems: [],
      studyTakeaway:
        'Active recall with immediate misconception feedback strengthens long-term exam retention.',
    };
  }

  if (templateId === 'revision_planner_app') {
    return {
      id: `app-planner-${Date.now()}`,
      title: `Revision Sprint & Flashcard Planner: ${text.slice(0, 42)}`,
      subtitle: 'Structured Study Checklist & Time-Boxed Active Recall Organizer',
      subject: detectEducationalSubject(text),
      topic: text,
      templateId: 'revision_planner_app',
      accentColor: '#34A853',
      inputs: [
        {
          id: 'dailyMinutes',
          label: 'Available Study Time Today',
          unit: 'min',
          min: 15,
          max: 180,
          step: 15,
          defaultValue: 60,
        },
      ],
      outputs: [],
      quizItems: [],
      plannerItems: [
        {
          id: 'pl-1',
          task: 'Review core formulas & axioms summary sheet',
          minutes: 15,
          priority: 'high',
          completed: false,
        },
        {
          id: 'pl-2',
          task: 'Solve 5 diagnostic & worked boundary-case problems',
          minutes: 25,
          priority: 'high',
          completed: false,
        },
        {
          id: 'pl-3',
          task: 'Complete Feynman "Teach It Back" self-explanation check',
          minutes: 20,
          priority: 'medium',
          completed: false,
        },
      ],
      studyTakeaway:
        'Splitting study blocks into 25-minute focused sprints with active problem solving prevents passive re-reading fatigue.',
    };
  }

  // Default: Bayes' Theorem & Diagnostic Posterior Calculator
  return {
    id: `app-bayes-${Date.now()}`,
    title: "Bayes' Theorem & Diagnostic Posterior Calculator",
    subtitle: 'Interactive Base-Rate & Conditional Probability Explorer',
    subject: 'Mathematics',
    topic: text,
    templateId: 'bayes_posterior',
    accentColor: '#1A73E8',
    inputs: [
      {
        id: 'priorPct',
        label: 'Prior Probability P(A)',
        unit: '%',
        min: 1,
        max: 90,
        step: 1,
        defaultValue: 10,
      },
      {
        id: 'sensitivityPct',
        label: 'Sensitivity / Likelihood P(B | A)',
        unit: '%',
        min: 10,
        max: 99,
        step: 1,
        defaultValue: 95,
      },
      {
        id: 'falsePositivePct',
        label: 'False Positive Rate P(B | Aᶜ)',
        unit: '%',
        min: 1,
        max: 50,
        step: 1,
        defaultValue: 5,
      },
    ],
    outputs: [
      {
        id: 'posteriorPct',
        label: 'Posterior Probability P(A | B)',
        unit: '%',
        expression: '[ P(B|A)·P(A) ] / P(B)',
        description: 'Updated probability that hypothesis A is true after observing evidence B.',
      },
      {
        id: 'marginalPct',
        label: 'Marginal Evidence P(B)',
        unit: '%',
        expression: 'P(B|A)P(A) + P(B|Aᶜ)P(Aᶜ)',
        description: 'Total probability of observing positive evidence B across all cases.',
      },
      {
        id: 'likelihoodRatio',
        label: 'Positive Likelihood Ratio (LR+)',
        unit: '×',
        expression: 'P(B|A) / P(B|Aᶜ)',
        description: 'How many times more likely evidence B is under hypothesis A vs Aᶜ.',
      },
    ],
    quizItems: [],
    plannerItems: [],
    studyTakeaway:
      'Even when a test has 95% sensitivity, a low base rate P(A) means false positives can still outnumber true positives!',
  };
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'about',
  'explain', 'animation', 'animated', 'explanation', 'lesson', 'video', 'concept',
  'jee', 'main', 'class', 'chapter', 'notes', 'study', 'show', 'how', 'what', 'why',
  'theory', 'normal', 'system', 'state', 'model', 'problem', 'method', 'step', 'law',
]);

/**
 * Determines whether the requested topic is supported by the uploaded study material
 * and returns verified 1-indexed page citations.
 */
export function resolveSupportedCitedPages(
  topic: string,
  contextText = '',
  candidatePages?: number[],
  validPageNumbers?: number[]
): { citedPages: number[]; isSupported: boolean } {
  const cleanContext = (contextText || '').trim().toLowerCase();
  const cleanTopic = (topic || '').trim().toLowerCase();

  const validSet =
    Array.isArray(validPageNumbers) && validPageNumbers.length > 0
      ? new Set(
          validPageNumbers
            .map((p) => Math.round(Number(p)))
            .filter((p) => Number.isFinite(p) && p >= 1 && p <= 2000)
        )
      : null;

  const normalizePages = (pages: number[]): number[] => {
    const filtered = pages
      .map((p) => Math.round(Number(p)))
      .filter((p) => Number.isFinite(p) && p >= 1 && p <= 2000 && (!validSet || validSet.has(p)));
    return Array.from(new Set(filtered)).sort((a, b) => a - b).slice(0, 6);
  };

  if (!cleanContext) {
    return { citedPages: [], isSupported: false };
  }

  // Extract meaningful tokens from topic
  const tokens = cleanTopic
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok));

  // Also check explicit "[Page N]" markers in contextText
  const explicitPageMatches = Array.from(contextText.matchAll(/\[Page\s+(\d+)\]/gi)).map((m) =>
    Number(m[1])
  );

  const matchingTokens = tokens.filter((tok) => cleanContext.includes(tok));
  const minRequiredMatches = tokens.length >= 3 ? 2 : 1;
  const hasTopicOverlap =
    tokens.length === 0
      ? cleanContext.length > 20
      : matchingTokens.length >= minRequiredMatches || cleanContext.includes(cleanTopic);

  if (!hasTopicOverlap) {
    return { citedPages: [], isSupported: false };
  }

  // Find which specific [Page N] blocks in contextText match the topic tokens
  const pageBlocks = contextText.split(/(?=\[Page\s+\d+\])/i);
  const matchedBlockPages: number[] = [];
  for (const block of pageBlocks) {
    const m = block.match(/\[Page\s+(\d+)\]/i);
    if (!m) continue;
    const pageNum = Number(m[1]);
    const blockLower = block.toLowerCase();
    const blockMatches = tokens.filter((tok) => blockLower.includes(tok));
    if (blockMatches.length >= 1 && matchingTokens.includes(blockMatches[0])) {
      matchedBlockPages.push(pageNum);
    }
  }

  const rawCandidates =
    matchedBlockPages.length > 0
      ? matchedBlockPages
      : Array.isArray(candidatePages) && candidatePages.length > 0
        ? candidatePages
        : explicitPageMatches.length > 0
          ? explicitPageMatches
          : validSet && validSet.size > 0
            ? [Array.from(validSet)[0]]
            : [1];

  const verifiedPages = normalizePages(rawCandidates);
  return {
    citedPages: verifiedPages,
    isSupported: verifiedPages.length > 0,
  };
}

function sanitizeBoundedString(val: unknown, maxLen: number): string {
  return sanitizeString(val).slice(0, maxLen);
}

/**
 * Splits a StructuredDiagramSpec's elements into 3 cumulative progressive diagram steps
 * so each scene builds visually step by step.
 */
export function buildProgressiveStepsForDiagram(
  spec: StructuredDiagramSpec,
  customStepLabels?: Array<{ label: string; description: string }>
): AnimatedDiagramStep[] {
  const allIds = spec.elements.map((el) => el.id);
  if (allIds.length === 0) {
    return [
      {
        stepNumber: 1,
        label: 'Complete Diagram',
        description: spec.description,
        visibleElementIds: [],
      },
    ];
  }

  const total = allIds.length;
  const step1Count = Math.max(1, Math.ceil(total / 3));
  const step2Count = Math.max(step1Count, Math.ceil((total * 2) / 3));

  const defaultSteps = [
    {
      label: 'Step 1: Reference Frame & Setup',
      description: 'Establish the coordinate axes, base geometry, or initial partition.',
    },
    {
      label: 'Step 2: Active Vectors & Mechanism',
      description: 'Trace the primary vectors, curves, or bond interactions.',
    },
    {
      label: 'Step 3: Governing Law & Exam Takeaway',
      description: 'Overlay the governing JEE formula and resultant quantities.',
    },
  ];

  const labels = customStepLabels && customStepLabels.length >= 3 ? customStepLabels : defaultSteps;

  return [
    {
      stepNumber: 1,
      label: sanitizeBoundedString(labels[0].label, 80) || defaultSteps[0].label,
      description: sanitizeBoundedString(labels[0].description, 180) || defaultSteps[0].description,
      visibleElementIds: allIds.slice(0, step1Count),
    },
    {
      stepNumber: 2,
      label: sanitizeBoundedString(labels[1].label, 80) || defaultSteps[1].label,
      description: sanitizeBoundedString(labels[1].description, 180) || defaultSteps[1].description,
      visibleElementIds: allIds.slice(0, step2Count),
    },
    {
      stepNumber: 3,
      label: sanitizeBoundedString(labels[2].label, 80) || defaultSteps[2].label,
      description: sanitizeBoundedString(labels[2].description, 180) || defaultSteps[2].description,
      visibleElementIds: allIds,
    },
  ];
}

/**
 * Returns a StructuredDiagramSpec filtered to the cumulative elements visible at stepIndex.
 */
export function getSceneSpecForProgressiveStep(
  scene: AnimatedExplanationScene,
  stepIndex: number
): StructuredDiagramSpec {
  const steps = scene.progressiveSteps || [];
  if (steps.length === 0) {
    return scene.spec;
  }
  const clampedIdx = Math.max(0, Math.min(steps.length - 1, Math.floor(stepIndex)));
  const targetStep = steps[clampedIdx];
  if (!targetStep || !Array.isArray(targetStep.visibleElementIds) || targetStep.visibleElementIds.length === 0) {
    return scene.spec;
  }
  const visibleSet = new Set(targetStep.visibleElementIds);
  const filteredElements = scene.spec.elements.filter((el) => visibleSet.has(el.id));
  return {
    ...scene.spec,
    elements: filteredElements.length > 0 ? filteredElements : scene.spec.elements,
  };
}

function makeSceneDiagramSpec(params: {
  title: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  category: StructuredDiagramSpec['category'];
  description: string;
  elements: DiagramElement[];
  assumptions: string[];
  citedPages: number[];
}): StructuredDiagramSpec {
  return {
    title: params.title,
    category: params.category,
    subject: params.subject,
    description: params.description,
    viewBox: { x: 0, y: 0, width: 700, height: 500 },
    elements: params.elements,
    assumptions: params.assumptions,
    schematicAssumptions: params.assumptions,
    citedPages: params.citedPages,
    isAiGenerated: false,
  };
}

/**
 * Generates a topic-matched 4–5 scene deterministic AnimatedExplanationScene[]
 * grounded in the active study material when supported.
 */
export function buildAnimatedExplanationScenes(
  topic: string,
  contextText = '',
  citedPages?: number[],
  validPageNumbers?: number[]
): AnimatedExplanationScene[] {
  const cleanTopic = sanitizeBoundedString(topic || 'Core Study Topic', 120) || 'Core Study Topic';
  const subject = detectEducationalSubject(`${cleanTopic} ${contextText}`);
  const citationInfo = resolveSupportedCitedPages(cleanTopic, contextText, citedPages, validPageNumbers);
  const verifiedPages = citationInfo.citedPages;
  const isSupported = citationInfo.isSupported;
  const lower = `${cleanTopic} ${contextText.slice(0, 300)}`.toLowerCase();

  if (subject === 'Physics') {
    const isInclined =
      lower.includes('incline') ||
      lower.includes('wedge') ||
      lower.includes('friction') ||
      lower.includes('normal force') ||
      lower.includes('free body') ||
      lower.includes('fbd');

    if (isInclined) {
      const rawScenes: Array<Omit<AnimatedExplanationScene, 'progressiveSteps'> & {
        stepLabels: Array<{ label: string; description: string }>;
      }> = [
        {
          sceneNumber: 1,
          durationSeconds: 8,
          heading: `Inclined Plane Geometry & Tilted Axes: ${cleanTopic}`,
          teachingPoint: 'Rotate the coordinate axes parallel (x) and perpendicular (y) to the incline of angle θ so motion stays strictly 1D along the ramp.',
          narration: `To solve ${cleanTopic} quickly in JEE Main, first align the x-axis down the incline of angle θ and the y-axis perpendicular to the surface. This makes acceleration perpendicular to the wedge zero.`,
          visualCue: 'Wedge of angle θ with block mass m and rotated (x∥, y⊥) coordinate frame',
          keyFormula: 'a_y = 0 (perpendicular to incline)',
          animationMode: 'projectile_arc',
          highlightValues: ['Incline angle θ', 'x-axis ∥ surface', 'y-axis ⊥ surface'],
          citedPages: verifiedPages,
          isSupportedByMaterial: isSupported,
          spec: makeSceneDiagramSpec({
            title: `Scene 1: Tilted Reference Frame (${cleanTopic})`,
            subject: 'Physics',
            category: 'free_body_diagram',
            description: 'Inclined wedge of angle θ with mass m and rotated x-y axes.',
            citedPages: verifiedPages,
            assumptions: ['Rigid inclined wedge fixed to horizontal ground', 'a_⊥ = 0 normal to wedge'],
            elements: [
              { id: 's1-ground', kind: 'line', startX: 80, startY: 410, endX: 620, endY: 410, color: '#64748B', strokeWidth: 3 },
              { id: 's1-ramp', kind: 'line', startX: 100, startY: 410, endX: 560, endY: 180, color: '#475569', strokeWidth: 3.5 },
              { id: 's1-wall', kind: 'line', startX: 560, startY: 180, endX: 560, endY: 410, color: '#64748B', strokeWidth: 2, dashed: true },
              { id: 's1-arc', kind: 'arc', cx: 100, cy: 410, r: 65, startAngleDeg: -26.5, endAngleDeg: 0, color: '#D97706', label: 'θ' },
              { id: 's1-block', kind: 'rect', x: 300, y: 245, width: 84, height: 52, rx: 6, stroke: '#4F46E5', fill: '#EEF2FF', label: 'Block m' },
              { id: 's1-axis-x', kind: 'arrow', startX: 342, startY: 271, endX: 235, endY: 325, color: '#0EA5E9', label: '+x (down ramp)', dashed: true },
              { id: 's1-axis-y', kind: 'arrow', startX: 342, startY: 271, endX: 295, endY: 180, color: '#10B981', label: '+y (normal)', dashed: true },
            ],
          }),
          stepLabels: [
            { label: 'Step 1: Wedge Geometry', description: 'Draw the horizontal base and inclined ramp at angle θ.' },
            { label: 'Step 2: Place Mass m', description: 'Position the block of mass m on the inclined plane.' },
            { label: 'Step 3: Align Tilted Axes', description: 'Set +x parallel to the ramp and +y perpendicular to the surface.' },
          ],
        },
        {
          sceneNumber: 2,
          durationSeconds: 9,
          heading: 'Resolving Gravity mg into Normal & Tangential Components',
          teachingPoint: 'Weight mg acts vertically downward and splits into mg cos θ pressing into the ramp and mg sin θ pulling the block down the slope.',
          narration: `Because the angle between the vertical weight vector mg and the inward normal equals the incline angle θ, gravity resolves into mg cos θ perpendicular to the plane and mg sin θ parallel to the plane.`,
          visualCue: 'Vertical mg vector resolving into orthogonal mg cos θ and mg sin θ components',
          keyFormula: 'F_∥ = mg sin θ,   F_⊥ = mg cos θ',
          animationMode: 'projectile_arc',
          highlightValues: ['mg acts straight down', 'mg cos θ ⊥ ramp', 'mg sin θ ∥ ramp'],
          citedPages: verifiedPages,
          isSupportedByMaterial: isSupported,
          spec: makeSceneDiagramSpec({
            title: 'Scene 2: Resolving Weight mg on an Incline',
            subject: 'Physics',
            category: 'free_body_diagram',
            description: 'Decomposition of vertical weight mg into mg cos θ and mg sin θ.',
            citedPages: verifiedPages,
            assumptions: ['Uniform gravitational field g = 9.8 m/s²', 'F_g,x = mg sin θ, F_g,y = -mg cos θ'],
            elements: [
              { id: 's2-ramp', kind: 'line', startX: 100, startY: 410, endX: 560, endY: 180, color: '#475569', strokeWidth: 3 },
              { id: 's2-block', kind: 'rect', x: 300, y: 245, width: 84, height: 52, rx: 6, stroke: '#4F46E5', fill: '#EEF2FF', label: 'Block m' },
              { id: 's2-mg', kind: 'arrow', startX: 342, startY: 271, endX: 342, endY: 430, color: '#EF4444', strokeWidth: 3, label: 'mg' },
              { id: 's2-mgcos', kind: 'arrow', startX: 342, startY: 271, endX: 405, endY: 398, color: '#D97706', strokeWidth: 2.5, dashed: true, label: 'mg cos θ' },
              { id: 's2-mgsin', kind: 'arrow', startX: 342, startY: 271, endX: 225, endY: 330, color: '#EC4899', strokeWidth: 2.5, dashed: true, label: 'mg sin θ' },
              { id: 's2-angle', kind: 'text', x: 365, y: 345, text: 'θ', color: '#D97706', fontSize: 14, fontWeight: 'bold' },
            ],
          }),
          stepLabels: [
            { label: 'Step 1: Vertical Gravity mg', description: 'Draw weight mg straight down toward Earth center.' },
            { label: 'Step 2: Perpendicular Component', description: 'Project mg cos θ along the inward normal axis.' },
            { label: 'Step 3: Driving Component', description: 'Project mg sin θ down the incline plane.' },
          ],
        },
        {
          sceneNumber: 3,
          durationSeconds: 9,
          heading: 'Normal Reaction N & Limiting Friction f_max',
          teachingPoint: 'Perpendicular equilibrium gives N = mg cos θ, which sets the maximum static friction threshold f_s,max = μ_s mg cos θ.',
          narration: `Since the block neither sinks into nor lifts off the wedge, the normal force N balances mg cos θ. Friction opposes impending slip up to a maximum value of μ mg cos θ.`,
          visualCue: 'Normal vector N balancing mg cos θ and friction vector f opposing motion',
          keyFormula: 'N = mg cos θ,   f_max = μ mg cos θ',
          animationMode: 'projectile_arc',
          highlightValues: ['N = mg cos θ', 'f ≤ μ_s N', 'Angle of repose: tan θ_r = μ_s'],
          citedPages: verifiedPages,
          isSupportedByMaterial: isSupported,
          spec: makeSceneDiagramSpec({
            title: 'Scene 3: Normal Force & Friction Threshold',
            subject: 'Physics',
            category: 'free_body_diagram',
            description: 'Normal reaction N = mg cos θ and opposing friction f = μN.',
            citedPages: verifiedPages,
            assumptions: ['Coulomb dry friction between block and incline', 'Angle of repose tan θ_c = μ_s'],
            elements: [
              { id: 's3-ramp', kind: 'line', startX: 100, startY: 410, endX: 560, endY: 180, color: '#475569', strokeWidth: 3 },
              { id: 's3-block', kind: 'rect', x: 300, y: 245, width: 84, height: 52, rx: 6, stroke: '#4F46E5', fill: '#EEF2FF', label: 'Block m' },
              { id: 's3-normal', kind: 'arrow', startX: 342, startY: 271, endX: 282, endY: 150, color: '#10B981', strokeWidth: 3, label: 'N = mg cos θ' },
              { id: 's3-mgcos', kind: 'arrow', startX: 342, startY: 271, endX: 402, endY: 390, color: '#D97706', strokeWidth: 2.5, dashed: true, label: 'mg cos θ' },
              { id: 's3-friction', kind: 'arrow', startX: 362, startY: 260, endX: 475, endY: 202, color: '#8B5CF6', strokeWidth: 3, label: 'f = μ mg cos θ' },
              { id: 's3-note', kind: 'text', x: 120, y: 95, text: 'Equilibrium along y: ΣF_y = N − mg cos θ = 0', color: '#0F172A', fontSize: 14, fontWeight: 'bold' },
            ],
          }),
          stepLabels: [
            { label: 'Step 1: Normal Balance', description: 'Surface exerts normal reaction N = mg cos θ.' },
            { label: 'Step 2: Opposing Friction', description: 'Friction f acts up the incline opposing downward slip.' },
            { label: 'Step 3: Limiting Condition', description: 'Compare mg sin θ with f_max = μ_s mg cos θ.' },
          ],
        },
        {
          sceneNumber: 4,
          durationSeconds: 8,
          heading: 'Net Downward Acceleration & JEE Exam Takeaway',
          teachingPoint: 'When tan θ > μ_k, the block accelerates down the ramp at a = g(sin θ − μ_k cos θ), independent of the block mass m.',
          narration: `Applying Newton's Second Law along the ramp gives m a = mg sin θ − μ_k mg cos θ. Dividing by m yields a = g(sin θ − μ_k cos θ)—notice that mass m cancels out completely!`,
          visualCue: 'Complete Free-Body Diagram with net acceleration vector a = g(sin θ − μ cos θ)',
          keyFormula: 'a = g (sin θ − μ_k cos θ)',
          animationMode: 'projectile_arc',
          highlightValues: ['Mass m cancels out', 'Smooth ramp: a = g sin θ', 'tan θ > μ_s for motion'],
          citedPages: verifiedPages,
          isSupportedByMaterial: isSupported,
          spec: getDeterministicDiagramTemplate(`Inclined plane FBD: ${cleanTopic}`, contextText, verifiedPages),
          stepLabels: [
            { label: 'Step 1: Ramp & Block Setup', description: 'Establish the inclined surface and block of mass m.' },
            { label: 'Step 2: All Four Force Vectors', description: 'Combine weight mg, normal N, and kinetic friction f_k.' },
            { label: 'Step 3: Net Acceleration a', description: 'Compute resultant acceleration a = g(sin θ − μ_k cos θ).' },
          ],
        },
      ];

      return rawScenes.map(({ stepLabels, ...scene }) =>
        attachConceptMasteryToScene(
          {
            ...scene,
            progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
          },
          cleanTopic,
          subject
        )
      );
    }

    // Default Physics: Projectile Motion & 2D Kinematics (4 scenes)
    const rawPhysicsScenes: Array<Omit<AnimatedExplanationScene, 'progressiveSteps'> & {
      stepLabels: Array<{ label: string; description: string }>;
    }> = [
      {
        sceneNumber: 1,
        durationSeconds: 8,
        heading: `Launch Vector Decomposition: ${cleanTopic}`,
        teachingPoint: 'Resolve initial velocity u at launch angle θ into independent horizontal u cos θ and vertical u sin θ components.',
        narration: `Let's break down ${cleanTopic}. A projectile launched at speed u and angle θ has horizontal velocity u_x = u cos θ (which stays constant) and initial vertical velocity u_y = u sin θ.`,
        visualCue: 'Initial velocity vector u decomposing into orthogonal u cos θ and u sin θ vectors',
        keyFormula: 'u_x = u cos θ,   u_y = u sin θ',
        animationMode: 'projectile_arc',
        highlightValues: ['a_x = 0 m/s²', 'a_y = −g', 'u_x = u cos θ'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: `Scene 1: Velocity Decomposition (${cleanTopic})`,
          subject: 'Physics',
          category: 'scientific_diagram',
          description: 'Initial launch velocity u resolved into horizontal u cos θ and vertical u sin θ.',
          citedPages: verifiedPages,
          assumptions: ['Negligible air resistance', 'Uniform gravity g = 9.8 m/s² downward'],
          elements: [
            { id: 'p1-xaxis', kind: 'arrow', startX: 80, startY: 400, endX: 640, endY: 400, color: '#475569', strokeWidth: 2, label: 'x (Horizontal)' },
            { id: 'p1-yaxis', kind: 'arrow', startX: 100, startY: 420, endX: 100, endY: 90, color: '#475569', strokeWidth: 2, label: 'y (Vertical)' },
            { id: 'p1-ux', kind: 'arrow', startX: 100, startY: 400, endX: 320, endY: 400, color: '#0EA5E9', strokeWidth: 3, label: 'u_x = u cos θ' },
            { id: 'p1-uy', kind: 'arrow', startX: 100, startY: 400, endX: 100, endY: 190, color: '#10B981', strokeWidth: 3, label: 'u_y = u sin θ' },
            { id: 'p1-u', kind: 'arrow', startX: 100, startY: 400, endX: 320, endY: 190, color: '#D97706', strokeWidth: 3.5, label: 'u (Launch Speed)' },
            { id: 'p1-arc', kind: 'arc', cx: 100, cy: 400, r: 65, startAngleDeg: 0, endAngleDeg: 44, color: '#D97706', label: 'θ' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Ground & Axes', description: 'Set origin (0,0) at the launch point with +x horizontal and +y vertical.' },
          { label: 'Step 2: Orthogonal Components', description: 'Project u_x = u cos θ horizontally and u_y = u sin θ vertically.' },
          { label: 'Step 3: Resultant Launch Vector', description: 'Combine components at launch angle θ.' },
        ],
      },
      {
        sceneNumber: 2,
        durationSeconds: 9,
        heading: 'Climb to Apex & Maximum Height H_max',
        teachingPoint: 'At the highest point (apex), vertical velocity v_y becomes zero while horizontal velocity remains u cos θ.',
        narration: `As the projectile rises, gravity reduces vertical speed at rate g. At time t = u sin θ / g, v_y hits zero at maximum altitude H_max = u² sin²θ / (2g), where speed is minimum and equal to u cos θ.`,
        visualCue: 'Rising trajectory reaching apex H_max where vertical velocity vanishes',
        keyFormula: 'H_max = (u² sin²θ) / (2g)',
        animationMode: 'projectile_arc',
        highlightValues: ['v_y(apex) = 0', 'v_apex = u cos θ', 't_ascent = u sin θ / g'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: 'Scene 2: Apex Condition & Maximum Height',
          subject: 'Physics',
          category: 'scientific_diagram',
          description: 'Trajectory climb to H_max showing purely horizontal velocity at the apex.',
          citedPages: verifiedPages,
          assumptions: ['Flat horizontal ground', 'v_y = 0 at apex, K_apex = K_0 cos²θ'],
          elements: [
            { id: 'p2-xaxis', kind: 'arrow', startX: 80, startY: 410, endX: 650, endY: 410, color: '#475569', strokeWidth: 2 },
            { id: 'p2-curve', kind: 'path', d: 'M 90 410 Q 240 155 385 155', stroke: '#4F46E5', strokeWidth: 3, fill: 'none', label: 'Ascent Arc' },
            { id: 'p2-hmax', kind: 'line', startX: 385, startY: 155, endX: 385, endY: 410, color: '#10B981', dashed: true, strokeWidth: 2, label: 'H_max = u²sin²θ/(2g)' },
            { id: 'p2-vapex', kind: 'arrow', startX: 385, startY: 155, endX: 505, endY: 155, color: '#0EA5E9', strokeWidth: 3, label: 'v_apex = u cos θ (v_y = 0)' },
            { id: 'p2-g', kind: 'arrow', startX: 385, startY: 175, endX: 385, endY: 260, color: '#EF4444', strokeWidth: 2.5, label: 'g' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Ascent Curve', description: 'Trace the upward parabolic path under downward acceleration g.' },
          { label: 'Step 2: Apex Altitude H_max', description: 'Mark the peak height where vertical velocity v_y = 0.' },
          { label: 'Step 3: Apex Velocity Vector', description: 'Only horizontal velocity u cos θ remains at the top.' },
        ],
      },
      {
        sceneNumber: 3,
        durationSeconds: 9,
        heading: 'Total Time of Flight & Horizontal Range R',
        teachingPoint: 'Symmetry of ascent and descent gives total flight time T = 2u sin θ / g and horizontal range R = u² sin 2θ / g.',
        narration: `Because descent mirrors ascent on level ground, total time of flight is T = 2u sin θ / g. Multiplying constant horizontal speed u cos θ by T yields the range formula R = u² sin 2θ / g.`,
        visualCue: 'Full symmetric parabolic trajectory landing at x = R',
        keyFormula: 'T = (2u sin θ) / g,   R = (u² sin 2θ) / g',
        animationMode: 'projectile_arc',
        highlightValues: ['T = 2 t_ascent', 'R = u_x · T', 'R_max = u²/g at θ = 45°'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: `Scene 3: Range & Time of Flight (${cleanTopic})`,
          subject: 'Physics',
          category: 'scientific_diagram',
          description: 'Full symmetric parabolic arc landing at horizontal range R = u² sin 2θ / g.',
          citedPages: verifiedPages,
          assumptions: ['Launch and landing at same elevation y = 0', 'T = 2u sin θ / g'],
          elements: [
            { id: 'p3-xaxis', kind: 'arrow', startX: 70, startY: 400, endX: 650, endY: 400, color: '#475569', strokeWidth: 2 },
            { id: 'p3-arc', kind: 'path', d: 'M 90 400 Q 350 90 610 400', stroke: '#4F46E5', strokeWidth: 3, fill: 'none' },
            { id: 'p3-hmax', kind: 'line', startX: 350, startY: 245, endX: 350, endY: 400, color: '#10B981', dashed: true, strokeWidth: 2, label: 'H_max' },
            { id: 'p3-range', kind: 'arrow', startX: 90, startY: 435, endX: 610, endY: 435, color: '#D97706', strokeWidth: 2.5, label: 'Range R = (u² sin 2θ) / g' },
            { id: 'p3-land', kind: 'circle', cx: 610, cy: 400, r: 6, fill: '#EF4444', stroke: '#EF4444', label: 'Impact (x = R)' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Full Parabolic Arc', description: 'Complete the symmetric trajectory back to y = 0.' },
          { label: 'Step 2: Apex Symmetry Line', description: 'Verify apex occurs at x = R/2 and t = T/2.' },
          { label: 'Step 3: Horizontal Range R', description: 'Measure total horizontal distance R = u² sin 2θ / g.' },
        ],
      },
      {
        sceneNumber: 4,
        durationSeconds: 8,
        heading: 'Equation of Trajectory & Complementary Launch Angles',
        teachingPoint: 'Eliminating time t gives the parabola y = x tan θ − gx²/(2u² cos²θ), and angles θ and (90° − θ) yield equal range R.',
        narration: `For JEE Main numericals, remember the time-independent trajectory equation y = x tan θ (1 − x/R) and that complementary launch angles like 30° and 60° land at the exact same horizontal range!`,
        visualCue: 'Comparison of θ = 30°, 45°, and 60° trajectories sharing range symmetries',
        keyFormula: 'y = x tan θ (1 − x / R)',
        animationMode: 'projectile_arc',
        highlightValues: ['R(30°) = R(60°)', 'H₁ / H₂ = tan²θ', 'R_max = 4 H_max (at 45°)'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: 'Scene 4: Complementary Angles & Trajectory Law',
          subject: 'Physics',
          category: 'scientific_diagram',
          description: 'Comparison of 30°, 45° (maximum range), and 60° projectile arcs.',
          citedPages: verifiedPages,
          assumptions: ['Same initial speed u for all three launch angles', 'R(θ) = R(90° − θ)'],
          elements: [
            { id: 'p4-axes', kind: 'arrow', startX: 80, startY: 410, endX: 660, endY: 410, color: '#475569', strokeWidth: 2, label: 'x (Range)' },
            { id: 'p4-arc45', kind: 'path', d: 'M 80 410 Q 360 150 640 410', stroke: '#4F46E5', strokeWidth: 3, fill: 'none' },
            { id: 'p4-arc60', kind: 'path', d: 'M 80 410 Q 295 70 510 410', stroke: '#EC4899', strokeWidth: 2.5, dashed: true, fill: 'none' },
            { id: 'p4-arc30', kind: 'path', d: 'M 80 410 Q 295 280 510 410', stroke: '#10B981', strokeWidth: 2.5, dashed: true, fill: 'none' },
            { id: 'p4-sameR', kind: 'circle', cx: 510, cy: 410, r: 7, stroke: '#D97706', fill: '#D97706', label: 'R(30°) = R(60°)' },
            { id: 'p4-txt', kind: 'text', x: 350, y: 70, text: 'θ = 45° gives R_max; 30° & 60° share equal Range R', fontSize: 13, fontWeight: 'bold', color: '#0F172A', textAnchor: 'middle' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Maximum Range Arc (45°)', description: 'Plot the 45° trajectory achieving R_max = u²/g.' },
          { label: 'Step 2: High-Angle Arc (60°)', description: 'Plot the steeper 60° trajectory with higher apex.' },
          { label: 'Step 3: Complementary Match (30°)', description: 'Verify 30° and 60° land at the identical range R.' },
        ],
      },
    ];

    return rawPhysicsScenes.map(({ stepLabels, ...scene }) =>
      attachConceptMasteryToScene(
        {
          ...scene,
          progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
        },
        cleanTopic,
        subject
      )
    );
  }

  if (subject === 'Chemistry') {
    const rawChemistryScenes: Array<Omit<AnimatedExplanationScene, 'progressiveSteps'> & {
      stepLabels: Array<{ label: string; description: string }>;
    }> = [
      {
        sceneNumber: 1,
        durationSeconds: 8,
        heading: `Valence Shell & Steric Number: ${cleanTopic}`,
        teachingPoint: 'Steric Number SN = ½(V + M − C + A) counts total σ-bond pairs plus lone pairs around the central atom.',
        narration: `In ${cleanTopic}, start by finding the Steric Number of the central atom: add valence electrons V and monovalent attached atoms M, subtract cationic charge C, add anionic charge A, and divide by 2.`,
        visualCue: 'Central oxygen/carbon valence shell showing bonding σ-domains and non-bonding lone pairs',
        keyFormula: 'SN = ½ (V + M − C + A) = BP + LP',
        animationMode: 'molecule_bonds',
        highlightValues: ['CH₄: SN = 4 (4 BP, 0 LP)', 'NH₃: SN = 4 (3 BP, 1 LP)', 'H₂O: SN = 4 (2 BP, 2 LP)'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: `Scene 1: Steric Number & Electron Domains (${cleanTopic})`,
          subject: 'Chemistry',
          category: 'molecular_shape',
          description: 'Four sp³ electron domains arranged around a central atom.',
          citedPages: verifiedPages,
          assumptions: ['VSEPR valence shell electron-pair repulsion model', 'SN = 4 ⇒ sp³ hybridization'],
          elements: [
            { id: 'c1-center', kind: 'circle', cx: 350, cy: 250, r: 34, stroke: '#4F46E5', fill: '#EEF2FF', label: 'Central Atom (SN=4)' },
            { id: 'c1-d1', kind: 'line', startX: 350, startY: 216, endX: 350, endY: 110, color: '#10B981', strokeWidth: 3, label: 'Domain 1' },
            { id: 'c1-d2', kind: 'line', startX: 320, startY: 268, endX: 200, endY: 350, color: '#10B981', strokeWidth: 3, label: 'Domain 2' },
            { id: 'c1-d3', kind: 'line', startX: 380, startY: 268, endX: 500, endY: 350, color: '#10B981', strokeWidth: 3, label: 'Domain 3' },
            { id: 'c1-d4', kind: 'line', startX: 375, startY: 225, endX: 495, endY: 150, color: '#0EA5E9', strokeWidth: 3, dashed: true, label: 'Domain 4' },
            { id: 'c1-note', kind: 'text', x: 350, y: 430, text: '4 Electron Domains → Tetrahedral Electron Geometry (sp³)', color: '#0F172A', fontSize: 14, fontWeight: 'bold', textAnchor: 'middle' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Central Valence Shell', description: 'Count valence electrons of the central atom.' },
          { label: 'Step 2: Sigma Bonding Domains', description: 'Attach σ-bonded ligands around the core.' },
          { label: 'Step 3: Total Steric Number', description: 'Sum bonding pairs + lone pairs to fix hybridization.' },
        ],
      },
      {
        sceneNumber: 2,
        durationSeconds: 9,
        heading: 'VSEPR Repulsion Hierarchy: LP–LP > LP–BP > BP–BP',
        teachingPoint: 'Lone pairs occupy more angular volume near the central nucleus than shared bond pairs, repelling adjacent domains more strongly.',
        narration: `A lone pair is attracted by only one nucleus, so its electron cloud spreads out wider than a shared bonding pair. According to VSEPR theory, repulsion follows Lone Pair–Lone Pair > Lone Pair–Bond Pair > Bond Pair–Bond Pair.`,
        visualCue: 'Water (H₂O) molecule showing two diffuse lone pairs pushing O–H bonds closer together',
        keyFormula: 'Repulsion: LP–LP > LP–BP > BP–BP',
        animationMode: 'molecule_bonds',
        highlightValues: ['2 Lone Pairs on O', '2 O–H Sigma Bonds', 'Bent Molecular Shape'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: getDeterministicDiagramTemplate(`VSEPR molecular shape H2O: ${cleanTopic}`, contextText, verifiedPages),
        stepLabels: [
          { label: 'Step 1: Central Oxygen & Hydrogens', description: 'Place central Oxygen atom and two Hydrogen atoms.' },
          { label: 'Step 2: Covalent O–H Bonds & Lone Pairs', description: 'Add the two σ-bonds and two non-bonding lone pair lobes.' },
          { label: 'Step 3: Repulsion & Compressed Angle', description: 'LP–LP repulsion compresses the H–O–H angle to 104.5°.' },
        ],
      },
      {
        sceneNumber: 3,
        durationSeconds: 9,
        heading: 'Bond Angle Trend Across CH₄, NH₃, and H₂O',
        teachingPoint: 'Adding each lone pair in an sp³ series reduces the bond angle by ~2.5°: CH₄ (109.5°) → NH₃ (107.0°) → H₂O (104.5°).',
        narration: `All three molecules—Methane, Ammonia, and Water—share sp³ hybridization with steric number 4. Yet as lone pairs increase from 0 to 1 to 2, the bond angle drops from 109.5° to 107° to 104.5°.`,
        visualCue: 'Side-by-side comparison of CH₄ (109.5°), NH₃ (107°), and H₂O (104.5°) bond angles',
        keyFormula: 'θ(CH₄: 109.5°) > θ(NH₃: 107.0°) > θ(H₂O: 104.5°)',
        animationMode: 'molecule_bonds',
        highlightValues: ['CH₄: Tetrahedral (0 LP)', 'NH₃: Trigonal Pyramidal (1 LP)', 'H₂O: Bent / V-Shape (2 LP)'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: 'Scene 3: Isoelectronic sp³ Bond Angle Comparison',
          subject: 'Chemistry',
          category: 'molecular_shape',
          description: 'Progressive compression of bond angles from CH₄ (109.5°) to NH₃ (107°) to H₂O (104.5°).',
          citedPages: verifiedPages,
          assumptions: ['Second-period hydrides with sp³ central atoms'],
          elements: [
            { id: 'c3-ch4', kind: 'rect', x: 50, y: 160, width: 170, height: 140, rx: 10, stroke: '#10B981', fill: '#ECFDF5', label: 'CH₄ • 0 LP • 109.5°' },
            { id: 'c3-nh3', kind: 'rect', x: 265, y: 160, width: 170, height: 140, rx: 10, stroke: '#D97706', fill: '#FFFBEB', label: 'NH₃ • 1 LP • 107.0°' },
            { id: 'c3-h2o', kind: 'rect', x: 480, y: 160, width: 170, height: 140, rx: 10, stroke: '#EF4444', fill: '#FEF2F2', label: 'H₂O • 2 LP • 104.5°' },
            { id: 'c3-arrow1', kind: 'arrow', startX: 222, startY: 230, endX: 262, endY: 230, color: '#64748B', strokeWidth: 2.5, label: '+1 LP' },
            { id: 'c3-arrow2', kind: 'arrow', startX: 437, startY: 230, endX: 477, endY: 230, color: '#64748B', strokeWidth: 2.5, label: '+1 LP' },
            { id: 'c3-caption', kind: 'text', x: 350, y: 390, text: 'Electron Geometry stays Tetrahedral (sp³), but Molecular Shape compresses!', color: '#0F172A', fontSize: 14, fontWeight: 'bold', textAnchor: 'middle' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: CH₄ (0 Lone Pairs)', description: 'Ideal symmetric tetrahedron with 109.5° H–C–H angles.' },
          { label: 'Step 2: NH₃ (1 Lone Pair)', description: 'One lone pair compresses H–N–H angles to 107.0°.' },
          { label: 'Step 3: H₂O (2 Lone Pairs)', description: 'Two lone pairs compress H–O–H angle further to 104.5°.' },
        ],
      },
      {
        sceneNumber: 4,
        durationSeconds: 8,
        heading: 'Dipole Moment Vector Sum & Polarity Check',
        teachingPoint: 'Net dipole moment μ_net is the vector sum of bond dipoles and lone-pair dipoles; symmetric cancellation yields μ = 0.',
        narration: `Finally, check molecular polarity for JEE Main: in CH₄ and CO₂, symmetric bond dipoles cancel out to give μ = 0 (non-polar), whereas H₂O and NH₃ have a non-zero resultant dipole moment.`,
        visualCue: 'Bond dipole vectors adding constructively in H₂O (μ = 1.85 D) vs cancelling in CO₂ (μ = 0 D)',
        keyFormula: 'μ_net = |Σ μ_i|   (H₂O: μ = 1.85 D > 0)',
        animationMode: 'molecule_bonds',
        highlightValues: ['CH₄, CO₂, CCl₄: μ = 0 D', 'H₂O: μ = 1.85 D (Polar)', 'NH₃ > NF₃ dipole trap'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: 'Scene 4: Resultant Dipole Moment & Polarity',
          subject: 'Chemistry',
          category: 'molecular_shape',
          description: 'Vector addition of O–H bond dipoles producing a net upward molecular dipole μ_net.',
          citedPages: verifiedPages,
          assumptions: ['Dipole vector points from δ+ (less electronegative) to δ− (more electronegative)'],
          elements: [
            { id: 'c4-o', kind: 'circle', cx: 350, cy: 250, r: 32, stroke: '#EF4444', fill: '#FEE2E2', label: 'O (δ−)' },
            { id: 'c4-h1', kind: 'circle', cx: 215, cy: 365, r: 22, stroke: '#3B82F6', fill: '#DBEAFE', label: 'H (δ+)' },
            { id: 'c4-h2', kind: 'circle', cx: 485, cy: 365, r: 22, stroke: '#3B82F6', fill: '#DBEAFE', label: 'H (δ+)' },
            { id: 'c4-d1', kind: 'arrow', startX: 235, startY: 348, endX: 325, endY: 272, color: '#0EA5E9', strokeWidth: 3, label: 'μ_OH' },
            { id: 'c4-d2', kind: 'arrow', startX: 465, startY: 348, endX: 375, endY: 272, color: '#0EA5E9', strokeWidth: 3, label: 'μ_OH' },
            { id: 'c4-net', kind: 'arrow', startX: 350, startY: 215, endX: 350, endY: 105, color: '#10B981', strokeWidth: 3.5, label: 'μ_net = 1.85 D (Polar)' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Electronegativity Charges', description: 'Mark partial charges δ+ on H and δ− on O.' },
          { label: 'Step 2: Individual Bond Dipoles', description: 'Draw bond dipole vectors pointing from H toward O.' },
          { label: 'Step 3: Resultant Dipole μ_net', description: 'Sum the vectors to obtain net dipole μ_net = 1.85 D.' },
        ],
      },
    ];

    return rawChemistryScenes.map(({ stepLabels, ...scene }) =>
      attachConceptMasteryToScene(
        {
          ...scene,
          progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
        },
        cleanTopic,
        subject
      )
    );
  }

  // Mathematics: check if Conic / Parabola / Quadratic vs Probability & Bayes' Theorem
  if (
    lower.includes('quadratic') ||
    lower.includes('parabola') ||
    lower.includes('conic') ||
    lower.includes('latus rectum') ||
    lower.includes('directrix')
  ) {
    const rawConicScenes: Array<Omit<AnimatedExplanationScene, 'progressiveSteps'> & {
      stepLabels: Array<{ label: string; description: string }>;
    }> = [
      {
        sceneNumber: 1,
        durationSeconds: 8,
        heading: `Conic Definition & Locus of a Parabola: ${cleanTopic}`,
        teachingPoint: 'A parabola is the locus of points equidistant from a fixed focus S(a, 0) and a fixed directrix line x = −a (eccentricity e = 1).',
        narration: `In JEE Coordinate Geometry, a standard parabola y² = 4ax is defined by eccentricity e = 1: for any point P(x, y) on the curve, its distance PS to the focus S(a, 0) equals its perpendicular distance PM to the directrix x = −a.`,
        visualCue: 'Coordinate plane with vertex (0,0), focus S(a,0), and directrix x = −a',
        keyFormula: 'PS = PM   ⇒   y² = 4ax   (e = 1)',
        animationMode: 'quadratic_curve',
        highlightValues: ['Vertex V(0, 0)', 'Focus S(a, 0)', 'Directrix x + a = 0'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: `Scene 1: Focus-Directrix Locus (${cleanTopic})`,
          subject: 'Mathematics',
          category: 'conic',
          description: 'Locus definition PS = PM for the standard parabola y² = 4ax.',
          citedPages: verifiedPages,
          assumptions: ['a > 0, axis of parabola along +x axis', 'Eccentricity e = PS / PM = 1'],
          elements: [
            { id: 'm1-xaxis', kind: 'arrow', startX: 80, startY: 250, endX: 640, endY: 250, color: '#475569', strokeWidth: 2, label: 'x' },
            { id: 'm1-yaxis', kind: 'arrow', startX: 300, startY: 430, endX: 300, endY: 70, color: '#475569', strokeWidth: 2, label: 'y' },
            { id: 'm1-dir', kind: 'line', startX: 190, startY: 70, endX: 190, endY: 430, color: '#EF4444', strokeWidth: 2.5, dashed: true, label: 'Directrix x = −a' },
            { id: 'm1-focus', kind: 'circle', cx: 410, cy: 250, r: 6, stroke: '#D97706', fill: '#D97706', label: 'Focus S(a, 0)' },
            { id: 'm1-pt', kind: 'circle', cx: 470, cy: 130, r: 6, stroke: '#4F46E5', fill: '#4F46E5', label: 'P(x, y)' },
            { id: 'm1-ps', kind: 'line', startX: 410, startY: 250, endX: 470, endY: 130, color: '#10B981', strokeWidth: 2.5, label: 'PS = x + a' },
            { id: 'm1-pm', kind: 'line', startX: 190, startY: 130, endX: 470, endY: 130, color: '#10B981', strokeWidth: 2.5, dashed: true, label: 'PM = x + a' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Axes & Directrix', description: 'Draw Cartesian axes and directrix line x = −a.' },
          { label: 'Step 2: Focus S(a, 0) & Point P', description: 'Mark the focus S(a, 0) and general locus point P(x, y).' },
          { label: 'Step 3: Equidistant Condition PS = PM', description: 'Equate PS = PM to derive y² = 4ax.' },
        ],
      },
      {
        sceneNumber: 2,
        durationSeconds: 9,
        heading: 'Latus Rectum & Focal Chord Properties',
        teachingPoint: 'The latus rectum through S(a, 0) has endpoints (a, ±2a) and total length 4a.',
        narration: `Setting x = a in y² = 4ax gives y = ±2a. Therefore, the latus rectum chord perpendicular to the axis at the focus has endpoints L(a, 2a) and L′(a, −2a), giving a total latus rectum length of 4a.`,
        visualCue: 'Parabola y² = 4ax highlighting Latus Rectum chord of length 4a through focus S',
        keyFormula: 'Length of Latus Rectum = 4a,   Endpoints = (a, ±2a)',
        animationMode: 'quadratic_curve',
        highlightValues: ['L(a, 2a) & L′(a, −2a)', 'Focal distance = x + a', 'Semi-latus rectum = 2a'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: getDeterministicDiagramTemplate(`Parabola conic latus rectum: ${cleanTopic}`, contextText, verifiedPages),
        stepLabels: [
          { label: 'Step 1: Coordinate Axes & Directrix', description: 'Plot the x-y frame and directrix x = −a.' },
          { label: 'Step 2: Parabolic Curve y² = 4ax', description: 'Trace the symmetric curve through vertex V(0, 0).' },
          { label: 'Step 3: Focus & Latus Rectum 4a', description: 'Draw the vertical focal chord of length 4a through S(a, 0).' },
        ],
      },
      {
        sceneNumber: 3,
        durationSeconds: 9,
        heading: 'Parametric Coordinates & Tangent Equation',
        teachingPoint: 'Every point on y² = 4ax can be parameterized as (at², 2at), where the tangent has slope 1/t and equation ty = x + at².',
        narration: `Substituting x = at² and y = 2at identically satisfies y² = 4ax for any real parameter t. Differentiating gives dy/dx = 2a/y = 1/t, yielding the clean tangent equation ty = x + at².`,
        visualCue: 'Tangent line ty = x + at² touching parabola at P(at², 2at) and meeting x-axis at (−at², 0)',
        keyFormula: 'P(t) = (at², 2at),   Tangent: t·y = x + a·t²',
        animationMode: 'quadratic_curve',
        highlightValues: ['Slope of tangent m = 1/t', 'Tangent in slope form: y = mx + a/m', 'Normal slope = −t'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: 'Scene 3: Parametric Point & Tangent Line',
          subject: 'Mathematics',
          category: 'conic',
          description: 'Tangent ty = x + at² at parametric point P(at², 2at) on y² = 4ax.',
          citedPages: verifiedPages,
          assumptions: ['t ≠ 0 for finite non-vertical slope m = 1/t'],
          elements: [
            { id: 'm3-xaxis', kind: 'arrow', startX: 80, startY: 260, endX: 640, endY: 260, color: '#475569', strokeWidth: 2, label: 'x' },
            { id: 'm3-curve', kind: 'path', d: 'M 540 90 Q 100 260 540 430', stroke: '#4F46E5', strokeWidth: 3, fill: 'none', label: 'y² = 4ax' },
            { id: 'm3-pt', kind: 'circle', cx: 420, cy: 150, r: 6, stroke: '#10B981', fill: '#10B981', label: 'P(at², 2at)' },
            { id: 'm3-tan', kind: 'line', startX: 180, startY: 260, endX: 540, endY: 95, color: '#EC4899', strokeWidth: 2.5, label: 'Tangent: ty = x + at²' },
            { id: 'm3-xint', kind: 'circle', cx: 180, cy: 260, r: 5, stroke: '#D97706', fill: '#D97706', label: 'T(−at², 0)' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Parabolic Locus', description: 'Plot the curve y² = 4ax with vertex at (0, 0).' },
          { label: 'Step 2: Parametric Point P(t)', description: 'Locate P(at², 2at) on the upper branch.' },
          { label: 'Step 3: Tangent Line ty = x + at²', description: 'Draw the tangent intersecting the axis at (−at², 0).' },
        ],
      },
      {
        sceneNumber: 4,
        durationSeconds: 8,
        heading: 'Quadratic Discriminant Δ = b² − 4ac & Tangency Condition',
        teachingPoint: 'Setting discriminant Δ = 0 for a line and conic intersection immediately gives the condition of tangency c = a/m.',
        narration: `To test whether a line y = mx + c is secant, tangent, or external to a parabola or quadratic curve, substitute and check the discriminant Δ: two intersections when Δ > 0, a single tangent point when Δ = 0 (c = a/m), and none when Δ < 0.`,
        visualCue: 'Comparison of secant (Δ > 0), tangent (Δ = 0, c = a/m), and non-intersecting (Δ < 0) lines',
        keyFormula: 'Δ = 0   ⇔   c = a / m   (Point of contact: (a/m², 2a/m))',
        animationMode: 'quadratic_curve',
        highlightValues: ['Δ > 0: Secant (2 pts)', 'Δ = 0: Tangent (c = a/m)', 'Director circle: x = −a'],
        citedPages: verifiedPages,
        isSupportedByMaterial: isSupported,
        spec: makeSceneDiagramSpec({
          title: 'Scene 4: Discriminant & Tangency Condition',
          subject: 'Mathematics',
          category: 'conic',
          description: 'Secant (Δ > 0), tangent (Δ = 0), and external (Δ < 0) lines relative to a parabola.',
          citedPages: verifiedPages,
          assumptions: ['Real coefficients and non-zero slope m', 'Tangency condition c = a/m'],
          elements: [
            { id: 'm4-xaxis', kind: 'arrow', startX: 100, startY: 360, endX: 620, endY: 360, color: '#475569', strokeWidth: 2, label: 'x' },
            { id: 'm4-parab', kind: 'path', d: 'M 160 110 Q 360 550 560 110', stroke: '#4F46E5', strokeWidth: 3, fill: 'none', label: 'Quadratic Curve' },
            { id: 'm4-sec', kind: 'line', startX: 140, startY: 210, endX: 580, endY: 210, color: '#10B981', strokeWidth: 2, label: 'Δ > 0 (2 Real Roots)' },
            { id: 'm4-tan', kind: 'line', startX: 140, startY: 330, endX: 580, endY: 330, color: '#D97706', strokeWidth: 2.5, label: 'Δ = 0 (Tangent Vertex)' },
            { id: 'm4-ext', kind: 'line', startX: 140, startY: 420, endX: 580, endY: 420, color: '#EF4444', strokeWidth: 2, dashed: true, label: 'Δ < 0 (No Real Intersection)' },
          ],
        }),
        stepLabels: [
          { label: 'Step 1: Parabolic Curve', description: 'Plot the quadratic curve on the coordinate plane.' },
          { label: 'Step 2: Secant vs Tangent (Δ ≥ 0)', description: 'Compare two-point secant intersection with single-point tangency.' },
          { label: 'Step 3: Non-Intersecting Line (Δ < 0)', description: 'Verify negative discriminant yields zero real intersections.' },
        ],
      },
    ];

    return rawConicScenes.map(({ stepLabels, ...scene }) =>
      attachConceptMasteryToScene(
        {
          ...scene,
          progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
        },
        cleanTopic,
        subject
      )
    );
  }

  // Default Mathematics (aligned with built-in JEE Sample Chapter: Probability, Conditional Probability & Bayes' Theorem)
  const rawMathScenes: Array<Omit<AnimatedExplanationScene, 'progressiveSteps'> & {
    stepLabels: Array<{ label: string; description: string }>;
  }> = [
    {
      sceneNumber: 1,
      durationSeconds: 8,
      heading: `Sample Space Partition & Axioms: ${cleanTopic}`,
      teachingPoint: 'Partition the sample space S into mutually exclusive and exhaustive hypotheses E₁ and E₂ whose prior probabilities sum to 1.',
      narration: `Let's build a clear visual intuition for ${cleanTopic}. We start with the entire sample space S partitioned into disjoint hypotheses E₁ (prior probability P(E₁)) and E₂ (prior probability P(E₂) = 1 − P(E₁)).`,
      visualCue: 'Sample space S branching into mutually exclusive prior events E₁ and E₂',
      keyFormula: 'P(E₁) + P(E₂) = 1,   E₁ ∩ E₂ = ∅',
      animationMode: 'probability_tree',
      highlightValues: ['Prior P(E₁) = 0.01 (1%)', 'Complement P(E₂) = 0.99 (99%)', 'P(S) = 1'],
      citedPages: verifiedPages,
      isSupportedByMaterial: isSupported,
      spec: makeSceneDiagramSpec({
        title: `Scene 1: Sample Space & Prior Partition (${cleanTopic})`,
        subject: 'Mathematics',
        category: 'scientific_diagram',
        description: 'Partition of sample space S into disjoint prior hypotheses E₁ and E₂.',
        citedPages: verifiedPages,
        assumptions: ['E₁ and E₂ are mutually exclusive and exhaustive events', 'P(E₁) + P(E₂) = 1'],
        elements: [
          { id: 'b1-root', kind: 'circle', cx: 130, cy: 250, r: 34, stroke: '#4F46E5', fill: '#EEF2FF', label: 'Sample Space S' },
          { id: 'b1-br1', kind: 'arrow', startX: 164, startY: 235, endX: 380, endY: 140, color: '#10B981', strokeWidth: 3, label: 'P(E₁) = 0.01' },
          { id: 'b1-br2', kind: 'arrow', startX: 164, startY: 265, endX: 380, endY: 360, color: '#D97706', strokeWidth: 3, label: 'P(E₂) = 0.99' },
          { id: 'b1-e1', kind: 'rect', x: 390, y: 108, width: 220, height: 64, rx: 8, stroke: '#10B981', fill: '#ECFDF5', label: 'Hypothesis E₁ (Has Disease)' },
          { id: 'b1-e2', kind: 'rect', x: 390, y: 328, width: 220, height: 64, rx: 8, stroke: '#D97706', fill: '#FFFBEB', label: 'Hypothesis E₂ (Healthy)' },
        ],
      }),
      stepLabels: [
        { label: 'Step 1: Sample Space Root S', description: 'Start from total probability P(S) = 1.' },
        { label: 'Step 2: Prior Branches P(E₁), P(E₂)', description: 'Split into mutually exclusive prior branches.' },
        { label: 'Step 3: Exhaustive Partition', description: 'Verify P(E₁) + P(E₂) = 0.01 + 0.99 = 1.00.' },
      ],
    },
    {
      sceneNumber: 2,
      durationSeconds: 9,
      heading: 'Conditional Probability & Multiplication Rule',
      teachingPoint: 'Observing event A restricts the sample space, multiplying each prior P(E_i) by its conditional likelihood P(A | E_i).',
      narration: `By the definition of conditional probability P(A | E) = P(A ∩ E) / P(E), the joint probability of both E_i and evidence A occurring is the product P(E_i) · P(A | E_i) along that branch.`,
      visualCue: 'Second-stage tree branches showing likelihoods P(A|E₁) and P(A|E₂)',
      keyFormula: 'P(A | E) = P(A ∩ E) / P(E)   ⇒   P(E ∩ A) = P(E) · P(A | E)',
      animationMode: 'probability_tree',
      highlightValues: ['Sensitivity P(+|D) = 0.99', 'False Positive P(+|D′) = 0.05', 'Independent iff P(A∩B)=P(A)P(B)'],
      citedPages: verifiedPages,
      isSupportedByMaterial: isSupported,
      spec: makeSceneDiagramSpec({
        title: 'Scene 2: Conditional Likelihoods & Joint Branches',
        subject: 'Mathematics',
        category: 'scientific_diagram',
        description: 'Two-stage probability tree multiplying priors P(E_i) by conditional likelihoods P(A|E_i).',
        citedPages: verifiedPages,
        assumptions: ['P(E_i) > 0 for every hypothesis branch', 'P(E_i ∩ A) = P(E_i) · P(A | E_i)'],
        elements: [
          { id: 'b2-root', kind: 'circle', cx: 80, cy: 250, r: 24, stroke: '#4F46E5', fill: '#EEF2FF', label: 'S' },
          { id: 'b2-e1', kind: 'circle', cx: 240, cy: 145, r: 28, stroke: '#10B981', fill: '#ECFDF5', label: 'E₁ (0.01)' },
          { id: 'b2-e2', kind: 'circle', cx: 240, cy: 355, r: 28, stroke: '#D97706', fill: '#FFFBEB', label: 'E₂ (0.99)' },
          { id: 'b2-l1', kind: 'line', startX: 104, startY: 238, endX: 212, endY: 155, color: '#10B981', strokeWidth: 2.5 },
          { id: 'b2-l2', kind: 'line', startX: 104, startY: 262, endX: 212, endY: 345, color: '#D97706', strokeWidth: 2.5 },
          { id: 'b2-a1', kind: 'arrow', startX: 268, startY: 145, endX: 450, endY: 145, color: '#0EA5E9', strokeWidth: 3, label: 'P(A|E₁) = 0.99' },
          { id: 'b2-a2', kind: 'arrow', startX: 268, startY: 355, endX: 450, endY: 355, color: '#EC4899', strokeWidth: 3, label: 'P(A|E₂) = 0.05' },
          { id: 'b2-j1', kind: 'rect', x: 460, y: 118, width: 195, height: 54, rx: 8, stroke: '#0EA5E9', fill: '#E0F2FE', label: 'True Pos: 0.0099' },
          { id: 'b2-j2', kind: 'rect', x: 460, y: 328, width: 195, height: 54, rx: 8, stroke: '#EC4899', fill: '#FCE7F3', label: 'False Pos: 0.0495' },
        ],
      }),
      stepLabels: [
        { label: 'Step 1: Prior Nodes E₁ and E₂', description: 'Begin with prior probabilities P(E₁) = 0.01 and P(E₂) = 0.99.' },
        { label: 'Step 2: Conditional Likelihood Arrows', description: 'Attach likelihoods P(A|E₁) = 0.99 and P(A|E₂) = 0.05.' },
        { label: 'Step 3: Multiply Along Branches', description: 'Compute joint probabilities P(E₁∩A) = 0.0099 and P(E₂∩A) = 0.0495.' },
      ],
    },
    {
      sceneNumber: 3,
      durationSeconds: 9,
      heading: 'Law of Total Probability P(A)',
      teachingPoint: 'Total probability P(A) sums the joint probabilities across all mutually exclusive pathways leading to evidence A.',
      narration: `Before we can invert the condition, we need the denominator P(A). By the Law of Total Probability, we sum all branches that produce event A: P(A) = P(E₁)P(A|E₁) + P(E₂)P(A|E₂) = 0.0099 + 0.0495 = 0.0594.`,
      visualCue: 'Both positive branches converging into marginal evidence node P(A) = 0.0594',
      keyFormula: 'P(A) = Σ P(E_i) · P(A | E_i)',
      animationMode: 'probability_tree',
      highlightValues: ['True Positives = 0.0099', 'False Positives = 0.0495', 'Total P(A) = 0.0594'],
      citedPages: verifiedPages,
      isSupportedByMaterial: isSupported,
      spec: makeSceneDiagramSpec({
        title: 'Scene 3: Law of Total Probability P(A)',
        subject: 'Mathematics',
        category: 'scientific_diagram',
        description: 'Summing disjoint joint probabilities to obtain total marginal probability P(A).',
        citedPages: verifiedPages,
        assumptions: ['Exhaustive partition of S', 'P(A) = 0.0099 + 0.0495 = 0.0594'],
        elements: [
          { id: 'b3-j1', kind: 'rect', x: 70, y: 118, width: 220, height: 64, rx: 8, stroke: '#10B981', fill: '#ECFDF5', label: 'P(E₁)P(A|E₁) = 0.0099' },
          { id: 'b3-j2', kind: 'rect', x: 70, y: 318, width: 220, height: 64, rx: 8, stroke: '#D97706', fill: '#FFFBEB', label: 'P(E₂)P(A|E₂) = 0.0495' },
          { id: 'b3-v1', kind: 'arrow', startX: 295, startY: 150, endX: 430, endY: 235, color: '#10B981', strokeWidth: 3, label: '+ True Pos' },
          { id: 'b3-v2', kind: 'arrow', startX: 295, startY: 350, endX: 430, endY: 265, color: '#D97706', strokeWidth: 3, label: '+ False Pos' },
          { id: 'b3-tot', kind: 'rect', x: 440, y: 210, width: 210, height: 80, rx: 10, stroke: '#4F46E5', fill: '#EEF2FF', label: 'Total P(A) = 0.0594' },
        ],
      }),
      stepLabels: [
        { label: 'Step 1: Individual Branch Weights', description: 'List P(E₁)P(A|E₁) = 0.0099 and P(E₂)P(A|E₂) = 0.0495.' },
        { label: 'Step 2: Converge Pathways', description: 'Combine all mutually exclusive paths that produce event A.' },
        { label: 'Step 3: Marginal Sum P(A)', description: 'Add branches to get denominator P(A) = 0.0594.' },
      ],
    },
    {
      sceneNumber: 4,
      durationSeconds: 9,
      heading: "Bayes' Theorem Posterior Update & JEE Exam Trap",
      teachingPoint: "Bayes' Theorem divides the target branch P(E₁)P(A|E₁) by total probability P(A) to update prior belief into posterior P(E₁ | A).",
      narration: `Finally, Bayes' Theorem gives the posterior probability P(E₁ | A) = 0.0099 / 0.0594 = 1/6 ≈ 16.7%. Even with a 99% sensitive test, a rare 1% prior means false positives outnumber true positives 5 to 1!`,
      visualCue: 'Posterior probability ratio bar comparing 0.0099 target branch against 0.0594 total evidence',
      keyFormula: 'P(E_k | A) = [ P(E_k) · P(A | E_k) ] / Σ [ P(E_i) · P(A | E_i) ]',
      animationMode: 'probability_tree',
      highlightValues: ['Posterior P(D|+) = 1/6 ≈ 16.7%', 'Base-Rate Fallacy Trap', 'Disjoint ≠ Independent'],
      citedPages: verifiedPages,
      isSupportedByMaterial: isSupported,
      spec: makeSceneDiagramSpec({
        title: "Scene 4: Bayes' Posterior Ratio & Base-Rate Takeaway",
        subject: 'Mathematics',
        category: 'scientific_diagram',
        description: "Bayes' theorem normalization yielding posterior P(E₁|A) = 1/6 ≈ 16.7%.",
        citedPages: verifiedPages,
        assumptions: ['P(A) > 0', 'P(D | +) = 0.0099 / 0.0594 = 1/6 ≈ 16.7%'],
        elements: [
          { id: 'b4-axes', kind: 'line', startX: 80, startY: 400, endX: 640, endY: 400, color: '#475569', strokeWidth: 2, label: 'Evidence Breakdown' },
          { id: 'b4-bar1', kind: 'rect', x: 110, y: 310, width: 130, height: 90, rx: 6, stroke: '#10B981', fill: '#D1FAE5', label: 'True Pos (0.0099)' },
          { id: 'b4-bar2', kind: 'rect', x: 280, y: 150, width: 130, height: 250, rx: 6, stroke: '#D97706', fill: '#FEF3C7', label: 'False Pos (0.0495)' },
          { id: 'b4-post', kind: 'rect', x: 465, y: 210, width: 160, height: 110, rx: 10, stroke: '#4F46E5', fill: '#EEF2FF', label: 'P(D|+) = 1/6 (16.7%)' },
          { id: 'b4-arrow', kind: 'arrow', startX: 245, startY: 340, endX: 460, endY: 265, color: '#4F46E5', strokeWidth: 2.5, label: 'Normalize by P(A)' },
        ],
      }),
      stepLabels: [
        { label: 'Step 1: Compare True vs False Positives', description: 'Contrast 0.0099 true positives with 0.0495 false positives.' },
        { label: 'Step 2: Normalize by Total P(A)', description: 'Divide target branch 0.0099 by total positive rate 0.0594.' },
        { label: 'Step 3: Posterior Result P(E₁|A) = 1/6', description: 'Obtain updated posterior 16.7% and avoid the base-rate fallacy.' },
      ],
    },
  ];

  return rawMathScenes.map(({ stepLabels, ...scene }) =>
    attachConceptMasteryToScene(
      {
        ...scene,
        progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
      },
      cleanTopic,
      subject
    )
  );
}

/**
 * Validates and sanitizes raw AI model output for Phase 5.2 Animated Explanations.
 * Enforces 4–6 scenes, strips XSS/script tags, validates each scene's StructuredDiagramSpec
 * and progressiveSteps, and verifies page citations against the active document.
 */
export function validateAndSanitizeAnimatedExplanation(
  raw: unknown,
  options: {
    topic: string;
    contextText?: string;
    citedPages?: number[];
    validPageNumbers?: number[];
  }
): ValidatedAnimatedExplanationResult {
  const warnings: string[] = [];
  const safeTopic = sanitizeBoundedString(options.topic || 'Core Study Topic', 120) || 'Core Study Topic';
  const contextText = options.contextText || '';
  const subject = detectEducationalSubject(`${safeTopic} ${contextText}`);
  const citationInfo = resolveSupportedCitedPages(
    safeTopic,
    contextText,
    options.citedPages,
    options.validPageNumbers
  );

  const buildFallbackResult = (reason: string): ValidatedAnimatedExplanationResult => {
    warnings.push(reason);
    const fallbackScenes = buildAnimatedExplanationScenes(
      safeTopic,
      contextText,
      options.citedPages,
      options.validPageNumbers
    );
    return {
      valid: false,
      isFallback: true,
      topic: safeTopic,
      subject,
      scenes: fallbackScenes,
      citedPages: citationInfo.citedPages,
      isSupportedByMaterial: citationInfo.isSupported,
      warnings,
    };
  };

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return buildFallbackResult('Model output was not valid JSON; using verified multi-scene template.');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return buildFallbackResult('Model output was empty or non-object; using verified multi-scene template.');
  }

  const obj = parsed as Record<string, unknown>;
  const rawScenes = Array.isArray(obj.scenes)
    ? obj.scenes
    : Array.isArray(parsed)
      ? (parsed as unknown[])
      : null;

  if (!rawScenes || rawScenes.length < 4) {
    return buildFallbackResult(
      `Model returned ${rawScenes ? rawScenes.length : 0} scenes (minimum 4 required); using verified multi-scene template.`
    );
  }

  const fallbackPool = buildAnimatedExplanationScenes(
    safeTopic,
    contextText,
    options.citedPages,
    options.validPageNumbers
  );

  const validModes = new Set(['projectile_arc', 'quadratic_curve', 'probability_tree', 'molecule_bonds']);
  const defaultMode: AnimatedExplanationScene['animationMode'] =
    subject === 'Physics'
      ? 'projectile_arc'
      : subject === 'Chemistry'
        ? 'molecule_bonds'
        : safeTopic.toLowerCase().includes('parabola') || safeTopic.toLowerCase().includes('quadratic')
          ? 'quadratic_curve'
          : 'probability_tree';

  const sanitizedScenes: AnimatedExplanationScene[] = [];
  const cappedRawScenes = rawScenes.slice(0, 6);

  for (let i = 0; i < cappedRawScenes.length; i++) {
    const item = cappedRawScenes[i];
    if (!item || typeof item !== 'object') {
      warnings.push(`Scene ${i + 1} was malformed and replaced.`);
      sanitizedScenes.push(fallbackPool[i % fallbackPool.length]);
      continue;
    }

    const s = item as Record<string, unknown>;
    const fallbackScene = fallbackPool[i % fallbackPool.length];
    const heading = sanitizeBoundedString(s.heading, 120) || fallbackScene.heading;
    const teachingPoint =
      sanitizeBoundedString(s.teachingPoint, 240) ||
      sanitizeBoundedString(s.visualCue, 240) ||
      fallbackScene.teachingPoint;
    const narration = sanitizeBoundedString(s.narration, 420) || fallbackScene.narration;
    const visualCue = sanitizeBoundedString(s.visualCue, 200) || fallbackScene.visualCue;
    const keyFormula = sanitizeBoundedString(s.keyFormula, 140) || fallbackScene.keyFormula;
    const durationSeconds = clampNumber(s.durationSeconds, 5, 20, 8);
    const animationMode = validModes.has(String(s.animationMode))
      ? (String(s.animationMode) as AnimatedExplanationScene['animationMode'])
      : defaultMode;

    const highlightValues = Array.isArray(s.highlightValues)
      ? s.highlightValues
          .map((v) => sanitizeBoundedString(v, 80))
          .filter((v) => v.length > 0)
          .slice(0, 5)
      : fallbackScene.highlightValues;

    // Validate scene citedPages against supported material
    let sceneCitedPages: number[] = [];
    if (citationInfo.isSupported) {
      if (Array.isArray(s.citedPages) && s.citedPages.length > 0) {
        const candidateScenePages = s.citedPages
          .map((p) => Number(p))
          .filter((p) => Number.isFinite(p));
        const resolvedScenePages = resolveSupportedCitedPages(
          `${safeTopic} ${heading}`,
          contextText,
          candidateScenePages,
          options.validPageNumbers
        );
        sceneCitedPages =
          resolvedScenePages.citedPages.length > 0
            ? resolvedScenePages.citedPages
            : citationInfo.citedPages;
      } else {
        sceneCitedPages = citationInfo.citedPages;
      }
    }

    // Validate scene diagram spec if provided, otherwise use fallbackScene.spec updated with scene title
    let sceneSpec: StructuredDiagramSpec = {
      ...fallbackScene.spec,
      title: heading,
      description: teachingPoint,
      citedPages: sceneCitedPages,
    };

    if (s.spec && typeof s.spec === 'object') {
      const validatedDiagram = validateAndSanitizeDiagramSpec(
        s.spec,
        heading,
        contextText,
        sceneCitedPages
      );
      const labeledCount = validatedDiagram.elements.filter(
        (el) =>
          ('label' in el && Boolean(el.label && el.label.trim())) ||
          ('text' in el && Boolean(el.text && el.text.trim()))
      ).length;
      if (validatedDiagram.elements.length >= 4 && labeledCount >= 2) {
        sceneSpec = {
          ...validatedDiagram,
          citedPages: sceneCitedPages,
        };
      }
    }

    // Validate progressive steps if provided; always enforce cumulative visibility ending with 100% of elements
    let customStepLabels: Array<{ label: string; description: string }> | undefined;
    if (Array.isArray(s.progressiveSteps) && s.progressiveSteps.length >= 2) {
      const extractedLabels: Array<{ label: string; description: string }> = [];
      for (let stepIdx = 0; stepIdx < Math.min(3, s.progressiveSteps.length); stepIdx++) {
        const rawStep = s.progressiveSteps[stepIdx];
        if (!rawStep || typeof rawStep !== 'object') continue;
        const rs = rawStep as Record<string, unknown>;
        extractedLabels.push({
          label: sanitizeBoundedString(rs.label, 80) || `Step ${stepIdx + 1}`,
          description: sanitizeBoundedString(rs.description, 180) || teachingPoint,
        });
      }
      if (extractedLabels.length >= 3) {
        customStepLabels = extractedLabels;
      }
    }
    const progressiveSteps = buildProgressiveStepsForDiagram(sceneSpec, customStepLabels);

    const baseScene: AnimatedExplanationScene = {
      sceneNumber: i + 1,
      durationSeconds,
      heading,
      teachingPoint,
      narration,
      visualCue,
      keyFormula,
      animationMode,
      highlightValues: highlightValues.length > 0 ? highlightValues : fallbackScene.highlightValues,
      citedPages: sceneCitedPages,
      isSupportedByMaterial: citationInfo.isSupported,
      spec: sceneSpec,
      progressiveSteps,
    };

    const enrichedScene = attachConceptMasteryToScene(baseScene, safeTopic, subject);
    if (s.conceptCheck && typeof s.conceptCheck === 'object') {
      const validatedCheck = validateAndSanitizeConceptCheck(s.conceptCheck, enrichedScene, {
        topic: safeTopic,
        subject,
        contextText,
        citedPages: sceneCitedPages,
        validPageNumbers: options.validPageNumbers,
      });
      enrichedScene.conceptCheck = validatedCheck.question;
    }

    sanitizedScenes.push(enrichedScene);
  }

  return {
    valid: true,
    isFallback: false,
    topic: safeTopic,
    subject,
    scenes: sanitizedScenes,
    citedPages: citationInfo.citedPages,
    isSupportedByMaterial: citationInfo.isSupported,
    warnings,
  };
}

/**
 * Pure state machine for the Animated Explanation slideshow player.
 * Guarantees speech synthesis cancellation whenever the scene changes,
 * mute is toggled on, playback is paused, the player is closed, or the user leaves Create.
 */
export function createInitialScenePlayerState(): ScenePlayerState {
  return {
    isOpen: true,
    activeSceneIndex: 0,
    activeStepIndex: 0,
    isPlaying: false,
    isMuted: false,
    speechCancelCount: 0,
  };
}

export function transitionScenePlayerState(
  state: ScenePlayerState,
  action: ScenePlayerAction,
  onCancelSpeech?: () => void
): ScenePlayerState {
  const cancelSpeech = () => {
    onCancelSpeech?.();
    return state.speechCancelCount + 1;
  };

  switch (action.type) {
    case 'PLAY':
      if (!state.isOpen) return state;
      return {
        ...state,
        isPlaying: true,
      };

    case 'PAUSE':
      return {
        ...state,
        isPlaying: false,
        speechCancelCount: cancelSpeech(),
      };

    case 'TOGGLE_PLAY':
      if (!state.isOpen) return state;
      if (state.isPlaying) {
        return {
          ...state,
          isPlaying: false,
          speechCancelCount: cancelSpeech(),
        };
      }
      return {
        ...state,
        isPlaying: true,
      };

    case 'NEXT_SCENE': {
      const maxScene = Math.max(0, action.totalScenes - 1);
      const nextScene = Math.min(maxScene, state.activeSceneIndex + 1);
      return {
        ...state,
        activeSceneIndex: nextScene,
        activeStepIndex: 0,
        speechCancelCount: cancelSpeech(),
      };
    }

    case 'PREV_SCENE': {
      const prevScene = Math.max(0, state.activeSceneIndex - 1);
      return {
        ...state,
        activeSceneIndex: prevScene,
        activeStepIndex: 0,
        speechCancelCount: cancelSpeech(),
      };
    }

    case 'SELECT_SCENE': {
      const maxScene = Math.max(0, action.totalScenes - 1);
      const target = Math.max(0, Math.min(maxScene, action.sceneIndex));
      return {
        ...state,
        activeSceneIndex: target,
        activeStepIndex: 0,
        speechCancelCount: cancelSpeech(),
      };
    }

    case 'NEXT_STEP': {
      const maxStep = Math.max(0, action.totalSteps - 1);
      if (state.activeStepIndex < maxStep) {
        return {
          ...state,
          activeStepIndex: state.activeStepIndex + 1,
        };
      }
      if (action.autoAdvanceScene) {
        const maxScene = Math.max(0, action.totalScenes - 1);
        if (state.activeSceneIndex < maxScene) {
          return {
            ...state,
            activeSceneIndex: state.activeSceneIndex + 1,
            activeStepIndex: 0,
            speechCancelCount: cancelSpeech(),
          };
        }
        return {
          ...state,
          isPlaying: false,
          speechCancelCount: cancelSpeech(),
        };
      }
      return state;
    }

    case 'PREV_STEP': {
      return {
        ...state,
        activeStepIndex: Math.max(0, state.activeStepIndex - 1),
      };
    }

    case 'SELECT_STEP': {
      const maxStep = Math.max(0, action.totalSteps - 1);
      return {
        ...state,
        activeStepIndex: Math.max(0, Math.min(maxStep, action.stepIndex)),
      };
    }

    case 'TOGGLE_MUTE': {
      const nextMuted = !state.isMuted;
      return {
        ...state,
        isMuted: nextMuted,
        speechCancelCount: nextMuted ? cancelSpeech() : state.speechCancelCount,
      };
    }

    case 'OPEN_CONCEPT_CHECK':
      return {
        ...state,
        isPlaying: false,
        speechCancelCount: cancelSpeech(),
      };

    case 'START_RETEACHING': {
      const targetStep =
        typeof action.totalSteps === 'number' && action.totalSteps > 0
          ? Math.max(0, action.totalSteps - 1)
          : state.activeStepIndex;
      return {
        ...state,
        isPlaying: false,
        activeStepIndex: targetStep,
        speechCancelCount: cancelSpeech(),
      };
    }

    case 'REPLAY_SCENE':
      if (!state.isOpen) return state;
      return {
        ...state,
        activeStepIndex: 0,
        isPlaying: true,
        speechCancelCount: cancelSpeech(),
      };

    case 'CLOSE_PLAYER':
      return {
        ...state,
        isOpen: false,
        isPlaying: false,
        activeSceneIndex: 0,
        activeStepIndex: 0,
        speechCancelCount: cancelSpeech(),
      };

    case 'LEAVE_CREATE':
      return {
        ...state,
        isPlaying: false,
        speechCancelCount: cancelSpeech(),
      };

    default:
      return state;
  }
}

/* ============================================================================
 * PHASE 5.3 — INTERACTIVE CONCEPT MASTERY, MISCONCEPTION DETECTION & RETEACHING
 * ============================================================================ */

/**
 * Attaches deterministic, teachingPoint-aligned concept check and visual reteaching
 * specs to an AnimatedExplanationScene.
 */
export function attachConceptMasteryToScene(
  scene: AnimatedExplanationScene,
  topic: string,
  subject?: EducationalSubject
): AnimatedExplanationScene {
  const resolvedSubject = subject || detectEducationalSubject(`${topic} ${scene.heading}`);
  const conceptCheck = buildDeterministicSceneConceptCheck(scene, {
    topic,
    subject: resolvedSubject,
    difficulty: 'standard',
  });
  const reteaching = buildDeterministicSceneReteaching(scene, {
    topic,
    subject: resolvedSubject,
  });
  return {
    ...scene,
    conceptCheck,
    reteaching,
  };
}

/**
 * Normalizes a student's numerical answer string (supporting decimals, fractions like "1/6",
 * percentages, scientific notation like "1.6e-19" or "1.6 x 10^-19", and trailing units)
 * and grades it against expectedValue within tolerance.
 */
export function normalizeAndGradeNumericalAnswer(
  rawInput: unknown,
  expectedValue: number,
  tolerance?: number,
  acceptedUnits?: string[]
): {
  validInput: boolean;
  normalizedValue: number | null;
  isCorrect: boolean;
  effectiveTolerance: number;
  errorReason?: string;
} {
  const effectiveTolerance =
    typeof tolerance === 'number' && Number.isFinite(tolerance) && tolerance >= 0
      ? tolerance
      : Math.max(0.05, Math.abs(expectedValue) * 0.02);

  if (rawInput === null || rawInput === undefined) {
    return {
      validInput: false,
      normalizedValue: null,
      isCorrect: false,
      effectiveTolerance,
      errorReason: 'Empty numerical answer.',
    };
  }

  let text = String(rawInput).trim();
  if (!text) {
    return {
      validInput: false,
      normalizedValue: null,
      isCorrect: false,
      effectiveTolerance,
      errorReason: 'Empty numerical answer.',
    };
  }

  // Normalize unicode minus and multiplication signs
  text = text
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '')
    .replace(/\s*×\s*10\^?\(?([+-]?\d+)\)?/i, 'e$1')
    .replace(/\s*\*\s*10\^?\(?([+-]?\d+)\)?/i, 'e$1')
    .trim();

  // Dimensional unit equivalence groups so synonymous unit notations are accepted
  // while dimensionally incompatible or unscaled units are rejected.
  const UNIT_EQUIVALENCE_GROUPS: string[][] = [
    ['n', 'newton', 'newtons', 'kg m/s^2', 'kg m/s²', 'kg·m/s²'],
    ['m/s^2', 'm/s²', 'm s^-2', 'ms^-2', 'm·s^-2'],
    ['m/s', 'm s^-1', 'ms^-1', 'm·s^-1'],
    ['km/h', 'kmph', 'km h^-1'],
    ['rad/s', 'rad s^-1'],
    ['rad', 'radian', 'radians'],
    ['deg', 'degree', 'degrees', '°'],
    ['j', 'joule', 'joules', 'n m', 'n·m'],
    ['w', 'watt', 'watts', 'j/s'],
    ['pa', 'pascal', 'pascals', 'n/m^2', 'n/m²'],
    ['hz', 'hertz', 's^-1'],
    ['c', 'coulomb', 'coulombs'],
    ['v', 'volt', 'volts'],
    ['ohm', 'ohms', 'ω', 'Ω'],
    ['m', 'meter', 'meters', 'metre', 'metres'],
    ['cm', 'centimeter', 'centimeters'],
    ['mm', 'millimeter', 'millimeters'],
    ['s', 'sec', 'second', 'seconds'],
    ['kg', 'kilogram', 'kilograms'],
    ['g', 'gram', 'grams'],
    ['mol', 'mole', 'moles'],
    ['d', 'debye', 'debyes'],
    ['å', 'angstrom', 'angstroms'],
    ['%'],
  ];

  const areUnitsDimensionallyEquivalent = (u1: string, u2: string): boolean => {
    const n1 = u1.trim().toLowerCase().replace(/\s+/g, ' ');
    const n2 = u2.trim().toLowerCase().replace(/\s+/g, ' ');
    if (n1 === n2) return true;
    for (const group of UNIT_EQUIVALENCE_GROUPS) {
      if (group.includes(n1) && group.includes(n2)) {
        return true;
      }
    }
    return false;
  };

  // Separate leading numeric/fraction expression from any trailing unit string
  const numWithUnitMatch = text.match(
    /^([+-]?\d+(?:\.\d+)?\s*\/\s*[+-]?\d+(?:\.\d+)?|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(.*)$/i
  );

  if (!numWithUnitMatch) {
    return {
      validInput: false,
      normalizedValue: null,
      isCorrect: false,
      effectiveTolerance,
      errorReason: 'Input is not a valid number or fraction.',
    };
  }

  const numericPart = numWithUnitMatch[1].trim();
  const trailingUnit = numWithUnitMatch[2].trim();

  if (trailingUnit) {
    const hasExplicitAcceptedUnits =
      Array.isArray(acceptedUnits) && acceptedUnits.some((u) => String(u).trim().length > 0);

    if (hasExplicitAcceptedUnits) {
      const cleanAccepted = (acceptedUnits || []).map((u) => String(u).trim()).filter(Boolean);
      const isCompatible = cleanAccepted.some((acc) =>
        areUnitsDimensionallyEquivalent(trailingUnit, acc)
      );
      if (!isCompatible) {
        return {
          validInput: false,
          normalizedValue: null,
          isCorrect: false,
          effectiveTolerance,
          errorReason: `Incompatible physical unit "${trailingUnit}". Expected ${cleanAccepted.join(' or ')}.`,
        };
      }
    } else {
      // No explicit acceptedUnits on question: only allow known standard units, reject arbitrary text
      const allKnownUnits = UNIT_EQUIVALENCE_GROUPS.flat();
      const isKnown = allKnownUnits.some((known) =>
        areUnitsDimensionallyEquivalent(trailingUnit, known)
      );
      if (!isKnown) {
        return {
          validInput: false,
          normalizedValue: null,
          isCorrect: false,
          effectiveTolerance,
          errorReason: `Unrecognized trailing unit or text "${trailingUnit}".`,
        };
      }
    }
  }

  text = numericPart;

  // Check fraction format: "a / b"
  const fractionMatch = text.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  let parsedValue: number;
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || Math.abs(den) < 1e-12) {
      return {
        validInput: false,
        normalizedValue: null,
        isCorrect: false,
        effectiveTolerance,
        errorReason: 'Division by zero or invalid fraction.',
      };
    }
    parsedValue = num / den;
  } else {
    // Must strictly match a valid decimal or scientific number
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      return {
        validInput: false,
        normalizedValue: null,
        isCorrect: false,
        effectiveTolerance,
        errorReason: 'Input is not a valid number or fraction.',
      };
    }
    parsedValue = Number(text);
  }

  if (!Number.isFinite(parsedValue)) {
    return {
      validInput: false,
      normalizedValue: null,
      isCorrect: false,
      effectiveTolerance,
      errorReason: 'Parsed value is not finite.',
    };
  }

  const isCorrect = Math.abs(parsedValue - expectedValue) <= effectiveTolerance + 1e-9;

  return {
    validInput: true,
    normalizedValue: Number(parsedValue.toFixed(6)),
    isCorrect,
    effectiveTolerance,
  };
}

/**
 * Generates a deterministic, teachingPoint-aligned SceneConceptCheckQuestion for any scene,
 * supporting 'standard', 'reteach' (equivalent retry question), and 'challenge' variants.
 */
export function buildDeterministicSceneConceptCheck(
  scene: Pick<
    AnimatedExplanationScene,
    | 'sceneNumber'
    | 'heading'
    | 'teachingPoint'
    | 'keyFormula'
    | 'citedPages'
    | 'isSupportedByMaterial'
    | 'spec'
  >,
  options: {
    topic: string;
    subject?: EducationalSubject;
    difficulty?: ConceptCheckDifficulty;
    sourceDocumentTitle?: string;
  }
): SceneConceptCheckQuestion {
  const safeTopic = sanitizeBoundedString(options.topic || 'Core Study Concept', 120) || 'Core Study Concept';
  const subject = options.subject || detectEducationalSubject(`${safeTopic} ${scene.heading}`);
  const difficulty: ConceptCheckDifficulty = options.difficulty || 'standard';
  const sceneNum = clampNumber(scene.sceneNumber, 1, 6, 1);
  const lower = `${safeTopic} ${scene.heading} ${scene.teachingPoint}`.toLowerCase();
  const elementIds = scene.spec?.elements?.map((el) => el.id) || [];
  const defaultHighlights = elementIds.slice(0, 3);

  const baseMeta = {
    sceneNumber: sceneNum,
    topic: safeTopic,
    subject,
    teachingPoint: scene.teachingPoint,
    difficulty,
    citedPages: Array.isArray(scene.citedPages) ? scene.citedPages : [],
    isSupportedByMaterial: Boolean(scene.isSupportedByMaterial),
    sourceDocumentTitle: options.sourceDocumentTitle,
    provenance: 'deterministic_fallback' as const,
  };

  // 1. PHYSICS: Inclined Plane Free-Body Diagram & Normal Reaction / Friction
  if (
    subject === 'Physics' &&
    (lower.includes('incline') ||
      lower.includes('wedge') ||
      lower.includes('normal') ||
      lower.includes('friction') ||
      lower.includes('mg cos') ||
      lower.includes('free body') ||
      lower.includes('fbd'))
  ) {
    if (sceneNum === 1) {
      if (difficulty === 'reteach') {
        return {
          ...baseMeta,
          id: `cc-phys-incline-s1-reteach`,
          questionType: 'mcq',
          statement:
            'When a block slides strictly along a rigid inclined plane of angle θ without lifting off, what is the component of acceleration perpendicular to the inclined surface (a_y)?',
          options: [
            'a_y = 0 m/s² because motion is constrained parallel to the ramp',
            'a_y = g = 9.8 m/s² downward along the y-axis',
            'a_y = g sin θ perpendicular to the incline',
            'a_y = g cos θ upward away from the ramp',
          ],
          correctIndex: 0,
          explanation:
            'Because the block neither sinks into the rigid wedge nor flies off it, velocity and acceleration perpendicular to the surface are identically zero (a_y = 0).',
          keyFormula: 'a_y = 0 (perpendicular to incline)',
          misconceptions: [
            {
              id: 'phys-inc-axes-unrotated',
              distractorIndex: 1,
              misconceptionSummary:
                'Confusing vertical gravitational acceleration g with acceleration normal to the ramp.',
              whyIncorrect:
                'The ramp’s normal force N balances the perpendicular component of gravity, keeping a_y = 0.',
              coreConceptFix:
                'Rotate axes so +x runs along the ramp and +y is perpendicular to the surface; then ΣF_y = m·a_y = 0.',
              highlightElementIds: ['s1-axis-x', 's1-axis-y', 's1-ramp'],
            },
            {
              id: 'phys-inc-sin-normal-swap',
              distractorIndex: 2,
              misconceptionSummary:
                'Assigning the parallel driving acceleration g sin θ to the perpendicular axis.',
              whyIncorrect:
                'g sin θ acts parallel to the ramp (+x), whereas motion along the normal (+y) is zero.',
              coreConceptFix:
                'Keep x-axis parallel to the surface (where a_x = g sin θ on a smooth ramp) and y-axis normal (where a_y = 0).',
              highlightElementIds: ['s1-axis-x', 's1-axis-y'],
            },
          ],
        };
      }
      return {
        ...baseMeta,
        id: `cc-phys-incline-s1-${difficulty}`,
        questionType: 'mcq',
        statement:
          'Why do we rotate the coordinate axes so that the x-axis is parallel to the incline and the y-axis is perpendicular to the incline?',
        options: [
          'So acceleration perpendicular to the ramp is zero (a_y = 0) and motion is 1D along x',
          'Because normal reaction N always acts vertically upward against gravity',
          'So that weight mg acts purely along the x-axis with no y-component',
          'Because friction acts perpendicular to the inclined surface',
        ],
        correctIndex: 0,
        explanation:
          'Aligning x parallel to the ramp and y normal to the ramp confines all motion to the x-axis, giving ΣF_y = N − mg cos θ = 0 (since a_y = 0).',
        keyFormula: 'a_y = 0,   ΣF_y = N − mg cos θ = 0',
        misconceptions: [
          {
            id: 'phys-inc-normal-vertical',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming normal reaction N always points vertically upward (so N = mg).',
            whyIncorrect:
              'Normal force N is always perpendicular to the contact surface, which is tilted by angle θ from the horizontal.',
            coreConceptFix:
              'Draw N perpendicular to the inclined ramp (+y), not straight up; N balances mg cos θ, not full mg.',
            highlightElementIds: ['s1-axis-y', 's1-ramp', 's1-block'],
          },
          {
            id: 'phys-inc-weight-along-x',
            distractorIndex: 2,
            misconceptionSummary:
              'Assuming gravity mg rotates with the inclined plane to act purely along the ramp.',
            whyIncorrect:
              'Gravity always pulls straight down toward the center of the Earth and must be resolved into mg sin θ and mg cos θ.',
            coreConceptFix:
              'Keep weight mg vertical, then project it onto the tilted x (mg sin θ) and y (mg cos θ) axes.',
            highlightElementIds: ['s1-axis-x', 's1-axis-y', 's1-arc'],
          },
        ],
      };
    }

    if (sceneNum === 2) {
      if (difficulty === 'reteach') {
        return {
          ...baseMeta,
          id: `cc-phys-incline-s2-reteach`,
          questionType: 'mcq',
          statement:
            'As the incline angle θ approaches 0° (a flat horizontal table), what must the perpendicular component of weight F_⊥ equal, and which trigonometric function satisfies this limit?',
          options: [
            'F_⊥ = mg cos θ, because cos(0°) = 1 gives F_⊥ = mg on a flat surface',
            'F_⊥ = mg sin θ, because sin(0°) = 1 on a flat surface',
            'F_⊥ = mg tan θ, because tan(0°) = 1',
            'F_⊥ = mg always, regardless of incline angle θ',
          ],
          correctIndex: 0,
          explanation:
            'Checking the boundary limit θ → 0° immediately confirms F_⊥ = mg cos θ (since cos 0° = 1 → mg) and F_∥ = mg sin θ (since sin 0° = 0 → 0).',
          keyFormula: 'F_⊥ = mg cos θ,   F_∥ = mg sin θ',
          misconceptions: [
            {
              id: 'phys-inc-trig-swap',
              distractorIndex: 1,
              misconceptionSummary:
                'Swapping sin θ and cos θ when resolving vertical weight mg onto tilted axes.',
              whyIncorrect:
                'At θ = 0°, sin(0°) = 0, which would falsely predict zero normal force on a flat table.',
              coreConceptFix:
                'The angle between vertical mg and the inward normal is θ (adjacent side), so F_⊥ = mg cos θ and F_∥ = mg sin θ.',
              highlightElementIds: ['s2-mg', 's2-mgcos', 's2-mgsin'],
            },
            {
              id: 'phys-inc-normal-equals-mg',
              distractorIndex: 3,
              misconceptionSummary:
                'Assuming the normal component of gravity equals full weight mg instead of mg cos θ.',
              whyIncorrect:
                'As the ramp tilts by θ > 0°, part of gravity (mg sin θ) pulls along the slope, reducing the perpendicular press to mg cos θ.',
              coreConceptFix:
                'Resolve vertical mg into orthogonal components: F_⊥ = mg cos θ into the ramp and F_∥ = mg sin θ down the ramp.',
              highlightElementIds: ['s2-mg', 's2-mgcos', 's2-angle'],
            },
          ],
        };
      }
      return {
        ...baseMeta,
        id: `cc-phys-incline-s2-${difficulty}`,
        questionType: 'mcq',
        statement:
          'A block of mass m rests on an incline of angle θ. How does vertical weight mg resolve into components perpendicular (F_⊥) and parallel (F_∥) to the inclined surface?',
        options: [
          'F_⊥ = mg cos θ (into ramp) and F_∥ = mg sin θ (down ramp)',
          'F_⊥ = mg (into ramp) and F_∥ = mg sin θ (down ramp)',
          'F_⊥ = mg sin θ (into ramp) and F_∥ = mg cos θ (down ramp)',
          'F_⊥ = mg / cos θ (into ramp) and F_∥ = mg tan θ (down ramp)',
        ],
        correctIndex: 0,
        explanation:
          'By similar right triangles, the angle between vertical weight mg and the line perpendicular to the incline is θ. The adjacent component is F_⊥ = mg cos θ and the opposite component is F_∥ = mg sin θ.',
        keyFormula: 'F_∥ = mg sin θ,   F_⊥ = mg cos θ',
        misconceptions: [
          {
            id: 'phys-inc-normal-always-mg',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming normal component of weight always equals full weight mg instead of mg cos θ.',
            whyIncorrect:
              'Full weight mg is the hypotenuse of the force triangle; the perpendicular leg cannot equal the hypotenuse when θ > 0°.',
            coreConceptFix:
              'Project mg onto the normal axis using cosine of the incline angle: F_⊥ = mg cos θ.',
            highlightElementIds: ['s2-mg', 's2-mgcos', 's2-angle'],
          },
          {
            id: 'phys-inc-sin-cos-interchange',
            distractorIndex: 2,
            misconceptionSummary:
              'Interchanging sin θ and cos θ components of gravity on an inclined plane.',
            whyIncorrect:
              'The angle θ lies between vertical mg and the normal axis, making the normal component adjacent (cos θ), not opposite (sin θ).',
            coreConceptFix:
              'Remember: "Cosine crushes the block into the ramp (mg cos θ); Sine slides the block down the ramp (mg sin θ)."',
            highlightElementIds: ['s2-mgcos', 's2-mgsin', 's2-angle'],
          },
        ],
      };
    }

    if (sceneNum === 3) {
      if (difficulty === 'challenge') {
        return {
          ...baseMeta,
          id: `cc-phys-incline-s3-challenge`,
          questionType: 'numerical',
          statement:
            'A block of mass m = 4 kg rests on an inclined plane tilted at θ = 60° to the horizontal (take g = 10 m/s² and cos 60° = 0.5). What is the magnitude of the normal reaction N exerted by the incline on the block (in N)?',
          numericalAnswer: 20,
          numericalTolerance: 0.5,
          acceptedUnits: ['N', 'newtons'],
          unitHint: 'N',
          explanation:
            'Perpendicular equilibrium gives N = mg cos θ = 4 × 10 × cos(60°) = 40 × 0.5 = 20 N (not mg = 40 N).',
          keyFormula: 'N = mg cos θ = 4 × 10 × 0.5 = 20 N',
          misconceptions: [
            {
              id: 'phys-inc-normal-equals-mg-num',
              wrongNumericalTarget: 40,
              wrongNumericalTolerance: 1,
              misconceptionSummary:
                'Assuming normal reaction N equals full weight mg (40 N) instead of mg cos θ (20 N).',
              whyIncorrect:
                'On a 60° incline, gravity acts vertically downward while normal reaction acts perpendicular to the surface, so N balances only mg cos 60° = 0.5 mg = 20 N.',
              coreConceptFix:
                'Always apply ΣF_y = N − mg cos θ = 0 perpendicular to the incline: N = mg cos θ.',
              highlightElementIds: ['s3-normal', 's3-mgcos', 's3-note'],
            },
            {
              id: 'phys-inc-normal-mgsin-num',
              wrongNumericalTarget: 34.64,
              wrongNumericalTolerance: 1.0,
              misconceptionSummary:
                'Using mg sin 60° (≈ 34.6 N) instead of mg cos 60° for normal reaction N.',
              whyIncorrect:
                'mg sin θ is the tangential force pulling the block down the incline, not the perpendicular force pressing into the surface.',
              coreConceptFix:
                'Use cosine for the perpendicular normal balance: N = mg cos θ = 20 N.',
              highlightElementIds: ['s3-normal', 's3-mgcos'],
            },
          ],
        };
      }
      if (difficulty === 'reteach') {
        return {
          ...baseMeta,
          id: `cc-phys-incline-s3-reteach`,
          questionType: 'numerical',
          statement:
            'A block of mass m = 2 kg is placed on a ramp inclined at θ = 60° (take g = 10 m/s² and cos 60° = 0.5). Compute the normal reaction force N (in N) exerted by the incline.',
          numericalAnswer: 10,
          numericalTolerance: 0.5,
          acceptedUnits: ['N', 'newtons'],
          unitHint: 'N',
          explanation:
            'Using ΣF_y = N − mg cos θ = 0 gives N = mg cos(60°) = 2 × 10 × 0.5 = 10 N (half of the full 20 N weight).',
          keyFormula: 'N = mg cos θ = 2 × 10 × cos(60°) = 10 N',
          misconceptions: [
            {
              id: 'phys-inc-normal-equals-mg-reteach',
              wrongNumericalTarget: 20,
              wrongNumericalTolerance: 0.8,
              misconceptionSummary:
                'Assuming normal reaction N always equals full weight mg (20 N) instead of mg cos θ (10 N).',
              whyIncorrect:
                'N = mg holds only on a flat horizontal surface (θ = 0°). On a 60° incline, only mg cos 60° = 10 N presses into the ramp.',
              coreConceptFix:
                'Multiply weight mg by cos θ to get the normal reaction: N = mg cos θ = 20 × 0.5 = 10 N.',
              highlightElementIds: ['s3-normal', 's3-mgcos', 's3-note'],
            },
          ],
        };
      }
      return {
        ...baseMeta,
        id: `cc-phys-incline-s3-standard`,
        questionType: 'mcq',
        statement:
          'For a block of mass m on an inclined plane of angle θ (with no other external vertical or normal pushes), what is the normal reaction N and maximum static friction f_s,max?',
        options: [
          'N = mg cos θ  and  f_s,max = μ_s mg cos θ',
          'N = mg  and  f_s,max = μ_s mg',
          'N = mg sin θ  and  f_s,max = μ_s mg sin θ',
          'N = mg / cos θ  and  f_s,max = μ_s mg tan θ',
        ],
        correctIndex: 0,
        explanation:
          'Equilibrium perpendicular to the incline (ΣF_y = 0) requires N = mg cos θ. Consequently, the limiting static friction threshold is f_s,max = μ_s N = μ_s mg cos θ.',
        keyFormula: 'N = mg cos θ,   f_s,max = μ_s N = μ_s mg cos θ',
        misconceptions: [
          {
            id: 'phys-inc-normal-equals-mg',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming normal reaction N always equals mg instead of mg cos θ on an inclined plane.',
            whyIncorrect:
              'Normal reaction N acts perpendicular to the tilted ramp, so it balances only the perpendicular component of gravity (mg cos θ), not the full vertical weight mg.',
            coreConceptFix:
              'Write ΣF_⊥ = N − mg cos θ = 0 first; substitute N = mg cos θ into f_max = μ N.',
            highlightElementIds: ['s3-normal', 's3-mgcos', 's3-friction', 's3-note'],
          },
          {
            id: 'phys-inc-normal-mgsin',
            distractorIndex: 2,
            misconceptionSummary:
              'Using the parallel component mg sin θ instead of mg cos θ for the normal reaction N.',
            whyIncorrect:
              'mg sin θ pulls the block parallel to the ramp; it does not compress the block into the surface.',
            coreConceptFix:
              'Normal force balances the cosine component perpendicular to the surface: N = mg cos θ.',
            highlightElementIds: ['s3-normal', 's3-mgcos'],
          },
        ],
      };
    }

    // Scene 4: Net Downward Acceleration
    if (difficulty === 'reteach') {
      return {
        ...baseMeta,
        id: `cc-phys-incline-s4-reteach`,
        questionType: 'mcq',
        statement:
          'If you double the mass of a block (from m to 2m) sliding down a rough incline of angle θ with kinetic friction coefficient μ_k, how does its downward acceleration a = g(sin θ − μ_k cos θ) change?',
        options: [
          'Acceleration a remains unchanged because mass m cancels out of both gravity and friction',
          'Acceleration doubles because gravitational pull 2mg is twice as large',
          'Acceleration halves because inertia 2m is twice as large while friction stays fixed',
          'Acceleration becomes zero because normal force doubles',
        ],
        correctIndex: 0,
        explanation:
          'Both the driving component (mg sin θ) and kinetic friction (μ_k mg cos θ) are proportional to mass m. Dividing ΣF_x = m a by m cancels m completely: a = g(sin θ − μ_k cos θ).',
        keyFormula: 'a = g (sin θ − μ_k cos θ)',
        misconceptions: [
          {
            id: 'phys-inc-mass-dependence',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming a heavier block accelerates faster down an incline.',
            whyIncorrect:
              'Doubling mass m doubles both the driving force mg sin θ and the resisting friction μ_k mg cos θ, as well as the inertia m in F = ma.',
            coreConceptFix:
              'Factor out and cancel m in m·a = m·g(sin θ − μ_k cos θ) ⇒ a is independent of mass m.',
            highlightElementIds: defaultHighlights,
          },
        ],
      };
    }
    return {
      ...baseMeta,
      id: `cc-phys-incline-s4-${difficulty}`,
      questionType: 'numerical',
      statement:
        'A block slides down a rough incline with sin θ = 0.6, cos θ = 0.8, kinetic friction coefficient μ_k = 0.25, and g = 10 m/s². What is its downward acceleration a along the ramp (in m/s²)?',
      numericalAnswer: 4,
      numericalTolerance: 0.15,
      acceptedUnits: ['m/s^2', 'm/s²', 'm/s2'],
      unitHint: 'm/s²',
      explanation:
        'Using a = g(sin θ − μ_k cos θ) = 10 × (0.6 − 0.25 × 0.8) = 10 × (0.6 − 0.2) = 4.0 m/s².',
      keyFormula: 'a = g (sin θ − μ_k cos θ)',
      misconceptions: [
        {
          id: 'phys-inc-friction-uses-mg',
          wrongNumericalTarget: 3.5,
          wrongNumericalTolerance: 0.15,
          misconceptionSummary:
            'Computing kinetic friction as μ_k mg instead of μ_k mg cos θ (using a = g(sin θ − μ_k) = 10(0.6 − 0.25) = 3.5 m/s²).',
          whyIncorrect:
            'Normal force on the incline is N = mg cos θ, not mg, so kinetic friction deceleration is μ_k g cos θ = 0.25 × 10 × 0.8 = 2.0 m/s².',
          coreConceptFix:
            'Always multiply μ_k by cos θ when computing friction on an incline: a = g(sin θ − μ_k cos θ) = 4 m/s².',
          highlightElementIds: defaultHighlights,
        },
        {
          id: 'phys-inc-ignore-friction',
          wrongNumericalTarget: 6,
          wrongNumericalTolerance: 0.15,
          misconceptionSummary:
            'Omitting opposing kinetic friction and computing smooth-incline acceleration a = g sin θ = 6 m/s².',
          whyIncorrect:
            'On a rough ramp, kinetic friction f_k = μ_k mg cos θ opposes motion up the slope and must be subtracted.',
          coreConceptFix:
            'Subtract μ_k g cos θ = 2 m/s² from g sin θ = 6 m/s² to get net acceleration a = 4 m/s².',
          highlightElementIds: defaultHighlights,
        },
      ],
    };
  }

  // 2. PHYSICS: Projectile Motion & 2D Kinematics
  if (subject === 'Physics') {
    if (sceneNum === 1) {
      return {
        ...baseMeta,
        id: `cc-phys-proj-s1-${difficulty}`,
        questionType: 'mcq',
        statement:
          difficulty === 'reteach'
            ? 'In ideal projectile motion (negligible air drag), why does the horizontal velocity component u_x = u cos θ remain constant throughout flight?'
            : 'A projectile is launched at speed u and angle θ above horizontal. What are its initial horizontal (u_x) and vertical (u_y) velocity components, and which component changes with time?',
        options:
          difficulty === 'reteach'
            ? [
                'Because no horizontal force acts on the projectile (a_x = 0)',
                'Because gravity g acts horizontally in the direction of motion',
                'Because u cos θ equals u sin θ at every launch angle',
                'Because vertical velocity v_y is also constant throughout flight',
              ]
            : [
                'u_x = u cos θ (constant) and u_y = u sin θ (changes due to a_y = −g)',
                'u_x = u sin θ (constant) and u_y = u cos θ (changes due to a_y = −g)',
                'Both u_x = u cos θ and u_y = u sin θ decrease to zero at the apex',
                'u_x = u (constant) and u_y = u tan θ',
              ],
        correctIndex: 0,
        explanation:
          'Gravity acts strictly vertically downward (a_x = 0, a_y = −g). Thus horizontal velocity u_x = u cos θ stays constant while vertical velocity v_y(t) = u sin θ − gt varies linearly.',
        keyFormula: 'u_x = u cos θ (a_x = 0),   v_y(t) = u sin θ − g·t',
        misconceptions: [
          {
            id: 'phys-proj-trig-swap',
            distractorIndex: 1,
            misconceptionSummary:
              'Swapping horizontal cosine and vertical sine components for launch angle θ measured from the horizontal.',
            whyIncorrect:
              'When θ is measured from the horizontal x-axis, the horizontal leg is adjacent (u cos θ) and the vertical leg is opposite (u sin θ).',
            coreConceptFix:
              'Project onto the adjacent horizontal axis with cos θ: u_x = u cos θ, u_y = u sin θ.',
            highlightElementIds: ['p1-ux', 'p1-uy', 'p1-u'],
          },
          {
            id: 'phys-proj-both-zero-apex',
            distractorIndex: 2,
            misconceptionSummary:
              'Assuming both horizontal and vertical velocity components vanish at the highest point.',
            whyIncorrect:
              'Only vertical velocity v_y becomes zero at the apex; horizontal velocity u_x = u cos θ remains constant.',
            coreConceptFix:
              'Keep horizontal and vertical motion independent: a_x = 0 ⇒ v_x = u cos θ everywhere.',
            highlightElementIds: ['p1-ux', 'p1-uy'],
          },
        ],
      };
    }

    if (sceneNum === 2) {
      return {
        ...baseMeta,
        id: `cc-phys-proj-s2-${difficulty}`,
        questionType: 'mcq',
        statement:
          difficulty === 'reteach'
            ? 'A ball is thrown at speed u = 20 m/s at θ = 60° (cos 60° = 0.5). What is its speed at the highest point (apex) of its trajectory?'
            : 'At the highest point (apex, H_max) of a projectile launched with speed u at angle θ, what are its instantaneous velocity v_apex and acceleration a_apex?',
        options:
          difficulty === 'reteach'
            ? [
                '10 m/s horizontally (since v_y = 0 and v_x = u cos 60° = 10 m/s)',
                '0 m/s (the ball momentarily stops completely at the top)',
                '20 m/s horizontally',
                '17.3 m/s vertically',
              ]
            : [
                'v_apex = u cos θ (horizontal) and a_apex = g downward',
                'v_apex = 0 and a_apex = 0',
                'v_apex = 0 and a_apex = g downward',
                'v_apex = u sin θ (horizontal) and a_apex = 0',
              ],
        correctIndex: 0,
        explanation:
          'At the apex, vertical velocity v_y momentarily crosses zero, but horizontal velocity v_x = u cos θ is unchanged and gravity g = 9.8 m/s² continues to act downward.',
        keyFormula: 'v_apex = u cos θ (v_y = 0),   H_max = (u² sin²θ) / (2g)',
        misconceptions: [
          {
            id: 'phys-proj-zero-velocity-apex',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming total velocity (and acceleration) is zero at the highest point of a 2D trajectory.',
            whyIncorrect:
              'If total velocity were zero and acceleration were zero, the projectile would hover in mid-air forever! Only v_y = 0 at the apex.',
            coreConceptFix:
              'At the apex, v_y = 0 but v_x = u cos θ ≠ 0, and downward gravitational acceleration a = g is constant throughout flight.',
            highlightElementIds: ['p2-vapex', 'p2-hmax', 'p2-g'],
          },
          {
            id: 'phys-proj-zero-speed-apex',
            distractorIndex: 2,
            misconceptionSummary:
              'Confusing 1D vertical toss (where speed at top is 0) with 2D projectile motion (where horizontal speed u cos θ persists).',
            whyIncorrect:
              'In 2D motion, the projectile is still moving horizontally at speed u cos θ as it passes over the peak.',
            coreConceptFix:
              'Speed at apex is v_min = u cos θ, and kinetic energy at apex is K_apex = K_0 cos²θ.',
            highlightElementIds: ['p2-vapex', 'p2-hmax'],
          },
        ],
      };
    }

    if (sceneNum === 3) {
      return {
        ...baseMeta,
        id: `cc-phys-proj-s3-${difficulty}`,
        questionType: 'numerical',
        statement:
          difficulty === 'reteach'
            ? 'A projectile is launched at u = 30 m/s at θ = 45° on level ground (take g = 10 m/s²). Calculate the maximum horizontal range R (in m).'
            : 'A projectile is launched with initial speed u = 20 m/s at angle θ = 45° on level ground (take g = 10 m/s²). What is its horizontal range R (in m)?',
        numericalAnswer: difficulty === 'reteach' ? 90 : 40,
        numericalTolerance: 0.5,
        acceptedUnits: ['m', 'meters'],
        unitHint: 'm',
        explanation:
          difficulty === 'reteach'
            ? 'R = u² sin(2θ) / g = 30² × sin(90°) / 10 = 900 / 10 = 90 m.'
            : 'R = u² sin(2θ) / g = 20² × sin(90°) / 10 = 400 / 10 = 40 m.',
        keyFormula: 'R = (u² sin 2θ) / g',
        misconceptions: [
          {
            id: 'phys-proj-half-range',
            wrongNumericalTarget: difficulty === 'reteach' ? 45 : 20,
            wrongNumericalTolerance: 1,
            misconceptionSummary:
              'Dividing by 2g (confusing the Range formula R = u² sin 2θ / g with the Maximum Height formula H = u² sin²θ / 2g).',
            whyIncorrect:
              'Maximum height has 2g in the denominator, whereas Horizontal Range R = u_x · T = (u cos θ)(2u sin θ / g) = u² sin(2θ) / g has g (not 2g) in the denominator.',
            coreConceptFix:
              'Use R = u² sin(2θ) / g without a factor of 2 in the denominator.',
            highlightElementIds: ['p3-range', 'p3-hmax', 'p3-land'],
          },
        ],
      };
    }

    return {
      ...baseMeta,
      id: `cc-phys-proj-s4-${difficulty}`,
      questionType: 'mcq',
      statement:
        'Two projectiles are fired from level ground with the same initial speed u. Projectile 1 is launched at θ₁ = 30°. Which launch angle θ₂ for Projectile 2 gives the exact same horizontal range R?',
      options: [
        'θ₂ = 60° (complementary angle 90° − θ₁)',
        'θ₂ = 45° (maximum range angle)',
        'θ₂ = 15° (half of θ₁)',
        'θ₂ = 75°',
      ],
      correctIndex: 0,
      explanation:
        'Since sin(2(90° − θ)) = sin(180° − 2θ) = sin(2θ), complementary launch angles θ and (90° − θ) (such as 30° and 60°) yield identical horizontal range R.',
      keyFormula: 'R(θ) = R(90° − θ) = (u² sin 2θ) / g',
      misconceptions: [
        {
          id: 'phys-proj-max-angle-confusion',
          distractorIndex: 1,
          misconceptionSummary:
            'Confusing the angle for maximum range (45°) with the complementary angle that matches R(30°).',
          whyIncorrect:
            'θ = 45° gives the maximum possible range u²/g, which is larger than R(30°) = (√3/2) u²/g.',
          coreConceptFix:
            'Subtract θ₁ from 90° to find the complementary angle with equal range: θ₂ = 90° − 30° = 60°.',
          highlightElementIds: ['p4-arc60', 'p4-arc30', 'p4-sameR'],
        },
      ],
    };
  }

  // 3. CHEMISTRY: VSEPR Theory, Steric Number, Lone Pair Repulsion & NH3 vs CH4 Bond Angles
  if (subject === 'Chemistry') {
    if (sceneNum === 1) {
      return {
        ...baseMeta,
        id: `cc-chem-vsepr-s1-${difficulty}`,
        questionType: 'mcq',
        statement:
          difficulty === 'reteach'
            ? 'In Water (H₂O), central Oxygen has 6 valence electrons and forms 2 single O–H bonds. What is its Steric Number (SN) and breakdown of Bonding Pairs (BP) + Lone Pairs (LP)?'
            : 'Using SN = ½(V + M − C + A), what is the Steric Number and electron-domain count around Nitrogen in Ammonia (NH₃, where V = 5, M = 3)?',
        options:
          difficulty === 'reteach'
            ? [
                'SN = 4 (2 Bonding Pairs + 2 Lone Pairs → sp³)',
                'SN = 2 (2 Bonding Pairs + 0 Lone Pairs → sp)',
                'SN = 3 (2 Bonding Pairs + 1 Lone Pair → sp²)',
                'SN = 6 (4 Bonding Pairs + 2 Lone Pairs → sp³d²)',
              ]
            : [
                'SN = 4 (3 Bonding Pairs + 1 Lone Pair → sp³ tetrahedral electron geometry)',
                'SN = 3 (3 Bonding Pairs + 0 Lone Pairs → sp² trigonal planar)',
                'SN = 5 (3 Bonding Pairs + 2 Lone Pairs → sp³d)',
                'SN = 2 (2 Bonding Pairs + 0 Lone Pairs → sp)',
              ],
        correctIndex: 0,
        explanation:
          difficulty === 'reteach'
            ? 'For H₂O, SN = ½(6 + 2) = 4 total electron domains: 2 O–H σ-bonding pairs and 2 non-bonding lone pairs (sp³).'
            : 'For NH₃, SN = ½(5 + 3) = 4 total electron domains: 3 N–H σ-bonding pairs plus 1 non-bonding lone pair on Nitrogen (sp³).',
        keyFormula: 'SN = ½ (V + M − C + A) = BP + LP',
        misconceptions: [
          {
            id: 'chem-vsepr-ignore-lone-pair',
            distractorIndex: 1,
            misconceptionSummary:
              'Counting only attached atoms (bonding pairs) and ignoring non-bonding lone pairs when finding Steric Number.',
            whyIncorrect:
              'Lone pairs occupy valence shell orbitals and repel strongly; omitting the lone pair falsely predicts sp² planar NH₃ or linear H₂O.',
            coreConceptFix:
              'Always add Lone Pairs (LP) to σ-Bonding Pairs (BP): SN = BP + LP = ½(V + M − C + A).',
            highlightElementIds: ['c1-center', 'c1-d1', 'c1-d4'],
          },
        ],
      };
    }

    if (sceneNum === 2) {
      return {
        ...baseMeta,
        id: `cc-chem-vsepr-s2-${difficulty}`,
        questionType: 'mcq',
        statement:
          'According to VSEPR theory, why do lone pairs compress the covalent bond angle between adjacent bonding pairs (such as reducing H–O–H in water to 104.5°)?',
        options: [
          'A lone pair is held by only one nucleus and occupies greater angular space, so LP–LP > LP–BP > BP–BP repulsion',
          'Bonding pairs repel each other more strongly than lone pairs (BP–BP > LP–LP)',
          'Lone pairs attract the attached hydrogen nuclei via ionic bonding',
          'Lone pairs reside in core 1s orbitals rather than the valence shell',
        ],
        correctIndex: 0,
        explanation:
          'Because a non-bonding lone pair is attracted by only the central nucleus (rather than shared between two nuclei), its electron cloud spreads out over a wider angle, exerting stronger repulsion: LP–LP > LP–BP > BP–BP.',
        keyFormula: 'Repulsion Order: LP–LP > LP–BP > BP–BP',
        misconceptions: [
          {
            id: 'chem-vsepr-repulsion-inverted',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming bonding pairs repel more strongly than lone pairs (inverting the VSEPR repulsion order).',
            whyIncorrect:
              'Shared bonding electrons are localized tightly between two nuclei, whereas lone-pair clouds are diffuse and exert greater angular repulsion.',
            coreConceptFix:
              'Memorize VSEPR repulsion order: Lone Pair–Lone Pair (strongest) > Lone Pair–Bond Pair > Bond Pair–Bond Pair (weakest).',
            highlightElementIds: defaultHighlights,
          },
        ],
      };
    }

    if (sceneNum === 3) {
      if (difficulty === 'reteach') {
        return {
          ...baseMeta,
          id: `cc-chem-vsepr-s3-reteach`,
          questionType: 'mcq',
          statement:
            'Both Methane (CH₄) and Ammonia (NH₃) have 4 electron domains (sp³ hybridization). Why is the H–N–H bond angle in NH₃ (107.0°) smaller than the H–C–H bond angle in CH₄ (109.5°)?',
          options: [
            'NH₃ has 1 lone pair (AX₃E₁) whose stronger LP–BP repulsion compresses the three N–H bonds from 109.5° to 107.0°',
            'NH₃ and CH₄ actually have the exact same 109.5° bond angle because both have 4 electron domains',
            'Nitrogen is sp² hybridized in NH₃ with a 120° bond angle',
            'CH₄ has 2 lone pairs that expand its bond angle to 109.5°',
          ],
          correctIndex: 0,
          explanation:
            'While both CH₄ and NH₃ have 4 electron domains (tetrahedral electron-domain geometry), NH₃ replaces one bonding pair with a lone pair (AX₃E₁). Stronger LP–BP repulsion pushes the three N–H bonds closer together, reducing the angle from 109.5° to 107.0°.',
          keyFormula: 'CH₄ (0 LP): 109.5°  >  NH₃ (1 LP): 107.0°  >  H₂O (2 LP): 104.5°',
          misconceptions: [
            {
              id: 'chem-vsepr-nh3-ch4-identical-angles',
              distractorIndex: 1,
              misconceptionSummary:
                'Assuming NH₃ and CH₄ have identical 109.5° bond angles because both have 4 electron domains (confusing electron-domain geometry with molecular geometry).',
              whyIncorrect:
                'Equal steric number (SN = 4) gives the same tetrahedral electron-domain arrangement, but a lone pair occupies more angular space than a bonding pair, compressing NH₃ to 107.0°.',
              coreConceptFix:
                'Distinguish Electron Geometry (tetrahedral for both) from Molecular Shape & Bond Angle: each lone pair compresses the sp³ angle by ~2.5° (CH₄ 109.5° → NH₃ 107.0° → H₂O 104.5°).',
              highlightElementIds: ['c3-ch4', 'c3-nh3', 'c3-h2o', 'c3-caption'],
            },
          ],
        };
      }
      return {
        ...baseMeta,
        id: `cc-chem-vsepr-s3-${difficulty}`,
        questionType: 'mcq',
        statement:
          'A student claims: "Because both CH₄ and NH₃ have 4 electron domains (Steric Number = 4, sp³), they must have the exact same 109.5° bond angle." Which statement correctly evaluates this claim?',
        options: [
          'Incorrect — NH₃ has 1 lone pair (AX₃E₁) which repels bonding pairs more strongly, compressing its H–N–H angle to 107.0° (< 109.5° in CH₄)',
          'Correct — any molecule with 4 electron domains (sp³) always has an exact 109.5° bond angle regardless of lone pairs',
          'Incorrect — NH₃ has a larger 120° bond angle because it has only 3 N–H bonds',
          'Incorrect — CH₄ has a smaller 104.5° bond angle than NH₃',
        ],
        correctIndex: 0,
        explanation:
          'Having 4 electron domains fixes the electron-domain geometry as tetrahedral, but in NH₃ (AX₃E₁) the single lone pair exerts stronger LP–BP repulsion than BP–BP repulsion, compressing the H–N–H bond angle to 107.0° compared to 109.5° in symmetric CH₄ (AX₄).',
        keyFormula: 'θ(CH₄: 109.5°) > θ(NH₃: 107.0°) > θ(H₂O: 104.5°)',
        misconceptions: [
          {
            id: 'chem-vsepr-nh3-ch4-identical-angles',
            distractorIndex: 1,
            misconceptionSummary:
              'Assuming NH₃ and CH₄ have identical bond angles because both have 4 electron domains (ignoring lone-pair compression).',
            whyIncorrect:
              '4 electron domains means sp³ hybridization for both, but NH₃ has 3 bonding pairs + 1 lone pair. Because LP–BP repulsion > BP–BP repulsion, the lone pair pushes the N–H bonds closer to 107.0°.',
            coreConceptFix:
              'Always check the lone-pair count after finding Steric Number: 0 LP (CH₄) = 109.5°, 1 LP (NH₃) = 107.0°, 2 LP (H₂O) = 104.5°.',
            highlightElementIds: ['c3-ch4', 'c3-nh3', 'c3-h2o', 'c3-caption'],
          },
          {
            id: 'chem-vsepr-nh3-trigonal-planar',
            distractorIndex: 2,
            misconceptionSummary:
              'Treating NH₃ as 3-domain trigonal planar (120°) by forgetting the unshared lone pair on Nitrogen.',
            whyIncorrect:
              'Nitrogen has 5 valence electrons: 3 used in N–H bonds and 2 forming an apical lone pair, giving 4 domains (trigonal pyramidal, 107°), not planar 120°.',
            coreConceptFix:
              'Include the non-bonding lone pair in the steric number (SN = 3 + 1 = 4).',
            highlightElementIds: ['c3-nh3', 'c3-caption'],
          },
        ],
      };
    }

    // Scene 4: Dipole Moment & Polarity
    return {
      ...baseMeta,
      id: `cc-chem-vsepr-s4-${difficulty}`,
      questionType: 'mcq',
      statement:
        'Why does Water (H₂O) have a large net dipole moment (μ = 1.85 D, polar) whereas Carbon Dioxide (CO₂) and Methane (CH₄) have zero net dipole moment (μ = 0 D, non-polar)?',
      options: [
        'H₂O has a bent geometry (104.5°) so its two O–H bond dipoles add constructively, whereas symmetric linear CO₂ and tetrahedral CH₄ cancel out',
        'C–O and C–H bonds have zero electronegativity difference',
        'H₂O is linear (180°) so its bond dipoles reinforce along a straight line',
        'Lone pairs always cancel out bond dipoles to make AX₂E₂ molecules non-polar',
      ],
      correctIndex: 0,
      explanation:
        'Because H₂O is bent (AX₂E₂, 104.5°), the two O–H bond dipole vectors do not oppose each other at 180°; their vertical components add constructively to give μ_net = 1.85 D.',
      keyFormula: 'μ_net = |Σ μ_i|   (Bent H₂O: μ = 1.85 D ≠ 0)',
      misconceptions: [
        {
          id: 'chem-vsepr-linear-water-dipole',
          distractorIndex: 2,
          misconceptionSummary:
            'Assuming H₂O is linear (180°) like CO₂.',
          whyIncorrect:
            'If H₂O were linear, its two equal and opposite O–H bond dipoles would cancel to μ = 0 D. Its non-zero 1.85 D dipole proves its bent VSEPR geometry.',
          coreConceptFix:
            'Two lone pairs on Oxygen bend H₂O to 104.5°, preventing dipole cancellation.',
          highlightElementIds: ['c4-o', 'c4-d1', 'c4-d2', 'c4-net'],
        },
      ],
    };
  }

  // 4. MATHEMATICS: Conic Sections & Parabola y² = 4ax
  if (
    lower.includes('parabola') ||
    lower.includes('conic') ||
    lower.includes('latus rectum') ||
    lower.includes('directrix') ||
    lower.includes('quadratic')
  ) {
    if (sceneNum === 1) {
      return {
        ...baseMeta,
        id: `cc-math-conic-s1-${difficulty}`,
        questionType: 'mcq',
        statement:
          'For the standard parabola y² = 4ax (a > 0), what are the coordinates of the focus S, the equation of the directrix, and the eccentricity e?',
        options: [
          'Focus S(a, 0), Directrix x = −a, and Eccentricity e = 1',
          'Focus S(0, a), Directrix y = −a, and Eccentricity e = 1',
          'Focus S(4a, 0), Directrix x = −4a, and Eccentricity e = 1',
          'Focus S(a, 0), Directrix x = a, and Eccentricity e = 0',
        ],
        correctIndex: 0,
        explanation:
          'Every point P(x, y) on y² = 4ax is equidistant (e = PS/PM = 1) from focus S(a, 0) on the +x-axis and the vertical directrix line x = −a.',
        keyFormula: 'PS = PM  ⇒  y² = 4ax,   S = (a, 0),   x = −a',
        misconceptions: [
          {
            id: 'math-conic-axis-swap',
            distractorIndex: 1,
            misconceptionSummary:
              'Placing the focus of y² = 4ax on the y-axis at (0, a) instead of the x-axis at (a, 0).',
            whyIncorrect:
              'y² = 4ax is symmetric about the x-axis (replacing y with −y leaves the equation unchanged), so its focus lies on the x-axis at S(a, 0).',
            coreConceptFix:
              'Look at the linear variable: in y² = 4ax, x is linear so the axis of symmetry is the x-axis and Focus is S(a, 0).',
            highlightElementIds: ['m1-focus', 'm1-dir', 'm1-ps'],
          },
          {
            id: 'math-conic-4a-focus',
            distractorIndex: 2,
            misconceptionSummary:
              'Using the full coefficient 4a as the focus coordinate S(4a, 0) instead of dividing by 4 to get a.',
            whyIncorrect:
              'The standard equation is y² = 4ax, so the focal distance from the vertex is a = (coefficient of x) / 4.',
            coreConceptFix:
              'Always equate the coefficient of x to 4a first, then divide by 4 to find Focus S(a, 0).',
            highlightElementIds: ['m1-focus', 'm1-dir'],
          },
        ],
      };
    }

    if (sceneNum === 2) {
      return {
        ...baseMeta,
        id: `cc-math-conic-s2-${difficulty}`,
        questionType: 'numerical',
        statement:
          difficulty === 'reteach'
            ? 'For the parabola y² = 16x, what is the total length of its latus rectum?'
            : 'For the parabola y² = 12x, what is the total length of the latus rectum chord passing through the focus?',
        numericalAnswer: difficulty === 'reteach' ? 16 : 12,
        numericalTolerance: 0.1,
        explanation:
          difficulty === 'reteach'
            ? 'Comparing y² = 16x with y² = 4ax gives 4a = 16 (so a = 4). The total length of the latus rectum is 4a = 16.'
            : 'Comparing y² = 12x with y² = 4ax gives 4a = 12 (so a = 3). The total length of the latus rectum is 4a = 12.',
        keyFormula: 'Length of Latus Rectum = 4a',
        misconceptions: [
          {
            id: 'math-conic-latus-rectum-a-vs-4a',
            wrongNumericalTarget: difficulty === 'reteach' ? 4 : 3,
            wrongNumericalTolerance: 0.1,
            misconceptionSummary:
              'Giving the focal distance a instead of the full latus rectum length 4a.',
            whyIncorrect:
              'a is the distance from vertex (0,0) to focus S(a,0). The latus rectum extends from (a, −2a) to (a, +2a), so its total length is 4a.',
            coreConceptFix:
              'For y² = 4ax, the latus rectum length equals the entire coefficient 4a.',
            highlightElementIds: defaultHighlights,
          },
        ],
      };
    }

    if (sceneNum === 3) {
      return {
        ...baseMeta,
        id: `cc-math-conic-s3-${difficulty}`,
        questionType: 'mcq',
        statement:
          'At the parametric point P(at², 2at) on the parabola y² = 4ax, what are the slope of the tangent and the tangent line equation?',
        options: [
          'Slope m = 1/t  and  Tangent equation: t·y = x + a·t²',
          'Slope m = t  and  Tangent equation: y = t·x + a·t²',
          'Slope m = −t  and  Tangent equation: y + t·x = 2at + at³',
          'Slope m = 2/t  and  Tangent equation: t·y = 2x + a·t²',
        ],
        correctIndex: 0,
        explanation:
          'Differentiating y² = 4ax gives 2y(dy/dx) = 4a ⇒ dy/dx = 2a/y = 2a/(2at) = 1/t. Thus the tangent is y − 2at = (1/t)(x − at²) ⇔ ty = x + at².',
        keyFormula: 'P(t) = (at², 2at),   Tangent: t·y = x + a·t²',
        misconceptions: [
          {
            id: 'math-conic-normal-vs-tangent',
            distractorIndex: 2,
            misconceptionSummary:
              'Confusing the normal line equation (slope −t) with the tangent line equation (slope 1/t).',
            whyIncorrect:
              'Slope −t is perpendicular to the tangent and gives the normal equation y + tx = 2at + at³.',
            coreConceptFix:
              'Tangent slope at P(t) is m = 1/t, giving ty = x + at².',
            highlightElementIds: ['m3-pt', 'm3-tan', 'm3-xint'],
          },
        ],
      };
    }

    return {
      ...baseMeta,
      id: `cc-math-conic-s4-${difficulty}`,
      questionType: 'mcq',
      statement:
        'For a line y = mx + c (m ≠ 0) to be tangent to the parabola y² = 4ax, what condition must the y-intercept c satisfy?',
      options: [
        'c = a / m  (where discriminant Δ = 0, touching at (a/m², 2a/m))',
        'c = a · m  (multiplying focal parameter a by slope m)',
        'c = −a · m²',
        'c = 4a / m',
      ],
      correctIndex: 0,
      explanation:
        'Substituting y = mx + c into y² = 4ax yields m²x² + (2mc − 4a)x + c² = 0. Setting discriminant Δ = (2mc − 4a)² − 4m²c² = 0 simplifies to mc = a ⇒ c = a/m.',
      keyFormula: 'Δ = 0  ⇔  c = a / m',
      misconceptions: [
        {
          id: 'math-conic-tangent-am',
          distractorIndex: 1,
          misconceptionSummary:
            'Writing c = a·m instead of c = a/m for the slope-form tangent to y² = 4ax.',
          whyIncorrect:
            'As slope m increases (steeper line), the tangent touches closer to the vertex so the y-intercept c = a/m must decrease inversely with m.',
          coreConceptFix:
            'In slope form, the tangent to y² = 4ax is y = mx + a/m (so c = a/m).',
          highlightElementIds: ['m4-parab', 'm4-tan'],
        },
      ],
    };
  }

  // 5. DEFAULT MATHEMATICS: Conditional Probability, Total Probability & Bayes' Theorem
  if (sceneNum === 1) {
    return {
      ...baseMeta,
      id: `cc-math-prob-s1-${difficulty}`,
      questionType: 'mcq',
      statement:
        difficulty === 'reteach'
          ? 'If a diagnostic study partitions the population into E₁ (has condition, P(E₁) = 0.01) and E₂ (healthy), what must P(E₂) and P(E₁ ∩ E₂) equal?'
          : 'To apply the Law of Total Probability and Bayes’ Theorem, what two conditions must the prior hypotheses E₁ and E₂ satisfy on sample space S?',
      options:
        difficulty === 'reteach'
          ? [
              'P(E₂) = 0.99 and P(E₁ ∩ E₂) = 0 (mutually exclusive & exhaustive)',
              'P(E₂) = 0.01 and P(E₁ ∩ E₂) = 0.01',
              'P(E₂) = 0.99 and P(E₁ ∩ E₂) = 0.01 × 0.99 (independent)',
              'P(E₂) = 0.50 and P(E₁ ∩ E₂) = 0',
            ]
          : [
              'They must be mutually exclusive (E₁ ∩ E₂ = ∅) and exhaustive (P(E₁) + P(E₂) = 1)',
              'They must be statistically independent (P(E₁ ∩ E₂) = P(E₁)P(E₂)) and have equal probabilities',
              'They must have P(E₁ | E₂) = 1',
              'Their probabilities must multiply to 1 (P(E₁) · P(E₂) = 1)',
            ],
      correctIndex: 0,
      explanation:
        'A valid partition of sample space S requires mutually exclusive (disjoint, E₁ ∩ E₂ = ∅) and exhaustive events whose prior probabilities sum to 1: P(E₁) + P(E₂) = 1.',
      keyFormula: 'P(E₁) + P(E₂) = 1,   E₁ ∩ E₂ = ∅',
      misconceptions: [
        {
          id: 'math-prob-disjoint-vs-independent',
          distractorIndex: 1,
          misconceptionSummary:
            'Confusing mutually exclusive (disjoint) partition events with statistically independent events.',
          whyIncorrect:
            'For non-empty partition events E₁ and E₂, if E₁ occurs then E₂ cannot occur, so P(E₁ ∩ E₂) = 0 ≠ P(E₁)P(E₂). Disjoint events with positive probability are never independent.',
          coreConceptFix:
            'Partition branches from the root of a probability tree are mutually exclusive (P(E₁ ∩ E₂) = 0) and sum to 1.',
          highlightElementIds: ['b1-root', 'b1-br1', 'b1-br2'],
        },
      ],
    };
  }

  if (sceneNum === 2) {
    if (difficulty === 'reteach') {
      return {
        ...baseMeta,
        id: `cc-math-prob-s2-reteach`,
        questionType: 'mcq',
        statement:
          'Why is the conditional probability P(A | B) generally NOT equal to P(B | A)?',
        options: [
          'Because P(A | B) = P(A ∩ B) / P(B) conditions on event B (dividing by P(B)), whereas P(B | A) = P(A ∩ B) / P(A) conditions on event A (dividing by P(A))',
          'Because the numerators P(A ∩ B) and P(B ∩ A) are different numbers',
          'P(A | B) and P(B | A) are always equal for any two events A and B',
          'Because P(A | B) = P(A) / P(B) without using the intersection',
        ],
        correctIndex: 0,
        explanation:
          'While both share the same intersection numerator P(A ∩ B), P(A | B) restricts the sample space to B (dividing by P(B)), whereas P(B | A) restricts the sample space to A (dividing by P(A)). They are equal only when P(A) = P(B) or P(A ∩ B) = 0.',
        keyFormula: 'P(A | B) = P(A ∩ B) / P(B)  ≠  P(B | A) = P(A ∩ B) / P(A)',
        misconceptions: [
          {
            id: 'math-prob-pab-vs-pba-inversion',
            distractorIndex: 2,
            misconceptionSummary:
              'Confusing P(A | B) with P(B | A) and assuming conditional probability is symmetric.',
            whyIncorrect:
              'Conditioning changes the denominator (the restricted sample space). For example, P(Positive Test | Disease) = 0.99 is very different from P(Disease | Positive Test) = 1/6 ≈ 0.167.',
            coreConceptFix:
              'Always check which event is GIVEN (after the "|" bar): the given event goes in the denominator, P(Target | Given) = P(Target ∩ Given) / P(Given).',
            highlightElementIds: ['b2-a1', 'b2-a2', 'b2-j1', 'b2-j2'],
          },
        ],
      };
    }
    return {
      ...baseMeta,
      id: `cc-math-prob-s2-${difficulty}`,
      questionType: 'mcq',
      statement:
        'Given P(E₁) = 0.01 and test sensitivity P(A | E₁) = 0.99, a student writes P(E₁ | A) = P(A | E₁) = 0.99 and divides P(A ∩ E₁) by P(E₁) when asked for P(E₁ | A). What conceptual error did the student make?',
      options: [
        'Confused P(E₁ | A) with P(A | E₁) — finding P(E₁ | A) requires dividing P(E₁ ∩ A) by P(A), not by P(E₁)',
        'No error — P(A | B) is always equal to P(B | A) for conditional probabilities',
        'Added P(E₁) + P(A | E₁) instead of multiplying along the branch',
        'Used P(E₂) instead of P(E₁) in the numerator',
      ],
      correctIndex: 0,
      explanation:
        'P(A | E₁) = P(E₁ ∩ A) / P(E₁) = 0.99 conditions on having the disease E₁, whereas P(E₁ | A) = P(E₁ ∩ A) / P(A) conditions on observing a positive test A. Equating P(A | B) with P(B | A) is the classic inverse-probability misconception.',
      keyFormula: 'P(A | B) = P(A ∩ B) / P(B)   vs   P(B | A) = P(A ∩ B) / P(A)',
      misconceptions: [
        {
          id: 'math-prob-pab-vs-pba-confusion',
          distractorIndex: 1,
          misconceptionSummary:
            'Confusing P(A | B) with P(B | A) (treating conditional probability as symmetric and dividing by the wrong marginal probability).',
          whyIncorrect:
            'P(A | B) measures the fraction of B outcomes where A occurs (denominator P(B)), while P(B | A) measures the fraction of A outcomes where B occurs (denominator P(A)).',
          coreConceptFix:
            'Identify the conditioning event after "|": P(E₁ | A) has denominator P(A), whereas P(A | E₁) has denominator P(E₁).',
          highlightElementIds: ['b2-e1', 'b2-a1', 'b2-j1', 'b2-j2'],
        },
        {
          id: 'math-prob-add-instead-of-multiply',
          distractorIndex: 2,
          misconceptionSummary:
            'Adding prior and conditional likelihood instead of multiplying P(E₁) · P(A | E₁) for joint probability.',
          whyIncorrect:
            'Sequential stages along a single branch represent an intersection (E₁ ∩ A), which requires multiplication.',
          coreConceptFix:
            'Multiply along a branch for joint probability: P(E₁ ∩ A) = P(E₁) · P(A | E₁) = 0.01 × 0.99 = 0.0099.',
          highlightElementIds: ['b2-e1', 'b2-a1', 'b2-j1'],
        },
      ],
    };
  }

  if (sceneNum === 3) {
    return {
      ...baseMeta,
      id: `cc-math-prob-s3-${difficulty}`,
      questionType: 'numerical',
      statement:
        difficulty === 'reteach'
          ? 'If branch 1 has joint probability P(E₁)P(A|E₁) = 0.02 and branch 2 has joint probability P(E₂)P(A|E₂) = 0.08, what is the total probability P(A)?'
          : 'Given true-positive branch weight P(E₁)P(A|E₁) = 0.0099 and false-positive branch weight P(E₂)P(A|E₂) = 0.0495, compute the total marginal probability P(A).',
      numericalAnswer: difficulty === 'reteach' ? 0.1 : 0.0594,
      numericalTolerance: 0.001,
      explanation:
        difficulty === 'reteach'
          ? 'By the Law of Total Probability, P(A) = P(E₁)P(A|E₁) + P(E₂)P(A|E₂) = 0.02 + 0.08 = 0.10.'
          : 'By the Law of Total Probability, sum all disjoint pathways leading to A: P(A) = 0.0099 + 0.0495 = 0.0594.',
      keyFormula: 'P(A) = P(E₁)P(A | E₁) + P(E₂)P(A | E₂)',
      misconceptions: [
        {
          id: 'math-prob-omit-false-positives',
          wrongNumericalTarget: difficulty === 'reteach' ? 0.02 : 0.0099,
          wrongNumericalTolerance: 0.001,
          misconceptionSummary:
            'Using only the first branch P(E₁)P(A|E₁) as total probability P(A) and ignoring the complementary false-positive pathway P(E₂)P(A|E₂).',
          whyIncorrect:
            'Event A can occur via either E₁ (true positive) or E₂ (false positive). Omitting the E₂ branch underestimates the denominator P(A).',
          coreConceptFix:
            'Sum P(E_i)P(A | E_i) over ALL mutually exclusive hypotheses i = 1, 2.',
          highlightElementIds: ['b3-j1', 'b3-j2', 'b3-tot'],
        },
      ],
    };
  }

  // Scene 4: Bayes' Theorem Posterior Update
  return {
    ...baseMeta,
    id: `cc-math-prob-s4-${difficulty}`,
    questionType: 'mcq',
    statement:
      'With P(E₁) = 0.01, P(A | E₁) = 0.99 (true positive branch = 0.0099), and P(A | E₂) = 0.05 (false positive branch = 0.0495, total P(A) = 0.0594), what is the exact posterior probability P(E₁ | A)?',
    options: [
      'P(E₁ | A) = 0.0099 / 0.0594 = 1/6 ≈ 16.7%',
      'P(E₁ | A) = P(A | E₁) = 99.0% (confusing P(E₁ | A) with P(A | E₁))',
      'P(E₁ | A) = 1 − 0.05 = 95.0%',
      'P(E₁ | A) = 0.0099 (0.99%)',
    ],
    correctIndex: 0,
    explanation:
      'By Bayes’ Theorem, P(E₁ | A) = P(E₁)P(A | E₁) / P(A) = 0.0099 / (0.0099 + 0.0495) = 0.0099 / 0.0594 = 1/6 ≈ 16.7%. Because the condition is rare (1%), false positives (4.95%) outnumber true positives (0.99%) by 5 to 1.',
    keyFormula: 'P(E₁ | A) = [ P(E₁) · P(A | E₁) ] / [ P(E₁)P(A | E₁) + P(E₂)P(A | E₂) ] = 1/6',
    misconceptions: [
      {
        id: 'math-prob-bayes-inverse-fallacy',
        distractorIndex: 1,
        misconceptionSummary:
          'Confusing posterior P(E₁ | A) with likelihood P(A | E₁) = 99% (the Base-Rate / Inverse Probability Fallacy).',
        whyIncorrect:
          'P(A | E₁) = 99% is the probability of testing positive GIVEN disease E₁. To invert the condition to P(E₁ | A), you must weight by the rare prior P(E₁) = 0.01 and divide by total positive rate P(A) = 0.0594.',
        coreConceptFix:
          'Never equate P(Hypothesis | Evidence) with P(Evidence | Hypothesis); always normalize the target branch weight by total probability P(Evidence).',
        highlightElementIds: ['b4-bar1', 'b4-bar2', 'b4-post', 'b4-arrow'],
      },
      {
        id: 'math-prob-complement-false-pos',
        distractorIndex: 2,
        misconceptionSummary:
          'Computing posterior probability as 1 − P(A | E₂) = 95% while ignoring the prior base rate P(E₁) = 1%.',
        whyIncorrect:
          '1 − P(A | E₂) is the test specificity P(A′ | E₂), not the posterior probability P(E₁ | A).',
        coreConceptFix:
          'Use Bayes’ ratio: Target Branch / (Target Branch + Competing Branches) = 0.0099 / 0.0594 = 1/6.',
        highlightElementIds: ['b4-bar1', 'b4-bar2', 'b4-post'],
      },
    ],
  };
}

/**
 * Builds the deterministic Adaptive Visual Reteaching specification for a scene,
 * reusing its StructuredDiagramSpec element IDs and attaching an equivalent follow-up question.
 */
export function buildDeterministicSceneReteaching(
  scene: Pick<
    AnimatedExplanationScene,
    | 'sceneNumber'
    | 'heading'
    | 'teachingPoint'
    | 'keyFormula'
    | 'citedPages'
    | 'isSupportedByMaterial'
    | 'spec'
  >,
  options: {
    topic: string;
    subject?: EducationalSubject;
    sourceDocumentTitle?: string;
  }
): SceneReteachingSpec {
  const safeTopic = sanitizeBoundedString(options.topic || 'Core Study Concept', 120) || 'Core Study Concept';
  const subject = options.subject || detectEducationalSubject(`${safeTopic} ${scene.heading}`);
  const followUpQuestion = buildDeterministicSceneConceptCheck(scene, {
    topic: safeTopic,
    subject,
    difficulty: 'reteach',
    sourceDocumentTitle: options.sourceDocumentTitle,
  });

  const primaryCheck = buildDeterministicSceneConceptCheck(scene, {
    topic: safeTopic,
    subject,
    difficulty: 'standard',
    sourceDocumentTitle: options.sourceDocumentTitle,
  });

  const allElementIds = scene.spec?.elements?.map((el) => el.id) || [];
  const ruleHighlights =
    primaryCheck.misconceptions?.[0]?.highlightElementIds?.filter((id) =>
      allElementIds.includes(id)
    ) || [];
  const highlightElementIds =
    ruleHighlights.length > 0 ? ruleHighlights : allElementIds.slice(0, Math.min(4, allElementIds.length));

  const primaryMisconception = primaryCheck.misconceptions?.[0];

  return {
    sceneNumber: scene.sceneNumber,
    teachingPoint: scene.teachingPoint,
    alternativeExplanation: primaryMisconception
      ? `Let's look at why a common trap happens here: ${primaryMisconception.whyIncorrect} ${primaryMisconception.coreConceptFix}`
      : `Focus on the core relationship in the diagram: ${scene.teachingPoint} Notice how each highlighted vector or branch directly feeds into ${scene.keyFormula}.`,
    stepByStepBreakdown: [
      `1. Inspect the highlighted diagram elements (${highlightElementIds.join(', ') || 'all active vectors'}) in the visual schematic.`,
      `2. Core Principle: ${scene.teachingPoint}`,
      `3. Governing Formula Breakdown: ${scene.keyFormula}`,
      primaryMisconception
        ? `4. Exam Fix: ${primaryMisconception.coreConceptFix}`
        : `4. Verify units, conditioning direction, and boundary cases before selecting your answer.`,
    ],
    highlightElementIds,
    keyFormula: scene.keyFormula,
    followUpQuestion,
  };
}

/**
 * Produces a copy of a scene's StructuredDiagramSpec where the reteaching target elements
 * are visually emphasized (thicker stroke / bright highlight ring) for Adaptive Visual Reteaching.
 */
export function getHighlightedDiagramSpecForReteaching(
  spec: StructuredDiagramSpec,
  highlightElementIds: string[]
): StructuredDiagramSpec {
  if (!Array.isArray(highlightElementIds) || highlightElementIds.length === 0) {
    return spec;
  }
  const highlightSet = new Set(highlightElementIds);
  const updatedElements: DiagramElement[] = spec.elements.map((el) => {
    if (!highlightSet.has(el.id)) {
      return el;
    }
    if (el.kind === 'arrow' || el.kind === 'line') {
      return {
        ...el,
        strokeWidth: Math.max(4, (el.strokeWidth || 2.5) + 1.5),
      };
    }
    if (el.kind === 'rect' || el.kind === 'circle') {
      return {
        ...el,
        strokeWidth: 3.5,
      };
    }
    return el;
  });

  return {
    ...spec,
    elements: updatedElements,
  };
}

/**
 * Validates and sanitizes an AI-generated or custom SceneConceptCheckQuestion.
 * Rejects malformed/ambiguous questions, strips XSS, and enforces PDF citation grounding.
 */
export function validateAndSanitizeConceptCheck(
  raw: unknown,
  scene: Pick<
    AnimatedExplanationScene,
    | 'sceneNumber'
    | 'heading'
    | 'teachingPoint'
    | 'keyFormula'
    | 'citedPages'
    | 'isSupportedByMaterial'
    | 'spec'
  >,
  options: {
    topic: string;
    subject?: EducationalSubject;
    difficulty?: ConceptCheckDifficulty;
    contextText?: string;
    citedPages?: number[];
    validPageNumbers?: number[];
    sourceDocumentTitle?: string;
  }
): {
  valid: boolean;
  isFallback: boolean;
  question: SceneConceptCheckQuestion;
  warnings: string[];
} {
  const warnings: string[] = [];
  const safeTopic = sanitizeBoundedString(options.topic || 'Core Study Concept', 120) || 'Core Study Concept';
  const subject = options.subject || detectEducationalSubject(`${safeTopic} ${scene.heading}`);
  const difficulty: ConceptCheckDifficulty = options.difficulty || 'standard';

  const citationInfo = resolveSupportedCitedPages(
    `${safeTopic} ${scene.heading}`,
    options.contextText || '',
    options.citedPages ?? scene.citedPages,
    options.validPageNumbers
  );

  const buildFallback = (reason: string) => {
    warnings.push(reason);
    const q = buildDeterministicSceneConceptCheck(
      {
        ...scene,
        citedPages: citationInfo.citedPages,
        isSupportedByMaterial: citationInfo.isSupported,
      },
      {
        topic: safeTopic,
        subject,
        difficulty,
        sourceDocumentTitle: options.sourceDocumentTitle,
      }
    );
    return {
      valid: false,
      isFallback: true,
      question: q,
      warnings,
    };
  };

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return buildFallback('Concept check JSON could not be parsed; using verified fallback question.');
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return buildFallback('Concept check payload was empty or non-object; using verified fallback question.');
  }

  const obj = parsed as Record<string, unknown>;
  const rawType = String(obj.questionType || 'mcq').toLowerCase();
  if (rawType !== 'mcq' && rawType !== 'numerical') {
    return buildFallback(`Unsupported questionType "${rawType}"; using verified fallback question.`);
  }

  const statement = sanitizeBoundedString(obj.statement || obj.question, 360);
  if (!statement || statement.length < 12) {
    return buildFallback('Question statement was missing or too short; using verified fallback question.');
  }

  const explanation = sanitizeBoundedString(obj.explanation, 420);
  if (!explanation || explanation.length < 10) {
    return buildFallback('Question explanation was missing or too short; using verified fallback question.');
  }

  const keyFormula =
    sanitizeBoundedString(obj.keyFormula, 160) || sanitizeBoundedString(scene.keyFormula, 160);

  // Sanitize misconceptions
  const fallbackTemplate = buildDeterministicSceneConceptCheck(
    {
      ...scene,
      citedPages: citationInfo.citedPages,
      isSupportedByMaterial: citationInfo.isSupported,
    },
    {
      topic: safeTopic,
      subject,
      difficulty,
      sourceDocumentTitle: options.sourceDocumentTitle,
    }
  );

  const sanitizedMisconceptions: ConceptMisconceptionRule[] = [];
  if (Array.isArray(obj.misconceptions)) {
    for (let i = 0; i < Math.min(4, obj.misconceptions.length); i++) {
      const m = obj.misconceptions[i];
      if (!m || typeof m !== 'object') continue;
      const rec = m as Record<string, unknown>;
      const summary = sanitizeBoundedString(rec.misconceptionSummary || rec.summary, 220);
      const whyIncorrect = sanitizeBoundedString(rec.whyIncorrect, 260);
      const coreConceptFix = sanitizeBoundedString(rec.coreConceptFix, 260);
      if (!summary || !whyIncorrect) continue;
      sanitizedMisconceptions.push({
        id: sanitizeBoundedString(rec.id, 60) || `ai-misconception-${i + 1}`,
        distractorIndex:
          typeof rec.distractorIndex === 'number' &&
          Number.isInteger(rec.distractorIndex) &&
          rec.distractorIndex >= 0 &&
          rec.distractorIndex <= 3
            ? rec.distractorIndex
            : undefined,
        wrongNumericalTarget:
          typeof rec.wrongNumericalTarget === 'number' && Number.isFinite(rec.wrongNumericalTarget)
            ? rec.wrongNumericalTarget
            : undefined,
        wrongNumericalTolerance:
          typeof rec.wrongNumericalTolerance === 'number' &&
          Number.isFinite(rec.wrongNumericalTolerance) &&
          rec.wrongNumericalTolerance > 0
            ? rec.wrongNumericalTolerance
            : undefined,
        misconceptionSummary: summary,
        whyIncorrect,
        coreConceptFix: coreConceptFix || fallbackTemplate.teachingPoint,
        highlightElementIds: Array.isArray(rec.highlightElementIds)
          ? rec.highlightElementIds
              .map((id) => sanitizeBoundedString(id, 40))
              .filter(Boolean)
              .slice(0, 5)
          : fallbackTemplate.misconceptions[0]?.highlightElementIds,
      });
    }
  }

  const finalMisconceptions =
    sanitizedMisconceptions.length > 0 ? sanitizedMisconceptions : fallbackTemplate.misconceptions;

  if (rawType === 'mcq') {
    if (!Array.isArray(obj.options) || obj.options.length !== 4) {
      return buildFallback('MCQ must provide exactly 4 options; using verified fallback question.');
    }
    const cleanOptions = obj.options.map((opt) => sanitizeBoundedString(opt, 180));
    if (cleanOptions.some((opt) => !opt || opt.length < 1)) {
      return buildFallback('One or more MCQ options were empty after sanitization.');
    }
    const uniqueNormalized = new Set(cleanOptions.map((opt) => opt.toLowerCase()));
    if (uniqueNormalized.size < 4) {
      return buildFallback('MCQ options contained duplicate choices (ambiguous question).');
    }

    const correctIndex = Number(obj.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      return buildFallback('MCQ correctIndex was missing or out of bounds (0..3).');
    }

    return {
      valid: true,
      isFallback: false,
      warnings,
      question: {
        id:
          sanitizeBoundedString(obj.id, 80) ||
          `cc-ai-s${scene.sceneNumber}-${difficulty}`,
        sceneNumber: scene.sceneNumber,
        topic: safeTopic,
        subject,
        teachingPoint: sanitizeBoundedString(obj.teachingPoint, 240) || scene.teachingPoint,
        questionType: 'mcq',
        difficulty,
        statement,
        options: cleanOptions as [string, string, string, string],
        correctIndex,
        explanation,
        keyFormula,
        misconceptions: finalMisconceptions,
        citedPages: citationInfo.citedPages,
        isSupportedByMaterial: citationInfo.isSupported,
        sourceDocumentTitle: options.sourceDocumentTitle,
        provenance: 'ai_grounded',
      },
    };
  }

  // Numerical question validation
  const numericalAnswer = Number(obj.numericalAnswer);
  if (!Number.isFinite(numericalAnswer)) {
    return buildFallback('Numerical question lacked a finite numericalAnswer.');
  }
  const numericalTolerance = clampNumber(
    obj.numericalTolerance,
    0.0001,
    Math.max(10, Math.abs(numericalAnswer) * 0.25),
    Math.max(0.05, Math.abs(numericalAnswer) * 0.02)
  );
  const acceptedUnits = Array.isArray(obj.acceptedUnits)
    ? obj.acceptedUnits
        .map((u) => sanitizeBoundedString(u, 20))
        .filter(Boolean)
        .slice(0, 6)
    : undefined;
  const unitHint = sanitizeBoundedString(obj.unitHint, 24) || acceptedUnits?.[0] || undefined;

  return {
    valid: true,
    isFallback: false,
    warnings,
    question: {
      id:
        sanitizeBoundedString(obj.id, 80) ||
        `cc-ai-num-s${scene.sceneNumber}-${difficulty}`,
      sceneNumber: scene.sceneNumber,
      topic: safeTopic,
      subject,
      teachingPoint: sanitizeBoundedString(obj.teachingPoint, 240) || scene.teachingPoint,
      questionType: 'numerical',
      difficulty,
      statement,
      numericalAnswer,
      numericalTolerance,
      acceptedUnits,
      unitHint,
      explanation,
      keyFormula,
      misconceptions: finalMisconceptions,
      citedPages: citationInfo.citedPages,
      isSupportedByMaterial: citationInfo.isSupported,
      sourceDocumentTitle: options.sourceDocumentTitle,
      provenance: 'ai_grounded',
    },
  };
}

/**
 * Creates the initial per-scene mastery state map for a multi-scene lesson.
 */
export function createInitialSceneMasteryMap(
  scenes: AnimatedExplanationScene[]
): Record<number, SceneConceptMasteryState> {
  const map: Record<number, SceneConceptMasteryState> = {};
  for (const sc of scenes) {
    map[sc.sceneNumber] = {
      sceneNumber: sc.sceneNumber,
      status: 'unseen',
      attemptsCount: 0,
      wrongAttemptsCount: 0,
      correctAttemptsCount: 0,
      skippedCount: 0,
      activeVariant: 'standard',
      reteachingUnlocked: false,
      reteachingCompleted: false,
      lastAttempt: null,
    };
  }
  return map;
}

/**
 * Evaluates a student's MCQ or numerical submission on a scene's Concept Check,
 * detects specific conceptual misconceptions, updates SceneConceptMasteryState,
 * and determines whether to trigger explanation + replay (1st wrong) or Adaptive Visual Reteaching (>=2 wrong).
 */
export function evaluateConceptCheckSubmission(params: {
  question: SceneConceptCheckQuestion;
  selectedOptionIndex?: number;
  enteredNumericalText?: string;
  previousSceneState?: SceneConceptMasteryState;
  studentUid?: string;
  documentId?: string;
  documentTitle?: string;
  timestamp?: string;
}): {
  validSubmission: boolean;
  validationError?: string;
  attemptRecord?: ConceptCheckAttemptRecord;
  nextSceneState: SceneConceptMasteryState;
  feedbackAction:
    | 'positive_advance_or_challenge'
    | 'targeted_explanation_and_replay'
    | 'open_adaptive_visual_reteaching';
} {
  const { question } = params;
  const prevState: SceneConceptMasteryState = params.previousSceneState || {
    sceneNumber: question.sceneNumber,
    status: 'unseen',
    attemptsCount: 0,
    wrongAttemptsCount: 0,
    correctAttemptsCount: 0,
    skippedCount: 0,
    activeVariant: question.difficulty || 'standard',
    reteachingUnlocked: false,
    reteachingCompleted: false,
    lastAttempt: null,
  };

  let isCorrect = false;
  let selectedOptionText: string | undefined;
  let normalizedNumericalValue: number | null = null;
  let correctAnswerDisplay = '';
  let detectedMisconception: ConceptCheckAttemptRecord['detectedMisconception'] = null;

  if (question.questionType === 'mcq') {
    const idx = params.selectedOptionIndex;
    const options = question.options || ['', '', '', ''];
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx > 3) {
      return {
        validSubmission: false,
        validationError: 'Please select one of the four options before submitting.',
        nextSceneState: prevState,
        feedbackAction: 'targeted_explanation_and_replay',
      };
    }
    selectedOptionText = options[idx];
    const correctIdx = typeof question.correctIndex === 'number' ? question.correctIndex : 0;
    correctAnswerDisplay = options[correctIdx] || `Option ${correctIdx + 1}`;
    isCorrect = idx === correctIdx;

    if (!isCorrect) {
      const matchedRule =
        question.misconceptions.find((m) => m.distractorIndex === idx) ||
        question.misconceptions[0];
      if (matchedRule) {
        detectedMisconception = {
          id: matchedRule.id,
          summary: matchedRule.misconceptionSummary,
          whyIncorrect: matchedRule.whyIncorrect,
          coreConceptFix: matchedRule.coreConceptFix,
          highlightElementIds: matchedRule.highlightElementIds,
        };
      } else {
        detectedMisconception = {
          id: `cautious-mcq-s${question.sceneNumber}`,
          summary: `This answer may indicate confusion between "${selectedOptionText}" and the governing rule (${question.keyFormula}).`,
          whyIncorrect: question.explanation,
          coreConceptFix: question.teachingPoint,
        };
      }
    }
  } else {
    // Numerical question
    const expected = typeof question.numericalAnswer === 'number' ? question.numericalAnswer : 0;
    const grade = normalizeAndGradeNumericalAnswer(
      params.enteredNumericalText,
      expected,
      question.numericalTolerance,
      question.acceptedUnits
    );
    if (!grade.validInput || grade.normalizedValue === null) {
      return {
        validSubmission: false,
        validationError:
          grade.errorReason || 'Please enter a valid number or fraction (e.g., 10, 0.0594, or 1/6).',
        nextSceneState: prevState,
        feedbackAction: 'targeted_explanation_and_replay',
      };
    }
    normalizedNumericalValue = grade.normalizedValue;
    isCorrect = grade.isCorrect;
    correctAnswerDisplay = `${expected}${question.unitHint ? ` ${question.unitHint}` : ''}`;

    if (!isCorrect) {
      const enteredVal = grade.normalizedValue;
      const matchedNumericRule = question.misconceptions.find((m) => {
        if (typeof m.wrongNumericalTarget !== 'number') return false;
        const tol = m.wrongNumericalTolerance ?? Math.max(0.1, Math.abs(m.wrongNumericalTarget) * 0.05);
        return Math.abs(enteredVal - m.wrongNumericalTarget) <= tol;
      });
      if (matchedNumericRule) {
        detectedMisconception = {
          id: matchedNumericRule.id,
          summary: matchedNumericRule.misconceptionSummary,
          whyIncorrect: matchedNumericRule.whyIncorrect,
          coreConceptFix: matchedNumericRule.coreConceptFix,
          highlightElementIds: matchedNumericRule.highlightElementIds,
        };
      } else {
        const fallbackRule = question.misconceptions[0];
        detectedMisconception = {
          id: fallbackRule?.id || `cautious-num-s${question.sceneNumber}`,
          summary:
            fallbackRule?.misconceptionSummary ||
            `This answer (${enteredVal}) may indicate confusion when applying ${question.keyFormula}.`,
          whyIncorrect: fallbackRule?.whyIncorrect || question.explanation,
          coreConceptFix: fallbackRule?.coreConceptFix || question.teachingPoint,
          highlightElementIds: fallbackRule?.highlightElementIds,
        };
      }
    }
  }

  const nextAttemptsCount = prevState.attemptsCount + 1;
  const nextWrongCount = isCorrect ? prevState.wrongAttemptsCount : prevState.wrongAttemptsCount + 1;
  const nextCorrectCount = isCorrect
    ? prevState.correctAttemptsCount + 1
    : prevState.correctAttemptsCount;

  // Repeated error (>= 2 wrong attempts on this scene) triggers Adaptive Visual Reteaching
  const triggeredReteaching = !isCorrect && nextWrongCount >= 2;
  const reteachingUnlocked = prevState.reteachingUnlocked || triggeredReteaching;
  const completedReteaching =
    prevState.reteachingCompleted || (isCorrect && reteachingUnlocked);

  let nextStatus: SceneMasteryStatus;
  let feedbackAction:
    | 'positive_advance_or_challenge'
    | 'targeted_explanation_and_replay'
    | 'open_adaptive_visual_reteaching';

  if (isCorrect) {
    nextStatus = prevState.wrongAttemptsCount === 0 ? 'correct_first_try' : 'correct_after_retry';
    feedbackAction = 'positive_advance_or_challenge';
  } else if (nextWrongCount >= 2) {
    nextStatus = 'needs_reteaching';
    feedbackAction = 'open_adaptive_visual_reteaching';
  } else {
    nextStatus = 'in_progress';
    feedbackAction = 'targeted_explanation_and_replay';
  }

  const attemptRecord: ConceptCheckAttemptRecord = {
    attemptId: `cc-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    studentUid: params.studentUid || 'anonymous-local',
    documentId: params.documentId || 'default-doc',
    documentTitle: params.documentTitle || question.sourceDocumentTitle || 'Study Material',
    topic: question.topic,
    subject: question.subject,
    sceneNumber: question.sceneNumber,
    teachingPoint: question.teachingPoint,
    questionId: question.id,
    questionType: question.questionType,
    provenance: question.provenance,
    selectedOptionIndex: params.selectedOptionIndex,
    selectedOptionText,
    enteredNumericalText: params.enteredNumericalText,
    normalizedNumericalValue,
    correctAnswerDisplay,
    isCorrect,
    skipped: false,
    attemptNumberForScene: nextAttemptsCount,
    detectedMisconception,
    triggeredReteaching,
    completedReteaching,
    citedPages: question.citedPages,
    isSupportedByMaterial: question.isSupportedByMaterial,
    timestamp: params.timestamp || new Date().toISOString(),
  };

  const nextSceneState: SceneConceptMasteryState = {
    sceneNumber: question.sceneNumber,
    status: nextStatus,
    attemptsCount: nextAttemptsCount,
    wrongAttemptsCount: nextWrongCount,
    correctAttemptsCount: nextCorrectCount,
    skippedCount: prevState.skippedCount,
    activeVariant: triggeredReteaching ? 'reteach' : question.difficulty,
    reteachingUnlocked,
    reteachingCompleted: completedReteaching,
    lastAttempt: attemptRecord,
  };

  return {
    validSubmission: true,
    attemptRecord,
    nextSceneState,
    feedbackAction,
  };
}

/**
 * Records that a student skipped a scene's concept check without fabricating a correct attempt
 * or overwriting previously verified mastery.
 */
export function skipSceneConceptCheck(
  prevState: SceneConceptMasteryState | undefined,
  sceneNumber: number
): SceneConceptMasteryState {
  const base: SceneConceptMasteryState = prevState || {
    sceneNumber,
    status: 'unseen',
    attemptsCount: 0,
    wrongAttemptsCount: 0,
    correctAttemptsCount: 0,
    skippedCount: 0,
    activeVariant: 'standard',
    reteachingUnlocked: false,
    reteachingCompleted: false,
    lastAttempt: null,
  };

  // Never downgrade an already-verified correct status or erase ongoing error counts
  const nextStatus: SceneMasteryStatus =
    base.status === 'correct_first_try' ||
    base.status === 'correct_after_retry' ||
    base.status === 'needs_reteaching' ||
    base.status === 'in_progress'
      ? base.status
      : 'skipped';

  return {
    ...base,
    status: nextStatus,
    skippedCount: base.skippedCount + 1,
  };
}

/**
 * Connects Interactive Concept Check attempts with LearnMate's existing Mistake DNA
 * (`MistakeInsight[]`), Revision Plan (`RevisionTask[]`), and `weakAreas` without
 * modifying official JEE Main mock-test (`jee_simulator`) records.
 *
 * Evidence rules:
 * - Skipped or unseen question -> no mastery evidence; no Mistake DNA changes.
 * - 1st wrong answer -> limited evidence (`limited_single_error`); does not permanently mark weak yet.
 * - Repeated wrong answers (>= 2 wrong on the scene/concept) -> confirmed misconception (`repeated_misconception`);
 *   upserts a grounded `MistakeInsight`, a high-priority `RevisionTask`, and adds the topic to `weakAreas`.
 * - Correct answer after reteaching -> (`recovered_after_reteaching`); downgrades high-priority RevisionTask to medium.
 */
export function integrateConceptCheckWithMistakeDna(params: {
  documentId: string;
  attempt: ConceptCheckAttemptRecord;
  sceneState: SceneConceptMasteryState;
  existingMistakes: MistakeInsight[];
  existingRevisionPlan: RevisionTask[];
  existingWeakAreas?: string[];
}): {
  evidenceLevel:
    | 'no_evidence_skipped'
    | 'positive_mastery'
    | 'recovered_after_reteaching'
    | 'limited_single_error'
    | 'repeated_misconception';
  updatedMistakes: MistakeInsight[];
  updatedRevisionPlan: RevisionTask[];
  updatedWeakAreas: string[];
  mistakeDnaUpdated: boolean;
} {
  const { documentId, attempt, sceneState } = params;
  const updatedMistakes = [...params.existingMistakes];
  const updatedRevisionPlan = [...params.existingRevisionPlan];
  const weakAreasSet = new Set(params.existingWeakAreas || []);

  if (attempt.skipped) {
    return {
      evidenceLevel: 'no_evidence_skipped',
      updatedMistakes,
      updatedRevisionPlan,
      updatedWeakAreas: Array.from(weakAreasSet),
      mistakeDnaUpdated: false,
    };
  }

  const mistakeIdKey = `concept-check-${documentId}-s${attempt.sceneNumber}-${attempt.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
  const revisionTaskId = `rev-cc-${documentId}-s${attempt.sceneNumber}`;

  if (attempt.isCorrect) {
    if (sceneState.wrongAttemptsCount >= 2 || attempt.completedReteaching) {
      // Student recovered after repeated errors / visual reteaching
      const revIdx = updatedRevisionPlan.findIndex((t) => t.id === revisionTaskId);
      if (revIdx >= 0) {
        updatedRevisionPlan[revIdx] = {
          ...updatedRevisionPlan[revIdx],
          priority: 'medium',
          reason: `Recovered in Scene ${attempt.sceneNumber} after Adaptive Visual Reteaching (${attempt.teachingPoint}). Do 1 spaced-repetition check tomorrow.`,
          updatedAt: attempt.timestamp,
        };
      }
      return {
        evidenceLevel: 'recovered_after_reteaching',
        updatedMistakes,
        updatedRevisionPlan,
        updatedWeakAreas: Array.from(weakAreasSet),
        mistakeDnaUpdated: revIdx >= 0,
      };
    }

    return {
      evidenceLevel: 'positive_mastery',
      updatedMistakes,
      updatedRevisionPlan,
      updatedWeakAreas: Array.from(weakAreasSet),
      mistakeDnaUpdated: false,
    };
  }

  // Incorrect attempt: check whether it is a single error (limited evidence) vs repeated misconception (>= 2 wrong)
  if (sceneState.wrongAttemptsCount < 2) {
    return {
      evidenceLevel: 'limited_single_error',
      updatedMistakes,
      updatedRevisionPlan,
      updatedWeakAreas: Array.from(weakAreasSet),
      mistakeDnaUpdated: false,
    };
  }

  // Repeated wrong answers (>= 2) -> Record in Mistake DNA, Revision Plan, and Weak Areas
  const verifiedPage =
    attempt.isSupportedByMaterial && attempt.citedPages.length > 0 ? attempt.citedPages[0] : 1;
  const sourceQuote =
    attempt.isSupportedByMaterial && attempt.citedPages.length > 0
      ? `Cited from Page ${attempt.citedPages.join(', ')} of "${attempt.documentTitle}" — ${attempt.teachingPoint}`
      : `Standard JEE Syllabus (Not in uploaded pages) — Scene ${attempt.sceneNumber}: ${attempt.teachingPoint}`;

  const selectedAnswerLabel =
    attempt.selectedOptionText ||
    (attempt.enteredNumericalText ? String(attempt.enteredNumericalText) : 'Incorrect response');

  const newMistake: MistakeInsight = {
    questionId: mistakeIdKey,
    topic: attempt.topic,
    question: `[Scene ${attempt.sceneNumber} Concept Check] ${attempt.teachingPoint}`,
    selectedOption: selectedAnswerLabel,
    correctOption: attempt.correctAnswerDisplay,
    likelyMisconception:
      attempt.detectedMisconception?.summary ||
      `Repeated confusion on Scene ${attempt.sceneNumber} (${attempt.teachingPoint}).`,
    coreConceptFix:
      attempt.detectedMisconception?.coreConceptFix ||
      attempt.detectedMisconception?.whyIncorrect ||
      attempt.teachingPoint,
    sourcePage: verifiedPage,
    sourceQuote,
  };

  const existingMistakeIdx = updatedMistakes.findIndex(
    (m) => m.questionId === mistakeIdKey || (m.topic === attempt.topic && m.question === newMistake.question)
  );
  if (existingMistakeIdx >= 0) {
    updatedMistakes[existingMistakeIdx] = newMistake;
  } else {
    updatedMistakes.unshift(newMistake);
  }

  const newRevisionTask: RevisionTask = {
    id: revisionTaskId,
    documentId,
    topic: attempt.topic,
    priority: 'high',
    reason: `Repeated misconception (${sceneState.wrongAttemptsCount} attempts) in Animated Explanation Scene ${attempt.sceneNumber}: ${
      attempt.detectedMisconception?.summary || attempt.teachingPoint
    }`,
    recommendedAction: `Complete Adaptive Visual Reteaching for Scene ${attempt.sceneNumber}, then solve a targeted Adaptive Practice set on "${attempt.topic}".`,
    conceptSummary: attempt.detectedMisconception?.coreConceptFix || attempt.teachingPoint,
    sourcePage: verifiedPage,
    completed: false,
    updatedAt: attempt.timestamp,
  };

  const existingRevIdx = updatedRevisionPlan.findIndex((t) => t.id === revisionTaskId);
  if (existingRevIdx >= 0) {
    updatedRevisionPlan[existingRevIdx] = newRevisionTask;
  } else {
    updatedRevisionPlan.unshift(newRevisionTask);
  }

  weakAreasSet.add(attempt.topic);

  return {
    evidenceLevel: 'repeated_misconception',
    updatedMistakes,
    updatedRevisionPlan,
    updatedWeakAreas: Array.from(weakAreasSet),
    mistakeDnaUpdated: true,
  };
}

/**
 * Computes the documented, evidence-based LessonMasterySummary and Smart Next-Action Recommendation
 * across all scenes in the animated explanation.
 *
 * Documented Evidence Formula:
 * - Each scene solved on the first try contributes 1.00 scene-mastery unit.
 * - Each scene solved after retry/reteaching contributes 0.75 scene-mastery units.
 * - Unattempted, skipped, or unresolved scenes contribute 0.00 units.
 * - `evidenceScorePct = Math.round(((firstTryCorrect * 1.0 + retryCorrect * 0.75) / totalScenes) * 100)`.
 */
export function computeLessonMasteryAndRecommendation(
  scenes: AnimatedExplanationScene[],
  masteryByScene: Record<number, SceneConceptMasteryState>
): LessonMasterySummary {
  const totalScenes = Math.max(1, scenes.length);
  let attemptedScenes = 0;
  let verifiedScenes = 0;
  let firstTryCorrectScenes = 0;
  let retryCorrectScenes = 0;
  const strugglingScenes: number[] = [];
  const skippedScenes: number[] = [];
  const uncompletedScenes: number[] = [];
  let singleErrorScenes: number[] = [];

  for (const sc of scenes) {
    const st = masteryByScene[sc.sceneNumber];
    if (!st || st.status === 'unseen') {
      uncompletedScenes.push(sc.sceneNumber);
      continue;
    }
    if (st.status === 'skipped' && st.attemptsCount === 0) {
      skippedScenes.push(sc.sceneNumber);
      uncompletedScenes.push(sc.sceneNumber);
      continue;
    }
    if (st.attemptsCount > 0) {
      attemptedScenes++;
    }
    if (st.status === 'correct_first_try') {
      verifiedScenes++;
      firstTryCorrectScenes++;
    } else if (st.status === 'correct_after_retry') {
      verifiedScenes++;
      retryCorrectScenes++;
      if (st.wrongAttemptsCount >= 2) {
        strugglingScenes.push(sc.sceneNumber);
      }
    } else if (st.status === 'needs_reteaching' || st.wrongAttemptsCount >= 2) {
      strugglingScenes.push(sc.sceneNumber);
      uncompletedScenes.push(sc.sceneNumber);
    } else if (st.status === 'in_progress' || st.wrongAttemptsCount === 1) {
      singleErrorScenes.push(sc.sceneNumber);
      uncompletedScenes.push(sc.sceneNumber);
    } else {
      uncompletedScenes.push(sc.sceneNumber);
    }
  }

  const checkpointCompletionPct = Math.min(100, Math.round((verifiedScenes / totalScenes) * 100));
  const weightedUnits = firstTryCorrectScenes * 1.0 + retryCorrectScenes * 0.75;
  const evidenceScorePct =
    attemptedScenes === 0 ? 0 : Math.min(100, Math.round((weightedUnits / totalScenes) * 100));

  // 1. Repeated misunderstanding takes highest priority for adaptive remediation
  const unresolvedStrugglingScene = scenes.find((sc) => {
    const st = masteryByScene[sc.sceneNumber];
    return st && st.wrongAttemptsCount >= 2 && st.correctAttemptsCount === 0;
  });

  if (unresolvedStrugglingScene) {
    return {
      totalScenes,
      attemptedScenes,
      verifiedScenes,
      firstTryCorrectScenes,
      retryCorrectScenes,
      strugglingScenes,
      skippedScenes,
      uncompletedScenes,
      checkpointCompletionPct,
      evidenceScorePct,
      estimatedConceptReadinessLabel: 'Needs Targeted Remediation (Repeated Misconception)',
      overallStatus: 'repeated_misunderstanding',
      headline: `Repeated Misconception Detected in Scene ${unresolvedStrugglingScene.sceneNumber}`,
      rationale: `You had multiple incorrect attempts on Scene ${unresolvedStrugglingScene.sceneNumber} (${unresolvedStrugglingScene.heading}). This concept has been synced to your Mistake DNA & Revision Plan.`,
      recommendedAction: {
        kind: 'open_visual_reteaching',
        label: `Complete Visual Reteaching (Scene ${unresolvedStrugglingScene.sceneNumber})`,
        targetSceneNumber: unresolvedStrugglingScene.sceneNumber,
      },
      secondaryAction: {
        kind: 'adaptive_practice',
        label: 'Practice Weak Topic in Adaptive Practice',
        targetTab: 'practice',
      },
    };
  }

  // 2. Unresolved single error -> Review missed teaching point and retry
  if (singleErrorScenes.length > 0) {
    const targetScene = singleErrorScenes[0];
    return {
      totalScenes,
      attemptedScenes,
      verifiedScenes,
      firstTryCorrectScenes,
      retryCorrectScenes,
      strugglingScenes,
      skippedScenes,
      uncompletedScenes,
      checkpointCompletionPct,
      evidenceScorePct,
      estimatedConceptReadinessLabel: 'Developing (Review & Retry Missed Checkpoint)',
      overallStatus: 'some_errors',
      headline: `Review Teaching Point in Scene ${targetScene} & Retry`,
      rationale: `You missed the first check on Scene ${targetScene}. Replay the 3-step visual breakdown and retry with an equivalent concept question.`,
      recommendedAction: {
        kind: 'review_and_retry_scene',
        label: `Review & Retry Scene ${targetScene} Check`,
        targetSceneNumber: targetScene,
      },
      secondaryAction: {
        kind: 'quick_revise',
        label: 'Open Quick Revise Formula Sheet',
        targetTab: 'revision',
      },
    };
  }

  // 3. All scenes verified!
  if (verifiedScenes >= totalScenes) {
    if (strugglingScenes.length > 0) {
      return {
        totalScenes,
        attemptedScenes,
        verifiedScenes,
        firstTryCorrectScenes,
        retryCorrectScenes,
        strugglingScenes,
        skippedScenes,
        uncompletedScenes,
        checkpointCompletionPct,
        evidenceScorePct,
        estimatedConceptReadinessLabel: 'Recovered After Reteaching (Verify in Timed Practice)',
        overallStatus: 'repeated_misunderstanding',
        headline: `All ${totalScenes} Checkpoints Completed (${evidenceScorePct}% Observed Score — Recovered After Reteaching)`,
        rationale: `You resolved your earlier misconception in Scene ${strugglingScenes.join(', ')}. Reinforce this topic now with a short Adaptive Practice quiz or Quick Revise flashcards.`,
        recommendedAction: {
          kind: 'adaptive_practice',
          label: 'Reinforce Weak Topic in Adaptive Practice',
          targetTab: 'practice',
        },
        secondaryAction: {
          kind: 'quick_revise',
          label: 'Review in Quick Revise',
          targetTab: 'revision',
        },
      };
    }

    if (firstTryCorrectScenes === totalScenes) {
      return {
        totalScenes,
        attemptedScenes,
        verifiedScenes,
        firstTryCorrectScenes,
        retryCorrectScenes,
        strugglingScenes,
        skippedScenes,
        uncompletedScenes,
        checkpointCompletionPct,
        evidenceScorePct,
        estimatedConceptReadinessLabel: 'Strong Checkpoint Evidence (Confirm in JEE Practice)',
        overallStatus: 'strong',
        headline: `Strong Checkpoint Evidence (${verifiedScenes}/${totalScenes} First-Try Verified · ${evidenceScorePct}% Observed Score)`,
        rationale: `You verified every scene's teaching point on the first attempt. Try a harder JEE numerical challenge or test yourself in Practice.`,
        recommendedAction: {
          kind: 'try_challenge',
          label: 'Try Harder Challenge Question',
          targetSceneNumber: scenes[scenes.length - 1].sceneNumber,
        },
        secondaryAction: {
          kind: 'adaptive_practice',
          label: 'Open Chapter Practice Quiz',
          targetTab: 'practice',
        },
      };
    }

    return {
      totalScenes,
      attemptedScenes,
      verifiedScenes,
      firstTryCorrectScenes,
      retryCorrectScenes,
      strugglingScenes,
      skippedScenes,
      uncompletedScenes,
      checkpointCompletionPct,
      evidenceScorePct,
      estimatedConceptReadinessLabel: 'Checkpoints Verified With Retry (Practice Recommended)',
      overallStatus: 'some_errors',
      headline: `Lesson Checkpoints Completed (${verifiedScenes}/${totalScenes} Scenes Verified · ${evidenceScorePct}% Observed Score)`,
      rationale: `You completed all scene checks with ${retryCorrectScenes} retry recovery. Solidify your speed with a practice set.`,
      recommendedAction: {
        kind: 'adaptive_practice',
        label: 'Start Targeted Practice Quiz',
        targetTab: 'practice',
      },
      secondaryAction: {
        kind: 'quick_revise',
        label: 'Open Quick Revise',
        targetTab: 'revision',
      },
    };
  }

  // 4. Incomplete lesson (some or zero scenes verified so far)
  const nextSceneToComplete = uncompletedScenes[0] || 1;
  if (attemptedScenes === 0) {
    return {
      totalScenes,
      attemptedScenes,
      verifiedScenes,
      firstTryCorrectScenes,
      retryCorrectScenes,
      strugglingScenes,
      skippedScenes,
      uncompletedScenes,
      checkpointCompletionPct: 0,
      evidenceScorePct: 0,
      estimatedConceptReadinessLabel: 'No Checkpoint Evidence Yet (0 Attempted)',
      overallStatus: 'unstarted',
      headline: `0 of ${totalScenes} Scene Checks Completed`,
      rationale:
        skippedScenes.length > 0
          ? `You skipped ${skippedScenes.length} scene check(s) (skipped checks record 0% mastery evidence). Click "Check Understanding" on Scene ${nextSceneToComplete} to verify your grasp.`
          : `Click "Check Understanding" after studying Scene ${nextSceneToComplete} to verify the teaching point.`,
      recommendedAction: {
        kind: 'resume_scene',
        label: `Check Understanding on Scene ${nextSceneToComplete}`,
        targetSceneNumber: nextSceneToComplete,
      },
    };
  }

  return {
    totalScenes,
    attemptedScenes,
    verifiedScenes,
    firstTryCorrectScenes,
    retryCorrectScenes,
    strugglingScenes,
    skippedScenes,
    uncompletedScenes,
    checkpointCompletionPct,
    evidenceScorePct,
    estimatedConceptReadinessLabel: `Partial Checkpoint Evidence (${verifiedScenes}/${totalScenes} Verified)`,
    overallStatus: 'incomplete',
    headline: `In Progress: ${verifiedScenes} of ${totalScenes} Scene Checks Verified (${evidenceScorePct}% Observed Score)`,
    rationale: `Continue to Scene ${nextSceneToComplete} and complete its interactive concept check to finish this lesson.`,
    recommendedAction: {
      kind: 'continue_next_scene',
      label: `Continue to Scene ${nextSceneToComplete}`,
      targetSceneNumber: nextSceneToComplete,
    },
    secondaryAction: {
      kind: 'try_challenge',
      label: 'Try Harder Question on Current Scene',
    },
  };
}

/**
 * Deterministically merges local and cloud ConceptCheckAttemptRecord arrays:
 * - Enforces account ownership if `ownerUid` is provided (migrating anonymous 'local-student' records to `ownerUid` and rejecting foreign UIDs).
 * - Deduplicates by `attemptId` (keeping the newer timestamp if both exist) and by composite event signature.
 * - Orders newest-first by `timestamp`.
 */
export function mergeConceptCheckAttempts(
  localAttempts: ConceptCheckAttemptRecord[],
  cloudAttempts: ConceptCheckAttemptRecord[],
  ownerUid?: string
): ConceptCheckAttemptRecord[] {
  const map = new Map<string, ConceptCheckAttemptRecord>();
  const signatureSet = new Set<string>();

  const processList = (items: ConceptCheckAttemptRecord[]) => {
    if (!Array.isArray(items)) return;
    for (const raw of items) {
      if (!raw || typeof raw !== 'object' || !raw.attemptId || !raw.documentId) continue;
      if (
        ownerUid &&
        raw.studentUid &&
        raw.studentUid !== 'local-student' &&
        raw.studentUid !== ownerUid
      ) {
        // Never allow another student's attempt record to merge into this student's state
        continue;
      }
      const normalized: ConceptCheckAttemptRecord = {
        ...raw,
        studentUid: ownerUid || raw.studentUid || 'local-student',
      };
      const sig = `${normalized.documentId}::${normalized.topic}::s${normalized.sceneNumber}::${normalized.questionId}::${normalized.timestamp}`;
      const existing = map.get(normalized.attemptId);
      if (existing) {
        const existingTs = Date.parse(existing.timestamp) || 0;
        const incomingTs = Date.parse(normalized.timestamp) || 0;
        if (incomingTs >= existingTs) {
          map.set(normalized.attemptId, normalized);
        }
      } else if (!signatureSet.has(sig)) {
        signatureSet.add(sig);
        map.set(normalized.attemptId, normalized);
      }
    }
  };

  processList(cloudAttempts);
  processList(localAttempts);

  return Array.from(map.values())
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
    .slice(0, 500);
}

function getMasteryStatusPriority(status: SceneMasteryStatus): number {
  switch (status) {
    case 'correct_first_try':
      return 6;
    case 'correct_after_retry':
      return 5;
    case 'needs_reteaching':
    case 'struggling':
      return 4;
    case 'in_progress':
      return 3;
    case 'skipped':
      return 2;
    case 'unseen':
    default:
      return 1;
  }
}

/**
 * Deterministically merges local and cloud per-scene mastery maps without losing verified progress
 * or misconception evidence.
 */
export function mergeSceneMasteryState(
  localState: Record<number, SceneConceptMasteryState> | null | undefined,
  cloudState: Record<number, SceneConceptMasteryState> | null | undefined
): Record<number, SceneConceptMasteryState> {
  const result: Record<number, SceneConceptMasteryState> = {};
  const keys = new Set<number>([
    ...Object.keys(localState || {}).map(Number),
    ...Object.keys(cloudState || {}).map(Number),
  ]);

  for (const sceneNum of keys) {
    if (!Number.isFinite(sceneNum)) continue;
    const loc = localState?.[sceneNum];
    const cld = cloudState?.[sceneNum];
    if (loc && !cld) {
      result[sceneNum] = { ...loc };
      continue;
    }
    if (cld && !loc) {
      result[sceneNum] = { ...cld };
      continue;
    }
    if (!loc || !cld) continue;

    const locTs = loc.lastAttempt?.timestamp ? Date.parse(loc.lastAttempt.timestamp) || 0 : 0;
    const cldTs = cld.lastAttempt?.timestamp ? Date.parse(cld.lastAttempt.timestamp) || 0 : 0;
    const newer = locTs >= cldTs ? loc : cld;

    const wrongAttemptsCount = Math.max(loc.wrongAttemptsCount || 0, cld.wrongAttemptsCount || 0);
    const correctAttemptsCount = Math.max(
      loc.correctAttemptsCount || 0,
      cld.correctAttemptsCount || 0
    );
    const attemptsCount = Math.max(
      loc.attemptsCount || 0,
      cld.attemptsCount || 0,
      wrongAttemptsCount + correctAttemptsCount
    );
    const skippedCount = Math.max(loc.skippedCount || 0, cld.skippedCount || 0);
    const reteachingUnlocked = Boolean(loc.reteachingUnlocked || cld.reteachingUnlocked);
    const reteachingCompleted = Boolean(loc.reteachingCompleted || cld.reteachingCompleted);

    let mergedStatus: SceneMasteryStatus =
      getMasteryStatusPriority(loc.status) >= getMasteryStatusPriority(cld.status)
        ? loc.status
        : cld.status;

    if (correctAttemptsCount > 0) {
      mergedStatus = wrongAttemptsCount === 0 ? 'correct_first_try' : 'correct_after_retry';
    } else if (wrongAttemptsCount >= 2) {
      mergedStatus = 'needs_reteaching';
    } else if (wrongAttemptsCount === 1) {
      mergedStatus = 'in_progress';
    }

    result[sceneNum] = {
      sceneNumber: sceneNum,
      status: mergedStatus,
      attemptsCount,
      wrongAttemptsCount,
      correctAttemptsCount,
      skippedCount,
      activeVariant: newer.activeVariant || 'standard',
      reteachingUnlocked,
      reteachingCompleted,
      lastAttempt: newer.lastAttempt || loc.lastAttempt || cld.lastAttempt || null,
    };
  }

  return result;
}

/**
 * Merges a document's topic-keyed mastery map (`Record<topicSlug, Record<sceneNumber, SceneConceptMasteryState>>`)
 * between local and cloud snapshots.
 */
export function mergeTopicMasteryMaps(
  localMap: Record<string, Record<number, SceneConceptMasteryState>> | null | undefined,
  cloudMap: Record<string, Record<number, SceneConceptMasteryState>> | null | undefined
): Record<string, Record<number, SceneConceptMasteryState>> {
  const out: Record<string, Record<number, SceneConceptMasteryState>> = {};
  const topics = new Set<string>([
    ...Object.keys(localMap || {}),
    ...Object.keys(cloudMap || {}),
  ]);
  for (const slug of topics) {
    if (!slug) continue;
    out[slug] = mergeSceneMasteryState(localMap?.[slug], cloudMap?.[slug]);
  }
  return out;
}



