'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { allocate, synchronise, preflight, prepare, CERTIFICATE, sha256, allocationOptions } = require('../android-release');

// Synthetic bytes and SDK responses only; no signing, Android builds or network.
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'allocation-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repo');
  const directory = path.join(temporary, 'archive');
  const legacy = path.join(temporary, 'legacy');
  const tools = path.join(temporary, 'sdk/build-tools/36.0.0');
  const jdk = path.join(temporary, 'jdk');
  for (const dir of [root, directory, legacy, tools, path.join(jdk, 'bin')]) fs.mkdirSync(dir, { recursive: true });
  const write = (name, text, mode) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, { mode: mode || 0o600 });
    return file;
  };
  write('.gitignore', 'android/\nnode_modules/\n');
  write('app.json', JSON.stringify({ expo: { version: '8.1.8', android: { package: 'fi.sancti.client', versionCode: 80000189 }, extra: { sanctifiVersion: '0.1.1' } } }, null, 2));
  const native = write('android/app/build.gradle', 'android {\n defaultConfig {\n  applicationId "fi.sancti.client"\n  versionCode 80000188\n  versionName "8.1.8"\n }\n signingConfig signingConfigs.sanctifiRelease\n validateSanctifiReleaseSigning\n}\n');
  write('android/gradlew', '#!/bin/sh\nexit 99\n', 0o700);
  write('node_modules/expo/package.json', '{}');
  const ledger = write('docs/android-release-ledger.md', '| `80000189` | `8.1.8` | Unknown | `' + 'a'.repeat(64) + '` | Unknown | Published Alpha |\n');
  for (const file of [path.join(jdk, 'bin/java'), path.join(jdk, 'bin/javac'), path.join(tools, 'aapt2'), path.join(tools, 'apksigner')]) fs.writeFileSync(file, '#!/bin/sh\nexit 99\n', { mode: 0o700 });
  const historyFile = path.join(temporary, 'history.json');
  const history = { schemaVersion: 1, checkedAt: new Date().toISOString(), complete: true, exclusiveAllocator: true,
    allocationDirectory: fs.realpathSync(directory), sources: { futwick: 'fixture complete local audit', server: 'fixture complete server inventory' },
    archivePaths: [legacy], artifacts: [{ versionCode: 80000189, sha256: 'a'.repeat(64), state: 'occupied' }] };
  const save = () => fs.writeFileSync(historyFile, JSON.stringify(history));
  save();
  const options = { directory, history: historyFile, initialize: true, dryRun: true, execute: false, buildTools: tools };
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'sanctifi');
  const commit = () => { git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture'); };
  commit();
  const reserve = (code = 80000190, overrides = {}) => allocate({ ...options, dryRun: false, execute: true, expectCode: code, ...overrides }, root);
  const sdk = (command) => path.basename(command) === 'java' ? 'openjdk 21.0.8' : path.basename(command) === 'apksigner'
    ? `Signer #1 certificate SHA-256 digest: ${CERTIFICATE}\n`
    : "package: name='fi.sancti.client' versionCode='80000190' versionName='8.1.8'\n";
  return { temporary, root, directory, legacy, tools, native, ledger, history, save, options, reserve, sdk, commit,
    env: { JAVA_HOME: jdk, ANDROID_HOME: path.dirname(path.dirname(tools)) } };
}

function snapshot(directory) {
  const result = {};
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else result[file] = fs.readFileSync(file).toString('base64');
    }
  };
  walk(directory);
  return result;
}

test('dry run selects next safe code, reports evidence and changes nothing', async (t) => {
  const f = fixture(t);
  const before = snapshot(f.temporary);
  const report = await allocate(f.options, f.root);
  assert.equal(report.versionCode, 80000190);
  assert.equal(report.highWaterMark, 80000189);
  assert.equal(report.changes.length, 2);
  assert.ok(report.evidence.some((item) => item.source === 'ledger'));
  assert.deepEqual(snapshot(f.temporary), before);
});

