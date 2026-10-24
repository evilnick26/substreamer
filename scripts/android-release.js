#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

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
  check(value.apkUrl === `https://sancti.fi/updates/apks/sanctifi-${value.versionCode}.apk`,
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

async function main(args) {
  const [command, file, ...rest] = args;
  check(['validate', 'stage'].includes(command) && file,
    'Usage: android-release.js validate MANIFEST [--apk APK --build-tools DIRECTORY] | stage APK --build-tools DIRECTORY --source-revision SHA [--directory DIRECTORY]');
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

module.exports = { validateManifest, validateArtifact, inspectApk, stageApk, sha256, CERTIFICATE, PACKAGE };
if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
