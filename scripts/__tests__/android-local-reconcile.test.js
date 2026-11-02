'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { reconcileLocalPublished } = require('../android-local-reconcile');

const sha = (char) => char.repeat(64);
let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-reconcile-'));
  fs.mkdirSync(path.join(directory, '.allocations'));
  fs.writeFileSync(path.join(directory, '.allocations/registry.json'),
    JSON.stringify({ schemaVersion: 1, directory }));
  fs.writeFileSync(path.join(directory, 'sanctifi-80000192.apk'), 'fixture');
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
const baseline = () => ({
  schemaVersion: 1, complete: true, exclusiveAllocator: true,
  artifacts: [{ versionCode: 80000191, sha256: sha('a'), state: 'occupied' }],
});
const remote = () => ({
  status: 'observed-not-authoritative',
  apks: [
    { versionCode: 80000191, sha256: sha('a') },
    { versionCode: 80000192, sha256: sha('b') },
  ],
  alpha: { versionCode: 80000192, sha256: sha('b') },
});

test('uses inspectApk verification to recognise newer published bytes', async () => {
  const inspect = jest.fn(async () => ({ versionCode: 80000192, sha256: sha('b') }));
  const result = await reconcileLocalPublished({ directory, buildTools: '/mock/sdk', baseline: baseline(), remote: remote(), inspect });
  expect(result.verifiedLocalCount).toBe(1);
  expect(inspect).toHaveBeenCalledTimes(1);
});
test('rejects conflicting local APK bytes', async () => {
  await expect(reconcileLocalPublished({
    directory, buildTools: '/mock/sdk', baseline: baseline(), remote: remote(),
    inspect: async () => ({ versionCode: 80000192, sha256: sha('c') }),
  })).rejects.toThrow('identities conflict');
});
test('does not trust unknown server APK if local file missing', async () => {
  fs.unlinkSync(path.join(directory, 'sanctifi-80000192.apk'));
  await expect(reconcileLocalPublished({
    directory, buildTools: '/mock/sdk', baseline: baseline(), remote: remote(),
    inspect: async () => { throw new Error('should not inspect'); },
  })).rejects.toThrow('unrecognised published APK');
});
test('rejects mismatched private registry identity', async () => {
  fs.writeFileSync(path.join(directory, '.allocations/registry.json'),
    JSON.stringify({ schemaVersion: 1, directory: '/other' }));
  await expect(reconcileLocalPublished({
    directory, buildTools: '/mock/sdk', baseline: baseline(), remote: remote(),
    inspect: async () => ({ versionCode: 80000192, sha256: sha('b') }),
  })).rejects.toThrow('registry identity mismatch');
});
