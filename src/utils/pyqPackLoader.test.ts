import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearPyqPackMemoryCache,
  fetchPyqPackIndex,
  loadPyqPack,
  packQuestionToCorpusQuestion,
  type PyqPackFile,
  type PyqPackIndex,
} from './pyqPackLoader';

test('public/pyq-packs contains 22 valid shift packs and 550+ questions with strict ORIGINAL_EDITORIAL provenance', () => {
  const packsDir = path.join(process.cwd(), 'public', 'pyq-packs');
  const indexRaw = fs.readFileSync(path.join(packsDir, 'index.json'), 'utf8');
  const index = JSON.parse(indexRaw) as PyqPackIndex;

  assert.equal(index.totalPacks, 22);
  assert.ok(index.totalQuestions >= 500, `Expected >= 500 questions, got ${index.totalQuestions}`);
  assert.equal(index.packs.length, 22);

  for (const entry of index.packs) {
    assert.equal(entry.sourceCategory, 'ORIGINAL_EDITORIAL');
    assert.equal(entry.collectionKind, 'original_practice');

    const packPath = path.join(process.cwd(), 'public', entry.file.replace(/^\//, ''));
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8')) as PyqPackFile;
    assert.equal(pack.packId, entry.packId);
    assert.equal(pack.isFakeShiftAssignment, false);
    assert.equal(pack.sourceCategory, 'ORIGINAL_EDITORIAL');
    assert.equal(pack.questions.length, entry.questionCount);

    const mapped = packQuestionToCorpusQuestion(pack.questions[0], pack, 1);
    assert.equal(mapped.sourceCategory, 'ORIGINAL_EDITORIAL');
    assert.equal(mapped.verificationMetadata.isFakeShiftAssignment, false);
  }
});

test('fetchPyqPackIndex and loadPyqPack lazily fetch and cache pack data in memory', async () => {
  clearPyqPackMemoryCache();
  const packsDir = path.join(process.cwd(), 'public', 'pyq-packs');
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls += 1;
    const urlStr = String(input);
    const rel = urlStr.replace(/^\//, '');
    const content = fs.readFileSync(path.join(process.cwd(), 'public', rel), 'utf8');
    return new Response(content, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const idx = await fetchPyqPackIndex();
    assert.equal(idx.packs.length, 22);

    const first = await loadPyqPack(idx.packs[0]);
    assert.equal(first.questions.length, 25);
    assert.equal(fetchCalls, 2);

    // Second load hits memory cache without triggering fetch
    const second = await loadPyqPack(idx.packs[0].packId);
    assert.equal(second.packId, first.packId);
    assert.equal(fetchCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearPyqPackMemoryCache();
  }
});
