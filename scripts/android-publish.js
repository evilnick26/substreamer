#!/usr/bin/env node
'use strict';
// Issue #51. Read-only publication planning; no remote writes or manifest promotion.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inspectApk, validateManifest } = require('./android-release.js');

const ARCHIVE = '/media/data/Complete/Sanctifi/Releases';
const SERVER = 'obscurity';
const BASE = '/opt/updates-site/client';
const URL = 'https://updates.sancti.fi/client';
const BUILD_TOOLS = path.join(process.env.ANDROID_HOME || '', 'build-tools/36.0.0');
function assert(ok, message) { if (!ok) throw new Error(message); }
function remoteScript(script) {
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', SERVER, 'sh -s'], {
    input: script + '\n', encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  assert(!result.error && result.status === 0, 'Read-only SSH inspection failed: ' + (result.stderr || result.error?.message || result.status));
  return result.stdout.trim();
}
function sha(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    for (;;) {
      const n = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!n) break;
      hash.update(buffer.subarray(0, n));
    }
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function readLocal(code) {
  assert(Number.isSafeInteger(code) && code > 0 && code <= 2100000000, 'Invalid versionCode');
  const filename = 'sanctifi-' + code + '.apk';
  const file = path.join(ARCHIVE, filename);
  const sidecar = file + '.json';
  assert(fs.lstatSync(file).isFile() && fs.lstatSync(sidecar).isFile(), 'Archived APK or sidecar missing');
  const record = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  assert(record.versionCode === code && /^[a-f0-9]{64}$/.test(record.sha256), 'Invalid build record');
  assert(sha(file) === record.sha256, 'Archived APK checksum differs from build record');
  return { file, filename, record };
}
function remoteInventory(filename) {
  // No sudo, no shell interpolation of user-supplied paths. The filename is numeric-only.
  const script = [
    'set -eu',
    'test -d ' + BASE + '/apks',
    'if test -e ' + BASE + '/apks/' + filename + '; then',
    ' sha256sum ' + BASE + '/apks/' + filename,
    'else printf "APK_ABSENT\\n"; fi',
    'if test -f ' + BASE + '/alpha.json; then',
    ' cat ' + BASE + '/alpha.json',
    'else printf "ALPHA_ABSENT\\n"; fi',
  ].join('\n');
  return remoteScript(script);
}
async function plan(code) {
  const { file, filename, record } = readLocal(code);
  const metadata = await inspectApk(file, BUILD_TOOLS);
  assert(metadata.versionCode === code && metadata.sha256 === record.sha256, 'APK identity differs from archived record');
  const remote = remoteInventory(filename);
  const match = remote.match(/^([a-f0-9]{64})\s+\/opt\/updates-site\/client\/apks\/sanctifi-\d+\.apk$/m);
  assert(!match || match[1] === record.sha256, 'Remote filename collision: DIFFERENT APK bytes');
  const alpha = remote.indexOf('{');
  if (alpha !== -1) {
    const manifest = JSON.parse(remote.slice(alpha));
    validateManifest(manifest);
    assert(manifest.versionCode <= code, 'Current Alpha has a newer versionCode; refusing downgrade');
    console.log('Current Alpha:', manifest.versionCode);
  } else {
    console.log('Current Alpha: absent');
  }
  console.log('Candidate:', filename);
  console.log('SHA-256:', record.sha256);
  console.log('VersionName:', metadata.versionName);
  console.log('Remote APK:', match ? 'identical bytes' : 'not present');
  console.log('Device tested (local record):', record.deviceTested);
  console.log('Planned channel: alpha');
  console.log('Public URL:', URL + '/apks/' + filename);
  console.log('READ ONLY: no transfer, publication or manifest change performed.');
}
if (require.main === module) {
  const [cmd, value, extra] = process.argv.slice(2);
  if (cmd !== 'plan' || !/^\d+$/.test(value || '') || extra) {
    console.error('Usage: node scripts/android-publish.js plan VERSION_CODE');
    process.exitCode = 2;
  } else {
    plan(Number(value)).catch(e => { console.error('Publication preflight failed:', e.message); process.exitCode = 1; });
  }
}
module.exports = { readLocal, sha };
, 'm'));
  assert(!match || match[1] === record.sha256, 'Remote filename collision: DIFFERENT APK bytes');
  const alpha = remote.indexOf('{');
  if (alpha !== -1) {
    const manifest = JSON.parse(remote.slice(alpha));
    validateManifest(manifest);
    assert(manifest.versionCode <= code, 'Current Alpha has a newer versionCode; refusing downgrade');
    console.log('Current Alpha:', manifest.versionCode);
  } else {
    console.log('Current Alpha: absent');
  }
  console.log('Candidate:', filename);
  console.log('SHA-256:', record.sha256);
  console.log('VersionName:', metadata.versionName);
  console.log('Remote APK:', match ? 'identical bytes' : 'not present');
  console.log('Device tested (local record):', record.deviceTested);
  console.log('Planned channel: alpha');
  console.log('Public URL:', URL + '/apks/' + filename);
  console.log('READ ONLY: no transfer, publication or manifest change performed.');
}
if (require.main === module) {
  const [cmd, value, extra] = process.argv.slice(2);
  if (cmd !== 'plan' || !/^\d+$/.test(value || '') || extra) {
    console.error('Usage: node scripts/android-publish.js plan VERSION_CODE');
    process.exitCode = 2;
  } else {
    plan(Number(value)).catch(e => { console.error('Publication preflight failed:', e.message); process.exitCode = 1; });
  }
}
module.exports = { readLocal, sha };
