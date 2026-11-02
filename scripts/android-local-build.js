#!/usr/bin/env node
'use strict';
// Issue #67: Futwick-only internal APK builder. Never publishes anything.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const ARCHIVE = '/media/data/Complete/Sanctifi/Releases';
const STATE = path.join(ARCHIVE, '.local-build');
const MAX = 2100000000;
const CERT = 'a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c';
function requireTrue(ok, message) { if (!ok) throw new Error(message); }
function syncDir(dir) { const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function writeAtomic(file, data) {
  const temp = file + '.tmp-' + process.pid;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(temp, file); syncDir(path.dirname(file)); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function readCounter() {
  const value = fs.readFileSync(path.join(STATE, 'last-code'), 'utf8').trim();
  requireTrue(/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)), 'Invalid local versionCode counter');
  return Number(value);
}
function ensureArchive() {
  requireTrue(os.hostname().toLowerCase() === 'futwick', 'Builds are permitted only on Futwick');
  requireTrue(fs.existsSync(ARCHIVE) && fs.realpathSync(ARCHIVE) === ARCHIVE, 'Release archive missing or redirected');
  const mounts = fs.readFileSync('/proc/self/mountinfo', 'utf8');
  requireTrue(mounts.split('\n').some(line => line.split(' ')[4] === '/media/data'), '/media/data is not mounted');
  requireTrue(fs.statSync(ARCHIVE).isDirectory(), 'Release archive is not a directory');
}
function reserve() {
  const previous = readCounter();
  requireTrue(previous < MAX, 'Android versionCode limit reached');
  const next = previous + 1;
  requireTrue(!fs.existsSync(path.join(ARCHIVE, 'sanctifi-' + next + '.apk')) && !fs.existsSync(path.join(ARCHIVE, 'sanctifi-' + next + '.apk.json')), 'Archive collision; reconcile before proceeding');
  writeAtomic(path.join(STATE, 'last-code'), next + '\n');
  return next;
}
function updateVersions(code) {
  const appFile = path.join(ROOT, 'app.json');
  const gradleFile = path.join(ROOT, 'android/app/build.gradle');
  const app = JSON.parse(fs.readFileSync(appFile, 'utf8'));
  const gradle = fs.readFileSync(gradleFile, 'utf8');
  requireTrue(app.expo.android.package === 'fi.sancti.client', 'Unexpected application ID');
  const matches = [...gradle.matchAll(/^[ \t]*versionCode[ \t]+\d+[ \t]*$/gm)];
  requireTrue(matches.length === 1, 'Expected one Gradle versionCode');
  app.expo.android.versionCode = code;
  writeAtomic(appFile, JSON.stringify(app, null, 2) + '\n');
  writeAtomic(gradleFile, gradle.replace(/^([ \t]*versionCode[ \t]+)\d+([ \t]*)$/m, (_, prefix, suffix) => prefix + code + suffix));
}
function verify(apk, code) {
  const tools = path.join(process.env.ANDROID_HOME || '', 'build-tools/36.0.0');
  const signer = execFileSync(path.join(tools, 'apksigner'), ['verify', '--print-certs', apk], { encoding: 'utf8' });
  const badging = execFileSync(path.join(tools, 'aapt2'), ['dump', 'badging', apk], { encoding: 'utf8' });
  requireTrue(signer.toLowerCase().includes('certificate sha-256 digest: ' + CERT), 'Unexpected APK signing certificate');
  requireTrue(new RegExp("package: name='fi\\.sancti\\.client' versionCode='" + code + "'").test(badging), 'Unexpected APK identity/version');
}
function build() {
  ensureArchive();
  requireTrue(fs.existsSync(path.join(STATE, 'last-code')), 'Counter not initialised. Reconcile existing builds once; then run init CODE.');
  fs.mkdirSync(STATE, { recursive: true, mode: 0o700 });
  const lock = path.join(STATE, 'build.lock');
  fs.mkdirSync(lock); // Exclusive; stale lock requires investigation, never auto-remove.
  try {
    const code = reserve(); // Consumed even if metadata, compilation or verification fails.
    updateVersions(code);
    console.log('Reserved versionCode ' + code);
    const revision = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const output = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
    if (fs.existsSync(output)) fs.unlinkSync(output); // Never accept a stale Gradle output.
    const result = spawnSync('./gradlew', ['assembleRelease', '--no-daemon'], { cwd: path.join(ROOT, 'android'), stdio: 'inherit' });
    requireTrue(result.status === 0, 'Gradle build failed; code ' + code + ' remains consumed');
    const apk = output;
    requireTrue(fs.existsSync(apk), 'Gradle produced no APK; code remains consumed');
    verify(apk, code);
    const dest = path.join(ARCHIVE, 'sanctifi-' + code + '.apk');
    fs.copyFileSync(apk, dest, fs.constants.COPYFILE_EXCL);
    const archived = fs.openSync(dest, 'r');
    try { fs.fsyncSync(archived); } finally { fs.closeSync(archived); }
    syncDir(ARCHIVE);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
    const record = { versionCode: code, sha256: sha, sourceRevision: revision, builtAt: new Date().toISOString(), deviceTested: false, published: false };
    const recordFd = fs.openSync(dest + '.json', 'wx', 0o600);
    try { fs.writeFileSync(recordFd, JSON.stringify(record, null, 2) + '\n'); fs.fsyncSync(recordFd); } finally { fs.closeSync(recordFd); }
    syncDir(ARCHIVE);
    console.log('Archived ' + dest + '\nSHA-256 ' + sha + '\nNOT published; device acceptance outstanding.');
  } finally { fs.rmdirSync(lock); }
}
function init(code) {
  ensureArchive();
  requireTrue(Number.isSafeInteger(code) && code > 0 && code < MAX, 'Supply a valid reconciled last-used versionCode');
  fs.mkdirSync(STATE, { recursive: true, mode: 0o700 });
  const file = path.join(STATE, 'last-code');
  requireTrue(!fs.existsSync(file), 'Counter already initialised; refusing to reset it');
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, code + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  syncDir(STATE);
  console.log('Initialised last-used versionCode ' + code + '; no build performed');
}
if (require.main === module) {
  try {
    const [cmd, value] = process.argv.slice(2);
    if (cmd === 'init' && /^\d+$/.test(value || '')) init(Number(value));
    else if (cmd === 'build' && !value) build();
    else throw new Error('Usage: node scripts/android-local-build.js init LAST_USED_CODE | build');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { readCounter, writeAtomic, updateVersions, reserve };
