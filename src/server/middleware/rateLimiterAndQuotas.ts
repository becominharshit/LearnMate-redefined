import type { Request, Response, NextFunction } from 'express';
import {
  StudentUsageLimiter,
  type UsageCategory,
  type UsageDecision,
} from '../usageLimits.ts';
import { usageCategoryForPath } from '../requestGuards.ts';
import {
  authenticateStudent,
  hashForLogs,
  readBearerToken,
  isPublicApiPath,
  type StudentRequest,
  type TokenVerifier,
} from './authAndSecurity.ts';
import {
  DurableCollectionStore,
  getDurableStore,
  type PersistenceBackendMode,
} from '../persistence/durableStore.ts';
import { getAiTelemetryService } from '../services/aiTelemetryService.ts';

export { StudentUsageLimiter, usageCategoryForPath };
export type { UsageCategory, UsageDecision };

export interface DailyTokenBudgetStatus {
  uid: string;
  dateKey: string;
  tokensUsedToday: number;
  dailyTokenCap: number;
  remainingTokens: number;
  requestsInCurrentWindow: number;
  maxRequestsPerMinute: number;
  allowed: boolean;
  backingStore: PersistenceBackendMode;
}

interface PersistedQuotaEntry {
  uid: string;
  dateKey: string;
  tokens: number;
  updatedAt: string;
}

const QUOTA_COLLECTION = 'quota_usage';

/**
 * Durable-backed sliding-window rate limiter + per-user daily AI token budget tracker + IP abuse throttle.
 * Persists daily AI token usage atomically on disk (and optional Firestore) and applies token billing
 * ONLY to genuine AI generation routes (`usageCategoryForPath(method, path) !== undefined`).
 */
export class DistributedRateLimiterAndTokenBudget {
  private readonly usageLimiter: StudentUsageLimiter;
  private readonly store: DurableCollectionStore | null;
  private readonly dailyTokenUsage = new Map<string, { dateKey: string; tokens: number }>();
  private readonly slidingWindowTimestamps = new Map<string, number[]>();
  private readonly ipWindowTimestamps = new Map<string, number[]>();
  private readonly dailyTokenCap: number;
  private readonly maxRequestsPerMinute: number;
  private readonly maxIpRequestsPerMinute: number;

  constructor(options?: {
    dailyTokenCap?: number;
    dailyTokenBudgetPerUser?: number;
    maxRequestsPerMinute?: number;
    maxRequestsPerWindow?: number;
    maxIpRequestsPerMinute?: number;
    windowMs?: number;
    usageLimiter?: StudentUsageLimiter;
    store?: DurableCollectionStore;
    persist?: boolean;
  }) {
    this.dailyTokenCap =
      options?.dailyTokenCap ?? options?.dailyTokenBudgetPerUser ?? 50_000;
    this.maxRequestsPerMinute =
      options?.maxRequestsPerMinute ?? options?.maxRequestsPerWindow ?? 20;
    this.maxIpRequestsPerMinute = options?.maxIpRequestsPerMinute ?? 180;
    this.usageLimiter = options?.usageLimiter ?? new StudentUsageLimiter();
    this.store = options?.store ?? (options?.persist ? getDurableStore() : null);

    // Hydrate today's persisted token counters when backed by a DurableCollectionStore
    if (this.store) {
      const today = this.getTodayKey();
      for (const entry of this.store.list<PersistedQuotaEntry>(QUOTA_COLLECTION)) {
        if (entry.dateKey === today) {
          this.dailyTokenUsage.set(entry.uid, {
            dateKey: entry.dateKey,
            tokens: entry.tokens,
          });
        }
      }
    }
  }

  private getTodayKey(nowMs = Date.now()): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  public getStudentUsageLimiter(): StudentUsageLimiter {
    return this.usageLimiter;
  }

  public checkIpRateLimit(
    clientIp: string,
    nowMs = Date.now()
  ): { allowed: boolean; requestsInWindow: number; retryAfterSeconds?: number } {
    const key = (clientIp || 'unknown').trim();
    const windowStart = nowMs - 60_000;
    const prev = this.ipWindowTimestamps.get(key) || [];
    const active = prev.filter((ts) => ts > windowStart);

    if (active.length >= this.maxIpRequestsPerMinute) {
      const oldest = active[0] || nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
      this.ipWindowTimestamps.set(key, active);
      return {
        allowed: false,
        requestsInWindow: active.length,
        retryAfterSeconds,
      };
    }

    active.push(nowMs);
    this.ipWindowTimestamps.set(key, active);
    return {
      allowed: true,
      requestsInWindow: active.length,
    };
  }

