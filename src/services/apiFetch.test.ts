import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApiUrl, buildWsUrl } from './apiFetch';

test('buildApiUrl leaves /api/* relative when base URL is empty', () => {
  assert.equal(buildApiUrl('/api/health', {}), '/api/health');
  assert.equal(buildApiUrl('api/commercial/waitlist', { VITE_API_BASE_URL: '' }), '/api/commercial/waitlist');
});

test('buildApiUrl prepends configured VITE_API_BASE_URL without double slashes', () => {
  assert.equal(
    buildApiUrl('/api/health', { VITE_API_BASE_URL: 'https://learnmate-backend.onrender.com/' }),
    'https://learnmate-backend.onrender.com/api/health'
  );
});

test('buildWsUrl resolves explicit wss base URL or derives wss from https API base URL', () => {
  assert.equal(
    buildWsUrl('/api/live', {
      env: { VITE_WS_BASE_URL: 'wss://learnmate-backend.onrender.com/', VITE_API_BASE_URL: '' },
    }),
    'wss://learnmate-backend.onrender.com/api/live'
  );

  assert.equal(
    buildWsUrl('/api/live', {
      env: { VITE_WS_BASE_URL: '', VITE_API_BASE_URL: 'https://learnmate-backend.onrender.com' },
    }),
    'wss://learnmate-backend.onrender.com/api/live'
  );
});
