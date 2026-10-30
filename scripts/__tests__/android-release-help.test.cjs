'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { ledgerDiagnostics } = require('../android-release');

const cli = path.resolve(__dirname, '../android-release.js');
const digest = 'b'.repeat(64);
function ledger(code = 500, source = 'Unknown', hash = digest, size = '12,345') {
  return `| \`${code}\` | \`8.1.8\` | ${source} | \`${hash}\` | Unverified | Published Alpha |\n
The owner-confirmed global allocation
high-water mark is therefore **${code}**.

### Historical Alpha ${code} reconciliation
| APK size | **${size} bytes**, owner-reported. |
`;
}
function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sanctifi-help-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const scripts = path.join(directory, 'scripts');
  fs.mkdirSync(scripts);
  const copied = path.join(scripts, 'android-release.js');
  fs.copyFileSync(cli, copied);
  const env = { ...process.env };
  delete env.JAVA_HOME;
  delete env.ANDROID_HOME;
  delete env.ANDROID_SDK_ROOT;
  return { directory, copied, env };
}

test('diagnostics describe the reconciled historical ledger snapshot without fresh verification claims', () => {
  const text = ledger(80000188, 'Unknown - original build source not established',
    'b94623970de73c14da3f89d5569c272b1d1a994296f431750a24b2d1236c5e7e', '79,562,702');
  const messages = ledgerDiagnostics(text, 80000188).join('\n');
  assert.match(messages, /Owner-confirmed allocation high-water mark: 80000188/);
  assert.match(messages, /configured versionCode 80000188 has already been distributed/);
  assert.match(messages, /SHA-256 recorded \(b94623970de73c14da3f89d5569c272b1d1a994296f431750a24b2d1236c5e7e\)/);
  assert.match(messages, /size recorded \(79562702 bytes\)/);
  assert.match(messages, /original build-source commit unknown/);
  assert.match(messages, /no fresh APK, signer or HTTPS verification/);
  assert.doesNotMatch(messages, /repository 80000187 is stale|exact hash\/source are not established/);
});

test('diagnostics follow changed ledger/configuration codes and recorded provenance', () => {
  const revision = 'a'.repeat(40);
  const messages = ledgerDiagnostics(ledger(700, revision), 700).join('\n');
  assert.match(messages, /high-water mark: 700/);
  assert.match(messages, /configured versionCode 700 has already been distributed/);
  assert.match(messages, /size recorded \(12345 bytes\)/);
  assert.match(messages, new RegExp('build-source commit recorded \\(' + revision + '\\)'));
  assert.doesNotMatch(messages, /80000188|80000189|unknown\/unverified/);
});

test('diagnostics distinguish Reserved configuration from historical publication', () => {
  const text = ledger() + '| `501` | Reserved |\n';
  const messages = ledgerDiagnostics(text, 501).join('\n');
  assert.match(messages, /high-water mark: 500/);
  assert.match(messages, /Highest versionCode in ledger rows: 501/);
  assert.match(messages, /configured versionCode 501 has ledger status: Reserved/);
  assert.match(messages, /Published 500:/);
  assert.doesNotMatch(messages, /501 has already been distributed/);
});

test('missing, ambiguous or malformed metadata does not produce false recorded facts', () => {
  let messages = ledgerDiagnostics('', 500).join('\n');
  assert.match(messages, /high-water mark is not unambiguously recorded/);
  assert.match(messages, /no unambiguous ledger row/);
  messages = ledgerDiagnostics(ledger() + 'The owner-confirmed high-water mark is **600**.\n', 500).join('\n');
  assert.match(messages, /high-water mark is not unambiguously recorded/);
  messages = ledgerDiagnostics(ledger(500, 'not a commit', 'bad', '0'), 500).join('\n');
  assert.match(messages, /SHA-256 not recorded as a valid digest/);
  assert.match(messages, /size not unambiguously recorded/);
  assert.match(messages, /build-source commit unknown\/unverified/);
  messages = ledgerDiagnostics(ledger(500, 'Unknown', digest, '1,,234'), 500).join('\n');
  assert.match(messages, /size not unambiguously recorded/);
  messages = ledgerDiagnostics(ledger() + '| `500` | Reserved |\n', 500).join('\n');
  assert.match(messages, /no unambiguous ledger row/);
  assert.doesNotMatch(messages, /configured versionCode 500 has already been distributed/);
});

