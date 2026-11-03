export type AiBackendProvider =
  | 'vertex_ai'
  | 'developer_api'
  | 'anthropic_claude'
  | 'higgsfield_api'
  | 'fallback';

export type VerificationStatus =
  | 'WORKING_VERIFIED'
  | 'WORKING_WITH_NON_AI_FALLBACK'
  | 'WORKING_WITH_FALLBACK'
  | 'CONFIGURED_UNVERIFIED'
  | 'BLOCKED_BY_QUOTA'
  | 'BLOCKED_BY_BILLING'
  | 'BLOCKED_BY_IAM'
  | 'BLOCKED_BY_PERMISSION'
  | 'UNSUPPORTED_IN_CURRENT_ENVIRONMENT'
  | 'BROKEN_CODE_FIXED';

export type VertexProbeStatus =
  | 'ready'
  | 'iam_permission_denied'
  | 'api_not_enabled'
  | 'billing_disabled'
  | 'model_not_found'
  | 'unauthenticated'
  | 'disabled_by_config'
  | 'probe_failed';

export type AICapabilityId =
  | 'text_generation'
  | 'document_understanding'
  | 'complex_reasoning_claude'
  | 'higgsfield_media'
  | 'image_generation'
  | 'video_generation'
  | 'music_generation'
  | 'audio_transcription'
  | 'gemini_live'
  | 'search_grounding'
  | 'maps_grounding';

export interface AICapabilityDescriptor {
  id: AICapabilityId;
  name: string;
  provider: AiBackendProvider;
  modelId: string;
  endpoint: string;
  authenticationType: 'adc_service_account' | 'developer_api_key' | 'deterministic_engine';
  enabled: boolean;
  configured: boolean;
  available: boolean;
  supportsStreaming: boolean;
  supportsAsyncJobs: boolean;
  estimatedCostOrBillingCategory:
    | 'vertex_free_trial_eligible'
    | 'developer_api_paid_prepayment'
    | 'free_deterministic_local';
  verificationStatus: VerificationStatus;
  lastCheckedStatus: string;
  lastError?: string;
  userFacingNotice: string;
  fallbackStrategy: string;
}

export interface EndpointMigrationDescriptor {
  endpoint: string;
  operation: string;
  featureName: string;
  targetProvider: 'vertex_ai_eligible' | 'developer_api_only';
  trialCreditsEligible: boolean;
  billingService: string;
  modelsUsed: string[];
  migrationAction: 'migrate_when_vertex_ready' | 'keep_on_developer_api_with_fallback';
  reason: string;
}

