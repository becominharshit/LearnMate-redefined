import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { DurableCollectionStore } from './persistence/durableStore';
import { EntitlementService, verifyStripeSignatureHeader, verifyWebhookHmac } from './services/entitlementService';
import { createStorageRouter, validateMagicBytes } from './routes/storageRoutes';
import { createCommercialAndScaleRouter } from './routes/commercialAndScaleRoutes';
import { createPyqAndCbtRouter } from './routes/pyqAndCbtRoutes';
import { createAiTutorRouter } from './routes/aiTutorRoutes';
import { StudyMediaService } from './services/studyMediaService';
import {
  DistributedRateLimiterAndTokenBudget,
  createAuthAndQuotaMiddleware,
} from './middleware/rateLimiterAndQuotas';
import { createAdminTokenGuardMiddleware, type TokenVerifier } from './middleware/authAndSecurity';
import { AiTelemetryService } from './services/aiTelemetryService';
import { TenantRagService, validateRagCitations } from './services/ragService';
import {
  YoutubeLectureJobStore,
  validateYoutubeDurationWithin12Hours,
} from './services/youtubeService';
import { VoiceSessionStateMachine } from './ws/voiceLiveServer';
import {
  BackgroundJobRegistry,
  SemanticAiResponseCache,
  ShareSnapshotRegistry,
  buildTenantScopedCacheContext,
} from '../utils/commercialScaleEngine';

function createTempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learnmate-w2w3-test-'));
  return {
    dir,
    store: new DurableCollectionStore(dir),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const mockVerifier: TokenVerifier = async (token: string) => {
  if (token === 'token-alice') {
    return {
      uid: 'uid-alice',
      email: 'alice@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    };
  }
  if (token === 'token-bob') {
    return {
      uid: 'uid-bob',
      email: 'bob@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    };
  }
  if (token === 'token-admin') {
    return {
      uid: 'uid-admin',
      email: 'admin@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
      admin: true,
    };
  }
  throw new Error('invalid token');
};

async function startTestApp(opts: {
  store: DurableCollectionStore;
  dailyCap?: number;
  maxRpm?: number;
}) {
  const entitlements = new EntitlementService(opts.store);
  const rateLimiter = new DistributedRateLimiterAndTokenBudget({
    dailyTokenCap: opts.dailyCap ?? 50_000,
    maxRequestsPerMinute: opts.maxRpm ?? 20,
    store: opts.store,
  });

  const app = express();
  app.use(
    express.json({
      limit: '2mb',
      verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
        if (req.originalUrl.includes('/api/commercial/webhook/')) {
          req.rawBody = buf.toString('utf8');
        }
      },
    })
  );

  app.use(
    '/api',
    createAuthAndQuotaMiddleware({
      verifyStudentIdToken: mockVerifier,
      rateLimiter,
      getTierLimitsForUser: (uid) => {
        const { tier } = entitlements.getEffectiveTierSpec(uid);
        return { dailyTokenCap: tier.dailyTokenCap, maxRequestsPerMinute: tier.maxRequestsPerMinute };
      },
    })
  );

  app.use('/api/cbt', createPyqAndCbtRouter());
  app.use('/api/tutor', createAiTutorRouter());
  app.use('/api/storage', createStorageRouter({ store: opts.store, signingSecret: 'test-storage-secret' }));
  app.use(
    '/api',
    createCommercialAndScaleRouter({
      rateLimiter,
      store: opts.store,
      entitlementService: entitlements,
      verifyStudentIdToken: mockVerifier,
    })
  );
  // Minimal mock AI endpoint to test AI-only token billing & spend cap
  app.post('/api/study/ask', (_req, res) => {
    res.locals.measuredAiTokens = 400;
    res.json({ ok: true, answer: 'Mocked answer' });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  return {
    baseUrl,
    rateLimiter,
    entitlements,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('Wave 2: Entitlements fail closed to free_explorer, block client paid upgrades, and handle signed idempotent webhooks', async () => {
  const { store, cleanup } = createTempStore();
  const prevTestMode = process.env.PAYMENT_TEST_MODE;
  const prevRzSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const prevAdminToken = process.env.ADMIN_TOKEN;
  delete process.env.PAYMENT_TEST_MODE;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_12345';
  process.env.ADMIN_TOKEN = 'super-secret-admin-token';

  const srv = await startTestApp({ store });
  try {
    // 1. Default tier is free_explorer
    const tiersRes = await fetch(`${srv.baseUrl}/api/commercial/tiers`, {
      headers: { Authorization: 'Bearer token-alice' },
    });
    assert.equal(tiersRes.status, 200);
    const tiersJson = (await tiersRes.json()) as { activeTierId: string };
    assert.equal(tiersJson.activeTierId, 'free_explorer');

    // 2. Client self-service paid tier escalation returns 403
    const escalRes = await fetch(`${srv.baseUrl}/api/commercial/select-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ tierId: 'pro_scholar' }),
    });
    assert.equal(escalRes.status, 403);
    const escalJson = (await escalRes.json()) as { code: string };
    assert.equal(escalJson.code, 'payment_required_for_paid_tier');

    // 3. Checkout creation fails cleanly with 503 when merchant keys aren't configured
    const checkoutRes = await fetch(`${srv.baseUrl}/api/commercial/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ tierId: 'pro_scholar', provider: 'razorpay' }),
    });
    assert.equal(checkoutRes.status, 503);

    // 4. Forged webhook signature returns 401
    const upgradePayload = JSON.stringify({
      eventId: 'evt_pay_001',
      eventType: 'subscription.activated',
      uid: 'uid-alice',
      tierId: 'pro_scholar',
      subscriptionId: 'sub_001',
    });
    const forgedRes = await fetch(`${srv.baseUrl}/api/commercial/webhook/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'deadbeef',
      },
      body: upgradePayload,
    });
    assert.equal(forgedRes.status, 401);

    // 5. Valid HMAC webhook upgrades user and replays idempotently
    const validSig = crypto
      .createHmac('sha256', 'whsec_test_12345')
      .update(upgradePayload)
      .digest('hex');
    const hookRes = await fetch(`${srv.baseUrl}/api/commercial/webhook/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSig,
      },
      body: upgradePayload,
    });
    assert.equal(hookRes.status, 200);
    const hookJson = (await hookRes.json()) as {
      duplicate: boolean;
      entitlement: { tierId: string; status: string };
    };
    assert.equal(hookJson.duplicate, false);
    assert.equal(hookJson.entitlement.tierId, 'pro_scholar');

    const replayRes = await fetch(`${srv.baseUrl}/api/commercial/webhook/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSig,
      },
      body: upgradePayload,
    });
    assert.equal(replayRes.status, 200);
    const replayJson = (await replayRes.json()) as { duplicate: boolean };
    assert.equal(replayJson.duplicate, true);

    // 6. Refund webhook revokes entitlement back to free_explorer
    const refundPayload = JSON.stringify({
      eventId: 'evt_ref_002',
      eventType: 'charge.refunded',
      uid: 'uid-alice',
    });
    const refundSig = crypto
      .createHmac('sha256', 'whsec_test_12345')
      .update(refundPayload)
      .digest('hex');
    await fetch(`${srv.baseUrl}/api/commercial/webhook/razorpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': refundSig,
      },
      body: refundPayload,
    });
    const afterRefundTiers = await fetch(`${srv.baseUrl}/api/commercial/tiers`, {
      headers: { Authorization: 'Bearer token-alice' },
    });
    const afterRefundJson = (await afterRefundTiers.json()) as { activeTierId: string };
    assert.equal(afterRefundJson.activeTierId, 'free_explorer');

    // 7. Admin endpoints reject regular users (403) and accept valid x-admin-token
    const nonAdminHealth = await fetch(`${srv.baseUrl}/api/admin/health`, {
      headers: { Authorization: 'Bearer token-alice' },
    });
    assert.equal(nonAdminHealth.status, 403);

    const adminGrantRes = await fetch(`${srv.baseUrl}/api/admin/grant-tier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': 'super-secret-admin-token',
      },
      body: JSON.stringify({ targetUid: 'uid-bob', tierId: 'institute', days: 14 }),
    });
    assert.equal(adminGrantRes.status, 200);
    const grantJson = (await adminGrantRes.json()) as { entitlement: { tierId: string } };
    assert.equal(grantJson.entitlement.tierId, 'institute');

    assert.equal(verifyWebhookHmac('abc', 'sha256=' + crypto.createHmac('sha256', 'sec').update('abc').digest('hex'), 'sec'), true);
    assert.equal(verifyWebhookHmac('abc', 'wrong', 'sec'), false);
  } finally {
    await srv.close();
    cleanup();
    if (prevTestMode === undefined) delete process.env.PAYMENT_TEST_MODE;
    else process.env.PAYMENT_TEST_MODE = prevTestMode;
    if (prevRzSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = prevRzSecret;
    if (prevAdminToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = prevAdminToken;
  }
});

test('Wave 2: Admin guard accepts verified Firebase admin custom claim via timing-safe verification', async () => {
  const guard = createAdminTokenGuardMiddleware({
    alwaysRequire: true,
    verifyStudentIdToken: mockVerifier,
  });
  let statusCode = 200;
  let nextCalled = false;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as express.Response;

  await guard(
    { get: (h: string) => (h.toLowerCase() === 'authorization' ? 'Bearer token-admin' : '') } as unknown as express.Request,
    res,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
  assert.equal(statusCode, 200);
});

test('Wave 2: Storage enforces MIME allowlist, magic bytes, HMAC URL signature, and strict cross-tenant isolation', async () => {
  const { store, cleanup } = createTempStore();
  const srv = await startTestApp({ store });
  try {
    // 1. Disallow SVG MIME
    const svgRes = await fetch(`${srv.baseUrl}/api/storage/signed-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ fileName: 'xss.svg', mimeType: 'image/svg+xml', sizeBytes: 100 }),
    });
    assert.equal(svgRes.status, 415);

    // 2. Request signed upload for PDF as Alice
    const signRes = await fetch(`${srv.baseUrl}/api/storage/signed-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ fileName: 'physics.pdf', mimeType: 'application/pdf', sizeBytes: 512 }),
    });
    assert.equal(signRes.status, 200);
    const signJson = (await signRes.json()) as {
      blobId: string;
      uploadUrl: string;
      downloadUrl: string;
      storageProvider: string;
    };
    assert.equal(signJson.storageProvider, 'server_durable_disk_store');

    // 3. Disguised PNG bytes uploaded as application/pdf -> 415 magic_byte_mismatch
    const pngFakePdf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64');
    const badMagicRes = await fetch(`${srv.baseUrl}${signJson.uploadUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ base64Data: pngFakePdf }),
    });
    assert.equal(badMagicRes.status, 415);

    // 4. Tampered HMAC signature -> 403
    const tamperedUrl = signJson.uploadUrl.replace(/sig=[^&]+/, 'sig=tampered0000');
    const validPdfBase64 = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n').toString('base64');
    const tamperedRes = await fetch(`${srv.baseUrl}${tamperedUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ base64Data: validPdfBase64 }),
    });
    assert.equal(tamperedRes.status, 403);

    // 5. Valid PDF bytes + valid sig succeeds
    const okUpload = await fetch(`${srv.baseUrl}${signJson.uploadUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ base64Data: validPdfBase64 }),
    });
    assert.equal(okUpload.status, 200);

    // 6. Bob tries to GET, overwrite, or DELETE Alice's blob -> 403 cross-tenant
    const bobGet = await fetch(`${srv.baseUrl}${signJson.downloadUrl}`, {
      headers: { Authorization: 'Bearer token-bob' },
    });
    assert.equal(bobGet.status, 403);

    const bobDelete = await fetch(`${srv.baseUrl}${signJson.downloadUrl}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-bob' },
    });
    assert.equal(bobDelete.status, 403);

    const bobAssets = await fetch(`${srv.baseUrl}/api/storage/assets`, {
      headers: { Authorization: 'Bearer token-bob' },
    });
    const bobAssetsJson = (await bobAssets.json()) as { assets: Array<{ blobId: string }> };
    assert.equal(bobAssetsJson.assets.length, 0);

    // Verify magic bytes helper directly
    assert.equal(validateMagicBytes('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).valid, true);
    assert.equal(validateMagicBytes('image/jpeg', Buffer.from([0x00, 0x01, 0x02])).valid, false);
  } finally {
    await srv.close();
    cleanup();
  }
});

test('Wave 2: Jobs, Semantic Cache, and Share Snapshots enforce tenant isolation, XSS sanitization, and owner revocation', async () => {
  const { store, cleanup } = createTempStore();
  const srv = await startTestApp({ store });
  try {
    // Jobs ownership + cross-tenant 403 + idempotency + retries
    const jobRes = await fetch(`${srv.baseUrl}/api/jobs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ kind: 'rag_index', title: 'Alice PDF', idempotencyKey: 'idem-1' }),
    });
    const jobJson = (await jobRes.json()) as { jobId: string; uid: string };
    assert.equal(jobJson.uid, 'uid-alice');

    const dupJobRes = await fetch(`${srv.baseUrl}/api/jobs/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ kind: 'rag_index', title: 'Alice PDF', idempotencyKey: 'idem-1' }),
    });
    const dupJobJson = (await dupJobRes.json()) as { jobId: string };
    assert.equal(dupJobJson.jobId, jobJson.jobId);

    const bobGetJob = await fetch(`${srv.baseUrl}/api/jobs/${jobJson.jobId}`, {
      headers: { Authorization: 'Bearer token-bob' },
    });
    assert.equal(bobGetJob.status, 403);

    // Retry bound directly on BackgroundJobRegistry
    const reg = new BackgroundJobRegistry();
    const j = reg.startJob({ uid: 'u1', kind: 'youtube_marathon', title: 'YT', maxRetries: 2 });
    reg.updateJob(j.jobId, { status: 'failed', errorMessage: 'transient' }, 'u1');
    const r1 = reg.updateJob(j.jobId, { status: 'running' }, 'u1');
    assert.equal(r1?.retryCount, 1);
    reg.updateJob(j.jobId, { status: 'failed' }, 'u1');
    const r2 = reg.updateJob(j.jobId, { status: 'running' }, 'u1');
    assert.equal(r2?.retryCount, 2);
    reg.updateJob(j.jobId, { status: 'failed' }, 'u1');
    const r3 = reg.updateJob(j.jobId, { status: 'running' }, 'u1');
    assert.equal(r3?.status, 'failed');
    assert.equal(r3?.errorMessage, 'Max retry budget exhausted.');

    // Tenant-scoped cache isolation
    const cache = new SemanticAiResponseCache();
    const ctxAlice = buildTenantScopedCacheContext({ tenantId: 'uid-alice', documentId: 'doc-1' });
    const ctxBob = buildTenantScopedCacheContext({ tenantId: 'uid-bob', documentId: 'doc-1' });
    cache.set('What is Gauss law?', ctxAlice, { secret: 'Alice Notes' });
    assert.ok(cache.get('What is Gauss law?', ctxAlice));
    assert.equal(cache.get('What is Gauss law?', ctxBob), null);

    // Share snapshots: sanitization, hidden ownerUid, non-owner 403 on revoke, owner revoke -> 404
    const shareRes = await fetch(`${srv.baseUrl}/api/share/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({
        title: '<script>alert(1)</script>Electrostatics Notes',
        payload: {
          email: 'alice@example.com',
          token: 'secret-token',
          uid: 'uid-alice',
          formula: 'E = kq/r^2',
          snippet: '<img src=x onerror=alert(1)>Gauss',
        },
      }),
    });
    const shareJson = (await shareRes.json()) as {
      shareId: string;
      snapshot: Record<string, unknown> & { payload: Record<string, unknown>; title: string };
    };
    assert.ok(!('ownerUid' in shareJson.snapshot));
    assert.ok(!shareJson.snapshot.title.includes('<script>'));
    assert.equal('email' in shareJson.snapshot.payload, false);
    assert.equal('token' in shareJson.snapshot.payload, false);
    assert.equal('uid' in shareJson.snapshot.payload, false);
    assert.ok(!String(shareJson.snapshot.payload.snippet).includes('onerror='));

    const bobRevoke = await fetch(`${srv.baseUrl}/api/share/${shareJson.shareId}/revoke`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-bob' },
    });
    assert.equal(bobRevoke.status, 403);

    const aliceRevoke = await fetch(`${srv.baseUrl}/api/share/${shareJson.shareId}/revoke`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-alice' },
    });
    assert.equal(aliceRevoke.status, 200);

    const afterRevoke = await fetch(`${srv.baseUrl}/api/share/${shareJson.shareId}`, {
      headers: { Authorization: 'Bearer token-alice' },
    });
    assert.equal(afterRevoke.status, 404);
  } finally {
    await srv.close();
    cleanup();
  }
});

