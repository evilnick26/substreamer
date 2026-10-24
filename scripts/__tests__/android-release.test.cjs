const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { validateManifest, validateArtifact, stageApk, CERTIFICATE } = require('../android-release');

const revision = '1'.repeat(40);
const bytes = Buffer.from('Synthetic APK bytes for filesystem tests; not a signed APK.');
const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = () => ({ schemaVersion: 1, versionCode: 80000186, versionName: '8.1.8',
  apkUrl: 'https://sancti.fi/updates/apks/sanctifi-80000186.apk', sha256: checksum });

// SDK process outputs are simulated; no keys or signed APKs are created.
function sdk({ code = '80000186', name = '8.1.8', packageName = 'fi.sancti.client', cert = CERTIFICATE } = {}) {
  return (command, args) => {
    if (path.basename(command) === 'apksigner') {
      assert.deepEqual(args.slice(0, 3), ['verify', '--verbose', '--print-certs']);
      return `Verifies\nSigner #1 certificate SHA-256 digest: ${cert}\n`;
    }
    assert.equal(path.basename(command), 'aapt2');
    assert.deepEqual(args.slice(0, 2), ['dump', 'badging']);
    return `package: name='${packageName}' versionCode='${code}' versionName='${name}'\n`;
  };
}

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-release-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'app-release.apk');
  fs.writeFileSync(source, bytes);
  return { directory, source, staging: path.join(directory, 'staged') };
}

test('valid manifest with optional plain-text notes', () => {
  assert.deepEqual(validateManifest(manifest()), manifest());
  validateManifest({ ...manifest(), releaseNotes: 'Playback improvements.\nDetails.' });
});

for (const [name, value] of [
  ['array', []], ['null', null], ['missing fields', {}],
  ['unsupported schema', { ...manifest(), schemaVersion: 2 }],
  ['string schema', { ...manifest(), schemaVersion: '1' }],
  ['string version code', { ...manifest(), versionCode: '80000186' }],
  ['fractional version code', { ...manifest(), versionCode: 1.5 }],
  ['zero version code', { ...manifest(), versionCode: 0 }],
  ['overflow version code', { ...manifest(), versionCode: 2100000001 }],
  ['numeric version name', { ...manifest(), versionName: 8 }],
  ['blank version name', { ...manifest(), versionName: ' ' }],
  ['long version name', { ...manifest(), versionName: 'x'.repeat(129) }],
  ['missing checksum', { ...manifest(), sha256: undefined }],
  ['short checksum', { ...manifest(), sha256: 'abc' }],
  ['uppercase checksum', { ...manifest(), sha256: 'A'.repeat(64) }],
  ['nonhex checksum', { ...manifest(), sha256: 'z'.repeat(64) }],
  ['unknown field', { ...manifest(), releaseNote: 'typo' }],
  ['invalid notes', { ...manifest(), releaseNotes: [] }],
  ['excessive notes', { ...manifest(), releaseNotes: 'x'.repeat(4001) }],
]) {
  test(`rejects manifest ${name}`, () => assert.throws(() => validateManifest(value)));
}

for (const url of [
  'http://sancti.fi/updates/apks/sanctifi-80000186.apk',
  'https://other.example/updates/apks/sanctifi-80000186.apk',
  'https://sancti.fi/updates/apks/sanctifi-80000185.apk',
  'https://sancti.fi/updates/apks/app-release.apk',
  'https://user:pass@sancti.fi/updates/apks/sanctifi-80000186.apk',
  'https://sancti.fi:444/updates/apks/sanctifi-80000186.apk',
  'https://sancti.fi/updates/apks/sanctifi-80000186.apk?x=1',
  'https://sancti.fi/updates/apks/sanctifi-80000186.apk#fragment',
  'https://sancti.fi/updates/apks/../apks/sanctifi-80000186.apk',
]) {
  test(`rejects noncanonical URL ${url}`, () => assert.throws(() => validateManifest({ ...manifest(), apkUrl: url })));
}