test('reserves before metadata edits, retains abandoned reservation and increments automatically', async (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(path.join(f.root, 'app.json'));
  const first = await f.reserve();
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'app.json')), before);
  assert.match(fs.readFileSync(f.ledger, 'utf8'), /80000190.*Reserved/);
  assert.equal(fs.statSync(first.reservation).mode & 0o777, 0o600);
  const second = await f.reserve(80000191, { initialize: false });
  assert.equal(second.versionCode, 80000191);
  assert.ok(fs.existsSync(first.reservation));
});

test('published and reserved history raise high-water mark without manual selection', async (t) => {
  const f = fixture(t);
  f.history.artifacts.push({ versionCode: 80000194, sha256: null, state: 'occupied' }); f.save();
  assert.equal((await allocate(f.options, f.root)).versionCode, 80000195);
  await assert.rejects(f.reserve(), /--expect-code 80000195/);
  assert.equal(fs.existsSync(path.join(f.directory, '.allocations')), false);
});

for (const [name, mutate] of [
  ['incomplete', (f) => { f.history.complete = false; f.save(); }],
  ['stale', (f) => { f.history.checkedAt = '2026-01-01T00:00:00Z'; f.save(); }],
  ['future', (f) => { f.history.checkedAt = '2099-01-01T00:00:00Z'; f.save(); }],
  ['server unavailable', (f) => { delete f.history.sources.server; f.save(); }],
  ['multiple publishers', (f) => { f.history.exclusiveAllocator = false; f.save(); }],
  ['contradictory ledger hash', (f) => { f.history.artifacts[0].sha256 = 'b'.repeat(64); f.save(); }],
  ['missing archive', (f) => { f.history.archivePaths.push('/nonexistent-allocation-fixture'); f.save(); }],
  ['duplicate ledger code', (f) => fs.appendFileSync(f.ledger, fs.readFileSync(f.ledger))],
  ['missing history', (f) => fs.unlinkSync(f.options.history)],
  ['missing registry', (f) => { f.options.initialize = false; }],
  ['orphan archive record', (f) => fs.writeFileSync(path.join(f.legacy, 'old.apk.json'), '{}')],
]) {
  test(`refuses ${name} without reservation or version edits`, async (t) => {
    const f = fixture(t); mutate(f);
    const before = snapshot(f.temporary);
    await assert.rejects(f.reserve());
    assert.deepEqual(snapshot(f.temporary), before);
  });
}

test('verifies local bytes and blocks differing APKs with the same code', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.legacy, 'one.apk'), 'one');
  fs.writeFileSync(path.join(f.directory, 'two.apk'), 'two');
  await assert.rejects(allocate(f.options, f.root, f.sdk), /Conflicting APK bytes/);
});

test('explicitly rejected historical collision stays occupied without replacing published identity', async (t) => {
  const f = fixture(t);
  const file = path.join(f.legacy, 'rejected.apk'); fs.writeFileSync(file, 'rejected historical bytes');
  f.history.artifacts.push({ versionCode: 80000189, sha256: await sha256(file), state: 'rejected' }); f.save();
  const sdk = (command, args) => f.sdk(command, args).replace("versionCode='80000190'", "versionCode='80000189'");
  const result = await allocate(f.options, f.root, sdk);
  assert.equal(result.versionCode, 80000190);
  assert.ok(result.evidence.some((item) => item.state === 'rejected' && item.source === file));
});

test('invalid local APK and sidecar mismatch fail closed', async (t) => {
  const f = fixture(t);
  const file = path.join(f.legacy, 'test.apk'); fs.writeFileSync(file, 'synthetic');
  await assert.rejects(allocate(f.options, f.root, () => { throw new Error('invalid'); }), /verification failed/);
  fs.writeFileSync(file + '.json', JSON.stringify({ versionCode: 80000190, sha256: '0'.repeat(64) }));
  await assert.rejects(allocate(f.options, f.root, f.sdk), /sidecar contradicts/);
});

