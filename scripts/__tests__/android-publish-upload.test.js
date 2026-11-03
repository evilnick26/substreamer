'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installScript, upload } = require('../android-publish-upload.js');
const HASH = 'a'.repeat(64);
const NAME = 'sanctifi-80000193.apk';
const TMP = '/tmp/sanctifi-upload-' + 'f'.repeat(32) + '.apk';

test('upload script checks temp and final checksum and uses exclusive hard-link', () => {
  const script = installScript(NAME, HASH, TMP);
  assert.match(script, /sha256sum -c -/);
  assert.match(script, /\bln /);
  assert.match(script, /root:root:644/);
  assert.doesNotMatch(script, /alpha\.json|beta\.json|release\.json/);
});
test('rejects path traversal and invalid hash', () => {
  assert.throws(() => installScript('../alpha.json', HASH, TMP), /filename/);
  assert.throws(() => installScript(NAME, 'bad', TMP), /checksum/);
  assert.throws(() => installScript(NAME, HASH, '/tmp/evil'), /temporary/);
});
test('upload invokes scp, remote sudo and cleanup in order', () => {
  const calls = [];
  upload('/local/archive.apk', NAME, HASH, {
    random: () => 'f'.repeat(32),
    run: (cmd, args) => { calls.push({ cmd, args }); return ''; },
  });
  assert.deepEqual(calls.map(x => x.cmd), ['scp', 'ssh', 'ssh']);
  assert.match(calls[1].args.at(-1), /^sudo \/bin\/sh -c /);
  assert.match(calls[2].args.at(-1), /rm -f/);
});
test('cleanup runs if remote install fails', () => {
  const calls = [];
  assert.throws(() => upload('/local/archive.apk', NAME, HASH, {
    random: () => 'f'.repeat(32),
    run: (cmd, args) => {
      calls.push(cmd);
      if (calls.length === 2) throw new Error('remote install failed');
    },
  }), /remote install failed/);
  assert.deepEqual(calls, ['scp', 'ssh', 'ssh']);
});
