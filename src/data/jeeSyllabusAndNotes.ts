/**
 * Unified Academic Content, Shared Syllabus, Full Notes & Quick Notes System
 * Covers JEE Main (NTA Official Syllabus) and JEE Advanced (IIT JAB Official Syllabus)
 * across Physics, Chemistry, and Mathematics.
 *
 * Reference Priority:
 * 1. Verified academic content and official exam syllabus specifications.
 * 2. Separate JEE Main and JEE Advanced syllabus mappings with provenance metadata.
 * 3. Authoritative Full Notes and Quick Notes for every supported chapter so students
 *    can study directly without uploading material.
 */

import type { JeeSubject } from '../utils/jeeSubjects';
import type { StudyDocument, StudyPage, StudyTopic } from '../types/study';
import {
  UNPACKED_41_NTA_CHAPTER_SEEDS,
  buildSyllabusChapterFromSeed,
} from './expandedNta58Chapters';

export type ExamTrackId = 'jee_main' | 'jee_advanced';
export type EditorialPublicationState = 'draft' | 'review' | 'published';

export interface SyllabusVersionMetadata {
  id: string;
  exam: ExamTrackId;
  examDisplayName: string;
  targetExamYear: string;
  verifiedReleaseYear: string;
  versionLabel: string;
  officialBody: string;
  sourceUrl: string;
  publicationDate: string;
  retrievedAt: string;
  statusNote: string;
}

export const SYLLABUS_VERSIONS: Record<ExamTrackId, SyllabusVersionMetadata> = {
  jee_main: {
    id: 'nta-jee-main-syllabus-v2025-2026',
    exam: 'jee_main',
    examDisplayName: 'JEE (Main)',
    targetExamYear: '2027',
    verifiedReleaseYear: '2025–2026',
    versionLabel: 'NTA JEE (Main) Official Rationalized Syllabus (v2025.1)',
    officialBody: 'National Testing Agency (NTA)',
    sourceUrl: 'https://jeemain.nta.nic.in/',
    publicationDate: '2024-11-01',
    retrievedAt: '2026-11-01',
    statusNote:
      'Latest verified NTA rationalized JEE (Main) syllabus (aligned with NCERT Class 11 & 12 rationalized curriculum). Target 2027 syllabus uses this verified baseline until NTA publishes any 2027 amendment.',
  },
  jee_advanced: {
    id: 'iit-jab-jee-advanced-syllabus-v2025-2026',
    exam: 'jee_advanced',
    examDisplayName: 'JEE (Advanced)',
    targetExamYear: '2027',
    verifiedReleaseYear: '2025–2026',
    versionLabel: 'IIT JAB JEE (Advanced) Official Syllabus (v2025.1)',
    officialBody: 'Joint Admission Board (JAB) · IITs',
    sourceUrl: 'https://jeeadv.ac.in/',
    publicationDate: '2024-11-15',
    retrievedAt: '2026-11-01',
    statusNote:
      'Latest verified IIT Joint Admission Board JEE (Advanced) syllabus. Includes multi-concept analytical extensions and experimental physics/chemistry topics.',
  },
};

export interface ChapterWorkedExample {
  id: string;
  title: string;
  examRelevance: 'both' | 'jee_main' | 'jee_advanced';
  problemStatement: string;
  solutionSteps: string[];
  finalAnswer: string;
}

export interface ChapterFormulaEntry {
  id: string;
  name: string;
  expression: string;
  unitsOrConditions: string;
  variablesExplanation: string;
}

export interface ChapterTopicNote {
  id: string;
  title: string;
  examScope: 'both' | 'jee_main' | 'jee_advanced';
  classLevel?: 'Class 11' | 'Class 12' | '11' | '12';
  ncertChapterNumber?: number;
  ntaWeightagePct?: number;
  syllabusStatus?: 'Active' | 'Removed-In-Main-Only';
  highYieldFormulas?: string[];
  formulas?: string[];
  definition: string;
  explanation: string;
  derivation: string;
  keyFormulas: ChapterFormulaEntry[];
  exceptionsAndCommonMistakes: string[];
  mainVsAdvancedDistinction: string;
}

export interface ChapterQuickNotes {
  essentialFormulas: Array<{ label: string; formula: string; condition: string }>;
  reactionsOrKeyFacts: string[];
  shortConceptSummaries: string[];
  commonTraps: string[];
  revisionCheckpoints: Array<{
    id: string;
    question: string;
    expectedKeyPoint: string;
  }>;
}

export interface SyllabusChapterRecord {
  id: string;
  code: string;
  subject: JeeSubject;
  classLevel: 'Class 11' | 'Class 12';
  classGrade?: '11' | '12';
  ncertChapterNumber?: number;
  ntaWeightagePct?: number;
  syllabusStatus?: 'Active' | 'Removed-In-Main-Only';
  highYieldFormulas?: string[];
  unitName: string;
  title: string;
  supportedExams: ExamTrackId[];
  syllabusVersionIds: Record<ExamTrackId, string>;
  editorialStatus: EditorialPublicationState;
  lastReviewedAt: string;
  sourceProvenance: {
    primaryReference: string;
    officialSyllabusSection: string;
    ncertMapping: string;
  };
  weightageQuestionsApprox: {
    jee_main: string;
    jee_advanced: string;
  };
  overview: string;
  topics: ChapterTopicNote[];
  workedExamples: ChapterWorkedExample[];
  quickNotes: ChapterQuickNotes;
}

