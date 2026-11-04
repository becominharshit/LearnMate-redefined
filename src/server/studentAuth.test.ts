import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateStudent, readBearerToken, type IdTokenVerifier } from './studentAuth';

const fakeVerifier =
  (claims: Record<string, unknown> | null): IdTokenVerifier =>
  async () => {
    if (!claims) throw new Error('invalid token');
    return claims as never;
  };

test('readBearerToken extracts the token from an Authorization header', () => {
  assert.equal(readBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(readBearerToken('bearer   xyz'), 'xyz');
  assert.equal(readBearerToken('Basic abc'), null);
  assert.equal(readBearerToken(''), null);
  assert.equal(readBearerToken(undefined), null);
});

test('authenticateStudent rejects missing, invalid and anonymous logins', async () => {
  const missing = await authenticateStudent(fakeVerifier({ uid: 'a' }), null);
  assert.equal(missing.ok, false);
  assert.equal(!missing.ok && missing.status, 401);

  const invalid = await authenticateStudent(fakeVerifier(null), 'bad');
  assert.equal(!invalid.ok && invalid.code, 'auth_invalid');

  const anonymous = await authenticateStudent(
    fakeVerifier({ uid: 'a', firebase: { sign_in_provider: 'anonymous' } }),
    'tok'
  );
  assert.equal(!anonymous.ok && anonymous.status, 401);

  const notConfigured = await authenticateStudent(null, 'tok');
  assert.equal(!notConfigured.ok && notConfigured.status, 503);
});

test('authenticateStudent requires a verified email for password accounts only', async () => {
  const unverified = await authenticateStudent(
    fakeVerifier({ uid: 'a', email_verified: false, firebase: { sign_in_provider: 'password' } }),
    'tok'
  );
  assert.equal(!unverified.ok && unverified.code, 'email_unverified');
  assert.equal(!unverified.ok && unverified.status, 403);

  const verified = await authenticateStudent(
    fakeVerifier({ uid: 'a', email: 'a@x.in', email_verified: true, firebase: { sign_in_provider: 'password' } }),
    'tok'
  );
  assert.ok(verified.ok);
  assert.equal(verified.ok && verified.student.uid, 'a');

  const google = await authenticateStudent(
    fakeVerifier({ uid: 'g', email_verified: true, firebase: { sign_in_provider: 'google.com' } }),
    'tok'
  );
  assert.equal(google.ok && google.student.signInProvider, 'google.com');
});
