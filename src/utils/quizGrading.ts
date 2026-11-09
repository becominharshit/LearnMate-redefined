import type {
  QuizQuestion,
  QuizAttempt,
  QuizAttemptAnswer,
  RevisionTask,
  StudyPage,
  StudyTopic,
  StudyDocument,
  TopicProgressComparison,
  OverallProgressSummary,
  StickyNoteItem,
  StickyNoteColor,
  FlashcardItem,
  MindMapData,
  OnePageRevisionSheet,
  FocusSessionRecord,
} from '../types/study';

export const MAX_PDF_PAGES = 60;
export const MAX_PDF_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB
export const MIN_TEXT_LENGTH = 40;

export interface MaterialValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParsedYouTubeUrl {
  valid: boolean;
  videoId?: string;
  canonicalWatchUrl?: string;
  embedUrl?: string;
  startSeconds?: number;
  error?: string;
}

/** True when a stored video id is safe to place in a YouTube embed URL. */
export function isValidYouTubeVideoId(videoId: string | null | undefined): videoId is string {
  return Boolean(videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId));
}

/**
 * Validates and parses a public YouTube URL into a canonical 11-character videoId.
 */
export function parseYouTubeUrl(rawUrl: string): ParsedYouTubeUrl {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please paste a YouTube video link.' };
  }

  let candidateUrl = trimmed;
  if (!/^https?:\/\//i.test(candidateUrl)) {
    candidateUrl = `https://${candidateUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return {
      valid: false,
      error: 'Please enter a valid YouTube URL (e.g. https://www.youtube.com/watch?v=...).',
    };
  }

  const host = parsed.hostname.replace(/^www\./i, '').replace(/^m\./i, '').toLowerCase();
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const vParam = parsed.searchParams.get('v');
    if (vParam) {
      videoId = vParam;
    } else {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (
        segments.length >= 2 &&
        ['embed', 'shorts', 'live', 'v'].includes(segments[0].toLowerCase())
      ) {
        videoId = segments[1];
      }
    }
  } else {
    return {
      valid: false,
      error: 'Only public YouTube URLs (youtube.com or youtu.be) are supported.',
    };
  }

  videoId = videoId.trim();
  if (!isValidYouTubeVideoId(videoId)) {
    return {
      valid: false,
      error: 'Could not find a valid 11-character YouTube video ID in the link.',
    };
  }

  const tParam = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '';
  let startSeconds = 0;
  if (/^\d+$/.test(tParam)) {
    startSeconds = Number(tParam);
  } else {
    const match = tParam.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
    if (match && (match[1] || match[2] || match[3])) {
      startSeconds =
        Number(match[1] || 0) * 3600 +
        Number(match[2] || 0) * 60 +
        Number(match[3] || 0);
    }
  }

  return {
    valid: true,
    videoId,
    canonicalWatchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    startSeconds,
  };
}

/**
 * Formats seconds into MM:SS or HH:MM:SS timestamp label.
 */
export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Computes a deterministic content version fingerprint for caching generated resources.
 */
export function computeContentVersion(doc: Pick<StudyDocument, 'id' | 'sourceType' | 'pageCount' | 'pages'>): string {
  const totalLen = (doc.pages || []).reduce((acc, p) => acc + (p.content?.length || 0), 0);
  return `v1_${doc.sourceType}_${doc.pageCount}_${totalLen}`;
}

/**
 * Formats a source reference badge label depending on document sourceType (PDF Page, Section, or Video Timestamp).
 */
export function formatSourceReferenceLabel(
  doc: Pick<StudyDocument, 'sourceType' | 'pages'>,
  pageNumber: number
): string {
  const page = doc.pages.find((p) => p.pageNumber === pageNumber);
  if (doc.sourceType === 'youtube') {
    if (page?.timestampLabel) return page.timestampLabel;
    if (typeof page?.timestampSeconds === 'number') return formatTimestamp(page.timestampSeconds);
    return formatTimestamp((Math.max(1, pageNumber) - 1) * 120);
  }
  if (doc.sourceType === 'text') {
    return `Section ${pageNumber}`;
  }
  return `Page ${pageNumber}`;
}

/**
 * Computes accurate remaining seconds for the Study Timer using real timestamp deltas
 * so switching tabs or backgrounding the browser never drifts.
 */
export function computeTimerRemainingSeconds(params: {
  isRunning: boolean;
  targetEndTimestamp: number | null;
  fallbackRemainingSeconds: number;
  nowMs?: number;
}): number {
  const { isRunning, targetEndTimestamp, fallbackRemainingSeconds, nowMs = Date.now() } = params;
  if (!isRunning || targetEndTimestamp === null) {
    return Math.max(0, Math.floor(fallbackRemainingSeconds));
  }
  const diffSec = Math.ceil((targetEndTimestamp - nowMs) / 1000);
  return Math.max(0, diffSec);
}

/**
 * Builds deterministic, grounded Sticky Notes (5-8 short notes, 10-30 words each) and Flashcards
 * from a study document's pages and topics when offline or as a base normalization layer.
 */
export function buildGroundedStickyNotesAndFlashcards(params: {
  sourceType: StudyDocument['sourceType'];
  pages: StudyPage[];
  topics: StudyTopic[];
}): {
  stickyNotes: StickyNoteItem[];
  flashcards: FlashcardItem[];
} {
  const { sourceType, pages, topics } = params;
  const colors: StickyNoteColor[] = ['yellow', 'pink', 'blue', 'green'];
  const stickyNotes: StickyNoteItem[] = [];
  const flashcards: FlashcardItem[] = [];

  const getLabel = (pageNum: number) => {
    const p = pages.find((item) => item.pageNumber === pageNum);
    if (sourceType === 'youtube') {
      return p?.timestampLabel || formatTimestamp(p?.timestampSeconds ?? (pageNum - 1) * 120);
    }
    return sourceType === 'text' ? `Section ${pageNum}` : `Page ${pageNum}`;
  };

  for (const page of pages) {
    const bullets = page.content
      .split('\n')
      .map((l) => l.replace(/^[•\-*\d.)\s]+/, '').trim())
      .filter((l) => l.length >= 20 && l.length <= 200);

    for (const line of bullets) {
      if (stickyNotes.length >= 8) break;
      const colonIdx = line.indexOf(':');
      const shortTitle =
        colonIdx > 2 && colonIdx <= 38
          ? line.slice(0, colonIdx).trim()
          : page.title.slice(0, 34);
      const bodyRaw = colonIdx > 2 && colonIdx <= 38 ? line.slice(colonIdx + 1).trim() : line;
      const words = bodyRaw.split(/\s+/).slice(0, 26).join(' ');
      const formulaMatch = line.match(/([A-Za-z0-9_()|+−\-×·/=\s]{4,}=[A-Za-z0-9_()|+−\-×·/=\s²³ⁿ√Σ]+)/);
      const idx = stickyNotes.length;
      const sourceLabel = getLabel(page.pageNumber);

      stickyNotes.push({
        id: `sn-${page.pageNumber}-${idx + 1}`,
        title: shortTitle,
        content: words,
        formula: formulaMatch ? formulaMatch[1].trim().slice(0, 48) : undefined,
        sourcePage: page.pageNumber,
        sourceLabel,
        color: colors[idx % colors.length],
      });

      flashcards.push({
        id: `fc-${page.pageNumber}-${idx + 1}`,
        frontQuestion:
          colonIdx > 2 && colonIdx <= 38
            ? `What is the key rule or definition for ${shortTitle}?`
            : `What key concept is explained in "${page.title}" (${sourceLabel})?`,
        backAnswer: words,
        topic:
          topics.find((t) => t.sourcePages.includes(page.pageNumber))?.name ||
          page.title,
        sourcePage: page.pageNumber,
        sourceLabel,
        status: 'unreviewed',
      });
    }
  }

  // Ensure at least 5 sticky notes & flashcards if material is short
  let fallbackIdx = 0;
  while (stickyNotes.length < 5 && pages.length > 0) {
    const p = pages[fallbackIdx % pages.length];
    const t = topics[fallbackIdx % Math.max(1, topics.length)];
    const sourceLabel = getLabel(p.pageNumber);
    const idx = stickyNotes.length;
    const snippet = (t?.summary || p.content.slice(0, 140))
      .split(/\s+/)
      .slice(0, 24)
      .join(' ');
    stickyNotes.push({
      id: `sn-extra-${idx + 1}`,
      title: (t?.name || p.title || `Concept ${idx + 1}`).slice(0, 36),
      content: snippet,
      sourcePage: p.pageNumber,
      sourceLabel,
      color: colors[idx % colors.length],
    });
    flashcards.push({
      id: `fc-extra-${idx + 1}`,
      frontQuestion: `How does ${t?.name || p.title} work according to ${sourceLabel}?`,
      backAnswer: snippet,
      topic: t?.name || p.title,
      sourcePage: p.pageNumber,
      sourceLabel,
      status: 'unreviewed',
    });
    fallbackIdx += 1;
  }

  return {
    stickyNotes: stickyNotes.slice(0, 8),
    flashcards: flashcards.slice(0, 8),
  };
}

/**
 * Builds a grounded Mind Map and One-Page Revision Sheet from the analyzed study material.
 */
export function buildGroundedMindMapAndRevisionSheet(params: {
  title: string;
  overview: string;
  sourceType: StudyDocument['sourceType'];
  pages: StudyPage[];
  topics: StudyTopic[];
}): {
  mindMap: MindMapData;
  onePageRevision: OnePageRevisionSheet;
} {
  const { title, overview, sourceType, pages, topics } = params;
  const branchColors: Array<'blue' | 'red' | 'yellow' | 'green'> = [
    'blue',
    'red',
    'yellow',
    'green',
  ];

  const getLabel = (pageNum: number) => {
    const p = pages.find((item) => item.pageNumber === pageNum);
    if (sourceType === 'youtube') {
      return p?.timestampLabel || formatTimestamp(p?.timestampSeconds ?? (pageNum - 1) * 120);
    }
    return sourceType === 'text' ? `Section ${pageNum}` : `Page ${pageNum}`;
  };

  const nodes: MindMapData['nodes'] = [
    {
      id: 'node-central',
      label: title.replace(/\.pdf$/i, '').slice(0, 38),
      explanation: overview || `Central topic covering ${pages.length} sections.`,
      sourcePage: 1,
      sourceLabel: getLabel(1),
      level: 'central',
      color: 'blue',
    },
  ];
  const edges: MindMapData['edges'] = [];

  const effectiveTopics: StudyTopic[] =
    topics.length > 0
      ? topics.slice(0, 6)
      : pages.slice(0, 5).map((p, i) => ({
          id: `top-${i + 1}`,
          name: p.title || `Topic ${i + 1}`,
          summary: p.content.slice(0, 140),
          keyConcepts: [p.title],
          sourcePages: [p.pageNumber],
        }));

  effectiveTopics.slice(0, 6).forEach((topic, bIdx) => {
    const color = branchColors[bIdx % branchColors.length];
    const pageNum = topic.sourcePages[0] || 1;
    const branchId = `node-branch-${bIdx + 1}`;
    nodes.push({
      id: branchId,
      label: topic.name.slice(0, 34),
      explanation: topic.summary,
      sourcePage: pageNum,
      sourceLabel: getLabel(pageNum),
      level: 'branch',
      color,
      parentId: 'node-central',
    });
    edges.push({
      from: 'node-central',
      to: branchId,
      relation: 'core topic',
    });

    (topic.keyConcepts || []).slice(0, 2).forEach((concept, cIdx) => {
      const subId = `node-sub-${bIdx + 1}-${cIdx + 1}`;
      nodes.push({
        id: subId,
        label: concept.slice(0, 30),
        explanation: `Key concept under ${topic.name} (${getLabel(pageNum)}): ${topic.summary}`,
        sourcePage: pageNum,
        sourceLabel: getLabel(pageNum),
        level: 'subtopic',
        color,
        parentId: branchId,
      });
      edges.push({
        from: branchId,
        to: subId,
      });
    });
  });

  const formulasAndDefinitions: OnePageRevisionSheet['formulasAndDefinitions'] = [];
  const commonMistakesToAvoid: string[] = [];

  for (const p of pages) {
    const lines = p.content
      .split('\n')
      .map((l) => l.replace(/^[•\-*\d.)\s]+/, '').trim())
      .filter(Boolean);
    for (const line of lines) {
      if (
        (line.includes('=') || line.includes(':')) &&
        formulasAndDefinitions.length < 6 &&
        line.length >= 15 &&
        line.length <= 160
      ) {
        const parts = line.split(':');
        formulasAndDefinitions.push({
          term:
            parts.length > 1 && parts[0].length <= 42
              ? parts[0].trim()
              : p.title.slice(0, 36),
          formulaOrDef: parts.length > 1 ? parts.slice(1).join(':').trim() : line,
          sourceLabel: getLabel(p.pageNumber),
        });
      }
      if (
        /pitfall|misconception|critical|note:|incorrect|cannot|important/i.test(line) &&
        commonMistakesToAvoid.length < 4
      ) {
        commonMistakesToAvoid.push(`${line} (${getLabel(p.pageNumber)})`);
      }
    }
  }

  if (commonMistakesToAvoid.length === 0) {
    commonMistakesToAvoid.push(
      `Always verify boundary conditions and definitions in ${getLabel(1)} before applying formulas.`
    );
  }

  const onePageRevision: OnePageRevisionSheet = {
    chapterTitle: title,
    overview: overview || `One-page revision sheet for ${title}.`,
    essentialConcepts: effectiveTopics.map((t) => {
      const pNum = t.sourcePages[0] || 1;
      return {
        title: t.name,
        summary: t.summary,
        sourcePage: pNum,
        sourceLabel: getLabel(pNum),
      };
    }),
    formulasAndDefinitions:
      formulasAndDefinitions.length > 0
        ? formulasAndDefinitions
        : effectiveTopics.slice(0, 4).map((t) => ({
            term: t.name,
            formulaOrDef: (t.keyConcepts || []).join(' · ') || t.summary,
            sourceLabel: getLabel(t.sourcePages[0] || 1),
          })),
    keyRelationships: effectiveTopics.slice(0, 4).map((t, i) => {
      const next = effectiveTopics[(i + 1) % effectiveTopics.length];
      return `${t.name} (${getLabel(t.sourcePages[0] || 1)}) connects directly to ${next.name} via ${(t.keyConcepts && t.keyConcepts[0]) || 'shared foundational principles'}.`;
    }),
    commonMistakesToAvoid,
    quickRecallQuestions: effectiveTopics.slice(0, 4).map((t) => ({
      question: `What is the core principle of ${t.name} (${getLabel(t.sourcePages[0] || 1)})?`,
      shortAnswer: t.summary,
    })),
  };

  return {
    mindMap: {
      centralTopic: title.replace(/\.pdf$/i, ''),
      nodes,
      edges,
    },
    onePageRevision,
  };
}

/**
 * Validates uploaded PDF metadata or pasted text before processing.
 */
export function validateMaterialInput(params: {
  sourceType: 'pdf' | 'text';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  pageCount?: number;
  textContent?: string;
}): MaterialValidationResult {
  if (params.sourceType === 'pdf') {
    const isPdfMime =
      params.mimeType === 'application/pdf' ||
      (params.fileName && params.fileName.toLowerCase().endsWith('.pdf'));
    if (!isPdfMime) {
      return { valid: false, error: 'Please upload a valid PDF file (.pdf).' };
    }
    if (typeof params.fileSize === 'number' && params.fileSize > MAX_PDF_SIZE_BYTES) {
      return {
        valid: false,
        error: 'File size exceeds the 20 MB limit. Please choose a smaller PDF.',
      };
    }
    if (typeof params.pageCount === 'number') {
      if (params.pageCount < 1) {
        return { valid: false, error: 'The uploaded PDF appears to have no pages.' };
      }
      if (params.pageCount > MAX_PDF_PAGES) {
        return {
          valid: false,
          error: `This PDF has ${params.pageCount} pages. LearnMate supports up to ${MAX_PDF_PAGES} pages per upload.`,
        };
      }
    }
    if (typeof params.textContent === 'string' && params.textContent.trim().length < 20) {
      return {
        valid: false,
        error:
          'Could not extract selectable text from this PDF. Please upload a text-based PDF or paste your notes directly.',
      };
    }
    return { valid: true };
  }

  const trimmed = (params.textContent || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Please paste or enter study notes before continuing.' };
  }
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Please provide at least ${MIN_TEXT_LENGTH} characters of study notes so LearnMate can extract topics and generate questions.`,
    };
  }
  return { valid: true };
}

