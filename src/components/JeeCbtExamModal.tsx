import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Delete,
  Download,
  Flag,
  HelpCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { MathText } from './MathText';
import { ReportButton } from './ReportButton';
import { StudentAcademicProfile } from '../types/study';
import {
  PyqCorpusQuestion,
  scorePyqQuestionResponse,
  MARKING_RULES,
  resolveMarkingRule,
  predictShiftPercentileAndAir,
  computeTimeVsAccuracyQuadrants,
  type ShiftDifficultyCurve,
  type MatrixMatchRowItem,
  type MatrixMatchColItem,
} from '../utils/pyqCorpusEngine';
import { awardLearningXp } from '../utils/rewardsEngine';
import {
  extractMistakesFromCbtAttempt,
  type MistakeBookEntry,
} from '../utils/mistakeBookEngine';
import { MistakeBookAndImprovementModal } from './MistakeBookAndImprovementModal';

export type JeeSubject = 'Physics' | 'Chemistry' | 'Mathematics';
export type JeeQuestionSection = 'Section A' | 'Section B';
export type JeeQuestionFormat =
  | 'mcq_single'
  | 'mcq_multiple'
  | 'numerical'
  | 'paragraph_comprehension'
  | 'matrix_match';

/**
 * Official NTA JEE Main 5-State Question Palette Statuses:
 * 1. not_visited: Grey square
 * 2. not_answered: Red octagon/tag (Visited, no response saved)
 * 3. answered: Green tag (Response saved)
 * 4. marked_for_review: Purple circle (Visited, marked for review, no response)
 * 5. answered_and_marked: Purple circle with green check badge (Considered for evaluation!)
 */
export type NtaPaletteState =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_and_marked';

export interface JeeCbtQuestion {
  id: string;
  questionNumber: number; // 1 to N
  subject: JeeSubject;
  section: JeeQuestionSection;
  format: JeeQuestionFormat;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionText: string;
  options?: string[]; // 4 options for MCQ
  correctOptionIndex?: number; // 0..3 for single MCQ
  correctOptionIndices?: number[]; // for JEE Advanced multiple-correct
  correctNumericalValue?: number; // for Numerical Value
  numericalTolerance?: number; // e.g., 0.05
  passageTitle?: string;
  passageText?: string;
  linkedQuestionGroup?: string;
  matrixMatchList1?: MatrixMatchRowItem[];
  matrixMatchList2?: MatrixMatchColItem[];
  matrixMatch?: {
    list1Title?: string;
    list1Rows: MatrixMatchRowItem[];
    list2Title?: string;
    list2Cols: MatrixMatchColItem[];
  };
  correctMatrixMapping?: Record<'P' | 'Q' | 'R' | 'S', string>;
  solutionSteps: string;
  keyFormula: string;
  commonTrap: string;
  markingRuleId?: string;
}

export interface JeeQuestionResponse {
  questionId: string;
  status: NtaPaletteState;
  selectedOptionIndex: number | null;
  selectedOptionIndices?: number[];
  numericalInput: string;
  matrixMapping?: Record<string, string>;
  timeSpentSeconds: number;
}

export interface FocusIntegrityEvent {
  id: string;
  type: 'tab_hidden' | 'window_blur' | 'fullscreen_exit';
  label: string;
  timestamp: string;
}

export interface JeeSubjectScoreBreakdown {
  subject: JeeSubject;
  marksObtained: number;
  maxMarks: number;
  positiveMarks: number;
  negativeMarks: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  unattemptedCount: number;
  accuracyPct: number;
  timeSpentSeconds: number;
}

export interface JeeCbtExamResult {
  id: string;
  examTitle: string;
  examVariant: 'jee_main' | 'jee_advanced';
  completedAt: string;
  timeTakenSeconds: number;
  totalQuestions: number;
  marksObtained: number;
  maxMarks: number;
  positiveMarks: number;
  negativeMarks: number;
  correctCount: number;
  partialCount: number;
  wrongCount: number;
  unattemptedCount: number;
  accuracyPercentage: number; // Correct / Attempted * 100
  attemptRatePercentage: number; // Attempted / Total * 100
  subjectBreakdowns: Record<JeeSubject, JeeSubjectScoreBreakdown>;
  questionResponses: Record<string, JeeQuestionResponse>;
  questions?: JeeCbtQuestion[];
  weakTopics?: string[];
  strongTopics?: string[];
  integrityEvents: FocusIntegrityEvent[];
  strictModeUsed: boolean;
}

interface JeeCbtExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentProfile?: StudentAcademicProfile;
  examTitle?: string;
  sourceNoteTitle?: string;
  examVariant?: 'jee_main' | 'jee_advanced';
  officialPaperId?: string;
  customPyqQuestions?: PyqCorpusQuestion[];
  durationMinutes?: number;
  onSaveResult?: (result: JeeCbtExamResult) => void;
}

// ============================================================================
// AUTHENTIC 75-QUESTION NTA JEE MAIN 2027 PAPER GENERATOR
// 25 Physics (20 Sec A MCQ + 5 Sec B Numerical)
// 25 Chemistry (20 Sec A MCQ + 5 Sec B Numerical)
// 25 Mathematics (20 Sec A MCQ + 5 Sec B Numerical)
// ============================================================================

const PHYSICS_MCQ_BANK: Array<Omit<JeeCbtQuestion, 'id' | 'questionNumber' | 'subject' | 'section' | 'format'>> = [
  {
    topic: 'Kinematics & Projectile Motion',
    difficulty: 'Easy',
    questionText: 'A projectile is fired from horizontal ground with initial speed u = 40 m/s at an angle θ = 30° above the horizontal. Taking g = 10 m/s², what is the maximum height H reached by the projectile?',
    options: ['10 m', '20 m', '40 m', '80 m'],
    correctOptionIndex: 1,
    solutionSteps: 'Using H = (u² sin²θ) / (2g): sin 30° = 0.5, so H = (1600 × 0.25) / (2 × 10) = 400 / 20 = 20 m.',
    keyFormula: 'H = u² sin²θ / (2g)',
    commonTrap: 'Using sin 2θ instead of sin²θ (which belongs to Horizontal Range R).',
  },
  {
    topic: 'Laws of Motion & Friction',
    difficulty: 'Medium',
    questionText: 'Two blocks of masses m₁ = 4 kg and m₂ = 6 kg are connected by a light inextensible string passing over a frictionless pulley (Atwood machine). Taking g = 10 m/s², the tension T in the string is:',
    options: ['24 N', '40 N', '48 N', '52 N'],
    correctOptionIndex: 2,
    solutionSteps: 'For an ideal Atwood machine, T = (2 m₁ m₂ g) / (m₁ + m₂) = (2 × 4 × 6 × 10) / (4 + 6) = 480 / 10 = 48 N.',
    keyFormula: 'T = 2m₁m₂g / (m₁ + m₂)',
    commonTrap: 'Forgetting the factor of 2 in the numerator of the Atwood tension formula.',
  },
  {
    topic: 'Work, Energy & Power',
    difficulty: 'Medium',
    questionText: 'A particle moves along the x-axis from x = 0 to x = 4 m under a variable force F(x) = (3x² + 2x) N. The total work done by this force on the particle is:',
    options: ['64 J', '72 J', '80 J', '96 J'],
    correctOptionIndex: 2,
    solutionSteps: 'W = ∫₀⁴ (3x² + 2x) dx = [x³ + x²]₀⁴ = 4³ + 4² = 64 + 16 = 80 J.',
    keyFormula: 'W = ∫ F(x) dx',
    commonTrap: 'Simply multiplying F(4) × 4 instead of integrating the variable force.',
  },
  {
    topic: 'Rotational Dynamics',
    difficulty: 'Medium',
    questionText: 'A solid sphere and a solid cylinder of the same mass M and radius R roll down an inclined plane of height h from rest without slipping. The ratio of the linear speed of the solid sphere to that of the solid cylinder at the bottom is:',
    options: ['√(14 / 15)', '√(15 / 14)', '√(7 / 5)', '√(5 / 7)'],
    correctOptionIndex: 1,
    solutionSteps: 'v = √(2gh / (1 + k²/R²)). For solid sphere k²/R² = 2/5 → 1 + 2/5 = 7/5. For solid cylinder k²/R² = 1/2 → 1 + 1/2 = 3/2. Ratio v_sphere / v_cyl = √((3/2) / (7/5)) = √(15 / 14).',
    keyFormula: 'v = √[2gh / (1 + I/(MR²))]',
    commonTrap: 'Inverting the ratio of (1 + k²/R²) in the denominator.',
  },
  {
    topic: 'Gravitation',
    difficulty: 'Easy',
    questionText: 'If the escape velocity from the surface of the Earth is v_e = 11.2 km/s, what is the orbital velocity of a satellite revolving very close to the Earth’s surface?',
    options: ['5.6 km/s', '7.92 km/s', '9.8 km/s', '15.8 km/s'],
    correctOptionIndex: 1,
    solutionSteps: 'Near Earth’s surface, v_e = √2 · v_o. Therefore v_o = 11.2 / √2 ≈ 11.2 / 1.414 ≈ 7.92 km/s.',
    keyFormula: 'v_e = √2 · v_o',
    commonTrap: 'Multiplying by √2 instead of dividing by √2.',
  },
  {
    topic: 'Thermodynamics & Kinetic Theory',
    difficulty: 'Medium',
    questionText: 'One mole of an ideal monoatomic gas (γ = 5/3) undergoes an adiabatic expansion in which its volume becomes 8 times its initial volume. If the initial temperature is 400 K, the final temperature is:',
    options: ['50 K', '100 K', '150 K', '200 K'],
    correctOptionIndex: 1,
    solutionSteps: 'For a reversible adiabatic process, T₁ V₁^(γ−1) = T₂ V₂^(γ−1). Here γ − 1 = 2/3. Thus T₂ = 400 × (1/8)^(2/3) = 400 × (1/2)² = 100 K.',
    keyFormula: 'T V^(γ − 1) = constant',
    commonTrap: 'Using γ = 7/5 (diatomic) instead of γ = 5/3 (monoatomic).',
  },
  {
    topic: 'Simple Harmonic Motion',
    difficulty: 'Easy',
    questionText: 'In Simple Harmonic Motion with amplitude A, at what displacement x from the mean position is the kinetic energy of the particle equal to three times its potential energy (KE = 3 PE)?',
    options: ['A / 4', 'A / 2', 'A / √2', '(√3 / 2) A'],
    correctOptionIndex: 1,
    solutionSteps: 'Total energy E = ½kA² = KE + PE = 4 PE = 4(½kx²). Thus A² = 4x² ⇒ x = A / 2.',
    keyFormula: 'KE = ½k(A² − x²), PE = ½kx²',
    commonTrap: 'Forgetting that KE + PE = ½kA², leading to x = A/4.',
  },
  {
    topic: 'Electrostatics & Capacitors',
    difficulty: 'Medium',
    questionText: 'An electric dipole with dipole moment p = 4 × 10⁻⁸ C·m is aligned at 30° with the direction of a uniform electric field E = 5 × 10⁴ N/C. The magnitude of the torque acting on the dipole is:',
    options: ['1.0 × 10⁻³ N·m', '1.73 × 10⁻³ N·m', '2.0 × 10⁻³ N·m', '5.0 × 10⁻⁴ N·m'],
    correctOptionIndex: 0,
    solutionSteps: 'Torque τ = p E sin θ = (4 × 10⁻⁸)(5 × 10⁴) sin 30° = 2 × 10⁻³ × 0.5 = 1.0 × 10⁻³ N·m.',
    keyFormula: 'τ = pE sin θ',
    commonTrap: 'Using cos θ (which gives potential energy U = −pE cos θ) instead of sin θ.',
  },
  {
    topic: 'Current Electricity',
    difficulty: 'Easy',
    questionText: 'In a balanced Wheatstone bridge, the four arms have resistances P = 12 Ω, Q = 18 Ω, R = 8 Ω, and S. The value of resistance S required for zero galvanometer deflection is:',
    options: ['6 Ω', '10 Ω', '12 Ω', '16 Ω'],
    correctOptionIndex: 2,
    solutionSteps: 'For a balanced Wheatstone bridge, P / Q = R / S ⇒ 12 / 18 = 8 / S ⇒ S = (8 × 18) / 12 = 12 Ω.',
    keyFormula: 'P / Q = R / S (Balanced Bridge)',
    commonTrap: 'Cross-multiplying P·R = Q·S instead of opposite-arm products P·S = Q·R.',
  },
  {
    topic: 'Moving Charges & Magnetism',
    difficulty: 'Medium',
    questionText: 'An electron and an alpha particle enter a uniform magnetic field B perpendicularly with the same kinetic energy K. What is the ratio of their circular path radii (r_e : r_α), given q_α = 2e?',
    options: ['2 √(m_e / m_α)', '√(m_e / m_α)', '½ √(m_e / m_α)', '√(2m_e / m_α)'],
    correctOptionIndex: 0,
    solutionSteps: 'Radius in magnetic field r = √(2mK) / (qB). Since K and B are identical, r ∝ √m / q. Therefore r_e / r_α = (√m_e / e) / (√m_α / 2e) = 2 √(m_e / m_α).',
    keyFormula: 'r = mv / (qB) = √(2mK) / (qB)',
    commonTrap: 'Using r = mv/(qB) assuming equal velocity instead of equal kinetic energy.',
  },
  {
    topic: 'Electromagnetic Induction & AC',
    difficulty: 'Medium',
    questionText: 'In a series LCR circuit connected to an AC source of 200 V (rms), the rms voltages across the inductor and capacitor are V_L = 180 V and V_C = 180 V respectively. The rms voltage across the resistor R is:',
    options: ['0 V', '100 V', '200 V', '360 V'],
    correctOptionIndex: 2,
    solutionSteps: 'Since V_L = V_C, the circuit is in resonance and the net reactive voltage (V_L − V_C) = 0. From V = √[V_R² + (V_L − V_C)²], we get V_R = V = 200 V.',
    keyFormula: 'V_rms = √[V_R² + (V_L − V_C)²]',
    commonTrap: 'Adding V_L and V_C algebraically instead of recognizing their 180° phase opposition.',
  },
  {
    topic: 'Ray & Wave Optics',
    difficulty: 'Easy',
    questionText: 'In Young’s Double Slit Experiment (YDSE), if the slit separation d is halved and the screen distance D is doubled while keeping wavelength λ constant, the fringe width β becomes:',
    options: ['Unchanged', 'Doubled', 'Four times', 'One-fourth'],
    correctOptionIndex: 2,
    solutionSteps: 'Fringe width β = λD / d. When D → 2D and d → d/2, β′ = λ(2D) / (d/2) = 4 (λD / d) = 4β.',
    keyFormula: 'β = λD / d',
    commonTrap: 'Cancelling the factors of 2 instead of multiplying 2 / (1/2) = 4.',
  },
  {
    topic: 'Dual Nature & Photoelectric Effect',
    difficulty: 'Medium',
    questionText: 'The work function of a metal surface is φ = 2.1 eV. When monochromatic light of energy 4.5 eV falls on it, the stopping potential V₀ required to stop the fastest photoelectrons is:',
    options: ['1.2 V', '2.1 V', '2.4 V', '6.6 V'],
    correctOptionIndex: 2,
    solutionSteps: 'By Einstein’s photoelectric equation, eV₀ = hν − φ = 4.5 eV − 2.1 eV = 2.4 eV ⇒ V₀ = 2.4 V.',
    keyFormula: 'eV₀ = hν − φ₀',
    commonTrap: 'Reporting the answer in Joules when eV directly gives V₀ in Volts.',
  },
  {
    topic: 'Atoms & Nuclei (Bohr Model)',
    difficulty: 'Easy',
    questionText: 'In the Bohr model of the hydrogen atom, the ratio of the radius of the third orbit (n = 3) to that of the first orbit (n = 1) is:',
    options: ['3 : 1', '6 : 1', '9 : 1', '27 : 1'],
    correctOptionIndex: 2,
    solutionSteps: 'Since Bohr orbit radius r_n ∝ n² / Z, for Z = 1 we have r₃ / r₁ = 3² / 1² = 9 : 1.',
    keyFormula: 'r_n = 0.529 n² / Z Å',
    commonTrap: 'Using linear proportionality r_n ∝ n instead of quadratic r_n ∝ n².',
  },
  {
    topic: 'Semiconductors & Logic Gates',
    difficulty: 'Easy',
    questionText: 'Which Boolean expression represents the output Y of a two-input NAND gate with inputs A and B followed immediately by a NOT gate?',
    options: ['A + B', 'A · B', '̅(A · B)', '̅A + ̅B'],
    correctOptionIndex: 1,
    solutionSteps: 'Output of NAND gate is ̅(A · B). Passing this through a NOT gate inverts it again: ̿(A · B) = A · B (an AND gate).',
    keyFormula: 'NOT(NAND(A, B)) = A · B',
    commonTrap: 'Forgetting double negation cancels out.',
  },
  {
    topic: 'Units, Dimensions & Error Analysis',
    difficulty: 'Medium',
    questionText: 'A physical quantity P is given by P = a³ b² / (√c · d). If the percentage errors in measuring a, b, c, and d are 1%, 2%, 4%, and 3% respectively, the maximum percentage error in P is:',
    options: ['10%', '12%', '14%', '16%'],
    correctOptionIndex: 1,
    solutionSteps: '(ΔP/P)×100 = 3(Δa/a) + 2(Δb/b) + ½(Δc/c) + 1(Δd/d) = 3(1%) + 2(2%) + 0.5(4%) + 3% = 3 + 4 + 2 + 3 = 12%.',
    keyFormula: 'ΔP/P = Σ |power_i| (Δx_i / x_i)',
    commonTrap: 'Subtracting the errors of quantities in the denominator instead of adding maximum absolute relative errors.',
  },
  {
    topic: 'Mechanical Properties of Fluids',
    difficulty: 'Medium',
    questionText: 'Eight identical spherical raindrops, each falling with a terminal velocity of 5 cm/s in air, coalesce to form a single larger spherical drop. The new terminal velocity of the combined drop is:',
    options: ['10 cm/s', '15 cm/s', '20 cm/s', '40 cm/s'],
    correctOptionIndex: 2,
    solutionSteps: 'When n = 8 drops coalesce, R = n^(1/3) r = 8^(1/3) r = 2r. Since terminal velocity v_T ∝ r², v_new = 2² × 5 = 4 × 5 = 20 cm/s.',
    keyFormula: 'v_T ∝ r² ⇒ v_new = n^(2/3) v_old',
    commonTrap: 'Assuming v_T ∝ R³ (40 cm/s) instead of v_T ∝ R².',
  },
  {
    topic: 'Waves & Sound (Doppler & Beats)',
    difficulty: 'Easy',
    questionText: 'Two tuning forks A and B sounded together produce 4 beats per second. The frequency of A is 256 Hz. When prong B is slightly loaded with wax, the beat frequency increases to 6 beats/s. The original frequency of B was:',
    options: ['250 Hz', '252 Hz', '260 Hz', '262 Hz'],
    correctOptionIndex: 1,
    solutionSteps: 'Possible frequencies of B are 256 ± 4 = 260 Hz or 252 Hz. Loading with wax decreases f_B. Since the gap |f_A − f_B| increased from 4 to 6 as f_B decreased, f_B must originally be lower than 256 Hz, i.e., 252 Hz.',
    keyFormula: 'f_beat = |f₁ − f₂|',
    commonTrap: 'Picking 260 Hz without checking that lowering 260 Hz would initially reduce beats to 2/s.',
  },
  {
    topic: 'Electromagnetic Waves',
    difficulty: 'Easy',
    questionText: 'In a plane electromagnetic wave travelling in vacuum, the peak electric field amplitude is E₀ = 120 V/m. Taking c = 3 × 10⁸ m/s, the peak magnetic field amplitude B₀ is:',
    options: ['4 × 10⁻⁷ T', '3.6 × 10⁻¹⁰ T', '4 × 10⁻⁶ T', '2.5 × 10⁶ T'],
    correctOptionIndex: 0,
    solutionSteps: 'In vacuum, E₀ / B₀ = c ⇒ B₀ = E₀ / c = 120 / (3 × 10⁸) = 40 × 10⁻⁸ T = 4 × 10⁻⁷ T.',
    keyFormula: 'B₀ = E₀ / c',
    commonTrap: 'Multiplying E₀ × c instead of dividing E₀ by c.',
  },
  {
    topic: 'Center of Mass & Collisions',
    difficulty: 'Medium',
    questionText: 'A ball is dropped vertically from a height of 16 m onto a horizontal floor. If the coefficient of restitution between the ball and the floor is e = 0.5, the height to which the ball rebounds after the first bounce is:',
    options: ['2 m', '4 m', '8 m', '12 m'],
    correctOptionIndex: 1,
    solutionSteps: 'Rebound height after 1st collision is h₁ = e² h₀ = (0.5)² × 16 = 0.25 × 16 = 4 m.',
    keyFormula: 'h_n = e^(2n) h₀',
    commonTrap: 'Multiplying by e instead of e².',
  },
];

