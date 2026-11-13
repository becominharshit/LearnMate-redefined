import { Router } from 'express';
import {
  COMMERCIAL_TIERS,
  retrieveTopRagChunks,
  SemanticAiResponseCache,
  ShareSnapshotRegistry,
  BackgroundJobRegistry,
  BITSAT_AND_VITEEE_PYQ_QUESTIONS,
  buildTenantScopedCacheContext,
  type CommercialSubscriptionTierId,
  type SupportedBillingCurrency,
  type ShareSnapshotKind,
  type BackgroundJobKind,
  type SharedStudySnapshot,
  type BackgroundJobRecord,
} from '../../utils/commercialScaleEngine.ts';
import { OFFICIAL_PYQ_QUESTIONS, getPyqCorpusCoverageAudit } from '../../utils/pyqCorpusEngine.ts';
import {
  createAdminTokenGuardMiddleware,
  type StudentRequest,
  type TokenVerifier,
} from '../middleware/authAndSecurity.ts';
import type { DistributedRateLimiterAndTokenBudget } from '../middleware/rateLimiterAndQuotas.ts';
import type { StudyPage } from '../../types/study.ts';
import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';
import { EntitlementService, getEntitlementService } from '../services/entitlementService.ts';

const SHARES_COLLECTION = 'shared_snapshots';
const JOBS_COLLECTION = 'background_jobs';

export const globalSemanticCache = new SemanticAiResponseCache(600);
export const globalShareRegistry = new ShareSnapshotRegistry();
export const globalJobRegistry = new BackgroundJobRegistry();

let registriesHydrated = false;
function ensureRegistriesHydrated(store: DurableCollectionStore) {
  if (registriesHydrated) return;
  registriesHydrated = true;
  const savedShares = store.list<SharedStudySnapshot>(SHARES_COLLECTION);
  if (savedShares.length > 0) {
    globalShareRegistry.hydrateFromRecords(savedShares);
  }
  const savedJobs = store.list<BackgroundJobRecord>(JOBS_COLLECTION);
  if (savedJobs.length > 0) {
    globalJobRegistry.hydrateFromRecords(savedJobs);
  }
}

