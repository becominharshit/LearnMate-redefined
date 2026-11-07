export type JeeSubject = 'Physics' | 'Chemistry' | 'Mathematics';
export type JeeSection = 'A' | 'B'; // 'A': 20 MCQs, 'B': 5 Numerical
export type JeeQuestionType = 'mcq' | 'numerical';

export type JeePaletteStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_and_marked_for_review';

export interface JeeQuestion {
  id: string;
  number: number; // 1 to 75
  subject: JeeSubject;
  section: JeeSection;
  type: JeeQuestionType;
  topic: string;
  question: string;
  options?: [string, string, string, string]; // For Section A (MCQ)
  correctOptionIndex?: number; // 0-3 for Section A
  correctNumericValue?: number; // For Section B (Numerical)
  numericTolerance?: number; // e.g. 0.05
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sourceMaterial?: string;
  sourcePage?: number;
}

export interface JeeCandidateResponse {
  selectedOption?: number; // 0-3
  numericalValue?: string; // string entered by candidate
  status: JeePaletteStatus;
  visited: boolean;
  timeSpentSeconds?: number;
}

export interface JeeSubjectStat {
  subject: JeeSubject;
  total: number;
  answered: number;
  notAnswered: number;
  markedForReview: number;
  answeredAndMarkedForReview: number;
  notVisited: number;
  correct: number;
  incorrect: number;
  marks: number;
}

export interface JeeExamResult {
  id: string;
  examTitle: string;
  completedAt: string;
  timeTakenSeconds: number;
  totalMarks: number; // 300
  marksObtained: number;
  accuracyPercentage: number;
  percentileEstimate: number;
  totalQuestions: number; // 75
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  subjectBreakdown: Record<JeeSubject, JeeSubjectStat>;
  questions: JeeQuestion[];
  responses: Record<string, JeeCandidateResponse>;
}