test('Wave 3: Quota bills ONLY AI endpoints and persists across limiter restarts', async () => {
  const { store, cleanup } = createTempStore();
  const srv = await startTestApp({ store });
  try {
    // Non-AI endpoint (/api/cbt/grade) consumes ZERO AI tokens
    const gradeRes = await fetch(`${srv.baseUrl}/api/cbt/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ responses: [] }),
    });
    assert.equal(gradeRes.status, 200);
    assert.equal(srv.rateLimiter.getTokenBudgetStatus('uid-alice').tokensUsedToday, 0);

    // AI endpoint (/api/study/ask) bills measuredAiTokens (400)
    const askRes = await fetch(`${srv.baseUrl}/api/study/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-alice',
      },
      body: JSON.stringify({ question: 'Explain Faraday law' }),
    });
    assert.equal(askRes.status, 200);
    // Allow res.on('finish') callback tick to flush
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(srv.rateLimiter.getTokenBudgetStatus('uid-alice').tokensUsedToday, 400);

    // Simulate server restart by constructing a new DistributedRateLimiterAndTokenBudget reading the same store
    const restartedLimiter = new DistributedRateLimiterAndTokenBudget({ store });
    assert.equal(restartedLimiter.getTokenBudgetStatus('uid-alice').tokensUsedToday, 400);
  } finally {
    await srv.close();
    cleanup();
  }
});

