import { Router } from 'express';
import {
  COMMERCIAL_TIERS,
  retrieveTopRagChunks,
  SemanticAiResponseCache,
  ShareSnapshotRegistry,
  BackgroundJobRegistry,
  BITSAT_AND_VITEEE_PYQ_QUESTIONS,
  type CommercialSubscriptionTierId,
  type ShareSnapshotKind,
  type BackgroundJobKind,
} from '../../utils/commercialScaleEngine.ts';
import { OFFICIAL_PYQ_QUESTIONS } from '../../utils/pyqCorpusEngine.ts';
import type { StudentRequest } from '../middleware/authAndSecurity.ts';
import type { DistributedRateLimiterAndTokenBudget } from '../middleware/rateLimiterAndQuotas.ts';
import type { StudyPage } from '../../types/study.ts';

export const globalSemanticCache = new SemanticAiResponseCache(600);
export const globalShareRegistry = new ShareSnapshotRegistry();
export const globalJobRegistry = new BackgroundJobRegistry();
const userSubscriptionTiers = new Map<string, CommercialSubscriptionTierId>();

export function createCommercialAndScaleRouter(params: {
  rateLimiter: DistributedRateLimiterAndTokenBudget;
}): Router {
  const { rateLimiter } = params;
  const router = Router();

  // 1. GET /api/commercial/tiers — Returns commercial tiers & student's active tier/quota
  router.get('/commercial/tiers', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const currentTierId = userSubscriptionTiers.get(uid) || 'pro_scholar';
    const currentTier = COMMERCIAL_TIERS[currentTierId];
    const quota = rateLimiter.getTokenBudgetStatus(uid);

    res.json({
      activeTierId: currentTierId,
      activeTier: currentTier,
      tiers: Object.values(COMMERCIAL_TIERS),
      quota: {
        ...quota,
        dailyTokenCap: currentTier.dailyTokenCap,
        remainingTokens: Math.max(0, currentTier.dailyTokenCap - quota.tokensUsedToday),
        maxRequestsPerMinute: currentTier.maxRequestsPerMinute,
      },
    });
  });

  // 2. POST /api/commercial/select-tier — Switches subscription tier (Free Explorer, Pro Scholar, Institute)
  router.post('/commercial/select-tier', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const { tierId } = (req.body || {}) as { tierId?: CommercialSubscriptionTierId };

    if (!tierId || !COMMERCIAL_TIERS[tierId]) {
      res.status(400).json({ error: 'Invalid subscription tier ID.' });
      return;
    }

    userSubscriptionTiers.set(uid, tierId);
    const tier = COMMERCIAL_TIERS[tierId];
    const quota = rateLimiter.getTokenBudgetStatus(uid);

    res.json({
      updated: true,
      activeTierId: tierId,
      activeTier: tier,
      quota: {
        ...quota,
        dailyTokenCap: tier.dailyTokenCap,
        remainingTokens: Math.max(0, tier.dailyTokenCap - quota.tokensUsedToday),
        maxRequestsPerMinute: tier.maxRequestsPerMinute,
      },
    });
  });

  // 3. POST /api/rag/retrieve — Server-Side Smart Chunking & Hybrid Keyword-Semantic RAG
  router.post('/rag/retrieve', (req, res) => {
    try {
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

      const result = retrieveTopRagChunks({
        documentId,
        pages: Array.isArray(pages) ? pages : [],
        query: String(query || ''),
        topK: Math.min(12, Math.max(1, Number(topK) || 5)),
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to run Hybrid RAG retrieval.',
      });
    }
  });

  // 4. GET /api/cache/stats & POST /api/cache/lookup — Semantic AI Response Cache
  router.get('/cache/stats', (_req, res) => {
    res.json(globalSemanticCache.getStats());
  });

  router.post('/cache/lookup', (req, res) => {
    const { query = '', contextId = 'global' } = (req.body || {}) as {
      query?: string;
      contextId?: string;
    };
    const hit = globalSemanticCache.get(String(query), String(contextId));
    res.json({
      hit: hit !== null,
      payload: hit,
      stats: globalSemanticCache.getStats(),
    });
  });

  // 5. POST /api/share/create & GET /api/share/:shareId — Read-Only Share Links for Notes, Formulas & Graphs
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
      } = (req.body || {}) as {
        ownerName?: string;
        kind?: ShareSnapshotKind;
        title?: string;
        subtitle?: string;
        payload?: Record<string, unknown>;
      };

      const snap = globalShareRegistry.createSnapshot({
        ownerUid: uid,
        ownerName,
        kind,
        title,
        subtitle,
        payload: payload && typeof payload === 'object' ? payload : {},
      });

      res.json({
        created: true,
        shareId: snap.shareId,
        shareUrl: `/?share=${encodeURIComponent(snap.shareId)}`,
        snapshot: snap,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create read-only share snapshot.',
      });
    }
  });

  router.get('/share/:shareId', (req, res) => {
    const snap = globalShareRegistry.getSnapshot(req.params.shareId);
    if (!snap) {
      res.status(404).json({ error: 'Shared snapshot not found or expired.' });
      return;
    }
    res.json(snap);
  });

  // 6. GET /api/jobs & POST /api/jobs/start & POST /api/jobs/:jobId — Background Job Tracker
  router.get('/jobs', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    res.json({ jobs: globalJobRegistry.getJobsForUser(uid) });
  });

  router.post('/jobs/start', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const {
      kind = 'rag_index',
      title = 'Indexing Study Material',
      stepLabel = 'Chunking pages for Hybrid RAG…',
    } = (req.body || {}) as {
      kind?: BackgroundJobKind;
      title?: string;
      stepLabel?: string;
    };

    const job = globalJobRegistry.startJob({ uid, kind, title, stepLabel });
    res.json(job);
  });

  router.post('/jobs/:jobId', (req, res) => {
    const updated = globalJobRegistry.updateJob(req.params.jobId, req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Background job not found.' });
      return;
    }
    res.json(updated);
  });

  // 7. GET /api/admin/health — Clean Admin Commercial & System Health Console Telemetry
  router.get('/admin/health', (req, res) => {
    const studentReq = req as StudentRequest;
    const uid = studentReq.student?.uid || 'dev-student-local';
    const currentTierId = userSubscriptionTiers.get(uid) || 'pro_scholar';
    const currentTier = COMMERCIAL_TIERS[currentTierId];
    const quota = rateLimiter.getTokenBudgetStatus(uid);
    const cacheStats = globalSemanticCache.getStats();

    const jeeMainCount = OFFICIAL_PYQ_QUESTIONS.filter((q) => q.exam === 'jee_main').length;
    const jeeAdvCount = OFFICIAL_PYQ_QUESTIONS.filter((q) => q.exam === 'jee_advanced').length;
    const bitsatCount = BITSAT_AND_VITEEE_PYQ_QUESTIONS.filter((q) => q.exam === 'bitsat').length;
    const viteeeCount = BITSAT_AND_VITEEE_PYQ_QUESTIONS.filter((q) => q.exam === 'viteee').length;

    res.json({
      timestamp: new Date().toISOString(),
      architecture: {
        serverMode: 'Modular Express + Firestore Hybrid Sync + In-Memory LRU Cache',
        ragEngine: 'Smart Overlapping Page Chunker (BM25 + Math Symbol Affinity)',
        pwaStatus: 'Service Worker + Offline IndexedDB + Web App Manifest Active',
      },
      subscription: {
        activeTierId: currentTierId,
        activeTierName: currentTier.name,
        dailyTokenCap: currentTier.dailyTokenCap,
        tokensUsedToday: quota.tokensUsedToday,
        remainingTokens: Math.max(0, currentTier.dailyTokenCap - quota.tokensUsedToday),
        maxRequestsPerMinute: currentTier.maxRequestsPerMinute,
        backingStore: 'firestore_or_redis_ready',
      },
      semanticCache: cacheStats,
      corpusSummary: {
        totalVerifiedQuestions: jeeMainCount + jeeAdvCount + bitsatCount + viteeeCount,
        byExam: {
          jee_main: jeeMainCount,
          jee_advanced: jeeAdvCount,
          bitsat: bitsatCount,
          viteee: viteeeCount,
        },
        storageMode: 'Hybrid Firestore PYQ Collection + Local Verified Fallback',
      },
      sharedArtifactsCount: globalShareRegistry.listSnapshots().length,
      activeJobsCount: globalJobRegistry.getJobsForUser(uid).length,
    });
  });

  return router;
}
