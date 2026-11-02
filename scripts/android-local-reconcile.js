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
    if (!row.status.startsWith('Published')) continue;
    if (!row.sha256) throw new Error('Published ledger entry has no checksum: ' + row.versionCode);
    const published = remote.apks.find((item) => item.versionCode === row.versionCode);
    // A published artifact must remain in the immutable server archive.
    // Missing files are not evidence that a versionCode can be reused.
    if (!published) throw new Error('Published ledger APK missing from remote archive: ' + row.versionCode);
    if (published.sha256 !== row.sha256) {
      throw new Error('Published ledger checksum conflicts with remote APK: ' + row.versionCode);
    }
  }
  return {
    ...result,
    verifiedLocalCount: verifiedLocal.length,
    localArchiveInspectedFiles: localArchives.inspectedFiles,
    // Preserve verified identities for the future evidence collector. The
    // caller must still attest completeness; never treat this as authority.
    inspectedArtifacts: localArchives.artifacts.map(({ versionCode, sha256, state }) =>
      ({ versionCode, sha256, state })),
    ledgerArtifacts: localState.ledger.map(({ versionCode, sha256, status }) =>
      ({ versionCode, sha256, state: status.startsWith('Rejected') ? 'rejected' : 'occupied' })),
    attemptedCodes: [...localState.attemptedCodes],
    localState: { ledgerCount: localState.ledgerCount, reservationCount: localState.reservationCount,
      attemptedCodes: localState.attemptedCodes, highestKnownCode: localState.highestKnownCode },
    limitations: 'Read-only comparison of caller-declared archives. Archive coverage, stable remote snapshot and refreshed history still require independent attestation.',
  };
}

module.exports = { reconcileLocalPublished };
