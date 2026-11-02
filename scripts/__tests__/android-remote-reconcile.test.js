'use strict';

const { reconcileRemote } = require('../android-remote-reconcile');
const sha = (c) => c.repeat(64);
const baseline = () => ({
  schemaVersion: 1, complete: true, exclusiveAllocator: true,
  artifacts: [{ versionCode: 80000191, sha256: sha('a'), state: 'occupied' }],
});
const remote = () => ({
  status: 'observed-not-authoritative',
  apks: [{ versionCode: 80000191, sha256: sha('a') }],
  alpha: { versionCode: 80000191, sha256: sha('a') },
});

test('recognises exact published identity', () => {
  expect(reconcileRemote(baseline(), remote()).status).toBe('remote-baseline-consistent');
});
test('rejects unapproved published hash', () => {
  const r = remote(); r.apks[0].sha256 = sha('b');
  expect(() => reconcileRemote(baseline(), r)).toThrow('unrecognised published APK');
});
test('rejects missing baseline attestation', () => {
  const b = baseline(); b.complete = false;
  expect(() => reconcileRemote(b, remote())).toThrow('approved complete baseline');
});
test('rejects duplicate remote versionCodes', () => {
  const r = remote(); r.apks.push({ ...r.apks[0] });
  expect(() => reconcileRemote(baseline(), r)).toThrow('duplicate remote APK');
});
test('rejects inconsistent Alpha manifest', () => {
  const r = remote(); r.alpha.sha256 = sha('c');
  expect(() => reconcileRemote(baseline(), r)).toThrow('Alpha manifest mismatch');
});
