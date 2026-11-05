/**
 * Claude model failover rules shared by the server and the 3D helper.
 *
 * The smart model (Sonnet) is tried first for tutoring and question writing, with the fast
 * model (Haiku) as a fast backup. The fast tier reverses that order. Only failures that a
 * different model can plausibly fix trigger a switch: rate limits, overload, network errors,
 * timeouts, bad JSON and unknown model ids. Auth, billing, refusal and cut-off errors stop
 * immediately so students are not left waiting for a retry that cannot help.
 */

import type { ClaudeEffort } from './anthropicClient';

export interface ClaudeAttemptPlan {
  model: string;
  effort: ClaudeEffort;
}

export function buildClaudeAttemptPlan(options: {
  smartModel: string;
  fastModel: string;
  tier: 'smart' | 'fast';
}): ClaudeAttemptPlan[] {
  const smart: ClaudeAttemptPlan = { model: options.smartModel.trim(), effort: 'medium' };
  const fast: ClaudeAttemptPlan = { model: options.fastModel.trim(), effort: 'low' };
  const ordered = options.tier === 'fast' ? [fast, smart] : [smart, fast];

  const seen = new Set<string>();
  return ordered.filter((attempt) => {
    if (!attempt.model || seen.has(attempt.model)) return false;
    seen.add(attempt.model);
    return true;
  });
}

function errorStatus(error: unknown): number | undefined {
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  for (const value of [candidate?.status, candidate?.statusCode, candidate?.code]) {
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || '')).toLowerCase();
}

/** True when trying the other Claude model could realistically succeed. */
export function shouldTryNextClaudeModel(error: unknown): boolean {
  const message = errorMessage(error);
  const status = errorStatus(error);

  // These depend on the prompt or the account, not on the model.
  if (
    message.includes('no_api_key') ||
    message.includes('claude_output_truncated') ||
    message.includes('claude_refusal') ||
    message.includes('credit balance is too low') ||
    message.includes('prepayment credits') ||
    message.includes('billing') ||
    message.includes('quota') ||
    status === 401 ||
    status === 403
  ) {
    return false;
  }

  // A 400 is usually a malformed request (same result on every model). The exception is a
  // model-id problem, which the backup model can fix.
  if (status === 400 && !message.includes('model')) return false;

  // Timeouts, network failures, 404/429/5xx, empty text and JSON parse errors are all worth a
  // second attempt on the other model.
  return true;
}

/** Short, PII-free reason for server logs. */
export function claudeFailureLogLine(error: unknown): string {
  const status = errorStatus(error);
  const raw = error instanceof Error ? error.message : String(error || 'unknown error');
  const clean = raw.replace(/\s+/g, ' ').slice(0, 180);
  return status ? `HTTP ${status}: ${clean}` : clean;
}
