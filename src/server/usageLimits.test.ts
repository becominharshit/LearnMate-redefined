import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StudentUsageLimiter,
  dailyLimitsFromEnv,
  indiaDayKey,
  hashForLogs,
  DEFAULT_DAILY_LIMITS,
} from './usageLimits';

test('daily allowance blocks after the limit and resets on the next Indian calendar day', () => {
  let now = Date.UTC(2026, 10, 3, 10, 0); // 3 Nov, 15:30 IST
  const limiter = new StudentUsageLimiter({
    dailyLimits: { ...DEFAULT_DAILY_LIMITS, practice: 2 },
    perMinute: 100,
    now: () => now,
  });

  assert.equal(limiter.consume('alice', 'practice').allowed, true);
  assert.equal(limiter.consume('alice', 'practice').allowed, true);
  const third = limiter.consume('alice', 'practice');
  assert.equal(third.allowed, false);
  assert.equal(third.code, 'daily_limit');
  assert.match(third.message || '', /2 practice sets/);

  // Other students and other features are unaffected.
  assert.equal(limiter.consume('bob', 'practice').allowed, true);
  assert.equal(limiter.consume('alice', 'tutor').allowed, true);

  now = Date.UTC(2026, 10, 3, 18, 31); // 4 Nov, 00:01 IST
  assert.equal(limiter.consume('alice', 'practice').allowed, true);
});

test('burst limit allows a set number of requests per minute', () => {
  let now = Date.UTC(2026, 10, 3, 10, 0);
  const limiter = new StudentUsageLimiter({ perMinute: 3, now: () => now });
  for (let i = 0; i < 3; i++) assert.equal(limiter.consume('alice').allowed, true);
  const blocked = limiter.consume('alice');
  assert.equal(blocked.code, 'rate_limited');
  assert.ok((blocked.retryAfterSeconds || 0) >= 1);

  now += 61_000;
  assert.equal(limiter.consume('alice').allowed, true);
});

test('release gives back a failed request', () => {
  const limiter = new StudentUsageLimiter({
    dailyLimits: { ...DEFAULT_DAILY_LIMITS, tutor: 1 },
    perMinute: 100,
  });
  assert.equal(limiter.consume('alice', 'tutor').allowed, true);
  limiter.release('alice', 'tutor');
  assert.equal(limiter.consume('alice', 'tutor').allowed, true);
  assert.equal(limiter.consume('alice', 'tutor').allowed, false);
});

test('snapshot reports totals without account ids; helpers behave', () => {
  const limiter = new StudentUsageLimiter();
  limiter.consume('alice', 'tutor');
  limiter.consume('bob', 'tutor');
  const snap = limiter.snapshot();
  assert.equal(snap.studentsToday, 2);
  assert.equal(snap.usesToday.tutor, 2);
  assert.ok(!JSON.stringify(snap).includes('alice'));

  assert.equal(indiaDayKey(Date.UTC(2026, 10, 3, 18, 29)), '2026-11-03');
  assert.equal(indiaDayKey(Date.UTC(2026, 10, 3, 18, 31)), '2026-11-04');
  assert.equal(hashForLogs('alice').length, 10);
  assert.notEqual(hashForLogs('alice'), 'alice');

  const limits = dailyLimitsFromEnv({ DAILY_LIMIT_TUTOR: '60', DAILY_LIMIT_CREATE: 'abc' });
  assert.equal(limits.tutor, 60);
  assert.equal(limits.create, DEFAULT_DAILY_LIMITS.create);
});
