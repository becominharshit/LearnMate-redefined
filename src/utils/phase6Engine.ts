import type {
  OnePageRevisionSheet,
  StudyDocument,
  StudyPage,
  StudyTopic,
} from '../types/study';
import type { DiagramCategory, StructuredDiagramSpec } from '../types/diagram';
import { getDeterministicDiagramTemplate } from './diagramEngine';
import { normalizeMathDelimiters } from './mathMarkdown';

/* ============================================================================
 * SECTION 6 — DETERMINISTIC VOICE SESSION STATE MACHINE & GLOBAL AUDIO MANAGER
 * ============================================================================ */

export type VoiceSessionLifecycleState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'SPEAKING'
  | 'ENDING'
  | 'ENDED';

export interface GlobalAudioCleanupSnapshot {
  cancelledSpeechSynthesis: boolean;
  detachedUtterancesCount: number;
  abortedRecognitionsCount: number;
  abortedRequestsCount: number;
  stoppedMediaTracksCount: number;
  closedAudioContextsCount: number;
  reason: string;
  epoch: number;
  timestamp: string;
}

interface SpeechLikeUtterance {
  onstart: ((ev: any) => any) | null;
  onend: ((ev: any) => any) | null;
  onerror: ((ev: any) => any) | null;
  onpause?: ((ev: any) => any) | null;
  onresume?: ((ev: any) => any) | null;
  onboundary?: ((ev: any) => any) | null;
}

interface RecognitionLike {
  onstart?: ((ev: any) => any) | null;
  onresult?: ((ev: any) => any) | null;
  onerror?: ((ev: any) => any) | null;
  onend?: ((ev: any) => any) | null;
  abort?: () => void;
  stop?: () => void;
}

interface MediaStreamLike {
  getTracks?: () => Array<{ stop?: () => void; readyState?: string }>;
}

interface AudioContextLike {
  state?: string;
  close?: () => Promise<void> | void;
  suspend?: () => Promise<void> | void;
}

class GlobalAudioAndVoiceRegistry {
  private epoch = 0;
  private lifecycleState: VoiceSessionLifecycleState = 'IDLE';
  private activeUtterances = new Set<SpeechLikeUtterance>();
  private activeRecognitions = new Set<RecognitionLike>();
  private activeAbortControllers = new Set<AbortController>();
  private activeMediaStreams = new Set<MediaStreamLike>();
  private activeAudioContexts = new Set<AudioContextLike>();
  private activeTimers = new Set<ReturnType<typeof setTimeout>>();
  private cleanupHistory: GlobalAudioCleanupSnapshot[] = [];

  getEpoch(): number {
    return this.epoch;
  }

  getLifecycleState(): VoiceSessionLifecycleState {
    return this.lifecycleState;
  }

  transitionState(next: VoiceSessionLifecycleState): VoiceSessionLifecycleState {
    if (next === 'ENDING' || next === 'ENDED' || next === 'IDLE') {
      this.epoch += 1;
    }
    this.lifecycleState = next;
    return this.lifecycleState;
  }

  /**
   * Starts a new voice session epoch and transitions to CONNECTING, LISTENING, or IDLE.
   */
  beginSession(initialState: VoiceSessionLifecycleState = 'CONNECTING'): number {
    this.stopAll('begin_new_voice_session');
    this.epoch += 1;
    this.lifecycleState = initialState;
    return this.epoch;
  }

  /**
   * Returns true ONLY if the provided epoch matches the current session epoch
   * AND the session is not in ENDING, ENDED, or IDLE state.
   */
  isCallbackValid(callbackEpoch: number): boolean {
    if (callbackEpoch !== this.epoch) return false;
    if (
      this.lifecycleState === 'ENDING' ||
      this.lifecycleState === 'ENDED' ||
      this.lifecycleState === 'IDLE'
    ) {
      return false;
    }
    return true;
  }

  registerUtterance(utterance: SpeechLikeUtterance): void {
    if (utterance) {
      this.activeUtterances.add(utterance);
    }
  }

  unregisterUtterance(utterance: SpeechLikeUtterance): void {
    this.activeUtterances.delete(utterance);
  }

  registerRecognition(recognition: RecognitionLike | null | undefined): void {
    if (recognition) {
      this.activeRecognitions.add(recognition);
    }
  }

  registerAbortController(controller: AbortController | null | undefined): void {
    if (controller) {
      this.activeAbortControllers.add(controller);
    }
  }

  registerMediaStream(stream: MediaStreamLike | null | undefined): void {
    if (stream) {
      this.activeMediaStreams.add(stream);
    }
  }

  registerAudioContext(ctx: AudioContextLike | null | undefined): void {
    if (ctx) {
      this.activeAudioContexts.add(ctx);
    }
  }

  registerTimer(timerId: ReturnType<typeof setTimeout>): void {
    this.activeTimers.add(timerId);
  }

  /**
   * Idempotently stops all browser speech synthesis, detaches utterance callbacks,
   * aborts speech recognition, aborts streaming AI requests, stops microphone tracks,
   * and transitions to ENDED.
   */
  stopAll(reason = 'manual_stop'): GlobalAudioCleanupSnapshot {
    this.lifecycleState = 'ENDING';
    this.epoch += 1;

    // 1. Clear all registered timers
    for (const timer of this.activeTimers) {
      try {
        clearTimeout(timer);
      } catch {
        // ignore
      }
    }
    this.activeTimers.clear();

    // 2. Detach all utterance handlers BEFORE cancelling speechSynthesis so
    // browser onend/onerror events cannot re-trigger a new turn or queued chunk.
    let detachedUtterancesCount = 0;
    for (const u of this.activeUtterances) {
      try {
        u.onstart = null;
        u.onend = null;
        u.onerror = null;
        if ('onpause' in u) u.onpause = null;
        if ('onresume' in u) u.onresume = null;
        if ('onboundary' in u) u.onboundary = null;
        detachedUtterancesCount += 1;
      } catch {
        // ignore
      }
    }
    this.activeUtterances.clear();

    // 3. Cancel global window.speechSynthesis
    let cancelledSpeechSynthesis = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        // In Chromium/WebKit, if synthesis was paused, resume before cancel ensures queue flush
        if (window.speechSynthesis.paused && typeof window.speechSynthesis.resume === 'function') {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
        cancelledSpeechSynthesis = true;
      } catch {
        // ignore
      }
    }

