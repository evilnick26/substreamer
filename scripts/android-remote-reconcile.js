'use strict';

// Read-only comparison; never generates or refreshes allocation attestations.
function reconcileRemote(baseline, remote, verifiedLocal = []) {
  const fail = (reason) => { throw new Error('Remote reconciliation: ' + reason); };
  if (baseline?.schemaVersion !== 1 || baseline.complete !== true ||
      baseline.exclusiveAllocator !== true || !Array.isArray(baseline.artifacts)) {
    fail('approved complete baseline required');
  }
  if (remote?.status !== 'observed-not-authoritative' || !Array.isArray(remote.apks) ||
      !remote.apks.length) fail('valid remote observation required');
  if (!Array.isArray(verifiedLocal)) fail('verified local APK records must be an array');
  const local = new Map();
  for (const item of verifiedLocal) {
    if (!Number.isSafeInteger(item.versionCode) || !/^[a-f0-9]{64}$/.test(item.sha256) ||
        local.has(item.versionCode) || item.verified !== true) fail('invalid or unverified local APK record');
    local.set(item.versionCode, item.sha256);
  }
  const seen = new Set();
  for (const apk of remote.apks) {
    if (!Number.isSafeInteger(apk.versionCode) || !/^[a-f0-9]{64}$/.test(apk.sha256) ||
        seen.has(apk.versionCode)) fail('invalid or duplicate remote APK');
    seen.add(apk.versionCode);
    const knownHistorical = baseline.artifacts.some((entry) => entry.versionCode === apk.versionCode &&
        entry.sha256 === apk.sha256 && entry.state === 'occupied');
    const knownLocal = local.get(apk.versionCode) === apk.sha256;
    if (!knownHistorical && !knownLocal) {
      fail('unrecognised published APK ' + apk.versionCode + '; explicit reconciliation required');
    }
  }
  if (!remote.apks.some((apk) => apk.versionCode === remote.alpha?.versionCode &&
      apk.sha256 === remote.alpha.sha256)) fail('Alpha manifest mismatch');
  return {
    status: 'remote-baseline-consistent',
    publishedCount: seen.size,
    highestPublishedCode: Math.max(...seen),
    limitations: 'Local verified records are supplied by caller; this function does not verify them, inspect reservations, prove remote completeness or issue an allocation attestation',
  };
}

module.exports = { reconcileRemote };