/**
 * Splits raw pasted study notes into page-indexed sections (up to 20 pages).
 * Respects explicit "--- Page X ---" markers or groups paragraphs into logical pages (~1200 chars each).
 */
export function splitTextIntoPages(rawText: string): StudyPage[] {
  const cleaned = rawText.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  // Check if explicit page markers exist
  const explicitPageRegex = /(?:^|\n)(?:---\s*Page\s*\d+\s*---|Page\s+\d+\s*:)/i;
  if (explicitPageRegex.test(cleaned)) {
    const chunks = cleaned
      .split(/(?:^|\n)(?:---\s*Page\s*\d+\s*---|Page\s+\d+\s*:)/i)
      .map((c) => c.trim())
      .filter(Boolean);
    return chunks.slice(0, MAX_PDF_PAGES).map((content, idx) => {
      const firstLine = content.split('\n')[0]?.replace(/^[#*\-\s]+/, '').trim() || '';
      const title =
        firstLine.length > 3 && firstLine.length <= 70 ? firstLine : `Section ${idx + 1}`;
      return {
        pageNumber: idx + 1,
        title,
        content,
      };
    });
  }

  // Group paragraphs into logical pages of ~1100 characters
  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pages: StudyPage[] = [];
  let currentBuffer: string[] = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    if (currentLength + para.length > 1100 && currentBuffer.length > 0 && pages.length < MAX_PDF_PAGES - 1) {
      const content = currentBuffer.join('\n\n');
      const firstLine = currentBuffer[0].split('\n')[0].replace(/^[#*\-\s]+/, '').trim();
      pages.push({
        pageNumber: pages.length + 1,
        title: firstLine.length > 3 && firstLine.length <= 68 ? firstLine : `Section ${pages.length + 1}`,
        content,
      });
      currentBuffer = [para];
      currentLength = para.length;
    } else {
      currentBuffer.push(para);
      currentLength += para.length;
    }
  }

  if (currentBuffer.length > 0) {
    const content = currentBuffer.join('\n\n');
    const firstLine = currentBuffer[0].split('\n')[0].replace(/^[#*\-\s]+/, '').trim();
    pages.push({
      pageNumber: pages.length + 1,
      title: firstLine.length > 3 && firstLine.length <= 68 ? firstLine : `Section ${pages.length + 1}`,
      content,
    });
  }

  return pages.slice(0, MAX_PDF_PAGES);
}

/**
 * Parses a pasted YouTube transcript into timestamped StudyPage segments (up to 10 segments).
 * Supports standard YouTube transcript formats where timestamps like "0:00", "02:15", "[12:04]"
 * or "1:04:20" appear on their own line or at the beginning of a line.
 */
export function parseTranscriptIntoTimestampedPages(rawTranscript: string): StudyPage[] {
  const cleaned = (rawTranscript || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const parseClockToSeconds = (clock: string): number => {
    const parts = clock.split(':').map((n) => Number(n));
    if (parts.some((n) => Number.isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: Array<{ seconds: number; text: string }> = [];
  let pendingSeconds: number | null = null;

  for (const line of lines) {
    const standaloneMatch = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?$/);
    if (standaloneMatch) {
      pendingSeconds = parseClockToSeconds(standaloneMatch[1]);
      continue;
    }

    const prefixMatch = line.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—:]?\s*(.+)$/);
    if (prefixMatch) {
      entries.push({
        seconds: parseClockToSeconds(prefixMatch[1]),
        text: prefixMatch[2].trim(),
      });
      pendingSeconds = null;
      continue;
    }

    entries.push({
      seconds: pendingSeconds ?? (entries.length > 0 ? entries[entries.length - 1].seconds : 0),
      text: line,
    });
    pendingSeconds = null;
  }

  if (entries.length === 0) return [];

  const maxSegments = 10;
  const targetChars = Math.max(500, Math.ceil(cleaned.length / maxSegments));
  const pages: StudyPage[] = [];
  let chunkTexts: string[] = [];
  let chunkStartSeconds = entries[0].seconds;
  let chunkLen = 0;

  const flushChunk = () => {
    if (chunkTexts.length === 0) return;
    const content = chunkTexts.join(' ');
    const label = formatTimestamp(chunkStartSeconds);
    const snippet = chunkTexts[0].replace(/^[#*\-\s]+/, '').trim();
    const shortHeading =
      snippet.length > 48 ? `${snippet.slice(0, 45).trim()}…` : snippet || `Segment ${pages.length + 1}`;
    pages.push({
      pageNumber: pages.length + 1,
      title: `${label} — ${shortHeading}`,
      content,
      timestampSeconds: chunkStartSeconds,
      timestampLabel: label,
    });
    chunkTexts = [];
    chunkLen = 0;
  };

  for (const entry of entries) {
    if (chunkTexts.length === 0) {
      chunkStartSeconds = entry.seconds;
    }
    chunkTexts.push(entry.text);
    chunkLen += entry.text.length + 1;

    if (chunkLen >= targetChars && pages.length < maxSegments - 1) {
      flushChunk();
    }
  }
  flushChunk();

  return pages;
}

/**
 * Deterministic quiz grading against validated question answer keys.
 */
export function gradeQuizSubmission(params: {
  attemptId: string;
  documentId: string;
  documentTitle: string;
  mode: 'diagnostic' | 'adaptive';
  targetTopics?: string[];
  questions: QuizQuestion[];
  selectedIndices: Record<string, number>;
  completedAt?: string;
}): QuizAttempt {
  const {
    attemptId,
    documentId,
    documentTitle,
    mode,
    targetTopics,
    questions,
    selectedIndices,
    completedAt = new Date().toISOString(),
  } = params;

  const answers: QuizAttemptAnswer[] = [];
  const topicStats = new Map<string, { correct: number; total: number }>();

  let score = 0;

  for (const q of questions) {
    const rawSelected = selectedIndices[q.id];
    const selectedIndex = typeof rawSelected === 'number' ? rawSelected : -1;
    const isCorrect = selectedIndex === q.correctIndex;

    if (isCorrect) {
      score += 1;
    }

    answers.push({
      questionId: q.id,
      selectedIndex,
      isCorrect,
      topic: q.topic,
      sourcePage: q.sourcePage,
    });

    const stat = topicStats.get(q.topic) || { correct: 0, total: 0 };
    stat.total += 1;
    if (isCorrect) stat.correct += 1;
    topicStats.set(q.topic, stat);
  }

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  const weakTopics: string[] = [];
  const strongTopics: string[] = [];

  for (const [topic, stat] of topicStats.entries()) {
    const topicAccuracy = stat.total > 0 ? stat.correct / stat.total : 0;
    if (topicAccuracy < 1) {
      weakTopics.push(topic);
    } else {
      strongTopics.push(topic);
    }
  }

  return {
    id: attemptId,
    documentId,
    documentTitle,
    mode,
    targetTopics,
    questions,
    answers,
    score,
    totalQuestions,
    percentage,
    weakTopics,
    strongTopics,
    completedAt,
  };
}

/**
 * Updates an existing revision plan based on an adaptive practice or subsequent quiz attempt.
 */
export function updateRevisionPlanWithAttempt(
  existingPlan: RevisionTask[],
  attempt: QuizAttempt
): RevisionTask[] {
  const now = new Date().toISOString();
  const topicAccuracyMap = new Map<string, { correct: number; total: number; page: number }>();

  for (const ans of attempt.answers) {
    const current = topicAccuracyMap.get(ans.topic) || {
      correct: 0,
      total: 0,
      page: ans.sourcePage,
    };
    current.total += 1;
    if (ans.isCorrect) current.correct += 1;
    topicAccuracyMap.set(ans.topic, current);
  }

  const updated = existingPlan.map((task) => {
    const perf = topicAccuracyMap.get(task.topic);
    if (!perf) return task;

    const ratio = perf.total > 0 ? perf.correct / perf.total : 0;
    if (ratio === 1) {
      return {
        ...task,
        completed: true,
        priority: 'low' as const,
        reason: `Mastered in ${attempt.mode === 'adaptive' ? 'Adaptive Practice' : 'Quiz'} (${perf.correct}/${perf.total} correct).`,
        updatedAt: now,
      };
    }

    return {
      ...task,
      completed: false,
      priority: ratio < 0.5 ? ('high' as const) : ('medium' as const),
      reason: `Scored ${perf.correct}/${perf.total} in latest ${attempt.mode} attempt — review Page ${task.sourcePage} again.`,
      updatedAt: now,
    };
  });

  // Add any newly discovered weak topics not yet in the plan
  for (const weakTopic of attempt.weakTopics) {
    const exists = updated.some((t) => t.topic.toLowerCase() === weakTopic.toLowerCase());
    if (!exists) {
      const perf = topicAccuracyMap.get(weakTopic);
      const relatedQuestion = attempt.questions.find((q) => q.topic === weakTopic);
      updated.push({
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        documentId: attempt.documentId,
        topic: weakTopic,
        priority: 'high',
        reason: `Missed ${perf ? perf.total - perf.correct : 1} question(s) during ${attempt.mode} quiz.`,
        recommendedAction: `Re-read Page ${relatedQuestion?.sourcePage || 1} and complete a targeted Adaptive Practice round on ${weakTopic}.`,
        conceptSummary: relatedQuestion?.explanation || `Review core definitions and examples for ${weakTopic}.`,
        sourcePage: relatedQuestion?.sourcePage || 1,
        completed: false,
        updatedAt: now,
      });
    }
  }

  const priorityOrder: Record<RevisionTask['priority'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return updated.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Computes real topic-level improvement across chronological quiz attempts.
 * Never fabricates progress; returns empty array if no attempts exist.
 */
export function computeTopicProgress(attempts: QuizAttempt[]): TopicProgressComparison[] {
  if (!attempts || attempts.length === 0) return [];

  // Sort chronological ascending (oldest first)
  const sorted = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  const perTopicHistory = new Map<
    string,
    {
      attemptScores: number[];
      totalCorrect: number;
      totalQuestions: number;
    }
  >();

  for (const attempt of sorted) {
    const attemptTopicMap = new Map<string, { correct: number; total: number }>();
    for (const ans of attempt.answers) {
      const entry = attemptTopicMap.get(ans.topic) || { correct: 0, total: 0 };
      entry.total += 1;
      if (ans.isCorrect) entry.correct += 1;
      attemptTopicMap.set(ans.topic, entry);
    }

    for (const [topic, stat] of attemptTopicMap.entries()) {
      const pct = Math.round((stat.correct / stat.total) * 100);
      const history = perTopicHistory.get(topic) || {
        attemptScores: [],
        totalCorrect: 0,
        totalQuestions: 0,
      };
      history.attemptScores.push(pct);
      history.totalCorrect += stat.correct;
      history.totalQuestions += stat.total;
      perTopicHistory.set(topic, history);
    }
  }

  const comparisons: TopicProgressComparison[] = [];
  for (const [topic, data] of perTopicHistory.entries()) {
    const firstScorePct = data.attemptScores[0] ?? 0;
    const latestScorePct = data.attemptScores[data.attemptScores.length - 1] ?? 0;
    const deltaPct = latestScorePct - firstScorePct;

    let status: TopicProgressComparison['status'] = 'steady';
    if (latestScorePct >= 85) {
      status = 'mastered';
    } else if (deltaPct > 0) {
      status = 'improved';
    } else if (latestScorePct < 60) {
      status = 'needs-work';
    }

    comparisons.push({
      topic,
      firstScorePct,
      latestScorePct,
      attemptsCount: data.attemptScores.length,
      totalCorrect: data.totalCorrect,
      totalQuestions: data.totalQuestions,
      deltaPct,
      status,
    });
  }

  return comparisons.sort((a, b) => a.latestScorePct - b.latestScorePct);
}

/**
 * Computes overall summary metrics from real quiz attempts.
 */
export function computeOverallProgressSummary(attempts: QuizAttempt[]): OverallProgressSummary {
  if (!attempts || attempts.length === 0) {
    return {
      totalAttempts: 0,
      diagnosticCount: 0,
      adaptiveCount: 0,
      averageScorePct: 0,
      firstAttemptPct: null,
      latestAttemptPct: null,
      overallDeltaPct: null,
      masteredTopicsCount: 0,
      weakTopicsCount: 0,
    };
  }

  const sorted = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  const totalAttempts = sorted.length;
  const diagnosticCount = sorted.filter((a) => a.mode === 'diagnostic').length;
  const adaptiveCount = sorted.filter((a) => a.mode === 'adaptive').length;
  const sumPct = sorted.reduce((acc, a) => acc + a.percentage, 0);
  const averageScorePct = Math.round(sumPct / totalAttempts);

  const firstAttemptPct = sorted[0].percentage;
  const latestAttemptPct = sorted[sorted.length - 1].percentage;
  const overallDeltaPct = totalAttempts > 1 ? latestAttemptPct - firstAttemptPct : 0;

  const topicBreakdown = computeTopicProgress(sorted);
  const masteredTopicsCount = topicBreakdown.filter((t) => t.status === 'mastered').length;
  const weakTopicsCount = topicBreakdown.filter((t) => t.status === 'needs-work').length;

  return {
    totalAttempts,
    diagnosticCount,
    adaptiveCount,
    averageScorePct,
    firstAttemptPct,
    latestAttemptPct,
    overallDeltaPct,
    masteredTopicsCount,
    weakTopicsCount,
  };
}

/**
 * Generates a formatted plain-text offline report summarizing quiz results,
 * topic-level mastery, revision plan task status, and focus sessions.
 */
export function generateStudyProgressReportText(params: {
  attempts: QuizAttempt[];
  revisionTasks: RevisionTask[];
  focusSessions?: FocusSessionRecord[];
  filterLabel?: string;
  generatedAt?: string;
}): string {
  const {
    attempts,
    revisionTasks,
    focusSessions = [],
    filterLabel = 'All Study Materials',
    generatedAt = new Date().toISOString(),
  } = params;

  const summary = computeOverallProgressSummary(attempts);
  const topicComparisons = computeTopicProgress(attempts);
  const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  const lines: string[] = [
    '============================================================',
    '               LEARNMATE STUDY PROGRESS REPORT              ',
    '============================================================',
    `Material Scope : ${filterLabel}`,
    `Generated At   : ${new Date(generatedAt).toLocaleString()}`,
    `Focus Sessions : ${focusSessions.length} completed (${totalFocusMinutes} mins total)`,
    '',
    '1. OVERALL QUIZ PERFORMANCE SUMMARY',
    '------------------------------------------------------------',
  ];

  if (attempts.length === 0) {
    lines.push('No quiz attempts recorded yet.');
  } else {
    lines.push(`Total Completed Quizzes : ${summary.totalAttempts} (${summary.diagnosticCount} diagnostic, ${summary.adaptiveCount} adaptive)`);
    lines.push(`Average Accuracy        : ${summary.averageScorePct}%`);
    lines.push(`First Attempt Score     : ${summary.firstAttemptPct ?? 0}%`);
    lines.push(`Latest Attempt Score    : ${summary.latestAttemptPct ?? 0}%`);
    const deltaSign = (summary.overallDeltaPct ?? 0) >= 0 ? '+' : '';
    lines.push(`Overall Improvement     : ${deltaSign}${summary.overallDeltaPct ?? 0}%`);
    lines.push(`Topics Mastered         : ${summary.masteredTopicsCount}`);
    lines.push(`Topics Needing Review   : ${summary.weakTopicsCount}`);
  }

  lines.push('');
  lines.push('2. TOPIC-LEVEL MASTERY & IMPROVEMENT');
  lines.push('------------------------------------------------------------');
  if (topicComparisons.length === 0) {
    lines.push('No topic-level quiz data available yet.');
  } else {
    for (const item of topicComparisons) {
      const sign = item.deltaPct >= 0 ? '+' : '';
      lines.push(
        `• ${item.topic} [${item.status.toUpperCase()}]: ${item.firstScorePct}% -> ${item.latestScorePct}% (${sign}${item.deltaPct}%) | ${item.totalCorrect}/${item.totalQuestions} correct across ${item.attemptsCount} attempt(s)`
      );
    }
  }

  lines.push('');
  lines.push('3. PERSONALIZED REVISION PLAN STATUS');
  lines.push('------------------------------------------------------------');
  if (revisionTasks.length === 0) {
    lines.push('No revision tasks generated yet.');
  } else {
    const completedCount = revisionTasks.filter((t) => t.completed).length;
    lines.push(`Completed Tasks: ${completedCount} of ${revisionTasks.length}`);
    lines.push('');
    for (const task of revisionTasks) {
      const statusTag = task.completed ? '[COMPLETED]' : '[PENDING]';
      lines.push(
        `${statusTag} ${task.topic} (Priority: ${task.priority.toUpperCase()}, Source: Page ${task.sourcePage})`
      );
      lines.push(`   Reason : ${task.reason}`);
      lines.push(`   Action : ${task.recommendedAction}`);
    }
  }

  lines.push('');
  lines.push('4. QUIZ ATTEMPT HISTORY');
  lines.push('------------------------------------------------------------');
  if (attempts.length === 0) {
    lines.push('No quiz attempts logged.');
  } else {
    for (const att of attempts) {
      const modeLabel = att.mode === 'adaptive' ? 'Adaptive Practice' : 'Diagnostic Quiz';
      lines.push(
        `• [${new Date(att.completedAt).toLocaleString()}] ${att.documentTitle} — ${modeLabel}: ${att.score}/${att.totalQuestions} (${att.percentage}%)`
      );
    }
  }

  lines.push('============================================================');
  return lines.join('\n');
}