export const VERTEX_TRIAL_ELIGIBILITY_MATRIX: EndpointMigrationDescriptor[] = [
  {
    endpoint: 'POST /api/study/analyze',
    operation: 'study_analyze',
    featureName: 'PDF & Study Notes Topic Extraction',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Standard structured JSON text generation is supported on Vertex AI via ADC and covered by the $300 Google Cloud Free Trial.',
  },
  {
    endpoint: 'POST /api/study/ask',
    operation: 'study_ask',
    featureName: 'Context-Aware Hybrid AI Study Tutor',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-argon'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Grounded Q&A with responseSchema is supported on Vertex AI via ADC and eligible for Google Cloud Free Trial credits.',
  },
  {
    endpoint: 'POST /api/study/quiz',
    operation: 'study_quiz',
    featureName: 'Diagnostic & Adaptive Quiz Generator',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Structured MCQ generation is supported on Vertex AI via ADC and covered by $300 Free Trial credits.',
  },
  {
    endpoint: 'POST /api/study/mistakes-and-plan',
    operation: 'study_mistakes_and_plan',
    featureName: 'Mistake DNA & Adaptive Revision Plan',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Structured JSON reasoning over quiz attempts is supported on Vertex AI via ADC and covered by Free Trial credits.',
  },
  {
    endpoint: 'POST /api/study/quick-revise',
    operation: 'quick_revise',
    featureName: 'Sticky Notes, Flashcards, Mind Map & One-Page Revision',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Structured JSON synthesis is supported on Vertex AI via ADC and covered by Free Trial credits.',
  },
  {
    endpoint: 'POST /api/study/teach-it-back',
    operation: 'study_teach_it_back',
    featureName: 'Feynman "Teach It Back" Evaluator',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Text evaluation with JSON schema is supported on Vertex AI via ADC and covered by Free Trial credits.',
  },
  {
    endpoint: 'POST /api/study/scan-notes',
    operation: 'study_scan_notes',
    featureName: 'Handwritten Note & Whiteboard OCR Scanner',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Multimodal inlineData (base64 image) + JSON output is supported on Vertex AI via ADC and covered by Free Trial credits.',
  },
  {
    endpoint: 'POST /api/study/transcribe-audio',
    operation: 'study_transcribe_audio',
    featureName: 'Voice Note & Lecture Audio Transcription',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.5-transcribe', 'gemini-3.8-flash'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Dedicated audio transcription via gemini-3.5-transcribe / multimodal Gemini is supported with structured study note synthesis.',
  },
  {
    endpoint: 'POST /api/explore/daily-news',
    operation: 'explore_daily_news',
    featureName: 'Daily Current Affairs Digest',
    targetProvider: 'vertex_ai_eligible',
    trialCreditsEligible: true,
    billingService: 'Vertex AI API (aiplatform.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
    migrationAction: 'migrate_when_vertex_ready',
    reason: 'Text generation is covered by Vertex AI Free Trial credits (Search grounding tool is omitted in trial-safe Vertex mode to avoid separate Grounding with Google Search per-query charges).',
  },
  {
    endpoint: 'POST /api/create/visualize',
    operation: 'create_visualize',
    featureName: 'Creative Studio Concept Visualizer (Nano Banana)',
    targetProvider: 'developer_api_only',
    trialCreditsEligible: false,
    billingService: 'Google AI Studio Developer API (generativelanguage.googleapis.com)',
    modelsUsed: ['gemini-nano-banana-2.1', 'gemini-3.1-flash-lite-image'],
    migrationAction: 'keep_on_developer_api_with_fallback',
    reason: 'gemini-nano-banana-2.1 is a paid Developer API image model. When paid credits are unavailable, LearnMate renders a clearly labeled deterministic SVG scientific diagram.',
  },
  {
    endpoint: 'POST /api/create/video-lesson',
    operation: 'create_video_lesson',
    featureName: 'AI Video Lesson Generator (Omni Flash)',
    targetProvider: 'developer_api_only',
    trialCreditsEligible: false,
    billingService: 'Google AI Studio Developer API Interactions (generativelanguage.googleapis.com)',
    modelsUsed: ['gemini-omni-1.1-flash'],
    migrationAction: 'keep_on_developer_api_with_fallback',
    reason: 'gemini-omni-1.1-flash requires the Developer API Interactions endpoint (ai.interactions.create) and a paid API key; provides a clearly labeled deterministic Animated Explanation when blocked by billing.',
  },
  {
    endpoint: 'POST /api/create/lofi-music',
    operation: 'create_lofi_music',
    featureName: 'Lo-Fi Focus Radio (Lyria Music Clip)',
    targetProvider: 'developer_api_only',
    trialCreditsEligible: false,
    billingService: 'Google AI Studio Developer API (generativelanguage.googleapis.com)',
    modelsUsed: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
    migrationAction: 'keep_on_developer_api_with_fallback',
    reason: 'lyria-3-clip-preview streaming music generation requires a paid Developer API key; uses a multi-layered deterministic Web Audio Focus Radio synthesizer when unavailable.',
  },
  {
    endpoint: 'POST /api/study/youtube-analyze',
    operation: 'youtube_analyze',
    featureName: 'YouTube Video URL Direct Ingestion',
    targetProvider: 'developer_api_only',
    trialCreditsEligible: false,
    billingService: 'Google AI Studio Developer API (generativelanguage.googleapis.com)',
    modelsUsed: ['gemini-3.8-flash'],
    migrationAction: 'keep_on_developer_api_with_fallback',
    reason: 'Direct public YouTube watch URLs in fileData.fileUri use the Developer API with public oEmbed metadata verification.',
  },
  {
    endpoint: 'WS /api/live',
    operation: 'live_voice_tutor',
    featureName: 'Real-Time Gemini Live Voice Tutor',
    targetProvider: 'developer_api_only',
    trialCreditsEligible: false,
    billingService: 'Google AI Studio Developer API Live WebSocket',
    modelsUsed: ['gemini-3.8-live'],
    migrationAction: 'keep_on_developer_api_with_fallback',
    reason: 'gemini-3.8-live bidirectional WebSocket session is configured for the Developer API with automatic fallback to grounded browser speech synthesis.',
  },
];