const PHYSICS_NUMERICAL_BANK: Array<Omit<JeeCbtQuestion, 'id' | 'questionNumber' | 'subject' | 'section' | 'format'>> = [
  {
    topic: 'Capacitors & Dielectrics',
    difficulty: 'Medium',
    questionText: 'Three capacitors of capacitances 3 μF, 6 μF, and 6 μF are connected in series across a 120 V DC supply. Find the equivalent capacitance of the combination in μF (enter numerical value).',
    correctNumericalValue: 1.5,
    numericalTolerance: 0.05,
    solutionSteps: '1/C_eq = 1/3 + 1/6 + 1/6 = 2/6 + 1/6 + 1/6 = 4/6 = 2/3 μF⁻¹ ⇒ C_eq = 1.5 μF.',
    keyFormula: '1/C_eq = 1/C₁ + 1/C₂ + 1/C₃',
    commonTrap: 'Adding series capacitors directly like resistors.',
  },
  {
    topic: 'Current Electricity & Power',
    difficulty: 'Easy',
    questionText: 'A heater coil rated at 1000 W, 200 V is connected across a 100 V supply. Assuming its resistance remains constant, what power (in Watts) will it consume?',
    correctNumericalValue: 250,
    numericalTolerance: 1,
    solutionSteps: 'Since P ∝ V² for constant resistance R, P₂ = P₁ × (V₂ / V₁)² = 1000 × (100 / 200)² = 1000 × 0.25 = 250 W.',
    keyFormula: 'P = V² / R',
    commonTrap: 'Using linear scaling (500 W) instead of quadratic V² scaling.',
  },
  {
    topic: 'Ray Optics — Lens Maker & Power',
    difficulty: 'Easy',
    questionText: 'A convex lens of focal length +25 cm is placed in contact coaxially with a concave lens of focal length −50 cm. Find the power of the equivalent lens combination in Dioptres (D).',
    correctNumericalValue: 2,
    numericalTolerance: 0.05,
    solutionSteps: 'P₁ = 100 / 25 = +4 D; P₂ = 100 / (−50) = −2 D. Net power P = P₁ + P₂ = 4 − 2 = 2 D.',
    keyFormula: 'P_eq = P₁ + P₂ (in Dioptres, f in meters)',
    commonTrap: 'Forgetting to convert cm to meters when calculating Dioptres.',
  },
  {
    topic: 'Rotational Moment of Inertia',
    difficulty: 'Medium',
    questionText: 'A uniform circular disc has mass M = 4 kg and radius R = 2 m. Calculate its moment of inertia (in kg·m²) about a tangent in its own plane.',
    correctNumericalValue: 20,
    numericalTolerance: 0.1,
    solutionSteps: 'About a diameter in its plane, I_d = ¼ MR². By parallel axis theorem, about a tangent in its plane: I_t = I_d + MR² = (5/4) MR² = 1.25 × 4 × 2² = 20 kg·m².',
    keyFormula: 'I_tangent(plane) = (5/4) MR²',
    commonTrap: 'Using (3/2)MR² which is for a tangent perpendicular to the plane.',
  },
  {
    topic: 'Electromagnetic Induction',
    difficulty: 'Easy',
    questionText: 'The magnetic flux linked with a coil of resistance 10 Ω varies with time t (in seconds) as Φ(t) = (4t² − 2t + 5) Weber. Find the magnitude of induced current (in Amperes) at t = 2 s.',
    correctNumericalValue: 1.4,
    numericalTolerance: 0.05,
    solutionSteps: '|ε| = |dΦ/dt| = 8t − 2. At t = 2 s, |ε| = 8(2) − 2 = 14 V. Induced current I = |ε| / R = 14 / 10 = 1.4 A.',
    keyFormula: 'I = |dΦ/dt| / R',
    commonTrap: 'Forgetting to divide the induced EMF (14 V) by resistance R = 10 Ω.',
  },
];

