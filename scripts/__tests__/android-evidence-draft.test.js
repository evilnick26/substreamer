'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeEvidenceDraft, writeEvidenceDraft } = require('../android-evidence-draft');
const sha = (x) => x.repeat(64);
const fixture = () => ({
  allocationDirectory: '/tmp/releases',
  archivePaths: ['/tmp/old-archive', '/tmp/new-archive'],
  baseline: {
    schemaVersion: 1, complete: true, exclusiveAllocator: true,
    allocationDirectory: '/tmp/releases', archivePaths: ['/tmp/old-archive'],
    artifacts: [{ versionCode: 80000189, sha256: sha('a'), state: 'occupied' }],
  },
  remote: { status: 'observed-not-authoritative',
    observedAt: '2026-11-02T18:39:44.000Z',
    apks: [{ versionCode: 80000189, sha256: sha('a') },
      { versionCode: 80000190, sha256: sha('b') }] },
  local: {
    status: 'remote-baseline-consistent', highestPublishedCode: 80000190,
    localArchiveInspectedFiles: 2,
    inspectedArtifacts: [{ versionCode: 80000190, sha256: sha('b'), state: 'occupied' }],
    ledgerArtifacts: [{ versionCode: 80000190, sha256: sha('b'), state: 'occupied' }],
    attemptedCodes: [80000190],
  },
  now: new Date('2026-11-02T18:40:00.000Z'),
});
test('constructs non-authoritative evidence draft without allocation history fields', () => {
  const result = makeEvidenceDraft(fixture());
  expect(result.status).toBe('draft-not-authoritative');
  expect(result.nextCandidateCode).toBe(80000191);
  for (const field of ['complete', 'checkedAt', 'exclusiveAllocator', 'sources']) {
    expect(result).not.toHaveProperty(field);
  }
});
test('refuses to silently shrink previously approved archive scope', () => {
  const value = fixture();
  value.archivePaths = ['/tmp/new-archive'];
  expect(() => makeEvidenceDraft(value)).toThrow('Historical archive omitted');
});
test('rejects stale observations and failed reconciliation', () => {
  const value = fixture();
  value.now = new Date('2026-11-02T19:00:00Z');
  expect(() => makeEvidenceDraft(value)).toThrow('stale');
  value.now = new Date('2026-11-02T18:40:00Z');
  value.local.status = 'failed';
  expect(() => makeEvidenceDraft(value)).toThrow('Successful signed');
});
test('creates draft exclusively, without overwriting, and refuses attestation-shaped drafts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-draft-'));
  try {
    const file = path.join(dir, 'evidence.json');
    const draft = makeEvidenceDraft(fixture());
    writeEvidenceDraft(file, draft);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).status).toBe('draft-not-authoritative');
    expect(() => writeEvidenceDraft(file, draft)).toThrow();
    expect(() => writeEvidenceDraft(path.join(dir, 'bad.json'), { ...draft, complete: true })).toThrow('Refusing');
    expect(fs.existsSync(path.join(dir, 'bad.json'))).toBe(false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
