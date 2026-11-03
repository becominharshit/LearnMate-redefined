import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyGeminiError,
  computeBackoffDelayMs,
  GeminiRequestManager,
  isGenericDocumentTitle,
  extractPreciseEducationalConcepts,
  buildSpecificYouTubeSearchQuery,
  parseIsoDurationSeconds,
  rankAndFilterYouTubeCandidates,
  upsertStreamingTranscriptChunk,
  finalizeActiveTranscriptTurn,
  type VoiceTranscriptEntry,
} from './stabilityEngine';

test('classifyGeminiError distinguishes transient 429, daily quota exhaustion, and auth errors', () => {
  const transient429 = classifyGeminiError(
    Object.assign(new Error('429 Too Many Requests: Resource has been exhausted (e.g. check RPM). retryDelay: "2s"'), {
      status: 429,
    })
  );
  assert.equal(transient429.category, 'temporarily_busy');
  assert.equal(transient429.retryable, true);
  assert.equal(transient429.userMessage, 'The AI is temporarily busy. Try again shortly.');
  assert.equal(transient429.retryAfterMs, 2000);

  const dailyQuota = classifyGeminiError(
    Object.assign(
      new Error(
        'You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash'
      ),
      { status: 429 }
    )
  );
  assert.equal(dailyQuota.category, 'quota_exhausted');
  assert.equal(dailyQuota.retryable, false);
  assert.equal(dailyQuota.userMessage, "Your project's AI quota has been reached.");

  const authErr = classifyGeminiError(
    Object.assign(new Error('API_KEY_INVALID: API key not valid.'), { status: 403 })
  );
  assert.equal(authErr.category, 'auth_config_error');
  assert.equal(authErr.retryable, false);
  assert.equal(authErr.userMessage, 'Generation failed. Your existing notes are safe.');

  const missingKey = classifyGeminiError(new Error('NO_API_KEY'));
  assert.equal(missingKey.category, 'auth_config_error');
  assert.equal(missingKey.retryable, false);
  assert.match(missingKey.userMessage, /not set up on this server/);

  const prepayDepleted = classifyGeminiError(
    Object.assign(
      new Error(
        'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.'
      ),
      { status: 402 }
    )
  );
  assert.equal(prepayDepleted.category, 'quota_exhausted');
  assert.equal(prepayDepleted.retryable, false);
  assert.equal(prepayDepleted.statusCode, 402);
});

test('GeminiRequestManager deduplicates rapid identical requests, caches results, and retries transient 429s', async () => {
  let callCount = 0;
  const logs: string[] = [];

  const manager = new GeminiRequestManager({
    maxConcurrency: 2,
    maxRetries: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
    sleepFn: async () => {},
    onLog: (entry) => logs.push(`${entry.operation}:${entry.status}:r${entry.retries}`),
  });

  // 1. Test transient 429 recovery on second try
  const res1 = await manager.execute({
    operation: 'quiz',
    model: 'gemini-3.8-flash',
    cacheKey: 'quiz:doc1:diag',
    task: async () => {
      callCount += 1;
      if (callCount === 1) {
        const err = new Error('429 rate limit exceeded');
        throw err;
      }
      return { questions: ['Q1', 'Q2'] };
    },
  });

  assert.deepEqual(res1, { questions: ['Q1', 'Q2'] });
  assert.equal(callCount, 2);

  // 2. Reopening cached resource hits cache without calling task again
  const cachedRes = await manager.execute({
    operation: 'quiz',
    model: 'gemini-3.8-flash',
    cacheKey: 'quiz:doc1:diag',
    task: async () => {
      callCount += 1;
      return { questions: ['Should not run'] };
    },
  });
  assert.deepEqual(cachedRes, { questions: ['Q1', 'Q2'] });
  assert.equal(callCount, 2);

  // 3. Rapid duplicate clicks on in-flight request deduplicate to a single execution
  let inFlightCalls = 0;
  const [dupA, dupB, dupC] = await Promise.all([
    manager.execute({
      operation: 'sticky_notes',
      model: 'gemini-3.8-flash',
      cacheKey: 'sticky:doc2',
      task: async () => {
        inFlightCalls += 1;
        await new Promise((r) => setTimeout(r, 15));
        return ['Note 1'];
      },
    }),
    manager.execute({
      operation: 'sticky_notes',
      model: 'gemini-3.8-flash',
      cacheKey: 'sticky:doc2',
      task: async () => {
        inFlightCalls += 1;
        return ['Note 2'];
      },
    }),
    manager.execute({
      operation: 'sticky_notes',
      model: 'gemini-3.8-flash',
      cacheKey: 'sticky:doc2',
      task: async () => {
        inFlightCalls += 1;
        return ['Note 3'];
      },
    }),
  ]);

  assert.equal(inFlightCalls, 1);
  assert.deepEqual(dupA, ['Note 1']);
  assert.deepEqual(dupB, ['Note 1']);
  assert.deepEqual(dupC, ['Note 1']);
});

test('GeminiRequestManager never retries exhausted daily quota or auth errors', async () => {
  let quotaAttempts = 0;
  const manager = new GeminiRequestManager({
    maxRetries: 3,
    sleepFn: async () => {},
  });

  await assert.rejects(
    async () => {
      await manager.execute({
        operation: 'analyze',
        model: 'gemini-3.8-flash',
        task: async () => {
          quotaAttempts += 1;
          throw new Error('Quota exceeded for quota metric GenerateRequestsPerDay');
        },
      });
    },
    (err: Error) => {
      assert.equal(err.message, "Your project's AI quota has been reached.");
      return true;
    }
  );
  assert.equal(quotaAttempts, 1);
});

