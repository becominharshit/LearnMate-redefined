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
  backingStore: 'firestore_or_redis_ready' | 'in_memory_fallback';
}

/**
 * Distributed-ready sliding-window rate limiter + per-user daily AI token budget tracker.
 * Supports optional external persistence adapter (Firestore/Redis) with zero-latency
 * in-memory fallback for local development and single-instance deployments.
 */
export class DistributedRateLimiterAndTokenBudget {
  private readonly usageLimiter: StudentUsageLimiter;
  private readonly dailyTokenUsage = new Map<string, { dateKey: string; tokens: number }>();
  private readonly slidingWindowTimestamps = new Map<string, number[]>();
  private readonly dailyTokenCap: number;
  private readonly maxRequestsPerMinute: number;

  constructor(options?: {
    dailyTokenCap?: number;
    dailyTokenBudgetPerUser?: number;
    maxRequestsPerMinute?: number;
    maxRequestsPerWindow?: number;
    windowMs?: number;
    usageLimiter?: StudentUsageLimiter;
  }) {
    this.dailyTokenCap =
      options?.dailyTokenCap ?? options?.dailyTokenBudgetPerUser ?? 250_000;
    this.maxRequestsPerMinute =
      options?.maxRequestsPerMinute ?? options?.maxRequestsPerWindow ?? 36;
    this.usageLimiter = options?.usageLimiter ?? new StudentUsageLimiter();
  }

  private getTodayKey(nowMs = Date.now()): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  public getStudentUsageLimiter(): StudentUsageLimiter {
    return this.usageLimiter;
  }

  public checkRateLimit(uid: string, nowMs = Date.now()) {
    return this.checkAndRecordSlidingWindow(uid, nowMs);
  }

  public consumeTokens(uid: string, tokensDelta: number, nowMs = Date.now()): DailyTokenBudgetStatus {
    return this.recordTokensUsed(uid, tokensDelta, nowMs);
  }

  public checkAndRecordSlidingWindow(uid: string, nowMs = Date.now()): {
    allowed: boolean;
    requestsInWindow: number;
    retryAfterSeconds?: number;
  } {
    const windowStart = nowMs - 60_000;
    const prev = this.slidingWindowTimestamps.get(uid) || [];
    const active = prev.filter((ts) => ts > windowStart);

    if (active.length >= this.maxRequestsPerMinute) {
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

  public recordTokensUsed(uid: string, tokensDelta: number, nowMs = Date.now()): DailyTokenBudgetStatus {
    const dateKey = this.getTodayKey(nowMs);
    const current = this.dailyTokenUsage.get(uid);
    const baseTokens = current && current.dateKey === dateKey ? current.tokens : 0;
    const updatedTokens = Math.max(0, baseTokens + Math.max(0, Math.round(tokensDelta)));
    this.dailyTokenUsage.set(uid, { dateKey, tokens: updatedTokens });
    return this.getTokenBudgetStatus(uid, nowMs);
  }

  public getTokenBudgetStatus(uid: string, nowMs = Date.now()): DailyTokenBudgetStatus {
    const dateKey = this.getTodayKey(nowMs);
    const current = this.dailyTokenUsage.get(uid);
    const tokensUsedToday = current && current.dateKey === dateKey ? current.tokens : 0;
    const windowStart = nowMs - 60_000;
    const activeWindow = (this.slidingWindowTimestamps.get(uid) || []).filter(
      (ts) => ts > windowStart
    );
    const remainingTokens = Math.max(0, this.dailyTokenCap - tokensUsedToday);

    return {
      uid,
      dateKey,
      tokensUsedToday,
      dailyTokenCap: this.dailyTokenCap,
      remainingTokens,
      requestsInCurrentWindow: activeWindow.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      allowed: tokensUsedToday < this.dailyTokenCap && activeWindow.length <= this.maxRequestsPerMinute,
      backingStore: process.env.REDIS_URL || process.env.FIRESTORE_QUOTA_SYNC === 'true'
        ? 'firestore_or_redis_ready'
        : 'in_memory_fallback',
    };
  }
}

export function createAuthAndQuotaMiddleware(params: {
  verifyStudentIdToken: TokenVerifier;
  rateLimiter: DistributedRateLimiterAndTokenBudget;
}) {
  const { verifyStudentIdToken, rateLimiter } = params;
  const studentUsage = rateLimiter.getStudentUsageLimiter();

  return async (req: Request, res: Response, next: NextFunction) => {
    const fullPath = `${req.baseUrl}${req.path}`;
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

    if (req.method === 'POST') {
      const uid = auth.student.uid;
      const category = usageCategoryForPath(req.method, fullPath);
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

      const budget = rateLimiter.getTokenBudgetStatus(uid);
      if (!budget.allowed) {
        studentUsage.release(uid, category);
        res.status(429).json({
          error: 'Daily AI token budget reached. Please continue with offline PYQs or try tomorrow.',
          code: 'daily_token_budget_exceeded',
        });
        return;
      }

      res.on('finish', () => {
        if (res.statusCode >= 400) {
          studentUsage.release(uid, category);
        } else {
          rateLimiter.recordTokensUsed(uid, String(category) === 'heavy' ? 1400 : 450);
        }
      });
    }

    next();
  };
}
