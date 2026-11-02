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
  'printf "%s\\n" "---BEFORE-END---"',
  'printf "%s\\n" "---SHA256---"',
  'sha256sum apks/sanctifi-*.apk',
  'printf "%s\\n" "---ALPHA---"',
  'cat alpha.json',
  'printf "\\n%s\\n" "---AFTER---"',
  'find apks -maxdepth 1 -type f -name "sanctifi-*.apk" -print | LC_ALL=C sort',
  'printf "%s\\n" "---AFTER-END---"',
  'sha256sum apks/sanctifi-*.apk',
  'printf "%s\\n" "---ALPHA-AGAIN---"',
  'cat alpha.json',
].join('\n');

function checkInventoryFileNames(filenames) {
  if (new Set(filenames).size !== filenames.length) throw new Error('Duplicate APK listing');
  for (const filename of filenames) {
    if (!/^apks\/sanctifi-\d+\.apk$/.test(filename)) throw new Error('Unexpected remote APK filename');
  }
}

function parseSnapshot(output) {
  const first = output.indexOf('\n---BEFORE-END---\n');
  const second = output.indexOf('\n---SHA256---\n');
  const third = output.indexOf('\n---ALPHA---\n');
  const fourth = output.indexOf('\n---AFTER---\n');
  const fifth = output.indexOf('\n---AFTER-END---\n');
  const sixth = output.indexOf('\n---ALPHA-AGAIN---\n');
  if ([first, second, third, fourth, fifth, sixth].some((i) => i < 0) ||
      !(first < second && second < third && third < fourth && fourth < fifth && fifth < sixth)) {
    throw new Error('Incomplete remote inventory response');
  }
  const names = output.slice(0, first).trim().split('\n').filter(Boolean);
  const hashes = output.slice(second + '\n---SHA256---\n'.length, third).trim().split('\n').filter(Boolean);
  const manifestText = output.slice(third + '\n---ALPHA---\n'.length, fourth).trim();
  const afterNames = output.slice(fourth + '\n---AFTER---\n'.length, fifth).trim().split('\n').filter(Boolean);
  const afterHashes = output.slice(fifth + '\n---AFTER-END---\n'.length, sixth).trim().split('\n').filter(Boolean);
  const afterManifest = output.slice(sixth + '\n---ALPHA-AGAIN---\n'.length).trim();
  if (!names.length || names.length !== hashes.length || names.length !== afterNames.length ||
      names.length !== afterHashes.length || manifestText !== afterManifest ||
      names.join('\n') !== afterNames.join('\n') ||
      hashes.slice().sort().join('\n') !== afterHashes.slice().sort().join('\n')) {
    throw new Error('Remote inventory changed during observation');
  }
  checkInventoryFileNames(names);
  const records = new Map();
  for (const line of hashes) {
    const match = /^([a-f0-9]{64})  (apks\/sanctifi-(\d+)\.apk)$/.exec(line);
    if (!match || records.has(match[2])) throw new Error('Malformed or duplicate APK hash record');
    const versionCode = Number(match[3]);
    if (!Number.isSafeInteger(versionCode)) throw new Error('Invalid remote versionCode');
    records.set(match[2], { versionCode, sha256: match[1] });
  }
  for (const name of names) if (!records.has(name)) throw new Error('APK listing and checksums disagree');
  const manifest = JSON.parse(manifestText);
  const apkName = `apks/sanctifi-${manifest.versionCode}.apk`;
  const current = records.get(apkName);
  if (manifest.schemaVersion !== 1 || !current || current.sha256 !== manifest.sha256 ||
      manifest.apkUrl !== `https://updates.sancti.fi/client/${apkName}`) {
    throw new Error('Alpha manifest disagrees with APK inventory');
  }
  return { apks: [...records.values()].sort((a, b) => a.versionCode - b.versionCode),
    alpha: { versionCode: manifest.versionCode, sha256: manifest.sha256 } };
}

function inspect(output) {
  const snapshot = parseSnapshot(output);
  return {
    status: 'observed-not-authoritative',
    host: HOST,
    archive: ROOT + '/apks',
    observedAt: new Date().toISOString(),
    ...snapshot,
    limitations: 'Double-read remote snapshot, not a transaction; no public HTTPS validation or historical/allocator attestation',
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