test('stages a verified snapshot by actual APK metadata without changing original output', async (t) => {
  const { source, staging } = setup(t);
  const record = await stageApk(source, '/dummy-sdk', revision, staging, sdk());
  assert.equal(record.filename, 'sanctifi-80000186.apk');
  assert.equal(record.versionName, '8.1.8');
  assert.equal(record.sha256, checksum);
  assert.equal(record.certificateSha256, CERTIFICATE);
  assert.equal(record.sourceRevision, revision);
  assert.deepEqual(fs.readFileSync(source), bytes);
  assert.deepEqual(fs.readFileSync(path.join(staging, record.filename)), bytes);
  assert.equal(JSON.parse(fs.readFileSync(path.join(staging, record.filename + '.json'))).sha256, checksum);
  assert.equal(fs.readdirSync(staging).length, 2);
});

test('repeat staging is idempotent and preserves the existing inode', async (t) => {
  const { source, staging } = setup(t);
  const first = await stageApk(source, '/dummy-sdk', revision, staging, sdk());
  const destination = path.join(staging, first.filename);
  const inode = fs.statSync(destination).ino;
  assert.deepEqual(await stageApk(source, '/dummy-sdk', revision, staging, sdk()), first);
  assert.equal(fs.statSync(destination).ino, inode);
  assert.equal(fs.readdirSync(staging).length, 2);
});

test('staging derives a different filename and version name from SDK metadata', async (t) => {
  const { source, staging } = setup(t);
  const record = await stageApk(source, '/dummy-sdk', revision, staging,
    sdk({ code: '80000187', name: '0.1.2' }));
  assert.equal(record.filename, 'sanctifi-80000187.apk');
  assert.equal(record.versionCode, 80000187);
  assert.equal(record.versionName, '0.1.2');
  assert.deepEqual(fs.readFileSync(source), bytes);
});

test('refuses a reused code with different bytes and keeps original artifact/record', async (t) => {
  const { source, staging } = setup(t);
  const first = await stageApk(source, '/dummy-sdk', revision, staging, sdk());
  const recordFile = path.join(staging, first.filename + '.json');
  const record = fs.readFileSync(recordFile);
  fs.writeFileSync(source, 'Different build bytes');
  await assert.rejects(stageApk(source, '/dummy-sdk', revision, staging, sdk()), /overwrite a different/);
  assert.deepEqual(fs.readFileSync(path.join(staging, first.filename)), bytes);
  assert.deepEqual(fs.readFileSync(recordFile), record);
});

test('refuses conflicting source provenance without rewriting the record', async (t) => {
  const { source, staging } = setup(t);
  await stageApk(source, '/dummy-sdk', revision, staging, sdk());
  await assert.rejects(stageApk(source, '/dummy-sdk', '2'.repeat(40), staging, sdk()), /record differs/);
});

test('repairs an interrupted staging run with an existing identical APK but no record', async (t) => {
  const { source, staging } = setup(t);
  fs.mkdirSync(staging);
  fs.copyFileSync(source, path.join(staging, 'sanctifi-80000186.apk'));
  await stageApk(source, '/dummy-sdk', revision, staging, sdk());
  assert.equal(fs.readdirSync(staging).length, 2);
});

test('rejects a symlink destination', async (t) => {
  const { source, staging } = setup(t);
  fs.mkdirSync(staging);
  fs.symlinkSync(source, path.join(staging, 'sanctifi-80000186.apk'));
  await assert.rejects(stageApk(source, '/dummy-sdk', revision, staging, sdk()), /regular file/);
});

