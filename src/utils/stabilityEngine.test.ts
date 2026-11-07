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
  assembleStudentSpeechTranscript,
  formatSpokenTextForTts,
  extractSentencesFromStream,
  isSpeakerEcho,
  shouldAcceptTurnEvent,
  shouldProcessSpeechRecognitionResult,
  extractSpeechUnitsFromStream,
  computeSilenceTimeoutMs,
  canAcceptSessionCallback,
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
  assert.equal(
    authErr.userMessage,
    'The AI is not set up correctly on this server. Please contact support so it can be fixed.'
  );

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

test('assembleStudentSpeechTranscript keeps finalized words stable and prevents duplicate text during provisional revisions', () => {
  // Step 1: Student says provisional words
  const step1 = assembleStudentSpeechTranscript({
    existingCommitted: '',
    interimChunk: 'What is',
  });
  assert.equal(step1.committed, '');
  assert.equal(step1.displayParagraph, 'What is');

  // Step 2: Speech recognition finalizes "What is Coulomb's"
  const step2 = assembleStudentSpeechTranscript({
    existingCommitted: step1.committed,
    newFinalChunk: "What is Coulomb's",
    interimChunk: 'law',
  });
  assert.equal(step2.committed, "What is Coulomb's");
  assert.equal(step2.displayParagraph, "What is Coulomb's law");

  // Step 3: Speech recognition revises interim to "law in Hindi"
  const step3 = assembleStudentSpeechTranscript({
    existingCommitted: step2.committed,
    interimChunk: 'law in Hindi',
  });
  assert.equal(step3.committed, "What is Coulomb's");
  assert.equal(step3.displayParagraph, "What is Coulomb's law in Hindi");

  // Step 4: Overlapping final chunk with boundary overlap
  const step4 = assembleStudentSpeechTranscript({
    existingCommitted: step3.committed,
    newFinalChunk: "Coulomb's law in Hindi",
    interimChunk: '',
  });
  assert.equal(step4.committed, "What is Coulomb's law in Hindi");
  assert.equal(step4.displayParagraph, "What is Coulomb's law in Hindi");

  // Step 5: Duplicate final chunk does not replicate
  const step5 = assembleStudentSpeechTranscript({
    existingCommitted: step4.committed,
    newFinalChunk: 'law in Hindi',
    interimChunk: '',
  });
  assert.equal(step5.committed, "What is Coulomb's law in Hindi");
  assert.equal(step5.displayParagraph, "What is Coulomb's law in Hindi");
});

test('formatSpokenTextForTts strips citations, markdown, and converts LaTeX for speech', () => {
  const input = "On Page 2 [Page 2: Gauss's Law], the electric flux is $$\\Phi = \\oint E \\cdot dA$$. For a point charge, $$E = \\frac{kq}{r^2}$$. Check your notes!";
  const cleaned = formatSpokenTextForTts(input);
  assert.ok(!cleaned.includes('[Page 2:'));
  assert.ok(!cleaned.includes('$$'));
  assert.ok(!cleaned.includes('\\oint'));
  assert.ok(cleaned.includes('the electric flux is'));
  assert.ok(cleaned.includes('Check your notes!'));
});

test('extractSentencesFromStream extracts complete sentences and flushes remainder on finish', () => {
  const buffer1 = "Newton's second law states that force equals rate of change of momentum. ";
  const res1 = extractSentencesFromStream(buffer1, false);
  assert.equal(res1.completeSentences.length, 1);
  assert.equal(res1.completeSentences[0], "Newton's second law states that force equals rate of change of momentum.");
  assert.equal(res1.remainder, '');

  const buffer2 = "Mathematically, F equals m times a. Can you verify this with units";
  const res2 = extractSentencesFromStream(buffer2, false);
  assert.equal(res2.completeSentences.length, 1);
  assert.equal(res2.completeSentences[0], "Mathematically, F equals m times a.");
  assert.equal(res2.remainder, 'Can you verify this with units');

  // When stream finishes, remainder is flushed
  const res3 = extractSentencesFromStream(res2.remainder, true);
  assert.equal(res3.completeSentences.length, 1);
  assert.equal(res3.completeSentences[0], 'Can you verify this with units');
  assert.equal(res3.remainder, '');
});

test('isSpeakerEcho detects tutor self-speech and allows distinct student questions', () => {
  const tutorUtterances = [
    'The acceleration is directly proportional to the applied force.',
    'It acts in the direction of the net force.',
  ];

  // Self-echo should return true
  const echo = isSpeakerEcho('directly proportional to the applied force', tutorUtterances);
  assert.equal(echo, true);

  // Unrelated student query should return false
  const studentDoubt = isSpeakerEcho('What happens if the mass is zero?', tutorUtterances);
  assert.equal(studentDoubt, false);
});