test('extractPreciseEducationalConcepts ignores generic document titles and extracts real chapter concepts', () => {
  assert.equal(isGenericDocumentTitle('Semester 1 Revision.pdf'), true);
  assert.equal(isGenericDocumentTitle('Exam Guide'), true);
  assert.equal(isGenericDocumentTitle('80/20 Notes'), true);
  assert.equal(isGenericDocumentTitle('Chapter 3 Notes'), true);
  assert.equal(isGenericDocumentTitle('Bayes Theorem and Conditional Probability'), false);

  const concepts = extractPreciseEducationalConcepts({
    documentTitle: 'Semester 1 Revision.pdf',
    weakTopics: ['Bayes Theorem'],
    topics: [
      {
        name: 'Exam Guide',
        keyConcepts: ['Law of Total Probability', 'Conditional Independence'],
      },
      {
        name: 'Discrete Random Variables',
        keyConcepts: ['Probability Mass Function'],
      },
    ],
    pageTitles: ['Page 1', '02:15 — Kolmogorov Axioms'],
  });

  assert.ok(concepts.length >= 3 && concepts.length <= 5);
  assert.equal(concepts[0], 'Bayes Theorem');
  assert.ok(!concepts.some((c) => /semester 1 revision|exam guide/i.test(c)));
  assert.ok(concepts.includes('Discrete Random Variables'));

  const query = buildSpecificYouTubeSearchQuery({
    concept: 'Bayes Theorem',
    documentTitle: 'Semester 1 Revision.pdf',
    topics: ['Probability Distributions'],
  });
  assert.ok(!/semester 1 revision/i.test(query));
  assert.match(query, /Bayes Theorem/i);
  assert.match(query, /tutorial|explanation/i);
});

test('rankAndFilterYouTubeCandidates rejects unrelated/clickbait videos and returns top 3 educational matches', () => {
  assert.equal(parseIsoDurationSeconds('PT15M30S'), 930);
  assert.equal(parseIsoDurationSeconds('PT45S'), 45);

  const candidates = [
    {
      videoId: 'vid-clickbait',
      title: 'INSANE Casino Prank Reaction!! Bayes Giveaway #shorts',
      channelTitle: 'Daily Vlogs',
      description: 'Subscribe for giveaway!',
      thumbnailUrl: 'https://i.ytimg.com/vi/1/hqdefault.jpg',
      watchUrl: 'https://www.youtube.com/watch?v=vid-clickbait',
      durationSeconds: 40,
    },
    {
      videoId: 'vid-unrelated',
      title: 'How to Bake Sourdough Bread at Home',
      channelTitle: 'Kitchen Chef',
      description: 'Complete baking guide for beginners',
      thumbnailUrl: 'https://i.ytimg.com/vi/2/hqdefault.jpg',
      watchUrl: 'https://www.youtube.com/watch?v=vid-unrelated',
      durationSeconds: 600,
    },
    {
      videoId: 'vid-mit-bayes',
      title: 'Bayes Theorem and Conditional Probability Explained | MIT Lecture',
      channelTitle: 'MIT OpenCourseWare',
      description: 'Full university lecture covering prior, likelihood, posterior, and law of total probability with worked examples.',
      thumbnailUrl: 'https://i.ytimg.com/vi/3/hqdefault.jpg',
      watchUrl: 'https://www.youtube.com/watch?v=vid-mit-bayes',
      durationSeconds: 1420,
    },
    {
      videoId: 'vid-3b1b-bayes',
      title: 'Bayes theorem, the geometry of changing beliefs',
      channelTitle: '3Blue1Brown',
      description: 'Visual probability tutorial explaining Bayes theorem and medical test paradox.',
      thumbnailUrl: 'https://i.ytimg.com/vi/4/hqdefault.jpg',
      watchUrl: 'https://www.youtube.com/watch?v=vid-3b1b-bayes',
      durationSeconds: 910,
    },
  ];

  const ranked = rankAndFilterYouTubeCandidates({
    candidates,
    concept: 'Bayes Theorem',
    subjectKeywords: ['Conditional Probability', 'Prior', 'Posterior'],
  });

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].videoId, 'vid-mit-bayes');
  assert.equal(ranked[1].videoId, 'vid-3b1b-bayes');
});

test('upsertStreamingTranscriptChunk assembles incremental live captions and handles interruptions cleanly', () => {
  let turns: VoiceTranscriptEntry[] = [];

  turns = upsertStreamingTranscriptChunk(turns, {
    role: 'user',
    chunkText: 'Can you explain',
    isFinal: false,
  });
  turns = upsertStreamingTranscriptChunk(turns, {
    role: 'user',
    chunkText: 'conditional probability?',
    isFinal: true,
  });

  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'Can you explain conditional probability?');
  assert.equal(turns[0].isFinal, true);

  turns = upsertStreamingTranscriptChunk(turns, {
    role: 'assistant',
    chunkText: 'On Page 2,',
    isFinal: false,
  });
  turns = upsertStreamingTranscriptChunk(turns, {
    role: 'assistant',
    chunkText: 'conditional probability restricts the sample space.',
    isFinal: false,
  });

  assert.equal(turns.length, 2);
  assert.equal(
    turns[1].text,
    'On Page 2, conditional probability restricts the sample space.'
  );

  turns = finalizeActiveTranscriptTurn(turns, 'assistant', true);
  assert.equal(turns[1].isFinal, true);
  assert.equal(turns[1].interrupted, true);
});

test('computeBackoffDelayMs respects Retry-After and caps at maxDelayMs', () => {
  const fromHeader = computeBackoffDelayMs({
    attempt: 0,
    retryAfterMs: 3000,
    randomFn: () => 0.5,
  });
  assert.equal(fromHeader, 3100);

  const exp = computeBackoffDelayMs({
    attempt: 2,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    randomFn: () => 0,
  });
  assert.equal(exp, 2000);
});
