'use strict';

// Issue #067: durable, read-only-to-release-state evidence draft.
// This is intentionally NOT an allocator --history file. A human must approve
// archive coverage and the historical authority before any attestation is issued.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { previewEvidence } = require('./android-evidence-preview');

function makeEvidenceDraft({ baseline, remote, local, archivePaths, allocationDirectory, now = new Date() }) {
  if (!Array.isArray(archivePaths) || !archivePaths.length ||
      !archivePaths.every((p) => typeof p === 'string' && path.isAbsolute(p)) ||
      new Set(archivePaths).size !== archivePaths.length ||
      typeof allocationDirectory !== 'string' || !path.isAbsolute(allocationDirectory) ||
      baseline?.allocationDirectory !== allocationDirectory ||
      !Array.isArray(baseline.archivePaths) || !baseline.archivePaths.length) {
    throw new Error('Exact archive directory and explicit archive scope required');
  }
  // Historical archive scope may only expand, never silently shrink.
  for (const prior of baseline.archivePaths) {
    if (!archivePaths.includes(prior)) throw new Error('Historical archive omitted: ' + prior);
  }
  const observed = Date.parse(remote?.observedAt);
  const generated = now.getTime();
  if (!Number.isFinite(observed) || !Number.isFinite(generated) ||
      generated < observed || generated - observed > 5 * 60 * 1000) {
    throw new Error('Remote observation is stale or has no trustworthy timestamp');
  }
  if (local?.status !== 'remote-baseline-consistent' ||
      !Number.isSafeInteger(local.highestPublishedCode) ||
      !Number.isSafeInteger(local.localArchiveInspectedFiles)) {
    throw new Error('Successful signed local and remote reconciliation required');
  }
  const preview = previewEvidence({ baseline, remote, local });
  const highestRemote = Math.max(...remote.apks.map((a) => a.versionCode));
  if (local.highestPublishedCode !== highestRemote) {
    throw new Error('Reconciliation report conflicts with remote observation');
  }
  return {
    schemaVersion: 1,
    status: 'draft-not-authoritative',
    generatedAt: now.toISOString(),
    remoteObservedAt: remote.observedAt,
    allocationDirectory,
    archivePaths,
    baselineCheckedAt: baseline.checkedAt || null,
    baselineDigest: crypto.createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
    localInspectedApks: local.localArchiveInspectedFiles,
    highestPublishedCode: highestRemote,
    nextCandidateCode: preview.nextCandidateCode,
    artifacts: preview.artifacts,
    limitations: 'Not valid --history: archive completeness, remote publication scope and provenance require explicit approval; no complete, checkedAt, sources or exclusiveAllocator claims.',
  };
}

// Exclusive creation; a draft is never overwritten and never placed in Git.
function writeEvidenceDraft(file, draft) {
  if (draft?.status !== 'draft-not-authoritative' || draft.complete !== undefined ||
      draft.checkedAt !== undefined || draft.exclusiveAllocator !== undefined ||
      draft.sources !== undefined || !Array.isArray(draft.artifacts)) {
    throw new Error('Refusing to persist an allocation attestation as a draft');
  }
  const parent = path.dirname(path.resolve(file));
  const stat = fs.lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Draft parent must be a real directory');
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(draft, null, 2) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return file;
}

module.exports = { makeEvidenceDraft, writeEvidenceDraft };
