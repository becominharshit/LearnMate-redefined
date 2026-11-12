import { ExamTypeId, QuizQuestion } from '../types/study';

export interface ExamBlueprint {
  id: ExamTypeId;
  shortName: string;
  fullName: string;
  categoryBadge: string;
  patternNote: string;
  subjects: string[];
  sections: string[];
  questionTypes: string[];
  defaultQuestionCount: number;
  defaultDurationMinutes: number;
  correctMarks: number;
  negativeMarks: number;
  supportsTimedMode: boolean;
}

export const EXAM_BLUEPRINTS: Record<ExamTypeId, ExamBlueprint> = {
  jee_main: {
    id: 'jee_main',
    shortName: 'JEE Main',
    fullName: 'JEE Main — Engineering Entrance Pattern',
    categoryBadge: 'NTA UG Engineering',
    patternNote: 'Customizable Practice Pattern • +4 Correct, −1 Negative Marking • Single Choice & Numerical',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: ['Section A (Single Choice Objective)', 'Section B (Numerical Value)'],
    questionTypes: ['Single Choice MCQ', 'Numerical Value'],
    defaultQuestionCount: 15,
    defaultDurationMinutes: 30,
    correctMarks: 4,
    negativeMarks: 1,
    supportsTimedMode: true
  },
  jee_advanced: {
    id: 'jee_advanced',
    shortName: 'JEE Advanced',
    fullName: 'JEE Advanced — IIT Entrance Pattern',
    categoryBadge: 'IIT Entrance',
    patternNote: 'Customizable Practice Pattern • +4 Correct, −1 Negative Marking • Deep Multi-Concept Analytical',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: ['Paper 1 — Analytical MCQs', 'Paper 2 — Stem & Matrix Match'],
    questionTypes: ['Single Correct', 'Multiple Concept Analytical', 'Integer Type'],
    defaultQuestionCount: 15,
    defaultDurationMinutes: 30,
    correctMarks: 4,
    negativeMarks: 1,
    supportsTimedMode: true
  },
  bitsat: {
    id: 'bitsat',
    shortName: 'BITSAT',
    fullName: 'BITSAT — BITS Pilani Online Test Pattern',
    categoryBadge: 'BITS Pilani / Goa / Hyderabad',
    patternNote: 'High-Speed CBT Pattern • +3 Correct, −1 Negative Marking • Physics, Chemistry, Math & Logical Reasoning',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: ['Part I — Physics', 'Part II — Chemistry', 'Part IV — Mathematics'],
    questionTypes: ['Single Choice Speed MCQ'],
    defaultQuestionCount: 15,
    defaultDurationMinutes: 20,
    correctMarks: 3,
    negativeMarks: 1,
    supportsTimedMode: true
  },
  viteee: {
    id: 'viteee',
    shortName: 'VITEEE',
    fullName: 'VITEEE — VIT Engineering Entrance Exam',
    categoryBadge: 'VIT Vellore / Chennai',
    patternNote: 'No Negative Marking Pattern • +1 Correct, 0 Negative Marking • High-Accuracy PCM & Aptitude',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    sections: ['Mathematics (40 Q)', 'Physics (35 Q)', 'Chemistry (35 Q)'],
    questionTypes: ['Single Choice Objective (+1, 0)'],
    defaultQuestionCount: 15,
    defaultDurationMinutes: 18,
    correctMarks: 1,
    negativeMarks: 0,
    supportsTimedMode: true
  },
  neet_ug: {
    id: 'neet_ug',
    shortName: 'NEET UG',
    fullName: 'NEET UG — Medical Entrance Pattern',
    categoryBadge: 'Medical UG',
    patternNote: 'Customizable Practice Pattern • +4 Correct, −1 Negative Marking • High-Speed NCERT & Application',
    subjects: ['Physics', 'Chemistry', 'Biology (Botany & Zoology)'],
    sections: ['Section A (Mandatory Core)', 'Section B (Application & Assertion-Reason)'],
    questionTypes: ['Single Choice MCQ', 'Statement / Assertion-Reason'],
    defaultQuestionCount: 15,
    defaultDurationMinutes: 20,
    correctMarks: 4,
    negativeMarks: 1,
    supportsTimedMode: true
  },
  cuet: {
    id: 'cuet',
    shortName: 'CUET',
    fullName: 'CUET — Central University Entrance Test',
    categoryBadge: 'Central Universities',
    patternNote: 'Customizable Practice Pattern • +5 Correct, −1 Negative Marking • Domain Subject & Aptitude',
    subjects: ['Domain Subject', 'General Test & Quantitative', 'Language & Comprehension'],
    sections: ['Domain Specific MCQs', 'Case-Passage Based'],
    questionTypes: ['Single Choice MCQ', 'Passage-Based MCQ'],
    defaultQuestionCount: 15,
    defaultDurationMinutes: 20,
    correctMarks: 5,
    negativeMarks: 1,
    supportsTimedMode: true
  },
  board_exams: {
    id: 'board_exams',
    shortName: 'Board Exams',
    fullName: 'School Board Exams (CBSE / ICSE / State)',
    categoryBadge: 'Class 10 & 12 Boards',
    patternNote: 'Customizable Practice Pattern • +1 Correct, 0 Negative Marking • Competency & Case-Study Focus',
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science'],
    sections: ['Section A (Objective & Assertion)', 'Section B (Case-Study & Conceptual)'],
    questionTypes: ['Competency MCQ', 'Assertion-Reason', 'Structured Concept Check'],
    defaultQuestionCount: 10,
    defaultDurationMinutes: 20,
    correctMarks: 1,
    negativeMarks: 0,
    supportsTimedMode: true
  },
  university_exams: {
    id: 'university_exams',
    shortName: 'University Exams',
    fullName: 'University / College Semester & Mid-Sem Pattern',
    categoryBadge: 'B.Tech / B.Sc / MBBS / BA',
    patternNote: 'Customizable Practice Pattern • +2 Correct, 0 Negative Marking • Core Theory & Problem Solving',
    subjects: ['Core Course Module', 'Engineering Mathematics / Stats', 'Algorithms & Systems', 'Elective Specialization'],
    sections: ['Part A (Short Concept Quiz)', 'Part B (Analytical Problem Solving)'],
    questionTypes: ['Conceptual Quiz', 'Derivation & Formula Check'],
    defaultQuestionCount: 10,
    defaultDurationMinutes: 20,
    correctMarks: 2,
    negativeMarks: 0,
    supportsTimedMode: true
  },
  general_practice: {
    id: 'general_practice',
    shortName: 'General Practice',
    fullName: 'General Practice & Untimed Mastery Mode',
    categoryBadge: 'Self-Paced Learning',
    patternNote: 'Customizable Practice Pattern • +1 Correct, 0 Negative Marking • Stress-Free Topic Mastery',
    subjects: ['All Uploaded Material Topics', 'Key Concepts & Definitions', 'Formulas & Applications'],
    sections: ['Self-Paced Concept Drill'],
    questionTypes: ['Concept Check', 'Application Problem'],
    defaultQuestionCount: 10,
    defaultDurationMinutes: 15,
    correctMarks: 1,
    negativeMarks: 0,
    supportsTimedMode: false
  }
};

