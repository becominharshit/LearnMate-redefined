/**
 * Per-student limits on AI usage: a short burst limit per minute plus daily allowances per
 * feature, so one account (or a leaked token) cannot run up the AI bill. In-memory: counts reset
 * when the server restarts, which is acceptable for a single-instance deployment.
 */
import { createHash } from 'node:crypto';

export type UsageCategory = 'tutor' | 'practice' | 'revise' | 'upload' | 'create';

export const USAGE_CATEGORIES: UsageCategory[] = ['tutor', 'practice', 'revise', 'upload', 'create'];

export const DEFAULT_DAILY_LIMITS: Record<UsageCategory, number> = {
  tutor: 40,
  practice: 6,
  revise: 20,
  upload: 15,
  create: 10,
};

const CATEGORY_LABELS: Record<UsageCategory, string> = {
  tutor: 'AI tutor questions',
  practice: 'practice sets',
  revise: 'revision tools',
  upload: 'uploads and scans',
  create: 'Create tools',
};

export interface UsageDecision {
  allowed: boolean;
  code?: 'rate_limited' | 'daily_limit';
  message?: string;
  retryAfterSeconds?: number;
}

interface StudentUsage {
  day: string;
  counts: Record<UsageCategory, number>;
  recent: number[];
}

/** Calendar day in India, so daily allowances reset at midnight IST. */
export function indiaDayKey(timestampMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestampMs));
}

/** Short, non-reversible id for logs, so logs never contain account ids. */
export function hashForLogs(uid: string): string {
  return createHash('sha256').update(uid).digest('hex').slice(0, 10);
}

function emptyCounts(): Record<UsageCategory, number> {
  return { tutor: 0, practice: 0, revise: 0, upload: 0, create: 0 };
}

/** Reads LIMIT overrides such as DAILY_LIMIT_TUTOR=60 from the environment. */
export function dailyLimitsFromEnv(env: Record<string, string | undefined>): Record<UsageCategory, number> {
  const limits = { ...DEFAULT_DAILY_LIMITS };
  for (const category of USAGE_CATEGORIES) {
    const raw = env[`DAILY_LIMIT_${category.toUpperCase()}`];
    const value = raw === undefined ? NaN : Number(raw);
    if (Number.isInteger(value) && value >= 0) limits[category] = value;
  }
  return limits;
}

export class StudentUsageLimiter {
  private readonly usage = new Map<string, StudentUsage>();
  private readonly dailyLimits: Record<UsageCategory, number>;
  private readonly perMinute: number;
  private readonly now: () => number;

  constructor(opts: {
    dailyLimits?: Record<UsageCategory, number>;
    perMinute?: number;
    now?: () => number;
  } = {}) {
    this.dailyLimits = opts.dailyLimits ?? DEFAULT_DAILY_LIMITS;
    this.perMinute = opts.perMinute ?? 12;
    this.now = opts.now ?? Date.now;
  }

  private entryFor(uid: string, timestamp: number): StudentUsage {
    const day = indiaDayKey(timestamp);
    let entry = this.usage.get(uid);
    if (!entry || entry.day !== day) {
      entry = { day, counts: emptyCounts(), recent: entry?.recent ?? [] };
      this.usage.set(uid, entry);
    }
    entry.recent = entry.recent.filter((t) => timestamp - t < 60_000);
    return entry;
  }

  /** Checks the limits and, when allowed, records one use. */
  consume(uid: string, category?: UsageCategory): UsageDecision {
    const timestamp = this.now();
    const entry = this.entryFor(uid, timestamp);

    if (entry.recent.length >= this.perMinute) {
      const oldest = entry.recent[0];
      return {
        allowed: false,
        code: 'rate_limited',
        message: 'Too many requests at once. Please wait a few seconds and try again.',
        retryAfterSeconds: Math.max(1, Math.ceil((60_000 - (timestamp - oldest)) / 1000)),
      };
    }

    if (category) {
      const limit = this.dailyLimits[category];
      if (entry.counts[category] >= limit) {
        return {
          allowed: false,
          code: 'daily_limit',
          message: `You've used today's limit of ${limit} ${CATEGORY_LABELS[category]}. It resets at midnight.`,
        };
      }
      entry.counts[category] += 1;
    }
    entry.recent.push(timestamp);
    return { allowed: true };
  }

  /** Gives a use back, e.g. when the request failed, so errors don't eat the daily allowance. */
  release(uid: string, category?: UsageCategory): void {
    const entry = this.usage.get(uid);
    if (!entry) return;
    if (category && entry.counts[category] > 0) entry.counts[category] -= 1;
    entry.recent.pop();
  }

  /** Aggregate numbers for the admin usage endpoint (no account ids). */
  snapshot(): { studentsToday: number; usesToday: Record<UsageCategory, number> } {
    const today = indiaDayKey(this.now());
    const usesToday = emptyCounts();
    let studentsToday = 0;
    for (const entry of this.usage.values()) {
      if (entry.day !== today) continue;
      studentsToday += 1;
      for (const category of USAGE_CATEGORIES) usesToday[category] += entry.counts[category];
    }
    return { studentsToday, usesToday };
  }
}
