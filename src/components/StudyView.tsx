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
  Maximize2,
  Minimize2,
  Highlighter,
  Eraser,
  StickyNote,
  GripVertical,
} from 'lucide-react';
import type {
  StudyDocument,
  TutorMessage,
  QuizQuestion,
  QuizAttempt,
  MistakeInsight,
  RevisionTask,
  SourceControlMode,
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
import {
  retrieveRelevantPagesForQuery,
  detectContextualCreateIntent,
  stopAllGlobalAudioAndSpeech,
  type ContextualCreateTransferPayload,
  type ContextualCreateAction,
} from '../utils/phase6Engine';
import { VoiceTutorModal } from './VoiceTutorModal';
import { QuizProctorOverlay } from './QuizProctorOverlay';
import { MathText } from './MathText';
import { ReportButton } from './ReportButton';
import { SyllabusAndNotesWorkspace } from './SyllabusAndNotesWorkspace';
import { ResourcesView } from './ResourcesView';
import type { QuickReviseSubTab } from './QuickReviseView';

export type StudySubMode = 'explain' | 'quiz' | 'adaptive';
export type StudyHubSection =
  | 'my_materials'
  | 'syllabus'
  | 'chapter_notes'
  | 'ai_tutor'
  | 'resources';

interface StudyViewProps {
  documents: StudyDocument[];
  activeDocument: StudyDocument;
  onSelectDocument: (doc: StudyDocument) => void;
  initialSubMode?: StudySubMode;
  initialHubSection?: StudyHubSection;
  initialQuestion?: string | null;
  onConsumeInitialQuestion?: () => void;
  onAttemptSaved: () => void;
  onNavigateProgress: () => void;
  onOpenRevise?: (subTab?: QuickReviseSubTab) => void;
  onOpenPractice?: () => void;
  onOpenPdfWorkspace?: () => void;
  onOpenUploadModal?: () => void;
  onOpenContextualCreate?: (payload: ContextualCreateTransferPayload) => void;
  isCloudSynced?: boolean;
  externalVoiceOpen?: boolean;
  onCloseExternalVoice?: () => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  documents,
  activeDocument,
  onSelectDocument,
  initialSubMode = 'explain',
  initialHubSection = 'my_materials',
  initialQuestion,
  onConsumeInitialQuestion,
  onAttemptSaved,
  onNavigateProgress,
  onOpenRevise,
  onOpenPractice,
  onOpenPdfWorkspace,
  onOpenUploadModal,
  onOpenContextualCreate,
  isCloudSynced = false,
  externalVoiceOpen = false,
  onCloseExternalVoice,
}) => {
  const [hubSection, setHubSection] = useState<StudyHubSection>(initialHubSection);
  const [subMode, setSubMode] = useState<StudySubMode>(initialSubMode);

  useEffect(() => {
    setHubSection(initialHubSection);
  }, [initialHubSection]);

  useEffect(() => {
    setSubMode(initialSubMode);
  }, [initialSubMode]);
  const [mobilePane, setMobilePane] = useState<'read' | 'ask'>('read');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visitedPages, setVisitedPages] = useState<number[]>([1]);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);
  const [readerZoomPct, setReaderZoomPct] = useState<number>(100);
  const [viewPdfCanvas, setViewPdfCanvas] = useState<boolean>(false);
  const [expandedCitationsMap, setExpandedCitationsMap] = useState<Record<string, boolean>>({});
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(false);

  // Desktop Resizable Split Pane & Full-Screen Toggle State
  const [readerSplitPct, setReaderSplitPct] = useState<number>(58);
  const [maximizedPane, setMaximizedPane] = useState<'none' | 'reader' | 'tutor'>('none');
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // Inline Reader Annotation State (Highlight, Freehand Pen/Eraser, Page Notes)
  const [inlineAnnotateActive, setInlineAnnotateActive] = useState<boolean>(false);
  const [inlineTool, setInlineTool] = useState<'highlight' | 'pen' | 'eraser'>('highlight');
  const [inlinePenColor, setInlinePenColor] = useState<string>('#4F46E5');
  const [inlinePageNotes, setInlinePageNotes] = useState<Record<number, string>>({});
  const [isDrawingInk, setIsDrawingInk] = useState<boolean>(false);
  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tutorScrollRef = useRef<HTMLDivElement | null>(null);

  // Tutor state (defaults to "Notes + JEE knowledge" / extended_knowledge)
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [lastAskedQuestion, setLastAskedQuestion] = useState<string>('');
  const [isAskingTutor, setIsAskingTutor] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [sourceControlMode, setSourceControlMode] = useState<SourceControlMode>('extended_knowledge');

  const handleStartSplitDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const relativeX = moveEvent.clientX - rect.left;
      const pct = Math.round((relativeX / rect.width) * 100);
      setReaderSplitPct(Math.max(32, Math.min(72, pct)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleInkPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!inlineAnnotateActive || inlineTool === 'highlight') return;
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawingInk(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleInkPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingInk || !inlineAnnotateActive || inlineTool === 'highlight') return;
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (inlineTool === 'eraser') {
      ctx.clearRect(x - 12, y - 12, 24, 24);
    } else {
      ctx.strokeStyle = inlinePenColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleInkPointerUp = () => {
    setIsDrawingInk(false);
  };

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

  // Load persisted document state when activeDocument changes & stop any lingering audio
  useEffect(() => {
    stopAllGlobalAudioAndSpeech('study_view_document_switch');
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
      const relevantPages = retrieveRelevantPagesForQuery(
        activeDocument.pages,
        qText,
        currentPage,
        10
      );
      const response = await aiStudyClient.askTutorStream(
        {
          title: activeDocument.title,
          pages: relevantPages.selectedPages,
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
    <div className="max-w-[1920px] w-full mx-auto px-6 sm:px-8 lg:px-10 xl:px-14 py-6 lg:py-8 space-y-7">
      {/* =====================================================================
          STUDY HUB SUB-NAVIGATION BAR (Matches Image 7 & Section 3)
          Syllabus · Chapter Notes · My Materials · AI Tutor · Create · Resources
         ===================================================================== */}
      <div
        role="tablist"
        aria-label="Study Hub Navigation"
        className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-3 border-b border-line no-scrollbar"
      >
        {(
          [
            { id: 'syllabus', label: 'Syllabus' },
            { id: 'chapter_notes', label: 'Chapter Notes' },
            { id: 'my_materials', label: 'My Materials' },
            { id: 'ai_tutor', label: 'AI Tutor' },
            { id: 'create_link', label: 'Create' },
            { id: 'resources', label: 'Resources' },
          ] as const
        ).map((item) => {
          const isActive =
            item.id === 'create_link'
              ? false
              : hubSection === item.id ||
                (item.id === 'ai_tutor' && hubSection === 'my_materials' && mobilePane === 'ask');

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`study-hub-tab-${item.id}`}
              onClick={() => {
                if (item.id === 'create_link') {
                  if (onOpenContextualCreate) {
                    onOpenContextualCreate({
                      sourceTutorMessageId: 'study-hub-create',
                      question: activePageLabel,
                      tutorAnswerExcerpt: activePageObj?.content?.slice(0, 500) || activeDocument.overview,
                      conceptTitle: activePageLabel,
                      topic: activePageTopic?.name || activePageLabel,
                      subject:
                        (documentSubject as 'Physics' | 'Chemistry' | 'Mathematics' | 'General') ||
                        'Physics',
                      documentId: activeDocument.id,
                      documentTitle: activeDocument.title,
                      citedPages: [currentPage],
                      selectedMode: 'create_diagram',
                    });
                  }
                  return;
                }
                if (item.id === 'ai_tutor') {
                  setHubSection('my_materials');
                  setSubMode('explain');
                  setMobilePane('ask');
                  return;
                }
                setHubSection(item.id);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-brand-soft text-brand border border-brand/30'
                  : 'text-muted hover:text-ink hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          SECTION A: BUILT-IN SYLLABUS & CHAPTER NOTES (Full Notes + Quick Notes)
         ===================================================================== */}
      {(hubSection === 'syllabus' || hubSection === 'chapter_notes') && (
        <SyllabusAndNotesWorkspace
          initialMode={hubSection === 'chapter_notes' ? 'notes' : 'syllabus'}
          onOpenChapterInWorkbench={(doc) => {
            studyStorage.saveDocument(doc);
            studyStorage.setActiveDocumentId(doc.id);
            onSelectDocument(doc);
            setSubMode('explain');
            setHubSection('my_materials');
          }}
          onOpenChapterPractice={(_chapterId) => {
            if (onOpenPractice) onOpenPractice();
          }}
          onOpenChapterRevise={(doc) => {
            studyStorage.saveDocument(doc);
            studyStorage.setActiveDocumentId(doc.id);
            onSelectDocument(doc);
            if (onOpenRevise) onOpenRevise('flashcards');
          }}
          onOpenChapterCreate={(chapter) => {
            if (onOpenContextualCreate) {
              onOpenContextualCreate({
                sourceTutorMessageId: `syllabus-${chapter.id}`,
                question: chapter.title,
                tutorAnswerExcerpt: chapter.overview,
                conceptTitle: chapter.title,
                topic: chapter.title,
                subject: chapter.subject,
                documentId: activeDocument.id,
                documentTitle: chapter.title,
                citedPages: [1],
                selectedMode: 'create_diagram',
              });
            }
          }}
        />
      )}

      {/* =====================================================================
          SECTION B: OFFICIAL RESOURCES & EXAM GUIDE
         ===================================================================== */}
      {hubSection === 'resources' && (
        <ResourcesView
          onImportReferenceNotes={(title, content) => {
            const newDoc: StudyDocument = {
              id: `doc-ref-${Date.now()}`,
              title: `${title}.pdf`,
              sourceType: 'text',
              pageCount: 1,
              pages: [{ pageNumber: 1, title, content }],
              createdAt: new Date().toISOString(),
              lastStudiedAt: new Date().toISOString(),
              topics: [{ id: 't-1', name: title, summary: content.slice(0, 140), keyConcepts: [title], sourcePages: [1] }],
              overview: content.slice(0, 200),
            };
            studyStorage.saveDocument(newDoc);
            studyStorage.setActiveDocumentId(newDoc.id);
            onSelectDocument(newDoc);
            setHubSection('my_materials');
          }}
          onOpenSyllabus={() => setHubSection('syllabus')}
        />
      )}

      {/* =====================================================================
          SECTION C: UNIFIED STUDY WORKBENCH (My Materials + AI Tutor)
         ===================================================================== */}
      {(hubSection === 'my_materials' || hubSection === 'ai_tutor') && (
        <>
          {documents.length === 0 && hubSection === 'my_materials' && (
            <div
              data-testid="study-my-materials-empty-banner"
              className="rounded-2xl border border-dashed border-line bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                  Personal Materials Library (0 Uploaded Files)
                </span>
                <h2 className="text-base font-bold text-ink">
                  No personal files uploaded yet — showing built-in JEE Syllabus preview below
                </h2>
                <p className="text-xs text-muted">
                  Upload your own PDF chapter, handwritten notes photo, or YouTube lecture to study your personal material, or explore the separate <strong>Syllabus</strong> and <strong>Chapter Notes</strong> tabs.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onOpenUploadModal && (
                  <button
                    type="button"
                    data-testid="study-empty-upload-btn"
                    onClick={onOpenUploadModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Upload My Material</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHubSection('syllabus')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-bold text-ink cursor-pointer"
                >
                  <span>Browse JEE Syllabus →</span>
                </button>
              </div>
            </div>
          )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1 border-b border-line">
        <div className="space-y-1.5 min-w-0 flex-1">
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
            Read and annotate your material on the left, and ask the JEE AI Tutor on the right. Drag the center divider to resize.
          </p>
        </div>

        {/* Mode Actions: Chapter Quiz | Adaptive Drill | Voice Tutor */}
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {subMode !== 'explain' && (
            <button
              type="button"
              onClick={() => setSubMode('explain')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-canvas hover:bg-soft text-xs font-semibold text-ink cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-muted" />
              <span>Back to Notes</span>
            </button>
          )}

          <button
            type="button"
            data-testid="study-chapter-quiz-btn"
            onClick={() => {
              if (subMode === 'quiz') {
                setSubMode('explain');
              } else {
                setSubMode('quiz');
                if (quizQuestions.length === 0 && !isGeneratingQuiz) {
                  void handleGenerateDiagnosticQuiz(false);
                }
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              subMode === 'quiz'
                ? 'lm-btn-accent shadow-2xs'
                : 'border border-line bg-white hover:bg-canvas text-ink'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-brand" />
            <span>Chapter Quiz</span>
          </button>

          <button
            type="button"
            data-testid="study-adaptive-drill-btn"
            onClick={() => {
              if (subMode === 'adaptive') {
                setSubMode('explain');
              } else {
                setSubMode('adaptive');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              subMode === 'adaptive'
                ? 'lm-btn-accent shadow-2xs'
                : 'border border-line bg-white hover:bg-canvas text-ink'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-brand" />
            <span>Adaptive Drill</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            data-testid="open-voice-tutor-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-white hover:bg-canvas text-xs font-semibold text-ink cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5 text-brand" />
            <span>Voice Tutor</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MOBILE "READ / ASK" SEGMENTED SWITCH (<1024px)
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
          RESIZABLE SIDE-BY-SIDE DESKTOP SPLIT PANE + FULL-SCREEN TOGGLES
         ===================================================================== */}
      {subMode === 'explain' && (
        <div
          ref={splitContainerRef}
          data-testid="study-resizable-split-pane"
          className={`flex flex-col lg:flex-row items-stretch gap-5 lg:gap-0 ${
            maximizedPane === 'none' ? 'lg:h-[calc(100dvh-14.5rem)] lg:min-h-[540px]' : ''
          }`}
        >
          {/* LEFT PANE: STUDY MATERIAL READER + INLINE ANNOTATIONS */}
          <div
            style={{
              width:
                maximizedPane === 'reader'
                  ? '100%'
                  : maximizedPane === 'tutor'
                  ? '0%'
                  : undefined,
              flexBasis:
                maximizedPane === 'none' ? `${readerSplitPct}%` : undefined,
            }}
            className={`lm-card-editorial overflow-hidden flex flex-col min-h-0 transition-all duration-150 ${
              maximizedPane === 'tutor'
                ? 'hidden'
                : mobilePane === 'ask'
                ? 'hidden lg:flex'
                : 'flex'
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
                    {documents.length > 0 ? (
                      documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))
                    ) : (
                      <option value={activeDocument.id}>{activeDocument.title}</option>
                    )}
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

                {/* Inline Annotation Toggle (Merged into Study Reader) */}
                <button
                  type="button"
                  data-testid="study-annotate-btn"
                  onClick={() => setInlineAnnotateActive((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                    inlineAnnotateActive
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white border-line hover:border-brand text-brand'
                  }`}
                  title="Toggle inline PDF & page annotations (Highlight, Pen, Eraser, Page Note)"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{inlineAnnotateActive ? 'Hide Annotations' : 'Annotate'}</span>
                </button>

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

                {/* Full-Screen Maximize Reader Toggle */}
                <button
                  type="button"
                  data-testid="maximize-reader-btn"
                  onClick={() =>
                    setMaximizedPane((prev) => (prev === 'reader' ? 'none' : 'reader'))
                  }
                  className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-line hover:border-brand text-xs font-semibold text-ink cursor-pointer"
                  title={maximizedPane === 'reader' ? 'Restore split view' : 'Maximize Reader'}
                >
                  {maximizedPane === 'reader' ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-brand" />
                      <span>Split View</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-brand" />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inline Annotation Toolbar (Merged directly into Study Document Reader) */}
            {inlineAnnotateActive && (
              <div
                data-testid="inline-reader-annotation-toolbar"
                className="px-4 py-2.5 bg-brand-soft/40 border-b border-brand/20 flex flex-wrap items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-brand uppercase tracking-wider text-[10px] mr-1">
                    Page {currentPage} Annotations:
                  </span>
                  <button
                    type="button"
                    data-testid="inline-tool-highlight"
                    onClick={() => setInlineTool('highlight')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                      inlineTool === 'highlight'
                        ? 'bg-amber-200 border-amber-400 text-amber-950'
                        : 'bg-white border-line text-ink'
                    }`}
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Select Text to Highlight</span>
                  </button>
                  <button
                    type="button"
                    data-testid="inline-tool-pen"
                    onClick={() => setInlineTool('pen')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                      inlineTool === 'pen'
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white border-line text-ink'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Freehand Ink Pen</span>
                  </button>
                  <button
                    type="button"
                    data-testid="inline-tool-eraser"
                    onClick={() => setInlineTool('eraser')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                      inlineTool === 'eraser'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white border-line text-ink'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Eraser</span>
                  </button>

                  {inlineTool === 'pen' && (
                    <div className="inline-flex items-center gap-1 ml-1">
                      {['#4F46E5', '#DC2626', '#059669', '#D97706'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setInlinePenColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-5 h-5 rounded-full border-2 cursor-pointer ${
                            inlinePenColor === color ? 'border-slate-900 scale-110' : 'border-white'
                          }`}
                          aria-label={`Select ink color ${color}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {onOpenPdfWorkspace && (
                    <button
                      type="button"
                      onClick={onOpenPdfWorkspace}
                      className="px-2.5 py-1 rounded-lg bg-white border border-line hover:border-brand text-[11px] font-semibold text-brand cursor-pointer"
                    >
                      Export Annotated PDF →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Official YouTube Player + Timestamped Sections */}
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
              <div className="px-4 py-2 bg-canvas dark:bg-[#162038] border-b border-line flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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

            {/* Main Reader Content Body + Optional Freehand Ink Overlay */}
            <div
              className="relative p-6 sm:p-8 lg:p-10 bg-white space-y-5 flex-1 min-h-[420px] lg:min-h-0 lg:overflow-y-auto"
              onMouseUp={handleReaderSelection}
            >
              {inlineAnnotateActive && (inlineTool === 'pen' || inlineTool === 'eraser') && (
                <canvas
                  ref={inkCanvasRef}
                  width={960}
                  height={640}
                  onPointerDown={handleInkPointerDown}
                  onPointerMove={handleInkPointerMove}
                  onPointerUp={handleInkPointerUp}
                  className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none"
                />
              )}

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
                              ? 'bg-[#FEF9C3] dark:bg-amber-500/20 dark:text-amber-100 ring-1 ring-amber-300 dark:ring-amber-500/40 px-2.5 py-1.5 -mx-2'
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

              {/* Inline Page Margin Note Box */}
              {inlineAnnotateActive && (
                <div className="pt-4 border-t border-line space-y-1.5 relative z-20">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                    <StickyNote className="w-3.5 h-3.5 text-brand" />
                    <span>Personal Margin Note for Page {currentPage}</span>
                  </label>
                  <textarea
                    rows={2}
                    value={inlinePageNotes[currentPage] || ''}
                    onChange={(e) =>
                      setInlinePageNotes((prev) => ({
                        ...prev,
                        [currentPage]: e.target.value,
                      }))
                    }
                    placeholder="Jot down a key formula, trick, or reminder for this page…"
                    className="w-full rounded-xl border border-line bg-canvas p-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand"
                  />
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP DRAGGABLE RESIZE HANDLE */}
          {maximizedPane === 'none' && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Document Reader and AI Tutor panes"
              data-testid="study-split-resizer"
              onMouseDown={handleStartSplitDrag}
              className="hidden lg:flex w-4 shrink-0 items-center justify-center cursor-col-resize group select-none"
              title="Drag to resize Document Reader and AI Tutor"
            >
              <div className="w-1 h-16 rounded-full bg-slate-200 group-hover:bg-brand transition-colors flex items-center justify-center">
                <GripVertical className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand" />
              </div>
            </div>
          )}

          {/* RIGHT PANE: STREAMLINED WRITTEN JEE AI STUDY TUTOR */}
          <aside
            aria-label="Interactive Study Companion"
            style={{
              width:
                maximizedPane === 'tutor'
                  ? '100%'
                  : maximizedPane === 'reader'
                  ? '0%'
                  : undefined,
              flexBasis:
                maximizedPane === 'none' ? `${100 - readerSplitPct}%` : undefined,
            }}
            className={`lm-card-editorial overflow-hidden flex flex-col min-h-[480px] lg:min-h-0 lg:h-full transition-all duration-150 ${
              maximizedPane === 'reader'
                ? 'hidden'
                : mobilePane === 'read'
                ? 'hidden lg:flex'
                : 'flex'
            }`}
          >
            {/* Streamlined Tutor Header: ONLY Source Mode Toggle ("Notes + JEE knowledge" vs "Only my notes") + Full-Screen Toggle */}
            <div className="px-4 py-3.5 border-b border-line bg-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-ink">AI Study Tutor</h2>
                  <p className="text-[11px] text-muted">
                    KaTeX math &amp; highlighted step-by-step JEE solutions
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
                    title="Default: Uses your notes first and adds JEE Main formulas & examples when helpful"
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

                {/* Full-Screen Maximize AI Tutor Toggle */}
                <button
                  type="button"
                  data-testid="maximize-tutor-btn"
                  onClick={() =>
                    setMaximizedPane((prev) => (prev === 'tutor' ? 'none' : 'tutor'))
                  }
                  className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-line hover:border-brand text-[11px] font-semibold text-ink cursor-pointer"
                  title={maximizedPane === 'tutor' ? 'Restore split view' : 'Maximize AI Tutor'}
                >
                  {maximizedPane === 'tutor' ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-brand" />
                      <span>Split View</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-brand" />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Clean Conversation Stream (No starter chips or preset mode pills) */}
            <div
              ref={tutorScrollRef}
              className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto max-h-[540px] lg:max-h-none bg-white"
            >
              {tutorMessages.length === 0 && (
                <div className="p-6 rounded-2xl bg-canvas border border-dashed border-line text-center space-y-2 my-6">
                  <Sparkles className="w-6 h-6 text-brand mx-auto" />
                  <h3 className="text-sm font-bold text-ink">
                    Ask any doubt about Page {currentPage} ({activePageLabel})
                  </h3>
                  <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                    Type your question in your own words below or highlight any sentence in the reader. The AI Tutor replies with KaTeX mathematical expressions and <strong>bold</strong> / <em>italic</em> highlights.
                  </p>
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
                    className="bg-canvas dark:bg-[#162038] rounded-2xl border border-line p-4 space-y-3"
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
                      <div className="space-y-2.5 pt-1">
                        {/* Phase 6 Section 5: Contextual AI Study Tutor -> Create Integration */}
                        {onOpenContextualCreate && (() => {
                          const msgIdx = tutorMessages.findIndex((m) => m.id === msg.id);
                          const prevUserMsg =
                            msgIdx > 0 && tutorMessages[msgIdx - 1]?.role === 'user'
                              ? tutorMessages[msgIdx - 1].content
                              : lastAskedQuestion || activePageLabel;
                          const intent = detectContextualCreateIntent({
                            question: prevUserMsg,
                            answer: msg.content,
                            topic:
                              msg.relatedTopics?.[0] ||
                              activePageTopic?.name ||
                              activePageLabel,
                            subject: documentSubject || 'Physics',
                          });
                          if (!intent.shouldSuggestVisual) return null;

                          const triggerCreateMode = (mode: ContextualCreateAction) => {
                            const citedNums =
                              msg.citations && msg.citations.length > 0
                                ? msg.citations.map((c) => c.pageNumber)
                                : [currentPage];
                            onOpenContextualCreate({
                              sourceTutorMessageId: msg.id,
                              question: prevUserMsg,
                              tutorAnswerExcerpt: msg.content.slice(0, 900),
                              conceptTitle: intent.recommendedConceptTitle,
                              topic:
                                msg.relatedTopics?.[0] ||
                                activePageTopic?.name ||
                                activePageLabel,
                              subject:
                                (documentSubject as 'Physics' | 'Chemistry' | 'Mathematics' | 'General') ||
                                'Physics',
                              documentId: activeDocument.id,
                              documentTitle: activeDocument.title,
                              citedPages: citedNums,
                              selectedMode: mode,
                            });
                          };

                          return (
                            <div
                              data-testid="tutor-contextual-create-bar"
                              className="p-2.5 rounded-xl bg-brand-soft/45 border border-brand-200 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Visual Concept Studio • {intent.reason}</span>
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  data-testid="contextual-create-diagram-btn"
                                  onClick={() => triggerCreateMode('create_diagram')}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-brand hover:text-white border border-brand-200 text-[11px] font-bold text-brand transition-colors cursor-pointer"
                                >
                                  Create Diagram
                                </button>
                                <button
                                  type="button"
                                  data-testid="contextual-create-visual-btn"
                                  onClick={() => triggerCreateMode('visual_understanding')}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-brand hover:text-white border border-brand-200 text-[11px] font-bold text-brand transition-colors cursor-pointer"
                                >
                                  Visual Understanding
                                </button>
                                <button
                                  type="button"
                                  data-testid="contextual-create-animated-btn"
                                  onClick={() => triggerCreateMode('animated_explanation')}
                                  className="px-2.5 py-1 rounded-lg bg-brand hover:bg-brand-strong text-white text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  Animated Explanation
                                </button>
                                <button
                                  type="button"
                                  data-testid="contextual-create-video-btn"
                                  onClick={() => triggerCreateMode('video_style_explanation')}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-brand hover:text-white border border-brand-200 text-[11px] font-bold text-brand transition-colors cursor-pointer"
                                >
                                  Video-style Explanation
                                </button>
                              </div>
                            </div>
                          );
                        })()}
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

                <div className="p-5 sm:p-6 rounded-2xl bg-canvas dark:bg-[#162038] border border-line space-y-4">
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
                      ? 'bg-brand text-white border-brand'
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
        </>
      )}

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