test('synchronise changes only both codes, supports dry run and interrupted recovery', async (t) => {
  const f = fixture(t);
  const result = await f.reserve();
  const options = { directory: f.directory, allocation: result.reservation, dryRun: true, execute: false };
  const before = snapshot(f.temporary);
  await synchronise(options, f.root);
  assert.deepEqual(snapshot(f.temporary), before);
  const reservation = JSON.parse(fs.readFileSync(result.reservation));
  // Simulate termination after the first metadata file was replaced.
  fs.writeFileSync(path.join(f.root, 'app.json'), reservation.metadata[0].target);
  await synchronise({ ...options, dryRun: false, execute: true }, f.root);
  for (const item of reservation.metadata) assert.equal(fs.readFileSync(path.join(f.root, item.path), 'utf8'), item.target);
  const expo = JSON.parse(fs.readFileSync(path.join(f.root, 'app.json'))).expo;
  assert.equal(expo.version, '8.1.8'); assert.equal(expo.extra.sanctifiVersion, '0.1.1');
  assert.equal(expo.android.versionCode, 80000190);
  const after = snapshot(f.temporary);
  await synchronise({ ...options, dryRun: false, execute: true }, f.root);
  assert.deepEqual(snapshot(f.temporary), after);
});

test('synchronise preserves later local edits and refuses stale reservation', async (t) => {
  const f = fixture(t); const result = await f.reserve();
  fs.appendFileSync(f.native, '// local edit\n');
  const before = snapshot(f.temporary);
  await assert.rejects(synchronise({ directory: f.directory, allocation: result.reservation, dryRun: false, execute: true }, f.root), /Metadata changed/);
  assert.deepEqual(snapshot(f.temporary), before);
});

for (const nativeChange of ['\nversionCode 80000189\n', '\nversionCodeOverride = 3\n', '\nproductFlavors {}\n']) {
  test(`unrecognised native version source blocks allocation: ${nativeChange.trim()}`, async (t) => {
    const f = fixture(t); fs.appendFileSync(f.native, nativeChange);
    await assert.rejects(f.reserve(), /native versionCode|overrides/);
  });
}

test('registry reservation integrates with preflight and failed build consumes code', async (t) => {
  const f = fixture(t); const result = await f.reserve();
  const options = { directory: f.directory, allocation: result.reservation, intent: 'new', executeBuild: true, dryRun: false };
  assert.equal((await preflight(options, f.root, f.env)).ok, false);
  await synchronise({ directory: f.directory, allocation: result.reservation, execute: true, dryRun: false }, f.root);
  f.commit();
  const ready = await preflight(options, f.root, f.env);
  assert.equal(ready.ok, true, ready.errors.join());
  const report = await prepare(options, f.root, f.env, () => { throw new Error('simulated build failure'); }, f.sdk, () => []);
  assert.equal(report.ok, false); assert.match(report.errors.join(), /simulated build failure/);
  assert.ok(fs.existsSync(path.join(f.directory, '.attempt-80000190')));
  const retry = await preflight(options, f.root, f.env);
  assert.equal(retry.ok, false); assert.match(retry.errors.join(), /already attempted/);
  const next = await f.reserve(80000191, { initialize: false });
  assert.equal(next.versionCode, 80000191);
});

test('concurrent allocation processes issue exactly one approved code', async (t) => {
  const f = fixture(t);
  const script = `const { allocate } = require(process.argv[1]); allocate(JSON.parse(process.argv[2]), process.argv[3]).then(r => console.log(r.versionCode)).catch(e => { console.error(e.message); process.exitCode = 1; });`;
  const start = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, path.resolve(__dirname, '../android-release.js'),
      JSON.stringify({ ...f.options, dryRun: false, execute: true, expectCode: 80000190 }), f.root],
      { env: { ...process.env, FORCE_COLOR: '0', NODE_DISABLE_COLORS: '1' } });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; }); child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject); child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const results = await Promise.all([start(), start()]);
  assert.equal(results.filter((item) => item.status === 0).length, 1, JSON.stringify(results));
  assert.equal(results.find((item) => item.status === 0).stdout.trim(), '80000190');
  assert.equal(fs.readdirSync(path.join(f.directory, '.allocations')).filter((name) => /^\d/.test(name)).length, 1);
});

test('strict allocation option parsing requires explicit execution mode', async (t) => {
  const f = fixture(t);
  await assert.rejects(allocate({ ...f.options, dryRun: false }, f.root), /Choose exactly one/);
  assert.throws(() => allocationOptions(['--execute', '--execute'], 'allocate'), /Duplicate/);
  assert.throws(() => allocationOptions(['--publish'], 'allocate'), /Unknown/);
});

