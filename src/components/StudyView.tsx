import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  Target,
  ListChecks,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Send,
  FileText,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Loader2,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Mic,
  CloudCheck,
  TrendingUp,
  Layers,
  Award,
  StickyNote,
  Youtube,
  Compass,
  Clock,
} from 'lucide-react';
import type {
  StudyDocument,
  TutorMessage,
  QuizQuestion,
  QuizAttempt,
  MistakeInsight,
  RevisionTask,
  SourceControlMode,
  TeachItBackEvaluation,
} from '../types/study';
import { aiStudyClient } from '../services/aiClient';
import { studyStorage } from '../services/storageService';
import {
  gradeQuizSubmission,
  updateRevisionPlanWithAttempt,
  computeTopicProgress,
  computeOverallProgressSummary,
  formatSourceReferenceLabel,
} from '../utils/quizGrading';
import { renderPdfPageToCanvas } from '../utils/pdfExtractor';
import { classifyJeeSubject } from '../utils/jeeSubjects';
import { VoiceTutorModal } from './VoiceTutorModal';
import { QuickReviseView } from './QuickReviseView';
import { ExploreFurtherView } from './ExploreFurtherView';
import { QuizProctorOverlay } from './QuizProctorOverlay';
import { MathText } from './MathText';

export type StudySubMode =
  | 'explain'
  | 'quick-revise'
  | 'quiz'
  | 'mistakes'
  | 'revision'
  | 'adaptive'
  | 'explore';

