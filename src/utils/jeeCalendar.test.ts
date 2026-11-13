import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextJeeCountdown } from './jeeCalendar';

test('getNextJeeCountdown counts calendar days to the next JEE Main session', () => {
  const beforeSession1 = getNextJeeCountdown(new Date(2026, 10, 3, 23, 30));
  assert.equal(beforeSession1?.label, 'JEE Main Session 1');
  assert.equal(beforeSession1?.daysLeft, 78);
  assert.equal(beforeSession1?.inProgress, false);

  const duringSession1 = getNextJeeCountdown(new Date(2027, 0, 22, 9, 0));
  assert.equal(duringSession1?.label, 'JEE Main Session 1');
  assert.equal(duringSession1?.daysLeft, 0);
  assert.equal(duringSession1?.inProgress, true);

  const beforeSession2 = getNextJeeCountdown(new Date(2027, 1, 1));
  assert.equal(beforeSession2?.label, 'JEE Main Session 2');
  assert.equal(beforeSession2?.daysLeft, 60);

  assert.equal(getNextJeeCountdown(new Date(2027, 3, 8)), null);
});

test('getNextJeeCountdown returns distinct dynamic dates per exam track', () => {
  const sampleDate = new Date(2026, 10, 13, 12, 0);
  const main = getNextJeeCountdown(sampleDate, 'jee_main');
  const adv = getNextJeeCountdown(sampleDate, 'jee_advanced');
  const bitsat = getNextJeeCountdown(sampleDate, 'bitsat');
  const viteee = getNextJeeCountdown(sampleDate, 'viteee');

  assert.equal(main?.label, 'JEE Main Session 1');
  assert.equal(adv?.label, 'JEE Advanced 2027');
  assert.equal(bitsat?.label, 'BITSAT Session 1');
  assert.equal(viteee?.label, 'VITEEE 2027 Window');
  assert.ok((adv?.daysLeft || 0) > (main?.daysLeft || 0));
});

