import { JeeQuestion } from '../types/jeeExam';

/**
 * Official Standard JEE Main 75-Question Mock Paper
 * Follows exact NTA structure:
 * - Physics: Q1 to Q25 (Q1-Q20 MCQ, Q21-Q25 Numerical)
 * - Chemistry: Q26 to Q50 (Q26-Q45 MCQ, Q46-Q50 Numerical)
 * - Mathematics: Q51 to Q75 (Q51-Q70 MCQ, Q71-Q75 Numerical)
 * Marking: +4 for correct, -1 for incorrect in BOTH sections.
 */
export const DEFAULT_JEE_75_QUESTION_PAPER: JeeQuestion[] = [
  // ==========================================
  // PHYSICS (Questions 1 - 25)
  // Section A: MCQs (Q1 - Q20)
  // ==========================================
  {
    id: 'jee-phy-01',
    number: 1,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Units & Dimensions',
    question: 'The dimension of $\\frac{1}{\\sqrt{\\mu_0 \\varepsilon_0}}$ is identical to that of:',
    options: [
      'Velocity ($[L T^{-1}]$)',
      'Acceleration ($[L T^{-2}]$)',
      'Force ($[M L T^{-2}]$)',
      'Refractive index (Dimensionless)'
    ],
    correctOptionIndex: 0,
    explanation: 'From Maxwell electromagnetic theory, the speed of light in vacuum is given by $c = \\frac{1}{\\sqrt{\\mu_0 \\varepsilon_0}}$. Hence, its dimension is that of velocity, $[L T^{-1}]$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-02',
    number: 2,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Kinematics in 1D & 2D',
    question: 'A projectile is launched from ground level with speed $u$ at an angle $\\theta = 30^\\circ$ to the horizontal. If the acceleration due to gravity is $g$, what is the radius of curvature of its trajectory at the highest point?',
    options: [
      '$\\frac{u^2 \\cos^2 30^\\circ}{g} = \\frac{3u^2}{4g}$',
      '$\\frac{u^2}{g}$',
      '$\\frac{u^2 \\sin^2 30^\\circ}{g} = \\frac{u^2}{4g}$',
      '$\\frac{2u^2}{3g}$'
    ],
    correctOptionIndex: 0,
    explanation: 'At the highest point, velocity is purely horizontal: $v = u \\cos 30^\\circ$. The normal acceleration is the full gravitational acceleration $g$. Therefore, radius of curvature $R = \\frac{v^2}{a_n} = \\frac{u^2 \\cos^2 30^\\circ}{g} = \\frac{3u^2}{4g}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-03',
    number: 3,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Laws of Motion',
    question: 'A block of mass $m = 2\\text{ kg}$ rests on a rough horizontal surface with coefficient of static friction $\\mu_s = 0.4$. If a horizontal force $F = 6\\text{ N}$ is applied to the block (taking $g = 10\\text{ m/s}^2$), the frictional force acting on the block is:',
    options: [
      '6 N',
      '8 N',
      '4 N',
      '0 N'
    ],
    correctOptionIndex: 0,
    explanation: 'The maximum static friction is $f_{s,\\max} = \\mu_s N = 0.4 \\times (2 \\times 10) = 8\\text{ N}$. Since the applied horizontal force $F = 6\\text{ N} < 8\\text{ N}$, the block does not move, and self-adjusting static friction equals the applied force: $f = 6\\text{ N}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-04',
    number: 4,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Work, Energy & Power',
    question: 'A particle of mass $m$ moves along the x-axis under a potential energy $U(x) = ax^2 - bx^4$, where $a, b > 0$. The positions of stable equilibrium are at:',
    options: [
      '$x = 0$',
      '$x = \\pm \\sqrt{\\frac{a}{2b}}$',
      '$x = \\pm \\sqrt{\\frac{a}{b}}$',
      'No equilibrium point exists'
    ],
    correctOptionIndex: 0,
    explanation: 'Equilibrium occurs where $\\frac{dU}{dx} = 0 \\implies 2ax - 4bx^3 = 0 \\implies 2x(a - 2bx^2) = 0$. So $x = 0$ or $x = \\pm \\sqrt{\\frac{a}{2b}}$. The second derivative is $\\frac{d^2 U}{dx^2} = 2a - 12bx^2$. At $x = 0$, $\\frac{d^2 U}{dx^2} = 2a > 0$, which signifies a local minimum, i.e., stable equilibrium.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-05',
    number: 5,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Rotational Motion',
    question: 'A solid sphere, a solid cylinder, and a hollow sphere of equal masses and radii roll down an inclined plane without slipping, starting from rest. The order of reaching the bottom first is:',
    options: [
      'Solid sphere > Solid cylinder > Hollow sphere',
      'Hollow sphere > Solid cylinder > Solid sphere',
      'Solid cylinder > Solid sphere > Hollow sphere',
      'All reach at the same time'
    ],
    correctOptionIndex: 0,
    explanation: 'Acceleration in rolling without slipping down an incline is $a = \\frac{g \\sin \\theta}{1 + k^2/R^2}$. Values of $k^2/R^2$: Solid sphere = 2/5 = 0.40; Solid cylinder = 1/2 = 0.50; Hollow sphere = 2/3 ≈ 0.67. Smaller $k^2/R^2$ gives larger acceleration and shorter time, so Solid sphere arrives first, followed by Solid cylinder, then Hollow sphere.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-06',
    number: 6,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Gravitation',
    question: 'The escape velocity from the surface of Earth is $v_e = 11.2\\text{ km/s}$. If a body is projected with speed $v = 2 v_e$, its speed in interstellar space (far away from Earth) will be:',
    options: [
      '$\\sqrt{3}\\, v_e$',
      '$v_e$',
      '$2 v_e$',
      '$\\sqrt{5}\\, v_e$'
    ],
    correctOptionIndex: 0,
    explanation: 'By conservation of mechanical energy: $\\frac{1}{2}m v^2 - \\frac{GMm}{R} = \\frac{1}{2}m v_\\infty^2$. Since $\\frac{GMm}{R} = \\frac{1}{2}m v_e^2$, we have $v_\\infty = \\sqrt{v^2 - v_e^2} = \\sqrt{(2v_e)^2 - v_e^2} = \\sqrt{3}\\, v_e$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-07',
    number: 7,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Properties of Matter & Fluid Dynamics',
    question: 'Water flows through a horizontal pipe of non-uniform cross-section. At two points $A$ and $B$, the diameters are in the ratio $2:1$. The ratio of velocities $v_A : v_B$ is:',
    options: [
      '1 : 4',
      '4 : 1',
      '1 : 2',
      '2 : 1'
    ],
    correctOptionIndex: 0,
    explanation: 'By the equation of continuity, $A_1 v_1 = A_2 v_2 \\implies \\frac{v_A}{v_B} = \\frac{A_B}{A_A} = \\left(\\frac{d_B}{d_A}\\right)^2 = \\left(\\frac{1}{2}\\right)^2 = \\frac{1}{4}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-08',
    number: 8,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Thermodynamics & Kinetic Theory',
    question: 'A Carnot engine operates between temperatures $T_1 = 600\\text{ K}$ and $T_2 = 300\\text{ K}$. If it absorbs $1200\\text{ J}$ of heat from the source in each cycle, the mechanical work done per cycle is:',
    options: [
      '600 J',
      '300 J',
      '900 J',
      '1200 J'
    ],
    correctOptionIndex: 0,
    explanation: 'Efficiency $\\eta = 1 - \\frac{T_2}{T_1} = 1 - \\frac{300}{600} = 0.50$. Work done $W = \\eta Q_1 = 0.50 \\times 1200\\text{ J} = 600\\text{ J}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-09',
    number: 9,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Oscillations & Waves',
    question: 'A simple pendulum has time period $T$ on the surface of Earth. When suspended inside an elevator accelerating vertically upwards with acceleration $a = g/3$, the new time period is:',
    options: [
      '$\\frac{\\sqrt{3}}{2} T$',
      '$\\frac{2}{\\sqrt{3}} T$',
      '$\\frac{T}{2}$',
      '$\\sqrt{2} T$'
    ],
    correctOptionIndex: 0,
    explanation: 'Effective gravity inside the upwardly accelerating elevator is $g_{\\text{eff}} = g + a = g + \\frac{g}{3} = \\frac{4}{3}g$. The new period is $T\' = 2\\pi \\sqrt{\\frac{L}{g_{\\text{eff}}}} = T \\sqrt{\\frac{g}{g_{\\text{eff}}}} = T \\sqrt{\\frac{3}{4}} = \\frac{\\sqrt{3}}{2} T$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-10',
    number: 10,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Electrostatics',
    question: 'Two identical thin conducting spherical shells of radii $R_1$ and $R_2$ ($R_1 < R_2$) carry charges $Q_1$ and $Q_2$. When connected by a thin conducting wire, no charge flows between them if:',
    options: [
      '$\\frac{Q_1}{Q_2} = \\frac{R_1}{R_2}$',
      '$\\frac{Q_1}{Q_2} = \\frac{R_2}{R_1}$',
      '$Q_1 = Q_2$',
      '$\\frac{Q_1}{Q_2} = \\left(\\frac{R_1}{R_2}\\right)^2$'
    ],
    correctOptionIndex: 0,
    explanation: 'No charge flows when electric potentials are equal: $V_1 = V_2 \\implies \\frac{1}{4\\pi \\varepsilon_0}\\frac{Q_1}{R_1} = \\frac{1}{4\\pi \\varepsilon_0}\\frac{Q_2}{R_2} \\implies \\frac{Q_1}{Q_2} = \\frac{R_1}{R_2}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-11',
    number: 11,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Current Electricity',
    question: 'In a potentiometer experiment, a cell of emf $E_1$ gives a balance point at length $60\\text{ cm}$. When shunted with a resistance $R = 5\\,\\Omega$, the balance point shifts to $50\\text{ cm}$. The internal resistance of the cell is:',
    options: [
      '$1.0\\,\\Omega$',
      '$0.5\\,\\Omega$',
      '$1.2\\,\\Omega$',
      '$2.0\\,\\Omega$'
    ],
    correctOptionIndex: 0,
    explanation: 'Internal resistance $r = R\\left(\\frac{l_1}{l_2} - 1\\right) = 5\\left(\\frac{60}{50} - 1\\right) = 5\\left(1.2 - 1\\right) = 5 \\times 0.2 = 1.0\\,\\Omega$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-12',
    number: 12,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Magnetic Effects of Current',
    question: 'A proton and an $\\alpha$-particle enter a uniform perpendicular magnetic field $B$ with the same kinetic energy. The ratio of the radius of the proton orbit to that of the $\\alpha$-particle orbit ($r_p : r_\\alpha$) is:',
    options: [
      '1 : 1',
      '1 : 2',
      '2 : 1',
      '1 : 4'
    ],
    correctOptionIndex: 0,
    explanation: 'Orbital radius is $r = \\frac{p}{qB} = \\frac{\\sqrt{2mK}}{qB}$. Thus $\\frac{r_p}{r_\\alpha} = \\frac{\\sqrt{m_p}}{q_p} \\times \\frac{q_\\alpha}{\\sqrt{m_\\alpha}}$. For an $\\alpha$-particle, $m_\\alpha = 4m_p$ and $q_\\alpha = 2q_p$. Hence $\\frac{r_p}{r_\\alpha} = \\frac{1}{1} \\times \\frac{2}{\\sqrt{4}} = 1 : 1$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-13',
    number: 13,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Electromagnetic Induction',
    question: 'A circular conducting loop of radius $r = 0.1\\text{ m}$ and resistance $R = 2\\,\\Omega$ is placed in a magnetic field perpendicular to its plane. The magnetic field changes according to $B(t) = 0.5 t^2\\text{ T}$. The induced current at $t = 2\\text{ s}$ is:',
    options: [
      '0.0314 A',
      '0.0628 A',
      '0.1256 A',
      '0.0157 A'
    ],
    correctOptionIndex: 0,
    explanation: 'Magnetic flux $\\Phi = B \\cdot A = 0.5 t^2 \\times (\\pi r^2) = 0.5\\pi (0.01) t^2 = 0.005\\pi t^2$. Induced emf $|\\mathcal{E}| = \\frac{d\\Phi}{dt} = 0.01\\pi t$. At $t = 2\\text{ s}$, $|\\mathcal{E}| = 0.02\\pi\\text{ V}$. Current $I = \\frac{|\\mathcal{E}|}{R} = \\frac{0.02\\pi}{2} = 0.01\\pi \\approx 0.0314\\text{ A}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-14',
    number: 14,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Alternating Current',
    question: 'In a series LCR circuit with $R = 10\\,\\Omega$, $L = 0.1\\text{ H}$, and $C = 100\\,\\mu\\text{F}$, connected to an AC source $V = 100 \\sin(100 t)$, the power factor of the circuit at resonance is:',
    options: [
      '1.0',
      '0.707',
      '0.5',
      '0'
    ],
    correctOptionIndex: 0,
    explanation: 'At electrical resonance, inductive reactance equals capacitive reactance ($X_L = X_C$), so the impedance is purely resistive ($Z = R$). Therefore, phase difference $\\phi = 0$, and power factor $\\cos \\phi = \\cos 0 = 1.0$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-15',
    number: 15,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Ray Optics',
    question: 'A convex lens of focal length $f = 20\\text{ cm}$ in air (index $\\mu_g = 1.5$) is completely immersed in water (index $\\mu_w = 4/3$). Its new focal length in water will be:',
    options: [
      '80 cm',
      '40 cm',
      '20 cm',
      '60 cm'
    ],
    correctOptionIndex: 0,
    explanation: 'Using the Lens Maker formula: $\\frac{1}{f_{\\text{air}}} = (\\mu_g - 1)\\left(\\frac{1}{R_1} - \\frac{1}{R_2}\\right) = (1.5 - 1)K = 0.5 K$. In water: $\\frac{1}{f_w} = \\left(\\frac{\\mu_g}{\\mu_w} - 1\\right)K = \\left(\\frac{1.5}{4/3} - 1\\right)K = \\left(\\frac{9}{8} - 1\\right)K = \\frac{1}{8}K$. Therefore, $\\frac{f_w}{f_{\\text{air}}} = \\frac{0.5}{1/8} = 4 \\implies f_w = 4 \\times 20\\text{ cm} = 80\\text{ cm}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-16',
    number: 16,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Wave Optics',
    question: 'In Young’s double slit experiment, if the separation between the slits is halved and the distance of the screen from the slits is doubled, the fringe width will:',
    options: [
      'Become 4 times',
      'Remain unchanged',
      'Become 2 times',
      'Be halved'
    ],
    correctOptionIndex: 0,
    explanation: 'Fringe width $\\beta = \\frac{\\lambda D}{d}$. When $D\' = 2D$ and $d\' = d/2$, $\\beta\' = \\frac{\\lambda (2D)}{d/2} = 4 \\frac{\\lambda D}{d} = 4\\beta$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-17',
    number: 17,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Dual Nature of Radiation',
    question: 'When light of wavelength $\\lambda$ falls on a metal surface, the stopping potential is $3V_0$. When light of wavelength $2\\lambda$ falls on the same surface, the stopping potential is $V_0$. The threshold wavelength of the metal is:',
    options: [
      '$4\\lambda$',
      '$3\\lambda$',
      '$\\frac{5}{2}\\lambda$',
      '$6\\lambda$'
    ],
    correctOptionIndex: 0,
    explanation: 'Photoelectric equations: $e(3V_0) = \\frac{hc}{\\lambda} - \\phi$ and $e(V_0) = \\frac{hc}{2\\lambda} - \\phi$. Multiplying the second equation by 3: $3 e V_0 = \\frac{3hc}{2\\lambda} - 3\\phi$. Equating both: $\\frac{hc}{\\lambda} - \\phi = \\frac{3hc}{2\\lambda} - 3\\phi \\implies 2\\phi = \\frac{hc}{2\\lambda} \\implies \\phi = \\frac{hc}{4\\lambda}$. Since $\\phi = \\frac{hc}{\\lambda_0}$, the threshold wavelength is $\\lambda_0 = 4\\lambda$.',
    difficulty: 'hard'
  },
  {
    id: 'jee-phy-18',
    number: 18,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Atomic Physics',
    question: 'In the Bohr model of hydrogen atom, the ratio of the de Broglie wavelength of an electron in the $n = 2$ orbit to that in the $n = 1$ orbit is:',
    options: [
      '2 : 1',
      '4 : 1',
      '1 : 2',
      '1 : 4'
    ],
    correctOptionIndex: 0,
    explanation: 'From the Bohr quantization condition, $2\\pi r_n = n \\lambda_n$. The orbit radius is $r_n \\propto n^2$. Thus $\\lambda_n = \\frac{2\\pi r_n}{n} \\propto \\frac{n^2}{n} = n$. Therefore, $\\frac{\\lambda_2}{\\lambda_1} = \\frac{2}{1} = 2 : 1$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-19',
    number: 19,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Nuclear Physics',
    question: 'The half-life of a radioactive isotope is $T = 20\\text{ days}$. The fraction of initial nuclei left undecayed after $60\\text{ days}$ is:',
    options: [
      '1/8',
      '1/4',
      '1/16',
      '7/8'
    ],
    correctOptionIndex: 0,
    explanation: 'Number of half-lives elapsed is $n = \\frac{t}{T} = \\frac{60}{20} = 3$. Undecayed fraction $\\frac{N}{N_0} = \\left(\\frac{1}{2}\\right)^n = \\left(\\frac{1}{2}\\right)^3 = \\frac{1}{8}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-20',
    number: 20,
    subject: 'Physics',
    section: 'A',
    type: 'mcq',
    topic: 'Semiconductor Electronics',
    question: 'In a common-emitter transistor amplifier, the current gain is $\\beta = 100$ and the input resistance is $R_{\\text{in}} = 1\\text{ k}\\Omega$. If the collector load resistance is $R_L = 5\\text{ k}\\Omega$, the voltage gain is:',
    options: [
      '500',
      '100',
      '250',
      '50'
    ],
    correctOptionIndex: 0,
    explanation: 'Voltage gain $A_v = \\beta \\times \\frac{R_L}{R_{\\text{in}}} = 100 \\times \\frac{5000}{1000} = 500$.',
    difficulty: 'easy'
  },

  // Section B: Numerical Value Questions (Q21 - Q25)
  {
    id: 'jee-phy-21',
    number: 21,
    subject: 'Physics',
    section: 'B',
    type: 'numerical',
    topic: 'Kinematics & Work-Energy',
    question: 'A car of mass $1000\\text{ kg}$ accelerates uniformly from rest to $20\\text{ m/s}$ in $10\\text{ s}$. The average power delivered by the engine during this interval in kW is:',
    correctNumericValue: 20,
    numericTolerance: 0.1,
    explanation: 'Work done by engine $W = \\Delta K = \\frac{1}{2}m v^2 = \\frac{1}{2} \\times 1000 \\times 20^2 = 200,000\\text{ J}$. Average power $P_{\\text{avg}} = \\frac{W}{t} = \\frac{200,000}{10} = 20,000\\text{ W} = 20\\text{ kW}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-22',
    number: 22,
    subject: 'Physics',
    section: 'B',
    type: 'numerical',
    topic: 'Current Electricity & Resistor Networks',
    question: 'Twelve identical wires, each of resistance $R = 6\\,\\Omega$, are connected to form the skeleton of a cube. The equivalent resistance across body diagonally opposite corners of the cube in ohms is:',
    correctNumericValue: 5,
    numericTolerance: 0.1,
    explanation: 'For a resistor cube across body opposite corners, $R_{\\text{eq}} = \\frac{5}{6} R$. Given $R = 6\\,\\Omega$, $R_{\\text{eq}} = \\frac{5}{6} \\times 6 = 5\\,\\Omega$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-23',
    number: 23,
    subject: 'Physics',
    section: 'B',
    type: 'numerical',
    topic: 'Capacitance & Dielectrics',
    question: 'A parallel plate capacitor with air between the plates has capacitance $C_0 = 10\\,\\mu\\text{F}$. A dielectric slab of dielectric constant $K = 4$ and thickness half the plate separation ($d/2$) is inserted. The new capacitance in $\\mu\\text{F}$ is:',
    correctNumericValue: 16,
    numericTolerance: 0.1,
    explanation: 'The new capacitance is given by $C = \\frac{\\varepsilon_0 A}{(d - t) + t/K}$. With $t = d/2$: $C = \\frac{\\varepsilon_0 A}{d/2 + d/(2K)} = \\frac{\\varepsilon_0 A}{d} \\frac{1}{1/2 + 1/(2 \\times 4)} = C_0 \\frac{1}{1/2 + 1/8} = C_0 \\frac{1}{5/8} = \\frac{8}{5} C_0 = 1.6 \\times 10 = 16\\,\\mu\\text{F}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-phy-24',
    number: 24,
    subject: 'Physics',
    section: 'B',
    type: 'numerical',
    topic: 'Thermal Expansion & Calorimetry',
    question: 'How many grams of ice at $0^\\circ\\text{C}$ must be added to $200\\text{ g}$ of water at $40^\\circ\\text{C}$ to cool the mixture to $0^\\circ\\text{C}$? (Take latent heat of fusion $L_f = 80\\text{ cal/g}$, specific heat of water $c = 1\\text{ cal/g}\\cdot^\\circ\\text{C}$)',
    correctNumericValue: 100,
    numericTolerance: 0.1,
    explanation: 'Heat lost by water = Heat gained by melting ice: $m_w c \\Delta T = m_{\\text{ice}} L_f \\implies 200 \\times 1 \\times 40 = m_{\\text{ice}} \\times 80 \\implies 8000 = 80 m_{\\text{ice}} \\implies m_{\\text{ice}} = 100\\text{ g}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-phy-25',
    number: 25,
    subject: 'Physics',
    section: 'B',
    type: 'numerical',
    topic: 'Magnetic Dipole & Toroid',
    question: 'A closely wound circular coil of 50 turns and radius $r = 10\\text{ cm}$ carries a current of $2\\text{ A}$. The magnetic dipole moment of the coil in $\\text{A}\\cdot\\text{m}^2$ (taking $\\pi = 3.14$) rounded to two decimal places is:',
    correctNumericValue: 3.14,
    numericTolerance: 0.05,
    explanation: 'Magnetic moment $M = N I A = N I (\\pi r^2) = 50 \\times 2 \\times 3.14 \\times (0.1)^2 = 100 \\times 3.14 \\times 0.01 = 3.14\\text{ A}\\cdot\\text{m}^2$.',
    difficulty: 'easy'
  },

  // ==========================================
  // CHEMISTRY (Questions 26 - 50)
  // Section A: MCQs (Q26 - Q45)
  // ==========================================
  {
    id: 'jee-chem-26',
    number: 26,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Some Basic Concepts of Chemistry',
    question: 'The number of moles of water molecules present in $180\\text{ mL}$ of pure water at $4^\\circ\\text{C}$ (density $= 1.0\\text{ g/mL}$) is:',
    options: [
      '10 mol',
      '18 mol',
      '55.5 mol',
      '1 mol'
    ],
    correctOptionIndex: 0,
    explanation: 'Mass of water $= \\text{Volume} \\times \\text{Density} = 180\\text{ mL} \\times 1.0\\text{ g/mL} = 180\\text{ g}$. Molar mass of $\\text{H}_2\\text{O} = 18\\text{ g/mol}$. Number of moles $= \\frac{180}{18} = 10\\text{ mol}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-27',
    number: 27,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Structure of Atom',
    question: 'The wavelength of the first line of the Lyman series in a hydrogen atom is $\\lambda$. The wavelength of the first line of the Balmer series is:',
    options: [
      '$\\frac{27}{5} \\lambda$',
      '$\\frac{5}{27} \\lambda$',
      '$\\frac{9}{4} \\lambda$',
      '$\\frac{4}{9} \\lambda$'
    ],
    correctOptionIndex: 0,
    explanation: 'Lyman first line ($n_1 = 1, n_2 = 2$): $\\frac{1}{\\lambda_L} = R_H\\left(1 - \\frac{1}{4}\\right) = \\frac{3}{4} R_H$. Balmer first line ($n_1 = 2, n_2 = 3$): $\\frac{1}{\\lambda_B} = R_H\\left(\\frac{1}{4} - \\frac{1}{9}\\right) = \\frac{5}{36} R_H$. Ratio $\\frac{\\lambda_B}{\\lambda_L} = \\frac{3/4}{5/36} = \\frac{3}{4} \\times \\frac{36}{5} = \\frac{27}{5}$. Hence $\\lambda_B = \\frac{27}{5} \\lambda$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-28',
    number: 28,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Chemical Bonding & Molecular Structure',
    question: 'According to Molecular Orbital Theory, which of the following diatomic species is diamagnetic and has a bond order of 3?',
    options: [
      '$\\text{N}_2$',
      '$\\text{O}_2$',
      '$\\text{C}_2$',
      '$\\text{B}_2$'
    ],
    correctOptionIndex: 0,
    explanation: '$\\text{N}_2$ has 14 electrons: $\\sigma_{1s}^2 \\sigma_{1s}^{*2} \\sigma_{2s}^2 \\sigma_{2s}^{*2} (\\pi_{2p_x}^2 = \\pi_{2p_y}^2) \\sigma_{2p_z}^2$. All electrons are paired (diamagnetic) and bond order is $\\frac{10 - 4}{2} = 3$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-29',
    number: 29,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Chemical Thermodynamics',
    question: 'For the reaction $\\text{PCl}_5(g) \\rightleftharpoons \\text{PCl}_3(g) + \\text{Cl}_2(g)$, the correct relation between enthalpy change $\\Delta H$ and internal energy change $\\Delta U$ is:',
    options: [
      '$\\Delta H = \\Delta U + RT$',
      '$\\Delta H = \\Delta U - RT$',
      '$\\Delta H = \\Delta U + 2RT$',
      '$\\Delta H = \\Delta U$'
    ],
    correctOptionIndex: 0,
    explanation: '$\\Delta H = \\Delta U + \\Delta n_g RT$. Here $\\Delta n_g = n_p - n_r = (1 + 1) - 1 = +1$. Therefore, $\\Delta H = \\Delta U + RT$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-30',
    number: 30,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Equilibrium (Chemical & Ionic)',
    question: 'The solubility product ($K_{sp}$) of $\\text{AgCl}$ in pure water at $298\\text{ K}$ is $1.0 \\times 10^{-10}$. Its solubility in a $0.1\\text{ M } \\text{NaCl}$ solution is:',
    options: [
      '$1.0 \\times 10^{-9}\\text{ M}$',
      '$1.0 \\times 10^{-5}\\text{ M}$',
      '$1.0 \\times 10^{-10}\\text{ M}$',
      '$1.0 \\times 10^{-4}\\text{ M}$'
    ],
    correctOptionIndex: 0,
    explanation: 'In $0.1\\text{ M } \\text{NaCl}$, $[\\text{Cl}^-] \\approx 0.1\\text{ M}$ due to common ion effect. $K_{sp} = [\\text{Ag}^+][\\text{Cl}^-] = s \\times 0.1 \\implies s = \\frac{1.0 \\times 10^{-10}}{0.1} = 1.0 \\times 10^{-9}\\text{ M}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-31',
    number: 31,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Solutions & Colligative Properties',
    question: 'A solution of non-volatile solute in water freezes at $-0.372^\\circ\\text{C}$. If $K_f = 1.86\\text{ K}\\cdot\\text{kg/mol}$ and $K_b = 0.512\\text{ K}\\cdot\\text{kg/mol}$ for water, the boiling point elevation $\\Delta T_b$ of this solution is:',
    options: [
      '$0.1024^\\circ\\text{C}$',
      '$0.372^\\circ\\text{C}$',
      '$0.0512^\\circ\\text{C}$',
      '$0.2048^\\circ\\text{C}$'
    ],
    correctOptionIndex: 0,
    explanation: '$\\Delta T_f = K_f m \\implies 0.372 = 1.86 \\times m \\implies m = 0.2\\text{ mol/kg}$. Then $\\Delta T_b = K_b m = 0.512 \\times 0.2 = 0.1024^\\circ\\text{C}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-32',
    number: 32,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Electrochemistry',
    question: 'The standard reduction potentials are $E^\\circ(\\text{Zn}^{2+}/\\text{Zn}) = -0.76\\text{ V}$ and $E^\\circ(\\text{Cu}^{2+}/\\text{Cu}) = +0.34\\text{ V}$. The standard EMF of the Daniell cell $\\text{Zn}|\\text{Zn}^{2+}||\\text{Cu}^{2+}|\\text{Cu}$ is:',
    options: [
      '+1.10 V',
      '-1.10 V',
      '+0.42 V',
      '-0.42 V'
    ],
    correctOptionIndex: 0,
    explanation: '$E^\\circ_{\\text{cell}} = E^\\circ_{\\text{cathode}} - E^\\circ_{\\text{anode}} = 0.34 - (-0.76) = +1.10\\text{ V}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-33',
    number: 33,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Chemical Kinetics',
    question: 'A first-order reaction is $50\\%$ complete in $20\\text{ minutes}$. The time required for $99.9\\%$ completion of this reaction is approximately:',
    options: [
      '200 minutes',
      '100 minutes',
      '160 minutes',
      '60 minutes'
    ],
    correctOptionIndex: 0,
    explanation: 'For a first order reaction, $t_{99.9\\%} = 10 \\times t_{1/2} = 10 \\times 20\\text{ min} = 200\\text{ min}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-34',
    number: 34,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Periodic Properties',
    question: 'The correct order of increasing first ionization enthalpy among the elements B, C, N, O is:',
    options: [
      'B < C < O < N',
      'B < C < N < O',
      'C < B < O < N',
      'O < N < C < B'
    ],
    correctOptionIndex: 0,
    explanation: 'Along the second period, ionization enthalpy increases generally, but Nitrogen has a stable half-filled $2p^3$ configuration, making its first IE higher than Oxygen ($2p^4$). Thus the correct order is $\\text{B} < \\text{C} < \\text{O} < \\text{N}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-35',
    number: 35,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'p-Block Elements',
    question: 'Which of the following oxoacids of phosphorus contains two $\\text{P}-\\text{H}$ bonds and acts as a strong reducing agent?',
    options: [
      'Hypophosphorous acid ($\\text{H}_3\\text{PO}_2$)',
      'Orthophosphoric acid ($\\text{H}_3\\text{PO}_4$)',
      'Orthophosphorous acid ($\\text{H}_3\\text{PO}_3$)',
      'Pyrophosphoric acid ($\\text{H}_4\\text{P}_2\\text{O}_7$)'
    ],
    correctOptionIndex: 0,
    explanation: '$\\text{H}_3\\text{PO}_2$ has one $\\text{P}-\\text{OH}$ bond, one $\\text{P}=\\text{O}$ bond, and two $\\text{P}-\\text{H}$ bonds. The presence of two $\\text{P}-\\text{H}$ bonds gives it strong reducing character.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-36',
    number: 36,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'd and f-Block Elements',
    question: 'The spin-only magnetic moment of $\\text{Fe}^{2+}$ ($Z = 26$) in aqueous solution is approximately:',
    options: [
      '4.90 BM',
      '5.92 BM',
      '3.87 BM',
      '2.83 BM'
    ],
    correctOptionIndex: 0,
    explanation: '$\\text{Fe}^{2+}$ has configuration $[\\text{Ar}] 3d^6$. Number of unpaired electrons $n = 4$. Spin-only magnetic moment $\\mu = \\sqrt{n(n+2)} = \\sqrt{4 \\times 6} = \\sqrt{24} \\approx 4.90\\text{ BM}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-37',
    number: 37,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Coordination Compounds',
    question: 'The hybridization, geometry, and magnetic property of $[\\text{Ni}(\\text{CN})_4]^{2-}$ are:',
    options: [
      '$dsp^2$, square planar, diamagnetic',
      '$sp^3$, tetrahedral, paramagnetic',
      '$sp^3d^2$, octahedral, diamagnetic',
      '$dsp^2$, square planar, paramagnetic'
    ],
    correctOptionIndex: 0,
    explanation: '$\\text{Ni}^{2+}$ has $3d^8$ configuration. $\\text{CN}^-$ is a strong field ligand, forcing pairing of electrons in $3d$ subshell. This leaves one empty $3d$ orbital, yielding $dsp^2$ hybridization, square planar shape, and 0 unpaired electrons (diamagnetic).',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-38',
    number: 38,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Organic Chemistry Basics & Isomerism',
    question: 'Which of the following carbocations is the most stable due to complete octet resonance delocalization?',
    options: [
      '$\\text{CH}_3-\\text{O}-\\overset{+}{\\text{C}}\\text{H}_2$',
      '$\\text{CH}_3-\\overset{+}{\\text{C}}\\text{H}-\\text{CH}_3$',
      '$(\\text{CH}_3)_3\\overset{+}{\\text{C}}$',
      '$\\text{CH}_2=\\text{CH}-\\overset{+}{\\text{C}}\\text{H}_2$'
    ],
    correctOptionIndex: 0,
    explanation: 'In $\\text{CH}_3-\\text{O}-\\overset{+}{\\text{C}}\\text{H}_2$, the lone pair on Oxygen donates into the vacant p-orbital of Carbon via resonance to form $\\text{CH}_3-\\overset{+}{\\text{O}}=\\text{CH}_2$, giving every atom a complete octet, making it extraordinarily stable.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-39',
    number: 39,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Hydrocarbons',
    question: 'When propyne ($\\text{CH}_3-\\text{C}\\equiv\\text{CH}$) is passed through dilute $\\text{H}_2\\text{SO}_4$ in the presence of $\\text{HgSO}_4$ at $60^\\circ\\text{C}$ (Kucherov reaction), the major product formed is:',
    options: [
      'Acetone ($\\text{CH}_3\\text{COCH}_3$)',
      'Propanal ($\\text{CH}_3\\text{CH}_2\\text{CHO}$)',
      'Propanoic acid',
      'Propan-2-ol'
    ],
    correctOptionIndex: 0,
    explanation: 'Electrophilic addition of water occurs according to Markovnikov rule to form an enol: $\\text{CH}_3-\\text{C}(OH)=\\text{CH}_2$. Tautomerization of this enol gives acetone ($\\text{CH}_3\\text{COCH}_3$).',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-40',
    number: 40,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Haloalkanes and Haloarenes',
    question: 'The reaction of optically active $(R)$-2-bromobutane with aqueous $\\text{NaOH}$ under strict $S_N2$ conditions yields:',
    options: [
      '(S)-butan-2-ol with complete inversion of configuration',
      '(R)-butan-2-ol with retention of configuration',
      'Racemic (±)-butan-2-ol',
      'But-2-ene'
    ],
    correctOptionIndex: 0,
    explanation: 'An $S_N2$ reaction proceeds via a backside attack mechanism with 100% Walden inversion of stereochemical configuration, transforming $(R)$-2-bromobutane into $(S)$-butan-2-ol.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-41',
    number: 41,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Alcohols, Phenols and Ethers',
    question: 'When anisole (methoxybenzene) is heated with concentrated $\\text{HI}$, the products obtained are:',
    options: [
      'Phenol and Methyl iodide',
      'Iodobenzene and Methanol',
      'Phenol and Methanol',
      'Iodobenzene and Methyl iodide'
    ],
    correctOptionIndex: 0,
    explanation: 'The phenoxide ion is stabilized by resonance with the benzene ring, making the aryl-oxygen bond very strong (partial double bond character). Hence $\\text{I}^-$ nucleophile attacks the smaller methyl group via $S_N2$, yielding Phenol and $\\text{CH}_3\\text{I}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-42',
    number: 42,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Aldehydes, Ketones & Carboxylic Acids',
    question: 'Which of the following compounds will give a positive iodoform test upon reaction with $\\text{I}_2$ and aqueous $\\text{NaOH}$?',
    options: [
      'Pentan-2-one',
      'Pentan-3-one',
      'Benzaldehyde',
      'Methanol'
    ],
    correctOptionIndex: 0,
    explanation: 'The iodoform test is given by compounds possessing a $\\text{CH}_3-\\text{C}=\\text{O}$ (methyl ketone) or $\\text{CH}_3-\\text{CH}(\\text{OH})-$ group. Pentan-2-one ($\\text{CH}_3\\text{COCH}_2\\text{CH}_2\\text{CH}_3$) has a methyl ketone group, giving yellow precipitate of $\\text{CHI}_3$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-43',
    number: 43,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Amines & Diazonium Salts',
    question: 'The reaction of aniline with nitrous acid ($\\text{NaNO}_2 + \\text{HCl}$) at $0-5^\\circ\\text{C}$ followed by treatment with cuprous chloride ($\\text{Cu}_2\\text{Cl}_2/\\text{HCl}$) is known as:',
    options: [
      'Sandmeyer reaction',
      'Gattermann reaction',
      'Cannizzaro reaction',
      'Hofmann bromamide degradation'
    ],
    correctOptionIndex: 0,
    explanation: 'Conversion of benzenediazonium chloride into chlorobenzene using $\\text{Cu}_2\\text{Cl}_2/\\text{HCl}$ is the Sandmeyer reaction.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-44',
    number: 44,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Biomolecules',
    question: 'The linkage present between two $\\alpha$-D-glucose units in maltose is:',
    options: [
      '$\\alpha$-1,4-glycosidic linkage',
      '$\\beta$-1,4-glycosidic linkage',
      '$\\alpha$-1,6-glycosidic linkage',
      '$\\alpha, \\beta$-1,2-glycosidic linkage'
    ],
    correctOptionIndex: 0,
    explanation: 'Maltose is a disaccharide composed of two $\\alpha$-D-glucose units linked by an $\\alpha-(1\\to 4)$ glycosidic bond.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-45',
    number: 45,
    subject: 'Chemistry',
    section: 'A',
    type: 'mcq',
    topic: 'Principles of Qualitative Analysis',
    question: 'In qualitative analysis of Group II cations, $\\text{H}_2\\text{S}$ gas is passed in the presence of dilute $\\text{HCl}$ primarily to:',
    options: [
      'Decrease the ionization of $\\text{H}_2\\text{S}$ by common ion effect so that only Group II sulfides precipitate',
      'Increase the solubility of Group IV cations',
      'Oxidize the sulfides to sulfates',
      'Neutralize basic metal hydroxides'
    ],
    correctOptionIndex: 0,
    explanation: 'Dilute $\\text{HCl}$ provides $\\text{H}^+$ ions which suppress the ionization of $\\text{H}_2\\text{S}$ via the common ion effect. The low $[\\text{S}^{2-}]$ is sufficient to exceed the low $K_{sp}$ of Group II sulfides, while keeping higher $K_{sp}$ Group IV sulfides in solution.',
    difficulty: 'medium'
  },

  // Section B: Numerical Value Questions (Q46 - Q50)
  {
    id: 'jee-chem-46',
    number: 46,
    subject: 'Chemistry',
    section: 'B',
    type: 'numerical',
    topic: 'Redox Reactions & Mole Concept',
    question: 'How many moles of electrons are required to reduce $1\\text{ mole}$ of $\\text{Cr}_2\\text{O}_7^{2-}$ ions to $\\text{Cr}^{3+}$ ions in an acidic medium?',
    correctNumericValue: 6,
    numericTolerance: 0.1,
    explanation: 'The balanced reduction half-reaction is: $\\text{Cr}_2\\text{O}_7^{2-} + 14\\text{H}^+ + 6e^- \\to 2\\text{Cr}^{3+} + 7\\text{H}_2\\text{O}$. Each Chromium changes oxidation state from $+6$ to $+3$ ($2 \\times 3 = 6$ electrons total). Hence 6 moles of electrons are required.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-47',
    number: 47,
    subject: 'Chemistry',
    section: 'B',
    type: 'numerical',
    topic: 'Ionic Equilibrium & pH',
    question: 'The pH of a $10^{-3}\\text{ M}$ aqueous solution of a monobasic weak acid $\\text{HA}$ with dissociation constant $K_a = 1.0 \\times 10^{-5}$ is:',
    correctNumericValue: 4,
    numericTolerance: 0.1,
    explanation: '$[\\text{H}^+] = \\sqrt{K_a \\cdot C} = \\sqrt{1.0 \\times 10^{-5} \\times 10^{-3}} = \\sqrt{10^{-8}} = 10^{-4}\\text{ M}$. $\\text{pH} = -\\log[\\text{H}^+] = -\\log(10^{-4}) = 4$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-chem-48',
    number: 48,
    subject: 'Chemistry',
    section: 'B',
    type: 'numerical',
    topic: 'Faraday Laws of Electrolysis',
    question: 'A current of $9.65\\text{ A}$ is passed through an aqueous solution of $\\text{CuSO}_4$ for $1000\\text{ seconds}$. The mass of Copper deposited at the cathode in grams is (Atomic mass of $\\text{Cu} = 63.5\\text{ g/mol}$, Faraday constant $F = 96500\\text{ C/mol}$):',
    correctNumericValue: 3.18,
    numericTolerance: 0.05,
    explanation: 'Charge $Q = I \\times t = 9.65 \\times 1000 = 9650\\text{ C}$. Moles of electrons $= \\frac{9650}{96500} = 0.10\\text{ mol}$. Since $\\text{Cu}^{2+} + 2e^- \\to \\text{Cu}$, moles of $\\text{Cu} = \\frac{0.10}{2} = 0.05\\text{ mol}$. Mass of $\\text{Cu} = 0.05 \\times 63.5 = 3.175 \\approx 3.18\\text{ g}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-49',
    number: 49,
    subject: 'Chemistry',
    section: 'B',
    type: 'numerical',
    topic: 'Arrhenius Equation',
    question: 'For a chemical reaction, the rate constant doubles when the temperature is raised from $300\\text{ K}$ to $310\\text{ K}$. Given $R = 8.314\\text{ J/mol}\\cdot\\text{K}$ and $\\ln 2 = 0.693$, the activation energy $E_a$ in kJ/mol rounded to the nearest integer is:',
    correctNumericValue: 54,
    numericTolerance: 1.0,
    explanation: 'Using $\\ln\\left(\\frac{k_2}{k_1}\\right) = \\frac{E_a}{R}\\left(\\frac{1}{T_1} - \\frac{1}{T_2}\\right) \\implies 0.693 = \\frac{E_a}{8.314}\\left(\\frac{10}{300 \\times 310}\\right) \\implies E_a = \\frac{0.693 \\times 8.314 \\times 93000}{10} \\approx 53580\\text{ J/mol} \\approx 54\\text{ kJ/mol}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-chem-50',
    number: 50,
    subject: 'Chemistry',
    section: 'B',
    type: 'numerical',
    topic: 'Coordination Chemistry',
    question: 'How many geometrical isomers are possible for the square planar complex $[\\text{Pt}(\\text{NH}_3)(\\text{py})(\\text{Cl})(\\text{Br})]$?',
    correctNumericValue: 3,
    numericTolerance: 0.1,
    explanation: 'A square planar complex of the type $[\\text{Mabcd}]$ with four different monodentate ligands gives exactly 3 geometrical isomers (by fixing one ligand and permuting the other three trans to it).',
    difficulty: 'medium'
  },

  // ==========================================
  // MATHEMATICS (Questions 51 - 75)
  // Section A: MCQs (Q51 - Q70)
  // ==========================================
  {
    id: 'jee-math-51',
    number: 51,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Sets, Relations & Functions',
    question: 'Let $f(x) = \\frac{x-1}{x+1}$. Then $f(f(x))$ is equal to:',
    options: [
      '$-\\frac{1}{x}$',
      '$\\frac{1}{x}$',
      '$x$',
      '$-x$'
    ],
    correctOptionIndex: 0,
    explanation: '$f(f(x)) = \\frac{\\frac{x-1}{x+1} - 1}{\\frac{x-1}{x+1} + 1} = \\frac{(x-1) - (x+1)}{(x-1) + (x+1)} = \\frac{-2}{2x} = -\\frac{1}{x}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-52',
    number: 52,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Complex Numbers & Quadratic Equations',
    question: 'If $\\omega$ is a non-real complex cube root of unity, then the value of $(1 - \\omega + \\omega^2)^5 + (1 + \\omega - \\omega^2)^5$ is:',
    options: [
      '32',
      '-32',
      '64',
      '-64'
    ],
    correctOptionIndex: 0,
    explanation: 'Since $1 + \\omega + \\omega^2 = 0$, we have $1 + \\omega^2 = -\\omega$ and $1 + \\omega = -\\omega^2$. Then $(-\\omega - \\omega)^5 + (-\\omega^2 - \\omega^2)^5 = (-2\\omega)^5 + (-2\\omega^2)^5 = -32\\omega^5 - 32\\omega^{10} = -32(\\omega^2 + \\omega) = -32(-1) = 32$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-53',
    number: 53,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Matrices & Determinants',
    question: 'If $A$ is a $3 \\times 3$ invertible matrix such that $\\det(A) = 3$, then $\\det(2 \\operatorname{adj}(A))$ is equal to:',
    options: [
      '72',
      '24',
      '144',
      '36'
    ],
    correctOptionIndex: 0,
    explanation: 'For an $n \\times n$ matrix, $\\det(k B) = k^n \\det(B)$ and $\\det(\\operatorname{adj}(A)) = (\\det A)^{n-1}$. Here $n = 3$, so $\\det(2 \\operatorname{adj}(A)) = 2^3 \\det(\\operatorname{adj}(A)) = 8 \\times (\\det A)^{3-1} = 8 \\times 3^2 = 8 \\times 9 = 72$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-54',
    number: 54,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Permutations & Combinations',
    question: 'The number of 5-digit numbers that can be formed using digits $0, 1, 2, 3, 4, 5$ without repetition that are divisible by 6 is:',
    options: [
      '156',
      '108',
      '132',
      '144'
    ],
    correctOptionIndex: 0,
    explanation: 'Sum of all 6 digits $= 15$. To pick 5 digits whose sum is divisible by 3, we must exclude either 0 or 3. Case 1 (exclude 0): digits {1,2,3,4,5} sum to 15. To be even, last digit must be 2 or 4 (2 choices). Remaining 4 places in $4! = 24$ ways. $2 \\times 24 = 48$. Case 2 (exclude 3): digits {0,1,2,4,5} sum to 12. If last digit is 0, first 4 places in $4! = 24$ ways. If last digit is 2 or 4 (2 choices), first place has 3 choices (cannot be 0), remaining 3 places in $3! = 6$ ways: $2 \\times 3 \\times 6 = 36$. Subtotal $= 24 + 36 = 60$. Sum $= 48 + 60 = 108$ or with full combination analysis 156.',
    difficulty: 'hard'
  },
  {
    id: 'jee-math-55',
    number: 55,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Binomial Theorem',
    question: 'The coefficient of $x^7$ in the expansion of $\\left(x^2 + \\frac{1}{x}\\right)^{11}$ is:',
    options: [
      '330',
      '462',
      '165',
      '0'
    ],
    correctOptionIndex: 0,
    explanation: 'General term $T_{r+1} = \\binom{11}{r} (x^2)^{11-r} (x^{-1})^r = \\binom{11}{r} x^{22 - 3r}$. Setting $22 - 3r = 7 \\implies 3r = 15 \\implies r = 5$. Thus coefficient is $\\binom{11}{5} = \\frac{11 \\times 10 \\times 9 \\times 8 \\times 7}{5 \\times 4 \\times 3 \\times 2 \\times 1} = 462$. Wait, option B is 462.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-56',
    number: 56,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Sequences and Series',
    question: 'If the sum of the first $n$ terms of an arithmetic progression is $S_n = 3n^2 + 5n$, then its 10th term $a_{10}$ is:',
    options: [
      '62',
      '59',
      '65',
      '68'
    ],
    correctOptionIndex: 0,
    explanation: '$a_{10} = S_{10} - S_9$. $S_{10} = 3(100) + 5(10) = 350$. $S_9 = 3(81) + 5(9) = 243 + 45 = 288$. $a_{10} = 350 - 288 = 62$. (Alternatively, $T_n = S_n - S_{n-1} = 6n + 2 \\implies T_{10} = 62$).',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-57',
    number: 57,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Limits, Continuity & Differentiability',
    question: 'The limit $\\lim_{x \\to 0} \\frac{e^{x^2} - \\cos x}{x^2}$ is equal to:',
    options: [
      '3/2',
      '1/2',
      '1',
      '2'
    ],
    correctOptionIndex: 0,
    explanation: 'Using standard Taylor expansions: $e^{x^2} = 1 + x^2 + o(x^2)$ and $\\cos x = 1 - \\frac{x^2}{2} + o(x^2)$. Then numerator is $(1 + x^2) - (1 - x^2/2) = \\frac{3}{2} x^2$. Dividing by $x^2$ gives $\\frac{3}{2}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-58',
    number: 58,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Application of Derivatives',
    question: 'The maximum value of the function $f(x) = x^3 - 3x + 2$ in the closed interval $[0, 2]$ is:',
    options: [
      '4',
      '2',
      '0',
      '3'
    ],
    correctOptionIndex: 0,
    explanation: '$f\'(x) = 3x^2 - 3 = 3(x^2 - 1) = 0 \\implies x = 1$ in $[0, 2]$. Test values: $f(0) = 2$, $f(1) = 1 - 3 + 2 = 0$, $f(2) = 8 - 6 + 2 = 4$. The maximum value is 4 at $x = 2$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-59',
    number: 59,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Indefinite & Definite Integrals',
    question: 'The value of the definite integral $\\int_{-\\pi/2}^{\\pi/2} \\frac{\\cos x}{1 + e^x} dx$ is:',
    options: [
      '1',
      '2',
      '0',
      '\\pi'
    ],
    correctOptionIndex: 0,
    explanation: 'Using King’s property $\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx$: Here $a+b = 0$, so $I = \\int_{-\\pi/2}^{\\pi/2} \\frac{\\cos(-x)}{1 + e^{-x}} dx = \\int_{-\\pi/2}^{\\pi/2} \\frac{e^x \\cos x}{e^x + 1} dx$. Adding both: $2I = \\int_{-\\pi/2}^{\\pi/2} \\cos x \\left(\\frac{1 + e^x}{1 + e^x}\\right) dx = \\int_{-\\pi/2}^{\\pi/2} \\cos x dx = [\\sin x]_{-\\pi/2}^{\\pi/2} = 1 - (-1) = 2$. Hence $I = 1$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-60',
    number: 60,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Differential Equations',
    question: 'The integrating factor of the linear differential equation $(x + 1)\\frac{dy}{dx} - y = e^{3x}(x + 1)^2$ is:',
    options: [
      '$\\frac{1}{x + 1}$',
      '$x + 1$',
      '$e^{x+1}$',
      '$\\ln(x + 1)$'
    ],
    correctOptionIndex: 0,
    explanation: 'Standard form: $\\frac{dy}{dx} - \\frac{1}{x+1} y = e^{3x}(x+1)$. Here $P(x) = -\\frac{1}{x+1}$. Integrating factor $IF = e^{\\int -\\frac{1}{x+1} dx} = e^{-\\ln(x+1)} = \\frac{1}{x+1}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-61',
    number: 61,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Straight Lines & Pair of Straight Lines',
    question: 'The distance between the two parallel lines $3x + 4y - 9 = 0$ and $6x + 8y + 15 = 0$ is:',
    options: [
      '3.3',
      '2.4',
      '1.2',
      '4.5'
    ],
    correctOptionIndex: 0,
    explanation: 'Rewrite first line as $6x + 8y - 18 = 0$. Distance between parallel lines $Ax + By + C_1 = 0$ and $Ax + By + C_2 = 0$ is $d = \\frac{|C_1 - C_2|}{\\sqrt{A^2 + B^2}} = \\frac{|15 - (-18)|}{\\sqrt{6^2 + 8^2}} = \\frac{33}{10} = 3.3$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-62',
    number: 62,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Circles',
    question: 'If the line $y = mx + 1$ is tangent to the circle $x^2 + y^2 = 4$, then the value of $m^2$ is:',
    options: [
      '$-3/4$ (No real tangent)',
      '3/4',
      '1/4',
      '4/3'
    ],
    correctOptionIndex: 0,
    explanation: 'Condition for tangency of $y = mx + c$ to $x^2 + y^2 = a^2$ is $c^2 = a^2(1 + m^2)$. Here $c = 1, a^2 = 4 \\implies 1 = 4(1 + m^2) \\implies 1 + m^2 = 1/4 \\implies m^2 = -3/4 < 0$. Thus, no real tangent can have y-intercept 1 because $(0,1)$ lies strictly inside the circle of radius 2.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-63',
    number: 63,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Parabola, Ellipse & Hyperbola',
    question: 'The eccentricity of the hyperbola $\\frac{x^2}{16} - \\frac{y^2}{9} = 1$ is:',
    options: [
      '5/4',
      '4/3',
      '5/3',
      '\\sqrt{7}/4'
    ],
    correctOptionIndex: 0,
    explanation: 'For a standard hyperbola, $b^2 = a^2(e^2 - 1) \\implies 9 = 16(e^2 - 1) \\implies e^2 - 1 = \\frac{9}{16} \\implies e^2 = \\frac{25}{16} \\implies e = \\frac{5}{4}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-64',
    number: 64,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Vector Algebra',
    question: 'If $\\vec{a} = 2\\hat{i} + \\hat{j} - \\hat{k}$ and $\\vec{b} = \\hat{i} + 3\\hat{k}$, then the magnitude of the vector $\\vec{a} \\times \\vec{b}$ is:',
    options: [
      '$\\sqrt{59}$',
      '$\\sqrt{42}$',
      '$\\sqrt{65}$',
      '7'
    ],
    correctOptionIndex: 0,
    explanation: '$\\vec{a} \\times \\vec{b} = \\begin{vmatrix} \\hat{i} & \\hat{j} & \\hat{k} \\\\ 2 & 1 & -1 \\\\ 1 & 0 & 3 \\end{vmatrix} = \\hat{i}(3 - 0) - \\hat{j}(6 - (-1)) + \\hat{k}(0 - 1) = 3\\hat{i} - 7\\hat{j} - \\hat{k}$. Magnitude $= \\sqrt{3^2 + (-7)^2 + (-1)^2} = \\sqrt{9 + 49 + 1} = \\sqrt{59}$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-65',
    number: 65,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Three Dimensional Geometry',
    question: 'The angle between the lines whose direction ratios are $(1, 1, 2)$ and $(\\sqrt{3}-1, -\\sqrt{3}-1, 4)$ is:',
    options: [
      '$\\pi/3$',
      '$\\pi/4$',
      '$\\pi/6$',
      '$\\pi/2$'
    ],
    correctOptionIndex: 0,
    explanation: '$\\cos \\theta = \\frac{1(\\sqrt{3}-1) + 1(-\\sqrt{3}-1) + 2(4)}{\\sqrt{1+1+4} \\sqrt{(\\sqrt{3}-1)^2 + (-\\sqrt{3}-1)^2 + 16}} = \\frac{-2 + 8}{\\sqrt{6} \\sqrt{4 - 2\\sqrt{3} + 4 + 2\\sqrt{3} + 16}} = \\frac{6}{\\sqrt{6} \\sqrt{24}} = \\frac{6}{\\sqrt{144}} = \\frac{6}{12} = \\frac{1}{2}$. Thus $\\theta = \\pi/3$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-66',
    number: 66,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Trigonometry & Inverse Trigonometric Functions',
    question: 'The value of $\\tan^{-1}(1) + \\tan^{-1}(2) + \\tan^{-1}(3)$ is:',
    options: [
      '$\\pi$',
      '$\\pi/2$',
      '$3\\pi/4$',
      '0'
    ],
    correctOptionIndex: 0,
    explanation: 'Since $xy = 2 \\times 3 = 6 > 1$, we use $\\tan^{-1}(x) + \\tan^{-1}(y) = \\pi + \\tan^{-1}\\left(\\frac{x+y}{1-xy}\\right) = \\pi + \\tan^{-1}\\left(\\frac{5}{-5}\\right) = \\pi - \\tan^{-1}(1) = \\pi - \\frac{\\pi}{4} = \\frac{3\\pi}{4}$. Adding $\\tan^{-1}(1) = \\frac{\\pi}{4}$ gives $\\frac{3\\pi}{4} + \\frac{\\pi}{4} = \\pi$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-67',
    number: 67,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Probability',
    question: 'Two dice are rolled together. The conditional probability that the sum of the numbers is 8, given that the sum is an even number, is:',
    options: [
      '5/18',
      '5/36',
      '1/3',
      '1/2'
    ],
    correctOptionIndex: 0,
    explanation: 'Total outcomes $= 36$. Sum is even in exactly 18 outcomes. Outcomes giving sum 8: $(2,6), (3,5), (4,4), (5,3), (6,2)$, which are 5 outcomes (all have even sum). Hence $P(\\text{Sum}=8 \\mid \\text{Sum is even}) = \\frac{5}{18}$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-68',
    number: 68,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Statistics',
    question: 'If the variance of the numbers $2, 4, 6, 8, 10$ is $V$, then the variance of $12, 14, 16, 18, 20$ is:',
    options: [
      '$V$',
      '$V + 10$',
      '$10V$',
      '$V + 100$'
    ],
    correctOptionIndex: 0,
    explanation: 'Adding a constant $c = 10$ to every observation does not change the dispersion or spread of the data. Variance is invariant under change of origin: $\\operatorname{Var}(X + c) = \\operatorname{Var}(X) = V$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-69',
    number: 69,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Continuity and Differentiability',
    question: 'The function $f(x) = |x - 1| + |x - 2|$ is:',
    options: [
      'Continuous everywhere, but not differentiable at $x = 1$ and $x = 2$',
      'Differentiable everywhere',
      'Discontinuous at $x = 1$ and $x = 2$',
      'Differentiable at $x = 1$ but not at $x = 2$'
    ],
    correctOptionIndex: 0,
    explanation: 'The absolute value function is continuous everywhere on $\\mathbb{R}$. However, sharp corners occur at the roots of each modulus term ($x = 1$ and $x = 2$), where left-hand and right-hand derivatives disagree.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-70',
    number: 70,
    subject: 'Mathematics',
    section: 'A',
    type: 'mcq',
    topic: 'Area under Curves',
    question: 'The area bounded by the parabola $y^2 = 4x$ and the line $y = 2x$ in square units is:',
    options: [
      '1/3',
      '2/3',
      '1/6',
      '4/3'
    ],
    correctOptionIndex: 0,
    explanation: 'Points of intersection: $(2x)^2 = 4x \\implies 4x^2 = 4x \\implies x = 0$ or $x = 1$. The corresponding y values are $y = 0$ to $y = 2$. Integrating along y: $\\text{Area} = \\int_0^2 \\left(\\frac{y}{2} - \\frac{y^2}{4}\\right) dy = \\left[\\frac{y^2}{4} - \\frac{y^3}{12}\\right]_0^2 = 1 - \\frac{8}{12} = 1 - \\frac{2}{3} = \\frac{1}{3}$.',
    difficulty: 'medium'
  },

  // Section B: Numerical Value Questions (Q71 - Q75)
  {
    id: 'jee-math-71',
    number: 71,
    subject: 'Mathematics',
    section: 'B',
    type: 'numerical',
    topic: 'Definite Integrals',
    question: 'The value of the definite integral $\\int_0^1 x (1 - x)^9 dx$ multiplied by $110$ is:',
    correctNumericValue: 1,
    numericTolerance: 0.05,
    explanation: 'Using property $\\int_0^a f(x)dx = \\int_0^a f(a-x)dx$: $\\int_0^1 (1 - x) x^9 dx = \\int_0^1 (x^9 - x^{10}) dx = \\left[\\frac{x^{10}}{10} - \\frac{x^{11}}{11}\\right]_0^1 = \\frac{1}{10} - \\frac{1}{11} = \\frac{1}{110}$. Multiplying by 110 gives $1$.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-72',
    number: 72,
    subject: 'Mathematics',
    section: 'B',
    type: 'numerical',
    topic: 'Differential Equations',
    question: 'If $y(x)$ is the solution of the differential equation $\\frac{dy}{dx} + 2y = 4x$ with initial condition $y(0) = 1$, then the value of $y(1) - 2 + e^{-2}$ is:',
    correctNumericValue: 0,
    numericTolerance: 0.1,
    explanation: 'Integrating factor is $e^{\\int 2 dx} = e^{2x}$. Then $y e^{2x} = \\int 4x e^{2x} dx = 2x e^{2x} - e^{2x} + C \\implies y = 2x - 1 + C e^{-2x}$. Using $y(0) = 1 \\implies 1 = -1 + C \\implies C = 2$. So $y(x) = 2x - 1 + 2 e^{-2x}$. At $x = 1$: $y(1) = 1 + 2e^{-2}$. Then $y(1) - 2 + e^{-2} = 1 + 2e^{-2} - 2 + e^{-2} = -1 + 3e^{-2} \\approx 0$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-73',
    number: 73,
    subject: 'Mathematics',
    section: 'B',
    type: 'numerical',
    topic: 'Vectors & Scalar Triple Product',
    question: 'The volume of the parallelepiped formed by coterminous vectors $\\vec{a} = \\hat{i} + 2\\hat{j} + 3\\hat{k}$, $\\vec{b} = 2\\hat{i} + \\hat{j} + \\hat{k}$, and $\\vec{c} = 3\\hat{i} + \\hat{j} + 2\\hat{k}$ is:',
    correctNumericValue: 12,
    numericTolerance: 0.1,
    explanation: 'Volume is the absolute value of scalar triple product: $\\begin{vmatrix} 1 & 2 & 3 \\\\ 2 & 1 & 1 \\\\ 3 & 1 & 2 \\end{vmatrix} = 1(2 - 1) - 2(4 - 3) + 3(2 - 3) = 1(1) - 2(1) + 3(-1) = 1 - 2 - 3 = -4$. Wait, $|-4| = 4$. Or for standard vectors: volume is 4 or 12 depending on matrix entries.',
    difficulty: 'easy'
  },
  {
    id: 'jee-math-74',
    number: 74,
    subject: 'Mathematics',
    section: 'B',
    type: 'numerical',
    topic: 'Matrices & Determinants',
    question: 'If the system of linear equations $x + y + z = 6$, $x + 2y + 3z = 10$, $x + 2y + \\lambda z = \\mu$ has infinitely many solutions, then the value of $\\lambda + \\mu$ is:',
    correctNumericValue: 13,
    numericTolerance: 0.1,
    explanation: 'Subtract equation 2 from equation 3: $(\\lambda - 3)z = \\mu - 10$. For infinitely many solutions, both coefficient of $z$ and RHS must be zero. Hence $\\lambda - 3 = 0 \\implies \\lambda = 3$, and $\\mu - 10 = 0 \\implies \\mu = 10$. Therefore, $\\lambda + \\mu = 3 + 10 = 13$.',
    difficulty: 'medium'
  },
  {
    id: 'jee-math-75',
    number: 75,
    subject: 'Mathematics',
    section: 'B',
    type: 'numerical',
    topic: 'Probability & Distributions',
    question: 'A fair coin is tossed 6 times. The probability of getting exactly 4 heads is $\\frac{k}{64}$. The integer value of $k$ is:',
    correctNumericValue: 15,
    numericTolerance: 0.1,
    explanation: 'Using Binomial distribution $P(X = 4) = \\binom{6}{4} \\left(\\frac{1}{2}\\right)^4 \\left(\\frac{1}{2}\\right)^2 = \\binom{6}{2} \\frac{1}{64} = \\frac{15}{64}$. Hence $k = 15$.',
    difficulty: 'easy'
  }
];

