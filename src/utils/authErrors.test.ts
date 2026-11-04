import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAuthError, passwordProblem } from './authErrors';

test('describeAuthError gives students short, specific messages', () => {
  assert.equal(describeAuthError({ code: 'auth/popup-closed-by-user' }), null);
  assert.equal(describeAuthError({ code: 'auth/invalid-credential' }), 'Email or password is incorrect.');
  assert.match(describeAuthError({ code: 'auth/email-already-in-use' }) || '', /already exists/);
  assert.match(describeAuthError({ code: 'auth/too-many-requests' }) || '', /wait a few minutes/);
  assert.equal(describeAuthError(new Error('boom')), 'Sign-in did not work. Please try again.');
});

test('passwordProblem requires 8+ characters with letters and numbers', () => {
  assert.equal(passwordProblem('short1'), 'Use at least 8 characters.');
  assert.equal(passwordProblem('onlyletters'), 'Use both letters and numbers.');
  assert.equal(passwordProblem('12345678'), 'Use both letters and numbers.');
  assert.equal(passwordProblem('jee2027rank'), null);
});
