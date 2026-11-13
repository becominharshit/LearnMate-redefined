import type {
  StudyPage,
  StudyTopic,
  StudySourceType,
  TutorCitation,
  TutorSourceType,
  GeminiModelOption,
  StudentTutorContext,
  QuizQuestion,
  QuizAttempt,
  MistakeInsight,
  RevisionTask,
  StickyNoteItem,
  FlashcardItem,
  MindMapData,
  OnePageRevisionSheet,
  YouTubeRecommendation,
  SourceControlMode,
  TeachItBackEvaluation,
  DailyNewsArticle,
  EducationalPlaceItem,
  AiUsageDashboardStats,
  Generate3DModelResponse,
  Custom3DSceneSpec,
} from '../types/study';
import type { StructuredDiagramSpec } from '../types/diagram';
import type {
  AnimatedExplanationScene,
  ConceptCheckDifficulty,
  SceneConceptCheckQuestion,
} from '../utils/educationalSpecsEngine';
import { apiFetch } from './apiFetch';

export interface AiStatusMetadata {
  aiStatus?: string;
  aiNotice?: string;
}

export interface AnalyzeDocumentResponse extends AiStatusMetadata {
  overview: string;
  topics: StudyTopic[];
}

export interface AnalyzeYouTubeResponse extends AiStatusMetadata {
  videoId: string;
  youtubeUrl: string;
  title: string;
  overview: string;
  pages: StudyPage[];
  topics: StudyTopic[];
}

export interface AskTutorResponse extends AiStatusMetadata {
  answer: string;
  foundInMaterial: boolean;
  sourceType: TutorSourceType;
  sourceControlMode?: SourceControlMode;
  citations: TutorCitation[];
  relatedTopics: string[];
  modelUsed?: string;
}

export interface GenerateQuizResponse extends AiStatusMetadata {
  questions: QuizQuestion[];
}

export interface DiagnoseMistakesResponse extends AiStatusMetadata {
  mistakes: MistakeInsight[];
  revisionPlan: RevisionTask[];
}

export interface GenerateStickyAndFlashcardsResponse extends AiStatusMetadata {
  stickyNotes: StickyNoteItem[];
  flashcards: FlashcardItem[];
}

export interface GenerateMindMapAndRevisionResponse extends AiStatusMetadata {
  mindMap: MindMapData;
  onePageRevision: OnePageRevisionSheet;
}

export interface YouTubeRecommendationsResponse {
  configured: boolean;
  videos: YouTubeRecommendation[];
  searchQuery?: string;
  extractedConcepts?: string[];
  message?: string;
}

export interface ScanNotesResponse {
  title: string;
  cleanContent: string;
  handwrittenContent: string;
  uncertainSegments: string[];
  summary: string;
  keyConcepts: string[];
}

export interface TranscribeAudioResponse {
  title: string;
  transcript: string;
  structuredNotes: string;
  summary: string;
  keyConcepts: string[];
}

export interface VisualizeConceptResponse {
  concept: string;
  style: string;
  isAiGenerated: boolean;
  spec: StructuredDiagramSpec;
  verificationStatus?:
    | 'VERIFIED_TEMPLATE'
    | 'AI_UNVERIFIED_SCHEMATIC'
    | 'REPAIRED_BY_VALIDATOR'
    | 'WORKING_VERIFIED'
    | 'BLOCKED_BY_BILLING'
    | 'FALLBACK';
  generatedImageUrl?: string;
  modelNotice?: string;
  provider?: string;
  modelUsed?: string;
  diagramSteps?: Array<{
    step: number;
    title: string;
    detail: string;
    color: string;
  }>;
}

export interface VideoLessonResponse {
  jobId?: string;
  topic: string;
  mode?: 'text_to_video' | 'image_to_video';
  aspectRatio?: '16:9' | '9:16';
  omniStatus: string;
  isAiGenerated?: boolean;
  modelUsed?: string;
  verificationStatus?: 'WORKING_VERIFIED' | 'BLOCKED_BY_BILLING' | 'WORKING_WITH_NON_AI_FALLBACK';
  fallbackMode?: 'none' | 'animated_explanation';
  userFacingNotice?: string;
  errorReason?: string;
  videoUrl?: string;
  citedPages?: number[];
  isSupportedByMaterial?: boolean;
  scenes: AnimatedExplanationScene[];
}

export interface GenerateConceptCheckResponse {
  question: SceneConceptCheckQuestion;
  isAiGenerated: boolean;
  modelUsed?: string;
  providerUsed?: string;
  verificationStatus: 'WORKING_VERIFIED' | 'WORKING_WITH_FALLBACK';
  userFacingNotice?: string;
}

