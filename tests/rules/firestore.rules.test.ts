/**
 * Proves that each student can reach only their own data. Runs against the Firestore emulator:
 *   npm run test:rules
 */
import test, { after, before, beforeEach } from 'node:test';
import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const now = '2026-11-03T10:00:00.000Z';
const verifiedGoogle = { email_verified: true, firebase: { sign_in_provider: 'google.com' as const } };
const verifiedEmail = { email_verified: true, firebase: { sign_in_provider: 'password' as const } };
const unverifiedEmail = { email_verified: false, firebase: { sign_in_provider: 'password' as const } };
const anonymous = { email_verified: false, firebase: { sign_in_provider: 'anonymous' as const } };

function studyDoc(uid: string, id = 'doc-1') {
  return {
    id,
    uid,
    title: 'Rotational Motion.pdf',
    sourceType: 'pdf',
    pageCount: 3,
    pagesJson: '[]',
    topicsJson: '[]',
    overview: 'Torque and angular momentum',
    createdAt: now,
    lastStudiedAt: now,
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-learnmate',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice/documents/doc-1'), studyDoc('alice'));
    await setDoc(doc(ctx.firestore(), 'users/alice'), { uid: 'alice', updatedAt: now });
  });
});

after(async () => {
  await env.cleanup();
});

test('a student can read and write their own study material', async () => {
  const alice = env.authenticatedContext('alice', verifiedGoogle).firestore();
  await assertSucceeds(getDoc(doc(alice, 'users/alice/documents/doc-1')));
  await assertSucceeds(getDocs(collection(alice, 'users/alice/documents')));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/documents/doc-2'), studyDoc('alice', 'doc-2')));
  await assertSucceeds(deleteDoc(doc(alice, 'users/alice/documents/doc-2')));
});

test("another student can never read, list, change or delete someone else's data", async () => {
  const bob = env.authenticatedContext('bob', verifiedGoogle).firestore();
  await assertFails(getDoc(doc(bob, 'users/alice')));
  await assertFails(getDoc(doc(bob, 'users/alice/documents/doc-1')));
  await assertFails(getDocs(collection(bob, 'users/alice/documents')));
  await assertFails(updateDoc(doc(bob, 'users/alice/documents/doc-1'), { title: 'hacked' }));
  await assertFails(deleteDoc(doc(bob, 'users/alice/documents/doc-1')));
  // Writing into another account's area, even with their uid in the data, is refused.
  await assertFails(setDoc(doc(bob, 'users/alice/documents/doc-9'), studyDoc('alice', 'doc-9')));
});

test('signed-out, anonymous and unverified accounts get nothing', async () => {
  const guest = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(guest, 'users/alice/documents/doc-1')));

  const anon = env.authenticatedContext('alice', anonymous).firestore();
  await assertFails(getDoc(doc(anon, 'users/alice/documents/doc-1')));

  const unverified = env.authenticatedContext('alice', unverifiedEmail).firestore();
  await assertFails(getDoc(doc(unverified, 'users/alice/documents/doc-1')));

  const verified = env.authenticatedContext('alice', verifiedEmail).firestore();
  await assertSucceeds(getDoc(doc(verified, 'users/alice/documents/doc-1')));
});

test('writes with unexpected fields or mismatched ids are refused', async () => {
  const alice = env.authenticatedContext('alice', verifiedGoogle).firestore();
  await assertFails(
    setDoc(doc(alice, 'users/alice/documents/doc-3'), { ...studyDoc('alice', 'doc-3'), isAdmin: true })
  );
  await assertFails(setDoc(doc(alice, 'users/alice/documents/doc-4'), studyDoc('alice', 'other-id')));
  await assertFails(setDoc(doc(alice, 'users/alice'), { uid: 'alice', updatedAt: now, role: 'admin' }));
  await assertFails(setDoc(doc(alice, 'publicFeed/post-1'), { text: 'hello' }));
});

test('reports can be created by their owner only and never edited', async () => {
  const report = {
    id: 'report-1',
    uid: 'alice',
    kind: 'tutor_answer',
    reason: 'wrong',
    note: 'The final answer should be 34.6 m',
    excerpt: 'R = 30 m',
    documentId: 'doc-1',
    createdAt: now,
  };
  const alice = env.authenticatedContext('alice', verifiedGoogle).firestore();
  const bob = env.authenticatedContext('bob', verifiedGoogle).firestore();

  await assertSucceeds(setDoc(doc(alice, 'users/alice/reports/report-1'), report));
  await assertFails(updateDoc(doc(alice, 'users/alice/reports/report-1'), { reason: 'other' }));
  await assertFails(getDoc(doc(bob, 'users/alice/reports/report-1')));
  await assertFails(setDoc(doc(bob, 'users/alice/reports/report-2'), { ...report, id: 'report-2' }));
});
