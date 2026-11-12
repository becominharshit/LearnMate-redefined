import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMERCIAL_TIERS,
  indexDocumentChunksForRag,
  retrieveTopRagChunks,
  SemanticAiResponseCache,
  ShareSnapshotRegistry,
  BackgroundJobRegistry,
  BITSAT_AND_VITEEE_PYQ_QUESTIONS,
} from './commercialScaleEngine';

test('Commercial subscription tiers enforce progressive token caps and RPM', () => {
  assert.equal(COMMERCIAL_TIERS.free_explorer.dailyTokenCap, 50_000);
  assert.equal(COMMERCIAL_TIERS.pro_scholar.dailyTokenCap, 250_000);
  assert.equal(COMMERCIAL_TIERS.institute.dailyTokenCap, 1_000_000);
});

test('Hybrid RAG chunker indexes multi-page textbook and retrieves top relevant page chunks', () => {
  const samplePages = Array.from({ length: 12 }, (_, idx) => ({
    pageNumber: idx + 1,
    title: idx === 4 ? 'Nernst Equation & Electrode Potential' : `Chapter Section ${idx + 1}`,
    content:
      idx === 4
        ? 'The Nernst equation relates cell potential to reaction quotient: $$E_{cell} = E^0_{cell} - \\frac{0.0591}{n} \\log Q$$ at 298 K.'
        : 'General background prose on standard laboratory glassware and titration measurements '.repeat(15),
  }));

  const chunks = indexDocumentChunksForRag('doc-electro', samplePages);
  assert.ok(chunks.length >= 12);

  const retrieval = retrieveTopRagChunks({
    documentId: 'doc-electro',
    pages: samplePages,
    query: 'What is the Nernst equation formula for E_cell?',
    topK: 2,
  });

  assert.equal(retrieval.topChunks[0]?.pageNumber, 5);
  assert.ok(retrieval.tokenSavingsPercent >= 60);
});

test('Semantic AI response cache canonicalizes queries and tracks hit rate and token savings', () => {
  const cache = new SemanticAiResponseCache(50);
  assert.equal(cache.get('What is the Nernst equation?', 'doc-1'), null);

  cache.set('What is the Nernst equation?', 'doc-1', { answer: 'E = E0 - (RT/nF) ln Q' });

  // Slightly different punctuation/casing hits the same canonical semantic key
  const hit = cache.get<{ answer: string }>('what is the nernst equation?!', 'doc-1');
  assert.equal(hit?.answer, 'E = E0 - (RT/nF) ln Q');

  const stats = cache.getStats();
  assert.equal(stats.totalHits, 1);
  assert.ok(stats.totalTokensSaved >= 650);
});

test('ShareSnapshotRegistry and BackgroundJobRegistry manage read-only shares and async jobs', () => {
  const shares = new ShareSnapshotRegistry();
  const snap = shares.createSnapshot({
    ownerUid: 'u1',
    ownerName: 'Aarav',
    kind: 'desmos_graph',
    title: 'Damped Harmonic Oscillator Plot',
    payload: { equations: ['y = exp(-0.2*x) * cos(2*x)'] },
  });

  const fetched = shares.getSnapshot(snap.shareId);
  assert.equal(fetched?.title, 'Damped Harmonic Oscillator Plot');
  assert.equal(fetched?.viewsCount, 1);

  const jobs = new BackgroundJobRegistry();
  const job = jobs.startJob({
    uid: 'u1',
    kind: 'youtube_marathon',
    title: '6-Hour Rotational Motion Lecture',
  });
  jobs.updateJob(job.jobId, { progressPct: 100, status: 'completed', stepLabel: 'Finished' });
  const list = jobs.getJobsForUser('u1');
  assert.equal(list[0]?.status, 'completed');
  assert.equal(list[0]?.progressPct, 100);
  assert.ok(BITSAT_AND_VITEEE_PYQ_QUESTIONS.length >= 5);
});
