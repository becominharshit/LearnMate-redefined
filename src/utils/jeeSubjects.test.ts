import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyJeeSubject, computeStudyStreak } from './jeeSubjects';

test('classifyJeeSubject maps JEE chapters to the right subject', () => {
  assert.equal(classifyJeeSubject('Rotational Motion: moment of inertia'), 'Physics');
  assert.equal(classifyJeeSubject('Electrostatics and Gauss law'), 'Physics');
  assert.equal(classifyJeeSubject('Simple Harmonic Motion'), 'Physics');
  assert.equal(classifyJeeSubject('Thermodynamics'), 'Physics');
  assert.equal(classifyJeeSubject('Coordination Compounds'), 'Chemistry');
  assert.equal(classifyJeeSubject('Hybridisation and VSEPR'), 'Chemistry');
  assert.equal(classifyJeeSubject('Haloalkanes and Haloarenes'), 'Chemistry');
  assert.equal(classifyJeeSubject('Definite Integration'), 'Mathematics');
  assert.equal(classifyJeeSubject('Conditional Probability & Bayes Theorem'), 'Mathematics');
  assert.equal(classifyJeeSubject('Excellent revision'), null);
});

test('classifyJeeSubject only matches keywords at the start of a word', () => {
  // "valence" (Chemistry) must not match inside "Equivalence".
  assert.equal(
    classifyJeeSubject('Sets and Relations Equivalence Relations & Partial Orders'),
    'Mathematics'
  );
  assert.equal(classifyJeeSubject('Three Dimensional Geometry'), 'Mathematics');
  // "ph " must not match the end of "graph".
  assert.equal(classifyJeeSubject('Velocity-time graph of a particle'), 'Physics');
  assert.equal(classifyJeeSubject('pH of buffer solutions'), 'Chemistry');
});

test('computeStudyStreak counts consecutive local days ending today or yesterday', () => {
  const today = new Date(2026, 10, 3, 20, 0);
  const day = (offset: number, hour = 10) => new Date(2026, 10, 3 - offset, hour, 0);

  assert.equal(computeStudyStreak([], today), 0);
  assert.equal(computeStudyStreak([day(0), day(1), day(2)], today), 3);
  assert.equal(computeStudyStreak([day(1), day(2)], today), 2);
  assert.equal(computeStudyStreak([day(0), day(0, 18), day(2)], today), 1);
  assert.equal(computeStudyStreak([day(2), day(3)], today), 0);
});
