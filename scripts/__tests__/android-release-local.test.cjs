'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { preflight, prepare: runPrepare, stageApk, CERTIFICATE, sourceState, localOptions, executeChecks } = require('../android-release');

const prepare = (options, root, env, build, run) => runPrepare(options, root, env, build, run,
  () => [{ command: 'fixture checks', result: 'passed (simulated)' }]);

const bytes = Buffer.from('Fixture APK, never signed or distributed');
function fixture(t, intent = 'new') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-local-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'repo');
  const archive = path.join(directory, 'archive');
  const tools = path.join(directory, 'sdk/build-tools/36.0.0');
  const jdk = path.join(directory, 'jdk');
  const write = (name, text, mode) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, mode ? { mode } : undefined);
    return file;
  };
  const config = { expo: { version: '8.1.8', android: { package: 'fi.sancti.client', versionCode: 80000189 }, extra: { sanctifiVersion: '0.1.1' } } };
  write('app.json', JSON.stringify(config));
  write('.gitignore', 'android/\nnode_modules/\n');
  write('docs/android-release-ledger.md', '| `80000188` | Published |\n| `80000189` | Reserved |\n');
  const native = write('android/app/build.gradle', `android {
    defaultConfig {
        applicationId "fi.sancti.client"
        versionCode 80000189
        versionName "8.1.8"
    }
    // Fixture only; not executable signing configuration.
    signingConfig signingConfigs.sanctifiRelease
    validateSanctifiReleaseSigning
}\n`);
  write('android/gradlew', '#!/bin/sh\nexit 99\n', 0o700);
  write('node_modules/expo/package.json', '{}');
  fs.mkdirSync(tools, { recursive: true });
  fs.mkdirSync(path.join(jdk, 'bin'), { recursive: true });
  for (const file of [path.join(tools, 'apksigner'), path.join(tools, 'aapt2'), path.join(jdk, 'bin/java'), path.join(jdk, 'bin/javac')]) {
    fs.writeFileSync(file, '#!/bin/sh\nexit 99\n', { mode: 0o700 });
  }
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'sanctifi');
  git('add', '.');
  git('-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture');
  const revision = git('rev-parse', 'HEAD');
  const allocation = path.join(directory, 'allocation.json');
  fs.writeFileSync(allocation, JSON.stringify({ reconciled: true, versionCode: 80000189, highWaterMark: 80000188, ledgerReference: 'fixture reservation', sourceRevision: revision }));
  const options = { intent, directory: archive, ...(intent === 'new' ? { allocation } : {}), dryRun: false, executeBuild: true };
  const env = { JAVA_HOME: jdk, ANDROID_HOME: path.join(directory, 'sdk') };
  const output = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
  const build = (_root, _env, log) => {
    assert.equal(_root, root);
    fs.writeFileSync(log, 'simulated Gradle build\n', { mode: 0o600 });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes);
  };
  const sdk = (command) => {
    if (path.basename(command) === 'java') return 'openjdk 21.0.8';
    return path.basename(command) === 'apksigner'
      ? `Verifies\nSigner #1 certificate SHA-256 digest: ${CERTIFICATE}\n`
      : "package: name='fi.sancti.client' versionCode='80000189' versionName='8.1.8'\n";
  };
  return { root, archive, tools, native, options, env, output, build, sdk, git, write, revision, allocation, directory };
}

async function archived(f, revision = f.revision) {
  fs.writeFileSync(path.join(f.directory, 'existing.apk'), bytes);
  return stageApk(path.join(f.directory, 'existing.apk'), f.tools, revision, f.archive, f.sdk);
}

test('preflight and dry run are read-only and execute no build or SDK processes', async (t) => {
  const f = fixture(t);
  const before = await sourceState(f.root);
  const report = await preflight(f.options, f.root, f.env);
  assert.equal(report.ok, true, report.errors.join('\n'));
  const dry = await prepare({ ...f.options, executeBuild: false, dryRun: true }, f.root, f.env,
    () => assert.fail('build'), () => assert.fail('SDK or Java'));
  assert.equal(dry.ok, true);
  assert.equal(fs.existsSync(f.archive), false);
  assert.deepEqual(await sourceState(f.root), before);
  assert.equal(fs.existsSync(f.output), false);
});

