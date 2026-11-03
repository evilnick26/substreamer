'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scriptFor, hash } = require('../android-publish-promote.js');
const TOKEN = 'f'.repeat(32);
const BEFORE = 'a'.repeat(64);
const JSON_TEXT = '{"schemaVersion":1}\n';
test('promotion checks current manifest, stages and atomically renames', () => {
  const script = scriptFor('promote', BEFORE, JSON_TEXT, TOKEN);
  assert.match(script, /sha256sum -c -/);
  assert.match(script, /cp -p/);
  assert.match(script, /base64 -d/);
  assert.match(script, /mv -f/);
  assert.match(script, /\.backup/);
  assert.doesNotMatch(script, /beta\.json|release\.json/);
});
test('rollback requires expected promoted checksum and retained backup', () => {
  const script = scriptFor('rollback', hash(JSON_TEXT), JSON_TEXT, TOKEN);
  assert.match(script, /test -f .*\.backup/);
  assert.match(script, /mv -f .*\.backup/);
  assert.match(script, /sha256sum -c -/);
});
test('rejects malformed token and expected checksum', () => {
  assert.throws(() => scriptFor('promote', 'bad', JSON_TEXT, TOKEN), /checksum/);
  assert.throws(() => scriptFor('promote', BEFORE, JSON_TEXT, '../bad'), /token/);
});
