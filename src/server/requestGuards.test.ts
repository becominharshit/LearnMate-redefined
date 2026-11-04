import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin, isPublicApiPath, usageCategoryForPath } from './requestGuards';

test('only the health check and admin diagnostics skip student login', () => {
  assert.equal(isPublicApiPath('/api/health'), true);
  assert.equal(isPublicApiPath('/api/usage'), true);
  assert.equal(isPublicApiPath('/api/vertex/status'), true);
  assert.equal(isPublicApiPath('/api/study/ask'), false);
  assert.equal(isPublicApiPath('/api/create/video-jobs/abc'), false);
  assert.equal(isPublicApiPath('/api/usage-export'), false);
});

test('AI routes map to daily allowance buckets', () => {
  assert.equal(usageCategoryForPath('POST', '/api/study/ask'), 'tutor');
  assert.equal(usageCategoryForPath('POST', '/api/study/quiz'), 'practice');
  assert.equal(usageCategoryForPath('POST', '/api/create/visualize'), 'create');
  assert.equal(usageCategoryForPath('GET', '/api/create/video-jobs/abc'), undefined);
  assert.equal(usageCategoryForPath('POST', '/api/unknown'), undefined);
});

test('isAllowedOrigin accepts same-site and listed origins only', () => {
  assert.equal(isAllowedOrigin(undefined, 'localhost:3000', []), true);
  assert.equal(isAllowedOrigin('http://localhost:3000', 'localhost:3000', []), true);
  assert.equal(isAllowedOrigin('https://evil.example', 'localhost:3000', []), false);
  assert.equal(
    isAllowedOrigin('https://learnmate.onrender.com', 'internal:10000', ['https://learnmate.onrender.com']),
    true
  );
  assert.equal(isAllowedOrigin('not a url', 'localhost:3000', []), false);
});
