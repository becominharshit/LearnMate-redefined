/**
 * Pure, deterministic Educational Specifications Engine for LearnMate 2.0 Creative Studio:
 * - PlayLab 2D Educational Games (EducationalGameSpec)
 * - Concept 3D Lab & 2D Mathematical/Physics Simulators (EducationalSceneSpec)
 * - No-Code Student Mini App Builder & Safe Formula Evaluator (MiniAppSpec)
 * - Deterministic Animated Explanation Specs for Video Lessons (AnimatedExplanationSpec)
 */

import type { DiagramElement, StructuredDiagramSpec } from '../types/diagram';
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

      return rawScenes.map(({ stepLabels, ...scene }) => ({
        ...scene,
        progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
      }));
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

    return rawPhysicsScenes.map(({ stepLabels, ...scene }) => ({
      ...scene,
      progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
    }));
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

    return rawChemistryScenes.map(({ stepLabels, ...scene }) => ({
      ...scene,
      progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
    }));
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

    return rawConicScenes.map(({ stepLabels, ...scene }) => ({
      ...scene,
      progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
    }));
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

  return rawMathScenes.map(({ stepLabels, ...scene }) => ({
    ...scene,
    progressiveSteps: buildProgressiveStepsForDiagram(scene.spec, stepLabels),
  }));
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

    sanitizedScenes.push({
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
    });
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

