#!/usr/bin/env node
'use strict';

// Issue #067: read-only Obscurity inventory probe. This is NOT an allocation
// attestation and must not be used to bypass android-release.js --history.
const { spawnSync } = require('node:child_process');

const HOST = 'evilnick@sancti.fi';
const ROOT = '/opt/updates-site/client';
const script = [
  'set -eu',
  'cd /opt/updates-site/client',
  'find apks -maxdepth 1 -type f -name "sanctifi-*.apk" -print | LC_ALL=C sort',
  'printf "%s\\n" "---SHA256---"',
  'sha256sum apks/sanctifi-*.apk',
  'printf "%s\\n" "---ALPHA---"',
  'cat alpha.json',
].join('\n');

function checkInventoryFileNames(filenames) {
  if (new Set(filenames).size !== filenames.length) throw new Error('Duplicate APK listing');
  for (const filename of filenames) {
    if (!/^apks\/sanctifi-\d+\.apk$/.test(filename)) throw new Error('Unexpected remote APK filename');
  }
}

function inspect(output) {
  const first = output.indexOf('\n---SHA256---\n');
  const second = output.indexOf('\n---ALPHA---\n');
  if (first < 0 || second < first) throw new Error('Incomplete remote inventory response');
  const filenames = output.slice(0, first).trim().split('\n').filter(Boolean);
  const hashLines = output.slice(first + '\n---SHA256---\n'.length, second).trim().split('\n').filter(Boolean);
  if (!filenames.length || hashLines.length !== filenames.length) throw new Error('Incomplete remote APK inventory');
  const hashes = new Map();
  for (const line of hashLines) {
    const match = /^([a-f0-9]{64})  (apks\/sanctifi-(\d+)\.apk)$/.exec(line);
    if (!match || hashes.has(match[2])) throw new Error('Malformed or duplicate APK hash record');
    hashes.set(match[2], { versionCode: Number(match[3]), sha256: match[1] });
  }
  for (const filename of filenames) {
    if (!/^apks\/sanctifi-\d+\.apk$/.test(filename) || !hashes.has(filename)) {
      throw new Error('APK listing and checksums disagree');
    }
  }
  checkInventoryFileNames(filenames);
  const manifest = JSON.parse(output.slice(second + '\n---ALPHA---\n'.length));
  const apkName = `apks/sanctifi-${manifest.versionCode}.apk`;
  const current = hashes.get(apkName);
  if (manifest.schemaVersion !== 1 || !current ||
      current.sha256 !== manifest.sha256 ||
      manifest.apkUrl !== `https://updates.sancti.fi/client/${apkName}`) {
    throw new Error('Alpha manifest disagrees with APK inventory');
  }
  return {
    status: 'observed-not-authoritative',
    host: HOST,
    archive: ROOT + '/apks',
    observedAt: new Date().toISOString(),
    apks: [...hashes.values()].sort((a, b) => a.versionCode - b.versionCode),
    alpha: { versionCode: manifest.versionCode, sha256: manifest.sha256 },
    limitations: 'Read-only remote observation; no APK signature verification, local registry reconciliation, historical baseline or allocation lock',
  };
}

function main() {
  const result = spawnSync('ssh', [
    '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '--', HOST, 'sh', '-s',
  ], { input: script + '\n', encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Remote inventory SSH command failed: ' + (result.stderr || 'exit ' + result.status).trim());
  process.stdout.write(JSON.stringify(inspect(result.stdout), null, 2) + '\n');
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write('Remote inventory failed closed: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { inspect };