test('new preparation builds with fixture, verifies, stages and writes separate private provenance', async (t) => {
  const f = fixture(t);
  const report = await prepare(f.options, f.root, f.env, f.build, f.sdk);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.apk.size, bytes.length);
  assert.equal(report.artifactSourceRevision, f.revision);
  assert.equal(report.manifestCandidate.versionName, '8.1.8');
  assert.equal(report.semanticVersion, '0.1.1');
  assert.equal(report.publication, 'none');
  assert.match(report.manualAcceptance, /Not performed/);
  const record = JSON.parse(fs.readFileSync(path.join(f.archive, 'sanctifi-80000189.apk.json')));
  assert.equal(record.sourceRevision, f.revision);
  assert.equal(Object.hasOwn(record, 'startedAt'), false);
  assert.equal(fs.statSync(report.evidenceDirectory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(report.evidenceDirectory, 'summary.json')).mode & 0o777, 0o600);
  assert.equal(report.after.nativeInputsSha256, report.source.nativeInputsSha256);
});

test('keep-version identical rebuild preserves original artifact and provenance from another commit', async (t) => {
  const f = fixture(t, 'keep');
  await archived(f, '1'.repeat(40));
  const file = path.join(f.archive, 'sanctifi-80000189.apk.json');
  const before = fs.readFileSync(file);
  const report = await prepare(f.options, f.root, f.env, f.build, f.sdk);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.equal(report.artifactSourceRevision, '1'.repeat(40));
  assert.equal(report.source.sourceRevision, f.revision);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('changed bytes with same code fail without overwriting archive', async (t) => {
  const f = fixture(t, 'keep');
  await archived(f);
  const build = (...args) => { f.build(...args); fs.appendFileSync(f.output, 'changed'); };
  const report = await prepare(f.options, f.root, f.env, build, f.sdk);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /Changed APK bytes/);
  assert.deepEqual(fs.readFileSync(path.join(f.archive, 'sanctifi-80000189.apk')), bytes);
});

for (const [name, change, expected] of [
  ['stale Gradle code', (f) => fs.writeFileSync(f.native, fs.readFileSync(f.native, 'utf8').replace('80000189', '80000187')), /Stale native metadata/],
  ['missing native project', (f) => fs.rmSync(path.join(f.root, 'android'), { recursive: true }), /Native Android project missing/],
  ['missing signer', (f) => fs.writeFileSync(f.native, fs.readFileSync(f.native, 'utf8').replace('sanctifiRelease', 'debug')), /Permanent release signer/],
  ['dirty source', (f) => fs.appendFileSync(path.join(f.root, 'app.json'), ' '), /Source tree is dirty/],
  ['untracked input', (f) => f.write('untracked.js', 'code'), /Source tree is dirty/],
  ['missing allocation', (f) => delete f.options.allocation, /reconciling 80000188/],
  ['unreconciled allocation', (f) => fs.writeFileSync(f.allocation, '{"reconciled":false}'), /Allocation must attest/],
  ['missing JDK', (f) => delete f.env.JAVA_HOME, /Configure JAVA_HOME/],
  ['missing SDK tool', (f) => fs.unlinkSync(path.join(f.tools, 'aapt2')), /ENOENT/],
  ['archive inside Git', (f) => f.options.directory = path.join(f.root, 'releases'), /outside every Git/],
  ['symlink archive into Git', (f) => { fs.symlinkSync(f.root, path.join(f.directory, 'link')); f.options.directory = path.join(f.directory, 'link/archive'); }, /outside every Git/],
  ['native symlink input', (f) => fs.symlinkSync(f.native, path.join(f.root, 'android/linked.gradle')), /symlinks require manual review/],
]) {
  test(`preparation refuses ${name} before build`, async (t) => {
    const f = fixture(t);
    change(f);
    const report = await prepare(f.options, f.root, f.env, () => assert.fail('build'), () => assert.fail('SDK'));
    assert.equal(report.ok, false);
    assert.match(report.errors.join('\n'), expected);
    assert.equal(fs.existsSync(f.output), false);
  });
}

test('build failure retains failure summary and restores previous standard output', async (t) => {
  const f = fixture(t);
  f.build(f.root, f.env, path.join(f.directory, 'initial.log'));
  const report = await prepare(f.options, f.root, f.env, () => { throw new Error('fixture build failed'); }, f.sdk);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /fixture build failed/);
  assert.deepEqual(fs.readFileSync(f.output), bytes);
  assert.equal(fs.existsSync(path.join(f.archive, 'sanctifi-80000189.apk')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(report.evidenceDirectory, 'summary.json'))).ok, false);
});

