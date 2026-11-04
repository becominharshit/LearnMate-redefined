import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import helmet from 'helmet';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import {
  GeminiRequestManager,
  computeRequestFingerprint,
  classifyGeminiError,
  extractPreciseEducationalConcepts,
  buildSpecificYouTubeSearchQuery,
  parseIsoDurationSeconds,
  rankAndFilterYouTubeCandidates,
  type RawYouTubeCandidate,
  type GeminiErrorCategory,
} from './src/utils/stabilityEngine.ts';
import {
  enforceSourceControlPolicy,
  evaluateTeachItBackCoverage,
  sanitizeInstrumentalLofiPrompt,
  type SourceControlMode,
} from './src/utils/learnmate2Engine.ts';
import {
  VERTEX_TRIAL_ELIGIBILITY_MATRIX,
  resolveVertexConfig,
  resolveVertexModelName,
  classifyVertexProbeError,
  buildAiCapabilityRegistry,
  type AiBackendProvider,
  type VertexDiagnosticProbeResult,
} from './src/utils/vertexAiRouter.ts';
import {
  buildAnimatedExplanationScenes,
  type AnimatedExplanationScene,
} from './src/utils/educationalSpecsEngine.ts';
import {
  callAnthropicMessagesApi,
  generateProcedural3DScene,
} from './src/utils/ai3dModelEngine.ts';
import {
  callClaude,
  toClaudeJsonSchema,
  CLAUDE_IMAGE_MEDIA_TYPES,
  type ClaudeEffort,
} from './src/utils/anthropicClient.ts';
import {
  buildHiggsfieldAuthHeader,
  submitHiggsfieldJob,
  waitForHiggsfieldResult,
  uploadDataUrlToHiggsfield,
  type HiggsfieldSubmitResponse,
} from './src/utils/higgsfieldClient.ts';
import type { Custom3DSceneSpec } from './src/types/study.ts';
import {
  authenticateStudent,
  readBearerToken,
  type IdTokenVerifier,
  type VerifiedStudent,
} from './src/server/studentAuth.ts';
import {
  StudentUsageLimiter,
  dailyLimitsFromEnv,
  hashForLogs,
} from './src/server/usageLimits.ts';
import {
  isAllowedOrigin,
  isPublicApiPath,
  usageCategoryForPath,
} from './src/server/requestGuards.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LearnMate uses Claude only. Gemini's API terms do not allow apps likely to be used by people
 * under 18, so every Gemini client below stays disabled even if Google keys are present.
 * The remaining Gemini code is removed together with its old features in Phase 3.
 */
const GEMINI_ENABLED = false;

const DEFAULT_GCP_PROJECT_ID = (process.env.GOOGLE_CLOUD_PROJECT || '').trim();

// ---- Student sign-in (Firebase Authentication) ----
const FIREBASE_USE_EMULATOR = (process.env.VITE_FIREBASE_USE_EMULATOR || '').trim() === 'true';
const FIREBASE_PROJECT_ID =
  (process.env.VITE_FIREBASE_PROJECT_ID || '').trim() || (FIREBASE_USE_EMULATOR ? 'demo-learnmate' : '');
if (FIREBASE_USE_EMULATOR && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

/** Verifies Firebase ID tokens with Google's public keys; only the project id is needed. */
function createIdTokenVerifier(): IdTokenVerifier | null {
  if (!FIREBASE_PROJECT_ID) return null;
  const adminApp = getAdminApps()[0] || initializeAdminApp({ projectId: FIREBASE_PROJECT_ID });
  const adminAuth = getAdminAuth(adminApp);
  return (idToken: string) => adminAuth.verifyIdToken(idToken);
}

const verifyStudentIdToken = createIdTokenVerifier();
const studentUsage = new StudentUsageLimiter({
  dailyLimits: dailyLimitsFromEnv(process.env),
  perMinute: Number(process.env.AI_REQUESTS_PER_MINUTE) || 12,
});

type StudentRequest = express.Request & { student?: VerifiedStudent };

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_MODELS = new Set([
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-4-argon',
  'gemini-flash-latest',
]);
const FALLBACK_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const;
const GEMINI_TIMEOUT_MS = 25000;

// Anthropic Claude: "smart" for tutoring, quizzes and OCR; "fast" for high-volume extraction.
const CLAUDE_SMART_MODEL = process.env.ANTHROPIC_MODEL_SMART?.trim() || 'claude-sonnet-5-5';
const CLAUDE_FAST_MODEL = process.env.ANTHROPIC_MODEL_FAST?.trim() || 'claude-haiku-5-5';

type AiTier = 'fast' | 'smart';

function getAnthropicApiKey(): string | null {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key || key.startsWith('MY_')) return null;
  return key;
}

function hasGeminiConfigured(): boolean {
  return false;
}

/** Claude handles every AI feature whenever its key is set. */
function anthropicPreferred(): boolean {
  return Boolean(getAnthropicApiKey());
}

function claudeModelFor(tier: AiTier): string {
  return tier === 'fast' ? CLAUDE_FAST_MODEL : CLAUDE_SMART_MODEL;
}

// Higgsfield media generation (Create section). Model ids are overridable via env.
const HIGGSFIELD_IMAGE_MODELS = {
  diagram: process.env.HIGGSFIELD_DIAGRAM_MODEL?.trim() || 'ideogram/v4.0',
  illustration: process.env.HIGGSFIELD_ILLUSTRATION_MODEL?.trim() || 'recraft/v4.1/text-to-image',
  photo: process.env.HIGGSFIELD_PHOTO_MODEL?.trim() || 'higgsfield-ai/soul/v2/standard',
} as const;
const HIGGSFIELD_TEXT_TO_VIDEO_MODEL =
  process.env.HIGGSFIELD_VIDEO_MODEL?.trim() || 'kling-video/v3.0/std/text-to-video';
const HIGGSFIELD_IMAGE_TO_VIDEO_MODEL =
  process.env.HIGGSFIELD_IMAGE_TO_VIDEO_MODEL?.trim() || 'kling-video/v2.5-turbo/pro/image-to-video';

/** Optional proxy or local mock server for Higgsfield; defaults to https://api.higgsfield.ai. */
const HIGGSFIELD_API_BASE = process.env.HIGGSFIELD_BASE_URL?.trim() || undefined;

/**
 * Higgsfield's API terms require every end user to be 18 or older, so it stays paused until the
 * app knows each student's age (Phase 2). After that it is enabled for 18+ accounts only.
 */
const HIGGSFIELD_PAUSED = true;

function hasHiggsfieldKey(): boolean {
  const key = (process.env.HIGGSFIELD_API_KEY || '').trim();
  return Boolean(key) && !key.startsWith('MY_');
}

function getHiggsfieldAuth(): string | null {
  if (HIGGSFIELD_PAUSED || !hasHiggsfieldKey()) return null;
  return buildHiggsfieldAuthHeader(
    (process.env.HIGGSFIELD_API_KEY || '').trim(),
    process.env.HIGGSFIELD_API_SECRET
  );
}

/**
 * Added to every Claude prompt. Most students are 16-18, and Anthropic's rules for products
 * serving minors require age-appropriate safeguards.
 */
const MINOR_SAFETY_RULES = `Safety: the student is a teenager (usually 16 to 18) preparing for JEE. Keep every reply age-appropriate and focused on learning. Do not produce sexual content, graphic violence, or instructions for weapons, drugs, self-harm or other dangerous acts; briefly redirect to studying instead. If the student mentions self-harm, hopelessness or severe exam stress, reply with warmth, encourage them to talk to a parent, teacher or friend they trust, and share India's free Tele-MANAS helpline: 14416 (or 1-800-891-4416). Never ask for personal details such as phone numbers, addresses or photos.`;

/** Reply-language instruction for tutoring prompts, from the student's profile preference. */
function languageInstruction(preferred?: string): string {
  const raw = (preferred || '').trim();
  const lang = raw.toLowerCase();
  if (lang.includes('hinglish')) {
    return 'Language: reply in Hinglish, i.e. conversational Hindi written in Roman (English) script mixed naturally with English technical terms, for example "Pehle free body diagram banao, phir Newton ka second law lagao." Keep formulas, units and technical terms in English.';
  }
  if (!lang || lang === 'english') {
    return 'Language: reply in clear, simple English. If the student writes in Hinglish or Hindi, reply in the same style.';
  }
  const languageName = raw.replace(/[^A-Za-z ]/g, '').trim() || 'English';
  return `Language: reply in simple ${languageName}, keeping formulas, units and technical terms in English.`;
}

/** Appended to prompts whose output the UI renders with KaTeX (Markdown + LaTeX + mhchem). */
const LATEX_FORMAT_RULES = `Formatting rules for every text field:
- Write all mathematics in LaTeX between single dollar signs for inline math ($v = u + at$) and double dollar signs for display equations ($$F = \\frac{G m_1 m_2}{r^2}$$).
- Write chemical formulas and reactions with mhchem inside math: $\\ce{H2SO4}$, $\\ce{N2 + 3H2 -> 2NH3}$.
- Never put LaTeX commands outside dollar delimiters. Use Markdown for structure: short paragraphs, numbered steps, **bold** key terms.`;

/** For text the UI shows as plain text (sticky notes, mind maps, revision plans, copy and export). */
const UNICODE_FORMAT_RULES = `Formatting rules for every text field:
- Write formulas as plain text with Unicode symbols, for example v = u + at, s = ut + ½at², x², √2, π, Δx, θ, μ, ∫, Σ, →, ≤, ≥, ≈, ×, and chemical formulas such as H₂SO₄ and CO₂.
- Never use LaTeX, dollar signs or Markdown formatting.`;

// Tracks per-model quota/rate-limit cooldown timestamps so requests immediately route to healthy models
const modelCooldownUntil = new Map<string, number>();

const aiUsageStats = {
  totalRequests: 0,
  cacheHits: 0,
  deduplicatedHits: 0,
  failedRequests: 0,
  totalLatencyMs: 0,
  byOperation: {} as Record<string, { count: number; totalMs: number; errors: number }>,
};

function getOrderedCandidateModels(preferredModel?: string): string[] {
  const now = Date.now();
  const baseOrder: string[] = [];
  if (preferredModel && ALLOWED_MODELS.has(preferredModel)) {
    baseOrder.push(preferredModel);
  }
  for (const candidate of FALLBACK_MODEL_CHAIN) {
    if (!baseOrder.includes(candidate)) {
      baseOrder.push(candidate);
    }
  }
  const available = baseOrder.filter((m) => (modelCooldownUntil.get(m) || 0) <= now);
  const coolingDown = baseOrder.filter((m) => (modelCooldownUntil.get(m) || 0) > now);
  return [...available, ...coolingDown];
}

const geminiManager = new GeminiRequestManager({
  // Shared by every student's requests; 2 slots made everyone queue behind one slow call.
  maxConcurrency: 6,
  maxRetries: 2,
  baseDelayMs: 650,
  maxDelayMs: 6000,
  cacheTtlMs: 20 * 60 * 1000,
  onLog: (entry) => {
    aiUsageStats.totalRequests += 1;
    aiUsageStats.totalLatencyMs += entry.durationMs;
    if (entry.status === 'cache_hit') aiUsageStats.cacheHits += 1;
    if (entry.status === 'dedup_hit') aiUsageStats.deduplicatedHits += 1;
    if (entry.status === 'failed') aiUsageStats.failedRequests += 1;
    const opBucket = aiUsageStats.byOperation[entry.operation] || {
      count: 0,
      totalMs: 0,
      errors: 0,
    };
    opBucket.count += 1;
    opBucket.totalMs += entry.durationMs;
    if (entry.status === 'failed') opBucket.errors += 1;
    aiUsageStats.byOperation[entry.operation] = opBucket;

    const approxTokens = Math.max(1, Math.round(entry.approxInputChars / 4));
    const statusLabel = entry.status === 'failed' ? 'fallback_engaged' : entry.status;
    console.log(
      `[AI] op=${entry.operation} model=${entry.model} state=${statusLabel} retries=${entry.retries} durationMs=${entry.durationMs} approxInputTokens=${approxTokens}` +
        (entry.errorReason ? ` reason="${entry.errorReason}"` : '')
    );
  },
});

const youtubeServerCache = new Map<
  string,
  {
    videos: RawYouTubeCandidate[];
    searchQuery: string;
    extractedConcepts: string[];
    expiresAt: number;
  }
>();

interface PageInput {
  pageNumber: number;
  title: string;
  content: string;
}

interface TopicInput {
  id: string;
  name: string;
  summary: string;
  keyConcepts: string[];
  sourcePages: number[];
}

interface StudentTutorContextInput {
  currentTopic?: string;
  currentPage?: number;
  currentActivity?: string;
  weakTopics?: string[];
  recentScorePct?: number | null;
  completedRevisionCount?: number;
  totalRevisionCount?: number;
  preferredLanguage?: string;
}

type TutorSourceType = 'material' | 'general' | 'both';

