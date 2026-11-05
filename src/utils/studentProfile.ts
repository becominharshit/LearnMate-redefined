import type { StudentAcademicProfile } from '../types/study';

/**
 * Empty profile defaults. Nothing here pretends to know the student: no school, no weak
 * chapters, no goal statement. The first-run setup fills the four facts we actually need.
 */
export const DEFAULT_STUDENT_PROFILE: StudentAcademicProfile = {
  fullName: '',
  educationStage: 'school',
  schoolClass: '',
  stream: '',
  schoolBoard: '',
  schoolName: '',
  collegeYear: '',
  degreeCourse: '',
  universityName: '',
  academicYear: '',
  ageBand: '',
  examSession: 'jee_main_2027_session_1',
  setupCompleted: false,
  primaryGoal: 'competitive_exam',
  targetExam: 'jee_main',
  targetExamYear: '2027',
  subjectsStudied: [],
  weakAreas: [],
  preferredLanguage: 'English',
  personalGoalStatement: '',
  dailyStudyMinutesGoal: 90,
  updatedAt: '',
};

/** Values written by the old default profile. They are not the student's real details. */
const LEGACY_PLACEHOLDER_NAME = 'LearnMate Student';
const LEGACY_SCHOOL = 'National Public School';
const LEGACY_DEGREE = 'B.Tech CSE / AI';
const LEGACY_UNIVERSITY = 'Indian Institute of Technology';
const LEGACY_GOAL =
  'Master probability, calculus, and mechanics with 85%+ mock test accuracy.';
const LEGACY_WEAK_AREAS = new Set([
  'Conditional Probability',
  'Bayes Theorem',
  'Rotational Dynamics',
]);
const LEGACY_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Probability & Statistics'];

function sameList(values: string[], expected: Set<string> | string[]): boolean {
  const expectedList = Array.isArray(expected) ? expected : Array.from(expected);
  if (values.length !== expectedList.length) return false;
  return values.every((value) => expectedList.includes(value));
}

/**
 * Cleans profiles saved by older versions and fills fields added later. The fake school,
 * weak chapters, degree and goal from the old default profile are removed, while values a
 * student actually typed are kept.
 */
export function normalizeStudentProfile(
  raw: Partial<StudentAcademicProfile> | null | undefined
): StudentAcademicProfile {
  const merged: StudentAcademicProfile = {
    ...DEFAULT_STUDENT_PROFILE,
    ...(raw || {}),
    subjectsStudied: Array.isArray(raw?.subjectsStudied) ? [...raw.subjectsStudied] : [],
    weakAreas: Array.isArray(raw?.weakAreas) ? [...raw.weakAreas] : [],
    updatedAt: raw?.updatedAt || '',
  };

  if (merged.fullName.trim() === LEGACY_PLACEHOLDER_NAME) merged.fullName = '';
  if (merged.schoolName.trim() === LEGACY_SCHOOL) merged.schoolName = '';
  if (merged.degreeCourse.trim() === LEGACY_DEGREE) merged.degreeCourse = '';
  if (merged.universityName.trim() === LEGACY_UNIVERSITY) merged.universityName = '';
  if (merged.personalGoalStatement.trim() === LEGACY_GOAL) merged.personalGoalStatement = '';
  if (sameList(merged.weakAreas, LEGACY_WEAK_AREAS)) merged.weakAreas = [];
  if (sameList(merged.subjectsStudied, LEGACY_SUBJECTS)) merged.subjectsStudied = [];

  // Older profiles had no setup flag. Treat a real name as already set up so existing
  // students are not forced through first-run setup again.
  if (typeof raw?.setupCompleted !== 'boolean') {
    merged.setupCompleted = Boolean(merged.fullName.trim());
  }

  if (merged.ageBand !== 'under_16' && merged.ageBand !== '16_17' && merged.ageBand !== '18_plus') {
    merged.ageBand = '';
  }
  if (
    merged.examSession !== 'jee_main_2027_session_1' &&
    merged.examSession !== 'jee_main_2027_session_2'
  ) {
    merged.examSession = 'jee_main_2027_session_1';
  }

  return merged;
}

/** True when a stored profile still has fields or fake values from an older version. */
export function profileNeedsMigration(
  raw: Partial<StudentAcademicProfile> | null | undefined
): boolean {
  if (!raw) return false;
  if (
    raw.setupCompleted === undefined ||
    raw.ageBand === undefined ||
    raw.examSession === undefined
  ) {
    return true;
  }
  if (raw.fullName?.trim() === LEGACY_PLACEHOLDER_NAME) return true;
  if (raw.schoolName?.trim() === LEGACY_SCHOOL) return true;
  if (raw.degreeCourse?.trim() === LEGACY_DEGREE) return true;
  if (raw.universityName?.trim() === LEGACY_UNIVERSITY) return true;
  if (raw.personalGoalStatement?.trim() === LEGACY_GOAL) return true;
  if (Array.isArray(raw.weakAreas) && sameList(raw.weakAreas, LEGACY_WEAK_AREAS)) return true;
  if (Array.isArray(raw.subjectsStudied) && sameList(raw.subjectsStudied, LEGACY_SUBJECTS)) {
    return true;
  }
  return false;
}

/** True when the four first-run answers have been saved. */
export function isProfileSetupComplete(profile: StudentAcademicProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.setupCompleted) return true;
  return Boolean(
    profile.fullName.trim() &&
      profile.schoolClass &&
      profile.preferredLanguage &&
      profile.ageBand
  );
}
