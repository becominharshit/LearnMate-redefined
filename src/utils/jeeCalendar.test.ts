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
