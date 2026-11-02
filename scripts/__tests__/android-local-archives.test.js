'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inventoryLocalArchives } = require('../android-local-archives');

let directory, extra;
const sha = (c) => c.repeat(64);
const baseline = () => ({ schemaVersion: 1, complete: true,
  artifacts: [{ versionCode: 80000190, sha256: sha('a'), state: 'rejected' }] });
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-archive-'));
  extra = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-legacy-'));
  fs.writeFileSync(path.join(directory, 'old.apk'), 'a');
  fs.writeFileSync(path.join(extra, 'new.apk'), 'b');
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.rmSync(extra, { recursive: true, force: true });
});
const inspect = async (file) => path.basename(file) === 'old.apk'
  ? { versionCode: 80000190, sha256: sha('a') }
  : { versionCode: 80000191, sha256: sha('b') };
const run = (overrides = {}) => inventoryLocalArchives({
  directory, archivePaths: [extra], buildTools: '/mock/sdk', baseline: baseline(), inspect, ...overrides,
});

test('inspects both archives and preserves approved rejection state', async () => {
  const result = await run();
  expect(result.inspectedFiles).toBe(2);
  expect(result.artifacts.find((a) => a.versionCode === 80000190).state).toBe('rejected');
});
test('rejects contradictory sidecar', async () => {
  fs.writeFileSync(path.join(extra, 'new.apk.json'), JSON.stringify({
    versionCode: 80000191, sha256: sha('c'),
  }));
  await expect(run()).rejects.toThrow('sidecar identity mismatch');
});
test('rejects orphan sidecar', async () => {
  fs.writeFileSync(path.join(extra, 'missing.apk.json'), '{}');
  await expect(run()).rejects.toThrow('Orphan APK sidecar');
});
test('rejects symlink within archive', async () => {
  fs.symlinkSync(path.join(directory, 'old.apk'), path.join(extra, 'linked.apk'));
  await expect(run()).rejects.toThrow('Symlink');
});
test('rejects different occupied hashes for same versionCode', async () => {
  await expect(run({ inspect: async (file) => ({
    versionCode: 80000191,
    sha256: path.basename(file) === 'old.apk' ? sha('c') : sha('b'),
  }) })).rejects.toThrow('Conflicting occupied APK hashes');
});

test('preserves approved rejected alternate alongside published identity despite misleading filename', async () => {
  const published = sha('a');
  const rejected = sha('b');
  const approved = { schemaVersion: 1, complete: true, artifacts: [
    { versionCode: 80000190, sha256: published, state: 'occupied' },
    { versionCode: 80000190, sha256: rejected, state: 'rejected' },
  ] };
  fs.renameSync(path.join(directory, 'old.apk'), path.join(directory, 'sanctifi-80000190.apk'));
  fs.renameSync(path.join(extra, 'new.apk'), path.join(extra, 'sanctifi-80000191-misnamed.apk'));
  fs.writeFileSync(path.join(extra, 'another-copy.apk'), 'duplicate');
  const result = await run({ baseline: approved, inspect: async (file) => ({
    versionCode: 80000190,
    sha256: path.basename(file) === 'sanctifi-80000190.apk' ? published : rejected,
  }) });
  expect(result.inspectedFiles).toBe(3);
  expect(result.artifacts.filter((a) => a.state === 'rejected')).toHaveLength(2);
  expect(result.artifacts.filter((a) => a.state === 'occupied')).toHaveLength(1);
});

test('unapproved alternate signed identity remains fail-closed even when stored in quarantine', async () => {
  const published = sha('a');
  const approved = { schemaVersion: 1, complete: true, artifacts: [
    { versionCode: 80000190, sha256: published, state: 'occupied' },
  ] };
  await expect(run({ baseline: approved, inspect: async (file) => ({
    versionCode: 80000190,
    sha256: path.basename(file) === 'old.apk' ? published : sha('b'),
  }) })).rejects.toThrow('Conflicting occupied APK hashes');
});

test('baseline cannot classify identical APK identity as both occupied and rejected', async () => {
  await expect(run({ baseline: { schemaVersion: 1, complete: true, artifacts: [
    { versionCode: 80000190, sha256: sha('a'), state: 'occupied' },
    { versionCode: 80000190, sha256: sha('a'), state: 'rejected' },
  ] } })).rejects.toThrow('Contradictory historical artifact states');
});