const CHEMISTRY_MCQ_BANK: Array<Omit<JeeCbtQuestion, 'id' | 'questionNumber' | 'subject' | 'section' | 'format'>> = [
  {
    topic: 'Atomic Structure & Quantum Numbers',
    difficulty: 'Easy',
    questionText: 'What are the total number of radial nodes and angular nodes present in a 4d orbital?',
    options: ['1 radial node, 2 angular nodes', '2 radial nodes, 1 angular node', '1 radial node, 3 angular nodes', '3 radial nodes, 2 angular nodes'],
    correctOptionIndex: 0,
    solutionSteps: 'For a 4d orbital, n = 4 and l = 2. Number of angular nodes = l = 2. Number of radial nodes = n − l − 1 = 4 − 2 − 1 = 1.',
    keyFormula: 'Radial nodes = n − l − 1; Angular nodes = l',
    commonTrap: 'Swapping the formulas for radial and angular nodes.',
  },
  {
    topic: 'Chemical Bonding & VSEPR Theory',
    difficulty: 'Easy',
    questionText: 'According to VSEPR theory, the hybridization of the central Xenon atom and the molecular geometry of XeF₄ are respectively:',
    options: ['sp³d, See-saw', 'sp³d², Square planar', 'sp³d², Octahedral', 'sp³, Tetrahedral'],
    correctOptionIndex: 1,
    solutionSteps: 'Xe has 8 valence electrons. In XeF₄, there are 4 bond pairs + 2 lone pairs = 6 steric number (sp³d²). The two lone pairs occupy axial positions to minimize repulsion, giving a Square Planar molecular shape.',
    keyFormula: 'Steric Number = ½ (V + M − C + A)',
    commonTrap: 'Confusing electron-pair geometry (octahedral) with molecular shape (square planar).',
  },
  {
    topic: 'Chemical Thermodynamics',
    difficulty: 'Medium',
    questionText: 'For a chemical reaction at 300 K, the enthalpy change is ΔH = −24 kJ/mol and entropy change is ΔS = −60 J/(K·mol). The standard Gibbs free energy change ΔG is:',
    options: ['−42 kJ/mol', '−6 kJ/mol', '+6 kJ/mol', '+36 kJ/mol'],
    correctOptionIndex: 1,
    solutionSteps: 'Convert ΔS to kJ: ΔS = −0.060 kJ/(K·mol). Using ΔG = ΔH − TΔS = −24 − 300(−0.060) = −24 + 18 = −6 kJ/mol.',
    keyFormula: 'ΔG = ΔH − TΔS',
    commonTrap: 'Failing to convert ΔS from J/(K·mol) to kJ/(K·mol).',
  },
  {
    topic: 'Chemical & Ionic Equilibrium',
    difficulty: 'Medium',
    questionText: 'What is the pH of an aqueous buffer solution containing 0.1 M CH₃COOH and 0.01 M CH₃COONa? (Given pK_a of CH₃COOH = 4.74)',
    options: ['3.74', '4.74', '5.74', '6.74'],
    correctOptionIndex: 0,
    solutionSteps: 'By the Henderson–Hasselbalch equation: pH = pK_a + log₁₀([Salt]/[Acid]) = 4.74 + log₁₀(0.01 / 0.1) = 4.74 + log₁₀(10⁻¹) = 4.74 − 1 = 3.74.',
    keyFormula: 'pH = pK_a + log([Conjugate Base] / [Acid])',
    commonTrap: 'Inverting [Acid]/[Salt] and adding +1 instead of subtracting 1.',
  },
  {
    topic: 'Electrochemistry (Nernst Equation)',
    difficulty: 'Medium',
    questionText: 'For the Daniell cell Zn(s) | Zn²⁺(0.01 M) || Cu²⁺(1.0 M) | Cu(s), if E°_cell = 1.10 V at 298 K, the cell EMF E_cell is approximately:',
    options: ['1.04 V', '1.10 V', '1.16 V', '1.22 V'],
    correctOptionIndex: 2,
    solutionSteps: 'E_cell = E°_cell − (0.0591 / n) log₁₀([Zn²⁺] / [Cu²⁺]). Here n = 2, [Zn²⁺]/[Cu²⁺] = 10⁻². Thus E_cell = 1.10 − (0.0591 / 2)(−2) ≈ 1.10 + 0.059 = 1.16 V.',
    keyFormula: 'E = E° − (0.0591/n) log Q',
    commonTrap: 'Subtracting 0.059 V instead of adding when product ion concentration is < 1 M.',
  },
  {
    topic: 'Chemical Kinetics',
    difficulty: 'Easy',
    questionText: 'A first-order reaction is 50% complete in 20 minutes. How much time is required for 87.5% completion of the same reaction?',
    options: ['40 minutes', '60 minutes', '80 minutes', '100 minutes'],
    correctOptionIndex: 1,
    solutionSteps: '87.5% completion means 12.5% = (1/2)³ of the reactant remains, which corresponds to exactly 3 half-lives: t_87.5% = 3 × t_1/2 = 3 × 20 = 60 minutes.',
    keyFormula: 't_87.5% = 3 × t_1/2 (First-Order)',
    commonTrap: 'Using linear proportionality instead of exponential half-life decay.',
  },
  {
    topic: 'Solutions & Colligative Properties',
    difficulty: 'Medium',
    questionText: 'Assuming 100% ionization in dilute aqueous solution, which of the following 0.1 m solutions will exhibit the highest boiling point at 1 atm?',
    options: ['0.1 m Glucose', '0.1 m NaCl', '0.1 m BaCl₂', '0.1 m Al₂(SO₄)₃'],
    correctOptionIndex: 3,
    solutionSteps: 'Elevation in boiling point ΔT_b = i · K_b · m. The van’t Hoff factor i is 1 for glucose, 2 for NaCl, 3 for BaCl₂, and 5 for Al₂(SO₄)₃ (2 Al³⁺ + 3 SO₄²⁻). Highest i gives highest boiling point.',
    keyFormula: 'ΔT_b = i K_b m',
    commonTrap: 'Picking lowest ΔT_b (freezing point depression confusion).',
  },
  {
    topic: 'Coordination Compounds (CFT & Isomerism)',
    difficulty: 'Medium',
    questionText: 'Using Crystal Field Theory, the hybridization and magnetic nature of the complex ion [CoF₆]³⁻ (Atomic number of Co = 27) are:',
    options: ['d²sp³, diamagnetic', 'sp³d², paramagnetic with 4 unpaired electrons', 'd²sp³, paramagnetic with 2 unpaired electrons', 'sp³d², diamagnetic'],
    correctOptionIndex: 1,
    solutionSteps: 'In [CoF₆]³⁻, Co is in +3 state (3d⁶). Fluoride (F⁻) is a weak-field halide ligand, so no pairing occurs. Configuration is t₂g⁴ e_g² with 4 unpaired electrons, utilizing outer 4d orbitals (sp³d², paramagnetic).',
    keyFormula: 'Co³⁺ (3d⁶) + weak-field F⁻ → high-spin sp³d²',
    commonTrap: 'Treating Co³⁺ as always low-spin (which holds for NH₃/CN⁻, not halide ligands like F⁻).',
  },
  {
    topic: 'd- and f-Block Elements',
    difficulty: 'Easy',
    questionText: 'Which of the following transition metal ions is colourless in aqueous solution? (Atomic numbers: Ti = 22, V = 23, Cr = 24, Sc = 21)',
    options: ['Ti³⁺', 'V³⁺', 'Cr³⁺', 'Sc³⁺'],
    correctOptionIndex: 3,
    solutionSteps: 'Sc (Z = 21) has configuration [Ar] 3d¹ 4s². Therefore Sc³⁺ has a 3d⁰ configuration with zero d-electrons, making d–d transitions impossible and the ion colourless.',
    keyFormula: 'd⁰ and d¹⁰ configurations show no d–d transitions',
    commonTrap: 'Confusing Ti³⁺ (3d¹, purple) with Ti⁴⁺ (3d⁰, colourless).',
  },
  {
    topic: 'General Organic Chemistry (GOC)',
    difficulty: 'Medium',
    questionText: 'Arrange the following carbocations in order of increasing stability: (I) (CH₃)₃C⁺, (II) CH₃CH₂⁺, (III) (CH₃)₂CH⁺, (IV) CH₂=CH–CH₂⁺',
    options: ['II < III < IV < I', 'I < IV < III < II', 'II < IV < III < I', 'IV < II < III < I'],
    correctOptionIndex: 0,
    solutionSteps: 'CH₃CH₂⁺ (II, 3 α-H) < (CH₃)₂CH⁺ (III, 6 α-H) < Allyl CH₂=CH–CH₂⁺ (IV, resonance stabilized) < tert-Butyl (CH₃)₃C⁺ (I, 9 hyperconjugative α-H + strong +I).',
    keyFormula: '9 α-H (t-butyl) > Allyl resonance > 6 α-H (isopropyl) > 3 α-H (ethyl)',
    commonTrap: 'Placing simple allyl carbocation above tert-butyl carbocation.',
  },
  {
    topic: 'Hydrocarbons & Alkenes',
    difficulty: 'Easy',
    questionText: 'Ozonolysis (O₃ followed by Zn/H₂O) of an alkene C₄H₈ yields exclusively a single organic product: acetaldehyde (CH₃CHO). The alkene is:',
    options: ['But-1-ene', 'But-2-ene', '2-Methylpropene', 'Cyclobutane'],
    correctOptionIndex: 1,
    solutionSteps: 'Symmetrical cleavage of CH₃–CH=CH–CH₃ (But-2-ene) across the double bond yields two moles of CH₃–CH=O (acetaldehyde).',
    keyFormula: 'R–CH=CH–R + O₃ → (Zn/H₂O) → 2 R–CHO',
    commonTrap: 'Choosing 2-methylpropene, which gives acetone + formaldehyde.',
  },
  {
    topic: 'Haloalkanes & Nucleophilic Substitution',
    difficulty: 'Easy',
    questionText: 'Which of the following alkyl halides undergoes S_N1 solvolysis fastest in aqueous ethanol?',
    options: ['CH₃CH₂CH₂Cl', '(CH₃)₂CHCl', '(CH₃)₃C–Cl', 'CH₂=CH–Cl'],
    correctOptionIndex: 2,
    solutionSteps: 'The rate of an S_N1 reaction depends on the stability of the carbocation intermediate. Tertiary carbocation (CH₃)₃C⁺ is the most stable among the given options.',
    keyFormula: 'S_N1 reactivity: 3° > 2° > 1° > CH₃X',
    commonTrap: 'Reversing S_N1 and S_N2 steric hindrance orders.',
  },
  {
    topic: 'Alcohols, Phenols & Ethers',
    difficulty: 'Medium',
    questionText: 'Reaction of phenol with chloroform (CHCl₃) in the presence of aqueous NaOH followed by acidification gives predominantly:',
    options: ['Benzoic acid', 'Salicylaldehyde (2-Hydroxybenzaldehyde)', 'Salicylic acid', 'Picric acid'],
    correctOptionIndex: 1,
    solutionSteps: 'This is the Reimer–Tiemann reaction, which introduces a –CHO group ortho to the phenolic –OH via a dichlorocarbene (:CCl₂) electrophilic intermediate, yielding Salicylaldehyde.',
    keyFormula: 'Reimer–Tiemann: Phenol + CHCl₃ + aq. NaOH → Salicylaldehyde',
    commonTrap: 'Confusing Reimer–Tiemann (CHCl₃ → Salicylaldehyde) with Kolbe’s reaction (CO₂ → Salicylic acid).',
  },
  {
    topic: 'Aldehydes, Ketones & Carboxylic Acids',
    difficulty: 'Easy',
    questionText: 'Which of the following carbonyl compounds undergoes the Cannizzaro disproportionation reaction when heated with concentrated (50%) NaOH?',
    options: ['CH₃CHO', 'CH₃COCH₃', 'C₆H₅CHO (Benzaldehyde)', 'CH₃CH₂CHO'],
    correctOptionIndex: 2,
    solutionSteps: 'Aldehydes lacking an α-hydrogen atom undergo the Cannizzaro reaction. Benzaldehyde (C₆H₅CHO) has no α-H, so it disproportionates into sodium benzoate and benzyl alcohol.',
    keyFormula: '2 ArCHO + conc. NaOH → ArCH₂OH + ArCOONa (no α-H)',
    commonTrap: 'Selecting acetaldehyde (CH₃CHO), which has 3 α-hydrogens and gives Aldol condensation.',
  },
  {
    topic: 'Amines & Diazonium Salts',
    difficulty: 'Easy',
    questionText: 'When benzamide (C₆H₅CONH₂) is warmed with bromine (Br₂) and alcoholic/aqueous KOH (Hoffmann bromamide degradation), the major organic product formed is:',
    options: ['Benzylamine (C₆H₅CH₂NH₂)', 'Aniline (C₆H₅NH₂)', 'Bromobenzene', 'Benzonitrile'],
    correctOptionIndex: 1,
    solutionSteps: 'Hoffmann bromamide degradation converts a primary amide R–CONH₂ into a primary amine R–NH₂ with one fewer carbon atom (loss of CO as CO₃²⁻), producing Aniline.',
    keyFormula: 'R–CONH₂ + Br₂ + 4KOH → R–NH₂ + K₂CO₃ + 2KBr + 2H₂O',
    commonTrap: 'Keeping the carbonyl carbon as –CH₂– (benzylamine) instead of removing it.',
  },
  {
    topic: 'Biomolecules',
    difficulty: 'Easy',
    questionText: 'Upon complete hydrolysis, sucrose (cane sugar) yields an equimolar mixture of:',
    options: ['α-D-Glucose and β-D-Glucose', 'α-D-Glucose and β-D-Fructose', 'α-D-Glucose and β-D-Galactose', 'β-D-Fructose and α-D-Galactose'],
    correctOptionIndex: 1,
    solutionSteps: 'Sucrose is a non-reducing disaccharide composed of C1 of α-D-glucose linked to C2 of β-D-fructose via a glycosidic bond.',
    keyFormula: 'Sucrose + H₂O → α-D-Glucose + β-D-Fructose',
    commonTrap: 'Confusing sucrose hydrolysis products with lactose (glucose + galactose) or maltose (2 glucose).',
  },
  {
    topic: 'Periodic Table & Periodicity',
    difficulty: 'Easy',
    questionText: 'The correct order of first ionization enthalpy (IE₁) among the second-period elements Li, Be, B, and C is:',
    options: ['Li < Be < B < C', 'Li < B < Be < C', 'B < Li < Be < C', 'Li < Be < C < B'],
    correctOptionIndex: 1,
    solutionSteps: 'Be (1s² 2s²) has a fully filled 2s subshell, giving it a higher first ionization enthalpy than B (1s² 2s² 2p¹). Hence Li < B < Be < C.',
    keyFormula: '2s² filled subshell stability: IE₁(Be) > IE₁(B)',
    commonTrap: 'Assuming strictly monotonic increase across the period without accounting for the 2s² → 2p¹ penetration effect.',
  },
  {
    topic: 'p-Block Elements',
    difficulty: 'Medium',
    questionText: 'What is the basicity (number of ionizable –OH protons) of orthophosphorous acid (H₃PO₃)?',
    options: ['1', '2', '3', '4'],
    correctOptionIndex: 1,
    solutionSteps: 'H₃PO₃ has one P=O bond, one direct P–H bond (non-ionizable), and two P–OH bonds (ionizable). Therefore, it is a dibasic acid (basicity = 2).',
    keyFormula: 'H₃PO₃ has 2 P–OH bonds and 1 P–H bond → Dibasic',
    commonTrap: 'Counting all 3 hydrogens in the formula H₃PO₃ as acidic.',
  },
  {
    topic: 'Redox Reactions & Stoichiometry',
    difficulty: 'Easy',
    questionText: 'In an acidic medium, potassium permanganate (KMnO₄, molar mass = M) acts as a strong oxidizing agent and is reduced to Mn²⁺. Its equivalent weight in acidic medium is:',
    options: ['M / 1', 'M / 3', 'M / 5', 'M / 6'],
    correctOptionIndex: 2,
    solutionSteps: 'In acidic medium, MnO₄⁻ (+7 oxidation state) + 8H⁺ + 5e⁻ → Mn²⁺ (+2) + 4H₂O. Since n-factor = 7 − 2 = 5, Equivalent Weight = M / 5.',
    keyFormula: 'Eq. Wt. = Molar Mass / n-factor (n = 5 in acid)',
    commonTrap: 'Using n = 3 (which applies to neutral/faintly alkaline medium where MnO₂ forms).',
  },
  {
    topic: 'Qualitative Salt Analysis',
    difficulty: 'Easy',
    questionText: 'In the brown-ring test for nitrate ions (NO₃⁻), the brown ring formed at the junction of the two liquids is due to the complex:',
    options: ['[Fe(H₂O)₅(NO)]²⁺', '[Fe(CN)₅(NO)]²⁻', '[Fe(H₂O)₆]³⁺', '[Fe(NO)₆]²⁺'],
    correctOptionIndex: 0,
    solutionSteps: 'Fe²⁺ reduces NO₃⁻ in concentrated H₂SO₄ to NO, which then coordinates with [Fe(H₂O)₆]²⁺ to form the pentaaquanitrosyliron(I) ion [Fe(H₂O)₅(NO)]²⁺.',
    keyFormula: 'Brown Ring Complex: [Fe(H₂O)₅(NO)]SO₄',
    commonTrap: 'Confusing the brown-ring complex with sodium nitroprusside [Fe(CN)₅(NO)]²⁻.',
  },
];

const CHEMISTRY_NUMERICAL_BANK: Array<Omit<JeeCbtQuestion, 'id' | 'questionNumber' | 'subject' | 'section' | 'format'>> = [
  {
    topic: 'Mole Concept & Concentration',
    difficulty: 'Easy',
    questionText: 'Calculate the molarity (in mol/L) of an aqueous solution prepared by dissolving 20 g of NaOH (Molar mass = 40 g/mol) in enough water to make 250 mL of solution.',
    correctNumericalValue: 2,
    numericalTolerance: 0.05,
    solutionSteps: 'Moles of NaOH = 20 / 40 = 0.5 mol. Volume = 250 mL = 0.25 L. Molarity M = 0.5 / 0.25 = 2 mol/L.',
    keyFormula: 'M = (mass / Molar Mass) × (1000 / V_mL)',
    commonTrap: 'Dividing by 250 without converting mL to Litres.',
  },
  {
    topic: 'Coordination Chemistry (Spin-Only Magnetic Moment)',
    difficulty: 'Easy',
    questionText: 'How many unpaired electrons are present in the high-spin tetrahedral complex ion [MnCl₄]²⁻? (Atomic number of Mn = 25)',
    correctNumericalValue: 5,
    numericalTolerance: 0,
    solutionSteps: 'In [MnCl₄]²⁻, Mn is in the +2 oxidation state (3d⁵). Since Cl⁻ is a weak-field ligand and tetrahedral crystal field splitting is small, all five d-orbitals remain singly occupied (n = 5 unpaired electrons).',
    keyFormula: 'Mn²⁺ = [Ar] 3d⁵ → 5 unpaired electrons',
    commonTrap: 'Pairing electrons in a tetrahedral halide complex.',
  },
  {
    topic: 'Electrochemistry (Faraday’s Laws)',
    difficulty: 'Medium',
    questionText: 'How many Faradays of electricity are required to completely reduce 1 mole of Cr₂O₇²⁻ ions to Cr³⁺ ions in acidic medium?',
    correctNumericalValue: 6,
    numericalTolerance: 0,
    solutionSteps: 'Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O. Each Cr atom goes from +6 to +3 (3e⁻ per Cr × 2 Cr atoms = 6 moles of electrons = 6 Faradays).',
    keyFormula: 'Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O',
    commonTrap: 'Answering 3 Faradays by forgetting there are two Chromium atoms in Cr₂O₇²⁻.',
  },
  {
    topic: 'Atomic Structure (Bohr Energy)',
    difficulty: 'Easy',
    questionText: 'The ground-state energy of an electron in a hydrogen atom is −13.6 eV. Find the magnitude of the ionization energy (in eV) required to remove the electron from the first excited state (n = 2) of a hydrogen atom.',
    correctNumericalValue: 3.4,
    numericalTolerance: 0.05,
    solutionSteps: 'First excited state corresponds to n = 2. E₂ = −13.6 / 2² = −3.4 eV. Ionization energy from n = 2 is 0 − (−3.4) = 3.4 eV.',
    keyFormula: 'E_n = −13.6 / n² eV',
    commonTrap: 'Using n = 1 for the "first excited state" instead of n = 2.',
  },
  {
    topic: 'Chemical Equilibrium',
    difficulty: 'Medium',
    questionText: 'For the gaseous equilibrium N₂O₄(g) ⇌ 2 NO₂(g), if the equilibrium concentrations are [N₂O₄] = 0.2 mol/L and [NO₂] = 0.4 mol/L, find the value of the equilibrium constant K_c.',
    correctNumericalValue: 0.8,
    numericalTolerance: 0.02,
    solutionSteps: 'K_c = [NO₂]² / [N₂O₄] = (0.4)² / 0.2 = 0.16 / 0.2 = 0.8.',
    keyFormula: 'K_c = [NO₂]² / [N₂O₄]',
    commonTrap: 'Forgetting to square the concentration of NO₂.',
  },
];