export function createCommercialAndScaleRouter(params: {
  rateLimiter: DistributedRateLimiterAndTokenBudget;
  store?: DurableCollectionStore;
  entitlementService?: EntitlementService;
  verifyStudentIdToken?: TokenVerifier;
  getCostTelemetrySummary?: () => unknown;
}): Router {
  const { rateLimiter } = params;
  const store = params.store || getDurableStore();
  const entitlements = params.entitlementService || new EntitlementService(store);
  const adminGuard = createAdminTokenGuardMiddleware({
    alwaysRequire: true,
    verifyStudentIdToken: params.verifyStudentIdToken,
  });

  if (!params.store) {
    ensureRegistriesHydrated(store);
  }

  const shares = params.store
    ? (() => {
        const reg = new ShareSnapshotRegistry();
        reg.hydrateFromRecords(store.list<SharedStudySnapshot>(SHARES_COLLECTION));
        return reg;
      })()
    : globalShareRegistry;

  const jobs = params.store
    ? (() => {
        const reg = new BackgroundJobRegistry();
        reg.hydrateFromRecords(store.list<BackgroundJobRecord>(JOBS_COLLECTION));
        return reg;
      })()
    : globalJobRegistry;

  const router = Router();

  // Fail closed in production when durable persistence (Postgres/Firestore/mounted volume) is absent
  router.use((_req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      const durability = store.isProductionDurable();
      if (!durability.durable) {
        res.status(503).json({
          error: durability.reason,
          code: 'persistence_not_durable',
          errorCode: 'persistence_not_durable',
        });
        return;
      }
    }
    next();
  });

  function getCorpusSummary() {
    const coverage = getPyqCorpusCoverageAudit();
    const jeeMainCount = OFFICIAL_PYQ_QUESTIONS.filter((q) => q.exam === 'jee_main').length;
    const jeeAdvCount = OFFICIAL_PYQ_QUESTIONS.filter((q) => q.exam === 'jee_advanced').length;
    const bitsatCount = BITSAT_AND_VITEEE_PYQ_QUESTIONS.filter((q) => q.exam === 'bitsat').length;
    const viteeeCount = BITSAT_AND_VITEEE_PYQ_QUESTIONS.filter((q) => q.exam === 'viteee').length;
    return {
      totalVerifiedOfficialQuestions: coverage.officialVerifiedQuestionsCount,
      totalOriginalEditorialQuestions: coverage.originalEditorialQuestionsCount + bitsatCount + viteeeCount,
      incompleteHistoricalPapersCount: coverage.incompleteHistoricalPapersCount,
      byExam: {
        jee_main: jeeMainCount,
        jee_advanced: jeeAdvCount,
        bitsat: bitsatCount,
        viteee: viteeeCount,
      },
      storageMode: 'Verified Provenance Registry + Durable Server Store',
    };
  }

  // 1. GET /api/commercial/tiers — Returns active entitlement (defaults to free_explorer) & tier quota
  router.get('/commercial/tiers', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { entitlement, tier } = entitlements.getEffectiveTierSpec(uid);
    const quota = rateLimiter.getTokenBudgetStatus(uid, Date.now(), tier.dailyTokenCap, tier.maxRequestsPerMinute);

    res.json({
      activeTierId: tier.id,
      activeTier: tier,
      entitlement: {
        status: entitlement.status,
        provider: entitlement.provider,
        currentPeriodEnd: entitlement.currentPeriodEnd,
        cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      },
      billingConfigured: {
        razorpay: entitlements.isPaymentProviderConfigured('razorpay'),
        stripe: entitlements.isPaymentProviderConfigured('stripe'),
      },
      tiers: Object.values(COMMERCIAL_TIERS),
      quota: {
        ...quota,
        dailyTokenCap: tier.dailyTokenCap,
        remainingTokens: Math.max(0, tier.dailyTokenCap - quota.tokensUsedToday),
        maxRequestsPerMinute: tier.maxRequestsPerMinute,
      },
      corpusSummary: getCorpusSummary(),
      semanticCache: globalSemanticCache.getStats(),
    });
  });

  // 2. POST /api/commercial/select-tier — Self-service may ONLY downgrade to free_explorer (403 on paid tiers)
  router.post('/commercial/select-tier', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { tierId } = (req.body || {}) as { tierId?: CommercialSubscriptionTierId };

    const result = entitlements.requestSelfServiceTierChange(uid, tierId as CommercialSubscriptionTierId);
    if (!result.ok) {
      res.status(result.status).json({
        error: result.error,
        code: result.code,
        requiresVerifiedCheckout: true,
      });
      return;
    }

    const tier = COMMERCIAL_TIERS[result.entitlement.tierId];
    const quota = rateLimiter.getTokenBudgetStatus(uid, Date.now(), tier.dailyTokenCap, tier.maxRequestsPerMinute);

    res.json({
      updated: true,
      activeTierId: tier.id,
      activeTier: tier,
      entitlement: result.entitlement,
      quota,
    });
  });

  // 2b. POST /api/commercial/checkout/create — Initiates Razorpay/Stripe checkout or returns 503 if unconfigured
  router.post('/commercial/checkout/create', async (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const {
      tierId = 'pro_scholar',
      provider = 'razorpay',
      currency = 'INR',
    } = (req.body || {}) as {
      tierId?: CommercialSubscriptionTierId;
      provider?: 'razorpay' | 'stripe';
      currency?: SupportedBillingCurrency;
    };

    const returnBaseUrl =
      req.get('origin') ||
      (req.get('host') ? `${req.protocol}://${req.get('host')}` : undefined);

    const result = await entitlements.createCheckoutSession(
      uid,
      tierId,
      provider,
      currency,
      returnBaseUrl
    );
    if (!result.ok) {
      res.status(result.status).json({
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.json({
      created: true,
      session: result.session,
    });
  });

  // 2b-ii. GET /api/commercial/invoices — Owner-scoped invoice ledger
  router.get('/commercial/invoices', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    res.json({
      invoices: entitlements.listInvoicesForUser(uid),
    });
  });

  // 2b-iii. POST /api/commercial/waitlist — Persists Early Access waitlist signups when billing is unprovisioned
  router.post('/commercial/waitlist', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const {
      email = studentReq.student?.email || '',
      tierId = 'pro_scholar',
      targetExam = 'jee_main',
    } = (req.body || {}) as {
      email?: string;
      tierId?: CommercialSubscriptionTierId;
      targetExam?: string;
    };

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const entryId = `${uid}::${tierId}`;
    const record = {
      entryId,
      uid,
      email: normalizedEmail || studentReq.student?.email || '',
      tierId,
      targetExam: String(targetExam || 'jee_main').slice(0, 40),
      joinedAt: new Date().toISOString(),
      status: 'waitlisted',
    };
    store.set('commercial_waitlist', entryId, record);

    res.json({
      joined: true,
      entry: record,
      message: 'You are on the Pro Scholar Early Access waitlist.',
    });
  });

  // 2c. Signed Billing Webhooks (Razorpay & Stripe) with HMAC-SHA256 & replay idempotency
  router.post('/commercial/webhook/:provider', (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'razorpay' && provider !== 'stripe') {
      res.status(400).json({ error: 'Unsupported webhook provider.' });
      return;
    }

    const signatureHeader = String(
      req.get('x-razorpay-signature') ||
        req.get('stripe-signature') ||
        req.get('x-webhook-signature') ||
        ''
    );
    const rawBody =
      (req as StudentRequest & { rawBody?: string }).rawBody ?? JSON.stringify(req.body || {});

    const outcome = entitlements.processSignedWebhook({
      provider,
      rawBody,
      signatureHeader,
    });

    if (!outcome.ok) {
      res.status(outcome.status).json({
        error: outcome.error,
        code: outcome.code,
      });
      return;
    }

    res.json({
      received: true,
      eventId: outcome.eventId,
      duplicate: outcome.duplicate,
      entitlement: outcome.entitlement,
    });
  });

  // 3. POST /api/rag/retrieve — Server-Side Smart Chunking & Hybrid Keyword-Semantic RAG
  router.post('/rag/retrieve', (req, res) => {
    try {
      const studentReq = req as StudentRequest;
      const uid = studentReq.student?.uid || 'dev-student-local';
      const {
        documentId = 'doc-active',
        pages = [],
        query = '',
        topK = 5,
      } = (req.body || {}) as {
        documentId?: string;
        pages?: StudyPage[];
        query?: string;
        topK?: number;
      };

      const scopedDocId = `${uid}::${String(documentId).slice(0, 120)}`;
      const result = retrieveTopRagChunks({
        documentId: scopedDocId,
        pages: Array.isArray(pages) ? pages : [],
        query: String(query || ''),
        topK: Math.min(12, Math.max(1, Number(topK) || 5)),
      });

      res.json({
        ...result,
        documentId,
        tenantUid: uid,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to run Hybrid RAG retrieval.',
      });
    }
  });

  // 4. Tenant-Scoped Semantic Cache endpoints
  router.get('/cache/stats', adminGuard, (_req, res) => {
    res.json(globalSemanticCache.getStats());
  });

  router.post('/cache/lookup', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const {
      query = '',
      documentId = 'general',
      docVersion = 'v1',
      modelKey = 'default',
    } = (req.body || {}) as {
      query?: string;
      documentId?: string;
      docVersion?: string;
      modelKey?: string;
    };

    const scopedContext = buildTenantScopedCacheContext({
      tenantId: uid,
      documentId,
      docVersion,
      modelKey,
    });
    const hit = globalSemanticCache.get(String(query), scopedContext);
    res.json({
      hit: hit !== null,
      payload: hit,
      scopedContext,
      stats: globalSemanticCache.getStats(),
    });
  });

  router.post('/cache/invalidate', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { documentId } = (req.body || {}) as { documentId?: string };
    const prefix = documentId
      ? `t=${uid.toLowerCase()}|d=${documentId.toLowerCase()}`
      : `t=${uid.toLowerCase()}|`;
    const invalidatedCount = globalSemanticCache.invalidateContextPrefix(prefix);
    res.json({ invalidated: true, count: invalidatedCount });
  });

  // 5. Cryptographic, Sanitized, Revocable Share Snapshots
  router.post('/share/create', (req, res) => {
    try {
      const studentReq = req as StudentRequest;
      const uid = studentReq.student?.uid || 'dev-student-local';
      const {
        ownerName = 'LearnMate Scholar',
        kind = 'desmos_graph',
        title = 'Shared Study Snapshot',
        subtitle = 'Read-only shared LearnMate study artifact',
        payload = {},
        ttlHours = 24 * 30,
      } = (req.body || {}) as {
        ownerName?: string;
        kind?: ShareSnapshotKind;
        title?: string;
        subtitle?: string;
        payload?: Record<string, unknown>;
        ttlHours?: number;
      };

      const snap = shares.createSnapshot({
        ownerUid: uid,
        ownerName,
        kind,
        title,
        subtitle,
        payload: payload && typeof payload === 'object' ? payload : {},
        ttlHours,
      });
      store.set(SHARES_COLLECTION, snap.shareId, snap);

      const { ownerUid: _hiddenUid, ...publicSnap } = snap;
      res.json({
        created: true,
        shareId: snap.shareId,
        shareUrl: `/?share=${encodeURIComponent(snap.shareId)}`,
        snapshot: publicSnap,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create read-only share snapshot.',
      });
    }
  });

  router.get('/share/:shareId', (req, res) => {
    const snap = shares.getSnapshot(req.params.shareId);
    if (!snap) {
      res.status(404).json({ error: 'Shared snapshot not found, revoked, or expired.' });
      return;
    }
    store.set(SHARES_COLLECTION, snap.shareId, snap);
    const { ownerUid: _hiddenUid, ...publicSnap } = snap;
    res.json(publicSnap);
  });

  router.post('/share/:shareId/revoke', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const outcome = shares.revokeSnapshot(req.params.shareId, uid);
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }
    store.set(SHARES_COLLECTION, outcome.snapshot.shareId, outcome.snapshot);
    res.json({ revoked: true, shareId: outcome.snapshot.shareId, revokedAt: outcome.snapshot.revokedAt });
  });

  // 6. Owner-Isolated Durable Background Job Tracker
  router.get('/jobs', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    res.json({ jobs: jobs.getJobsForUser(uid) });
  });

  router.post('/jobs/start', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const {
      kind = 'rag_index',
      title = 'Indexing Study Material',
      stepLabel = 'Chunking pages for Hybrid RAG…',
      idempotencyKey,
    } = (req.body || {}) as {
      kind?: BackgroundJobKind;
      title?: string;
      stepLabel?: string;
      idempotencyKey?: string;
    };

    const job = jobs.startJob({ uid, kind, title, stepLabel, idempotencyKey });
    store.set(JOBS_COLLECTION, job.jobId, job);
    res.json(job);
  });

  router.get('/jobs/:jobId', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const existing = jobs.getJob(req.params.jobId);
    if (!existing) {
      res.status(404).json({ error: 'Background job not found.' });
      return;
    }
    if (existing.uid !== uid) {
      res.status(403).json({
        error: 'Access denied: you do not own this background job.',
        code: 'forbidden_cross_tenant_job',
      });
      return;
    }
    res.json(existing);
  });

  router.post('/jobs/:jobId', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const existing = jobs.getJob(req.params.jobId);
    if (!existing) {
      res.status(404).json({ error: 'Background job not found.' });
      return;
    }
    if (existing.uid !== uid) {
      res.status(403).json({
        error: 'Access denied: you do not own this background job.',
        code: 'forbidden_cross_tenant_job',
      });
      return;
    }

    const updated = jobs.updateJob(req.params.jobId, req.body || {}, uid);
    if (!updated) {
      res.status(404).json({ error: 'Background job not found.' });
      return;
    }
    store.set(JOBS_COLLECTION, updated.jobId, updated);
    res.json(updated);
  });

  // 7. Admin-Only Routes (/api/admin/health, /api/admin/grant-tier, /api/admin/costs)
  router.post('/admin/grant-tier', adminGuard, (req, res) => {
    const studentReq = req as StudentRequest;
    const {
      targetUid,
      tierId,
      reason = 'Verified administrative grant',
      days = 30,
    } = (req.body || {}) as {
      targetUid?: string;
      tierId?: CommercialSubscriptionTierId;
      reason?: string;
      days?: number;
    };

    if (!targetUid || !tierId || !COMMERCIAL_TIERS[tierId]) {
      res.status(400).json({ error: 'Valid targetUid and tierId are required.' });
      return;
    }

    const adminActor = studentReq.student?.uid || 'x-admin-token';
    const record = entitlements.grantTierAsAdmin({
      adminActor,
      targetUid,
      tierId,
      reason,
      days,
    });
    res.json({ granted: true, entitlement: record });
  });

  router.get('/admin/costs', adminGuard, (_req, res) => {
    res.json(
      params.getCostTelemetrySummary
        ? params.getCostTelemetrySummary()
        : { note: 'Telemetry summary provider not attached' }
    );
  });

  router.get('/admin/health', adminGuard, (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { entitlement, tier } = entitlements.getEffectiveTierSpec(uid);
    const quota = rateLimiter.getTokenBudgetStatus(uid, Date.now(), tier.dailyTokenCap, tier.maxRequestsPerMinute);
    const cacheStats = globalSemanticCache.getStats();
    const persistenceStatus = store.getBackendStatus();

    res.json({
      timestamp: new Date().toISOString(),
      architecture: {
        serverMode: `Modular Express + ${persistenceStatus.mode} + Tenant-Scoped LRU Cache`,
        ragEngine: 'Smart Overlapping Page Chunker (BM25 + Math Symbol Affinity)',
        pwaStatus: 'Service Worker + Offline IndexedDB + Web App Manifest Active',
        persistenceBackend: persistenceStatus.mode,
      },
      subscription: {
        activeTierId: tier.id,
        activeTierName: tier.name,
        status: entitlement.status,
        dailyTokenCap: tier.dailyTokenCap,
        tokensUsedToday: quota.tokensUsedToday,
        remainingTokens: Math.max(0, tier.dailyTokenCap - quota.tokensUsedToday),
        maxRequestsPerMinute: tier.maxRequestsPerMinute,
        backingStore: persistenceStatus.mode,
      },
      semanticCache: cacheStats,
      corpusSummary: getCorpusSummary(),
      sharedArtifactsCount: shares.listSnapshots().length,
      activeJobsCount: jobs.getJobsForUser(uid).length,
      costs: params.getCostTelemetrySummary ? params.getCostTelemetrySummary() : undefined,
    });
  });

  return router;
}
