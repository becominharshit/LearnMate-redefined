/**
 * Minimal Anthropic Messages API client (no SDK dependency) used by the server for all
 * Claude calls, including structured JSON output via `output_config.format`.
 */

export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeRequest {
  apiKey: string;
  baseUrl?: string;
  model: string;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens: number;
  effort?: ClaudeEffort;
  /** JSON schema for structured output; the reply text is then guaranteed to match it. */
  jsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface ClaudeResponse {
  text: string;
  stopReason: string | null;
  model: string;
}

export class ClaudeApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
  }
}

/** Image types the Messages API accepts as base64 image blocks. */
export const CLAUDE_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/**
 * Converts a Gemini-style response schema (`Type.OBJECT`, `Type.STRING`, ...) or a plain JSON
 * schema into the subset accepted by Claude structured outputs: lowercase types,
 * `additionalProperties: false` on every object and every property required (Claude fills
 * otherwise-optional strings with "", which keeps the compiled grammar small).
 */
export function toClaudeJsonSchema(schema: unknown): Record<string, unknown> {
  const convert = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    if (typeof src.type === 'string') out.type = src.type.toLowerCase();
    if (typeof src.description === 'string') out.description = src.description;
    if (Array.isArray(src.enum)) out.enum = src.enum;

    if (out.type === 'object' || (src.properties && typeof src.properties === 'object')) {
      const props = (src.properties || {}) as Record<string, unknown>;
      const convertedProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        convertedProps[key] = convert(value);
      }
      out.type = 'object';
      out.properties = convertedProps;
      out.required = Object.keys(convertedProps);
      out.additionalProperties = false;
    }

    if (out.type === 'array' && src.items) {
      out.items = convert(src.items);
    }
    return out;
  };

  return convert(schema) as Record<string, unknown>;
}

export async function callClaude(req: ClaudeRequest): Promise<ClaudeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      messages: req.messages,
    };
    if (req.system) body.system = req.system;

    const outputConfig: Record<string, unknown> = {};
    if (req.effort) outputConfig.effort = req.effort;
    if (req.jsonSchema) outputConfig.format = { type: 'json_schema', schema: req.jsonSchema };
    if (Object.keys(outputConfig).length > 0) body.output_config = outputConfig;

    const baseUrl = (req.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': req.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new ClaudeApiError('CLAUDE_TIMEOUT: the AI took too long to respond.');
      }
      throw new ClaudeApiError(
        `Network error contacting the AI service: ${err instanceof Error ? err.message : String(err)}`,
        503
      );
    }

    const raw = await res.text();
    let data: {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string | null;
      model?: string;
      error?: { message?: string };
    } | null = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const apiMessage = data?.error?.message || raw.slice(0, 300) || `HTTP ${res.status}`;
      // 529 means "overloaded": report it like 503 so callers treat it as temporarily busy.
      const status = res.status === 529 ? 503 : res.status;
      throw new ClaudeApiError(`Anthropic API error ${res.status}: ${apiMessage}`, status);
    }

    const blocks = Array.isArray(data?.content) ? data!.content! : [];
    const text = blocks
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');

    return {
      text,
      stopReason: data?.stop_reason ?? null,
      model: data?.model || req.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function streamClaude(
  req: Omit<ClaudeRequest, 'jsonSchema'>,
  onDelta: (textChunk: string) => void
): Promise<ClaudeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);

  try {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      messages: req.messages,
      stream: true,
    };
    if (req.system) body.system = req.system;
    if (req.effort) body.output_config = { effort: req.effort };

    const baseUrl = (req.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': req.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new ClaudeApiError('CLAUDE_TIMEOUT: the AI took too long to respond.');
      }
      throw new ClaudeApiError(
        `Network error contacting the AI service: ${err instanceof Error ? err.message : String(err)}`,
        503
      );
    }

    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let apiMessage = raw.slice(0, 300) || `HTTP ${res.status}`;
      try {
        const parsed = raw ? (JSON.parse(raw) as { error?: { message?: string } }) : null;
        if (parsed?.error?.message) apiMessage = parsed.error.message;
      } catch {
        // use raw text
      }
      const status = res.status === 529 ? 503 : res.status;
      throw new ClaudeApiError(`Anthropic API error ${res.status}: ${apiMessage}`, status);
    }

    if (!res.body) {
      throw new ClaudeApiError('Anthropic stream returned an empty response body.', 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let stopReason: string | null = null;
    let resolvedModel = req.model;

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) return;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') return;
      let evt: {
        type?: string;
        message?: { model?: string; stop_reason?: string | null };
        delta?: { type?: string; text?: string; stop_reason?: string | null };
        error?: { message?: string };
      };
      try {
        evt = JSON.parse(payload);
      } catch {
        return;
      }
      if (evt.type === 'message_start' && evt.message?.model) {
        resolvedModel = evt.message.model;
      } else if (
        evt.type === 'content_block_delta' &&
        evt.delta?.type === 'text_delta' &&
        typeof evt.delta.text === 'string'
      ) {
        fullText += evt.delta.text;
        onDelta(evt.delta.text);
      } else if (evt.type === 'message_delta' && evt.delta?.stop_reason !== undefined) {
        stopReason = evt.delta.stop_reason ?? null;
      } else if (evt.type === 'error') {
        throw new ClaudeApiError(
          `Anthropic stream error: ${evt.error?.message || 'stream interrupted'}`,
          502
        );
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        processLine(line);
      }
    }
    if (buffer.trim()) {
      processLine(buffer);
    }

    return {
      text: fullText,
      stopReason,
      model: resolvedModel,
    };
  } finally {
    clearTimeout(timer);
  }
}
