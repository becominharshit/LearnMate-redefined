import { DurableCollectionStore, getDurableStore } from '../persistence/durableStore.ts';

export type AiProviderName = 'gemini' | 'vertex_ai' | 'anthropic_claude' | 'deterministic_fallback';

export interface AiUsageRecordInput {
  endpoint: string;
  provider: AiProviderName;
  model: string;
  uid?: string;
  promptTokens: number;
  completionTokens: number;
  isMeasured: boolean;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
}

export interface DailyCostBucket {
  dateKey: string;
  requests: number;
  errors: number;
  measuredRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedCostInr: number;
  byProvider: Record<string, { requests: number; tokens: number; costUsd: number }>;
  byEndpoint: Record<string, { requests: number; tokens: number; costUsd: number }>;
  latenciesMs: number[];
}

const TELEMETRY_COLLECTION = 'ai_telemetry_daily';
const USD_TO_INR = 84;

const MODEL_PRICING_PER_1M: Record<string, { inputUsd: number; outputUsd: number }> = {
  'gemini-3.1-flash-lite': { inputUsd: 0.1, outputUsd: 0.4 },
  'gemini-3.8-flash': { inputUsd: 0.15, outputUsd: 0.6 },
  'gemini-3.8-live': { inputUsd: 0.35, outputUsd: 1.5 },
  'gemini-4-argon': { inputUsd: 0.25, outputUsd: 1.0 },
  'claude-haiku-4-5': { inputUsd: 0.8, outputUsd: 4.0 },
  'claude-sonnet-4-5': { inputUsd: 3.0, outputUsd: 15.0 },
  deterministic: { inputUsd: 0, outputUsd: 0 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
  isMeasured: boolean
): number {
  if (!isMeasured && model.includes('deterministic')) return 0;
  const pricing =
    MODEL_PRICING_PER_1M[model] ||
    (model.includes('claude')
      ? MODEL_PRICING_PER_1M['claude-sonnet-4-5']
      : MODEL_PRICING_PER_1M['gemini-3.1-flash-lite']);
  const usd =
    (Math.max(0, promptTokens) / 1_000_000) * pricing.inputUsd +
    (Math.max(0, completionTokens) / 1_000_000) * pricing.outputUsd;
  return Number(usd.toFixed(6));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export class AiTelemetryService {
  private readonly store: DurableCollectionStore;

  constructor(store?: DurableCollectionStore) {
    this.store = store || getDurableStore();
  }

  private getDateKey(nowMs = Date.now()): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  private getMonthPrefix(nowMs = Date.now()): string {
    return new Date(nowMs).toISOString().slice(0, 7);
  }

  public getDailySpendCapUsd(): number {
    const raw = Number(process.env.AI_DAILY_SPEND_CAP_USD || 25);
    return Number.isFinite(raw) && raw > 0 ? raw : 25;
  }

  public getMonthlySpendCapUsd(): number {
    const raw = Number(process.env.AI_MONTHLY_SPEND_CAP_USD || 250);
    return Number.isFinite(raw) && raw > 0 ? raw : 250;
  }

  private getOrCreateBucket(dateKey: string): DailyCostBucket {
    const existing = this.store.get<DailyCostBucket>(TELEMETRY_COLLECTION, dateKey);
    if (existing) return existing;
    return {
      dateKey,
      requests: 0,
      errors: 0,
      measuredRequests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      estimatedCostInr: 0,
      byProvider: {},
      byEndpoint: {},
      latenciesMs: [],
    };
  }

  public recordUsage(input: AiUsageRecordInput, nowMs = Date.now()): DailyCostBucket {
    const dateKey = this.getDateKey(nowMs);
    const bucket = this.getOrCreateBucket(dateKey);

    const promptTokens = Math.max(0, Math.round(input.promptTokens));
    const completionTokens = Math.max(0, Math.round(input.completionTokens));
    const totalTokens = promptTokens + completionTokens;
    const costUsd = estimateCostUsd(input.model, promptTokens, completionTokens, input.isMeasured);

    bucket.requests += 1;
    if (!input.success) bucket.errors += 1;
    if (input.isMeasured) bucket.measuredRequests += 1;
    bucket.promptTokens += promptTokens;
    bucket.completionTokens += completionTokens;
    bucket.totalTokens += totalTokens;
    bucket.estimatedCostUsd = Number((bucket.estimatedCostUsd + costUsd).toFixed(6));
    bucket.estimatedCostInr = Number((bucket.estimatedCostUsd * USD_TO_INR).toFixed(2));

    const prov = (bucket.byProvider[input.provider] ||= { requests: 0, tokens: 0, costUsd: 0 });
    prov.requests += 1;
    prov.tokens += totalTokens;
    prov.costUsd = Number((prov.costUsd + costUsd).toFixed(6));

    const ep = (bucket.byEndpoint[input.endpoint] ||= { requests: 0, tokens: 0, costUsd: 0 });
    ep.requests += 1;
    ep.tokens += totalTokens;
    ep.costUsd = Number((ep.costUsd + costUsd).toFixed(6));

    bucket.latenciesMs.push(Math.max(0, Math.round(input.latencyMs)));
    if (bucket.latenciesMs.length > 500) {
      bucket.latenciesMs = bucket.latenciesMs.slice(-500);
    }

    this.store.set(TELEMETRY_COLLECTION, dateKey, bucket);
    return bucket;
  }

  public getSpendStatus(nowMs = Date.now()): {
    todayUsd: number;
    monthUsd: number;
    dailyCapUsd: number;
    monthlyCapUsd: number;
    circuitOpen: boolean;
    reason?: string;
  } {
    const dateKey = this.getDateKey(nowMs);
    const monthPrefix = this.getMonthPrefix(nowMs);
    const todayBucket = this.getOrCreateBucket(dateKey);
    const dailyCapUsd = this.getDailySpendCapUsd();
    const monthlyCapUsd = this.getMonthlySpendCapUsd();

    let monthUsd = 0;
    for (const [k, b] of this.store.getAll<DailyCostBucket>(TELEMETRY_COLLECTION)) {
      if (k.startsWith(monthPrefix)) {
        monthUsd += b.estimatedCostUsd || 0;
      }
    }
    monthUsd = Number(monthUsd.toFixed(6));

    if (todayBucket.estimatedCostUsd >= dailyCapUsd) {
      return {
        todayUsd: todayBucket.estimatedCostUsd,
        monthUsd,
        dailyCapUsd,
        monthlyCapUsd,
        circuitOpen: true,
        reason: `Daily AI spend cap ($${dailyCapUsd.toFixed(2)}) reached.`,
      };
    }
    if (monthUsd >= monthlyCapUsd) {
      return {
        todayUsd: todayBucket.estimatedCostUsd,
        monthUsd,
        dailyCapUsd,
        monthlyCapUsd,
        circuitOpen: true,
        reason: `Monthly AI spend cap ($${monthlyCapUsd.toFixed(2)}) reached.`,
      };
    }

    return {
      todayUsd: todayBucket.estimatedCostUsd,
      monthUsd,
      dailyCapUsd,
      monthlyCapUsd,
      circuitOpen: false,
    };
  }

  public getAdminSummary(nowMs = Date.now()) {
    const dateKey = this.getDateKey(nowMs);
    const today = this.getOrCreateBucket(dateKey);
    const sortedLat = [...today.latenciesMs].sort((a, b) => a - b);
    const spend = this.getSpendStatus(nowMs);

    return {
      dateKey,
      spend,
      requestsToday: today.requests,
      errorsToday: today.errors,
      errorRatePercent:
        today.requests > 0 ? Number(((today.errors / today.requests) * 100).toFixed(2)) : 0,
      measuredUsagePercent:
        today.requests > 0
          ? Number(((today.measuredRequests / today.requests) * 100).toFixed(1))
          : 0,
      tokensToday: {
        prompt: today.promptTokens,
        completion: today.completionTokens,
        total: today.totalTokens,
      },
      estimatedCostTodayUsd: today.estimatedCostUsd,
      estimatedCostTodayInr: today.estimatedCostInr,
      latencyMs: {
        p50: percentile(sortedLat, 50),
        p95: percentile(sortedLat, 95),
      },
      byProvider: today.byProvider,
      byEndpoint: today.byEndpoint,
    };
  }
}

let defaultTelemetryInstance: AiTelemetryService | null = null;

export function getAiTelemetryService(): AiTelemetryService {
  if (!defaultTelemetryInstance) {
    defaultTelemetryInstance = new AiTelemetryService();
  }
  return defaultTelemetryInstance;
}
