#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const PACKAGE = 'fi.sancti.client';
const CERTIFICATE = 'a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c';
const DEFAULT_DIRECTORY = path.join(os.homedir(), '.local/share/sanctifi/releases');

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function validateVersion(versionCode, versionName) {
  check(Number.isInteger(versionCode) && versionCode > 0 && versionCode <= 2100000000,
    'versionCode must be an integer from 1 to 2100000000');
  check(typeof versionName === 'string' && versionName.length > 0 && versionName.length <= 128 &&
    versionName.trim() === versionName, 'versionName must be a nonempty string without surrounding whitespace');
}

function validateManifest(value) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Manifest must be an object');
  const required = ['schemaVersion', 'versionCode', 'versionName', 'apkUrl', 'sha256'];
  check(required.every((key) => Object.hasOwn(value, key)), 'Missing required manifest field');
  check(Object.keys(value).every((key) => [...required, 'releaseNotes'].includes(key)), 'Unknown manifest field');
  check(value.schemaVersion === 1, 'Unsupported schemaVersion');
  validateVersion(value.versionCode, value.versionName);
  check(value.apkUrl === `https://updates.sancti.fi/client/apks/sanctifi-${value.versionCode}.apk`,
    'apkUrl must use the canonical HTTPS archive URL matching versionCode');
  check(typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256),
    'sha256 must contain 64 lowercase hexadecimal characters');
  if (Object.hasOwn(value, 'releaseNotes')) {
    check(typeof value.releaseNotes === 'string' && value.releaseNotes.length <= 4000,
      'releaseNotes must be plain text of at most 4000 characters');
  }
  return value;
}

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function runTool(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 1024 * 1024,
  });
}

