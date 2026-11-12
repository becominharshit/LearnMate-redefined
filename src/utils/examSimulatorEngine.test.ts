import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAM_BLUEPRINTS,
  getExamBlueprint,
  evaluateExamSession
} from './examSimulatorEngine';
import { QuizQuestion } from '../types/study';

test('EXAM_BLUEPRINTS supports all 9 student exam types (including BITSAT & VITEEE) with accurate marking rules', () => {
  const keys = Object.keys(EXAM_BLUEPRINTS);
  assert.deepEqual(keys, [
    'jee_main',
    'jee_advanced',
    'bitsat',
    'viteee',
    'neet_ug',
    'cuet',
    'board_exams',
    'university_exams',
    'general_practice'
  ]);

  assert.equal(getExamBlueprint('jee_main').correctMarks, 4);
  assert.equal(getExamBlueprint('jee_main').negativeMarks, 1);
  assert.equal(getExamBlueprint('bitsat').correctMarks, 3);
  assert.equal(getExamBlueprint('bitsat').negativeMarks, 1);
  assert.equal(getExamBlueprint('viteee').correctMarks, 1);
  assert.equal(getExamBlueprint('viteee').negativeMarks, 0);
  assert.equal(getExamBlueprint('cuet').correctMarks, 5);
  assert.equal(getExamBlueprint('board_exams').negativeMarks, 0);
  assert.equal(getExamBlueprint('general_practice').supportsTimedMode, false);
});

test('evaluateExamSession calculates positive, negative, net score, and topic breakdown accurately', () => {
  const questions: QuizQuestion[] = [
    {
      id: 'q1',
      question: 'Q1',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      explanation: 'Exp 1',
      topic: 'Probability Axioms',
      sourcePage: 1,
      sourceQuote: 'Quote 1',
      difficulty: 'easy'
    },
    {
      id: 'q2',
      question: 'Q2',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      explanation: 'Exp 2',
      topic: 'Probability Axioms',
      sourcePage: 1,
      sourceQuote: 'Quote 2',
      difficulty: 'medium'
    },
    {
      id: 'q3',
      question: 'Q3',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      explanation: 'Exp 3',
      topic: 'Bayes Theorem',
      sourcePage: 2,
      sourceQuote: 'Quote 3',
      difficulty: 'hard'
    }
  ];

  // Q1 correct (+4), Q2 wrong (-1), Q3 unattempted (0) -> Net score = 3 / 12
  const summary = evaluateExamSession(questions, { q1: 1, q2: 0 }, 4, 1);

  assert.equal(summary.totalQuestions, 3);
  assert.equal(summary.attemptedCount, 2);
  assert.equal(summary.unattemptedCount, 1);
  assert.equal(summary.correctCount, 1);
  assert.equal(summary.incorrectCount, 1);
  assert.equal(summary.positiveScore, 4);
  assert.equal(summary.negativeScore, 1);
  assert.equal(summary.netScore, 3);
  assert.equal(summary.maxPossibleScore, 12);
  assert.equal(summary.accuracyPercent, 50);
  assert.equal(summary.topicBreakdown.length, 2);
});
