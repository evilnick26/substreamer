'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeAtomic, reserve, readCounter } = require('../android-local-build');

test('counter replacement is complete and leaves no temporary file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-counter-'));
  try {
    const file = path.join(dir, 'last-code');
    fs.writeFileSync(file, '80000191\n');
    writeAtomic(file, '80000192\n');
    assert.equal(fs.readFileSync(file, 'utf8'), '80000192\n');
    assert.deepEqual(fs.readdirSync(dir), ['last-code']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('atomic writer refuses to replace a symlink destination via temporary-file collision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-counter-'));
  try {
    const file = path.join(dir, 'last-code');
    fs.writeFileSync(file + '.tmp-' + process.pid, 'occupied');
    assert.throws(() => writeAtomic(file, '80000192\n'), /EEXIST/);
    assert.equal(fs.existsSync(file), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});


test('each reservation consumes a new code even without an APK', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-reserve-'));
  try {
    const state = path.join(dir, '.local-build');
    fs.mkdirSync(state);
    fs.writeFileSync(path.join(state, 'last-code'), '80000191\\n'.replace('\\n', '\n'));
    assert.equal(reserve(state, dir), 80000192);
    // Simulate failure after allocation: no APK is created.
    assert.equal(reserve(state, dir), 80000193);
    assert.equal(readCounter(state), 80000193);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('archive collision blocks reservation without consuming a code', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-collision-'));
  try {
    const state = path.join(dir, '.local-build');
    fs.mkdirSync(state);
    fs.writeFileSync(path.join(state, 'last-code'), '80000191\n');
    fs.writeFileSync(path.join(dir, 'sanctifi-80000192.apk'), 'existing');
    assert.throws(() => reserve(state, dir), /Archive collision/);
    assert.equal(readCounter(state), 80000191);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