test('Wave 3: AiTelemetry spend-cap breaker, TenantRag isolation, YouTube 12h/ownership, and VoiceSessionStateMachine', () => {
  const { store, cleanup } = createTempStore();
  const prevCap = process.env.AI_DAILY_SPEND_CAP_USD;
  process.env.AI_DAILY_SPEND_CAP_USD = '0.01';
  try {
    // 1. Spend-cap circuit breaker opens cleanly when cost crosses threshold
    const telemetry = new AiTelemetryService(store);
    assert.equal(telemetry.getSpendStatus().circuitOpen, false);
    telemetry.recordUsage({
      endpoint: '/api/study/ask',
      provider: 'anthropic_claude',
      model: 'claude-sonnet-4-5',
      promptTokens: 2000,
      completionTokens: 1000,
      isMeasured: true,
      latencyMs: 320,
      success: true,
    });
    assert.equal(telemetry.getSpendStatus().circuitOpen, true);

    // 2. TenantRagService cross-tenant isolation & citation check
    const rag = new TenantRagService(store);
    rag.indexStudentDocument({
      ownerUid: 'uid-alice',
      documentId: 'electrostatics-ch1',
      pages: [{ pageNumber: 1, title: 'Gauss Law', content: 'Electric flux equals enclosed charge over epsilon zero.' }],
    });
    const bobRetrieval = rag.retrieveForStudent({
      ownerUid: 'uid-bob',
      documentId: 'electrostatics-ch1',
      query: 'Gauss Law',
    });
    assert.equal(bobRetrieval.totalChunksIndexed, 0);
    assert.equal(validateRagCitations([1, 2, 99], [1, 2, 3]).allCitationsValid, false);
    assert.equal(validateRagCitations([1, 2], [1, 2, 3]).allCitationsValid, true);

    // 3. YouTube 12h validator & job ownership
    assert.equal(validateYoutubeDurationWithin12Hours(12 * 3600).allowed, true);
    assert.equal(validateYoutubeDurationWithin12Hours(12 * 3600 + 1).allowed, false);
    const ytStore = new YoutubeLectureJobStore(store);
    const ytJob = ytStore.createJob('uid-alice', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Physics');
    assert.equal(ytStore.getJobForOwner(ytJob.jobId, 'uid-alice').ok, true);
    const bobYt = ytStore.getJobForOwner(ytJob.jobId, 'uid-bob');
    assert.equal(bobYt.ok, false);
    if (!bobYt.ok) assert.equal(bobYt.status, 403);

    // 4. VoiceSessionStateMachine turn & token caps
    const sm = new VoiceSessionStateMachine(1000, 2);
    assert.equal(sm.canStartSetup(), true);
    sm.state = 'LIVE_CONNECTED';
    assert.equal(sm.canStartSetup(), false);
    assert.equal(sm.canAcceptTurn(400).allowed, true);
    sm.recordTurn(400);
    assert.equal(sm.canAcceptTurn(400).allowed, true);
    sm.recordTurn(400);
    assert.equal(sm.canAcceptTurn(400).allowed, false); // turn cap reached
  } finally {
    cleanup();
    if (prevCap === undefined) delete process.env.AI_DAILY_SPEND_CAP_USD;
    else process.env.AI_DAILY_SPEND_CAP_USD = prevCap;
  }
});

test('Workstream B: Production fails closed without durable DB/volume and rejects missing STORAGE_SIGNING_SECRET', async () => {
  const { dir, store, cleanup } = createTempStore();
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDbUrl = process.env.DATABASE_URL;
  const prevAllowDisk = process.env.ALLOW_PERSISTENT_DISK_IN_PROD;
  const prevDataDir = process.env.LEARNMATE_DATA_DIR;
  const prevStorageSecret = process.env.STORAGE_SIGNING_SECRET;
  const prevTestMode = process.env.PAYMENT_TEST_MODE;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ALLOW_PERSISTENT_DISK_IN_PROD;
    delete process.env.LEARNMATE_DATA_DIR;
    delete process.env.STORAGE_SIGNING_SECRET;
    process.env.PAYMENT_TEST_MODE = 'true';

    // Ephemeral /tmp store in production without Postgres or persistent volume must report not durable
    const durability = store.isProductionDurable();
    assert.equal(durability.durable, false);

    // Storage router fails closed without STORAGE_SIGNING_SECRET in production
    const prodApp = express();
    prodApp.use(express.json());
    prodApp.use('/api', createAuthAndQuotaMiddleware({
      verifyStudentIdToken: mockVerifier,
      rateLimiter: new DistributedRateLimiterAndTokenBudget({ store }),
    }));
    prodApp.use('/api/storage', createStorageRouter({ store }));
    prodApp.use('/api', createCommercialAndScaleRouter({
      rateLimiter: new DistributedRateLimiterAndTokenBudget({ store }),
      store,
      verifyStudentIdToken: mockVerifier,
    }));

    const prodServer = http.createServer(prodApp);
    await new Promise<void>((resolve) => prodServer.listen(0, '127.0.0.1', () => resolve()));
    const addr = prodServer.address();
    const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    try {
      const storageRes = await fetch(`${baseUrl}/api/storage/signed-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-alice' },
        body: JSON.stringify({ fileName: 'notes.pdf', mimeType: 'application/pdf', sizeBytes: 128 }),
      });
      assert.equal(storageRes.status, 503);
      const storageJson = (await storageRes.json()) as { code: string };
      assert.equal(storageJson.code, 'persistence_not_durable');

      const commercialRes = await fetch(`${baseUrl}/api/commercial/tiers`, {
        headers: { Authorization: 'Bearer token-alice' },
      });
      assert.equal(commercialRes.status, 503);
      const commercialJson = (await commercialRes.json()) as { code: string };
      assert.equal(commercialJson.code, 'persistence_not_durable');

      // Once durable volume is allowed, storage still fails closed if STORAGE_SIGNING_SECRET is missing
      process.env.ALLOW_PERSISTENT_DISK_IN_PROD = 'true';
      process.env.LEARNMATE_DATA_DIR = dir;
      const missingSecretRes = await fetch(`${baseUrl}/api/storage/signed-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-alice' },
        body: JSON.stringify({ fileName: 'notes.pdf', mimeType: 'application/pdf', sizeBytes: 128 }),
      });
      assert.equal(missingSecretRes.status, 503);
      const missingSecretJson = (await missingSecretRes.json()) as { code: string };
      assert.equal(missingSecretJson.code, 'storage_signing_not_configured');

      // EntitlementService must also disable PAYMENT_TEST_MODE in production even with disk allowed
      const ent = new EntitlementService(store);
      assert.equal(ent.isPaymentProviderConfigured('razorpay'), false);
      const checkout = await ent.createCheckoutSession('uid-alice', 'pro_scholar', 'razorpay', 'USD');
      assert.equal(checkout.ok, false);
      if (!checkout.ok) assert.equal(checkout.status, 503);
    } finally {
      await new Promise<void>((resolve) => prodServer.close(() => resolve()));
    }
  } finally {
    cleanup();
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;
    if (prevAllowDisk === undefined) delete process.env.ALLOW_PERSISTENT_DISK_IN_PROD;
    else process.env.ALLOW_PERSISTENT_DISK_IN_PROD = prevAllowDisk;
    if (prevDataDir === undefined) delete process.env.LEARNMATE_DATA_DIR;
    else process.env.LEARNMATE_DATA_DIR = prevDataDir;
    if (prevStorageSecret === undefined) delete process.env.STORAGE_SIGNING_SECRET;
    else process.env.STORAGE_SIGNING_SECRET = prevStorageSecret;
    if (prevTestMode === undefined) delete process.env.PAYMENT_TEST_MODE;
    else process.env.PAYMENT_TEST_MODE = prevTestMode;
  }
});