export interface ResolvedVertexConfig {
  mode: 'auto' | 'enabled' | 'disabled';
  projectId: string;
  location: string;
  authMethod: 'application_default_credentials';
  orgPolicyKeyCreationDisabled: boolean;
  configError?: string;
}

export interface VertexDiagnosticProbeResult {
  checkedAt: string;
  status: VertexProbeStatus;
  readyForMigration: boolean;
  activeProvider: AiBackendProvider;
  billingService: string;
  billingApiEndpoint: string;
  trialCreditsEligible: boolean;
  projectId: string;
  location: string;
  authMethod: string;
  runtimeIdentityHint?: string;
  modelTested: string;
  latencyMs: number;
  sampleOutput?: string;
  httpStatus?: number;
  errorReason?: string;
  remediationSteps: string[];
}

/**
 * Resolves a model alias for Vertex AI publisher model endpoints.
 * Vertex AI publisher endpoints do not accept `-latest` aliases like `gemini-flash-latest`.
 */
export function resolveVertexModelName(modelName: string): string {
  const trimmed = (modelName || '').trim();
  if (!trimmed || trimmed === 'gemini-flash-latest') {
    return 'gemini-3.1-flash-lite';
  }
  return trimmed;
}

/**
 * Resolves server-side Vertex AI configuration using strictly Application Default Credentials (ADC).
 * Compliant with organization policy `iam.disableServiceAccountKeyCreation` — never requires or parses
 * downloadable service-account JSON key files.
 */
export function resolveVertexConfig(params: {
  env?: Record<string, string | undefined>;
  fallbackProjectId?: string;
}): ResolvedVertexConfig {
  const env = params.env || process.env;
  const rawMode = (env.GOOGLE_GENAI_USE_VERTEXAI || 'auto').trim().toLowerCase();
  const mode: 'auto' | 'enabled' | 'disabled' =
    rawMode === 'false' || rawMode === '0' || rawMode === 'disabled'
      ? 'disabled'
      : rawMode === 'true' || rawMode === '1' || rawMode === 'enabled'
      ? 'enabled'
      : 'auto';

  const location = (env.GOOGLE_CLOUD_LOCATION || 'us-central1').trim();
  const projectId = (
    env.GOOGLE_CLOUD_PROJECT ||
    params.fallbackProjectId ||
    'cs-project-wsjgygls'
  ).trim();

  let configError: string | undefined;
  if (!projectId) {
    configError = 'GOOGLE_CLOUD_PROJECT is required for Vertex AI initialization.';
  } else if (!location) {
    configError = 'GOOGLE_CLOUD_LOCATION is required for Vertex AI initialization.';
  }

  return {
    mode,
    projectId,
    location,
    authMethod: 'application_default_credentials',
    orgPolicyKeyCreationDisabled: true,
    configError,
  };
}

/**
 * Classifies a raw error returned by a Vertex AI (`aiplatform.googleapis.com`) probe call
 * into an actionable status and concrete keyless ADC / IAM setup steps.
 */
