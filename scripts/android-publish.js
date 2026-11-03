#!/usr/bin/env node
'use strict';
// Issue #51: read-only publication preflight. Does not upload or promote anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inspectApk, validateManifest } = require('./android-release.js');

const ARCHIVE = '/media/data/Complete/Sanctifi/Releases';
const BASE = '/opt/updates-site/client';
const URL = 'https://updates.sancti.fi/client';
const CERT_TOOLS = path.join(process.env.ANDROID_HOME || '', 'build-tools/36.0.0');

function check(ok, message) { if (!ok) throw new Error(message); }
function digest(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    while (true) {
      const size = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!size) break;
      hash.update(buffer.subarray(0, size));
    }
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function readLocal(code, archive = ARCHIVE) {
  check(Number.isSafeInteger(code) && code > 0 && code <= 2100000000, 'Invalid versionCode');
  const filename = 'sanctifi-' + code + '.apk';
  const file = path.join(archive, filename);
  const recordFile = file + '.json';
  check(fs.lstatSync(file).isFile() && fs.lstatSync(recordFile).isFile(), 'Archived APK or sidecar missing');
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  check(record.versionCode === code && /^[a-f0-9]{64}$/.test(record.sha256), 'Invalid build record');
  check(digest(file) === record.sha256, 'Archived APK checksum differs from build record');
  return { file, filename, record };
}
function inspectRemote(filename, ssh = spawnSync) {
  // The filename is produced exclusively from a validated integer.
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
  const result = ssh('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'obscurity', 'sh -s'], {
    input: script + '\n', encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
  });
  check(!result.error && result.status === 0, 'Read-only SSH inspection failed: ' + (result.stderr || result.error?.message || result.status));
  return result.stdout;
}
function parseRemote(output, code, expectedHash) {
  const filename = 'sanctifi-' + code + '.apk';
  const lines = output.trim().split('\n');
  const first = lines.shift();
  let remoteHash = null;
  if (first !== 'APK_ABSENT') {
    const match = /^([a-f0-9]{64})  (\/opt\/updates-site\/client\/apks\/sanctifi-\d+\.apk)$/.exec(first);
    check(match && match[2] === BASE + '/apks/' + filename, 'Unrecognised remote APK inventory');
    remoteHash = match[1];
    check(remoteHash === expectedHash, 'Remote filename collision: DIFFERENT APK bytes');
  }
  const rest = lines.join('\n').trim();
  let current = null;
  if (rest !== 'ALPHA_ABSENT') {
    current = validateManifest(JSON.parse(rest));
    check(current.versionCode <= code, 'Current Alpha has a newer versionCode; refusing downgrade');
  }
  return { remoteHash, current };
}
async function plan(code, deps = {}) {
  const local = readLocal(code, deps.archive || ARCHIVE);
  const apk = await (deps.inspectApk || inspectApk)(local.file, deps.buildTools || CERT_TOOLS);
  check(apk.versionCode === code && apk.sha256 === local.record.sha256, 'APK identity differs from archived record');
  const output = (deps.inspectRemote || inspectRemote)(local.filename);
  const remote = parseRemote(output, code, apk.sha256);
  return {
    code, filename: local.filename, sha256: apk.sha256, versionName: apk.versionName,
    currentAlpha: remote.current?.versionCode ?? null,
    remoteApk: remote.remoteHash ? 'identical' : 'absent',
    apkUrl: URL + '/apks/' + local.filename,
  };
}
if (require.main === module) {
  const [command, value, extra] = process.argv.slice(2);
  if (command !== 'plan' || !/^[1-9]\d*$/.test(value || '') || extra) {
    console.error('Usage: node scripts/android-publish.js plan VERSION_CODE');
    process.exitCode = 2;
  } else {
    plan(Number(value)).then(result => {
      console.log(JSON.stringify(result, null, 2));
      console.log('READ ONLY: no transfer, publication or manifest change performed.');
    }).catch(error => { console.error('Publication preflight failed:', error.message); process.exitCode = 1; });
  }
}
module.exports = { digest, readLocal, inspectRemote, parseRemote, plan };