for (const [name, buildChange, sdkChange, error] of [
  ['missing fresh output', () => {}, null, /fresh app-release/],
  ['native mutation', (f) => { f.build(f.root, f.env, path.join(f.directory, 'build.log')); fs.appendFileSync(f.native, '\n// changed\n'); }, null, /inputs changed/],
  ['source commit mutation', (f) => { f.build(f.root, f.env, path.join(f.directory, 'build.log')); f.write('new.txt', 'x'); f.git('add', '.'); f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'changed'); }, null, /inputs changed/],
  ['wrong APK code', null, (output) => output.replace('80000189', '80000188'), /Built APK differs/],
  ['wrong signature', null, (output) => output.replace(CERTIFICATE, 'f'.repeat(64)), /permanent sancti.fi signer/],
  ['SDK execution failure', null, () => { throw new Error('SDK failure'); }, /verification failed/],
]) {
  test(`build result rejects ${name}`, async (t) => {
    const f = fixture(t);
    const sdk = (cmd, args) => path.basename(cmd) === 'java' || !sdkChange ? f.sdk(cmd, args) : sdkChange(f.sdk(cmd, args));
    const build = buildChange ? () => buildChange(f) : f.build;
    const report = await prepare(f.options, f.root, f.env, build, sdk);
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), error);
    assert.equal(fs.existsSync(path.join(f.archive, 'sanctifi-80000189.apk')), false);
  });
}

test('explicit execution and strict CLI options prevent accidental build', async (t) => {
  const f = fixture(t);
  await assert.rejects(prepare({ ...f.options, executeBuild: false }, f.root, f.env), /Choose exactly one/);
  await assert.rejects(prepare({ ...f.options, dryRun: true }, f.root, f.env), /Choose exactly one/);
  assert.throws(() => localOptions(['--execute-build'], false));
  assert.throws(() => localOptions(['--dry-run', '--dry-run'], true));
  assert.throws(() => localOptions(['--publish'], true));
  assert.throws(() => localOptions(['--intent'], true));
  const cli = path.resolve(__dirname, '../android-release.js');
  const result = spawnSync(process.execPath, [cli, 'prepare', '--intent', 'new'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Choose exactly one/);
});


test('failed quality gate stops before Gradle and records the failure', async (t) => {
  const f = fixture(t);
  const report = await runPrepare(f.options, f.root, f.env, () => assert.fail('build'), f.sdk,
    () => { throw new Error('Automated check fixture failed'); });
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /Automated check fixture failed/);
  assert.equal(fs.existsSync(f.output), false);
});

test('actual process orchestration uses only a fake wrapper with production environment and exact task', async (t) => {
  const f = fixture(t);
  f.write('android/gradlew', `#!/bin/sh
[ "$NODE_ENV" = production ] || exit 11
[ "$#" = 1 ] && [ "$1" = :app:assembleRelease ] || exit 12
/bin/mkdir -p app/build/outputs/apk/release
/bin/printf 'Fixture APK, never signed or distributed' > app/build/outputs/apk/release/app-release.apk
/bin/printf 'fixture wrapper only\n'
`, 0o700);
  const report = await prepare(f.options, f.root, f.env, undefined, f.sdk);
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.match(fs.readFileSync(path.join(report.evidenceDirectory, 'build.log'), 'utf8'), /fixture wrapper only/);
  assert.equal(fs.statSync(path.join(report.evidenceDirectory, 'build.log')).mode & 0o777, 0o600);
});

