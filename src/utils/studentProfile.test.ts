import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STUDENT_PROFILE,
  isProfileSetupComplete,
  normalizeStudentProfile,
} from './studentProfile';

test('defaults contain no invented school, weak chapters or goal', () => {
  assert.equal(DEFAULT_STUDENT_PROFILE.fullName, '');
  assert.equal(DEFAULT_STUDENT_PROFILE.schoolName, '');
  assert.deepEqual(DEFAULT_STUDENT_PROFILE.weakAreas, []);
  assert.equal(DEFAULT_STUDENT_PROFILE.personalGoalStatement, '');
  assert.equal(DEFAULT_STUDENT_PROFILE.setupCompleted, false);
});

test('legacy fake profile values are cleaned up', () => {
  const cleaned = normalizeStudentProfile({
    fullName: 'LearnMate Student',
    schoolName: 'National Public School',
    degreeCourse: 'B.Tech CSE / AI',
    universityName: 'Indian Institute of Technology',
    personalGoalStatement:
      'Master probability, calculus, and mechanics with 85%+ mock test accuracy.',
    weakAreas: ['Conditional Probability', 'Bayes Theorem', 'Rotational Dynamics'],
    subjectsStudied: ['Mathematics', 'Physics', 'Chemistry', 'Probability & Statistics'],
  });

  assert.equal(cleaned.fullName, '');
  assert.equal(cleaned.schoolName, '');
  assert.equal(cleaned.degreeCourse, '');
  assert.equal(cleaned.universityName, '');
  assert.equal(cleaned.personalGoalStatement, '');
  assert.deepEqual(cleaned.weakAreas, []);
  assert.deepEqual(cleaned.subjectsStudied, []);
  assert.equal(cleaned.setupCompleted, false);
});

test('real details survive migration while only fake chapters are removed', () => {
  const cleaned = normalizeStudentProfile({
    fullName: 'Aarav Sharma',
    schoolName: 'Delhi Public School',
    weakAreas: ['Conditional Probability', 'Bayes Theorem', 'Rotational Dynamics'],
    subjectsStudied: ['Physics', 'Chemistry', 'Mathematics'],
    updatedAt: '2026-11-01T10:00:00.000Z',
  });

  assert.equal(cleaned.fullName, 'Aarav Sharma');
  assert.equal(cleaned.schoolName, 'Delhi Public School');
  assert.deepEqual(cleaned.weakAreas, []);
  assert.deepEqual(cleaned.subjectsStudied, ['Physics', 'Chemistry', 'Mathematics']);
  assert.equal(cleaned.setupCompleted, true, 'existing real profiles are not forced through setup');
});

test('setup is complete only after the four answers are saved', () => {
  assert.equal(isProfileSetupComplete(null), false);
  assert.equal(isProfileSetupComplete(DEFAULT_STUDENT_PROFILE), false);

  const saved = normalizeStudentProfile({
    fullName: 'Aarav Sharma',
    schoolClass: 'Class 12',
    preferredLanguage: 'English',
    ageBand: '16_17',
    setupCompleted: true,
  });
  assert.equal(isProfileSetupComplete(saved), true);
});

test('an invalid age band or exam session falls back safely', () => {
  const cleaned = normalizeStudentProfile({
    ageBand: 'unknown' as never,
    examSession: 'unknown' as never,
  });
  assert.equal(cleaned.ageBand, '');
  assert.equal(cleaned.examSession, 'jee_main_2027_session_1');
});
