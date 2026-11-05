/**
 * Centralized Stability, Rate-Limit Protection, YouTube Relevance Ranking,
 * and Real-Time Voice Transcript Assembly Engine.
 */

export type GeminiErrorCategory =
  | 'temporarily_busy'
  | 'quota_exhausted'
  | 'auth_config_error'
  | 'generation_failed';

export interface ClassifiedGeminiError {
  category: GeminiErrorCategory;
  retryable: boolean;
  userMessage: string;
  retryAfterMs?: number;
  statusCode?: number;
  rawReason: string;
}

/**
 * Extracts Retry-After milliseconds from an error object or message if provided by the server.
 */
export function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error) return undefined;

  const errObj = error as Record<string, unknown>;
  // Check headers if available on error response
  const headers = (errObj.headers ||
    (errObj.response as Record<string, unknown> | undefined)?.headers) as
    | Record<string, string | undefined>
    | { get?: (name: string) => string | null }
    | undefined;

  let retryHeader: string | null | undefined;
  if (headers) {
    if (typeof (headers as { get?: (name: string) => string | null }).get === 'function') {
      retryHeader = (headers as { get: (name: string) => string | null }).get('retry-after');
    } else {
      const rec = headers as Record<string, string | undefined>;
      retryHeader = rec['retry-after'] || rec['Retry-After'];
    }
  }

  if (retryHeader) {
    const seconds = Number(retryHeader);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return Math.min(30_000, Math.round(seconds * 1000));
    }
  }

  const msg = error instanceof Error ? error.message : String(error);
  // Check Google RPC retryDelay format e.g. "retryDelay":"3s" or "Please retry in 4.5s"
  const matchSec = msg.match(/(?:retryDelay["':\s]+|retry in\s+)(\d+(?:\.\d+)?)s/i);
  if (matchSec) {
    const secs = parseFloat(matchSec[1]);
    if (secs > 0) {
      return Math.min(30_000, Math.round(secs * 1000));
    }
  }

  return undefined;
}

/**
 * Classifies a Gemini API error into temporary rate limit, daily quota exhaustion,
 * non-retryable auth/config error, or general generation failure.
 */
export function classifyGeminiError(error: unknown): ClassifiedGeminiError {
  const rawMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
  const lower = rawMessage.toLowerCase();
  const statusObj = error as { status?: number; statusCode?: number; code?: number };
  const statusCode =
    typeof statusObj?.status === 'number'
      ? statusObj.status
      : typeof statusObj?.statusCode === 'number'
      ? statusObj.statusCode
      : typeof statusObj?.code === 'number'
      ? statusObj.code
      : undefined;

  const retryAfterMs = extractRetryAfterMs(error);

  // 0. The server has no Gemini credentials at all: say so plainly instead of "generation failed".
  if (rawMessage === 'NO_API_KEY') {
    return {
      category: 'auth_config_error',
      retryable: false,
      userMessage:
        'AI is not set up on this server yet (missing API key), so this feature cannot run right now.',
      statusCode,
      rawReason: rawMessage,
    };
  }

  // Both Claude models were busy, overloaded, unreachable or timed out.
  if (lower.includes('claude_unavailable') || lower.includes('claude_timeout')) {
    return {
      category: 'temporarily_busy',
      retryable: true,
      userMessage: 'The AI service is temporarily unavailable. Please try again in a minute.',
      statusCode,
      rawReason: rawMessage.slice(0, 180),
    };
  }

  // Claude replies that hit max_tokens or were declined: a retry with the same input won't help.
  if (lower.includes('claude_output_truncated')) {
    return {
      category: 'generation_failed',
      retryable: false,
      userMessage:
        "The AI's answer was too long and got cut off. Try a shorter question or a smaller part of your notes.",
      statusCode,
      rawReason: rawMessage.slice(0, 180),
    };
  }
  if (lower.includes('claude_refusal')) {
    return {
      category: 'generation_failed',
      retryable: false,
      userMessage: "The AI couldn't help with this request. Try rephrasing it.",
      statusCode,
      rawReason: rawMessage.slice(0, 180),
    };
  }

  // 1. Daily or per-model quota exhaustion or depleted prepayment credits (do not retry indefinitely; evaluate before auth_config_error so 429/402 messages mentioning 'check your plan and billing details' are not misclassified)
  if (
    statusCode === 402 ||
    // Anthropic reports an empty prepaid balance as HTTP 400.
    lower.includes('credit balance is too low') ||
    lower.includes('prepayment credits are depleted') ||
    lower.includes('credits are depleted') ||
    lower.includes('quota_exceeded') ||
    lower.includes('quota exceeded') ||
    lower.includes('daily limit') ||
    lower.includes('perday') ||
    lower.includes('generaterequestsperday') ||
    lower.includes('project quota') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('billing_not_enabled')
  ) {
    return {
      category: 'quota_exhausted',
      retryable: false,
      userMessage: "Your project's AI quota has been reached.",
      statusCode: statusCode ?? 429,
      rawReason: rawMessage.slice(0, 180),
    };
  }

  // 2. Non-retryable authentication or invalid configuration errors
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 400 ||
    lower.includes('no_api_key') ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated') ||
    lower.includes('billing_disabled') ||
    lower.includes('invalid_argument')
  ) {
    return {
      category: 'auth_config_error',
      retryable: false,
      userMessage:
        'The AI is not set up correctly on this server. Please contact support so it can be fixed.',
      statusCode,
      rawReason: rawMessage.slice(0, 180),
    };
  }

  // 3. Transient rate limits (429 RPM/TPM) or temporary server overload (503)
  if (
    statusCode === 429 ||
    statusCode === 503 ||
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('resource_exhausted') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable')
  ) {
    return {
      category: 'temporarily_busy',
      retryable: true,
      userMessage: 'The AI is temporarily busy. Try again shortly.',
      retryAfterMs,
      statusCode: statusCode ?? 429,
      rawReason: rawMessage.slice(0, 180),
    };
  }

  // 4. Timeouts: retrying the same long request rarely helps, so say what happened.
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      category: 'generation_failed',
      retryable: false,
      userMessage: 'The AI took too long to respond. Please try again.',
      statusCode,
      rawReason: rawMessage.slice(0, 180),
    };
  }

  // 5. General generation failures
  return {
    category: 'generation_failed',
    retryable: false,
    userMessage: 'Generation failed. Your existing notes are safe.',
    statusCode,
    rawReason: rawMessage.slice(0, 180),
  };
}