test('new-version intent refuses an existing archive before build', async (t) => {
  const f = fixture(t);
  await archived(f);
  const report = await prepare(f.options, f.root, f.env, () => assert.fail('build'), f.sdk);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /cannot reuse an existing archive/);
});


test('existing preparation lock prevents concurrent output manipulation', async (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.archive, '.prepare-lock'), { recursive: true });
  const report = await prepare(f.options, f.root, f.env, () => assert.fail('build'), () => assert.fail('SDK'));
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /another preparation/);
  assert.equal(fs.existsSync(path.join(f.archive, '.prepare-lock')), true);
});

test('unsupported JDK fails with private failure summary and releases lock', async (t) => {
  const f = fixture(t);
  const report = await prepare(f.options, f.root, f.env, () => assert.fail('build'), () => 'openjdk 25');
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /JDK 17-24/);
  assert.equal(fs.existsSync(path.join(f.archive, '.prepare-lock')), false);
});

test('quality gate executes fixture checks in order and retains failure diagnostics', (t) => {
  const f = fixture(t);
  f.write('scripts/__tests__/android-release.fixture.test.cjs', '');
  f.write('plugins/__tests__/with-sanctifi-release-signing.fixture.test.cjs', '');
  for (const name of ['tsc', 'jest']) f.write('node_modules/.bin/' + name, '#!/bin/sh\nexit 0\n', 0o700);
  for (const name of ['validate-intl', 'validate-translations', 'validate-proguard-rules', 'validate-module-inventory']) f.write('scripts/' + name + '.js', '');
  const logs = path.join(f.directory, 'checks');
  fs.mkdirSync(logs);
  const results = executeChecks(f.root, { ...process.env, ...f.env }, logs);
  assert.equal(results.length, 7);
  assert.equal(results.every((result) => result.result === 'passed'), true);
  assert.equal(fs.statSync(path.join(logs, 'check-1.log')).mode & 0o777, 0o600);
  f.write('node_modules/.bin/tsc', '#!/bin/sh\nexit 42\n', 0o700);
  const failures = path.join(f.directory, 'failed-checks');
  fs.mkdirSync(failures);
  assert.throws(() => executeChecks(f.root, { ...process.env, ...f.env }, failures), (error) => {
    assert.match(error.message, /check 2 failed \(exit 42\)/);
    assert.deepEqual(error.checks.map((result) => result.result), ['passed', 'failed']);
    assert.equal(fs.existsSync(path.join(failures, 'check-3.log')), false);
    return true;
  });
});


for (const [name, change, expected] of [
  ['stale high-water mark', (f) => {
    const value = JSON.parse(fs.readFileSync(f.allocation)); value.highWaterMark = 80000187;
    fs.writeFileSync(f.allocation, JSON.stringify(value));
  }, /highWaterMark >= 80000188/],
  ['allocation for another code', (f) => {
    const value = JSON.parse(fs.readFileSync(f.allocation)); value.versionCode = 80000190;
    fs.writeFileSync(f.allocation, JSON.stringify(value));
  }, /Allocation must attest/],
  ['unreserved code', (f) => { f.write('docs/android-release-ledger.md', '| `80000188` | Published |'); f.git('add', '.');
    f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'ledger');
  }, /Record the approved code as Reserved/],
  ['later ledger reservation', (f) => { f.write('docs/android-release-ledger.md', '| `80000189` | Reserved |\n| `80000190` | Reserved |'); f.git('add', '.');
    f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'ledger');
  }, /Allocation must attest/],
  ['ambiguous native code', (f) => fs.appendFileSync(f.native, '\nversionCode 80000189\n'), /Cannot uniquely read native versionCode/],
  ['unexpected versionName', (f) => fs.writeFileSync(f.native, fs.readFileSync(f.native, 'utf8').replace('8.1.8', '0.1.1')), /Stale native metadata/],
]) {
  test(`read-only preflight rejects ${name}`, async (t) => {
    const f = fixture(t);
    change(f);
    const report = await preflight(f.options, f.root, f.env);
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), expected);
    assert.equal(fs.existsSync(f.archive), false);
  });
}

