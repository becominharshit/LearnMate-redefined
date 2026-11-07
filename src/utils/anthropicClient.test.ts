import test from 'node:test';
import assert from 'node:assert/strict';
import { toClaudeJsonSchema, callClaude, streamClaude, ClaudeApiError } from './anthropicClient';

test('toClaudeJsonSchema converts Gemini-style schemas to Claude structured-output schemas', () => {
  const geminiSchema = {
    type: 'OBJECT',
    properties: {
      answer: { type: 'STRING', description: 'The reply' },
      citations: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            pageNumber: { type: 'INTEGER' },
            quote: { type: 'STRING' },
          },
          required: ['pageNumber'],
        },
      },
      found: { type: 'BOOLEAN' },
    },
    required: ['answer'],
  };

  const converted = toClaudeJsonSchema(geminiSchema);
  assert.deepEqual(converted, {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'The reply' },
      citations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pageNumber: { type: 'integer' },
            quote: { type: 'string' },
          },
          required: ['pageNumber', 'quote'],
          additionalProperties: false,
        },
      },
      found: { type: 'boolean' },
    },
    required: ['answer', 'citations', 'found'],
    additionalProperties: false,
  });
});

test('callClaude sends structured-output requests and returns the text block', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        model: 'claude-test',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{"ok":true}' }],
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  try {
    const result = await callClaude({
      apiKey: 'test-key',
      baseUrl: 'http://mock.local/',
      model: 'claude-test',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 100,
      effort: 'low',
      jsonSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    });
    assert.equal(result.text, '{"ok":true}');
    assert.equal(result.stopReason, 'end_turn');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://mock.local/v1/messages');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['x-api-key'], 'test-key');
    assert.equal(headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.output_config.effort, 'low');
    assert.equal(body.output_config.format.type, 'json_schema');
    assert.equal(body.system, 'sys');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('callClaude maps overloaded (529) responses to a retryable 503 error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { message: 'Overloaded' } }), { status: 529 })) as typeof fetch;
  try {
    await assert.rejects(
      callClaude({
        apiKey: 'k',
        model: 'm',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 10,
      }),
      (err: unknown) => err instanceof ClaudeApiError && err.status === 503
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamClaude emits text deltas as SSE chunks arrive', async () => {
  const originalFetch = globalThis.fetch;
  const sseChunks = [
    'event: message_start\ndata: {"type":"message_start","message":{"model":"claude-sonnet-5-5"}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Step 1: "}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"F = ma"}}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
  ];

  globalThis.fetch = (async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as typeof fetch;

  try {
    const deltas: string[] = [];
    const result = await streamClaude(
      {
        apiKey: 'test-key',
        baseUrl: 'http://mock.local/',
        model: 'claude-sonnet-5-5',
        messages: [{ role: 'user', content: 'Explain Newton 2nd law' }],
        maxTokens: 200,
        effort: 'low',
      },
      (chunk) => deltas.push(chunk)
    );
    assert.deepEqual(deltas, ['Step 1: ', 'F = ma']);
    assert.equal(result.text, 'Step 1: F = ma');
    assert.equal(result.stopReason, 'end_turn');
    assert.equal(result.model, 'claude-sonnet-5-5');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
