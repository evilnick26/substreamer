'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { publish } = require('../android-publish.js');

const code = 80000193;
const previous = {
  schemaVersion: 1, versionCode: 80000191, versionName: '8.1.8',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000191.apk',
  sha256: 'b'.repeat(64),
};
function fixture() {
  const archive = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-publish-flow-'));
  const file = path.join(archive, 'sanctifi-' + code + '.apk');
  fs.writeFileSync(file, 'test apk');
  const sha256 = crypto.createHash('sha256').update('test apk').digest('hex');
  fs.writeFileSync(file + '.json', JSON.stringify({ versionCode: code, sha256 }));
  const candidate = {
    schemaVersion: 1, versionCode: code, versionName: '8.1.8',
    apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-' + code + '.apk',
    sha256,
  };
  const calls = [];
  const deps = {
    archive,
    plan: async () => ({
      code, filename: 'sanctifi-' + code + '.apk', sha256, versionName: '8.1.8',
      currentAlpha: previous.versionCode, remoteApk: 'absent', apkUrl: candidate.apkUrl,
    }),
    upload: () => calls.push('upload'),
    verifyPublicApk: async () => calls.push('verify-apk'),
    readCurrent: () => JSON.stringify(previous),
    approval: async () => { calls.push('approval'); return true; },
    promote: () => { calls.push('promote'); return { after: 'a'.repeat(64), previousRaw: JSON.stringify(previous), token: 'f'.repeat(32) }; },
    fetchPublicManifest: async () => { calls.push('verify-manifest'); return candidate; },
    rollback: () => calls.push('rollback'),
  };
  return { archive, file, calls, deps };
}
test('publishes only after public APK verification and explicit approval', async () => {
  const f = fixture();
  try {
    const record = await publish(code, f.deps);
    assert.deepEqual(f.calls, ['upload', 'verify-apk', 'approval', 'promote', 'verify-manifest', 'verify-apk']);
    assert.equal(record.versionCode, code);
    assert.equal(JSON.parse(fs.readFileSync(f.file + '.publication.json')).publicManifestVerified, true);
  } finally { fs.rmSync(f.archive, { recursive: true, force: true }); }
});
test('refused approval never promotes', async () => {
  const f = fixture();
  try {
    f.deps.approval = async () => false;
    await assert.rejects(publish(code, f.deps), /cancelled/);
    assert.deepEqual(f.calls, ['upload', 'verify-apk']);
  } finally { fs.rmSync(f.archive, { recursive: true, force: true }); }
});
test('post-promotion manifest mismatch triggers rollback', async () => {
  const f = fixture();
  try {
    f.deps.fetchPublicManifest = async () => previous;
    await assert.rejects(publish(code, f.deps), /differs/);
    assert.deepEqual(f.calls.slice(-3), ['approval', 'promote', 'rollback']);
    assert.equal(f.calls.at(-1), 'rollback');
    assert.equal(fs.existsSync(f.file + '.publication.json'), false);
  } finally { fs.rmSync(f.archive, { recursive: true, force: true }); }
});
