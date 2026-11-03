'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { download, verifyPublicApk } = require('../android-publish-verify.js');

const payload = Buffer.from('fake apk bytes');
const hash = crypto.createHash('sha256').update(payload).digest('hex');
const manifest = {
  schemaVersion: 1, versionCode: 80000193, versionName: '8.1.8',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000193.apk', sha256: hash,
};
function fakeGet(bytes, statusCode = 200) {
  return (url, options, callback) => {
    const req = new EventEmitter();
    req.destroy = error => req.emit('error', error);
    process.nextTick(() => {
      const response = Readable.from([bytes]);
      response.statusCode = statusCode;
      callback(response);
    });
    return req;
  };
}
test('downloads entire public APK with no-cache headers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-get-'));
  try {
    let headers;
    const result = await download(manifest.apkUrl, path.join(dir, 'apk'), (url, options, callback) => {
      headers = options.headers;
      return fakeGet(payload)(url, options, callback);
    });
    assert.equal(result.sha256, hash);
    assert.equal(result.bytes, payload.length);
    assert.equal(headers['Cache-Control'], 'no-cache');
    assert.deepEqual(fs.readFileSync(path.join(dir, 'apk')), payload);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('rejects non-200 status rather than following redirect', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-get-'));
  try {
    await assert.rejects(download(manifest.apkUrl, path.join(dir, 'apk'), fakeGet(payload, 302)), /HTTP 302/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('verifies downloaded bytes and APK identity', async () => {
  const result = await verifyPublicApk(manifest, {
    request: fakeGet(payload),
    inspectApk: async file => {
      assert.deepEqual(fs.readFileSync(file), payload);
      return { sha256: hash, versionCode: 80000193, versionName: '8.1.8' };
    },
  });
  assert.equal(result.sha256, hash);
});
test('rejects public checksum mismatch before invoking APK inspector', async () => {
  await assert.rejects(verifyPublicApk(manifest, {
    request: fakeGet(Buffer.from('wrong bytes')),
    inspectApk: async () => { throw new Error('inspector must not run'); },
  }), /SHA-256 mismatch/);
});
test('rejects wrong APK version despite matching public hash', async () => {
  await assert.rejects(verifyPublicApk(manifest, {
    request: fakeGet(payload),
    inspectApk: async () => ({ sha256: hash, versionCode: 80000192, versionName: '8.1.8' }),
  }), /version does not match/);
});
