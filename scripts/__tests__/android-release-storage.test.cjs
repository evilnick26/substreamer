'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_DIRECTORY, releaseDirectory, verifyArchiveMount, stageApk, allocate, synchronise, prepare } = require('../android-release');

const root = '10 1 8:1 / / rw,relatime - ext4 /dev/root rw\n';
const volume = '20 10 253:8 / /media/data rw,relatime - ext4 /dev/unspecified rw\n';
const valid = root + volume;
const archive = '/media/data/Complete/Sanctifi/Releases';

test('production default is the permanent archive, not a home-derived fallback', () => {
  assert.equal(DEFAULT_DIRECTORY, archive);
});

for (const [name, mountinfo, expected] of [
  ['no mount', root, /distinct mounted filesystem/],
  ['system drive bind mount', root + volume.replace('253:8', '8:1'), /distinct mounted filesystem/],
  ['read-only mount', root + volume.replace('rw,relatime', 'ro,relatime'), /read-only/],
  ['read-only filesystem', root + volume.replace('unspecified rw', 'unspecified ro'), /read-only/],
  ['nested system-drive mount', valid + '30 20 8:1 / /media/data/Complete rw - ext4 ignored rw\n', /another filesystem/],
  ['stacked mount', valid + volume.replace('20 10', '21 10'), /distinct mounted filesystem/],
  ['hidden mount under overmounted ancestor', valid + '30 10 8:3 / /media rw - ext4 ignored rw\n', /another filesystem/],
  ['malformed mountinfo', 'not mountinfo', /malformed/],
  ['empty mountinfo', '', /malformed/],
]) {
  test(`storage rejects ${name}`, () => assert.throws(() => verifyArchiveMount(archive, mountinfo), expected));
}

test('mounted storage accepts different device names and filesystem implementations', () => {
  assert.equal(verifyArchiveMount(archive, valid), archive);
  assert.equal(verifyArchiveMount(archive, valid.replace('rw,relatime -', 'rw,relatime shared:123 -')), archive);
  assert.equal(verifyArchiveMount(archive, valid.replace('ext4 /dev/unspecified', 'fuse.veracrypt non-device-label')), archive);
});

test('deepest covering mount is checked; unrelated mounts and path prefixes are ignored', () => {
  const unrelated = valid + '30 20 8:1 / /media/data/CompleteElsewhere rw - ext4 ignored rw\n';
  assert.equal(verifyArchiveMount(archive, unrelated), archive);
  const sameVolume = valid + '30 20 253:8 /bound /media/data/Complete rw - ext4 ignored rw\n';
  assert.equal(verifyArchiveMount(archive, sameVolume), archive);
});

for (const [escape, character] of [['040', ' '], ['011', '\t'], ['012', '\n'], ['134', '\\']]) {
  test(`mount paths decode Linux octal escape ${escape}`, () => {
    const target = '/media/data/Archive' + character + 'Files';
    const nested = valid + '30 20 8:1 / /media/data/Archive\\' + escape + 'Files rw - ext4 ignored rw\n';
    assert.throws(() => verifyArchiveMount(target + '/Releases', nested), /another filesystem/);
  });
}

test('explicit temporary override is isolated from production and does not inspect mounts', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'release-storage-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const read = fs.readFileSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    assert.notEqual(file, '/proc/self/mountinfo');
    return read(file, ...args);
  });
  const destination = path.join(temporary, 'archive');
  assert.equal(releaseDirectory(destination), destination);
  const apk = path.join(temporary, 'fixture.apk'); fs.writeFileSync(apk, 'fixture');
  await assert.rejects(stageApk(apk, '/fixture-sdk', '1'.repeat(40), destination, () => { throw new Error('fixture verification fails'); }), /verification failed/);
  assert.deepEqual(fs.readdirSync(destination), []);
});

for (const existing of [false, true]) {
  test(`missing mount creates no release state even when archive exists: ${existing}`, async (t) => {
    const read = fs.readFileSync;
    const lstat = fs.lstatSync;
    let inspectedArchive = false;
    t.mock.method(fs, 'readFileSync', (file, ...args) => file === '/proc/self/mountinfo' ? root : read(file, ...args));
    t.mock.method(fs, 'lstatSync', (file, ...args) => {
      if (file === archive) { inspectedArchive = true; return { isDirectory: () => existing }; }
      return lstat(file, ...args);
    });
    for (const method of ['mkdirSync', 'mkdtempSync', 'writeFileSync', 'appendFileSync', 'openSync', 'copyFileSync', 'linkSync', 'renameSync', 'rmSync', 'rmdirSync']) {
      t.mock.method(fs, method, () => assert.fail('persistent filesystem change: ' + method));
    }
    assert.throws(() => releaseDirectory(), /distinct mounted filesystem/);
    assert.throws(() => releaseDirectory(archive), /distinct mounted filesystem/);
    await assert.rejects(stageApk('/fixture.apk', '/fixture-sdk', '1'.repeat(40)), /distinct mounted filesystem/);
    await assert.rejects(allocate({ dryRun: false, execute: true, initialize: true }), /distinct mounted filesystem/);
    await assert.rejects(synchronise({ dryRun: false, execute: true, allocation: '/fixture.json' }), /distinct mounted filesystem/);
    const report = await prepare({ intent: 'new', allocation: '/fixture.json', dryRun: false, executeBuild: true });
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), /distinct mounted filesystem/);
    assert.equal(inspectedArchive, false, 'must validate mount before relying on directory existence');
  });
}

test('production mountinfo read failure fails closed without home fallback', (t) => {
  t.mock.method(fs, 'readFileSync', () => { throw new Error('unavailable'); });
  assert.throws(() => releaseDirectory(), /mountinfo unavailable; no fallback/);
});

test('valid production storage resolves through the existing outside-Git guard', (t) => {
  const read = fs.readFileSync;
  const lstat = fs.lstatSync;
  const stat = fs.statSync;
  const realpath = fs.realpathSync;
  t.mock.method(fs, 'readFileSync', (file, ...args) => file === '/proc/self/mountinfo' ? valid : read(file, ...args));
  t.mock.method(fs, 'lstatSync', (file, ...args) => file === archive ? { isDirectory: () => true } : lstat(file, ...args));
  t.mock.method(fs, 'statSync', (file, ...args) => file === archive ? { isDirectory: () => true } : stat(file, ...args));
  t.mock.method(fs, 'realpathSync', (file, ...args) => file === archive ? archive : realpath(file, ...args));
  assert.equal(releaseDirectory(), archive);
});

test('override symlink into production still requires the production mount', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'release-alias-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const realpath = fs.realpathSync;
  const read = fs.readFileSync;
  t.mock.method(fs, 'realpathSync', (file, ...args) => file === temporary ? archive : realpath(file, ...args));
  t.mock.method(fs, 'readFileSync', (file, ...args) => file === '/proc/self/mountinfo' ? root : read(file, ...args));
  assert.throws(() => releaseDirectory(temporary), /distinct mounted filesystem/);
});
