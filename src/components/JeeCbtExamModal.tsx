import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Award,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ArrowRight,
  Printer,
  X,
  Check,
  Send,
  Delete,
  Hash,
} from 'lucide-react';
import {
  JeeQuestion,
  JeeCandidateResponse,
  JeeExamResult,
  JeePaletteStatus,
  JeeSubject,
  JeeSection,
} from '../types/jeeExam';
import {
  DEFAULT_JEE_75_QUESTION_PAPER,
  calculateJeeExamScore,
} from '../utils/jeeQuestionBank';
import { MathText } from './MathText';
import { StudentAcademicProfile } from '../types/study';

interface JeeCbtExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentProfile?: StudentAcademicProfile;
  customQuestions?: JeeQuestion[];
  examTitle?: string;
  sourceNoteTitle?: string;
  onSaveResult?: (result: JeeExamResult) => void;
}

export const JeeCbtExamModal: React.FC<JeeCbtExamModalProps> = ({
  isOpen,
  onClose,
  studentProfile,
  customQuestions,
  examTitle = 'JEE (Main) 2027 Full Mock Paper 1',
  sourceNoteTitle,
  onSaveResult,
}) => {
  // Questions array: default 75 or custom
  const questions: JeeQuestion[] = useMemo(() => {
    if (customQuestions && customQuestions.length === 75) {
      return customQuestions;
    }
    return DEFAULT_JEE_75_QUESTION_PAPER;
  }, [customQuestions]);

  // Exam state
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeSubject, setActiveSubject] = useState<JeeSubject>('Physics');
  const [activeSection, setActiveSection] = useState<JeeSection>('A');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(180 * 60); // 180 mins = 10,800 secs
  const [responses, setResponses] = useState<Record<string, JeeCandidateResponse>>({});
  const [examSubmitted, setExamSubmitted] = useState<boolean>(false);
  const [examResult, setExamResult] = useState<JeeExamResult | null>(null);

  // Modals inside exam
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [showQuestionPaper, setShowQuestionPaper] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [filterSolutionSubject, setFilterSolutionSubject] = useState<JeeSubject | 'All'>('All');
  const [filterSolutionStatus, setFilterSolutionStatus] = useState<'All' | 'Incorrect' | 'Unattempted' | 'Correct'>('All');

  // Input state for current active question
  const currentQuestion = questions[currentIndex] || questions[0];
  const currentResp = responses[currentQuestion?.id];
  const [selectedOption, setSelectedOption] = useState<number | undefined>(undefined);
  const [numericalInput, setNumericalInput] = useState<string>('');

  // Keep track of visited questions and sync local answer state on question switch
  useEffect(() => {
    if (!currentQuestion || examSubmitted) return;

    // Sync selected option or numerical input
    const existing = responses[currentQuestion.id];
    setSelectedOption(existing?.selectedOption);
    setNumericalInput(existing?.numericalValue || '');

    // Mark as visited if it was not_visited
    setResponses((prev) => {
      const qResp = prev[currentQuestion.id];
      if (!qResp || qResp.status === 'not_visited') {
        return {
          ...prev,
          [currentQuestion.id]: {
            ...qResp,
            visited: true,
            status: 'not_answered',
          },
        };
      }
      return prev;
    });

    // Auto-align subject and section tabs to active question
    setActiveSubject(currentQuestion.subject);
    setActiveSection(currentQuestion.section);
  }, [currentIndex, currentQuestion, examSubmitted]);

  // Timer countdown
  useEffect(() => {
    if (!isOpen || examSubmitted) return;

    if (remainingSeconds <= 0) {
      handleFinalSubmit();
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, examSubmitted, remainingSeconds]);

  // Format timer into HH:MM:SS
  const timerFormatted = useMemo(() => {
    const hrs = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }, [remainingSeconds]);

  // Palette counts
  const paletteSummary = useMemo(() => {
    let answered = 0;
    let notAnswered = 0;
    let notVisited = 0;
    let markedForReview = 0;
    let answeredAndMarkedForReview = 0;

    for (const q of questions) {
      const r = responses[q.id];
      const st: JeePaletteStatus = r?.status || 'not_visited';
      if (st === 'answered') answered++;
      else if (st === 'not_answered') notAnswered++;
      else if (st === 'marked_for_review') markedForReview++;
      else if (st === 'answered_and_marked_for_review') answeredAndMarkedForReview++;
      else notVisited++;
    }

    return { answered, notAnswered, notVisited, markedForReview, answeredAndMarkedForReview };
  }, [questions, responses]);

  // Subject wise question list
  const subjectQuestions = useMemo(() => {
    return questions.filter((q) => q.subject === activeSubject);
  }, [questions, activeSubject]);

  // Save answer and move to next
  const handleSaveAndNext = () => {
    if (!currentQuestion) return;

    const hasAnswer =
      currentQuestion.type === 'mcq'
        ? typeof selectedOption === 'number'
        : numericalInput.trim() !== '';

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedOption: currentQuestion.type === 'mcq' ? selectedOption : undefined,
        numericalValue: currentQuestion.type === 'numerical' ? numericalInput.trim() : undefined,
        status: hasAnswer ? 'answered' : 'not_answered',
        visited: true,
      },
    }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Clear current response
  const handleClearResponse = () => {
    setSelectedOption(undefined);
    setNumericalInput('');
    if (!currentQuestion) return;

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedOption: undefined,
        numericalValue: undefined,
        status: 'not_answered',
        visited: true,
      },
    }));
  };

  // Save & Mark for review
  const handleSaveAndMarkForReview = () => {
    if (!currentQuestion) return;

    const hasAnswer =
      currentQuestion.type === 'mcq'
        ? typeof selectedOption === 'number'
        : numericalInput.trim() !== '';

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedOption: currentQuestion.type === 'mcq' ? selectedOption : undefined,
        numericalValue: currentQuestion.type === 'numerical' ? numericalInput.trim() : undefined,
        status: hasAnswer ? 'answered_and_marked_for_review' : 'marked_for_review',
        visited: true,
      },
    }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Mark for review without saving answer
  const handleMarkForReviewAndNext = () => {
    if (!currentQuestion) return;

    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        selectedOption: undefined,
        numericalValue: undefined,
        status: 'marked_for_review',
        visited: true,
      },
    }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Virtual Keypad Button Press for Section B
  const handleKeypadPress = (val: string) => {
    if (val === 'clear') {
      setNumericalInput('');
    } else if (val === 'backspace') {
      setNumericalInput((prev) => prev.slice(0, -1));
    } else if (val === '.') {
      if (!numericalInput.includes('.')) {
        setNumericalInput((prev) => prev + '.');
      }
    } else if (val === '-') {
      if (numericalInput.length === 0) {
        setNumericalInput('-');
      }
    } else {
      if (numericalInput.length < 12) {
        setNumericalInput((prev) => prev + val);
      }
    }
  };

  // Submit test and generate official score
  const handleFinalSubmit = () => {
    const timeSpent = 180 * 60 - remainingSeconds;
    const finalScore = calculateJeeExamScore(questions, responses, timeSpent, examTitle);
    setExamResult(finalScore);
    setExamSubmitted(true);
    setShowSubmitConfirm(false);
    if (onSaveResult) {
      onSaveResult(finalScore);
    }
  };

  // Reset exam for re-attempt
  const handleReattempt = () => {
    setResponses({});
    setCurrentIndex(0);
    setRemainingSeconds(180 * 60);
    setExamSubmitted(false);
    setExamResult(null);
    setSelectedOption(undefined);
    setNumericalInput('');
    setActiveSubject('Physics');
    setActiveSection('A');
  };

  if (!isOpen) return null;

  // Candidate info
  const candidateName = studentProfile?.fullName || 'Arjun Sharma';
  const rollNumber = '2701048291';

  // Helper for Palette badge appearance
  const getPaletteBadgeStyle = (status: JeePaletteStatus) => {
    switch (status) {
      case 'answered':
        return 'bg-emerald-600 text-white font-bold border-emerald-700 shadow-xs';
      case 'not_answered':
        return 'bg-rose-600 text-white font-bold border-rose-700 shadow-xs';
      case 'marked_for_review':
        return 'bg-purple-600 text-white font-bold rounded-full border-purple-700 shadow-xs';
      case 'answered_and_marked_for_review':
        return 'bg-purple-600 text-white font-bold rounded-full border-purple-700 shadow-xs relative ring-2 ring-emerald-400';
      case 'not_visited':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col justify-between overflow-hidden select-none">
      {/* ============================================================ */}
      {/* 1. TOP NTA CBT HEADER BAR                                    */}
      {/* ============================================================ */}
      <header className="bg-[#1E3A8A] text-white border-b border-blue-900 px-4 py-2.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center font-bold text-amber-300 border border-white/20 text-sm">
            NTA
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold tracking-wide text-white leading-tight">
              JOINT ENTRANCE EXAMINATION (MAIN) - 2027 CBT SIMULATOR
            </h1>
            <p className="text-[11px] text-blue-200">
              National Testing Agency (NTA) Official Mock Environment · 75 Questions · 300 Marks (+4 / -1)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* Live Countdown Clock */}
          {!examSubmitted && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm sm:text-base ${
                remainingSeconds < 900
                  ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                  : 'bg-blue-950/80 border-blue-400 text-amber-300'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-300" />
              <span>Time Left: {timerFormatted}</span>
            </div>
          )}

          {/* Candidate Profile Widget */}
          <div className="hidden md:flex items-center gap-2.5 bg-blue-950/60 px-3 py-1 rounded-lg border border-blue-800 text-right">
            <div className="text-right">
              <div className="text-xs font-bold text-white">{candidateName}</div>
              <div className="text-[10px] text-blue-300">Roll No: {rollNumber}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-bold flex items-center justify-center text-xs shadow-xs">
              {candidateName.charAt(0)}
            </div>
          </div>

          <button
            onClick={() => {
              if (examSubmitted || confirm('Exit JEE Mock Test? Your progress will be discarded.')) {
                onClose();
              }
            }}
            title="Exit Exam"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. MAIN CBT VIEW (OR SCORECARD IF SUBMITTED)                */}
      {/* ============================================================ */}
      {examSubmitted && examResult ? (
        // POST-EXAM OFFICIAL SCORECARD VIEW
        <div className="flex-1 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Scorecard Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Official Score Card Generated</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {examResult.examTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Candidate: <strong className="text-slate-700">{candidateName}</strong> · Roll No: <strong className="text-slate-700">{rollNumber}</strong> · Completed in {Math.floor(examResult.timeTakenSeconds / 60)} mins
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>Print Scorecard</span>
                  </button>
                  <button
                    onClick={handleReattempt}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Re-attempt Exam</span>
                  </button>
                </div>
              </div>

              {/* Score Highlight Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-1">
                  <div className="text-xs font-semibold text-blue-700">Total Score</div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-blue-900 font-mono">
                    {examResult.marksObtained}
                    <span className="text-sm font-medium text-blue-600 ml-1">/ 300</span>
                  </div>
                  <div className="text-[11px] text-blue-600 font-medium">+4 for correct, -1 for wrong</div>
                </div>

                <div className="p-4 rounded-xl bg-purple-50/80 border border-purple-200 space-y-1">
                  <div className="text-xs font-semibold text-purple-700">Estimated Percentile</div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-purple-900 font-mono">
                    {examResult.percentileEstimate.toFixed(2)}
                    <span className="text-sm font-medium text-purple-600 ml-0.5">%ile</span>
                  </div>
                  <div className="text-[11px] text-purple-600 font-medium">JEE 2027 Projected</div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-1">
                  <div className="text-xs font-semibold text-emerald-700">Accuracy Rate</div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-emerald-900 font-mono">
                    {examResult.accuracyPercentage}
                    <span className="text-sm font-medium text-emerald-600 ml-0.5">%</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium">
                    {examResult.correctCount} Correct / {examResult.attemptedCount} Attempted
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold text-slate-700">Questions Answered</div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono">
                    {examResult.attemptedCount}
                    <span className="text-sm font-medium text-slate-500 ml-1">/ 75</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {examResult.unattemptedCount} Unattempted
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  Subject-Wise Performance &amp; Marking
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Subject</th>
                        <th className="py-2.5 px-3 text-center">Total Qs</th>
                        <th className="py-2.5 px-3 text-center">Attempted</th>
                        <th className="py-2.5 px-3 text-center text-emerald-700">Correct (+4)</th>
                        <th className="py-2.5 px-3 text-center text-rose-700">Wrong (-1)</th>
                        <th className="py-2.5 px-4 text-right font-mono">Marks / 100</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {(['Physics', 'Chemistry', 'Mathematics'] as JeeSubject[]).map((subj) => {
                        const stat = examResult.subjectBreakdown[subj];
                        return (
                          <tr key={subj} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  subj === 'Physics'
                                    ? 'bg-blue-600'
                                    : subj === 'Chemistry'
                                    ? 'bg-amber-600'
                                    : 'bg-indigo-600'
                                }`}
                              />
                              {subj}
                            </td>
                            <td className="py-3 px-3 text-center text-slate-600">25</td>
                            <td className="py-3 px-3 text-center font-semibold text-slate-900">
                              {stat.answered + stat.answeredAndMarkedForReview}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600 font-mono">
                              {stat.correct}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-rose-600 font-mono">
                              {stat.incorrect}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-blue-900 font-mono text-sm">
                              {stat.marks}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50/80 font-bold text-slate-900 border-t-2 border-slate-200">
                        <td className="py-3 px-4">TOTAL (ALL SUBJECTS)</td>
                        <td className="py-3 px-3 text-center">75</td>
                        <td className="py-3 px-3 text-center">{examResult.attemptedCount}</td>
                        <td className="py-3 px-3 text-center text-emerald-700 font-mono">{examResult.correctCount}</td>
                        <td className="py-3 px-3 text-center text-rose-700 font-mono">{examResult.incorrectCount}</td>
                        <td className="py-3 px-4 text-right text-blue-900 font-mono text-base">
                          {examResult.marksObtained} / 300
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Step-by-Step Question Solutions with Mistake DNA */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Comprehensive Question-by-Question Solution &amp; Answer Key
                  </h3>
                  <p className="text-xs text-slate-500">
                    Detailed step-by-step mathematical reasoning and verified answers for all 75 questions.
                  </p>
                </div>

                {/* Filter controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterSolutionSubject(s)}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          filterSolutionSubject === s ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                    {(['All', 'Incorrect', 'Correct', 'Unattempted'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setFilterSolutionStatus(st)}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                          filterSolutionStatus === st ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filtered Solutions List */}
              <div className="space-y-4">
                {questions
                  .filter((q) => {
                    if (filterSolutionSubject !== 'All' && q.subject !== filterSolutionSubject) return false;
                    const r = examResult.responses[q.id];
                    const isAttempted = r?.status === 'answered' || r?.status === 'answered_and_marked_for_review';
                    let isCorrect = false;
                    if (isAttempted) {
                      if (q.type === 'mcq') isCorrect = r?.selectedOption === q.correctOptionIndex;
                      else {
                        const val = parseFloat(r?.numericalValue || '');
                        isCorrect = !isNaN(val) && q.correctNumericValue !== undefined && Math.abs(val - q.correctNumericValue) <= (q.numericTolerance ?? 0.05);
                      }
                    }
                    if (filterSolutionStatus === 'Correct') return isAttempted && isCorrect;
                    if (filterSolutionStatus === 'Incorrect') return isAttempted && !isCorrect;
                    if (filterSolutionStatus === 'Unattempted') return !isAttempted;
                    return true;
                  })
                  .map((q) => {
                    const r = examResult.responses[q.id];
                    const isAttempted = r?.status === 'answered' || r?.status === 'answered_and_marked_for_review';
                    let isCorrect = false;
                    if (isAttempted) {
                      if (q.type === 'mcq') isCorrect = r?.selectedOption === q.correctOptionIndex;
                      else {
                        const val = parseFloat(r?.numericalValue || '');
                        isCorrect = !isNaN(val) && q.correctNumericValue !== undefined && Math.abs(val - q.correctNumericValue) <= (q.numericTolerance ?? 0.05);
                      }
                    }

                    return (
                      <div
                        key={q.id}
                        className={`p-5 rounded-xl border transition-all space-y-3 ${
                          !isAttempted
                            ? 'bg-slate-50 border-slate-200'
                            : isCorrect
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs font-mono px-2 py-0.5 rounded-md bg-white border text-slate-800">
                              Q{q.number}
                            </span>
                            <span className="text-xs font-bold text-slate-700">{q.subject}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500">{q.topic}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {!isAttempted ? (
                              <span className="text-xs font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">
                                Unattempted (0 Marks)
                              </span>
                            ) : isCorrect ? (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                Correct (+4 Marks)
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                <X className="w-3.5 h-3.5" />
                                Incorrect (-1 Mark)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question Text */}
                        <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                          <MathText text={q.question} />
                        </div>

                        {/* Options or Numerical Output */}
                        {q.type === 'mcq' && q.options ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {q.options.map((opt, oIdx) => {
                              const isChosen = r?.selectedOption === oIdx;
                              const isCorrectOption = q.correctOptionIndex === oIdx;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                                    isCorrectOption
                                      ? 'bg-emerald-100/80 border-emerald-300 font-bold text-emerald-950'
                                      : isChosen
                                      ? 'bg-rose-100/80 border-rose-300 font-bold text-rose-950'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 font-bold text-[11px]">
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <div className="flex-1">
                                    <MathText text={opt} />
                                  </div>
                                  {isCorrectOption && (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200 px-1.5 py-0.5 rounded">
                                      Official Key
                                    </span>
                                  )}
                                  {isChosen && !isCorrectOption && (
                                    <span className="text-[10px] font-bold text-rose-800 bg-rose-200 px-1.5 py-0.5 rounded">
                                      Your Choice
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between">
                            <span className="text-slate-600">
                              Your Input: <strong className="font-mono text-slate-900">{r?.numericalValue || 'None'}</strong>
                            </span>
                            <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                              Official Correct Value: <strong className="font-mono">{q.correctNumericValue}</strong>
                            </span>
                          </div>
                        )}

                        {/* Step-by-Step Explanation */}
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1.5 text-xs">
                          <div className="font-bold text-blue-900 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Step-by-Step Mathematical Solution</span>
                          </div>
                          <div className="text-slate-700 leading-relaxed">
                            <MathText text={q.explanation} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ACTIVE CBT EXAM INTERFACE (MATCHING OFFICIAL NTA PORTAL)
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* ============================================================ */}
          {/* LEFT 75%: QUESTION PANEL & NAVIGATION                       */}
          {/* ============================================================ */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden border-r border-slate-300">
            {/* Subject Tabs (PHYSICS | CHEMISTRY | MATHEMATICS) */}
            <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                {(['Physics', 'Chemistry', 'Mathematics'] as JeeSubject[]).map((subj) => {
                  const active = activeSubject === subj;
                  // Count answered in this subject
                  const answeredInSubj = questions
                    .filter((q) => q.subject === subj)
                    .filter((q) => {
                      const st = responses[q.id]?.status;
                      return st === 'answered' || st === 'answered_and_marked_for_review';
                    }).length;

                  return (
                    <button
                      key={subj}
                      onClick={() => {
                        setActiveSubject(subj);
                        const firstInSubj = questions.findIndex((q) => q.subject === subj);
                        if (firstInSubj !== -1) setCurrentIndex(firstInSubj);
                      }}
                      className={`px-4 py-2 rounded-t-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border-t-2 ${
                        active
                          ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/70'
                      }`}
                    >
                      <span>{subj.toUpperCase()}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          active ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {answeredInSubj}/25
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Utility Buttons: Question Paper & Instructions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQuestionPaper(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Question Paper</span>
                </button>
                <button
                  onClick={() => setShowInstructions(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Instructions</span>
                </button>
              </div>
            </div>

            {/* Section Switcher (Section A: 20 MCQs | Section B: 5 Numerical) */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-4">
                <span className="text-slate-500 font-bold uppercase text-[11px]">Section:</span>
                <button
                  onClick={() => {
                    setActiveSection('A');
                    const firstSecA = questions.findIndex(
                      (q) => q.subject === activeSubject && q.section === 'A'
                    );
                    if (firstSecA !== -1) setCurrentIndex(firstSecA);
                  }}
                  className={`py-1 px-2.5 rounded-md cursor-pointer transition-all ${
                    activeSection === 'A'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Section A (MCQs: Q1 - Q20)
                </button>
                <button
                  onClick={() => {
                    setActiveSection('B');
                    const firstSecB = questions.findIndex(
                      (q) => q.subject === activeSubject && q.section === 'B'
                    );
                    if (firstSecB !== -1) setCurrentIndex(firstSecB);
                  }}
                  className={`py-1 px-2.5 rounded-md cursor-pointer transition-all ${
                    activeSection === 'B'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Section B (Numerical: Q21 - Q25)
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-emerald-700 font-bold">+4.00</span>
                <span className="text-slate-400">/</span>
                <span className="text-rose-700 font-bold">-1.00</span>
              </div>
            </div>

            {/* Question Body Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Question Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-extrabold text-blue-900 font-serif">
                    Question No. {currentQuestion?.number}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                    {currentQuestion?.type === 'mcq' ? 'Single Choice (MCQ)' : 'Numerical Answer'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Topic: <strong className="text-slate-800">{currentQuestion?.topic}</strong>
                </div>
              </div>

              {/* Question Statement */}
              <div className="text-base text-slate-900 leading-relaxed font-medium">
                <MathText text={currentQuestion?.question || ''} />
              </div>

              {/* Answering Controls: MCQs vs Numerical */}
              {currentQuestion?.type === 'mcq' && currentQuestion.options ? (
                // SECTION A: 4 MCQs
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Select one correct option:
                  </div>
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((opt, oIdx) => {
                      const isSelected = selectedOption === oIdx;
                      return (
                        <label
                          key={oIdx}
                          onClick={() => setSelectedOption(oIdx)}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`jee-q-${currentQuestion.id}`}
                            checked={isSelected}
                            onChange={() => setSelectedOption(oIdx)}
                            className="mt-1 w-4 h-4 accent-blue-600"
                          />
                          <div className="flex items-center gap-2 flex-1 text-sm font-medium text-slate-800">
                            <span className="font-bold font-mono text-slate-500">
                              ({String.fromCharCode(65 + oIdx)})
                            </span>
                            <div className="leading-snug">
                              <MathText text={opt} />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // SECTION B: NUMERICAL VALUE KEYPAD
                <div className="space-y-4 pt-2 max-w-md">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Enter Numerical Value (Use On-Screen Keypad):
                  </div>

                  {/* Input Screen Display */}
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={numericalInput}
                      placeholder="e.g. 24 or 3.14"
                      className="w-full h-12 px-4 rounded-xl border-2 border-blue-500 bg-white font-mono text-xl font-bold text-blue-900 text-center tracking-wider shadow-inner"
                    />
                    {numericalInput && (
                      <button
                        onClick={() => setNumericalInput('')}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* NTA Virtual Numeric Keypad */}
                  <div className="p-3 bg-slate-100 rounded-2xl border border-slate-300 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 text-center uppercase">
                      NTA Virtual Numeric Keypad
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '-'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleKeypadPress(k)}
                          className="h-10 rounded-lg bg-white border border-slate-300 hover:bg-blue-50 hover:border-blue-400 font-mono font-bold text-base text-slate-800 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 transition-all"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('backspace')}
                        className="h-9 rounded-lg bg-slate-200 border border-slate-300 hover:bg-slate-300 text-xs font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Delete className="w-4 h-4" />
                        <span>Backspace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('clear')}
                        className="h-9 rounded-lg bg-rose-100 border border-rose-300 hover:bg-rose-200 text-xs font-bold text-rose-800 flex items-center justify-center cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Official NTA Action Toolbar */}
            <footer className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Next</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearResponse}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                >
                  Clear Response
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndMarkForReview}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                >
                  Save &amp; Mark for Review
                </button>

                <button
                  type="button"
                  onClick={handleMarkForReviewAndNext}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all"
                >
                  Mark for Review &amp; Next
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  &lt;&lt; Previous
                </button>
                <button
                  type="button"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((c) => Math.min(questions.length - 1, c + 1))}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Next &gt;&gt;
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md cursor-pointer ml-2 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Exam</span>
                </button>
              </div>
            </footer>
          </div>

          {/* ============================================================ */}
          {/* RIGHT 25%: CANDIDATE INFO & QUESTION PALETTE               */}
          {/* ============================================================ */}
          <aside className="w-full md:w-80 lg:w-96 bg-slate-100 flex flex-col border-l border-slate-300 overflow-hidden">
            {/* Candidate Photo & Identification */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center gap-3">
              <div className="w-12 h-14 bg-slate-200 border border-slate-300 rounded flex items-center justify-center font-bold text-slate-600 text-sm">
                PHOTO
              </div>
              <div className="text-xs space-y-0.5 min-w-0">
                <div className="font-extrabold text-slate-900 truncate">{candidateName}</div>
                <div className="text-slate-500 font-mono text-[11px]">Roll: {rollNumber}</div>
                <div className="text-blue-700 font-semibold text-[11px]">Paper: B.E. / B.Tech</div>
              </div>
            </div>

            {/* Official NTA 5-State Legend Summary */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {paletteSummary.answered}
                  </span>
                  <span className="text-slate-700">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-rose-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {paletteSummary.notAnswered}
                  </span>
                  <span className="text-slate-700">Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[10px]">
                    {paletteSummary.notVisited}
                  </span>
                  <span className="text-slate-700">Not Visited</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                    {paletteSummary.markedForReview}
                  </span>
                  <span className="text-slate-700">Marked for Review</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200 text-[11px]">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[10px] ring-2 ring-emerald-500">
                  {paletteSummary.answeredAndMarkedForReview}
                </span>
                <span className="text-slate-700 leading-tight">
                  Ans. &amp; Marked for Review (Evaluated)
                </span>
              </div>
            </div>

            {/* Subject Selector inside Palette */}
            <div className="px-3 py-2 bg-blue-900 text-white font-bold text-xs flex items-center justify-between">
              <span>{activeSubject.toUpperCase()} QUESTIONS</span>
              <span className="text-blue-200 text-[11px]">25 Questions</span>
            </div>

            {/* Question Grid Buttons (25 Questions for Active Subject) */}
            <div className="flex-1 overflow-y-auto p-3.5">
              <div className="grid grid-cols-5 gap-2">
                {subjectQuestions.map((q) => {
                  const qGlobalIndex = questions.findIndex((item) => item.id === q.id);
                  const isCurrent = qGlobalIndex === currentIndex;
                  const st: JeePaletteStatus = responses[q.id]?.status || 'not_visited';
                  const badgeClass = getPaletteBadgeStyle(st);

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(qGlobalIndex)}
                      title={`Q${q.number}: ${q.topic} (${st.replace('_', ' ')})`}
                      className={`h-9 w-full rounded-md border text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${badgeClass} ${
                        isCurrent ? 'ring-3 ring-blue-500 scale-105 z-10' : ''
                      }`}
                    >
                      {q.number}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Final Submit Button in Palette Footer */}
            <div className="p-3 bg-white border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit {examTitle}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. MODAL: SUBMISSION CONFIRMATION TABLE                      */}
      {/* ============================================================ */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-blue-900 font-extrabold text-base">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Candidate Exam Summary &amp; Confirmation</span>
              </div>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Review your attempt status below before final submission. Once submitted, you cannot make any further changes to your responses.
            </p>

            {/* Subject Summary Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Subject</th>
                    <th className="py-2 px-2 text-center">Total</th>
                    <th className="py-2 px-2 text-center text-emerald-700">Answered</th>
                    <th className="py-2 px-2 text-center text-rose-700">Not Ans.</th>
                    <th className="py-2 px-2 text-center text-purple-700">Review</th>
                    <th className="py-2 px-2 text-center text-slate-500">Not Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(['Physics', 'Chemistry', 'Mathematics'] as JeeSubject[]).map((subj) => {
                    const subjQs = questions.filter((q) => q.subject === subj);
                    let ans = 0;
                    let notAns = 0;
                    let rev = 0;
                    let notVis = 0;

                    for (const q of subjQs) {
                      const st = responses[q.id]?.status || 'not_visited';
                      if (st === 'answered' || st === 'answered_and_marked_for_review') ans++;
                      else if (st === 'not_answered') notAns++;
                      else if (st === 'marked_for_review') rev++;
                      else notVis++;
                    }

                    return (
                      <tr key={subj} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-800">{subj}</td>
                        <td className="py-2 px-2 text-center text-slate-600">25</td>
                        <td className="py-2 px-2 text-center font-bold text-emerald-600">{ans}</td>
                        <td className="py-2 px-2 text-center font-bold text-rose-600">{notAns}</td>
                        <td className="py-2 px-2 text-center font-bold text-purple-600">{rev}</td>
                        <td className="py-2 px-2 text-center text-slate-400">{notVis}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                    <td className="py-2.5 px-3">TOTAL</td>
                    <td className="py-2.5 px-2 text-center">75</td>
                    <td className="py-2.5 px-2 text-center text-emerald-700">
                      {paletteSummary.answered + paletteSummary.answeredAndMarkedForReview}
                    </td>
                    <td className="py-2.5 px-2 text-center text-rose-700">{paletteSummary.notAnswered}</td>
                    <td className="py-2.5 px-2 text-center text-purple-700">{paletteSummary.markedForReview}</td>
                    <td className="py-2.5 px-2 text-center text-slate-500">{paletteSummary.notVisited}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                No, Return to Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Yes, Submit Final Exam</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. MODAL: QUESTION PAPER VIEW (ALL 75 QUESTIONS)             */}
      {/* ============================================================ */}
      {showQuestionPaper && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-blue-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold">{examTitle} — Full Question Paper (75 Questions)</h3>
                <p className="text-[11px] text-blue-200">Scroll through all questions across Physics, Chemistry, and Mathematics</p>
              </div>
              <button
                onClick={() => setShowQuestionPaper(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {questions.map((q) => (
                <div key={q.id} className="p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-1.5">
                    <span className="font-extrabold text-blue-900 font-mono">
                      Question {q.number} ({q.subject} - Section {q.section})
                    </span>
                    <span className="font-medium text-slate-600">{q.topic}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                    <MathText text={q.question} />
                  </div>
                  {q.type === 'mcq' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center gap-2">
                          <span className="font-bold text-slate-500 font-mono">({String.fromCharCode(65 + oIdx)})</span>
                          <MathText text={opt} />
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'numerical' && (
                    <div className="text-xs text-blue-700 font-semibold bg-blue-50 p-2 rounded">
                      Type: Numerical Value (Enter integer or decimal value)
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 text-right shrink-0">
              <button
                onClick={() => setShowQuestionPaper(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
              >
                Close Question Paper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MODAL: OFFICIAL NTA CBT INSTRUCTIONS                      */}
      {/* ============================================================ */}
      {showInstructions && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>NTA CBT Exam Instructions &amp; Question Palette Guide</span>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-700 leading-relaxed">
              <h4 className="font-bold text-slate-900 text-sm">General Instructions:</h4>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>Total duration of examination is <strong>180 minutes (3 hours)</strong>.</li>
                <li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination.</li>
                <li>There are three subjects: <strong>Physics (25 Qs)</strong>, <strong>Chemistry (25 Qs)</strong>, and <strong>Mathematics (25 Qs)</strong>.</li>
                <li>Each subject has two sections: Section A containing 20 Multiple Choice Questions, and Section B containing 5 Numerical Value Questions.</li>
              </ol>

              <h4 className="font-bold text-slate-900 text-sm pt-2">Marking Scheme:</h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-800">
                <li><strong>+4 marks</strong> for each correct response.</li>
                <li><strong>-1 mark</strong> for each incorrect response (applies to BOTH Section A and Section B).</li>
                <li><strong>0 marks</strong> for unattempted questions.</li>
              </ul>

              <h4 className="font-bold text-slate-900 text-sm pt-2">Navigating to a Question:</h4>
              <p>
                To answer a question, click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Note that using this option does NOT save your answer to the current question. Click on <strong>Save &amp; Next</strong> to save your answer for the current question and then go to the next question.
              </p>
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 text-right shrink-0">
              <button
                onClick={() => setShowInstructions(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Understood, Return to Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