function getDeveloperGenAIClient(): GoogleGenAI | null {
  if (!GEMINI_ENABLED) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Keep alias for Developer-API-only endpoints (Live API, Omni Flash video, Nano Banana image, Lyria music, YouTube direct URL)
const getGenAIClient = getDeveloperGenAIClient;

function getVertexGenAIClient(): GoogleGenAI | null {
  if (!GEMINI_ENABLED) return null;
  const cfg = resolveVertexConfig({ fallbackProjectId: DEFAULT_GCP_PROJECT_ID });
  if (cfg.mode === 'disabled' || cfg.configError || !cfg.projectId) {
    return null;
  }
  return new GoogleGenAI({
    vertexai: true,
    project: cfg.projectId,
    location: cfg.location,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

let developerApiBillingDepleted = false;

interface VideoGenerationJob {
  jobId: string;
  /** Student who created the job; only they may read its status. */
  ownerUid?: string;
  topic: string;
  mode: 'text_to_video' | 'image_to_video';
  aspectRatio: '16:9' | '9:16';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  verificationStatus: 'WORKING_VERIFIED' | 'BLOCKED_BY_BILLING' | 'WORKING_WITH_NON_AI_FALLBACK';
  videoUrl?: string;
  errorReason?: string;
  userFacingNotice?: string;
  fallbackMode: 'none' | 'animated_explanation';
  scenes: AnimatedExplanationScene[];
  createdAt: string;
  updatedAt: string;
}

const videoJobs = new Map<string, VideoGenerationJob>();

/** Polls a Higgsfield video job in the background and records the result for the client to fetch. */
async function trackHiggsfieldVideoJob(
  jobId: string,
  submitted: HiggsfieldSubmitResponse,
  authHeader: string
): Promise<void> {
  const settle = (patch: Partial<VideoGenerationJob>) => {
    const record = videoJobs.get(jobId);
    if (!record) return;
    videoJobs.set(jobId, { ...record, ...patch, updatedAt: new Date().toISOString() });
  };
  try {
    const result = await waitForHiggsfieldResult({
      authHeader,
      baseUrl: HIGGSFIELD_API_BASE,
      requestId: submitted.request_id,
      statusUrl: submitted.status_url,
      timeoutMs: 15 * 60 * 1000,
    });
    const url = result.video?.url;
    if (url) {
      settle({
        status: 'completed',
        videoUrl: url,
        verificationStatus: 'WORKING_VERIFIED',
        fallbackMode: 'none',
        userFacingNotice:
          'Video generated with Higgsfield. Higgsfield keeps the file for 7 days, so download it to keep it.',
      });
    } else {
      settle({
        status: 'failed',
        errorReason: 'Higgsfield returned no video.',
        userFacingNotice: 'Higgsfield finished but returned no video. Playing the animated explanation instead.',
      });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    settle({
      status: 'failed',
      errorReason: reason,
      userFacingNotice: `Higgsfield video generation failed: ${reason}`,
    });
  }
}

let cachedVertexProbe: {
  result: VertexDiagnosticProbeResult;
  expiresAt: number;
} | null = null;

async function detectMetadataServiceAccountEmail(): Promise<string | undefined> {
  try {
    const resp = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
      {
        headers: { 'Metadata-Flavor': 'Google' },
        signal: AbortSignal.timeout(1200),
      }
    );
    if (resp.ok) {
      const email = (await resp.text()).trim();
      return email || undefined;
    }
  } catch {
    // Not on GCE/Cloud Run metadata environment
  }
  return undefined;
}

/**
 * Executes a single low-cost Vertex AI text generation probe ("Reply with single word: OK", maxOutputTokens: 5)
 * to verify ADC / IAM permissions and Google Cloud Free Trial eligibility before migrating production study endpoints.
 */
async function runLowCostVertexProbe(forceRefresh = false): Promise<VertexDiagnosticProbeResult> {
  if (!forceRefresh && cachedVertexProbe && cachedVertexProbe.expiresAt > Date.now()) {
    return cachedVertexProbe.result;
  }

  const startMs = Date.now();
  const cfg = resolveVertexConfig({ fallbackProjectId: DEFAULT_GCP_PROJECT_ID });
  const probeModel = 'gemini-3.1-flash-lite';
  const billingService = 'Vertex AI API / Gemini Enterprise Agent Platform (aiplatform.googleapis.com)';
  const billingApiEndpoint = `https://${cfg.location}-aiplatform.googleapis.com/v1beta1/projects/${cfg.projectId}/locations/${cfg.location}/publishers/google/models/${probeModel}:generateContent`;

  if (!forceRefresh && cfg.mode !== 'enabled') {
    const passiveResult: VertexDiagnosticProbeResult = {
      checkedAt: new Date().toISOString(),
      status: 'disabled_by_config',
      readyForMigration: false,
      activeProvider: 'developer_api',
      billingService,
      billingApiEndpoint,
      trialCreditsEligible: true,
      projectId: cfg.projectId,
      location: cfg.location,
      authMethod: cfg.authMethod,
      modelTested: probeModel,
      latencyMs: 0,
      errorReason: 'Passive check (no API quota consumed on startup).',
      remediationSteps: ['Use POST /api/vertex/probe or set GOOGLE_GENAI_USE_VERTEXAI="true" to run a live Vertex AI check.'],
    };
    cachedVertexProbe = { result: passiveResult, expiresAt: Date.now() + 10 * 60 * 1000 };
    return passiveResult;
  }

  if (cfg.mode === 'disabled') {
    const disabledResult: VertexDiagnosticProbeResult = {
      checkedAt: new Date().toISOString(),
      status: 'disabled_by_config',
      readyForMigration: false,
      activeProvider: 'developer_api',
      billingService,
      billingApiEndpoint,
      trialCreditsEligible: true,
      projectId: cfg.projectId,
      location: cfg.location,
      authMethod: cfg.authMethod,
      modelTested: probeModel,
      latencyMs: 0,
      errorReason: 'GOOGLE_GENAI_USE_VERTEXAI is set to false.',
      remediationSteps: ['Set GOOGLE_GENAI_USE_VERTEXAI="auto" or "true" to enable Vertex AI routing.'],
    };
    cachedVertexProbe = { result: disabledResult, expiresAt: Date.now() + 5 * 60 * 1000 };
    return disabledResult;
  }

  const metadataEmail = await detectMetadataServiceAccountEmail();

  if (cfg.configError) {
    const errResult: VertexDiagnosticProbeResult = {
      checkedAt: new Date().toISOString(),
      status: 'unauthenticated',
      readyForMigration: false,
      activeProvider: 'developer_api',
      billingService,
      billingApiEndpoint,
      trialCreditsEligible: true,
      projectId: cfg.projectId,
      location: cfg.location,
      authMethod: cfg.authMethod,
      runtimeIdentityHint: metadataEmail,
      modelTested: probeModel,
      latencyMs: Date.now() - startMs,
      errorReason: cfg.configError,
      remediationSteps: [
        'Configure GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION and attach a Cloud Run service account with roles/aiplatform.user (no JSON key required).',
      ],
    };
    cachedVertexProbe = { result: errResult, expiresAt: Date.now() + 2 * 60 * 1000 };
    return errResult;
  }

  const vertexClient = getVertexGenAIClient();
  if (!vertexClient) {
    const unauthResult: VertexDiagnosticProbeResult = {
      checkedAt: new Date().toISOString(),
      status: 'unauthenticated',
      readyForMigration: false,
      activeProvider: 'developer_api',
      billingService,
      billingApiEndpoint,
      trialCreditsEligible: true,
      projectId: cfg.projectId,
      location: cfg.location,
      authMethod: cfg.authMethod,
      runtimeIdentityHint: metadataEmail,
      modelTested: probeModel,
      latencyMs: Date.now() - startMs,
      errorReason: 'Vertex AI client could not be initialized.',
      remediationSteps: [
        'Set GOOGLE_CLOUD_PROJECT and configure Cloud Run Application Default Credentials with roles/aiplatform.user.',
      ],
    };
    cachedVertexProbe = { result: unauthResult, expiresAt: Date.now() + 2 * 60 * 1000 };
    return unauthResult;
  }

  try {
    const response = await Promise.race([
      vertexClient.models.generateContent({
        model: probeModel,
        contents: 'Reply with single word: OK',
        config: {
          maxOutputTokens: 5,
          temperature: 0,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('VERTEX_PROBE_TIMEOUT')), 6500)
      ),
    ]);

    const readyResult: VertexDiagnosticProbeResult = {
      checkedAt: new Date().toISOString(),
      status: 'ready',
      readyForMigration: true,
      activeProvider: 'vertex_ai',
      billingService,
      billingApiEndpoint,
      trialCreditsEligible: true,
      projectId: cfg.projectId,
      location: cfg.location,
      authMethod: cfg.authMethod,
      runtimeIdentityHint: metadataEmail,
      modelTested: probeModel,
      latencyMs: Date.now() - startMs,
      sampleOutput: (response.text || 'OK').trim().slice(0, 32),
      httpStatus: 200,
      remediationSteps: [],
    };
    cachedVertexProbe = { result: readyResult, expiresAt: Date.now() + 15 * 60 * 1000 };
    return readyResult;
  } catch (err) {
    const classified = classifyVertexProbeError({
      error: err,
      projectId: cfg.projectId,
      location: cfg.location,
      runtimeIdentityHint: metadataEmail,
    });
    const failedResult: VertexDiagnosticProbeResult = {
      checkedAt: new Date().toISOString(),
      status: classified.status,
      readyForMigration: false,
      activeProvider: 'developer_api',
      billingService,
      billingApiEndpoint,
      trialCreditsEligible: true,
      projectId: cfg.projectId,
      location: cfg.location,
      authMethod: cfg.authMethod,
      runtimeIdentityHint: metadataEmail,
      modelTested: probeModel,
      latencyMs: Date.now() - startMs,
      httpStatus: classified.httpStatus,
      errorReason: classified.errorReason,
      remediationSteps: classified.remediationSteps,
    };
    cachedVertexProbe = { result: failedResult, expiresAt: Date.now() + 3 * 60 * 1000 };
    return failedResult;
  }
}

/**
 * Resolves the active Gemini client for Vertex-eligible study & multimodal endpoints.
 * Only routes to Vertex AI when the low-cost probe has confirmed IAM/ADC readiness (or when GOOGLE_VERTEX_CREDENTIALS_JSON is provided and passes probe);
 * otherwise falls back safely to the Google AI Studio Developer API client.
 */
async function getTrialEligibleStudyClient(): Promise<{
  ai: GoogleGenAI | null;
  provider: AiBackendProvider;
}> {
  if (!GEMINI_ENABLED) return { ai: null, provider: 'developer_api' };
  const cfg = resolveVertexConfig({ fallbackProjectId: DEFAULT_GCP_PROJECT_ID });
  if (cfg.mode !== 'disabled') {
    const probe = await runLowCostVertexProbe(false);
    if (probe.readyForMigration) {
      const vertexAi = getVertexGenAIClient();
      if (vertexAi) {
        return { ai: vertexAi, provider: 'vertex_ai' };
      }
    }
  }
  return { ai: getDeveloperGenAIClient(), provider: 'developer_api' };
}

interface StructuredJsonParams {
  operation: string;
  prompt: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  preferredModel?: string;
  bypassCache?: boolean;
  /** "fast" for extraction-style tasks, "smart" (default) for tutoring and question writing. */
  tier?: AiTier;
  /** "latex" when the UI renders the fields with MathText (KaTeX); "unicode" when it shows plain text. */
  mathFormat?: 'latex' | 'unicode' | 'plain';
  maxOutputTokens?: number;
}

type StructuredJsonResult<T> = { data: T; modelUsed: string; providerUsed?: AiBackendProvider };

/**
 * Generates structured JSON with Claude. Throws NO_API_KEY when ANTHROPIC_API_KEY is missing.
 */
async function generateStructuredJson<T>(
  params: StructuredJsonParams
): Promise<StructuredJsonResult<T>> {
  const formatRules =
    params.mathFormat === 'latex'
      ? `\n\n${LATEX_FORMAT_RULES}`
      : params.mathFormat === 'unicode'
      ? `\n\n${UNICODE_FORMAT_RULES}`
      : '';
  const prepared: StructuredJsonParams = {
    ...params,
    systemInstruction: `${params.systemInstruction}${formatRules}\n\n${MINOR_SAFETY_RULES}`,
  };
  return generateStructuredJsonWithClaude<T>(prepared);
}

async function generateStructuredJsonWithClaude<T>(
  params: StructuredJsonParams
): Promise<StructuredJsonResult<T>> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const tier: AiTier = params.tier || 'smart';
  const model = claudeModelFor(tier);
  const effort: ClaudeEffort = tier === 'fast' ? 'low' : 'medium';
  const cacheKey = computeRequestFingerprint([
    'claude',
    params.operation,
    model,
    params.systemInstruction,
    params.prompt,
  ]);

  return geminiManager.execute({
    operation: params.operation,
    model,
    cacheKey,
    bypassCache: params.bypassCache,
    approxInputChars: params.prompt.length + params.systemInstruction.length,
    task: async () => {
      const result = await callClaude({
        apiKey,
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        model,
        system: params.systemInstruction,
        messages: [{ role: 'user', content: params.prompt }],
        // Thinking tokens count toward max_tokens, so leave generous room.
        maxTokens: params.maxOutputTokens ?? (tier === 'fast' ? 8000 : 16000),
        effort,
        jsonSchema: toClaudeJsonSchema(params.responseSchema),
        timeoutMs: tier === 'fast' ? 45_000 : 90_000,
      });
      if (result.stopReason === 'max_tokens') {
        throw new Error('CLAUDE_OUTPUT_TRUNCATED: the AI answer was cut off. Try a smaller request.');
      }
      if (result.stopReason === 'refusal') {
        throw new Error('CLAUDE_REFUSAL: the AI declined this request.');
      }
      if (!result.text.trim()) {
        throw new Error('EMPTY_RESPONSE');
      }
      return {
        data: JSON.parse(result.text) as T,
        modelUsed: result.model,
        providerUsed: 'anthropic_claude' as AiBackendProvider,
      };
    },
  });
}

async function generateStructuredJsonWithGemini<T>(
  params: StructuredJsonParams
): Promise<StructuredJsonResult<T>> {
  const { ai: primaryAi, provider: primaryProvider } = await getTrialEligibleStudyClient();
  const fallbackDevAi = primaryProvider === 'vertex_ai' ? getDeveloperGenAIClient() : null;

  if (!primaryAi && !fallbackDevAi) {
    throw new Error('NO_API_KEY');
  }

  const candidateModels = getOrderedCandidateModels(params.preferredModel);
  const primaryModel = candidateModels[0] || 'gemini-3.1-flash-lite';

  const cacheKey = computeRequestFingerprint([
    params.operation,
    params.preferredModel || 'default',
    params.systemInstruction,
    params.prompt,
  ]);

  return geminiManager.execute({
    operation: params.operation,
    model: primaryModel,
    cacheKey,
    bypassCache: params.bypassCache,
    approxInputChars: params.prompt.length + params.systemInstruction.length,
    task: async () => {
      let lastErr: unknown = null;

      const providersToTry: Array<{ client: GoogleGenAI; provider: AiBackendProvider }> = [];
      if (primaryAi) {
        providersToTry.push({ client: primaryAi, provider: primaryProvider });
      }
      if (fallbackDevAi) {
        providersToTry.push({ client: fallbackDevAi, provider: 'developer_api' });
      }

      for (const { client, provider } of providersToTry) {
        for (const rawModelName of candidateModels) {
          const modelName =
            provider === 'vertex_ai' ? resolveVertexModelName(rawModelName) : rawModelName;
          try {
            const callPromise = client.models.generateContent({
              model: modelName,
              contents: params.prompt,
              config: {
                systemInstruction: params.systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: params.responseSchema,
                temperature: 0.25,
                ...(modelName === 'gemini-3.8-flash' || modelName === 'gemini-4-argon'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : modelName === 'gemini-3.1-flash-lite'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
                  : {}),
              },
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('GEMINI_CALL_TIMEOUT')), GEMINI_TIMEOUT_MS)
            );

            const response = await Promise.race([callPromise, timeoutPromise]);
            const rawText = response.text?.trim();
            if (!rawText) {
              throw new Error('EMPTY_RESPONSE');
            }
            return {
              data: JSON.parse(rawText) as T,
              modelUsed: modelName,
              providerUsed: provider,
            };
          } catch (err) {
            lastErr = err;
            const classified = classifyGeminiError(err);
            // If Developer API prepayment credits are depleted (HTTP 402), stop trying other models on the same depleted Developer API key
            if (classified.statusCode === 402) {
              for (const m of candidateModels) {
                modelCooldownUntil.set(m, Date.now() + 15 * 60 * 1000);
              }
              break;
            }
            if (classified.category === 'quota_exhausted') {
              modelCooldownUntil.set(rawModelName, Date.now() + 15 * 60 * 1000);
              continue;
            }
            if (classified.category === 'temporarily_busy') {
              modelCooldownUntil.set(rawModelName, Date.now() + 30 * 1000);
              continue;
            }
            if (
              classified.statusCode === 404 ||
              (err instanceof Error && err.message.toLowerCase().includes('not found'))
            ) {
              modelCooldownUntil.set(rawModelName, Date.now() + 60 * 60 * 1000);
              continue;
            }
            if (
              classified.category === 'auth_config_error' &&
              (classified.statusCode === 401 ||
                classified. statusCode === 403 ||
                classified.rawReason.toLowerCase().includes('api_key_invalid'))
            ) {
              break;
            }
          }
        }
      }

      throw lastErr || new Error('GENERATION_FAILED');
    },
  });
}

function extractAiNotice(err: unknown): {
  aiStatus: GeminiErrorCategory;
  aiNotice: string;
} {
  const enriched = err as { classified?: { category: GeminiErrorCategory; userMessage: string } };
  if (enriched?.classified) {
    return {
      aiStatus: enriched.classified.category,
      aiNotice: enriched.classified.userMessage,
    };
  }
  const classified = classifyGeminiError(err);
  return {
    aiStatus: classified.category,
    aiNotice: classified.userMessage,
  };
}

function formatPagesContext(pages: PageInput[]): string {
  return pages
    .map(
      (p) =>
        `=== PAGE ${p.pageNumber} (${p.title || `Section ${p.pageNumber}`}) ===\n${p.content}`
    )
    .join('\n\n');
}

function buildGroundedFallbackAnalysis(title: string, pages: PageInput[]) {
  const topics: TopicInput[] = pages.slice(0, 6).map((p, idx) => {
    const lines = p.content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const topicName =
      p.title && p.title !== `Page ${p.pageNumber}`
        ? p.title
        : lines[0] || `Topic ${idx + 1}`;
    const summaryLine =
      lines.find((l) => l.length > 45 && !l.startsWith('1.') && !l.startsWith('2.')) ||
      lines.slice(0, 2).join(' ');
    const bullets = lines
      .filter((l) => l.startsWith('•') || l.includes(':') || l.includes('='))
      .slice(0, 4)
      .map((b) => b.replace(/^[•\-*\d.)\s]+/, '').slice(0, 55));

    return {
      id: `topic-${p.pageNumber}-${idx}`,
      name: topicName.replace(/^\d+\.\s*/, '').slice(0, 64),
      summary: summaryLine.slice(0, 200),
      keyConcepts: bullets.length > 0 ? bullets : [`Page ${p.pageNumber} Core Concept`],
      sourcePages: [p.pageNumber],
    };
  });

  return {
    overview: `Structured study guide for "${title}" spanning ${pages.length} page${pages.length === 1 ? '' : 's'} and ${topics.length} core topics.`,
    topics,
  };
}

/**
 * Used only when the AI call fails. It never pretends to be an explanation: it returns the
 * passages from the student's own material that best match the question, clearly labelled
 * as excerpts, or null when nothing matches (the caller then reports the AI error honestly).
 */
function buildMaterialExcerptFallback(
  question: string,
  pages: PageInput[],
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  studentContext?: StudentTutorContextInput
): {
  answer: string;
  foundInMaterial: boolean;
  sourceType: TutorSourceType;
  citations: Array<{ pageNumber: number; section: string; quote: string }>;
  relatedTopics: string[];
} | null {
  if (!pages || pages.length === 0) return null;

  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
    'does', 'is', 'are', 'was', 'were', 'the', 'and', 'for', 'with', 'from',
    'that', 'this', 'explain', 'define', 'tell', 'about', 'can', 'you', 'your',
    'between', 'difference', 'formula', 'mean', 'meaning', 'notes', 'material',
    'page', 'give', 'more', 'another', 'extra', 'real', 'world', 'application',
    'step', 'simple', 'simply', 'example', 'examples', 'relate', 'related',
  ]);

  const isFollowUpRequest =
    /\b(more simply|simpler|simplify|deeper|greater depth|derivation|step-by-step|step by step|another example|extra example|real-world|real world|analogy|follow up|elaborate|break it down)\b/i.test(
      question
    );

  let searchContext = question;
  if (isFollowUpRequest && history && history.length > 0) {
    const recentText = history
      .slice(-2)
      .map((h) => h.content)
      .join(' ');
    searchContext = `${question} ${recentText}`;
  } else if (studentContext?.currentTopic && /this topic/i.test(question)) {
    searchContext = `${question} ${studentContext.currentTopic}`;
  }

  const queryTokens = Array.from(
    new Set(
      searchContext
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w))
    )
  );
  if (queryTokens.length === 0) return null;

  // Require at least half of the meaningful words to appear, so one shared word like
  // "law" does not pass off an unrelated page as an answer.
  const minMatches = Math.max(1, Math.ceil(queryTokens.length / 2));
  const scoredPages = pages
    .map((p) => {
      const lower = `${p.title} ${p.content}`.toLowerCase();
      let matches = 0;
      for (const token of queryTokens) {
        if (lower.includes(token)) matches += 1;
      }
      return { page: p, matches };
    })
    .filter((item) => item.matches >= minMatches)
    .sort((a, b) => b.matches - a.matches);

  if (scoredPages.length === 0) return null;

  const topPages = scoredPages.slice(0, 2);
  const citations = topPages.map(({ page }) => {
    const paragraphs = page.content
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 25);
    const matchingLine =
      paragraphs.find((line) =>
        queryTokens.some((tok) => line.toLowerCase().includes(tok))
      ) ||
      paragraphs[0] ||
      page.content.slice(0, 140);

    return {
      pageNumber: page.pageNumber,
      section: page.title || `Page ${page.pageNumber}`,
      quote: matchingLine.slice(0, 180),
    };
  });

  const excerpts = topPages.map(({ page }) => {
    const lines = page.content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const relevant = lines.filter((line) =>
      queryTokens.some((tok) => line.toLowerCase().includes(tok))
    );
    const snippet = (relevant.length > 0 ? relevant.slice(0, 3) : lines.slice(0, 3)).join(' ');
    return `**Page ${page.pageNumber} (${page.title || `Page ${page.pageNumber}`}):** ${snippet}`;
  });

  return {
    answer: `**The AI tutor is unavailable right now, so this is not an explanation.** These are the passages from your material that best match your question:\n\n${excerpts.join('\n\n')}\n\nAsk again in a minute for a full explanation.`,
    foundInMaterial: true,
    sourceType: 'material',
    citations,
    relatedTopics: topPages.map((t) => t.page.title).filter(Boolean),
  };
}

