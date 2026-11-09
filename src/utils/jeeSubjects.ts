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

export const STUDY_ACTIVITY_CHECKIN_STORAGE_KEY = 'learnmate_study_activity_days_v1';

export interface StudyActivityDayCell {
  dayKey: string;
  shortWeekday: string;
  dayOfMonth: number;
  monthShort: string;
  isToday: boolean;
  isActive: boolean;
  inCurrentStreak: boolean;
  activityCount: number;
}

export interface StudyActivityStreakSummary {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  isTodayActive: boolean;
  isStreakAtRiskToday: boolean;
  days: StudyActivityDayCell[];
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Pure helper that builds a complete streak summary and 14-day timeline from raw activity Date objects.
 */
export function computeStudyActivityStreakSummary(
  activity: Date[],
  today: Date = new Date(),
  windowDays = 14
): StudyActivityStreakSummary {
  const countsByDay = new Map<string, number>();
  for (const raw of activity) {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = localDayKey(d);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  const activeDayKeys = new Set(countsByDay.keys());
  const todayAnchor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = localDayKey(todayAnchor);
  const isTodayActive = activeDayKeys.has(todayKey);

  // Determine which day keys belong to the active consecutive streak
  const streakDayKeys = new Set<string>();
  const cursor = new Date(todayAnchor);
  let canStartStreak = true;
  if (!activeDayKeys.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDayKeys.has(localDayKey(cursor))) {
      canStartStreak = false;
    }
  }
  if (canStartStreak) {
    while (activeDayKeys.has(localDayKey(cursor))) {
      streakDayKeys.add(localDayKey(cursor));
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const currentStreak = streakDayKeys.size;
  const isStreakAtRiskToday = !isTodayActive && currentStreak > 0;

  // Calculate longest consecutive day streak across all recorded history
  const sortedKeys = Array.from(activeDayKeys).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: Date | null = null;

  for (const key of sortedKeys) {
    const [y, m, d] = key.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d);
    if (prevDate) {
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / 86_400_000);
      if (diffDays === 1) {
        runningStreak += 1;
      } else {
        runningStreak = 1;
      }
    } else {
      runningStreak = 1;
    }
    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDate = currentDate;
  }

  const days: StudyActivityDayCell[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const cellDate = new Date(todayAnchor);
    cellDate.setDate(todayAnchor.getDate() - offset);
    const key = localDayKey(cellDate);
    const count = countsByDay.get(key) ?? 0;
    days.push({
      dayKey: key,
      shortWeekday: WEEKDAY_SHORT[cellDate.getDay()],
      dayOfMonth: cellDate.getDate(),
      monthShort: MONTH_SHORT[cellDate.getMonth()],
      isToday: offset === 0,
      isActive: count > 0,
      inCurrentStreak: streakDayKeys.has(key),
      activityCount: count,
    });
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalActiveDays: activeDayKeys.size,
    isTodayActive,
    isStreakAtRiskToday,
    days,
  };
}

/**
 * Retrieves all recorded study activity timestamps from localStorage keys used by LearnMate JEE:
 * - learnmate_study_activity_days_v1 (explicit daily check-ins & session logs)
 * - learnmate_documents_v1 (lastStudiedAt, createdAt)
 * - learnmate_quiz_attempts_v1 (completedAt)
 * - learnmate_focus_sessions_v1 (completedAt)
 * - learnmate_concept_attempts_v1 (timestamp)
 * - learnmate_handwritten_notes_v1 (updatedAt)
 */
export function getStudyActivityDatesFromLocalStorage(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): Date[] {
  const dates: Date[] = [];
  if (!storage) return dates;

  const pushValidDate = (val: unknown) => {
    if (!val) return;
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      const parsed = new Date(y, m - 1, d, 12, 0, 0);
      if (!Number.isNaN(parsed.getTime())) dates.push(parsed);
      return;
    }
    if (typeof val === 'string' || typeof val === 'number') {
      const parsed = new Date(val);
      if (!Number.isNaN(parsed.getTime())) dates.push(parsed);
    }
  };

  try {
    const checkinsRaw = storage.getItem(STUDY_ACTIVITY_CHECKIN_STORAGE_KEY);
    if (checkinsRaw) {
      const parsed = JSON.parse(checkinsRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach(pushValidDate);
      }
    }
  } catch {
    // Ignore malformed JSON
  }

  const collectionKeys: Array<{ key: string; fields: string[] }> = [
    { key: 'learnmate_documents_v1', fields: ['lastStudiedAt', 'createdAt'] },
    { key: 'learnmate_quiz_attempts_v1', fields: ['completedAt', 'timestamp'] },
    { key: 'learnmate_focus_sessions_v1', fields: ['completedAt'] },
    { key: 'learnmate_concept_attempts_v1', fields: ['timestamp'] },
    { key: 'learnmate_handwritten_notes_v1', fields: ['updatedAt', 'createdAt'] },
  ];

  for (const { key, fields } of collectionKeys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        for (const field of fields) {
          pushValidDate((item as Record<string, unknown>)[field]);
        }
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  return dates;
}

/**
 * Records a study check-in for the given date in localStorage so consecutive study days persist across reloads.
 */
export function recordDailyStudyCheckIn(
  date: Date = new Date(),
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): string[] {
  if (!storage) return [];
  const dayKey = localDayKey(date);
  let existing: string[] = [];
  try {
    const raw = storage.getItem(STUDY_ACTIVITY_CHECKIN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existing = parsed.filter((v): v is string => typeof v === 'string');
      }
    }
  } catch {
    existing = [];
  }

  if (!existing.includes(dayKey)) {
    existing.push(dayKey);
  }
  const deduped = Array.from(new Set(existing)).sort();
  try {
    storage.setItem(STUDY_ACTIVITY_CHECKIN_STORAGE_KEY, JSON.stringify(deduped));
  } catch {
    // Ignore quota errors
  }
  return deduped;
}

