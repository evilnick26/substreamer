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