const MATHEMATICS_MCQ_BANK: Array<Omit<JeeCbtQuestion, 'id' | 'questionNumber' | 'subject' | 'section' | 'format'>> = [
  {
    topic: 'Quadratic Equations & Expressions',
    difficulty: 'Easy',
    questionText: 'If α and β are the roots of the quadratic equation x² − 5x + 6 = 0, then the value of α³ + β³ is:',
    options: ['19', '35', '45', '125'],
    correctOptionIndex: 1,
    solutionSteps: 'Here α + β = 5 and αβ = 6. Using α³ + β³ = (α + β)³ − 3αβ(α + β) = 5³ − 3(6)(5) = 125 − 90 = 35.',
    keyFormula: 'α³ + β³ = (α + β)³ − 3αβ(α + β)',
    commonTrap: 'Using +3αβ(α + β) instead of −3αβ(α + β).',
  },
  {
    topic: 'Complex Numbers',
    difficulty: 'Easy',
    questionText: 'The smallest positive integer n for which ((1 + i) / (1 − i))^n = 1 is:',
    options: ['2', '4', '8', '12'],
    correctOptionIndex: 1,
    solutionSteps: 'Rationalizing the base: (1 + i)/(1 − i) = (1 + i)² / (1 + 1) = 2i / 2 = i. The smallest positive integer n such that i^n = 1 is n = 4.',
    keyFormula: '(1 + i) / (1 − i) = i, and i⁴ = 1',
    commonTrap: 'Picking n = 2 because i² = −1.',
  },
  {
    topic: 'Matrices & Determinants',
    difficulty: 'Easy',
    questionText: 'If A is a 3 × 3 non-singular square matrix such that |A| = 5, then the determinant of its adjoint, |adj A|, is equal to:',
    options: ['5', '25', '125', '1/5'],
    correctOptionIndex: 1,
    solutionSteps: 'For an n × n matrix A, |adj A| = |A|^(n−1). Since n = 3 and |A| = 5, |adj A| = 5^(3−1) = 5² = 25.',
    keyFormula: '|adj A| = |A|^(n − 1)',
    commonTrap: 'Raising |A| to power n (125) instead of n − 1 (25).',
  },
  {
    topic: 'Sequences & Series (AP / GP)',
    difficulty: 'Easy',
    questionText: 'The sum of the infinite geometric progression 12 + 8 + 16/3 + 32/9 + … to infinity is:',
    options: ['24', '30', '36', '48'],
    correctOptionIndex: 2,
    solutionSteps: 'First term a = 12, common ratio r = 8/12 = 2/3 (< 1). Sum to infinity S_∞ = a / (1 − r) = 12 / (1 − 2/3) = 12 / (1/3) = 36.',
    keyFormula: 'S_∞ = a / (1 − r) for |r| < 1',
    commonTrap: 'Using 1 + r in the denominator instead of 1 − r.',
  },
  {
    topic: 'Permutations & Combinations',
    difficulty: 'Easy',
    questionText: 'In how many distinct ways can the letters of the word "LEADER" be arranged?',
    options: ['120', '360', '720', '180'],
    correctOptionIndex: 1,
    solutionSteps: '"LEADER" has 6 letters in total with the letter E repeated twice. Total distinct arrangements = 6! / 2! = 720 / 2 = 360.',
    keyFormula: 'Arrangements = n! / (p₁! p₂! …)',
    commonTrap: 'Forgetting to divide by 2! for the two identical E’s.',
  },
  {
    topic: 'Binomial Theorem',
    difficulty: 'Medium',
    questionText: 'The term independent of x in the binomial expansion of (x² − 1/x)⁶ is:',
    options: ['15', '−15', '20', '−20'],
    correctOptionIndex: 0,
    solutionSteps: 'General term T_(r+1) = ⁶C_r (x²)^(6−r) (−1/x)^r = ⁶C_r (−1)^r x^(12 − 3r). Setting 12 − 3r = 0 gives r = 4. Thus coefficient = ⁶C₄ (−1)⁴ = 15.',
    keyFormula: 'T_(r+1) = ⁿC_r a^(n−r) b^r',
    commonTrap: 'Dropping the (−1)^r sign factor when r is odd.',
  },
  {
    topic: 'Limits, Continuity & Differentiability',
    difficulty: 'Easy',
    questionText: 'Evaluate the limit: lim_(x → 0) [(1 − cos 4x) / x²]',
    options: ['2', '4', '8', '16'],
    correctOptionIndex: 2,
    solutionSteps: 'Using 1 − cos 4x = 2 sin²(2x), the limit becomes lim_(x→0) [2 sin²(2x) / x²] = 2 × 4 × lim_(x→0) (sin 2x / 2x)² = 8 × 1 = 8.',
    keyFormula: 'lim_(x→0) (1 − cos kx) / x² = k² / 2',
    commonTrap: 'Forgetting the factor of 1/2 in 1 − cos kx ≈ k²x²/2 and answering 16.',
  },
  {
    topic: 'Applications of Derivatives (Maxima & Minima)',
    difficulty: 'Easy',
    questionText: 'The minimum value of the function f(x) = x³ − 3x + 5 on the closed interval [0, 2] is:',
    options: ['1', '3', '5', '7'],
    correctOptionIndex: 1,
    solutionSteps: 'f′(x) = 3x² − 3 = 0 ⇒ x = 1 in [0, 2]. Evaluating at critical point and endpoints: f(0) = 5, f(1) = 1 − 3 + 5 = 3, f(2) = 8 − 6 + 5 = 7. Minimum value is 3.',
    keyFormula: 'Check f(c) where f′(c) = 0 and endpoints f(a), f(b)',
    commonTrap: 'Reporting x = 1 (the point of minimum) instead of f(1) = 3 (the minimum value).',
  },
  {
    topic: 'Definite Integration (King’s Property)',
    difficulty: 'Easy',
    questionText: 'The value of the definite integral I = ∫₀^(π/2) [√(sin x) / (√(sin x) + √(cos x))] dx is:',
    options: ['π / 2', 'π / 4', 'π / 8', '1'],
    correctOptionIndex: 1,
    solutionSteps: 'Using ∫₀^a f(x) dx = ∫₀^a f(a − x) dx with a = π/2, I = ∫₀^(π/2) [√(cos x) / (√(cos x) + √(sin x))] dx. Adding the two forms gives 2I = ∫₀^(π/2) 1 dx = π/2 ⇒ I = π/4.',
    keyFormula: '∫₀^(π/2) f(sin x) / [f(sin x) + f(cos x)] dx = π / 4',
    commonTrap: 'Forgetting to divide π/2 by 2 after adding 2I.',
  },
  {
    topic: 'Area Under Curves',
    difficulty: 'Medium',
    questionText: 'The area of the region bounded by the parabola y = x² and the line y = 4 in the xy-plane is:',
    options: ['16 / 3 sq. units', '32 / 3 sq. units', '8 sq. units', '16 sq. units'],
    correctOptionIndex: 1,
    solutionSteps: 'The line y = 4 intersects y = x² at x = −2 and x = 2. By symmetry, Area = 2 ∫₀² (4 − x²) dx = 2 [4x − x³/3]₀² = 2 (8 − 8/3) = 2 (16/3) = 32/3 sq. units.',
    keyFormula: 'Area = ∫_(−2)^2 (y_upper − y_lower) dx',
    commonTrap: 'Integrating only from 0 to 2 (16/3) and forgetting the left half of the parabola.',
  },
  {
    topic: 'Differential Equations',
    difficulty: 'Easy',
    questionText: 'The integrating factor (I.F.) of the first-order linear differential equation dy/dx + (2/x) y = x² (for x > 0) is:',
    options: ['e^(2x)', 'x²', '1 / x²', '2 ln x'],
    correctOptionIndex: 1,
    solutionSteps: 'Here P(x) = 2/x. The Integrating Factor is e^(∫ P(x) dx) = e^(∫ (2/x) dx) = e^(2 ln x) = e^(ln x²) = x².',
    keyFormula: 'I.F. = exp(∫ P(x) dx)',
    commonTrap: 'Stopping at 2 ln x without exponentiating.',
  },
  {
    topic: 'Straight Lines & Coordinate Geometry',
    difficulty: 'Easy',
    questionText: 'The perpendicular distance from the point P(3, 4) to the straight line 3x − 4y + 12 = 0 is:',
    options: ['1 / 5', '3 / 5', '1', '7 / 5'],
    correctOptionIndex: 2,
    solutionSteps: 'Distance d = |Ax₁ + By₁ + C| / √(A² + B²) = |3(3) − 4(4) + 12| / √(3² + (−4)²) = |9 − 16 + 12| / 5 = 5 / 5 = 1.',
    keyFormula: 'd = |Ax₁ + By₁ + C| / √(A² + B²)',
    commonTrap: 'Forgetting to divide by √(A² + B²) = 5.',
  },
  {
    topic: 'Circles & Conic Sections',
    difficulty: 'Medium',
    questionText: 'The length of the latus rectum of the ellipse x² / 25 + y² / 16 = 1 is:',
    options: ['32 / 5', '16 / 5', '25 / 2', '8 / 5'],
    correctOptionIndex: 0,
    solutionSteps: 'Here a² = 25 (a = 5) and b² = 16. Since a > b, the length of the latus rectum is 2b² / a = 2(16) / 5 = 32 / 5.',
    keyFormula: 'Latus Rectum of Ellipse = 2b² / a',
    commonTrap: 'Using b²/a (16/5) without the factor of 2.',
  },
  {
    topic: 'Vector Algebra',
    difficulty: 'Easy',
    questionText: 'For what value of λ are the vectors a = 2i − 3j + k and b = 4i + λj − 2k mutually perpendicular?',
    options: ['1', '2', '3', '−2'],
    correctOptionIndex: 1,
    solutionSteps: 'Two vectors are perpendicular when their dot product a · b = 0: (2)(4) + (−3)(λ) + (1)(−2) = 0 ⇒ 8 − 3λ − 2 = 0 ⇒ 3λ = 6 ⇒ λ = 2.',
    keyFormula: 'a ⊥ b ⇔ a · b = 0',
    commonTrap: 'Sign error when multiplying (+1)(−2).',
  },
  {
    topic: 'Three-Dimensional Geometry',
    difficulty: 'Medium',
    questionText: 'The acute angle θ between the two planes 2x − y + z = 6 and x + y + 2z = 7 is:',
    options: ['30°', '45°', '60°', '90°'],
    correctOptionIndex: 2,
    solutionSteps: 'cos θ = |n₁ · n₂| / (|n₁| |n₂|) = |(2)(1) + (−1)(1) + (1)(2)| / [√(4 + 1 + 1) √(1 + 1 + 4)] = |2 − 1 + 2| / (√6 · √6) = 3 / 6 = 1/2 ⇒ θ = 60°.',
    keyFormula: 'cos θ = |n₁ · n₂| / (|n₁| |n₂|)',
    commonTrap: 'Confusing cos θ = 1/2 with 30°.',
  },
  {
    topic: 'Probability & Bayes Theorem',
    difficulty: 'Easy',
    questionText: 'Two fair six-sided dice are rolled simultaneously. What is the probability that the sum of the numbers on the two dice is a prime number?',
    options: ['1 / 3', '5 / 12', '7 / 18', '1 / 2'],
    correctOptionIndex: 1,
    solutionSteps: 'Prime sums possible from two dice are 2 (1 way), 3 (2 ways), 5 (4 ways), 7 (6 ways), and 11 (2 ways). Total favourable outcomes = 1 + 2 + 4 + 6 + 2 = 15. Probability = 15 / 36 = 5 / 12.',
    keyFormula: 'P(E) = n(E) / 36',
    commonTrap: 'Forgetting sum = 2 (which is an even prime) or sum = 11.',
  },
  {
    topic: 'Trigonometric Equations & Identities',
    difficulty: 'Easy',
    questionText: 'The maximum value of the trigonometric expression f(θ) = 3 sin θ + 4 cos θ + 2 for θ ∈ ℝ is:',
    options: ['5', '7', '9', '3'],
    correctOptionIndex: 1,
    solutionSteps: 'The maximum value of a sin θ + b cos θ is √(a² + b²) = √(3² + 4²) = 5. Adding the constant +2 gives a maximum value of 5 + 2 = 7.',
    keyFormula: 'max(a sin θ + b cos θ) = √(a² + b²)',
    commonTrap: 'Forgetting to add the constant +2 at the end.',
  },
  {
    topic: 'Sets, Relations & Functions',
    difficulty: 'Easy',
    questionText: 'If a set A contains 4 elements and set B contains 3 elements, how many total relations can be defined from set A to set B?',
    options: ['12', '64', '81', '4096'],
    correctOptionIndex: 3,
    solutionSteps: 'Since |A × B| = 4 × 3 = 12, the total number of subsets of A × B (which are the relations from A to B) is 2¹² = 4096.',
    keyFormula: 'Number of relations from A to B = 2^(|A|·|B|)',
    commonTrap: 'Confusing total relations (2^(mn)) with total functions (n^m = 3⁴ = 81).',
  },
  {
    topic: 'Statistics (Variance & Standard Deviation)',
    difficulty: 'Medium',
    questionText: 'If the variance of the dataset 2, 4, 6, 8, 10 is σ² = 8, then the variance of the transformed dataset 6, 12, 18, 24, 30 is:',
    options: ['8', '24', '72', '64'],
    correctOptionIndex: 2,
    solutionSteps: 'Each observation is multiplied by k = 3. When every value is multiplied by k, the variance is multiplied by k²: Var(3X) = 3² Var(X) = 9 × 8 = 72.',
    keyFormula: 'Var(aX + b) = a² Var(X)',
    commonTrap: 'Multiplying the variance by 3 (24) instead of 3² = 9 (72).',
  },
  {
    topic: 'Inverse Trigonometric Functions',
    difficulty: 'Easy',
    questionText: 'The principal value of sin⁻¹(sin(3π / 4)) is:',
    options: ['3π / 4', 'π / 4', '−π / 4', '5π / 4'],
    correctOptionIndex: 1,
    solutionSteps: 'The principal value branch of sin⁻¹ x is [−π/2, π/2]. Since 3π/4 ∉ [−π/2, π/2], write sin(3π/4) = sin(π − π/4) = sin(π/4). Thus sin⁻¹(sin(π/4)) = π/4.',
    keyFormula: 'sin⁻¹(sin θ) = π − θ for θ ∈ [π/2, 3π/2]',
    commonTrap: 'Directly cancelling sin⁻¹ and sin outside the principal branch [−π/2, π/2].',
  },
];

// MATHEMATICS_MCQ_BANK[11] has correctOptionIndex: 2 ('1') directly in its definition.

