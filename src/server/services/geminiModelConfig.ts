import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_MODEL_FAST = 'gemini-3.5-flash-lite';
export const DEFAULT_GEMINI_MODEL_THINKING = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_MODEL_LIVE = 'gemini-3.8-live';

export const GEMINI_FALLBACK_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
] as const;

export interface GeminiModelConfig {
  fastModel: string;
  thinkingModel: string;
  liveModel: string;
  fallbackChain: string[];
}

export function getGeminiModelConfig(
  env: Record<string, string | undefined> = process.env
): GeminiModelConfig {
  const fastModel = (env.GEMINI_MODEL_FAST || '').trim() || DEFAULT_GEMINI_MODEL_FAST;
  const thinkingModel = (env.GEMINI_MODEL_THINKING || '').trim() || DEFAULT_GEMINI_MODEL_THINKING;
  const liveModel = (env.GEMINI_MODEL_LIVE || '').trim() || DEFAULT_GEMINI_MODEL_LIVE;

  const fallbackChain: string[] = [];
  for (const candidate of [thinkingModel, ...GEMINI_FALLBACK_CHAIN, fastModel]) {
    const clean = candidate.trim();
    if (clean && !fallbackChain.includes(clean)) {
      fallbackChain.push(clean);
    }
  }

  return {
    fastModel,
    thinkingModel,
    liveModel,
    fallbackChain,
  };
}

export function extractGeminiErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const anyErr = err as Record<string, unknown>;
  const direct = anyErr.status ?? anyErr.statusCode ?? anyErr.code;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const nested = (anyErr.error as Record<string, unknown> | undefined)?.code;
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
  const msg = anyErr.message ? String(anyErr.message) : '';
  if (/\b404\b|not found|is not found for api version/i.test(msg)) return 404;
  if (/\b429\b|rate limit|too many requests|resource_exhausted|quota/i.test(msg)) return 429;
  return undefined;
}

export function isFallbackableGeminiStatus(err: unknown): boolean {
  const status = extractGeminiErrorStatus(err);
  return status === 404 || status === 429;
}

export interface GeminiFallbackAttemptResult {
  response: GenerateContentResponse;
  modelUsed: string;
  attempts: Array<{ model: string; status?: number; error?: string }>;
}

export class GeminiFallbackExhaustedError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly attempts: Array<{ model: string; status?: number; error?: string }>;

  constructor(
    message: string,
    attempts: Array<{ model: string; status?: number; error?: string }>,
    statusCode = 503
  ) {
    super(message);
    this.name = 'GeminiFallbackExhaustedError';
    this.statusCode = statusCode;
    this.code = 'gemini_models_exhausted';
    this.attempts = attempts;
  }
}

export type MinimalGenAiClient = {
  models: {
    generateContent: (params: GenerateContentParameters) => Promise<GenerateContentResponse>;
  };
};

/**
 * Calls `ai.models.generateContent` across the configured model fallback chain
 * (`gemini-3.8-flash` -> `gemini-3.6-flash` -> `gemini-3.5-flash-lite`) whenever a
 * model returns HTTP 404 (not found/retired) or 429 (rate-limited/quota exhausted).
 */
export async function generateWithModelFallback(
  ai: GoogleGenAI | MinimalGenAiClient,
  params: Omit<GenerateContentParameters, 'model'> & {
    preferredModel?: string;
    fallbackModels?: string[];
  }
): Promise<GeminiFallbackAttemptResult> {
  const cfg = getGeminiModelConfig();
  const baseList = params.fallbackModels?.length
    ? params.fallbackModels
    : cfg.fallbackChain;
  const modelsToTry: string[] = [];
  if (params.preferredModel && params.preferredModel.trim()) {
    modelsToTry.push(params.preferredModel.trim());
  }
  for (const m of baseList) {
    if (m && !modelsToTry.includes(m)) {
      modelsToTry.push(m);
    }
  }

  const attempts: Array<{ model: string; status?: number; error?: string }> = [];
  let lastError: unknown = null;
  const { preferredModel: _p, fallbackModels: _f, ...requestParams } = params;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await ai.models.generateContent({
        ...requestParams,
        model,
      });
      return { response, modelUsed: model, attempts };
    } catch (err) {
      lastError = err;
      const status = extractGeminiErrorStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ model, status, error: message.slice(0, 220) });

      if (isFallbackableGeminiStatus(err) && i < modelsToTry.length - 1) {
        continue;
      }
      if (isFallbackableGeminiStatus(err)) {
        throw new GeminiFallbackExhaustedError(
          `All Gemini fallback models failed (${attempts.map((a) => `${a.model}:${a.status ?? 'err'}`).join(', ')}).`,
          attempts,
          status || 503
        );
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new GeminiFallbackExhaustedError('No Gemini models available.', attempts, 503);
}
