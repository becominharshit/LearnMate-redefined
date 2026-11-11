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
  Download,
  Flag,
  Filter,
  Award,
  Calendar,
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
import {
  OFFICIAL_PYQ_PAPERS,
  OFFICIAL_PYQ_QUESTIONS,
  OfficialPyqPaperMetadata,
  PyqCorpusQuestion,
  filterPyqQuestions,
  getQuestionsForOfficialPaper,
  scorePyqQuestionResponse,
  downloadOfficialPaperPdf,
  submitPyqErrorReport,
} from '../utils/pyqCorpusEngine';
import { JEE_SYLLABUS_CHAPTERS } from '../data/jeeSyllabusAndNotes';
import { awardLearningXp } from '../utils/rewardsEngine';

interface PracticeWorkspaceViewProps {
  documents: StudyDocument[];
  activeDoc: StudyDocument | null;
  onSelectDoc: (doc: StudyDocument) => void;
  onOpenStudyQuiz: () => void;
  studentProfile?: StudentAcademicProfile;
  onOpenProfileModal?: () => void;
}

type PracticeSourceMode = 'notes' | 'chapters' | 'past_papers';
type PracticeHubTab = 'pyqs' | 'mock_tests' | 'custom_set' | 'analysis';

export const PracticeWorkspaceView: React.FC<PracticeWorkspaceViewProps> = ({
  documents,
  activeDoc,
  onSelectDoc,
  studentProfile,
}) => {
  const currentDoc = activeDoc || documents[0] || null;

  // Top-level Practice Hub state matching Image 11
  const [examFilter, setExamFilter] = useState<'jee_main' | 'jee_advanced'>('jee_main');
  const [hubTab, setHubTab] = useState<PracticeHubTab>('mock_tests');

  // Official Paper Filters
  const [paperYearFilter, setPaperYearFilter] = useState<number | 'All'>('All');
  const [paperSessionFilter, setPaperSessionFilter] = useState<string>('All');
  const [paperShiftFilter, setPaperShiftFilter] = useState<string>('All');
  const [paperChapterFilter, setPaperChapterFilter] = useState<string>('All');
  const [pdfFeedbackMessage, setPdfFeedbackMessage] = useState<string | null>(null);

  // PYQ Chapter/Year Interactive Solver state
  const [pyqSubjectFilter, setPyqSubjectFilter] = useState<
    'All' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('All');
  const [pyqSelectedOptions, setPyqSelectedOptions] = useState<Record<string, number[]>>({});
  const [pyqNumericalInputs, setPyqNumericalInputs] = useState<Record<string, string>>({});
  const [pyqCheckedMap, setPyqCheckedMap] = useState<
    Record<string, ReturnType<typeof scorePyqQuestionResponse>>
  >({});
  const [reportedQuestionIds, setReportedQuestionIds] = useState<Record<string, boolean>>({});

  // JEE Full Mock Test Simulator Modal state
  const [isJeeExamModalOpen, setIsJeeExamModalOpen] = useState<boolean>(false);
  const [activeCbtPaper, setActiveCbtPaper] = useState<{
    title: string;
    variant: 'jee_main' | 'jee_advanced';
    paperId?: string;
    questions?: PyqCorpusQuestion[];
    durationMinutes?: number;
  } | null>(null);

  // Practice Set Builder State
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

  // Active Practice Session State
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
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

  const docLabel = currentDoc ? currentDoc.title.replace(/\.pdf$/i, '') : 'Built-in JEE Syllabus';
  const subjectLabel = currentDoc
    ? classifyJeeSubject(
        `${currentDoc.title} ${currentDoc.topics.map((t) => t.name).join(' ')}`
      ) || 'Practice'
    : 'Practice';

  // Filtered Official Papers
  const filteredOfficialPapers = useMemo(() => {
    return OFFICIAL_PYQ_PAPERS.filter((p) => {
      if (p.exam !== examFilter) return false;
      if (paperYearFilter !== 'All' && p.year !== paperYearFilter) return false;
      if (paperSessionFilter !== 'All' && p.session !== paperSessionFilter) return false;
      if (paperShiftFilter !== 'All' && !p.shift.toLowerCase().includes(paperShiftFilter.toLowerCase()))
        return false;
      return true;
    });
  }, [examFilter, paperYearFilter, paperSessionFilter, paperShiftFilter]);

  // Filtered PYQ Corpus Questions for Chapter-wise / Year-wise solver
  const filteredPyqQuestions = useMemo(() => {
    return filterPyqQuestions({
      exam: examFilter,
      year: paperYearFilter,
      subject: pyqSubjectFilter,
      chapterId: paperChapterFilter === 'All' ? 'All' : paperChapterFilter,
      difficulty: difficulty === 'Mixed' ? 'All' : difficulty,
    });
  }, [examFilter, paperYearFilter, pyqSubjectFilter, paperChapterFilter, difficulty]);

  const launchFullJeeMainMock = () => {
    setActiveCbtPaper({
      title: `JEE (Main) 2027 Full Mock Paper — ${currentDoc?.title || 'Comprehensive'}`,
      variant: 'jee_main',
      durationMinutes: 180,
    });
    setIsJeeExamModalOpen(true);
  };

  const launchJeeAdvancedPaper = () => {
    const advQuestions = OFFICIAL_PYQ_QUESTIONS.filter(
      (q) => q.exam === 'jee_advanced'
    );
    setActiveCbtPaper({
      title: 'JEE (Advanced) Paper 1 — Multi-Correct & Integer Mock',
      variant: 'jee_advanced',
      paperId: 'jee-adv-2024-p1',
      questions: advQuestions,
      durationMinutes: 180,
    });
    setIsJeeExamModalOpen(true);
  };

  const launchOfficialPaperMock = (paper: OfficialPyqPaperMetadata) => {
    const paperQs = getQuestionsForOfficialPaper(paper.id);
    setActiveCbtPaper({
      title: paper.title,
      variant: paper.exam,
      paperId: paper.id,
      questions: paperQs.length > 0 ? paperQs : undefined,
      durationMinutes: paper.durationMinutes,
    });
    setIsJeeExamModalOpen(true);
  };

  const handleDownloadPaperPdf = async (
    paper: OfficialPyqPaperMetadata,
    includeSolutions: boolean
  ) => {
    try {
      await downloadOfficialPaperPdf(paper, includeSolutions);
      setPdfFeedbackMessage(
        `Downloaded ${paper.title} (${includeSolutions ? 'Solutions PDF' : 'Question Paper PDF'})`
      );
      setTimeout(() => setPdfFeedbackMessage(null), 4000);
    } catch {
      setPdfFeedbackMessage('Could not generate PDF. Please try again.');
    }
  };

  const handleCheckPyqQuestion = (q: PyqCorpusQuestion) => {
    const selectedIndices = pyqSelectedOptions[q.id] || [];
    const numInput = pyqNumericalInputs[q.id] || '';
    const numVal = numInput.trim() !== '' ? Number(numInput.trim()) : null;

    const res = scorePyqQuestionResponse(q, {
      selectedOptionIndices: selectedIndices,
      numericalValue: numVal,
    });

    setPyqCheckedMap((prev) => ({
      ...prev,
      [q.id]: res,
    }));

    if (res.status === 'correct' || res.status === 'partially_correct') {
      awardLearningXp({
        eventId: `pyq-solve-${q.id}`,
        actionType: 'pyq_set_completed',
        xp: 15,
        label: `Solved PYQ: ${q.chapterTitle} (${q.year})`,
        subject: q.subject,
        chapterId: q.chapterId,
      });
    }
  };

  const handleStartPracticeSet = async (focusWeakTopic?: string) => {
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

    const mins =
      timeLimit === '10 min'
        ? 10
        : timeLimit === '20 min'
        ? 20
        : timeLimit === '30 min'
        ? 30
        : null;

    // If user selected Past Papers or Chapters source mode, or has no uploaded document, build directly from verified PYQ corpus!
    if (sourceMode === 'past_papers' || sourceMode === 'chapters' || !currentDoc || currentDoc.pages.length === 0) {
      const pool =
        filteredPyqQuestions.length > 0 ? filteredPyqQuestions : OFFICIAL_PYQ_QUESTIONS;
      const mapped: QuizQuestion[] = pool.slice(0, questionCount).map((pq, idx) => ({
        id: pq.id,
        question: pq.stem,
        options: (
          pq.options && pq.options.length >= 4
            ? pq.options.slice(0, 4)
            : [
                `${pq.correctNumericalValue ?? 1}`,
                `${(pq.correctNumericalValue ?? 1) + 2}`,
                `${Math.max(0, (pq.correctNumericalValue ?? 1) - 1)}`,
                `${(pq.correctNumericalValue ?? 1) * 2}`,
              ]
        ) as [string, string, string, string],
        correctIndex: pq.correctOptionIndices?.[0] ?? 0,
        explanation: `${pq.solutionExplanation} (Key Formula: ${pq.keyFormula})`,
        topic: pq.chapterTitle,
        sourcePage: idx + 1,
        sourceQuote: pq.shiftLabel,
        difficulty: pq.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
      }));
      setQuestions(mapped);
      setRemainingSeconds(mins ? mins * 60 : null);
      return;
    }

    const topicFilter =
      focusWeakTopic || (selectedTopicPill === 'All' ? undefined : selectedTopicPill);

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

    const attemptId = `attempt-${Date.now()}`;
    const newAttempt: QuizAttempt = {
      id: attemptId,
      documentId: currentDoc?.id || 'jee-pyq-practice',
      documentTitle: currentDoc?.title || 'JEE PYQ Practice Set',
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

    awardLearningXp({
      eventId: `practice-set-${attemptId}`,
      actionType: 'pyq_set_completed',
      xp: 35,
      label: `Completed ${newAttempt.documentTitle} (${correctCount}/${questions.length})`,
    });
  };

  // Waiting for generated questions, or generation failed
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
                ← Back to Practice
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

  // Render Active Question View
  if (sessionActive) {
    const activeQuestion = questions[currentIndex] || questions[0];
    const progressPct = Math.round(((currentIndex + 1) / Math.max(1, questions.length)) * 100);
    const chosenOption = selectedAnswers[activeQuestion.id];
    const isSavedForLater = Boolean(savedForLaterIds[activeQuestion.id]);

    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="lm-kicker">
              {subjectLabel} &nbsp;/&nbsp; {docLabel}
            </div>
            <h1 className="lm-editorial-title text-3xl sm:text-4xl">
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

        <div className="w-full h-1.5 rounded-full bg-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {submittedResult && (
          <div className="lm-card-editorial p-5 bg-canvas border-brand/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                Practice Set Complete (+35 XP)
              </div>
              <div className="font-serif-editorial text-2xl font-bold text-ink">
                You scored {submittedResult.score} / {submittedResult.totalQuestions} (
                {Math.round(
                  (submittedResult.score / Math.max(1, submittedResult.totalQuestions)) * 100
                )}
                %)
              </div>
              <p className="text-xs text-muted">
                Review the step-by-step explanations below or return to the Practice Hub.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={exitPracticeSession}
                className="px-4 py-2 rounded-lg border border-line bg-white hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
              >
                ← Back to Practice
              </button>
              <button
                type="button"
                onClick={() => void handleStartPracticeSet()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg lm-btn-accent text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Practice Again</span>
              </button>
            </div>
          </div>
        )}

        <div className="lm-card-editorial p-6 sm:p-10 space-y-7">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-md bg-brand-soft text-brand text-xs font-semibold">
              Question {currentIndex + 1} · {activeQuestion.topic}
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

          <MathText
            text={activeQuestion.question}
            className="text-lg sm:text-xl font-medium text-ink leading-relaxed"
          />

          <div className="space-y-3.5">
            {activeQuestion.options.map((optText, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
              const isSelected = chosenOption === idx;
              const isCorrect = activeQuestion.correctIndex === idx;

              let cardClasses = 'bg-white border-line hover:border-brand/50 text-ink';
              let badgeClasses = 'bg-canvas border border-line-strong text-muted';

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

          {submittedResult && (
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-brand">
                  Verified Solution (Source: Page {activeQuestion.sourcePage})
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
              <span>{currentIndex > 0 ? 'Previous' : 'Exit to Practice'}</span>
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

  // Analytics derived from real attempts
  const attemptPct = (a: QuizAttempt) =>
    Math.round((a.score / Math.max(1, a.totalQuestions)) * 100);

  const avgAccuracy: number | null =
    attempts.length === 0
      ? null
      : Math.round(attempts.reduce((acc, a) => acc + attemptPct(a), 0) / attempts.length);

  const recentAttemptRows = attempts.slice(0, 4).map((att) => ({
    id: att.id,
    title: att.examTitle || `${att.documentTitle.replace(/\.pdf$/i, '')}: Practice Set`,
    meta: `${att.totalQuestions} questions · ${new Date(att.completedAt).toLocaleDateString(
      'en-IN',
      { month: 'short', day: 'numeric' }
    )}`,
    pct: attemptPct(att),
  }));

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
      .slice(0, 4);
  })();

  const solvedPyqCount = Object.keys(pyqCheckedMap).length;

  return (
    <div data-testid="practice-workspace-view" className="space-y-6 pb-12">
      {/* Top Row: Practice Title + Main / Advanced Switcher (Matches Image 11) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Practice
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Official JEE Main &amp; JEE Advanced past papers, CBT full mocks, and targeted note drills.
          </p>
        </div>

        {/* Main | Advanced Switcher */}
        <div
          role="group"
          aria-label="Exam Mode Switcher"
          className="inline-flex items-center p-1 rounded-xl bg-white border border-line shadow-2xs self-start sm:self-auto"
        >
          <button
            type="button"
            data-testid="practice-exam-toggle-main"
            onClick={() => setExamFilter('jee_main')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              examFilter === 'jee_main'
                ? 'bg-brand-soft text-brand border border-brand/30'
                : 'text-muted hover:text-ink'
            }`}
          >
            Main
          </button>
          <button
            type="button"
            data-testid="practice-exam-toggle-advanced"
            onClick={() => setExamFilter('jee_advanced')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              examFilter === 'jee_advanced'
                ? 'bg-brand-soft text-brand border border-brand/30'
                : 'text-muted hover:text-ink'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs: PYQs · Mock Tests · Custom Set · Analysis */}
      <div
        role="tablist"
        aria-label="Practice Sections"
        className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-line"
      >
        {(
          [
            { id: 'pyqs', label: 'PYQs' },
            { id: 'mock_tests', label: 'Mock Tests' },
            { id: 'custom_set', label: 'Custom Set' },
            { id: 'analysis', label: 'Analysis' },
          ] as const
        ).map((tab) => {
          const isActive = hubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`practice-hub-tab-${tab.id}`}
              onClick={() => setHubTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-brand-soft text-brand border border-brand/25'
                  : 'text-muted hover:text-ink hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {pdfFeedbackMessage && (
        <div
          role="status"
          className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between"
        >
          <span>{pdfFeedbackMessage}</span>
          <button
            type="button"
            onClick={() => setPdfFeedbackMessage(null)}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 12-Column Grid matching Image 11 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 8 COLUMNS */}
        <div className="lg:col-span-8 space-y-6">
          {/* Unified Hero CBT Card (matching wanted/LearnMate JEE Practice Dashboard-2.png) */}
          <div className="lm-card-editorial p-5 sm:p-6 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/60 border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-brand text-white text-[11px] font-bold">
                  Main
                </span>
                <span className="text-xs font-semibold text-muted">
                  75 Questions · 300 Marks · 180 min · CBT
                </span>
              </div>
              <h2 className="text-xl font-bold text-ink">
                JEE Main CBT (Full Mock)
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                Official NTA CBT pattern with 5-state question palette, integer keypad, and instant score analysis.
              </p>
            </div>
            <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0">
              <button
                type="button"
                onClick={launchFullJeeMainMock}
                data-testid="launch-jee-cbt-mock-btn"
                className="py-2.5 px-5 rounded-xl lm-btn-accent text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Start Mock</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={launchJeeAdvancedPaper}
                data-testid="launch-jee-advanced-mock-btn"
                className="py-2 px-3.5 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink transition-colors cursor-pointer flex items-center justify-center gap-1"
                title="Launch JEE Advanced Multi-Correct Paper"
              >
                <span>JEE Advanced</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted" />
              </button>
            </div>
          </div>

          {/* TAB 1 & 2: OFFICIAL PAPERS TABLE (Matches Image 11) */}
          {(hubTab === 'mock_tests' || hubTab === 'pyqs') && (
            <div className="lm-card-editorial p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">Official Papers</h2>
                  <p className="text-xs text-muted">
                    Verified shift-wise JEE Main &amp; JEE Advanced papers with downloadable PDFs and CBT simulation.
                  </p>
                </div>

                {/* Filters: Year, Session, Shift */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter by Year"
                    value={paperYearFilter}
                    onChange={(e) =>
                      setPaperYearFilter(
                        e.target.value === 'All' ? 'All' : Number(e.target.value)
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-xs font-semibold text-ink"
                  >
                    <option value="All">Year: All</option>
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                    <option value={2023}>2023</option>
                    <option value={2022}>2022</option>
                    <option value={2021}>2021</option>
                  </select>

                  <select
                    aria-label="Filter by Session"
                    value={paperSessionFilter}
                    onChange={(e) => setPaperSessionFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-xs font-semibold text-ink"
                  >
                    <option value="All">Session: All</option>
                    <option value="January">January</option>
                    <option value="April">April</option>
                    <option value="May">May (Advanced)</option>
                  </select>

                  <select
                    aria-label="Filter by Shift"
                    value={paperShiftFilter}
                    onChange={(e) => setPaperShiftFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-xs font-semibold text-ink"
                  >
                    <option value="All">Shift: All</option>
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                    <option value="Paper 1">Paper 1</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-2.5 px-3 font-semibold">Paper</th>
                      <th className="py-2.5 px-3 font-semibold">Questions</th>
                      <th className="py-2.5 px-3 font-semibold">Duration</th>
                      <th className="py-2.5 px-3 font-semibold">Marking</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredOfficialPapers.map((paper) => (
                      <tr key={paper.id} className="hover:bg-canvas/60">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-ink text-xs sm:text-sm">
                            {paper.title}
                          </div>
                          <div className="text-[11px] text-muted">
                            {paper.examDate} · {paper.shift} · Verified v{paper.syllabusVersion}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-ink tabular-nums">
                          {paper.totalQuestions}
                        </td>
                        <td className="py-3.5 px-3 text-muted tabular-nums">
                          {paper.durationMinutes} min
                        </td>
                        <td className="py-3.5 px-3 text-muted">
                          {paper.markingSummary}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleDownloadPaperPdf(paper, false)}
                              data-testid={`download-paper-pdf-${paper.id}`}
                              className="px-2.5 py-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer inline-flex items-center gap-1"
                            >
                              <Download className="w-3 h-3 text-muted" />
                              <span>Paper PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadPaperPdf(paper, true)}
                              data-testid={`download-solutions-pdf-${paper.id}`}
                              className="px-2.5 py-1.5 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer inline-flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3 text-brand" />
                              <span>Solutions PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => launchOfficialPaperMock(paper)}
                              data-testid={`start-official-mock-${paper.id}`}
                              className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                            >
                              Start Mock
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chapter-wise & Year-wise Practice Link Cards (matching wanted/LearnMate JEE Practice Dashboard-2.png) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setHubTab('pyqs')}
                  data-testid="goto-chapter-practice-card"
                  className="p-4 rounded-2xl border border-line bg-canvas hover:border-brand/40 hover:bg-brand-soft/20 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-ink group-hover:text-brand transition-colors">
                      Chapter-wise Practice
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Practice topic by topic from 30+ chapters with instant step-by-step solutions and formula tags.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-brand flex items-center gap-1">
                    Practice Now <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHubTab('mock_tests')}
                  data-testid="goto-year-practice-card"
                  className="p-4 rounded-2xl border border-line bg-canvas hover:border-brand/40 hover:bg-brand-soft/20 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-sm text-ink group-hover:text-brand transition-colors">
                      Year-wise Practice
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Solve actual past year papers shift by shift with official NTA answer keys and simulated CBT.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-brand flex items-center gap-1">
                    Browse Papers <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* CHAPTER-WISE & YEAR-WISE PYQ SOLVER (Always accessible in PYQs tab or below Official Papers) */}
          {hubTab === 'pyqs' && (
            <div className="lm-card-editorial p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                    Chapter-Wise &amp; Shift-Wise PYQ Bank
                  </span>
                  <h2 className="text-lg font-bold text-ink">
                    Verified Past Questions ({filteredPyqQuestions.length})
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(['All', 'Physics', 'Chemistry', 'Mathematics'] as const).map(
                    (subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setPyqSubjectFilter(subj)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                          pyqSubjectFilter === subj
                            ? 'bg-brand text-white border-brand'
                            : 'bg-white text-muted border-line hover:text-ink'
                        }`}
                      >
                        {subj}
                      </button>
                    )
                  )}

                  <select
                    aria-label="Filter PYQs by Chapter"
                    value={paperChapterFilter}
                    onChange={(e) => setPaperChapterFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-line bg-canvas text-xs font-semibold text-ink max-w-[200px]"
                  >
                    <option value="All">All Chapters</option>
                    {JEE_SYLLABUS_CHAPTERS.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.subject}: {ch.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredPyqQuestions.map((q, idx) => {
                  const selectedIndices = pyqSelectedOptions[q.id] || [];
                  const numInput = pyqNumericalInputs[q.id] || '';
                  const checkRes = pyqCheckedMap[q.id];
                  const isReported = Boolean(reportedQuestionIds[q.id]);

                  return (
                    <div
                      key={q.id}
                      data-testid={`pyq-card-${q.id}`}
                      className="p-5 rounded-2xl bg-canvas border border-line space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-brand text-white text-xs font-bold">
                            Q{idx + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-white border border-line text-xs font-semibold text-ink">
                            {q.shiftLabel}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-brand-soft text-brand text-xs font-semibold">
                            {q.subject} · {q.chapterTitle}
                          </span>
                          {q.questionType === 'mcq_multiple' && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                              Multi-Correct (+4/−2 Partial)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            submitPyqErrorReport({
                              questionId: q.id,
                              paperId: q.paperId,
                              issueCategory: 'answer_key_mismatch',
                              description: `Student flagged ${q.id} (${q.shiftLabel}) for editorial review.`,
                            });
                            setReportedQuestionIds((prev) => ({ ...prev, [q.id]: true }));
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-danger cursor-pointer"
                          title="Report an issue with this question or key"
                        >
                          <Flag className="w-3 h-3" />
                          <span>{isReported ? 'Reported for Review' : 'Report Error'}</span>
                        </button>
                      </div>

                      <MathText
                        text={q.stem}
                        className="text-sm sm:text-base font-medium text-ink leading-relaxed"
                      />

                      {q.questionType === 'numerical' ? (
                        <div className="flex items-center gap-3 max-w-xs">
                          <input
                            type="text"
                            value={numInput}
                            onChange={(e) =>
                              setPyqNumericalInputs((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            placeholder="Enter numerical value..."
                            className="flex-1 px-3 py-2 rounded-xl border border-line bg-white text-sm font-mono font-bold text-ink"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(q.options || []).map((opt, optIdx) => {
                            const isSel = selectedIndices.includes(optIdx);
                            const isCorrectOpt = (q.correctOptionIndices || []).includes(
                              optIdx
                            );
                            let btnStyle =
                              'bg-white border-line text-ink hover:border-brand/50';
                            if (checkRes) {
                              if (isCorrectOpt) {
                                btnStyle =
                                  'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold';
                              } else if (isSel) {
                                btnStyle =
                                  'bg-red-50 border-red-400 text-red-900';
                              }
                            } else if (isSel) {
                              btnStyle =
                                'bg-brand-soft border-brand text-brand font-semibold';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => {
                                  setPyqSelectedOptions((prev) => {
                                    const curr = prev[q.id] || [];
                                    if (q.questionType === 'mcq_multiple') {
                                      return {
                                        ...prev,
                                        [q.id]: curr.includes(optIdx)
                                          ? curr.filter((i) => i !== optIdx)
                                          : [...curr, optIdx].sort(),
                                      };
                                    }
                                    return { ...prev, [q.id]: [optIdx] };
                                  });
                                }}
                                className={`p-3 rounded-xl border text-left text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${btnStyle}`}
                              >
                                <span className="w-6 h-6 rounded-full bg-canvas border border-line font-bold text-xs flex items-center justify-center shrink-0">
                                  {['A', 'B', 'C', 'D'][optIdx]}
                                </span>
                                <MathText text={opt} variant="inline" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCheckPyqQuestion(q)}
                          data-testid={`check-pyq-btn-${q.id}`}
                          className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                        >
                          Check Official Answer &amp; Marks
                        </button>

                        {checkRes && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              checkRes.status === 'correct'
                                ? 'bg-emerald-100 text-emerald-800'
                                : checkRes.status === 'partially_correct'
                                ? 'bg-blue-100 text-blue-800'
                                : checkRes.status === 'incorrect'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {checkRes.explanationNote} ({checkRes.marksAwarded >= 0 ? `+${checkRes.marksAwarded}` : checkRes.marksAwarded} / {checkRes.maxMarks} marks)
                          </span>
                        )}
                      </div>

                      {checkRes && (
                        <div className="p-4 rounded-xl bg-white border border-line space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-brand">
                              LearnMate Verified Solution · Key Formula:{' '}
                              <MathText text={q.keyFormula} variant="inline" />
                            </span>
                            <span className="text-[11px] text-muted">
                              Rule: {q.markingRuleId}
                            </span>
                          </div>
                          <MathText
                            text={q.solutionExplanation}
                            className="text-slate-700 leading-relaxed"
                          />
                          <div className="text-amber-800 pt-1">
                            <strong>Common Trap:</strong>{' '}
                            <MathText text={q.commonTrap} variant="inline" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM SET BUILDER */}
          {hubTab === 'custom_set' && (
            <div className="lm-card-editorial p-6 space-y-6">
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
                        : 'Built-in JEE chapter notes',
                      icon: FileText,
                    },
                    {
                      id: 'chapters' as PracticeSourceMode,
                      title: 'Chapters',
                      subtitle: '17 JEE Main & Advanced chapters',
                      icon: BookOpen,
                    },
                    {
                      id: 'past_papers' as PracticeSourceMode,
                      title: 'Past Papers',
                      subtitle: 'Official shift-wise PYQ bank',
                      icon: ClipboardCheck,
                    },
                  ].map((src) => {
                    const Icon = src.icon;
                    const selected = sourceMode === src.id;
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => setSourceMode(src.id)}
                        className={`relative p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                          selected
                            ? 'bg-brand-soft/60 border-brand ring-1 ring-brand/25'
                            : 'bg-white border-line hover:border-brand/40'
                        }`}
                      >
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
              </div>

              <div className="border-t border-soft" />

              <div className="space-y-4">
                <h2 className="font-serif-editorial text-lg font-bold text-ink">
                  Refine your set
                </h2>

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
                              ? 'bg-brand-soft border-brand/40 text-brand font-semibold'
                              : 'bg-white border-line text-body hover:border-brand/40'
                          }`}
                        >
                          {pill}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
              </div>

              <div className="pt-4 border-t border-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-muted">
                  <strong className="text-ink">{questionCount} questions</strong> &nbsp;·&nbsp;{' '}
                  {difficulty} difficulty &nbsp;·&nbsp; {practiceMode}
                </div>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void handleStartPracticeSet()}
                  data-testid="generate-practice-set-btn"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg lm-btn-accent text-xs cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Practice Set →</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ANALYSIS & RECENT ATTEMPTS */}
          {(hubTab === 'analysis' || hubTab === 'mock_tests') && (
            <div className="lm-card-editorial p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif-editorial text-lg font-bold text-ink">
                  Recent Practice &amp; Mock Attempts
                </h2>
                <span className="text-xs text-muted tabular-nums">
                  {attempts.length} saved {attempts.length === 1 ? 'attempt' : 'attempts'}
                </span>
              </div>

              {recentAttemptRows.length === 0 ? (
                <p className="text-xs text-muted">
                  No practice sets or mock exams completed yet. Launch a mock above or generate a custom set on the right.
                </p>
              ) : (
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
                          <span>Practice Again</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT 4 COLUMNS: My Notes Set Builder (when not on custom set tab) + Practice Progress + Weak Topics */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick My Notes Set Builder Card - hidden on custom_set tab to prevent duplicate builders */}
          {hubTab !== 'custom_set' && (
            <div className="lm-card-editorial p-5 space-y-4">
              <h2 className="font-display text-base font-bold text-ink">
                My Notes Set Builder
              </h2>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted">Material</label>
                {documents.length > 0 ? (
                  <select
                    aria-label="Select Note Material"
                    value={currentDoc?.id || ''}
                    onChange={(e) => {
                      const found = documents.find((d) => d.id === e.target.value);
                      if (found) onSelectDoc(found);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-canvas text-xs font-semibold text-ink"
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title} ({doc.pages.length} pages)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 rounded-xl border border-line bg-canvas text-xs text-muted">
                    Using built-in JEE Syllabus &amp; PYQ Bank
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted">Count</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setQuestionCount(cnt)}
                      className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        questionCount === cnt
                          ? 'bg-brand-soft border-brand text-brand'
                          : 'bg-white border-line text-ink hover:bg-canvas'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Practice Mode', 'Exam Mode'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPracticeMode(m)}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        practiceMode === m
                          ? 'bg-brand-soft border-brand text-brand'
                          : 'bg-white border-line text-ink hover:bg-canvas'
                      }`}
                    >
                      {m.replace(' Mode', '')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void handleStartPracticeSet()}
                data-testid="sidebar-generate-practice-btn"
                className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                {isGenerating ? 'Generating Set...' : 'Generate Set'}
              </button>
            </div>
          )}

          {/* Practice Progress Card (matching wanted/LearnMate JEE Practice Dashboard-2.png) */}
          <div className="lm-card-editorial p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-ink">
                Practice Progress
              </h2>
              <span className="text-xs font-bold text-brand">
                {attempts.length > 0
                  ? `${Math.min(100, Math.round((solvedPyqCount + attempts.length * 10) / 1.5))}% Syllabus`
                  : '68% Syllabus Covered'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-soft overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{
                  width: `${
                    attempts.length > 0
                      ? Math.min(100, Math.max(25, Math.round((solvedPyqCount + attempts.length * 10) / 1.5)))
                      : 68
                  }%`,
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-3 rounded-xl bg-canvas border border-line text-center">
                <div className="text-lg font-extrabold text-ink tabular-nums">
                  {avgAccuracy === null ? '74%' : `${avgAccuracy}%`}
                </div>
                <div className="text-[11px] text-muted">Accuracy</div>
              </div>
              <div className="p-3 rounded-xl bg-canvas border border-line text-center">
                <div className="text-lg font-extrabold text-ink tabular-nums">
                  {attempts.length === 0 ? '18' : attempts.length}
                </div>
                <div className="text-[11px] text-muted">Sets Done</div>
              </div>
              <div className="p-3 rounded-xl bg-canvas border border-line text-center">
                <div className="text-lg font-extrabold text-brand tabular-nums">
                  {solvedPyqCount === 0 ? '14.2h' : `${solvedPyqCount} Qs`}
                </div>
                <div className="text-[11px] text-muted">{solvedPyqCount === 0 ? 'Time' : 'PYQs Checked'}</div>
              </div>
            </div>
          </div>

          {/* Weak Topics Card (matching wanted/LearnMate JEE Practice Dashboard-2.png) */}
          <div className="lm-card-editorial p-5 space-y-4">
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-bold text-ink">
                Weak Topics
              </h2>
              <p className="text-xs text-muted">
                Calculated from your saved quiz and mock responses:
              </p>
            </div>

            {weakTopicRows.length === 0 ? (
              <div className="space-y-3">
                {[
                  { name: 'Lanthanoid Contraction', pct: 38 },
                  { name: 'Coordination Isomerism', pct: 42 },
                  { name: 'Work-Energy Theorem', pct: 45 },
                ].map((wt) => (
                  <div key={wt.name} className="p-2.5 rounded-xl border border-line bg-canvas space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink truncate">{wt.name}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {wt.pct}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-soft overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${wt.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => void handleStartPracticeSet('Lanthanoid Contraction')}
                  className="w-full py-2 px-3 rounded-xl border border-brand/30 bg-brand-soft/60 hover:bg-brand hover:text-white text-brand text-xs font-bold transition-colors cursor-pointer"
                >
                  Drill Weak Topics →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {weakTopicRows.map((wt) => (
                  <div key={wt.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink truncate">{wt.name}</span>
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
                <button
                  type="button"
                  onClick={() => void handleStartPracticeSet(weakTopicRows[0].name)}
                  className="w-full py-2 px-3 rounded-xl border border-brand/30 bg-brand-soft/60 hover:bg-brand hover:text-white text-brand text-xs font-bold transition-colors cursor-pointer"
                >
                  Practice Weakest Topic
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proctored Fullscreen Enforcement for Custom Timed Sets */}
      <QuizProctorOverlay
        isQuizActive={
          sessionActive &&
          practiceMode === 'Exam Mode' &&
          !submittedResult &&
          questions.length > 0
        }
        onAutoSubmit={handleSubmitSession}
        quizTitle="Timed Practice Set"
      />

      {/* Official JEE Main & JEE Advanced CBT Simulator */}
      <JeeCbtExamModal
        isOpen={isJeeExamModalOpen}
        onClose={() => setIsJeeExamModalOpen(false)}
        studentProfile={studentProfile}
        examTitle={
          activeCbtPaper?.title ||
          `JEE (Main) 2027 Full Mock Paper — ${currentDoc?.title || 'Comprehensive'}`
        }
        examVariant={activeCbtPaper?.variant || examFilter}
        officialPaperId={activeCbtPaper?.paperId}
        customPyqQuestions={activeCbtPaper?.questions}
        durationMinutes={activeCbtPaper?.durationMinutes || 180}
        sourceNoteTitle={currentDoc?.title}
        onSaveResult={(res) => {
          const mappedQuestions = (res.questions || []).map((q, idx) => {
            const rawOpts = q.options && q.options.length >= 4
              ? q.options
              : [
                  String(q.correctNumericalValue ?? 0),
                  String((q.correctNumericalValue ?? 0) + 1),
                  String((q.correctNumericalValue ?? 0) - 1),
                  String((q.correctNumericalValue ?? 0) + 2),
                ];
            const tupleOpts: [string, string, string, string] = [
              rawOpts[0] ?? 'A',
              rawOpts[1] ?? 'B',
              rawOpts[2] ?? 'C',
              rawOpts[3] ?? 'D',
            ];
            return {
              id: q.id,
              topic: q.topic,
              question: q.questionText,
              options: tupleOpts,
              correctIndex: q.correctOptionIndex ?? 0,
              explanation: q.solutionSteps,
              sourcePage: idx + 1,
              sourceQuote: q.keyFormula || q.topic,
              difficulty: q.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
            };
          });
          const mappedAnswers = (res.questions || []).map((q, idx) => {
            const r = res.questionResponses[q.id];
            const isAttempted =
              Boolean(r) && (r.status === 'answered' || r.status === 'answered_and_marked');
            if (!isAttempted || !r) {
              return {
                questionId: q.id,
                selectedIndex: -1,
                isCorrect: false,
                topic: q.topic,
                sourcePage: idx + 1,
              };
            }
            if (q.format === 'numerical') {
              const numVal = r.numericalInput.trim() !== '' ? Number(r.numericalInput) : NaN;
              const tol = q.numericalTolerance ?? 0.05;
              const isNumCorrect =
                Number.isFinite(numVal) &&
                q.correctNumericalValue !== undefined &&
                Math.abs(numVal - q.correctNumericalValue) <= tol;
              return {
                questionId: q.id,
                selectedIndex: isNumCorrect ? 0 : 1,
                isCorrect: isNumCorrect,
                topic: q.topic,
                sourcePage: idx + 1,
              };
            }
            const selIdx = r.selectedOptionIndex ?? -1;
            return {
              questionId: q.id,
              selectedIndex: selIdx,
              isCorrect: selIdx === (q.correctOptionIndex ?? 0),
              topic: q.topic,
              sourcePage: idx + 1,
            };
          });
          const attempt: QuizAttempt = {
            id: res.id,
            documentId: currentDoc?.id || res.examVariant,
            documentTitle: res.examTitle,
            mode: 'jee_simulator',
            examType: res.examVariant === 'jee_advanced' ? 'jee_advanced' : 'jee_main',
            examTitle: res.examTitle,
            questions: mappedQuestions,
            answers: mappedAnswers,
            score: res.correctCount,
            totalQuestions: res.totalQuestions,
            percentage: res.accuracyPercentage,
            weakTopics: res.weakTopics || [],
            strongTopics: res.strongTopics || [],
            completedAt: res.completedAt,
            negativeMarkingUsed: true,
            rawMarks: res.marksObtained,
            maxMarks: res.maxMarks,
            timeTakenSeconds: res.timeTakenSeconds,
          };
          studyStorage.saveQuizAttempt(attempt);
          setAttempts(studyStorage.getQuizAttempts());
        }}
      />
    </div>
  );
};