test('superseded and withdrawn reservations cannot synchronise metadata', async (t) => {
  const f = fixture(t); const first = await f.reserve();
  const second = await f.reserve(80000191, { initialize: false });
  await assert.rejects(synchronise({ directory: f.directory, allocation: first.reservation, dryRun: true, execute: false }, f.root), /superseded/);
  const ledger = fs.readFileSync(f.ledger, 'utf8').replace(/Reserved/g, 'Withdrawn'); fs.writeFileSync(f.ledger, ledger);
  await assert.rejects(synchronise({ directory: f.directory, allocation: second.reservation, dryRun: true, execute: false }, f.root), /missing from ledger/);
});

test('failure updating ledger still burns reservation and next allocation skips it', async (t) => {
  const f = fixture(t);
  const original = fs.appendFileSync;
  t.mock.method(fs, 'appendFileSync', (file, ...args) => {
    if (file === f.ledger) throw new Error('fixture ledger write failure');
    return original(file, ...args);
  });
  await assert.rejects(f.reserve(), /ledger write failure/);
  assert.ok(fs.existsSync(path.join(f.directory, '.allocations/80000190.json')));
  t.mock.restoreAll();
  assert.equal((await f.reserve(80000191, { initialize: false })).versionCode, 80000191);
});

test('successful registry preparation verifies and stages without changing original record schema', async (t) => {
  const f = fixture(t); const reserved = await f.reserve();
  await synchronise({ directory: f.directory, allocation: reserved.reservation, execute: true, dryRun: false }, f.root);
  f.commit();
  const options = { intent: 'new', directory: f.directory, allocation: reserved.reservation, executeBuild: true, dryRun: false };
  const output = path.join(f.root, 'android/app/build/outputs/apk/release/app-release.apk');
  const report = await prepare(options, f.root, f.env, () => {
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, 'synthetic verified fixture');
  }, f.sdk, () => []);
  assert.equal(report.ok, true, report.errors.join());
  assert.equal(report.apk.versionCode, 80000190);
  const record = JSON.parse(fs.readFileSync(path.join(f.directory, 'sanctifi-80000190.apk.json')));
  assert.equal(record.sha256, await sha256(output));
  assert.equal(record.certificateSha256, CERTIFICATE);
  assert.equal(record.schemaVersion, undefined);
});

test('metadata code beyond published history is occupied and selected next', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.native, fs.readFileSync(f.native, 'utf8').replace('80000188', '80000197'));
  assert.equal((await allocate(f.options, f.root)).versionCode, 80000198);
});

test('malformed private inventory errors do not echo its contents', async (t) => {
  const f = fixture(t); fs.writeFileSync(f.options.history, '{PRIVATE_FIXTURE_MARKER');
  await assert.rejects(allocate(f.options, f.root), (error) => {
    assert.doesNotMatch(error.message, /PRIVATE_FIXTURE_MARKER/); return true;
  });
});

test('CLI allocation and synchronisation complete without manual version edits', (t) => {
  const f = fixture(t);
  const scripts = path.join(f.root, 'scripts'); fs.mkdirSync(scripts);
  const cli = path.join(scripts, 'android-release.js');
  fs.copyFileSync(path.resolve(__dirname, '../android-release.js'), cli);
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' }));
  const common = ['--history', f.options.history, '--directory', f.directory, '--initialize'];
  const dry = run('allocate', ...common, '--dry-run');
  assert.equal(dry.versionCode, 80000190);
  const reserved = run('allocate', ...common, '--execute', '--expect-code', String(dry.versionCode));
  const args = ['--allocation', reserved.reservation, '--directory', f.directory];
  assert.equal(run('synchronise', ...args, '--dry-run').versionCode, 80000190);
  assert.equal(run('synchronise', ...args, '--execute').versionCode, 80000190);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'app.json'))).expo.android.versionCode, 80000190);
  assert.match(fs.readFileSync(f.native, 'utf8'), /versionCode 80000190/);
});