export interface ExamEvaluationSummary {
  totalQuestions: number;
  attemptedCount: number;
  unattemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  positiveScore: number;
  negativeScore: number;
  netScore: number;
  maxPossibleScore: number;
  accuracyPercent: number;
  scorePercent: number;
  topicBreakdown: {
    topic: string;
    total: number;
    correct: number;
    incorrect: number;
    unattempted: number;
    accuracyPercent: number;
  }[];
}

export function getExamBlueprint(examId: ExamTypeId): ExamBlueprint {
  return EXAM_BLUEPRINTS[examId] || EXAM_BLUEPRINTS.jee_main;
}

export function evaluateExamSession(
  questions: QuizQuestion[],
  selectedAnswers: Record<string, number>,
  correctMarks: number,
  negativeMarks: number
): ExamEvaluationSummary {
  let attemptedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  const topicMap = new Map<
    string,
    { total: number; correct: number; incorrect: number; unattempted: number }
  >();

  for (const q of questions) {
    const topicName = (q.topic || 'General Concept').trim();
    const entry = topicMap.get(topicName) || {
      total: 0,
      correct: 0,
      incorrect: 0,
      unattempted: 0
    };
    entry.total += 1;

    const chosen = selectedAnswers[q.id];
    if (chosen === undefined || chosen === null) {
      entry.unattempted += 1;
    } else {
      attemptedCount += 1;
      if (chosen === q.correctIndex) {
        correctCount += 1;
        entry.correct += 1;
      } else {
        incorrectCount += 1;
        entry.incorrect += 1;
      }
    }
    topicMap.set(topicName, entry);
  }

  const totalQuestions = questions.length;
  const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
  const positiveScore = correctCount * correctMarks;
  const negativeScore = incorrectCount * negativeMarks;
  const netScore = positiveScore - negativeScore;
  const maxPossibleScore = Math.max(1, totalQuestions * correctMarks);
  const accuracyPercent =
    attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const scorePercent = Math.max(0, Math.round((netScore / maxPossibleScore) * 100));

  const topicBreakdown = Array.from(topicMap.entries()).map(([topic, stats]) => {
    const attemptedInTopic = stats.correct + stats.incorrect;
    return {
      topic,
      ...stats,
      accuracyPercent:
        attemptedInTopic > 0 ? Math.round((stats.correct / attemptedInTopic) * 100) : 0
    };
  });

  return {
    totalQuestions,
    attemptedCount,
    unattemptedCount,
    correctCount,
    incorrectCount,
    positiveScore,
    negativeScore,
    netScore,
    maxPossibleScore,
    accuracyPercent,
    scorePercent,
    topicBreakdown
  };
}
