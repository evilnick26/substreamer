'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeAtomic } = require('../android-local-build');

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
