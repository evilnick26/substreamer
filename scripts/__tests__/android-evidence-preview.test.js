'use strict';
const { previewEvidence } = require('../android-evidence-preview');
const hash = (c) => c.repeat(64);
const inputs = () => ({
  baseline: { schemaVersion: 1, complete: true, exclusiveAllocator: true,
    artifacts: [{ versionCode: 80000189, sha256: hash('a'), state: 'occupied' },
      { versionCode: 80000189, sha256: hash('c'), state: 'rejected' }] },
  remote: { status: 'observed-not-authoritative',
    apks: [{ versionCode: 80000189, sha256: hash('a') },
      { versionCode: 80000190, sha256: hash('b') }] },
  local: { inspectedArtifacts: [{ versionCode: 80000190, sha256: hash('b'), state: 'occupied' }],
    ledgerArtifacts: [{ versionCode: 80000190, sha256: hash('b'), state: 'occupied' }],
    attemptedCodes: [80000190, 80000191] },
});
test('deduplicates identities while retaining rejected bytes and attempted codes', () => {
  const result = previewEvidence(inputs());
  expect(result.status).toBe('candidate-evidence-not-attested');
  expect(result.nextCandidateCode).toBe(80000192);
  expect(result.artifacts.filter((x) => x.versionCode === 80000190 && x.sha256 === hash('b'))).toHaveLength(1);
  expect(result.artifacts).toContainEqual({ versionCode: 80000189, sha256: hash('c'), state: 'rejected' });
  expect(result.artifacts).toContainEqual({ versionCode: 80000191, sha256: null, state: 'occupied' });
  expect(result).not.toHaveProperty('complete');
  expect(result).not.toHaveProperty('checkedAt');
});
test('rejects conflicting occupied identities', () => {
  const value = inputs();
  value.local.inspectedArtifacts[0].sha256 = hash('d');
  expect(() => previewEvidence(value)).toThrow('Conflicting occupied');
});
test('rejects an identity marked both occupied and rejected', () => {
  const value = inputs();
  value.local.inspectedArtifacts.push({ versionCode: 80000189, sha256: hash('c'), state: 'occupied' });
  expect(() => previewEvidence(value)).toThrow('occupied and rejected');
});
test('rejects incomplete baseline and invalid identities', () => {
  const value = inputs();
  value.baseline.complete = false;
  expect(() => previewEvidence(value)).toThrow('requires reconciled');
  value.baseline.complete = true;
  value.local.attemptedCodes.push(-1);
  expect(() => previewEvidence(value)).toThrow('Invalid evidence');
});
