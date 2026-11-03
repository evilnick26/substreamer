'use strict';
// Issue #51: fetch the publicly served artifact, never trust a HEAD response.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { inspectApk, validateManifest } = require('./android-release.js');

const MAX_APK_BYTES = 1024 * 1024 * 1024;
const BUILD_TOOLS = path.join(process.env.ANDROID_HOME || '', 'build-tools/36.0.0');
function check(condition, message) { if (!condition) throw new Error(message); }

async function download(url, destination, request = https.get) {
  const response = await new Promise((resolve, reject) => {
    const req = request(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }, timeout: 120000 }, resolve);
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('HTTPS download timed out')));
  });
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error('Public APK GET returned HTTP ' + response.statusCode);
  }
  let count = 0;
  const hash = crypto.createHash('sha256');
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      count += chunk.length;
      if (count > MAX_APK_BYTES) return callback(new Error('Public APK exceeds safety limit'));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(response, meter, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  check(count > 0, 'Public APK is empty');
  return { sha256: hash.digest('hex'), bytes: count };
}
async function verifyPublicApk(manifest, deps = {}) {
  validateManifest(manifest);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-public-apk-'));
  const destination = path.join(directory, 'download.apk');
  try {
    const received = await download(manifest.apkUrl, destination, deps.request || https.get);
    check(received.sha256 === manifest.sha256, 'Public APK SHA-256 mismatch');
    const metadata = await (deps.inspectApk || inspectApk)(destination, deps.buildTools || BUILD_TOOLS);
    check(metadata.sha256 === manifest.sha256, 'Public APK inspector SHA-256 mismatch');
    check(metadata.versionCode === manifest.versionCode && metadata.versionName === manifest.versionName,
      'Public APK version does not match manifest');
    return { ...received, versionCode: metadata.versionCode, versionName: metadata.versionName };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
module.exports = { download, verifyPublicApk };