/**
 * Sets up the Gemini Live Voice Tutor WebSocket bridge (/api/live) using model 'gemini-3.8-live'.
 */
function attachGeminiLiveWebSocketServer(httpServer: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/api/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      // ignore non-live upgrades (e.g. Vite HMR)
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let liveSession: any = null;
    let sessionPages: PageInput[] = [];
    let sessionTitle = 'Study Material';
    let sessionWeakTopics: string[] = [];
    // Browsers cannot send headers on WebSockets, so the login token arrives in the setup message.
    let studentUid: string | null = null;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    // Close connections that never sign in.
    const authDeadline = setTimeout(() => {
      if (!studentUid) clientWs.close(4401, 'Sign-in required');
    }, 15_000);
    clientWs.on('close', () => clearTimeout(authDeadline));

    clientWs.on('message', async (rawBuffer) => {
      try {
        const msg = JSON.parse(rawBuffer.toString()) as {
          type: string;
          title?: string;
          pages?: PageInput[];
          weakTopics?: string[];
          currentTopic?: string;
          data?: string;
          question?: string;
          idToken?: string;
        };

        if (!studentUid) {
          const auth =
            msg.type === 'setup'
              ? await authenticateStudent(verifyStudentIdToken, msg.idToken || null)
              : null;
          if (!auth || !auth.ok) {
            safeSend({
              type: 'error',
              code: auth && !auth.ok ? auth.code : 'auth_required',
              message: auth && !auth.ok ? auth.message : 'Please sign in to use the voice tutor.',
            });
            clientWs.close(4401, 'Sign-in required');
            return;
          }
          studentUid = auth.student.uid;
        }

        if (msg.type === 'setup') {
          sessionTitle = msg.title || 'Study Material';
          sessionPages = Array.isArray(msg.pages) ? msg.pages : [];
          sessionWeakTopics = Array.isArray(msg.weakTopics) ? msg.weakTopics : [];

          const ai = getGenAIClient();
          if (!ai) {
            safeSend({
              type: 'status',
              state: 'fallback_ready',
              message: getAnthropicApiKey()
                ? 'Voice mode: speak or type your question. Claude answers and your browser reads the answer aloud.'
                : 'Live voice AI is not set up on this server (missing API key). Voice answers can only read out matching lines from your notes.',
            });
            return;
          }

          const condensedMaterial = sessionPages
            .slice(0, 6)
            .map((p) => `Page ${p.pageNumber} (${p.title}): ${p.content.slice(0, 650)}`)
            .join('\n\n');

          const systemInstruction = `You are LearnMate's real-time Voice Study Tutor helping a student understand "${sessionTitle}".
${sessionWeakTopics.length > 0 ? `Student weak topics to reinforce gently: ${sessionWeakTopics.join(', ')}.` : ''}
Study Material Reference:
${condensedMaterial}

Rules for Voice Tutoring:
- Speak naturally, warmly, and concisely (2 to 4 sentences per turn).
- Reference specific page numbers verbally (e.g. "On Page 2 of your notes...") whenever answering from the material.
- Encourage the student and ask a short check-for-understanding question when appropriate.`;

          try {
            const connectPromise = ai.live.connect({
              model: 'gemini-3.8-live',
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                  },
                },
                outputAudioTranscription: {},
                inputAudioTranscription: {},
                systemInstruction: {
                  parts: [{ text: systemInstruction }],
                },
              },
              callbacks: {
                onopen: () => {
                  safeSend({
                    type: 'status',
                    state: 'connected',
                    model: 'gemini-3.8-live',
                  });
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onmessage: (serverMsg: any) => {
                  const sc = serverMsg?.serverContent;
                  const parts = sc?.modelTurn?.parts || [];
                  for (const part of parts) {
                    if (part?.inlineData?.data) {
                      safeSend({
                        type: 'audio',
                        data: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                      });
                    }
                    if (part?.text) {
                      safeSend({
                        type: 'transcript',
                        role: 'assistant',
                        text: part.text,
                      });
                    }
                  }
                  if (sc?.outputTranscription?.text) {
                    safeSend({
                      type: 'output_transcription',
                      text: sc.outputTranscription.text,
                      finished: Boolean(sc.outputTranscription.finished),
                    });
                  }
                  if (sc?.inputTranscription?.text) {
                    safeSend({
                      type: 'input_transcription',
                      text: sc.inputTranscription.text,
                      finished: Boolean(sc.inputTranscription.finished),
                    });
                  }
                  if (sc?.interrupted) {
                    safeSend({ type: 'interrupted' });
                  }
                  if (sc?.turnComplete) {
                    safeSend({ type: 'turn_complete' });
                  }
                },
                onerror: (err: unknown) => {
                  safeSend({
                    type: 'status',
                    state: 'fallback_ready',
                    message:
                      err instanceof Error
                        ? err.message
                        : 'Gemini Live stream switched to grounded voice synthesis.',
                  });
                },
                onclose: () => {
                  liveSession = null;
                },
              },
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('LIVE_CONNECT_TIMEOUT')), 4500)
            );

            liveSession = await Promise.race([connectPromise, timeoutPromise]);
          } catch (err) {
            liveSession = null;
            safeSend({
              type: 'status',
              state: 'fallback_ready',
              message:
                err instanceof Error ? err.message : 'Live audio stream unavailable; using grounded voice mode.',
            });
          }
          return;
        }

        if (msg.type === 'audio' && msg.data && liveSession) {
          try {
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch {
            // ignore transient frame error
          }
          return;
        }

        if (msg.type === 'voice_question' && msg.question) {
          const qText = msg.question.trim().slice(0, 2000);
          if (!qText) return;

          const allowance = studentUsage.consume(studentUid, 'tutor');
          if (!allowance.allowed) {
            safeSend({
              type: 'voice_response',
              text: allowance.message || 'Please wait a moment and try again.',
              citations: [],
              sourceType: 'general',
            });
            return;
          }

          if (liveSession) {
            try {
              if (typeof liveSession.sendClientContent === 'function') {
                liveSession.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: qText }] }],
                  turnComplete: true,
                });
                return;
              }
            } catch {
              // fall through to grounded tutor voice response
            }
          }

          // No Gemini Live session: answer with Claude as short spoken text for browser TTS.
          const voiceClaudeKey = getAnthropicApiKey();
          if (voiceClaudeKey) {
            try {
              const material = sessionPages
                .slice(0, 8)
                .map((p) => `Page ${p.pageNumber} (${p.title}): ${p.content.slice(0, 800)}`)
                .join('\n\n');
              const spoken = await callClaude({
                apiKey: voiceClaudeKey,
                baseUrl: process.env.ANTHROPIC_BASE_URL,
                model: CLAUDE_FAST_MODEL,
                maxTokens: 4000,
                effort: 'low',
                timeoutMs: 30_000,
                system: `You are LearnMate's friendly voice tutor for JEE Main (Physics, Chemistry, Mathematics), helping with "${sessionTitle}".
Your reply is read aloud by a speech synthesizer, so:
- Answer in 2 to 4 short spoken sentences.
- No Markdown, no bullet points, no LaTeX; say formulas in words (for example "v equals u plus a t").
- If the student's notes below cover the question, say which page.
${sessionWeakTopics.length > 0 ? `- The student is working on: ${sessionWeakTopics.join(', ')}.` : ''}

${MINOR_SAFETY_RULES}

Student notes:
${material || 'No notes provided.'}`,
                messages: [{ role: 'user', content: qText }],
              });
              const spokenText = spoken.text.replace(/[*#_`$\\]/g, '').replace(/\s+/g, ' ').trim();
              if (spokenText) {
                safeSend({ type: 'voice_response', text: spokenText, citations: [], sourceType: 'general' });
                return;
              }
            } catch (err) {
              console.warn(
                '[Voice] Claude answer failed:',
                err instanceof Error ? err.message : String(err)
              );
            }
          }

          // No AI available: read out matching lines from the notes, never a made-up answer.
          const excerpt = buildMaterialExcerptFallback(qText, sessionPages, [], {
            weakTopics: sessionWeakTopics,
          });
          if (!excerpt) {
            safeSend({
              type: 'voice_response',
              text: 'Sorry, the live AI tutor is not available right now, and I could not find this topic in your notes. Please try again later.',
              citations: [],
              sourceType: 'general',
            });
            return;
          }
          const cleanSpoken = excerpt.answer
            .replace(/\*\*/g, '')
            .replace(/•/g, '')
            .replace(/\n+/g, ' ')
            .trim();

          safeSend({
            type: 'voice_response',
            text: cleanSpoken,
            citations: excerpt.citations,
            sourceType: excerpt.sourceType,
          });
        }
      } catch {
        // ignore malformed ws message
      }
    });

    clientWs.on('close', () => {
      if (liveSession && typeof liveSession.close === 'function') {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
      liveSession = null;
    });
  });
}

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  // Hosts such as Render put one proxy in front of the app.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Firebase's Google sign-in pop-up must be able to report back to this page.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginEmbedderPolicy: false,
      // Report-only first, so a missed domain shows up in the browser console instead of
      // breaking sign-in. Off in development, where Vite injects inline scripts.
      contentSecurityPolicy: isProduction
        ? {
            reportOnly: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
              connectSrc: [
                "'self'",
                'wss:',
                'https://*.googleapis.com',
                'https://*.firebaseio.com',
                'https://*.firebaseapp.com',
              ],
              frameSrc: [
                "'self'",
                'https://*.firebaseapp.com',
                'https://accounts.google.com',
                'https://www.youtube-nocookie.com',
                'https://www.youtube.com',
              ],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              mediaSrc: ["'self'", 'blob:', 'https:'],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
              workerSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    })
  );

  // Only this site (plus any ALLOWED_ORIGINS) may call the API from a browser.
  const extraAllowedOrigins = [process.env.APP_URL || '', ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//.test(value));
  app.use('/api', (req, res, next) => {
    if (!isAllowedOrigin(req.get('origin'), req.get('host'), extraAllowedOrigins)) {
      res.status(403).json({ error: 'Requests from other websites are not allowed.', code: 'origin_not_allowed' });
      return;
    }
    next();
  });

  // Photos and recordings need room; everything else is text and stays small.
  app.use(
    ['/api/study/scan-notes', '/api/study/transcribe-audio', '/api/create/video-lesson'],
    express.json({ limit: '12mb' })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.too.large') {
      res.status(413).json({ error: 'This upload is too large. Please use a smaller file.' });
      return;
    }
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: 'The request could not be read. Please try again.' });
      return;
    }
    next(err);
  });

  // Every API route needs a signed-in student, except the health check and the admin
  // diagnostics (which have their own ADMIN_TOKEN check below). New routes are protected by default.
  app.use('/api', async (req, res, next) => {
    const fullPath = `${req.baseUrl}${req.path}`;
    if (isPublicApiPath(fullPath)) {
      next();
      return;
    }
    const auth = await authenticateStudent(verifyStudentIdToken, readBearerToken(req.get('authorization')));
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.message, code: auth.code });
      return;
    }
    const studentReq = req as StudentRequest;
    studentReq.student = auth.student;

    // AI calls (POST) count toward the per-minute and daily limits; status checks (GET) do not.
    if (req.method === 'POST') {
      const uid = auth.student.uid;
      const category = usageCategoryForPath(req.method, fullPath);
      const decision = studentUsage.consume(uid, category);
      if (!decision.allowed) {
        if (decision.retryAfterSeconds) res.set('Retry-After', String(decision.retryAfterSeconds));
        console.log(`[Usage] blocked student=${hashForLogs(uid)} route=${fullPath} reason=${decision.code}`);
        res.status(429).json({ error: decision.message, code: decision.code });
        return;
      }
      // Failed requests don't use up the student's allowance.
      res.on('finish', () => {
        if (res.statusCode >= 400) studentUsage.release(uid, category);
      });
    }
    next();
  });

  // Internal diagnostics reveal the cloud project ID and service-account identity, and
  // /api/vertex/probe triggers a billed model call. In production they require ADMIN_TOKEN.
  app.use(['/api/usage', '/api/capabilities', '/api/vertex'], (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }
    const expected = process.env.ADMIN_TOKEN || '';
    const provided = req.get('x-admin-token') || '';
    const allowed =
      expected.length > 0 &&
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!allowed) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Analyze uploaded study material & extract page-grounded topics
  app.post('/api/study/analyze', async (req, res) => {
    try {
      const { title, pages } = req.body as { title?: string; pages?: PageInput[] };
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        res.status(400).json({ error: 'Pages array is required for document analysis.' });
        return;
      }

      const validPageNumbers = new Set(pages.map((p) => p.pageNumber));
      const contextText = formatPagesContext(pages);

      try {
        const { data: parsed } = await generateStructuredJson<{
          overview: string;
          topics: Array<{
            name: string;
            summary: string;
            keyConcepts: string[];
            sourcePages: number[];
          }>;
        }>({
          operation: 'study_analyze',
          tier: 'fast',
          mathFormat: 'unicode',
          systemInstruction:
            'You are LearnMate, an academic study assistant. Analyze the provided page-indexed study material and extract 3 to 6 core study topics strictly grounded in the text. Every topic MUST reference valid page numbers from the input.',
          prompt: `Document Title: ${title || 'Study Material'}\n\nStudy Material Pages:\n${contextText}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: {
                type: Type.STRING,
                description: 'A concise 1-2 sentence overview of the study material.',
              },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    keyConcepts: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    sourcePages: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                  },
                  required: ['name', 'summary', 'keyConcepts', 'sourcePages'],
                },
              },
            },
            required: ['overview', 'topics'],
          },
        });

        const sanitizedTopics: TopicInput[] = (parsed.topics || []).map((t, idx) => {
          const verifiedPages = (t.sourcePages || []).filter((num) => validPageNumbers.has(num));
          return {
            id: `topic-${Date.now()}-${idx + 1}`,
            name: t.name || `Topic ${idx + 1}`,
            summary: t.summary || '',
            keyConcepts: Array.isArray(t.keyConcepts) ? t.keyConcepts.slice(0, 5) : [],
            sourcePages: verifiedPages.length > 0 ? verifiedPages : [pages[0].pageNumber],
          };
        });

        res.json({
          overview: parsed.overview || `Study guide for ${title || 'uploaded material'}.`,
          topics:
            sanitizedTopics.length > 0
              ? sanitizedTopics
              : buildGroundedFallbackAnalysis(title || 'Study Material', pages).topics,
        });
      } catch (err) {
        const notice = extractAiNotice(err);
        const fallback = buildGroundedFallbackAnalysis(title || 'Study Material', pages);
        res.json({
          ...fallback,
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to analyze document.',
      });
    }
  });

  // 2. Context-Aware AI Study Tutor with Source-Control Mode (Material Only vs Extended Knowledge) & Model Choice
  app.post('/api/study/ask', async (req, res) => {
    try {
      const {
        title,
        pages = [],
        question,
        history,
        modelPreference,
        studentContext,
        sourceControlMode = 'expanded_default',
      } = req.body as {
        title?: string;
        pages?: PageInput[];
        question?: string;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
        modelPreference?: string;
        studentContext?: StudentTutorContextInput;
        sourceControlMode?: SourceControlMode | 'expanded_default';
      };

      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Please enter a question.' });
        return;
      }

      const explicitStrictMode = sourceControlMode === 'material_only';
      const hasDocument = Array.isArray(pages) && pages.length > 0;
      const validPageNumbers = new Set(hasDocument ? pages.map((p) => p.pageNumber) : []);
      const contextText = hasDocument ? formatPagesContext(pages) : 'No uploaded study material.';
      const historyContext =
        history && history.length > 0
          ? history
              .slice(-6)
              .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
              .join('\n')
          : 'No prior messages.';

      const studentContextSummary = studentContext
        ? [
            studentContext.currentTopic ? `Active Topic: ${studentContext.currentTopic}` : '',
            studentContext.currentPage ? `Viewing Page: ${studentContext.currentPage}` : '',
            studentContext.currentActivity ? `Learning Mode: ${studentContext.currentActivity}` : '',
            studentContext.weakTopics && studentContext.weakTopics.length > 0
              ? `Student Weak Topics from Quizzes: ${studentContext.weakTopics.join(', ')}`
              : '',
            typeof studentContext.recentScorePct === 'number'
              ? `Latest Quiz Score: ${studentContext.recentScorePct}%`
              : '',
          ]
            .filter(Boolean)
            .join(' | ')
        : 'Standard study session';

      const tutorPersona = `You are LearnMate, an expert JEE Main tutor for Physics, Chemistry and Mathematics (NCERT Class 11-12 syllabus, NTA JEE Main 2027 pattern).
How to teach:
- Explain step by step: the key concept first, then the relevant formula, then the worked solution, then a clearly stated final answer with units.
- For numerical problems, show each substitution and check units and limiting cases.
- Point out common exam traps and one quick JEE tip where useful.
- Keep answers focused (about 250 words) unless the student asks for a derivation or more depth.
- If you are not sure about a fact or a numerical answer, say so plainly instead of guessing.
${languageInstruction(studentContext?.preferredLanguage)}`;

      try {
        const { data: parsed, modelUsed } = await generateStructuredJson<{
          answer: string;
          sourceType: 'material' | 'general' | 'both';
          foundInMaterial: boolean;
          citations: Array<{
            pageNumber: number;
            section: string;
            quote: string;
          }>;
          relatedTopics: string[];
        }>({
          operation: `study_ask_${explicitStrictMode ? 'strict' : 'hybrid'}`,
          preferredModel: modelPreference,
          tier: 'smart',
          mathFormat: 'latex',
          systemInstruction: explicitStrictMode
            ? `${tutorPersona}

You are operating in MATERIAL ONLY mode.
Student Learning Context: ${studentContextSummary}
Rules for Material Only Mode:
1. Answer ONLY if the explanation is directly supported by the provided Study Material Pages.
2. Every claim MUST include verified page citations (pageNumber, section, verbatim quote).
3. If the topic is NOT covered in the provided Study Material Pages, set "foundInMaterial": false, "sourceType": "general", "citations": [], and set "answer" to: "This topic is not covered in your uploaded study material. Switch to Extended Knowledge mode if you want a general explanation."`
            : `${tutorPersona}

Student Learning Context: ${studentContextSummary}

Follow these exact rules for Hybrid Knowledge Answering:
1. PRIORITIZE UPLOADED MATERIAL: Always check the provided Study Material Pages first.
2. FULLY IN MATERIAL ("sourceType": "material"):
   - If the answer is fully covered in the uploaded pages, explain it clearly using the document and return verified page citations (pageNumber, section, verbatim quote). Set "foundInMaterial": true.
3. PARTIALLY COVERED OR EXPANSION REQUEST ("sourceType": "both"):
   - If the question is partially covered in the document, OR if the student asks for extra examples, simplified analogies, step-by-step teaching, or follow-up questions extending a document topic, combine the document information with your general knowledge.
   - Clearly distinguish the two in your answer using headings like "**From your material:**" and "**General knowledge:**".
   - Include verified citations ONLY for the parts that came from the uploaded pages. Set "foundInMaterial": true.
4. ABSENT FROM MATERIAL ("sourceType": "general"):
   - If the uploaded material does not cover the question at all, you MUST start your answer with the exact phrase: "Not covered in your material." and then provide a helpful, clear general-knowledge explanation (with step-by-step teaching or examples).
   - Set "foundInMaterial": false and "citations": []. NEVER fabricate document citations or imply general knowledge came from the PDF.
5. NO UPLOADED MATERIAL:
   - If no study material pages are provided, answer the educational question normally using general knowledge with "sourceType": "general" and "citations": [].
6. PERSONALIZED AWARENESS:
   - When relevant, connect your explanation to the student's active topic or weak topics so they can overcome misconceptions.`,
          prompt: `Document: ${hasDocument ? title || 'Study Material' : 'None'}\n\nStudy Material Pages:\n${contextText}\n\nConversation History:\n${historyContext}\n\nStudent Question: ${question.trim()}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              sourceType: {
                type: Type.STRING,
                description: 'Must be "material", "general", or "both".',
              },
              foundInMaterial: { type: Type.BOOLEAN },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    section: { type: Type.STRING },
                    quote: { type: Type.STRING },
                  },
                  required: ['pageNumber', 'section', 'quote'],
                },
              },
              relatedTopics: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['answer', 'sourceType', 'foundInMaterial', 'citations', 'relatedTopics'],
          },
        });

        if (explicitStrictMode) {
          const policyResult = enforceSourceControlPolicy({
            mode: 'material_only',
            rawAnswer: parsed.answer || '',
            foundInMaterial: Boolean(parsed.foundInMaterial),
            citations: parsed.citations || [],
            validPageNumbers,
          });
          res.json({
            answer: policyResult.answer,
            foundInMaterial: policyResult.foundInMaterial,
            sourceType: policyResult.sourceType,
            sourceControlMode: 'material_only',
            citations: policyResult.citations,
            relatedTopics: policyResult.foundInMaterial && Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics : [],
            modelUsed,
          });
          return;
        }

        const verifiedCitations = hasDocument
          ? (parsed.citations || []).filter((c) => validPageNumbers.has(c.pageNumber))
          : [];

        let sourceType: TutorSourceType =
          parsed.sourceType === 'material' ||
          parsed.sourceType === 'both' ||
          parsed.sourceType === 'general'
            ? parsed.sourceType
            : verifiedCitations.length > 0
            ? 'material'
            : 'general';

        if (!hasDocument || verifiedCitations.length === 0) {
          sourceType = 'general';
        }

        const isFound = sourceType === 'material' || sourceType === 'both';
        let finalAnswer = (parsed.answer || '').trim();

        if (
          hasDocument &&
          sourceType === 'general' &&
          !finalAnswer.toLowerCase().includes('not covered in your material')
        ) {
          finalAnswer = `Not covered in your material.\n\n${finalAnswer}`;
        }

        res.json({
          answer: finalAnswer,
          foundInMaterial: isFound,
          sourceType,
          sourceControlMode: 'extended_knowledge',
          citations: isFound ? verifiedCitations : [],
          relatedTopics: Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics : [],
          modelUsed,
        });
      } catch (err) {
        const notice = extractAiNotice(err);
        const excerptFallback = buildMaterialExcerptFallback(
          question,
          pages,
          history,
          studentContext
        );
        if (!excerptFallback) {
          // Nothing honest to show: report the failure so the UI offers a retry.
          res.status(503).json({
            error: notice.aiNotice,
            aiStatus: notice.aiStatus,
            aiNotice: notice.aiNotice,
          });
          return;
        }
        res.json({
          ...excerptFallback,
          sourceControlMode: explicitStrictMode ? 'material_only' : 'extended_knowledge',
          modelUsed: 'none',
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to answer question.',
      });
    }
  });

  // 3. Generate Diagnostic or Adaptive Quiz (5-8 grounded MCQs with 4 choices)
  app.post('/api/study/quiz', async (req, res) => {
    try {
      const {
        title,
        pages,
        topics = [],
        mode = 'diagnostic',
        focusTopics = [],
        questionCount = 6,
        forceRefresh = false,
      } = req.body as {
        title?: string;
        pages?: PageInput[];
        topics?: TopicInput[];
        mode?: 'diagnostic' | 'adaptive';
        focusTopics?: string[];
        questionCount?: number;
        forceRefresh?: boolean;
      };

      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        res.status(400).json({ error: 'Study material pages are required to generate a quiz.' });
        return;
      }

      const clampedCount = Math.max(5, Math.min(30, Number(questionCount) || 6));
      const validPageNumbers = new Set(pages.map((p) => p.pageNumber));
      const contextText = formatPagesContext(pages);

      const focusInstruction =
        mode === 'adaptive' && focusTopics.length > 0
          ? `This is an ADAPTIVE PRACTICE quiz. Focus all ${clampedCount} questions specifically on these weak topics that the student struggled with: ${focusTopics.join(', ')}. Test conceptual understanding from new angles.`
          : `This is a DIAGNOSTIC QUIZ. Generate ${clampedCount} multiple-choice questions spanning across the key topics in the material (${topics.map((t) => t.name).join(', ') || 'all pages'}).`;

      try {
        const { data: parsed } = await generateStructuredJson<{
          questions: Array<{
            topic: string;
            question: string;
            options: string[];
            correctIndex: number;
            explanation: string;
            sourcePage: number;
            sourceQuote: string;
            difficulty: 'easy' | 'medium' | 'hard';
          }>;
        }>({
          operation: `study_quiz_${mode}_${clampedCount}`,
          bypassCache: Boolean(forceRefresh),
          tier: 'smart',
          mathFormat: 'latex',
          maxOutputTokens: 24000,
          systemInstruction: `You are LearnMate's JEE Main question writer for Physics, Chemistry and Mathematics.
Generate ${clampedCount} JEE Main-style single-correct Multiple-Choice Questions based on the concepts in the provided Study Material Pages.
Rules:
- Test understanding and problem solving (numericals, applications, multi-step reasoning), not rote recall of sentences.
- Every question MUST have exactly 4 distinct options, and exactly one of them correct.
- Wrong options should come from realistic mistakes (sign errors, wrong formula, unit slips, a missed factor of 2).
- Solve each question yourself before writing it; "correctIndex" (0-3) must point to the option that matches your solution.
- "explanation" must show the full worked solution step by step and end with the final answer.
- Mix difficulty: roughly 30% easy, 50% medium, 20% hard ("difficulty" must be "easy", "medium" or "hard").
- "sourcePage" MUST be an existing page number from the study material; "sourceQuote" is a short quote or formula from that page.
- ${focusInstruction}`,
          prompt: `Document: ${title || 'Study Material'}\n\nStudy Material Pages:\n${contextText}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    sourcePage: { type: Type.INTEGER },
                    sourceQuote: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                  },
                  required: [
                    'topic',
                    'question',
                    'options',
                    'correctIndex',
                    'explanation',
                    'sourcePage',
                    'sourceQuote',
                    'difficulty',
                  ],
                },
              },
            },
            required: ['questions'],
          },
        });

        // Drop malformed items instead of "repairing" them: padding options or defaulting the
        // answer to option A would grade students against a wrong key.
        const rawQuestions = (parsed.questions || [])
          .filter((q) => {
            const opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
            return (
              typeof q.question === 'string' &&
              q.question.trim().length > 0 &&
              opts.length === 4 &&
              opts.every((o) => o.length > 0) &&
              new Set(opts).size === 4 &&
              Number.isInteger(q.correctIndex) &&
              q.correctIndex >= 0 &&
              q.correctIndex <= 3
            );
          })
          .slice(0, clampedCount);
        if (rawQuestions.length < Math.min(5, clampedCount)) {
          throw new Error('INSUFFICIENT_QUESTIONS');
        }

        const sanitizedQuestions = rawQuestions.map((q, idx) => {
          const opts = q.options.map((o) => String(o).trim());
          const safeIndex = q.correctIndex;
          const safePage = validPageNumbers.has(q.sourcePage)
            ? q.sourcePage
            : pages[0].pageNumber;
          const diff =
            q.difficulty === 'easy' || q.difficulty === 'medium' || q.difficulty === 'hard'
              ? q.difficulty
              : 'medium';

          return {
            id: `q-${mode}-${Date.now()}-${idx + 1}`,
            topic: q.topic || topics[idx % Math.max(1, topics.length)]?.name || `Page ${safePage}`,
            question: q.question,
            options: [opts[0], opts[1], opts[2], opts[3]] as [string, string, string, string],
            correctIndex: safeIndex,
            explanation: q.explanation,
            sourcePage: safePage,
            sourceQuote: q.sourceQuote || '',
            difficulty: diff,
          };
        });

        res.json({ questions: sanitizedQuestions });
      } catch (err) {
        // No template quiz: a question bank built from raw lines had several "correct" options
        // and a fixed answer pattern, which grades students wrongly. Report the failure instead.
        const notice = extractAiNotice(err);
        res.status(503).json({
          error: `Could not generate quiz questions right now. ${notice.aiNotice}`,
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate quiz.',
      });
    }
  });

  // 4. Mistake DNA & Personalized Revision Plan from actual quiz attempt
  app.post('/api/study/mistakes-and-plan', async (req, res) => {
    try {
      const { documentId, title, pages, attempt } = req.body as {
        documentId: string;
        title?: string;
        pages?: PageInput[];
        attempt?: {
          id: string;
          questions: Array<{
            id: string;
            topic: string;
            question: string;
            options: [string, string, string, string];
            correctIndex: number;
            explanation: string;
            sourcePage: number;
            sourceQuote: string;
          }>;
          answers: Array<{
            questionId: string;
            selectedIndex: number;
            isCorrect: boolean;
            topic: string;
            sourcePage: number;
          }>;
        };
      };

      if (!pages || !attempt) {
        res.status(400).json({ error: 'Pages and quiz attempt data are required.' });
        return;
      }

      const validPageNumbers = new Set(pages.map((p) => p.pageNumber));
      const wrongDetails = attempt.answers
        .filter((a) => !a.isCorrect)
        .map((ans) => {
          const q = attempt.questions.find((item) => item.id === ans.questionId);
          if (!q) return null;
          return {
            questionId: q.id,
            topic: q.topic,
            question: q.question,
            selectedOption:
              ans.selectedIndex >= 0 && ans.selectedIndex < 4
                ? q.options[ans.selectedIndex]
                : 'No answer selected',
            correctOption: q.options[q.correctIndex],
            explanation: q.explanation,
            sourcePage: q.sourcePage,
            sourceQuote: q.sourceQuote,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (wrongDetails.length === 0) {
        res.json({
          mistakes: [],
          revisionPlan: [
            {
              id: `rev-${Date.now()}-mastery`,
              documentId,
              topic: 'All Tested Topics Mastered',
              priority: 'low',
              reason: 'You scored 100% on your quiz attempt with zero misconceptions detected.',
              recommendedAction:
                'Challenge yourself with an Adaptive Practice session or explore deeper questions in the AI Study Tutor.',
              conceptSummary: 'All core concepts across your material were answered accurately.',
              sourcePage: pages[0]?.pageNumber || 1,
              completed: true,
              updatedAt: new Date().toISOString(),
            },
          ],
        });
        return;
      }

      const contextText = formatPagesContext(pages);

      try {
        const { data: parsed } = await generateStructuredJson<{
          mistakes: Array<{
            questionId: string;
            likelyMisconception: string;
            coreConceptFix: string;
          }>;
          revisionPlan: Array<{
            topic: string;
            priority: 'high' | 'medium' | 'low';
            reason: string;
            recommendedAction: string;
            conceptSummary: string;
            sourcePage: number;
          }>;
        }>({
          operation: 'study_mistakes_and_plan',
          tier: 'fast',
          mathFormat: 'unicode',
          systemInstruction: `You are LearnMate's Mistake DNA & Personalized Revision Architect.
Given the study material pages and the exact questions the student answered incorrectly:
1. For each wrong answer, explain the student's "likelyMisconception" (why they chose their selected option instead of the correct option) and the "coreConceptFix" grounded in the source page.
2. Build a prioritized "revisionPlan" of study tasks targeting the weak topics, with specific sourcePage numbers, why it's prioritized, a concrete recommendedAction, and a clear conceptSummary.`,
          prompt: `Document: ${title || 'Study Material'}\n\nStudy Material Pages:\n${contextText}\n\nStudent Incorrect Answers:\n${JSON.stringify(wrongDetails, null, 2)}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mistakes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionId: { type: Type.STRING },
                    likelyMisconception: { type: Type.STRING },
                    coreConceptFix: { type: Type.STRING },
                  },
                  required: ['questionId', 'likelyMisconception', 'coreConceptFix'],
                },
              },
              revisionPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    recommendedAction: { type: Type.STRING },
                    conceptSummary: { type: Type.STRING },
                    sourcePage: { type: Type.INTEGER },
                  },
                  required: [
                    'topic',
                    'priority',
                    'reason',
                    'recommendedAction',
                    'conceptSummary',
                    'sourcePage',
                  ],
                },
              },
            },
            required: ['mistakes', 'revisionPlan'],
          },
        });

        const mistakes = wrongDetails.map((w) => {
          const aiMatch = (parsed.mistakes || []).find((m) => m.questionId === w.questionId);
          return {
            questionId: w.questionId,
            topic: w.topic,
            question: w.question,
            selectedOption: w.selectedOption,
            correctOption: w.correctOption,
            likelyMisconception:
              aiMatch?.likelyMisconception ||
              'No specific misconception was identified for this question. Compare your answer with the explanation below.',
            coreConceptFix: aiMatch?.coreConceptFix || w.explanation,
            sourcePage: validPageNumbers.has(w.sourcePage) ? w.sourcePage : 1,
            sourceQuote: w.sourceQuote,
          };
        });

        const now = new Date().toISOString();
        const revisionPlan = (parsed.revisionPlan || []).map((task, idx) => {
          const priority =
            task.priority === 'high' || task.priority === 'medium' || task.priority === 'low'
              ? task.priority
              : 'high';
          const safePage = validPageNumbers.has(task.sourcePage)
            ? task.sourcePage
            : wrongDetails[idx % wrongDetails.length]?.sourcePage || 1;
          return {
            id: `rev-${Date.now()}-${idx + 1}`,
            documentId,
            topic: task.topic,
            priority,
            reason: task.reason,
            recommendedAction: task.recommendedAction,
            conceptSummary: task.conceptSummary,
            sourcePage: safePage,
            completed: false,
            updatedAt: now,
          };
        });

        res.json({ mistakes, revisionPlan });
      } catch (err) {
        const notice = extractAiNotice(err);
        const now = new Date().toISOString();
        const mistakes = wrongDetails.map((w) => ({
          questionId: w.questionId,
          topic: w.topic,
          question: w.question,
          selectedOption: w.selectedOption,
          correctOption: w.correctOption,
          likelyMisconception:
            'AI mistake analysis is unavailable right now. Compare your answer with the explanation below.',
          coreConceptFix: w.explanation,
          sourcePage: w.sourcePage,
          sourceQuote: w.sourceQuote,
        }));

        const uniqueTopics = Array.from(new Set(wrongDetails.map((w) => w.topic)));
        const revisionPlan = uniqueTopics.map((topic, idx) => {
          const sample = wrongDetails.find((w) => w.topic === topic)!;
          return {
            id: `rev-${Date.now()}-${idx + 1}`,
            documentId,
            topic,
            priority: 'high' as const,
            reason: `Missed ${wrongDetails.filter((w) => w.topic === topic).length} question(s) on ${topic}.`,
            recommendedAction: `Re-read Page ${sample.sourcePage} carefully and run an Adaptive Practice quiz on ${topic}.`,
            conceptSummary: sample.explanation,
            sourcePage: sample.sourcePage,
            completed: false,
            updatedAt: now,
          };
        });

        res.json({
          mistakes,
          revisionPlan,
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to diagnose mistakes.',
      });
    }
  });

  // 5. On-Demand Quick Revise Generator (Sticky Notes & Flashcards OR Mind Map & One-Page Revision)
  app.post('/api/study/quick-revise', async (req, res) => {
    try {
      const {
        title = 'Study Material',
        overview = '',
        sourceType = 'pdf',
        pages = [],
        topics = [],
        resourceType = 'sticky_and_flashcards',
        forceRefresh = false,
      } = req.body as {
        title?: string;
        overview?: string;
        sourceType?: 'pdf' | 'text' | 'youtube';
        pages?: Array<PageInput & { timestampSeconds?: number; timestampLabel?: string }>;
        topics?: TopicInput[];
        resourceType?: 'sticky_and_flashcards' | 'mindmap_and_revision';
        forceRefresh?: boolean;
      };

      if (!Array.isArray(pages) || pages.length === 0) {
        res.status(400).json({ error: 'Study material pages are required.' });
        return;
      }

      const formatRefLabel = (pageNum: number) => {
        const p = pages.find((item) => item.pageNumber === pageNum);
        if (sourceType === 'youtube') {
          if (p?.timestampLabel) return p.timestampLabel;
          const secs = typeof p?.timestampSeconds === 'number' ? p.timestampSeconds : (pageNum - 1) * 120;
          const m = Math.floor(secs / 60);
          const s = Math.floor(secs % 60);
          return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return sourceType === 'text' ? `Section ${pageNum}` : `Page ${pageNum}`;
      };

      const contextText = pages
        .map(
          (p) =>
            `=== ${formatRefLabel(p.pageNumber)} [pageNumber=${p.pageNumber}] (${p.title}) ===\n${p.content}`
        )
        .join('\n\n');

      const validPageNumbers = new Set(pages.map((p) => p.pageNumber));

      if (resourceType === 'sticky_and_flashcards') {
        try {
          const { data: parsed } = await generateStructuredJson<{
            stickyNotes: Array<{
              title: string;
              content: string;
              formula?: string;
              sourcePage: number;
              frontQuestion: string;
              backAnswer: string;
              topic: string;
            }>;
          }>({
            operation: 'quick_revise_sticky_flashcards',
            tier: 'fast',
            mathFormat: 'unicode',
            bypassCache: Boolean(forceRefresh),
            systemInstruction: `You are LearnMate's Quick Revise generator.
Extract 5 to 8 key concepts from the provided study material.
For each concept, produce:
- "title": A short sticky-note heading (2 to 5 words).
- "content": An ultra-concise sticky note body (10 to 28 words maximum, 1 to 3 short lines).
- "formula": Optional short mathematical formula or key equation if applicable (otherwise empty string).
- "sourcePage": Valid integer pageNumber from the input.
- "frontQuestion": Clear active-recall flashcard question testing this concept.
- "backAnswer": Concise, accurate flashcard explanation (15 to 40 words) grounded in the material.
- "topic": Topic name.`,
            prompt: `Document: ${title}\n\nStudy Material:\n${contextText}`,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                stickyNotes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      content: { type: Type.STRING },
                      formula: { type: Type.STRING },
                      sourcePage: { type: Type.INTEGER },
                      frontQuestion: { type: Type.STRING },
                      backAnswer: { type: Type.STRING },
                      topic: { type: Type.STRING },
                    },
                    required: [
                      'title',
                      'content',
                      'sourcePage',
                      'frontQuestion',
                      'backAnswer',
                      'topic',
                    ],
                  },
                },
              },
              required: ['stickyNotes'],
            },
          });

          const rawItems = (parsed.stickyNotes || []).slice(0, 8);
          if (rawItems.length < 4) {
            throw new Error('INSUFFICIENT_NOTES');
          }

          const colors: Array<'yellow' | 'pink' | 'blue' | 'green'> = [
            'yellow',
            'pink',
            'blue',
            'green',
          ];

          const stickyNotes = rawItems.map((item, idx) => {
            const safePage = validPageNumbers.has(item.sourcePage)
              ? item.sourcePage
              : pages[idx % pages.length].pageNumber;
            const words = (item.content || '')
              .trim()
              .split(/\s+/)
              .slice(0, 30)
              .join(' ');
            return {
              id: `sn-${Date.now()}-${idx + 1}`,
              title: (item.title || `Concept ${idx + 1}`).slice(0, 42),
              content: words,
              formula: item.formula ? item.formula.trim().slice(0, 60) : undefined,
              sourcePage: safePage,
              sourceLabel: formatRefLabel(safePage),
              color: colors[idx % colors.length],
            };
          });

          const flashcards = rawItems.map((item, idx) => {
            const safePage = validPageNumbers.has(item.sourcePage)
              ? item.sourcePage
              : pages[idx % pages.length].pageNumber;
            return {
              id: `fc-${Date.now()}-${idx + 1}`,
              frontQuestion: item.frontQuestion || `Explain ${item.title}`,
              backAnswer: item.backAnswer || item.content,
              topic: item.topic || item.title,
              sourcePage: safePage,
              sourceLabel: formatRefLabel(safePage),
              status: 'unreviewed' as const,
            };
          });

          res.json({ stickyNotes, flashcards });
          return;
        } catch (err) {
          const notice = extractAiNotice(err);
          // Grounded deterministic extraction from actual pages
          const colors: Array<'yellow' | 'pink' | 'blue' | 'green'> = [
            'yellow',
            'pink',
            'blue',
            'green',
          ];
          const stickyNotes: Array<Record<string, unknown>> = [];
          const flashcards: Array<Record<string, unknown>> = [];

          for (const page of pages) {
            const lines = page.content
              .split('\n')
              .map((l) => l.replace(/^[•\-*\d.)\s]+/, '').trim())
              .filter((l) => l.length >= 22 && l.length <= 200);
            for (const line of lines) {
              if (stickyNotes.length >= 7) break;
              const colonIdx = line.indexOf(':');
              const shortTitle =
                colonIdx > 2 && colonIdx <= 38
                  ? line.slice(0, colonIdx).trim()
                  : page.title.slice(0, 36);
              const body =
                colonIdx > 2 && colonIdx <= 38 ? line.slice(colonIdx + 1).trim() : line;
              const compactBody = body.split(/\s+/).slice(0, 26).join(' ');
              const idx = stickyNotes.length;
              const refLabel = formatRefLabel(page.pageNumber);

              stickyNotes.push({
                id: `sn-fb-${page.pageNumber}-${idx + 1}`,
                title: shortTitle,
                content: compactBody,
                sourcePage: page.pageNumber,
                sourceLabel: refLabel,
                color: colors[idx % colors.length],
              });
              flashcards.push({
                id: `fc-fb-${page.pageNumber}-${idx + 1}`,
                frontQuestion:
                  colonIdx > 2 && colonIdx <= 38
                    ? `What is the key rule or definition of ${shortTitle}?`
                    : `What does ${refLabel} explain about ${page.title}?`,
                backAnswer: compactBody,
                topic:
                  topics.find((t) => t.sourcePages.includes(page.pageNumber))?.name ||
                  page.title,
                sourcePage: page.pageNumber,
                sourceLabel: refLabel,
                status: 'unreviewed' as const,
              });
            }
          }

          res.json({
            stickyNotes: stickyNotes.slice(0, 8),
            flashcards: flashcards.slice(0, 8),
            aiStatus: notice.aiStatus,
            aiNotice: notice.aiNotice,
          });
          return;
        }
      }

      // resourceType === 'mindmap_and_revision'
      try {
        const { data: parsed } = await generateStructuredJson<{
          branches: Array<{
            label: string;
            explanation: string;
            sourcePage: number;
            subtopics: Array<{
              label: string;
              explanation: string;
            }>;
          }>;
          essentialConcepts: Array<{
            title: string;
            summary: string;
            sourcePage: number;
          }>;
          formulasAndDefinitions: Array<{
            term: string;
            formulaOrDef: string;
            sourcePage: number;
          }>;
          keyRelationships: string[];
          commonMistakesToAvoid: string[];
          quickRecallQuestions: Array<{
            question: string;
            shortAnswer: string;
          }>;
        }>({
          operation: 'quick_revise_mindmap_revision',
          tier: 'fast',
          mathFormat: 'unicode',
          bypassCache: Boolean(forceRefresh),
          systemInstruction: `You are LearnMate's Mind Map and One-Page Revision architect.
Analyze the provided study material and generate:
1. "branches": 4 to 6 main concept branches for a mind map. Each branch has a short "label" (2-5 words), a concise "explanation" (1-2 sentences), a valid "sourcePage", and 1 to 2 "subtopics". Never invent relationships not supported by the material.
2. "essentialConcepts": 3 to 5 core takeaways with sourcePage.
3. "formulasAndDefinitions": 3 to 5 key formulas or definitions from the material with sourcePage.
4. "keyRelationships": 3 to 4 concise statements explaining how concepts connect.
5. "commonMistakesToAvoid": 2 to 4 common student pitfalls mentioned or implied by the material.
6. "quickRecallQuestions": 3 to 4 self-check questions with short answers.`,
          prompt: `Document: ${title}\nOverview: ${overview}\n\nStudy Material:\n${contextText}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              branches: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    sourcePage: { type: Type.INTEGER },
                    subtopics: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          explanation: { type: Type.STRING },
                        },
                        required: ['label', 'explanation'],
                      },
                    },
                  },
                  required: ['label', 'explanation', 'sourcePage', 'subtopics'],
                },
              },
              essentialConcepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    sourcePage: { type: Type.INTEGER },
                  },
                  required: ['title', 'summary', 'sourcePage'],
                },
              },
              formulasAndDefinitions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    formulaOrDef: { type: Type.STRING },
                    sourcePage: { type: Type.INTEGER },
                  },
                  required: ['term', 'formulaOrDef', 'sourcePage'],
                },
              },
              keyRelationships: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              commonMistakesToAvoid: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              quickRecallQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    shortAnswer: { type: Type.STRING },
                  },
                  required: ['question', 'shortAnswer'],
                },
              },
            },
            required: [
              'branches',
              'essentialConcepts',
              'formulasAndDefinitions',
              'keyRelationships',
              'commonMistakesToAvoid',
              'quickRecallQuestions',
            ],
          },
        });

        const branchColors: Array<'blue' | 'red' | 'yellow' | 'green'> = [
          'blue',
          'red',
          'yellow',
          'green',
        ];
        const nodes: Array<{
          id: string;
          label: string;
          explanation: string;
          sourcePage: number;
          sourceLabel: string;
          level: 'central' | 'branch' | 'subtopic';
          color: 'blue' | 'red' | 'yellow' | 'green';
          parentId?: string;
        }> = [
          {
            id: 'node-central',
            label: title.replace(/\.pdf$/i, '').slice(0, 38),
            explanation: overview || `Core study material covering ${pages.length} sections.`,
            sourcePage: pages[0].pageNumber,
            sourceLabel: formatRefLabel(pages[0].pageNumber),
            level: 'central',
            color: 'blue',
          },
        ];
        const edges: Array<{ from: string; to: string; relation?: string }> = [];

        (parsed.branches || []).slice(0, 6).forEach((branch, bIdx) => {
          const color = branchColors[bIdx % branchColors.length];
          const safePage = validPageNumbers.has(branch.sourcePage)
            ? branch.sourcePage
            : pages[bIdx % pages.length].pageNumber;
          const branchId = `node-branch-${bIdx + 1}`;
          nodes.push({
            id: branchId,
            label: (branch.label || `Topic ${bIdx + 1}`).slice(0, 34),
            explanation: branch.explanation || '',
            sourcePage: safePage,
            sourceLabel: formatRefLabel(safePage),
            level: 'branch',
            color,
            parentId: 'node-central',
          });
          edges.push({ from: 'node-central', to: branchId });

          (branch.subtopics || []).slice(0, 2).forEach((sub, sIdx) => {
            const subId = `node-sub-${bIdx + 1}-${sIdx + 1}`;
            nodes.push({
              id: subId,
              label: (sub.label || 'Detail').slice(0, 30),
              explanation: sub.explanation || branch.explanation,
              sourcePage: safePage,
              sourceLabel: formatRefLabel(safePage),
              level: 'subtopic',
              color,
              parentId: branchId,
            });
            edges.push({ from: branchId, to: subId });
          });
        });

        const onePageRevision = {
          chapterTitle: title,
          overview: overview || `Compact one-page revision sheet for ${title}.`,
          essentialConcepts: (parsed.essentialConcepts || []).slice(0, 6).map((c) => {
            const safePage = validPageNumbers.has(c.sourcePage)
              ? c.sourcePage
              : pages[0].pageNumber;
            return {
              title: c.title,
              summary: c.summary,
              sourcePage: safePage,
              sourceLabel: formatRefLabel(safePage),
            };
          }),
          formulasAndDefinitions: (parsed.formulasAndDefinitions || [])
            .slice(0, 6)
            .map((f) => {
              const safePage = validPageNumbers.has(f.sourcePage)
                ? f.sourcePage
                : pages[0].pageNumber;
              return {
                term: f.term,
                formulaOrDef: f.formulaOrDef,
                sourceLabel: formatRefLabel(safePage),
              };
            }),
          keyRelationships: (parsed.keyRelationships || []).slice(0, 5),
          commonMistakesToAvoid: (parsed.commonMistakesToAvoid || []).slice(0, 4),
          quickRecallQuestions: (parsed.quickRecallQuestions || []).slice(0, 4),
        };

        res.json({
          mindMap: {
            centralTopic: title.replace(/\.pdf$/i, ''),
            nodes,
            edges,
          },
          onePageRevision,
        });
      } catch (err) {
        const notice = extractAiNotice(err);
        res.status(503).json({
          error:
            notice.aiNotice ||
            'Gemini model timed out; client will use grounded local concept map.',
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate quick revise content.',
      });
    }
  });

  // 6. YouTube Lecture Import & Grounded Timestamped Analysis
  app.post('/api/study/youtube-analyze', async (req, res) => {
    try {
      const { youtubeUrl } = req.body as { youtubeUrl?: string };
      const rawUrl = (youtubeUrl || '').trim();
      if (!rawUrl) {
        res.status(400).json({ error: 'Please provide a YouTube video link.' });
        return;
      }

      let candidate = rawUrl;
      if (!/^https?:\/\//i.test(candidate)) {
        candidate = `https://${candidate}`;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(candidate);
      } catch {
        res.status(400).json({
          error: 'Invalid YouTube URL format. Please paste a link like https://www.youtube.com/watch?v=...',
        });
        return;
      }

      const host = parsedUrl.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
      let videoId = '';
      if (host === 'youtu.be') {
        videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
      } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        videoId =
          parsedUrl.searchParams.get('v') ||
          parsedUrl.pathname.split('/').filter(Boolean)[1] ||
          '';
      } else {
        res.status(400).json({
          error: 'Only public YouTube links (youtube.com or youtu.be) are supported.',
        });
        return;
      }

      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        res.status(400).json({
          error: 'Could not extract a valid 11-character YouTube video ID from the URL.',
        });
        return;
      }

      const canonicalWatchUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Verify video exists and is public via YouTube oEmbed
      let oembedTitle = '';
      let oembedAuthor = '';
      try {
        const oembedResp = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalWatchUrl)}&format=json`
        );
        if (!oembedResp.ok) {
          res.status(422).json({
            error:
              'This YouTube video appears to be private, unavailable, or restricted from embedding.',
          });
          return;
        }
        const oembedJson = (await oembedResp.json()) as {
          title?: string;
          author_name?: string;
        };
        oembedTitle = oembedJson.title || '';
        oembedAuthor = oembedJson.author_name || '';
      } catch {
        // Proceed to Gemini video analysis if oEmbed network check is unreachable
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error:
            'YouTube import is being rebuilt. For now, open the video on YouTube, choose "Show transcript", copy it, and paste it under Paste text.',
        });
        return;
      }

      const ytFingerprint = computeRequestFingerprint([
        'youtube_analyze',
        'gemini-3.8-flash',
        canonicalWatchUrl,
      ]);

      try {
        const ytCandidateModels = getOrderedCandidateModels('gemini-3.8-flash');
        const ytAnalysis = await geminiManager.execute({
          operation: 'youtube_analyze',
          model: ytCandidateModels[0] || 'gemini-3.1-flash-lite',
          cacheKey: ytFingerprint,
          approxInputChars: canonicalWatchUrl.length + 600,
          task: async () => {
            let lastErr: unknown = null;
            for (const modelName of ytCandidateModels) {
              try {
                const callPromise = ai.models.generateContent({
                  model: modelName,
                  contents: [
                    {
                      role: 'user',
                      parts: [
                        {
                          fileData: {
                            fileUri: canonicalWatchUrl,
                            mimeType: 'video/mp4',
                          },
                        },
                        {
                          text: `Analyze this educational YouTube video${
                            oembedTitle ? ` titled "${oembedTitle}" by ${oembedAuthor}` : ''
                          }.