for (const [name, run] of [
  ['invalid signature/tool failure', () => { throw new Error('verification failed'); }],
  ['wrong signer', sdk({ cert: 'f'.repeat(64) })],
  ['wrong package', sdk({ packageName: 'com.ghenry22.substream2' })],
  ['zero APK version code', sdk({ code: '0' })],
  ['missing APK version name', sdk({ name: '' })],
  ['ambiguous quoted APK version name', sdk({ name: "8.1.8'bad" })],
  ['unreadable metadata', () => 'unexpected output'],
  ['multiple signers', (command, args) => path.basename(command) === 'apksigner'
    ? `Signer #1 certificate SHA-256 digest: ${CERTIFICATE}\nSigner #2 certificate SHA-256 digest: ${CERTIFICATE}\n`
    : sdk()(command, args)],
]) {
  test(`staging rejects ${name} and leaves no artifacts`, async (t) => {
    const { source, staging } = setup(t);
    await assert.rejects(stageApk(source, '/dummy-sdk', revision, staging, run));
    assert.deepEqual(fs.readdirSync(staging), []);
    assert.deepEqual(fs.readFileSync(source), bytes);
  });
}

test('missing source and invalid source revision fail safely', async (t) => {
  const { directory, source, staging } = setup(t);
  await assert.rejects(stageApk(path.join(directory, 'missing.apk'), '/dummy-sdk', revision, staging, sdk()));
  await assert.rejects(stageApk(source, '/dummy-sdk', 'HEAD', staging, sdk()), /exact full source revision/);
});

test('local artifact verification checks checksum and exact APK versions', async (t) => {
  const { source } = setup(t);
  await validateArtifact(manifest(), source, '/dummy-sdk', sdk());
  await assert.rejects(validateArtifact({ ...manifest(), sha256: '0'.repeat(64) }, source, '/dummy-sdk', sdk()), /checksum differs/);
  await assert.rejects(validateArtifact({ ...manifest(), versionName: '0.1.1' }, source, '/dummy-sdk', sdk()), /metadata differs/);
  await assert.rejects(validateArtifact(manifest(), source, '/dummy-sdk', sdk({ code: '80000187' })), /metadata differs/);
});

test('channel promotion preserves identical artifact metadata', () => {
  const alpha = manifest();
  const beta = structuredClone(alpha);
  const release = structuredClone(alpha);
  for (const value of [alpha, beta, release]) validateManifest(value);
  assert.deepEqual(alpha, beta);
  assert.deepEqual(beta, release);
});

test('CLI separates structural validation from artifact verification and rejects bad input', (t) => {
  const { directory } = setup(t);
  const file = path.join(directory, 'alpha.json');
  const cli = path.resolve(__dirname, '../android-release.js');
  fs.writeFileSync(file, JSON.stringify(manifest()));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const valid = run('validate', file);
  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /artifact and live hosting not checked/);
  assert.notEqual(run('validate', file, '--unknown', 'value').status, 0);
  assert.notEqual(run('stage', file).status, 0);
  fs.writeFileSync(file, '{broken');
  assert.notEqual(run('validate', file).status, 0);
});

test('CLI stages and revalidates a manifest using simulated SDK executables', (t) => {
  const { directory, source, staging } = setup(t);
  const tools = path.join(directory, 'sdk');
  fs.mkdirSync(tools);
  for (const name of ['apksigner', 'aapt2']) {
    const output = sdk()(name, name === 'apksigner' ? ['verify', '--verbose', '--print-certs'] : ['dump', 'badging']);
    fs.writeFileSync(path.join(tools, name), '#!/usr/bin/env node\nprocess.stdout.write(' + JSON.stringify(output) + ');\n', { mode: 0o700 });
  }
  const cli = path.resolve(__dirname, '../android-release.js');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }).trim();
  assert.notEqual(run('stage', source, '--build-tools', tools, '--source-revision', '0'.repeat(40), '--directory', staging).status, 0);
  const staged = run('stage', source, '--build-tools', tools, '--source-revision', sourceRevision, '--directory', staging);
  assert.equal(staged.status, 0, staged.stderr);
  assert.equal(JSON.parse(staged.stdout).filename, 'sanctifi-80000186.apk');
  const file = path.join(directory, 'alpha.json');
  fs.writeFileSync(file, JSON.stringify(manifest()));
  const checked = run('validate', file, '--apk', path.join(staging, 'sanctifi-80000186.apk'), '--build-tools', tools);
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /Manifest and local APK verified/);
  assert.deepEqual(fs.readFileSync(source), bytes);
});