// Client-side in-flight deduplication to prevent duplicate submissions from rapid button clicks
const inFlightRequests = new Map<string, Promise<unknown>>();

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const serialized = JSON.stringify(body);
  const requestKey = `${url}::${serialized}`;

  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const task = (async () => {
    try {
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          (data && typeof data.aiNotice === 'string' && data.aiNotice) ||
          (data && typeof data.error === 'string' && data.error) ||
          `Request failed with status ${response.status}`;
        throw new Error(message);
      }
      return data as T;
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();

  inFlightRequests.set(requestKey, task);
  return task;
}

export const aiStudyClient = {
  async analyzeDocument(title: string, pages: StudyPage[]): Promise<AnalyzeDocumentResponse> {
    return postJson<AnalyzeDocumentResponse>('/api/study/analyze', { title, pages });
  },

  async analyzeYouTubeVideo(
    youtubeUrl: string,
    transcript?: string,
    title?: string
  ): Promise<AnalyzeYouTubeResponse> {
    return postJson<AnalyzeYouTubeResponse>('/api/study/youtube-analyze', {
      youtubeUrl,
      transcript,
      title,
    });
  },

  async askTutor(params: {
    title: string;
    pages: StudyPage[];
    question: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    modelPreference?: GeminiModelOption;
    studentContext?: StudentTutorContext;
    sourceControlMode?: SourceControlMode;
    isVoiceTutor?: boolean;
  }): Promise<AskTutorResponse> {
    return postJson<AskTutorResponse>('/api/study/ask', params);
  },

  async askTutorStream(
    params: {
      title: string;
      pages: StudyPage[];
      question: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      studentContext?: StudentTutorContext;
      sourceControlMode?: SourceControlMode;
      isVoiceTutor?: boolean;
      signal?: AbortSignal;
    },
    onDelta: (chunk: string) => void
  ): Promise<AskTutorResponse> {
    const { signal, ...bodyParams } = params;
    const response = await apiFetch('/api/study/ask-stream', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(bodyParams),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message =
        (data && typeof data.aiNotice === 'string' && data.aiNotice) ||
        (data && typeof data.error === 'string' && data.error) ||
        `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    if (!response.body) {
      return postJson<AskTutorResponse>('/api/study/ask', bodyParams);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamedAnswer = '';
    let finalResponse: AskTutorResponse | null = null;
    let streamError: string | null = null;

    const handleLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const raw = trimmed.slice(5).trim();
      if (!raw) return;
      let parsed: {
        type?: 'delta' | 'done' | 'error';
        text?: string;
        data?: AskTutorResponse;
        error?: string;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (parsed.type === 'delta' && typeof parsed.text === 'string') {
        streamedAnswer += parsed.text;
        onDelta(parsed.text);
      } else if (parsed.type === 'done' && parsed.data) {
        finalResponse = parsed.data;
      } else if (parsed.type === 'error') {
        streamError = parsed.error || 'The AI tutor could not finish the response.';
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          handleLine(line);
        }
      }
      if (buffer.trim()) {
        handleLine(buffer);
      }
    } catch (readErr: unknown) {
      if (signal?.aborted || (readErr instanceof Error && readErr.name === 'AbortError')) {
        return {
          answer: streamedAnswer,
          foundInMaterial: false,
          sourceType: 'general',
          citations: [],
          relatedTopics: [],
          aiNotice: 'Interrupted by student.',
        };
      }
      throw readErr;
    }

    if (streamError) {
      throw new Error(streamError);
    }

    if (finalResponse) {
      return finalResponse;
    }

    if (streamedAnswer.trim()) {
      return {
        answer: streamedAnswer.trim(),
        foundInMaterial: params.pages.length > 0,
        sourceType: params.pages.length > 0 ? 'both' : 'general',
        sourceControlMode: params.sourceControlMode,
        citations: [],
        relatedTopics: [],
      };
    }

    throw new Error('The AI tutor returned an empty response. Please try again.');
  },

  async generateQuiz(params: {
    documentId: string;
    title: string;
    pages: StudyPage[];
    topics: StudyTopic[];
    mode: 'diagnostic' | 'adaptive';
    focusTopics?: string[];
    questionCount?: number;
    forceRefresh?: boolean;
  }): Promise<GenerateQuizResponse> {
    return postJson<GenerateQuizResponse>('/api/study/quiz', params);
  },

  async analyzeMistakesAndPlan(params: {
    documentId: string;
    title: string;
    pages: StudyPage[];
    attempt: QuizAttempt;
  }): Promise<DiagnoseMistakesResponse> {
    return postJson<DiagnoseMistakesResponse>('/api/study/mistakes-and-plan', params);
  },

  async generateStickyNotesAndFlashcards(params: {
    title: string;
    overview: string;
    sourceType: StudySourceType;
    pages: StudyPage[];
    topics: StudyTopic[];
    forceRefresh?: boolean;
  }): Promise<GenerateStickyAndFlashcardsResponse> {
    return postJson<GenerateStickyAndFlashcardsResponse>('/api/study/quick-revise', {
      ...params,
      resourceType: 'sticky_and_flashcards',
    });
  },

  async generateMindMapAndRevisionSheet(params: {
    title: string;
    overview: string;
    sourceType: StudySourceType;
    pages: StudyPage[];
    topics: StudyTopic[];
    forceRefresh?: boolean;
  }): Promise<GenerateMindMapAndRevisionResponse> {
    return postJson<GenerateMindMapAndRevisionResponse>('/api/study/quick-revise', {
      ...params,
      resourceType: 'mindmap_and_revision',
    });
  },

  async fetchYouTubeRecommendations(params: {
    query?: string;
    documentTitle: string;
    topics: string[];
    weakTopics?: string[];
    keyConcepts?: string[];
    pageTitles?: string[];
  }): Promise<YouTubeRecommendationsResponse> {
    return postJson<YouTubeRecommendationsResponse>('/api/study/youtube-recommendations', params);
  },

  async scanNotes(params: {
    imageDataUrl: string;
    title?: string;
  }): Promise<ScanNotesResponse> {
    return postJson<ScanNotesResponse>('/api/study/scan-notes', params);
  },

  async transcribeAudio(params: {
    audioDataUrl?: string;
    title?: string;
    manualTranscript?: string;
  }): Promise<TranscribeAudioResponse> {
    return postJson<TranscribeAudioResponse>('/api/study/transcribe-audio', params);
  },

  async evaluateTeachItBack(params: {
    topic: string;
    studentExplanation: string;
    keyConcepts?: string[];
    pages: StudyPage[];
  }): Promise<TeachItBackEvaluation> {
    return postJson<TeachItBackEvaluation>('/api/study/teach-it-back', params);
  },

  async visualizeConcept(params: {
    concept: string;
    contextText: string;
    style?: string;
    documentTitle?: string;
    citedPages?: number[];
  }): Promise<VisualizeConceptResponse> {
    return postJson<VisualizeConceptResponse>('/api/create/visualize', params);
  },

  async generateVideoLesson(params: {
    topic: string;
    contextText: string;
    aspectRatio?: '16:9' | '9:16';
    sourceImageDataUrl?: string;
    documentTitle?: string;
    citedPages?: number[];
    validPageNumbers?: number[];
    preferredLanguage?: string;
  }): Promise<VideoLessonResponse> {
    return postJson<VideoLessonResponse>('/api/create/video-lesson', params);
  },

  async generateConceptCheck(params: {
    topic: string;
    sceneNumber: number;
    heading: string;
    teachingPoint: string;
    keyFormula: string;
    difficulty?: ConceptCheckDifficulty;
    contextText?: string;
    documentTitle?: string;
    citedPages?: number[];
    validPageNumbers?: number[];
    preferredLanguage?: string;
    forceFallback?: boolean;
  }): Promise<GenerateConceptCheckResponse> {
    return postJson<GenerateConceptCheckResponse>('/api/create/concept-check', params);
  },

  /** Status of a background video job (Higgsfield generations take minutes). */
  async getVideoJob(jobId: string): Promise<{
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    videoUrl?: string;
    userFacingNotice?: string;
    errorReason?: string;
    verificationStatus?: 'WORKING_VERIFIED' | 'BLOCKED_BY_BILLING' | 'WORKING_WITH_NON_AI_FALLBACK';
  }> {
    const resp = await apiFetch(`/api/create/video-jobs/${encodeURIComponent(jobId)}`);
    if (!resp.ok) {
      throw new Error(resp.status === 404 ? 'Video job not found.' : 'Could not check the video status.');
    }
    return resp.json();
  },

  async prepareLofiMusic(params: {
    presetId: string;
    prompt: string;
  }): Promise<{
    presetId: string;
    instrumentalOnly: boolean;
    sanitizedPrompt: string;
    audioDataUrl?: string;
    verificationStatus?: string;
    fallbackMode?: string;
    userFacingNotice?: string;
  }> {
    return postJson('/api/create/lofi-music', params);
  },

  async fetchDailyNews(category?: string): Promise<{
    updatedAt: string;
    articles: DailyNewsArticle[];
    groundedWithSearch: boolean;
    message?: string;
  }> {
    return postJson('/api/explore/daily-news', { category });
  },

  async fetchEducationalPlaces(params: {
    city: string;
    studyTopic: string;
  }): Promise<{
    city: string;
    studyTopic: string;
    places: EducationalPlaceItem[];
    message?: string;
    mapsSearchUri?: string;
  }> {
    return postJson('/api/explore/educational-maps', params);
  },

  async generate3DModel(params: {
    concept: string;
    contextText?: string;
    style?: string;
  }): Promise<Generate3DModelResponse> {
    return postJson<Generate3DModelResponse>('/api/create/3d-model', params);
  },

  async fetchAiUsageStats(): Promise<AiUsageDashboardStats> {
    const resp = await fetch('/api/usage');
    if (!resp.ok) {
      throw new Error('Failed to load AI usage metrics');
    }
    return (await resp.json()) as AiUsageDashboardStats;
  },

  async fetchAiCapabilities(): Promise<{
    checkedAt: string;
    capabilities: Array<{
      id: string;
      name: string;
      provider: string;
      modelId: string;
      verificationStatus: string;
      userFacingNotice: string;
      fallbackStrategy: string;
    }>;
  }> {
    const resp = await fetch('/api/capabilities');
    if (!resp.ok) {
      throw new Error('Failed to load AI capabilities');
    }
    return resp.json();
  },
};