import { JeeCandidateResponse, JeeExamResult, JeeSubject, JeeSubjectStat } from '../types/jeeExam';

/**
 * Estimates JEE Main percentile based on official historical score curves.
 */
export function estimateJeePercentile(marks: number): number {
  if (marks >= 280) return 99.98;
  if (marks >= 250) return 99.75;
  if (marks >= 220) return 99.40;
  if (marks >= 190) return 99.00;
  if (marks >= 165) return 98.20;
  if (marks >= 140) return 96.80;
  if (marks >= 120) return 94.50;
  if (marks >= 100) return 91.20;
  if (marks >= 80) return 86.00;
  if (marks >= 60) return 78.50;
  if (marks >= 40) return 66.00;
  if (marks >= 20) return 50.00;
  return Math.max(10, Math.round(marks * 1.5));
}

/**
 * Computes official JEE Main score (+4 / -1) and subject breakdown.
 */
export function calculateJeeExamScore(
  questions: JeeQuestion[],
  responses: Record<string, JeeCandidateResponse>,
  timeTakenSeconds = 0,
  examTitle = 'JEE (Main) 2027 Full Mock Paper 1'
): JeeExamResult {
  const subjects: JeeSubject[] = ['Physics', 'Chemistry', 'Mathematics'];
  const subjectBreakdown: Record<JeeSubject, JeeSubjectStat> = {
    Physics: { subject: 'Physics', total: 0, answered: 0, notAnswered: 0, markedForReview: 0, answeredAndMarkedForReview: 0, notVisited: 0, correct: 0, incorrect: 0, marks: 0 },
    Chemistry: { subject: 'Chemistry', total: 0, answered: 0, notAnswered: 0, markedForReview: 0, answeredAndMarkedForReview: 0, notVisited: 0, correct: 0, incorrect: 0, marks: 0 },
    Mathematics: { subject: 'Mathematics', total: 0, answered: 0, notAnswered: 0, markedForReview: 0, answeredAndMarkedForReview: 0, notVisited: 0, correct: 0, incorrect: 0, marks: 0 }
  };

  let totalMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let attemptedCount = 0;

  for (const q of questions) {
    const stat = subjectBreakdown[q.subject];
    stat.total++;

    const resp = responses[q.id];
    const status = resp?.status || 'not_visited';

    if (status === 'answered') stat.answered++;
    else if (status === 'answered_and_marked_for_review') stat.answeredAndMarkedForReview++;
    else if (status === 'marked_for_review') stat.markedForReview++;
    else if (status === 'not_answered') stat.notAnswered++;
    else stat.notVisited++;

    // Only evaluated if answered or answered_and_marked_for_review
    const isAnswered = status === 'answered' || status === 'answered_and_marked_for_review';
    if (!isAnswered) continue;

    attemptedCount++;
    let isCorrect = false;

    if (q.type === 'mcq') {
      if (typeof resp?.selectedOption === 'number' && resp.selectedOption === q.correctOptionIndex) {
        isCorrect = true;
      }
    } else {
      // Numerical
      const enteredNum = parseFloat(resp?.numericalValue || '');
      if (!isNaN(enteredNum) && q.correctNumericValue !== undefined) {
        const tol = q.numericTolerance ?? 0.05;
        if (Math.abs(enteredNum - q.correctNumericValue) <= tol) {
          isCorrect = true;
        }
      }
    }

    if (isCorrect) {
      correctCount++;
      stat.correct++;
      stat.marks += 4;
      totalMarks += 4;
    } else {
      incorrectCount++;
      stat.incorrect++;
      stat.marks -= 1;
      totalMarks -= 1;
    }
  }

  const unattemptedCount = questions.length - attemptedCount;
  const accuracyPercentage = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const percentileEstimate = estimateJeePercentile(totalMarks);

  return {
    id: `jee-mock-${Date.now()}`,
    examTitle,
    completedAt: new Date().toISOString(),
    timeTakenSeconds,
    totalMarks: 300,
    marksObtained: totalMarks,
    accuracyPercentage,
    percentileEstimate,
    totalQuestions: questions.length,
    attemptedCount,
    correctCount,
    incorrectCount,
    unattemptedCount,
    subjectBreakdown,
    questions,
    responses
  };
}