async function readyReservation(t) {
  const f = fixture(t);
  const result = await f.reserve();
  await synchronise({ directory: f.directory, allocation: result.reservation, execute: true, dryRun: false }, f.root);
  f.commit();
  return { ...f, reservation: result.reservation,
    prepareOptions: { directory: f.directory, allocation: result.reservation, intent: 'new', executeBuild: true, dryRun: false } };
}

function newerPrivateReservation(f) {
  const record = JSON.parse(fs.readFileSync(f.reservation));
  record.versionCode++;
  record.highWaterMark++;
  record.id = '12345678-1234-1234-1234-123456789abc';
  fs.writeFileSync(path.join(f.directory, '.allocations', record.versionCode + '.json'), JSON.stringify(record));
}

const readinessChanges = [
  ['orphan newer reservation', newerPrivateReservation, /superseded/],
  ['changed private evidence', (f) => {
    const record = JSON.parse(fs.readFileSync(f.reservation)); record.historySha256 = 'b'.repeat(64);
    fs.writeFileSync(f.reservation, JSON.stringify(record));
  }, /allocationSha256 changed/],
  ['withdrawn ledger row', (f) => fs.writeFileSync(f.ledger, fs.readFileSync(f.ledger, 'utf8').replace(/Reserved/g, 'Withdrawn')), /ledger entry must match/],
  ['wrong ledger identity', (f) => {
    const record = JSON.parse(fs.readFileSync(f.reservation));
    fs.writeFileSync(f.ledger, fs.readFileSync(f.ledger, 'utf8').replace(record.id, 'different-reservation'));
  }, /ledger entry must match/],
  ['duplicate ledger row', (f) => fs.appendFileSync(f.ledger, '| `80000190` | `8.1.8` | Unknown | Not built | Unknown | Reserved duplicate |\n'), /duplicate release ledger/],
  ['changed native code', (f) => fs.writeFileSync(f.native, fs.readFileSync(f.native, 'utf8').replace('80000190', '80000191')), /Stale native metadata|inputs changed/],
  ['changed app metadata', (f) => fs.appendFileSync(path.join(f.root, 'app.json'), '\n'), /synchronise|inputs changed/],
  ['new archive collision', (f) => fs.writeFileSync(path.join(f.directory, 'sanctifi-80000190.apk'), 'intervening artifact'), /existing archive entry/],
];

for (const [name, change, expected] of readinessChanges) {
  test(`change between preflight and lock blocks preparation: ${name}`, async (t) => {
    const f = await readyReservation(t);
    assert.equal((await preflight(f.prepareOptions, f.root, f.env)).ok, true);
    const mkdir = fs.mkdirSync;
    let interleaved = false;
    t.mock.method(fs, 'mkdirSync', (directory, ...args) => {
      if (directory === path.join(f.directory, '.prepare-lock') && !interleaved) {
        interleaved = true; change(f);
      }
      return mkdir(directory, ...args);
    });
    const report = await prepare(f.prepareOptions, f.root, f.env, () => assert.fail('build started'),
      () => assert.fail('SDK/Java started'), () => assert.fail('checks started'));
    assert.equal(interleaved, true);
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), expected);
    assert.equal(fs.existsSync(path.join(f.directory, '.attempt-80000190')), false);
    assert.equal(fs.existsSync(path.join(f.directory, '.prepare-lock')), false);
  });

  test(`change immediately before build blocks preparation: ${name}`, async (t) => {
    const f = await readyReservation(t);
    let checked = false;
    const report = await prepare(f.prepareOptions, f.root, f.env, () => assert.fail('build started'), f.sdk,
      () => { checked = true; change(f); return []; });
    assert.equal(checked, true);
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), new RegExp(expected.source + '|inputs changed during automated checks'));
    assert.equal(fs.existsSync(path.join(f.directory, '.attempt-80000190')), true);
    assert.equal(fs.existsSync(path.join(f.directory, '.prepare-lock')), false);
  });
}

