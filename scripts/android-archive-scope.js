'use strict';

// Issue #067: a locally approved scope declaration, not an assertion that
// the filesystem is complete. Refuse silent archive additions or omissions.
const fs = require('node:fs');
const path = require('node:path');

function verifyArchiveScope({ file, directory, archives, baseline }) {
  if (!file || !path.isAbsolute(file)) throw new Error('Absolute approved scope file required');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Scope declaration must be a regular file');
  const scope = JSON.parse(fs.readFileSync(file, 'utf8'));
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
    const st = fs.lstatSync(folder);
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('Archive scope path is not a real directory: ' + folder);
  }
  return { approvedBy: scope.approvedBy, reason: scope.reason, scopeFile: file };
}

module.exports = { verifyArchiveScope };