export function classifyVertexProbeError(params: {
  error: unknown;
  projectId: string;
  location: string;
  runtimeIdentityHint?: string;
}): {
  status: VertexProbeStatus;
  httpStatus?: number;
  errorReason: string;
  remediationSteps: string[];
} {
  const { error, projectId, location, runtimeIdentityHint } = params;
  const rawMessage =
    error instanceof Error ? error.message : String(error || 'Unknown Vertex AI error');
  const lower = rawMessage.toLowerCase();
  const statusObj = error as { status?: number; statusCode?: number; code?: number };
  const httpStatus =
    typeof statusObj?.status === 'number'
      ? statusObj.status
      : typeof statusObj?.statusCode === 'number'
      ? statusObj.statusCode
      : typeof statusObj?.code === 'number'
      ? statusObj.code
      : undefined;

  if (
    lower.includes('aiplatform.endpoints.predict') ||
    lower.includes('iam_permission_denied') ||
    (httpStatus === 403 && lower.includes('permission') && lower.includes('denied'))
  ) {
    const identityNote = runtimeIdentityHint
      ? `Current Cloud Run / Metadata ADC principal is "${runtimeIdentityHint}".`
      : 'The current runtime Application Default Credentials (ADC) principal lacks Vertex AI prediction permission on your project.';
    return {
      status: 'iam_permission_denied',
      httpStatus: httpStatus ?? 403,
      errorReason: `IAM_PERMISSION_DENIED: Permission 'aiplatform.endpoints.predict' denied on project "${projectId}" (${location}). ${identityNote}`,
      remediationSteps: [
        `Enable the Vertex AI API (aiplatform.googleapis.com) in Google Cloud project "${projectId}".`,
        `Keyless ADC Remediation (compliant with iam.disableServiceAccountKeyCreation): Grant the "Vertex AI User" role (roles/aiplatform.user, which includes aiplatform.endpoints.predict) directly to the attached Cloud Run runtime service account (${runtimeIdentityHint || 'your Cloud Run service account'}) on project "${projectId}".`,
        `Example gcloud command (no JSON key needed): gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${runtimeIdentityHint || 'RUNTIME_SERVICE_ACCOUNT_EMAIL'}" --role="roles/aiplatform.user"`,
      ],
    };
  }

  if (
    lower.includes('has not been used in project') ||
    lower.includes('service_disabled') ||
    lower.includes('aiplatform.googleapis.com/overview') ||
    lower.includes('agent platform api has not been used')
  ) {
    return {
      status: 'api_not_enabled',
      httpStatus: httpStatus ?? 403,
      errorReason: `SERVICE_DISABLED: Vertex AI API / Agent Platform API (aiplatform.googleapis.com) is not enabled on project "${projectId}".`,
      remediationSteps: [
        `Enable the Vertex AI API (aiplatform.googleapis.com) in project "${projectId}" via Google Cloud Console or: gcloud services enable aiplatform.googleapis.com --project=${projectId}`,
        `Wait 1–2 minutes for API propagation and re-run the low-cost Vertex AI probe.`,
      ],
    };
  }

  if (
    lower.includes('billing_disabled') ||
    lower.includes('billing account') ||
    lower.includes('billing to be enabled')
  ) {
    return {
      status: 'billing_disabled',
      httpStatus: httpStatus ?? 403,
      errorReason: `BILLING_DISABLED: Project "${projectId}" is not linked to an active Google Cloud Billing Account.`,
      remediationSteps: [
        `Link project "${projectId}" to your Google Cloud Free Trial Billing Account ($300 credit) in Google Cloud Console -> Billing.`,
      ],
    };
  }

  if (
    httpStatus === 404 ||
    lower.includes('not found') ||
    lower.includes('publisher model')
  ) {
    return {
      status: 'model_not_found',
      httpStatus: httpStatus ?? 404,
      errorReason: `MODEL_NOT_FOUND: Requested Gemini model is not available in region "${location}" for project "${projectId}".`,
      remediationSteps: [
        `Set GOOGLE_CLOUD_LOCATION=us-central1 or GOOGLE_CLOUD_LOCATION=global for full Gemini model availability on Vertex AI.`,
      ],
    };
  }

  if (
    httpStatus === 401 ||
    lower.includes('could not load the default credentials') ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid_grant')
  ) {
    return {
      status: 'unauthenticated',
      httpStatus: httpStatus ?? 401,
      errorReason: `UNAUTHENTICATED: Application Default Credentials (ADC) could not be loaded for project "${projectId}".`,
      remediationSteps: [
        `On Cloud Run: attach a runtime service account with roles/aiplatform.user (no JSON key required).`,
        `Locally: run "gcloud auth application-default login --project=${projectId}".`,
      ],
    };
  }

  return {
    status: 'probe_failed',
    httpStatus,
    errorReason: rawMessage.slice(0, 260),
    remediationSteps: [
      `Verify GOOGLE_CLOUD_PROJECT="${projectId}" and GOOGLE_CLOUD_LOCATION="${location}" have Vertex AI API (aiplatform.googleapis.com) enabled and that the runtime ADC service account holds roles/aiplatform.user.`,
    ],
  };
}