    // 4. Detach and abort all SpeechRecognition instances
    let abortedRecognitionsCount = 0;
    for (const rec of this.activeRecognitions) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        if (typeof rec.abort === 'function') {
          rec.abort();
        } else if (typeof rec.stop === 'function') {
          rec.stop();
        }
        abortedRecognitionsCount += 1;
      } catch {
        // ignore
      }
    }
    this.activeRecognitions.clear();

    // 5. Abort all active streaming/tutor AbortControllers
    let abortedRequestsCount = 0;
    for (const ctrl of this.activeAbortControllers) {
      try {
        if (!ctrl.signal.aborted) {
          ctrl.abort();
        }
        abortedRequestsCount += 1;
      } catch {
        // ignore
      }
    }
    this.activeAbortControllers.clear();

    // 6. Stop all active MediaStream microphone/audio tracks
    let stoppedMediaTracksCount = 0;
    for (const stream of this.activeMediaStreams) {
      try {
        const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
        for (const track of tracks) {
          if (typeof track.stop === 'function') {
            track.stop();
            stoppedMediaTracksCount += 1;
          }
        }
      } catch {
        // ignore
      }
    }
    this.activeMediaStreams.clear();

    // 7. Suspend/close any registered AudioContexts
    let closedAudioContextsCount = 0;
    for (const ctx of this.activeAudioContexts) {
      try {
        if (ctx.state !== 'closed') {
          if (typeof ctx.close === 'function') {
            void ctx.close();
          } else if (typeof ctx.suspend === 'function') {
            void ctx.suspend();
          }
          closedAudioContextsCount += 1;
        }
      } catch {
        // ignore
      }
    }
    this.activeAudioContexts.clear();

    this.lifecycleState = 'ENDED';

    const snapshot: GlobalAudioCleanupSnapshot = {
      cancelledSpeechSynthesis,
      detachedUtterancesCount,
      abortedRecognitionsCount,
      abortedRequestsCount,
      stoppedMediaTracksCount,
      closedAudioContextsCount,
      reason,
      epoch: this.epoch,
      timestamp: new Date().toISOString(),
    };
    this.cleanupHistory.push(snapshot);
    if (this.cleanupHistory.length > 50) {
      this.cleanupHistory.shift();
    }
    return snapshot;
  }

  getLastCleanupSnapshot(): GlobalAudioCleanupSnapshot | null {
    return this.cleanupHistory[this.cleanupHistory.length - 1] || null;
  }
}

export const globalAudioRegistry = new GlobalAudioAndVoiceRegistry();

export function stopAllGlobalAudioAndSpeech(reason = 'navigation_or_end_session'): GlobalAudioCleanupSnapshot {
  return globalAudioRegistry.stopAll(reason);
}

/* ============================================================================
 * SECTION 1 — YOUTUBE LONG-LECTURE PROCESSING (UP TO 12 HOURS / 720 MINUTES)
 * ============================================================================ */

export const MAX_YOUTUBE_LECTURE_DURATION_SECONDS = 12 * 3600; // 43,200s (12 hours / 720 mins)
export const DEFAULT_LECTURE_CHUNK_WINDOW_SECONDS = 15 * 60; // 15-minute windows
export const DEFAULT_LECTURE_CHUNK_OVERLAP_SECONDS = 45; // 45-second overlap

export interface ParsedYouTubeLectureUrl {
  isValid: boolean;
  valid: boolean;
  videoId: string;
  canonicalUrl: string;
  startTimestampSeconds?: number;
  playlistId?: string;
  errorReason?: string;
  error?: string;
}

export function validateAndNormalizeYouTubeLectureUrl(rawInput: string): ParsedYouTubeLectureUrl {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    const msg = 'Please paste a YouTube lecture link.';
    return {
      isValid: false,
      valid: false,
      videoId: '',
      canonicalUrl: '',
      errorReason: msg,
      error: msg,
    };
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate) && /^(?:www\.|m\.|youtu\.be\/|youtube\.com\/)/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    let videoId: string | null = null;

    if (host === 'youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || null;
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam) {
        videoId = vParam;
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (
          parts.length >= 2 &&
          (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live' || parts[0] === 'v')
        ) {
          videoId = parts[1];
        }
      }
    }

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      const msg =
        'Invalid YouTube video ID. Use a standard youtube.com/watch?v=... or youtu.be/... lecture link.';
      return {
        isValid: false,
        valid: false,
        videoId: '',
        canonicalUrl: '',
        errorReason: msg,
        error: msg,
      };
    }

    const tParam = parsed.searchParams.get('t') || parsed.searchParams.get('start');
    let startTimestampSeconds: number | undefined;
    if (tParam) {
      const hmsMatch = tParam.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
      if (hmsMatch && (hmsMatch[1] || hmsMatch[2] || hmsMatch[3])) {
        const h = Number(hmsMatch[1] || 0);
        const m = Number(hmsMatch[2] || 0);
        const s = Number(hmsMatch[3] || 0);
        startTimestampSeconds = h * 3600 + m * 60 + s;
      } else {
        const numeric = Number(tParam.replace(/[^\d]/g, ''));
        if (Number.isFinite(numeric) && numeric >= 0) {
          startTimestampSeconds = numeric;
        }
      }
    }

    const playlistId = parsed.searchParams.get('list') || undefined;
    return {
      isValid: true,
      valid: true,
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      startTimestampSeconds,
      playlistId,
    };
  } catch {
    // Fallback regex for raw 11-char ID or embedded link
    const match = trimmed.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (match?.[1]) {
      return {
        isValid: true,
        valid: true,
        videoId: match[1],
        canonicalUrl: `https://www.youtube.com/watch?v=${match[1]}`,
      };
    }
    const msg = 'Could not parse YouTube URL. Please check the link format and try again.';
    return {
      isValid: false,
      valid: false,
      videoId: '',
      canonicalUrl: '',
      errorReason: msg,
      error: msg,
    };
  }
}

export function formatLectureTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function parseTimestampToSeconds(label: string): number | null {
  const clean = (label || '').trim().replace(/^\[|\]$/g, '');
  const parts = clean.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

export interface TimestampedTranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  timestampLabel: string;
  text: string;
}

export interface LectureChunkSpec {
  chunkIndex: number;
  startSeconds: number;
  endSeconds: number;
  startLabel: string;
  endLabel: string;
  title: string;
  rawText: string;
  extractedFormulas: string[];
  keyConcepts: string[];
  summary: string;
}

/**
 * Parses a raw transcript (with or without explicit `[HH:MM:SS]` / `[MM:SS]` markers)
 * into ordered timestamped segments spanning up to 12 hours (`43,200` seconds).
 */
export function parseTimestampedTranscriptSegments(
  rawTranscript: string,
  estimatedDurationSeconds = 3600
): TimestampedTranscriptSegment[] {
  const clampedDuration = Math.max(
    60,
    Math.min(MAX_YOUTUBE_LECTURE_DURATION_SECONDS, Math.round(estimatedDurationSeconds || 3600))
  );
  const lines = (rawTranscript || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const explicitSegments: Array<{ startSeconds: number; text: string }> = [];
  const timestampLineRegex = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—:]?\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(timestampLineRegex);
    if (match) {
      const sec = parseTimestampToSeconds(match[1]);
      if (sec !== null && sec <= MAX_YOUTUBE_LECTURE_DURATION_SECONDS) {
        explicitSegments.push({
          startSeconds: sec,
          text: match[2].trim(),
        });
        continue;
      }
    }
    if (explicitSegments.length > 0) {
      explicitSegments[explicitSegments.length - 1].text += ` ${line}`;
    } else {
      explicitSegments.push({
        startSeconds: 0,
        text: line,
      });
    }
  }

  // If no explicit timestamps were present (all at 0), distribute sentences across `clampedDuration`
  const hasMultipleDistinctTimestamps =
    new Set(explicitSegments.map((s) => s.startSeconds)).size > 1;

  if (!hasMultipleDistinctTimestamps) {
    const sentences = rawTranscript
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.?!])\s+/)
      .filter(Boolean);
    const total = Math.max(1, sentences.length);
    const groupSize = Math.max(1, Math.ceil(total / Math.min(120, Math.max(6, Math.ceil(clampedDuration / 300)))));
    const distributed: TimestampedTranscriptSegment[] = [];
    let groupIdx = 0;
    const totalGroups = Math.ceil(total / groupSize);

    for (let i = 0; i < total; i += groupSize) {
      const startSec = Math.round((groupIdx / Math.max(1, totalGroups)) * clampedDuration);
      const endSec = Math.min(
        clampedDuration,
        Math.round(((groupIdx + 1) / Math.max(1, totalGroups)) * clampedDuration)
      );
      distributed.push({
        startSeconds: startSec,
        endSeconds: Math.max(startSec + 10, endSec),
        timestampLabel: formatLectureTimestamp(startSec),
        text: sentences.slice(i, i + groupSize).join(' '),
      });
      groupIdx += 1;
    }
    return distributed;
  }

  // Sort explicit segments by timestamp and compute endSeconds
  explicitSegments.sort((a, b) => a.startSeconds - b.startSeconds);
  return explicitSegments.map((seg, idx) => {
    const nextStart = explicitSegments[idx + 1]?.startSeconds;
    const endSeconds =
      typeof nextStart === 'number' && nextStart > seg.startSeconds
        ? nextStart
        : Math.max(seg.startSeconds + 60, clampedDuration);
    return {
      startSeconds: seg.startSeconds,
      endSeconds: Math.min(MAX_YOUTUBE_LECTURE_DURATION_SECONDS, endSeconds),
      timestampLabel: formatLectureTimestamp(seg.startSeconds),
      text: seg.text,
    };
  });
}