test('size is never borrowed from another artifact section', () => {
  const text = ledger().replace('| APK size | **12,345 bytes**, owner-reported. |', '') +
    '\n### Historical Alpha 499 reconciliation\n| APK size | **999 bytes** |\n';
  const messages = ledgerDiagnostics(text, 500).join('\n');
  assert.match(messages, /size not unambiguously recorded in its ledger section/);
  assert.doesNotMatch(messages, /999 bytes/);
});

for (const dirty of [false, true]) {
  test(`global and per-command help need no prerequisites or tool calls (dirty Git: ${dirty})`, (t) => {
    const f = setup(t);
    if (dirty) {
      execFileSync('git', ['init', f.directory], { stdio: 'ignore' });
      fs.writeFileSync(path.join(f.directory, 'untracked.txt'), 'dirty checkout');
    }
    const guard = path.join(f.directory, 'no-tools.cjs');
    fs.writeFileSync(guard, `
      const cp = require('node:child_process');
      for (const name of ['execFileSync', 'spawnSync', 'spawn', 'exec']) cp[name] = () => { throw new Error('Help invoked a forbidden tool'); };
      const fs = require('node:fs');
      const read = fs.readFileSync;
      fs.readFileSync = (file, ...args) => {
        if (file === process.argv[1]) return read(file, ...args);
        throw new Error('Help attempted to read configuration or allocation data');
      };
      for (const name of ['mkdirSync', 'mkdtempSync', 'copyFileSync', 'writeFileSync', 'renameSync', 'linkSync']) fs[name] = () => { throw new Error('Help attempted a filesystem mutation'); };
    `);
    const before = fs.readdirSync(f.directory);
    for (const args of [['--help'], ['-h'], ...['allocate', 'synchronise', 'preflight', 'prepare', 'verify', 'validate', 'stage'].flatMap((command) => [[command, '--help'], [command, '-h']])]) {
      const result = spawnSync(process.execPath, ['--require', guard, f.copied, ...args],
        { cwd: f.directory, env: f.env, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /Usage: node scripts\/android-release.js/);
      assert.match(result.stdout, /read-only|does not inspect/);
      assert.doesNotMatch(result.stdout, /--bump|--keep-version|--publish/);
    }
    assert.deepEqual(fs.readdirSync(f.directory), before);
  });
}

test('help describes actual required arguments, intent, execution and safety distinctions', (t) => {
  const f = setup(t);
  const result = spawnSync(process.execPath, [f.copied, '--help'], { env: f.env, encoding: 'utf8' });
  assert.equal(result.status, 0);
  for (const text of ['--intent new|keep', '--allocation FILE', 'Reserved ledger row', 'private JSON', '--dry-run',
    '--execute-build', 'actual separately authorised Gradle build', 'verify APK --build-tools DIRECTORY',
    'validate MANIFEST', 'stage APK', '--source-revision SHA', 'source revision stays unknown', 'Only synchronise changes versions']) {
    assert.ok(result.stdout.includes(text), text);
  }
});

test('invalid help and normal invalid options fail without invoking release work', (t) => {
  const f = setup(t);
  for (const args of [['unknown', '--help'], ['prepare', '--help', '--execute-build'], ['prepare', '--publish'], ['--help', 'prepare']]) {
    const result = spawnSync(process.execPath, [f.copied, ...args], { env: f.env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

test('both new-release entry points refuse missing attestation and report actual ledger state', (t) => {
  const f = setup(t);
  fs.mkdirSync(path.join(f.directory, 'docs'));
  fs.writeFileSync(path.join(f.directory, 'docs/android-release-ledger.md'), ledger());
  fs.writeFileSync(path.join(f.directory, 'app.json'), JSON.stringify({ expo: { version: '8.1.8',
    android: { versionCode: 500, package: 'fi.sancti.client' }, extra: { sanctifiVersion: '0.1.1' } } }));
  const before = fs.readdirSync(f.directory);
  for (const args of [['preflight', '--intent', 'new'], ['prepare', '--dry-run', '--intent', 'new']]) {
    const result = spawnSync(process.execPath, [f.copied, ...args, '--directory', path.join(f.directory, 'archive')], { cwd: f.directory, env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.match(report.errors.join(), /supply --allocation FILE/);
    assert.match(report.errors.join(), /separately approved higher versionCode, a Reserved ledger entry/);
    assert.match(report.warnings.join(), /high-water mark: 500/);
    assert.match(report.warnings.join(), /500 has already been distributed/);
    assert.equal(report.publication, 'none');
    assert.equal(report.evidenceDirectory, undefined);
  }
  assert.deepEqual(fs.readdirSync(f.directory), before);
});
