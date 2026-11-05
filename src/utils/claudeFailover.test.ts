import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClaudeAttemptPlan,
  claudeFailureLogLine,
  shouldTryNextClaudeModel,
} from './claudeFailover';
import { ClaudeApiError } from './anthropicClient';

const MODELS = {
  smartModel: 'claude-sonnet-5-5',
  fastModel: 'claude-haiku-5-5',
};

test('smart tier tries Sonnet then Haiku; fast tier tries Haiku then Sonnet', () => {
  assert.deepEqual(buildClaudeAttemptPlan({ ...MODELS, tier: 'smart' }), [
    { model: 'claude-sonnet-5-5', effort: 'medium' },
    { model: 'claude-haiku-5-5', effort: 'low' },
  ]);
  assert.deepEqual(buildClaudeAttemptPlan({ ...MODELS, tier: 'fast' }), [
    { model: 'claude-haiku-5-5', effort: 'low' },
    { model: 'claude-sonnet-5-5', effort: 'medium' },
  ]);
});

test('a single configured model is not retried twice', () => {
  assert.deepEqual(
    buildClaudeAttemptPlan({
      smartModel: 'claude-sonnet-5-5',
      fastModel: 'claude-sonnet-5-5',
      tier: 'smart',
    }),
    [{ model: 'claude-sonnet-5-5', effort: 'medium' }]
  );
});

test('transient and model-specific failures switch to the other Claude model', () => {
  for (const status of [404, 429, 500, 502, 503, 504]) {
    assert.equal(
      shouldTryNextClaudeModel(new ClaudeApiError(`Anthropic API error ${status}`, status)),
      true,
      `HTTP ${status} should fail over`
    );
  }
  assert.equal(
    shouldTryNextClaudeModel(new ClaudeApiError('Network error contacting the AI service', 503)),
    true
  );
  assert.equal(shouldTryNextClaudeModel(new Error('CLAUDE_TIMEOUT: the AI took too long')), true);
  assert.equal(shouldTryNextClaudeModel(new Error('EMPTY_RESPONSE')), true);
  assert.equal(shouldTryNextClaudeModel(new Error('Unexpected token in JSON')), true);
  assert.equal(
    shouldTryNextClaudeModel(new ClaudeApiError('model not found: claude-sonnet-5-5', 400)),
    true
  );
});

test('account, safety and prompt failures do not waste a second model call', () => {
  assert.equal(shouldTryNextClaudeModel(new Error('NO_API_KEY')), false);
  assert.equal(shouldTryNextClaudeModel(new Error('CLAUDE_REFUSAL: declined')), false);
  assert.equal(shouldTryNextClaudeModel(new Error('CLAUDE_OUTPUT_TRUNCATED: cut off')), false);
  assert.equal(
    shouldTryNextClaudeModel(new ClaudeApiError('credit balance is too low', 400)),
    false
  );
  assert.equal(
    shouldTryNextClaudeModel(new ClaudeApiError('invalid x-api-key', 401)),
    false
  );
  assert.equal(
    shouldTryNextClaudeModel(new ClaudeApiError('permission denied', 403)),
    false
  );
  assert.equal(shouldTryNextClaudeModel(new ClaudeApiError('bad request', 400)), false);
});

test('log lines never include line breaks or unbounded text', () => {
  const line = claudeFailureLogLine(
    new ClaudeApiError(`overloaded\n${'x'.repeat(300)}`, 503)
  );
  assert.equal(line.includes('\n'), false);
  assert.ok(line.length <= 200);
  assert.match(line, /^HTTP 503:/);
});
