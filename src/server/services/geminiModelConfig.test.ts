import test from 'node:test';
import assert from 'node:assert/strict';
import type { GenerateContentResponse } from '@google/genai';
import {
  getGeminiModelConfig,
  generateWithModelFallback,
  GeminiFallbackExhaustedError,
  GEMINI_FALLBACK_CHAIN,
  extractGeminiErrorStatus,
  type MinimalGenAiClient,
} from './geminiModelConfig';

test('getGeminiModelConfig reads env vars and defaults to current 3.x aliases', () => {
  const envEmpty: Record<string, string | undefined> = {};
  const defaults = getGeminiModelConfig(envEmpty);
  assert.equal(defaults.fastModel, 'gemini-3.5-flash-lite');
  assert.equal(defaults.thinkingModel, 'gemini-3.8-flash');
  assert.equal(defaults.liveModel, 'gemini-3.8-live');
  assert.deepEqual(GEMINI_FALLBACK_CHAIN, [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ]);

  const custom = getGeminiModelConfig({
    GEMINI_MODEL_FAST: 'gemini-3.6-flash',
    GEMINI_MODEL_THINKING: 'gemini-3.8-pro',
    GEMINI_MODEL_LIVE: 'gemini-3.8-live-custom',
  });
  assert.equal(custom.fastModel, 'gemini-3.6-flash');
  assert.equal(custom.thinkingModel, 'gemini-3.8-pro');
  assert.equal(custom.liveModel, 'gemini-3.8-live-custom');
});

test('generateWithModelFallback cascades on 404 and 429 and returns result on recovered model', async () => {
  const attempted: string[] = [];
  const mockAi: MinimalGenAiClient = {
    models: {
      generateContent: async (params) => {
        attempted.push(params.model);
        if (params.model === 'gemini-3.8-flash') {
          throw Object.assign(new Error('Model not found'), { status: 404 });
        }
        if (params.model === 'gemini-3.6-flash') {
          throw Object.assign(new Error('429 Too Many Requests'), { status: 429 });
        }
        return { text: `ok:${params.model}` } as GenerateContentResponse;
      },
    },
  };

  const { modelUsed, response, attempts } = await generateWithModelFallback(mockAi, {
    contents: 'Explain Gauss Law',
    preferredModel: 'gemini-3.8-flash',
  });

  assert.equal(modelUsed, 'gemini-3.5-flash-lite');
  assert.equal(response.text, 'ok:gemini-3.5-flash-lite');
  assert.deepEqual(attempted, [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ]);
  assert.equal(attempts.length, 2);
});

test('generateWithModelFallback throws GeminiFallbackExhaustedError when all models fail with 429/404', async () => {
  const failingAi: MinimalGenAiClient = {
    models: {
      generateContent: async () => {
        throw { status: 429, message: 'Resource exhausted' };
      },
    },
  };

  await assert.rejects(
    () =>
      generateWithModelFallback(failingAi, {
        contents: 'Solve integral',
        preferredModel: 'gemini-3.8-flash',
      }),
    (err: unknown) => {
      assert.ok(err instanceof GeminiFallbackExhaustedError);
      assert.equal(err.statusCode, 429);
      assert.equal(err.attempts.length, 3);
      return true;
    }
  );
});

test('extractGeminiErrorStatus detects HTTP 404 and 429 from status or error message', () => {
  assert.equal(extractGeminiErrorStatus({ status: 404 }), 404);
  assert.equal(extractGeminiErrorStatus({ code: 429 }), 429);
  assert.equal(extractGeminiErrorStatus(new Error('HTTP 429 rate limit exceeded')), 429);
  assert.equal(extractGeminiErrorStatus(new Error('404 models/foo is not found')), 404);
});
