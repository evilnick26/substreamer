'use strict';

// Issue #067: verified local inputs for remote reconciliation.
// This module does not allocate, write history or assert archive completeness.
const fs = require('node:fs');
const path = require('node:path');
const { inspectApk, releaseDirectory } = require('./android-release');
const { reconcileRemote } = require('./android-remote-reconcile');
const { auditReleaseState } = require('./android-local-state-audit');

async function reconcileLocalPublished({ directory, buildTools, ledgerFile, baseline, remote, inspect = inspectApk }) {
  if (!buildTools || !directory || !ledgerFile) throw new Error('Local reconciliation requires archive, ledger and Android build-tools');
  const archive = releaseDirectory(directory);
  const localState = auditReleaseState({ directory: archive, ledgerFile });
  const registry = path.join(archive, '.allocations');
  const identityPath = path.join(registry, 'registry.json');
  if (!fs.lstatSync(registry).isDirectory() || !fs.lstatSync(identityPath).isFile()) {
    throw new Error('Private allocation registry unavailable');
  }
  const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
  if (identity.schemaVersion !== 1 || identity.directory !== archive) {
    throw new Error('Private allocation registry identity mismatch');
  }
  const verifiedLocal = [];
  for (const published of remote.apks || []) {
    const code = published.versionCode;
    if (!Number.isSafeInteger(code) || code < 1) throw new Error('Invalid remote versionCode');
    const filename = path.join(archive, `sanctifi-${code}.apk`);
    let stat;
    try { stat = fs.lstatSync(filename); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      continue; // Baseline may already attest older server-only APKs.
    }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Local APK must be a regular file: ' + filename);
    const apk = await inspect(filename, buildTools);
    if (apk.versionCode !== code || apk.sha256 !== published.sha256) {
      throw new Error('Local and published APK identities conflict for ' + code);
    }
    // inspectApk verifies permanent signer, package, version and file hash.
    verifiedLocal.push({ versionCode: code, sha256: apk.sha256, verified: true });
  }
  const result = reconcileRemote(baseline, remote, verifiedLocal);
  for (const row of localState.ledger) {
    if (!row.sha256 || !row.status.startsWith('Published')) continue;
    const published = remote.apks.find((item) => item.versionCode === row.versionCode);
    if (published && published.sha256 !== row.sha256) {
      throw new Error('Published ledger checksum conflicts with remote APK: ' + row.versionCode);
    }
  }
  return {
    ...result,
    verifiedLocalCount: verifiedLocal.length,
    localState: { ledgerCount: localState.ledgerCount, reservationCount: localState.reservationCount,
      attemptedCodes: localState.attemptedCodes, highestKnownCode: localState.highestKnownCode },
    limitations: 'Read-only archive/remote comparison only. Local reservations, attempt markers, ledger, complete archive scope and refreshed history still require allocationEvidence validation.',
  };
}

module.exports = { reconcileLocalPublished };
