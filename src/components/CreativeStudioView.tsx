import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video,
  Play,
  Pause,
  Bookmark,
  CheckCircle2,
  Trash2,
  Upload,
  Download,
  Eye,
  X,
  Sparkles,
  Layers,
  BookOpen,
  Filter,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  RotateCcw,
  HelpCircle,
  Target,
  Lightbulb,
  ArrowRight,
  Award,
} from 'lucide-react';
import type { StudyDocument, CreativeAsset, ThemeMode } from '../types/study';
import type { StructuredDiagramSpec } from '../types/diagram';
import { studyStorage } from '../services/storageService';
import {
  aiStudyClient,
  type VisualizeConceptResponse,
  type VideoLessonResponse,
} from '../services/aiClient';
import { DiagramRenderer } from './DiagramRenderer';
import { ReportButton } from './ReportButton';
import { MathText } from './MathText';
import {
  stopAllGlobalAudioAndSpeech,
  type ContextualCreateTransferPayload,
} from '../utils/phase6Engine';
import {
  serializeDiagramSpecToSvg,
  getDeterministicDiagramTemplate,
} from '../utils/diagramEngine';
import {
  buildAnimatedExplanationScenes,
  buildDeterministicSceneConceptCheck,
  buildDeterministicSceneReteaching,
  computeLessonMasteryAndRecommendation,
  createInitialSceneMasteryMap,
  createInitialScenePlayerState,
  evaluateConceptCheckSubmission,
  getHighlightedDiagramSpecForReteaching,
  getSceneSpecForProgressiveStep,
  resolveSupportedCitedPages,
  skipSceneConceptCheck,
  transitionScenePlayerState,
  validateAndSanitizeAnimatedExplanation,
  type ConceptCheckDifficulty,
  type RecommendedNextAction,
  type SceneConceptCheckQuestion,
  type SceneConceptMasteryState,
  type ScenePlayerAction,
  type ScenePlayerState,
} from '../utils/educationalSpecsEngine';

interface CreativeStudioViewProps {
  documents: StudyDocument[];
  activeDocument: StudyDocument;
  onSelectDocument: (id: string) => void;
  themeMode?: ThemeMode;
  onNavigateToPage?: (pageNumber: number) => void;
  onNavigateTab?: (tab: 'practice' | 'revision' | 'study') => void;
  contextualTransfer?: ContextualCreateTransferPayload | null;
  onReturnToTutor?: () => void;
}

type StudioSubTab = 'visualize' | 'videolesson' | 'saved';

interface PresetItem {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  label: string;
  category: string;
  concept: string;
}

const JEE_PRESETS: PresetItem[] = [
  {
    subject: 'Physics',
    label: 'Block on Incline FBD',
    category: 'free_body_diagram',
    concept: 'Free body diagram of a block on an inclined plane with gravity (mg), normal force (N), and friction (f_s)',
  },
  {
    subject: 'Physics',
    label: 'Convex Lens Ray Optics',
    category: 'ray_optics',
    concept: 'Ray optics convex lens forming a real inverted image beyond 2F with focal points and parallel/focal rays',
  },
  {
    subject: 'Physics',
    label: 'RC Charging Circuit',
    category: 'circuit_diagram',
    concept: 'Series RC charging circuit with DC battery voltage V, resistor R, capacitor C, and switch',
  },
  {
    subject: 'Chemistry',
    label: 'H2O Bent Molecule (VSEPR)',
    category: 'molecular_shape',
    concept: 'H2O water molecule bent VSEPR geometry with 104.5° bond angle and two non-bonding lone pairs',
  },
  {
    subject: 'Chemistry',
    label: 'PCl5 Trigonal Bipyramidal',
    category: 'molecular_shape',
    concept: 'PCl5 phosphorus pentachloride trigonal bipyramidal geometry with axial (180°) and equatorial (120°) bonds',
  },
  {
    subject: 'Mathematics',
    label: 'Parabola y² = 4ax',
    category: 'conic_section',
    concept: 'Parabola y²=4ax with focus S(a, 0), directrix x = -a, vertex at origin (0, 0), and latus rectum',
  },
  {
    subject: 'Mathematics',
    label: 'Ellipse with Foci & Axes',
    category: 'conic_section',
    concept: 'Standard ellipse x²/a² + y²/b² = 1 with foci S and S\', major and minor axes, and directrices',
  },
];

