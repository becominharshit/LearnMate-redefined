import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHiggsfieldAuthHeader,
  submitHiggsfieldJob,
  waitForHiggsfieldResult,
  HiggsfieldApiError,
} from './higgsfieldClient';

test('buildHiggsfieldAuthHeader uses the "Key id:secret" scheme', () => {
  assert.equal(buildHiggsfieldAuthHeader('abc:def'), 'Key abc:def');
  assert.equal(buildHiggsfieldAuthHeader('abc', 'def'), 'Key abc:def');
  assert.equal(buildHiggsfieldAuthHeader(' abc:def ', 'ignored'), 'Key abc:def');
});

test('submitHiggsfieldJob posts a flat JSON body with auth and idempotency headers', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({ status: 'queued', request_id: 'req-1', status_url: 'http://mock/status/req-1' }),
      { status: 200 }
    );
  }) as typeof fetch;
  try {
    const job = await submitHiggsfieldJob({
      authHeader: 'Key a:b',
      endpoint: 'ideogram/v4.0',
      input: { prompt: 'projectile motion diagram', aspect_ratio: '16:9' },
      baseUrl: 'http://mock/',
    });
    assert.equal(job.request_id, 'req-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://mock/ideogram/v4.0');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Key a:b');
    assert.ok(headers['Idempotency-Key']);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      prompt: 'projectile motion diagram',
      aspect_ratio: '16:9',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('waitForHiggsfieldResult polls until completed and returns the result', async () => {
  const originalFetch = globalThis.fetch;
  const statuses = ['queued', 'in_progress', 'completed'];
  let calls = 0;
  globalThis.fetch = (async () => {
    const status = statuses[Math.min(calls, statuses.length - 1)];
    calls += 1;
    return new Response(
      JSON.stringify(
        status === 'completed' ? { status, images: [{ url: 'https://cdn/img.png' }] } : { status }
      ),
      { status: 200 }
    );
  }) as typeof fetch;
  try {
    const result = await waitForHiggsfieldResult({
      authHeader: 'Key a:b',
      requestId: 'req-1',
      baseUrl: 'http://mock',
      timeoutMs: 60_000,
      sleep: async () => {},
    });
    assert.equal(result.images?.[0]?.url, 'https://cdn/img.png');
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('waitForHiggsfieldResult reports content-filter blocks and stops on auth errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: 'nsfw' }), { status: 200 })) as typeof fetch;
    await assert.rejects(
      waitForHiggsfieldResult({
        authHeader: 'Key a:b',
        requestId: 'r',
        timeoutMs: 60_000,
        sleep: async () => {},
      }),
      /content filter/
    );

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ detail: 'Invalid credentials' }), { status: 401 })) as typeof fetch;
    await assert.rejects(
      waitForHiggsfieldResult({
        authHeader: 'Key bad',
        requestId: 'r',
        timeoutMs: 60_000,
        sleep: async () => {},
      }),
      (err: unknown) => err instanceof HiggsfieldApiError && err.status === 401
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