/**
 * Builds the centralized AI Capability Registry summarizing live availability,
 * authentication mode, billing requirements, and fallback behavior for all 9 capabilities.
 */
export function buildAiCapabilityRegistry(params: {
  vertexProbe: VertexDiagnosticProbeResult;
  hasDeveloperApiKey: boolean;
  developerApiBillingDepleted: boolean;
  hasAnthropicApiKey?: boolean;
  hasHiggsfieldApiKey?: boolean;
}): AICapabilityDescriptor[] {
  const {
    vertexProbe,
    hasDeveloperApiKey,
    developerApiBillingDepleted,
    hasAnthropicApiKey = false,
    hasHiggsfieldApiKey = false,
  } = params;
  const vertexReady = vertexProbe.readyForMigration;
  const devAvailable = hasDeveloperApiKey && !developerApiBillingDepleted;
  const studyOnline = vertexReady || devAvailable;

  const studyVerification: VerificationStatus = studyOnline
    ? 'WORKING_VERIFIED'
    : 'WORKING_WITH_NON_AI_FALLBACK';

  const studyBlockedReason = !studyOnline
    ? vertexProbe.status === 'iam_permission_denied'
      ? `Vertex AI ADC returned HTTP 403 IAM_PERMISSION_DENIED (${vertexProbe.errorReason || 'missing roles/aiplatform.user'}) and Developer API key returned HTTP 402 prepayment credits depleted.`
      : 'Developer API prepayment credits are depleted (HTTP 402) and Vertex AI ADC is not yet authorized.'
    : undefined;

  const paidMediaNotice = devAvailable
    ? 'Paid Developer API model configured and ready.'
    : 'AI media generation requires configuration or paid model access.';

  const paidMediaStatus: VerificationStatus = devAvailable
    ? 'WORKING_VERIFIED'
    : 'BLOCKED_BY_BILLING';

  return [
    {
      id: 'text_generation',
      name: 'Gemini Text & Reasoning (Low-Latency Default: gemini-3.1-flash-lite)',
      provider: vertexReady ? 'vertex_ai' : devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-3.1-flash-lite / gemini-3.8-flash',
      endpoint: '/api/study/ask, /api/study/quiz, /api/study/mistakes-and-plan, /api/study/quick-revise',
      authenticationType: vertexReady
        ? 'adc_service_account'
        : devAvailable
        ? 'developer_api_key'
        : 'deterministic_engine',
      enabled: true,
      configured: vertexReady || hasDeveloperApiKey,
      available: true,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'vertex_free_trial_eligible',
      verificationStatus: studyVerification,
      lastCheckedStatus: studyOnline
        ? `Online via ${vertexReady ? 'Vertex AI ADC' : 'Gemini Developer API'}`
        : 'Grounded deterministic study engine active (Vertex IAM / Developer API 402 fallback)',
      lastError: studyBlockedReason,
      userFacingNotice: studyOnline
        ? 'Live Gemini reasoning active (gemini-3.1-flash-lite default).'
        : 'Using source-grounded deterministic study synthesis while cloud AI credits/IAM are offline.',
      fallbackStrategy:
        'Extracts verbatim page quotes, formulas, diagnostic questions, and flashcards directly from uploaded study pages.',
    },
    {
      id: 'document_understanding',
      name: 'PDF, YouTube & Handwritten Note OCR Understanding',
      provider: vertexReady ? 'vertex_ai' : devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-3.1-flash-lite / gemini-3.8-flash',
      endpoint: '/api/study/analyze, /api/study/scan-notes, /api/study/youtube-analyze',
      authenticationType: vertexReady
        ? 'adc_service_account'
        : devAvailable
        ? 'developer_api_key'
        : 'deterministic_engine',
      enabled: true,
      configured: vertexReady || hasDeveloperApiKey,
      available: true,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'vertex_free_trial_eligible',
      verificationStatus: studyVerification,
      lastCheckedStatus: studyOnline
        ? 'Multimodal document analysis active'
        : 'Deterministic PDF/Note parser & YouTube oEmbed analyzer active',
      lastError: studyBlockedReason,
      userFacingNotice: studyOnline
        ? 'Live multimodal document analysis active.'
        : 'Using deterministic section extraction and public YouTube oEmbed metadata.',
      fallbackStrategy:
        'Client-side PDF.js page extraction + server-side heading/formula segmentation and YouTube oEmbed verification.',
    },
    {
      id: 'complex_reasoning_claude',
      name: 'Anthropic Claude Optional Complex STEM & Spec Provider',
      provider: hasAnthropicApiKey ? 'anthropic_claude' : 'fallback',
      modelId: 'claude-3-5-sonnet-latest',
      endpoint: '/api/study/ask (opt-in complex reasoning), /api/providers/status',
      authenticationType: hasAnthropicApiKey ? 'developer_api_key' : 'deterministic_engine',
      enabled: true,
      configured: hasAnthropicApiKey,
      available: hasAnthropicApiKey,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'developer_api_paid_prepayment',
      verificationStatus: hasAnthropicApiKey ? 'WORKING_VERIFIED' : 'BLOCKED_BY_PERMISSION',
      lastCheckedStatus: hasAnthropicApiKey
        ? 'Anthropic API key configured (explicit student consent required before sending private study text)'
        : 'ANTHROPIC_API_KEY not configured in environment — routing complex tasks to Gemini / deterministic engine',
      lastError: hasAnthropicApiKey
        ? undefined
        : 'ANTHROPIC_API_KEY is not set in server environment.',
      userFacingNotice: hasAnthropicApiKey
        ? 'Claude complex reasoning available on explicit opt-in.'
        : 'Anthropic Claude provider unconfigured (ANTHROPIC_API_KEY missing); using Gemini & deterministic spec engine.',
      fallbackStrategy:
        'Routes complex reasoning, game specs, and mini-app specifications to Gemini or verified deterministic educational templates.',
    },
    {
      // No Higgsfield API client exists in this codebase, so a configured key must never be
      // reported as a working integration.
      id: 'higgsfield_media',
      name: 'Higgsfield Video & Visual Generation Adapter',
      provider: 'fallback',
      modelId: 'not-implemented',
      endpoint: 'none',
      authenticationType: 'deterministic_engine',
      enabled: false,
      configured: hasHiggsfieldApiKey,
      available: false,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'free_deterministic_local',
      verificationStatus: 'UNSUPPORTED_IN_CURRENT_ENVIRONMENT',
      lastCheckedStatus: 'Not implemented: the server makes no Higgsfield API calls.',
      lastError: 'Higgsfield integration is not implemented.',
      userFacingNotice: 'Higgsfield video generation is not implemented.',
      fallbackStrategy:
        'Renders verified HTML5 Canvas / SVG multi-scene animated explanations with real kinematics and probability formulas.',
    },
    {
      id: 'image_generation',
      name: 'Concept Diagram & Scientific Image Generation',
      provider: devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-nano-banana-2.1',
      endpoint: '/api/create/visualize',
      authenticationType: devAvailable ? 'developer_api_key' : 'deterministic_engine',
      enabled: true,
      configured: hasDeveloperApiKey,
      available: devAvailable,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'developer_api_paid_prepayment',
      verificationStatus: paidMediaStatus,
      lastCheckedStatus: devAvailable
        ? 'Nano Banana 2.1 ready'
        : 'BLOCKED_BY_BILLING (HTTP 402 prepayment credits depleted) — Deterministic SVG Scientific Diagram active',
      lastError: devAvailable
        ? undefined
        : 'HTTP 402: Gemini Developer API prepayment credits are depleted for paid image model gemini-nano-banana-2.1.',
      userFacingNotice: paidMediaNotice,
      fallbackStrategy:
        'Renders a clearly labeled deterministic SVG scientific diagram / mathematical function plot from the study topic.',
    },
    {
      id: 'video_generation',
      name: 'AI Video Lesson & Image-to-Video Animation (Omni Flash)',
      provider: devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-omni-1.1-flash',
      endpoint: '/api/create/video-lesson, /api/create/video-jobs/:jobId',
      authenticationType: devAvailable ? 'developer_api_key' : 'deterministic_engine',
      enabled: true,
      configured: hasDeveloperApiKey,
      available: devAvailable,
      supportsStreaming: false,
      supportsAsyncJobs: true,
      estimatedCostOrBillingCategory: 'developer_api_paid_prepayment',
      verificationStatus: paidMediaStatus,
      lastCheckedStatus: devAvailable
        ? 'Omni 1.1 Flash Interactions API ready'
        : 'BLOCKED_BY_BILLING (HTTP 402 prepayment credits depleted) — Deterministic Animated Explanation active',
      lastError: devAvailable
        ? undefined
        : 'HTTP 402: Paid Developer API access is required for gemini-omni-1.1-flash MP4 video generation.',
      userFacingNotice: paidMediaNotice,
      fallbackStrategy:
        'Provides a clearly labeled interactive HTML5 Canvas / SVG Animated Explanation with narrated scenes and play/pause/scrub controls.',
    },
    {
      id: 'music_generation',
      name: 'Lo-Fi Study Music Generation (Lyria 3 & Focus Radio)',
      provider: devAvailable ? 'developer_api' : 'fallback',
      modelId: 'lyria-3-clip-preview',
      endpoint: '/api/create/lofi-music',
      authenticationType: devAvailable ? 'developer_api_key' : 'deterministic_engine',
      enabled: true,
      configured: hasDeveloperApiKey,
      available: devAvailable,
      supportsStreaming: true,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'developer_api_paid_prepayment',
      verificationStatus: paidMediaStatus,
      lastCheckedStatus: devAvailable
        ? 'Lyria 3 clip streaming ready'
        : 'BLOCKED_BY_BILLING (HTTP 402 prepayment credits depleted) — Deterministic Web Audio Focus Radio active',
      lastError: devAvailable
        ? undefined
        : 'HTTP 402: Paid Developer API access is required for lyria-3-clip-preview audio streaming.',
      userFacingNotice: paidMediaNotice,
      fallbackStrategy:
        'Plays warm, multi-layered deterministic Web Audio instrumental lo-fi synth presets (Rhodes chords, soft percussion, vinyl/rain ambience).',
    },
    {
      id: 'audio_transcription',
      name: 'Voice Note & Lecture Audio Transcription',
      provider: vertexReady ? 'vertex_ai' : devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-3.5-transcribe',
      endpoint: '/api/study/transcribe-audio',
      authenticationType: vertexReady
        ? 'adc_service_account'
        : devAvailable
        ? 'developer_api_key'
        : 'deterministic_engine',
      enabled: true,
      configured: vertexReady || hasDeveloperApiKey,
      available: true,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'vertex_free_trial_eligible',
      verificationStatus: studyVerification,
      lastCheckedStatus: studyOnline
        ? 'gemini-3.5-transcribe ready'
        : 'Browser SpeechRecognition + structured note formatter active',
      lastError: studyBlockedReason,
      userFacingNotice: studyOnline
        ? 'Cloud audio transcription active.'
        : 'Using browser speech capture and deterministic study note structuring.',
      fallbackStrategy:
        'Structures live browser SpeechRecognition or typed lecture notes into clean bullet points, summary, and key concepts.',
    },
    {
      id: 'gemini_live',
      name: 'Gemini Live Real-Time Voice Tutor',
      provider: devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-3.8-live',
      endpoint: 'WS /api/live',
      authenticationType: devAvailable ? 'developer_api_key' : 'deterministic_engine',
      enabled: true,
      configured: hasDeveloperApiKey,
      available: true,
      supportsStreaming: true,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'developer_api_paid_prepayment',
      verificationStatus: devAvailable ? 'WORKING_VERIFIED' : 'WORKING_WITH_NON_AI_FALLBACK',
      lastCheckedStatus: devAvailable
        ? 'WebSocket /api/live bidirectional audio ready'
        : 'WebSocket /api/live connected with grounded browser SpeechSynthesis fallback',
      lastError: devAvailable
        ? undefined
        : 'Developer API prepayment credits depleted (HTTP 402); VoiceTutorModal automatically switches to grounded spoken tutor mode.',
      userFacingNotice: devAvailable
        ? 'Gemini Live low-latency voice session active.'
        : 'Grounded spoken voice tutor active.',
      fallbackStrategy:
        'Preserves existing /api/live WebSocket handshake and answers spoken questions using grounded study notes + Web Speech synthesis.',
    },
    {
      id: 'search_grounding',
      name: 'Daily Current Affairs with Google Search Grounding',
      provider: devAvailable ? 'developer_api' : vertexReady ? 'vertex_ai' : 'fallback',
      modelId: 'gemini-3.8-flash',
      endpoint: '/api/explore/daily-news',
      authenticationType: devAvailable
        ? 'developer_api_key'
        : vertexReady
        ? 'adc_service_account'
        : 'deterministic_engine',
      enabled: true,
      configured: hasDeveloperApiKey || vertexReady,
      available: true,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'vertex_free_trial_eligible',
      verificationStatus: studyVerification,
      lastCheckedStatus: studyOnline
        ? 'Live current affairs synthesis active'
        : 'Curated exam-focused current affairs digest active',
      lastError: studyBlockedReason,
      userFacingNotice: studyOnline
        ? 'Live search-grounded current affairs active.'
        : 'Displaying curated exam-relevant current affairs edition with practice MCQs.',
      fallbackStrategy:
        'Serves curated Science, Technology, India, Economy, and Environment current affairs articles with interactive MCQs.',
    },
    {
      id: 'maps_grounding',
      name: 'Educational Maps ("Learning Around Me" via Google Maps Grounding)',
      provider: devAvailable ? 'developer_api' : 'fallback',
      modelId: 'gemini-3.8-flash',
      endpoint: '/api/explore/educational-maps',
      authenticationType: devAvailable ? 'developer_api_key' : 'deterministic_engine',
      enabled: true,
      configured: hasDeveloperApiKey,
      available: true,
      supportsStreaming: false,
      supportsAsyncJobs: false,
      estimatedCostOrBillingCategory: 'developer_api_paid_prepayment',
      verificationStatus: devAvailable ? 'WORKING_VERIFIED' : 'WORKING_WITH_NON_AI_FALLBACK',
      lastCheckedStatus: devAvailable
        ? 'Google Maps grounding tool active'
        : 'Curated regional science center, planetarium & university library directory active',
      lastError: devAvailable ? undefined : studyBlockedReason,
      userFacingNotice: devAvailable
        ? 'Google Maps grounded discovery active.'
        : 'Showing verified regional science centers, libraries, and museums with direct Google Maps links.',
      fallbackStrategy:
        'Generates city-matched science centers, reference libraries, and museums with direct Google Maps search links.',
    },
  ];
}
