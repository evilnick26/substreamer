#!/usr/bin/env node
'use strict';
// Issue #51: read-only publication preflight. Does not upload or promote anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { inspectApk, validateManifest } = require('./android-release.js');
const { upload } = require('./android-publish-upload.js');
const { verifyPublicApk } = require('./android-publish-verify.js');
const { readCurrent, promote, rollback } = require('./android-publish-promote.js');
const https = require('node:https');
const readline = require('node:readline/promises');

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
async function fetchPublicManifest(request = https.get) {
  const url = URL + '/alpha.json?verify=' + crypto.randomBytes(8).toString('hex');
  const body = await new Promise((resolve, reject) => {
    const req = request(url, { headers: { 'Cache-Control': 'no-cache' }, timeout: 30000 }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('Public Alpha manifest HTTP ' + response.statusCode));
        return;
      }
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        text += chunk;
        if (text.length > 20000) req.destroy(new Error('Public manifest too large'));
      });
      response.on('end', () => resolve(text));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Public manifest timed out')));
  });
  return validateManifest(JSON.parse(body));
}
function writePublicationRecord(file, record) {
  const temp = file + '.tmp-' + crypto.randomBytes(8).toString('hex');
  try {
    fs.writeFileSync(temp, JSON.stringify(record, null, 2) + '\\n', { flag: 'wx', mode: 0o600 });
    // Atomic creation without replacing an existing publication record.
    fs.linkSync(temp, file);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    check(saved.versionCode === record.versionCode && saved.sha256 === record.sha256,
      'Publication record verification failed');
  } finally { try { fs.unlinkSync(temp); } catch { /* best effort */ } }
}
function sameManifest(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
async function approval(code) {
  check(process.stdin.isTTY && process.stdout.isTTY, 'Publication requires interactive approval');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Type PUBLISH ' + code + ' to promote Alpha: ');
    return answer.trim() === 'PUBLISH ' + code;
  } finally { rl.close(); }
}
async function publish(code, deps = {}) {
  const preflight = await (deps.plan || plan)(code);
  const local = readLocal(code, deps.archive || ARCHIVE);
  const manifest = validateManifest({
    schemaVersion: 1, versionCode: code, versionName: preflight.versionName,
    apkUrl: preflight.apkUrl, sha256: preflight.sha256,
    ...(deps.releaseNotes ? { releaseNotes: deps.releaseNotes } : {}),
  });
  console.log('Candidate:', JSON.stringify(manifest, null, 2));
  console.log('Current Alpha:', preflight.currentAlpha);
  check(preflight.remoteApk === 'absent' || preflight.remoteApk === 'identical', 'Remote APK collision');
  if (preflight.remoteApk === 'absent') {
    console.log('Uploading immutable APK (remote sudo may request password)...');
    (deps.upload || upload)(local.file, local.filename, preflight.sha256);
  }
  // Verify the actual publicly hosted APK before any manifest change.
  console.log('Verifying public APK by full HTTPS download...');
  await (deps.verifyPublicApk || verifyPublicApk)(manifest);
  const previousRaw = (deps.readCurrent || readCurrent)();
  check(previousRaw !== 'ALPHA_ABSENT', 'Alpha manifest missing');
  const previous = validateManifest(JSON.parse(previousRaw));
  check(previous.versionCode <= code, 'Refusing Alpha downgrade');
  check(!sameManifest(previous, manifest), 'Alpha already points to this exact release; nothing to publish');
  console.log('Proposed Alpha:', previous.versionCode, '->', code);
  const approved = await (deps.approval || approval)(code);
  check(approved, 'Publication cancelled; Alpha manifest unchanged');
  // Compare-and-swap within remote sudo script rejects concurrent manifest edits.
  const state = (deps.promote || promote)(manifest, previousRaw);
  try {
    const publicManifest = await (deps.fetchPublicManifest || fetchPublicManifest)();
    check(sameManifest(publicManifest, manifest), 'Public Alpha manifest differs from approved manifest');
    await (deps.verifyPublicApk || verifyPublicApk)(manifest);
  } catch (error) {
    console.error('Post-promotion verification failed:', error.message);
    try {
      (deps.rollback || rollback)(state);
      console.error('Previous Alpha manifest restored on Obscurity; verify public cache separately.');
    } catch (recovery) {
      throw new Error('PUBLICATION VERIFICATION FAILED AND ROLLBACK FAILED: ' + recovery.message + '; original: ' + error.message);
    }
    throw error;
  }
  const record = {
    schemaVersion: 1, channel: 'alpha', versionCode: code, sha256: preflight.sha256,
    previousVersionCode: previous.versionCode, publishedAt: new Date().toISOString(),
    publicApkVerified: true, publicManifestVerified: true,
  };
  const recordPath = local.file + '.publication.json';
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Published Alpha', code, 'and recorded:', recordPath);
  return record;
}
if (require.main === module) {
  const [command, value, extra] = process.argv.slice(2);
  if (command !== 'plan' || !/^[1-9]\d*$/.test(value || '') || extra) {
    console.error('Usage: node scripts/android-publish.js plan|publish VERSION_CODE');
    process.exitCode = 2;
  } else {
    plan(Number(value)).then(result => {
      console.log(JSON.stringify(result, null, 2));
      console.log('READ ONLY: no transfer, publication or manifest change performed.');
    }).catch(error => { console.error('Publication preflight failed:', error.message); process.exitCode = 1; });
  }
}
module.exports = { digest, readLocal, inspectRemote, parseRemote, plan, publish, approval, fetchPublicManifest, writePublicationRecord };