test('Workstream B: Stripe signature verifies t=,v1= over t.rawBody, rejects expired replays, and records owner-scoped billing invoices', async () => {
  const { store, cleanup } = createTempStore();
  const prevStripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_stripe_live_test';
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  const nowSec = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify({
    eventId: 'evt_stripe_101',
    eventType: 'invoice.paid',
    uid: 'uid-alice',
    tierId: 'pro_scholar',
    subscriptionId: 'sub_stripe_101',
    amountMinor: 1900,
    currency: 'USD',
  });
  const validSig = crypto.createHmac('sha256', secret).update(`${nowSec}.${rawBody}`).digest('hex');
  const staleTs = nowSec - 900;
  const staleSig = crypto.createHmac('sha256', secret).update(`${staleTs}.${rawBody}`).digest('hex');

  assert.equal(verifyStripeSignatureHeader(rawBody, `t=${nowSec},v1=${validSig}`, secret, 300, nowSec).valid, true);
  const expiredCheck = verifyStripeSignatureHeader(rawBody, `t=${staleTs},v1=${staleSig}`, secret, 300, nowSec);
  assert.equal(expiredCheck.valid, false);
  assert.equal(expiredCheck.reason, 'stripe_webhook_timestamp_expired');

  const srv = await startTestApp({ store });
  try {
    // Expired replay signature rejected with 401
    const staleHook = await fetch(`${srv.baseUrl}/api/commercial/webhook/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': `t=${staleTs},v1=${staleSig}`,
      },
      body: rawBody,
    });
    assert.equal(staleHook.status, 401);

    // Valid Stripe signature activates entitlement and creates an owner-scoped invoice
    const okHook = await fetch(`${srv.baseUrl}/api/commercial/webhook/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': `t=${nowSec},v1=${validSig}`,
      },
      body: rawBody,
    });
    assert.equal(okHook.status, 200);

    const aliceInvoices = await fetch(`${srv.baseUrl}/api/commercial/invoices`, {
      headers: { Authorization: 'Bearer token-alice' },
    });
    assert.equal(aliceInvoices.status, 200);
    const aliceJson = (await aliceInvoices.json()) as {
      invoices: Array<{ uid: string; provider: string; currency: string; amount: number; status: string }>;
    };
    assert.equal(aliceJson.invoices.length, 1);
    assert.equal(aliceJson.invoices[0].provider, 'stripe');
    assert.equal(aliceJson.invoices[0].currency, 'USD');
    assert.equal(typeof aliceJson.invoices[0].amount, 'number');
    assert.equal(aliceJson.invoices[0].amount > 0, true);
    assert.equal(aliceJson.invoices[0].status, 'paid');

    // Bob sees 0 invoices
    const bobInvoices = await fetch(`${srv.baseUrl}/api/commercial/invoices`, {
      headers: { Authorization: 'Bearer token-bob' },
    });
    const bobJson = (await bobInvoices.json()) as { invoices: unknown[] };
    assert.equal(bobJson.invoices.length, 0);
  } finally {
    await srv.close();
    cleanup();
    if (prevStripeWebhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevStripeWebhook;
  }
});

