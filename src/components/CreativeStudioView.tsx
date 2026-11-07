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
import {
  serializeDiagramSpecToSvg,
  getDeterministicDiagramTemplate,
} from '../utils/diagramEngine';
import {
  buildAnimatedExplanationScenes,
  createInitialScenePlayerState,
  transitionScenePlayerState,
  getSceneSpecForProgressiveStep,
  validateAndSanitizeAnimatedExplanation,
  resolveSupportedCitedPages,
  type ScenePlayerState,
  type ScenePlayerAction,
} from '../utils/educationalSpecsEngine';

interface CreativeStudioViewProps {
  documents: StudyDocument[];
  activeDocument: StudyDocument;
  onSelectDocument: (id: string) => void;
  themeMode?: ThemeMode;
  onNavigateToPage?: (pageNumber: number) => void;
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore speech synthesis errors in headless browsers
      }
    }
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

  const handleRunVideoLesson = async (topicOverride?: string) => {
    const targetTopic = (topicOverride ?? videoTopicInput).trim() || selectedTopic || 'Core Concept';
    if (topicOverride) {
      setVideoTopicInput(topicOverride);
    }

    cancelSpeechAndTimers();
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

      setVideoResult({
        ...res,
        topic: targetTopic,
        citedPages: validated.citedPages,
        isSupportedByMaterial: validated.isSupportedByMaterial,
        scenes: validated.scenes,
      });
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
      setVideoResult({
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
      });
      setPlayerState((prev) => ({
        ...createInitialScenePlayerState(),
        isMuted: prev.isMuted,
      }));
    } finally {
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

  // Filtered saved assets
  const filteredSavedAssets = savedAssets.filter((a) => {
    if (savedFilter === 'current') {
      return a.documentId === activeDocument.id;
    }
    return true;
  });

  return (
    <div className="max-w-[1340px] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
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

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
            <select
              aria-label="Select active study document for studio"
              value={activeDocument.id}
              onChange={(e) => onSelectDocument(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-ink dark:text-slate-100"
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
              className="px-3 py-2 rounded-lg border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-ink dark:text-slate-100"
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
              { id: 'videolesson', label: 'Animated Explanation (Phase 5.2)' },
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
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-brand-soft dark:bg-indigo-950/70 text-brand dark:text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
                  Phase 5.2 · Narrated Scene Player
                </span>
                <span className="text-[11px] text-muted dark:text-slate-400">
                  4–6 Progressive Diagram Scenes · App-Owned SVG
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-ink dark:text-slate-100">
                Animated Concept Explanations
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
                onClick={() => void handleRunVideoLesson()}
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
                          videoResult
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

                {/* Scene Selector Strip (Scenes 1..N) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {videoResult.scenes.map((sc, i) => {
                    const isSelected = playerState.activeSceneIndex === i;
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
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-80">
                          <span>Scene {sc.sceneNumber}</span>
                          <span>{sc.durationSeconds}s</span>
                        </div>
                        <div className="text-xs font-semibold line-clamp-1 mt-0.5">
                          {sc.heading}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Main 2-Column Content: Progressive Diagram + Teaching Point / Formula / Narration */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Progressive Step Controls + App-Owned SVG DiagramRenderer */}
                  <div className="lg:col-span-7 space-y-3">
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
                      spec={getSceneSpecForProgressiveStep(
                        activeScene,
                        playerState.activeStepIndex
                      )}
                      isDarkTheme={isDark}
                      onNavigateToPage={onNavigateToPage}
                    />
                  </div>

                  {/* Right Column: Scene Heading, Teaching Point, Key Formula & Visible Narration */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Scene Heading & Governing Formula */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
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

                      {/* Teaching Point */}
                      <div
                        data-testid="scene-teaching-point"
                        className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-1"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand dark:text-indigo-300">
                          Key Teaching Point
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-ink dark:text-slate-100 leading-relaxed">
                          {activeScene.teachingPoint}
                        </p>
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
                          <div className="font-mono text-xs sm:text-sm font-bold text-white break-words">
                            {activeScene.keyFormula}
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
                        <span>
                          Verify formulas against your NCERT / JEE notes.
                        </span>
                        <ReportButton
                          kind="tutor_answer"
                          excerpt={`${activeScene.heading}: ${activeScene.teachingPoint} — ${activeScene.narration}`}
                          documentId={activeDocument.id}
                        />
                      </div>
                    </div>
                  </div>
                </div>
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
                              setVideoResult(asset.payload as VideoLessonResponse);
                              setVideoTopicInput(asset.payload?.topic || asset.topic);
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
