'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyArchiveScope } = require('../android-archive-scope');
let dir, a, b, file, scope;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-scope-'));
  a = path.join(dir, 'releases');
  b = path.join(dir, 'quarantine');
  fs.mkdirSync(a);
  fs.mkdirSync(b);
  file = path.join(dir, 'scope.json');
  scope = { schemaVersion: 1, approved: true, approvedBy: 'owner',
    reason: 'reviewed both release archives', allocationDirectory: a,
    archivePaths: [a, b] };
  fs.writeFileSync(file, JSON.stringify(scope));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
const check = (archives = [a, b], baseline = { archivePaths: [a, b] }) =>
  verifyArchiveScope({ file, directory: a, archives, baseline });
test('accepts an exact explicit owner-reviewed archive scope', () => {
  expect(check().approvedBy).toBe('owner');
});
test('rejects omitted and unapproved scan locations', () => {
  expect(() => check([a])).toThrow('differs');
  expect(() => check([a, b, dir])).toThrow('differs');
});
test('rejects historical archive omission even when scan matches approval', () => {
  expect(() => check([a, b], { archivePaths: [a, b, dir] })).toThrow('historical');
});
test('rejects missing owner approval and unavailable directories', () => {
  scope.approved = false;
  fs.writeFileSync(file, JSON.stringify(scope));
  expect(() => check()).toThrow('Explicit approved');
  scope.approved = true;
  fs.writeFileSync(file, JSON.stringify(scope));
  fs.rmdirSync(b);
  expect(() => check()).toThrow('real directory');
});

test('rejects archive paths resolving through a symlinked parent', () => {
  const alias = path.join(dir, 'alias');
  fs.symlinkSync(b, alias, 'dir');
  scope.archivePaths = [a, alias];
  fs.writeFileSync(file, JSON.stringify(scope));
  expect(() => check([a, alias], { archivePaths: [a] })).toThrow('canonical real directory');
});
test('rejects unknown approval declaration fields', () => {
  scope.unreviewedOverride = true;
  fs.writeFileSync(file, JSON.stringify(scope));
  expect(() => check()).toThrow('Unrecognised archive scope');
});