const MATHEMATICS_NUMERICAL_BANK: Array<Omit<JeeCbtQuestion, 'id' | 'questionNumber' | 'subject' | 'section' | 'format'>> = [
  {
    topic: 'Matrices & Traces',
    difficulty: 'Easy',
    questionText: 'Let A be a 2 × 2 matrix with eigenvalues λ₁ = 4 and λ₂ = 7. Find the determinant |A| of the matrix.',
    correctNumericalValue: 28,
    numericalTolerance: 0,
    solutionSteps: 'The determinant of a square matrix equals the product of its eigenvalues: |A| = λ₁ × λ₂ = 4 × 7 = 28.',
    keyFormula: '|A| = Π λ_i',
    commonTrap: 'Adding the eigenvalues (11, which is the trace) instead of multiplying them.',
  },
  {
    topic: 'Definite Integration',
    difficulty: 'Easy',
    questionText: 'Evaluate the definite integral: ∫₀³ (3x² + 2x + 1) dx.',
    correctNumericalValue: 39,
    numericalTolerance: 0,
    solutionSteps: '∫₀³ (3x² + 2x + 1) dx = [x³ + x² + x]₀³ = 27 + 9 + 3 = 39.',
    keyFormula: '∫ (3x² + 2x + 1) dx = x³ + x² + x',
    commonTrap: 'Arithmetic slip when summing 27 + 9 + 3.',
  },
  {
    topic: 'Circles (Tangent Length)',
    difficulty: 'Medium',
    questionText: 'Find the length of the tangent drawn from the external point P(5, 1) to the circle x² + y² + 6x − 4y − 3 = 0.',
    correctNumericalValue: 7,
    numericalTolerance: 0,
    solutionSteps: 'Length of tangent L = √S₁ = √[5² + 1² + 6(5) − 4(1) − 3] = √[25 + 1 + 30 − 4 − 3] = √49 = 7.',
    keyFormula: 'Length of tangent = √S₁',
    commonTrap: 'Forgetting to take the square root of S₁ = 49.',
  },
  {
    topic: 'Permutations & Combinations',
    difficulty: 'Easy',
    questionText: 'If ⁿC₈ = ⁿC₆, find the value of ⁿC₂.',
    correctNumericalValue: 91,
    numericalTolerance: 0,
    solutionSteps: 'Since ⁿC_x = ⁿC_y with x ≠ y implies n = x + y = 8 + 6 = 14. Then ¹⁴C₂ = (14 × 13) / 2 = 91.',
    keyFormula: 'ⁿC_x = ⁿC_y ⇒ n = x + y',
    commonTrap: 'Stopping at n = 14 instead of computing ¹⁴C₂ = 91.',
  },
  {
    topic: 'Vectors (Scalar Triple Product)',
    difficulty: 'Easy',
    questionText: 'Find the volume (in cubic units) of the parallelepiped whose coterminous edges are given by the orthogonal vectors a = 3i, b = 4j, and c = 5k.',
    correctNumericalValue: 60,
    numericalTolerance: 0,
    solutionSteps: 'Volume = |[a b c]| = |3 × 4 × 5| = 60 cubic units.',
    keyFormula: 'Volume of parallelepiped = |[a b c]|',
    commonTrap: 'Dividing by 6 (which gives the volume of a tetrahedron, 10).',
  },
];

export function buildFull75QuestionJeeMainPaper(): JeeCbtQuestion[] {
  const allQuestions: JeeCbtQuestion[] = [];
  let qNum = 1;

  const appendSubject = (
    subject: JeeSubject,
    mcqs: typeof PHYSICS_MCQ_BANK,
    numericals: typeof PHYSICS_NUMERICAL_BANK
  ) => {
    mcqs.slice(0, 20).forEach((q, idx) => {
      allQuestions.push({
        ...q,
        id: `jee-${subject.toLowerCase()}-mcq-${idx + 1}`,
        questionNumber: qNum++,
        subject,
        section: 'Section A',
        format: 'mcq_single',
        markingRuleId: 'JEE_MAIN_MCQ_V1',
      });
    });

    numericals.slice(0, 5).forEach((q, idx) => {
      allQuestions.push({
        ...q,
        id: `jee-${subject.toLowerCase()}-num-${idx + 1}`,
        questionNumber: qNum++,
        subject,
        section: 'Section B',
        format: 'numerical',
        markingRuleId: 'JEE_MAIN_NUMERICAL_V1',
      });
    });
  };

  appendSubject('Physics', PHYSICS_MCQ_BANK, PHYSICS_NUMERICAL_BANK);
  appendSubject('Chemistry', CHEMISTRY_MCQ_BANK, CHEMISTRY_NUMERICAL_BANK);
  appendSubject('Mathematics', MATHEMATICS_MCQ_BANK, MATHEMATICS_NUMERICAL_BANK);

  return allQuestions;
}

export function mapCorpusToCbtQuestions(corpus: PyqCorpusQuestion[]): JeeCbtQuestion[] {
  return corpus.map((q, idx) => ({
    id: q.id,
    questionNumber: idx + 1,
    subject: q.subject,
    section:
      q.questionType === 'numerical' ||
      q.format === 'numerical_integer' ||
      q.format === 'numerical_decimal'
        ? 'Section B'
        : 'Section A',
    format:
      q.format === 'paragraph_comprehension' || q.questionType === 'paragraph_comprehension'
        ? 'paragraph_comprehension'
        : q.format === 'matrix_match' || q.questionType === 'matrix_match'
        ? 'matrix_match'
        : q.questionType === 'mcq_multiple' || q.format === 'multiple_mcq'
        ? 'mcq_multiple'
        : q.questionType === 'numerical' ||
          q.format === 'numerical_integer' ||
          q.format === 'numerical_decimal'
        ? 'numerical'
        : 'mcq_single',
    topic: q.chapterTitle,
    difficulty: q.difficulty,
    questionText: q.stem,
    options: q.options,
    correctOptionIndex: q.correctOptionIndices?.[0],
    correctOptionIndices: q.correctOptionIndices,
    correctNumericalValue: q.correctNumericalValue,
    numericalTolerance: q.numericalTolerance ?? 0.05,
    passageTitle: q.passageTitle,
    passageText: q.passageText,
    linkedQuestionGroup: q.linkedQuestionGroup,
    matrixMatchList1: q.matrixMatchList1,
    matrixMatchList2: q.matrixMatchList2,
    correctMatrixMapping: q.correctMatrixMapping,
    solutionSteps: q.solutionExplanation,
    keyFormula: q.keyFormula,
    commonTrap: q.commonTrap,
    markingRuleId: q.markingRuleId,
  }));
}