test('shouldAcceptTurnEvent guards against stale SSE events after interruption and handles consecutive interruptions', () => {
  let activeTurnId = 1;
  let isTurnActive = true;

  // Normal chunk in turn 1
  assert.equal(shouldAcceptTurnEvent(1, activeTurnId, isTurnActive), true);

  // Turn 1 is interrupted by user barge-in
  isTurnActive = false;
  activeTurnId = 2; // increments for the new turn

  // Late chunk arriving from aborted fetch of turn 1
  assert.equal(shouldAcceptTurnEvent(1, activeTurnId, isTurnActive), false);

  // Turn 2 starts streaming
  isTurnActive = true;
  assert.equal(shouldAcceptTurnEvent(2, activeTurnId, isTurnActive), true);

  // Turn 2 is also interrupted (second consecutive interruption)
  isTurnActive = false;
  activeTurnId = 3;

  // Late chunk from turn 2
  assert.equal(shouldAcceptTurnEvent(2, activeTurnId, isTurnActive), false);

  // Turn 3 starts and processes normally
  isTurnActive = true;
  assert.equal(shouldAcceptTurnEvent(3, activeTurnId, isTurnActive), true);
});

test('voice tutor interruption lifecycle preserves partial transcript and flags interrupted turns', () => {
  let conversation: VoiceTranscriptEntry[] = [];

  // Turn 1: User asks question
  conversation.push({
    id: 'user-1',
    role: 'user',
    text: 'What is the work-energy theorem?',
    isFinal: true,
  });

  // Assistant begins streaming response
  conversation.push({
    id: 'tutor-1',
    role: 'assistant',
    text: 'The work-energy theorem states that the net work done equals',
    isFinal: false,
  });

  // User barge-in while assistant is mid-stream
  // The turn is finalized immediately with whatever was streamed so far and marked interrupted
  conversation = finalizeActiveTranscriptTurn(conversation, 'assistant', true);

  assert.equal(conversation.length, 2);
  assert.equal(conversation[1].id, 'tutor-1');
  assert.equal(
    conversation[1].text,
    'The work-energy theorem states that the net work done equals'
  );
  assert.equal(conversation[1].isFinal, true);
  assert.equal(conversation[1].interrupted, true);

  // Turn 2: Follow-up question during barge-in
  conversation.push({
    id: 'user-2',
    role: 'user',
    text: 'Wait, does it apply to non-conservative forces too?',
    isFinal: true,
  });

  // Assistant answers follow-up
  conversation.push({
    id: 'tutor-2',
    role: 'assistant',
    text: 'Yes, it accounts for both conservative and non-conservative forces.',
    isFinal: false,
  });

  // Second interruption while speaking
  conversation = finalizeActiveTranscriptTurn(conversation, 'assistant', true);

  assert.equal(conversation.length, 4);
  assert.equal(conversation[3].interrupted, true);
  assert.equal(conversation[3].isFinal, true);

  // Reopening/reloading clears any lingering streaming state
  const restored = conversation.map((t) => ({ ...t, isFinal: true }));
  assert.equal(restored.every((t) => t.isFinal), true);
  assert.equal(restored[1].interrupted, true);
  assert.equal(restored[3].interrupted, true);
});