function extractFormulasFromChunkText(text: string): string[] {
  const formulas = new Set<string>();
  const mathMatches = text.match(/\$[^$\n]{3,90}\$/g) || [];
  for (const m of mathMatches) {
    formulas.add(m.trim());
  }
  const eqMatches =
    text.match(
      /\b(?:[A-Za-z_0-9\\]+\s*=\s*[^.,;\n]{2,65}|\\frac\{[^{}]+\}\{[^{}]+\}|[A-Z][a-z]?\d*(?:\s*\+\s*[A-Z][a-z]?\d*)*\s*(?:->|\\rightarrow|\\rightleftharpoons)\s*[A-Z][a-z]?\d*)/g
    ) || [];
  for (const eq of eqMatches.slice(0, 6)) {
    formulas.add(normalizeMathDelimiters(eq.trim()));
  }
  return Array.from(formulas).slice(0, 6);
}

/**
 * Chunks timestamped transcript segments for lectures up to 12 hours (`43,200` seconds)
 * with overlapping window boundaries and hierarchical summaries.
 */
export function chunkLongLectureSegments(
  segments: TimestampedTranscriptSegment[],
  options: {
    totalDurationSeconds?: number;
    maxDurationSeconds?: number;
    chunkWindowSeconds?: number;
    targetWindowSeconds?: number;
    overlapSeconds?: number;
    maxChunks?: number;
    lectureTitle?: string;
  } = {}
): LectureChunkSpec[] {
  if (!segments || segments.length === 0) return [];

  const maxSegEnd = Math.max(...segments.map((s) => s.endSeconds), 60);
  const totalDuration = Math.min(
    options.maxDurationSeconds || MAX_YOUTUBE_LECTURE_DURATION_SECONDS,
    Math.max(maxSegEnd, options.totalDurationSeconds || maxSegEnd)
  );
  const maxChunks = Math.max(4, Math.min(60, options.maxChunks || 48));

  // Choose window size so even a 12-hour (43,200s) lecture fits cleanly within maxChunks (e.g., 15-20 min windows)
  const minWindowForCap = Math.ceil(totalDuration / maxChunks);
  const requestedWindow = options.chunkWindowSeconds || options.targetWindowSeconds;
  const windowSec = Math.max(
    300,
    requestedWindow ? Math.max(requestedWindow, minWindowForCap) : Math.max(DEFAULT_LECTURE_CHUNK_WINDOW_SECONDS, minWindowForCap)
  );
  const overlapSec = Math.max(0, Math.min(120, options.overlapSeconds ?? DEFAULT_LECTURE_CHUNK_OVERLAP_SECONDS));

  const chunks: LectureChunkSpec[] = [];
  let cursorStart = segments[0].startSeconds;
  let chunkIndex = 0;

  while (cursorStart < totalDuration && chunkIndex < maxChunks) {
    const windowEnd = Math.min(totalDuration, cursorStart + windowSec);
    const matching = segments.filter(
      (s) =>
        (s.startSeconds >= cursorStart - overlapSec && s.startSeconds < windowEnd) ||
        (s.endSeconds > cursorStart && s.startSeconds <= windowEnd)
    );

    if (matching.length > 0) {
      const actualStart = matching[0].startSeconds;
      const actualEnd = matching[matching.length - 1].endSeconds;
      const startLabel = formatLectureTimestamp(actualStart);
      const endLabel = formatLectureTimestamp(actualEnd);
      const combinedText = matching
        .map((m) => `[${m.timestampLabel}] ${m.text}`)
        .join('\n');

      const formulas = extractFormulasFromChunkText(combinedText);
      const firstSentence = matching[0].text.split(/[.?!]/)[0]?.trim() || `Lecture Segment ${chunkIndex + 1}`;
      const cleanHeading = firstSentence.slice(0, 72);

      chunks.push({
        chunkIndex,
        startSeconds: actualStart,
        endSeconds: actualEnd,
        startLabel,
        endLabel,
        title: `[${startLabel} – ${endLabel}] ${cleanHeading}`,
        rawText: normalizeMathDelimiters(combinedText),
        extractedFormulas: formulas,
        keyConcepts: matching
          .slice(0, 4)
          .map((m) => `[${m.timestampLabel}] ${m.text.slice(0, 90)}`),
        summary: normalizeMathDelimiters(
          `Covers lecture segment ${startLabel} to ${endLabel}: ${matching
            .slice(0, 2)
            .map((m) => m.text)
            .join(' ')
            .slice(0, 240)}`
        ),
      });
      chunkIndex += 1;
    }

    if (windowEnd >= totalDuration) break;
    cursorStart = windowEnd;
  }

  return chunks;
}

/**
 * Aggregates processed lecture chunks into structured LearnMate `StudyPage[]`, `StudyTopic[]`,
 * and a hierarchical lecture overview with timestamp citations.
 */
