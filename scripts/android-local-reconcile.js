'use strict';

// Issue #067: verified local inputs for remote reconciliation.
// This module does not allocate, write history or assert archive completeness.
const fs = require('node:fs');
const path = require('node:path');
const { inspectApk, releaseDirectory } = require('./android-release');
const { reconcileRemote } = require('./android-remote-reconcile');
const { auditReleaseState } = require('./android-local-state-audit');
const { inventoryLocalArchives } = require('./android-local-archives');

async function reconcileLocalPublished({ directory, buildTools, ledgerFile, archivePaths, outputApk, baseline, remote, inspect = inspectApk }) {
  if (!buildTools || !directory || !ledgerFile) throw new Error('Local reconciliation requires archive, ledger and Android build-tools');
  const archive = releaseDirectory(directory);
  const localState = auditReleaseState({ directory: archive, ledgerFile });
  const localArchives = await inventoryLocalArchives({ directory: archive, archivePaths,
    outputApk, buildTools, baseline, inspect });
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
    const matching = localArchives.artifacts.filter((item) => item.versionCode === code);
    if (matching.some((item) => item.sha256 !== published.sha256 && item.state !== 'rejected')) {
      throw new Error('Local and published APK identities conflict for ' + code);
    }
    if (matching.some((item) => item.sha256 === published.sha256 && item.state === 'occupied')) {
      verifiedLocal.push({ versionCode: code, sha256: published.sha256, verified: true });
    }
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
    localArchiveInspectedFiles: localArchives.inspectedFiles,
    localState: { ledgerCount: localState.ledgerCount, reservationCount: localState.reservationCount,
      attemptedCodes: localState.attemptedCodes, highestKnownCode: localState.highestKnownCode },
    limitations: 'Read-only comparison of caller-declared archives. Archive coverage, stable remote snapshot and refreshed history still require independent attestation.',
  };
}

module.exports = { reconcileLocalPublished };