  public checkRateLimit(uid: string, nowMs = Date.now(), customMaxRpm?: number) {
    return this.checkAndRecordSlidingWindow(uid, nowMs, customMaxRpm);
  }

  public consumeTokens(
    uid: string,
    tokensDelta: number,
    nowMs = Date.now(),
    customDailyCap?: number
  ): DailyTokenBudgetStatus {
    const statusBefore = this.getTokenBudgetStatus(uid, nowMs, customDailyCap);
    const effectiveCap = customDailyCap ?? this.dailyTokenCap;
    if (statusBefore.tokensUsedToday + tokensDelta > effectiveCap) {
      return {
        ...statusBefore,
        allowed: false,
      };
    }
    return this.recordTokensUsed(uid, tokensDelta, nowMs, customDailyCap);
  }

  public checkAndRecordSlidingWindow(
    uid: string,
    nowMs = Date.now(),
    customMaxRpm?: number
  ): {
    allowed: boolean;
    requestsInWindow: number;
    retryAfterSeconds?: number;
  } {
    const limit = customMaxRpm ?? this.maxRequestsPerMinute;
    const windowStart = nowMs - 60_000;
    const prev = this.slidingWindowTimestamps.get(uid) || [];
    const active = prev.filter((ts) => ts > windowStart);

    if (active.length >= limit) {
      const oldest = active[0] || nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
      this.slidingWindowTimestamps.set(uid, active);
      return {
        allowed: false,
        requestsInWindow: active.length,
        retryAfterSeconds,
      };
    }

    active.push(nowMs);
    this.slidingWindowTimestamps.set(uid, active);
    return {
      allowed: true,
      requestsInWindow: active.length,
    };
  }

  public recordTokensUsed(
    uid: string,
    tokensDelta: number,
    nowMs = Date.now(),
    customDailyCap?: number
  ): DailyTokenBudgetStatus {
    const dateKey = this.getTodayKey(nowMs);
    const current = this.dailyTokenUsage.get(uid);
    const baseTokens = current && current.dateKey === dateKey ? current.tokens : 0;
    const updatedTokens = Math.max(0, baseTokens + Math.max(0, Math.round(tokensDelta)));
    this.dailyTokenUsage.set(uid, { dateKey, tokens: updatedTokens });
    this.store?.set<PersistedQuotaEntry>(QUOTA_COLLECTION, `${uid}::${dateKey}`, {
      uid,
      dateKey,
      tokens: updatedTokens,
      updatedAt: new Date(nowMs).toISOString(),
    });
    return this.getTokenBudgetStatus(uid, nowMs, customDailyCap);
  }

  public getTokenBudgetStatus(
    uid: string,
    nowMs = Date.now(),
    customDailyCap?: number,
    customMaxRpm?: number
  ): DailyTokenBudgetStatus {
    const dateKey = this.getTodayKey(nowMs);
    const current = this.dailyTokenUsage.get(uid);
    const persisted =
      current && current.dateKey === dateKey
        ? current.tokens
        : this.store?.get<PersistedQuotaEntry>(QUOTA_COLLECTION, `${uid}::${dateKey}`)?.tokens || 0;
    if (persisted > 0 && (!current || current.dateKey !== dateKey)) {
      this.dailyTokenUsage.set(uid, { dateKey, tokens: persisted });
    }
    const tokensUsedToday = persisted;
    const windowStart = nowMs - 60_000;
    const activeWindow = (this.slidingWindowTimestamps.get(uid) || []).filter(
      (ts) => ts > windowStart
    );
    const effectiveCap = customDailyCap ?? this.dailyTokenCap;
    const effectiveRpm = customMaxRpm ?? this.maxRequestsPerMinute;
    const remainingTokens = Math.max(0, effectiveCap - tokensUsedToday);

    return {
      uid,
      dateKey,
      tokensUsedToday,
      dailyTokenCap: effectiveCap,
      remainingTokens,
      requestsInCurrentWindow: activeWindow.length,
      maxRequestsPerMinute: effectiveRpm,
      allowed: tokensUsedToday < effectiveCap && activeWindow.length <= effectiveRpm,
      backingStore: this.store?.getBackendStatus().mode ?? 'durable_disk_store',
    };
  }
}