interface StudyViewProps {
  documents: StudyDocument[];
  activeDocument: StudyDocument;
  onSelectDocument: (doc: StudyDocument) => void;
  initialSubMode?: StudySubMode;
  presentationMode?: 'study-space' | 'ai-tutor';
  onAttemptSaved: () => void;
  onNavigateProgress: () => void;
  onOpenPdfWorkspace?: () => void;
  onOpenUploadModal?: () => void;
  isCloudSynced?: boolean;
  externalVoiceOpen?: boolean;
  onCloseExternalVoice?: () => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  documents,
  activeDocument,
  onSelectDocument,
  initialSubMode = 'explain',
  presentationMode = 'study-space',
  onAttemptSaved,
  onNavigateProgress,
  onOpenPdfWorkspace,
  onOpenUploadModal,
  isCloudSynced = false,
  externalVoiceOpen = false,
  onCloseExternalVoice,
}) => {
  const [subMode, setSubMode] = useState<StudySubMode>(initialSubMode);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visitedPages, setVisitedPages] = useState<number[]>([1]);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [readerZoomPct, setReaderZoomPct] = useState<number>(100);
  const [pageQuestionInput, setPageQuestionInput] = useState<string>('');
  const [viewPdfCanvas, setViewPdfCanvas] = useState<boolean>(false);
  const [showDocPreview, setShowDocPreview] = useState<boolean>(true);
  const [showOverviewDrawer, setShowOverviewDrawer] = useState<boolean>(false);
  const [expandedCitationsMap, setExpandedCitationsMap] = useState<Record<string, boolean>>({});
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(false);

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tutorScrollRef = useRef<HTMLDivElement | null>(null);
  const docSelectRef = useRef<HTMLSelectElement | null>(null);

  // Tutor state
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string>('');
  const [isAskingTutor, setIsAskingTutor] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [sourceControlMode, setSourceControlMode] = useState<SourceControlMode>(() =>
    studyStorage.getSourceControlMode()
  );

  // Teach It Back (Feynman Method) state
  const [showTeachItBack, setShowTeachItBack] = useState(false);
  const [teachTopic, setTeachTopic] = useState('');
  const [teachExplanation, setTeachExplanation] = useState('');
  const [isEvaluatingTeach, setIsEvaluatingTeach] = useState(false);
  const [teachResult, setTeachResult] = useState<TeachItBackEvaluation | null>(null);

  useEffect(() => {
    if (externalVoiceOpen) {
      setVoiceModalOpen(true);
    }
  }, [externalVoiceOpen]);

  // Scroll ONLY the internal tutor chat container so the top navbar & close buttons never move off-screen
  useEffect(() => {
    if (tutorScrollRef.current && tutorMessages.length > 0) {
      const container = tutorScrollRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [tutorMessages, isAskingTutor]);

  // Diagnostic Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [latestDiagnosticAttempt, setLatestDiagnosticAttempt] = useState<QuizAttempt | null>(null);
  const [allDocAttempts, setAllDocAttempts] = useState<QuizAttempt[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Mistake DNA & Revision Plan state
  const [mistakes, setMistakes] = useState<MistakeInsight[]>([]);
  const [revisionPlan, setRevisionPlan] = useState<RevisionTask[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Adaptive Practice state
  const [adaptiveFocusTopics, setAdaptiveFocusTopics] = useState<string[]>([]);
  const [adaptiveQuestions, setAdaptiveQuestions] = useState<QuizQuestion[]>([]);
  const [adaptiveQuestionIdx, setAdaptiveQuestionIdx] = useState(0);
  const [adaptiveSelected, setAdaptiveSelected] = useState<Record<string, number>>({});
  const [latestAdaptiveAttempt, setLatestAdaptiveAttempt] = useState<QuizAttempt | null>(null);
  const [isGeneratingAdaptive, setIsGeneratingAdaptive] = useState(false);

  useEffect(() => {
    setSubMode(initialSubMode);
    if (initialSubMode === 'quiz' && quizQuestions.length === 0 && !isGeneratingQuiz) {
      void handleGenerateDiagnosticQuiz(false);
    }
  }, [initialSubMode]);

  // Load persisted document state when activeDocument changes
  useEffect(() => {
    setCurrentPage(1);
    setVisitedPages([1]);
    setHighlightedQuote(null);
    setViewPdfCanvas(false);

    const savedTutor = studyStorage.getTutorMessages(activeDocument.id);
    setTutorMessages(savedTutor);

    const cachedQuiz = studyStorage.getCachedQuiz(activeDocument.id, 'diagnostic');
    setQuizQuestions(cachedQuiz || []);
    setCurrentQuestionIdx(0);
    setSelectedAnswers({});

    const docAttempts = studyStorage.getQuizAttempts(activeDocument.id);
    setAllDocAttempts(docAttempts);
    const lastDiag = docAttempts.find((a) => a.mode === 'diagnostic') || null;
    const lastAdapt = docAttempts.find((a) => a.mode === 'adaptive') || null;
    setLatestDiagnosticAttempt(lastDiag);
    setLatestAdaptiveAttempt(lastAdapt);

    const savedMistakes = studyStorage.getMistakeInsights(activeDocument.id);
    setMistakes(savedMistakes);

    const savedPlan = studyStorage.getRevisionPlan(activeDocument.id);
    setRevisionPlan(savedPlan);

    const weakFromPlan = savedPlan.filter((t) => !t.completed).map((t) => t.topic);
    const weakFromAttempt = lastDiag?.weakTopics || [];
    const defaultWeak = Array.from(new Set([...weakFromPlan, ...weakFromAttempt]));
    setAdaptiveFocusTopics(
      defaultWeak.length > 0
        ? defaultWeak
        : activeDocument.topics.slice(0, 2).map((t) => t.name)
    );
    setAdaptiveQuestions([]);
    setAdaptiveSelected({});
  }, [activeDocument.id]);

  // Generate diagnostic quiz on demand only when student opens the quiz mode
  useEffect(() => {
    if (
      subMode === 'quiz' &&
      quizQuestions.length === 0 &&
      !isGeneratingQuiz
    ) {
      const cached = studyStorage.getCachedQuiz(activeDocument.id, 'diagnostic');
      if (cached && cached.length >= 5) {
        setQuizQuestions(cached);
      } else {
        void handleGenerateDiagnosticQuiz(false);
      }
    }
  }, [subMode, activeDocument.id]);

  // Render PDF page to canvas when toggled on
  useEffect(() => {
    if (viewPdfCanvas && activeDocument.pdfDataUrl && pdfCanvasRef.current) {
      renderPdfPageToCanvas(activeDocument.pdfDataUrl, currentPage, pdfCanvasRef.current).catch(
        () => {}
      );
    }
  }, [viewPdfCanvas, currentPage, activeDocument.pdfDataUrl]);

  const selectPage = (pageNumber: number) => {
    const safePage = Math.max(1, Math.min(pageNumber, activeDocument.pageCount));
    setCurrentPage(safePage);
    setVisitedPages((prev) => (prev.includes(safePage) ? prev : [...prev, safePage]));
  };

  const navigateToCitation = (pageNumber: number, quote?: string) => {
    setShowDocPreview(true);
    selectPage(pageNumber);
    if (quote) {
      setHighlightedQuote(quote);
    }
  };

  const toggleCitationExpand = (msgId: string) => {
    setExpandedCitationsMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const activePageObj =
    activeDocument.pages.find((p) => p.pageNumber === currentPage) ||
    activeDocument.pages[0];

  const activePageTopic =
    activeDocument.topics.find((t) => t.sourcePages.includes(currentPage)) ||
    activeDocument.topics[0];

  const cleanDocTitle = activeDocument.title.replace(/\.pdf$/i, '');
  const documentSubject = classifyJeeSubject(
    `${activeDocument.title} ${activeDocument.topics.map((t) => t.name).join(' ')}`
  );
  const activePageLabel = activePageObj?.title || activePageTopic?.name || `Page ${currentPage}`;
  const latestTutorAnswer =
    [...tutorMessages].reverse().find((m) => m.role === 'assistant') || null;
  const highlightKey = (highlightedQuote || '').replace(/\s+/g, ' ').slice(0, 28).toLowerCase();

  /** Students can select any line on the page and ask the tutor about it. */
  const handleReaderSelection = () => {
    const selected = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() || '';
    if (selected.length >= 4) setHighlightedQuote(selected.slice(0, 400));
  };

  const currentWeakTopics = Array.from(
    new Set([
      ...(latestDiagnosticAttempt?.weakTopics || []),
      ...mistakes.map((m) => m.topic),
      ...revisionPlan.filter((r) => !r.completed).map((r) => r.topic),
    ])
  );

  // --- Context-Aware AI Study Tutor Handler ---
  const handleAskTutor = async (customQuestion?: string) => {
    const qText = (customQuestion ?? questionInput).trim();
    if (!qText || isAskingTutor) return;

    setTutorError(null);
    setLastAskedQuestion(qText);
    const userMsg: TutorMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: qText,
      foundInMaterial: true,
      citations: [],
      relatedTopics: [],
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...tutorMessages, userMsg];
    setTutorMessages(nextMessages);
    if (!customQuestion) setQuestionInput('');
    setIsAskingTutor(true);

    try {
      const response = await aiStudyClient.askTutor({
        title: activeDocument.title,
        pages: activeDocument.pages,
        question: qText,
        history: nextMessages.slice(-5).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        sourceControlMode,
        studentContext: {
          currentTopic: activePageTopic?.name || activePageObj?.title,
          currentPage,
          currentActivity: subMode,
          weakTopics: currentWeakTopics,
          recentScorePct: latestDiagnosticAttempt?.percentage ?? null,
          completedRevisionCount: revisionPlan.filter((t) => t.completed).length,
          totalRevisionCount: revisionPlan.length,
          preferredLanguage: studyStorage.getStudentProfile().preferredLanguage,
        },
      });

      const assistantMsg: TutorMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.answer,
        foundInMaterial: response.foundInMaterial,
        sourceType: response.sourceType,
        citations: response.citations || [],
        relatedTopics: response.relatedTopics || [],
        timestamp: new Date().toISOString(),
        modelUsed: response.modelUsed,
      };

      const updated = [...nextMessages, assistantMsg];
      setTutorMessages(updated);
      studyStorage.saveTutorMessages(activeDocument.id, updated);

      if (response.aiNotice) {
        setTutorError(response.aiNotice);
      }

      // Automatically navigate preview to the first cited page
      if (response.citations && response.citations.length > 0) {
        navigateToCitation(response.citations[0].pageNumber, response.citations[0].quote);
      }
    } catch (err) {
      setTutorError(
        err instanceof Error ? err.message : 'The AI is temporarily busy. Try again shortly.'
      );
    } finally {
      setIsAskingTutor(false);
    }
  };

  const handleToggleSourceControl = (mode: SourceControlMode) => {
    setSourceControlMode(mode);
    studyStorage.saveSourceControlMode(mode);
  };

  const handleEvaluateTeachItBack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teachExplanation.trim() || isEvaluatingTeach) return;
    setIsEvaluatingTeach(true);
    try {
      const targetConcept =
        teachTopic.trim() ||
        activePageTopic?.name ||
        activeDocument.topics[0]?.name ||
        activeDocument.title;
      const evaluation = await aiStudyClient.evaluateTeachItBack({
        topic: targetConcept,
        studentExplanation: teachExplanation.trim(),
        pages: activeDocument.pages,
      });
      setTeachResult(evaluation);
    } catch {
      // ignore
    } finally {
      setIsEvaluatingTeach(false);
    }
  };

  // --- Diagnostic Quiz Generation & Grading ---
  const handleGenerateDiagnosticQuiz = async (forceRefresh = false) => {
    if (isGeneratingQuiz) return;
    setQuizError(null);
    setLatestDiagnosticAttempt(null);
    setSelectedAnswers({});
    setCurrentQuestionIdx(0);

    if (!forceRefresh) {
      const cached = studyStorage.getCachedQuiz(activeDocument.id, 'diagnostic');
      if (cached && cached.length >= 5) {
        setQuizQuestions(cached);
        return;
      }
    }

    setIsGeneratingQuiz(true);
    try {
      const res = await aiStudyClient.generateQuiz({
        documentId: activeDocument.id,
        title: activeDocument.title,
        pages: activeDocument.pages,
        topics: activeDocument.topics,
        mode: 'diagnostic',
        questionCount: 6,
        forceRefresh,
      });

      if (!res.questions || res.questions.length === 0) {
        setQuizError(
          res.aiNotice || 'Could not generate quiz questions for this material.'
        );
      } else {
        setQuizQuestions(res.questions);
        studyStorage.saveCachedQuiz(activeDocument.id, 'diagnostic', res.questions);
      }
    } catch (err) {
      setQuizError(
        err instanceof Error
          ? err.message
          : 'The AI is temporarily busy. Try again shortly.'
      );
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSubmitDiagnosticQuiz = async () => {
    if (quizQuestions.length === 0) return;

    const gradedAttempt = gradeQuizSubmission({
      attemptId: `att-diag-${Date.now()}`,
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
      mode: 'diagnostic',
      questions: quizQuestions,
      selectedIndices: selectedAnswers,
    });

    studyStorage.saveQuizAttempt(gradedAttempt);
    setLatestDiagnosticAttempt(gradedAttempt);
    setAllDocAttempts(studyStorage.getQuizAttempts(activeDocument.id));
    onAttemptSaved();

    if (gradedAttempt.weakTopics.length > 0) {
      setAdaptiveFocusTopics(gradedAttempt.weakTopics);
    }

    setIsDiagnosing(true);
    try {
      const diagnosis = await aiStudyClient.analyzeMistakesAndPlan({
        documentId: activeDocument.id,
        title: activeDocument.title,
        pages: activeDocument.pages,
        attempt: gradedAttempt,
      });

      setMistakes(diagnosis.mistakes);
      setRevisionPlan(diagnosis.revisionPlan);
      studyStorage.saveMistakeInsights(activeDocument.id, diagnosis.mistakes);
      studyStorage.saveRevisionPlan(activeDocument.id, diagnosis.revisionPlan);
    } catch {
      // Handled gracefully
    } finally {
      setIsDiagnosing(false);
    }
  };

  // --- Revision Plan Task Toggle ---
  const handleToggleRevisionTask = (taskId: string) => {
    const updated = revisionPlan.map((t) =>
      t.id === taskId
        ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
        : t
    );
    setRevisionPlan(updated);
    studyStorage.saveRevisionPlan(activeDocument.id, updated);
  };

  // --- Adaptive Practice Generation & Grading ---
  const handleStartAdaptivePractice = async (topicsOverride?: string[]) => {
    const targetTopics =
      topicsOverride && topicsOverride.length > 0
        ? topicsOverride
        : adaptiveFocusTopics.length > 0
        ? adaptiveFocusTopics
        : activeDocument.topics.map((t) => t.name);

    setAdaptiveFocusTopics(targetTopics);
    setSubMode('adaptive');
    setLatestAdaptiveAttempt(null);
    setAdaptiveSelected({});
    setAdaptiveQuestionIdx(0);
    setIsGeneratingAdaptive(true);

    try {
      const res = await aiStudyClient.generateQuiz({
        documentId: activeDocument.id,
        title: activeDocument.title,
        pages: activeDocument.pages,
        topics: activeDocument.topics,
        mode: 'adaptive',
        focusTopics: targetTopics,
        questionCount: 5,
      });
      setAdaptiveQuestions(res.questions);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Failed to generate adaptive questions.');
    } finally {
      setIsGeneratingAdaptive(false);
    }
  };

  const handleSubmitAdaptivePractice = () => {
    if (adaptiveQuestions.length === 0) return;

    const gradedAdaptive = gradeQuizSubmission({
      attemptId: `att-adapt-${Date.now()}`,
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
      mode: 'adaptive',
      targetTopics: adaptiveFocusTopics,
      questions: adaptiveQuestions,
      selectedIndices: adaptiveSelected,
    });

    studyStorage.saveQuizAttempt(gradedAdaptive);
    setLatestAdaptiveAttempt(gradedAdaptive);
    setAllDocAttempts(studyStorage.getQuizAttempts(activeDocument.id));
    onAttemptSaved();

    const updatedPlan = updateRevisionPlanWithAttempt(revisionPlan, gradedAdaptive);
    setRevisionPlan(updatedPlan);
    studyStorage.saveRevisionPlan(activeDocument.id, updatedPlan);
  };

  const activeDiagnosticQuestion = quizQuestions[currentQuestionIdx];
  const answeredDiagnosticCount = Object.keys(selectedAnswers).length;

  const activeAdaptiveQuestion = adaptiveQuestions[adaptiveQuestionIdx];
  const answeredAdaptiveCount = Object.keys(adaptiveSelected).length;

  const nextRecommendedTask =
    revisionPlan.find((t) => !t.completed && t.priority === 'high') ||
    revisionPlan.find((t) => !t.completed) ||
    null;

  const docProgressSummary = computeOverallProgressSummary(allDocAttempts);
  const topicComparisons = computeTopicProgress(allDocAttempts);
  const studiedPct = Math.round(
    (Math.max(visitedPages.length, currentPage) / Math.max(1, activeDocument.pageCount)) * 100
  );

  const isDiagnosticQuizActive =
    subMode === 'quiz' &&
    Boolean(activeDiagnosticQuestion) &&
    !latestDiagnosticAttempt &&
    !isGeneratingQuiz;

  const isAdaptiveQuizActive =
    subMode === 'adaptive' &&
    Boolean(activeAdaptiveQuestion) &&
    !latestAdaptiveAttempt &&
    !isGeneratingAdaptive;

  const isPracticeGroup =
    subMode === 'quiz' ||
    subMode === 'mistakes' ||
    subMode === 'revision' ||
    subMode === 'adaptive';

  const subModeTitleMap: Record<StudySubMode, string> = {
    explain: 'AI Study Tutor',
    'quick-revise': 'Quick Revise',
    quiz: 'Diagnostic Quiz',
    mistakes: 'Mistake DNA',
    revision: 'Revision Plan',
    adaptive: 'Adaptive Practice',
    explore: 'Explore Further',
  };

  const totalReaderPages = Math.max(1, activeDocument.pageCount || activeDocument.pages.length || 1);

  return (
    <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-6">
      {/* =====================================================================
          EDITORIAL HEADER FOR STUDY SPACE (Images 3 & 4) OR AI TUTOR (Image 7)
         ===================================================================== */}
      {presentationMode === 'study-space' ? (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
          <div className="space-y-1.5">
            <div className="lm-kicker">
              {documentSubject || 'Study'} &nbsp;/&nbsp; {cleanDocTitle}
            </div>
            <h1 className="lm-editorial-title text-3xl sm:text-4xl">{cleanDocTitle}</h1>
            <p className="lm-editorial-subtitle text-base sm:text-lg text-body">
              Read your notes page by page. Select any line to ask the AI tutor about it.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start md:self-end">
            <div className="flex items-center gap-3">
              <span className="font-serif-editorial text-4xl sm:text-5xl font-bold text-brand leading-none tabular-nums">
                {String(currentPage).padStart(2, '0')}
              </span>
              <div className="h-9 w-[1.5px] bg-line-strong" />
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted max-w-[160px] leading-snug line-clamp-2">
                {activePageLabel}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
          <div className="space-y-1.5">
            <div className="lm-kicker">AI TUTOR</div>
            <h1 className="lm-editorial-title text-4xl sm:text-5xl">
              Ask, understand, move forward.
            </h1>
            <p className="lm-editorial-subtitle text-base sm:text-lg text-body">
              Get clear, step-by-step explanations, examples, and practice, tailored to your study material.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-end">
            <button
              type="button"
              onClick={() => setVoiceModalOpen(true)}
              data-testid="open-voice-tutor-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-brand" />
              <span>Live Voice Tutor</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          IMAGES 3 & 4: EDITORIAL STUDY SPACE (2-COLUMN TEXTBOOK + ON THIS PAGE AI)
         ===================================================================== */}
      {presentationMode === 'study-space' && subMode === 'explain' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Textbook / PDF Reader with Annotation Toolbar */}
          <div className="lg:col-span-8 lm-card-editorial overflow-hidden">
            {/* Reader Top Toolbar matching Images 3 & 4 */}
            <div className="px-4 py-3 bg-canvas border-b border-line flex flex-wrap items-center justify-between gap-3">
              {/* Document Selector + Page Switcher + Zoom */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-line text-xs font-medium text-ink">
                  <FileText className="w-3.5 h-3.5 text-brand" />
                  <select
                    aria-label="Select Study Document"
                    value={activeDocument.id}
                    onChange={(e) => {
                      const found = documents.find((d) => d.id === e.target.value);
                      if (found) onSelectDocument(found);
                    }}
                    className="bg-transparent font-semibold text-ink focus:outline-none cursor-pointer max-w-[180px] truncate"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Page `< 2 / 4 >` */}
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-line text-xs font-medium text-ink tabular-nums">
                  <button
                    type="button"
                    onClick={() => selectPage(Math.max(1, currentPage - 1))}
                    className="p-1 rounded hover:bg-brand-soft text-muted hover:text-ink cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5">
                    {currentPage} / {totalReaderPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectPage(Math.min(totalReaderPages, currentPage + 1))}
                    className="p-1 rounded hover:bg-brand-soft text-muted hover:text-ink cursor-pointer"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Zoom `- 125% +` */}
                <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-line text-xs font-medium text-muted tabular-nums">
                  <button
                    type="button"
                    onClick={() => setReaderZoomPct((z) => Math.max(90, z - 10))}
                    className="px-1.5 hover:text-ink cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-ink font-semibold">{readerZoomPct}%</span>
                  <button
                    type="button"
                    onClick={() => setReaderZoomPct((z) => Math.min(160, z + 10))}
                    className="px-1.5 hover:text-ink cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {onOpenPdfWorkspace && (
                <button
                  type="button"
                  onClick={onOpenPdfWorkspace}
                  className="px-3 py-1.5 rounded-lg bg-white border border-line hover:border-brand text-xs font-semibold text-brand cursor-pointer"
                  title="Highlight, draw and add notes on the original PDF"
                >
                  Annotate PDF
                </button>
              )}
            </div>

            {/* The student's own page, with select-to-ask */}
            <div className="p-6 sm:p-10 bg-white space-y-5" onMouseUp={handleReaderSelection}>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                  {formatSourceReferenceLabel(activeDocument, currentPage)}
                </div>
                <h2 className="font-serif-editorial text-2xl font-bold text-ink">
                  {activePageObj?.title || `Page ${currentPage}`}
                </h2>
              </div>

              {activePageObj?.content?.trim() ? (
                <div
                  className="space-y-3 text-ink leading-relaxed"
                  style={{ fontSize: `${(15 * readerZoomPct) / 100}px` }}
                >
                  {activePageObj.content
                    .split(/\n{2,}/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, idx) => {
                      const isHighlighted =
                        highlightKey.length > 0 &&
                        para.replace(/\s+/g, ' ').toLowerCase().includes(highlightKey);
                      return (
                        <p
                          key={idx}
                          className={`whitespace-pre-line rounded-lg transition-colors ${
                            isHighlighted ? 'bg-[#FEF9C3] ring-1 ring-amber-300 px-2 py-1 -mx-2' : ''
                          }`}
                        >
                          {para}
                        </p>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No text was found on this page. If it is a scanned page, open it with Annotate PDF,
                  or photograph it with Scan notes.
                </p>
              )}
            </div>
          </div>

          {/* Right 4 Columns: "On this page" Contextual AI Explanation Panel matching Images 3 & 4 */}
          <aside className="lg:col-span-4 lm-card-editorial p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-soft pb-3">
              <h2 className="font-serif-editorial text-lg font-bold text-ink">
                On this page
              </h2>
              <span className="text-[11px] font-medium text-muted">
                Page {currentPage} of {totalReaderPages}
              </span>
            </div>

            {/* Text the student selected on the page */}
            {highlightedQuote ? (
              <div className="p-3.5 rounded-xl bg-canvas border border-line border-l-4 border-l-brand space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-brand">Highlighted text</span>
                  <button
                    type="button"
                    onClick={() => setHighlightedQuote(null)}
                    className="text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs italic text-body leading-relaxed line-clamp-4">
                  &ldquo;{highlightedQuote}&rdquo;
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={isAskingTutor}
                    onClick={() =>
                      void handleAskTutor(
                        `Explain this line from page ${currentPage} of my notes step by step: "${highlightedQuote}"`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg lm-btn-accent text-[11px] cursor-pointer"
                  >
                    Explain this
                  </button>
                  <button
                    type="button"
                    disabled={isAskingTutor}
                    onClick={() =>
                      void handleAskTutor(
                        `Give me one JEE Main style question that tests this idea from page ${currentPage}, then solve it step by step: "${highlightedQuote}"`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg border border-line bg-white hover:border-brand text-[11px] font-semibold text-ink cursor-pointer disabled:opacity-50"
                  >
                    JEE-style question
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-dashed border-line-strong text-xs text-muted leading-relaxed">
                Tip: select any line on the page to ask the tutor about it.
              </div>
            )}

            {/* The tutor's latest answer, or quick actions for this page */}
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI tutor</span>
              </div>

              {isAskingTutor ? (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Working it out step by step…
                </div>
              ) : latestTutorAnswer ? (
                <div className="text-[13px] text-ink max-h-[380px] overflow-y-auto pr-1">
                  <MathText text={latestTutorAnswer.content} className="lm-prose-compact" />
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {[
                    {
                      label: 'Explain this page simply',
                      prompt: `Explain page ${currentPage} (${activePageLabel}) of my notes simply, step by step.`,
                    },
                    {
                      label: 'Key formulas on this page',
                      prompt: `List the key formulas and definitions on page ${currentPage}, and when to use each one in JEE problems.`,
                    },
                    {
                      label: 'A JEE-style question from this page',
                      prompt: `Give me one JEE Main style question based on page ${currentPage}, then the full step-by-step solution.`,
                    },
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => void handleAskTutor(action.prompt)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-line hover:border-brand text-left text-xs font-semibold text-ink transition-colors cursor-pointer"
                    >
                      {action.label}
                      <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {tutorError && !isAskingTutor && (
                <p className="text-xs text-danger leading-relaxed">{tutorError}</p>
              )}

              <div className="pt-2 border-t border-soft flex items-center justify-between text-[11px]">
                <span className="text-muted">Page {currentPage}</span>
                {latestTutorAnswer && !isAskingTutor && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleAskTutor(
                        `Explain that again more simply, with a different example from page ${currentPage}.`
                      )
                    }
                    className="font-semibold text-brand hover:underline cursor-pointer"
                  >
                    Explain differently →
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Input: Ask a question about this page... */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!pageQuestionInput.trim()) return;
                void handleAskTutor(pageQuestionInput.trim());
                setPageQuestionInput('');
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={pageQuestionInput}
                onChange={(e) => setPageQuestionInput(e.target.value)}
                placeholder="Ask a question about this page..."
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-line bg-canvas text-xs text-ink placeholder:text-[#9CA3AF] focus:outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={isAskingTutor || !pageQuestionInput.trim()}
                className="w-9 h-9 rounded-lg lm-btn-accent flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                aria-label="Ask about this page"
              >
                {isAskingTutor ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </form>
          </aside>
        </div>
      )}

      {/* =====================================================================
          STUDY SPACE HEADER & CONTROLS (Shown in Quiz/Mistake/Revision subModes)
         ===================================================================== */}
      <div
        data-testid="study-space-control-bar"
        className={`${
          subMode === 'explain' ? 'hidden' : 'block'
        } bg-white rounded-2xl border border-line px-5 py-3.5 sm:px-6 space-y-3 lm-no-print`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Active Material Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                activeDocument.sourceType === 'youtube'
                  ? 'bg-[#FCE8E6] text-danger'
                  : 'bg-brand-soft text-brand'
              }`}
            >
              {activeDocument.sourceType === 'youtube' ? (
                <Youtube className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <label htmlFor="active-doc-select" className="sr-only">
                Select Active Study Document
              </label>
              <select
                ref={docSelectRef}
                id="active-doc-select"
                value={activeDocument.id}
                onChange={(e) => {
                  const found = documents.find((d) => d.id === e.target.value);
                  if (found) onSelectDocument(found);
                }}
                className="text-base font-bold text-ink bg-canvas hover:bg-slate-100/80 border border-slate-200/90 rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand cursor-pointer truncate max-w-[230px] sm:max-w-[300px]"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:inline" />
              <span className="text-xs sm:text-sm font-semibold text-[#475569] px-2.5 py-1 rounded-lg bg-slate-100/80 whitespace-nowrap">
                {subModeTitleMap[subMode]}
              </span>
              {isCloudSynced && (
                <span
                  title="Synced with your account"
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success-soft text-success text-xs font-semibold"
                >
                  <CloudCheck className="w-3.5 h-3.5" />
                  <span>Synced</span>
                </span>
              )}
            </div>
          </div>

          {/* Primary Study Workspace Mode Switcher — Generous spacing & uniform h-10 height */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="tablist"
              aria-label="Study Workspace Sections"
              className="flex flex-wrap items-center gap-2"
            >
              {/* 1. AI Tutor */}
              <button
                type="button"
                role="tab"
                aria-selected={subMode === 'explain'}
                onClick={() => setSubMode('explain')}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  subMode === 'explain'
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-canvas border border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>AI Tutor</span>
              </button>

              {/* 2. Quick Revise & Notes */}
              <button
                type="button"
                role="tab"
                aria-selected={subMode === 'quick-revise'}
                onClick={() => setSubMode('quick-revise')}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  subMode === 'quick-revise'
                    ? 'bg-success text-white shadow-xs'
                    : 'bg-canvas border border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <StickyNote className="w-4 h-4" />
                <span>Quick Revise &amp; PDF Notes</span>
              </button>

              {/* 3. Practice & Diagnosis */}
              <button
                type="button"
                role="tab"
                aria-selected={isPracticeGroup}
                onClick={() => {
                  if (!isPracticeGroup) {
                    setSubMode('quiz');
                    if (quizQuestions.length === 0 && !isGeneratingQuiz) {
                      void handleGenerateDiagnosticQuiz(false);
                    }
                  }
                }}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isPracticeGroup
                    ? 'bg-danger text-white shadow-xs'
                    : 'bg-canvas border border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Practice &amp; Quiz</span>
              </button>

              {/* 4. Video Lectures */}
              <button
                type="button"
                role="tab"
                aria-selected={subMode === 'explore'}
                onClick={() => setSubMode('explore')}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  subMode === 'explore'
                    ? 'bg-warning text-white shadow-xs'
                    : 'bg-canvas border border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Video Lectures</span>
              </button>

              {/* Secondary Utility: Reader Panel Toggle */}
              <button
                type="button"
                onClick={() => setShowDocPreview((prev) => !prev)}
                className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 ${
                  showDocPreview
                    ? 'bg-brand-soft/70 border-brand/30 text-brand'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-ink hover:bg-slate-50'
                }`}
                title={
                  showDocPreview
                    ? 'Hide source panel for wider workspace'
                    : 'Show source reader panel'
                }
              >
                {showDocPreview ? (
                  <>
                    <PanelLeftClose className="w-4 h-4" />
                    <span>Reader Panel</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-4 h-4" />
                    <span>Show Reader</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Bar for Practice & Revision Tools — Generous spacing */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSubMode('quiz');
                if (quizQuestions.length === 0 && !isGeneratingQuiz) {
                  void handleGenerateDiagnosticQuiz(false);
                }
              }}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subMode === 'quiz'
                  ? 'bg-[#FCE8E6] text-[#C5221F] border border-red-200'
                  : 'bg-slate-50 text-muted hover:text-ink hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Diagnostic Quiz</span>
            </button>

            <button
              type="button"
              onClick={() => setSubMode('mistakes')}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subMode === 'mistakes'
                  ? 'bg-warning-soft text-[#B45309] border border-amber-200'
                  : 'bg-slate-50 text-muted hover:text-ink hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>
                Mistake DNA{mistakes.length > 0 ? ` (${mistakes.length})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubMode('revision')}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subMode === 'revision'
                  ? 'bg-success-soft text-success border border-emerald-200'
                  : 'bg-slate-50 text-muted hover:text-ink hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>
                Revision Plan
                {revisionPlan.length > 0
                  ? ` (${revisionPlan.filter((t) => !t.completed).length})`
                  : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubMode('adaptive')}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                subMode === 'adaptive'
                  ? 'bg-brand-soft text-brand border border-blue-200'
                  : 'bg-slate-50 text-muted hover:text-ink hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Adaptive Practice</span>
            </button>
          </div>

          {onOpenPdfWorkspace && (
            <button
              type="button"
              onClick={onOpenPdfWorkspace}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-brand-soft hover:bg-brand-200 text-brand text-xs font-bold transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Annotate in PDF Workspace →</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          INNER LEARNING DASHBOARD WORKSPACE (matching Image 2)
          Left Col: Current Study Material + Reader (PDF / Text / YouTube Player)
          Center Col: Active Study Tool (AI Tutor / Quick Revise / Practice / Explore)
          Right Col: Quick Explanation, Weak Topics / Mistake DNA, Revision Plan (hidden in Focus Mode)
         ===================================================================== */}
      <div
        className={`${
          presentationMode === 'study-space' && subMode === 'explain' ? 'hidden' : 'grid'
        } grid-cols-1 lg:grid-cols-12 gap-5 items-start`}
      >
        {/* LEFT COLUMN (3 cols on xl, 4 cols on lg when shown) */}
        {showDocPreview && (
          <div className="lg:col-span-4 xl:col-span-3 space-y-5 lm-no-print">
            {/* Editorial Study Context & Focus Topic Card matching Image 7 */}
            <section
              aria-label="Study Context"
              className="lm-card-editorial p-5 space-y-4"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Study Context
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink truncate">
                    {activeDocument.title.endsWith('.pdf')
                      ? activeDocument.title
                      : `${activeDocument.title}.pdf`}
                  </div>
                  <div className="text-[11px] text-muted">
                    {activeDocument.pageCount} pages · {activeDocument.topics.length} topics
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Focus Topic
                </div>
                <div className="space-y-1">
                  {activeDocument.topics.length === 0 && (
                    <p className="px-1 text-xs text-muted">
                      Topics from your material appear here once it has been analysed.
                    </p>
                  )}
                  {activeDocument.topics.slice(0, 6).map((topic) => {
                    const item = { label: topic.name, page: topic.sourcePages[0] || 1 };
                    const isSelected = activePageTopic?.id === topic.id;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => selectPage(item.page)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-brand-soft/70 text-brand font-semibold'
                            : 'text-body hover:bg-canvas'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-brand' : 'border-[#CBD5E1]'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#home';
                }}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-[#CBD5E1] hover:border-brand text-xs font-medium text-muted hover:text-brand transition-colors cursor-pointer"
              >
                + Upload Material
              </button>
            </section>

            {/* 1. Current Study Material + Page/Timestamp-Indexed Reader Card */}
            <section
              aria-label="Study Material Reader"
              className="bg-white rounded-2xl border border-line overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-ink">
                    Current Study Material
                  </h2>
                  <span className="text-[11px] font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full tabular-nums">
                    {studiedPct}% {activeDocument.sourceType === 'youtube' ? 'Covered' : 'Read'}
                  </span>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-canvas border border-line">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                      activeDocument.sourceType === 'youtube'
                        ? 'bg-brand-soft text-brand'
                        : activeDocument.sourceType === 'pdf'
                        ? 'bg-brand-soft text-brand'
                        : 'bg-brand-soft text-brand'
                    }`}
                  >
                    {activeDocument.sourceType === 'youtube'
                      ? 'YT'
                      : activeDocument.sourceType === 'pdf'
                      ? 'PDF'
                      : 'TXT'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink truncate">
                      {activeDocument.title}
                    </p>
                    <p className="text-xs text-muted tabular-nums">
                      {activeDocument.sourceType === 'youtube'
                        ? `Section ${currentPage} of ${activeDocument.pageCount} (${
                            activePageObj?.timestampLabel || '00:00'
                          })`
                        : `Page ${currentPage} of ${activeDocument.pageCount}`}{' '}
                      • {activeDocument.topics.length} Topics
                    </p>
                  </div>
                </div>

                {/* Embedded YouTube Player when activeDocument is a YouTube Lecture */}
                {activeDocument.sourceType === 'youtube' && activeDocument.videoId && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video">
                    <iframe
                      title={activeDocument.title}
                      src={`https://www.youtube.com/embed/${activeDocument.videoId}?start=${
                        activePageObj?.timestampSeconds || 0
                      }&rel=0`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand to-success transition-all duration-300"
                    style={{ width: `${Math.max(15, studiedPct)}%` }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {activeDocument.pdfDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setViewPdfCanvas((prev) => !prev)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-brand-soft hover:bg-brand-200 text-brand text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {viewPdfCanvas ? 'Text View' : 'PDF View'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        selectPage((currentPage % activeDocument.pageCount) + 1)
                      }
                      className="flex-1 py-1.5 px-3 rounded-xl bg-brand-soft hover:bg-brand-200 text-brand text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {activeDocument.sourceType === 'youtube'
                        ? 'Next Timestamp →'
                        : 'Next Page →'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => docSelectRef.current?.focus()}
                    className="py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Page / Timestamp Navigation Controls */}
              <div className="px-4 py-2.5 bg-canvas border-b border-slate-200/70 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                  {formatSourceReferenceLabel(activeDocument, currentPage)}
                </span>

                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      selectPage(currentPage - 1);
                      setHighlightedQuote(null);
                    }}
                    aria-label="Previous Page"
                    className="p-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {activeDocument.pages.map((p) => (
                    <button
                      key={p.pageNumber}
                      type="button"
                      onClick={() => {
                        selectPage(p.pageNumber);
                        setHighlightedQuote(null);
                      }}
                      aria-label={
                        activeDocument.sourceType === 'youtube' && p.timestampLabel
                          ? `Jump to ${p.timestampLabel}`
                          : `Go to Page ${p.pageNumber}`
                      }
                      className={`px-1.5 h-6 rounded-md text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        currentPage === p.pageNumber
                          ? 'bg-brand text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {activeDocument.sourceType === 'youtube' && p.timestampLabel
                        ? p.timestampLabel
                        : p.pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage >= activeDocument.pageCount}
                    onClick={() => {
                      selectPage(currentPage + 1);
                      setHighlightedQuote(null);
                    }}
                    aria-label="Next Page"
                    className="p-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Highlighted Citation Banner when navigated from a reference */}
              {highlightedQuote && (
                <div className="px-4 py-2.5 bg-warning-soft border-b border-amber-200/70 flex items-start justify-between gap-2">
                  <div className="text-xs text-amber-950 leading-snug">
                    <span className="font-semibold">
                      {formatSourceReferenceLabel(activeDocument, currentPage)}:{' '}
                    </span>
                    <span className="italic">&ldquo;{highlightedQuote}&rdquo;</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHighlightedQuote(null)}
                    className="text-[11px] font-medium text-amber-800 hover:underline shrink-0 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Page / Timestamp Content Body */}
              <div className="p-4 max-h-[300px] overflow-y-auto space-y-2.5">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-semibold text-brand inline-flex items-center gap-1">
                    {activeDocument.sourceType === 'youtube' && (
                      <Clock className="w-3 h-3" />
                    )}
                    <span>
                      Source{' '}
                      {formatSourceReferenceLabel(
                        activeDocument,
                        activePageObj?.pageNumber || 1
                      )}
                    </span>
                  </span>
                  <h3 className="text-sm font-semibold text-ink mt-0.5">
                    {activePageObj?.title || `Page ${activePageObj?.pageNumber}`}
                  </h3>
                </div>

                {viewPdfCanvas && activeDocument.pdfDataUrl ? (
                  <div className="flex justify-center bg-slate-100 p-2 rounded-xl overflow-x-auto">
                    <canvas
                      ref={pdfCanvasRef}
                      className="max-w-full rounded shadow-2xs bg-white"
                    />
                  </div>
                ) : (
                  <div className="text-[14px] text-slate-700 leading-[1.6] whitespace-pre-wrap font-normal space-y-2.5">
                    {activePageObj?.content.split('\n\n').map((para, idx) => {
                      const isHighlighted =
                        highlightedQuote &&
                        para
                          .toLowerCase()
                          .includes(highlightedQuote.slice(0, 28).toLowerCase());
                      return (
                        <p
                          key={idx}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isHighlighted
                              ? 'bg-[#FEF3C7] text-ink font-medium ring-1 ring-amber-300'
                              : ''
                          }`}
                        >
                          {para}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* 2. Live Diagnostic Quiz Card (Clean NotebookLM-inspired surface) */}
            {subMode === 'explain' && (
              <section
                aria-label="Quick Diagnostic Quiz"
                className="bg-gradient-to-b from-white to-brand-soft rounded-3xl border border-slate-200/90 shadow-2xs p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-ink">Quick Diagnostic Check</h2>
                    <p className="text-xs text-muted mt-0.5">
                      Test recall on {activeDocument.title}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full tabular-nums">
                    {quizQuestions.length > 0
                      ? `Q${currentQuestionIdx + 1}/${quizQuestions.length}`
                      : '6 MCQs'}
                  </span>
                </div>

                {activeDiagnosticQuestion ? (
                  <div className="space-y-2.5">
                    <div className="text-xs font-medium text-ink leading-snug line-clamp-3">
                      <MathText text={activeDiagnosticQuestion.question} variant="inline" />
                    </div>
                    <div className="space-y-1.5">
                      {activeDiagnosticQuestion.options.map((opt, idx) => {
                        const isSelected =
                          selectedAnswers[activeDiagnosticQuestion.id] === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setSelectedAnswers((prev) => ({
                                ...prev,
                                [activeDiagnosticQuestion.id]: idx,
                              }))
                            }
                            className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-brand-soft border-brand text-ink font-semibold'
                                : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-brand text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {['A', 'B', 'C', 'D'][idx]}
                            </span>
                            <span className="truncate">
                              <MathText text={opt} variant="inline" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted leading-relaxed">
                    Generate a source-grounded 6-question diagnostic quiz to pinpoint weak concepts.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSubMode('quiz');
                    if (quizQuestions.length === 0 && !isGeneratingQuiz) {
                      void handleGenerateDiagnosticQuiz(false);
                    }
                  }}
                  className="w-full h-10 px-4 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Start Diagnostic Quiz</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </section>
            )}
          </div>
        )}

        {/* CENTER COLUMN: Primary AI Study Tutor & Focused Mode Views */}
        <section
          aria-label="Interactive Study Companion"
          className={`${
            !showDocPreview
              ? 'lg:col-span-12 max-w-[960px] mx-auto w-full'
              : subMode === 'explain'
              ? 'lg:col-span-8 xl:col-span-6'
              : 'lg:col-span-8 xl:col-span-9'
          } bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col min-h-[640px]`}
        >
          {/* MODE 1: AI STUDY TUTOR (Primary Focus, Context-Aware Chat) */}
          {subMode === 'explain' && (
            <div className="flex flex-col flex-1 h-full bg-white">
              {/* Tutor Header with Model Choice & Topic Drawer */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand via-success to-warning p-0.5">
                    <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center text-brand">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink">
                      AI Study Tutor
                    </h2>
                    <p className="text-xs text-muted">
                      Ask anything about your material
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Strict Source-Control Mode Toggle: Material Only | Extended Knowledge */}
                  <div
                    role="group"
                    aria-label="Tutor Source Control Mode"
                    className="inline-flex items-center p-0.5 rounded-full bg-canvas border border-slate-200/90"
                  >
                    <button
                      type="button"
                      data-testid="source-mode-material-only"
                      onClick={() => handleToggleSourceControl('material_only')}
                      title="Strict Material Only: Tutor answers strictly from your uploaded study material"
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        sourceControlMode === 'material_only'
                          ? 'bg-brand text-white shadow-2xs'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      Material Only
                    </button>
                    <button
                      type="button"
                      data-testid="source-mode-extended"
                      onClick={() => handleToggleSourceControl('extended_knowledge')}
                      title="Extended Knowledge: Allows supplemental examples and outside context"
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        sourceControlMode === 'extended_knowledge'
                          ? 'bg-success text-white shadow-2xs'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      Extended Knowledge
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTeachItBack((prev) => !prev);
                      if (!teachTopic && activeDocument.topics[0]) {
                        setTeachTopic(activeDocument.topics[0].name);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                      showTeachItBack
                        ? 'bg-warning-soft border-warning text-warning'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Teach It Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOverviewDrawer((prev) => !prev)}
                    aria-expanded={showOverviewDrawer}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span>Topics ({activeDocument.topics.length})</span>
                    {showOverviewDrawer ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubMode('quiz');
                      if (quizQuestions.length === 0) void handleGenerateDiagnosticQuiz(false);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-soft hover:bg-brand-200 text-brand text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                  >
                    <span>Take Quiz</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Teach It Back (Feynman Active-Recall Drawer) */}
              {showTeachItBack && (
                <div className="px-5 py-4 bg-warning-soft border-b border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-ink">
                        Teach It Back: Feynman Active Recall
                      </h3>
                      <p className="text-xs text-muted">
                        Explain a concept in your own words. LearnMate evaluates what you got right and what you missed from your material.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTeachItBack(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <form onSubmit={handleEvaluateTeachItBack} className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Concept:
                      </label>
                      <select
                        value={teachTopic}
                        onChange={(e) => setTeachTopic(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-ink"
                      >
                        {activeDocument.topics.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      value={teachExplanation}
                      onChange={(e) => setTeachExplanation(e.target.value)}
                      placeholder="Explain this concept in your own words as if teaching a classmate..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-200 text-xs text-ink focus:outline-none focus:border-warning"
                    />
                    <div className="flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={isEvaluatingTeach || !teachExplanation.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-warning hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        {isEvaluatingTeach ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Evaluating...</span>
                          </>
                        ) : (
                          <span>Evaluate My Explanation</span>
                        )}
                      </button>
                    </div>
                  </form>

                  {teachResult && (
                    <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">
                          Mastery Score: {teachResult.scorePct}% ({teachResult.verdict.replace('_', ' ')})
                        </span>
                      </div>
                      {teachResult.strengths.length > 0 && (
                        <div>
                          <span className="font-semibold text-emerald-700">What you nailed: </span>
                          <span className="text-slate-700">
                            {teachResult.strengths.join(' • ')}
                          </span>
                        </div>
                      )}
                      {teachResult.missingConcepts.length > 0 && (
                        <div>
                          <span className="font-semibold text-amber-800">Key points to add: </span>
                          <span className="text-slate-700">
                            {teachResult.missingConcepts.join(' • ')}
                          </span>
                        </div>
                      )}
                      <p className="text-slate-600 italic">{teachResult.groundedFeedback}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Collapsible Material Overview & Topics Drawer */}
              {showOverviewDrawer && (
                <div className="px-5 py-3.5 bg-canvas border-b border-slate-200/70 space-y-2.5">
                  <p className="text-xs text-slate-600 max-w-[65ch] leading-relaxed">
                    {activeDocument.overview}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeDocument.topics.map((topic) => (
                      <div
                        key={topic.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-ink truncate">
                            {topic.name}
                          </h3>
                          <p className="text-[11px] text-muted">
                            Page {topic.sourcePages.join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOverviewDrawer(false);
                            void handleAskTutor(
                              `Explain ${topic.name} clearly with key formulas.`
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-brand-soft text-brand text-xs font-semibold hover:bg-brand-200 shrink-0 cursor-pointer"
                        >
                          Explain →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Horizontal Topic Filter Chips (matching Reference Image 3) */}
              <div className="px-5 py-2.5 border-b border-slate-100 bg-[#FBFCFF] flex items-center gap-2 overflow-x-auto no-scrollbar">
                {activeDocument.topics.map((topic, tIdx) => {
                  const isFirst = tIdx === 0;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() =>
                        void handleAskTutor(
                          `Explain ${topic.name} clearly with key definitions and formulas from my notes.`
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isFirst
                          ? 'bg-brand text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]'
                          : 'bg-white hover:bg-brand-soft text-[#475569] hover:text-brand border border-slate-200/80'
                      }`}
                    >
                      {topic.name}
                    </button>
                  );
                })}
              </div>

              {/* ChatGPT-like Reading & Conversation Stream */}
              <div
                ref={tutorScrollRef}
                className="px-5 sm:px-7 py-5 space-y-6 flex-1 overflow-y-auto max-h-[520px] bg-white"
              >
                {/* First-visit starter prompts */}
                {tutorMessages.length === 0 && (
                  <div className="py-2 space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-brand">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Tutor</span>
                      </div>
                      <h3 className="font-display text-xl font-bold text-ink">Ask your first doubt</h3>
                      <p className="text-sm text-body leading-relaxed max-w-[60ch]">
                        I explain step by step: the concept, the formula, a worked solution and the
                        final answer. Ask about {cleanDocTitle} or any JEE Main topic, in English or
                        Hinglish.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        activePageTopic
                          ? `Explain ${activePageTopic.name} step by step with an example.`
                          : `Explain the main idea of ${cleanDocTitle} step by step.`,
                        `What are the most important formulas in ${cleanDocTitle}, and when do I use each?`,
                        `Give me one JEE Main level question from ${cleanDocTitle} and solve it step by step.`,
                        `What mistakes do students usually make in ${activePageTopic?.name || cleanDocTitle}?`,
                        `${activePageTopic?.name || cleanDocTitle} ko simple Hinglish mein samjhao.`,
                        'Make me a quick 5-point revision summary of this chapter.',
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void handleAskTutor(prompt)}
                          className="p-3 rounded-xl bg-canvas hover:bg-brand-soft/50 border border-line hover:border-brand-200 text-left text-sm text-ink transition-colors cursor-pointer"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Thread */}
                {tutorMessages.length > 0 && (
                  <div className="space-y-6 pt-1">
                    {tutorMessages.map((msg) => {
                      const resolvedSourceType =
                        msg.sourceType || (msg.foundInMaterial ? 'material' : 'general');
                      const sourceLabel =
                        resolvedSourceType === 'both'
                          ? 'Both'
                          : resolvedSourceType === 'material'
                          ? 'From your material'
                          : 'General knowledge';
                      const sourceBadgeStyle =
                        resolvedSourceType === 'both'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                          : resolvedSourceType === 'material'
                          ? 'bg-brand-soft text-brand border-blue-200/80'
                          : 'bg-amber-50 text-amber-800 border-amber-200/80';

                      const isExpanded = !!expandedCitationsMap[msg.id];

                      if (msg.role === 'user') {
                        return (
                          <div key={msg.id} className="flex justify-end">
                            <div className="bg-brand-soft text-ink rounded-2xl px-4 py-3 max-w-[56ch]">
                              <span className="sr-only">You: </span>
                              <p className="text-[15px] font-medium leading-relaxed">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <article
                          key={msg.id}
                          className="bg-[#FBFCFF] rounded-2xl border border-slate-200/70 p-4 sm:p-5 space-y-3.5 max-w-[65ch]"
                        >
                          {/* Tutor Header & Compact Source Label */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-brand-soft text-brand flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                              <span className="text-xs font-bold text-ink">
                                LearnMate Tutor
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${sourceBadgeStyle}`}
                            >
                              {sourceLabel}
                            </span>
                          </div>

                          {/* Reading Prose */}
                          <MathText text={msg.content} />

                          {/* Compact Source Citations & Expandable Reference Details */}
                          {msg.citations.length > 0 && (
                            <div className="pt-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {msg.citations.map((cit, cIdx) => (
                                  <button
                                    key={cIdx}
                                    type="button"
                                    onClick={() =>
                                      navigateToCitation(cit.pageNumber, cit.quote)
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-brand-soft border border-slate-200/90 hover:border-brand text-xs font-semibold text-brand transition-colors cursor-pointer"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>
                                      Page {cit.pageNumber} · {cit.section}
                                    </span>
                                  </button>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => toggleCitationExpand(msg.id)}
                                  aria-expanded={isExpanded}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <span>
                                    {isExpanded
                                      ? 'Hide source quotes'
                                      : `View source quotes (${msg.citations.length})`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="space-y-2 pt-1">
                                  {msg.citations.map((cit, cIdx) => (
                                    <div
                                      key={cIdx}
                                      className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-600 space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-ink">
                                          Page {cit.pageNumber} : {cit.section}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            navigateToCitation(cit.pageNumber, cit.quote)
                                          }
                                          className="text-brand font-medium hover:underline cursor-pointer"
                                        >
                                          Jump to page →
                                        </button>
                                      </div>
                                      <p className="italic text-slate-600">
                                        &ldquo;{cit.quote}&rdquo;
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Compact "Simplify" and "Explain deeper" Follow-up Actions */}
                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={isAskingTutor}
                              onClick={() =>
                                void handleAskTutor(
                                  'Simplify your previous explanation in plain, easy-to-follow steps with a short everyday analogy.'
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-ink hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <span>Simplify</span>
                            </button>
                            <button
                              type="button"
                              disabled={isAskingTutor}
                              onClick={() =>
                                void handleAskTutor(
                                  'Explain this topic in greater depth with step-by-step derivation and a worked example.'
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-ink hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <span>Explain deeper</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {/* Functional Loading Skeleton */}
                {isAskingTutor && (
                  <div className="max-w-[65ch] space-y-3 py-3" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-brand" />
                      <span>Reading your study material and preparing explanation...</span>
                    </div>
                    <div className="space-y-2.5 animate-pulse">
                      <div className="h-4 bg-slate-100 rounded-md w-11/12" />
                      <div className="h-4 bg-slate-100 rounded-md w-full" />
                      <div className="h-4 bg-slate-100 rounded-md w-4/5" />
                    </div>
                  </div>
                )}

                {/* Friendly Error Message with Retry Action */}
                {tutorError && (
                  <div
                    role="alert"
                    className="max-w-[65ch] p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-4 text-sm text-red-700"
                  >
                    <span>{tutorError}</span>
                    {lastAskedQuestion && (
                      <button
                        type="button"
                        onClick={() => void handleAskTutor(lastAskedQuestion)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-100 shrink-0 cursor-pointer"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Rainbow-Framed Bottom Composer matching Reference Image 3 */}
              <div className="p-4 border-t border-slate-100 bg-white">
                <div className="lm-rainbow-frame p-3 bg-white shadow-[0_8px_28px_rgba(37,99,235,0.08)] space-y-2.5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleAskTutor();
                    }}
                    className="flex items-center gap-2"
                  >
                    <span className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      placeholder="Ask a question about your notes..."
                      aria-label="Ask AI Study Tutor a question"
                      className="flex-1 px-2 py-1.5 bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setVoiceModalOpen(true)}
                      title="Open Live Voice Tutor"
                      className="p-2 rounded-full text-slate-500 hover:text-brand hover:bg-brand-soft transition-colors cursor-pointer shrink-0"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={isAskingTutor || !questionInput.trim()}
                      aria-label="Send question to AI Tutor"
                      className="px-4 py-2 rounded-full bg-brand hover:bg-brand-strong text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer shrink-0 shadow-[0_4px_12px_rgba(26,115,232,0.28)]"
                    >
                      <span>Ask</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  {/* Quick Prompt Action Chips inside Rainbow Composer */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          void handleAskTutor(
                            `Deep Explain: Provide a thorough, step-by-step explanation of Page ${currentPage} (${activePageObj?.title}).`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-canvas hover:bg-brand-soft border border-slate-200/80 text-xs font-semibold text-body hover:text-brand transition-colors cursor-pointer"
                      >
                        <ListChecks className="w-3.5 h-3.5 text-brand" />
                        <span>Deep Explain</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleAskTutor(
                            `Give Example: Walk me through a concrete worked example for ${
                              activePageTopic?.name || activePageObj?.title
                            }.`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-canvas hover:bg-warning-soft border border-slate-200/80 text-xs font-semibold text-body hover:text-warning transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-warning" />
                        <span>Give Example</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleAskTutor(
                            `Simplify: Explain Page ${currentPage} (${activePageObj?.title}) in simple everyday language.`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-canvas hover:bg-success-soft border border-slate-200/80 text-xs font-semibold text-body hover:text-success transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-success" />
                        <span>Simplify</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleAskTutor(
                            `Practice Question: Ask me one exam-style practice question on ${
                              activePageTopic?.name || activePageObj?.title
                            } and explain the solution.`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-canvas hover:bg-[#F3E8FD] border border-slate-200/80 text-xs font-semibold text-body hover:text-[#9334E6] transition-colors cursor-pointer"
                      >
                        <Target className="w-3.5 h-3.5 text-[#9334E6]" />
                        <span>Practice Question</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: DIAGNOSTIC QUIZ (5-8 Grounded MCQs, One Question at a Time) */}
          {subMode === 'quiz' && (
            <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-ink">
                      Diagnostic Quiz
                    </h2>
                    <p className="text-sm text-muted">
                      Test your understanding and get instant feedback.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-soft border border-slate-200/80">
                    <span className="w-8 h-8 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink">Build your foundation</p>
                      <p className="text-[11px] text-muted">Find what to focus on next.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isGeneratingQuiz}
                    onClick={() => void handleGenerateDiagnosticQuiz(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGeneratingQuiz ? 'animate-spin' : ''}`} />
                    <span>New Quiz</span>
                  </button>
                </div>
              </div>

              {isGeneratingQuiz ? (
                <div className="py-16 max-w-xl mx-auto w-full space-y-4">
                  <div className="flex items-center justify-center gap-2.5 text-base font-medium text-slate-700">
                    <Loader2 className="w-5 h-5 animate-spin text-brand" />
                    <span>Generating grounded diagnostic questions from your material...</span>
                  </div>
                  <div className="space-y-3 animate-pulse pt-2">
                    <div className="h-6 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-12 bg-slate-100 rounded-xl w-full" />
                    <div className="h-12 bg-slate-100 rounded-xl w-full" />
                    <div className="h-12 bg-slate-100 rounded-xl w-full" />
                  </div>
                </div>
              ) : quizError ? (
                <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3 max-w-md mx-auto">
                  <p className="text-base font-medium text-red-700">{quizError}</p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateDiagnosticQuiz(true)}
                    className="px-5 py-2 rounded-full bg-danger text-white text-sm font-semibold cursor-pointer"
                  >
                    Retry Quiz Generation
                  </button>
                </div>
              ) : latestDiagnosticAttempt ? (
                /* Graded Quiz Results View */
                <div className="space-y-6 overflow-y-auto max-h-[520px] pr-1">
                  <div className="p-5 rounded-2xl bg-brand-soft border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-brand">
                        Diagnostic Results Graded
                      </span>
                      <h3 className="text-2xl font-bold text-ink tabular-nums">
                        {latestDiagnosticAttempt.score} / {latestDiagnosticAttempt.totalQuestions} Correct ({latestDiagnosticAttempt.percentage}%)
                      </h3>
                      <p className="text-sm text-slate-600">
                        {latestDiagnosticAttempt.weakTopics.length > 0
                          ? `Focus areas identified: ${latestDiagnosticAttempt.weakTopics.join(', ')}`
                          : 'Great job! You answered all topics accurately.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSubMode('mistakes')}
                        className="px-4 py-2 rounded-full bg-warning hover:bg-amber-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        View Mistake DNA →
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubMode('revision')}
                        className="px-4 py-2 rounded-full bg-success hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        Open Revision Plan →
                      </button>
                    </div>
                  </div>

                  {/* Per-Question Answer Key & Explanation Breakdown */}
                  <div className="space-y-3.5 max-w-[65ch]">
                    {latestDiagnosticAttempt.questions.map((q, idx) => {
                      const ans = latestDiagnosticAttempt.answers.find(
                        (a) => a.questionId === q.id
                      );
                      const isCorrect = ans?.isCorrect ?? false;
                      const userChoiceIdx = ans?.selectedIndex ?? -1;

                      return (
                        <div
                          key={q.id}
                          className={`p-5 rounded-2xl border ${
                            isCorrect
                              ? 'bg-emerald-50/30 border-emerald-200'
                              : 'bg-red-50/30 border-red-200'
                          } space-y-2.5`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-danger shrink-0" />
                              )}
                              <span className="text-xs font-semibold text-slate-700">
                                Question {idx + 1} · {q.topic}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigateToCitation(q.sourcePage, q.sourceQuote)}
                              className="text-xs font-semibold text-brand hover:underline shrink-0 cursor-pointer"
                            >
                              Verify on Page {q.sourcePage}
                            </button>
                          </div>

                          <MathText text={q.question} className="lm-quiz-question" />

                          <div className="text-sm space-y-1.5 pt-1">
                            <p
                              className={
                                isCorrect
                                  ? 'text-emerald-800 font-medium'
                                  : 'text-red-700 font-medium'
                              }
                            >
                              Your Answer:{' '}
                              {userChoiceIdx >= 0 ? (
                                <MathText text={q.options[userChoiceIdx]} variant="inline" />
                              ) : (
                                'Not answered'
                              )}
                            </p>
                            {!isCorrect && (
                              <p className="text-emerald-800 font-semibold">
                                Correct Answer:{' '}
                                <MathText text={q.options[q.correctIndex]} variant="inline" />
                              </p>
                            )}
                            <MathText text={q.explanation} className="text-slate-600 pt-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeDiagnosticQuestion ? (
                /* Active Single-Question-at-a-Time Quiz View matching Reference Image 5 */
                <div className="space-y-6 flex-1 flex flex-col justify-between max-w-[72ch]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span className="font-bold text-ink tabular-nums">
                        Question {currentQuestionIdx + 1} of {quizQuestions.length}
                      </span>
                      <span className="font-semibold text-muted tabular-nums">
                        {Math.round(((currentQuestionIdx + 1) / quizQuestions.length) * 100)}% complete
                      </span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-success transition-all duration-300"
                        style={{
                          width: `${
                            ((currentQuestionIdx + 1) / quizQuestions.length) * 100
                          }%`,
                        }}
                      />
                    </div>

                    <div className="p-5 sm:p-6 rounded-3xl bg-[#FBFCFF] border border-slate-200/80 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-brand-soft text-brand text-xs font-bold">
                          Multiple Choice
                        </span>
                        <span className="text-xs text-muted">
                          Topic: <strong className="text-ink">{activeDiagnosticQuestion.topic}</strong> · Page {activeDiagnosticQuestion.sourcePage}
                        </span>
                      </div>

                      <MathText
                        text={activeDiagnosticQuestion.question}
                        className="lm-quiz-question"
                      />

                      <div className="space-y-2.5 pt-1">
                        {activeDiagnosticQuestion.options.map((optionText, optIdx) => {
                          const isSelected =
                            selectedAnswers[activeDiagnosticQuestion.id] === optIdx;
                          const optionLabel = ['A', 'B', 'C', 'D'][optIdx];

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() =>
                                setSelectedAnswers((prev) => ({
                                  ...prev,
                                  [activeDiagnosticQuestion.id]: optIdx,
                                }))
                              }
                              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                                isSelected
                                  ? 'bg-brand-soft/90 border-brand text-ink shadow-[0_4px_14px_rgba(66,133,244,0.12)]'
                                  : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-brand bg-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                                )}
                              </span>
                              <span
                                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-brand-200 text-brand'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {optionLabel}
                              </span>
                              <span className="text-sm sm:text-base font-medium leading-relaxed">
                                <MathText text={optionText} variant="inline" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx((i) => Math.max(0, i - 1))}
                      className="px-5 py-2.5 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      ← Previous
                    </button>

                    <div className="flex items-center gap-3">
                      {currentQuestionIdx < quizQuestions.length - 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentQuestionIdx((i) =>
                              Math.min(quizQuestions.length - 1, i + 1)
                            )
                          }
                          className="px-3.5 py-2 rounded-full text-sm font-semibold text-brand hover:bg-brand-soft transition-colors cursor-pointer"
                        >
                          Skip
                        </button>
                      )}

                      {currentQuestionIdx < quizQuestions.length - 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentQuestionIdx((i) =>
                              Math.min(quizQuestions.length - 1, i + 1)
                            )
                          }
                          className="px-6 py-2.5 rounded-full bg-brand hover:bg-brand-strong text-white text-sm font-semibold shadow-[0_6px_16px_rgba(26,115,232,0.25)] cursor-pointer"
                        >
                          Next Question →
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSubmitDiagnosticQuiz()}
                          className="px-6 py-2.5 rounded-full bg-success hover:bg-emerald-700 text-white text-sm font-semibold shadow-2xs cursor-pointer"
                        >
                          Submit Quiz
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-3">
                  <p className="text-base text-slate-600">
                    Ready to test your knowledge on {activeDocument.title}?
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateDiagnosticQuiz(true)}
                    className="px-6 py-2.5 rounded-full bg-brand text-white text-[15px] font-semibold cursor-pointer"
                  >
                    Start Diagnostic Quiz
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODE 3: MISTAKE DNA */}
          {subMode === 'mistakes' && (
            <div className="p-6 sm:p-8 space-y-5 flex-1 overflow-y-auto max-h-[580px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
                    <Target className="w-5 h-5 text-warning" />
                    <span>Mistake DNA</span>
                  </h2>
                  <p className="text-sm text-muted">
                    Concise misconception diagnosis from your quiz answers, linked to source pages.
                  </p>
                </div>
                {mistakes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSubMode('revision')}
                    className="px-4 py-2 rounded-full bg-success text-white text-[14px] font-semibold cursor-pointer"
                  >
                    Go to Revision Plan →
                  </button>
                )}
              </div>

              {isDiagnosing ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-warning mx-auto" />
                  <p className="text-base font-medium text-slate-800">
                    Analyzing your incorrect answers and diagnosing misconceptions...
                  </p>
                </div>
              ) : !latestDiagnosticAttempt && mistakes.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-warning-soft text-warning flex items-center justify-center mx-auto">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-lg font-semibold text-ink">
                      No Quiz Mistakes Recorded Yet
                    </h3>
                    <p className="text-base text-muted leading-relaxed">
                      Complete a Diagnostic Quiz first so LearnMate can identify weak topics and explain the exact misconceptions behind any missed questions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubMode('quiz');
                      if (quizQuestions.length === 0) void handleGenerateDiagnosticQuiz(false);
                    }}
                    className="px-5 py-2.5 rounded-full bg-brand text-white text-[15px] font-semibold cursor-pointer"
                  >
                    Take Diagnostic Quiz
                  </button>
                </div>
              ) : mistakes.length === 0 ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2 max-w-lg mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
                  <h3 className="text-lg font-semibold text-emerald-950">
                    Zero Misconceptions Detected!
                  </h3>
                  <p className="text-base text-emerald-800">
                    You answered 100% of the diagnostic questions correctly.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-w-[65ch]">
                  {mistakes.map((item, idx) => (
                    <div
                      key={item.questionId || idx}
                      className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md">
                          Weak Topic: {item.topic}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigateToCitation(item.sourcePage, item.sourceQuote)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-canvas border border-slate-200 text-xs font-semibold text-brand hover:bg-blue-50 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Page {item.sourcePage}</span>
                        </button>
                      </div>

                      <MathText text={item.question} className="lm-quiz-question" />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                        <div className="p-3 rounded-xl bg-red-50/70 border border-red-200 text-red-900">
                          <span className="font-semibold block mb-0.5">Your Answer:</span>
                          <MathText text={item.selectedOption} variant="inline" />
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900">
                          <span className="font-semibold block mb-0.5">Correct Answer:</span>
                          <MathText text={item.correctOption} variant="inline" />
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 text-base leading-relaxed">
                        <p className="text-slate-700">
                          <strong className="font-semibold text-ink">
                            Why this happens:{' '}
                          </strong>
                          <MathText text={item.likelyMisconception} variant="inline" />
                        </p>
                        <p className="text-slate-700">
                          <strong className="font-semibold text-success">
                            Key takeaway:{' '}
                          </strong>
                          <MathText text={item.coreConceptFix} variant="inline" />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MODE 4: PERSONALIZED REVISION PLAN */}
          {subMode === 'revision' && (
            <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto max-h-[580px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-success" />
                    <span>Personalized Revision Plan</span>
                  </h2>
                  <p className="text-sm text-muted">
                    Short, actionable study tasks prioritized from your quiz performance.
                  </p>
                </div>
                {revisionPlan.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleStartAdaptivePractice()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink hover:bg-slate-800 text-white text-[14px] font-semibold cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Practice Weak Topics</span>
                  </button>
                )}
              </div>

              {revisionPlan.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-success-soft text-success flex items-center justify-center mx-auto">
                    <ListChecks className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-lg font-semibold text-ink">
                      Revision Plan Awaits Your Diagnostic Quiz
                    </h3>
                    <p className="text-base text-muted leading-relaxed">
                      Take a quick Diagnostic Quiz first. LearnMate will prioritize your study tasks with exact page references and recommended actions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubMode('quiz');
                      if (quizQuestions.length === 0) void handleGenerateDiagnosticQuiz(false);
                    }}
                    className="px-5 py-2.5 rounded-full bg-brand text-white text-[15px] font-semibold cursor-pointer"
                  >
                    Start Diagnostic Quiz
                  </button>
                </div>
              ) : (
                <div className="space-y-5 max-w-[65ch]">
                  {nextRecommendedTask && (
                    <div className="p-5 rounded-2xl bg-[#F3F7FE] border border-blue-200/80 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                          Next Recommended Learning Action
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          Page {nextRecommendedTask.sourcePage}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-ink">
                        {nextRecommendedTask.topic}
                      </h3>
                      <p className="text-base text-slate-700 leading-relaxed">
                        {nextRecommendedTask.recommendedAction}
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            navigateToCitation(
                              nextRecommendedTask.sourcePage,
                              nextRecommendedTask.conceptSummary
                            )
                          }
                          className="px-4 py-2 rounded-full bg-white border border-blue-200 text-brand text-sm font-semibold hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          Review Page {nextRecommendedTask.sourcePage}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleStartAdaptivePractice([nextRecommendedTask.topic])
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand hover:bg-brand-strong text-white text-sm font-semibold transition-colors cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Practice {nextRecommendedTask.topic}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {revisionPlan.map((task) => (
                      <div
                        key={task.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          task.completed
                            ? 'bg-slate-50 border-slate-200 opacity-75'
                            : 'bg-white border-slate-200/90 shadow-2xs'
                        } space-y-2.5`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleRevisionTask(task.id)}
                              className="mt-1 w-4 h-4 rounded text-success focus:ring-success"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3
                                  className={`text-base font-semibold ${
                                    task.completed
                                      ? 'line-through text-slate-500'
                                      : 'text-ink'
                                  }`}
                                >
                                  {task.topic}
                                </h3>
                                <span
                                  className={`text-xs font-medium ${
                                    task.priority === 'high'
                                      ? 'text-danger'
                                      : task.priority === 'medium'
                                      ? 'text-amber-600'
                                      : 'text-success'
                                  }`}
                                >
                                  · {task.priority} priority
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                {task.recommendedAction}
                              </p>
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={() =>
                              navigateToCitation(task.sourcePage, task.conceptSummary)
                            }
                            className="px-3 py-1 rounded-lg bg-canvas border border-slate-200 text-brand text-xs font-semibold hover:bg-brand-soft shrink-0 cursor-pointer"
                          >
                            Page {task.sourcePage}
                          </button>
                        </div>

                        <div className="pl-7 flex items-center gap-4 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleStartAdaptivePractice([task.topic])}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Practice topic →</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 5: ADAPTIVE PRACTICE */}
          {subMode === 'adaptive' && (
            <div className="p-6 sm:p-8 space-y-5 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
                    <Zap className="w-5 h-5 text-brand" />
                    <span>Adaptive Practice</span>
                  </h2>
                  <p className="text-sm text-muted">
                    Targeted questions focused on your weak topics. Automatically updates your Revision Plan & Progress.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeneratingAdaptive}
                  onClick={() => void handleStartAdaptivePractice()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ink hover:bg-slate-800 text-white text-[14px] font-semibold cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isGeneratingAdaptive ? 'animate-spin' : ''}`}
                  />
                  <span>Generate Adaptive Set</span>
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  Target Topics for Adaptive Drill:
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeDocument.topics.map((t) => {
                    const isFocused = adaptiveFocusTopics.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setAdaptiveFocusTopics((prev) =>
                            prev.includes(t.name)
                              ? prev.filter((item) => item !== t.name)
                              : [...prev, t.name]
                          );
                        }}
                        className={`text-sm px-3.5 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
                          isFocused
                            ? 'bg-ink text-white border-ink'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isGeneratingAdaptive ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-ink mx-auto" />
                  <p className="text-base font-medium text-slate-800">
                    Generating targeted practice questions for {adaptiveFocusTopics.join(', ')}...
                  </p>
                </div>
              ) : latestAdaptiveAttempt ? (
                <div className="space-y-5 overflow-y-auto max-h-[420px] max-w-[65ch]">
                  <div className="p-5 rounded-2xl bg-success-soft border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold uppercase text-emerald-700">
                        Adaptive Practice Completed & Revision Plan Updated
                      </span>
                      <h3 className="text-2xl font-bold text-ink tabular-nums mt-0.5">
                        {latestAdaptiveAttempt.score} / {latestAdaptiveAttempt.totalQuestions} (
                        {latestAdaptiveAttempt.percentage}%)
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {latestAdaptiveAttempt.strongTopics.length > 0
                          ? `Mastered in this round: ${latestAdaptiveAttempt.strongTopics.join(', ')}`
                          : 'Keep reviewing source pages for remaining weak topics.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSubMode('revision')}
                        className="px-4 py-2 rounded-full bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold cursor-pointer"
                      >
                        Check Updated Plan
                      </button>
                      <button
                        type="button"
                        onClick={onNavigateProgress}
                        className="px-4 py-2 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
                      >
                        View Progress →
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {latestAdaptiveAttempt.questions.map((q, idx) => {
                      const ans = latestAdaptiveAttempt.answers.find(
                        (a) => a.questionId === q.id
                      );
                      const isCorrect = ans?.isCorrect ?? false;
                      return (
                        <div
                          key={q.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink">
                              Q{idx + 1} · {q.topic} : {isCorrect ? 'Correct ✓' : 'Missed ✗'}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigateToCitation(q.sourcePage, q.sourceQuote)}
                              className="text-brand font-semibold hover:underline cursor-pointer text-xs"
                            >
                              Page {q.sourcePage}
                            </button>
                          </div>
                          <MathText text={q.question} className="lm-quiz-question" />
                          <p className="text-emerald-700 font-medium">
                            Correct: <MathText text={q.options[q.correctIndex]} variant="inline" />
                          </p>
                          <MathText text={q.explanation} className="text-slate-600" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeAdaptiveQuestion ? (
                <div className="space-y-5 flex-1 flex flex-col justify-between max-w-[65ch]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted">
                      <span className="font-semibold text-ink tabular-nums">
                        Adaptive Question {adaptiveQuestionIdx + 1} of{' '}
                        {adaptiveQuestions.length}
                      </span>
                      <span>
                        Focus:{' '}
                        <strong className="font-medium">
                          {activeAdaptiveQuestion.topic}
                        </strong>{' '}
                        (Page {activeAdaptiveQuestion.sourcePage})
                      </span>
                    </div>

                    <MathText
                      text={activeAdaptiveQuestion.question}
                      className="lm-quiz-question"
                    />

                    <div className="space-y-2.5">
                      {activeAdaptiveQuestion.options.map((opt, optIdx) => {
                        const isSelected =
                          adaptiveSelected[activeAdaptiveQuestion.id] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() =>
                              setAdaptiveSelected((prev) => ({
                                ...prev,
                                [activeAdaptiveQuestion.id]: optIdx,
                              }))
                            }
                            className={`w-full text-left p-4 rounded-xl border text-base transition-all flex items-center gap-3.5 cursor-pointer ${
                              isSelected
                                ? 'bg-ink text-white border-ink font-medium'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-xs font-semibold shrink-0">
                              {['A', 'B', 'C', 'D'][optIdx]}
                            </span>
                            <MathText text={opt} variant="inline" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={adaptiveQuestionIdx === 0}
                      onClick={() => setAdaptiveQuestionIdx((i) => Math.max(0, i - 1))}
                      className="px-4 py-2 rounded-full border border-slate-200 text-[14px] font-medium text-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      ← Previous
                    </button>

                    <span className="text-sm text-muted tabular-nums">
                      {answeredAdaptiveCount}/{adaptiveQuestions.length} answered
                    </span>

                    {adaptiveQuestionIdx < adaptiveQuestions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setAdaptiveQuestionIdx((i) =>
                            Math.min(adaptiveQuestions.length - 1, i + 1)
                          )
                        }
                        className="px-5 py-2.5 rounded-full bg-ink text-white text-[14px] font-semibold cursor-pointer"
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmitAdaptivePractice}
                        className="px-6 py-2.5 rounded-full bg-success hover:bg-emerald-700 text-white text-[14px] font-semibold cursor-pointer"
                      >
                        Submit Adaptive Practice
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center space-y-4">
                  <p className="text-base text-slate-600 max-w-md mx-auto">
                    Select one or more topics above and generate a targeted 5-question adaptive set.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleStartAdaptivePractice()}
                    className="px-6 py-2.5 rounded-full bg-brand text-white text-[15px] font-semibold cursor-pointer"
                  >
                    Launch Adaptive Practice
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODE 6: QUICK REVISE (Sticky Notes | Flashcards | Mind Map | One-Page Revision) */}
          {subMode === 'quick-revise' && (
            <QuickReviseView
              activeDocument={activeDocument}
              onNavigateToCitation={navigateToCitation}
            />
          )}

          {/* MODE 7: EXPLORE FURTHER (YouTube Learning Recommendations) */}
          {subMode === 'explore' && (
            <ExploreFurtherView
              activeDocument={activeDocument}
              weakTopics={currentWeakTopics}
            />
          )}
        </section>

        {/* RIGHT COLUMN: Image 7 Quick Explanation Card + Study Studio Tools */}
        {showDocPreview && subMode === 'explain' && (
          <div
            data-testid="study-space-tool-cards"
            className="lg:col-span-12 xl:col-span-3 space-y-5 lm-no-print"
          >
            {/* Card 2: One-Click Tutor Prompts (Clean white card, uniform buttons, no random color patches) */}
            <section
              aria-label="Quick Prompts"
              className="bg-white rounded-3xl border border-slate-200/90 p-5 space-y-3.5 shadow-2xs"
            >
              <div>
                <h2 className="text-sm font-bold text-ink">Ask About This Page</h2>
                <p className="text-xs text-muted mt-0.5">
                  Instant explanations grounded in Page {currentPage}.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    label: 'Explain this page simply',
                    desc: 'Step-by-step walkthrough',
                    prompt: `Explain Page ${currentPage} (${activePageObj?.title}) in simple, clear terms.`,
                  },
                  {
                    label: 'Summarize key takeaways',
                    desc: 'Bullet-point exam summary',
                    prompt: `What are the key takeaways and main formulas on Page ${currentPage}?`,
                  },
                  {
                    label: 'Show a worked example',
                    desc: 'Step-by-step solved problem',
                    prompt: `Show me a worked example from my notes for ${
                      activePageTopic?.name || activePageObj?.title
                    }.`,
                  },
                  {
                    label: 'Common exam pitfalls',
                    desc: 'Mistakes to avoid on this topic',
                    prompt: `What are the most common mistakes students make in ${
                      activePageTopic?.name || activePageObj?.title
                    } and how can I avoid them?`,
                  },
                ].map((item) => {
                  const isActivePrompt = lastAskedQuestion === item.prompt;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => void handleAskTutor(item.prompt)}
                      className={`w-full px-3.5 py-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isActivePrompt
                          ? 'bg-brand-soft border-brand text-brand'
                          : 'bg-canvas hover:bg-slate-100/90 border-slate-200/80 text-ink'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{item.label}</p>
                        <p className="text-[11px] text-muted truncate">{item.desc}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Card 3: NotebookLM-Style Study Studio Actions (Each tool clearly defined) */}
            <section
              aria-label="Study Tools"
              className="bg-white rounded-3xl border border-slate-200/90 p-5 space-y-3.5 shadow-2xs"
            >
              <div>
                <h2 className="text-sm font-bold text-ink">Study Studio Tools</h2>
                <p className="text-xs text-muted mt-0.5">
                  Generate notes, PDF sheets, and targeted practice.
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSubMode('quick-revise')}
                  className="w-full px-3.5 py-3 rounded-2xl bg-canvas hover:bg-brand-soft/60 border border-slate-200/80 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-ink">
                      Revision Notes &amp; PDF Export
                    </p>
                    <p className="text-[11px] text-muted">
                      Sticky notes, flashcards &amp; downloadable PDF
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSubMode('quiz');
                    if (quizQuestions.length === 0) void handleGenerateDiagnosticQuiz(false);
                  }}
                  className="w-full px-3.5 py-3 rounded-2xl bg-canvas hover:bg-brand-soft/60 border border-slate-200/80 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-ink">
                      Generate Practice Questions
                    </p>
                    <p className="text-[11px] text-muted">
                      Diagnostic quiz with instant grading
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setSubMode('revision')}
                  className="w-full px-3.5 py-3 rounded-2xl bg-canvas hover:bg-brand-soft/60 border border-slate-200/80 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-bold text-ink">
                      Personalized Revision Plan
                    </p>
                    <p className="text-[11px] text-muted">
                      Prioritized checklist from your quiz results
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-brand shrink-0" />
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Bottom "Your Progress" Summary Strip */}
      <div className="bg-white rounded-3xl border border-slate-200/80 px-5 py-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 lm-no-print">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-brand" />
          <span className="text-sm font-bold text-ink">Your Study Progress</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-canvas border border-slate-200/80">
            <TrendingUp className="w-4 h-4 text-success shrink-0" />
            <div>
              <p className="text-xs font-bold text-ink tabular-nums">
                {docProgressSummary.overallDeltaPct !== null
                  ? `${
                      docProgressSummary.overallDeltaPct >= 0 ? '+' : ''
                    }${docProgressSummary.overallDeltaPct}% Improvement`
                  : docProgressSummary.latestAttemptPct !== null
                  ? `${docProgressSummary.latestAttemptPct}% Latest Score`
                  : 'No Quiz Baseline Yet'}
              </p>
              <p className="text-[11px] text-muted">Overall Improvement</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-canvas border border-slate-200/80">
            <Layers className="w-4 h-4 text-brand shrink-0" />
            <div>
              <p className="text-xs font-bold text-ink tabular-nums">
                {Math.max(visitedPages.length, 1)} / {activeDocument.pageCount}{' '}
                {activeDocument.sourceType === 'youtube' ? 'Sections' : 'Pages'}
              </p>
              <p className="text-[11px] text-muted">
                {activeDocument.sourceType === 'youtube'
                  ? 'Video Sections Studied'
                  : 'Pages Studied'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-canvas border border-slate-200/80">
            <ClipboardCheck className="w-4 h-4 text-warning shrink-0" />
            <div>
              <p className="text-xs font-bold text-ink tabular-nums">
                {allDocAttempts.length} Completed
              </p>
              <p className="text-[11px] text-muted">Quizzes Completed</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateProgress}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline shrink-0 cursor-pointer"
        >
          <span>Full Progress &amp; Report</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Proctored Fullscreen Enforcement with 3 Warnings */}
      <QuizProctorOverlay
        isQuizActive={isDiagnosticQuizActive}
        onAutoSubmit={() => void handleSubmitDiagnosticQuiz()}
        quizTitle="Diagnostic Quiz"
      />
      <QuizProctorOverlay
        isQuizActive={isAdaptiveQuizActive}
        onAutoSubmit={() => void handleSubmitAdaptivePractice()}
        quizTitle="Adaptive Practice Test"
      />

      {/* Gemini Live Voice Tutor Modal */}
      <VoiceTutorModal
        isOpen={voiceModalOpen}
        onClose={() => {
          setVoiceModalOpen(false);
          if (onCloseExternalVoice) onCloseExternalVoice();
        }}
        activeDocument={activeDocument}
        weakTopics={currentWeakTopics}
        onNavigateToCitation={navigateToCitation}
      />
    </div>
  );
};