async function inspectApk(file, buildTools, run = runTool) {
  check(fs.statSync(file).isFile(), 'APK must be a regular file');
  let signature;
  let badging;
  try {
    signature = run(path.join(buildTools, 'apksigner'), ['verify', '--verbose', '--print-certs', file]);
    badging = run(path.join(buildTools, 'aapt2'), ['dump', 'badging', file]);
  } catch {
    throw new Error('APK signature/metadata verification failed; check the SDK tools and APK locally');
  }
  const certificates = [...signature.matchAll(/^Signer #(\d+) certificate SHA-256 digest: ([a-fA-F0-9]{64})\s*$/gm)];
  check(certificates.length === 1 && certificates[0][1] === '1' &&
    certificates[0][2].toLowerCase() === CERTIFICATE, 'APK must have the single permanent sancti.fi signer');
  const metadata = /^package: name='([^']+)' versionCode='(\d+)' versionName='([^'\r\n]*)'(?=\s|$)/m.exec(badging);
  check(metadata, 'Cannot read APK package/version metadata');
  const [, packageName, code, versionName] = metadata;
  check(packageName === PACKAGE, 'Unexpected APK package');
  const versionCode = Number(code);
  validateVersion(versionCode, versionName);
  return { packageName, versionCode, versionName, certificateSha256: CERTIFICATE, sha256: await sha256(file) };
}

async function validateArtifact(manifest, file, buildTools, run) {
  validateManifest(manifest);
  const apk = await inspectApk(file, buildTools, run);
  check(apk.versionCode === manifest.versionCode && apk.versionName === manifest.versionName,
    'Manifest version metadata differs from the APK');
  check(apk.sha256 === manifest.sha256, 'Manifest checksum differs from the APK');
  return apk;
}

function existingRegularFile(file) {
  try {
    check(fs.lstatSync(file).isFile(), 'Existing staging destination must be a regular file, not a symlink');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// Hard-link promotion is exclusive and atomic; the temporary files share the destination filesystem.
async function stageApk(source, buildTools, sourceRevision, directory = DEFAULT_DIRECTORY, run) {
  check(/^[a-f0-9]{40}$/.test(sourceRevision), 'Supply the exact full source revision used for this APK');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  check(fs.lstatSync(directory).isDirectory(), 'Staging directory must not be a symlink');
  const temporary = fs.mkdtempSync(path.join(directory, '.stage-'));
  try {
    const snapshot = path.join(temporary, 'candidate.apk');
    fs.copyFileSync(source, snapshot, fs.constants.COPYFILE_EXCL);
    const apk = await inspectApk(snapshot, buildTools, run);
    const record = { ...apk, sourceRevision };
    const filename = `sanctifi-${apk.versionCode}.apk`;
    const destination = path.join(directory, filename);
    if (existingRegularFile(destination)) {
      check(await sha256(destination) === apk.sha256, 'Refusing to overwrite a different staged APK');
    } else {
      try {
        fs.linkSync(snapshot, destination);
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        check(existingRegularFile(destination) && await sha256(destination) === apk.sha256,
          'Refusing to overwrite a different staged APK');
      }
    }
    const recordFile = destination + '.json';
    const recordBytes = JSON.stringify(record, null, 2) + '\n';
    const temporaryRecord = path.join(temporary, 'record.json');
    fs.writeFileSync(temporaryRecord, recordBytes, { flag: 'wx', mode: 0o600 });
    try {
      fs.linkSync(temporaryRecord, recordFile);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      check(existingRegularFile(recordFile) && fs.readFileSync(recordFile, 'utf8') === recordBytes,
        'Existing staging record differs; inspect provenance locally, do not overwrite it');
    }
    return { filename, ...record };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function git(root, args) {
  return execFileSync('git', ['--no-optional-locks', '-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function outsideGit(directory) {
  const exists = (file) => {
    try { fs.lstatSync(file); return true; } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  };
  let existing = path.resolve(directory);
  const missing = [];
  while (!exists(existing)) {
    missing.unshift(path.basename(existing));
    check(path.dirname(existing) !== existing, 'Cannot resolve staging directory');
    existing = path.dirname(existing);
  }
  check(fs.statSync(existing).isDirectory(), 'Release directory or its nearest existing parent must be a directory');
  const physical = fs.realpathSync(existing);
  const metadata = (parent) => exists(path.join(parent, 'HEAD')) &&
    ((exists(path.join(parent, 'objects')) && exists(path.join(parent, 'refs'))) || exists(path.join(parent, 'commondir')));
  for (let ancestor = physical; ; ancestor = path.dirname(ancestor)) {
    const marker = path.join(ancestor, '.git');
    const checkout = exists(marker) && (!fs.statSync(marker).isDirectory() || metadata(marker));
    check(!checkout && !metadata(ancestor), 'Release directory must be outside every Git checkout or repository metadata (including symlink targets)');
    if (path.dirname(ancestor) === ancestor) break;
  }
  return path.join(physical, ...missing);
}

async function sourceState(root) {
  const native = {};
  const walk = async (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      if (['build', '.gradle', '.cxx', '.kotlin'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      check(!entry.isSymbolicLink(), 'Native input symlinks require manual review before an automated build');
      if (entry.isDirectory()) await walk(file);
      else if (!/\.(keystore|jks|p12|pem|key)$/.test(entry.name) && entry.name !== 'signing.properties') {
        native[path.relative(root, file)] = await sha256(file);
      }
    }
  };
  const android = path.join(root, 'android');
  if (fs.existsSync(android)) {
    check(fs.lstatSync(android).isDirectory(), 'Native Android directory must not be a symlink');
    await walk(android);
  }
  return {
    sourceRevision: git(root, ['rev-parse', 'HEAD']),
    branch: git(root, ['branch', '--show-current']),
    dirty: git(root, ['status', '--porcelain', '--untracked-files=all']).length > 0,
    nativeInputs: native,
    nativeInputsSha256: crypto.createHash('sha256').update(JSON.stringify(native)).digest('hex'),
    provenanceLimit: 'Git revision plus native input hashes; ignored JS/environment inputs and installed dependencies are not a hermetic build attestation',
  };
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  try { return JSON.parse(text); } catch {
    throw new Error('Invalid JSON input; inspect the selected file locally without sharing its contents');
  }
}

function nativeMetadata(text) {
  const one = (expression, name) => {
    const matches = [...text.matchAll(expression)];
    check(matches.length === 1, `Cannot uniquely read native ${name}; inspect android/app/build.gradle`);
    return matches[0][1];
  };
  const code = one(/^\s*versionCode\s+(\d+)\s*$/gm, 'versionCode');
  const versionName = one(/^\s*versionName\s+["']([^"']+)["']\s*$/gm, 'versionName');
  const packageName = one(/^\s*applicationId\s+["']([^"']+)["']\s*$/gm, 'applicationId');
  return { versionCode: Number(code), versionName, packageName };
}

function ledgerDiagnostics(ledger, configuredCode) {
  const validCode = (value) => Number.isInteger(value) && value > 0 && value <= 2100000000;
  const marks = [...ledger.matchAll(/owner-confirmed(?:\s+global\s+allocation)?\s+high-water\s+mark\s+is(?:\s+therefore)?\s+\*\*(\d+)\*\*/gi)]
    .map((match) => Number(match[1]));
  const confirmed = marks.length > 0 && marks.every((code) => validCode(code) && code === marks[0]) ? marks[0] : null;
  const rows = ledger.split('\n').filter((line) => /^\|\s*`\d+`\s*\|/.test(line)).map((line) => {
    const fields = line.split('|').slice(1, -1).map((value) => value.trim());
    return { code: Number(fields[0].replaceAll('`', '')), fields, status: fields.at(-1) };
  }).filter((row) => validCode(row.code));
  const unique = rows.filter((row) => rows.filter((other) => other.code === row.code).length === 1);
  const current = unique.find((row) => row.code === configuredCode);
  const published = unique.filter((row) => /^Published\b/i.test(row.status)).sort((a, b) => b.code - a.code)[0];
  const highest = rows.length ? Math.max(...rows.map((row) => row.code)) : null;
  const messages = [confirmed === null ? 'Owner-confirmed allocation high-water mark is not unambiguously recorded in the ledger'
    : `Owner-confirmed allocation high-water mark: ${confirmed}`];
  if (highest !== null) messages.push(`Highest versionCode in ledger rows: ${highest}`);
  if (current) messages.push(/^Published\b/i.test(current.status)
    ? `Current configured versionCode ${configuredCode} has already been distributed (Published ledger row)`
    : `Current configured versionCode ${configuredCode} has ledger status: ${current.status}`);
  else messages.push(`Current configured versionCode ${configuredCode ?? 'unknown'} has no unambiguous ledger row`);
  if (published && published.fields.length === 6) {
    const source = published.fields[2].replaceAll('`', '');
    const hash = published.fields[3].replaceAll('`', '');
    const sections = ledger.split(/(?=^#{1,6} )/m).filter((section) =>
      new RegExp('^#{1,6} [^\n]*\\b' + published.code + '\\b').test(section));
    const sizes = sections.flatMap((section) => [...section.matchAll(/^\|\s*APK size\s*\|\s*\*\*((?:[1-9]\d{0,2}(?:,\d{3})+)|(?:[1-9]\d*)) bytes\*\*/gm)])
      .map((match) => Number(match[1].replaceAll(',', '')));
    const size = sizes.length === 1 && Number.isSafeInteger(sizes[0]) && sizes[0] > 0 ? sizes[0] : null;
    messages.push(`Published ${published.code}: APK SHA-256 ${/^[a-f0-9]{64}$/.test(hash) ? 'recorded (' + hash + ')' : 'not recorded as a valid digest'}; ` +
      `APK size ${size === null ? 'not unambiguously recorded in its ledger section' : 'recorded (' + size + ' bytes)'}; ` +
      `original build-source commit ${/^[a-f0-9]{40}$/.test(source) ? 'recorded (' + source + ')' : 'unknown/unverified (no full revision recorded)'}. ` +
      'Ledger evidence only; no fresh APK, signer or HTTPS verification performed');
  }
  return messages;
}

async function preflight(options, root = path.resolve(__dirname, '..'), env = process.env) {
  const report = { command: 'preflight', ok: true, errors: [], warnings: [], publication: 'none',
    apkVerification: 'Not performed by preflight', automatedChecks: 'Not run by preflight',
    manualAcceptance: 'Not performed: startup/manual discovery, browser in-place install, account/settings/offline preservation, navigation, online/offline playback, Up to Date' };
  const attempt = async (fn) => {
    try { await fn(); } catch (error) { report.errors.push(error.message); }
  };
  await attempt(async () => {
    check(['new', 'keep'].includes(options.intent), 'Supply --intent new or --intent keep; no versions are edited or allocated');
  });
  await attempt(async () => {
    report.source = await sourceState(root);
    check(!report.source.dirty, 'Source tree is dirty or has untracked files; commit/reconcile changes before preparation');
  });
  await attempt(async () => {
    const expo = readJson(path.join(root, 'app.json')).expo;
    report.semanticVersion = expo.extra?.sanctifiVersion;
    report.expected = { versionCode: expo.android.versionCode, versionName: expo.version, packageName: expo.android.package };
    validateVersion(report.expected.versionCode, report.expected.versionName);
    check(/^\d+\.\d+\.\d+$/.test(report.semanticVersion), 'Missing/invalid expo.extra.sanctifiVersion');
    check(report.expected.packageName === PACKAGE && report.expected.versionName === '8.1.8',
      'Expected package fi.sancti.client and native versionName 8.1.8; native migration requires separate review');
  });
  await attempt(async () => {
    const nativeFile = path.join(root, 'android/app/build.gradle');
    check(fs.existsSync(nativeFile), 'Native Android project missing; preserve local native work and use the reviewed manual Expo regeneration procedure');
    const text = fs.readFileSync(nativeFile, 'utf8');
    report.native = nativeMetadata(text);
    check(JSON.stringify(report.native) === JSON.stringify(report.expected),
      `Stale native metadata: Gradle ${JSON.stringify(report.native)}, app.json ${JSON.stringify(report.expected)}. Stop; preserve local work and manually review npx expo prebuild --platform android --no-install. Nothing was regenerated`);
    check(text.includes('signingConfig signingConfigs.sanctifiRelease') && text.includes('validateSanctifiReleaseSigning'),
      'Permanent release signer/validator missing from generated Gradle; inspect manually, never fall back to debug signing');
  });
  await attempt(async () => {
    check(env.JAVA_HOME && env.ANDROID_HOME, 'Configure JAVA_HOME and ANDROID_HOME explicitly on futwick; no emulator/environment helper is run');
    for (const file of [path.join(env.JAVA_HOME, 'bin/java'), path.join(env.JAVA_HOME, 'bin/javac'), path.join(root, 'android/gradlew')]) {
      fs.accessSync(file, fs.constants.X_OK);
    }
    check(fs.statSync(env.ANDROID_HOME).isDirectory(), 'ANDROID_HOME must be a directory');
    report.buildTools = path.resolve(options.buildTools || path.join(env.ANDROID_HOME, 'build-tools/36.0.0'));
    for (const tool of ['apksigner', 'aapt2']) fs.accessSync(path.join(report.buildTools, tool), fs.constants.X_OK);
    check(fs.existsSync(path.join(root, 'node_modules/expo/package.json')), 'Install reviewed locked dependencies before preparing a build');
  });
  let ledger;
  try {
    ledger = fs.readFileSync(path.join(root, 'docs/android-release-ledger.md'), 'utf8');
    report.warnings.push(...ledgerDiagnostics(ledger, report.expected?.versionCode));
  } catch {
    report.warnings.push('Release ledger diagnostic context unavailable; inspect docs/android-release-ledger.md locally');
  }
  await attempt(async () => {
    report.directory = outsideGit(options.directory || DEFAULT_DIRECTORY);
    if (options.intent === 'new') {
      check(options.allocation, 'New artifact blocked: supply --allocation FILE. A new release requires a separately approved higher versionCode, a Reserved ledger entry and its matching private allocation attestation. ' + report.warnings.join('. '));
      const allocation = readJson(options.allocation);
      check(ledger !== undefined, 'Cannot check allocation without the release ledger');
      const knownCodes = [...ledger.matchAll(/^\|\s*`(\d+)`\s*\|/gm)].map((m) => Number(m[1]));
      const minimumHighWaterMark = Math.max(80000188, ...knownCodes.filter((n) => n !== report.expected?.versionCode));
      check(allocation.reconciled === true && Number.isInteger(allocation.highWaterMark) &&
        allocation.highWaterMark >= minimumHighWaterMark &&
        allocation.versionCode === report.expected?.versionCode && allocation.versionCode > allocation.highWaterMark &&
        typeof allocation.ledgerReference === 'string' && allocation.ledgerReference.trim().length > 0,
      `Allocation must attest reconciled history, highWaterMark >= ${minimumHighWaterMark}, a higher matching versionCode and ledgerReference; no number is allocated here`);
      check(ledger.split('\n').some((line) => line.split('|')[1]?.trim() === '`' + allocation.versionCode + '`' && /^Reserved\b/i.test(line.split('|').at(-2)?.trim() || '')),
        'Record the approved code as Reserved in the release ledger before building');
      const destination = path.join(report.directory, `sanctifi-${allocation.versionCode}.apk`);
      check(!existingRegularFile(destination) && !existingRegularFile(destination + '.json'),
        'New-version intent cannot reuse an existing archive entry; use --intent keep to compare an identical rebuild');
      report.allocation = { reconciled: true, versionCode: allocation.versionCode, highWaterMark: allocation.highWaterMark, ledgerReference: allocation.ledgerReference };
    } else if (options.intent === 'keep') {
      check(!options.allocation, '--allocation is only valid with --intent new');
      const archived = path.join(report.directory, `sanctifi-${report.expected?.versionCode}.apk`);
      check(existingRegularFile(archived) && existingRegularFile(archived + '.json'),
        'Keep-version requires an existing immutable APK and provenance record; use verify for an unrelated existing APK');
      const record = readJson(archived + '.json');
      check(/^[a-f0-9]{40}$/.test(record.sourceRevision), 'Existing provenance record lacks an exact source revision');
      check(record.packageName === PACKAGE && record.certificateSha256 === CERTIFICATE &&
        record.versionCode === report.expected?.versionCode && record.versionName === report.expected?.versionName &&
        record.sha256 === await sha256(archived), 'Existing archive metadata/checksum mismatch; do not repair by overwriting');
      report.existingArtifact = { ...record, file: archived };
    }
  });
  report.buildCommand = { cwd: 'android', command: './gradlew', args: [':app:assembleRelease'], NODE_ENV: 'production' };
  report.ok = report.errors.length === 0;
  return report;
}

function executeChecks(root, env, directory) {
  const nodeTests = [
    ...fs.readdirSync(path.join(root, 'scripts/__tests__')).filter((name) => /^android-release.*\.test\.cjs$/.test(name)).map((name) => 'scripts/__tests__/' + name),
    ...fs.readdirSync(path.join(root, 'plugins/__tests__')).filter((name) => /^with-sanctifi-release-signing.*\.test\.cjs$/.test(name)).map((name) => 'plugins/__tests__/' + name),
  ];
  const commands = [
    [process.execPath, ['--test', ...nodeTests]],
    [path.join(root, 'node_modules/.bin/tsc'), ['--noEmit']],
    [path.join(root, 'node_modules/.bin/jest'), ['--no-coverage', '--maxWorkers=2']],
    ...['validate-intl', 'validate-translations', 'validate-proguard-rules', 'validate-module-inventory']
      .map((name) => [process.execPath, ['scripts/' + name + '.js']]),
  ];
  const results = [];
  commands.forEach(([command, args], index) => {
    const log = path.join(directory, `check-${index + 1}.log`);
    const fd = fs.openSync(log, 'wx', 0o600);
    try {
      const result = spawnSync(command, args, { cwd: root, env, stdio: ['ignore', fd, fd] });
      const passed = !result.error && result.status === 0 && !result.signal;
      results.push({ command: [path.basename(command), ...args], result: passed ? 'passed' : 'failed', log: path.basename(log) });
      if (!passed) {
        const error = new Error(`Automated check ${index + 1} failed (exit ${result.status}); inspect private check-${index + 1}.log locally; Gradle not started`);
        error.checks = results;
        throw error;
      }
    } finally { fs.closeSync(fd); }
  });
  return results;
}

function executeBuild(root, env, log) {
  const fd = fs.openSync(log, 'wx', 0o600);
  try {
    const result = spawnSync('./gradlew', [':app:assembleRelease'], {
      cwd: path.join(root, 'android'), env: { ...env, NODE_ENV: 'production' }, stdio: ['ignore', fd, fd],
    });
    check(!result.error && result.status === 0 && !result.signal,
      `Gradle failed (exit ${result.status}, signal ${result.signal || 'none'}); inspect the private build.log locally, never paste credential-bearing logs`);
  } finally { fs.closeSync(fd); }
}

async function prepare(options, root = path.resolve(__dirname, '..'), env = process.env, build = executeBuild, run = runTool, checks = executeChecks) {
  check(options.dryRun !== options.executeBuild, 'Choose exactly one of --dry-run or --execute-build; real release builds require separate owner approval');
  const report = await preflight(options, root, env);
  report.command = 'prepare';
  report.dryRun = options.dryRun;
  if (!report.ok || options.dryRun) return report;
  fs.mkdirSync(report.directory, { recursive: true, mode: 0o700 });
  const lock = path.join(report.directory, '.prepare-lock');
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch {
    report.ok = false;
    report.errors.push('Cannot acquire .prepare-lock; another preparation may be running. Inspect locally before removing a stale lock');
    return report;
  }
  let evidence;
  try { evidence = fs.mkdtempSync(path.join(report.directory, '.build-')); } catch (error) {
    fs.rmdirSync(lock);
    throw error;
  }
  fs.chmodSync(evidence, 0o700);
  report.evidenceDirectory = evidence;
  const output = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
  const previous = path.join(evidence, 'previous-output.apk');
  let moved = false;
  report.startedAt = new Date().toISOString();
  try {
    const javaVersion = run(path.join(env.JAVA_HOME, 'bin/java'), ['--version']);
    const javaMajor = /(?:openjdk|java) (\d+)/i.exec(javaVersion);
    check(javaMajor && Number(javaMajor[1]) >= 17 && Number(javaMajor[1]) <= 24, 'Gradle requires JDK 17-24; configure a supported JAVA_HOME');
    report.tools = { node: process.version, java: javaVersion.trim(), buildTools: report.buildTools };
    report.automatedChecks = checks(root, env, evidence);
    report.afterChecks = await sourceState(root);
    check(JSON.stringify(report.afterChecks) === JSON.stringify(report.source), 'Source/native inputs changed during automated checks; Gradle not started');
    if (options.intent === 'keep') {
      await validateArtifact({ schemaVersion: 1, ...artifactManifest(report.existingArtifact) },
        report.existingArtifact.file, report.buildTools, run);
    }
    if (fs.existsSync(output)) {
      check(existingRegularFile(output), 'Build output must not be a symlink');
      fs.renameSync(output, previous);
      moved = true;
    }
    build(root, env, path.join(evidence, 'build.log'));
    check(existingRegularFile(output), 'Gradle succeeded without producing a fresh app-release.apk; no artifact staged');
    report.after = await sourceState(root);
    check(JSON.stringify(report.after) === JSON.stringify(report.source), 'Source/native inputs changed during build; no artifact staged. Reconcile changes and rebuild');
    const snapshot = path.join(evidence, 'candidate.apk');
    fs.copyFileSync(output, snapshot, fs.constants.COPYFILE_EXCL);
    report.apk = await inspectApk(snapshot, report.buildTools, run);
    report.apkVerification = 'Signature, pinned signer, package, versions and file SHA-256 verified locally; no HTTPS/device checks';
    report.apk.size = fs.statSync(snapshot).size;
    check(report.apk.versionCode === report.expected.versionCode && report.apk.versionName === report.expected.versionName,
      'Built APK differs from approved source/native version metadata; no artifact staged');
    if (options.intent === 'keep') {
      check(report.apk.sha256 === report.existingArtifact.sha256,
        'Changed APK bytes with unchanged versionCode: stopped. Obtain approval for a globally new code; original archive/provenance untouched');
      report.artifactSourceRevision = report.existingArtifact.sourceRevision;
      report.staging = 'Existing identical artifact retained; original provenance unchanged';
    } else {
      report.staged = await stageApk(snapshot, report.buildTools, report.source.sourceRevision, report.directory, run);
      check(report.staged.sha256 === report.apk.sha256, 'APK changed during staging; stop and inspect staging before any manual publication');
      report.artifactSourceRevision = report.source.sourceRevision;
      report.staging = 'Verified immutable artifact staged';
    }
    report.manifestCandidate = { schemaVersion: 1, ...artifactManifest(report.apk) };
    validateManifest(report.manifestCandidate);
  } catch (error) {
    report.ok = false;
    report.errors.push(error.message);
    if (error.checks) report.automatedChecks = error.checks;
    if (moved && !fs.existsSync(output)) fs.renameSync(previous, output);
  } finally { fs.rmdirSync(lock); }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(evidence, 'summary.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return report;
}

function artifactManifest(apk) {
  return { versionCode: apk.versionCode, versionName: apk.versionName,
    apkUrl: `https://updates.sancti.fi/client/apks/sanctifi-${apk.versionCode}.apk`, sha256: apk.sha256 };
}

function localOptions(args, preparing) {
  const options = { dryRun: false, executeBuild: false };
  const values = { '--intent': 'intent', '--allocation': 'allocation', '--directory': 'directory', '--build-tools': 'buildTools' };
  const flags = preparing ? { '--dry-run': 'dryRun', '--execute-build': 'executeBuild' } : {};
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    check(!seen.has(arg), 'Duplicate option: ' + arg);
    seen.add(arg);
    if (flags[arg]) options[flags[arg]] = true;
    else {
      check(values[arg] && args[i + 1] && !args[i + 1].startsWith('--'), 'Unknown or incomplete option: ' + arg);
      options[values[arg]] = args[++i];
    }
  }
  return options;
}

function help(command) {
  const common = '  --build-tools DIRECTORY  SDK tools (default: $ANDROID_HOME/build-tools/36.0.0)\n' +
    '  --directory DIRECTORY    Trusted release archive outside Git (default: ~/.local/share/sanctifi/releases/)';
  const intent = '  --intent new|keep is required. new consumes a separately approved higher code, Reserved ledger row\n' +
    '  and --allocation FILE (private JSON: reconciled, versionCode, highWaterMark, ledgerReference).\n' +
    '  Allocation is required only for new and invalid for keep; it records prior approval, never creates it.\n' +
    '  keep requires the existing immutable APK/provenance and rejects changed rebuild bytes.\n' +
    '  Neither intent edits versions or allocates a number.';
  const commands = {
    preflight: 'preflight --intent new|keep [--allocation FILE] [--build-tools DIRECTORY] [--directory DIRECTORY]\n' +
      '  Read-only readiness checks; no tests, SDK processes, build or staging.\n' + intent + '\n' + common,
    prepare: 'prepare --intent new|keep (--dry-run | --execute-build) [--allocation FILE] [--build-tools DIRECTORY] [--directory DIRECTORY]\n' +
      '  --dry-run: read-only preparation assessment, with no tests/tools/build/staging.\n' +
      '  --execute-build: runs checks, an actual separately authorised Gradle build, APK verification and staging.\n' +
      '  Choose exactly one execution flag; stale native metadata stops, never triggers Expo prebuild.\n' + intent + '\n' + common,
    verify: 'verify APK --build-tools DIRECTORY\n' +
      '  Inspect an existing APK: signature/pinned signer, package, versions, hash and size.\n' +
      '  Requires existing SDK tools; source revision stays unknown. Does not build or stage.',
    validate: 'validate MANIFEST [--apk APK --build-tools DIRECTORY]\n' +
      '  Validate manifest structure only, or also compare a supplied local APK using required SDK tools.\n' +
      '  --build-tools is only valid with --apk. No download or public hosting verification.',
    stage: 'stage APK --build-tools DIRECTORY --source-revision SHA [--directory DIRECTORY]\n' +
      '  Verify/copy an existing APK to the immutable archive. SHA is the actual full 40-character build-source\n' +
      '  attestation and must exist in this checkout. Refuses differing bytes/provenance; never infer old source from HEAD.\n' +
      '  build-tools is required; directory defaults to ~/.local/share/sanctifi/releases/ outside Git.',
  };
  if (command) {
    check(Object.hasOwn(commands, command), 'Unknown command for help: ' + command);
    return 'Usage: node scripts/android-release.js ' + commands[command] + '\nHelp is read-only and needs no SDK, allocation file or clean checkout. No command publishes remotely.';
  }
  return 'Usage: node scripts/android-release.js COMMAND [arguments]\n\n' + Object.values(commands).join('\n\n') +
    '\n\nUse --help or COMMAND --help (also -h). Help does not inspect the checkout or run tools.\nNo command changes versions or publishes remotely; real builds require separate owner approval.';
}

async function main(args) {
  const [command, file, ...rest] = args;
  if (args.some((arg) => arg === '--help' || arg === '-h')) {
    check((args.length === 1 && ['--help', '-h'].includes(command)) ||
      (args.length === 2 && ['--help', '-h'].includes(file)), 'Usage: --help or COMMAND --help');
    console.log(help(args.length === 1 ? undefined : command));
    return;
  }
  if (command === 'preflight' || command === 'prepare') {
    const options = localOptions(args.slice(1), command === 'prepare');
    const report = command === 'prepare' ? await prepare(options) : await preflight(options);
    const summary = { ...report };
    for (const key of ['source', 'afterChecks', 'after']) {
      if (summary[key]) {
        const { nativeInputs, ...state } = summary[key];
        summary[key] = { ...state, nativeInputCount: Object.keys(nativeInputs).length };
      }
    }
    console.log(JSON.stringify(summary, null, 2));
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (command === 'verify') {
    check(file && rest.length === 2 && rest[0] === '--build-tools', 'Usage: android-release.js verify APK --build-tools DIRECTORY');
    const apk = await inspectApk(file, rest[1]);
    console.log(JSON.stringify({ apk: { ...apk, size: fs.statSync(file).size }, sourceRevision: null,
      publication: 'none', deviceAcceptance: 'not performed' }, null, 2));
    return;
  }
  check(['validate', 'stage'].includes(command) && file,
    'Usage: android-release.js preflight --intent new|keep [options] | prepare --intent new|keep --dry-run|--execute-build [options] | verify APK --build-tools DIRECTORY | validate MANIFEST [--apk APK --build-tools DIRECTORY] | stage APK --build-tools DIRECTORY --source-revision SHA [--directory DIRECTORY]');
  const allowed = command === 'stage' ? ['--build-tools', '--source-revision', '--directory'] : ['--apk', '--build-tools'];
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    check(allowed.includes(rest[i]) && rest[i + 1] && !rest[i + 1].startsWith('--') && !Object.hasOwn(options, rest[i]),
      'Unknown, duplicate or incomplete option');
    options[rest[i]] = rest[i + 1];
  }
  if (command === 'stage') {
    check(options['--build-tools'] && options['--source-revision'], 'Staging requires build-tools and source-revision');
    check(/^[a-f0-9]{40}$/.test(options['--source-revision']), 'Supply the exact full source revision used for this APK');
    try {
      execFileSync('git', ['-C', path.resolve(__dirname, '..'), 'cat-file', '-e', `${options['--source-revision']}^{commit}`], { stdio: 'ignore' });
    } catch {
      throw new Error('Source revision is not an available commit in this checkout');
    }
    console.log(JSON.stringify(await stageApk(file, options['--build-tools'], options['--source-revision'], options['--directory']), null, 2));
  } else {
    const manifest = validateManifest(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (options['--apk']) {
      check(options['--build-tools'], 'APK verification requires build-tools');
      await validateArtifact(manifest, options['--apk'], options['--build-tools']);
    } else {
      check(!options['--build-tools'], 'build-tools requires an APK');
    }
    console.log(options['--apk'] ? 'Manifest and local APK verified' : 'Manifest structure valid; artifact and live hosting not checked');
  }
}

module.exports = { validateManifest, validateArtifact, inspectApk, stageApk, sha256, CERTIFICATE, PACKAGE, preflight, prepare, sourceState, nativeMetadata, localOptions, executeChecks, ledgerDiagnostics };
if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
