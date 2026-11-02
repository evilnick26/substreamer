'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditReleaseState } = require('../android-local-state-audit');

let directory;
let ledgerFile;
const id = '11111111-2222-3333-4444-555555555555';
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-audit-'));
  ledgerFile = path.join(directory, 'ledger.md');
  fs.mkdirSync(path.join(directory, '.allocations'));
  fs.writeFileSync(path.join(directory, '.allocations/registry.json'),
    JSON.stringify({ schemaVersion: 1, directory }));
  fs.writeFileSync(path.join(directory, '.allocations/80000191.json'),
    JSON.stringify({ schemaVersion: 2, reconciled: true, directory, id,
      versionCode: 80000191, highWaterMark: 80000190 }));
  fs.writeFileSync(ledgerFile,
    '| `80000190` | 8.1.8 | Unknown | ' + 'a'.repeat(64) + ' | Unknown | Published |\n' +
    '| `80000191` | 8.1.8 | Unknown | Not built | Unknown | Reserved ' + id + ' |\n');
  fs.writeFileSync(path.join(directory, '.attempt-80000191'), '');
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

test('audits ledger, private reservations and attempted codes', () => {
  const result = auditReleaseState({ directory, ledgerFile });
  expect(result.status).toBe('local-state-consistent');
  expect(result.highestKnownCode).toBe(80000191);
  expect(result.attemptedCodes).toEqual([80000191]);
});
test('rejects orphan attempted build', () => {
  fs.writeFileSync(path.join(directory, '.attempt-80000192'), '');
  expect(() => auditReleaseState({ directory, ledgerFile })).toThrow('Attempt marker without reservation');
});
test('rejects reservation not present in ledger', () => {
  fs.writeFileSync(ledgerFile, '| `80000190` | 8.1.8 | Unknown | ' + 'a'.repeat(64) + ' | Unknown | Published |\n');
  expect(() => auditReleaseState({ directory, ledgerFile })).toThrow('Reservation missing');
});
test('rejects duplicate ledger versionCodes', () => {
  fs.appendFileSync(ledgerFile, '| `80000190` | 8.1.8 | Unknown | ' + 'a'.repeat(64) + ' | Unknown | Published |\n');
  expect(() => auditReleaseState({ directory, ledgerFile })).toThrow('duplicate ledger');
});
test('rejects registry identity mismatch', () => {
  fs.writeFileSync(path.join(directory, '.allocations/registry.json'),
    JSON.stringify({ schemaVersion: 1, directory: '/wrong' }));
  expect(() => auditReleaseState({ directory, ledgerFile })).toThrow('registry identity mismatch');
});