test('shouldProcessSpeechRecognitionResult rejects echo during playback and post-playback cooldown, and allows short queries', () => {
  const baseTime = 10000;

  // 1. Playback is actively speaking
  const decisionActive = shouldProcessSpeechRecognitionResult({
    isPlaybackActive: true,
    playbackFinishedAt: 0,
    now: baseTime,
    cooldownMs: 600,
    turnSequenceId: 1,
    expectedTurnSequenceId: 1,
  });
  assert.equal(decisionActive.allowProcessing, false);
  assert.equal(decisionActive.reason, 'playback_active');

  // 2. Playback just ended 200ms ago (cooldown period of 600ms still active)
  const decisionCooldown = shouldProcessSpeechRecognitionResult({
    isPlaybackActive: false,
    playbackFinishedAt: baseTime,
    now: baseTime + 200,
    cooldownMs: 600,
    turnSequenceId: 1,
    expectedTurnSequenceId: 1,
  });
  assert.equal(decisionCooldown.allowProcessing, false);
  assert.equal(decisionCooldown.reason, 'in_cooldown');

  // 3. Stale callback from an old turn sequence (e.g. after user tapped circle to interrupt)
  const decisionStale = shouldProcessSpeechRecognitionResult({
    isPlaybackActive: false,
    playbackFinishedAt: 0,
    now: baseTime + 800,
    cooldownMs: 600,
    turnSequenceId: 1,
    expectedTurnSequenceId: 2, // expected has incremented
  });
  assert.equal(decisionStale.allowProcessing, false);
  assert.equal(decisionStale.reason, 'stale_turn_sequence');

  // 4. Clean listening state after cooldown: allows genuine speech, including short words like "Why?"
  const decisionClean = shouldProcessSpeechRecognitionResult({
    isPlaybackActive: false,
    playbackFinishedAt: baseTime,
    now: baseTime + 700, // 700ms > 600ms cooldown
    cooldownMs: 600,
    turnSequenceId: 2,
    expectedTurnSequenceId: 2,
  });
  assert.equal(decisionClean.allowProcessing, true);
  assert.equal(decisionClean.reason, 'allowed');

  // Short follow-up "Why?" in clean state is assembled without error or word-loss
  const assembledWhy = assembleStudentSpeechTranscript({
    existingCommitted: '',
    newFinalChunk: 'Why?',
  });
  assert.equal(assembledWhy.committed, 'Why?');
  assert.equal(assembledWhy.displayParagraph, 'Why?');
});

test('extractSpeechUnitsFromStream extracts early clause units on isFirstUnit so speech starts in ~400ms', () => {
  // Case 1: First unit with an early comma boundary
  const buffer1 = 'In transition metals, electrons absorb visible light as they move between split d-orbitals. ';
  const res1 = extractSpeechUnitsFromStream(buffer1, true, false);
  assert.equal(res1.units.length, 1);
  assert.equal(res1.units[0], 'In transition metals,');
  assert.ok(res1.remainder.startsWith('electrons absorb'));

  // Case 2: Subsequent unit extracts at full sentence boundary
  const res2 = extractSpeechUnitsFromStream(res1.remainder, false, false);
  assert.equal(res2.units.length, 1);
  assert.equal(res2.units[0], 'electrons absorb visible light as they move between split d-orbitals.');
  assert.equal(res2.remainder.trim(), '');

  // Case 3: Stream finished with leftover text
  const res3 = extractSpeechUnitsFromStream('The colour observed is complementary.', false, true);
  assert.equal(res3.units.length, 1);
  assert.equal(res3.units[0], 'The colour observed is complementary.');
  assert.equal(res3.remainder, '');
});

test('computeSilenceTimeoutMs reduces dead latency on finished speech while preserving mid-phrase pauses', () => {
  // Finished completed question: 750ms
  const finalTimeout = computeSilenceTimeoutMs({ isFinal: true, wordCount: 8 });
  assert.equal(finalTimeout, 750);

  // Short follow-up question ("Why?"): 800ms
  const shortTimeout = computeSilenceTimeoutMs({ isFinal: true, wordCount: 1 });
  assert.equal(shortTimeout, 800);

  // Mid-phrase pause where isFinal is false: 1100ms breathing room
  const pauseTimeout = computeSilenceTimeoutMs({ isFinal: false, wordCount: 4 });
  assert.equal(pauseTimeout, 1100);
});

test('canAcceptSessionCallback invalidates pending callbacks immediately upon End session or epoch change', () => {
  let isSessionActive = true;
  let currentEpoch = 1;

  // Active session callback
  assert.equal(canAcceptSessionCallback({ isSessionActive, currentEpoch, expectedEpoch: 1 }), true);

  // User taps End session (isSessionActive becomes false, epoch increments)
  isSessionActive = false;
  currentEpoch = 2;

  // Late callback arriving from network stream or delayed TTS utterance
  assert.equal(canAcceptSessionCallback({ isSessionActive, currentEpoch: 1, expectedEpoch: currentEpoch }), false);
  assert.equal(canAcceptSessionCallback({ isSessionActive, currentEpoch: 2, expectedEpoch: currentEpoch }), false);

  // Reopening starts fresh session (epoch 3)
  isSessionActive = true;
  currentEpoch = 3;
  assert.equal(canAcceptSessionCallback({ isSessionActive, currentEpoch: 3, expectedEpoch: 3 }), true);
  // Stale callback from previous session (epoch 2) rejected
  assert.equal(canAcceptSessionCallback({ isSessionActive, currentEpoch: 2, expectedEpoch: 3 }), false);
});
