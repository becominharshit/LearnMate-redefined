import React, { useEffect, useRef, useState } from 'react';
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
import {
  serializeDiagramSpecToSvg,
  getDeterministicDiagramTemplate,
} from '../utils/diagramEngine';

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
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [isPlayingStoryboard, setIsPlayingStoryboard] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0.65);

  useEffect(() => {
    if (!isPlayingStoryboard) return;
    const interval = setInterval(() => {
      setAnimationProgress((p) => (p >= 1 ? 0.05 : Number((p + 0.025).toFixed(3))));
    }, 60);
    return () => clearInterval(interval);
  }, [isPlayingStoryboard]);

  const videoPollRef = useRef(0);
  useEffect(() => {
    return () => {
      videoPollRef.current += 1;
    };
  }, []);

  const pollVideoJob = async (jobId: string) => {
    const pollId = ++videoPollRef.current;
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      if (videoPollRef.current !== pollId) return;
      try {
        const job = await aiStudyClient.getVideoJob(jobId);
        if (videoPollRef.current !== pollId) return;
        if (job.status === 'completed' || job.status === 'failed') {
          setVideoResult((prev) =>
            prev && prev.jobId === jobId
              ? {
                  ...prev,
                  videoUrl: job.videoUrl || prev.videoUrl,
                  userFacingNotice: job.userFacingNotice || prev.userFacingNotice,
                  verificationStatus: job.verificationStatus || prev.verificationStatus,
                  omniStatus: job.status === 'completed' ? 'video_ready' : 'video_failed',
                }
              : prev
          );
          return;
        }
      } catch {
        // Transient network error
      }
    }
  };

  const handleRunVideoLesson = async () => {
    setIsGeneratingVideo(true);
    setActiveSceneIdx(0);
    try {
      const contextText = activeDocument.pages
        .slice(0, 2)
        .map((p) => p.content)
        .join('\n');
      const res = await aiStudyClient.generateVideoLesson({
        topic: videoTopicInput,
        contextText,
        aspectRatio: videoAspectRatio,
        sourceImageDataUrl: videoSourceImage,
      });
      setVideoResult(res);
      setAnimationProgress(0.65);
      if (res.jobId && res.omniStatus === 'higgsfield_processing') {
        void pollVideoJob(res.jobId);
      }
    } catch (err) {
      setVideoResult({
        topic: videoTopicInput,
        omniStatus: 'video_failed',
        userFacingNotice: err instanceof Error ? err.message : 'Could not generate the video.',
        scenes: [],
      });
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

        <div className="flex items-center gap-6 overflow-x-auto">
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
                className={`relative pb-3 pt-1 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
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
       * 2. ANIMATED EXPLANATION (Phase 5.2 - Higgsfield Paused)
       * ===================================================================== */}
      {subTab === 'videolesson' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-5 shadow-2xs">
          <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-950 dark:text-sky-200 flex items-center justify-between gap-2">
            <span>
              <strong>Phase 5.2 Scheduled:</strong> Animated video synthesis via external AI
              generators is safely paused. You can still test the interactive multi-scene storyboard
              player below.
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-[11px] font-bold shrink-0">
              Interactive Storyboard
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink dark:text-slate-100">
                Animated Concept Explanations
              </h2>
              <p className="text-xs text-muted dark:text-slate-400">
                Multi-scene storyboard with governing equations and an interactive timeline player.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={videoTopicInput}
                onChange={(e) => setVideoTopicInput(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100 min-w-[200px]"
              />
              <select
                aria-label="Video aspect ratio"
                value={videoAspectRatio}
                onChange={(e) => setVideoAspectRatio(e.target.value as '16:9' | '9:16')}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100"
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Vertical</option>
              </select>
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-ink dark:text-slate-100 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-brand dark:text-indigo-400" />
                <span>{videoSourceImage ? 'Image Attached ✓' : 'Reference Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadVideoSourceImage}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                disabled={isGeneratingVideo}
                onClick={() => void handleRunVideoLesson()}
                data-testid="generate-video-lesson-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                <Video className="w-3.5 h-3.5" />
                <span>{isGeneratingVideo ? 'Building Lesson...' : 'Generate Explanation'}</span>
              </button>
            </div>
          </div>

          {videoResult ? (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                    Animated Explanation • Scene{' '}
                    {videoResult.scenes[activeSceneIdx]?.sceneNumber || 1} of{' '}
                    {videoResult.scenes.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isPlayingStoryboard;
                        setIsPlayingStoryboard(nextState);
                        if (nextState && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          const utter = new SpeechSynthesisUtterance(
                            videoResult.scenes[activeSceneIdx]?.narration || ''
                          );
                          utter.onend = () => setIsPlayingStoryboard(false);
                          window.speechSynthesis.speak(utter);
                        } else if ('speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold cursor-pointer"
                    >
                      {isPlayingStoryboard ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Animation</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Play Animated Scene</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleSaveCreativeAsset(
                          'video_lesson',
                          `Animated Lesson: ${videoResult.topic}`,
                          videoResult
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
                    >
                      Save Lesson
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <svg viewBox="0 0 600 170" className="w-full h-40">
                    <line x1="30" y1="145" x2="570" y2="145" stroke="#334155" strokeWidth="2" />
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3.5"
                      points={Array.from({ length: 32 }, (_, idx) => {
                        const t = (idx / 31) * animationProgress;
                        const x = 40 + t * 500;
                        const y = 145 - Math.sin(t * Math.PI) * 105;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ')}
                    />
                    <circle
                      cx={40 + animationProgress * 500}
                      cy={145 - Math.sin(animationProgress * Math.PI) * 105}
                      r="7"
                      fill="#facc15"
                    />
                    <text x="40" y="28" fill="#38bdf8" fontSize="13" fontWeight="bold">
                      {videoResult.scenes[activeSceneIdx]?.heading}
                    </text>
                    <text x="40" y="48" fill="#facc15" fontSize="12" fontFamily="monospace">
                      Governing Formula: {videoResult.scenes[activeSceneIdx]?.keyFormula}
                    </text>
                  </svg>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400">Scrub Timeline:</span>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.02}
                      value={animationProgress}
                      onChange={(e) => setAnimationProgress(Number(e.target.value))}
                      className="flex-1 accent-[#38bdf8]"
                    />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-bold text-white">
                      {videoResult.scenes[activeSceneIdx]?.heading}
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-brand/20 border border-brand/40 font-mono text-xs text-blue-200">
                      {videoResult.scenes[activeSceneIdx]?.keyFormula}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    &ldquo;{videoResult.scenes[activeSceneIdx]?.narration}&rdquo;
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {videoResult.scenes.map((sc, i) => (
                    <button
                      key={sc.sceneNumber}
                      type="button"
                      onClick={() => setActiveSceneIdx(i)}
                      className={`p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                        activeSceneIdx === i
                          ? 'bg-brand text-white font-semibold'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      Scene {sc.sceneNumber}: {sc.heading}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-muted dark:text-slate-400">
              Click &quot;Generate Explanation&quot; to synthesize an interactive storyboard for{' '}
              <span className="font-semibold text-ink dark:text-slate-200">{videoTopicInput}</span>.
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
                Reopen, inspect, and export your saved diagrams and lesson materials.
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
                  ? `No saved assets for "${activeDocument.title}". Switch to "All Documents" or save a diagram from the Diagram Maker tab.`
                  : 'No saved diagrams or visual explanations yet. Generate and save one above!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSavedAssets.map((asset) => {
                const isDiagram = asset.type === 'visual_diagram';
                const spec = asset.payload?.spec as StructuredDiagramSpec | undefined;

                return (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col justify-between space-y-4 hover:border-brand/30 dark:hover:border-indigo-500/30 transition-all shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-brand-soft dark:bg-indigo-950/60 text-brand dark:text-indigo-400 border border-brand/20 dark:border-indigo-800/40">
                          {isDiagram ? 'Vector Diagram' : asset.type.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-ink dark:text-slate-100 line-clamp-1">
                        {asset.title}
                      </h3>

                      <p className="text-xs text-muted dark:text-slate-400 line-clamp-2">
                        {spec?.description || `Topic: ${asset.topic}`}
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