test('completed competing allocation between preflight and lock never consumes old attempt', async (t) => {
  const f = await readyReservation(t);
  const mkdir = fs.mkdirSync;
  let competing;
  t.mock.method(fs, 'mkdirSync', (directory, ...args) => {
    if (directory === path.join(f.directory, '.prepare-lock') && !competing) {
      const script = 'require(process.argv[1]).allocate(JSON.parse(process.argv[2]), process.argv[3]).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e.message); process.exitCode = 1; });';
      competing = JSON.parse(execFileSync(process.execPath, ['-e', script, path.resolve(__dirname, '../android-release.js'),
        JSON.stringify({ ...f.options, initialize: false, execute: true, dryRun: false, expectCode: 80000191 }), f.root], { encoding: 'utf8' }));
    }
    return mkdir(directory, ...args);
  });
  const report = await prepare(f.prepareOptions, f.root, f.env, () => assert.fail('build started'),
    () => assert.fail('SDK/Java started'), () => assert.fail('checks started'));
  assert.equal(competing.versionCode, 80000191);
  assert.equal(report.ok, false);
  assert.match(report.errors.join(), /superseded/);
  assert.equal(fs.existsSync(path.join(f.directory, '.attempt-80000190')), false);
});

for (const removed of [false, true]) {
  test(`attempt marker ${removed ? 'removed' : 'replaced'} during checks prevents build`, async (t) => {
    const f = await readyReservation(t);
    const marker = path.join(f.directory, '.attempt-80000190');
    const report = await prepare(f.prepareOptions, f.root, f.env, () => assert.fail('build started'), f.sdk, () => {
      if (removed) fs.unlinkSync(marker); else fs.writeFileSync(marker, 'another-run\n');
      return [];
    });
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), /attempt marker no longer belongs/);
  });
}

test('approved semantic amendment accepts only exact app.json value change, without changing reservation', async (t) => {
  const f = fixture(t);
  const result = await f.reserve();
  await synchronise({ directory: f.directory, allocation: result.reservation, execute: true, dryRun: false }, f.root);
  const reservationBefore = fs.readFileSync(result.reservation);
  const ledgerBefore = fs.readFileSync(f.ledger);
  const appPath = path.join(f.root, 'app.json');
  const original = fs.readFileSync(appPath, 'utf8');
  const amendmentPath = path.join(f.root, 'docs/release-amendments/80000190.json');
  const record = JSON.parse(reservationBefore);
  const amendment = { schemaVersion: 1, reservationId: record.id, versionCode: 80000190,
    field: 'expo.extra.sanctifiVersion', from: '0.1.1', to: '0.1.2', reason: 'Owner approved' };
  fs.mkdirSync(path.dirname(amendmentPath), { recursive: true });
  fs.writeFileSync(appPath, original.replace('"sanctifiVersion": "0.1.1"', '"sanctifiVersion": "0.1.2"'));
  f.commit();
  const options = { directory: f.directory, allocation: result.reservation, intent: 'new' };
  assert.equal((await preflight(options, f.root, f.env)).ok, false);
  fs.writeFileSync(amendmentPath, JSON.stringify(amendment));
  f.commit();
  const amendedReport = await preflight(options, f.root, f.env);
  assert.equal(amendedReport.ok, true, JSON.stringify(amendedReport.errors));
  assert.deepEqual(fs.readFileSync(result.reservation), reservationBefore);
  assert.deepEqual(fs.readFileSync(f.ledger), ledgerBefore);
  const approved = fs.readFileSync(appPath, 'utf8');
  for (const changed of [
    approved.replace('"versionCode": 80000190', '"versionCode": 80000191'),
    approved.replace('"sanctifiVersion": "0.1.2"', '"sanctifiVersion": "0.1.3"'),
    approved.replace('"package": "fi.sancti.client"', '"package": "other.client"'),
    approved + '\\n',
  ]) {
    fs.writeFileSync(appPath, changed);
    f.commit();
    assert.equal((await preflight(options, f.root, f.env)).ok, false);
  }
  fs.writeFileSync(appPath, approved);
  f.commit();
  amendment.reservationId = '00000000-0000-0000-0000-000000000000';
  fs.writeFileSync(amendmentPath, JSON.stringify(amendment));
  f.commit();
  assert.equal((await preflight(options, f.root, f.env)).ok, false);
});
