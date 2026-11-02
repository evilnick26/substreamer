'use strict';

// Read-only comparison; never generates or refreshes allocation attestations.
function reconcileRemote(baseline, remote) {
  const fail = (reason) => { throw new Error('Remote reconciliation: ' + reason); };
  if (baseline?.schemaVersion !== 1 || baseline.complete !== true ||
      baseline.exclusiveAllocator !== true || !Array.isArray(baseline.artifacts)) {
    fail('approved complete baseline required');
  }
  if (remote?.status !== 'observed-not-authoritative' || !Array.isArray(remote.apks) ||
      !remote.apks.length) fail('valid remote observation required');
  const seen = new Set();
  for (const apk of remote.apks) {
    if (!Number.isSafeInteger(apk.versionCode) || !/^[a-f0-9]{64}$/.test(apk.sha256) ||
        seen.has(apk.versionCode)) fail('invalid or duplicate remote APK');
    seen.add(apk.versionCode);
    if (!baseline.artifacts.some((entry) => entry.versionCode === apk.versionCode &&
        entry.sha256 === apk.sha256 && entry.state === 'occupied')) {
      fail('unrecognised published APK ' + apk.versionCode + '; explicit reconciliation required');
    }
  }
  if (!remote.apks.some((apk) => apk.versionCode === remote.alpha?.versionCode &&
      apk.sha256 === remote.alpha.sha256)) fail('Alpha manifest mismatch');
  return {
    status: 'remote-baseline-consistent',
    publishedCount: seen.size,
    highestPublishedCode: Math.max(...seen),
    limitations: 'No local registry scan, signature check, remote completeness proof or allocation attestation',
  };
}

module.exports = { reconcileRemote };