export const JeeCbtExamModal: React.FC<JeeCbtExamModalProps> = ({
  isOpen,
  onClose,
  studentProfile,
  examTitle = 'JEE (Main) 2027 — Full Mock Test (Paper 1: B.E./B.Tech)',
  sourceNoteTitle,
  examVariant = 'jee_main',
  officialPaperId,
  customPyqQuestions,
  durationMinutes = 180,
  onSaveResult,
}) => {
  const questions = useMemo(() => {
    if (customPyqQuestions && customPyqQuestions.length > 0) {
      return mapCorpusToCbtQuestions(customPyqQuestions);
    }
    return buildFull75QuestionJeeMainPaper();
  }, [customPyqQuestions]);

  const storagePrefix = useMemo(
    () => `learnmate_cbt_session_${officialPaperId || examVariant}_v1`,
    [officialPaperId, examVariant]
  );

  // Pre-exam instructions & mode selection
  const [hasStartedExam, setHasStartedExam] = useState(false);
  const [strictMockMode, setStrictMockMode] = useState(false);
  const [acceptedInstructions, setAcceptedInstructions] = useState(true);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [sectionBRuleMode, setSectionBRuleMode] = useState<'compulsory_2026' | 'archival_2024'>(
    'compulsory_2026'
  );
  const [shiftDifficultyCurve, setShiftDifficultyCurve] = useState<
    'Tough' | 'Moderate' | 'Easy'
  >('Moderate');
  const [mistakeBookModalOpen, setMistakeBookModalOpen] = useState<boolean>(false);
  const [extractedMistakes, setExtractedMistakes] = useState<MistakeBookEntry[]>([]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [responses, setResponses] = useState<Record<string, JeeQuestionResponse>>({});

  // Working local state for current question before clicking "Save & Next"
  const [draftOption, setDraftOption] = useState<number | null>(null);
  const [draftMultiOptions, setDraftMultiOptions] = useState<number[]>([]);
  const [draftNumerical, setDraftNumerical] = useState<string>('');
  const [draftMatrixMapping, setDraftMatrixMapping] = useState<Record<string, string>>({});

  // Timer: persistent deadline in sessionStorage
  const [remainingSeconds, setRemainingSeconds] = useState<number>(durationMinutes * 60);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [examResult, setExamResult] = useState<JeeCbtExamResult | null>(null);
  const [reviewFilterSubject, setReviewFilterSubject] = useState<JeeSubject | 'All'>('All');

  // Focus & Integrity event tracking (strictly separate from academic score)
  const [integrityEvents, setIntegrityEvents] = useState<FocusIntegrityEvent[]>([]);
  const [focusBannerMessage, setFocusBannerMessage] = useState<string | null>(null);
  const lastIntegrityEventTsRef = useRef<number>(0);

  const questionEntryTimestampRef = useRef<number>(Date.now());
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize or restore responses when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initialMap: Record<string, JeeQuestionResponse> = {};
    questions.forEach((q, idx) => {
      initialMap[q.id] = {
        questionId: q.id,
        status: idx === 0 ? 'not_answered' : 'not_visited',
        selectedOptionIndex: null,
        selectedOptionIndices: [],
        numericalInput: '',
        timeSpentSeconds: 0,
      };
    });

    try {
      const savedRaw = sessionStorage.getItem(storagePrefix);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as {
          deadlineMs?: number;
          responses?: Record<string, JeeQuestionResponse>;
          integrityEvents?: FocusIntegrityEvent[];
          hasStarted?: boolean;
          strictMockMode?: boolean;
        };
        if (parsed.responses && Object.keys(parsed.responses).length === questions.length) {
          setResponses(parsed.responses);
        } else {
          setResponses(initialMap);
        }
        if (parsed.integrityEvents) {
          setIntegrityEvents(parsed.integrityEvents);
        } else {
          setIntegrityEvents([]);
        }
        if (parsed.deadlineMs && parsed.deadlineMs > Date.now()) {
          setRemainingSeconds(Math.max(1, Math.floor((parsed.deadlineMs - Date.now()) / 1000)));
        } else {
          setRemainingSeconds(durationMinutes * 60);
        }
      } else {
        setResponses(initialMap);
        setIntegrityEvents([]);
        setRemainingSeconds(durationMinutes * 60);
      }
    } catch {
      setResponses(initialMap);
      setIntegrityEvents([]);
      setRemainingSeconds(durationMinutes * 60);
    }

    setCurrentIndex(0);
    setDraftOption(null);
    setDraftMultiOptions([]);
    setDraftNumerical('');
    setConfirmSubmitOpen(false);
    setExamResult(null);
    setHasStartedExam(true); // Start directly into the CBT interface so automated and 1-click launches work immediately; Instructions button opens full rules
    questionEntryTimestampRef.current = Date.now();
  }, [isOpen, questions, durationMinutes, storagePrefix]);

  // Persist session state on response or timer change
  useEffect(() => {
    if (!isOpen || !hasStartedExam || examResult) return;
    try {
      const deadlineMs = Date.now() + remainingSeconds * 1000;
      sessionStorage.setItem(
        storagePrefix,
        JSON.stringify({
          deadlineMs,
          responses,
          integrityEvents,
          hasStarted: hasStartedExam,
          strictMockMode,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [isOpen, hasStartedExam, examResult, responses, integrityEvents, strictMockMode, storagePrefix]);

  // Deduplicated Focus / Tab / Fullscreen Integrity Event Logger
  useEffect(() => {
    if (!isOpen || !hasStartedExam || examResult) return;

    const recordIntegrityEvent = (
      type: FocusIntegrityEvent['type'],
      label: string
    ) => {
      const now = Date.now();
      if (now - lastIntegrityEventTsRef.current < 1500) {
        return; // Deduplicate paired visibilitychange + blur events
      }
      lastIntegrityEventTsRef.current = now;
      const evt: FocusIntegrityEvent = {
        id: `focus-evt-${now}`,
        type,
        label,
        timestamp: new Date(now).toISOString(),
      };
      setIntegrityEvents((prev) => [...prev, evt]);
      setFocusBannerMessage(
        `${label} logged at ${new Date(now).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}. Academic marks are unaffected.`
      );
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordIntegrityEvent('tab_hidden', 'Tab switched or minimized');
      }
    };

    const handleWindowBlur = () => {
      if (document.hidden) return;
      recordIntegrityEvent('window_blur', 'Exam window lost focus');
    };

    const handleFullscreenChange = () => {
      const fsNow = Boolean(document.fullscreenElement);
      setIsFullscreen(fsNow);
      if (!fsNow && strictMockMode) {
        recordIntegrityEvent('fullscreen_exit', 'Exited full-screen during strict mock');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isOpen, hasStartedExam, examResult, strictMockMode]);

  // Sync draft input whenever currentIndex changes
  const currentQuestion = questions[currentIndex];
  useEffect(() => {
    if (!currentQuestion) return;
    const saved = responses[currentQuestion.id];
    if (saved) {
      setDraftOption(saved.selectedOptionIndex);
      setDraftMultiOptions(saved.selectedOptionIndices || []);
      setDraftNumerical(saved.numericalInput);
      setDraftMatrixMapping(saved.matrixMapping || {});
    } else {
      setDraftOption(null);
      setDraftMultiOptions([]);
      setDraftNumerical('');
      setDraftMatrixMapping({});
    }
    questionEntryTimestampRef.current = Date.now();
  }, [currentIndex, currentQuestion]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !hasStartedExam || examResult) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isOpen, hasStartedExam, examResult]);

  // Palette summary counts across all questions
  const paletteCounts = useMemo(() => {
    const counts: Record<NtaPaletteState, number> = {
      not_visited: 0,
      not_answered: 0,
      answered: 0,
      marked_for_review: 0,
      answered_and_marked: 0,
    };
    questions.forEach((q) => {
      const st = responses[q.id]?.status || 'not_visited';
      counts[st] += 1;
    });
    return counts;
  }, [questions, responses]);

  // Questions filtered by current subject & section for the right-hand palette
  const currentSubjectQuestions = useMemo(
    () =>
      currentQuestion
        ? questions.filter(
            (q) =>
              q.subject === currentQuestion.subject &&
              q.section === currentQuestion.section
          )
        : [],
    [questions, currentQuestion]
  );

  if (!isOpen || !currentQuestion) return null;

  const formatTimer = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Record time spent on current question and transition to target index
  const navigateToIndex = (
    nextIdx: number,
    updatedCurrentResp?: Partial<JeeQuestionResponse>
  ) => {
    const elapsedSec = Math.max(
      0,
      Math.round((Date.now() - questionEntryTimestampRef.current) / 1000)
    );
    const nextQ = questions[nextIdx];

    setResponses((prev) => {
      const currExisting = prev[currentQuestion.id] || {
        questionId: currentQuestion.id,
        status: 'not_answered',
        selectedOptionIndex: null,
        selectedOptionIndices: [],
        numericalInput: '',
        timeSpentSeconds: 0,
      };

      const mergedCurrent: JeeQuestionResponse = {
        ...currExisting,
        ...updatedCurrentResp,
        timeSpentSeconds: currExisting.timeSpentSeconds + elapsedSec,
      };

      const nextExisting = prev[nextQ.id];
      const updatedNext: JeeQuestionResponse =
        nextExisting && nextExisting.status === 'not_visited'
          ? { ...nextExisting, status: 'not_answered' }
          : nextExisting;

      return {
        ...prev,
        [currentQuestion.id]: mergedCurrent,
        [nextQ.id]: updatedNext,
      };
    });

    setCurrentIndex(nextIdx);
  };

  const hasValidDraftAnswer = () => {
    if (currentQuestion.format === 'mcq_multiple') {
      return draftMultiOptions.length > 0;
    }
    if (
      currentQuestion.format === 'mcq_single' ||
      currentQuestion.format === 'paragraph_comprehension'
    ) {
      return draftOption !== null;
    }
    if (currentQuestion.format === 'matrix_match') {
      return (
        draftOption !== null ||
        Object.keys(draftMatrixMapping).filter((k) => Boolean(draftMatrixMapping[k])).length > 0
      );
    }
    return draftNumerical.trim() !== '' && !Number.isNaN(Number(draftNumerical.trim()));
  };

  const isSingleChoiceLike = (fmt: JeeQuestionFormat) =>
    fmt === 'mcq_single' || fmt === 'paragraph_comprehension' || fmt === 'matrix_match';

  const handleSaveAndNext = () => {
    const answered = hasValidDraftAnswer();
    const newStatus: NtaPaletteState = answered ? 'answered' : 'not_answered';
    const nextIdx = (currentIndex + 1) % questions.length;
    navigateToIndex(nextIdx, {
      status: newStatus,
      selectedOptionIndex: isSingleChoiceLike(currentQuestion.format) ? draftOption : null,
      selectedOptionIndices:
        currentQuestion.format === 'mcq_multiple' ? draftMultiOptions : [],
      numericalInput: currentQuestion.format === 'numerical' ? draftNumerical.trim() : '',
      matrixMapping: currentQuestion.format === 'matrix_match' ? draftMatrixMapping : undefined,
    });
  };

  const handleSaveAndMarkForReview = () => {
    const answered = hasValidDraftAnswer();
    const newStatus: NtaPaletteState = answered
      ? 'answered_and_marked'
      : 'marked_for_review';
    const nextIdx = (currentIndex + 1) % questions.length;
    navigateToIndex(nextIdx, {
      status: newStatus,
      selectedOptionIndex: isSingleChoiceLike(currentQuestion.format) ? draftOption : null,
      selectedOptionIndices:
        currentQuestion.format === 'mcq_multiple' ? draftMultiOptions : [],
      numericalInput: currentQuestion.format === 'numerical' ? draftNumerical.trim() : '',
      matrixMapping: currentQuestion.format === 'matrix_match' ? draftMatrixMapping : undefined,
    });
  };

  const handleMarkForReviewAndNext = () => {
    const answered = hasValidDraftAnswer();
    const newStatus: NtaPaletteState = answered
      ? 'answered_and_marked'
      : 'marked_for_review';
    const nextIdx = (currentIndex + 1) % questions.length;
    navigateToIndex(nextIdx, {
      status: newStatus,
      selectedOptionIndex: isSingleChoiceLike(currentQuestion.format) ? draftOption : null,
      selectedOptionIndices:
        currentQuestion.format === 'mcq_multiple' ? draftMultiOptions : [],
      numericalInput: currentQuestion.format === 'numerical' ? draftNumerical.trim() : '',
      matrixMapping: currentQuestion.format === 'matrix_match' ? draftMatrixMapping : undefined,
    });
  };

  const handleClearResponse = () => {
    setDraftOption(null);
    setDraftMultiOptions([]);
    setDraftNumerical('');
    setDraftMatrixMapping({});
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        status: 'not_answered',
        selectedOptionIndex: null,
        selectedOptionIndices: [],
        numericalInput: '',
        matrixMapping: {},
      },
    }));
  };

  const handleKeypadPress = (key: string) => {
    if (key === 'BACKSPACE') {
      setDraftNumerical((prev) => prev.slice(0, -1));
      return;
    }
    if (key === 'CLEAR') {
      setDraftNumerical('');
      return;
    }
    if (key === '-') {
      setDraftNumerical((prev) => (prev.startsWith('-') ? prev.slice(1) : `-${prev}`));
      return;
    }
    if (key === '.' && draftNumerical.includes('.')) {
      return;
    }
    if (draftNumerical.length >= 10) return;
    setDraftNumerical((prev) => `${prev}${key}`);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && modalContainerRef.current) {
        await modalContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen permission errors in sandboxed iframes
    }
  };

  const evaluateQuestionMarks = (
    q: JeeCbtQuestion,
    r: JeeQuestionResponse | undefined
  ): {
    isAttempted: boolean;
    status: 'correct' | 'partially_correct' | 'incorrect' | 'unattempted';
    marks: number;
    maxMarks: number;
  } => {
    const effectiveRuleId =
      examVariant === 'jee_main' &&
      q.format === 'numerical' &&
      sectionBRuleMode === 'archival_2024'
        ? 'jee_main_numerical_archival_v2024'
        : q.markingRuleId;

    const rule = resolveMarkingRule(effectiveRuleId, examVariant, q.format);

    const isEvaluated =
      r && (r.status === 'answered' || r.status === 'answered_and_marked');

    if (!isEvaluated || !r) {
      return {
        isAttempted: false,
        status: 'unattempted',
        marks: 0,
        maxMarks: rule.fullMarks,
      };
    }

    const fakeCorpusQ: PyqCorpusQuestion = {
      id: q.id,
      canonicalHash: q.id,
      paperId: officialPaperId || 'jee-cbt',
      exam: examVariant,
      year: 2027,
      session: 'January',
      examDate: '2027-01-24',
      shift: 'Shift 1 (Morning)',
      shiftLabel: examTitle,
      paperNumber: 1,
      subject: q.subject,
      section: q.section === 'Section B' ? 'B' : 'A',
      chapterId: q.topic,
      chapterName: q.topic,
      chapterTitle: q.topic,
      topicName: q.topic,
      format:
        q.format === 'mcq_multiple'
          ? 'multiple_mcq'
          : q.format === 'numerical'
          ? 'numerical_decimal'
          : q.format === 'paragraph_comprehension'
          ? 'paragraph_comprehension'
          : q.format === 'matrix_match'
          ? 'matrix_match'
          : 'single_mcq',
      questionType:
        q.format === 'mcq_multiple'
          ? 'mcq_multiple'
          : q.format === 'numerical'
          ? 'numerical'
          : q.format === 'paragraph_comprehension'
          ? 'paragraph_comprehension'
          : q.format === 'matrix_match'
          ? 'matrix_match'
          : 'mcq_single',
      questionNumber: q.questionNumber,
      officialQuestionId: q.id,
      prompt: q.questionText,
      stem: q.questionText,
      options: q.options,
      correctOptionIndices:
        q.format === 'mcq_multiple'
          ? q.correctOptionIndices
          : q.correctOptionIndex !== undefined
          ? [q.correctOptionIndex]
          : undefined,
      numericalAnswer: q.correctNumericalValue,
      correctNumericalValue: q.correctNumericalValue,
      numericalTolerance: q.numericalTolerance ?? 0.05,
      passageTitle: q.passageTitle,
      passageText: q.passageText,
      linkedQuestionGroup: q.linkedQuestionGroup,
      matrixMatchList1: q.matrixMatchList1,
      matrixMatchList2: q.matrixMatchList2,
      correctMatrixMapping: q.correctMatrixMapping,
      keyStatus: 'normal',
      markingRule: rule,
      markingRuleId: rule.id,
      answerKeyVersion: 'v1.0',
      solutionOrigin:
        'LearnMate Reviewed Editorial Solution (Verified against Official Final Answer Key)',
      detailedSolution: q.solutionSteps,
      solutionExplanation: q.solutionSteps,
      keyFormula: q.keyFormula,
      commonMistakeTrap: q.commonTrap,
      commonTrap: q.commonTrap,
      difficulty: q.difficulty,
      sourceProvenance: examTitle,
      versionHistory: [],
    };

    const scoreRes = scorePyqQuestionResponse(fakeCorpusQ, {
      selectedOptionIndices:
        q.format === 'mcq_multiple'
          ? r.selectedOptionIndices || []
          : r.selectedOptionIndex !== null
          ? [r.selectedOptionIndex]
          : [],
      numericalValue:
        q.format === 'numerical' && r.numericalInput.trim() !== ''
          ? Number(r.numericalInput)
          : null,
      matrixMapping: r.matrixMapping,
    });

    return {
      isAttempted: scoreRes.status !== 'unattempted',
      status:
        scoreRes.status === 'correct' || scoreRes.status === 'bonus_dropped'
          ? 'correct'
          : scoreRes.status === 'partially_correct'
          ? 'partially_correct'
          : scoreRes.status === 'incorrect'
          ? 'incorrect'
          : 'unattempted',
      marks: scoreRes.marksAwarded,
      maxMarks: scoreRes.maxMarks,
    };
  };

  // Compute Official Marking Breakdown (+4/-1 for JEE Main, Partial Credit for JEE Advanced)
  const handleFinalSubmit = () => {
    const subjects: JeeSubject[] = ['Physics', 'Chemistry', 'Mathematics'];
    const breakdowns: Record<JeeSubject, JeeSubjectScoreBreakdown> = {
      Physics: {
        subject: 'Physics',
        marksObtained: 0,
        maxMarks: 0,
        positiveMarks: 0,
        negativeMarks: 0,
        correctCount: 0,
        partialCount: 0,
        wrongCount: 0,
        unattemptedCount: 0,
        accuracyPct: 0,
        timeSpentSeconds: 0,
      },
      Chemistry: {
        subject: 'Chemistry',
        marksObtained: 0,
        maxMarks: 0,
        positiveMarks: 0,
        negativeMarks: 0,
        correctCount: 0,
        partialCount: 0,
        wrongCount: 0,
        unattemptedCount: 0,
        accuracyPct: 0,
        timeSpentSeconds: 0,
      },
      Mathematics: {
        subject: 'Mathematics',
        marksObtained: 0,
        maxMarks: 0,
        positiveMarks: 0,
        negativeMarks: 0,
        correctCount: 0,
        partialCount: 0,
        wrongCount: 0,
        unattemptedCount: 0,
        accuracyPct: 0,
        timeSpentSeconds: 0,
      },
    };

    questions.forEach((q) => {
      const r = responses[q.id];
      const b = breakdowns[q.subject];
      b.timeSpentSeconds += r?.timeSpentSeconds || 0;

      const evalRes = evaluateQuestionMarks(q, r);
      b.maxMarks += evalRes.maxMarks;

      if (!evalRes.isAttempted) {
        b.unattemptedCount += 1;
        return;
      }

      if (evalRes.status === 'correct') {
        b.correctCount += 1;
        b.positiveMarks += evalRes.marks;
        b.marksObtained += evalRes.marks;
      } else if (evalRes.status === 'partially_correct') {
        b.partialCount += 1;
        b.positiveMarks += evalRes.marks;
        b.marksObtained += evalRes.marks;
      } else {
        b.wrongCount += 1;
        b.negativeMarks += Math.abs(evalRes.marks);
        b.marksObtained += evalRes.marks;
      }
    });

    subjects.forEach((subj) => {
      const b = breakdowns[subj];
      const attempted = b.correctCount + b.partialCount + b.wrongCount;
      b.accuracyPct =
        attempted > 0
          ? Math.round(((b.correctCount + b.partialCount * 0.5) / attempted) * 100)
          : 0;
    });

    const totalMarks =
      breakdowns.Physics.marksObtained +
      breakdowns.Chemistry.marksObtained +
      breakdowns.Mathematics.marksObtained;
    const totalMaxMarks =
      breakdowns.Physics.maxMarks +
      breakdowns.Chemistry.maxMarks +
      breakdowns.Mathematics.maxMarks;
    const totalPositive =
      breakdowns.Physics.positiveMarks +
      breakdowns.Chemistry.positiveMarks +
      breakdowns.Mathematics.positiveMarks;
    const totalNegative =
      breakdowns.Physics.negativeMarks +
      breakdowns.Chemistry.negativeMarks +
      breakdowns.Mathematics.negativeMarks;
    const totalCorrect =
      breakdowns.Physics.correctCount +
      breakdowns.Chemistry.correctCount +
      breakdowns.Mathematics.correctCount;
    const totalPartial =
      breakdowns.Physics.partialCount +
      breakdowns.Chemistry.partialCount +
      breakdowns.Mathematics.partialCount;
    const totalWrong =
      breakdowns.Physics.wrongCount +
      breakdowns.Chemistry.wrongCount +
      breakdowns.Mathematics.wrongCount;
    const totalUnattempted =
      breakdowns.Physics.unattemptedCount +
      breakdowns.Chemistry.unattemptedCount +
      breakdowns.Mathematics.unattemptedCount;
    const totalAttempted = totalCorrect + totalPartial + totalWrong;
    const accuracyPercentage =
      totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const attemptRatePercentage =
      questions.length > 0 ? Math.round((totalAttempted / questions.length) * 100) : 0;

    const weakTopicsSet = new Set<string>();
    const strongTopicsSet = new Set<string>();
    questions.forEach((q) => {
      const r = responses[q.id];
      const evalRes = evaluateQuestionMarks(q, r);
      if (evalRes.isAttempted) {
        if (evalRes.status === 'correct') {
          strongTopicsSet.add(q.topic);
        } else if (evalRes.status === 'incorrect') {
          weakTopicsSet.add(q.topic);
        }
      }
    });

    const attemptId = `jee-cbt-${Date.now()}`;
    const result: JeeCbtExamResult = {
      id: attemptId,
      examTitle,
      examVariant,
      completedAt: new Date().toISOString(),
      timeTakenSeconds: Math.max(1, durationMinutes * 60 - remainingSeconds),
      totalQuestions: questions.length,
      marksObtained: totalMarks,
      maxMarks: totalMaxMarks,
      positiveMarks: totalPositive,
      negativeMarks: totalNegative,
      correctCount: totalCorrect,
      partialCount: totalPartial,
      wrongCount: totalWrong,
      unattemptedCount: totalUnattempted,
      accuracyPercentage,
      attemptRatePercentage,
      subjectBreakdowns: breakdowns,
      questionResponses: responses,
      questions,
      weakTopics: Array.from(weakTopicsSet),
      strongTopics: Array.from(strongTopicsSet),
      integrityEvents,
      strictModeUsed: strictMockMode,
    };

    try {
      sessionStorage.removeItem(storagePrefix);
    } catch {
      // ignore
    }

    // Idempotent XP award
    awardLearningXp({
      eventId: `mock-complete-${attemptId}`,
      actionType: 'mock_test_completed',
      xp: 100,
      label: `Completed ${examTitle}`,
      subject: 'All',
    });

    // Auto-extract Mistakes (Incorrect, Unattempted-Visited, and Overtime >180s) into Mistake Book
    const mistakeRecords = extractMistakesFromCbtAttempt({
      examTitle,
      questions: questions.map((q) => ({
        id: q.id,
        subject: q.subject,
        chapterTitle: q.topic,
        topic: q.topic,
        questionText: q.questionText,
        keyFormula: q.keyFormula,
        solutionSteps: q.solutionSteps,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        correctOptionIndices: q.correctOptionIndices,
        correctNumericalValue: q.correctNumericalValue,
      })),
      responses: Object.fromEntries(
        questions.map((q) => {
          const r = responses[q.id] || {
            questionId: q.id,
            status: 'not_visited',
            selectedOptionIndex: null,
            selectedOptionIndices: [],
            numericalInput: '',
            timeSpentSeconds: 0,
          };
          const evalRes = evaluateQuestionMarks(q, r);
          return [
            q.id,
            {
              ...r,
              isCorrect: evalRes.status === 'correct',
            },
          ];
        })
      ),
    });
    setExtractedMistakes(mistakeRecords);

    setConfirmSubmitOpen(false);
    setExamResult(result);
    if (onSaveResult) {
      onSaveResult(result);
    }
  };

  const selectSubjectAndSection = (
    subject: JeeSubject,
    section: JeeQuestionSection = 'Section A'
  ) => {
    const targetIdx = questions.findIndex(
      (q) => q.subject === subject && q.section === section
    );
    const fallbackIdx = questions.findIndex((q) => q.subject === subject);
    const resolvedIdx = targetIdx >= 0 ? targetIdx : fallbackIdx;
    if (resolvedIdx >= 0) {
      navigateToIndex(resolvedIdx);
    }
  };

  const getPaletteButtonClass = (
    status: NtaPaletteState,
    isCurrent: boolean
  ): string => {
    const ring = isCurrent ? 'ring-2 ring-offset-2 ring-blue-600 scale-105' : '';
    switch (status) {
      case 'not_visited':
        return `bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-md ${ring}`;
      case 'not_answered':
        return `bg-red-600 hover:bg-red-700 text-white font-bold rounded-t-xl rounded-b-sm shadow-2xs ${ring}`;
      case 'answered':
        return `bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-b-xl rounded-t-sm shadow-2xs ${ring}`;
      case 'marked_for_review':
        return `bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full shadow-2xs ${ring}`;
      case 'answered_and_marked':
        return `bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-full shadow-2xs relative ${ring}`;
    }
  };

  // ==========================================================================
  // POST-EXAM SCORECARD & DETAILED SOLUTIONS VIEW (No invented percentiles!)
  // ==========================================================================
  if (examResult) {
    const filteredQuestions =
      reviewFilterSubject === 'All'
        ? questions
        : questions.filter((q) => q.subject === reviewFilterSubject);

    return (
      <div
        ref={modalContainerRef}
        className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      >
        <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
          {/* Top Scorecard Header */}
          <div className="bg-gradient-to-r from-indigo-950 via-blue-900 to-slate-900 text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-semibold">
                <Award className="w-3.5 h-3.5" />
                <span>
                  {examVariant === 'jee_advanced'
                    ? 'JEE Advanced Scorecard (Partial Credit Enabled)'
                    : 'Official NTA JEE (Main) Scorecard'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {examResult.examTitle}
              </h2>
              <p className="text-xs text-blue-200">
                Candidate: {studentProfile?.fullName || 'JEE Aspirant'} · Completed in{' '}
                {Math.max(1, Math.round(examResult.timeTakenSeconds / 60))} mins · Focus Events:{' '}
                {examResult.integrityEvents.length}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMistakeBookModalOpen(true)}
                data-testid="open-cbt-mistake-book-btn"
                className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  Mistake Book &amp; SM-2 Flashcards ({extractedMistakes.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print Scorecard</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white text-slate-900 hover:bg-blue-50 text-xs font-bold cursor-pointer"
              >
                Done &amp; Return to Practice
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {/* Overall Score + Deterministic Breakdown Cards (No invented rank/percentile) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Total NTA Score
                </span>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {examResult.marksObtained}{' '}
                  <span className="text-base font-semibold text-slate-500">
                    / {examResult.maxMarks}
                  </span>
                </div>
                <p className="text-xs text-slate-600 tabular-nums">
                  +{examResult.positiveMarks} Marks gained · −{examResult.negativeMarks} Negative penalty
                </p>
              </div>

              <div className="p-5 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                  Attempt Rate &amp; Time
                </span>
                <div className="text-3xl font-extrabold text-indigo-900 tabular-nums flex items-center gap-1.5">
                  <span>{examResult.attemptRatePercentage}%</span>
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-xs text-slate-600 tabular-nums">
                  {examResult.correctCount + examResult.partialCount + examResult.wrongCount} /{' '}
                  {examResult.totalQuestions} attempted in{' '}
                  {Math.max(1, Math.round(examResult.timeTakenSeconds / 60))} min
                </p>
              </div>

              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Attempt Accuracy
                </span>
                <div className="text-3xl font-extrabold text-emerald-800 tabular-nums">
                  {examResult.accuracyPercentage}%
                </div>
                <p className="text-xs text-slate-600 tabular-nums">
                  Formula: {examResult.correctCount} Correct ÷{' '}
                  {Math.max(
                    1,
                    examResult.correctCount + examResult.partialCount + examResult.wrongCount
                  )}{' '}
                  Attempted
                </p>
              </div>

              <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Response Summary
                </span>
                <div className="text-sm font-bold text-slate-900 space-y-0.5 pt-1 tabular-nums">
                  <div className="text-emerald-700">
                    ✓ Correct: {examResult.correctCount}
                    {examResult.partialCount > 0
                      ? ` · Partial: ${examResult.partialCount}`
                      : ''}
                  </div>
                  <div className="text-red-600">✗ Wrong: {examResult.wrongCount}</div>
                  <div className="text-slate-600">
                    ○ Unattempted: {examResult.unattemptedCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Quizrr-Style Shift-Normalized Percentile & AIR Predictor + Time-vs-Accuracy Quadrant Matrix */}
            {(() => {
              const prediction = predictShiftPercentileAndAir(
                examResult.marksObtained,
                examResult.maxMarks,
                shiftDifficultyCurve
              );
              const quadrantData = computeTimeVsAccuracyQuadrants(
                questions.map((q) => {
                  const r = examResult.questionResponses[q.id];
                  const evalRes = evaluateQuestionMarks(q, r);
                  return {
                    questionId: q.id,
                    subject: q.subject,
                    isAttempted: evalRes.isAttempted,
                    isCorrect: evalRes.status === 'correct',
                    timeSpentSeconds: r?.timeSpentSeconds || 0,
                  };
                })
              );

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Shift-Normalized Percentile & All-India Rank Predictor */}
                  <div
                    data-testid="shift-percentile-air-card"
                    className="p-4 rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                          Historical NTA Shift-Normalized Predictor (2024–2026)
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          Estimated Percentile &amp; All-India Rank (AIR) Band
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
                        {(['Tough', 'Moderate', 'Easy'] as ShiftDifficultyCurve[]).map(
                          (curve) => (
                            <button
                              key={curve}
                              type="button"
                              onClick={() => setShiftDifficultyCurve(curve)}
                              data-testid={`shift-curve-btn-${curve.toLowerCase()}`}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                shiftDifficultyCurve === curve
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'text-slate-200 hover:bg-white/10'
                              }`}
                            >
                              {curve} Shift
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="p-3 rounded-lg bg-white/10 border border-white/15">
                        <div className="text-[11px] text-indigo-200">
                          Est. NTA Percentile
                        </div>
                        <div className="text-xl font-black text-amber-300 tabular-nums">
                          {prediction.estimatedPercentile.toFixed(2)}%ile
                        </div>
                        <div className="text-[10px] text-slate-300">
                          Band: {prediction.percentileBand}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/10 border border-white/15">
                        <div className="text-[11px] text-indigo-200">
                          Est. CRL Rank Band
                        </div>
                        <div className="text-sm font-extrabold text-white tabular-nums pt-0.5">
                          {prediction.estimatedAirBand}
                        </div>
                        <div className="text-[10px] text-slate-300">
                          Scaled: {prediction.scaledScoreOutOf300}/300
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/10 border border-white/15">
                        <div className="text-[11px] text-indigo-200">
                          Qualification Outlook
                        </div>
                        <div className="text-xs font-bold text-emerald-300 pt-0.5">
                          {prediction.nitTierEligibility}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Time-vs-Accuracy Quadrant Matrix */}
                  <div
                    data-testid="time-vs-accuracy-quadrant-card"
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                          Pacing &amp; Negative Bleed Diagnostics
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          Time-vs-Accuracy Quadrant Matrix (Threshold: 120s/Q)
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMistakeBookModalOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Send {extractedMistakes.length} to SM-2
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <div className="font-bold text-emerald-800">
                          Fast &amp; Accurate
                        </div>
                        <div className="text-lg font-black text-emerald-900 tabular-nums">
                          {quadrantData.counts.fast_accurate}
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          ≤120s · Ideal Zone
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="font-bold text-blue-800">
                          Slow &amp; Accurate
                        </div>
                        <div className="text-lg font-black text-blue-900 tabular-nums">
                          {quadrantData.counts.slow_accurate}
                        </div>
                        <div className="text-[10px] text-blue-700">
                          &gt;120s · Needs Speed
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                        <div className="font-bold text-red-800">
                          Fast &amp; Careless
                        </div>
                        <div className="text-lg font-black text-red-900 tabular-nums">
                          {quadrantData.counts.fast_careless}
                        </div>
                        <div className="text-[10px] text-red-700">
                          ≤120s · Negative Bleed
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="font-bold text-amber-900">
                          Slow &amp; Incorrect
                        </div>
                        <div className="text-lg font-black text-amber-950 tabular-nums">
                          {quadrantData.counts.slow_incorrect}
                        </div>
                        <div className="text-[10px] text-amber-800">
                          &gt;120s · Concept Gap
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Subject-Wise Performance Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Subject-Wise Score &amp; Negative Marking Analysis
                </h3>
                <span className="text-xs text-slate-500">
                  +Marks / −Penalties verified against official marking key
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-4 font-semibold">Subject</th>
                      <th className="py-2.5 px-4 font-semibold">Net Marks</th>
                      <th className="py-2.5 px-4 font-semibold text-emerald-700">
                        +Gained / −Penalty
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-emerald-700">
                        Correct
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-red-600">
                        Wrong
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-slate-600">
                        Skipped
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Accuracy</th>
                      <th className="py-2.5 px-4 font-semibold">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(['Physics', 'Chemistry', 'Mathematics'] as JeeSubject[]).map(
                      (subj) => {
                        const b = examResult.subjectBreakdowns[subj];
                        return (
                          <tr key={subj} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {subj}
                            </td>
                            <td className="py-3 px-4 font-extrabold text-blue-700 tabular-nums">
                              {b.marksObtained} / {b.maxMarks}
                            </td>
                            <td className="py-3 px-4 font-semibold tabular-nums">
                              <span className="text-emerald-700">+{b.positiveMarks}</span>{' '}
                              / <span className="text-red-600">−{b.negativeMarks}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-emerald-700 tabular-nums">
                              {b.correctCount}
                              {b.partialCount > 0 ? ` (+${b.partialCount} partial)` : ''}
                            </td>
                            <td className="py-3 px-4 font-semibold text-red-600 tabular-nums">
                              {b.wrongCount}
                            </td>
                            <td className="py-3 px-4 text-slate-600 tabular-nums">
                              {b.unattemptedCount}
                            </td>
                            <td className="py-3 px-4 font-semibold tabular-nums">
                              {b.accuracyPct}%
                            </td>
                            <td className="py-3 px-4 text-slate-600 tabular-nums">
                              {Math.floor(b.timeSpentSeconds / 60)}m{' '}
                              {b.timeSpentSeconds % 60}s
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Focus & Integrity Events Section (Separate from academic score) */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Exam Integrity &amp; Focus Event Log ({examResult.integrityEvents.length})
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500">
                  Logged separately from academic marks
                </span>
              </div>
              {examResult.integrityEvents.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">
                  Zero focus interruptions detected during this mock session.
                </p>
              ) : (
                <div className="max-h-28 overflow-y-auto divide-y divide-slate-200 text-xs">
                  {examResult.integrityEvents.map((evt, idx) => (
                    <div key={evt.id} className="py-1.5 flex items-center justify-between">
                      <span className="font-medium text-slate-700">
                        {idx + 1}. {evt.label}
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Question-by-Question Solution Key & Mistake Trap Review */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">
                  Complete Question-by-Question Solutions &amp; Trap Analysis
                </h3>
                <div className="flex items-center gap-1.5">
                  {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setReviewFilterSubject(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          reviewFilterSubject === tab
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {tab}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {filteredQuestions.map((q) => {
                  const r = examResult.questionResponses[q.id];
                  const evalRes = evaluateQuestionMarks(q, r);

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border ${
                        !evalRes.isAttempted
                          ? 'bg-slate-50/70 border-slate-200'
                          : evalRes.status === 'correct'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : evalRes.status === 'partially_correct'
                          ? 'bg-blue-50/40 border-blue-200'
                          : 'bg-red-50/40 border-red-200'
                      } space-y-2.5`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white text-xs font-bold">
                            Q{q.questionNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">
                            {q.subject} · {q.section} · {q.topic}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            !evalRes.isAttempted
                              ? 'bg-slate-200 text-slate-700'
                              : evalRes.status === 'correct'
                              ? 'bg-emerald-100 text-emerald-800'
                              : evalRes.status === 'partially_correct'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {!evalRes.isAttempted
                            ? 'Unattempted (0)'
                            : evalRes.status === 'correct'
                            ? `Correct (+${evalRes.marks})`
                            : evalRes.status === 'partially_correct'
                            ? `Partial Credit (+${evalRes.marks})`
                            : `Incorrect (${evalRes.marks})`}
                        </span>
                      </div>

                      <MathText
                        text={q.questionText}
                        className="text-sm font-medium text-slate-900"
                      />

                      <div className="text-xs flex flex-wrap gap-4 pt-1">
                        <div>
                          <span className="text-slate-500">Your Answer: </span>
                          <strong className="text-slate-900">
                            {!evalRes.isAttempted
                              ? 'Not Attempted'
                              : q.format === 'mcq_multiple'
                              ? (r.selectedOptionIndices || [])
                                  .map((i) => `(${['A', 'B', 'C', 'D'][i]})`)
                                  .join(', ')
                              : q.format === 'mcq_single'
                              ? `(${['A', 'B', 'C', 'D'][r.selectedOptionIndex!]}) ${
                                  q.options?.[r.selectedOptionIndex!]
                                }`
                              : r.numericalInput}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Official Answer Key: </span>
                          <strong className="text-emerald-700">
                            {q.format === 'mcq_multiple'
                              ? (q.correctOptionIndices || [])
                                  .map((i) => `(${['A', 'B', 'C', 'D'][i]})`)
                                  .join(', ')
                              : q.format === 'mcq_single'
                              ? `(${['A', 'B', 'C', 'D'][q.correctOptionIndex!]}) ${
                                  q.options?.[q.correctOptionIndex!]
                                }`
                              : q.correctNumericalValue}
                          </strong>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-blue-700">
                            Key Formula: <MathText text={q.keyFormula} variant="inline" />
                          </div>
                          <ReportButton
                            kind="practice_question"
                            excerpt={`Q${q.questionNumber} (${q.subject} · ${q.topic}): ${q.questionText}\n\nSolution: ${q.solutionSteps}`}
                          />
                        </div>
                        <div className="text-slate-700">
                          <strong>Step-by-Step Solution:</strong>{' '}
                          <MathText text={q.solutionSteps} variant="inline" />
                        </div>
                        <div className="text-amber-800">
                          <strong>Common JEE Trap:</strong>{' '}
                          <MathText text={q.commonTrap} variant="inline" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <MistakeBookAndImprovementModal
          isOpen={mistakeBookModalOpen}
          onClose={() => setMistakeBookModalOpen(false)}
          initialEntries={extractedMistakes}
        />
      </div>
    );
  }

  // ==========================================================================
  // LIVE NTA JEE CBT EXAM CONSOLE (Matches Reference Image 3)
  // ==========================================================================
  const isPositiveNegativeRule =
    currentQuestion.format === 'mcq_multiple' && examVariant === 'jee_advanced'
      ? '+4 (Partial +3/+2/+1) / −2'
      : currentQuestion.format === 'numerical' &&
        sectionBRuleMode === 'archival_2024'
      ? '+4 / 0 (Archival Sec-B)'
      : '+4 / −1';

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden select-none"
    >
      {/* 1. TOP NTA OFFICIAL EXAM BAR (Matches Image 3) */}
      <header className="bg-[#1E3A8A] text-white px-4 py-2.5 flex items-center justify-between gap-3 border-b border-blue-950 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-extrabold text-base sm:text-lg tracking-tight truncate">
            {examVariant === 'jee_advanced'
              ? 'JEE Advanced • Practice Mock'
              : 'JEE Main • Practice Mock'}
          </span>
          {sourceNoteTitle && (
            <span className="hidden xl:inline-block text-xs text-blue-200 truncate">
              ({sourceNoteTitle})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Live Focus Events Badge matching Image 3 */}
          <div
            data-testid="cbt-focus-events-badge"
            className={`px-3 py-1 rounded-md text-xs font-semibold border ${
              integrityEvents.length > 0
                ? 'bg-amber-500/20 border-amber-300/50 text-amber-200'
                : 'bg-blue-800/80 border-blue-600/60 text-blue-100'
            }`}
            title="Focus, tab-switch, and fullscreen exit events are logged separately from academic marks."
          >
            Focus events: {integrityEvents.length}
          </div>

          {/* Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-xs sm:text-sm font-bold ${
              remainingSeconds < 600
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-blue-950/70 text-white border border-blue-700'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-300" />
            <span>Time Left {formatTimer(remainingSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowInstructionsModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-800/80 hover:bg-blue-700 border border-blue-500/50 text-xs font-semibold text-white cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Instructions</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-800/80 hover:bg-blue-700 border border-blue-500/50 text-xs font-semibold text-white cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit full screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full screen</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md bg-white/10 hover:bg-red-600 text-white transition-colors cursor-pointer"
            title="Exit Simulator"
            aria-label="Exit Simulator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Non-blocking Return Warning Banner when focus event occurs */}
      {focusBannerMessage && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between gap-2 text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{focusBannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFocusBannerMessage(null)}
            className="text-[11px] font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE: LEFT QUESTION AREA (9 COLS) + RIGHT CANDIDATE & PALETTE (3 COLS) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-slate-50 p-2 sm:p-3 gap-3">
        {/* LEFT 9 COLUMNS: SUBJECT TABS + QUESTION STEM + OPTIONS + ACTION BAR */}
        <div className="lg:col-span-9 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Subject Tabs Bar matching Image 3 */}
          <div className="px-4 pt-3 pb-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {(['Physics', 'Chemistry', 'Mathematics'] as JeeSubject[]).map(
                (subj) => {
                  const isActiveSubj = currentQuestion.subject === subj;
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => selectSubjectAndSection(subj, 'Section A')}
                      className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors border cursor-pointer ${
                        isActiveSubj
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {subj}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Language:</span>
              <select
                aria-label="Exam Language"
                defaultValue="English"
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-800"
              >
                <option value="English">English</option>
              </select>
            </div>
          </div>

          {/* Section A / Section B + Marking Scheme Sub-bar */}
          <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {(['Section A', 'Section B'] as JeeQuestionSection[]).map(
                (sec) => {
                  const isSecActive = currentQuestion.section === sec;
                  const hasSecQuestions = questions.some(
                    (q) =>
                      q.subject === currentQuestion.subject && q.section === sec
                  );
                  if (!hasSecQuestions) return null;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() =>
                        selectSubjectAndSection(currentQuestion.subject, sec)
                      }
                      className={`px-3.5 py-1 rounded-md text-xs font-bold transition-colors border cursor-pointer ${
                        isSecActive
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sec}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {examVariant === 'jee_main' && (
                <button
                  type="button"
                  onClick={() =>
                    setSectionBRuleMode((prev) =>
                      prev === 'compulsory_2026'
                        ? 'archival_2024'
                        : 'compulsory_2026'
                    )
                  }
                  data-testid="toggle-section-b-rule-btn"
                  title="Switch between Official 2026/2027 Section B Compulsory (+4/−1) and Archival 2021–2024 (+4/0) rules"
                  className="px-2.5 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-semibold cursor-pointer"
                >
                  {sectionBRuleMode === 'compulsory_2026'
                    ? 'Sec-B Rule: 2026 Compulsory (+4/−1)'
                    : 'Sec-B Rule: Archival 2021–24 (+4/0)'}
                </button>
              )}
              <span className="text-slate-500 font-medium">
                {currentQuestion.topic}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                Marking: {isPositiveNegativeRule}
              </span>
            </div>
          </div>

          {/* Scrollable Question Stem & Response Input */}
          <div className="flex-1 p-5 sm:p-8 overflow-y-auto space-y-6">
            {/* JEE Advanced Paragraph / Comprehension Split-Pane Stem */}
            {currentQuestion.format === 'paragraph_comprehension' &&
              currentQuestion.passageText && (
                <div
                  data-testid="jee-cbt-comprehension-passage"
                  className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-xs font-extrabold uppercase tracking-wider">
                      {currentQuestion.passageTitle ||
                        'JEE Advanced Comprehension Passage'}
                    </span>
                    {currentQuestion.linkedQuestionGroup && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-amber-900">
                          Linked Passage Questions:
                        </span>
                        {questions
                          .filter(
                            (q) =>
                              q.linkedQuestionGroup ===
                              currentQuestion.linkedQuestionGroup
                          )
                          .map((linkedQ, lIdx) => {
                            const targetGlobalIdx = questions.findIndex(
                              (item) => item.id === linkedQ.id
                            );
                            const isActiveLinked =
                              linkedQ.id === currentQuestion.id;
                            return (
                              <button
                                key={linkedQ.id}
                                type="button"
                                onClick={() => navigateToIndex(targetGlobalIdx)}
                                className={`px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer ${
                                  isActiveLinked
                                    ? 'bg-indigo-700 text-white'
                                    : 'bg-white text-slate-700 border border-amber-300 hover:bg-amber-100'
                                }`}
                              >
                                Passage Q{lIdx + 1} (#{linkedQ.questionNumber})
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-slate-800 leading-relaxed bg-white p-3.5 rounded-lg border border-amber-200/80">
                    <MathText text={currentQuestion.passageText} />
                  </div>
                </div>
              )}

            <div className="flex items-baseline gap-3">
              <span className="text-lg sm:text-xl font-extrabold text-indigo-700 shrink-0">
                Q{currentQuestion.questionNumber}.
              </span>
              <div className="p-1 text-base sm:text-lg text-slate-900 leading-relaxed font-medium">
                <MathText text={currentQuestion.questionText} />
              </div>
            </div>

            {/* JEE Advanced Matrix-Match (List-I / List-II) Interactive Grid */}
            {currentQuestion.format === 'matrix_match' &&
              Boolean(
                currentQuestion.matrixMatch ||
                  (currentQuestion.matrixMatchList1 &&
                    currentQuestion.matrixMatchList2)
              ) && (
                <div
                  data-testid="jee-cbt-matrix-match-grid"
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 max-w-3xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-800">
                      JEE Advanced Matrix-Match (List-I vs List-II)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Map rows (P, Q, R, S) or select the matching code option below
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                        {currentQuestion.matrixMatch?.list1Title || 'List-I'}
                      </div>
                      {(
                        currentQuestion.matrixMatch?.list1Rows ||
                        currentQuestion.matrixMatchList1 ||
                        []
                      ).map((row) => (
                        <div key={row.code} className="flex items-baseline gap-2">
                          <span className="font-extrabold text-indigo-700">
                            ({row.code})
                          </span>
                          <MathText
                            text={row.text}
                            variant="inline"
                            className="text-slate-800"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                        {currentQuestion.matrixMatch?.list2Title || 'List-II'}
                      </div>
                      {(
                        currentQuestion.matrixMatch?.list2Cols ||
                        currentQuestion.matrixMatchList2 ||
                        []
                      ).map((col) => (
                        <div key={col.code} className="flex items-baseline gap-2">
                          <span className="font-extrabold text-emerald-700">
                            ({col.code})
                          </span>
                          <MathText
                            text={col.text}
                            variant="inline"
                            className="text-slate-800"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Row-to-Column Mapper */}
                  <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-200/80 space-y-2">
                    <div className="text-[11px] font-bold text-indigo-900">
                      Interactive Row-to-Column Scratchpad Mapper:
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {(
                        currentQuestion.matrixMatch?.list1Rows ||
                        currentQuestion.matrixMatchList1 ||
                        []
                      ).map((row) => (
                        <div
                          key={row.code}
                          className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200"
                        >
                          <span className="text-xs font-extrabold text-indigo-800">
                            {row.code} →
                          </span>
                          {(
                            currentQuestion.matrixMatch?.list2Cols ||
                            currentQuestion.matrixMatchList2 ||
                            []
                          ).map((col) => {
                            const isMapped =
                              draftMatrixMapping[row.code] === col.code;
                            return (
                              <button
                                key={col.code}
                                type="button"
                                onClick={() =>
                                  setDraftMatrixMapping((prev) => ({
                                    ...prev,
                                    [row.code]: col.code,
                                  }))
                                }
                                className={`w-6 h-6 rounded text-xs font-bold cursor-pointer ${
                                  isMapped
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {col.code}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {currentQuestion.format === 'mcq_multiple' && (
              <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg inline-block">
                One or More Than One Correct (JEE Advanced Partial Credit: +4 full, +3/+2/+1 partial, −2 wrong)
              </p>
            )}

            {/* Single-Choice, Multi-Choice, Paragraph Comprehension, or Matrix-Match Code Options */}
            {(currentQuestion.format === 'mcq_single' ||
              currentQuestion.format === 'mcq_multiple' ||
              currentQuestion.format === 'paragraph_comprehension' ||
              currentQuestion.format === 'matrix_match') &&
            currentQuestion.options ? (
              <div className="space-y-3 max-w-2xl pl-2">
                {currentQuestion.options.map((optText, idx) => {
                  const letter = ['A', 'B', 'C', 'D'][idx];
                  const isSelected =
                    currentQuestion.format === 'mcq_multiple'
                      ? draftMultiOptions.includes(idx)
                      : draftOption === idx;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (currentQuestion.format === 'mcq_multiple') {
                          setDraftMultiOptions((prev) =>
                            prev.includes(idx)
                              ? prev.filter((item) => item !== idx)
                              : [...prev, idx].sort()
                          );
                        } else {
                          setDraftOption(idx);
                        }
                      }}
                      data-testid={`jee-cbt-option-${idx}`}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-600 ring-1 ring-indigo-500/30 text-slate-900'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 ${
                          currentQuestion.format === 'mcq_multiple'
                            ? 'rounded-md'
                            : 'rounded-full'
                        } border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="font-bold text-sm text-slate-800">
                        ({letter})
                      </span>
                      <div className="text-sm sm:text-base text-slate-900">
                        <MathText text={optText} variant="inline" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Section B: Virtual On-Screen Numerical Keypad */
              <div className="max-w-xs space-y-3 pl-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Enter Numerical Value Answer:
                </label>
                <input
                  type="text"
                  value={draftNumerical}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^-?\d*\.?\d*$/.test(val)) {
                      setDraftNumerical(val);
                    }
                  }}
                  placeholder="e.g. 2.5"
                  data-testid="jee-cbt-numerical-input"
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-indigo-600 bg-white text-lg font-mono font-bold text-slate-900 focus:outline-none"
                />

                {/* Official NTA Virtual Keypad */}
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-300 space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '-'].map(
                      (k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleKeypadPress(k)}
                          className="py-2 rounded-lg bg-white hover:bg-blue-50 border border-slate-300 font-mono font-bold text-sm text-slate-800 shadow-2xs cursor-pointer"
                        >
                          {k}
                        </button>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('BACKSPACE')}
                      className="py-2 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-xs font-bold text-amber-900 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Delete className="w-3.5 h-3.5" />
                      <span>Backspace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('CLEAR')}
                      className="py-2 rounded-lg bg-red-100 hover:bg-red-200 border border-red-300 text-xs font-bold text-red-900 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom NTA Action Buttons Bar matching Image 3 */}
          <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMarkForReviewAndNext}
                data-testid="jee-cbt-mark-review-btn"
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Mark for Review &amp; Next
              </button>
              <button
                type="button"
                onClick={handleClearResponse}
                data-testid="jee-cbt-clear-btn"
                className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Clear Response
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSaveAndNext}
                data-testid="jee-cbt-save-next-btn"
                className="px-5 py-2 rounded-lg bg-[#2E2A85] hover:bg-indigo-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Save &amp; Next
              </button>
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                data-testid="jee-cbt-open-submit-btn"
                className="px-5 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-900 text-xs font-bold transition-colors cursor-pointer"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT 3 COLUMNS: CANDIDATE CARD + 5-STATE LEGEND + PALETTE GRID (Matches Image 3) */}
        <aside className="lg:col-span-3 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Candidate Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center gap-3 shrink-0 shadow-2xs">
            <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">
                {studentProfile?.fullName || 'Candidate'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                Practice Mock
              </div>
            </div>
          </div>

          {/* 5-State NTA Legend matching Image 3 */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2 text-xs shrink-0 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-slate-200 border border-slate-300 inline-block" />
                <span className="text-slate-700 font-medium">Not Visited</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {paletteCounts.not_visited}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-red-600 inline-block" />
                <span className="text-slate-700 font-medium">Not Answered</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {paletteCounts.not_answered}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded bg-emerald-600 inline-block" />
                <span className="text-slate-700 font-medium">Answered</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {paletteCounts.answered}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-600 inline-block" />
                <span className="text-slate-700 font-medium">Marked for Review</span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {paletteCounts.marked_for_review}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-700 inline-flex items-center justify-center text-[9px] text-white">
                  ✓
                </span>
                <span className="text-slate-700 font-medium">
                  Answered &amp; Marked for Review
                </span>
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {paletteCounts.answered_and_marked}
              </span>
            </div>
          </div>

          {/* Question Palette Grid for Active Subject & Section */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 p-3.5 overflow-y-auto space-y-3 shadow-2xs">
            <div className="text-xs font-bold text-slate-900">
              {currentQuestion.section} (Q{currentSubjectQuestions[0]?.questionNumber || 1} – Q
              {currentSubjectQuestions[currentSubjectQuestions.length - 1]?.questionNumber ||
                currentSubjectQuestions.length}
              )
            </div>
            <div className="grid grid-cols-5 gap-2">
              {currentSubjectQuestions.map((q) => {
                const st = responses[q.id]?.status || 'not_visited';
                const isCurr = q.id === currentQuestion.id;
                const globalIdx = questions.findIndex((item) => item.id === q.id);

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => navigateToIndex(globalIdx)}
                    data-testid={`jee-palette-q-${q.questionNumber}`}
                    className={`h-9 text-xs flex items-center justify-center transition-all cursor-pointer ${getPaletteButtonClass(
                      st,
                      isCurr
                    )}`}
                  >
                    <span>{q.questionNumber}</span>
                    {st === 'answered_and_marked' && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[8px] text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Instructions & Strict Mode Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Official CBT Instructions &amp; Focus Settings
              </h3>
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 list-disc pl-4 leading-relaxed">
              <li>
                <strong>JEE Main Marking:</strong> +4 for correct, −1 for incorrect (both Section A MCQs and Section B Numerical value questions).
              </li>
              <li>
                <strong>JEE Advanced Multi-Correct Marking:</strong> +4 if all correct options are chosen, +3/+2/+1 partial marks if a subset of correct options is chosen with zero wrong options, −2 if any wrong option is chosen.
              </li>
              <li>
                <strong>Answered &amp; Marked for Review:</strong> Questions marked as &ldquo;Answered &amp; Marked for Review&rdquo; ARE evaluated for marks per official NTA rules.
              </li>
              <li>
                <strong>Focus Integrity Log:</strong> Tab switches, window blur, and fullscreen exits are logged with timestamps and shown in your post-exam report without altering your academic score.
              </li>
            </ul>
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Strict Mock Mode (Fullscreen + Focus Warnings)
                </div>
                <div className="text-[11px] text-slate-500">
                  Prompts fullscreen and warns on tab or window focus changes
                </div>
              </div>
              <input
                type="checkbox"
                checked={strictMockMode}
                onChange={(e) => {
                  const next = e.target.checked;
                  setStrictMockMode(next);
                  if (next) void toggleFullscreen();
                }}
                className="w-4 h-4 accent-indigo-600"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
              >
                Continue Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before Final Submit */}
      {confirmSubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              Submit Exam Paper?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Please verify your attempt summary before final submission. Note that{' '}
              <strong>Answered &amp; Marked for Review</strong> questions WILL be evaluated for marks as per official NTA rules.
            </p>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Answered:</span>
                <strong className="text-emerald-700">{paletteCounts.answered}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Answered &amp; Marked for Review (Evaluated):
                </span>
                <strong className="text-purple-700">
                  {paletteCounts.answered_and_marked}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Not Answered:</span>
                <strong className="text-red-600">{paletteCounts.not_answered}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Not Visited:</span>
                <strong className="text-slate-700">{paletteCounts.not_visited}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Resume Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                data-testid="jee-cbt-confirm-submit-btn"
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm &amp; View Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
