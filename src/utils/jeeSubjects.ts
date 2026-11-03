export type JeeSubject = 'Physics' | 'Chemistry' | 'Mathematics';

export const JEE_SUBJECTS: JeeSubject[] = ['Physics', 'Chemistry', 'Mathematics'];

/** Chapter and concept keywords from the JEE Main syllabus, used to group results by subject. */
const SUBJECT_KEYWORDS: Record<JeeSubject, string[]> = {
  Physics: [
    'kinematic', 'projectile', 'laws of motion', 'newton', 'friction', 'work energy', 'work, energy',
    'momentum', 'collision', 'rotational', 'torque', 'moment of inertia', 'angular momentum', 'rolling',
    'gravitation', 'escape velocity', 'elasticity', 'young\'s modulus', 'fluid', 'viscosity',
    'surface tension', 'bernoulli', 'thermal expansion', 'calorimetry', 'heat transfer', 'thermodynamics',
    'kinetic theory', 'oscillation', 'simple harmonic', 'shm', 'pendulum', 'wave', 'sound', 'doppler',
    'electrostatic', 'coulomb', 'electric field', 'gauss', 'capacitor', 'capacitance', 'current electricity',
    'ohm', 'kirchhoff', 'resistance', 'wheatstone', 'potentiometer', 'magnetic', 'biot', 'ampere',
    'electromagnetic induction', 'faraday', 'lenz', 'inductance', 'alternating current', 'lcr',
    'electromagnetic wave', 'ray optics', 'refraction', 'reflection', 'lens', 'mirror', 'prism',
    'wave optics', 'interference', 'diffraction', 'polari', 'ydse', 'photoelectric', 'dual nature',
    'de broglie', 'bohr', 'nuclei', 'nuclear', 'radioactiv', 'semiconductor', 'diode', 'transistor',
    'logic gate', 'units and measurement', 'dimension', 'vernier', 'screw gauge', 'velocity',
    'acceleration', 'physics',
  ],
  Chemistry: [
    'mole concept', 'stoichiometr', 'atomic structure', 'quantum number', 'periodic', 'chemical bonding',
    'hybridi', 'vsepr', 'molecular orbital', 'ionic bond', 'covalent', 'thermochemistry', 'enthalpy',
    'entropy', 'gibbs', 'chemical equilibrium', 'ionic equilibrium', 'ph ', 'buffer', 'solubility product',
    'redox', 'oxidation number', 'electrochemi', 'nernst', 'chemical kinetics', 'rate law', 'rate constant',
    'order of reaction', 'colligative', 'raoult', 'osmotic', 'adsorption', 'catalys', 's-block', 'p-block',
    'd-block', 'f-block', 'transition element', 'lanthan', 'coordination compound', 'ligand', 'metallurgy',
    'hydrogen peroxide', 'organic', 'iupac', 'isomer', 'stereochem', 'chiral', 'general organic',
    'hydrocarbon', 'alkane', 'alkene', 'alkyne', 'benzene', 'aromatic', 'haloalkane', 'haloarene',
    'alcohol', 'phenol', 'ether', 'aldehyde', 'ketone', 'carboxylic', 'amine', 'diazonium', 'biomolecule',
    'carbohydrate', 'protein', 'polymer', 'salt analysis', 'titration', 'sn1', 'sn2', 'electrophil',
    'nucleophil', 'chemistry', 'molarity', 'valence',
  ],
  Mathematics: [
    'sets', 'relations and functions', 'complex number', 'quadratic', 'sequence', 'series', 'progression',
    'permutation', 'combination', 'binomial', 'matri', 'determinant', 'limit', 'continuity',
    'differentiab', 'derivative', 'differentiation', 'application of derivative', 'maxima', 'minima',
    'integral', 'integration', 'area under', 'differential equation', 'straight line', 'circle',
    'parabola', 'ellipse', 'hyperbola', 'conic', 'coordinate geometry', 'vector algebra', 'vectors',
    '3d geometry', 'three dimensional', 'direction cosine', 'probability', 'bayes', 'statistics',
    'variance', 'standard deviation', 'trigonometr', 'inverse trigonometric', 'mathematical induction',
    'mathematics', 'maths', 'calculus', 'algebra', 'geometry',
  ],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Keywords match only at the start of a word, so stems still work ("hybridi" matches
 * "hybridisation") but "valence" does not match inside "equivalence".
 */
const SUBJECT_PATTERNS = Object.fromEntries(
  JEE_SUBJECTS.map((subject) => [
    subject,
    SUBJECT_KEYWORDS[subject].map((keyword) => ({
      pattern: new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}`),
      weight: keyword.length >= 7 ? 2 : 1,
    })),
  ])
) as Record<JeeSubject, Array<{ pattern: RegExp; weight: number }>>;

/** Best-matching JEE subject for a topic or chapter name, or null when nothing matches. */
export function classifyJeeSubject(text: string): JeeSubject | null {
  const haystack = ` ${text.toLowerCase()} `;
  let best: JeeSubject | null = null;
  let bestScore = 0;
  for (const subject of JEE_SUBJECTS) {
    let score = 0;
    for (const { pattern, weight } of SUBJECT_PATTERNS[subject]) {
      if (pattern.test(haystack)) score += weight;
    }
    if (score > bestScore) {
      best = subject;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Consecutive local days with study activity, ending today (or yesterday, so a streak is not
 * lost before the student has studied today).
 */
export function computeStudyStreak(activity: Date[], today: Date = new Date()): number {
  const days = new Set(activity.filter((d) => !Number.isNaN(d.getTime())).map(localDayKey));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