test('keep-version refuses missing record and corrupt retained bytes', async (t) => {
  const f = fixture(t, 'keep');
  let report = await preflight(f.options, f.root, f.env);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /existing immutable APK/);
  await archived(f);
  fs.appendFileSync(path.join(f.archive, 'sanctifi-80000189.apk'), 'corruption');
  report = await preflight(f.options, f.root, f.env);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /metadata\/checksum mismatch/);
});

test('real fixture wrapper failure keeps sensitive stdout out of summaries and does not stage', async (t) => {
  const f = fixture(t);
  f.write('android/gradlew', '#!/bin/sh\nprintf "storePassword=fixture-only-secret\\n"\nexit 42\n', 0o700);
  const report = await prepare(f.options, f.root, f.env, undefined, f.sdk);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /Gradle failed \(exit 42/);
  assert.doesNotMatch(JSON.stringify(report), /fixture-only-secret/);
  assert.equal(fs.statSync(path.join(report.evidenceDirectory, 'build.log')).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(path.join(f.archive, 'sanctifi-80000189.apk')), false);
});

test('CLI dry-run succeeds without executing fixture tools or creating artifacts', (t) => {
  const f = fixture(t);
  const cli = f.write('scripts/android-release.js', fs.readFileSync(path.resolve(__dirname, '../android-release.js')));
  f.git('add', '.');
  f.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'cli fixture');
  const result = spawnSync(process.execPath, [cli, 'prepare', '--intent', 'new', '--allocation', f.allocation,
    '--directory', f.archive, '--dry-run'], { env: { ...process.env, ...f.env }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.dryRun, true);
  assert.equal(report.source.nativeInputs, undefined);
  assert.ok(report.source.nativeInputCount > 0);
  assert.equal(fs.existsSync(f.archive), false);
});

test('CLI verify reports independent actual metadata without assuming current HEAD', (t) => {
  const f = fixture(t);
  const file = path.join(f.directory, 'existing.apk');
  fs.writeFileSync(file, bytes);
  for (const tool of ['apksigner', 'aapt2']) {
    fs.writeFileSync(path.join(f.tools, tool), '#!' + process.execPath + '\nprocess.stdout.write(' + JSON.stringify(f.sdk(tool)) + ');\n', { mode: 0o700 });
  }
  const cli = path.resolve(__dirname, '../android-release.js');
  const result = spawnSync(process.execPath, [cli, 'verify', file, '--build-tools', f.tools], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.sourceRevision, null);
  assert.equal(report.apk.versionCode, 80000189);
  assert.equal(report.apk.size, bytes.length);
  assert.equal(report.publication, 'none');
});


test('malformed allocation diagnostics never echo input content', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.allocation, 'storePassword=fixture-only-secret');
  const report = await preflight(f.options, f.root, f.env);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /Invalid JSON input/);
  assert.doesNotMatch(JSON.stringify(report), /fixture-only-secret/);
});

test('native input fingerprints omit signing material and build output', async (t) => {
  const f = fixture(t);
  const before = await sourceState(f.root);
  f.write('android/signing.properties', 'storePassword=fixture-only-secret');
  f.write('android/local.p12', 'fixture key placeholder');
  f.write('android/app/build/generated.txt', 'output');
  const after = await sourceState(f.root);
  assert.deepEqual(after, before);
  assert.doesNotMatch(JSON.stringify(after), /fixture-only-secret|signing.properties|local.p12|generated.txt/);
});
