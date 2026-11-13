/**
 * AI Gateway Utilities: Prompt-Injection Isolation, Spend-Cap Guards,
 * and Structured Provider Telemetry Capture.
 */

import { getAiTelemetryService, type AiProviderName } from './aiTelemetryService.ts';

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi,
  /disregard\s+(all\s+)?(system|developer)\s+(prompts?|rules?)/gi,
  /you\s+are\s+now\s+(in\s+)?developer\s+mode/gi,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|api\s+key)/gi,
  /<\|?(system|assistant|im_start|im_end)\|?>/gi,
];

/**
 * Strips known instruction-hijack control tokens from user-uploaded PDFs/notes/questions
 * without damaging legitimate Physics/Chemistry/Mathematics formulas.
 */
export function sanitizeUntrustedStudyText(rawText: string, maxChars = 48_000): string {
  let cleaned = String(rawText || '').slice(0, maxChars);
  for (const pat of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pat, '[filtered-untrusted-directive]');
  }
  return cleaned;
}

/**
 * Wraps uploaded PDF/OCR/YouTube study text in explicit XML-style data boundaries
 * so LLM calls treat document contents strictly as untrusted reference material.
 */
export function wrapUntrustedStudyMaterial(rawText: string, sourceLabel = 'student_study_material'): string {
  const safeLabel = String(sourceLabel || 'student_study_material').replace(/[^a-zA-Z0-9._-]/g, '_');
  const sanitized = sanitizeUntrustedStudyText(rawText);
  return [
    `<untrusted_reference_data source="${safeLabel}" treat_as_data_only="true">`,
    sanitized,
    `</untrusted_reference_data>`,
  ].join('\n');
}

export function assertSpendCapAllowsCall(): { allowed: boolean; reason?: string } {
  const status = getAiTelemetryService().getSpendStatus();
  if (status.circuitOpen) {
    return { allowed: false, reason: status.reason };
  }
  return { allowed: true };
}

export function recordGeminiUsageMetadata(params: {
  endpoint: string;
  provider: AiProviderName;
  model: string;
  uid?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null;
  latencyMs: number;
  success: boolean;
  fallbackCharEstimate?: number;
}) {
  const telemetry = getAiTelemetryService();
  const hasReal = Boolean(
    params.usageMetadata &&
      (typeof params.usageMetadata.promptTokenCount === 'number' ||
        typeof params.usageMetadata.candidatesTokenCount === 'number')
  );
  const promptTokens = hasReal
    ? Number(params.usageMetadata?.promptTokenCount || 0)
    : Math.max(0, Math.round((params.fallbackCharEstimate || 0) / 4));
  const completionTokens = hasReal ? Number(params.usageMetadata?.candidatesTokenCount || 0) : 0;

  return telemetry.recordUsage({
    endpoint: params.endpoint,
    provider: params.provider,
    model: params.model,
    uid: params.uid,
    promptTokens,
    completionTokens,
    isMeasured: hasReal,
    latencyMs: params.latencyMs,
    success: params.success,
  });
}

export function recordClaudeUsageMetadata(params: {
  endpoint: string;
  model: string;
  uid?: string;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  latencyMs: number;
  success: boolean;
}) {
  const telemetry = getAiTelemetryService();
  const hasReal = Boolean(
    params.usage &&
      (typeof params.usage.input_tokens === 'number' ||
        typeof params.usage.output_tokens === 'number')
  );
  return telemetry.recordUsage({
    endpoint: params.endpoint,
    provider: 'anthropic_claude',
    model: params.model,
    uid: params.uid,
    promptTokens: Number(params.usage?.input_tokens || 0),
    completionTokens: Number(params.usage?.output_tokens || 0),
    isMeasured: hasReal,
    latencyMs: params.latencyMs,
    success: params.success,
  });
}
