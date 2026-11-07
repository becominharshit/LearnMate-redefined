import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_JEE_75_QUESTION_PAPER,
  calculateJeeExamScore,
  estimateJeePercentile,
} from './jeeQuestionBank';
import { JeeCandidateResponse } from '../types/jeeExam';

test('DEFAULT_JEE_75_QUESTION_PAPER contains exactly 75 questions distributed 25-25-25 across P-C-M', () => {
  assert.equal(DEFAULT_JEE_75_QUESTION_PAPER.length, 75);

  const physics = DEFAULT_JEE_75_QUESTION_PAPER.filter((q) => q.subject === 'Physics');
  const chemistry = DEFAULT_JEE_75_QUESTION_PAPER.filter((q) => q.subject === 'Chemistry');
  const maths = DEFAULT_JEE_75_QUESTION_PAPER.filter((q) => q.subject === 'Mathematics');

  assert.equal(physics.length, 25);
  assert.equal(chemistry.length, 25);
  assert.equal(maths.length, 25);

  // Each subject must have 20 Section A (MCQs) and 5 Section B (Numerical)
  for (const [subjName, list] of [
    ['Physics', physics],
    ['Chemistry', chemistry],
    ['Mathematics', maths],
  ] as const) {
    const secA = list.filter((q) => q.section === 'A');
    const secB = list.filter((q) => q.section === 'B');
    assert.equal(secA.length, 20, `${subjName} Section A must have 20 MCQs`);
    assert.equal(secB.length, 5, `${subjName} Section B must have 5 Numerical questions`);

    for (const q of secA) {
      assert.equal(q.type, 'mcq');
      assert.ok(q.options && q.options.length === 4);
      assert.ok(typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3);
      assert.ok(q.explanation.length > 5);
    }

    for (const q of secB) {
      assert.equal(q.type, 'numerical');
      assert.ok(typeof q.correctNumericValue === 'number');
      assert.ok(q.explanation.length > 5);
    }
  }
});

test('calculateJeeExamScore applies official +4 / -1 marking to both MCQ and Numerical sections', () => {
  const q1 = DEFAULT_JEE_75_QUESTION_PAPER[0]; // Physics MCQ (correct: 0)
  const q2 = DEFAULT_JEE_75_QUESTION_PAPER[1]; // Physics MCQ (correct: 0)
  const q21 = DEFAULT_JEE_75_QUESTION_PAPER[20]; // Physics Numerical (correct: 20)
  const q22 = DEFAULT_JEE_75_QUESTION_PAPER[21]; // Physics Numerical (correct: 5)
  const q3 = DEFAULT_JEE_75_QUESTION_PAPER[2]; // Unattempted

  const responses: Record<string, JeeCandidateResponse> = {
    // Q1: Correct MCQ -> +4
    [q1.id]: {
      selectedOption: q1.correctOptionIndex,
      status: 'answered',
      visited: true,
    },
    // Q2: Incorrect MCQ -> -1
    [q2.id]: {
      selectedOption: (q2.correctOptionIndex! + 1) % 4,
      status: 'answered',
      visited: true,
    },
    // Q21: Correct Numerical -> +4
    [q21.id]: {
      numericalValue: String(q21.correctNumericValue),
      status: 'answered',
      visited: true,
    },
    // Q22: Incorrect Numerical -> -1
    [q22.id]: {
      numericalValue: '999',
      status: 'answered',
      visited: true,
    },
    // Q3: Marked for review without answer -> 0 marks
    [q3.id]: {
      status: 'marked_for_review',
      visited: true,
    },
  };

  const result = calculateJeeExamScore(DEFAULT_JEE_75_QUESTION_PAPER, responses, 3600);

  // Attempted: 4 (Q1, Q2, Q21, Q22)
  assert.equal(result.attemptedCount, 4);
  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 2);
  assert.equal(result.unattemptedCount, 71);

  // Net score: 4 - 1 + 4 - 1 = +6 marks
  assert.equal(result.marksObtained, 6);
  assert.equal(result.accuracyPercentage, 50);

  // Physics subject breakdown
  assert.equal(result.subjectBreakdown.Physics.correct, 2);
  assert.equal(result.subjectBreakdown.Physics.incorrect, 2);
  assert.equal(result.subjectBreakdown.Physics.marks, 6);
});

test('calculateJeeExamScore evaluates answered_and_marked_for_review questions', () => {
  const q1 = DEFAULT_JEE_75_QUESTION_PAPER[0];
  const responses: Record<string, JeeCandidateResponse> = {
    [q1.id]: {
      selectedOption: q1.correctOptionIndex,
      status: 'answered_and_marked_for_review',
      visited: true,
    },
  };

  const result = calculateJeeExamScore(DEFAULT_JEE_75_QUESTION_PAPER, responses, 1200);
  assert.equal(result.attemptedCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.marksObtained, 4);
});

test('estimateJeePercentile maps score to realistic JEE Main historical percentiles', () => {
  assert.ok(estimateJeePercentile(285) >= 99.9);
  assert.ok(estimateJeePercentile(225) >= 99.0);
  assert.ok(estimateJeePercentile(170) >= 98.0);
  assert.ok(estimateJeePercentile(125) >= 94.0);
  assert.ok(estimateJeePercentile(50) >= 60.0);
});