/**
 * Computes exponential backoff with jitter, respecting server Retry-After when available.
 */
export function computeBackoffDelayMs(params: {
  attempt: number; // 0-based retry index (0 = first retry)
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryAfterMs?: number;
  randomFn?: () => number;
}): number {
  const {
    attempt,
    baseDelayMs = 600,
    maxDelayMs = 8000,
    retryAfterMs,
    randomFn = Math.random,
  } = params;

  if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
    const jitter = Math.round(randomFn() * 200);
    return Math.min(maxDelayMs, retryAfterMs + jitter);
  }

  const exponential = baseDelayMs * Math.pow(2, Math.max(0, attempt));
  const jitter = Math.round(randomFn() * 250);
  return Math.min(maxDelayMs, exponential + jitter);
}

/**
 * Computes a fast deterministic hash for request deduplication and caching.
 */
export function computeRequestFingerprint(parts: Array<string | number | undefined | null>): string {
  const combined = parts.map((p) => String(p ?? '')).join('|');
  let hash = 2166136261;
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp_${(hash >>> 0).toString(36)}_${combined.length}`;
}

export interface GeminiManagerOptions {
  maxConcurrency?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  cacheTtlMs?: number;
  maxCacheEntries?: number;
  sleepFn?: (ms: number) => Promise<void>;
  onLog?: (entry: {
    operation: string;
    model: string;
    status: 'cache_hit' | 'dedup_hit' | 'success' | 'retry' | 'failed';
    retries: number;
    durationMs: number;
    approxInputChars: number;
    errorCategory?: GeminiErrorCategory;
    /** Raw provider error (for server logs only, never shown to students). */
    errorReason?: string;
  }) => void;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Centralized Gemini Request Manager with:
 * - Controlled concurrency queue
 * - In-flight request deduplication
 * - Successful result caching
 * - Bounded exponential backoff with jitter for transient 429/503 errors
 */
export class GeminiRequestManager {
  private readonly maxConcurrency: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly cacheTtlMs: number;
  private readonly maxCacheEntries: number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly onLog?: GeminiManagerOptions['onLog'];

  private activeCount = 0;
  private readonly waitQueue: Array<() => void> = [];
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(options: GeminiManagerOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 2;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseDelayMs = options.baseDelayMs ?? 650;
    this.maxDelayMs = options.maxDelayMs ?? 6000;
    this.cacheTtlMs = options.cacheTtlMs ?? 15 * 60 * 1000; // 15 minutes
    this.maxCacheEntries = options.maxCacheEntries ?? 120;
    this.sleepFn =
      options.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.onLog = options.onLog;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
    this.activeCount += 1;
  }

  private releaseSlot(): void {
    this.activeCount = Math.max(0, this.activeCount - 1);
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  getCached<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }
    return entry.value as T;
  }

  setCached<T>(cacheKey: string, value: T): void {
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  async execute<T>(params: {
    operation: string;
    model: string;
    cacheKey?: string;
    bypassCache?: boolean;
    approxInputChars?: number;
    task: () => Promise<T>;
  }): Promise<T> {
    const {
      operation,
      model,
      cacheKey,
      bypassCache = false,
      approxInputChars = 0,
      task,
    } = params;
    const startTime = Date.now();

    // 1. Check completed response cache
    if (cacheKey && !bypassCache) {
      const hit = this.getCached<T>(cacheKey);
      if (hit !== null) {
        this.onLog?.({
          operation,
          model,
          status: 'cache_hit',
          retries: 0,
          durationMs: 0,
          approxInputChars,
        });
        return hit;
      }
    }

    // 2. Check in-flight deduplication
    const dedupKey = cacheKey || `${operation}:${model}:${Date.now()}`;
    if (cacheKey && this.inFlight.has(dedupKey)) {
      this.onLog?.({
        operation,
        model,
        status: 'dedup_hit',
        retries: 0,
        durationMs: Date.now() - startTime,
        approxInputChars,
      });
      return (await this.inFlight.get(dedupKey)) as T;
    }

    const runner = (async (): Promise<T> => {
      await this.acquireSlot();
      let retries = 0;
      try {
        while (true) {
          try {
            const result = await task();
            if (cacheKey) {
              this.setCached(cacheKey, result);
            }
            this.onLog?.({
              operation,
              model,
              status: 'success',
              retries,
              durationMs: Date.now() - startTime,
              approxInputChars,
            });
            return result;
          } catch (err) {
            const classified = classifyGeminiError(err);
            if (classified.retryable && retries < this.maxRetries) {
              const delayMs = computeBackoffDelayMs({
                attempt: retries,
                baseDelayMs: this.baseDelayMs,
                maxDelayMs: this.maxDelayMs,
                retryAfterMs: classified.retryAfterMs,
              });
              retries += 1;
              this.onLog?.({
                operation,
                model,
                status: 'retry',
                retries,
                durationMs: Date.now() - startTime,
                approxInputChars,
                errorCategory: classified.category,
                errorReason: classified.rawReason,
              });
              await this.sleepFn(delayMs);
              continue;
            }

            this.onLog?.({
              operation,
              model,
              status: 'failed',
              retries,
              durationMs: Date.now() - startTime,
              approxInputChars,
              errorCategory: classified.category,
              errorReason: classified.rawReason,
            });
            const enrichedError = new Error(classified.userMessage) as Error & {
              classified?: ClassifiedGeminiError;
            };
            enrichedError.classified = classified;
            throw enrichedError;
          }
        }
      } finally {
        this.releaseSlot();
      }
    })();

    if (cacheKey) {
      this.inFlight.set(dedupKey, runner);
    }

    try {
      return await runner;
    } finally {
      if (cacheKey) {
        this.inFlight.delete(dedupKey);
      }
    }
  }
}

/* ============================================================================
 * 2. TOPIC-SPECIFIC YOUTUBE RECOMMENDATION LOGIC
 * ============================================================================ */

const GENERIC_TITLE_PATTERNS = [
  /^(?:semester|sem|term|unit|module|chapter|ch|part|week|lecture|lec)\s*\d*\s*(?:revision|notes|guide|summary|review|prep|material|handout|slides|pdf)?$/i,
  /^(?:exam|final|midterm|test|quiz|revision|study|quick|complete|full|master)\s*(?:guide|notes|sheet|summary|prep|material|pack|review|pdf|doc|document)*$/i,
  /^80\s*\/\s*20\s*(?:notes|rule|revision|summary|guide)?$/i,
  /^(?:uploaded|pasted|my|student|course|class|subject)\s*(?:notes|material|document|pdf|text|summary)$/i,
  /^untitled/i,
];

const GENERIC_NOISE_WORDS = new Set([
  'semester',
  'revision',
  'exam',
  'guide',
  'notes',
  'chapter',
  'unit',
  'module',
  'lecture',
  'summary',
  'study',
  'material',
  'handout',
  'pdf',
  'page',
  'section',
  'overview',
  'introduction',
  'basics',
  'part',
  'week',
  '80/20',
  '8020',
  'final',
  'midterm',
  'prep',
]);

/**
 * Checks whether a document or section title is generic filler (e.g. "Semester 1 Revision", "Exam Guide", "80/20 Notes").
 */
export function isGenericDocumentTitle(rawTitle: string): boolean {
  const cleaned = (rawTitle || '')
    .replace(/\.pdf$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3) return true;
  if (GENERIC_TITLE_PATTERNS.some((rx) => rx.test(cleaned))) {
    return true;
  }

  const tokens = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9/\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return true;
  const meaningfulTokens = tokens.filter(
    (t) => !GENERIC_NOISE_WORDS.has(t) && !/^\d+$/.test(t)
  );
  return meaningfulTokens.length === 0;
}

/**
 * Cleans a raw title by stripping generic noise words while keeping real academic subject words if present.
 */
export function extractSubjectFromTitle(rawTitle: string): string {
  const cleaned = (rawTitle || '')
    .replace(/\.pdf$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b(?:semester\s*\d+|chapter\s*\d+|unit\s*\d+|80\/20|exam\s*guide|revision\s*notes|study\s*guide|lecture\s*notes|notes)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (isGenericDocumentTitle(cleaned)) {
    return '';
  }
  return cleaned;
}

/**
 * Extracts 3 to 5 precise educational concepts from the current chapter or weak topics,
 * ignoring generic document titles unless accompanied by actual subject concepts.
 */
export function extractPreciseEducationalConcepts(params: {
  documentTitle: string;
  topics: Array<{ name: string; keyConcepts?: string[] } | string>;
  weakTopics?: string[];
  pageTitles?: string[];
}): string[] {
  const { documentTitle, topics = [], weakTopics = [], pageTitles = [] } = params;
  const candidates: string[] = [];

  // 1. Prioritize weak topics from quiz performance
  for (const wt of weakTopics) {
    const clean = wt.trim();
    if (clean && !isGenericDocumentTitle(clean)) {
      candidates.push(clean);
    }
  }

  // 2. Topic names and keyConcepts
  for (const t of topics) {
    if (typeof t === 'string') {
      if (t.trim() && !isGenericDocumentTitle(t)) {
        candidates.push(t.trim());
      }
    } else if (t && typeof t === 'object') {
      if (t.name && !isGenericDocumentTitle(t.name)) {
        candidates.push(t.name.trim());
      }
      if (Array.isArray(t.keyConcepts)) {
        for (const kc of t.keyConcepts) {
          const cleanKc = kc.replace(/[=≥≤≠±×·÷Σ√]+.*$/, '').trim();
          if (cleanKc.length >= 4 && !isGenericDocumentTitle(cleanKc)) {
            candidates.push(cleanKc);
          }
        }
      }
    }
  }

  // 3. Page / Section headings
  for (const pt of pageTitles) {
    const cleanPt = pt.replace(/^\d{1,2}:\d{2}\s*[—\-:]\s*/, '').trim();
    if (cleanPt && !isGenericDocumentTitle(cleanPt)) {
      candidates.push(cleanPt);
    }
  }

  // 4. Only use documentTitle if it contains an actual academic subject
  const subjectFromTitle = extractSubjectFromTitle(documentTitle);
  if (subjectFromTitle && candidates.length < 3) {
    candidates.push(subjectFromTitle);
  }

  // Deduplicate case-insensitively and cap at 5
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of candidates) {
    const normalized = item.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
    if (result.length >= 5) break;
  }

  return result;
}

/**
 * Builds a specific educational YouTube search query using subject + concept + tutorial/explanation.
 */
export function buildSpecificYouTubeSearchQuery(params: {
  concept: string;
  documentTitle?: string;
  topics?: string[];
}): string {
  const cleanConcept = (params.concept || '').trim();
  const subjectHint = extractSubjectFromTitle(params.documentTitle || '');

  // Check if concept already includes the subject word
  const conceptLower = cleanConcept.toLowerCase();
  const subjectLower = subjectHint.toLowerCase();

  let base = cleanConcept;
  if (
    subjectHint &&
    !conceptLower.includes(subjectLower) &&
    subjectHint.split(/\s+/).length <= 3
  ) {
    base = `${subjectHint} ${cleanConcept}`;
  } else if (!subjectHint && params.topics && params.topics.length > 0) {
    const firstTopic = params.topics[0];
    if (
      firstTopic &&
      !isGenericDocumentTitle(firstTopic) &&
      !conceptLower.includes(firstTopic.toLowerCase()) &&
      cleanConcept.split(/\s+/).length <= 2
    ) {
      base = `${cleanConcept} ${firstTopic}`;
    }
  }

  if (!/\b(?:tutorial|explained|explanation|lecture|course|example)\b/i.test(base)) {
    return `${base} tutorial explanation`.replace(/\s+/g, ' ').trim();
  }
  return base.replace(/\s+/g, ' ').trim();
}

/**
 * Parses an ISO 8601 YouTube duration string (e.g. "PT14M20S") into total seconds.
 */
export function parseIsoDurationSeconds(isoDuration?: string): number | null {
  if (!isoDuration || typeof isoDuration !== 'string') return null;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export interface RawYouTubeCandidate {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  watchUrl: string;
  publishedAt?: string;
  durationSeconds?: number | null;
}

export interface ScoredYouTubeCandidate extends RawYouTubeCandidate {
  relevanceScore: number;
}

const CLICKBAIT_OR_UNRELATED_REGEX =
  /\b(?:prank|vlog|unboxing|giveaway|reaction|gameplay|fortnite|minecraft|roblox|music\s*video|official\s*video|lyrics|trailer|teaser|parody|asmr|mukbang|gossip|drama|celebrity|horoscope|astrology|betting|casino|crypto\s*pump|#shorts|shorts\s*viral)\b/i;

const EDUCATIONAL_SIGNAL_REGEX =
  /\b(?:lecture|tutorial|explained|explanation|introduction|intro|course|lesson|class|university|college|academy|mit|stanford|harvard|khan|3blue1brown|statquest|organic\s*chemistry\s*tutor|nptel|crash\s*course|professor|prof|theorem|proof|example|problem|solved|derivation|formula|mathematics|statistics|probability|science|engineering|physics|chemistry|biology|computer\s*science|discrete)\b/i;

/**
 * Ranks YouTube video candidates by topic relevance, educational usefulness, duration, and specificity.
 * Rejects unrelated, clickbait, promotional, or ultra-short videos and returns at most 3 strong matches.
 */
export function rankAndFilterYouTubeCandidates(params: {
  candidates: RawYouTubeCandidate[];
  concept: string;
  subjectKeywords?: string[];
  maxResults?: number;
}): ScoredYouTubeCandidate[] {
  const { candidates, concept, subjectKeywords = [], maxResults = 3 } = params;
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'what', 'how', 'why',
    'tutorial', 'explanation', 'explained', 'lecture', 'video', 'notes',
    'chapter', 'section', 'page', 'study', 'guide',
  ]);

  const extractTokens = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

  const conceptTokens = extractTokens(concept);
  const subjectTokens = extractTokens(subjectKeywords.join(' '));

  const scored: ScoredYouTubeCandidate[] = [];

  for (const item of candidates) {
    if (!item.videoId || !item.title) continue;

    const combinedText = `${item.title} ${item.description || ''} ${item.channelTitle || ''}`;
    const titleLower = item.title.toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const channelLower = (item.channelTitle || '').toLowerCase();

    // 1. Reject obvious clickbait, gaming, music videos, or unrelated entertainment
    if (CLICKBAIT_OR_UNRELATED_REGEX.test(combinedText)) {
      continue;
    }

    // 2. Reject ultra-short clips (< 60s) when duration is known
    if (typeof item.durationSeconds === 'number' && item.durationSeconds > 0 && item.durationSeconds < 60) {
      continue;
    }

    let score = 0;

    // 3. Exact phrase or concept token matching
    const cleanConceptPhrase = concept
      .toLowerCase()
      .replace(/\b(?:tutorial|explanation|explained|lecture)\b/gi, '')
      .trim();

    if (cleanConceptPhrase.length >= 4 && titleLower.includes(cleanConceptPhrase)) {
      score += 35;
    } else if (cleanConceptPhrase.length >= 4 && descLower.includes(cleanConceptPhrase)) {
      score += 18;
    }

    let matchedConceptTokens = 0;
    for (const tok of conceptTokens) {
      if (titleLower.includes(tok)) {
        score += 14;
        matchedConceptTokens += 1;
      } else if (descLower.includes(tok)) {
        score += 6;
        matchedConceptTokens += 1;
      }
    }

    // Require at least one concept token match (if conceptTokens is non-empty)
    if (conceptTokens.length > 0 && matchedConceptTokens === 0) {
      continue;
    }

    // 4. Subject context matching
    for (const sTok of subjectTokens) {
      if (titleLower.includes(sTok) || descLower.includes(sTok)) {
        score += 5;
      }
    }

    // 5. Educational usefulness signals in title, description, or channel
    if (EDUCATIONAL_SIGNAL_REGEX.test(titleLower)) {
      score += 12;
    }
    if (EDUCATIONAL_SIGNAL_REGEX.test(channelLower)) {
      score += 15;
    }
    if (EDUCATIONAL_SIGNAL_REGEX.test(descLower)) {
      score += 6;
    }

    // 6. Duration sweet spot (3 minutes to 60 minutes)
    if (typeof item.durationSeconds === 'number' && item.durationSeconds >= 180 && item.durationSeconds <= 3600) {
      score += 10;
    }

    // Minimum quality threshold
    if (score >= 14) {
      scored.push({
        ...item,
        relevanceScore: score,
      });
    }
  }

  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

/* ============================================================================
 * 3. REAL-TIME VOICE TRANSCRIPT CHUNK ASSEMBLER
 * ============================================================================ */

export interface VoiceTranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
  interrupted?: boolean;
}

/**
 * Cleanly merges an incoming incremental transcription chunk into the conversation transcript list
 * without duplicating text or mixing student and tutor turns.
 */
export function upsertStreamingTranscriptChunk(
  entries: VoiceTranscriptEntry[],
  params: {
    role: 'user' | 'assistant';
    chunkText: string;
    isFinal?: boolean;
  }
): VoiceTranscriptEntry[] {
  const { role, chunkText, isFinal = false } = params;
  if (!chunkText) return entries;

  const updated = [...entries];
  const lastIdx = updated.length - 1;
  const last = lastIdx >= 0 ? updated[lastIdx] : null;

  if (last && last.role === role && !last.isFinal) {
    // Combine incremental chunk without duplicating overlapping prefixes
    const existing = last.text;
    let mergedText = existing;
    if (chunkText.startsWith(existing)) {
      mergedText = chunkText;
    } else if (!existing.endsWith(chunkText)) {
      const needsSpace =
        existing.length > 0 &&
        !/\s$/.test(existing) &&
        !/^[\s.,!?;:'")]/.test(chunkText);
      mergedText = `${existing}${needsSpace ? ' ' : ''}${chunkText}`;
    }
    updated[lastIdx] = {
      ...last,
      text: mergedText.replace(/\s+/g, ' ').trim(),
      isFinal,
    };
    return updated;
  }

  updated.push({
    id: `vt-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text: chunkText.trim(),
    isFinal,
  });
  return updated;
}

/**
 * Marks the latest active assistant turn as finalized/interrupted when turnComplete or interrupted fires.
 */
export function finalizeActiveTranscriptTurn(
  entries: VoiceTranscriptEntry[],
  role?: 'user' | 'assistant',
  interrupted = false
): VoiceTranscriptEntry[] {
  return entries.map((entry, idx) => {
    if (idx === entries.length - 1 && (!role || entry.role === role) && !entry.isFinal) {
      return {
        ...entry,
        isFinal: true,
        interrupted: interrupted || entry.interrupted,
      };
    }
    return entry;
  });
}
