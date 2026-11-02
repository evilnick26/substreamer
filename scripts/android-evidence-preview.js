'use strict';

// Issue #067: construct an inspectable candidate evidence set, never an
// allocation attestation. No timestamps, complete:true or file writes here.
function previewEvidence({ baseline, remote, local }) {
  if (baseline?.schemaVersion !== 1 || baseline.complete !== true ||
      baseline.exclusiveAllocator !== true || !Array.isArray(baseline.artifacts) ||
      remote?.status !== 'observed-not-authoritative' || !Array.isArray(remote.apks) ||
      !Array.isArray(local?.inspectedArtifacts) || !Array.isArray(local?.ledgerArtifacts) ||
      !Array.isArray(local?.attemptedCodes)) {
    throw new Error('Evidence preview requires reconciled baseline, remote and local inputs');
  }
  const artifacts = new Map();
  function add(item, source) {
    const { versionCode, sha256, state } = item;
    if (!Number.isSafeInteger(versionCode) || versionCode < 1 ||
        !['occupied', 'rejected'].includes(state) ||
        !(sha256 === null && state === 'occupied') &&
        !(typeof sha256 === 'string' && /^[a-f0-9]{64}$/.test(sha256))) {
      throw new Error('Invalid evidence identity from ' + source);
    }
    const key = [versionCode, sha256, state].join(':');
    if (!artifacts.has(key)) artifacts.set(key, { versionCode, sha256, state });
  }
  for (const item of baseline.artifacts) add(item, 'historical baseline');
  for (const item of local.inspectedArtifacts) add(item, 'signed local APK');
  for (const item of local.ledgerArtifacts) add(item, 'release ledger');
  for (const code of local.attemptedCodes) add({ versionCode: code, sha256: null, state: 'occupied' }, 'attempt marker');
  for (const item of remote.apks) add({ ...item, state: 'occupied' }, 'remote published archive');
  const list = [...artifacts.values()].sort((a, b) =>
    a.versionCode - b.versionCode || a.state.localeCompare(b.state) ||
    (a.sha256 || '').localeCompare(b.sha256 || ''));
  const occupied = new Map();
  const rejected = new Set(list.filter((x) => x.state === 'rejected').map((x) => x.versionCode + ':' + x.sha256));
  for (const item of list.filter((x) => x.state === 'occupied' && x.sha256 !== null)) {
    const key = item.versionCode + ':' + item.sha256;
    if (rejected.has(key)) throw new Error('Same APK is occupied and rejected: ' + item.versionCode);
    if (occupied.has(item.versionCode) && occupied.get(item.versionCode) !== item.sha256) {
      throw new Error('Conflicting occupied APK identities: ' + item.versionCode);
    }
    occupied.set(item.versionCode, item.sha256);
  }
  const codes = list.map((x) => x.versionCode);
  if (!codes.length) throw new Error('No release evidence');
  return {
    status: 'candidate-evidence-not-attested',
    highestKnownCode: Math.max(...codes),
    nextCandidateCode: Math.max(...codes) + 1,
    artifacts: list,
    limitations: 'Not allocation authority: requires verified complete archive scope, stable remote evidence and explicit approved fresh history generation.',
  };
}

module.exports = { previewEvidence };