Extract:
1. "title": Accurate title of the lecture.
2. "overview": Concise 1-2 sentence summary of what the video teaches.
3. "sections": 4 to 7 chronological timestamped sections covering the actual content of the video. Each section MUST include:
   - "timestampSeconds": integer start time in seconds (e.g. 0, 95, 240)
   - "timestampLabel": formatted MM:SS timestamp (e.g. "00:00", "01:35", "04:00")
   - "title": section heading
   - "content": detailed, accurate study notes and key formulas/explanations covered in that segment of the video.
4. "topics": 3 to 5 key study topics with "name", "summary", "keyConcepts", and "sourcePages" (1-based section index numbers).
Never fabricate content if the video has no educational material.`,
                        },
                      ],
                    },
                  ],
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        overview: { type: Type.STRING },
                        sections: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              timestampSeconds: { type: Type.INTEGER },
                              timestampLabel: { type: Type.STRING },
                              title: { type: Type.STRING },
                              content: { type: Type.STRING },
                            },
                            required: ['timestampSeconds', 'timestampLabel', 'title', 'content'],
                          },
                        },
                        topics: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              summary: { type: Type.STRING },
                              keyConcepts: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                              },
                              sourcePages: {
                                type: Type.ARRAY,
                                items: { type: Type.INTEGER },
                              },
                            },
                            required: ['name', 'summary', 'keyConcepts', 'sourcePages'],
                          },
                        },
                      },
                      required: ['title', 'overview', 'sections', 'topics'],
                    },
                    temperature: 0.2,
                  },
                });

                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('YOUTUBE_ANALYSIS_TIMEOUT')), 18000)
                );

                const response = await Promise.race([callPromise, timeoutPromise]);
                const rawText = response.text?.trim();
                if (!rawText) {
                  throw new Error('Empty response from Gemini video analysis.');
                }

                const parsed = JSON.parse(rawText) as {
                  title?: string;
                  overview?: string;
                  sections?: Array<{
                    timestampSeconds: number;
                    timestampLabel: string;
                    title: string;
                    content: string;
                  }>;
                  topics?: Array<{
                    name: string;
                    summary: string;
                    keyConcepts: string[];
                    sourcePages: number[];
                  }>;
                };

                const rawSections = parsed.sections || [];
                if (rawSections.length === 0) {
                  throw new Error('Could not extract structured educational sections from this video.');
                }

                const pages = rawSections.slice(0, 12).map((sec, idx) => {
                  const secs = Math.max(0, Number(sec.timestampSeconds) || idx * 120);
                  const mins = Math.floor(secs / 60);
                  const rem = Math.floor(secs % 60);
                  const label =
                    sec.timestampLabel && /^\d{1,2}:\d{2}/.test(sec.timestampLabel)
                      ? sec.timestampLabel
                      : `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
                  return {
                    pageNumber: idx + 1,
                    title: `${label} — ${sec.title || `Segment ${idx + 1}`}`,
                    content: sec.content,
                    timestampSeconds: secs,
                    timestampLabel: label,
                  };
                });

                const validPageNums = new Set(pages.map((p) => p.pageNumber));
                const topics = (parsed.topics || []).map((t, idx) => {
                  const verified = (t.sourcePages || []).filter((n) => validPageNums.has(n));
                  return {
                    id: `yt-topic-${Date.now()}-${idx + 1}`,
                    name: t.name || `Topic ${idx + 1}`,
                    summary: t.summary || '',
                    keyConcepts: Array.isArray(t.keyConcepts) ? t.keyConcepts.slice(0, 5) : [],
                    sourcePages: verified.length > 0 ? verified : [1],
                  };
                });

                return {
                  videoId,
                  youtubeUrl: canonicalWatchUrl,
                  title: oembedTitle || parsed.title || `YouTube Lecture (${videoId})`,
                  overview:
                    parsed.overview ||
                    `Video lecture analysis for ${oembedTitle || canonicalWatchUrl}.`,
                  pages,
                  topics,
                };
              } catch (err) {
                lastErr = err;
                const classified = classifyGeminiError(err);
                if (classified.category === 'quota_exhausted') {
                  modelCooldownUntil.set(modelName, Date.now() + 15 * 60 * 1000);
                  continue;
                }
                if (classified.category === 'temporarily_busy') {
                  modelCooldownUntil.set(modelName, Date.now() + 30 * 1000);
                  continue;
                }
                if (
                  classified.category === 'auth_config_error' &&
                  (classified.statusCode === 401 || classified.rawReason.toLowerCase().includes('api_key_invalid'))
                ) {
                  throw err;
                }
              }
            }
            throw lastErr || new Error('YOUTUBE_ANALYSIS_FAILED');
          },
        });

        res.json(ytAnalysis);
        return;
      } catch (err) {
        const notice = extractAiNotice(err);
        res.status(422).json({
          error:
            notice.aiStatus === 'temporarily_busy' || notice.aiStatus === 'quota_exhausted'
              ? notice.aiNotice
              : err instanceof Error
              ? `Could not analyze this YouTube video (${err.message}). Please ensure the video is public, has spoken educational content, and try again.`
              : 'Could not analyze this YouTube video. Please ensure the video is public and contains educational content.',
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to analyze YouTube link.',
      });
    }
  });

  // 7. YouTube Learning Recommendations (Explore Further) via Official YouTube Data API v3
  app.post('/api/study/youtube-recommendations', async (req, res) => {
    try {
      const {
        query = '',
        documentTitle = '',
        topics = [],
        weakTopics = [],
        keyConcepts = [],
        pageTitles = [],
      } = req.body as {
        query?: string;
        documentTitle?: string;
        topics?: string[];
        weakTopics?: string[];
        keyConcepts?: string[];
        pageTitles?: string[];
      };

      // Extract 3-5 precise educational concepts (filtering out generic document titles like "Semester 1 Revision")
      const extractedConcepts = extractPreciseEducationalConcepts({
        documentTitle,
        topics: topics.map((name) => ({ name, keyConcepts })),
        weakTopics,
        pageTitles,
      });

      const primaryConcept =
        query.trim() ||
        extractedConcepts[0] ||
        weakTopics[0] ||
        topics[0] ||
        documentTitle.replace(/\.pdf$/i, '').trim() ||
        'Academic Concept';

      const specificSearchQuery = buildSpecificYouTubeSearchQuery({
        concept: primaryConcept,
        documentTitle,
        topics,
      });

      const cacheKey = `${specificSearchQuery.toLowerCase()}::${extractedConcepts.join('|').toLowerCase()}`;
      const cachedRecs = youtubeServerCache.get(cacheKey);
      if (cachedRecs && cachedRecs.expiresAt > Date.now()) {
        res.json({
          configured: true,
          videos: cachedRecs.videos,
          searchQuery: cachedRecs.searchQuery,
          extractedConcepts: cachedRecs.extractedConcepts,
        });
        return;
      }

      const apiKey = (process.env.YOUTUBE_API_KEY || process.env.GEMINI_API_KEY || '').trim();
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.json({
          configured: false,
          videos: [],
          searchQuery: specificSearchQuery,
          extractedConcepts,
          message:
            'YouTube Data API v3 key is not configured. Add YOUTUBE_API_KEY in Secrets to enable live video search.',
        });
        return;
      }

      const ytSearchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      ytSearchUrl.searchParams.set('part', 'snippet');
      ytSearchUrl.searchParams.set('type', 'video');
      ytSearchUrl.searchParams.set('videoEmbeddable', 'true');
      ytSearchUrl.searchParams.set('safeSearch', 'strict');
      ytSearchUrl.searchParams.set('relevanceLanguage', 'en');
      ytSearchUrl.searchParams.set('maxResults', '10');
      ytSearchUrl.searchParams.set('q', specificSearchQuery);
      ytSearchUrl.searchParams.set('key', apiKey);

      const ytResp = await fetch(ytSearchUrl.toString());
      const ytData = (await ytResp.json().catch(() => ({}))) as {
        items?: Array<{
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            description?: string;
            publishedAt?: string;
            thumbnails?: {
              high?: { url?: string };
              medium?: { url?: string };
              default?: { url?: string };
            };
          };
        }>;
        error?: { message?: string };
      };

      if (!ytResp.ok || !Array.isArray(ytData.items)) {
        res.json({
          configured: false,
          videos: [],
          searchQuery: specificSearchQuery,
          extractedConcepts,
          message:
            ytData?.error?.message ||
            'YouTube Data API v3 is not enabled for the current API key. Configure YOUTUBE_API_KEY with YouTube Data API v3 enabled to fetch live video recommendations.',
        });
        return;
      }

      const rawItems = ytData.items.filter((item) => item?.id?.videoId && item?.snippet?.title);
      const videoIds = rawItems.map((item) => item.id!.videoId!).slice(0, 10);

      // Fetch video durations and full descriptions via videos.list
      const durationMap = new Map<string, { durationIso?: string; fullDescription?: string }>();
      if (videoIds.length > 0) {
        try {
          const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
          detailsUrl.searchParams.set('part', 'contentDetails,snippet');
          detailsUrl.searchParams.set('id', videoIds.join(','));
          detailsUrl.searchParams.set('key', apiKey);
          const detailsResp = await fetch(detailsUrl.toString());
          if (detailsResp.ok) {
            const detailsJson = (await detailsResp.json()) as {
              items?: Array<{
                id?: string;
                contentDetails?: { duration?: string };
                snippet?: { description?: string };
              }>;
            };
            for (const vItem of detailsJson.items || []) {
              if (vItem.id) {
                durationMap.set(vItem.id, {
                  durationIso: vItem.contentDetails?.duration,
                  fullDescription: vItem.snippet?.description,
                });
              }
            }
          }
        } catch {
          // Proceed with snippet metadata if videos.list fails
        }
      }

      const candidates = rawItems.map((item) => {
        const vId = item.id!.videoId!;
        const snippet = item.snippet!;
        const details = durationMap.get(vId);
        const thumb =
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
        return {
          videoId: vId,
          title: snippet.title || 'Educational Lecture',
          channelTitle: snippet.channelTitle || 'YouTube Educator',
          description: details?.fullDescription || snippet.description || '',
          thumbnailUrl: thumb,
          watchUrl: `https://www.youtube.com/watch?v=${vId}`,
          publishedAt: snippet.publishedAt,
          durationSeconds: parseIsoDurationSeconds(details?.durationIso),
        };
      });

      const rankedVideos = rankAndFilterYouTubeCandidates({
        candidates,
        concept: primaryConcept,
        subjectKeywords: extractedConcepts.length > 0 ? extractedConcepts : [primaryConcept],
        maxResults: 3,
      });

      const payload = {
        configured: true,
        videos: rankedVideos,
        searchQuery: specificSearchQuery,
        extractedConcepts,
        message:
          rankedVideos.length === 0
            ? `No high-confidence educational lectures matched "${primaryConcept}". Try searching a more specific subtopic above.`
            : undefined,
      };

      youtubeServerCache.set(cacheKey, {
        videos: rankedVideos,
        searchQuery: specificSearchQuery,
        extractedConcepts,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      res.json(payload);
    } catch (err) {
      res.json({
        configured: false,
        videos: [],
        message:
          err instanceof Error
            ? err.message
            : 'Unable to reach YouTube Data API v3 right now.',
      });
    }
  });

  // 8. Multimodal Camera / Handwritten Note Scanner (OCR + Clean & Handwritten Views)
  app.post('/api/study/scan-notes', async (req, res) => {
    try {
      const { imageDataUrl, title = 'Scanned Handwritten Notes' } = req.body as {
        imageDataUrl?: string;
        title?: string;
      };
      if (!imageDataUrl || !imageDataUrl.includes('base64,')) {
        res.status(400).json({ error: 'A valid base64 imageDataUrl is required to scan notes.' });
        return;
      }

      const [header, base64Data] = imageDataUrl.split('base64,');
      const mimeMatch = header.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      const { ai, provider } = await getTrialEligibleStudyClient();
      let scanFailureNotice = extractAiNotice(new Error('NO_API_KEY')).aiNotice;

      const claudeKey = anthropicPreferred() ? getAnthropicApiKey() : null;
      if (claudeKey) {
        if (!CLAUDE_IMAGE_MEDIA_TYPES.has(mimeType)) {
          res.status(400).json({ error: 'Please upload a JPG, PNG or WebP photo of your notes.' });
          return;
        }
        try {
          const result = await callClaude({
            apiKey: claudeKey,
            baseUrl: process.env.ANTHROPIC_BASE_URL,
            model: CLAUDE_SMART_MODEL,
            maxTokens: 12000,
            effort: 'low',
            timeoutMs: 90_000,
            system:
              `You read handwritten and printed JEE Physics, Chemistry and Mathematics notes accurately. Transcribe only what is visible in the image; never add content that is not there.\n\n${MINOR_SAFETY_RULES}`,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
                  {
                    type: 'text',
                    text: `Transcribe these notes ("${title}") into clean digital study notes.
- "extractedTitle": a concise title for the notes
- "cleanContent": the notes as structured text with headings and bullet points
- "handwrittenContent": the same content as natural notebook-style lines
- "uncertainSegments": words or formulas that were blurry or ambiguous (empty if everything is clear)
- "summary": a 1-2 sentence overview
- "keyConcepts": 3 to 5 key concepts or formulas found
Write formulas with Unicode symbols (x², H₂O, √, π, ∫, Δ, →, ≤), not LaTeX.`,
                  },
                ],
              },
            ],
            jsonSchema: toClaudeJsonSchema({
              type: Type.OBJECT,
              properties: {
                extractedTitle: { type: Type.STRING },
                cleanContent: { type: Type.STRING },
                handwrittenContent: { type: Type.STRING },
                uncertainSegments: { type: Type.ARRAY, items: { type: Type.STRING } },
                summary: { type: Type.STRING },
                keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            }),
          });
          if (result.stopReason === 'max_tokens') {
            throw new Error('CLAUDE_OUTPUT_TRUNCATED: the notes are too long to read in one go.');
          }
          const parsed = JSON.parse(result.text || '{}') as {
            extractedTitle?: string;
            cleanContent?: string;
            handwrittenContent?: string;
            uncertainSegments?: string[];
            summary?: string;
            keyConcepts?: string[];
          };
          if (parsed.cleanContent && parsed.cleanContent.trim()) {
            res.json({
              title: parsed.extractedTitle || title,
              cleanContent: parsed.cleanContent,
              handwrittenContent: parsed.handwrittenContent || parsed.cleanContent,
              uncertainSegments: Array.isArray(parsed.uncertainSegments)
                ? parsed.uncertainSegments
                : [],
              summary: parsed.summary || 'Digitized handwritten study notes.',
              keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
            });
            return;
          }
          scanFailureNotice =
            'No readable text was found in this image. Try a clearer, well-lit photo.';
        } catch (err) {
          console.warn(
            '[AI] Claude notes scan failed:',
            err instanceof Error ? err.message.slice(0, 200) : String(err)
          );
          scanFailureNotice = extractAiNotice(err).aiNotice;
        }
      }

      if (ai) {
        try {
          const candidateModels = getOrderedCandidateModels('gemini-3.8-flash');
          const rawModel = candidateModels[0] || 'gemini-3.1-flash-lite';
          const primaryModel =
            provider === 'vertex_ai' ? resolveVertexModelName(rawModel) : rawModel;
          const resp = await ai.models.generateContent({
            model: primaryModel,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { data: base64Data, mimeType } },
                  {
                    text: `Perform high-accuracy academic OCR on this scanned page or whiteboard photo ("${title}").
Return JSON with:
- "extractedTitle": concise title of the notes
- "cleanContent": structured digital markdown notes with headings, bullet points, and clear formulas
- "handwrittenContent": natural, notebook-friendly paragraph/bullet version suitable for handwritten Kalam display
- "uncertainSegments": array of any words/formulas that were blurry or ambiguous (empty array if clear)
- "summary": 1-2 sentence overview
- "keyConcepts": array of 3-5 key concepts or formulas found`,
                  },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  extractedTitle: { type: Type.STRING },
                  cleanContent: { type: Type.STRING },
                  handwrittenContent: { type: Type.STRING },
                  uncertainSegments: { type: Type.ARRAY, items: { type: Type.STRING } },
                  summary: { type: Type.STRING },
                  keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'extractedTitle',
                  'cleanContent',
                  'handwrittenContent',
                  'uncertainSegments',
                  'summary',
                  'keyConcepts',
                ],
              },
            },
          });

          const parsed = JSON.parse(resp.text || '{}');
          if (parsed.cleanContent) {
            res.json({
              title: parsed.extractedTitle || title,
              cleanContent: parsed.cleanContent,
              handwrittenContent: parsed.handwrittenContent || parsed.cleanContent,
              uncertainSegments: Array.isArray(parsed.uncertainSegments)
                ? parsed.uncertainSegments
                : [],
              summary: parsed.summary || 'Digitized handwritten study notes.',
              keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
            });
            return;
          }
          scanFailureNotice =
            'No readable text was found in this image. Try a clearer, well-lit photo (PNG or JPEG).';
        } catch (err) {
          scanFailureNotice = extractAiNotice(err).aiNotice;
        }
      }

      // Never return invented "OCR" text: students would save it as their own notes.
      res.status(503).json({
        error: `Could not scan these notes. ${scanFailureNotice}`,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to scan notes.',
      });
    }
  });

  // 9. Audio Lecture Recording & Multimodal Transcription
  app.post('/api/study/transcribe-audio', async (req, res) => {
    try {
      const {
        audioDataUrl,
        title = 'Recorded Voice Note',
        manualTranscript = '',
      } = req.body as {
        audioDataUrl?: string;
        title?: string;
        manualTranscript?: string;
      };

      const { ai, provider } = await getTrialEligibleStudyClient();
      const hasAudio = Boolean(audioDataUrl && audioDataUrl.includes('base64,'));
      let transcribeFailureNotice = ai
        ? 'No audio was recorded.'
        : extractAiNotice(new Error('NO_API_KEY')).aiNotice;
      if (ai && audioDataUrl && hasAudio) {
        try {
          const [header, base64Data] = audioDataUrl.split('base64,');
          const mimeMatch = header.match(/data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
          const candidateModels =
            provider === 'developer_api'
              ? ['gemini-3.5-transcribe', ...getOrderedCandidateModels('gemini-3.8-flash')]
              : getOrderedCandidateModels('gemini-3.8-flash');
          const rawModel = candidateModels[0] || 'gemini-3.1-flash-lite';
          const primaryModel =
            provider === 'vertex_ai' ? resolveVertexModelName(rawModel) : rawModel;

          const resp = await ai.models.generateContent({
            model: primaryModel,
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { data: base64Data, mimeType } },
                  {
                    text: `Transcribe this student lecture/voice recording ("${title}") and convert it into structured study notes.
Return JSON with:
- "transcript": verbatim or cleaned transcript of the spoken audio
- "structuredNotes": organized bullet-point study notes with headings
- "summary": concise 1-2 sentence summary
- "keyConcepts": 3 to 5 key takeaways`,
                  },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  transcript: { type: Type.STRING },
                  structuredNotes: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['transcript', 'structuredNotes', 'summary', 'keyConcepts'],
              },
            },
          });

          const parsed = JSON.parse(resp.text || '{}');
          if (parsed.transcript) {
            res.json({
              title,
              transcript: parsed.transcript,
              structuredNotes: parsed.structuredNotes || parsed.transcript,
              summary: parsed.summary || 'Transcribed voice study note.',
              keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
              modelUsed: primaryModel,
            });
            return;
          }
          transcribeFailureNotice = 'No speech could be recognised in this recording.';
        } catch (err) {
          const classified = classifyGeminiError(err);
          if (classified.statusCode === 402 || classified.category === 'quota_exhausted') {
            developerApiBillingDepleted = true;
          }
          transcribeFailureNotice = extractAiNotice(err).aiNotice;
        }
      }

      const typedTranscript = manualTranscript.trim();
      if (!typedTranscript) {
        // Never invent a transcript for audio that was not actually transcribed.
        res.status(503).json({
          error: `Could not transcribe this recording. ${transcribeFailureNotice}`,
        });
        return;
      }

      // AI transcription unavailable: keep the student's own typed text unchanged.
      res.json({
        title,
        transcript: typedTranscript,
        structuredNotes: typedTranscript,
        summary: typedTranscript.slice(0, 160),
        keyConcepts: [],
        aiNotice: hasAudio
          ? `The recording was not transcribed (${transcribeFailureNotice}). Saved your typed transcript instead.`
          : undefined,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to transcribe audio note.',
      });
    }
  });

  // 10. Teach It Back — Student Explanation Evaluator
  app.post('/api/study/teach-it-back', async (req, res) => {
    try {
      const {
        topic = 'Core Topic',
        studentExplanation = '',
        keyConcepts = [],
        pages = [],
      } = req.body as {
        topic?: string;
        studentExplanation?: string;
        keyConcepts?: string[];
        pages?: PageInput[];
      };

      if (!studentExplanation || studentExplanation.trim().length < 5) {
        res.status(400).json({ error: 'Please write or speak your explanation first.' });
        return;
      }

      const deterministic = evaluateTeachItBackCoverage({
        studentExplanation,
        keyConcepts:
          keyConcepts.length > 0
            ? keyConcepts
            : [topic, ...(pages[0]?.title ? [pages[0].title] : [])],
        sourceSummary: pages.map((p) => p.content).join('\n'),
      });

      try {
        const contextText = formatPagesContext(pages.slice(0, 4));
        const { data: parsed } = await generateStructuredJson<{
          scorePct: number;
          verdict: 'mastered' | 'good_understanding' | 'partial_gaps' | 'needs_review';
          strengths: string[];
          missingConcepts: string[];
          inaccuracies: string[];
          suggestedFollowUpQuestion: string;
          groundedFeedback: string;
        }>({
          operation: 'study_teach_it_back',
          tier: 'fast',
          mathFormat: 'unicode',
          systemInstruction: `You are LearnMate's "Teach It Back" Feynman-method evaluator.
Compare the student's explanation of "${topic}" against the provided Study Material Pages.
Evaluate:
1. "scorePct" (0 to 100)
2. "verdict": "mastered", "good_understanding", "partial_gaps", or "needs_review"
3. "strengths": specific points the student explained accurately
4. "missingConcepts": important points or conditions from the material they left out
5. "inaccuracies": any misconceptions in their explanation (empty array if none)
6. "suggestedFollowUpQuestion": a Socratic question to deepen their understanding
7. "groundedFeedback": warm, constructive feedback referencing specific page numbers.`,
          prompt: `Topic: ${topic}\n\nStudy Material:\n${contextText}\n\nStudent Explanation:\n${studentExplanation}`,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scorePct: { type: Type.INTEGER },
              verdict: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
              inaccuracies: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedFollowUpQuestion: { type: Type.STRING },
              groundedFeedback: { type: Type.STRING },
            },
            required: [
              'scorePct',
              'verdict',
              'strengths',
              'missingConcepts',
              'inaccuracies',
              'suggestedFollowUpQuestion',
              'groundedFeedback',
            ],
          },
        });

        res.json(parsed);
      } catch (err) {
        const notice = extractAiNotice(err);
        res.json({
          scorePct: deterministic.scorePct,
          verdict: deterministic.verdict,
          strengths: deterministic.coveredConcepts.map((c) => `Mentioned key term: ${c}`),
          missingConcepts: deterministic.missingConcepts,
          inaccuracies: [],
          suggestedFollowUpQuestion:
            deterministic.missingConcepts.length > 0
              ? `Can you explain ${topic} again and include: ${deterministic.missingConcepts.join(', ')}?`
              : `Can you explain ${topic} again using a worked example?`,
          groundedFeedback: `AI evaluation is unavailable right now (${notice.aiNotice}) This score is only a keyword check of your explanation, not a real assessment. ${deterministic.feedbackSummary}`,
          aiStatus: notice.aiStatus,
          aiNotice: notice.aiNotice,
        });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to evaluate explanation.',
      });
    }
  });

  // 10b. Creative Studio — AI 3D Model Creator (Anthropic Claude + Gemini Flash + Procedural Engine)
  app.post('/api/create/3d-model', async (req, res) => {
    try {
      const {
        concept = 'DNA Double Helix',
        contextText = '',
        style = 'academic',
      } = req.body as {
        concept?: string;
        contextText?: string;
        style?: string;
      };

      const systemPrompt = `You are a 3D scientific visualization architect. Convert the user's educational topic into a structured Three.js 3D scene specification.
Return ONLY a valid JSON object with:
- "title": concise title of the 3D model
- "summary": 1-2 sentence academic explanation of what this 3D model represents
- "category": topic category (physics, chemistry, biology, mathematics, engineering, astronomy)
- "camera": { "position": [0, 3, 8] }
- "meshes": array of 8 to 35 3D geometric primitives that form the recognizable scientific structure.
Each mesh object MUST have:
  - "id": string unique id
  - "shape": one of "sphere", "box", "cylinder", "torus", "cone", "capsule", "ring"
  - "args": array of numbers for geometry dimensions (e.g. for sphere [radius, 16, 16], for box [w, h, d], for cylinder [topR, botR, height, 16], for torus [radius, tube, 12, 24])
  - "position": [x, y, z] coordinates centered around [0, 0, 0] within -4 to +4
  - "rotation": optional [rx, ry, rz] radians
  - "color": hex color string like "#10B981", "#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", "#06B6D4"
  - "roughness": optional number (0..1)
  - "metalness": optional number (0..1)
  - "label": short student-facing component name
- "annotations": 2 to 3 educational callouts with "title", "description", and "position": [x, y, z].
Never output markdown fences or commentary outside the JSON.`;

      let sceneSpec: Custom3DSceneSpec | null = null;
      let provider: 'anthropic_claude' | 'gemini' | 'procedural_engine' = 'procedural_engine';
      let modelUsed = 'procedural_engine';

      // 1. Attempt Anthropic Claude if key is available
      const claude3dKey = getAnthropicApiKey();
      if (claude3dKey) {
        try {
          const claudeText = await callAnthropicMessagesApi({
            apiKey: claude3dKey,
            model: CLAUDE_FAST_MODEL,
            system: `${systemPrompt}\n\n${MINOR_SAFETY_RULES}`,
            prompt: `Concept to visualize in 3D: "${concept}". Academic context: ${contextText.slice(0, 400)}. Style: ${style}. Generate structured 3D scene JSON.`,
            maxTokens: 8000,
          });
          if (claudeText) {
            const cleaned = claudeText.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
            sceneSpec = JSON.parse(cleaned);
            provider = 'anthropic_claude';
            modelUsed = CLAUDE_FAST_MODEL;
          }
        } catch (err) {
          console.warn('Claude 3D generation failed, falling back to Gemini:', err);
        }
      }

      // 2. Attempt Gemini if Claude was skipped or failed
      if (!sceneSpec) {
        const ai = getGenAIClient();
        if (ai) {
          try {
            const resp = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: `${systemPrompt}\n\nConcept to visualize in 3D: "${concept}". Academic context: ${contextText.slice(0, 400)}. Style: ${style}. Return JSON.`,
              config: {
                responseMimeType: 'application/json',
              },
            });
            if (resp.text) {
              sceneSpec = JSON.parse(resp.text);
              provider = 'gemini';
              modelUsed = 'gemini-3.8-flash';
            }
          } catch (err) {
            console.warn('Gemini 3D generation failed, falling back to procedural:', err);
          }
        }
      }

      // 3. Fallback to procedural scientific scene engine
      if (!sceneSpec || !Array.isArray(sceneSpec.meshes) || sceneSpec.meshes.length === 0) {
        sceneSpec = generateProcedural3DScene(concept, contextText);
        provider = 'procedural_engine';
        modelUsed = 'procedural-scientific-engine';
      }

      res.json({
        sceneSpec,
        isAiGenerated: provider !== 'procedural_engine',
        provider,
        modelUsed,
        userFacingNotice:
          provider === 'anthropic_claude'
            ? '3D Model synthesized via Anthropic Claude.'
            : provider === 'gemini'
            ? '3D Model synthesized via Gemini 3.8 Flash.'
            : '3D Model synthesized via LearnMate Procedural Scientific Engine.',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate 3D model specification.',
      });
    }
  });

  // 11. Creative Studio — Visualize Concept (Nano Banana 2.1 + Deterministic Scientific Diagram Fallback)
  app.post('/api/create/visualize', async (req, res) => {
    try {
      const {
        concept = 'Concept Overview',
        contextText = '',
        style = 'educational_diagram',
      } = req.body as {
        concept?: string;
        contextText?: string;
        style?: string;
      };

      const ai = getGenAIClient();
      let generatedImageUrl: string | undefined;
      let modelNotice: string | undefined;
      let verificationStatus: 'WORKING_VERIFIED' | 'BLOCKED_BY_BILLING' = 'BLOCKED_BY_BILLING';

      const higgsfieldAuth = getHiggsfieldAuth();
      if (higgsfieldAuth) {
        const styleKey: keyof typeof HIGGSFIELD_IMAGE_MODELS = /illustrat|cartoon|sketch/i.test(style)
          ? 'illustration'
          : /photo|realistic/i.test(style)
          ? 'photo'
          : 'diagram';
        const endpoint = HIGGSFIELD_IMAGE_MODELS[styleKey];
        const prompt = `Clean educational ${
          styleKey === 'diagram' ? 'diagram' : 'illustration'
        } for a JEE Main student explaining "${concept}". White background, clear English labels with correct spelling, arrows where helpful, textbook style, no watermark.${
          contextText.trim() ? ` Context: ${contextText.slice(0, 300)}` : ''
        }`;
        try {
          const job = await submitHiggsfieldJob({
            authHeader: higgsfieldAuth,
            baseUrl: HIGGSFIELD_API_BASE,
            endpoint,
            input:
              styleKey === 'diagram'
                ? { prompt: prompt.slice(0, 2000), aspect_ratio: '16:9', rendering_speed: 'DEFAULT' }
                : styleKey === 'photo'
                ? { prompt, aspect_ratio: '16:9', resolution: '1080p' }
                : { prompt, aspect_ratio: '16:9' },
          });
          const result = await waitForHiggsfieldResult({
            authHeader: higgsfieldAuth,
            baseUrl: HIGGSFIELD_API_BASE,
            requestId: job.request_id,
            statusUrl: job.status_url,
            timeoutMs: 150_000,
          });
          const url = result.images?.[0]?.url;
          if (url) {
            generatedImageUrl = url;
            verificationStatus = 'WORKING_VERIFIED';
            modelNotice = `Generated with Higgsfield (${endpoint}). Higgsfield keeps the file for 7 days, so download it to keep it.`;
          } else {
            modelNotice = 'Higgsfield finished but returned no image.';
          }
        } catch (err) {
          modelNotice = `Higgsfield image generation failed: ${
            err instanceof Error ? err.message : String(err)
          }`;
        }
      }

      if (!generatedImageUrl && ai) {
        try {
          const imgResp = await ai.models.generateContent({
            model: 'gemini-nano-banana-2.1',
            contents: `Create a clean, minimal, high-contrast educational diagram illustrating "${concept}" (${style}). Include clear academic labels and arrows on a white background. Context: ${contextText.slice(0, 400)}`,
          });
          const parts = imgResp.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || 'image/png';
              generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
              verificationStatus = 'WORKING_VERIFIED';
              break;
            }
          }
        } catch (err) {
          const classified = classifyGeminiError(err);
          if (classified.statusCode === 402 || classified.category === 'quota_exhausted') {
            developerApiBillingDepleted = true;
          }
          modelNotice =
            modelNotice ||
            'AI image generation is unavailable right now. Showing a simple outline instead.';
        }
      } else if (!generatedImageUrl && !modelNotice) {
        modelNotice = HIGGSFIELD_PAUSED
          ? 'AI images are paused while we add age checks. A diagram maker for every student is coming soon. Showing a simple outline instead.'
          : 'AI image generation is not set up (add HIGGSFIELD_API_KEY to .env). Showing a simple outline instead.';
      }

      res.json({
        concept,
        style,
        isAiGenerated: Boolean(generatedImageUrl),
        verificationStatus,
        generatedImageUrl,
        modelNotice,
        // The generic outline is only a placeholder when no real image could be generated.
        diagramSteps: generatedImageUrl ? [] : [
          {
            step: 1,
            title: `Input & Foundations: ${concept}`,
            detail:
              'Establish baseline definitions, state variables, and domain assumptions from the source chapter.',
            color: '#4285F4',
          },
          {
            step: 2,
            title: 'Core Mechanism & Governing Law',
            detail:
              contextText.slice(0, 140).trim() ||
              `Apply the governing law or formula connecting the primary variables in ${concept}.`,
            color: '#FBBC05',
          },
          {
            step: 3,
            title: 'Verified Outcome & Application',
            detail:
              'Verify boundary conditions, units, and real-world diagnostic or exam interpretations.',
            color: '#34A853',
          },
        ],
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to visualize concept.',
      });
    }
  });

  // 12. Creative Studio — AI Video Lesson & Image-to-Video Animation (Omni 1.1 Flash + Persistent Job Tracking + Animated Explanation)
  app.post('/api/create/video-lesson', async (req, res) => {
    try {
      const {
        topic = 'Core Concept',
        contextText = '',
        aspectRatio = '16:9',
        sourceImageDataUrl,
      } = req.body as {
        topic?: string;
        contextText?: string;
        aspectRatio?: '16:9' | '9:16';
        sourceImageDataUrl?: string;
      };

      const safeAspectRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const mode: 'text_to_video' | 'image_to_video' =
        sourceImageDataUrl && sourceImageDataUrl.includes('base64,')
          ? 'image_to_video'
          : 'text_to_video';

      const scenes = buildAnimatedExplanationScenes(topic, contextText);
      const jobId = `vidjob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();

      const jobRecord: VideoGenerationJob = {
        jobId,
        ownerUid: (req as StudentRequest).student?.uid,
        topic,
        mode,
        aspectRatio: safeAspectRatio,
        status: 'processing',
        verificationStatus: 'BLOCKED_BY_BILLING',
        fallbackMode: 'animated_explanation',
        scenes,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      videoJobs.set(jobId, jobRecord);

      // Drop settled jobs older than an hour so the in-memory job map cannot grow forever.
      const pruneBefore = Date.now() - 60 * 60 * 1000;
      for (const [existingId, existingJob] of videoJobs) {
        if (existingJob.status !== 'processing' && Date.parse(existingJob.updatedAt) < pruneBefore) {
          videoJobs.delete(existingId);
        }
      }

      const higgsfieldAuth = getHiggsfieldAuth();
      let higgsfieldError: string | undefined;
      if (higgsfieldAuth) {
        try {
          const videoPrompt = `Short educational animation for a JEE Main student explaining "${topic}". Clean diagram-style visuals, smooth motion, scientifically accurate, no on-screen text.${
            contextText.trim() ? ` Context: ${contextText.slice(0, 300)}` : ''
          }`;
          let submitted: HiggsfieldSubmitResponse;
          if (mode === 'image_to_video' && sourceImageDataUrl) {
            const imageUrl = await uploadDataUrlToHiggsfield({
              authHeader: higgsfieldAuth,
              baseUrl: HIGGSFIELD_API_BASE,
              dataUrl: sourceImageDataUrl,
            });
            submitted = await submitHiggsfieldJob({
              authHeader: higgsfieldAuth,
              baseUrl: HIGGSFIELD_API_BASE,
              endpoint: HIGGSFIELD_IMAGE_TO_VIDEO_MODEL,
              input: { prompt: videoPrompt, image_url: imageUrl, duration: 5 },
            });
          } else {
            submitted = await submitHiggsfieldJob({
              authHeader: higgsfieldAuth,
              baseUrl: HIGGSFIELD_API_BASE,
              endpoint: HIGGSFIELD_TEXT_TO_VIDEO_MODEL,
              input: { prompt: videoPrompt, duration: 5, aspect_ratio: safeAspectRatio, sound: 'off' },
            });
          }

          jobRecord.verificationStatus = 'WORKING_WITH_NON_AI_FALLBACK';
          jobRecord.userFacingNotice =
            'Higgsfield is generating your video (usually 1-3 minutes). The animated explanation below plays in the meantime.';
          jobRecord.updatedAt = new Date().toISOString();
          videoJobs.set(jobId, jobRecord);
          void trackHiggsfieldVideoJob(jobId, submitted, higgsfieldAuth);

          res.json({
            jobId,
            topic,
            mode,
            aspectRatio: safeAspectRatio,
            omniStatus: 'higgsfield_processing',
            verificationStatus: jobRecord.verificationStatus,
            fallbackMode: jobRecord.fallbackMode,
            userFacingNotice: jobRecord.userFacingNotice,
            scenes,
          });
          return;
        } catch (err) {
          higgsfieldError = err instanceof Error ? err.message : String(err);
        }
      }

      let videoUrl: string | undefined;
      let omniStatus = 'animated_explanation_ready';
      let userFacingNotice = HIGGSFIELD_PAUSED
        ? 'AI video is paused while we add age checks. Playing the animated explanation for your topic instead.'
        : 'AI video is not set up on this server. Playing the animated explanation for your topic instead.';

      const ai = getGenAIClient();
      if (ai && typeof (ai as any).interactions?.create === 'function') {
        try {
          let interactionInput: unknown = `Create a clear educational explainer animation for "${topic}" illustrating its governing equations and visual mechanism. Context: ${contextText.slice(0, 300)}`;
          if (mode === 'image_to_video' && sourceImageDataUrl) {
            const [header, base64Data] = sourceImageDataUrl.split('base64,');
            const mimeMatch = header.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            interactionInput = [
              {
                type: 'image',
                data: base64Data,
                mime_type: mimeType,
              },
              {
                type: 'text',
                text: `Animate this educational diagram/image for "${topic}" with smooth camera motion and clear step progression.`,
              },
            ];
          }

          const interaction = await Promise.race([
            (ai as any).interactions.create({
              model: 'gemini-omni-1.1-flash',
              input: interactionInput,
              response_modalities: ['video'],
              response_format: {
                type: 'video',
                aspect_ratio: safeAspectRatio,
                duration: '5s',
              },
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('OMNI_TIMEOUT')), 8000)
            ),
          ]);
          const outputs = (interaction as any)?.outputs || [];
          const videoOut = outputs.find((o: any) => o.type === 'video' && o.data);
          if (videoOut?.data) {
            videoUrl = `data:${videoOut.mime_type || 'video/mp4'};base64,${videoOut.data}`;
            omniStatus = 'omni_video_generated';
            userFacingNotice = 'AI video generated via gemini-omni-1.1-flash.';
            jobRecord.status = 'completed';
            jobRecord.verificationStatus = 'WORKING_VERIFIED';
            jobRecord.videoUrl = videoUrl;
            jobRecord.fallbackMode = 'none';
            jobRecord.userFacingNotice = userFacingNotice;
            jobRecord.updatedAt = new Date().toISOString();
          }
        } catch (err) {
          const classified = classifyGeminiError(err);
          if (classified.statusCode === 402 || classified.category === 'quota_exhausted') {
            developerApiBillingDepleted = true;
          }
          omniStatus = 'animated_explanation_mode';
          jobRecord.status = 'failed';
          jobRecord.verificationStatus = 'BLOCKED_BY_BILLING';
          jobRecord.errorReason =
            classified.statusCode === 402
              ? 'HTTP 402: Gemini Developer API prepayment credits are depleted for paid model gemini-omni-1.1-flash.'
              : 'Paid model access required for gemini-omni-1.1-flash video generation.';
          jobRecord.userFacingNotice = userFacingNotice;
          jobRecord.updatedAt = new Date().toISOString();
        }
      } else {
        jobRecord.status = 'failed';
        jobRecord.verificationStatus = 'BLOCKED_BY_BILLING';
        jobRecord.errorReason = 'Paid Developer API key not configured for gemini-omni-1.1-flash.';
        jobRecord.userFacingNotice = userFacingNotice;
        jobRecord.updatedAt = new Date().toISOString();
      }

      if (higgsfieldError && !videoUrl) {
        jobRecord.userFacingNotice = `Higgsfield video generation failed: ${higgsfieldError}. Playing the animated explanation instead.`;
      }
      videoJobs.set(jobId, jobRecord);

      res.json({
        jobId,
        topic,
        mode,
        aspectRatio: safeAspectRatio,
        omniStatus,
        verificationStatus: jobRecord.verificationStatus,
        fallbackMode: jobRecord.fallbackMode,
        userFacingNotice: jobRecord.userFacingNotice,
        errorReason: jobRecord.errorReason,
        videoUrl,
        scenes,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate video lesson.',
      });
    }
  });

  app.get('/api/create/video-jobs/:jobId', (req, res) => {
    const job = videoJobs.get(req.params.jobId);
    // Another student's job looks exactly like a missing one.
    if (!job || job.ownerUid !== (req as StudentRequest).student?.uid) {
      res.status(404).json({ error: 'Video job not found.' });
      return;
    }
    const { ownerUid: _owner, ...publicJob } = job;
    res.json(publicJob);
  });

  // 13. Lo-Fi Focus Radio — Strictly Instrumental Lyria Clip + Deterministic Synth Config
  app.post('/api/create/lofi-music', async (req, res) => {
    try {
      const { presetId = 'rainy-library', prompt = 'Rainy library lo-fi study beats' } = req.body as {
        presetId?: string;
        prompt?: string;
      };

      const sanitizedPrompt = sanitizeInstrumentalLofiPrompt(prompt);
      let audioDataUrl: string | undefined;
      let verificationStatus: 'WORKING_VERIFIED' | 'BLOCKED_BY_BILLING' = 'BLOCKED_BY_BILLING';
      let userFacingNotice =
        'AI media generation requires configuration or paid model access. Playing deterministic Focus Radio instrumental synth.';

      const ai = getGenAIClient();
      if (ai) {
        try {
          const responseStream = await Promise.race([
            ai.models.generateContentStream({
              model: 'lyria-3-clip-preview',
              contents: sanitizedPrompt,
              config: {
                responseModalities: [Modality.AUDIO],
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('LYRIA_TIMEOUT')), 6500)
            ),
          ]);
          let audioBase64 = '';
          let audioMimeType = 'audio/wav';
          for await (const chunk of responseStream) {
            const parts = chunk.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                audioBase64 += part.inlineData.data;
                if (part.inlineData.mimeType) audioMimeType = part.inlineData.mimeType;
              }
            }
          }
          if (audioBase64) {
            audioDataUrl = `data:${audioMimeType};base64,${audioBase64}`;
            verificationStatus = 'WORKING_VERIFIED';
            userFacingNotice = 'Streaming AI instrumental clip generated via Lyria 3.';
          }
        } catch (err) {
          const classified = classifyGeminiError(err);
          if (classified.statusCode === 402 || classified.category === 'quota_exhausted') {
            developerApiBillingDepleted = true;
          }
        }
      }

      res.json({
        presetId,
        instrumentalOnly: true,
        sanitizedPrompt,
        audioDataUrl,
        verificationStatus,
        fallbackMode: audioDataUrl ? 'none' : 'deterministic_web_audio_synth',
        userFacingNotice,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to prepare lo-fi track.',
      });
    }
  });

  // 14. Explore Workspace — LearnMate Daily Current Affairs Newspaper (Google Search Grounding)
  app.post('/api/explore/daily-news', async (req, res) => {
    try {
      const { category = 'All' } = req.body as { category?: string };
      const { ai, provider } = await getTrialEligibleStudyClient();
      let newsFailureNotice = extractAiNotice(new Error('NO_API_KEY')).aiNotice;

      if (ai) {
        try {
          const candidateModels = getOrderedCandidateModels('gemini-3.8-flash');
          const rawModel = candidateModels[0] || 'gemini-3.1-flash-lite';
          const primaryModel =
            provider === 'vertex_ai' ? resolveVertexModelName(rawModel) : rawModel;
          const resp = await Promise.race([
            ai.models.generateContent({
              model: primaryModel,
              contents: `Curate 4 educational and exam-relevant current affairs news summaries for students${
                category && category !== 'All' ? ` in the category "${category}"` : ' across Science, Technology, Economy, and Environment'
              }. Return JSON array of articles with headline, category, summary, examRelevance, keyTakeaways, sourceName, and a 4-option multiple choice quizQuestion.`,
              config: {
                // Omit googleSearch tool when running on Vertex AI Free Trial mode to avoid separate Vertex Search Grounding per-prompt billing
                ...(provider === 'developer_api' ? { tools: [{ googleSearch: {} }] } : {}),
                responseMimeType: 'application/json',
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('NEWS_TIMEOUT')), 8000)
            ),
          ]);
          const parsedRaw = JSON.parse(resp.text || '[]') as unknown;
          const parsedArticles: unknown[] = Array.isArray(parsedRaw)
            ? parsedRaw
            : Array.isArray((parsedRaw as { articles?: unknown[] } | null)?.articles)
            ? (parsedRaw as { articles: unknown[] }).articles
            : [];
          if (parsedArticles.length > 0) {
            res.json({
              updatedAt: new Date().toISOString(),
              articles: parsedArticles.map((article, idx) => {
                const record = (article || {}) as Record<string, unknown>;
                return {
                  ...record,
                  id: typeof record.id === 'string' && record.id ? record.id : `news-${idx + 1}`,
                };
              }),
              // Only true when the Google Search tool was actually attached to the request.
              groundedWithSearch: provider === 'developer_api',
            });
            return;
          }
          newsFailureNotice = 'The AI returned no articles.';
        } catch (err) {
          newsFailureNotice = extractAiNotice(err).aiNotice;
        }
      }

      // No invented articles: an empty edition with the reason is returned instead.
      res.json({
        updatedAt: new Date().toISOString(),
        articles: [],
        groundedWithSearch: false,
        message: `Today's digest is unavailable. ${newsFailureNotice}`,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load daily current affairs.',
      });
    }
  });

  // 15. Explore Workspace — Educational Maps ("Learning Around Me" via Google Maps Grounding)
  app.post('/api/explore/educational-maps', async (req, res) => {
    try {
      const { city = 'Bengaluru', studyTopic = 'Science & Mathematics' } = req.body as {
        city?: string;
        studyTopic?: string;
      };

      // No real place data source (e.g. Places API / Maps grounding) is connected, so no places
      // are invented. Students get an honest notice and a real Google Maps search link instead.
      const cleanCity = city.trim();
      res.json({
        city: cleanCity,
        studyTopic,
        places: [],
        message: 'Educational Maps is not available yet: no verified place data source is connected.',
        mapsSearchUri: cleanCity
          ? `https://www.google.com/maps/search/${encodeURIComponent(`science museum planetarium library ${cleanCity}`)}`
          : undefined,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to fetch educational places.',
      });
    }
  });

  // 16. AI Usage & Stability Telemetry Dashboard Endpoint
  app.get('/api/usage', (_req, res) => {
    const now = Date.now();
    let maxCooldown: number | null = null;
    modelCooldownUntil.forEach((until) => {
      if (until > now && (maxCooldown === null || until > maxCooldown)) {
        maxCooldown = until;
      }
    });

    const formattedOps: Record<string, { count: number; avgMs: number; errors: number }> = {};
    for (const [op, stats] of Object.entries(aiUsageStats.byOperation)) {
      formattedOps[op] = {
        count: stats.count,
        avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
        errors: stats.errors,
      };
    }

    res.json({
      totalRequests: aiUsageStats.totalRequests,
      cacheHits: aiUsageStats.cacheHits,
      deduplicatedHits: aiUsageStats.deduplicatedHits,
      failedRequests: aiUsageStats.failedRequests,
      avgLatencyMs:
        aiUsageStats.totalRequests > 0
          ? Math.round(aiUsageStats.totalLatencyMs / aiUsageStats.totalRequests)
          : 0,
      activeCooldownUntil: maxCooldown,
      byOperation: formattedOps,
      modelsConfigured: [CLAUDE_SMART_MODEL, CLAUDE_FAST_MODEL],
      students: studentUsage.snapshot(),
    });
  });

  // 17. Vertex AI Migration Readiness, Low-Cost Trial Probe & Centralized AI Capability Registry Endpoints
  app.get('/api/capabilities', async (_req, res) => {
    try {
      const probe = await runLowCostVertexProbe(false);
      const hasDeveloperApiKey = Boolean(getDeveloperGenAIClient());
      const hasAnthropicApiKey = Boolean(
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== ''
      );
      const hasHiggsfieldApiKey = Boolean(
        process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_KEY.trim() !== ''
      );
      const capabilities = buildAiCapabilityRegistry({
        vertexProbe: probe,
        hasDeveloperApiKey,
        developerApiBillingDepleted,
        hasAnthropicApiKey,
        hasHiggsfieldApiKey,
      });
      res.json({
        checkedAt: new Date().toISOString(),
        defaultModel: 'gemini-3.1-flash-lite',
        providers: {
          geminiDeveloperApi: hasDeveloperApiKey ? 'CONFIGURED' : 'UNCONFIGURED',
          vertexAiAdc: probe.readyForMigration ? 'WORKING_VERIFIED' : probe.status,
          anthropicClaude: hasAnthropicApiKey ? 'CONFIGURED_OPT_IN' : 'UNCONFIGURED',
          higgsfieldMedia: hasHiggsfieldApiKey ? 'CONFIGURED' : 'UNCONFIGURED',
        },
        vertexProbe: probe,
        capabilities,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to inspect AI capability registry.',
      });
    }
  });

  app.get('/api/vertex/status', async (_req, res) => {
    try {
      const probe = await runLowCostVertexProbe(false);
      const hasDeveloperApiKey = Boolean(getDeveloperGenAIClient());
      const hasAnthropicApiKey = Boolean(
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== ''
      );
      const hasHiggsfieldApiKey = Boolean(
        process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_KEY.trim() !== ''
      );
      res.json({
        probe,
        eligibilityMatrix: VERTEX_TRIAL_ELIGIBILITY_MATRIX,
        capabilities: buildAiCapabilityRegistry({
          vertexProbe: probe,
          hasDeveloperApiKey,
          developerApiBillingDepleted,
          hasAnthropicApiKey,
          hasHiggsfieldApiKey,
        }),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to inspect Vertex AI status.',
      });
    }
  });

  app.post('/api/vertex/probe', async (_req, res) => {
    try {
      const probe = await runLowCostVertexProbe(true);
      const hasDeveloperApiKey = Boolean(getDeveloperGenAIClient());
      const hasAnthropicApiKey = Boolean(
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== ''
      );
      const hasHiggsfieldApiKey = Boolean(
        process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_KEY.trim() !== ''
      );
      res.json({
        probe,
        eligibilityMatrix: VERTEX_TRIAL_ELIGIBILITY_MATRIX,
        capabilities: buildAiCapabilityRegistry({
          vertexProbe: probe,
          hasDeveloperApiKey,
          developerApiBillingDepleted,
          hasAnthropicApiKey,
          hasHiggsfieldApiKey,
        }),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to execute low-cost Vertex AI probe.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ error: `Endpoint ${req.path} not found` });
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  attachGeminiLiveWebSocketServer(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`LearnMate full-stack server running on http://localhost:${PORT}`);
    if (getAnthropicApiKey()) {
      console.log(
        `[LearnMate] AI provider: Anthropic Claude only (smart: ${CLAUDE_SMART_MODEL}, fast: ${CLAUDE_FAST_MODEL}).`
      );
    } else {
      console.warn(
        '[LearnMate] WARNING: ANTHROPIC_API_KEY is not set. AI features (tutor, quizzes, OCR, voice) ' +
          'will report "AI is not set up" until you add it to .env.'
      );
    }
    if (FIREBASE_PROJECT_ID) {
      console.log(
        `[LearnMate] Student sign-in: Firebase project "${FIREBASE_PROJECT_ID}"` +
          (FIREBASE_USE_EMULATOR ? ' (local emulator).' : '.')
      );
    } else {
      console.warn(
        '[LearnMate] WARNING: VITE_FIREBASE_PROJECT_ID is not set, so sign-in and every AI feature ' +
          'are unavailable. See docs/PHASE2_PLAN.md section 4.'
      );
    }
    console.log(
      `[LearnMate] Higgsfield media generation: ${
        !hasHiggsfieldKey() ? 'not configured' : HIGGSFIELD_PAUSED ? 'paused until age checks exist' : 'enabled'
      }.`
    );
  });
}

startServer();
