'use strict';

// Issue #067: read-only inventory of all declared local APK archives.
// This is evidence collection, not a history attestation or allocation.
const fs = require('node:fs');
const path = require('node:path');
const { inspectApk, releaseDirectory } = require('./android-release');

async function inventoryLocalArchives({
  directory, archivePaths, buildTools, outputApk, baseline, inspect = inspectApk,
}) {
  if (!directory || !buildTools || !Array.isArray(archivePaths) || !archivePaths.length ||
      baseline?.schemaVersion !== 1 || baseline.complete !== true ||
      !Array.isArray(baseline.artifacts)) {
    throw new Error('Complete approved baseline, archives and build tools required');
  }
  const archive = releaseDirectory(directory);
  const paths = [archive, ...archivePaths];
  const seen = new Set();
  const artifacts = [];
  const known = new Map();
  for (const entry of baseline.artifacts) {
    if (!Number.isSafeInteger(entry.versionCode) ||
        !['occupied', 'rejected'].includes(entry.state) ||
        (entry.sha256 !== null && !/^[a-f0-9]{64}$/.test(entry.sha256))) {
      throw new Error('Invalid historical artifact');
    }
    const key = entry.versionCode + ':' + entry.sha256;
    if (known.has(key) && known.get(key) !== entry.state) {
      throw new Error('Contradictory historical artifact states');
    }
    known.set(key, entry.state);
  }
  const occupiedHashes = new Map();
  async function visit(file) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error('Symlink in release archive: ' + file);
    const real = fs.realpathSync(file);
    if (seen.has(real)) return;
    seen.add(real);
    if (stat.isDirectory()) {
      if (real === path.join(archive, '.allocations')) return;
      for (const name of fs.readdirSync(file).sort()) await visit(path.join(file, name));
      return;
    }
    if (!stat.isFile()) throw new Error('Unexpected archive entry: ' + file);
    if (/\.apk\.json$/i.test(file)) {
      if (!fs.existsSync(file.slice(0, -5))) throw new Error('Orphan APK sidecar: ' + file);
      return;
    }
    if (!/\.apk$/i.test(file)) return;
    const apk = await inspect(file, buildTools);
    if (!Number.isSafeInteger(apk.versionCode) || !/^[a-f0-9]{64}$/.test(apk.sha256)) {
      throw new Error('Invalid inspected APK identity: ' + file);
    }
    const state = known.get(apk.versionCode + ':' + apk.sha256) === 'rejected' ? 'rejected' : 'occupied';
    if (state === 'occupied') {
      const previous = occupiedHashes.get(apk.versionCode);
      if (previous && previous !== apk.sha256) throw new Error('Conflicting occupied APK hashes: ' + apk.versionCode);
      occupiedHashes.set(apk.versionCode, apk.sha256);
    }
    const sidecar = file + '.json';
    if (fs.existsSync(sidecar)) {
      if (!fs.lstatSync(sidecar).isFile()) throw new Error('Invalid APK sidecar: ' + sidecar);
      const record = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      if (record.versionCode !== apk.versionCode || record.sha256 !== apk.sha256) {
        throw new Error('APK sidecar identity mismatch: ' + file);
      }
    }
    artifacts.push({ versionCode: apk.versionCode, sha256: apk.sha256, state, file });
  }
  for (const folder of paths) {
    if (!path.isAbsolute(folder) || !fs.lstatSync(folder).isDirectory()) {
      throw new Error('Archive path must be an existing absolute directory');
    }
    await visit(folder);
  }
  if (outputApk && fs.existsSync(outputApk)) await visit(outputApk);
  return {
    status: 'local-archives-inspected',
    inspectedFiles: artifacts.length,
    artifacts,
    archivePaths: paths,
    limitations: 'Archive paths are caller-supplied; complete coverage and remote consistency are not established',
  };
}

module.exports = { inventoryLocalArchives };