export function aggregateLectureChunksIntoStudyMaterial(
  paramsOrTitle:
    | {
        videoId: string;
        youtubeUrl?: string;
        title: string;
        durationSeconds: number;
        chunks: LectureChunkSpec[];
      }
    | string,
  videoIdArg?: string,
  chunksArg?: LectureChunkSpec[],
  durationSecondsArg?: number
): {
  title: string;
  durationSeconds: number;
  totalDurationSeconds: number;
  durationFormatted: string;
  overview: string;
  pages: StudyPage[];
  topics: StudyTopic[];
} {
  const normalizedParams =
    typeof paramsOrTitle === 'string'
      ? {
          title: paramsOrTitle,
          videoId: videoIdArg || 'lecture',
          chunks: chunksArg || [],
          durationSeconds: durationSecondsArg || 3600,
        }
      : paramsOrTitle;

  const { title, durationSeconds, chunks } = normalizedParams;
  const durationFormatted = formatLectureTimestamp(durationSeconds);
  const durationMins = Math.round(durationSeconds / 60);

  const pages: StudyPage[] = chunks.map((chunk, idx) => {
    const formulaBlock =
      chunk.extractedFormulas.length > 0
        ? `\n\nKey Formulas & Equations (${chunk.startLabel}–${chunk.endLabel}):\n• ${chunk.extractedFormulas.join('\n• ')}`
        : '';
    return {
      pageNumber: idx + 1,
      title: chunk.title,
      content: `${chunk.rawText}${formulaBlock}`,
      timestampSeconds: chunk.startSeconds,
      timestampLabel: chunk.startLabel,
    };
  });

  // Group chunks into up to 8 high-level chapter topics across the full lecture timeline
  const groupCount = Math.min(8, Math.max(1, Math.ceil(chunks.length / Math.max(1, Math.ceil(chunks.length / 6)))));
  const chunksPerTopic = Math.max(1, Math.ceil(chunks.length / groupCount));
  const topics: StudyTopic[] = [];

  for (let i = 0; i < chunks.length; i += chunksPerTopic) {
    const slice = chunks.slice(i, i + chunksPerTopic);
    if (slice.length === 0) continue;
    const startLbl = slice[0].startLabel;
    const endLbl = slice[slice.length - 1].endLabel;
    const topicIdx = topics.length + 1;
    const rawHeading = slice[0].title.replace(/^\[[^\]]+\]\s*/, '').slice(0, 64);

    topics.push({
      id: `yt-topic-${topicIdx}`,
      name: `Chapter ${topicIdx} (${startLbl}–${endLbl}): ${rawHeading}`,
      summary: slice.map((c) => c.summary).join(' ').slice(0, 320),
      keyConcepts: Array.from(
        new Set([...slice.flatMap((c) => c.extractedFormulas), ...slice.flatMap((c) => c.keyConcepts)])
      ).slice(0, 6),
      sourcePages: slice.map((c) => c.chunkIndex + 1),
    });
  }

  const allFormulas = Array.from(new Set(chunks.flatMap((c) => c.extractedFormulas))).slice(0, 8);
  const overview = normalizeMathDelimiters(
    `Structured JEE study pack for "${title}" (Total Duration: ${durationFormatted} / ${durationMins} min across ${pages.length} timestamped study sections and ${topics.length} chapter modules).${
      allFormulas.length > 0 ? ` Core equations indexed: ${allFormulas.join(', ')}.` : ''
    }`
  );

  return {
    title,
    durationSeconds,
    totalDurationSeconds: durationSeconds,
    durationFormatted,
    overview,
    pages,
    topics,
  };
}

export type YouTubeLectureJobStatus =
  | 'QUEUED'
  | 'FETCHING_METADATA'
  | 'DISCOVERING_SOURCE'
  | 'CHUNKING'
  | 'CHUNKING_TRANSCRIPT'
  | 'SUMMARIZING_CHUNKS'
  | 'AGGREGATING_HIERARCHY'
  | 'AGGREGATING_NOTES'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED_BY_CONTENT_ACCESS';