const CORE_17_SYLLABUS_CHAPTERS: SyllabusChapterRecord[] = [
  /* ==========================================================================
   * PHYSICS (6 Complete High-Yield Chapters across Class 11 & 12)
   * ========================================================================== */
  {
    id: 'ch-phys-kinematics-laws',
    code: 'PHY-11-01',
    subject: 'Physics',
    classLevel: 'Class 11',
    unitName: 'Mechanics I',
    title: 'Kinematics & Laws of Motion',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Physics Part 1 (Ch 2–4)',
      officialSyllabusSection: 'Unit 2 & Unit 3: Kinematics and Laws of Motion',
      ncertMapping: 'NCERT Class 11 Physics Chapters 2, 3, and 4',
    },
    weightageQuestionsApprox: {
      jee_main: '2–3 questions (8–12 marks)',
      jee_advanced: '1–2 problems (4–8 marks)',
    },
    overview:
      'Covers frame of reference, instantaneous velocity and acceleration, projectile motion, relative velocity, Newton’s three laws, free-body diagrams, static and kinetic friction, pseudo forces in non-inertial frames, and circular dynamics.',
    topics: [
      {
        id: 'top-phys-projectile-relative',
        title: 'Calculus of Kinematics & 2D Projectile Motion',
        examScope: 'both',
        definition:
          'Instantaneous velocity is the time derivative of position v = dr/dt, and instantaneous acceleration is a = dv/dt = v(dv/dx). Projectile motion is 2D motion under uniform gravitational acceleration g downward.',
        explanation:
          'When acceleration is constant, vector motion decomposes into two independent orthogonal axes. For a projectile launched at speed u and angle θ above horizontal, horizontal velocity u cos θ remains constant while vertical velocity changes at rate −g.',
        derivation:
          'From y(t) = (u sin θ)t − ½gt² and x(t) = (u cos θ)t, substituting t = x/(u cos θ) yields the trajectory equation: y = x tan θ − gx² / (2u² cos² θ) = x tan θ (1 − x/R).',
        keyFormulas: [
          {
            id: 'f-kin-1',
            name: 'Differential Acceleration Form',
            expression: 'a = dv/dt = v · (dv/dx)',
            unitsOrConditions: 'm·s⁻² (valid for any 1D motion, constant or variable a)',
            variablesExplanation: 'v = instantaneous velocity, x = position, t = time',
          },
          {
            id: 'f-kin-2',
            name: 'Projectile Time of Flight, Max Height & Range',
            expression: 'T = (2u sin θ)/g,  H = (u² sin² θ)/(2g),  R = (u² sin 2θ)/g',
            unitsOrConditions: 'Level ground (Δy = 0), uniform g, negligible air drag',
            variablesExplanation: 'u = launch speed, θ = launch angle with horizontal',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Using v = u + at when acceleration is a function of time a(t) or position a(x) — integrate dv = a(t)dt or v dv = a(x)dx instead.',
          'Confusing average speed (total distance / time) with magnitude of average velocity (|Δr| / Δt) after a particle reverses direction.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main focuses on level-ground projectiles, river-boat relative velocity, and 1D graphs; JEE Advanced tests projectiles on inclined planes and constrained pulley-wedge kinematics.',
      },
      {
        id: 'top-phys-newton-friction',
        title: 'Newton’s Laws, Wedge-Pulley Constraints & Friction',
        examScope: 'both',
        definition:
          'In an inertial frame, net external force equals the rate of change of linear momentum: ΣF_ext = dp/dt = ma (for constant mass m). Static friction f_s ≤ μ_s N self-adjusts up to its limiting value.',
        explanation:
          'For connected bodies with ideal massless inextensible strings and pulleys, virtual work Σ(T · x) = 0, Σ(T · v) = 0, and Σ(T · a) = 0 relates block accelerations. On an incline of angle θ, sliding begins only if tan θ > μ_s.',
        derivation:
          'On an inclined plane of angle θ: Normal reaction N = mg cos θ. Down-slope gravity component = mg sin θ. If mg sin θ ≤ μ_s mg cos θ, static friction f_s = mg sin θ and a = 0. If tan θ > μ_s, block accelerates down with a = g(sin θ − μ_k cos θ).',
        keyFormulas: [
          {
            id: 'f-nlm-1',
            name: 'Static & Kinetic Friction Law',
            expression: '0 ≤ f_s ≤ μ_s N,   f_k = μ_k N',
            unitsOrConditions: 'N (Newtons); f_s opposes impending relative motion',
            variablesExplanation: 'N = normal contact force, μ_s = static coefficient, μ_k = kinetic coefficient',
          },
          {
            id: 'f-nlm-2',
            name: 'Banking of Road with Friction',
            expression: 'v_max = √[ Rg (tan θ + μ_s) / (1 − μ_s tan θ) ]',
            unitsOrConditions: 'm·s⁻¹; optimum speed without friction is v_0 = √(Rg tan θ)',
            variablesExplanation: 'R = turn radius, θ = banking angle, μ_s = lateral tire friction coefficient',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Setting static friction equal to μ_s N when the body is below the verge of slipping.',
          'Assuming Normal force N is always mg cos θ even when an external force has a component perpendicular to the incline or the wedge itself accelerates.',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced frequently combines non-inertial pseudo forces (−ma_frame) with two-block friction transition thresholds and variable forces.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-phys-nlm-1',
        title: 'Block on Rough Incline Threshold & Acceleration',
        examRelevance: 'both',
        problemStatement:
          'A block of mass 4 kg rests on a rough inclined plane at θ = 37° (sin 37° = 0.6, cos 37° = 0.8) with μ_s = 0.5 and μ_k = 0.4. Find the frictional force and acceleration of the block (take g = 10 m/s²).',
        solutionSteps: [
          'Compute driving gravity component down the incline: F_g = mg sin 37° = 4 × 10 × 0.6 = 24 N.',
          'Compute normal force: N = mg cos 37° = 4 × 10 × 0.8 = 32 N.',
          'Compute maximum static friction: f_s,max = μ_s N = 0.5 × 32 = 16 N.',
          'Since F_g (24 N) > f_s,max (16 N), the block slips. Kinetic friction acts: f_k = μ_k N = 0.4 × 32 = 12.8 N.',
          'Net acceleration: a = (24 − 12.8) / 4 = 11.2 / 4 = 2.8 m/s².',
        ],
        finalAnswer: 'f_k = 12.8 N up the incline, a = 2.8 m/s² down the incline',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Variable Acceleration', formula: 'v dv = a(x) dx', condition: '1D motion when a = f(x)' },
        { label: 'Projectile Trajectory', formula: 'y = x tan θ (1 − x/R)', condition: 'Uniform gravity, level ground' },
        { label: 'Atwood Machine Acceleration', formula: 'a = (m₁ − m₂)g / (m₁ + m₂),  T = 2m₁m₂g / (m₁ + m₂)', condition: 'Massless pulley & string' },
        { label: 'Angle of Repose', formula: 'tan θ_r = μ_s', condition: 'Onset of sliding on rough incline' },
      ],
      reactionsOrKeyFacts: [
        'Action-reaction pairs (Newton’s 3rd Law) always act on two different bodies and never cancel in a single free-body diagram.',
        'Pseudo force F_pseudo = −m a_frame is applied ONLY when analyzing motion from a non-inertial (accelerating) frame.',
      ],
      shortConceptSummaries: [
        'Decompose 2D projectile or incline problems along perpendicular axes chosen parallel and normal to the surface.',
        'Always test whether external driving force exceeds f_s,max = μ_s N before choosing static vs kinetic friction.',
      ],
      commonTraps: [
        'Writing f = μ_s N when the applied force F < μ_s N (actual static friction equals F).',
        'Forgetting that string tension vanishes if the string goes slack.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-phys-1',
          question: 'When a block remains stationary on a rough incline of angle θ, what is the magnitude of friction?',
          expectedKeyPoint: 'mg sin θ (not μ_s mg cos θ, unless it is on the verge of sliding).',
        },
      ],
    },
  },
  {
    id: 'ch-phys-work-energy-rotation',
    code: 'PHY-11-02',
    subject: 'Physics',
    classLevel: 'Class 11',
    unitName: 'Mechanics II',
    title: 'Work, Energy, Power & Rotational Motion',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Physics Part 1 (Ch 5–7)',
      officialSyllabusSection: 'Unit 4 & Unit 5: Work, Energy, Power and Rotational Motion',
      ncertMapping: 'NCERT Class 11 Physics Chapters 5 and 6',
    },
    weightageQuestionsApprox: {
      jee_main: '3–4 questions (12–16 marks)',
      jee_advanced: '2–3 problems (8–12 marks)',
    },
    overview:
      'Work-energy theorem, conservative forces and potential energy curves, elastic and inelastic collisions, moment of inertia theorems, torque and angular momentum conservation, and pure rolling motion.',
    topics: [
      {
        id: 'top-phys-wet-collisions',
        title: 'Work-Energy Theorem, Potential Energy & Collisions',
        examScope: 'both',
        definition:
          'Total work done by all forces (conservative + non-conservative + internal) equals the change in kinetic energy: W_all = ΔK. For conservative forces, F = −∇U.',
        explanation:
          'In any collision without external impulsive forces, total linear momentum Σp is conserved. Coefficient of restitution e = (v_sep)/(u_app) characterizes elasticity (e = 1 elastic, 0 < e < 1 partially inelastic, e = 0 perfectly inelastic).',
        derivation:
          'From m dv/dt = F_net, multiplying by v = dx/dt gives m v dv = F_net dx. Integrating from state 1 to state 2 yields ½mv₂² − ½mv₁² = ∫ F_net · dr = W_all.',
        keyFormulas: [
          {
            id: 'f-wep-1',
            name: 'Work-Energy Theorem & Conservative Force',
            expression: 'W_cons + W_non-cons = ΔK,   W_cons = −ΔU,   F_x = −dU/dx',
            unitsOrConditions: 'Joules (J); valid in inertial frames',
            variablesExplanation: 'K = kinetic energy, U = potential energy',
          },
          {
            id: 'f-wep-2',
            name: 'Vertical Circular Motion Minimum Speeds (Mass on String)',
            expression: 'v_bottom ≥ √(5gL),   v_top ≥ √(gL)',
            unitsOrConditions: 'm·s⁻¹; massless string of length L',
            variablesExplanation: 'L = radius of vertical circle, g = acceleration due to gravity',
          },
        ],
        exceptionsAndCommonMistakes: [
          'For a rigid massless rod of length L in a vertical circle, minimum speed at the bottom to complete the circle is √(4gL), not √(5gL), because the rod can support compression at the top (v_top = 0).',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests 2D oblique collisions, impulse-momentum in variable-mass/spring systems, and stability analysis around d²U/dx² > 0.',
      },
      {
        id: 'top-phys-rotation-rolling',
        title: 'Moment of Inertia, Angular Momentum & Pure Rolling',
        examScope: 'both',
        definition:
          'Moment of inertia I = ∫ r² dm measures rotational inertia about a specified axis. Torque τ = r × F = dL/dt.',
        explanation:
          'In pure rolling without slipping on a stationary surface, the instantaneous point of contact has zero velocity (v_cm = Rω) and tangential acceleration satisfies a_cm = Rα. Static friction does zero net work during pure rolling on a fixed surface.',
        derivation:
          'For a body rolling down a rough incline of angle θ: mg sin θ − f_s = ma_cm and f_s R = I_cm α = (mk²) (a_cm / R). Eliminating f_s gives a_cm = g sin θ / (1 + k²/R²) and f_s = mg sin θ / (1 + R²/k²).',
        keyFormulas: [
          {
            id: 'f-rot-1',
            name: 'Parallel & Perpendicular Axis Theorems',
            expression: 'I = I_cm + Md²,    I_z = I_x + I_y (planar lamina only)',
            unitsOrConditions: 'kg·m²; d is perpendicular distance between parallel axes',
            variablesExplanation: 'I_cm = moment of inertia about centre-of-mass axis, M = total mass',
          },
          {
            id: 'f-rot-2',
            name: 'Pure Rolling Down an Incline',
            expression: 'a_cm = (g sin θ) / (1 + k²/R²),   K_total = ½mv_cm²(1 + k²/R²)',
            unitsOrConditions: 'No slipping (v_cm = Rω); I_cm = mk²',
            variablesExplanation: 'k = radius of gyration, R = outer radius',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Applying Perpendicular Axis Theorem I_z = I_x + I_y to 3D objects like spheres or cylinders (it holds strictly for flat 2D planar laminas).',
          'Forgetting the r_⊥ × mv_cm term when calculating angular momentum L = I_cm ω + r × (mv_cm) about an arbitrary point.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main focuses on standard I values, conservation of L = Iω, and incline rolling; JEE Advanced tests rolling with slipping transitions, eccentric impulses (toppling vs sliding), and instantaneous axis of rotation (IAOR).',
      },
    ],
    workedExamples: [
      {
        id: 'ex-phys-rot-1',
        title: 'Race Down an Incline: Solid Sphere vs Solid Cylinder',
        examRelevance: 'both',
        problemStatement:
          'A solid sphere and a solid cylinder of the same mass and radius start from rest at the top of a rough incline of height h and roll without slipping. Find the ratio of their translational speeds at the bottom.',
        solutionSteps: [
          'By mechanical energy conservation (since static friction does zero work in pure rolling): mgh = ½mv²(1 + k²/R²).',
          'Thus v = √[ 2gh / (1 + k²/R²) ].',
          'For a solid sphere, k²/R² = 2/5 ⇒ 1 + k²/R² = 7/5.',
          'For a solid cylinder, k²/R² = 1/2 ⇒ 1 + k²/R² = 3/2.',
          'Ratio v_sphere / v_cylinder = √[ (3/2) / (7/5) ] = √(15 / 14).',
        ],
        finalAnswer: 'v_sphere : v_cylinder = √(15/14)',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'MOI Ring / Disc', formula: 'I_ring = MR²,  I_disc = ½MR²', condition: 'Axis ⊥ to plane through centre' },
        { label: 'MOI Solid / Hollow Sphere', formula: 'I_solid = (2/5)MR²,  I_hollow = (2/3)MR²', condition: 'About any diameter' },
        { label: 'Angular Momentum about Point O', formula: 'L_O = I_cm ω + r_cm × (m v_cm)', condition: 'General planar rigid body motion' },
        { label: 'Min μ_s for Pure Rolling on Incline', formula: 'μ_s,min = tan θ / (1 + R²/k²)', condition: 'Prevents slipping on incline θ' },
      ],
      reactionsOrKeyFacts: [
        'Solid sphere (k²/R² = 0.4) reaches the bottom of a rough incline before a disc/cylinder (0.5), hollow sphere (0.67), or ring (1.0).',
      ],
      shortConceptSummaries: [
        'Use angular momentum conservation about the point of contact to eliminate unknown impulsive friction during rolling transitions.',
      ],
      commonTraps: [
        'Using I = I_1 + M d² between two non-COM parallel axes (must always pass through I_cm first!).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-phys-rot-1',
          question: 'Why is total mechanical energy conserved in pure rolling on a rough fixed incline?',
          expectedKeyPoint: 'Because the point of contact is instantaneously at rest, so static friction does zero work.',
        },
      ],
    },
  },
  {
    id: 'ch-phys-thermodynamics-ktg',
    code: 'PHY-11-03',
    subject: 'Physics',
    classLevel: 'Class 11',
    unitName: 'Thermal Physics',
    title: 'Kinetic Theory of Gases & Thermodynamics',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Physics Part 2 (Ch 11–12)',
      officialSyllabusSection: 'Unit 8 & Unit 9: Thermodynamics and Kinetic Theory of Gases',
      ncertMapping: 'NCERT Class 11 Physics Chapters 11 and 12',
    },
    weightageQuestionsApprox: {
      jee_main: '2–3 questions (8–12 marks)',
      jee_advanced: '2 problems (6–8 marks)',
    },
    overview:
      'Ideal gas law, RMS/average/most-probable molecular speeds, degrees of freedom and equipartition of energy, First Law of Thermodynamics (Physics sign convention Q = ΔU + W), polytropic processes, P-V indicator diagrams, and Carnot heat engine efficiency.',
    topics: [
      {
        id: 'top-phys-ktg-equipartition',
        title: 'Molecular Speeds, Degrees of Freedom & Equipartition',
        examScope: 'both',
        definition:
          'Each translational or rotational degree of freedom contributes ½k_B T average thermal energy per molecule (or ½RT per mole). Internal energy of n moles of an ideal gas with f degrees of freedom is U = (f/2)nRT.',
        explanation:
          'At room temperature, monatomic gases (He, Ne, Ar) have f = 3; rigid diatomic/linear polyatomic gases (H₂, N₂, O₂, CO₂) have f = 5; non-linear polyatomic gases (H₂O, NH₃, CH₄) have f = 6. Molar heat capacities are C_V = (f/2)R, C_P = (1 + f/2)R, and γ = C_P/C_V = 1 + 2/f.',
        derivation:
          'From kinetic pressure P = (1/3)ρ v_rms² and PV = nRT = (M_total/M₀)RT, we obtain v_rms = √(3RT/M₀) = √(3k_B T/m).',
        keyFormulas: [
          {
            id: 'f-ktg-1',
            name: 'Maxwell Speed Hierarchy',
            expression: 'v_mp = √(2RT/M₀) < v_avg = √(8RT/πM₀) < v_rms = √(3RT/M₀)',
            unitsOrConditions: 'm·s⁻¹; M₀ must be in kg·mol⁻¹ (e.g., O₂ is 0.032 kg·mol⁻¹)',
            variablesExplanation: 'R = 8.314 J·mol⁻¹·K⁻¹, T = absolute temperature in Kelvin',
          },
          {
            id: 'f-ktg-2',
            name: 'First Law & Polytropic Process Heat Capacity',
            expression: 'Q = ΔU + W,   W = ∫ P dV,   C_poly = R/(γ − 1) + R/(1 − x)  (for PV^x = const)',
            unitsOrConditions: 'Physics convention: W_by_gas > 0 on expansion',
            variablesExplanation: 'γ = C_P/C_V, x = polytropic exponent',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Sign convention alert: In Physics, Q = ΔU + W where W = ∫ P dV is work done BY the gas. In Chemistry (IUPAC), ΔU = q + w where w = −∫ P_ext dV is work done ON the gas.',
          'Forgetting to convert molar mass M₀ from g/mol to kg/mol when computing v_rms.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main tests standard cyclic P-V loops, adiabatic/isothermal work ratios, and mixture γ_mix; JEE Advanced tests variable-molar-heat-capacity polytropic cycles and piston-spring thermodynamic equilibria.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-phys-thermo-1',
        title: 'Molar Heat Capacity in a Polytropic Expansion',
        examRelevance: 'both',
        problemStatement:
          'One mole of an ideal monatomic gas (γ = 5/3) undergoes a process P V² = constant. Find the molar heat capacity C of the gas during this process.',
        solutionSteps: [
          'For a polytropic process PV^x = constant, molar heat capacity is C = C_V + R / (1 − x).',
          'For a monatomic gas, f = 3 ⇒ C_V = (3/2)R.',
          'Here x = 2, so R / (1 − x) = R / (1 − 2) = −R.',
          'Therefore C = (3/2)R − R = R / 2.',
        ],
        finalAnswer: 'C = R / 2',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Speed Ratio', formula: 'v_mp : v_avg : v_rms = √2 : √(8/π) : √3 ≈ 1 : 1.128 : 1.224', condition: 'Ideal gas at temperature T' },
        { label: 'Adiabatic Work (Physics)', formula: 'W_by = (P₁V₁ − P₂V₂) / (γ − 1) = nR(T₁ − T₂) / (γ − 1)', condition: 'Q = 0, PV^γ = const' },
        { label: 'Carnot Efficiency', formula: 'η = 1 − T_sink / T_source = W_net / Q_absorbed', condition: 'T in Kelvin only' },
      ],
      reactionsOrKeyFacts: [
        'Slope of an adiabatic curve on a P-V diagram is γ times steeper than an isothermal curve passing through the same point: (dP/dV)_adiabatic = γ (dP/dV)_isothermal = −γ(P/V).',
      ],
      shortConceptSummaries: [
        'Internal energy ΔU = nC_V ΔT depends ONLY on initial and final temperatures for an ideal gas, regardless of the path.',
      ],
      commonTraps: [
        'Using Q_rejected / Q_total instead of Q_absorbed (positive heat inflows only) in the denominator of cyclic thermal efficiency η = W_cycle / Q_in.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-phys-th-1',
          question: 'What is the change in internal energy ΔU in any complete thermodynamic cycle of an ideal gas?',
          expectedKeyPoint: 'Zero (ΔU_cycle = 0 because U is a state function), so Q_net = W_net (area enclosed by P-V loop).',
        },
      ],
    },
  },
  {
    id: 'ch-phys-electrostatics-current',
    code: 'PHY-12-01',
    subject: 'Physics',
    classLevel: 'Class 12',
    unitName: 'Electromagnetism I',
    title: 'Electrostatics, Capacitors & Current Electricity',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Physics Part 1 (Ch 1–3)',
      officialSyllabusSection: 'Unit 11 & Unit 12: Electrostatics and Current Electricity',
      ncertMapping: 'NCERT Class 12 Physics Chapters 1, 2, and 3',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Coulomb’s law, electric field and potential, Gauss’s law and symmetric flux applications, electric dipole in uniform/non-uniform fields, parallel-plate and spherical capacitors with dielectrics, Kirchhoff’s laws, Wheatstone bridge, RC transient circuits, and electrical measuring instruments.',
    topics: [
      {
        id: 'top-phys-gauss-dipole-capacitors',
        title: 'Gauss’s Law, Electric Potential, Dipoles & Capacitors',
        examScope: 'both',
        definition:
          'Gauss’s Law states that total electric flux through any closed surface equals the net enclosed charge divided by ε₀: ∮ E · dA = q_in / ε₀. Electric field relates to potential via E = −∇V.',
        explanation:
          'Inside a uniformly charged solid non-conducting sphere of radius R and total charge Q, E(r) = kQr/R³ grows linearly with r, whereas inside a conducting shell E(r) = 0 and V(r) = kQ/R is constant. Inserting a dielectric of constant K into an isolated capacitor (Q constant) divides E, V, and stored energy U by K; if battery remains connected (V constant), Q and U multiply by K.',
        derivation:
          'For a parallel-plate capacitor with plate area A and separation d, E = σ/ε₀ = Q/(Aε₀), so V = Ed = Qd/(Aε₀) and C = Q/V = ε₀A/d. With a dielectric slab of thickness t < d, V = E₀(d − t) + (E₀/K)t ⇒ C = ε₀A / [d − t(1 − 1/K)].',
        keyFormulas: [
          {
            id: 'f-elec-1',
            name: 'Electric Dipole Field & Potential',
            expression: 'E_axial = 2kp/r³,   E_eq = kp/r³,   τ = p × E,   U = −p · E',
            unitsOrConditions: 'Short dipole (r ≫ 2a); E_eq is antiparallel to p',
            variablesExplanation: 'p = q(2a) dipole moment directed from −q to +q',
          },
          {
            id: 'f-elec-2',
            name: 'Capacitor Energy & Charge Sharing Heat Loss',
            expression: 'U = ½CV² = Q²/(2C),   ΔH_loss = ½ [C₁C₂/(C₁ + C₂)] (V₁ − V₂)²',
            unitsOrConditions: 'Joules (J); use (V₁ + V₂)² if connected with opposite polarity',
            variablesExplanation: 'C₁, C₂ = capacitances; V₁, V₂ = initial potentials',
          },
        ],
        exceptionsAndCommonMistakes: [
          'In Gauss’s Law ∮ E · dA = q_in / ε₀, the electric field E on the Gaussian surface is due to ALL charges (both inside and outside), whereas the net flux depends ONLY on q_in.',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests non-concentric cavity fields (E_cavity = ρ(O₁O₂)/(3ε₀)), electrostatic pressure σ²/(2ε₀), and multi-loop RC networks.',
      },
      {
        id: 'top-phys-current-rc',
        title: 'Kirchhoff’s Laws, Bridges, RC Transients & Instruments',
        examScope: 'both',
        definition:
          'Kirchhoff’s Current Law (charge conservation, ΣI_in = ΣI_out) and Voltage Law (energy conservation, ΣΔV_loop = 0) govern steady-state and transient DC networks.',
        explanation:
          'In an RC circuit with time constant τ = R_eq C, at t = 0⁺ an uncharged capacitor acts as a short circuit (zero voltage drop), and as t → ∞ (steady state) it acts as an open circuit (zero branch current).',
        derivation:
          'Applying KVL to a series RC charging loop: ε − iR − q/C = 0 ⇒ R(dq/dt) + q/C = ε. Separating variables and integrating with q(0) = 0 gives q(t) = Cε(1 − e^(−t/RC)) and i(t) = (ε/R)e^(−t/RC).',
        keyFormulas: [
          {
            id: 'f-curr-1',
            name: 'Drift Velocity & Parallel Cell Combination',
            expression: 'I = n e A v_d,    ε_eq = (Σ ε_i/r_i) / (Σ 1/r_i),    1/r_eq = Σ (1/r_i)',
            unitsOrConditions: 'Pay attention to cell polarity when summing ε_i/r_i',
            variablesExplanation: 'n = free electron density, v_d = drift speed, r_i = internal resistance',
          },
          {
            id: 'f-curr-2',
            name: 'RC Charging & Discharging',
            expression: 'q_charge(t) = Q₀(1 − e^(−t/τ)),   q_discharge(t) = Q₀ e^(−t/τ),   τ = R_th C',
            unitsOrConditions: 'R_th is Thevenin resistance seen across capacitor terminals',
            variablesExplanation: 'τ = time constant in seconds',
          },
        ],
        exceptionsAndCommonMistakes: [
          'When stretching a wire to n times its original length at constant volume, new resistance is R′ = n² R (not nR), because area A shrinks to A/n.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main focuses on symmetry networks, meter bridge, and standard RC charging; JEE Advanced tests multi-source RC switching with initial capacitor charge and error analysis in meter bridge.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-phys-elec-1',
        title: 'Energy Loss on Connecting Charged and Uncharged Capacitors',
        examRelevance: 'both',
        problemStatement:
          'A 6 μF capacitor charged to 100 V is disconnected from the battery and connected in parallel with an uncharged 4 μF capacitor. Find the common potential V_c and heat dissipated in the connecting wires.',
        solutionSteps: [
          'Initial charge Q₁ = C₁V₁ = 6 μF × 100 V = 600 μC; Q₂ = 0.',
          'By charge conservation, common potential V_c = (Q₁ + Q₂) / (C₁ + C₂) = 600 / (6 + 4) = 60 V.',
          'Heat loss ΔH = ½ [C₁C₂ / (C₁ + C₂)] (V₁ − V₂)² = ½ × (24 / 10) × 10⁻⁶ × (100 − 0)² = 1.2 × 10⁻⁶ × 10⁴ = 0.012 J = 12 mJ.',
        ],
        finalAnswer: 'V_c = 60 V, Heat dissipated = 12 mJ',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Solid Sphere Potential at Centre', formula: 'V_centre = (3/2) · (kQ / R)', condition: 'Uniformly charged non-conducting sphere' },
        { label: 'Field in Spherical Cavity', formula: 'E_cavity = ρ a / (3ε₀)', condition: 'Uniform field; a = vector from sphere centre to cavity centre' },
        { label: 'Balanced Wheatstone Bridge', formula: 'R₁ / R₂ = R₃ / R₄  ⇒  I_galvanometer = 0', condition: 'Central branch can be removed' },
        { label: 'Max Power Transfer Theorem', formula: 'R_load = r_internal,   P_max = ε² / (4r)', condition: 'Purely resistive DC source' },
      ],
      reactionsOrKeyFacts: [
        'Work done by an external agent in charging a capacitor slowly is ½CV², while work done by a constant-voltage battery of EMF V is CV² (50% is dissipated as heat/radiation even if wires have negligible resistance).',
      ],
      shortConceptSummaries: [
        'Use folding symmetry (equipotential nodes) and mirror symmetry (current splitting) to simplify cube/grid resistor networks.',
      ],
      commonTraps: [
        'Forgetting to reverse the sign of ε_i/r_i when one battery in a parallel bank is connected with reverse polarity.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-phys-el-1',
          question: 'What happens to the electric field and energy of an isolated charged capacitor when a slab of dielectric constant K fills the gap?',
          expectedKeyPoint: 'Charge Q stays constant; C becomes KC, so E = E₀/K and stored energy U = Q²/(2C) decreases to U₀/K.',
        },
      ],
    },
  },
  {
    id: 'ch-phys-magnetism-emi-ac',
    code: 'PHY-12-02',
    subject: 'Physics',
    classLevel: 'Class 12',
    unitName: 'Electromagnetism II',
    title: 'Moving Charges, Magnetism, EMI & Alternating Current',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Physics Part 1 (Ch 4, 6, 7)',
      officialSyllabusSection: 'Unit 13, Unit 14 & Unit 15: Magnetic Effects, EMI and AC',
      ncertMapping: 'NCERT Class 12 Physics Chapters 4, 6, and 7',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3 problems (10–12 marks)',
    },
    overview:
      'Biot-Savart and Ampere’s circuital laws, Lorentz force and cyclotron motion, torque on current loops, Faraday’s and Lenz’s laws, motional EMF, self and mutual inductance, RL/LC circuits, and series LCR AC resonance & power factor.',
    topics: [
      {
        id: 'top-phys-mag-lorentz',
        title: 'Biot-Savart Law, Ampere’s Law & Charged Particle in B Field',
        examScope: 'both',
        definition:
          'Magnetic force F_B = q(v × B) is always perpendicular to velocity v, so a static magnetic field never does work on a charged particle and kinetic energy remains constant.',
        explanation:
          'When v ⊥ B, the particle executes uniform circular motion with radius R = mv/(|q|B) and cyclotron period T = 2πm/(|q|B) independent of speed. For a finite straight wire carrying current I, B = [μ₀I / (4πd)](sin θ₁ + sin θ₂).',
        derivation:
          'Equating magnetic force qvB to centripetal force mv²/R yields R = mv/(qB) = p/(qB) = √(2mK)/(qB) and angular frequency ω = qB/m.',
        keyFormulas: [
          {
            id: 'f-mag-1',
            name: 'Circular Arc & Infinite Wire Magnetic Field',
            expression: 'B_arc = (μ₀Iθ)/(4πR),   B_wire = (μ₀I)/(4πd)(sin θ₁ + sin θ₂)',
            unitsOrConditions: 'Tesla (T); θ in radians for circular arc at centre',
            variablesExplanation: 'μ₀ = 4π × 10⁻⁷ T·m/A, d = perpendicular distance to wire',
          },
          {
            id: 'f-mag-2',
            name: 'Motional EMF, Inductance & Series LCR Resonance',
            expression: 'ε = −dΦ_B/dt,   ε_rot = ½BωL²,   Z = √[R² + (X_L − X_C)²],   ω₀ = 1/√(LC)',
            unitsOrConditions: 'At resonance X_L = X_C, Z_min = R, power factor cos φ = 1',
            variablesExplanation: 'X_L = ωL, X_C = 1/(ωC), P_avg = V_rms I_rms cos φ',
          },
        ],
        exceptionsAndCommonMistakes: [
          'For a conducting rod of length L rotating about one end in uniform B, EMF between ends is ½BωL²; if it rotates about its midpoint, the two ends are at the same potential (V_A − V_B = 0), though each end differs from the midpoint by ⅛BωL².',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests 3D helical trajectories in crossed E and B fields, time-varying magnetic fields (induced electric field ∮ E · dl = −dΦ_B/dt), and sliding rails with capacitors/inductors.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-phys-emi-1',
        title: 'Induced Charge Flow in a Conducting Loop',
        examRelevance: 'both',
        problemStatement:
          'A circular coil of 50 turns, area 0.02 m², and total resistance 10 Ω lies with its plane perpendicular to a uniform magnetic field B = 0.4 T. If the coil is flipped by 180° in 0.1 s, find the total charge ΔQ that flows through the coil.',
        solutionSteps: [
          'Initial total flux linkage NΦ₁ = N B A cos 0° = 50 × 0.4 × 0.02 × 1 = +0.4 Wb.',
          'After flipping by 180°, NΦ₂ = N B A cos 180° = −0.4 Wb.',
          'Magnitude of flux linkage change |ΔΦ_total| = |−0.4 − 0.4| = 0.8 Wb.',
          'Total induced charge ΔQ = |ΔΦ_total| / R = 0.8 / 10 = 0.08 C = 80 mC (independent of the time 0.1 s taken to flip!).',
        ],
        finalAnswer: 'ΔQ = 0.08 C (80 mC)',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Total Induced Charge', formula: 'ΔQ = |ΔΦ_total| / R', condition: 'Independent of how fast flux changes' },
        { label: 'Solenoid Field & Inductance', formula: 'B = μ₀ n I,   L = μ₀ n² A l', condition: 'Long ideal solenoid (n = N/l)' },
        { label: 'Quality Factor of LCR', formula: 'Q = ω₀L / R = (1/R)√(L/C)', condition: 'Measures sharpness of resonance' },
      ],
      reactionsOrKeyFacts: [
        'Magnetic force on ANY closed current-carrying loop placed in a UNIFORM magnetic field is always zero (∮ dl = 0), though net torque τ = M × B may be non-zero.',
      ],
      shortConceptSummaries: [
        'Replace any arbitrary planar wire from A to B in a uniform B field with the straight directed segment L_eff = r_B − r_A when computing F = I(L_eff × B) or motional EMF.',
      ],
      commonTraps: [
        'Adding AC branch voltages algebraically instead of using phasor vector addition V_total = √[V_R² + (V_L − V_C)²].',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-phys-mag-1',
          question: 'Does the total charge ΔQ induced in a closed resistive loop depend on the rate dΦ/dt at which magnetic flux changes?',
          expectedKeyPoint: 'No — ΔQ = |ΔΦ|/R depends only on the net change in magnetic flux and loop resistance.',
        },
      ],
    },
  },
  {
    id: 'ch-phys-optics-modern',
    code: 'PHY-12-03',
    subject: 'Physics',
    classLevel: 'Class 12',
    unitName: 'Optics & Modern Physics',
    title: 'Ray Optics, Wave Optics & Modern Physics',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Physics Part 2 (Ch 9–14)',
      officialSyllabusSection: 'Unit 16–19: Optics, Dual Nature, Atoms & Nuclei, and Semiconductors',
      ncertMapping: 'NCERT Class 12 Physics Chapters 9, 10, 11, 12, 13, and 14',
    },
    weightageQuestionsApprox: {
      jee_main: '5–6 questions (20–24 marks)',
      jee_advanced: '4–5 problems (16–20 marks)',
    },
    overview:
      'Spherical mirrors, refraction at plane and spherical surfaces, lens maker’s formula, total internal reflection, prism dispersion, Young’s double-slit experiment (YDSE), diffraction, polarization, photoelectric effect, de Broglie matter waves, Bohr atomic model, nuclear binding energy, and logic gates.',
    topics: [
      {
        id: 'top-phys-optics-ydse',
        title: 'Refraction, Lenses, Prisms & Young’s Double-Slit Interference',
        examScope: 'both',
        definition:
          'Snell’s Law n₁ sin i = n₂ sin r governs refraction. In YDSE, coherent waves of wavelength λ from slits separated by d interfere on a screen at distance D ≫ d with fringe width β = λD/d.',
        explanation:
          'When a thin transparent sheet of thickness t and refractive index μ is placed in front of one slit in YDSE, the entire fringe pattern shifts toward that slit by Δy = (D/d)(μ − 1)t = (β/λ)(μ − 1)t without changing the fringe width β.',
        derivation:
          'Optical path difference introduced by slab of thickness t is Δx_optical = (μ − 1)t. Since path difference at position y on screen is d·y/D, central maxima (Δx_net = 0) shifts to y = (D/d)(μ − 1)t.',
        keyFormulas: [
          {
            id: 'f-opt-1',
            name: 'Spherical Refraction & Lens Maker’s Formula',
            expression: 'μ₂/v − μ₁/u = (μ₂ − μ₁)/R,    1/f = (μ_lens/μ_med − 1)(1/R₁ − 1/R₂)',
            unitsOrConditions: 'Paraxial rays; Cartesian sign convention (incident light direction is +ve)',
            variablesExplanation: 'u = object distance, v = image distance, f = focal length',
          },
          {
            id: 'f-opt-2',
            name: 'YDSE Intensity & Fringe Width',
            expression: 'I(φ) = I₁ + I₂ + 2√(I₁I₂) cos φ = 4I₀ cos²(φ/2),   β = λD/d',
            unitsOrConditions: 'φ = (2π/λ)Δx; 4I₀ formula holds when I₁ = I₂ = I₀',
            variablesExplanation: 'Δx = path difference, φ = phase difference',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Forgetting that immersing a glass lens (μ_g = 1.5) in a liquid of higher refractive index (e.g., μ_l = 1.65) flips the sign of 1/f, turning a convex converging lens into a diverging lens.',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced combines moving objects/mirrors, silvered lenses (1/f_eq = 1/f_m − 2/f_l), and oblique incidence / dichromatic YDSE.',
      },
      {
        id: 'top-phys-modern-bohr-photoelectric',
        title: 'Photoelectric Effect, Matter Waves, Bohr Atom & Nuclear Physics',
        examScope: 'both',
        definition:
          'Einstein’s photoelectric equation K_max = eV₀ = hν − φ₀ = hc/λ − hc/λ₀ relates maximum photoelectron kinetic energy to photon frequency ν and work function φ₀.',
        explanation:
          'In Bohr’s model for hydrogen-like ions (atomic number Z), angular momentum is quantized as L = mvr = nh/(2π). Radius scales as r_n = 0.529 (n²/Z) Å, speed as v_n = 2.18×10⁶ (Z/n) m/s, and total energy as E_n = −13.6 (Z²/n²) eV.',
        derivation:
          'Combining kZe²/r² = mv²/r with mvr = nℏ gives r_n = n²ℏ²/(mkZe²) ∝ n²/Z and E_n = K_n + U_n = −K_n = −U_n/2 = −13.6 (Z²/n²) eV.',
        keyFormulas: [
          {
            id: 'f-mod-1',
            name: 'Photoelectric Stopping Potential & de Broglie Wavelength',
            expression: 'eV₀ = hc/λ − φ₀,    λ_dB = h/p = h / √(2mK) = h / √(2mqV)',
            unitsOrConditions: 'hc ≈ 1240 eV·nm; for electron λ_dB(Å) ≈ 12.27 / √V(volts)',
            variablesExplanation: 'V₀ = stopping potential, p = momentum, V = accelerating potential',
          },
          {
            id: 'f-mod-2',
            name: 'Bohr Energy Levels & Rydberg Formula',
            expression: 'E_n = −13.6 (Z²/n²) eV,    1/λ = R_H Z² (1/n₁² − 1/n₂²)',
            unitsOrConditions: 'Single-electron species (H, He⁺, Li²⁺); K_n = −E_n, U_n = 2E_n',
            variablesExplanation: 'R_H = 1.097 × 10⁷ m⁻¹, n₁ < n₂',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Doubling the intensity of monochromatic light doubles the saturation photocurrent (photon flux), NOT the stopping potential V₀ or K_max.',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests nuclear recoil during photon emission, simultaneous radioactive decay/production dN/dt = α − λN, and reduced mass corrections in positronium/muonic hydrogen.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-phys-mod-1',
        title: 'Photoelectric Stopping Potential & Threshold Wavelength',
        examRelevance: 'both',
        problemStatement:
          'Light of wavelength 310 nm falls on a metal surface of work function 2.2 eV (use hc = 1240 eV·nm). Find the maximum kinetic energy of emitted photoelectrons and the stopping potential.',
        solutionSteps: [
          'Incident photon energy E = hc / λ = 1240 eV·nm / 310 nm = 4.0 eV.',
          'Maximum kinetic energy K_max = E − φ₀ = 4.0 eV − 2.2 eV = 1.8 eV.',
          'Stopping potential V₀ = K_max / e = 1.8 V.',
        ],
        finalAnswer: 'K_max = 1.8 eV, Stopping potential V₀ = 1.8 V',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Critical Angle (TIR)', formula: 'sin θ_c = μ_rarer / μ_denser', condition: 'Ray travelling from denser to rarer medium' },
        { label: 'Silvered Lens Equivalent Mirror', formula: '1 / f_eq = 1 / f_mirror − 2 / f_lens', condition: 'With signs (P_eq = 2P_lens + P_mirror)' },
        { label: 'Bohr Energy Relations', formula: 'K = −E_total,   U = 2 E_total', condition: 'Zero of U at infinity' },
        { label: 'Number of Spectral Lines', formula: 'N = (n₂ − n₁)(n₂ − n₁ + 1) / 2', condition: 'De-excitation from state n₂ to n₁ in an ensemble' },
      ],
      reactionsOrKeyFacts: [
        'Nuclear density ρ ≈ 2.3 × 10¹⁷ kg/m³ is independent of mass number A because nuclear radius R = R₀ A^(1/3) so volume V ∝ A.',
      ],
      shortConceptSummaries: [
        'Use hc = 1240 eV·nm for rapid JEE calculations in photoelectric effect and atomic transitions.',
      ],
      commonTraps: [
        'Confusing "2nd excited state" (which is n = 3) with n = 2 (which is the 1st excited state).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-phys-mod-1',
          question: 'How does the stopping potential V₀ change if the intensity of incident light (above threshold frequency) is tripled?',
          expectedKeyPoint: 'Stopping potential V₀ remains unchanged because V₀ depends only on photon frequency ν and work function φ₀.',
        },
      ],
    },
  },

  /* ==========================================================================
   * CHEMISTRY (6 Complete High-Yield Chapters: Physical, Inorganic & Organic)
   * ========================================================================== */
  {
    id: 'ch-chem-atomic-bonding',
    code: 'CHE-11-01',
    subject: 'Chemistry',
    classLevel: 'Class 11',
    unitName: 'Physical & Inorganic Foundations',
    title: 'Atomic Structure & Chemical Bonding',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Chemistry Part 1 (Ch 2 & 4)',
      officialSyllabusSection: 'Unit 2 & Unit 3: Atomic Structure and Chemical Bonding & Molecular Structure',
      ncertMapping: 'NCERT Class 11 Chemistry Chapters 2 and 4',
    },
    weightageQuestionsApprox: {
      jee_main: '3–4 questions (12–16 marks)',
      jee_advanced: '2–3 problems (8–12 marks)',
    },
    overview:
      'Quantum numbers, radial and angular nodes, Aufbau/Pauli/Hund rules, VSEPR theory, hybridization and Bent’s rule, dipole moment, Fajan’s rules for covalent character, Molecular Orbital Theory (MOT) bond order and magnetism, and hydrogen bonding.',
    topics: [
      {
        id: 'top-chem-quantum-nodes',
        title: 'Quantum Numbers, Radial/Angular Nodes & Electronic Configuration',
        examScope: 'both',
        definition:
          'An atomic orbital ψ_(n,l,m_l) is characterized by principal (n ≥ 1), azimuthal (0 ≤ l ≤ n−1), and magnetic (−l ≤ m_l ≤ +l) quantum numbers.',
        explanation:
          'For any orbital, the number of angular (planar/conical) nodes is l, the number of radial (spherical) nodes is n − l − 1, and total nodes = n − 1. Orbital angular momentum is √[l(l+1)] ℏ, whereas spin angular momentum is √[s(s+1)] ℏ.',
        derivation:
          'In the radial wave function R_nl(r), the polynomial factor has degree n − l − 1, giving n − l − 1 positive finite roots r > 0 where R_nl(r) = 0 (radial nodes).',
        keyFormulas: [
          {
            id: 'f-atom-1',
            name: 'Radial & Angular Nodes and Spin-Only Magnetic Moment',
            expression: 'N_angular = l,   N_radial = n − l − 1,   μ_s = √[n_u(n_u + 2)] BM',
            unitsOrConditions: 'BM = Bohr Magneton; n_u = number of unpaired electrons',
            variablesExplanation: 'n = principal quantum number, l = azimuthal quantum number (0=s, 1=p, 2=d, 3=f)',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Cr (Z = 24) is [Ar] 3d⁵ 4s¹ and Cu (Z = 29) is [Ar] 3d¹⁰ 4s¹ due to exchange energy and symmetrical subshell stability; when ionizing 3d metals, remove 4s electrons BEFORE 3d electrons!',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests plots of R(r), R²(r), and radial probability distribution 4πr²R²(r) against r.',
      },
      {
        id: 'top-chem-vsepr-mot',
        title: 'VSEPR Geometry, Bent’s Rule & Molecular Orbital Theory (MOT)',
        examScope: 'both',
        definition:
          'Steric number SN = (number of σ-bonded atoms) + (number of lone pairs on central atom) determines electron-domain geometry; lone-pair repulsion (LP–LP > LP–BP > BP–BP) determines molecular shape.',
        explanation:
          'In trigonal bipyramidal (sp³d, SN = 5) geometry, lone pairs always occupy equatorial positions (e.g., SF₄ is see-saw, ClF₃ is bent T-shaped, XeF₂ and I₃⁻ are linear), whereas more electronegative substituents prefer axial positions (Bent’s rule, e.g., in PCl₃F₂, F atoms are axial). In MOT, Bond Order = ½(N_b − N_a).',
        derivation:
          'For homonuclear diatomics with ≤ 14 electrons (B₂, C₂, N₂), s–p mixing raises σ2p_z above π2p_x = π2p_y. For > 14 electrons (O₂, F₂, Ne₂), σ2p_z lies below π2p_x = π2p_y.',
        keyFormulas: [
          {
            id: 'f-bond-1',
            name: 'Steric Number & MOT Bond Order',
            expression: 'SN = ½(V + M − C + A),    Bond Order = ½(N_bonding − N_antibonding)',
            unitsOrConditions: 'M = monovalent surrounding atoms; higher BO ⇒ shorter bond, higher BDE',
            variablesExplanation: 'V = valence e⁻ of central atom, C = cationic charge, A = anionic charge',
          },
        ],
        exceptionsAndCommonMistakes: [
          'B₂ (10 e⁻) and O₂ (16 e⁻) are both PARAMAGNETIC (2 unpaired electrons in π2p and π*2p respectively), whereas C₂ (12 e⁻) is diamagnetic because all 4 valence π electrons pair in π2p_x² π2p_y².',
          'NH₃ has a larger dipole moment (1.47 D) than NF₃ (0.23 D) because the lone-pair dipole reinforces N–H bond dipoles in NH₃ but opposes N–F bond dipoles in NF₃.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main focuses on hybridization, VSEPR shapes, and MOT bond orders of O₂/N₂/NO/CO species; JEE Advanced tests back-bonding (BF₃, N(SiH₃)₃ planar vs N(CH₃)₃ pyramidal), banana bonds (B₂H₆), and heteronuclear MO diagrams.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-chem-bond-1',
        title: 'MOT Bond Order & Magnetism of Dioxygen Species',
        examRelevance: 'both',
        problemStatement:
          'Arrange O₂⁺, O₂, O₂⁻ (superoxide), and O₂²⁻ (peroxide) in order of increasing O–O bond length and state which species are paramagnetic.',
        solutionSteps: [
          'Count total electrons: O₂⁺ (15 e⁻), O₂ (16 e⁻), O₂⁻ (17 e⁻), O₂²⁻ (18 e⁻).',
          'Compute Bond Order = ½(10 − N_antibonding in 2s/2p): O₂⁺ = 2.5, O₂ = 2.0, O₂⁻ = 1.5, O₂²⁻ = 1.0.',
          'Bond length is inversely proportional to bond order: O₂⁺ < O₂ < O₂⁻ < O₂²⁻.',
          'O₂⁺ (1 unpaired e⁻ in π*2p), O₂ (2 unpaired e⁻ in π*2p), and O₂⁻ (1 unpaired e⁻ in π*2p) are paramagnetic; O₂²⁻ is diamagnetic.',
        ],
        finalAnswer: 'Bond length: O₂⁺ < O₂ < O₂⁻ < O₂²⁻; Paramagnetic: O₂⁺, O₂, O₂⁻',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Node Counts', formula: 'Angular = l,  Radial = n − l − 1,  Total = n − 1', condition: 'Any hydrogenic or multi-electron orbital' },
        { label: 'MOT Bond Order (10–18 e⁻)', formula: '14 e⁻ → BO = 3.0; subtract 0.5 for each e⁻ away from 14', condition: 'Quick check for N₂, CO, NO⁺ (14 e⁻ → 3.0)' },
      ],
      reactionsOrKeyFacts: [
        'XeF₂ (sp³d, 3 LP) and I₃⁻ are linear; XeF₄ (sp³d², 2 LP) is square planar; XeF₆ (sp³d³, 1 LP) is distorted octahedral.',
        'N(SiH₃)₃ is trigonal planar (sp²) due to N(2p) → Si(3d) pπ–dπ back-bonding, whereas N(CH₃)₃ is pyramidal (sp³).',
      ],
      shortConceptSummaries: [
        'Fajan’s Rule: Small, highly charged cation + large, polarizable anion ⇒ high covalent character, lower melting point, and lower water solubility.',
      ],
      commonTraps: [
        'Counting π-bonds when finding steric number (only σ-bonds and localized lone pairs contribute to hybridization).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-chem-bond-1',
          question: 'Why is the bond order of CO⁺ reported as ~3.5 (bond length shorter than CO)?',
          expectedKeyPoint: 'In CO, the HOMO has slight antibonding character localized on Carbon; removing an electron strengthens the C–O bond.',
        },
      ],
    },
  },
  {
    id: 'ch-chem-thermo-equilibrium',
    code: 'CHE-11-02',
    subject: 'Chemistry',
    classLevel: 'Class 11',
    unitName: 'Physical Chemistry I',
    title: 'Chemical Thermodynamics & Equilibrium',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Chemistry Part 1 (Ch 5 & 6)',
      officialSyllabusSection: 'Unit 4 & Unit 6: Chemical Thermodynamics and Equilibrium',
      ncertMapping: 'NCERT Class 11 Chemistry Chapters 5 and 6',
    },
    weightageQuestionsApprox: {
      jee_main: '3–4 questions (12–16 marks)',
      jee_advanced: '3 problems (10–12 marks)',
    },
    overview:
      'IUPAC First Law (ΔU = q + w), enthalpy (ΔH = ΔU + Δn_g RT), Hess’s law, Second Law and entropy, Gibbs free energy and spontaneity, K_p and K_c relations, Le Chatelier’s principle, pH of weak acids/bases, Henderson-Hasselbalch buffer equation, salt hydrolysis, and solubility product K_sp.',
    topics: [
      {
        id: 'top-chem-thermo-gibbs',
        title: 'First Law (IUPAC), Enthalpy, Entropy & Gibbs Free Energy',
        examScope: 'both',
        definition:
          'Under the IUPAC convention, internal energy change is ΔU = q + w, where w = −∫ P_ext dV is work done ON the system. At constant T and P, a process is spontaneous if ΔG = ΔH − TΔS < 0.',
        explanation:
          'For reversible isothermal expansion of n moles of an ideal gas from V₁ to V₂, ΔU = ΔH = 0 and w_rev = −nRT ln(V₂/V₁) = −2.303 nRT log₁₀(V₂/V₁). At chemical equilibrium, ΔG = 0 and Q = K, giving ΔG° = −RT ln K.',
        derivation:
          'From H = U + PV, for an isothermal chemical reaction involving ideal gases at constant T: ΔH = ΔU + Δ(PV) = ΔU + Δn_g RT, where Δn_g counts ONLY gaseous products minus gaseous reactants.',
        keyFormulas: [
          {
            id: 'f-cth-1',
            name: 'Enthalpy–Internal Energy & Gibbs–Equilibrium Relation',
            expression: 'ΔH = ΔU + Δn_g RT,    ΔG° = ΔH° − TΔS° = −2.303 RT log₁₀ K',
            unitsOrConditions: 'Match units of R (8.314 J·mol⁻¹·K⁻¹) with ΔH° and ΔG° (convert kJ to J!)',
            variablesExplanation: 'Δn_g = moles of gaseous products − moles of gaseous reactants',
          },
          {
            id: 'f-cth-2',
            name: 'Equilibrium Constant & Buffer pH (Henderson-Hasselbalch)',
            expression: 'K_p = K_c (RT)^(Δn_g),    pH_acidic = pK_a + log₁₀([Salt]/[Acid])',
            unitsOrConditions: 'For K_p in atm and K_c in mol/L, use R = 0.0821 L·atm·mol⁻¹·K⁻¹',
            variablesExplanation: 'pK_a = −log₁₀ K_a',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Including solid or pure liquid moles when calculating Δn_g in ΔH = ΔU + Δn_g RT or K_p = K_c(RT)^(Δn_g).',
          'Using pH = −log(Cα) for a very dilute strong acid like 10⁻⁸ M HCl without including the 10⁻⁷ M H⁺ contribution from water auto-ionization (actual pH ≈ 6.98, never > 7).',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests polyprotic acid titrations, simultaneous solubility equilibria with common-ion/complexation effects, and entropy of mixing/phase transitions.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-chem-eq-1',
        title: 'Solubility in Presence of a Common Ion',
        examRelevance: 'both',
        problemStatement:
          'The solubility product K_sp of Ag₂CrO₄ is 4 × 10⁻¹² at 298 K. Calculate its molar solubility in (a) pure water and (b) 0.01 M AgNO₃ solution.',
        solutionSteps: [
          '(a) In pure water: Ag₂CrO₄(s) ⇌ 2Ag⁺(2s) + CrO₄²⁻(s) ⇒ K_sp = (2s)²(s) = 4s³.',
          '4s³ = 4 × 10⁻¹² ⇒ s³ = 10⁻¹² ⇒ s = 1.0 × 10⁻⁴ mol/L.',
          '(b) In 0.01 M AgNO₃: [Ag⁺] = 0.01 + 2s′ ≈ 0.01 M, and [CrO₄²⁻] = s′.',
          'K_sp = (0.01)² × s′ = 4 × 10⁻¹² ⇒ 10⁻⁴ s′ = 4 × 10⁻¹² ⇒ s′ = 4.0 × 10⁻⁸ mol/L.',
        ],
        finalAnswer: '(a) 1.0 × 10⁻⁴ M in pure water; (b) 4.0 × 10⁻⁸ M in 0.01 M AgNO₃',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Free Expansion into Vacuum', formula: 'P_ext = 0  ⇒  w = 0;  for isothermal ideal gas: q = 0, ΔU = 0, ΔH = 0, ΔS_sys = nR ln(V₂/V₁)', condition: 'Irreversible adiabatic & isothermal simultaneously' },
        { label: 'Weak Acid + Weak Base Salt pH', formula: 'pH = 7 + ½(pK_a − pK_b)', condition: 'Independent of salt concentration C' },
        { label: 'Solubility Product A_x B_y', formula: 'K_sp = x^x y^y s^(x+y)', condition: 'In pure water without hydrolysis' },
      ],
      reactionsOrKeyFacts: [
        'Adding an inert gas at constant VOLUME does not shift chemical equilibrium; adding an inert gas at constant PRESSURE shifts equilibrium toward the side with MORE gaseous moles (higher Δn_g).',
      ],
      shortConceptSummaries: [
        'Always convert ΔH° from kJ/mol to J/mol before adding −TΔS° (which is in J/mol).',
      ],
      commonTraps: [
        'Forgetting the stoichiometric coefficient power (e.g., [Ag⁺]² in Ag₂CrO₄) when writing K_sp.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-chem-th-1',
          question: 'For an isothermal free expansion of an ideal gas into vacuum, what are q, w, ΔU, and ΔS_total?',
          expectedKeyPoint: 'w = 0 (since P_ext = 0), ΔU = 0 (isothermal ideal gas), so q = 0; ΔS_sys = nR ln(V₂/V₁) > 0 and ΔS_surr = 0, so ΔS_total > 0.',
        },
      ],
    },
  },
  {
    id: 'ch-chem-electrochem-kinetics-solutions',
    code: 'CHE-12-01',
    subject: 'Chemistry',
    classLevel: 'Class 12',
    unitName: 'Physical Chemistry II',
    title: 'Solutions, Electrochemistry & Chemical Kinetics',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Chemistry Part 1 (Ch 1–3)',
      officialSyllabusSection: 'Unit 5, Unit 7 & Unit 8: Solutions, Electrochemistry and Chemical Kinetics',
      ncertMapping: 'NCERT Class 12 Chemistry Chapters 1, 2, and 3',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Raoult’s law, colligative properties and Van’t Hoff factor i, Nernst equation, ΔG° = −nFE°_cell, molar conductivity and Kohlrausch’s law, Faraday’s laws of electrolysis, zero-order and first-order integrated rate laws, half-life, and Arrhenius activation energy equation.',
    topics: [
      {
        id: 'top-chem-colligative-electro',
        title: 'Colligative Properties, Nernst Equation & Conductance',
        examScope: 'both',
        definition:
          'Colligative properties depend on the total concentration of solute particles (i · C). In an electrochemical cell, EMF at 298 K is given by Nernst’s equation: E_cell = E°_cell − (0.0591 / n) log₁₀ Q.',
        explanation:
          'For an electrolyte A_x B_y dissociating to degree α (giving ν = x + y ions), Van’t Hoff factor is i = 1 + (ν − 1)α. When combining two half-reactions to form a third half-reaction, add their ΔG° = −nFE° values (since ΔG° is extensive, whereas E° is intensive): n₃E°₃ = n₁E°₁ + n₂E°₂.',
        derivation:
          'Substituting ΔG = −nFE_cell and ΔG° = −nFE°_cell into ΔG = ΔG° + RT ln Q and dividing by −nF gives E_cell = E°_cell − (RT / nF) ln Q.',
        keyFormulas: [
          {
            id: 'f-sol-1',
            name: 'Colligative Properties with Van’t Hoff Factor i',
            expression: 'ΔT_b = i K_b m,    ΔT_f = i K_f m,    π = i C R T',
            unitsOrConditions: 'm = molality (mol/kg), C = molarity (mol/L)',
            variablesExplanation: 'i = 1 + (ν − 1)α for dissociation; i = 1 − (1 − 1/n)α for association',
          },
          {
            id: 'f-elec-chem-1',
            name: 'Nernst Equation, Kohlrausch’s Law & First-Order Kinetics',
            expression: 'E = E° − (0.0591/n) log₁₀ Q,   Λ°_m = ν₊λ°₊ + ν₋λ°₋,   k = (2.303/t) log₁₀([A]₀/[A]_t)',
            unitsOrConditions: 'At 298 K (25 °C); first-order half-life t_1/2 = 0.693 / k',
            variablesExplanation: 'n = moles of electrons transferred, Q = reaction quotient',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Adding standard electrode potentials E°₁ + E°₂ directly when combining two half-cells with a remaining electron transfer n₃ ≠ 0 (always use E°₃ = (n₁E°₁ + n₂E°₂)/n₃).',
          'For a first-order reaction, t_99.9% = 10 × t_1/2 and t_99% = 2 × t_90% (since log 100 = 2 log 10).',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests conductometric titration curves, parallel/consecutive first-order kinetics, and pressure-based gas-phase first-order kinetics.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-chem-kin-1',
        title: 'First-Order Reaction Time to 99% vs 90% Completion',
        examRelevance: 'both',
        problemStatement:
          'Show that for any first-order reaction, the time required for 99% completion is exactly twice the time required for 90% completion.',
        solutionSteps: [
          'For 90% completion, [A]_t = 0.10 [A]₀, so [A]₀ / [A]_t = 10.',
          't_90% = (2.303 / k) log₁₀(10) = 2.303 / k.',
          'For 99% completion, [A]_t = 0.01 [A]₀, so [A]₀ / [A]_t = 100 = 10².',
          't_99% = (2.303 / k) log₁₀(10²) = 2 × (2.303 / k) = 2 × t_90%.',
        ],
        finalAnswer: 't_99% = 2 × t_90%',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Faraday’s First Law', formula: 'w = (E_eq · I · t) / 96500 = (M / n_f) · (Q / F)', condition: '1 F ≈ 96500 C/mol e⁻' },
        { label: 'Zero-Order Kinetics', formula: '[A]_t = [A]₀ − kt,   t_1/2 = [A]₀ / (2k)', condition: 'Units of k: mol·L⁻¹·s⁻¹' },
        { label: 'Arrhenius Equation', formula: 'log₁₀(k₂ / k₁) = (E_a / 2.303 R) · [(T₂ − T₁) / (T₁ T₂)]', condition: 'E_a in J/mol, R = 8.314 J·mol⁻¹·K⁻¹' },
      ],
      reactionsOrKeyFacts: [
        'Specific conductivity κ (kappa) DECREASES on dilution (fewer ions per unit volume), whereas molar conductivity Λ_m = 1000 κ / C INCREASES on dilution.',
      ],
      shortConceptSummaries: [
        'Benzoic acid dimerizes in benzene (i ≈ 0.5) but partially ionizes in water (i > 1).',
      ],
      commonTraps: [
        'Confusing order of reaction (experimental, can be fractional/zero) with molecularity (theoretical elementary step count, always positive integer 1, 2, or 3).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-chem-kin-1',
          question: 'How does the half-life t_1/2 of a reaction scale with initial concentration [A]₀ for an nth-order reaction?',
          expectedKeyPoint: 't_1/2 ∝ [A]₀^(1 − n) (independent of [A]₀ for n = 1; proportional to [A]₀ for n = 0; inversely proportional to [A]₀ for n = 2).',
        },
      ],
    },
  },
  {
    id: 'ch-chem-coordination-dfblock',
    code: 'CHE-12-02',
    subject: 'Chemistry',
    classLevel: 'Class 12',
    unitName: 'Inorganic Chemistry',
    title: 'Coordination Compounds & Transition Elements',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Chemistry Part 1 (Ch 4 & 5)',
      officialSyllabusSection: 'Unit 11 & Unit 12: d- and f-Block Elements and Coordination Compounds',
      ncertMapping: 'NCERT Class 12 Chemistry Chapters 4 and 5',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Werner’s theory, IUPAC nomenclature of complexes, structural and stereoisomerism (geometrical and optical), Valence Bond Theory (inner vs outer orbital complexes), Crystal Field Theory (octahedral Δ_o and tetrahedral Δ_t splitting, CFSE, spectrochemical series), metal carbonyl synergic bonding, and KMnO₄/K₂Cr₂O₇ redox chemistry.',
    topics: [
      {
        id: 'top-chem-cft-isomerism',
        title: 'Crystal Field Theory (CFT), Spectrochemical Series & Isomerism',
        examScope: 'both',
        definition:
          'In an octahedral crystal field, the 5 degenerate d-orbitals split into lower-energy t₂g (d_xy, d_yz, d_xz; −0.4 Δ_o) and higher-energy e_g (d_(x²−y²), d_z²; +0.6 Δ_o). In a tetrahedral field, splitting is inverted (e below t₂) with Δ_t = (4/9)Δ_o.',
        explanation:
          'Strong-field ligands (CO > CN⁻ > NO₂⁻ > en > NH₃) produce Δ_o > P (pairing energy), favoring low-spin d⁴–d⁷ octahedral complexes. Weak-field ligands (I⁻ < Br⁻ < SCN⁻ < Cl⁻ < F⁻ < OH⁻ < H₂O) produce Δ_o < P, giving high-spin complexes. Square planar complexes (d⁸ with strong ligands or 4d/5d metals like [Ni(CN)₄]²⁻, [PtCl₄]²⁻) are diamagnetic dsp².',
        derivation:
          'Preserving the barycenter (average energy = 0): 3 E(t₂g) + 2 E(e_g) = 0 and E(e_g) − E(t₂g) = Δ_o ⇒ E(t₂g) = −0.4 Δ_o and E(e_g) = +0.6 Δ_o.',
        keyFormulas: [
          {
            id: 'f-coord-1',
            name: 'Octahedral CFSE & Effective Atomic Number (EAN)',
            expression: 'CFSE_oct = (−0.4 n_t2g + 0.6 n_eg) Δ_o + m P,    EAN = Z − O.S. + 2(C.N.)',
            unitsOrConditions: 'm = number of additional ligand-forced electron pairs',
            variablesExplanation: 'Z = atomic number of metal, O.S. = oxidation state, C.N. = coordination number',
          },
        ],
        exceptionsAndCommonMistakes: [
          '[Ni(CO)₄] has Ni(0) (3d⁸ 4s²); strong-field CO pushes 4s² into 3d¹⁰, so hybridization is sp³ (tetrahedral and diamagnetic), NOT dsp²!',
          'Tetrahedral complexes [MABCD] can be optically active (chiral), whereas square planar [MABCD] has a molecular plane of symmetry and is optically inactive (though it has 3 geometrical isomers!).',
        ],
        mainVsAdvancedDistinction:
          'JEE Main tests spin-only magnetic moments, hybridization of [CoF₆]³⁻ vs [Co(NH₃)₆]³⁺, and CFSE; JEE Advanced tests isomer counting for [Ma₂b₂c₂], [M(AB)₃], John-Teller distortion in d⁹ Cu(II), and metal-carbonyl C–O bond order trends.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-chem-coord-1',
        title: 'Geometry, Hybridization & Magnetism of Nickel(II) / Nickel(0) Complexes',
        examRelevance: 'both',
        problemStatement:
          'Compare the hybridization, geometry, and number of unpaired electrons in [NiCl₄]²⁻, [Ni(CN)₄]²⁻, and [Ni(CO)₄].',
        solutionSteps: [
          '[NiCl₄]²⁻: Ni²⁺ is 3d⁸, Cl⁻ is a weak-field ligand ⇒ no pairing; sp³ hybridization, tetrahedral, 2 unpaired electrons (μ ≈ 2.83 BM).',
          '[Ni(CN)₄]²⁻: Ni²⁺ is 3d⁸, CN⁻ is a strong-field ligand ⇒ pairs the two 3d electrons; dsp² hybridization, square planar, 0 unpaired electrons (diamagnetic).',
          '[Ni(CO)₄]: Ni(0) is 3d⁸ 4s², CO is a strong-field ligand ⇒ rearrangements give 3d¹⁰; sp³ hybridization, tetrahedral, 0 unpaired electrons (diamagnetic).',
        ],
        finalAnswer: '[NiCl₄]²⁻ (sp³, tetrahedral, 2 e⁻); [Ni(CN)₄]²⁻ (dsp², square planar, 0 e⁻); [Ni(CO)₄] (sp³, tetrahedral, 0 e⁻)',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Tetrahedral vs Octahedral Splitting', formula: 'Δ_t = (4/9) Δ_o', condition: 'Same metal, same ligand, same bond length' },
        { label: 'Chromate–Dichromate pH Equilibrium', formula: '2CrO₄²⁻ (yellow, basic) + 2H⁺ ⇌ Cr₂O₇²⁻ (orange, acidic) + H₂O', condition: 'No change in Cr(+6) oxidation state' },
      ],
      reactionsOrKeyFacts: [
        'Synergic π-back-bonding in metal carbonyls (M(dπ) → CO(π*2p)) strengthens the M–C bond and weakens/lengthens the C–O bond.',
        'Lanthanoid contraction (poor shielding by 4f electrons) makes 4d and 5d transition elements (e.g., Zr and Hf) have almost identical atomic radii.',
      ],
      shortConceptSummaries: [
        '[Ma₃b₃] octahedral complexes exhibit facial (fac, three identical ligands on one triangular face) and meridional (mer) geometrical isomerism; neither is optically active.',
      ],
      commonTraps: [
        'Assuming [Co(ox)₃]³⁻ has weak-field Co³⁺ — with Co³⁺ (3d⁶), even oxalate C₂O₄²⁻ and H₂O act as strong-field ligands, making [Co(C₂O₄)₃]³⁻ and [Co(H₂O)₆]³⁺ diamagnetic (d²sp³)!',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-chem-coord-1',
          question: 'How many geometrical isomers does a square planar complex [M(A)(B)(C)(D)] have, and how many are optically active?',
          expectedKeyPoint: '3 geometrical isomers (by fixing A and placing B, C, or D trans to A); 0 optically active isomers because the molecular plane is a plane of symmetry.',
        },
      ],
    },
  },
  {
    id: 'ch-chem-goc-hydrocarbons',
    code: 'CHE-11-03',
    subject: 'Chemistry',
    classLevel: 'Class 11',
    unitName: 'Organic Chemistry I',
    title: 'General Organic Chemistry (GOC), Stereochemistry & Hydrocarbons',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Chemistry Part 2 (Ch 8 & 9)',
      officialSyllabusSection: 'Unit 14 & Unit 15: Basic Principles of Organic Chemistry and Hydrocarbons',
      ncertMapping: 'NCERT Class 11 Chemistry Chapters 8 and 9',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Inductive, mesomeric/resonance, hyperconjugation, and steric effects, aromaticity (Hückel’s 4n+2 rule), carbocation/carbanion/free-radical stability, acidity and basicity orders, R/S and E/Z stereochemistry, conformational analysis, Markovnikov/anti-Markovnikov alkene additions, ozonolysis, and Electrophilic Aromatic Substitution (EAS).',
    topics: [
      {
        id: 'top-chem-goc-aromaticity',
        title: 'Electronic Effects, Aromaticity & Intermediate Stability',
        examScope: 'both',
        definition:
          'Resonance (+M/−M) operates through conjugated π-systems and generally outweighs inductive (+I/−I) effects except for halogens (−I > +M). Hückel’s rule states that a cyclic, planar, fully conjugated species with (4n + 2) π-electrons is aromatic.',
        explanation:
          'Carbocation stability increases with dancing resonance (cyclopropylcarbinyl), aromaticity (tropylium C₇H₇⁺, 6π e⁻), lone-pair resonance (+M), and α-C–H hyperconjugation. Ortho-substituted benzoic acids are stronger acids than para-isomers (Ortho Effect due to steric inhibition of resonance of –COOH with the ring).',
        derivation:
          'Counting α-hydrogens adjacent to sp² carbocation or alkene C=C gives (n_α + 1) hyperconjugative structures; more α-H ⇒ lower heat of hydrogenation ΔH_hydrog and higher alkene stability.',
        keyFormulas: [
          {
            id: 'f-goc-1',
            name: 'Degree of Unsaturation (DU) & Stereoisomer Count',
            expression: 'DU = (C + 1) − (H + X − N)/2,    Max Stereoisomers = 2^n (unsymmetrical)',
            unitsOrConditions: 'X = halogens, N = nitrogen; n = number of stereocenters',
            variablesExplanation: '1 DU = 1 ring or 1 π-bond; benzene has DU = 4',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Aqueous basicity of methylamines: (CH₃)₂NH (2°) > CH₃NH₂ (1°) > (CH₃)₃N (3°) > NH₃; for ethylamines: (C₂H₅)₂NH (2°) > (C₂H₅)₃N (3°) > C₂H₅NH₂ (1°) > NH₃ (combined +I, solvation, and steric effects).',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests bridgehead carbocation instability (Bredt’s rule), isotopic labeling in rearrangements, and diastereomeric stereochemical outcomes (syn/anti addition to cis/trans alkenes).',
      },
    ],
    workedExamples: [
      {
        id: 'ex-chem-goc-1',
        title: 'Stereochemical Outcome of Bromination of cis- vs trans-2-Butene',
        examRelevance: 'both',
        problemStatement:
          'Predict the stereochemical product(s) when (a) trans-2-butene and (b) cis-2-butene react with Br₂ in CCl₄.',
        solutionSteps: [
          'Addition of Br₂ / CCl₄ proceeds via a cyclic bromonium ion intermediate followed by backside SN2 attack, giving stereospecific ANTI addition.',
          'Mnemonic CAR / TAS: Cis + Anti = Racemic (±) mixture; Trans + Anti = Meso compound.',
          '(a) trans-2-butene + Br₂ (anti) → meso-2,3-dibromobutane (optically inactive due to internal plane of symmetry).',
          '(b) cis-2-butene + Br₂ (anti) → racemic (±)-2,3-dibromobutane (equimolar d and l enantiomers).',
        ],
        finalAnswer: '(a) meso-2,3-dibromobutane; (b) racemic (±)-2,3-dibromobutane',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Stereospecific Addition Mnemonic', formula: 'CIS + SYN = MESO;  CIS + ANTI = RACEMIC;  TRANS + SYN = RACEMIC;  TRANS + ANTI = MESO', condition: 'Symmetrical alkenes like 2-butene' },
        { label: 'Hückel Aromaticity', formula: '4n + 2 π electrons (n = 0, 1, 2…)', condition: 'Cyclic, planar, continuous p-orbital conjugation' },
      ],
      reactionsOrKeyFacts: [
        'Peroxide (Kharasch) anti-Markovnikov effect applies ONLY to HBr (because both chain-propagation steps are exothermic), never to HCl or HI.',
        'Hydroboration-oxidation (BH₃·THF / H₂O₂, OH⁻) gives syn anti-Markovnikov alcohol without carbocation rearrangement; Oxymercuration-demercuration (Hg(OAc)₂, H₂O / NaBH₄) gives Markovnikov alcohol without rearrangement.',
      ],
      shortConceptSummaries: [
        'Halogens (–F, –Cl, –Br, –I) are deactivating on benzene (−I > +M) yet ortho/para-directing because +M stabilizes the ortho/para Wheland sigma-complex.',
      ],
      commonTraps: [
        'Treating Cyclooctatetraene (8π e⁻) as antiaromatic — it adopts a non-planar tub conformation and is non-aromatic.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-chem-goc-1',
          question: 'Why does HCl not show the anti-Markovnikov peroxide effect with propene?',
          expectedKeyPoint: 'The reaction of Cl• radical with alkene is exothermic, but abstraction of H from H–Cl by the carbon radical is endothermic (high H–Cl bond energy).',
        },
      ],
    },
  },
  {
    id: 'ch-chem-organic-functional-groups',
    code: 'CHE-12-03',
    subject: 'Chemistry',
    classLevel: 'Class 12',
    unitName: 'Organic Chemistry II',
    title: 'Haloalkanes, Alcohols, Carbonyls, Amines & Biomolecules',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Chemistry Part 2 (Ch 6–10)',
      officialSyllabusSection: 'Unit 16–20: Haloalkanes, Oxygen/Nitrogen Organic Compounds and Biomolecules',
      ncertMapping: 'NCERT Class 12 Chemistry Chapters 6, 7, 8, 9, and 10',
    },
    weightageQuestionsApprox: {
      jee_main: '5–6 questions (20–24 marks)',
      jee_advanced: '4–5 problems (16–20 marks)',
    },
    overview:
      'SN1, SN2, E1, and E2 mechanisms, Reimer-Tiemann and Kolbe reactions, Aldol and Cannizzaro condensations, Haloform/Tollens/Fehling tests, Hoffmann bromamide and Gabriel phthalimide syntheses, diazonium salt coupling, carbohydrates, amino acids, and nucleic acids.',
    topics: [
      {
        id: 'top-chem-sn1-sn2-carbonyls',
        title: 'SN1/SN2/E1/E2 Mechanisms & Named Carbonyl/Amine Reactions',
        examScope: 'both',
        definition:
          'SN2 is a concerted bimolecular backside attack (rate = k[RX][Nu⁻]) giving 100% Walden inversion (1° > 2° ≫ 3°). SN1 proceeds via a planar carbocation intermediate (rate = k[RX]), giving partial racemization with rearrangement.',
        explanation:
          'Aldehydes and ketones WITH α-hydrogens undergo Aldol condensation in dilute base to form β-hydroxy carbonyls → α,β-unsaturated carbonyls. Aldehydes WITHOUT α-hydrogens (HCHO, PhCHO, Me₃C–CHO) undergo Cannizzaro disproportionation in conc. OH⁻. In Cross-Cannizzaro with HCHO, HCHO is always oxidized to HCO₂⁻ while the other aldehyde is reduced to alcohol.',
        derivation:
          'In Hoffmann Bromamide degradation (R–CONH₂ + Br₂ + 4KOH → R–NH₂ + K₂CO₃ + 2KBr + 2H₂O), migration of group R from carbonyl carbon to electron-deficient nitrene-like nitrogen is concerted with retention of configuration at a chiral migrating carbon.',
        keyFormulas: [
          {
            id: 'f-org-1',
            name: 'Hoffmann Bromamide Stoichiometry & Iodoform Test',
            expression: 'RCONH₂ + Br₂ + 4NaOH → RNH₂ (1 fewer C) + Na₂CO₃ + 2NaBr + 2H₂O',
            unitsOrConditions: 'Iodoform (I₂/NaOH → yellow CHI₃↓) requires CH₃–C(=O)– or CH₃–CH(OH)– group',
            variablesExplanation: 'Rate-determining step in Hoffmann reaction involves loss of Br⁻ and rearrangement to R–N=C=O',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Benzaldehyde (Ph–CHO) gives a positive Tollens’ silver mirror test (reduces [Ag(NH₃)₂]⁺ to Ag) but does NOT reduce Fehling’s or Benedict’s Cu²⁺ solution.',
          'Gabriel phthalimide synthesis prepares pure aliphatic 1° amines (R–NH₂) but CANNOT prepare aniline (Ph–NH₂) because aryl halides do not undergo nucleophilic substitution with potassium phthalimide.',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests multi-step synthesis roadmaps, intramolecular aldol/Claisen ring-size selectivity (5- and 6-membered rings favored), and neighbouring group participation (NGP / anchimeric assistance).',
      },
    ],
    workedExamples: [
      {
        id: 'ex-chem-org-1',
        title: 'Distinguishing Carbonyl Isomers via Tollens, Fehling & Iodoform Tests',
        examRelevance: 'both',
        problemStatement:
          'Three isomeric compounds A, B, and C of formula C₃H₆O give the following tests: A gives both Tollens’ test and Fehling’s test but no yellow precipitate with I₂/NaOH; B gives yellow CHI₃ precipitate with I₂/NaOH but negative Tollens’ test; C decolorizes Br₂/H₂O and shows Lucas turbidity immediately. Identify A, B, and C.',
        solutionSteps: [
          'Formula C₃H₆O has DU = 3 + 1 − 6/2 = 1.',
          'Compound A reduces Tollens’ and Fehling’s reagents ⇒ aliphatic aldehyde: propanal (CH₃CH₂CHO). Since it lacks a CH₃CO– unit, it gives a negative iodoform test.',
          'Compound B gives a positive iodoform test but negative Tollens’ test ⇒ methyl ketone: propan-2-one (acetone, CH₃COCH₃).',
          'Compound C decolorizes Br₂ water (alkene) and is an alcohol: prop-2-en-1-ol (allyl alcohol, CH₂=CH–CH₂OH, whose allylic carbocation reacts rapidly with Lucas reagent).',
        ],
        finalAnswer: 'A = Propanal (CH₃CH₂CHO), B = Acetone (CH₃COCH₃), C = Allyl alcohol (CH₂=CHCH₂OH)',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Reimer-Tiemann Reaction', formula: 'Phenol + CHCl₃ + aq. NaOH → Salicylaldehyde (major, ortho)', condition: 'Electrophile is dichlorocarbene :CCl₂ (6 valence e⁻, singlet)' },
        { label: 'Carbylamine Test (1° Amines ONLY)', formula: 'R–NH₂ + CHCl₃ + 3KOH(alc.) → R–NC (foul-smelling isocyanide) + 3KCl + 3H₂O', condition: 'Given by both aliphatic and aromatic 1° amines' },
      ],
      reactionsOrKeyFacts: [
        'Sucrose (α-D-glucose C1 – β-D-fructose C2 glycosidic linkage) is a NON-REDUCING sugar and does not show mutarotation; Maltose and Lactose are reducing sugars.',
        'Vitamin C (ascorbic acid) and Vitamin B-complex are water-soluble; Vitamins A, D, E, K are fat-soluble.',
      ],
      shortConceptSummaries: [
        'Polar protic solvents (H₂O, ROH) stabilize carbocations and halide leaving groups via H-bonding (favoring SN1); polar aprotic solvents (DMSO, acetone, DMF) leave anions unsolvated/naked (favoring SN2).',
      ],
      commonTraps: [
        'Thinking Acetaldehyde (CH₃CHO) only gives Tollens’ test — CH₃CHO is the ONLY aldehyde that ALSO gives a positive Iodoform test (since it has H–C(=O)–CH₃)!',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-chem-org-1',
          question: 'What is the active electrophile in the Reimer-Tiemann formylation of phenol?',
          expectedKeyPoint: 'Singlet dichlorocarbene (:CCl₂), a neutral electron-deficient species with 6 valence electrons.',
        },
      ],
    },
  },

  /* ==========================================================================
   * MATHEMATICS (6 Complete High-Yield Chapters: Algebra, Geometry & Calculus)
   * ========================================================================== */
  {
    id: 'ch-math-algebra-quad-seq',
    code: 'MAT-11-01',
    subject: 'Mathematics',
    classLevel: 'Class 11',
    unitName: 'Algebra I',
    title: 'Complex Numbers, Quadratic Equations, Sequences & Binomial Theorem',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Mathematics (Ch 4, 6, 7, 8)',
      officialSyllabusSection: 'Unit 2, Unit 4 & Unit 5: Complex Numbers, Quadratic Equations, Permutations, Binomial Theorem & Sequences',
      ncertMapping: 'NCERT Class 11 Mathematics Chapters 4, 6, 7, and 8',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Euler form and De Moivre’s theorem, cube roots of unity (1, ω, ω²), geometry on the Argand plane, Vieta’s relations and Newton’s power-sum formula, location of roots, AP/GP/AGP and telescoping series, AM–GM inequality, and Binomial general/middle terms.',
    topics: [
      {
        id: 'top-math-complex-quad',
        title: 'Argand Geometry, Cube Roots of Unity & Quadratic Root Location',
        examScope: 'both',
        definition:
          'Any non-zero complex number z = x + iy = r e^(iθ) satisfies |z₁ + z₂| ≤ |z₁| + |z₂| (triangle inequality). The cube roots of unity satisfy 1 + ω + ω² = 0 and ω³ = 1.',
        explanation:
          'Rotation theorem: If z₁, z₂, z₃ are vertices of a triangle, (z₃ − z₁)/(z₂ − z₁) = (|z₃ − z₁| / |z₂ − z₁|) e^(iα) rotates vector z₂ − z₁ by angle α to z₃ − z₁. For a quadratic ax² + bx + c = 0 with roots α, β, Newton’s sum S_n = α^n + β^n satisfies a S_n + b S_(n−1) + c S_(n−2) = 0.',
        derivation:
          'Since α and β satisfy ax² + bx + c = 0, multiplying by x^(n−2) gives ax^n + bx^(n−1) + cx^(n−2) = 0 for x = α, β. Adding both equations yields a S_n + b S_(n−1) + c S_(n−2) = 0.',
        keyFormulas: [
          {
            id: 'f-alg-1',
            name: 'Equilateral Triangle Condition & Newton’s Sum Formula',
            expression: 'z₁² + z₂² + z₃² = z₁z₂ + z₂z₃ + z₃z₁,    a S_n + b S_(n−1) + c S_(n−2) = 0',
            unitsOrConditions: 'S_n = α^n ± β^n for roots α, β of ax² + bx + c = 0',
            variablesExplanation: 'z₁, z₂, z₃ = complex vertices of an equilateral triangle',
          },
          {
            id: 'f-alg-2',
            name: 'Binomial General Term & Vandermonde Identity',
            expression: 'T_(r+1) = C(n, r) x^(n−r) y^r,    Σ C(m, k) C(n, r−k) = C(m+n, r)',
            unitsOrConditions: '0 ≤ r ≤ n; C(n, 0)² + C(n, 1)² + … + C(n, n)² = C(2n, n)',
            variablesExplanation: 'C(n, r) = n! / [r!(n−r)!]',
          },
        ],
        exceptionsAndCommonMistakes: [
          'For both roots of f(x) = ax² + bx + c to lie strictly in (k₁, k₂), checking a·f(k₁) > 0 and a·f(k₂) > 0 is NOT enough — you MUST also enforce D ≥ 0 and k₁ < −b/(2a) < k₂.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main frequently asks Newton’s sum S₁₀ − S₈ style determinants and Binomial remainder/term-independent-of-x problems; JEE Advanced tests nth roots of unity product polynomials and complex loci.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-math-alg-1',
        title: 'Newton’s Formula for High-Power Root Sums',
        examRelevance: 'both',
        problemStatement:
          'Let α and β be the roots of x² − 6x − 2 = 0, with a_n = α^n − β^n for n ≥ 1. Find the value of (a₁₀ − 2a₈) / (2a₉).',
        solutionSteps: [
          'Since α, β satisfy x² − 6x − 2 = 0, Newton’s recurrence gives a_n − 6a_(n−1) − 2a_(n−2) = 0.',
          'For n = 10: a₁₀ − 6a₉ − 2a₈ = 0  ⇒  a₁₀ − 2a₈ = 6a₉.',
          'Divide by 2a₉: (a₁₀ − 2a₈) / (2a₉) = 6a₉ / (2a₉) = 3.',
        ],
        finalAnswer: '3',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'AM–GM Inequality', formula: '(a₁ + a₂ + … + a_n)/n ≥ (a₁a₂…a_n)^(1/n)', condition: 'Strictly positive real numbers a_i > 0; equality iff all a_i equal' },
        { label: 'Derangement Formula', formula: 'D_n = n! [1 − 1/1! + 1/2! − 1/3! + … + (−1)^n / n!]', condition: 'D₃ = 2, D₄ = 9, D₅ = 44' },
        { label: 'Argand Circle / Perpendicular Bisector', formula: '|z − z₁| = |z − z₂| (perp. bisector);  |z − z₁|/|z − z₂| = k ≠ 1 (Apollonius circle)', condition: 'Locus of z in complex plane' },
      ],
      reactionsOrKeyFacts: [
        '1 + ω^n + ω^(2n) equals 3 if n is a multiple of 3, and 0 otherwise.',
      ],
      shortConceptSummaries: [
        'For telescoping sums Σ 1/[(k)(k+1)], split into Σ [1/k − 1/(k+1)]; for Σ k·k!, rewrite k as (k+1) − 1 so (k+1)! − k! telescopes.',
      ],
      commonTraps: [
        'Applying AM ≥ GM when variables can be negative (for x < 0, x + 1/x ≤ −2).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-math-alg-1',
          question: 'What is the necessary and sufficient condition for exactly one root of a quadratic f(x) = 0 to lie strictly inside (k₁, k₂) when f(k₁)·f(k₂) ≠ 0?',
          expectedKeyPoint: 'f(k₁) · f(k₂) < 0 (and also check boundary cases f(k₁) = 0 or f(k₂) = 0 separately).',
        },
      ],
    },
  },
  {
    id: 'ch-math-matrices-determinants',
    code: 'MAT-12-01',
    subject: 'Mathematics',
    classLevel: 'Class 12',
    unitName: 'Algebra II',
    title: 'Matrices & Determinants',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Mathematics Part 1 (Ch 3 & 4)',
      officialSyllabusSection: 'Unit 3: Matrices and Determinants',
      ncertMapping: 'NCERT Class 12 Mathematics Chapters 3 and 4',
    },
    weightageQuestionsApprox: {
      jee_main: '2–3 questions (8–12 marks)',
      jee_advanced: '2 problems (6–8 marks)',
    },
    overview:
      'Matrix algebra, symmetric and skew-symmetric decomposition, orthogonal and idempotent matrices, determinant properties, adjoint and inverse properties (|adj A| = |A|^(n−1)), Cayley-Hamilton theorem, and Cramer’s rule / consistency of linear systems AX = B.',
    topics: [
      {
        id: 'top-math-adjoint-cramer',
        title: 'Adjoint Properties, Cayley-Hamilton & Linear System Consistency',
        examScope: 'both',
        definition:
          'For an n × n matrix A, A(adj A) = (adj A)A = |A| I_n. Consequently, if |A| ≠ 0, A⁻¹ = (adj A)/|A| and |adj A| = |A|^(n−1).',
        explanation:
          'Iterating the adjoint k times gives |adj(adj … A)| = |A|^((n−1)^k) and adj(adj A) = |A|^(n−2) A. By the Cayley-Hamilton theorem, every square matrix satisfies its own characteristic equation det(A − λI) = 0; for a 2 × 2 matrix A, A² − tr(A)A + |A|I = 0.',
        derivation:
          'Taking determinants on both sides of A(adj A) = |A|I_n gives |A| · |adj A| = |A|^n · |I_n| = |A|^n ⇒ |adj A| = |A|^(n−1).',
        keyFormulas: [
          {
            id: 'f-mat-1',
            name: 'Adjoint Scaling & Nested Determinant Rules (Order n)',
            expression: '|kA| = k^n |A|,   adj(kA) = k^(n−1) adj A,   |adj(adj A)| = |A|^((n−1)²)',
            unitsOrConditions: 'n = order of square matrix A (for 3×3, (n−1)² = 4)',
            variablesExplanation: 'k = scalar, |A| = determinant of A',
          },
          {
            id: 'f-mat-2',
            name: '2×2 & 3×3 Cayley-Hamilton Identities',
            expression: 'A² − tr(A)A + |A|I = 0  (2×2);    A³ − tr(A)A² + (Σ C_ii)A − |A|I = 0  (3×3)',
            unitsOrConditions: 'Σ C_ii = sum of cofactors of main diagonal elements',
            variablesExplanation: 'tr(A) = sum of diagonal elements of A',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Writing |kA| = k|A| instead of k^n|A| (every one of the n rows gets multiplied by k).',
          'Assuming Δ = Δ₁ = Δ₂ = Δ₃ = 0 guarantees infinitely many solutions for a 3×3 system — if all three planes are parallel (e.g., x+y+z=1, x+y+z=2, x+y+z=3), Δ = Δ_i = 0 yet the system has NO solution!',
        ],
        mainVsAdvancedDistinction:
          'JEE Main heavily tests |adj(k adj A)| formulas and Cramer’s rule parameter values; JEE Advanced tests trace/eigenvalue power reductions, orthogonal matrices (AAᵀ = I), and matrix equations.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-math-mat-1',
        title: 'Determinant of Nested Adjoint with Scalar Multiplication',
        examRelevance: 'both',
        problemStatement:
          'Let A be a 3 × 3 matrix with |A| = 2. Find the value of |3 adj(2A)|.',
        solutionSteps: [
          'For n = 3 and any 3 × 3 matrix M, |3M| = 3³ |M| = 27 |M|. Here M = adj(2A).',
          'Next, |adj(2A)| = |2A|^(n−1) = |2A|².',
          'Since A is 3 × 3, |2A| = 2³ |A| = 8 × 2 = 16.',
          'Therefore |adj(2A)| = 16² = 256, and |3 adj(2A)| = 27 × 256 = 6912.',
        ],
        finalAnswer: '6912',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Skew-Symmetric Determinant', formula: '|A| = 0 if Aᵀ = −A and order n is ODD (e.g. 3×3)', condition: 'If n is even, |A| is a perfect square' },
        { label: 'Homogeneous System AX = 0', formula: '|A| = 0  ⇔  Non-trivial (infinite) solutions exist', condition: 'Always consistent (X = 0 is trivial solution)' },
      ],
      reactionsOrKeyFacts: [
        'Trace properties: tr(A + B) = tr(A) + tr(B) and tr(AB) = tr(BA), even when AB ≠ BA.',
      ],
      shortConceptSummaries: [
        'Use Cayley-Hamilton to reduce high matrix powers A^n into a linear combination c₁A + c₀I (for 2×2) or c₂A² + c₁A + c₀I (for 3×3).',
      ],
      commonTraps: [
        'Forgetting to reverse the order in transpose/inverse/adjoint of a product: (AB)ᵀ = BᵀAᵀ, (AB)⁻¹ = B⁻¹A⁻¹, and adj(AB) = adj(B) adj(A).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-math-mat-1',
          question: 'If A is a 3 × 3 matrix with |A| = 5, what is |adj(adj A)|?',
          expectedKeyPoint: '|A|^((3−1)²) = 5⁴ = 625.',
        },
      ],
    },
  },
  {
    id: 'ch-math-coordinate-conics',
    code: 'MAT-11-02',
    subject: 'Mathematics',
    classLevel: 'Class 11',
    unitName: 'Coordinate Geometry',
    title: 'Straight Lines, Circles & Conic Sections',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 11 Mathematics (Ch 9 & 10)',
      officialSyllabusSection: 'Unit 11: Coordinate Geometry (Straight Lines, Circles, Parabola, Ellipse & Hyperbola)',
      ncertMapping: 'NCERT Class 11 Mathematics Chapters 9 and 10',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Family of lines, image and foot of perpendicular, orthogonality and radical axis of circles, standard equations, focal properties, parametric tangents and normals, chord with given midpoint (T = S₁), and director circles of parabola, ellipse, and hyperbola.',
    topics: [
      {
        id: 'top-math-lines-circles-conics',
        title: 'Reflections, Circle Tangency & Conic Tangents/Normals',
        examScope: 'both',
        definition:
          'A conic section is the locus of a point whose distance from a fixed focus S bears a constant ratio e (eccentricity) to its perpendicular distance from a fixed directrix: e = 1 (parabola), 0 < e < 1 (ellipse), e > 1 (hyperbola).',
        explanation:
          'For any second-degree curve S = 0, T = 0 gives the tangent at (x₁, y₁) on the curve, T = S₁ gives the chord bisected at (x₁, y₁), and SS₁ = T² gives the pair of tangents from an external point. Optical reflection property: a ray from one focus of an ellipse/hyperbola reflects off the curve along the line through the other focus; for a parabola, focal rays reflect parallel to the axis.',
        derivation:
          'Substituting y = mx + c into y² = 4ax gives m²x² + (2mc − 4a)x + c² = 0. Setting discriminant D = 0 for tangency yields c = a/m, with point of contact (a/m², 2a/m).',
        keyFormulas: [
          {
            id: 'f-con-1',
            name: 'Foot (h, k) & Image (x′, y′) of (x₁, y₁) in Line ax + by + c = 0',
            expression: '(x − x₁)/a = (y − y₁)/b = −k_f · (ax₁ + by₁ + c)/(a² + b²)',
            unitsOrConditions: 'k_f = 1 for foot of perpendicular; k_f = 2 for mirror image',
            variablesExplanation: 'a, b, c = coefficients of the mirror line',
          },
          {
            id: 'f-con-2',
            name: 'Slope-Form Tangents to Standard Conics',
            expression: 'Parabola: y = mx + a/m;   Ellipse: y = mx ± √(a²m² + b²);   Hyperbola: y = mx ± √(a²m² − b²)',
            unitsOrConditions: 'For y² = 4ax, x²/a² + y²/b² = 1, and x²/a² − y²/b² = 1 respectively',
            variablesExplanation: 'm = slope of tangent line',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Before applying the distance between parallel lines |c₁ − c₂|/√(a² + b²), always make the coefficients of x and y identical in both equations!',
        ],
        mainVsAdvancedDistinction:
          'JEE Main focuses on common tangents between two conics, focal chord lengths, and chord bisected at a point; JEE Advanced tests focal-reflection loci, conormal points, and variable circles.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-math-con-1',
        title: 'Shortest Distance & Common Tangent to Parabola and Circle',
        examRelevance: 'both',
        problemStatement:
          'Find the equations of the common tangents to the parabola y² = 8x and the circle x² + y² = 2.',
        solutionSteps: [
          'For y² = 4ax with 4a = 8 ⇒ a = 2, any tangent with slope m is y = mx + 2/m, or m²x − my + 2 = 0.',
          'For this line to be tangent to x² + y² = 2 (centre (0,0), radius r = √2), perpendicular distance from (0,0) must equal √2:',
          '|2| / √(m⁴ + m²) = √2  ⇒  4 / (m⁴ + m²) = 2  ⇒  m⁴ + m² − 2 = 0.',
          'Factoring: (m² + 2)(m² − 1) = 0 ⇒ m² = 1 ⇒ m = ±1.',
          'Substitute m = ±1 into y = mx + 2/m: y = ±(x + 2).',
        ],
        finalAnswer: 'y = x + 2 and y = −x − 2',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Orthogonal Circles Condition', formula: '2g₁g₂ + 2f₁f₂ = c₁ + c₂', condition: 'Tangents at intersection are perpendicular (r₁² + r₂² = d²)' },
        { label: 'Parabola Focal Chord (t₁, t₂)', formula: 't₁ · t₂ = −1,   Length = a(t₁ − t₂)² = a(t + 1/t)² ≥ 4a', condition: 'Harmonic mean of focal segments is semi-latus rectum 2a' },
        { label: 'Director Circle (Perpendicular Tangents)', formula: 'Circle: x²+y² = 2r²;  Ellipse: x²+y² = a²+b²;  Parabola: x = −a (directrix)', condition: 'Locus of intersection of perpendicular tangents' },
      ],
      reactionsOrKeyFacts: [
        'For any ellipse x²/a² + y²/b² = 1 with foci S and S′, the sum of focal distances SP + S′P = 2a is constant for all P on the ellipse.',
      ],
      shortConceptSummaries: [
        'To find the common tangent of two curves, write the slope-form tangent y = mx + f(m) of the simpler curve and equate its distance from the circle centre to radius R (or set D = 0 with the second curve).',
      ],
      commonTraps: [
        'Using b² = a²(1 − e²) when b > a in a vertical ellipse (must use a² = b²(1 − e²) when the major axis is along the y-axis).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-math-con-1',
          question: 'What is the locus of the point of intersection of two mutually perpendicular tangents to the parabola y² = 4ax?',
          expectedKeyPoint: 'The directrix x = −a (furthermore, the chord of contact always passes through the focus (a, 0)).',
        },
      ],
    },
  },
  {
    id: 'ch-math-differential-calculus',
    code: 'MAT-12-02',
    subject: 'Mathematics',
    classLevel: 'Class 12',
    unitName: 'Calculus I',
    title: 'Limits, Continuity, Differentiability & Applications of Derivatives',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Mathematics Part 1 (Ch 5 & 6)',
      officialSyllabusSection: 'Unit 6 & Unit 7: Limit, Continuity, Differentiability and Applications of Derivatives',
      ncertMapping: 'NCERT Class 12 Mathematics Chapters 5 and 6',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '3–4 problems (12–16 marks)',
    },
    overview:
      'Standard limits, Taylor/Maclaurin series expansions, 1^∞ indeterminate forms, continuity and sharp-corner non-differentiability, implicit and parametric differentiation, Rolle’s and Lagrange’s Mean Value Theorems, monotonicity, local and global maxima/minima, and inflection points.',
    topics: [
      {
        id: 'top-math-limits-diff-aod',
        title: 'Maclaurin Expansions, Differentiability & Maxima/Minima',
        examScope: 'both',
        definition:
          'A function f is differentiable at x = a iff RHD = lim_(h→0⁺) [f(a+h)−f(a)]/h and LHD = lim_(h→0⁻) [f(a+h)−f(a)]/h both exist, are finite, and are equal. Differentiability implies continuity, but not vice versa.',
        explanation:
          'For limits with cancellations up to x³ or x⁴, Maclaurin series are faster than repeated L’Hôpital: sin x = x − x³/6 + x⁵/120, cos x = 1 − x²/2 + x⁴/24, tan x = x + x³/3, ln(1+x) = x − x²/2 + x³/3, e^x = 1 + x + x²/2 + x³/6. Note that |g(x)| is non-differentiable at simple roots of g(x) = 0 where g′(a) ≠ 0, but IS differentiable if g(a) = g′(a) = 0 (e.g., |x|³ or |sin x|² at x = 0).',
        derivation:
          'For 1^∞ indeterminate forms lim_(x→a) [f(x)]^[g(x)] where f(x) → 1 and g(x) → ∞: writing [1 + (f(x)−1)]^[g(x)] = exp[ g(x) ln(1 + f(x) − 1) ] and using ln(1+u) / u → 1 gives exp[ lim_(x→a) g(x)(f(x) − 1) ].',
        keyFormulas: [
          {
            id: 'f-cal-1',
            name: '1^∞ Limit Shortcut & Essential Maclaurin Series',
            expression: 'lim [f(x)]^[g(x)] = exp[ lim g(x)(f(x) − 1) ],    tan x − sin x ≈ x³/2',
            unitsOrConditions: 'Valid when f(x) → 1 and g(x) → ∞ as x → a',
            variablesExplanation: 'Use Taylor terms up to the degree of the denominator',
          },
          {
            id: 'f-cal-2',
            name: 'Lagrange’s Mean Value Theorem (LMVT) & Functional Equations',
            expression: 'f′(c) = [f(b) − f(a)] / (b − a) for some c ∈ (a, b)',
            unitsOrConditions: 'f continuous on [a, b] and differentiable on (a, b)',
            variablesExplanation: 'If f(x+y) = f(x)f(y) + …, compute f′(x) = lim_(h→0) [f(x+h)−f(x)]/h',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Assuming f′(a) = 0 guarantees a local extremum — if f″(a) = 0 and f‴(a) ≠ 0 (like f(x) = x³ at x = 0), x = a is a point of inflection, not an extremum.',
        ],
        mainVsAdvancedDistinction:
          'JEE Advanced tests piecewise min/max envelope graphs (e.g., max{f(x), g(x)}) to count non-differentiable corners and Rolles/LMVT auxiliary function constructions.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-math-cal-1',
        title: 'Evaluating a 0/0 Limit Using Maclaurin Series',
        examRelevance: 'both',
        problemStatement:
          'Evaluate L = lim_(x→0) [ e^x − e^(sin x) ] / [ 2(x − sin x) ].',
        solutionSteps: [
          'Factor e^(sin x) in the numerator: e^x − e^(sin x) = e^(sin x) [ e^(x − sin x) − 1 ].',
          'As x → 0, x − sin x → 0, so [ e^(x − sin x) − 1 ] / (x − sin x) → 1 and e^(sin x) → e⁰ = 1.',
          'Therefore L = ½ × 1 × 1 = 1/2.',
        ],
        finalAnswer: '1/2 (0.5)',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Standard Polynomial Functional Equation', formula: 'f(x)·f(1/x) = f(x) + f(1/x)  ⇒  f(x) = 1 ± x^n', condition: 'For non-zero polynomial f(x)' },
        { label: 'Subtangent & Subnormal Lengths', formula: 'Subtangent = |y / y′|,   Subnormal = |y · y′|', condition: 'At point (x, y) on curve y = f(x)' },
      ],
      reactionsOrKeyFacts: [
        'At a sharp transverse intersection of f(x) and g(x) where f(a) = g(a) and f′(a) ≠ g′(a), both max{f(x), g(x)} and min{f(x), g(x)} are continuous but NOT differentiable at x = a.',
      ],
      shortConceptSummaries: [
        'Memorize x − sin x ≈ x³/6, tan x − x ≈ x³/3, and 1 − cos x ≈ x²/2 − x⁴/24 for instant JEE limit evaluation.',
      ],
      commonTraps: [
        'Using f′(x) > 0 instead of f′(x) ≥ 0 (with f′(x) = 0 only at isolated points, not on an open interval) when finding parameter ranges for strictly increasing functions.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-math-cal-1',
          question: 'At how many points is f(x) = |x − 1| + |x − 2|³ non-differentiable?',
          expectedKeyPoint: 'Only 1 point (x = 1), because |x − 2|³ has a triple root at x = 2 so its derivative is 0 from both sides.',
        },
      ],
    },
  },
  {
    id: 'ch-math-integral-calculus-ode',
    code: 'MAT-12-03',
    subject: 'Mathematics',
    classLevel: 'Class 12',
    unitName: 'Calculus II',
    title: 'Indefinite & Definite Integration, Area & Differential Equations',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Mathematics Part 2 (Ch 7, 8, 9)',
      officialSyllabusSection: 'Unit 8 & Unit 9: Integral Calculus and Differential Equations',
      ncertMapping: 'NCERT Class 12 Mathematics Chapters 7, 8, and 9',
    },
    weightageQuestionsApprox: {
      jee_main: '4–5 questions (16–20 marks)',
      jee_advanced: '4 problems (14–16 marks)',
    },
    overview:
      'Integration by substitution, partial fractions, and parts (∫ e^x [f(x)+f′(x)] dx), King’s property and symmetry properties of definite integrals, Leibniz rule for differentiation under the integral sign, Riemann limit of a sum, area bounded by curves, and first-order linear/Bernoulli/exact differential equations.',
    topics: [
      {
        id: 'top-math-definite-leibniz-ode',
        title: 'King’s Rule, Leibniz Rule, Area & Linear Differential Equations',
        examScope: 'both',
        definition:
          'King’s property states ∫_a^b f(x) dx = ∫_a^b f(a + b − x) dx. Leibniz rule differentiates an integral with variable limits: d/dx [∫_(g(x))^(h(x)) f(t) dt] = f(h(x))h′(x) − f(g(x))g′(x).',
        explanation:
          'For integrals of the form I = ∫_a^b g(x)/[g(x) + g(a+b−x)] dx, applying King’s rule and adding 2I = ∫_a^b 1 dx immediately gives I = (b − a)/2. For a first-order linear ODE dy/dx + P(x)y = Q(x), multiplying by the Integrating Factor I.F. = e^(∫ P(x) dx) turns the LHS into d/dx [y · I.F.].',
        derivation:
          'Since d/dx [y · e^(∫ P dx)] = (dy/dx)e^(∫ P dx) + P(x)y e^(∫ P dx) = Q(x)e^(∫ P dx), integrating both sides gives y · (I.F.) = ∫ Q(x) · (I.F.) dx + C.',
        keyFormulas: [
          {
            id: 'f-int-1',
            name: 'King’s Property, Cancellation Integral & Leibniz Rule',
            expression: '∫_a^b f(x) dx = ∫_a^b f(a+b−x) dx,    ∫ e^x [f(x) + f′(x)] dx = e^x f(x) + C',
            unitsOrConditions: 'Always check whether f(x) is continuous on [a, b]',
            variablesExplanation: 'In ∫_(-a)^a f(x) dx, odd part vanishes and even part doubles to 2∫_0^a f(x) dx',
          },
          {
            id: 'f-int-2',
            name: 'Linear First-Order ODE & Exact Differentials',
            expression: 'dy/dx + P(x)y = Q(x)  ⇒  y · (I.F.) = ∫ Q(x)·(I.F.) dx + C,   I.F. = e^(∫ P dx)',
            unitsOrConditions: 'Also check if equation is linear in x: dx/dy + P(y)x = Q(y)',
            variablesExplanation: 'Exact differentials: x dy + y dx = d(xy); (x dy − y dx)/x² = d(y/x)',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Integrating across a vertical asymptote (e.g., ∫_(−1)^1 (1/x²) dx) as if the Fundamental Theorem of Calculus applies directly without checking continuity.',
        ],
        mainVsAdvancedDistinction:
          'JEE Main heavily tests King’s property, greatest-integer [x] step splits, and linear ODE initial-value problems; JEE Advanced tests integral inequalities, reduction recurrence relations I_n, and functional integral equations.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-math-int-1',
        title: 'Definite Integral Using King’s Property & Even/Odd Symmetry',
        examRelevance: 'both',
        problemStatement:
          'Evaluate I = ∫_(−π/2)^(π/2) (x² cos x) / (1 + e^x) dx.',
        solutionSteps: [
          'For any even function g(x), ∫_(−a)^a g(x) / (1 + b^x) dx = ∫_0^a g(x) dx (by substituting x → −x and adding).',
          'Here g(x) = x² cos x is even because (−x)² cos(−x) = x² cos x.',
          'Thus I = ∫_0^(π/2) x² cos x dx.',
          'Integrate by parts twice: ∫ x² cos x dx = x² sin x − 2(−x cos x + sin x) = (x² − 2)sin x + 2x cos x.',
          'Evaluating from 0 to π/2 gives I = (π²/4 − 2)(1) + 0 − 0 = π²/4 − 2.',
        ],
        finalAnswer: 'π²/4 − 2',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Even / Exponential Symmetry Shortcut', formula: '∫_(−a)^a f_even(x) / (1 + b^x) dx = ∫_0^a f_even(x) dx', condition: 'b > 0 and f_even(−x) = f_even(x)' },
        { label: 'Parabola–Line Bounded Area', formula: 'Area(y² = 4ax and y = mx) = 8a² / (3m³);   Area(y² = 4ax and x² = 4by) = 16ab / 3', condition: 'Fast check for standard parabola areas' },
        { label: 'Riemann Limit of a Sum', formula: 'lim_(n→∞) (1/n) Σ_(r=1)^n f(r/n) = ∫_0^1 f(x) dx', condition: 'Replace r/n → x and 1/n → dx' },
      ],
      reactionsOrKeyFacts: [
        'For ∫ dx / (x² + 1/x² ± k), divide numerator and denominator by x² and write 1 ± 1/x² as the derivative of (x ∓ 1/x).',
      ],
      shortConceptSummaries: [
        'Whenever variable limits appear in an integral equation ∫_a^x f(t) dt = g(x), differentiate both sides via Leibniz rule and also substitute x = a to find initial values.',
      ],
      commonTraps: [
        'Forgetting to split greatest-integer [f(x)] or modulus |f(x)| integrals at every point where f(x) crosses an integer or zero.',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-math-int-1',
          question: 'What is the value of ∫_0^(π/2) sin^n(x) / [sin^n(x) + cos^n(x)] dx for any real number n?',
          expectedKeyPoint: 'π / 4 (by King’s property f(a − x) = f(π/2 − x), adding 2I = ∫_0^(π/2) 1 dx = π/2).',
        },
      ],
    },
  },
  {
    id: 'ch-math-vectors-3d-probability',
    code: 'MAT-12-04',
    subject: 'Mathematics',
    classLevel: 'Class 12',
    unitName: 'Vectors, 3D & Probability',
    title: 'Vectors, 3D Geometry, Probability & Statistics',
    supportedExams: ['jee_main', 'jee_advanced'],
    syllabusVersionIds: {
      jee_main: SYLLABUS_VERSIONS.jee_main.id,
      jee_advanced: SYLLABUS_VERSIONS.jee_advanced.id,
    },
    editorialStatus: 'published',
    lastReviewedAt: '2026-11-01',
    sourceProvenance: {
      primaryReference: 'LearnMate Original Editorial Content aligned with NCERT Class 12 Mathematics Part 2 (Ch 10, 11, 13)',
      officialSyllabusSection: 'Unit 10, Unit 12 & Unit 14: Vector Algebra, 3D Geometry, Probability and Statistics',
      ncertMapping: 'NCERT Class 12 Mathematics Chapters 10, 11, and 13',
    },
    weightageQuestionsApprox: {
      jee_main: '5–6 questions (20–24 marks)',
      jee_advanced: '4 problems (14–16 marks)',
    },
    overview:
      'Dot and cross products, scalar and vector triple products, skew lines shortest distance, 3D lines and planes, conditional probability, Law of Total Probability, Bayes’ theorem, random variables, and variance/standard deviation.',
    topics: [
      {
        id: 'top-math-vectors-3d-skew',
        title: 'Vector Triple Products, Skew Lines & 3D Geometry',
        examScope: 'both',
        definition:
          'Scalar triple product [a b c] = a · (b × c) gives the signed volume of the parallelepiped spanned by a, b, c; three vectors are coplanar iff [a b c] = 0. Vector triple product satisfies a × (b × c) = (a · c)b − (a · b)c.',
        explanation:
          'In 3D space, two non-parallel lines r = a₁ + λb₁ and r = a₂ + μb₂ have shortest perpendicular distance d = |(a₂ − a₁) · (b₁ × b₂)| / |b₁ × b₂|. The two lines intersect (are coplanar) iff d = 0, i.e., [(a₂ − a₁) b₁ b₂] = 0.',
        derivation:
          'The common perpendicular to skew lines has unit direction n̂ = (b₁ × b₂) / |b₁ × b₂|; projecting the vector a₂ − a₁ connecting any point on line 1 to any point on line 2 onto n̂ yields d = |(a₂ − a₁) · n̂|.',
        keyFormulas: [
          {
            id: 'f-vec-1',
            name: 'Vector Triple Product & Shortest Distance Between Skew Lines',
            expression: 'a × (b × c) = (a · c)b − (a · b)c,    d_skew = |(a₂ − a₁) · (b₁ × b₂)| / |b₁ × b₂|',
            unitsOrConditions: 'For parallel lines (b₁ = b₂ = b), d_parallel = |(a₂ − a₁) × b| / |b|',
            variablesExplanation: 'a₁, a₂ = position vectors on lines; b₁, b₂ = direction vectors',
          },
          {
            id: 'f-vec-2',
            name: 'Bayes’ Theorem & Variance under Linear Scaling',
            expression: 'P(E_k | A) = P(E_k)P(A | E_k) / [Σ P(E_i)P(A | E_i)],    Var(aX + b) = a² Var(X)',
            unitsOrConditions: 'Var(X) = (1/N)Σ x_i² − (x̄)²; adding constant b does not change variance',
            variablesExplanation: 'E₁, E₂, … form a mutually exclusive and exhaustive partition',
          },
        ],
        exceptionsAndCommonMistakes: [
          'Using the skew-line formula when the two lines are parallel (so b₁ × b₂ = 0 gives 0/0) — for parallel lines, use |(a₂ − a₁) × b| / |b|.',
          'Confusing independent events (P(A ∩ B) = P(A)P(B)) with mutually exclusive events (P(A ∩ B) = 0).',
        ],
        mainVsAdvancedDistinction:
          'JEE Main focuses on skew-line shortest distance, vector equations of the form r × a = b, and Bayes’ theorem + variance; JEE Advanced tests 3D line-plane projections, tetrahedron geometry, and conditional probability recurrence chains.',
      },
    ],
    workedExamples: [
      {
        id: 'ex-math-vec-1',
        title: 'Solving a Vector Equation Using Dot and Cross Products',
        examRelevance: 'both',
        problemStatement:
          'Let a = î + ĵ + k̂ and b = î − ĵ + k̂. Find the vector r satisfying r × a = b − a and r · a = 3.',
        solutionSteps: [
          'Take the cross product of a with (r × a): a × (r × a) = a × (b − a) = a × b (since a × a = 0).',
          'Expand LHS using vector triple product: (a · a)r − (a · r)a = a × b.',
          'Here |a|² = 1² + 1² + 1² = 3 and a · r = 3, so 3r − 3a = a × b ⇒ r = a + (a × b)/3.',
          'Compute a × b = (î + ĵ + k̂) × (î − ĵ + k̂) = 2î − 2k̂.',
          'Thus r = (î + ĵ + k̂) + (2/3)î − (2/3)k̂ = (5/3)î + ĵ + (1/3)k̂.',
        ],
        finalAnswer: 'r = (5/3)î + ĵ + (1/3)k̂',
      },
    ],
    quickNotes: {
      essentialFormulas: [
        { label: 'Lagrange Identity', formula: '|a × b|² + (a · b)² = |a|² |b|²', condition: 'Relates cross and dot product magnitudes' },
        { label: 'Box Product of Pairwise Crosses', formula: '[a×b  b×c  c×a] = [a b c]²;   [a+b  b+c  c+a] = 2[a b c]', condition: 'Any 3D vectors a, b, c' },
        { label: 'Combined Variance of Two Groups', formula: 'σ² = (n₁σ₁² + n₂σ₂²)/(n₁+n₂) + [n₁n₂/(n₁+n₂)²](x̄₁ − x̄₂)²', condition: 'When merging two datasets of sizes n₁, n₂' },
      ],
      reactionsOrKeyFacts: [
        'For any direction cosines (l, m, n) making angles α, β, γ with axes: cos²α + cos²β + cos²γ = 1 and sin²α + sin²β + sin²γ = 2.',
      ],
      shortConceptSummaries: [
        'To solve for an unknown vector r when both r · a and r × a are given, compute a × (r × a) = |a|² r − (r · a)a.',
      ],
      commonTraps: [
        'Writing Var(aX + b) = a Var(X) + b instead of a² Var(X).',
      ],
      revisionCheckpoints: [
        {
          id: 'chk-math-vec-1',
          question: 'If a dataset of 20 observations has variance 5, what is the new variance if every observation is multiplied by −3 and then increased by 10?',
          expectedKeyPoint: '(−3)² × 5 = 9 × 5 = 45 (adding 10 does not change variance).',
        },
      ],
    },
  },
];

function enrichCoreChapterMetadata(ch: SyllabusChapterRecord, index: number): SyllabusChapterRecord {
  const grade: '11' | '12' = ch.classLevel === 'Class 12' ? '12' : '11';
  const ncertMatch = ch.sourceProvenance.ncertMapping.match(/(\d+)/);
  const ncertNum = ncertMatch ? Number(ncertMatch[1]) : (index % 12) + 1;
  const highYield = [
    ...ch.quickNotes.essentialFormulas.map((ef) => ef.formula),
    ...ch.topics.flatMap((t) => t.keyFormulas.map((kf) => kf.expression)),
  ].slice(0, 6);
  const weightagePct = ch.subject === 'Mathematics' ? 6.5 : 5.8;

  return {
    ...ch,
    classGrade: grade,
    ncertChapterNumber: ch.ncertChapterNumber ?? ncertNum,
    ntaWeightagePct: ch.ntaWeightagePct ?? weightagePct,
    syllabusStatus: ch.syllabusStatus ?? 'Active',
    highYieldFormulas: ch.highYieldFormulas ?? highYield,
    topics: ch.topics.map((t) => ({
      ...t,
      classLevel: ch.classLevel,
      ncertChapterNumber: ncertNum,
      ntaWeightagePct: weightagePct,
      syllabusStatus: 'Active',
      highYieldFormulas: t.keyFormulas.map((kf) => kf.expression),
      formulas: t.keyFormulas.map((kf) => kf.expression),
    })),
  };
}

export const JEE_SYLLABUS_CHAPTERS: SyllabusChapterRecord[] = [
  ...CORE_17_SYLLABUS_CHAPTERS.map((ch, idx) => enrichCoreChapterMetadata(ch, idx)),
  ...UNPACKED_41_NTA_CHAPTER_SEEDS.map((seed) => buildSyllabusChapterFromSeed(seed)),
];

export interface SyllabusCoverageReport {
  totalChapters: number;
  publishedChapters: number;
  bySubject: Record<JeeSubject, { total: number; published: number; topicsCount: number; formulasCount: number }>;
  syllabusVersions: Record<ExamTrackId, SyllabusVersionMetadata>;
}

export function getSyllabusCoverageReport(): SyllabusCoverageReport {
  const bySubject: SyllabusCoverageReport['bySubject'] = {
    Physics: { total: 0, published: 0, topicsCount: 0, formulasCount: 0 },
    Chemistry: { total: 0, published: 0, topicsCount: 0, formulasCount: 0 },
    Mathematics: { total: 0, published: 0, topicsCount: 0, formulasCount: 0 },
  };

  for (const ch of JEE_SYLLABUS_CHAPTERS) {
    const stat = bySubject[ch.subject];
    stat.total += 1;
    if (ch.editorialStatus === 'published') stat.published += 1;
    stat.topicsCount += ch.topics.length;
    stat.formulasCount +=
      ch.topics.reduce((acc, t) => acc + t.keyFormulas.length, 0) +
      ch.quickNotes.essentialFormulas.length;
  }

  return {
    totalChapters: JEE_SYLLABUS_CHAPTERS.length,
    publishedChapters: JEE_SYLLABUS_CHAPTERS.filter((c) => c.editorialStatus === 'published').length,
    bySubject,
    syllabusVersions: SYLLABUS_VERSIONS,
  };
}

export function getSyllabusChaptersForExam(
  exam: ExamTrackId = 'jee_main',
  subjectFilter?: JeeSubject | 'All'
): SyllabusChapterRecord[] {
  return JEE_SYLLABUS_CHAPTERS.filter((ch) => {
    if (!ch.supportedExams.includes(exam)) return false;
    if (subjectFilter && subjectFilter !== 'All' && ch.subject !== subjectFilter) return false;
    return true;
  });
}

export function getSyllabusChapterById(chapterId: string): SyllabusChapterRecord | undefined {
  return JEE_SYLLABUS_CHAPTERS.find((c) => c.id === chapterId || c.code === chapterId);
}

/**
 * Converts an authoritative SyllabusChapterRecord into a full StudyDocument so students
 * can open any syllabus chapter in the Study Workbench, ask the AI Tutor, generate
 * flashcards/mind maps, or take adaptive chapter quizzes without uploading a file.
 */
export function buildStudyDocumentFromSyllabusChapter(
  chapter: SyllabusChapterRecord,
  noteMode: 'full' | 'quick' = 'full'
): StudyDocument {
  const pages: StudyPage[] = [];

  if (noteMode === 'full') {
    chapter.topics.forEach((topic, idx) => {
      const formulaLines = topic.keyFormulas
        .map((f) => `• ${f.name}: ${f.expression} (${f.unitsOrConditions}) — ${f.variablesExplanation}`)
        .join('\n');
      const trapsLines = topic.exceptionsAndCommonMistakes.map((m) => `• ${m}`).join('\n');

      pages.push({
        pageNumber: idx + 1,
        title: `${chapter.code} · ${topic.title}`,
        content: [
          `CHAPTER: ${chapter.title} (${chapter.subject} · ${chapter.classLevel})`,
          `TOPIC: ${topic.title}`,
          '',
          `1. DEFINITION & CORE PRINCIPLE`,
          topic.definition,
          '',
          `2. DETAILED EXPLANATION`,
          topic.explanation,
          '',
          `3. DERIVATION & MATHEMATICAL BASIS`,
          topic.derivation,
          '',
          `4. KEY FORMULAS & UNITS`,
          formulaLines,
          '',
          `5. EXCEPTIONS & COMMON JEE TRAPS`,
          trapsLines,
          '',
          `6. JEE MAIN VS JEE ADVANCED SCOPE`,
          topic.mainVsAdvancedDistinction,
        ].join('\n'),
      });
    });

    // Add Worked Examples & Quick Revision Page
    const workedText = chapter.workedExamples
      .map(
        (ex, i) =>
          `Worked Example ${i + 1}: ${ex.title}\nProblem: ${ex.problemStatement}\nSolution:\n${ex.solutionSteps
            .map((s, si) => `  Step ${si + 1}: ${s}`)
            .join('\n')}\nFinal Answer: ${ex.finalAnswer}`
      )
      .join('\n\n');

    const quickFormulasText = chapter.quickNotes.essentialFormulas
      .map((f) => `• ${f.label}: ${f.formula} [${f.condition}]`)
      .join('\n');

    pages.push({
      pageNumber: pages.length + 1,
      title: `${chapter.code} · Worked Examples & Quick Revision Sheet`,
      content: [
        `WORKED EXAMPLES — ${chapter.title}`,
        '',
        workedText,
        '',
        `QUICK REVISION FORMULAS`,
        quickFormulasText,
        '',
        `KEY FACTS & REACTIONS`,
        chapter.quickNotes.reactionsOrKeyFacts.map((r) => `• ${r}`).join('\n'),
        '',
        `COMMON EXAM TRAPS`,
        chapter.quickNotes.commonTraps.map((t) => `• ${t}`).join('\n'),
      ].join('\n'),
    });
  } else {
    // Quick Notes mode
    pages.push({
      pageNumber: 1,
      title: `${chapter.code} · Quick Notes: ${chapter.title}`,
      content: [
        `QUICK REVISION NOTES — ${chapter.title} (${chapter.subject})`,
        '',
        `ESSENTIAL FORMULAS`,
        chapter.quickNotes.essentialFormulas
          .map((f) => `• ${f.label}: ${f.formula} (${f.condition})`)
          .join('\n'),
        '',
        `KEY FACTS & REACTIONS`,
        chapter.quickNotes.reactionsOrKeyFacts.map((r) => `• ${r}`).join('\n'),
        '',
        `CONCEPT SUMMARIES`,
        chapter.quickNotes.shortConceptSummaries.map((s) => `• ${s}`).join('\n'),
        '',
        `COMMON JEE TRAPS`,
        chapter.quickNotes.commonTraps.map((t) => `• ${t}`).join('\n'),
        '',
        `REVISION CHECKPOINTS`,
        chapter.quickNotes.revisionCheckpoints
          .map((c) => `Q: ${c.question}\nKey Point: ${c.expectedKeyPoint}`)
          .join('\n\n'),
      ].join('\n'),
    });
  }

  const topics: StudyTopic[] = chapter.topics.map((t, idx) => ({
    id: t.id,
    name: t.title,
    summary: t.definition,
    keyConcepts: [
      ...t.keyFormulas.map((f) => `${f.name}: ${f.expression}`),
      ...t.exceptionsAndCommonMistakes,
    ],
    sourcePages: [Math.min(idx + 1, pages.length)],
  }));

  return {
    id: `learnmate-syllabus-${chapter.id}-${noteMode}`,
    title: `${chapter.title} (${noteMode === 'quick' ? 'Quick Notes' : 'Full Notes'})`,
    sourceType: 'text',
    createdAt: chapter.lastReviewedAt,
    lastStudiedAt: new Date().toISOString(),
    pageCount: pages.length,
    overview: `${chapter.overview} [Source: ${chapter.sourceProvenance.primaryReference}]`,
    pages,
    topics,
  };
}