export function createAuthAndQuotaMiddleware(params: {
  verifyStudentIdToken: TokenVerifier;
  rateLimiter: DistributedRateLimiterAndTokenBudget;
  getTierLimitsForUser?: (uid: string) => { dailyTokenCap: number; maxRequestsPerMinute: number };
}) {
  const { verifyStudentIdToken, rateLimiter, getTierLimitsForUser } = params;
  const studentUsage = rateLimiter.getStudentUsageLimiter();

  return async (req: Request, res: Response, next: NextFunction) => {
    const fullPath = `${req.baseUrl}${req.path}`;

    // 1. Per-IP sliding-window abuse limiter on all /api traffic except health probes
    if (fullPath !== '/api/health' && fullPath !== '/api/readiness') {
      const ipDecision = rateLimiter.checkIpRateLimit(req.ip || req.socket?.remoteAddress || 'unknown');
      if (!ipDecision.allowed) {
        if (ipDecision.retryAfterSeconds) {
          res.set('Retry-After', String(ipDecision.retryAfterSeconds));
        }
        res.status(429).json({
          error: 'Too many requests from this IP address. Please slow down briefly.',
          code: 'ip_rate_limited',
        });
        return;
      }
    }

    if (isPublicApiPath(fullPath)) {
      next();
      return;
    }

    const bearer = readBearerToken(req.get('authorization'));
    let auth = await authenticateStudent(verifyStudentIdToken, bearer);
    if (!auth.ok && process.env.NODE_ENV !== 'production' && !bearer) {
      auth = {
        ok: true,
        student: {
          uid: 'dev-student-local',
          email: 'student@learnmate.local',
          emailVerified: true,
          signInProvider: 'developer',
        },
      };
    }

    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.message, code: auth.code });
      return;
    }

    const studentReq = req as StudentRequest;
    studentReq.student = auth.student;

    // 2. Apply AI quota & token billing ONLY to actual AI generation endpoints
    const category = usageCategoryForPath(req.method, fullPath);
    if (req.method === 'POST' && category !== undefined) {
      const uid = auth.student.uid;
      const tierLimits = getTierLimitsForUser ? getTierLimitsForUser(uid) : undefined;

      // Hard global AI spend-cap circuit breaker
      const spendStatus = getAiTelemetryService().getSpendStatus();
      if (spendStatus.circuitOpen) {
        res.status(503).json({
          error: 'AI generation is temporarily paused due to platform spend-cap protection. Deterministic PYQs & notes remain available.',
          code: 'spend_cap_exceeded',
        });
        return;
      }

      const decision = studentUsage.consume(uid, category);
      if (!decision.allowed) {
        if (decision.retryAfterSeconds) {
          res.set('Retry-After', String(decision.retryAfterSeconds));
        }
        console.log(
          `[Usage] blocked student=${hashForLogs(uid)} route=${fullPath} reason=${decision.code}`
        );
        res.status(429).json({ error: decision.message, code: decision.code });
        return;
      }

      const rpmCheck = rateLimiter.checkAndRecordSlidingWindow(
        uid,
        Date.now(),
        tierLimits?.maxRequestsPerMinute
      );
      if (!rpmCheck.allowed) {
        studentUsage.release(uid, category);
        if (rpmCheck.retryAfterSeconds) {
          res.set('Retry-After', String(rpmCheck.retryAfterSeconds));
        }
        res.status(429).json({
          error: 'Too many AI requests per minute for your active tier. Please wait briefly.',
          code: 'tier_rpm_exceeded',
        });
        return;
      }

      const budget = rateLimiter.getTokenBudgetStatus(
        uid,
        Date.now(),
        tierLimits?.dailyTokenCap,
        tierLimits?.maxRequestsPerMinute
      );
      if (!budget.allowed) {
        studentUsage.release(uid, category);
        res.status(429).json({
          error: 'Daily AI token budget reached for your active plan. Please continue with offline PYQs or upgrade via checkout.',
          code: 'daily_token_budget_exceeded',
        });
        return;
      }

      res.on('finish', () => {
        if (res.statusCode >= 400) {
          studentUsage.release(uid, category);
        } else {
          const measuredDelta = Number(res.locals?.measuredAiTokens || 0);
          const tokenCost =
            measuredDelta > 0
              ? measuredDelta
              : category === 'upload' || category === 'create'
              ? 1200
              : 450;
          rateLimiter.recordTokensUsed(uid, tokenCost, Date.now(), tierLimits?.dailyTokenCap);
        }
      });
    }

    next();
  };
}
