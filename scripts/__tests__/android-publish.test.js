'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { readLocal, parseRemote, plan } = require('../android-publish.js');

const CODE = 80000193;
const HASH = 'a'.repeat(64);
const apkPath = '/opt/updates-site/client/apks/sanctifi-' + CODE + '.apk';
const old = {
  schemaVersion: 1, versionCode: 80000191, versionName: '8.1.8',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000191.apk',
  sha256: 'b'.repeat(64),
};
test('remote absent APK and existing Alpha are parsed without mutation', () => {
  const result = parseRemote('APK_ABSENT\n' + JSON.stringify(old) + '\n', CODE, HASH);
  assert.equal(result.remoteHash, null);
  assert.equal(result.current.versionCode, 80000191);
});
test('remote matching APK is idempotent', () => {
  const result = parseRemote(HASH + '  ' + apkPath + '\n' + JSON.stringify(old), CODE, HASH);
  assert.equal(result.remoteHash, HASH);
});
test('remote filename collision is fatal', () => {
  assert.throws(() => parseRemote('c'.repeat(64) + '  ' + apkPath + '\n' + JSON.stringify(old), CODE, HASH), /collision/);
});
test('newer Alpha cannot be downgraded', () => {
  const newer = { ...old, versionCode: CODE + 1, apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-' + (CODE + 1) + '.apk' };
  assert.throws(() => parseRemote('APK_ABSENT\n' + JSON.stringify(newer), CODE, HASH), /downgrade/);
});
test('malformed remote inventory fails closed', () => {
  assert.throws(() => parseRemote('unexpected\n' + JSON.stringify(old), CODE, HASH), /Unrecognised/);
});
test('archive checksum and sidecar must agree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-publish-test-'));
  try {
    const file = path.join(dir, 'sanctifi-' + CODE + '.apk');
    fs.writeFileSync(file, 'test-apk');
    const sha256 = crypto.createHash('sha256').update('test-apk').digest('hex');
    fs.writeFileSync(file + '.json', JSON.stringify({ versionCode: CODE, sha256 }));
    assert.equal(readLocal(CODE, dir).record.sha256, sha256);
    fs.writeFileSync(file, 'tampered');
    assert.throws(() => readLocal(CODE, dir), /checksum/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('plan uses injected inspectors and performs no remote writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-publish-plan-'));
  try {
    const file = path.join(dir, 'sanctifi-' + CODE + '.apk');
    fs.writeFileSync(file, 'test-apk');
    const sha256 = crypto.createHash('sha256').update('test-apk').digest('hex');
    fs.writeFileSync(file + '.json', JSON.stringify({ versionCode: CODE, sha256 }));
    const result = await plan(CODE, {
      archive: dir,
      inspectApk: async () => ({ versionCode: CODE, versionName: '8.1.8', sha256 }),
      inspectRemote: () => 'APK_ABSENT\n' + JSON.stringify(old),
    });
    assert.equal(result.currentAlpha, 80000191);
    assert.equal(result.remoteApk, 'absent');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
