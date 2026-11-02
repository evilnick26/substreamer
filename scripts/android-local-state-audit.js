'use strict';

// Issue #067: fail-closed, read-only local release-state audit.
// Not an allocation attestation: complete local archive scans and server
// reconciliation remain separate requirements.
const fs = require('node:fs');
const path = require('node:path');
const { releaseDirectory } = require('./android-release');

function auditReleaseState({ directory, ledgerFile }) {
  if (!directory || !ledgerFile) throw new Error('Release state audit requires directory and ledgerFile');
  const archive = releaseDirectory(directory);
  const registry = path.join(archive, '.allocations');
  const identityFile = path.join(registry, 'registry.json');
  if (!fs.lstatSync(registry).isDirectory() || !fs.lstatSync(identityFile).isFile()) {
    throw new Error('Missing trusted allocation registry');
  }
  const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
  if (identity.schemaVersion !== 1 || identity.directory !== archive) {
    throw new Error('Allocation registry identity mismatch');
  }
  const entries = fs.readdirSync(registry).filter((name) => name !== 'registry.json');
  const reservations = new Map();
  for (const name of entries) {
    if (!/^\d+\.json$/.test(name)) throw new Error('Unknown allocation registry entry: ' + name);
    const file = path.join(registry, name);
    if (!fs.lstatSync(file).isFile()) throw new Error('Invalid reservation file: ' + name);
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    const code = Number(name.slice(0, -5));
    if (!Number.isSafeInteger(code) || record.schemaVersion !== 2 ||
        record.reconciled !== true || record.directory !== archive ||
        record.versionCode !== code || record.highWaterMark + 1 !== code ||
        !/^[a-f0-9-]{36}$/.test(record.id || '')) {
      throw new Error('Invalid allocation reservation: ' + name);
    }
    reservations.set(code, record);
  }
  if (!fs.lstatSync(ledgerFile).isFile()) throw new Error('Missing release ledger');
  const rows = fs.readFileSync(ledgerFile, 'utf8').split('\n')
    .filter((line) => /^\|\s*`\d+`\s*\|/.test(line));
  if (!rows.length) throw new Error('Empty release ledger');
  const ledger = new Map();
  for (const row of rows) {
    const fields = row.split('|').slice(1, -1).map((field) => field.trim().replaceAll('`', ''));
    const code = Number(fields[0]);
    if (fields.length !== 6 || !Number.isSafeInteger(code) || ledger.has(code) ||
        !/^(Published|Reserved|Failed|Withdrawn|Rejected)\b/.test(fields[5])) {
      throw new Error('Invalid or duplicate ledger row: ' + row);
    }
    const sha256 = /^[a-f0-9]{64}$/.test(fields[3]) ? fields[3] : null;
    if (fields[5].startsWith('Published') && !sha256) throw new Error('Published ledger row missing SHA-256: ' + code);
    ledger.set(code, { versionCode: code, sha256, status: fields[5] });
  }
  for (const [code, reservation] of reservations) {
    const row = ledger.get(code);
    if (!row || !row.status.includes(reservation.id)) {
      throw new Error('Reservation missing or inconsistent with ledger: ' + code);
    }
  }
  const attempts = [];
  for (const name of fs.readdirSync(archive)) {
    if (!name.startsWith('.attempt-')) continue;
    const match = /^\.attempt-(\d+)$/.exec(name);
    if (!match) throw new Error('Unknown attempt marker: ' + name);
    const code = Number(match[1]);
    if (!Number.isSafeInteger(code) || !reservations.has(code) || !ledger.has(code)) {
      throw new Error('Attempt marker without reservation and ledger: ' + name);
    }
    attempts.push(code);
  }
  const occupied = new Set([...ledger.keys(), ...reservations.keys(), ...attempts]);
  return {
    status: 'local-state-consistent',
    registry: archive,
    ledgerCount: ledger.size,
    reservationCount: reservations.size,
    attemptedCodes: attempts.sort((a, b) => a - b),
    highestKnownCode: Math.max(...occupied),
    ledger: [...ledger.values()].sort((a, b) => a.versionCode - b.versionCode),
    limitations: 'Does not scan every local archive, verify APK signatures or prove remote completeness; no history freshness assertion',
  };
}

module.exports = { auditReleaseState };