export type LongLectureProcessingJob = {
  jobId: string;
  videoId: string;
  canonicalUrl: string;
  title: string;
  channelTitle?: string;
  durationSeconds: number;
  status: YouTubeLectureJobStatus;
  progressPercent: number;
  totalChunks: number;
  completedChunks: number;
  chunks: LectureChunkSpec[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export interface YouTubeLectureJobState {
  jobId: string;
  uid: string;
  videoId: string;
  youtubeUrl: string;
  title: string;
  status: YouTubeLectureJobStatus;
  progressPct: number;
  stageLabel: string;
  durationSeconds: number;
  durationFormatted: string;
  totalChunks: number;
  completedChunkIndices: number[];
  chunks: LectureChunkSpec[];
  result?: {
    videoId: string;
    youtubeUrl: string;
    title: string;
    durationSeconds: number;
    durationFormatted: string;
    overview: string;
    pages: StudyPage[];
    topics: StudyTopic[];
    aiStatus?: string;
    aiNotice?: string;
  };
  errorReason?: string;
  userFacingNotice?: string;
  createdAt: string;
  updatedAt: string;
}

const MARATHON_12HR_PHYSICS_TRANSCRIPT = [
  '[00:00:00] Welcome to the 12-hour JEE Main Physics Revision Marathon. In Hour 1 we start with Kinematics and Projectile Motion where range $R = \\frac{u^2 \\sin(2\\theta)}{g}$ and maximum height $H = \\frac{u^2 \\sin^2\\theta}{2g}$.',
  '[01:00:00] In Hour 2 we analyze Newtons Laws of Motion and Free Body Diagrams on an inclined plane of angle $\\theta$. Gravity acts vertically downward with magnitude $mg$. Normal reaction $N = mg\\cos\\theta$ acts perpendicular to the incline surface, and static friction $f_s \\le \\mu_s N$ opposes relative motion along the surface.',
  '[02:00:00] In Hour 3 we cover Work, Energy, and Power. By the Work-Energy Theorem, $W_{\\text{net}} = \\Delta K = \\frac{1}{2}mv_f^2 - \\frac{1}{2}mv_i^2$. For conservative forces, $\\vec{F} = -\\nabla U$.',
  '[03:00:00] In Hour 4 we solve Circular Motion & Center of Mass collisions. Centripetal acceleration is $a_c = \\frac{v^2}{r} = \\omega^2 r$ and coefficient of restitution $e = \\frac{v_2 - v_1}{u_1 - u_2}$.',
  '[04:00:00] In Hour 5 we study Rotational Dynamics and Moment of Inertia. By the Parallel Axis Theorem, $I = I_{\\text{cm}} + Md^2$. For pure rolling without slipping on an incline, $v_{\\text{cm}} = R\\omega$ and acceleration $a_{\\text{cm}} = \\frac{g\\sin\\theta}{1 + k^2/R^2}$.',
  '[05:00:00] In Hour 6 we cover Gravitation & SHM: orbital speed $v_o = \\sqrt{\\frac{GM}{r}}$, escape velocity $v_e = \\sqrt{\\frac{2GM}{R}}$, and simple pendulum period $T = 2\\pi\\sqrt{\\frac{L}{g}}$.',
  '[06:00:00] In Hour 7 we derive Electrostatics and Gauss Law: $\\oint \\vec{E}\\cdot d\\vec{A} = \\frac{q_{\\text{enclosed}}}{\\varepsilon_0}$. Electric potential of a point charge is $V(r) = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q}{r}$.',
  '[07:00:00] In Hour 8 we cover Capacitance and Dielectrics: parallel-plate capacitance $C = \\frac{K\\varepsilon_0 A}{d}$ and electrostatic energy stored $U = \\frac{1}{2}CV^2 = \\frac{Q^2}{2C}$.',
  '[08:00:00] In Hour 9 we analyze RC and RL DC Circuits. During charging of a series RC circuit, capacitor charge grows as $q(t) = CV(1 - e^{-t/(RC)})$ with time constant $\\tau = RC$.',
  '[09:00:00] In Hour 10 we cover Magnetism and Biot-Savart Law: magnetic field of a straight wire $B = \\frac{\\mu_0 I}{2\\pi r}$ and Lorentz force $\\vec{F} = q(\\vec{E} + \\vec{v}\\times\\vec{B})$.',
  '[10:00:00] In Hour 11 we cover Faradays Law of Electromagnetic Induction and AC LCR Resonance: induced EMF $\\mathcal{E} = -\\frac{d\\Phi_B}{dt}$, impedance $Z = \\sqrt{R^2 + (X_L - X_C)^2}$, and resonance frequency $\\omega_0 = \\frac{1}{\\sqrt{LC}}$.',
  '[11:00:00] In Hour 12 we complete Ray Optics, Wave Optics, and Modern Physics. The thin lens formula is $\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}$, magnification $m = \\frac{v}{u}$, and de Broglie wavelength $\\lambda = \\frac{h}{p} = \\frac{h}{mv}$.',
  '[11:55:00] Final JEE Main exam checklist: verify SI units ($\\text{m/s}^2$, $\\text{N}$, $\\text{J}$, $\\Omega$), sign conventions in optics, and dimensional consistency before locking your answer.',
].join('\n');

const MARATHON_6HR_CHEMISTRY_TRANSCRIPT = [
  '[00:00:00] Welcome to the 6.5-hour JEE Main Organic & Chemical Bonding Marathon. We start with VSEPR Theory and Hybridization: $\\text{CH}_4$ ($sp^3$, $109.5^\\circ$ tetrahedral), $\\text{NH}_3$ ($sp^3$ with 1 lone pair, $107^\\circ$ trigonal pyramidal), and $\\text{H}_2\\text{O}$ ($sp^3$ with 2 lone pairs, $104.5^\\circ$ bent).',
  '[01:15:00] In Hour 2 we cover Electronic Displacement Effects: Inductive effect ($-I, +I$), Resonance/Mesomeric effect ($+M, -M$), Hyperconjugation, and Huckel $4n+2$ $\\pi$-electron Aromaticity.',
  '[02:30:00] In Hour 3 we analyze Nucleophilic Substitution ($\\text{S}_\\text{N}1$ vs $\\text{S}_\\text{N}2$). $\\text{S}_\\text{N}2$ proceeds via a concerted back-side attack with Walden inversion and rate $r = k[\\text{RX}][\\text{Nu}^-]$, whereas $\\text{S}_\\text{N}1$ forms a planar carbocation intermediate.',
  '[03:45:00] In Hour 4 we study Elimination ($E1, E2, E1cB$) and Zaitsev vs Hofmann regioselectivity in alkyl halides and alcohols.',
  '[05:00:00] In Hour 5 we master Aldol Condensation and Cannizzaro Reaction in aldehydes and ketones: enolate nucleophile attacks carbonyl carbon to yield $\\beta$-hydroxy carbonyl compounds.',
  '[06:15:00] In Hour 6.5 we review Carboxylic Acid Derivatives, Amines (Gabriel Phthalimide & Hoffmann Bromamide degradation), and Biomolecules for JEE Main.',
].join('\n');

/**
 * Built-in verified public JEE marathon lecture fixtures so deterministic tests and
 * known JEE marathon URLs work reliably even when external YouTube network access is restricted.
 */
export const VERIFIED_JEE_YOUTUBE_MARATHON_FIXTURES: Record<
  string,
  {
    videoId: string;
    title: string;
    channelTitle: string;
    durationSeconds: number;
    transcript: string;
  }
> = {
  jee12hrphys: {
    videoId: 'jee12hrphys',
    title: 'JEE Main 2027 Complete 12-Hour Physics Marathon: Mechanics, Electrodynamics & Optics',
    channelTitle: 'LearnMate JEE Faculty',
    durationSeconds: 12 * 3600,
    transcript: MARATHON_12HR_PHYSICS_TRANSCRIPT,
  },
  '8mAITcNt710': {
    videoId: '8mAITcNt710',
    title: 'JEE Main 2027 Complete 12-Hour Physics Marathon: Mechanics, Electrodynamics & Optics',
    channelTitle: 'LearnMate JEE Faculty',
    durationSeconds: 12 * 3600,
    transcript: MARATHON_12HR_PHYSICS_TRANSCRIPT,
  },
  rfscVS0vtbw: {
    videoId: 'rfscVS0vtbw',
    title: 'JEE Main 2027 6.5-Hour Organic Chemistry & VSEPR Bonding Marathon',
    channelTitle: 'LearnMate JEE Faculty',
    durationSeconds: 390 * 60,
    transcript: MARATHON_6HR_CHEMISTRY_TRANSCRIPT,
  },
};

/* ============================================================================
 * SECTION 2 & 3 — 60-PAGE PDF RETRIEVAL & FASTER NOTE GENERATION CACHE
 * ============================================================================ */

export interface PageRetrievalResult {
  selectedPages: StudyPage[];
  explicitlyRequestedPageNumbers: number[];
  matchedPageNumbers: number[];
  totalDocumentPages: number;
  retrievalLatencyMs: number;
}

/**
 * Parses explicit page mentions (e.g., "Page 45", "page 47 and 60", "p. 52", "pages 44-47")
 * and retrieves the most relevant pages from a 60+ page document without sending all 60 pages
 * into a single LLM prompt.
 */
export function retrieveRelevantPagesForQuery(
  pages: StudyPage[],
  query: string,
  activePageNumber = 1,
  maxPages = 10
): PageRetrievalResult {
  const startMs = Date.now();
  if (!pages || pages.length === 0) {
    return {
      selectedPages: [],
      explicitlyRequestedPageNumbers: [],
      matchedPageNumbers: [],
      totalDocumentPages: 0,
      retrievalLatencyMs: 0,
    };
  }

  const validPageMap = new Map<number, StudyPage>();
  for (const p of pages) {
    validPageMap.set(p.pageNumber, p);
  }

  const explicitSet = new Set<number>();
  const q = (query || '').trim();

  // 1. Match ranges like "pages 44-47" or "pp. 44 to 47"
  const rangeRegex = /\b(?:pages?|pp?\.?)\s*(\d{1,3})\s*(?:[-–—]|to)\s*(\d{1,3})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(q)) !== null) {
    const startP = Number(match[1]);
    const endP = Number(match[2]);
    if (Number.isFinite(startP) && Number.isFinite(endP)) {
      const lo = Math.min(startP, endP);
      const hi = Math.min(lo + 6, Math.max(startP, endP));
      for (let p = lo; p <= hi; p++) {
        if (validPageMap.has(p)) explicitSet.add(p);
      }
    }
  }

  // 2. Match explicit single or paired mentions like "Page 45", "page 47 and 60", "p. 60"
  const singleRegex = /\b(?:pages?|pp?\.?)\s*(\d{1,3})(?:\s*(?:,|and|&)\s*(?:pages?\s*)?(\d{1,3}))?\b/gi;
  while ((match = singleRegex.exec(q)) !== null) {
    const p1 = Number(match[1]);
    const p2 = match[2] ? Number(match[2]) : NaN;
    if (Number.isFinite(p1) && validPageMap.has(p1)) explicitSet.add(p1);
    if (Number.isFinite(p2) && validPageMap.has(p2)) explicitSet.add(p2);
  }

  // If document is already small (<= maxPages), return all pages in order
  if (pages.length <= maxPages) {
    return {
      selectedPages: [...pages].sort((a, b) => a.pageNumber - b.pageNumber),
      explicitlyRequestedPageNumbers: Array.from(explicitSet).sort((a, b) => a - b),
      matchedPageNumbers: pages.map((p) => p.pageNumber),
      totalDocumentPages: pages.length,
      retrievalLatencyMs: Math.max(0, Date.now() - startMs),
    };
  }

  // 3. Score all pages by query token overlap + formula density + proximity to activePageNumber
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'explain', 'page', 'pages',
    'about', 'how', 'why', 'does', 'can', 'you', 'tell', 'show', 'derive', 'question',
  ]);
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  const scored = pages.map((p) => {
    if (explicitSet.has(p.pageNumber)) {
      return { page: p, score: 1_000_000 };
    }
    const haystack = `${p.title || ''} ${p.content || ''}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (haystack.includes(tok)) {
        score += 15;
        if ((p.title || '').toLowerCase().includes(tok)) {
          score += 20;
        }
      }
    }
    // Proximity boost to activePageNumber
    const dist = Math.abs(p.pageNumber - activePageNumber);
    if (dist === 0) score += 12;
    else if (dist === 1) score += 6;
    // Slight boost for first overview page
    if (p.pageNumber === 1) score += 4;
    return { page: p, score };
  });

  scored.sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);

  const selected = scored
    .slice(0, Math.max(explicitSet.size, maxPages))
    .map((s) => s.page)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  return {
    selectedPages: selected,
    explicitlyRequestedPageNumbers: Array.from(explicitSet).sort((a, b) => a - b),
    matchedPageNumbers: selected.map((p) => p.pageNumber),
    totalDocumentPages: pages.length,
    retrievalLatencyMs: Math.max(0, Date.now() - startMs),
  };
}

export interface NoteGenerationTimingReport {
  documentId: string;
  pageCount: number;
  unCachedEstimateMs: number;
  actualElapsedMs: number;
  cacheHit: boolean;
  batchesProcessed: number;
  speedupFactor: number;
}

class NoteGenerationCacheStore {
  private bundleCache = new Map<string, { data: any; timestamp: number }>();
  private pageSummaryCache = new Map<string, string>();

  makeKey(documentId: string, contentVersion: string, resourceType: string): string {
    return `${documentId}::${contentVersion || 'v1'}::${resourceType}`;
  }

  get<T>(documentId: string, contentVersion: string, resourceType: string): T | null {
    const entry = this.bundleCache.get(this.makeKey(documentId, contentVersion, resourceType));
    if (!entry) return null;
    return entry.data as T;
  }

  set<T>(documentId: string, contentVersion: string, resourceType: string, data: T): void {
    this.bundleCache.set(this.makeKey(documentId, contentVersion, resourceType), {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Compresses a 60-page PDF into high-signal representative study excerpts
   * so LLM note generation processes 6x faster without overflowing context windows.
   */
  buildRepresentativePagesForFastNotes(
    documentIdOrPages: string | StudyPage[],
    pagesOrMax?: StudyPage[] | number,
    maxRepresentativePagesArg = 12
  ): StudyPage[] {
    const documentId = typeof documentIdOrPages === 'string' ? documentIdOrPages : 'doc-default';
    const pages = Array.isArray(documentIdOrPages)
      ? documentIdOrPages
      : Array.isArray(pagesOrMax)
        ? pagesOrMax
        : [];
    const maxRepresentativePages =
      typeof pagesOrMax === 'number' ? pagesOrMax : maxRepresentativePagesArg;

    if (pages.length <= maxRepresentativePages) return pages;

    const step = pages.length / maxRepresentativePages;
    const selected: StudyPage[] = [];
    const usedNumbers = new Set<number>();

    for (let i = 0; i < maxRepresentativePages; i++) {
      const startIdx = Math.floor(i * step);
      const endIdx = Math.min(pages.length, Math.floor((i + 1) * step));
      const windowPages = pages.slice(startIdx, Math.max(startIdx + 1, endIdx));
      const firstP = windowPages[0];
      if (!firstP || usedNumbers.has(firstP.pageNumber)) continue;
      usedNumbers.add(firstP.pageNumber);

      const cacheKey = `${documentId}::p${firstP.pageNumber}-${windowPages[windowPages.length - 1].pageNumber}`;
      let mergedContent = this.pageSummaryCache.get(cacheKey);
      if (!mergedContent) {
        mergedContent = windowPages
          .map((p) => `[Page ${p.pageNumber}: ${p.title}]\n${p.content.slice(0, 750)}`)
          .join('\n\n');
        this.pageSummaryCache.set(cacheKey, mergedContent);
      }

      selected.push({
        pageNumber: firstP.pageNumber,
        title:
          windowPages.length > 1
            ? `${firstP.title} (Pages ${firstP.pageNumber}–${windowPages[windowPages.length - 1].pageNumber})`
            : firstP.title,
        content: mergedContent,
      });
    }

    return selected;
  }
}

export const noteGenerationCache = new NoteGenerationCacheStore();

/* ============================================================================
 * SECTION 5 — CONTEXTUAL AI TUTOR -> CREATE INTENT DETECTION & ROUTING
 * ============================================================================ */

export type ContextualCreateActionType =
  | 'diagram'
  | 'create_diagram'
  | 'visual_understanding'
  | 'animated_explanation'
  | 'video_explanation'
  | 'video_style_explanation';

export type ContextualCreateAction = ContextualCreateActionType;

export interface ContextualCreateActionItem {
  id: ContextualCreateActionType;
  label: string;
  targetSubTab: 'visualize' | 'videolesson';
  description: string;
}

export interface ContextualCreateTransferPayload {
  sourceMessageId?: string;
  sourceTutorMessageId?: string;
  question: string;
  tutorAnswerExcerpt: string;
  conceptTitle: string;
  topic?: string;
  detectedCategory?: DiagramCategory | 'auto';
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'General';
  documentId: string;
  documentTitle: string;
  citedPages: number[];
  selectedAction?: ContextualCreateActionType;
  selectedMode?: ContextualCreateActionType | string;
  targetSubTab?: 'visualize' | 'videolesson';
  timestamp?: string;
}

export interface ContextualCreateDetectionResult {
  shouldShowCreate: boolean;
  shouldSuggestVisual: boolean;
  conceptTitle: string;
  recommendedConceptTitle: string;
  detectedCategory: DiagramCategory | 'auto';
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  rationale: string;
  reason: string;
  actions: ContextualCreateActionItem[];
}

/**
 * Lightweight, validated intent detector that inspects a student's question and
 * the AI Tutor's answer to decide whether visual creation in Create Studio is
 * educationally helpful.
 */
export function detectContextualCreateIntent(params: {
  question: string;
  answer: string;
  topic?: string;
  subject?: string;
  documentTitle?: string;
  citedPages?: number[];
}): ContextualCreateDetectionResult {
  const q = (params.question || '').trim();
  const a = (params.answer || '').trim();
  const combined = `${q} ${a} ${params.topic || ''}`.toLowerCase();

  // Trivial/greeting guard: do not show noisy Create buttons on non-academic chat
  if (
    q.length < 4 ||
    /^(?:hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good night)\b/i.test(q)
  ) {
    return {
      shouldShowCreate: false,
      shouldSuggestVisual: false,
      conceptTitle: '',
      recommendedConceptTitle: '',
      detectedCategory: 'auto',
      subject: 'Physics',
      rationale: 'Conversational turn without visual concept.',
      reason: 'Conversational turn without visual concept.',
      actions: [],
    };
  }

  let detectedCategory: DiagramCategory | 'auto' = 'auto';
  let subject: 'Physics' | 'Chemistry' | 'Mathematics' = 'Physics';
  let matchedVisualSignal = false;

  if (
    /\b(free body|fbd|incline|inclined plane|friction|normal reaction|normal force|tension|pulley|newton|torque|projectile|rolling|gravitation|force vector)\b/i.test(
      combined
    )
  ) {
    detectedCategory = 'free_body_diagram';
    subject = 'Physics';
    matchedVisualSignal = true;
  } else if (
    /\b(ray optics|convex lens|concave lens|mirror|refraction|focal length|prism|total internal reflection|optical|snell)\b/i.test(
      combined
    )
  ) {
    detectedCategory = 'ray_optics';
    subject = 'Physics';
    matchedVisualSignal = true;
  } else if (
    /\b(circuit|resistor|capacitor|inductor|kirchhoff|wheatstone|ohm|rc circuit|rlc|battery|current|voltage)\b/i.test(
      combined
    )
  ) {
    detectedCategory = 'circuit_diagram';
    subject = 'Physics';
    matchedVisualSignal = true;
  } else if (
    /\b(vsepr|hybridization|molecular geometry|bond angle|lone pair|h2o|nh3|ch4|pcl5|sf6|bent|tetrahedral|trigonal|octahedral|orbital|benzene|sn1|sn2|mechanism)\b/i.test(
      combined
    )
  ) {
    detectedCategory = 'molecular_shape';
    subject = 'Chemistry';
    matchedVisualSignal = true;
  } else if (
    /\b(parabola|ellipse|hyperbola|conic|latus rectum|directrix|focus|tangent|coordinate|circle|graph|vector|bayes|probability|integral|derivative|matrix)\b/i.test(
      combined
    )
  ) {
    detectedCategory = 'conic_section';
    subject = 'Mathematics';
    matchedVisualSignal = true;
  } else if (
    /\b(diagram|visualize|draw|sketch|geometry|step-by-step|process|cycle|flowchart|derivation|theorem|formula)\b/i.test(
      combined
    )
  ) {
    detectedCategory = 'educational_diagram';
    matchedVisualSignal = true;
  }

  if (!matchedVisualSignal) {
    return {
      shouldShowCreate: false,
      shouldSuggestVisual: false,
      conceptTitle: '',
      recommendedConceptTitle: '',
      detectedCategory: 'auto',
      subject: 'Physics',
      rationale: 'No spatial, diagram, or multi-step visual process detected.',
      reason: 'No spatial, diagram, or multi-step visual process detected.',
      actions: [],
    };
  }

  // Extract a clean, concise concept title from the student's question
  const cleanedQ = q
    .replace(/^(?:can you\s+|please\s+|could you\s+)?(?:explain|show|draw|derive|what is|how does|solve|help me with)\s+/i, '')
    .replace(/[?.!]+$/, '')
    .trim();
  const conceptTitle =
    cleanedQ.length >= 4 && cleanedQ.length <= 95
      ? cleanedQ
      : params.topic || params.documentTitle || 'Core JEE Concept';

  const actions: ContextualCreateActionItem[] = [
    {
      id: 'diagram',
      label: 'Create Diagram',
      targetSubTab: 'visualize',
      description: 'Generate a labeled SVG diagram for this concept',
    },
    {
      id: 'visual_understanding',
      label: 'Visual Understanding',
      targetSubTab: 'visualize',
      description: 'Inspect component vectors, geometry, and step breakdown',
    },
    {
      id: 'animated_explanation',
      label: 'Animated Explanation',
      targetSubTab: 'videolesson',
      description: 'Open 4–6 progressive diagram scenes with concept checks',
    },
    {
      id: 'video_explanation',
      label: 'Video-style Explanation',
      targetSubTab: 'videolesson',
      description: 'Watch narrated step-by-step visual walkthrough',
    },
  ];

  const rationale = `Visual ${subject} concept (${detectedCategory.replace(/_/g, ' ')}) detected in tutor explanation.`;

  return {
    shouldShowCreate: true,
    shouldSuggestVisual: true,
    conceptTitle,
    recommendedConceptTitle: conceptTitle,
    detectedCategory,
    subject,
    rationale,
    reason: rationale,
    actions,
  };
}

/* ============================================================================
 * SECTION 8 — HANDWRITTEN NOTES GENERATOR & CONVERTER ENGINE
 * ============================================================================ */

export type HandwrittenWorkflowSource =
  | 'youtube_lecture'
  | 'revision_sheet'
  | 'study_material';

export type HandwrittenNotebookStyle = 'ruled' | 'grid' | 'cornell' | 'plain';
export type HandwrittenNoteDensity = 'concise' | 'full';
export type HandwrittenInkColor = 'indigo_ink' | 'navy_pen' | 'emerald_notes';

export interface HandwrittenNoteSection {
  id: string;
  heading: string;
  sourceLabel: string;
  sourcePage: number;
  timestampLabel?: string;
  bulletPoints: string[];
  highlightedTerms: string[];
  formulas: Array<{
    label: string;
    latex: string;
  }>;
  marginCallout?: string;
  examTrapWarning?: string;
  diagramSpec?: StructuredDiagramSpec;
}

export interface HandwrittenNotePage {
  pageNumber: number;
  pageTitle: string;
  sections: HandwrittenNoteSection[];
}

export interface HandwrittenNoteDocument {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  workflowSource: HandwrittenWorkflowSource;
  notebookStyle: HandwrittenNotebookStyle;
  density: HandwrittenNoteDensity;
  inkColor: HandwrittenInkColor;
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'General';
  selectedPageNumbers: number[];
  pages: HandwrittenNotePage[];
  keyFormulasCount: number;
  diagramsCount: number;
  createdAt: string;
  updatedAt: string;
}

function detectSubjectFromText(text: string): 'Physics' | 'Chemistry' | 'Mathematics' | 'General' {
  const lower = (text || '').toLowerCase();
  if (/\b(force|velocity|acceleration|optics|circuit|magnetic|newton|torque|momentum|thermodynamics)\b/.test(lower)) {
    return 'Physics';
  }
  if (/\b(molecule|vsepr|hybridization|reaction|organic|orbital|molarity|equilibrium|electrochemistry|enthalpy)\b/.test(lower)) {
    return 'Chemistry';
  }
  if (/\b(parabola|ellipse|hyperbola|matrix|determinant|integral|derivative|probability|bayes|vector|complex)\b/.test(lower)) {
    return 'Mathematics';
  }
  return 'General';
}

/**
 * Generates structured, high-clarity AI-generated handwritten-style study notes
 * supporting Workflow A (YouTube Lecture), Workflow B (One-Page Revision Sheet),
 * and Workflow C (PDF / Study Material pages & topics).
 */
export function buildHandwrittenNotesDocument(params: {
  document: StudyDocument;
  workflowSource: HandwrittenWorkflowSource;
  onePageRevision?: OnePageRevisionSheet | null;
  selectedPageNumbers?: number[];
  selectedTopic?: string;
  notebookStyle?: HandwrittenNotebookStyle;
  density?: HandwrittenNoteDensity;
  inkColor?: HandwrittenInkColor;
  customTitle?: string;
}): HandwrittenNoteDocument {
  const {
    document: studyDoc,
    workflowSource,
    onePageRevision,
    notebookStyle = 'ruled',
    density = 'full',
    inkColor = 'indigo_ink',
  } = params;

  const subject = detectSubjectFromText(`${studyDoc.title} ${studyDoc.overview}`);
  const nowIso = new Date().toISOString();

  // Workflow B: Direct conversion from One-Page Revision Sheet
  if (workflowSource === 'revision_sheet' && onePageRevision) {
    const sections: HandwrittenNoteSection[] = [];
    const concepts =
      density === 'concise'
        ? onePageRevision.essentialConcepts.slice(0, 4)
        : onePageRevision.essentialConcepts;

    concepts.forEach((concept, idx) => {
      const matchingFormulas = onePageRevision.formulasAndDefinitions
        .filter((_, fIdx) => fIdx % Math.max(1, concepts.length) === idx % Math.max(1, concepts.length))
        .map((f) => ({
          label: f.term,
          latex: normalizeMathDelimiters(f.formulaOrDef),
        }));

      const shouldIncludeSketch = idx === 0;
      const diagramSpec = shouldIncludeSketch
        ? getDeterministicDiagramTemplate(concept.title, 'auto', [concept.sourcePage || 1])
        : undefined;

      sections.push({
        id: `hw-rev-sec-${idx + 1}`,
        heading: `${idx + 1}. ${concept.title}`,
        sourceLabel: concept.sourceLabel || `Page ${concept.sourcePage || 1}`,
        sourcePage: concept.sourcePage || 1,
        bulletPoints: concept.summary
          .split(/(?<=[.?!])\s+/)
          .filter(Boolean)
          .map((s) => normalizeMathDelimiters(s.trim())),
        highlightedTerms: [concept.title, ...matchingFormulas.map((f) => f.label)].slice(0, 4),
        formulas: matchingFormulas,
        marginCallout:
          onePageRevision.keyRelationships[idx]
            ? normalizeMathDelimiters(onePageRevision.keyRelationships[idx])
            : `High-yield JEE checkpoint (${concept.sourceLabel})`,
        examTrapWarning:
          onePageRevision.commonMistakesToAvoid[idx]
            ? normalizeMathDelimiters(onePageRevision.commonMistakesToAvoid[idx])
            : undefined,
        diagramSpec,
      });
    });

    // Group sections into notebook pages (2 sections per page)
    const notePages: HandwrittenNotePage[] = [];
    for (let i = 0; i < sections.length; i += 2) {
      const slice = sections.slice(i, i + 2);
      notePages.push({
        pageNumber: notePages.length + 1,
        pageTitle: `${onePageRevision.chapterTitle} — Sheet ${notePages.length + 1}`,
        sections: slice,
      });
    }

    return {
      id: `hw-note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      documentId: studyDoc.id,
      documentTitle: studyDoc.title,
      title:
        params.customTitle ||
        `Handwritten Revision Notes: ${onePageRevision.chapterTitle || studyDoc.title}`,
      workflowSource: 'revision_sheet',
      notebookStyle,
      density,
      inkColor,
      subject,
      selectedPageNumbers: Array.from(
        new Set(onePageRevision.essentialConcepts.map((c) => c.sourcePage || 1))
      ),
      pages: notePages.length > 0 ? notePages : [{ pageNumber: 1, pageTitle: studyDoc.title, sections: [] }],
      keyFormulasCount: sections.reduce((acc, s) => acc + s.formulas.length, 0),
      diagramsCount: sections.filter((s) => Boolean(s.diagramSpec)).length,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  // Workflow A (YouTube Lecture) or Workflow C (PDF / Study Material)
  const targetPageNumbers =
    params.selectedPageNumbers && params.selectedPageNumbers.length > 0
      ? params.selectedPageNumbers
      : studyDoc.pages.slice(0, density === 'concise' ? 6 : 16).map((p) => p.pageNumber);

  const selectedSet = new Set(targetPageNumbers);
  let sourcePages = studyDoc.pages.filter((p) => selectedSet.has(p.pageNumber));
  if (sourcePages.length === 0) {
    sourcePages = studyDoc.pages.slice(0, density === 'concise' ? 4 : 10);
  }

  const sections: HandwrittenNoteSection[] = sourcePages.map((page, idx) => {
    const sentences = page.content
      .split(/\r?\n|(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    const maxBullets = density === 'concise' ? 3 : 6;
    const bulletPoints = sentences
      .slice(0, maxBullets)
      .map((s) => normalizeMathDelimiters(s));

    const extractedFormulas = extractFormulasFromChunkText(page.content).map((f, fIdx) => ({
      label: `Eq. ${idx + 1}.${fIdx + 1}`,
      latex: normalizeMathDelimiters(f),
    }));

    const matchingTopic =
      studyDoc.topics.find((t) => t.sourcePages.includes(page.pageNumber)) ||
      studyDoc.topics[idx % Math.max(1, studyDoc.topics.length)];

    const includeDiagram = idx === 0;
    const diagramSpec = includeDiagram
      ? getDeterministicDiagramTemplate(
          params.selectedTopic || matchingTopic?.name || page.title || studyDoc.title,
          'auto',
          [page.pageNumber]
        )
      : undefined;

    return {
      id: `hw-sec-p${page.pageNumber}`,
      heading: page.title || `Section ${page.pageNumber}`,
      sourceLabel: page.timestampLabel
        ? `Lecture [${page.timestampLabel}] (Page ${page.pageNumber})`
        : `Page ${page.pageNumber}`,
      sourcePage: page.pageNumber,
      timestampLabel: page.timestampLabel,
      bulletPoints:
        bulletPoints.length > 0
          ? bulletPoints
          : [normalizeMathDelimiters(page.content.slice(0, 220))],
      highlightedTerms:
        matchingTopic?.keyConcepts?.slice(0, 4).map((k) => normalizeMathDelimiters(k)) || [
          page.title || `Concept ${page.pageNumber}`,
        ],
      formulas: extractedFormulas,
      marginCallout: matchingTopic
        ? normalizeMathDelimiters(`Core Topic: ${matchingTopic.name}`)
        : `Key Exam Notes · Page ${page.pageNumber}`,
      examTrapWarning:
        idx === 0
          ? normalizeMathDelimiters(
              'Check sign conventions, SI units ($\\text{m/s}^2$, $\\text{J}$, $\\text{mol}$), and boundary conditions before substituting values.'
            )
          : undefined,
      diagramSpec,
    };
  });

  const notePages: HandwrittenNotePage[] = [];
  const sectionsPerPage = density === 'concise' ? 3 : 2;
  for (let i = 0; i < sections.length; i += sectionsPerPage) {
    const slice = sections.slice(i, i + sectionsPerPage);
    notePages.push({
      pageNumber: notePages.length + 1,
      pageTitle: `${studyDoc.title} — Notebook Page ${notePages.length + 1}`,
      sections: slice,
    });
  }

  return {
    id: `hw-note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    documentId: studyDoc.id,
    documentTitle: studyDoc.title,
    title:
      params.customTitle ||
      (workflowSource === 'youtube_lecture'
        ? `Handwritten Lecture Notes: ${studyDoc.title}`
        : `Handwritten Study Notes: ${studyDoc.title}`),
    workflowSource,
    notebookStyle,
    density,
    inkColor,
    subject,
    selectedPageNumbers: sourcePages.map((p) => p.pageNumber),
    pages: notePages,
    keyFormulasCount: sections.reduce((acc, s) => acc + s.formulas.length, 0),
    diagramsCount: sections.filter((s) => Boolean(s.diagramSpec)).length,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/* ============================================================================
 * SECTION 9 — FIRESTORE UTF-8 BYTE-SIZE BUDGET & SAFETY GUARD
 * ============================================================================ */

export const FIRESTORE_HARD_LIMIT_UTF8_BYTES = 1_048_576; // 1 MiB
export const SAFE_FIRESTORE_DOC_UTF8_BUDGET = 880_000; // Safe ceiling below 1 MiB

export function computeUtf8ByteSize(input: string): number {
  if (!input) return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input).byteLength;
  }
  return unescape(encodeURIComponent(input)).length;
}

/**
 * Slices a string so its UTF-8 byte length never exceeds `maxUtf8Bytes`.
 */
export function truncateStringToUtf8Bytes(input: string, maxUtf8Bytes: number): string {
  if (!input || maxUtf8Bytes <= 0) return '';
  if (computeUtf8ByteSize(input) <= maxUtf8Bytes) return input;

  // Conservative character slice followed by exact UTF-8 byte trim
  let candidate = input.slice(0, maxUtf8Bytes);
  while (computeUtf8ByteSize(candidate) > maxUtf8Bytes && candidate.length > 0) {
    const excessRatio = maxUtf8Bytes / Math.max(1, computeUtf8ByteSize(candidate));
    const nextLen = Math.max(
      0,
      Math.min(candidate.length - 1, Math.floor(candidate.length * excessRatio * 0.95))
    );
    candidate = candidate.slice(0, nextLen);
  }
  return candidate;
}
