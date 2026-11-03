'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { promote, hash } = require('../android-publish-promote.js');
const { writePublicationRecord } = require('../android-publish.js');
const old = '{"versionCode":80000191}\n';
const manifest = {
  schemaVersion: 1, versionCode: 80000193, versionName: '8.1.8',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000193.apk',
  sha256: 'a'.repeat(64),
};
test('SSH disconnect after rename reconciles as success', () => {
  const newRaw = JSON.stringify(manifest, null, 2) + '\n';
  const result = promote(manifest, old, {
    random: () => 'f'.repeat(32),
    run: () => { throw new Error('SSH disconnected'); },
    readCurrent: () => newRaw,
  });
  assert.equal(result.after, hash(newRaw));
});
test('SSH disconnect before rename fails without retry', () => {
  assert.throws(() => promote(manifest, old, {
    random: () => 'f'.repeat(32),
    run: () => { throw new Error('SSH disconnected'); },
    readCurrent: () => old,
  }), /did not take effect/);
});
test('unreadable or unexpected remote state is explicitly uncertain', () => {
  assert.throws(() => promote(manifest, old, {
    random: () => 'f'.repeat(32),
    run: () => { throw new Error('SSH disconnected'); },
    readCurrent: () => { throw new Error('offline'); },
  }), /UNKNOWN/);
});
test('publication record is valid JSON and never overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-record-'));
  try {
    const file = path.join(dir, 'publication.json');
    const record = { versionCode: 80000193, sha256: 'a'.repeat(64) };
    writePublicationRecord(file, record);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), record);
    assert.throws(() => writePublicationRecord(file, record), /EEXIST/);
    assert.deepEqual(fs.readdirSync(dir), ['publication.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI rejects invalid command before any remote work', () => {
  const script = path.resolve(__dirname, '../android-publish.js');
  const result = spawnSync(process.execPath, [script, 'publish', 'not-a-code'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});
test('CLI dispatches publish command (missing archive fails preflight, not usage)', () => {
  const script = path.resolve(__dirname, '../android-publish.js');
  const result = spawnSync(process.execPath, [script, 'publish', '2100000000'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /Usage:/);
  assert.match(result.stderr, /Publication command ended:/);
});