export const CreativeStudioView: React.FC<CreativeStudioViewProps> = ({
  documents,
  activeDocument,
  onSelectDocument,
  themeMode = 'light',
  onNavigateToPage,
  onNavigateTab,
  contextualTransfer,
  onReturnToTutor,
}) => {
  const isDark = themeMode === 'dark';
  const [subTab, setSubTab] = useState<StudioSubTab>('visualize');
  const [selectedTopic, setSelectedTopic] = useState<string>(
    activeDocument.topics[0]?.name || activeDocument.title
  );
  const [savedAssets, setSavedAssets] = useState<CreativeAsset[]>(() =>
    studyStorage.getCreativeAssets()
  );
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Saved Assets Filter & Modal
  const [savedFilter, setSavedFilter] = useState<'current' | 'all'>('current');
  const [inspectingAsset, setInspectingAsset] = useState<CreativeAsset | null>(null);

  useEffect(() => {
    setSelectedTopic(activeDocument.topics[0]?.name || activeDocument.title);
  }, [activeDocument.id, activeDocument.title, activeDocument.topics]);

  const handleSaveCreativeAsset = (
    type: CreativeAsset['type'],
    title: string,
    payload: Record<string, any>
  ) => {
    const asset: CreativeAsset = {
      id: `creative-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      type,
      documentId: activeDocument.id,
      topic: selectedTopic,
      difficulty: 'medium',
      payload,
      createdAt: new Date().toISOString(),
    };
    studyStorage.saveCreativeAsset(asset);
    setSavedAssets(studyStorage.getCreativeAssets());
    setSaveToast(`Saved "${title}" to your Studio Library!`);
    setTimeout(() => setSaveToast(null), 3200);
  };

  /* =====================================================================
   * 1. VISUALIZE CONCEPT (Phase 5.1 Diagram Maker)
   * ===================================================================== */
  const [visualConceptInput, setVisualConceptInput] = useState(selectedTopic);
  const [visualCategory, setVisualCategory] = useState<string>('auto');
  const [visualResult, setVisualResult] = useState<VisualizeConceptResponse | null>(null);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<
    'all' | 'Physics' | 'Chemistry' | 'Mathematics'
  >('all');

  useEffect(() => {
    setVisualConceptInput(selectedTopic);
    setVideoTopicInput(selectedTopic);
  }, [selectedTopic]);

  const handleRunVisualize = async (conceptOverride?: string, categoryOverride?: string) => {
    const targetConcept = (conceptOverride ?? visualConceptInput).trim();
    if (!targetConcept) return;

    const targetCategory = categoryOverride ?? visualCategory;
    setIsVisualizing(true);

    // Extract relevant study excerpts from the active document
    const queryWords = targetConcept
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);

    let scoredPages = activeDocument.pages.map((p) => {
      const text = p.content.toLowerCase();
      const score = queryWords.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
      return { page: p, score };
    });

    // Sort by relevance score
    scoredPages.sort((a, b) => b.score - a.score);

    const relevantPages =
      scoredPages[0]?.score > 0
        ? scoredPages.filter((sp) => sp.score > 0).slice(0, 3).map((sp) => sp.page)
        : activeDocument.pages.slice(0, 2);

    const citedPages = relevantPages.map((p) => p.pageNumber);
    const contextText = relevantPages
      .map((p) => `Page ${p.pageNumber}:\n${p.content}`)
      .join('\n\n');

    try {
      const res = await aiStudyClient.visualizeConcept({
        concept: targetConcept,
        contextText,
        style: targetCategory as any,
        documentTitle: activeDocument.title,
        citedPages,
      });

      // Guard: ensure spec is populated
      if (!res.spec) {
        res.spec = getDeterministicDiagramTemplate(
          targetConcept,
          targetCategory as any,
          citedPages
        );
      }
      setVisualResult(res);
    } catch (err) {
      // Deterministic verified template fallback
      const fallbackSpec = getDeterministicDiagramTemplate(
        targetConcept,
        targetCategory as any,
        citedPages
      );
      setVisualResult({
        concept: targetConcept,
        style: targetCategory as any,
        isAiGenerated: false,
        verificationStatus: 'FALLBACK',
        modelNotice:
          err instanceof Error
            ? `AI service offline: ${err.message}. Showing verified schematic template.`
            : 'AI service offline. Showing verified schematic template.',
        spec: fallbackSpec,
        diagramSteps: fallbackSpec.elements
          .filter((e) => e.kind === 'text')
          .slice(0, 4)
          .map((e: any, idx) => ({
            step: idx + 1,
            title: e.text || `Step ${idx + 1}`,
            detail: `Coordinate (${e.x}, ${e.y})`,
            color: e.color || '#4F46E5',
          })),
      });
    } finally {
      setIsVisualizing(false);
    }
  };

  const isCurrentVisualSaved = Boolean(
    visualResult?.spec &&
      savedAssets.some(
        (a) =>
          a.documentId === activeDocument.id &&
          (a.title === visualResult.spec?.title ||
            a.payload?.spec?.title === visualResult.spec?.title)
      )
  );

  const handleDownloadAssetSvg = (spec: StructuredDiagramSpec, title: string) => {
    const svgContent = serializeDiagramSpecToSvg(spec, isDark);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (title || 'diagram')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '');
    a.href = url;
    a.download = `LearnMate-${safeTitle}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* =====================================================================
   * 2. ANIMATED CONCEPT EXPLANATION (Phase 5.2 - Higgsfield Paused)
   * ===================================================================== */
  const [videoTopicInput, setVideoTopicInput] = useState(selectedTopic);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoSourceImage, setVideoSourceImage] = useState<string | undefined>(undefined);
  const [videoResult, setVideoResult] = useState<VideoLessonResponse | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [playerState, setPlayerState] = useState<ScenePlayerState>(() =>
    createInitialScenePlayerState()
  );

  const playbackTimerRef = useRef<number | null>(null);

  const cancelSpeechAndTimers = useCallback(() => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    stopAllGlobalAudioAndSpeech('creative_studio_scene_transition');
  }, []);

  const dispatchPlayer = useCallback(
    (action: ScenePlayerAction) => {
      setPlayerState((prev) => transitionScenePlayerState(prev, action, cancelSpeechAndTimers));
    },
    [cancelSpeechAndTimers]
  );

  // Cancel narration when leaving the Animated Explanation subTab, switching documents, or unmounting
  useEffect(() => {
    if (subTab !== 'videolesson') {
      dispatchPlayer({ type: 'LEAVE_CREATE' });
    }
  }, [subTab, dispatchPlayer]);

  useEffect(() => {
    return () => {
      cancelSpeechAndTimers();
    };
  }, [activeDocument.id, cancelSpeechAndTimers]);

  const currentScenes = videoResult?.scenes || [];
  const activeScene =
    currentScenes[Math.min(playerState.activeSceneIndex, Math.max(0, currentScenes.length - 1))];
  const activeSceneSteps = activeScene?.progressiveSteps || [];

  /* =====================================================================
   * PHASE 5.3 — INTERACTIVE CONCEPT MASTERY & ADAPTIVE RETEACHING STATE
   * ===================================================================== */
  const [masteryByScene, setMasteryByScene] = useState<Record<number, SceneConceptMasteryState>>(
    {}
  );
  const [isCheckOpen, setIsCheckOpen] = useState<boolean>(false);
  const [isReteachingOpen, setIsReteachingOpen] = useState<boolean>(false);
  const [customQuestionsByScene, setCustomQuestionsByScene] = useState<
    Record<number, SceneConceptCheckQuestion>
  >({});
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [numericalInputText, setNumericalInputText] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRefreshingQuestion, setIsRefreshingQuestion] = useState<boolean>(false);
  const [mistakeDnaSyncNotice, setMistakeDnaSyncNotice] = useState<string | null>(null);
  const conceptRequestEpochRef = useRef<number>(0);

  // Reset per-scene transient input UI when switching scenes while preserving persisted mastery state
  useEffect(() => {
    conceptRequestEpochRef.current += 1;
    setSelectedMcqOption(null);
    setNumericalInputText('');
    setValidationError(null);
    setMistakeDnaSyncNotice(null);
    setIsRefreshingQuestion(false);
    const scNum = activeScene?.sceneNumber || 1;
    const scMastery = masteryByScene[scNum];
    setIsReteachingOpen(Boolean(scMastery?.status === 'needs_reteaching'));
  }, [playerState.activeSceneIndex, activeScene?.sceneNumber]);

  const activeSceneNum = activeScene?.sceneNumber || 1;
  const activeSceneMastery: SceneConceptMasteryState | undefined = masteryByScene[activeSceneNum];

  const activeQuestion: SceneConceptCheckQuestion | undefined = activeScene
    ? customQuestionsByScene[activeSceneNum] ||
      activeScene.conceptCheck ||
      buildDeterministicSceneConceptCheck(activeScene, {
        topic: videoResult?.topic || selectedTopic,
        difficulty: activeSceneMastery?.activeVariant || 'standard',
        sourceDocumentTitle: activeDocument.title,
      })
    : undefined;

  const activeReteaching = activeScene
    ? activeScene.reteaching ||
      buildDeterministicSceneReteaching(activeScene, {
        topic: videoResult?.topic || selectedTopic,
        sourceDocumentTitle: activeDocument.title,
      })
    : undefined;

  const lessonMasterySummary =
    videoResult && videoResult.scenes.length > 0
      ? computeLessonMasteryAndRecommendation(videoResult.scenes, masteryByScene)
      : null;

  const initializeOrRestoreLessonMastery = useCallback(
    (
      docId: string,
      topic: string,
      scenes: VideoLessonResponse['scenes'],
      savedMastery?: Record<number, SceneConceptMasteryState>
    ) => {
      const stored = savedMastery || studyStorage.getLessonMasteryState(docId, topic);
      const base = createInitialSceneMasteryMap(scenes);
      if (stored && typeof stored === 'object') {
        for (const sc of scenes) {
          if (stored[sc.sceneNumber]) {
            base[sc.sceneNumber] = stored[sc.sceneNumber];
          }
        }
      }
      setMasteryByScene(base);
      setCustomQuestionsByScene({});
      setIsCheckOpen(false);
      setIsReteachingOpen(false);
      setSelectedMcqOption(null);
      setNumericalInputText('');
      setValidationError(null);
      setMistakeDnaSyncNotice(null);
    },
    []
  );

  const handleOpenConceptCheck = () => {
    dispatchPlayer({ type: 'OPEN_CONCEPT_CHECK' });
    setIsCheckOpen(true);
    setValidationError(null);
  };

  const handleLoadQuestionVariant = async (
    variant: ConceptCheckDifficulty,
    useLiveAi = false
  ) => {
    if (!activeScene || !videoResult) return;
    dispatchPlayer({ type: 'OPEN_CONCEPT_CHECK' });
    setIsCheckOpen(true);
    setSelectedMcqOption(null);
    setNumericalInputText('');
    setValidationError(null);

    if (!useLiveAi) {
      const nextQ =
        variant === 'reteach' && activeReteaching?.followUpQuestion
          ? activeReteaching.followUpQuestion
          : buildDeterministicSceneConceptCheck(activeScene, {
              topic: videoResult.topic,
              difficulty: variant,
              sourceDocumentTitle: activeDocument.title,
            });
      setCustomQuestionsByScene((prev) => ({
        ...prev,
        [activeScene.sceneNumber]: nextQ,
      }));
      return;
    }

    const requestEpoch = ++conceptRequestEpochRef.current;
    setIsRefreshingQuestion(true);
    const { contextText, citedPages, validPageNumbers } = extractDocumentContextForTopic(
      videoResult.topic
    );

    try {
      const res = await aiStudyClient.generateConceptCheck({
        topic: videoResult.topic,
        sceneNumber: activeScene.sceneNumber,
        heading: activeScene.heading,
        teachingPoint: activeScene.teachingPoint,
        keyFormula: activeScene.keyFormula,
        difficulty: variant,
        contextText,
        documentTitle: activeDocument.title,
        citedPages,
        validPageNumbers,
        preferredLanguage: studyStorage.getStudentProfile()?.preferredLanguage,
      });
      if (conceptRequestEpochRef.current !== requestEpoch) return;
      setCustomQuestionsByScene((prev) => ({
        ...prev,
        [activeScene.sceneNumber]: res.question,
      }));
    } catch {
      if (conceptRequestEpochRef.current !== requestEpoch) return;
      const fallbackQ = buildDeterministicSceneConceptCheck(activeScene, {
        topic: videoResult.topic,
        difficulty: variant,
        sourceDocumentTitle: activeDocument.title,
      });
      setCustomQuestionsByScene((prev) => ({
        ...prev,
        [activeScene.sceneNumber]: fallbackQ,
      }));
    } finally {
      if (conceptRequestEpochRef.current === requestEpoch) {
        setIsRefreshingQuestion(false);
      }
    }
  };

  const handleSubmitConceptCheck = () => {
    if (!activeScene || !activeQuestion || !videoResult) return;
    dispatchPlayer({ type: 'PAUSE' });

    const evalResult = evaluateConceptCheckSubmission({
      question: activeQuestion,
      selectedOptionIndex: selectedMcqOption ?? undefined,
      enteredNumericalText: numericalInputText,
      previousSceneState: masteryByScene[activeScene.sceneNumber],
      documentId: activeDocument.id,
      documentTitle: activeDocument.title,
    });

    if (!evalResult.validSubmission || !evalResult.attemptRecord) {
      setValidationError(evalResult.validationError || 'Please provide a valid answer.');
      return;
    }

    setValidationError(null);
    const updatedMap: Record<number, SceneConceptMasteryState> = {
      ...masteryByScene,
      [activeScene.sceneNumber]: evalResult.nextSceneState,
    };
    setMasteryByScene(updatedMap);
    studyStorage.saveLessonMasteryState(activeDocument.id, videoResult.topic, updatedMap);

    const dnaSync = studyStorage.saveConceptCheckAttempt(
      evalResult.attemptRecord,
      evalResult.nextSceneState
    );

    if (dnaSync.evidenceLevel === 'repeated_misconception') {
      setMistakeDnaSyncNotice(
        'Synced to Mistake DNA & High-Priority Revision Plan (repeated misconception detected).'
      );
      setIsReteachingOpen(true);
      dispatchPlayer({
        type: 'START_RETEACHING',
        totalSteps: activeSceneSteps.length,
      });
    } else if (dnaSync.evidenceLevel === 'recovered_after_reteaching') {
      setMistakeDnaSyncNotice(
        'Recovery recorded in Mistake DNA! Revision priority downgraded to medium.'
      );
    } else {
      setMistakeDnaSyncNotice(null);
    }
  };

  const handleSkipConceptCheck = () => {
    if (!activeScene || !videoResult) return;
    dispatchPlayer({ type: 'PAUSE' });
    setValidationError(null);
    const nextSceneState = skipSceneConceptCheck(
      masteryByScene[activeScene.sceneNumber],
      activeScene.sceneNumber
    );
    const updatedMap: Record<number, SceneConceptMasteryState> = {
      ...masteryByScene,
      [activeScene.sceneNumber]: nextSceneState,
    };
    setMasteryByScene(updatedMap);
    studyStorage.saveLessonMasteryState(activeDocument.id, videoResult.topic, updatedMap);
  };

  const handleExecuteRecommendedAction = (action: RecommendedNextAction) => {
    if (!videoResult) return;
    if (action.targetTab && onNavigateTab) {
      dispatchPlayer({ type: 'LEAVE_CREATE' });
      onNavigateTab(action.targetTab);
      return;
    }
    if (typeof action.targetSceneNumber === 'number') {
      const targetIdx = Math.max(
        0,
        Math.min(videoResult.scenes.length - 1, action.targetSceneNumber - 1)
      );
      dispatchPlayer({
        type: 'SELECT_SCENE',
        sceneIndex: targetIdx,
        totalScenes: videoResult.scenes.length,
      });
    }
    if (action.kind === 'open_visual_reteaching') {
      setIsCheckOpen(true);
      setIsReteachingOpen(true);
      dispatchPlayer({
        type: 'START_RETEACHING',
        totalSteps: activeSceneSteps.length,
      });
    } else if (action.kind === 'try_challenge') {
      void handleLoadQuestionVariant('challenge', false);
    } else if (action.kind === 'review_and_retry_scene') {
      void handleLoadQuestionVariant('reteach', false);
    } else if (action.kind === 'resume_scene' || action.kind === 'continue_next_scene') {
      setIsCheckOpen(true);
    }
  };

  // Handle narrated slideshow playback & progressive step advancement
  useEffect(() => {
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (!playerState.isOpen || !playerState.isPlaying || !activeScene) {
      return;
    }

    // Trigger speech synthesis at step 0 of the active scene when not muted
    if (
      playerState.activeStepIndex === 0 &&
      !playerState.isMuted &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    ) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          `${activeScene.heading}. ${activeScene.teachingPoint} ${activeScene.narration}`
        );
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore speech synthesis errors in environments without audio devices
      }
    }

    const totalSteps = Math.max(1, activeSceneSteps.length);
    const stepDurationMs = Math.max(
      2400,
      Math.round(((activeScene.durationSeconds || 8) * 1000) / totalSteps)
    );

    playbackTimerRef.current = window.setTimeout(() => {
      dispatchPlayer({
        type: 'NEXT_STEP',
        totalSteps,
        totalScenes: currentScenes.length,
        autoAdvanceScene: true,
      });
    }, stepDurationMs);

    return () => {
      if (playbackTimerRef.current !== null) {
        window.clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [
    playerState.isOpen,
    playerState.isPlaying,
    playerState.activeSceneIndex,
    playerState.activeStepIndex,
    playerState.isMuted,
    activeScene,
    activeSceneSteps.length,
    currentScenes.length,
    dispatchPlayer,
  ]);

  const extractDocumentContextForTopic = useCallback(
    (targetTopic: string) => {
      const validPageNumbers = activeDocument.pages.map((p) => p.pageNumber);
      const fullDocumentContext = activeDocument.pages
        .map((p) => `[Page ${p.pageNumber}]\n${p.content}`)
        .join('\n\n');

      const supportCheck = resolveSupportedCitedPages(
        targetTopic,
        fullDocumentContext,
        undefined,
        validPageNumbers
      );

      if (supportCheck.isSupported && supportCheck.citedPages.length > 0) {
        const citedSet = new Set(supportCheck.citedPages);
        const matchedPages = activeDocument.pages.filter((p) => citedSet.has(p.pageNumber));
        const contextText = matchedPages
          .map((p) => `[Page ${p.pageNumber}]\n${p.content}`)
          .join('\n\n');
        return {
          contextText,
          citedPages: supportCheck.citedPages,
          validPageNumbers,
          isSupported: true,
        };
      }

      // Topic is not in the uploaded pages; still pass full document context so server can verify
      const fallbackContext = activeDocument.pages
        .slice(0, 3)
        .map((p) => `[Page ${p.pageNumber}]\n${p.content}`)
        .join('\n\n');
      return {
        contextText: fallbackContext,
        citedPages: [],
        validPageNumbers,
        isSupported: false,
      };
    },
    [activeDocument.pages]
  );

  const isGeneratingVideoRef = useRef<boolean>(false);
  const videoLessonCacheRef = useRef<Map<string, VideoLessonResponse>>(new Map());

  const handleRunVideoLesson = async (topicOverride?: string, forceRegenerate = false) => {
    if (isGeneratingVideoRef.current) return;
    const targetTopic = (topicOverride ?? videoTopicInput).trim() || selectedTopic || 'Core Concept';
    if (topicOverride) {
      setVideoTopicInput(topicOverride);
    }

    const cacheKey = `${activeDocument.id}::${targetTopic.toLowerCase()}::${videoAspectRatio}`;
    if (!forceRegenerate && !videoSourceImage && videoLessonCacheRef.current.has(cacheKey)) {
      const cached = videoLessonCacheRef.current.get(cacheKey)!;
      cancelSpeechAndTimers();
      setVideoResult(cached);
      initializeOrRestoreLessonMastery(activeDocument.id, targetTopic, cached.scenes);
      setPlayerState((prev) => ({
        ...createInitialScenePlayerState(),
        isMuted: prev.isMuted,
      }));
      return;
    }

    cancelSpeechAndTimers();
    isGeneratingVideoRef.current = true;
    setIsGeneratingVideo(true);

    const { contextText, citedPages, validPageNumbers } =
      extractDocumentContextForTopic(targetTopic);
    const preferredLanguage = studyStorage.getStudentProfile()?.preferredLanguage;

    try {
      const res = await aiStudyClient.generateVideoLesson({
        topic: targetTopic,
        contextText,
        aspectRatio: videoAspectRatio,
        sourceImageDataUrl: videoSourceImage,
        documentTitle: activeDocument.title,
        citedPages,
        validPageNumbers,
        preferredLanguage,
      });

      const validated = validateAndSanitizeAnimatedExplanation(
        { scenes: res.scenes },
        {
          topic: targetTopic,
          contextText,
          citedPages: res.citedPages ?? citedPages,
          validPageNumbers,
        }
      );

      const nextVideoResult: VideoLessonResponse = {
        ...res,
        topic: targetTopic,
        citedPages: validated.citedPages,
        isSupportedByMaterial: validated.isSupportedByMaterial,
        scenes: validated.scenes,
      };
      videoLessonCacheRef.current.set(cacheKey, nextVideoResult);
      setVideoResult(nextVideoResult);
      initializeOrRestoreLessonMastery(activeDocument.id, targetTopic, validated.scenes);
      setPlayerState((prev) => ({
        ...createInitialScenePlayerState(),
        isMuted: prev.isMuted,
      }));
    } catch (err) {
      const fallbackScenes = buildAnimatedExplanationScenes(
        targetTopic,
        contextText,
        citedPages,
        validPageNumbers
      );
      const fallbackResult: VideoLessonResponse = {
        topic: targetTopic,
        omniStatus: 'animated_explanation_ready',
        isAiGenerated: false,
        verificationStatus: 'WORKING_WITH_NON_AI_FALLBACK',
        fallbackMode: 'animated_explanation',
        citedPages: fallbackScenes[0]?.citedPages || [],
        isSupportedByMaterial: fallbackScenes[0]?.isSupportedByMaterial || false,
        userFacingNotice:
          err instanceof Error
            ? `Could not reach live AI service (${err.message}). Showing the built-in JEE multi-scene animated explanation template.`
            : 'Could not reach live AI service. Showing the built-in JEE multi-scene animated explanation template.',
        scenes: fallbackScenes,
      };
      videoLessonCacheRef.current.set(cacheKey, fallbackResult);
      setVideoResult(fallbackResult);
      initializeOrRestoreLessonMastery(activeDocument.id, targetTopic, fallbackScenes);
      setPlayerState((prev) => ({
        ...createInitialScenePlayerState(),
        isMuted: prev.isMuted,
      }));
    } finally {
      isGeneratingVideoRef.current = false;
      setIsGeneratingVideo(false);
    }
  };

  const handleUploadVideoSourceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVideoSourceImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Phase 6 Section 5: Automatically apply contextual transfer from AI Study Tutor
  const lastAppliedTransferIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!contextualTransfer) return;
    const transferKey = `${contextualTransfer.sourceTutorMessageId}::${contextualTransfer.selectedMode}`;
    if (lastAppliedTransferIdRef.current === transferKey) return;
    lastAppliedTransferIdRef.current = transferKey;

    const targetConcept =
      contextualTransfer.conceptTitle || contextualTransfer.topic || activeDocument.title;
    setSelectedTopic(contextualTransfer.topic || targetConcept);
    setVisualConceptInput(targetConcept);
    setVideoTopicInput(targetConcept);

    if (
      contextualTransfer.selectedMode === 'create_diagram' ||
      contextualTransfer.selectedMode === 'visual_understanding'
    ) {
      setSubTab('visualize');
      void handleRunVisualize(targetConcept, 'auto');
    } else {
      setSubTab('videolesson');
      void handleRunVideoLesson(targetConcept, false);
    }
  }, [contextualTransfer]);

  // Filtered saved assets
  const filteredSavedAssets = savedAssets.filter((a) => {
    if (savedFilter === 'current') {
      return a.documentId === activeDocument.id;
    }
    return true;
  });

  return (
    <div className="w-full max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6 overflow-x-hidden">
      {/* Phase 6 Section 5: Contextual AI Study Tutor Transfer Banner */}
      {contextualTransfer && (
        <div
          data-testid="contextual-create-banner"
          className="p-3.5 sm:p-4 rounded-2xl bg-brand-soft/60 dark:bg-indigo-950/60 border border-brand-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-brand text-white">
                Transferred from AI Study Tutor
              </span>
              <span className="text-xs font-bold text-ink dark:text-slate-100">
                {contextualTransfer.conceptTitle}
              </span>
              {contextualTransfer.citedPages.length > 0 && (
                <span className="text-[11px] font-semibold text-brand dark:text-indigo-300">
                  (Cited Page {contextualTransfer.citedPages.join(', ')})
                </span>
              )}
            </div>
            <p className="text-xs text-muted dark:text-slate-300 line-clamp-1">
              Question: &ldquo;{contextualTransfer.question}&rdquo;
            </p>
          </div>
          {onReturnToTutor && (
            <button
              type="button"
              data-testid="return-to-tutor-btn"
              onClick={() => {
                cancelSpeechAndTimers();
                onReturnToTutor();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-brand-200 dark:border-indigo-700 text-xs font-bold text-brand dark:text-indigo-300 hover:bg-brand hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Return to AI Tutor Question</span>
            </button>
          )}
        </div>
      )}

      {/* Editorial Header */}
      <div className="space-y-4 border-b border-line dark:border-slate-800 pb-0">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2">
          <div className="space-y-1.5">
            <div className="lm-kicker">CREATE · JEE VISUAL STUDIO</div>
            <h1 className="lm-editorial-title text-3xl sm:text-4xl text-ink dark:text-slate-100">
              Concept diagrams &amp; visual explanations.
            </h1>
            <p className="lm-editorial-subtitle text-sm sm:text-base text-body dark:text-slate-400">
              Generate structured, grounded SVG diagrams for Free-Body Diagrams, Ray Optics, Circuits,
              Molecular VSEPR geometry, and Conic sections from your active study notes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-end max-w-full">
            <select
              aria-label="Select active study document for studio"
              value={activeDocument.id}
              onChange={(e) => onSelectDocument(e.target.value)}
              className="max-w-full px-3 py-2 rounded-lg border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-ink dark:text-slate-100"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Select topic for studio creation"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="max-w-full px-3 py-2 rounded-lg border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-ink dark:text-slate-100"
            >
              {activeDocument.topics.map((t) => (
                <option key={t.id} value={t.name}>
                  Topic: {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:gap-6">
          {(
            [
              { id: 'visualize', label: 'Diagram Maker' },
              { id: 'videolesson', label: 'Animated Explanation (Phase 5.3)' },
              { id: 'saved', label: `Saved Library (${savedAssets.length})` },
            ] as const
          ).map((item) => {
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubTab(item.id)}
                data-testid={`studio-tab-${item.id}`}
                className={`relative pb-2.5 sm:pb-3 pt-1 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'text-brand dark:text-indigo-400 font-semibold'
                    : 'text-muted dark:text-slate-400 hover:text-ink dark:hover:text-slate-200'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-brand dark:bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {saveToast && (
        <div className="p-3 rounded-xl bg-success-soft dark:bg-emerald-950/40 border border-success/30 dark:border-emerald-800 text-success dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* =====================================================================
       * 1. DIAGRAM MAKER (Phase 5.1)
       * ===================================================================== */}
      {subTab === 'visualize' && (
        <div className="space-y-6">
          {/* Main Controls Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand dark:text-indigo-400" />
                  <span>Interactive JEE Diagram Maker</span>
                </h2>
                <p className="text-xs text-muted dark:text-slate-400">
                  Grounds diagrams in &ldquo;{activeDocument.title}&rdquo; with arrows, force components,
                  equations, and page citations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted dark:text-slate-400">
                  Category:
                </span>
                <select
                  aria-label="Diagram category selector"
                  value={visualCategory}
                  onChange={(e) => setVisualCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
                >
                  <option value="auto">Auto-Detect from Concept</option>
                  <option value="free_body_diagram">Free-Body Diagram (FBD)</option>
                  <option value="ray_optics">Ray Optics &amp; Lenses</option>
                  <option value="circuit_diagram">Circuit Diagram</option>
                  <option value="molecular_shape">Molecular Shape / VSEPR</option>
                  <option value="conic_section">Conic Section &amp; Geometry</option>
                  <option value="flowchart">Process Flowchart</option>
                  <option value="educational_diagram">General Scientific Diagram</option>
                </select>
              </div>
            </div>

            {/* Input Bar */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={visualConceptInput}
                  onChange={(e) => setVisualConceptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRunVisualize();
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs sm:text-sm font-semibold text-ink dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  placeholder="Enter concept (e.g. Block on incline with friction, H2O VSEPR geometry, Convex lens ray optics)..."
                />
              </div>

              <button
                type="button"
                disabled={isVisualizing || !visualConceptInput.trim()}
                onClick={() => void handleRunVisualize()}
                data-testid="generate-visual-btn"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-60 transition-colors shadow-sm"
              >
                {isVisualizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating SVG...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Diagram</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Concept Presets */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>JEE Core Concept Presets:</span>
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {(['all', 'Physics', 'Chemistry', 'Mathematics'] as const).map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubjectFilter(sub)}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition-colors ${
                        selectedSubjectFilter === sub
                          ? 'bg-brand/10 dark:bg-indigo-950/60 text-brand dark:text-indigo-400'
                          : 'text-muted dark:text-slate-400 hover:text-ink dark:hover:text-slate-200'
                      }`}
                    >
                      {sub === 'all' ? 'All' : sub}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {JEE_PRESETS.filter(
                  (p) => selectedSubjectFilter === 'all' || p.subject === selectedSubjectFilter
                ).map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setVisualConceptInput(preset.concept);
                      setVisualCategory(preset.category);
                      void handleRunVisualize(preset.concept, preset.category);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-brand/40 dark:hover:border-indigo-500/40 hover:bg-brand/5 dark:hover:bg-indigo-950/30 text-xs text-ink dark:text-slate-200 font-medium transition-all cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-brand dark:bg-indigo-400" />
                    <span>{preset.label}</span>
                    <span className="text-[10px] text-muted dark:text-slate-400">
                      ({preset.subject})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Diagram Result View */}
          {visualResult?.spec ? (
            <div className="space-y-4">
              {/* Top Banner if Notice / Fallback */}
              {visualResult.modelNotice && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      <strong>Status ({visualResult.verificationStatus || 'VERIFIED'}):</strong>{' '}
                      {visualResult.modelNotice}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[11px] font-bold shrink-0">
                    {visualResult.isAiGenerated ? 'AI Model Grounded' : 'Deterministic SVG Template'}
                  </span>
                </div>
              )}

              {/* Main App-Owned SVG Renderer */}
              <DiagramRenderer
                spec={visualResult.spec}
                isDarkTheme={isDark}
                isSaved={isCurrentVisualSaved}
                onSave={(spec) => {
                  handleSaveCreativeAsset('visual_diagram', spec.title || visualResult.concept, {
                    concept: visualResult.concept,
                    style: visualResult.style,
                    spec,
                    diagramSteps: visualResult.diagramSteps,
                    citedPages: spec.citedPages,
                    isAiGenerated: visualResult.isAiGenerated,
                    modelNotice: visualResult.modelNotice,
                  });
                }}
                onNavigateToPage={onNavigateToPage}
              />

              {/* Step / Formula Details Below Diagram */}
              {visualResult.diagramSteps && visualResult.diagramSteps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted dark:text-slate-400">
                    Component Breakdown &amp; Analysis:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {visualResult.diagramSteps.map((step) => (
                      <div
                        key={step.step}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-md text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: step.color || '#4F46E5' }}
                          >
                            {step.step}
                          </span>
                          <span className="text-xs font-bold text-ink dark:text-slate-100 truncate">
                            {step.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted dark:text-slate-400 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isVisualizing ? (
            <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-brand dark:text-indigo-400 animate-spin" />
              <div className="text-sm font-bold text-ink dark:text-slate-100">
                Building Grounded SVG Diagram...
              </div>
              <p className="text-xs text-muted dark:text-slate-400 max-w-md mx-auto">
                Analyzing notes in &ldquo;{activeDocument.title}&rdquo;, solving geometric
                coordinates, and rendering validated vector primitives.
              </p>
            </div>
          ) : (
            <div className="p-10 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
              <div className="text-sm font-semibold text-ink dark:text-slate-200">
                Ready to Generate Concept Diagram
              </div>
              <p className="text-xs text-muted dark:text-slate-400 max-w-md mx-auto">
                Choose a core JEE preset above or type any physics, chemistry, or math concept to
                synthesize an SVG diagram directly from your study notes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
       * 2. ANIMATED EXPLANATION (Phase 5.2 - Source-Grounded Multi-Scene Player)
       * ===================================================================== */}
      {subTab === 'videolesson' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-3 sm:p-6 space-y-5 shadow-2xs">
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-brand-soft dark:bg-indigo-950/70 text-brand dark:text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
                  Phase 5.3 · Interactive Concept Mastery
                </span>
                <span className="text-[11px] text-muted dark:text-slate-400">
                  4–6 Progressive Diagram Scenes · Concept Checks &amp; Visual Reteaching
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-ink dark:text-slate-100">
                Animated Concept Explanations &amp; Adaptive Mastery
              </h2>
              <p className="text-xs text-muted dark:text-slate-400">
                Choose a concept from <span className="font-semibold text-ink dark:text-slate-200">{activeDocument.title}</span> or enter a JEE Physics, Chemistry, or Maths request below.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <input
                type="text"
                aria-label="Concept or topic for animated explanation"
                data-testid="animated-topic-input"
                value={videoTopicInput}
                onChange={(e) => setVideoTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGeneratingVideo) {
                    void handleRunVideoLesson();
                  }
                }}
                placeholder="e.g., Conditional Probability & Bayes' Theorem, Inclined Plane FBD..."
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-ink dark:text-slate-100 sm:min-w-[280px] focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                disabled={isGeneratingVideo}
                onClick={() => void handleRunVideoLesson()}
                data-testid="generate-video-lesson-btn"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer disabled:opacity-60 shrink-0"
              >
                {isGeneratingVideo ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Building 4–6 Scenes...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-3.5 h-3.5" />
                    <span>Generate Explanation</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Document Concept Chips & Subject Presets */}
          <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted dark:text-slate-400 mr-1">
                From Active Material:
              </span>
              {activeDocument.topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`doc-topic-chip-${t.id}`}
                  onClick={() => void handleRunVideoLesson(t.name)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    videoTopicInput === t.name
                      ? 'bg-brand-soft dark:bg-indigo-950/80 border-brand text-brand dark:text-indigo-300 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-ink dark:text-slate-200 hover:border-brand/40'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted dark:text-slate-400 mr-1">
                JEE Subject Walkthroughs:
              </span>
              {[
                {
                  id: 'physics-incline',
                  subject: 'Physics',
                  label: 'Physics: Block on Inclined Plane FBD',
                  topic: 'Block on an Inclined Plane with Gravity mg, Normal Reaction N, and Friction',
                },
                {
                  id: 'chemistry-vsepr',
                  subject: 'Chemistry',
                  label: 'Chemistry: VSEPR H₂O & sp³ Bond Angles',
                  topic: 'VSEPR Theory: Lone Pair Repulsion & Bond Angles in CH4, NH3, and H2O',
                },
                {
                  id: 'math-bayes',
                  subject: 'Mathematics',
                  label: "Maths: Conditional Probability & Bayes' Theorem",
                  topic: "Conditional Probability, Law of Total Probability & Bayes' Theorem",
                },
                {
                  id: 'math-parabola',
                  subject: 'Mathematics',
                  label: 'Maths: Parabola y² = 4ax & Latus Rectum',
                  topic: 'Parabola y² = 4ax Focus, Directrix, Latus Rectum & Parametric Tangent',
                },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`animated-preset-${preset.id}`}
                  onClick={() => void handleRunVideoLesson(preset.topic)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-body dark:text-slate-300 hover:border-brand hover:text-brand dark:hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Honest AI / Fallback Status Banner + Retry */}
          {videoResult && (
            <div
              data-testid={
                videoResult.isAiGenerated ? 'animated-ai-banner' : 'animated-fallback-banner'
              }
              className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                videoResult.isAiGenerated
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-950 dark:text-emerald-200'
                  : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {videoResult.isAiGenerated ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {videoResult.isAiGenerated
                      ? `Live AI Animated Explanation (${videoResult.scenes.length} Scenes)`
                      : `Built-in JEE Multi-Scene Fallback Template (${videoResult.scenes.length} Scenes)`}
                  </div>
                  <p className="text-[11px] opacity-90">
                    {videoResult.userFacingNotice ||
                      'Validated structured scenes with progressive 2D vector diagrams.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isGeneratingVideo}
                onClick={() => void handleRunVideoLesson(undefined, true)}
                data-testid="retry-animated-lesson-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-ink dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0 self-start sm:self-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Generation</span>
              </button>
            </div>
          )}

          {/* Main Narrated Slideshow Player */}
          {videoResult && videoResult.scenes.length > 0 ? (
            playerState.isOpen && activeScene ? (
              <div
                data-testid="animated-scene-player"
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-3 sm:p-6 space-y-5"
              >
                {/* Top Player Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid="scene-counter-badge"
                        className="px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-bold"
                      >
                        Scene {activeScene.sceneNumber} of {videoResult.scenes.length}
                      </span>
                      <span className="text-xs font-semibold text-muted dark:text-slate-400">
                        {videoResult.topic}
                      </span>
                      {activeScene.citedPages && activeScene.citedPages.length > 0 ? (
                        <div
                          data-testid="scene-citations"
                          className="inline-flex flex-wrap items-center gap-1.5"
                        >
                          {activeScene.citedPages.map((pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => onNavigateToPage?.(pageNum)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-brand dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
                              title={`Jump to Page ${pageNum} in study notes`}
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>Cited: Page {pageNum}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span
                          data-testid="scene-citations-unsupported"
                          className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[11px] font-medium text-muted dark:text-slate-400"
                        >
                          Standard JEE Syllabus (Not in uploaded pages)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Playback, Navigation, Mute, Save & Close Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="scene-prev-btn"
                      disabled={playerState.activeSceneIndex <= 0}
                      onClick={() =>
                        dispatchPlayer({
                          type: 'PREV_SCENE',
                          totalScenes: videoResult.scenes.length,
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                      title="Previous Scene"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>

                    <button
                      type="button"
                      data-testid="scene-play-pause-btn"
                      onClick={() => dispatchPlayer({ type: 'TOGGLE_PLAY' })}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer"
                    >
                      {playerState.isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Play Narration</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="scene-next-btn"
                      disabled={playerState.activeSceneIndex >= videoResult.scenes.length - 1}
                      onClick={() =>
                        dispatchPlayer({
                          type: 'NEXT_SCENE',
                          totalScenes: videoResult.scenes.length,
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                      title="Next Scene"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      data-testid="scene-mute-btn"
                      aria-pressed={playerState.isMuted}
                      onClick={() => dispatchPlayer({ type: 'TOGGLE_MUTE' })}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        playerState.isMuted
                          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-ink dark:text-slate-100'
                      }`}
                      title={playerState.isMuted ? 'Unmute voice narration' : 'Mute voice narration'}
                    >
                      {playerState.isMuted ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>Muted</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Voice On</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      data-testid="save-animated-lesson-btn"
                      onClick={() =>
                        handleSaveCreativeAsset(
                          'video_lesson',
                          `Animated Lesson: ${videoResult.topic}`,
                          {
                            ...videoResult,
                            masteryByScene,
                          }
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-ink dark:text-slate-100 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-brand dark:text-indigo-400" />
                      <span>Save</span>
                    </button>

                    <button
                      type="button"
                      data-testid="scene-close-btn"
                      onClick={() => dispatchPlayer({ type: 'CLOSE_PLAYER' })}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold text-muted hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      title="Close scene player and stop narration"
                    >
                      <X className="w-4 h-4" />
                      <span className="sr-only sm:not-sr-only">Close</span>
                    </button>
                  </div>
                </div>

                {/* Scene Selector Strip (Scenes 1..N) with Phase 5.3 Mastery Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {videoResult.scenes.map((sc, i) => {
                    const isSelected = playerState.activeSceneIndex === i;
                    const scState = masteryByScene[sc.sceneNumber];
                    const badgeInfo =
                      scState?.status === 'correct_first_try' ||
                      scState?.status === 'correct_after_retry'
                        ? {
                            label: 'Verified ✓',
                            cls: isSelected
                              ? 'bg-emerald-400/25 text-white'
                              : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300',
                          }
                        : scState?.status === 'needs_reteaching'
                          ? {
                              label: 'Reteach !',
                              cls: isSelected
                                ? 'bg-rose-400/30 text-white'
                                : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300',
                            }
                          : scState?.status === 'in_progress'
                            ? {
                                label: 'Retry',
                                cls: isSelected
                                  ? 'bg-amber-400/30 text-white'
                                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300',
                              }
                            : scState?.status === 'skipped'
                              ? {
                                  label: 'Skipped',
                                  cls: isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-muted dark:text-slate-400',
                                }
                              : {
                                  label: `${sc.durationSeconds}s`,
                                  cls: 'opacity-80',
                                };
                    return (
                      <button
                        key={sc.sceneNumber}
                        type="button"
                        data-testid={`scene-select-btn-${i}`}
                        onClick={() =>
                          dispatchPlayer({
                            type: 'SELECT_SCENE',
                            sceneIndex: i,
                            totalScenes: videoResult.scenes.length,
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand text-white border-brand shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-ink dark:text-slate-200 hover:border-brand/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider">
                          <span>Scene {sc.sceneNumber}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${badgeInfo.cls}`}>
                            {badgeInfo.label}
                          </span>
                        </div>
                        <div className="text-xs font-semibold line-clamp-1 mt-0.5">
                          {sc.heading}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Main 2-Column Content: Progressive Diagram + Teaching Point / Formula / Narration / Concept Check */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Progressive Step Controls + App-Owned SVG DiagramRenderer + Adaptive Visual Reteaching */}
                  <div className="lg:col-span-7 min-w-0 space-y-3">
                    {activeSceneSteps.length > 0 && (
                      <div
                        data-testid="progressive-steps-bar"
                        className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand dark:text-indigo-400">
                            Progressive Diagram Build ({playerState.activeStepIndex + 1} of{' '}
                            {activeSceneSteps.length})
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="step-prev-btn"
                              disabled={playerState.activeStepIndex <= 0}
                              onClick={() =>
                                dispatchPlayer({
                                  type: 'PREV_STEP',
                                  totalSteps: activeSceneSteps.length,
                                })
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-ink dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                            >
                              − Step
                            </button>
                            <button
                              type="button"
                              data-testid="step-next-btn"
                              disabled={playerState.activeStepIndex >= activeSceneSteps.length - 1}
                              onClick={() =>
                                dispatchPlayer({
                                  type: 'NEXT_STEP',
                                  totalSteps: activeSceneSteps.length,
                                  totalScenes: videoResult.scenes.length,
                                  autoAdvanceScene: false,
                                })
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-ink dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                            >
                              + Step
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {activeSceneSteps.map((st, sIdx) => {
                            const active = playerState.activeStepIndex === sIdx;
                            return (
                              <button
                                key={st.stepNumber}
                                type="button"
                                data-testid={`step-select-btn-${sIdx}`}
                                onClick={() =>
                                  dispatchPlayer({
                                    type: 'SELECT_STEP',
                                    stepIndex: sIdx,
                                    totalSteps: activeSceneSteps.length,
                                  })
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-brand text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-muted dark:text-slate-300 hover:text-ink'
                                }`}
                              >
                                {st.label}
                              </button>
                            );
                          })}
                        </div>

                        <p
                          data-testid="active-step-description"
                          className="text-xs text-body dark:text-slate-300"
                        >
                          {activeSceneSteps[playerState.activeStepIndex]?.description}
                        </p>
                      </div>
                    )}

                    <DiagramRenderer
                      spec={
                        isReteachingOpen && activeReteaching
                          ? getHighlightedDiagramSpecForReteaching(
                              getSceneSpecForProgressiveStep(
                                activeScene,
                                playerState.activeStepIndex
                              ),
                              activeReteaching.highlightElementIds
                            )
                          : getSceneSpecForProgressiveStep(
                              activeScene,
                              playerState.activeStepIndex
                            )
                      }
                      isDarkTheme={isDark}
                      onNavigateToPage={onNavigateToPage}
                    />

                    {/* Phase 5.3 — Adaptive Visual Reteaching Panel (when unlocked or opened) */}
                    {isReteachingOpen && activeReteaching && (
                      <div
                        data-testid="adaptive-reteaching-panel"
                        className="p-4 sm:p-5 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                              Adaptive Visual Reteaching · Scene {activeScene.sceneNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsReteachingOpen(false)}
                            className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                          >
                            Hide Reteaching
                          </button>
                        </div>

                        <div
                          data-testid="reteaching-alternative-explanation"
                          className="text-xs sm:text-sm font-medium text-amber-950 dark:text-amber-100 leading-relaxed"
                        >
                          <MathText text={activeReteaching.alternativeExplanation} />
                        </div>

                        {activeReteaching.highlightElementIds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                              Highlighted Diagram Elements:
                            </span>
                            {activeReteaching.highlightElementIds.map((elId) => (
                              <span
                                key={elId}
                                data-testid={`reteach-highlight-${elId}`}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[11px] font-mono font-semibold text-amber-900 dark:text-amber-200"
                              >
                                {elId}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Step-by-Step Visual &amp; Formula Breakdown
                          </div>
                          <ul className="space-y-1 text-xs text-ink dark:text-slate-200">
                            {activeReteaching.stepByStepBreakdown.map((stepStr, idx) => (
                              <li key={idx} className="leading-relaxed">
                                <MathText text={stepStr} variant="inline" />
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                            Formula: <MathText text={activeReteaching.keyFormula} variant="inline" />
                          </span>
                          <button
                            type="button"
                            data-testid="attempt-reteach-followup-btn"
                            onClick={() => void handleLoadQuestionVariant('reteach', false)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer"
                          >
                            <Target className="w-3.5 h-3.5" />
                            <span>Try Equivalent Follow-Up Question</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Scene Heading, Teaching Point, Key Formula, Narration & Interactive Concept Check */}
                  <div className="lg:col-span-5 min-w-0 space-y-4">
                    {/* Scene Heading & Governing Formula */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand dark:text-indigo-400">
                            Scene {activeScene.sceneNumber} Breakdown
                          </span>
                          <h3
                            data-testid="scene-heading"
                            className="text-base sm:text-lg font-bold text-ink dark:text-slate-100"
                          >
                            {activeScene.heading}
                          </h3>
                        </div>

                        <button
                          type="button"
                          data-testid="open-concept-check-btn"
                          onClick={handleOpenConceptCheck}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer shrink-0 shadow-2xs"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Check Understanding</span>
                        </button>
                      </div>

                      {/* Teaching Point */}
                      <div
                        data-testid="scene-teaching-point"
                        className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand dark:text-indigo-300">
                          Key Teaching Point
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-ink dark:text-slate-100 leading-relaxed">
                          <MathText text={activeScene.teachingPoint} />
                        </div>
                      </div>

                      {/* Governing Formula */}
                      {activeScene.keyFormula && (
                        <div
                          data-testid="scene-key-formula"
                          className="p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 space-y-1"
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            Governing JEE Formula
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-white break-words">
                            <MathText text={activeScene.keyFormula} />
                          </div>
                        </div>
                      )}

                      {/* Visible Narration */}
                      <div
                        data-testid="scene-visible-narration"
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted dark:text-slate-400">
                            Visible Narration Transcript
                          </span>
                          <span className="text-[10px] font-semibold text-brand dark:text-indigo-400">
                            {playerState.isPlaying
                              ? playerState.isMuted
                                ? 'Playing (Muted)'
                                : 'Speaking Aloud'
                              : 'Paused'}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-body dark:text-slate-200 leading-relaxed">
                          &ldquo;{activeScene.narration}&rdquo;
                        </p>
                      </div>

                      {/* Highlight Values */}
                      {activeScene.highlightValues && activeScene.highlightValues.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted dark:text-slate-400">
                            Exam Checkpoints
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeScene.highlightValues.map((hv, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-ink dark:text-slate-200"
                              >
                                {hv}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Safety Disclosure & Report Action */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-muted dark:text-slate-400">
                        <span>Verify formulas against your NCERT / JEE notes.</span>
                        <ReportButton
                          kind="animated_explanation"
                          excerpt={`${activeScene.heading}: ${activeScene.teachingPoint} — ${activeScene.narration}`}
                          documentId={activeDocument.id}
                        />
                      </div>
                    </div>

                    {/* Phase 5.3 — Interactive Concept Check Card */}
                    {isCheckOpen && activeQuestion && (
                      <div
                        data-testid="concept-check-panel"
                        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-brand/40 dark:border-indigo-500/50 space-y-4 shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-brand-soft dark:bg-indigo-950/80 text-brand dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                              Scene {activeScene.sceneNumber} Concept Check (
                              {activeQuestion.difficulty})
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-muted dark:text-slate-300">
                              {activeQuestion.questionType === 'numerical'
                                ? 'Numerical Input'
                                : 'Single-Choice MCQ'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="load-equivalent-question-btn"
                              disabled={isRefreshingQuestion}
                              onClick={() =>
                                void handleLoadQuestionVariant(
                                  activeQuestion.difficulty === 'reteach' ? 'standard' : 'reteach',
                                  false
                                )
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-ink dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Switch to an equivalent question for this teaching point"
                            >
                              Equivalent Q
                            </button>
                            <button
                              type="button"
                              data-testid="ai-refresh-concept-check-btn"
                              disabled={isRefreshingQuestion}
                              onClick={() =>
                                void handleLoadQuestionVariant(activeQuestion.difficulty, true)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-brand dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer disabled:opacity-50"
                              title="Generate fresh AI concept check"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${isRefreshingQuestion ? 'animate-spin' : ''}`}
                              />
                              <span>AI New</span>
                            </button>
                          </div>
                        </div>

                        {/* Source Grounding Badge inside Concept Check */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          {activeQuestion.isSupportedByMaterial &&
                          activeQuestion.citedPages.length > 0 ? (
                            <span
                              data-testid="concept-check-source-cited"
                              className="text-brand dark:text-indigo-300 font-semibold"
                            >
                              Source-Grounded: Page {activeQuestion.citedPages.join(', ')} of{' '}
                              {activeDocument.title}
                            </span>
                          ) : (
                            <span
                              data-testid="concept-check-source-syllabus"
                              className="text-muted dark:text-slate-400 font-medium"
                            >
                              Standard JEE Syllabus — Not in Uploaded Pages
                            </span>
                          )}
                          <span className="text-[10px] text-muted dark:text-slate-400">
                            {activeQuestion.provenance === 'ai_grounded'
                              ? 'AI-Generated & Validated'
                              : 'Verified JEE Checkpoint'}
                          </span>
                        </div>

                        {/* Question Statement */}
                        <div
                          data-testid="concept-check-statement"
                          className="text-xs sm:text-sm font-semibold text-ink dark:text-slate-100 leading-relaxed"
                        >
                          <MathText text={activeQuestion.statement} />
                        </div>

                        {/* MCQ Options OR Numerical Input */}
                        {activeQuestion.questionType === 'mcq' && activeQuestion.options ? (
                          <div
                            role="radiogroup"
                            aria-label={`Scene ${activeScene.sceneNumber} concept check options`}
                            className="space-y-2"
                          >
                            {activeQuestion.options.map((optText, optIdx) => {
                              const isChosen = selectedMcqOption === optIdx;
                              const letter = String.fromCharCode(65 + optIdx);
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  role="radio"
                                  aria-checked={isChosen}
                                  data-testid={`concept-option-${optIdx}`}
                                  onClick={() => {
                                    setSelectedMcqOption(optIdx);
                                    setValidationError(null);
                                  }}
                                  className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm flex items-start gap-2.5 transition-all cursor-pointer ${
                                    isChosen
                                      ? 'border-brand bg-brand-soft/60 dark:bg-indigo-950/70 text-ink dark:text-slate-100 font-semibold ring-2 ring-brand/30'
                                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-body dark:text-slate-200 hover:border-brand/40'
                                  }`}
                                >
                                  <span
                                    className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                      isChosen
                                        ? 'bg-brand text-white'
                                        : 'bg-white dark:bg-slate-700 text-ink dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                  <span className="leading-snug">
                                    <MathText text={optText} variant="inline" />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label
                              htmlFor={`concept-num-input-${activeScene.sceneNumber}`}
                              className="block text-xs font-semibold text-muted dark:text-slate-300"
                            >
                              Enter Numerical Value (decimals or fractions like 1/6 accepted
                              {activeQuestion.unitHint
                                ? ` · Unit: ${activeQuestion.unitHint}`
                                : ''}
                              ):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                id={`concept-num-input-${activeScene.sceneNumber}`}
                                type="text"
                                data-testid="concept-numerical-input"
                                value={numericalInputText}
                                onChange={(e) => {
                                  setNumericalInputText(e.target.value);
                                  setValidationError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSubmitConceptCheck();
                                  }
                                }}
                                placeholder={
                                  activeQuestion.unitHint
                                    ? `e.g., 10 or 10 ${activeQuestion.unitHint}`
                                    : 'e.g., 0.0594 or 1/6'
                                }
                                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm font-mono font-semibold text-ink dark:text-slate-100 focus:outline-none focus:border-brand"
                              />
                              {activeQuestion.unitHint && (
                                <span className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-ink dark:text-slate-200">
                                  <MathText text={activeQuestion.unitHint} variant="inline" />
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {validationError && (
                          <div
                            data-testid="concept-validation-error"
                            className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
                          >
                            {validationError}
                          </div>
                        )}

                        {/* Submit & Skip Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            data-testid="submit-concept-check-btn"
                            onClick={handleSubmitConceptCheck}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Submit Answer</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              data-testid="skip-concept-check-btn"
                              onClick={handleSkipConceptCheck}
                              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-muted dark:text-slate-400 hover:text-ink dark:hover:text-slate-200 cursor-pointer"
                            >
                              Skip Check
                            </button>
                          </div>
                        </div>

                        {/* Feedback & Targeted Misconception Diagnosis Box (shown after attempt) */}
                        {activeSceneMastery?.lastAttempt && (
                          <div
                            data-testid="concept-feedback-banner"
                            className={`p-4 rounded-2xl border space-y-3 ${
                              activeSceneMastery.lastAttempt.isCorrect
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                                : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                                {activeSceneMastery.lastAttempt.isCorrect ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>
                                      Correct! Concept Verified (Attempt #
                                      {activeSceneMastery.lastAttempt.attemptNumberForScene})
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                    <span>
                                      Incorrect (Attempt #
                                      {activeSceneMastery.lastAttempt.attemptNumberForScene}) —
                                      Correct Answer:{' '}
                                      <MathText
                                        text={activeSceneMastery.lastAttempt.correctAnswerDisplay}
                                        variant="inline"
                                      />
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Targeted Misconception Diagnosis */}
                            {!activeSceneMastery.lastAttempt.isCorrect &&
                              activeSceneMastery.lastAttempt.detectedMisconception && (
                                <div
                                  data-testid="misconception-diagnosis-box"
                                  className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-rose-800/80 space-y-1.5 text-ink dark:text-slate-100"
                                >
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                    Targeted Misconception Diagnosis
                                  </div>
                                  <p className="text-xs font-bold">
                                    <MathText
                                      text={
                                        activeSceneMastery.lastAttempt.detectedMisconception.summary
                                      }
                                      variant="inline"
                                    />
                                  </p>
                                  <p className="text-xs text-body dark:text-slate-300 leading-relaxed">
                                    <strong>Why this happens:</strong>{' '}
                                    <MathText
                                      text={
                                        activeSceneMastery.lastAttempt.detectedMisconception
                                          .whyIncorrect
                                      }
                                      variant="inline"
                                    />
                                  </p>
                                  <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold leading-relaxed">
                                    <strong>Core Concept Fix:</strong>{' '}
                                    <MathText
                                      text={
                                        activeSceneMastery.lastAttempt.detectedMisconception
                                          .coreConceptFix
                                      }
                                      variant="inline"
                                    />
                                  </p>
                                </div>
                              )}

                            {/* Step-by-Step Explanation */}
                            <div className="text-xs leading-relaxed opacity-95">
                              <strong>Explanation:</strong>{' '}
                              <MathText text={activeQuestion.explanation} variant="inline" />
                            </div>

                            {mistakeDnaSyncNotice && (
                              <div
                                data-testid="mistake-dna-sync-badge"
                                className="p-2.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5"
                              >
                                <Award className="w-3.5 h-3.5 shrink-0" />
                                <span>{mistakeDnaSyncNotice}</span>
                              </div>
                            )}

                            {/* Post-Feedback Next Actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                data-testid="replay-scene-after-check-btn"
                                onClick={() => dispatchPlayer({ type: 'REPLAY_SCENE' })}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-ink dark:text-slate-100 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Replay Scene</span>
                              </button>

                              {!activeSceneMastery.lastAttempt.isCorrect && (
                                <>
                                  <button
                                    type="button"
                                    data-testid="retry-concept-check-btn"
                                    onClick={() =>
                                      void handleLoadQuestionVariant('reteach', false)
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Retry Equivalent Question</span>
                                  </button>

                                  <button
                                    type="button"
                                    data-testid="open-reteaching-btn"
                                    onClick={() => {
                                      setIsReteachingOpen(true);
                                      dispatchPlayer({
                                        type: 'START_RETEACHING',
                                        totalSteps: activeSceneSteps.length,
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    <span>Visual Reteaching</span>
                                  </button>
                                </>
                              )}

                              {activeSceneMastery.lastAttempt.isCorrect && (
                                <>
                                  {playerState.activeSceneIndex <
                                    videoResult.scenes.length - 1 && (
                                    <button
                                      type="button"
                                      data-testid="continue-after-check-btn"
                                      onClick={() =>
                                        dispatchPlayer({
                                          type: 'NEXT_SCENE',
                                          totalScenes: videoResult.scenes.length,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer"
                                    >
                                      <span>Continue to Next Scene</span>
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    data-testid="try-challenge-question-btn"
                                    onClick={() =>
                                      void handleLoadQuestionVariant('challenge', false)
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-brand dark:text-indigo-300 cursor-pointer"
                                  >
                                    <Target className="w-3.5 h-3.5" />
                                    <span>Try Challenge Q</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase 5.3 — Smart Next-Action Recommendation & Evidence-Based Lesson Mastery Bar */}
                {lessonMasterySummary && (
                  <div
                    data-testid="lesson-mastery-recommendation-card"
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-brand-soft dark:bg-indigo-950/80 text-brand dark:text-indigo-300">
                          Lesson Checkpoint Evidence &amp; Next Best Action
                        </span>
                        <span
                          data-testid="lesson-evidence-score"
                          className="text-xs font-bold text-ink dark:text-slate-100"
                        >
                          Checkpoints: {lessonMasterySummary.verifiedScenes} of{' '}
                          {lessonMasterySummary.totalScenes} ({lessonMasterySummary.checkpointCompletionPct}%) · Observed Score:{' '}
                          {lessonMasterySummary.evidenceScorePct}%
                        </span>
                        <span
                          data-testid="lesson-readiness-label"
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-muted dark:text-slate-300"
                        >
                          Status: {lessonMasterySummary.estimatedConceptReadinessLabel}
                        </span>
                        {lessonMasterySummary.skippedScenes.length > 0 && (
                          <span className="text-[11px] text-muted dark:text-slate-400">
                            ({lessonMasterySummary.skippedScenes.length} skipped — 0% evidence)
                          </span>
                        )}
                      </div>
                      <h4
                        data-testid="lesson-mastery-headline"
                        className="text-sm font-bold text-ink dark:text-slate-100"
                      >
                        {lessonMasterySummary.headline}
                      </h4>
                      <p className="text-xs text-muted dark:text-slate-400 leading-relaxed">
                        {lessonMasterySummary.rationale}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid="recommended-primary-action-btn"
                        onClick={() =>
                          handleExecuteRecommendedAction(lessonMasterySummary.recommendedAction)
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        <span>{lessonMasterySummary.recommendedAction.label}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {lessonMasterySummary.secondaryAction && (
                        <button
                          type="button"
                          data-testid="recommended-secondary-action-btn"
                          onClick={() =>
                            lessonMasterySummary.secondaryAction &&
                            handleExecuteRecommendedAction(lessonMasterySummary.secondaryAction)
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-ink dark:text-slate-100 cursor-pointer"
                        >
                          <span>{lessonMasterySummary.secondaryAction.label}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                data-testid="animated-player-closed"
                className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3"
              >
                <div className="space-y-0.5 text-center sm:text-left">
                  <div className="text-sm font-bold text-ink dark:text-slate-100">
                    Player closed for &ldquo;{videoResult.topic}&rdquo; ({videoResult.scenes.length}{' '}
                    scenes ready)
                  </div>
                  <p className="text-xs text-muted dark:text-slate-400">
                    Narration has been stopped. Reopen the slideshow player or generate another concept.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="reopen-scene-player-btn"
                  onClick={() =>
                    setPlayerState((prev) => ({
                      ...createInitialScenePlayerState(),
                      isMuted: prev.isMuted,
                    }))
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Reopen Scene Player</span>
                </button>
              </div>
            )
          ) : (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
              <p className="text-xs text-muted dark:text-slate-400">
                Select a concept chip above or click{' '}
                <span className="font-semibold text-ink dark:text-slate-200">
                  &ldquo;Generate Explanation&rdquo;
                </span>{' '}
                to build a 4–6 scene narrated explanation with progressive diagrams for{' '}
                <span className="font-semibold text-ink dark:text-slate-200">
                  {videoTopicInput}
                </span>
                .
              </p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
       * 3. SAVED STUDIO LIBRARY
       * ===================================================================== */}
      {subTab === 'saved' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink dark:text-slate-100 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-brand dark:text-indigo-400" />
                <span>Saved Studio Assets ({filteredSavedAssets.length})</span>
              </h2>
              <p className="text-xs text-muted dark:text-slate-400">
                Reopen, inspect, and export your saved diagrams and animated explanations.
              </p>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted dark:text-slate-400" />
              <span className="text-xs font-semibold text-muted dark:text-slate-400">Scope:</span>
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSavedFilter('current')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    savedFilter === 'current'
                      ? 'bg-white dark:bg-slate-700 text-brand dark:text-indigo-300 shadow-2xs'
                      : 'text-muted dark:text-slate-400 hover:text-ink dark:hover:text-slate-200'
                  }`}
                >
                  This Document
                </button>
                <button
                  type="button"
                  onClick={() => setSavedFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    savedFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-brand dark:text-indigo-300 shadow-2xs'
                      : 'text-muted dark:text-slate-400 hover:text-ink dark:hover:text-slate-200'
                  }`}
                >
                  All Documents ({savedAssets.length})
                </button>
              </div>
            </div>
          </div>

          {filteredSavedAssets.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="text-xs text-muted dark:text-slate-400">
                {savedFilter === 'current'
                  ? `No saved assets for "${activeDocument.title}". Switch to "All Documents" or save a diagram or animated explanation.`
                  : 'No saved diagrams or animated explanations yet. Generate and save one above!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSavedAssets.map((asset) => {
                const isDiagram = asset.type === 'visual_diagram';
                const isVideoLesson = asset.type === 'video_lesson';
                const spec = asset.payload?.spec as StructuredDiagramSpec | undefined;
                const savedScenes = Array.isArray(asset.payload?.scenes)
                  ? asset.payload.scenes
                  : [];

                return (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col justify-between space-y-4 hover:border-brand/30 dark:hover:border-indigo-500/30 transition-all shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-brand-soft dark:bg-indigo-950/60 text-brand dark:text-indigo-400 border border-brand/20 dark:border-indigo-800/40">
                          {isDiagram
                            ? 'Vector Diagram'
                            : isVideoLesson
                              ? `Animated Lesson (${savedScenes.length} Scenes)`
                              : asset.type.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-ink dark:text-slate-100 line-clamp-1">
                        {asset.title}
                      </h3>

                      <p className="text-xs text-muted dark:text-slate-400 line-clamp-2">
                        {spec?.description ||
                          savedScenes[0]?.teachingPoint ||
                          `Topic: ${asset.topic}`}
                      </p>

                      {spec?.citedPages && spec.citedPages.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-brand dark:text-indigo-400 font-medium">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Sources: Page {spec.citedPages.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {isDiagram && spec && (
                          <>
                            <button
                              type="button"
                              onClick={() => setInspectingAsset(asset)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand/10 dark:bg-indigo-950/60 hover:bg-brand/20 text-brand dark:text-indigo-400 text-xs font-semibold cursor-pointer transition-colors"
                              title="Inspect diagram"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadAssetSvg(spec, asset.title)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-ink dark:text-slate-200 cursor-pointer transition-colors"
                              title="Download standalone SVG"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>SVG</span>
                            </button>
                          </>
                        )}
                        {isVideoLesson && savedScenes.length > 0 && (
                          <button
                            type="button"
                            data-testid="open-saved-lesson-btn"
                            onClick={() => {
                              const payload = asset.payload as VideoLessonResponse & {
                                masteryByScene?: Record<number, SceneConceptMasteryState>;
                              };
                              const targetTopic = payload?.topic || asset.topic;
                              setVideoResult(payload);
                              setVideoTopicInput(targetTopic);
                              initializeOrRestoreLessonMastery(
                                asset.documentId || activeDocument.id,
                                targetTopic,
                                payload.scenes,
                                payload.masteryByScene
                              );
                              setPlayerState(createInitialScenePlayerState());
                              setSubTab('videolesson');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand/10 dark:bg-indigo-950/60 hover:bg-brand/20 text-brand dark:text-indigo-400 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Open in Player</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          studyStorage.deleteCreativeAsset(asset.id);
                          setSavedAssets(studyStorage.getCreativeAssets());
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors p-1"
                        title="Delete asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inspecting Saved Asset Modal */}
      {inspectingAsset && inspectingAsset.payload?.spec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-ink dark:text-slate-100">
                  {inspectingAsset.title}
                </h3>
                <p className="text-xs text-muted dark:text-slate-400">
                  Saved on {new Date(inspectingAsset.createdAt).toLocaleString()} · Scoped to{' '}
                  {activeDocument.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingAsset(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-ink dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DiagramRenderer
              spec={inspectingAsset.payload.spec}
              isDarkTheme={isDark}
              isSaved={true}
              onNavigateToPage={(pageNum) => {
                setInspectingAsset(null);
                if (onNavigateToPage) onNavigateToPage(pageNum);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
