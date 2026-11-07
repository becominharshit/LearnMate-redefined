import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  BookOpen,
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
} from 'lucide-react';
import {
  StudyDocument,
  QuizQuestion,
  QuizAttempt,
  QuizAttemptAnswer,
  StudentAcademicProfile,
} from '../types/study';
import { studyStorage } from '../services/storageService';
import { aiStudyClient } from '../services/aiClient';
import { classifyJeeSubject } from '../utils/jeeSubjects';
import { QuizProctorOverlay } from './QuizProctorOverlay';
import { MathText } from './MathText';
import { ReportButton } from './ReportButton';
import { JeeCbtExamModal } from './JeeCbtExamModal';

interface PracticeWorkspaceViewProps {
  documents: StudyDocument[];
  activeDoc: StudyDocument | null;
  onSelectDoc: (doc: StudyDocument) => void;
  onOpenStudyQuiz: () => void;
  studentProfile?: StudentAcademicProfile;
  onOpenProfileModal?: () => void;
}

type PracticeSourceMode = 'notes' | 'chapters' | 'past_papers';

export const PracticeWorkspaceView: React.FC<PracticeWorkspaceViewProps> = ({
  documents,
  activeDoc,
  onSelectDoc,
  studentProfile,
}) => {
  const currentDoc = activeDoc || documents[0] || null;

  // JEE Full Mock Test Simulator Modal state
  const [isJeeExamModalOpen, setIsJeeExamModalOpen] = useState<boolean>(false);

  // Practice Set Builder State (matching Image 10)
  const [sourceMode, setSourceMode] = useState<PracticeSourceMode>('notes');
  const [selectedTopicPill, setSelectedTopicPill] = useState<string>('All');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<'Mixed' | 'Easy' | 'Medium' | 'Hard'>('Mixed');
  const [timeLimit, setTimeLimit] = useState<'No Limit' | '10 min' | '20 min' | '30 min'>(
    '20 min'
  );
  const [practiceMode, setPracticeMode] = useState<'Practice Mode' | 'Exam Mode'>(
    'Practice Mode'
  );

  // Active Practice Session State (matching Image 9)
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // Incremented on every start/exit so late AI responses for an abandoned set are ignored.
  const practiceRequestIdRef = useRef(0);
  const lastFocusTopicRef = useRef<string | undefined>(undefined);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [savedForLaterIds, setSavedForLaterIds] = useState<Record<string, boolean>>({});
  const [submittedResult, setSubmittedResult] = useState<QuizAttempt | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const [attempts, setAttempts] = useState<QuizAttempt[]>(() =>
    studyStorage.getQuizAttempts()
  );

  // Timer countdown during active timed session
  useEffect(() => {
    if (!sessionActive || submittedResult || remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      handleSubmitSession();
      return;
    }
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionActive, submittedResult, remainingSeconds]);

  const topicPills = useMemo(() => {
    const names = (currentDoc?.topics || []).map((t) => t.name).filter(Boolean);
    return ['All', ...Array.from(new Set(names))].slice(0, 8);
  }, [currentDoc]);

  const docLabel = currentDoc ? currentDoc.title.replace(/\.pdf$/i, '') : 'Your notes';
  const subjectLabel = currentDoc
    ? classifyJeeSubject(
        `${currentDoc.title} ${currentDoc.topics.map((t) => t.name).join(' ')}`
      ) || 'Practice'
    : 'Practice';

  const handleStartPracticeSet = async (focusWeakTopic?: string) => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    const requestId = ++practiceRequestIdRef.current;
    lastFocusTopicRef.current = focusWeakTopic;
    setSubmittedResult(null);
    setGenerationError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setSavedForLaterIds({});
    setRemainingSeconds(null);
    setSessionActive(true);

    if (!currentDoc || currentDoc.pages.length === 0) {
      setIsGenerating(false);
      setGenerationError('Select or upload study material first, then generate a practice set.');
      return;
    }

    const topicFilter = focusWeakTopic || (selectedTopicPill === 'All' ? undefined : selectedTopicPill);
    const mins =
      timeLimit === '10 min'
        ? 10
        : timeLimit === '20 min'
        ? 20
        : timeLimit === '30 min'
        ? 30
        : null;

    setIsGenerating(true);
    try {
      const res = await aiStudyClient.generateQuiz({
        documentId: currentDoc.id,
        title: currentDoc.title,
        pages: currentDoc.pages,
        topics: currentDoc.topics,
        mode: topicFilter ? 'adaptive' : 'diagnostic',
        focusTopics: topicFilter ? [topicFilter] : undefined,
        questionCount,
      });
      if (practiceRequestIdRef.current !== requestId) return;
      const generated = (res.questions || []).slice(0, questionCount);
      if (generated.length === 0) {
        setGenerationError(
          res.aiNotice || 'No questions could be generated from this material. Please try again.'
        );
        return;
      }
      setQuestions(generated);
      // The clock starts only once real questions are on screen.
      setRemainingSeconds(mins ? mins * 60 : null);
    } catch (err) {
      if (practiceRequestIdRef.current !== requestId) return;
      setGenerationError(
        err instanceof Error
          ? err.message
          : 'Could not generate a practice set right now. Please try again.'
      );
    } finally {
      if (practiceRequestIdRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  };

  const exitPracticeSession = () => {
    practiceRequestIdRef.current += 1;
    setIsGenerating(false);
    setGenerationError(null);
    setSessionActive(false);
    setSubmittedResult(null);
  };

  const handleSubmitSession = () => {
    const answers: QuizAttemptAnswer[] = questions.map((q) => {
      const selectedIdx = selectedAnswers[q.id] ?? -1;
      const isCorrect = selectedIdx === q.correctIndex;
      return {
        questionId: q.id,
        selectedIndex: selectedIdx,
        isCorrect,
        topic: q.topic,
        sourcePage: q.sourcePage,
      };
    });

    const correctCount = answers.filter((a) => a.isCorrect).length;
    const weakSet = new Set<string>();
    const strongSet = new Set<string>();
    answers.forEach((a) => {
      if (!a.isCorrect) weakSet.add(a.topic);
      else strongSet.add(a.topic);
    });

    const newAttempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      documentId: currentDoc?.id || 'practice',
      documentTitle: currentDoc?.title || 'Practice set',
      mode: practiceMode === 'Exam Mode' ? 'adaptive' : 'diagnostic',
      questions,
      answers,
      score: correctCount,
      totalQuestions: questions.length,
      percentage: Math.round((correctCount / Math.max(1, questions.length)) * 100),
      weakTopics: Array.from(weakSet),
      strongTopics: Array.from(strongSet),
      completedAt: new Date().toISOString(),
    };

    studyStorage.saveQuizAttempt(newAttempt);
    setAttempts(studyStorage.getQuizAttempts());
    setSubmittedResult(newAttempt);
  };

  // Waiting for generated questions, or generation failed: never show placeholder questions.
  if (sessionActive && questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        {isGenerating ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-brand" />
            <h2 className="font-serif-editorial text-2xl font-bold text-ink">
              Preparing your practice set…
            </h2>
            <p className="text-sm text-muted">
              Generating {questionCount} questions from {currentDoc?.title || 'your material'}.
              The timer starts when the questions appear.
            </p>
            <button
              type="button"
              onClick={exitPracticeSession}
              className="px-4 py-2 rounded-lg border border-line bg-white hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <XCircle className="w-8 h-8 mx-auto text-danger" />
            <h2 className="font-serif-editorial text-2xl font-bold text-ink">
              Couldn&apos;t create a practice set
            </h2>
            <p className="text-sm text-muted">
              {generationError || 'No questions were generated. Please try again.'}
            </p>
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={exitPracticeSession}
                className="px-4 py-2 rounded-lg border border-line bg-white hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                ← Back to Builder
              </button>
              <button
                type="button"
                onClick={() => void handleStartPracticeSet(lastFocusTopicRef.current)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg lm-btn-accent text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Render Active Question View matching Image 9 ("Check your understanding.")
  if (sessionActive) {
    const activeQuestion = questions[currentIndex] || questions[0];
    const progressPct = Math.round(((currentIndex + 1) / Math.max(1, questions.length)) * 100);
    const chosenOption = selectedAnswers[activeQuestion.id];
    const isSavedForLater = Boolean(savedForLaterIds[activeQuestion.id]);

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-14">
        {/* Top Row: Breadcrumb + Exit / Timer */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="lm-kicker">
              {subjectLabel} &nbsp;/&nbsp; {docLabel}
            </div>
            <h1 className="lm-editorial-title text-4xl sm:text-5xl">
              Check your understanding.
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-end">
            {remainingSeconds !== null && !submittedResult && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-line text-xs font-medium text-ink tabular-nums">
                <Clock className="w-3.5 h-3.5 text-brand" />
                <span>
                  {Math.floor(remainingSeconds / 60)}:
                  {String(remainingSeconds % 60).padStart(2, '0')}
                </span>
              </span>
            )}
            <span className="text-sm font-medium text-muted tabular-nums">
              Question <strong className="text-ink">{currentIndex + 1}</strong> of{' '}
              <strong className="text-ink">{questions.length}</strong>
            </span>
          </div>
        </div>

        {/* Thin Full-Width Terracotta Progress Bar matching Image 9 */}
        <div className="w-full h-1.5 rounded-full bg-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Submitted Score Summary Banner (if user submitted set) */}
        {submittedResult && (
          <div className="lm-card-editorial p-5 bg-canvas border-brand/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                Practice Set Complete
              </div>
              <div className="font-serif-editorial text-2xl font-bold text-ink">
                You scored {submittedResult.score} / {submittedResult.totalQuestions} (
                {Math.round(
                  (submittedResult.score / Math.max(1, submittedResult.totalQuestions)) * 100
                )}
                %)
              </div>
              <p className="text-xs text-muted">
                Review the step-by-step explanations below or return to the Practice Set Builder.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={exitPracticeSession}
                className="px-4 py-2 rounded-lg border border-line bg-white hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                ← Back to Builder
              </button>
              <button
                type="button"
                onClick={() => handleStartPracticeSet()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg lm-btn-accent text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Practice Again</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Spacious Examination Card matching Image 9 */}
        <div className="lm-card-editorial p-6 sm:p-10 space-y-7">
          {/* Card Top Bar: Question Badge + Save for later */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-md bg-brand-soft text-brand text-xs font-semibold">
              Question {currentIndex + 1}
            </span>

            <button
              type="button"
              onClick={() =>
                setSavedForLaterIds((prev) => ({
                  ...prev,
                  [activeQuestion.id]: !prev[activeQuestion.id],
                }))
              }
              className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                isSavedForLater ? 'text-brand font-semibold' : 'text-muted hover:text-ink'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSavedForLater ? 'fill-current' : ''}`} />
              <span>{isSavedForLater ? 'Saved for later' : 'Save for later'}</span>
            </button>
          </div>

          {/* Large Editorial Question Text */}
          <MathText
            text={activeQuestion.question}
            className="text-lg sm:text-xl font-medium text-ink leading-relaxed"
          />

          {/* 4 Full-Width Answer Cards matching Image 9 */}
          <div className="space-y-3.5">
            {activeQuestion.options.map((optText, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
              const isSelected = chosenOption === idx;
              const isCorrect = activeQuestion.correctIndex === idx;

              let cardClasses =
                'bg-white border-line hover:border-brand/50 text-ink';
              let badgeClasses =
                'bg-canvas border border-line-strong text-muted';

              if (submittedResult) {
                if (isCorrect) {
                  cardClasses = 'bg-success-soft/60 border-success text-ink';
                  badgeClasses = 'bg-success text-white border-success';
                } else if (isSelected) {
                  cardClasses = 'bg-danger-soft border-danger text-ink';
                  badgeClasses = 'bg-danger text-white border-danger';
                }
              } else if (isSelected) {
                cardClasses =
                  'bg-brand-soft/55 border-brand ring-1 ring-brand/30 text-ink';
                badgeClasses = 'bg-brand text-white border-brand';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={Boolean(submittedResult)}
                  onClick={() =>
                    setSelectedAnswers((prev) => ({
                      ...prev,
                      [activeQuestion.id]: idx,
                    }))
                  }
                  data-testid={`practice-option-${idx}`}
                  className={`w-full px-5 py-4 rounded-xl border text-left flex items-center justify-between gap-4 transition-all cursor-pointer ${cardClasses}`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${badgeClasses}`}
                    >
                      {letter}
                    </span>
                    <div className="text-base text-ink">
                      <MathText text={optText} variant="inline" />
                    </div>
                  </div>

                  {submittedResult && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  )}
                  {submittedResult && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-danger shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Grounded Explanation Box when submitted */}
          {submittedResult && (
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-brand">
                  AI-written solution (Source: Page {activeQuestion.sourcePage})
                </span>
                <ReportButton
                  kind="practice_question"
                  excerpt={`${activeQuestion.question}\n\nOptions: ${activeQuestion.options.join(' | ')}\nMarked answer: ${
                    activeQuestion.options[activeQuestion.correctIndex]
                  }\n\nSolution: ${activeQuestion.explanation}`}
                  documentId={currentDoc?.id}
                />
              </div>
              <MathText text={activeQuestion.explanation} className="text-sm text-ink" />
            </div>
          )}

          {/* Bottom Navigation Bar matching Image 9 */}
          <div className="pt-4 border-t border-soft flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex((prev) => prev - 1);
                } else {
                  exitPracticeSession();
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-medium text-muted hover:text-ink cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{currentIndex > 0 ? 'Previous' : 'Exit to Builder'}</span>
            </button>

            <div className="flex items-center gap-3">
              {!submittedResult && currentIndex < questions.length - 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="px-3 py-2 text-xs font-medium text-muted hover:text-ink cursor-pointer"
                >
                  Skip
                </button>
              )}

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  data-testid="practice-next-question-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg lm-btn-accent text-xs cursor-pointer"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : !submittedResult ? (
                <button
                  type="button"
                  onClick={handleSubmitSession}
                  data-testid="practice-submit-set-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg lm-btn-accent text-xs cursor-pointer"
                >
                  <span>Submit Practice Set</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default View: Practice Set Builder matching Image 10 ("Practice, with purpose.")
  const attemptPct = (a: QuizAttempt) =>
    Math.round((a.score / Math.max(1, a.totalQuestions)) * 100);

  const avgAccuracy: number | null =
    attempts.length === 0
      ? null
      : Math.round(attempts.reduce((acc, a) => acc + attemptPct(a), 0) / attempts.length);

  const recentAttemptRows = attempts.slice(0, 4).map((att) => ({
    id: att.id,
    title: `${att.documentTitle.replace(/\.pdf$/i, '')}: Custom Set`,
    meta: `${att.totalQuestions} questions · ${new Date(att.completedAt).toLocaleDateString(
      'en-IN',
      { month: 'short', day: 'numeric' }
    )}`,
    pct: attemptPct(att),
  }));

  // Oldest → newest, last five sets, plotted on a 0–100% scale.
  const trendPoints = attempts
    .slice(0, 5)
    .reverse()
    .map((att, i, arr) => ({
      x: arr.length === 1 ? 144 : 32 + (i * (256 - 32)) / (arr.length - 1),
      y: 20 + (100 - attemptPct(att)) * 0.76,
      label: `Set ${i + 1}`,
    }));

  // Weakest topics by real answer accuracy across all saved attempts.
  const weakTopicRows = (() => {
    const stats = new Map<string, { correct: number; total: number }>();
    for (const att of attempts) {
      for (const ans of att.answers) {
        if (!ans.topic) continue;
        const s = stats.get(ans.topic) || { correct: 0, total: 0 };
        s.total += 1;
        if (ans.isCorrect) s.correct += 1;
        stats.set(ans.topic, s);
      }
    }
    return Array.from(stats.entries())
      .map(([name, s]) => ({ name, pct: Math.round((s.correct / s.total) * 100) }))
      .filter((t) => t.pct < 100)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
  })();

  return (
    <div className="space-y-7 pb-12">
      {/* Editorial Header matching Image 10 */}
      <div className="space-y-2 max-w-2xl">
        <div className="lm-kicker">
          {subjectLabel} &nbsp;/&nbsp; {docLabel}
        </div>
        <h1 className="lm-editorial-title text-4xl sm:text-5xl">
          Practice, with purpose.
        </h1>
        <p className="lm-editorial-subtitle text-base sm:text-lg text-body">
          Build a JEE-style practice set from your own notes, and focus on what matters most.
        </p>
      </div>

      {/* Official JEE Main 75-Question CBT Simulator Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-7 shadow-lg border border-blue-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-amber-300 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Full-Scale NTA CBT Mock Exam</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              JEE (Main) 2027 Full Mock Test Simulator
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
              Step into the authentic NTA Computer-Based Test environment: <strong>75 questions</strong> across Physics (25), Chemistry (25), and Mathematics (25) with 20 MCQs + 5 Numerical value questions each, 180-minute countdown timer, official Question Palette (5 states), on-screen virtual keypad, and official +4 / −1 marking.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-blue-200 pt-1">
              <span className="flex items-center gap-1">⏱️ 180 Minutes</span>
              <span>•</span>
              <span className="flex items-center gap-1">📝 75 Questions</span>
              <span>•</span>
              <span className="flex items-center gap-1">🎯 300 Marks (+4 / -1)</span>
              <span>•</span>
              <span className="flex items-center gap-1">🖥️ Official NTA CBT UI</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setIsJeeExamModalOpen(true)}
              data-testid="launch-jee-cbt-mock-btn"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Launch 75-Q JEE Mock Test</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-blue-300/80 text-center font-medium">
              Grounded in {currentDoc?.title || 'uploaded materials'} &amp; JEE syllabus
            </span>
          </div>
        </div>
      </div>

      {/* Main 12-Column Builder & Analytics Grid matching Image 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Choose what to practice + Refine your set + Recent Attempts */}
        <div className="lg:col-span-8 space-y-6">
          {/* Builder Card */}
          <div className="lm-card-editorial p-6 space-y-6">
            {/* Section 1: Choose what to practice */}
            <div className="space-y-3">
              <h2 className="font-serif-editorial text-lg font-bold text-ink">
                Choose what to practice
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {[
                  {
                    id: 'notes' as PracticeSourceMode,
                    title: 'My Notes',
                    subtitle: currentDoc
                      ? `${currentDoc.title} (${currentDoc.pages.length} pages)`
                      : 'Upload a chapter or notes first',
                    icon: FileText,
                    available: true,
                  },
                  {
                    id: 'chapters' as PracticeSourceMode,
                    title: 'Chapters',
                    subtitle: 'JEE Main syllabus chapters',
                    icon: BookOpen,
                    available: false,
                  },
                  {
                    id: 'past_papers' as PracticeSourceMode,
                    title: 'Past Papers',
                    subtitle: 'JEE Main previous-year questions',
                    icon: ClipboardCheck,
                    available: false,
                  },
                ].map((src) => {
                  const Icon = src.icon;
                  const selected = sourceMode === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      disabled={!src.available}
                      onClick={() => setSourceMode(src.id)}
                      title={src.available ? undefined : 'Coming soon'}
                      className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                        !src.available
                          ? 'bg-soft border-line opacity-70 cursor-not-allowed'
                          : selected
                          ? 'bg-brand-soft/60 border-brand ring-1 ring-brand/25 cursor-pointer'
                          : 'bg-white border-line hover:border-brand/40 cursor-pointer'
                      }`}
                    >
                      {!src.available && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-white border border-line text-[10px] font-bold text-muted">
                          Coming soon
                        </span>
                      )}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`w-4 h-4 ${
                              selected ? 'text-brand' : 'text-muted'
                            }`}
                          />
                          <span className="font-serif-editorial font-bold text-sm text-ink">
                            {src.title}
                          </span>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selected ? 'border-brand' : 'border-line-strong'
                          }`}
                        >
                          {selected && (
                            <span className="w-2 h-2 rounded-full bg-brand" />
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-muted truncate">{src.subtitle}</div>
                    </button>
                  );
                })}
              </div>

              {documents.length > 1 && sourceMode === 'notes' && (
                <div className="pt-1 flex items-center gap-2 text-xs">
                  <span className="text-muted">Active Note Source:</span>
                  <select
                    value={currentDoc?.id || ''}
                    onChange={(e) => {
                      const found = documents.find((d) => d.id === e.target.value);
                      if (found) onSelectDoc(found);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-line bg-canvas text-xs font-medium text-ink"
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title} ({doc.pages.length} pages)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="border-t border-soft" />

            {/* Section 2: Refine your set */}
            <div className="space-y-4">
              <h2 className="font-serif-editorial text-lg font-bold text-ink">
                Refine your set
              </h2>

              {/* Topics Row */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-muted">Topics</label>
                <div className="flex flex-wrap items-center gap-2">
                  {topicPills.map((pill) => {
                    const active = selectedTopicPill === pill;
                    return (
                      <button
                        key={pill}
                        type="button"
                        onClick={() => setSelectedTopicPill(pill)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                          active
                            ? 'bg-brand-soft border-[#F2C9BC] text-brand font-semibold'
                            : 'bg-white border-line text-body hover:border-brand/40'
                        }`}
                      >
                        {pill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questions & Difficulty Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">Questions</label>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 15, 20, 30].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          questionCount === cnt
                            ? 'bg-brand-soft border-brand/40 text-brand font-semibold'
                            : 'bg-white border-line text-body hover:bg-canvas'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">Difficulty</label>
                  <div className="flex items-center gap-1.5">
                    {(['Mixed', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          difficulty === diff
                            ? 'bg-brand-soft border-brand/40 text-brand font-semibold'
                            : 'bg-white border-line text-body hover:bg-canvas'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time Limit & Mode Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">Time Limit</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['No Limit', '10 min', '20 min', '30 min'] as const).map((tl) => (
                      <button
                        key={tl}
                        type="button"
                        onClick={() => setTimeLimit(tl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          timeLimit === tl
                            ? 'bg-brand-soft border-brand/40 text-brand font-semibold'
                            : 'bg-white border-line text-body hover:bg-canvas'
                        }`}
                      >
                        {tl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted">Mode</label>
                  <div className="flex items-center gap-1.5">
                    {(['Practice Mode', 'Exam Mode'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPracticeMode(m)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          practiceMode === m
                            ? 'bg-brand-soft border-brand/40 text-brand font-semibold'
                            : 'bg-white border-line text-body hover:bg-canvas'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary & Generate Practice Set Action Bar */}
            <div className="pt-4 border-t border-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-muted">
                <strong className="text-ink">{questionCount} questions</strong> &nbsp;·&nbsp;{' '}
                {difficulty} difficulty &nbsp;·&nbsp;{' '}
                {timeLimit === 'No Limit' ? 'Untimed' : timeLimit.replace('min', 'minutes')}{' '}
                &nbsp;·&nbsp; {practiceMode}
              </div>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void handleStartPracticeSet()}
                data-testid="generate-practice-set-btn"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg lm-btn-accent text-xs cursor-pointer shrink-0"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Practice Set →</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Recent Attempts Card matching Image 10 */}
          <div className="lm-card-editorial p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-editorial text-lg font-bold text-ink">
                Recent Attempts
              </h2>
              <button
                type="button"
                onClick={() => void handleStartPracticeSet()}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline cursor-pointer"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentAttemptRows.length === 0 && (
              <p className="text-xs text-muted">
                No practice sets yet. Your completed sets will be listed here.
              </p>
            )}

            <div className="divide-y divide-soft">
              {recentAttemptRows.map((row) => (
                <div
                  key={row.id}
                  className="py-3.5 flex items-center justify-between gap-4 first:pt-1 last:pb-1"
                >
                  <div className="min-w-0">
                    <div className="font-serif-editorial font-bold text-sm text-ink truncate">
                      {row.title}
                    </div>
                    <div className="text-xs text-muted mt-0.5">{row.meta}</div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-2.5 py-1 rounded-md bg-success-soft text-success font-bold text-xs tabular-nums">
                      {row.pct}%
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleStartPracticeSet()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-medium text-ink cursor-pointer"
                    >
                      <span>Review</span>
                      <ChevronDown className="w-3 h-3 text-muted" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Your Practice Progress + Focus on these topics */}
        <div className="lg:col-span-4 space-y-6">
          {/* Your Practice Progress Chart Card */}
          <div className="lm-card-editorial p-6 space-y-4">
            <h2 className="font-serif-editorial text-lg font-bold text-ink">
              Your Practice Progress
            </h2>

            <div className="flex items-baseline gap-2">
              <span className="font-serif-editorial font-bold text-3xl text-ink tabular-nums">
                {avgAccuracy === null ? '—' : `${avgAccuracy}%`}
              </span>
              <span className="text-xs text-muted">Avg. Accuracy</span>
              <span className="text-xs text-muted ml-auto">
                {attempts.length} {attempts.length === 1 ? 'set' : 'sets'}
              </span>
            </div>

            {trendPoints.length < 2 ? (
              <p className="text-xs text-muted pt-2">
                Complete at least two practice sets to see your accuracy trend.
              </p>
            ) : (
              <div className="pt-2">
                <svg viewBox="0 0 280 120" className="w-full h-28 overflow-visible">
                  {[20, 58, 96].map((y) => (
                    <line
                      key={y}
                      x1="24"
                      y1={y}
                      x2="268"
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                  ))}
                  <text x="0" y="23" fontSize="9" fill="#94A3B8">
                    100%
                  </text>
                  <text x="0" y="61" fontSize="9" fill="#94A3B8">
                    50%
                  </text>
                  <text x="0" y="99" fontSize="9" fill="#94A3B8">
                    0%
                  </text>
                  <polyline
                    fill="none"
                    stroke="#4F46E5"
                    strokeWidth="2.2"
                    points={trendPoints.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                  />
                  {trendPoints.map((pt, i) => (
                    <g key={i}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        fill="#FFFFFF"
                        stroke="#4F46E5"
                        strokeWidth="2"
                      />
                      <text
                        x={pt.x}
                        y="112"
                        textAnchor="middle"
                        fontSize="9"
                        fill="#94A3B8"
                      >
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* Focus on these topics Card matching Image 10 */}
          <div className="lm-card-editorial p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="font-serif-editorial text-lg font-bold text-ink">
                Focus on these topics
              </h2>
              <p className="text-xs text-muted">
                Based on your recent mistakes and quiz results:
              </p>
            </div>

            {weakTopicRows.length === 0 && (
              <p className="text-xs text-muted">
                No weak topics yet. They will appear here after you answer practice questions.
              </p>
            )}

            <div className="space-y-3.5 pt-1">
              {weakTopicRows.map((wt) => (
                <div key={wt.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand" />
                      {wt.name}
                    </span>
                    <span className="font-bold text-brand tabular-nums">{wt.pct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-brand-soft overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${wt.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {weakTopicRows.length > 0 && (
              <button
                type="button"
                onClick={() => void handleStartPracticeSet(weakTopicRows[0].name)}
                className="w-full py-2.5 px-4 rounded-lg border border-line bg-canvas hover:bg-brand-soft hover:text-brand text-xs font-semibold text-ink transition-colors cursor-pointer"
              >
                Practice Weakest Topic: {weakTopicRows[0].name}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Proctored Fullscreen Enforcement with 3 Warnings */}
      <QuizProctorOverlay
        isQuizActive={sessionActive && !submittedResult && questions.length > 0}
        onAutoSubmit={handleSubmitSession}
        quizTitle="Timed Practice Set"
      />

      {/* Official 75-Question JEE Main CBT Exam Simulator */}
      <JeeCbtExamModal
        isOpen={isJeeExamModalOpen}
        onClose={() => setIsJeeExamModalOpen(false)}
        studentProfile={studentProfile}
        examTitle={`JEE (Main) 2027 Full Mock Paper — ${currentDoc?.title || 'Comprehensive'}`}
        sourceNoteTitle={currentDoc?.title}
        onSaveResult={(res) => {
          // Save attempt into studyStorage so it syncs with Recent Attempts and Mistake DNA
          const attempt: QuizAttempt = {
            id: res.id,
            documentId: currentDoc?.id || 'jee-mock-75',
            documentTitle: res.examTitle,
            mode: 'jee_simulator',
            examType: 'jee_main',
            examTitle: res.examTitle,
            questions: [],
            answers: [],
            score: res.correctCount,
            totalQuestions: res.totalQuestions,
            percentage: res.accuracyPercentage,
            weakTopics: [],
            strongTopics: [],
            completedAt: res.completedAt,
            negativeMarkingUsed: true,
            rawMarks: res.marksObtained,
            maxMarks: 300,
            timeTakenSeconds: res.timeTakenSeconds,
          };
          studyStorage.saveQuizAttempt(attempt);
          setAttempts(studyStorage.getQuizAttempts());
        }}
      />
    </div>
  );
};
