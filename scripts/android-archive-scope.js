'use strict';

// Issue #067: a locally approved scope declaration, not an assertion that
// the filesystem is complete. Refuse silent archive additions or omissions.
const fs = require('node:fs');
const path = require('node:path');

function approvedPath(value) {
  return typeof value === 'string' && path.isAbsolute(value) &&
    path.normalize(value) === value && fs.realpathSync(value) === value;
}

function verifyArchiveScope({ file, directory, archives, baseline }) {
  if (!file || !path.isAbsolute(file)) throw new Error('Absolute approved scope file required');
  if (fs.realpathSync(file) !== file) throw new Error('Scope declaration path must be canonical');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Scope declaration must be a regular file');
  const scope = JSON.parse(fs.readFileSync(file, 'utf8'));
  const permitted = ['schemaVersion', 'approved', 'approvedBy', 'reason',
    'allocationDirectory', 'archivePaths'];
  if (Object.keys(scope).some((key) => !permitted.includes(key))) {
    throw new Error('Unrecognised archive scope declaration field');
  }
  if (scope?.schemaVersion !== 1 || scope.approved !== true ||
      typeof scope.approvedBy !== 'string' || !scope.approvedBy.trim() ||
      typeof scope.reason !== 'string' || !scope.reason.trim() ||
      scope.allocationDirectory !== directory ||
      !Array.isArray(scope.archivePaths) || !scope.archivePaths.length ||
      !Array.isArray(archives) || !archives.length) {
    throw new Error('Explicit approved archive scope for exact allocation directory required');
  }
  const valid = (values) => values.every((value) =>
    typeof value === 'string' && path.isAbsolute(value) &&
    path.normalize(value) === value) && new Set(values).size === values.length;
  if (!valid(scope.archivePaths) || !valid(archives)) throw new Error('Invalid or duplicate archive path');
  if (!approvedPath(directory)) throw new Error('Invalid allocation directory');
  const declared = new Set(archives);
  const approved = new Set(scope.archivePaths);
  if (declared.size !== approved.size ||
      [...declared].some((p) => !approved.has(p))) {
    throw new Error('Actual archive scan differs from approved scope');
  }
  if (!Array.isArray(baseline?.archivePaths) ||
      baseline.archivePaths.some((p) => p !== directory && !approved.has(p))) {
    throw new Error('Approved scope omits historical archive path');
  }
  for (const folder of approved) {
    let st;
    try {
      st = fs.lstatSync(folder);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        throw new Error('Archive scope path is not a canonical real directory: ' + folder);
      }
      throw error;
    }
    if (!st.isDirectory() || st.isSymbolicLink() || fs.realpathSync(folder) !== folder) {
      throw new Error('Archive scope path is not a canonical real directory: ' + folder);
    }
  }
  return { approvedBy: scope.approvedBy, reason: scope.reason, scopeFile: file };
}

module.exports = { verifyArchiveScope };
