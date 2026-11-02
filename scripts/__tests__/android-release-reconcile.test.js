'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { optionsFromArgs, readBaseline, report } = require('../android-release-reconcile');

let directory, baselineFile;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-report-'));
  baselineFile = path.join(directory, 'baseline.json');
  fs.writeFileSync(baselineFile, JSON.stringify({
    schemaVersion: 1, complete: true, exclusiveAllocator: true,
    allocationDirectory: directory,
    artifacts: [{ versionCode: 80000191, sha256: 'a'.repeat(64), state: 'occupied' }],
  }));
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

test('requires an explicit archive declaration', () => {
  expect(() => optionsFromArgs(['--baseline', 'file', '--directory', '/tmp/a',
    '--build-tools', '/sdk', '--ledger', 'ledger'])).toThrow('Required');
});
test('rejects unknown arguments and duplicate scalar options', () => {
  expect(() => optionsFromArgs(['--unknown', 'x'])).toThrow('Unknown');
  expect(() => optionsFromArgs(['--directory', '/a', '--directory', '/b'])).toThrow('Duplicate');
});
test('rejects a baseline for a different archive', () => {
  expect(() => readBaseline(baselineFile, '/wrong')).toThrow('Approved complete');
});
test('reports reconciliation without allocating or writing history', async () => {
  const result = await report({
    baseline: baselineFile, directory, archives: [directory], buildTools: '/sdk',
    ledgerFile: '/ledger',
  }, {
    probe: () => ({ status: 'observed-not-authoritative', observedAt: '2026-11-02T18:39:44Z' }),
    reconcile: async () => ({ publishedCount: 6, highestPublishedCode: 80000191,
      verifiedLocalCount: 6, localArchiveInspectedFiles: 6,
      localState: { highestKnownCode: 80000191 } }),
  });
  expect(result.status).toBe('read-only-reconciled-not-attested');
  expect(result.highestPublishedCode).toBe(80000191);
  expect(fs.readdirSync(directory)).toEqual(['baseline.json']);
});