test('Workstream B: /api/tutor/ocr-doubt returns honest 400/503 error instead of fabricating rotational cylinder fallback', async () => {
  const { store, cleanup } = createTempStore();
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevApiKey = process.env.API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.API_KEY;

  const srv = await startTestApp({ store });
  try {
    // 1. Empty payload -> 400
    const emptyRes = await fetch(`${srv.baseUrl}/api/tutor/ocr-doubt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-alice' },
      body: JSON.stringify({}),
    });
    assert.equal(emptyRes.status, 400);

    // 2. Image uploaded without GEMINI_API_KEY and without rawTextHint -> 503 ocr_unavailable_or_unreadable (no fake cylinder)
    const imgOnlyRes = await fetch(`${srv.baseUrl}/api/tutor/ocr-doubt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-alice' },
      body: JSON.stringify({
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      }),
    });
    assert.equal(imgOnlyRes.status, 503);
    const imgJson = (await imgOnlyRes.json()) as { errorCode?: string; extractedLatexProblem?: string };
    assert.equal(imgJson.errorCode, 'ocr_unavailable_or_unreadable');
    assert.equal(imgJson.extractedLatexProblem, undefined);
  } finally {
    await srv.close();
    cleanup();
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    if (prevApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApiKey;
  }
});

test('Workstream B: StudyMediaService video job listing/cancellation and DurableCollectionStore multi-collection account purge enforce ownership', () => {
  const { dir, store, cleanup } = createTempStore();
  try {
    const media = new StudyMediaService(store);
    media.saveVideoJob({
      jobId: 'vj-alice-1',
      ownerUid: 'uid-alice',
      topic: 'Gauss Law',
      mode: 'text_to_video',
      aspectRatio: '16:9',
      status: 'queued',
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    });
    media.saveVideoJob({
      jobId: 'vj-bob-1',
      ownerUid: 'uid-bob',
      topic: 'Torque',
      mode: 'text_to_video',
      aspectRatio: '16:9',
      status: 'processing',
      createdAt: '2026-11-12T10:01:00.000Z',
      updatedAt: '2026-11-12T10:01:00.000Z',
    });

    assert.equal(media.listVideoJobsForOwner('uid-alice').length, 1);
    const bobCancelAlice = media.cancelVideoJobForOwner('vj-alice-1', 'uid-bob');
    assert.equal(bobCancelAlice.ok, false);
    if (!bobCancelAlice.ok) assert.equal(bobCancelAlice.status, 403);

    const aliceCancel = media.cancelVideoJobForOwner('vj-alice-1', 'uid-alice');
    assert.equal(aliceCancel.ok, true);
    if (aliceCancel.ok) assert.equal(aliceCancel.job.status, 'cancelled');

    // Account purge checks across store, blobs, RAG, shares, and jobs
    const rag = new TenantRagService(store);
    rag.indexStudentDocument({
      ownerUid: 'uid-alice',
      documentId: 'doc-purge',
      pages: [{ pageNumber: 1, title: 'Wave', content: 'Superposition principle in waves.' }],
    });
    const shareReg = new ShareSnapshotRegistry();
    shareReg.createSnapshot({
      ownerUid: 'uid-alice',
      ownerName: 'Alice',
      kind: 'formula_sheet',
      title: 'Alice Snapshot',
      payload: { formula: 'v = f * lambda' },
    });
    const jobReg = new BackgroundJobRegistry();
    jobReg.startJob({ uid: 'uid-alice', kind: 'rag_index', title: 'Alice Job' });
    jobReg.startJob({ uid: 'uid-bob', kind: 'rag_index', title: 'Bob Job' });

    const aliceBlobDir = path.join(dir, 'blobs', 'uid-alice');
    fs.mkdirSync(aliceBlobDir, { recursive: true });
    fs.writeFileSync(path.join(aliceBlobDir, 'sample.pdf'), '%PDF-1.7');

    store.set('quota_usage', 'uid-alice::2026-11-12', { tokens: 1200 });
    store.set('quota_usage', 'uid-bob::2026-11-12', { tokens: 500 });

    assert.equal(store.deleteByPrefix('quota_usage', 'uid-alice::'), 1);
    assert.equal(store.deleteWhere<{ ownerUid?: string }>('study_video_jobs', (_k, v) => v?.ownerUid === 'uid-alice'), 1);
    assert.equal(rag.deleteAllForOwner('uid-alice') >= 1, true);
    assert.equal(shareReg.deleteSnapshotsForOwner('uid-alice'), 1);
    assert.equal(jobReg.deleteJobsForUser('uid-alice'), 1);
    assert.equal(store.deleteOwnerBlobDirectory('uid-alice'), true);

    assert.equal(media.listVideoJobsForOwner('uid-bob').length, 1);
    assert.equal(jobReg.getJobsForUser('uid-bob').length, 1);
    assert.ok(store.get('quota_usage', 'uid-bob::2026-11-12'));
  } finally {
    cleanup();
  }
});

