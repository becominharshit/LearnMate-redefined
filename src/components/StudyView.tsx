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
  Mic,
  CloudCheck,
  TrendingUp,
  Layers,
  Award,
  Youtube,
  Clock,
  PenTool,
  Plus,
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
  computeOverallProgressSummary,
  formatSourceReferenceLabel,
  isValidYouTubeVideoId,
} from '../utils/quizGrading';
import { renderPdfPageToCanvas } from '../utils/pdfExtractor';
import { classifyJeeSubject } from '../utils/jeeSubjects';
import { VoiceTutorModal } from './VoiceTutorModal';
import { QuizProctorOverlay } from './QuizProctorOverlay';
import { MathText } from './MathText';
import { ReportButton } from './ReportButton';
import type { QuickReviseSubTab } from './QuickReviseView';

export type StudySubMode = 'explain' | 'quiz' | 'adaptive';

interface StudyViewProps {
  documents: StudyDocument[];
  activeDocument: StudyDocument;
  onSelectDocument: (doc: StudyDocument) => void;
  initialSubMode?: StudySubMode;
  initialQuestion?: string | null;
  onConsumeInitialQuestion?: () => void;
  onAttemptSaved: () => void;
  onNavigateProgress: () => void;
  onOpenRevise?: (subTab?: QuickReviseSubTab) => void;
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
  initialQuestion,
  onConsumeInitialQuestion,
  onAttemptSaved,
  onNavigateProgress,
  onOpenRevise,
  onOpenPdfWorkspace,
  onOpenUploadModal,
  isCloudSynced = false,
  externalVoiceOpen = false,
  onCloseExternalVoice,
}) => {
  const [subMode, setSubMode] = useState<StudySubMode>(initialSubMode);
  const [mobilePane, setMobilePane] = useState<'read' | 'ask'>('read');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visitedPages, setVisitedPages] = useState<number[]>([1]);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [readerZoomPct, setReaderZoomPct] = useState<number>(100);
  const [viewPdfCanvas, setViewPdfCanvas] = useState<boolean>(false);
  const [showOverviewDrawer, setShowOverviewDrawer] = useState<boolean>(false);
  const [expandedCitationsMap, setExpandedCitationsMap] = useState<Record<string, boolean>>({});
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(false);

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tutorScrollRef = useRef<HTMLDivElement | null>(null);

  // Tutor state (defaults to "Notes + JEE knowledge" / extended_knowledge per Phase 3 item 5)
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string>('');
  const [isAskingTutor, setIsAskingTutor] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [sourceControlMode, setSourceControlMode] = useState<SourceControlMode>('extended_knowledge');

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

  // Scroll ONLY the internal tutor chat container
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

  // Mistake DNA & Revision Plan state (persisted for Revise tab)
  const [mistakes, setMistakes] = useState<MistakeInsight[]>([]);
  const [revisionPlan, setRevisionPlan] = useState<RevisionTask[]>([]);

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

  // Trigger initialQuestion from Home "Ask a doubt" box
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim()) {
      const q = initialQuestion.trim();
      setSubMode('explain');
      setMobilePane('ask');
      if (onConsumeInitialQuestion) onConsumeInitialQuestion();
      void handleAskTutor(q);
    }
  }, [initialQuestion]);

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
    const safePage = Math.max(1, Math.min(pageNumber, activeDocument.pageCount || 1));
    setCurrentPage(safePage);
    setVisitedPages((prev) => (prev.includes(safePage) ? prev : [...prev, safePage]));
  };

  const navigateToCitation = (pageNumber: number, quote?: string) => {
    selectPage(pageNumber);
    setMobilePane('read');
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
  const highlightKey = (highlightedQuote || '').replace(/\s+/g, ' ').slice(0, 28).toLowerCase();

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

  // --- Streaming Context-Aware AI Study Tutor Handler (Phase 3 Item 5) ---
  const handleAskTutor = async (customQuestion?: string) => {
    const qText = (customQuestion ?? questionInput).trim();
    if (!qText || isAskingTutor) return;

    setTutorError(null);
    setLastAskedQuestion(qText);
    setMobilePane('ask');

    const userMsg: TutorMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: qText,
      foundInMaterial: true,
      citations: [],
      relatedTopics: [],
      timestamp: new Date().toISOString(),
    };

    const streamingMsgId = `msg-${Date.now() + 1}-ai`;
    const initialAiMsg: TutorMessage = {
      id: streamingMsgId,
      role: 'assistant',
      content: '',
      foundInMaterial: true,
      sourceType: sourceControlMode === 'material_only' ? 'material' : 'both',
      sourceControlMode,
      citations: [],
      relatedTopics: [],
      timestamp: new Date().toISOString(),
    };

    const historyForRequest = [...tutorMessages, userMsg].slice(-5).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setTutorMessages((prev) => [...prev, userMsg, initialAiMsg]);
    if (!customQuestion) setQuestionInput('');
    setIsAskingTutor(true);

    try {
      let accumulated = '';
      const response = await aiStudyClient.askTutorStream(
        {
          title: activeDocument.title,
          pages: activeDocument.pages,
          question: qText,
          history: historyForRequest,
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
        },
        (deltaChunk) => {
          accumulated += deltaChunk;
          setTutorMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMsgId ? { ...m, content: accumulated } : m
            )
          );
        }
      );

      const finalAssistantMsg: TutorMessage = {
        id: streamingMsgId,
        role: 'assistant',
        content: response.answer || accumulated,
        foundInMaterial: response.foundInMaterial,
        sourceType: response.sourceType,
        sourceControlMode,
        citations: response.citations || [],
        relatedTopics: response.relatedTopics || [],
        timestamp: new Date().toISOString(),
        modelUsed: response.modelUsed,
      };

      setTutorMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === streamingMsgId ? finalAssistantMsg : m
        );
        studyStorage.saveTutorMessages(activeDocument.id, updated);
        return updated;
      });

      if (response.aiNotice) {
        setTutorError(response.aiNotice);
      }

      if (response.citations && response.citations.length > 0) {
        selectPage(response.citations[0].pageNumber);
        if (response.citations[0].quote) {
          setHighlightedQuote(response.citations[0].quote);
        }
      }
    } catch (err) {
      // Remove empty streaming placeholder on error
      setTutorMessages((prev) =>
        prev.filter((m) => !(m.id === streamingMsgId && !m.content.trim()))
      );
      setTutorError(
        err instanceof Error
          ? err.message
          : 'The AI tutor is temporarily busy. Try again shortly.'
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
    }
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
  const activeAdaptiveQuestion = adaptiveQuestions[adaptiveQuestionIdx];
  const answeredAdaptiveCount = Object.keys(adaptiveSelected).length;

  const docProgressSummary = computeOverallProgressSummary(allDocAttempts);
  const totalReaderPages = Math.max(1, activeDocument.pageCount || activeDocument.pages.length || 1);

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

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-5">
      {/* =====================================================================
          UNIFIED STUDY HEADER (One Study Screen — Reader + AI Tutor)
         ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1 border-b border-line">
        <div className="space-y-1.5">
          <div className="lm-kicker flex items-center gap-2">
            <span>{documentSubject || 'Study'}</span>
            <span>/</span>
            <span>{cleanDocTitle}</span>
            {isCloudSynced && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-soft text-success text-[10px] font-semibold normal-case tracking-normal">
                <CloudCheck className="w-3 h-3" />
                <span>Synced</span>
              </span>
            )}
          </div>
          <h1 className="lm-editorial-title text-2xl sm:text-4xl">{cleanDocTitle}</h1>
          <p className="lm-editorial-subtitle text-sm sm:text-base text-body">
            Read your material on the left and ask the JEE AI Tutor on the right. Select any line to ask about it.
          </p>
        </div>

        {/* Mode Switcher: Read & Ask | Chapter Quiz | Adaptive Drill + Live Voice */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <div
            role="tablist"
            aria-label="Study Screen Modes"
            className="inline-flex items-center p-1 rounded-xl bg-canvas border border-line"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'explain'}
              onClick={() => setSubMode('explain')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subMode === 'explain'
                  ? 'bg-brand text-white shadow-2xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Read &amp; Ask Tutor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'quiz'}
              onClick={() => {
                setSubMode('quiz');
                if (quizQuestions.length === 0 && !isGeneratingQuiz) {
                  void handleGenerateDiagnosticQuiz(false);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subMode === 'quiz'
                  ? 'bg-brand text-white shadow-2xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Chapter Quiz
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'adaptive'}
              onClick={() => setSubMode('adaptive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subMode === 'adaptive'
                  ? 'bg-brand text-white shadow-2xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Adaptive Drill
            </button>
          </div>

          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            data-testid="open-voice-tutor-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5 text-brand" />
            <span>Voice Tutor</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MOBILE "READ / ASK" SEGMENTED SWITCH (<1024px per Phase 3 Item 4)
         ===================================================================== */}
      {subMode === 'explain' && (
        <div className="lg:hidden flex items-center justify-between gap-2 p-1 rounded-xl bg-white border border-line shadow-2xs">
          <button
            type="button"
            data-testid="mobile-study-read-tab"
            onClick={() => setMobilePane('read')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobilePane === 'read'
                ? 'bg-brand text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read ({currentPage}/{totalReaderPages})</span>
          </button>
          <button
            type="button"
            data-testid="mobile-study-ask-tab"
            onClick={() => setMobilePane('ask')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobilePane === 'ask'
                ? 'bg-brand text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Tutor ({tutorMessages.filter((m) => m.role === 'assistant').length})</span>
          </button>
        </div>
      )}

      {/* =====================================================================
          ONE STUDY SCREEN: READER (LEFT 7 COLS) + AI TUTOR (RIGHT 5 COLS)
         ===================================================================== */}
      {subMode === 'explain' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT 7 COLUMNS: STUDY MATERIAL READER (PDF / Notes / Scanned Image / YouTube) */}
          <div
            className={`lg:col-span-7 lm-card-editorial overflow-hidden flex flex-col ${
              mobilePane === 'ask' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Reader Top Toolbar */}
            <div className="px-4 py-3 bg-canvas border-b border-line flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* Document Switcher */}
                <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-line text-xs font-medium text-ink">
                  {activeDocument.sourceType === 'youtube' ? (
                    <Youtube className="w-3.5 h-3.5 text-danger shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-brand shrink-0" />
                  )}
                  <select
                    aria-label="Select Study Document"
                    value={activeDocument.id}
                    onChange={(e) => {
                      const found = documents.find((d) => d.id === e.target.value);
                      if (found) onSelectDocument(found);
                    }}
                    className="bg-transparent font-semibold text-ink focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[210px] truncate"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Page / Timestamp Switcher */}
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-line text-xs font-medium text-ink tabular-nums">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => selectPage(Math.max(1, currentPage - 1))}
                    className="p-1 rounded hover:bg-brand-soft text-muted hover:text-ink disabled:opacity-40 cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5">
                    {currentPage} / {totalReaderPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalReaderPages}
                    onClick={() => selectPage(Math.min(totalReaderPages, currentPage + 1))}
                    className="p-1 rounded hover:bg-brand-soft text-muted hover:text-ink disabled:opacity-40 cursor-pointer"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Zoom `- 100% +` */}
                <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-line text-xs font-medium text-muted tabular-nums">
                  <button
                    type="button"
                    onClick={() => setReaderZoomPct((z) => Math.max(90, z - 10))}
                    className="px-1.5 hover:text-ink cursor-pointer"
                    aria-label="Decrease text size"
                  >
                    −
                  </button>
                  <span className="text-ink font-semibold">{readerZoomPct}%</span>
                  <button
                    type="button"
                    onClick={() => setReaderZoomPct((z) => Math.min(160, z + 10))}
                    className="px-1.5 hover:text-ink cursor-pointer"
                    aria-label="Increase text size"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeDocument.pdfDataUrl && (
                  <button
                    type="button"
                    onClick={() => setViewPdfCanvas((prev) => !prev)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-line hover:border-brand text-xs font-semibold text-ink cursor-pointer"
                  >
                    {viewPdfCanvas ? 'Text View' : 'PDF View'}
                  </button>
                )}

                {onOpenPdfWorkspace && (
                  <button
                    type="button"
                    data-testid="study-annotate-btn"
                    onClick={onOpenPdfWorkspace}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-line hover:border-brand text-xs font-semibold text-brand cursor-pointer"
                    title="Highlight, draw and add notes in the Annotation Studio"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Annotate</span>
                  </button>
                )}

                {onOpenUploadModal && (
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="p-1.5 rounded-lg bg-white border border-line hover:border-brand text-muted hover:text-brand cursor-pointer"
                    title="Add study material"
                    aria-label="Add study material"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Official YouTube Player + Timestamped Sections (Phase 3 Item 8) */}
            {activeDocument.sourceType === 'youtube' &&
              isValidYouTubeVideoId(activeDocument.videoId) && (
                <div className="p-4 bg-slate-950 border-b border-line space-y-3">
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video">
                    <iframe
                      title={activeDocument.title}
                      src={`https://www.youtube-nocookie.com/embed/${activeDocument.videoId}?start=${
                        activePageObj?.timestampSeconds || 0
                      }&rel=0`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {activeDocument.pages.map((p) => (
                      <button
                        key={p.pageNumber}
                        type="button"
                        onClick={() => selectPage(p.pageNumber)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          currentPage === p.pageNumber
                            ? 'bg-brand text-white'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{p.timestampLabel || `Part ${p.pageNumber}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* Scanned Photo of Notes Preview */}
            {activeDocument.scannedImageDataUrl && currentPage === 1 && (
              <div className="px-6 pt-4 bg-canvas border-b border-line">
                <img
                  src={activeDocument.scannedImageDataUrl}
                  alt={activeDocument.title}
                  className="max-h-56 rounded-xl border border-line object-contain mx-auto bg-white"
                />
              </div>
            )}

            {/* Topic Jump Bar */}
            {activeDocument.topics.length > 0 && (
              <div className="px-4 py-2 bg-[#FBFCFF] border-b border-line flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted shrink-0 mr-1">
                  Topics:
                </span>
                {activeDocument.topics.map((topic) => {
                  const targetPg = topic.sourcePages[0] || 1;
                  const isCurrent = activePageTopic?.id === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => selectPage(targetPg)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                        isCurrent
                          ? 'bg-brand-soft text-brand font-semibold border border-brand/30'
                          : 'bg-white text-body hover:bg-canvas border border-line'
                      }`}
                    >
                      {topic.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Text / Citation Highlight Bar */}
            {highlightedQuote && (
              <div className="px-4 py-2.5 bg-warning-soft border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-amber-950 leading-snug flex-1 min-w-[200px]">
                  <span className="font-bold">Selected on {formatSourceReferenceLabel(activeDocument, currentPage)}: </span>
                  <span className="italic">&ldquo;{highlightedQuote}&rdquo;</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isAskingTutor}
                    onClick={() =>
                      void handleAskTutor(
                        `Explain this from ${formatSourceReferenceLabel(activeDocument, currentPage)} step by step: "${highlightedQuote}"`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg lm-btn-accent text-[11px] font-semibold cursor-pointer"
                  >
                    Ask Tutor
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighlightedQuote(null)}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium text-amber-900 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Main Reader Content Body */}
            <div
              className="p-6 sm:p-8 bg-white space-y-4 flex-1 min-h-[460px]"
              onMouseUp={handleReaderSelection}
            >
              <div className="space-y-1 border-b border-soft pb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand">
                  {formatSourceReferenceLabel(activeDocument, currentPage)}
                </div>
                <h2 className="font-serif-editorial text-xl sm:text-2xl font-bold text-ink">
                  {activePageLabel}
                </h2>
              </div>

              {viewPdfCanvas && activeDocument.pdfDataUrl ? (
                <div className="flex justify-center bg-slate-100 p-3 rounded-xl overflow-x-auto">
                  <canvas
                    ref={pdfCanvasRef}
                    className="max-w-full rounded shadow-2xs bg-white keep-white"
                  />
                </div>
              ) : activePageObj?.content?.trim() ? (
                <div
                  className="space-y-3.5 text-ink leading-relaxed"
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
                        <div
                          key={idx}
                          className={`rounded-lg transition-colors ${
                            isHighlighted
                              ? 'bg-[#FEF9C3] ring-1 ring-amber-300 px-2.5 py-1.5 -mx-2'
                              : ''
                          }`}
                        >
                          <MathText text={para} />
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  No text was found on this page. If it is a scanned page, click Annotate or upload a photo of your notes.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: STREAMING JEE AI TUTOR (Phase 3 Item 4 & 5) */}
          <aside
            aria-label="Interactive Study Companion"
            className={`lg:col-span-5 lm-card-editorial overflow-hidden flex flex-col min-h-[580px] lg:sticky lg:top-20 ${
              mobilePane === 'read' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Tutor Header + Source Mode Toggle ("Notes + JEE knowledge" default vs "Only my notes") */}
            <div className="px-4 py-3.5 border-b border-line bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-ink">AI Study Tutor</h2>
                  <p className="text-[11px] text-muted">
                    Streaming step-by-step JEE solutions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <div
                  role="group"
                  aria-label="Tutor Source Control Mode"
                  className="inline-flex items-center p-0.5 rounded-full bg-canvas border border-line"
                >
                  <button
                    type="button"
                    data-testid="source-mode-extended"
                    onClick={() => handleToggleSourceControl('extended_knowledge')}
                    title="Default: Uses your notes first and adds JEE Main formulas & examples when helpful (clearly labelled)"
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                      sourceControlMode === 'extended_knowledge'
                        ? 'bg-brand text-white shadow-2xs'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Notes + JEE knowledge
                  </button>
                  <button
                    type="button"
                    data-testid="source-mode-material-only"
                    onClick={() => handleToggleSourceControl('material_only')}
                    title="Answers strictly from your uploaded notes"
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                      sourceControlMode === 'material_only'
                        ? 'bg-brand text-white shadow-2xs'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Only my notes
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
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors cursor-pointer ${
                    showTeachItBack
                      ? 'bg-warning-soft border-warning text-warning'
                      : 'border-line text-ink hover:bg-canvas'
                  }`}
                >
                  Teach It Back
                </button>

                <button
                  type="button"
                  onClick={() => setShowOverviewDrawer((prev) => !prev)}
                  aria-expanded={showOverviewDrawer}
                  className="px-2.5 py-1 rounded-full border border-line text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
                >
                  Topics ({activeDocument.topics.length})
                </button>
              </div>
            </div>

            {/* Teach It Back Drawer */}
            {showTeachItBack && (
              <div className="px-4 py-3.5 bg-warning-soft border-b border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-ink">
                    Teach It Back (Feynman Recall)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowTeachItBack(false)}
                    className="text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <form onSubmit={handleEvaluateTeachItBack} className="space-y-2">
                  <select
                    value={teachTopic}
                    onChange={(e) => setTeachTopic(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-ink"
                  >
                    {activeDocument.topics.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={teachExplanation}
                    onChange={(e) => setTeachExplanation(e.target.value)}
                    placeholder="Explain this concept in your own words..."
                    className="w-full px-3 py-2 rounded-lg bg-white border border-amber-200 text-xs text-ink"
                  />
                  <button
                    type="submit"
                    disabled={isEvaluatingTeach || !teachExplanation.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-warning text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {isEvaluatingTeach ? 'Evaluating...' : 'Check My Explanation'}
                  </button>
                </form>
                {teachResult && (
                  <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-1 text-xs">
                    <div className="font-bold text-ink">
                      Score: {teachResult.scorePct}% ({teachResult.verdict.replace('_', ' ')})
                    </div>
                    <p className="text-slate-600">{teachResult.groundedFeedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Topics Drawer */}
            {showOverviewDrawer && (
              <div className="px-4 py-3 bg-canvas border-b border-line space-y-2 max-h-56 overflow-y-auto">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeDocument.overview}
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeDocument.topics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-2 rounded-lg bg-white border border-line flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-semibold text-ink truncate">
                        {topic.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOverviewDrawer(false);
                          void handleAskTutor(
                            `Explain ${topic.name} clearly with key formulas.`
                          );
                        }}
                        className="px-2 py-1 rounded bg-brand-soft text-brand text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        Explain →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Stream */}
            <div
              ref={tutorScrollRef}
              className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto max-h-[480px] bg-white"
            >
              {tutorMessages.length === 0 && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-ink">
                      Ask about Page {currentPage} ({activePageLabel})
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Answers stream live, use your uploaded notes first, and clearly label any extra JEE Main context.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      `Explain page ${currentPage} (${activePageLabel}) simply, step by step.`,
                      `List the key formulas on page ${currentPage} and when to use each in JEE Main.`,
                      `Give me one JEE Main style question (+4 / −1) from page ${currentPage} and solve it step by step.`,
                      `What common traps do students fall into on ${activePageTopic?.name || cleanDocTitle}?`,
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleAskTutor(prompt)}
                        className="p-3 rounded-xl bg-canvas hover:bg-brand-soft/60 border border-line hover:border-brand text-left text-xs font-medium text-ink transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span>{prompt}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tutorMessages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="bg-brand-soft text-ink rounded-2xl px-3.5 py-2.5 max-w-[90%]">
                        <p className="text-xs sm:text-sm font-medium leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                }

                const resolvedSourceType =
                  msg.sourceType || (msg.foundInMaterial ? 'material' : 'general');
                const sourceLabel =
                  resolvedSourceType === 'material'
                    ? 'From your notes'
                    : resolvedSourceType === 'both'
                    ? 'Notes + JEE knowledge (goes beyond notes)'
                    : 'JEE knowledge (not in notes)';
                const sourceBadgeStyle =
                  resolvedSourceType === 'material'
                    ? 'bg-brand-soft text-brand border-blue-200/80'
                    : resolvedSourceType === 'both'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                    : 'bg-amber-50 text-amber-800 border-amber-200/80';

                const isExpanded = !!expandedCitationsMap[msg.id];

                return (
                  <article
                    key={msg.id}
                    className="bg-[#FBFCFF] rounded-2xl border border-line p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        data-testid="tutor-source-badge"
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sourceBadgeStyle}`}
                      >
                        {sourceLabel}
                      </span>
                      {msg.content && (
                        <ReportButton
                          kind="tutor_answer"
                          excerpt={msg.content}
                          documentId={activeDocument.id}
                        />
                      )}
                    </div>

                    {msg.content ? (
                      <div className="text-xs sm:text-sm text-ink leading-relaxed">
                        <MathText text={msg.content} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                        <span>Streaming step-by-step explanation...</span>
                      </div>
                    )}

                    {msg.citations.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {msg.citations.map((cit, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => navigateToCitation(cit.pageNumber, cit.quote)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-brand-soft border border-line text-[11px] font-semibold text-brand cursor-pointer"
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
                            className="text-[11px] font-medium text-muted hover:text-ink px-1.5 py-0.5 cursor-pointer"
                          >
                            {isExpanded ? 'Hide quotes' : 'Quotes'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="space-y-1.5 pt-1">
                            {msg.citations.map((cit, cIdx) => (
                              <div
                                key={cIdx}
                                className="p-2.5 rounded-xl bg-white border border-line text-xs text-slate-600"
                              >
                                <div className="font-semibold text-ink">
                                  Page {cit.pageNumber}: {cit.section}
                                </div>
                                <p className="italic mt-0.5">&ldquo;{cit.quote}&rdquo;</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.content && !isAskingTutor && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void handleAskTutor(
                              'Simplify your previous explanation in plain steps with a short analogy.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white border border-line text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
                        >
                          Simplify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAskTutor(
                              'Show a JEE Main worked numerical example for this concept.'
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white border border-line text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
                        >
                          JEE Example
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}

              {tutorError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-700"
                >
                  <span>{tutorError}</span>
                  {lastAskedQuestion && (
                    <button
                      type="button"
                      onClick={() => void handleAskTutor(lastAskedQuestion)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-red-200 font-semibold text-red-700 shrink-0 cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Tutor Question Composer */}
            <div className="p-3.5 border-t border-line bg-canvas space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAskTutor();
                }}
                className="flex items-center gap-2 bg-white rounded-xl border border-line px-3 py-1.5 focus-within:border-brand"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask a doubt about this page or JEE topic..."
                  aria-label="Ask AI Study Tutor a question"
                  className="flex-1 py-1.5 bg-transparent text-xs sm:text-sm text-ink placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isAskingTutor || !questionInput.trim()}
                  aria-label="Send question to AI Tutor"
                  className="px-3.5 py-1.5 rounded-lg lm-btn-accent text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isAskingTutor ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Ask</span>
                      <Send className="w-3 h-3" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      {/* =====================================================================
          MODE 2: CHAPTER DIAGNOSTIC QUIZ
         ===================================================================== */}
      {subMode === 'quiz' && (
        <div className="bg-white rounded-3xl border border-line p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">
                  Chapter Diagnostic Quiz
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  Test your understanding of {cleanDocTitle} and diagnose any weak areas.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isGeneratingQuiz}
              onClick={() => void handleGenerateDiagnosticQuiz(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line hover:bg-canvas text-xs font-semibold text-ink cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingQuiz ? 'animate-spin' : ''}`} />
              <span>New Quiz</span>
            </button>
          </div>

          {isGeneratingQuiz ? (
            <div className="py-16 max-w-xl mx-auto w-full space-y-4 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
              <p className="text-sm font-medium text-ink">
                Generating grounded diagnostic questions from {cleanDocTitle}...
              </p>
            </div>
          ) : quizError ? (
            <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3 max-w-md mx-auto">
              <p className="text-sm font-medium text-red-700">{quizError}</p>
              <button
                type="button"
                onClick={() => void handleGenerateDiagnosticQuiz(true)}
                className="px-5 py-2 rounded-full bg-danger text-white text-xs font-semibold cursor-pointer"
              >
                Retry Quiz Generation
              </button>
            </div>
          ) : latestDiagnosticAttempt ? (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-brand-soft border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-brand">
                    Diagnostic Results Graded
                  </span>
                  <h3 className="text-2xl font-bold text-ink tabular-nums">
                    {latestDiagnosticAttempt.score} / {latestDiagnosticAttempt.totalQuestions} Correct ({latestDiagnosticAttempt.percentage}%)
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {latestDiagnosticAttempt.weakTopics.length > 0
                      ? `Focus areas identified: ${latestDiagnosticAttempt.weakTopics.join(', ')}`
                      : 'Great job! You answered all topics accurately.'}
                  </p>
                </div>
                {onOpenRevise && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenRevise('mistakes')}
                      className="px-4 py-2 rounded-full bg-brand hover:bg-brand-strong text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Open Mistake DNA &amp; Plan in Revise →
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3.5 max-w-[68ch]">
                {latestDiagnosticAttempt.questions.map((q, idx) => {
                  const ans = latestDiagnosticAttempt.answers.find(
                    (a) => a.questionId === q.id
                  );
                  const isCorrect = ans?.isCorrect ?? false;
                  return (
                    <div
                      key={q.id}
                      className={`p-5 rounded-2xl border ${
                        isCorrect
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-red-50/30 border-red-200'
                      } space-y-2`}
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
                          onClick={() => {
                            setSubMode('explain');
                            navigateToCitation(q.sourcePage, q.sourceQuote);
                          }}
                          className="text-xs font-semibold text-brand hover:underline shrink-0 cursor-pointer"
                        >
                          Page {q.sourcePage}
                        </button>
                      </div>
                      <MathText text={q.question} className="text-sm font-semibold text-ink" />
                      <p className="text-xs text-emerald-800 font-semibold">
                        Correct Answer: <MathText text={q.options[q.correctIndex]} variant="inline" />
                      </p>
                      <div className="text-xs text-slate-600">
                        <MathText text={q.explanation} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeDiagnosticQuestion ? (
            <div className="space-y-6 max-w-[72ch]">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-bold text-ink tabular-nums">
                    Question {currentQuestionIdx + 1} of {quizQuestions.length}
                  </span>
                  <span className="font-semibold text-muted tabular-nums">
                    Topic: {activeDiagnosticQuestion.topic} · Page {activeDiagnosticQuestion.sourcePage}
                  </span>
                </div>

                <div className="p-5 sm:p-6 rounded-2xl bg-[#FBFCFF] border border-line space-y-4">
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
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-brand-soft border-brand text-ink font-semibold'
                              : 'bg-white hover:bg-slate-50 border-line text-slate-700'
                          }`}
                        >
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-xs font-bold flex items-center justify-center shrink-0">
                            {optionLabel}
                          </span>
                          <span className="text-sm leading-relaxed">
                            <MathText text={optionText} variant="inline" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentQuestionIdx === 0}
                  onClick={() => setCurrentQuestionIdx((i) => Math.max(0, i - 1))}
                  className="px-4 py-2 rounded-full border border-line bg-white text-xs font-semibold text-ink disabled:opacity-40 cursor-pointer"
                >
                  ← Previous
                </button>

                {currentQuestionIdx < quizQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentQuestionIdx((i) =>
                        Math.min(quizQuestions.length - 1, i + 1)
                      )
                    }
                    className="px-5 py-2 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSubmitDiagnosticQuiz()}
                    className="px-5 py-2 rounded-full bg-success text-white text-xs font-semibold cursor-pointer"
                  >
                    Submit Quiz
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <button
                type="button"
                onClick={() => void handleGenerateDiagnosticQuiz(true)}
                className="px-5 py-2.5 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
              >
                Start Diagnostic Quiz
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 3: ADAPTIVE PRACTICE DRILL
         ===================================================================== */}
      {subMode === 'adaptive' && (
        <div className="bg-white rounded-3xl border border-line p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                <Zap className="w-5 h-5 text-brand" />
                <span>Adaptive Practice Drill</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted">
                Targeted questions focused on your weak topics.
              </p>
            </div>
            <button
              type="button"
              disabled={isGeneratingAdaptive}
              onClick={() => void handleStartAdaptivePractice()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isGeneratingAdaptive ? 'animate-spin' : ''}`}
              />
              <span>Generate Adaptive Set</span>
            </button>
          </div>

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
                  className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
                    isFocused
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-slate-600 border-line hover:bg-canvas'
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          {isGeneratingAdaptive ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" />
              <p className="text-sm text-ink">
                Generating adaptive practice questions...
              </p>
            </div>
          ) : latestAdaptiveAttempt ? (
            <div className="p-5 rounded-2xl bg-success-soft border border-emerald-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Score: {latestAdaptiveAttempt.score} / {latestAdaptiveAttempt.totalQuestions} ({latestAdaptiveAttempt.percentage}%)
                </h3>
                <p className="text-xs text-slate-600">
                  Adaptive attempt saved to your Progress history.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateProgress}
                className="px-4 py-2 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
              >
                View Progress →
              </button>
            </div>
          ) : activeAdaptiveQuestion ? (
            <div className="space-y-4 max-w-[65ch]">
              <div className="text-xs font-semibold text-muted">
                Adaptive Question {adaptiveQuestionIdx + 1} of {adaptiveQuestions.length} · {activeAdaptiveQuestion.topic}
              </div>
              <MathText text={activeAdaptiveQuestion.question} className="lm-quiz-question" />
              <div className="space-y-2">
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
                      className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-ink text-white border-ink font-medium'
                          : 'bg-white hover:bg-canvas border-line text-slate-700'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs font-semibold shrink-0">
                        {['A', 'B', 'C', 'D'][optIdx]}
                      </span>
                      <MathText text={opt} variant="inline" />
                    </button>
                  );
                })}
              </div>
              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  disabled={adaptiveQuestionIdx === 0}
                  onClick={() => setAdaptiveQuestionIdx((i) => Math.max(0, i - 1))}
                  className="px-4 py-2 rounded-full border border-line text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ← Previous
                </button>
                <span className="text-xs text-muted">
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
                    className="px-4 py-2 rounded-full bg-ink text-white text-xs font-semibold cursor-pointer"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitAdaptivePractice}
                    className="px-5 py-2 rounded-full bg-success text-white text-xs font-semibold cursor-pointer"
                  >
                    Submit Adaptive Set
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">
              <button
                type="button"
                onClick={() => void handleStartAdaptivePractice()}
                className="px-5 py-2.5 rounded-full bg-brand text-white text-xs font-semibold cursor-pointer"
              >
                Launch Adaptive Drill
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Study Progress Strip */}
      <div className="bg-white rounded-2xl border border-line px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 lm-no-print">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-ink">
            <Award className="w-4 h-4 text-brand" />
            <span>Study Progress</span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted tabular-nums">
            <Layers className="w-3.5 h-3.5 text-brand" />
            <span>
              {Math.max(visitedPages.length, 1)} / {totalReaderPages}{' '}
              {activeDocument.sourceType === 'youtube' ? 'sections' : 'pages'} read
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted tabular-nums">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <span>
              {docProgressSummary.latestAttemptPct !== null
                ? `Latest Quiz: ${docProgressSummary.latestAttemptPct}%`
                : `${allDocAttempts.length} quizzes taken`}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {onOpenRevise && (
            <button
              type="button"
              onClick={() => onOpenRevise('flashcards')}
              className="text-xs font-semibold text-brand hover:underline cursor-pointer"
            >
              Revise this chapter →
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateProgress}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
          >
            <span>Progress</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Proctored Fullscreen Enforcement */}
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

      {/* Live Voice Tutor Modal */}
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
