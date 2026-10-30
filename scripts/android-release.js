#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const PACKAGE = 'fi.sancti.client';
const CERTIFICATE = 'a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c';
const DEFAULT_DIRECTORY = '/media/data/Complete/Sanctifi/Releases';
const STORAGE_MOUNT = '/media/data';

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
async function stageApk(source, buildTools, sourceRevision, directory = DEFAULT_DIRECTORY, run, storage = {}) {
  check(/^[a-f0-9]{40}$/.test(sourceRevision), 'Supply the exact full source revision used for this APK');
  const requestedDirectory = directory;
  directory = releaseDirectory(directory, storage);
  check(!fs.existsSync(requestedDirectory) || fs.lstatSync(requestedDirectory).isDirectory(), 'Staging directory must not be a symlink');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  check(fs.lstatSync(directory).isDirectory(), 'Staging directory must not be a symlink');
  const temporary = fs.mkdtempSync(path.join(directory, '.stage-'));
  try {
    const snapshot = path.join(temporary, 'candidate.apk');
    fs.copyFileSync(source, snapshot, fs.constants.COPYFILE_EXCL);
    const apk = await inspectApk(snapshot, buildTools, run);
    releaseDirectory(directory, storage);
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

function within(directory, ancestor) {
  return directory === ancestor || directory.startsWith(ancestor + '/');
}

function verifyArchiveMount(directory, mountinfo, storage = {}, destination = true) {
  const decode = (value) => value.replace(/\\(040|011|012|134)/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
  const mounts = mountinfo.trim().split('\n').map((line) => {
    const parts = line.split(' - ');
    const fields = parts[0].split(' ');
    const filesystem = parts[1]?.split(' ');
    check(parts.length === 2 && fields.length >= 6 && /^\d+$/.test(fields[0]) &&
      /^\d+$/.test(fields[1]) && /^\d+:\d+$/.test(fields[2]) && fields[4].startsWith('/') && filesystem.length >= 3,
    'Cannot verify release storage: malformed Linux mountinfo');
    return { id: fields[0], parent: fields[1], target: decode(fields[4]), root: decode(fields[3]), device: fields[2], options: fields[5].split(','), superOptions: filesystem[2].split(',') };
  });
  const covering = mounts.filter((mount) => mount.target === '/' || within(directory, mount.target));
  const exact = mounts.filter((mount) => mount.target === STORAGE_MOUNT);
  const root = mounts.filter((mount) => mount.target === '/');
  check(exact.length === 1 && root.length === 1 && exact[0].device !== root[0].device,
    'Release storage unavailable: /media/data must be a distinct mounted filesystem; mount the VeraCrypt volume, never create a replacement archive');
  check(new Set(mounts.map((mount) => mount.id)).size === mounts.length, 'Cannot verify release storage: duplicate mount IDs');
  const deepest = covering.sort((a, b) => b.target.length - a.target.length)[0];
  const ancestors = new Set();
  for (let mount = deepest; mount && !ancestors.has(mount.id); mount = mounts.find((parent) => parent.id === mount.parent)) ancestors.add(mount.id);
  check(deepest && covering.filter((mount) => mount.target === deepest.target).length === 1 &&
    covering.every((mount) => ancestors.has(mount.id)) && deepest.device === exact[0].device &&
    [exact[0], deepest].every((mount) => mount.options.includes('rw') && mount.superOptions.includes('rw')),
  'Release storage unavailable: archive is obscured by another filesystem or mounted read-only');
  const identity = JSON.stringify([exact[0].id, exact[0].device, exact[0].root]);
  check(storage.mountIdentity === undefined || storage.mountIdentity === identity,
    'Release storage identity changed during this operation; stop and inspect the mount');
  storage.mountIdentity = identity;
  if (destination) {
    const coveringIdentity = JSON.stringify([deepest.id, deepest.device, deepest.root, deepest.target]);
    check(storage.coveringIdentity === undefined || storage.coveringIdentity === coveringIdentity,
      'Release archive covering mount changed during this operation; stop and inspect the mount');
    storage.coveringIdentity = coveringIdentity;
  }
  return directory;
}

function releaseDirectory(directory = DEFAULT_DIRECTORY, storage = {}) {
  const requested = path.resolve(directory);
  const production = within(requested, STORAGE_MOUNT);
  const verify = (target, destination) => {
    let mountinfo;
    try { mountinfo = fs.readFileSync('/proc/self/mountinfo', 'utf8'); } catch {
      throw new Error('Cannot verify release storage: Linux /proc/self/mountinfo unavailable; no fallback archive is allowed');
    }
    verifyArchiveMount(target, mountinfo, storage, destination);
  };
  if (production) verify(requested, false);
  const physical = outsideGit(requested);
  check(!production || within(physical, STORAGE_MOUNT), 'Production archive symlink escapes the mounted storage');
  if (within(physical, STORAGE_MOUNT)) verify(physical, true);
  return physical;
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

function digest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function allocationFile(directory, code) {
  return path.join(directory, '.allocations', `${code}.json`);
}

function ledgerRows(text) {
  const rows = text.split('\n').filter((line) => /^\|\s*`\d+`\s*\|/.test(line)).map((line) => {
    const fields = line.split('|').slice(1, -1).map((field) => field.trim().replaceAll('`', ''));
    const versionCode = Number(fields[0]);
    validateVersion(versionCode, '8.1.8');
    check(fields.length === 6 && /^(Published|Reserved|Failed|Withdrawn|Rejected)\b/.test(fields[5]), 'Incomplete or unrecognised release ledger row');
    const sha = /^[a-f0-9]{64}$/.test(fields[3]) ? fields[3] : null;
    check(!/^Published\b/.test(fields[5]) || sha, 'Published ledger row lacks APK checksum');
    return { versionCode, sha256: sha, state: /^Rejected\b/.test(fields[5]) ? 'rejected' : 'occupied', status: fields[5] };
  });
  check(rows.length && new Set(rows.map((row) => row.versionCode)).size === rows.length, 'Missing or duplicate release ledger history');
  return rows;
}

function metadataPlan(root, code) {
  const appFile = path.join(root, 'app.json');
  const nativeFile = path.join(root, 'android/app/build.gradle');
  check(existingRegularFile(appFile) && existingRegularFile(nativeFile), 'app.json and existing native Gradle project required; no prebuild is run');
  const dynamic = path.join(root, 'app.config.js');
  if (fs.existsSync(dynamic)) {
    check(!/versionCode|versionName/.test(fs.readFileSync(dynamic, 'utf8')), 'Dynamic version overrides require manual review');
  }
  const app = fs.readFileSync(appFile, 'utf8');
  const native = fs.readFileSync(nativeFile, 'utf8');
  const expo = readJson(appFile).expo;
  const current = nativeMetadata(native);
  validateVersion(expo.android.versionCode, expo.version);
  check(expo.version === '8.1.8' && current.versionName === expo.version &&
    expo.android.package === PACKAGE && current.packageName === PACKAGE, 'Package/versionName migration requires separate review');
  check(/^\d+\.\d+\.\d+$/.test(expo.extra?.sanctifiVersion), 'Missing sancti.fi semantic version');
  check([...app.matchAll(/"versionCode"\s*:/g)].length === 1, 'Ambiguous app.json versionCode');
  check([...native.matchAll(/\bversionCode\b/g)].length === 1 &&
    !/versionCodeOverride|productFlavors|\bsplits\b|apply\s+from\s*:/.test(native), 'Unsupported Gradle versionCode overrides; inspect native build manually');
  check(code > expo.android.versionCode && code > current.versionCode, 'Allocation must exceed configured versionCodes');
  const appNext = app.replace(/("versionCode"\s*:\s*)\d+/, (_, prefix) => prefix + code);
  const nativeNext = native.replace(/^(\s*versionCode\s+)\d+(\s*)$/m, (_, prefix, suffix) => prefix + code + suffix);
  return [
    { path: 'app.json', before: digest(app), after: digest(appNext), original: app, target: appNext },
    { path: 'android/app/build.gradle', before: digest(native), after: digest(nativeNext), original: native, target: nativeNext },
  ];
}

// A committed, reservation-specific semantic-version amendment is the only
// permitted departure from the immutable post-synchronisation app.json bytes.
function matchesSemanticAmendment(root, reservation, item, actual) {
  if (item.path !== 'app.json') return false;
  const file = path.join(root, 'docs/release-amendments', `${reservation.versionCode}.json`);
  if (!existingRegularFile(file)) return false;
  const amendment = readJson(file);
  if (amendment.schemaVersion !== 1 || amendment.reservationId !== reservation.id ||
      amendment.versionCode !== reservation.versionCode ||
      amendment.field !== 'expo.extra.sanctifiVersion' ||
      typeof amendment.from !== 'string' || typeof amendment.to !== 'string' ||
      !/^\\d+\\.\\d+\\.\\d+$/.test(amendment.from) ||
      !/^\\d+\\.\\d+\\.\\d+$/.test(amendment.to) ||
      amendment.from === amendment.to ||
      !Object.keys(amendment).every((key) =>
        ['schemaVersion', 'reservationId', 'versionCode', 'field', 'from', 'to', 'reason'].includes(key)) ||
      typeof amendment.reason !== 'string' || !amendment.reason.trim()) return false;
  const original = JSON.parse(item.target);
  if (original.expo?.extra?.sanctifiVersion !== amendment.from) return false;
  original.expo.extra.sanctifiVersion = amendment.to;
  const current = JSON.parse(actual);
  // Require byte-for-byte equivalence after changing exactly the approved value.
  // Preserve the original JSON formatting by replacing only the field's value.
  const matches = [...item.target.matchAll(/("sanctifiVersion"\\s*:\\s*")([^"]+)(")/g)];
  if (matches.length !== 1 || matches[0][2] !== amendment.from) return false;
  const expected = item.target.replace(/("sanctifiVersion"\\s*:\\s*")([^"]+)(")/,
    (_, prefix, old, suffix) => prefix + amendment.to + suffix);
  return digest(actual) === digest(expected) &&
    current.expo?.extra?.sanctifiVersion === amendment.to;
}

function readReservation(file, directory) {
  check(existingRegularFile(file), 'Reservation file must be a regular file');
  const identity = readJson(path.join(directory, '.allocations/registry.json'));
  check(identity.schemaVersion === 1 && identity.directory === directory, 'Registry identity mismatch');
  const record = readJson(file);
  validateVersion(record.versionCode, '8.1.8');
  check(record.schemaVersion === 2 && record.reconciled === true &&
    record.versionCode === record.highWaterMark + 1 && record.directory === directory &&
    path.resolve(file) === allocationFile(directory, record.versionCode) &&
    typeof record.id === 'string' && /^[a-f0-9-]{36}$/.test(record.id) &&
    Array.isArray(record.metadata) && record.metadata.length === 2 &&
    record.metadata.every((item, index) => item.path === ['app.json', 'android/app/build.gradle'][index] &&
      digest(item.original) === item.before && digest(item.target) === item.after), 'Invalid private registry reservation');
  return record;
}

async function allocationEvidence(options, root, run, storage) {
  const directory = releaseDirectory(options.directory, storage);
  check(fs.lstatSync(directory).isDirectory(), 'Existing trusted archive required, including for initial allocation');
  check(options.history && existingRegularFile(options.history), 'Supply --history FILE with complete Futwick/server reconciliation');
  outsideGit(path.dirname(options.history));
  const historyBytes = fs.readFileSync(options.history, 'utf8');
  const history = readJson(options.history);
  const age = Date.now() - Date.parse(history.checkedAt);
  check(history.schemaVersion === 1 && age >= 0 && age <= 24 * 60 * 60 * 1000 &&
    history.complete === true && history.exclusiveAllocator === true && history.allocationDirectory === directory &&
    ['futwick', 'server'].every((key) => typeof history.sources?.[key] === 'string' && history.sources[key].trim()),
  'History must be complete, <=24h old, identify Futwick/server evidence and the exclusive allocation directory');
  check(Array.isArray(history.artifacts) && history.artifacts.length && Array.isArray(history.archivePaths) && history.archivePaths.length,
    'History must enumerate artifacts and all local archivePaths (including unstaged builds)');
  const ledgerFile = path.join(root, 'docs/android-release-ledger.md');
  const ledger = fs.readFileSync(ledgerFile, 'utf8');
  const rows = ledgerRows(ledger);
  const evidence = [];
  const add = (item, source) => {
    validateVersion(item.versionCode, '8.1.8');
    check(['occupied', 'rejected'].includes(item.state) &&
      ((item.sha256 === null && item.state === 'occupied') || /^[a-f0-9]{64}$/.test(item.sha256)), 'Invalid history artifact');
    evidence.push({ ...item, source });
  };
  for (const item of history.artifacts) add(item, 'authoritative history');
  for (const row of rows) {
    const localReservation = !row.sha256 && existingRegularFile(allocationFile(directory, row.versionCode));
    if (localReservation) readReservation(allocationFile(directory, row.versionCode), directory);
    check(localReservation || history.artifacts.some((item) => item.versionCode === row.versionCode &&
      (!row.sha256 || row.sha256 === item.sha256) && item.state === row.state), 'History omits or contradicts a ledger allocation');
    add(row, 'ledger');
  }
  const registry = path.join(directory, '.allocations');
  if (options.initialize) check(!fs.existsSync(registry), 'Registry already exists; omit --initialize');
  else {
    check(fs.lstatSync(registry).isDirectory(), 'Private registry unavailable; restore it, never silently start over');
    const names = fs.readdirSync(registry);
    check(names.includes('registry.json'), 'Registry identity missing; restore from backup');
    const identity = readJson(path.join(registry, 'registry.json'));
    check(identity.directory === directory && identity.schemaVersion === 1, 'Registry directory identity mismatch');
    for (const name of names.filter((name) => name !== 'registry.json')) {
      check(/^\d+\.json$/.test(name), 'Unrecognised registry entry; reconcile before allocating');
      const record = readReservation(path.join(registry, name), directory);
      add({ versionCode: record.versionCode, sha256: null, state: 'occupied' }, 'reservation');
    }
  }
  check(!fs.existsSync(path.join(directory, '.prepare-lock')) || options.locked, 'Another allocation/preparation holds .prepare-lock');
  const seen = new Set();
  const scan = async (file) => {
    const stat = fs.lstatSync(file);
    check(!stat.isSymbolicLink(), 'Archive symlinks require manual reconciliation');
    const real = fs.realpathSync(file);
    if (seen.has(real)) return;
    seen.add(real);
    if (stat.isDirectory()) {
      if (file === registry) return;
      for (const name of fs.readdirSync(file).sort()) await scan(path.join(file, name));
    } else if (/\.apk$/i.test(file)) {
      check(options.buildTools, 'Local APK inventory requires --build-tools DIRECTORY');
      const apk = await inspectApk(file, options.buildTools, run);
      const rejected = history.artifacts.some((item) => item.state === 'rejected' && item.versionCode === apk.versionCode && item.sha256 === apk.sha256);
      add({ versionCode: apk.versionCode, sha256: apk.sha256, state: rejected ? 'rejected' : 'occupied' }, file);
      const sidecar = file + '.json';
      if (fs.existsSync(sidecar)) {
        check(existingRegularFile(sidecar), 'Invalid APK sidecar');
        const record = readJson(sidecar);
        check(record.versionCode === apk.versionCode && record.sha256 === apk.sha256, 'Archive sidecar contradicts APK bytes');
      }
    } else if (/\.apk\.json$/i.test(file)) {
      check(existingRegularFile(file.slice(0, -5)), 'Orphan APK provenance; reconcile missing artifact');
    }
  };
  for (const archive of [directory, ...history.archivePaths]) {
    check(path.isAbsolute(archive) && fs.lstatSync(archive).isDirectory(), 'archivePaths must be absolute existing directories');
    await scan(archive);
  }
  const output = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
  if (fs.existsSync(output)) await scan(output);
  for (const item of evidence.filter((item) => item.sha256 && item.state !== 'rejected')) {
    check(!evidence.some((other) => other.versionCode === item.versionCode && other.state !== 'rejected' &&
      other.sha256 && other.sha256 !== item.sha256), `Conflicting APK bytes for versionCode ${item.versionCode}; quarantine/reconcile rejected artifacts explicitly`);
  }
  const expo = readJson(path.join(root, 'app.json')).expo;
  const native = nativeMetadata(fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8'));
  const highWaterMark = Math.max(80000189, expo.android.versionCode, native.versionCode, ...evidence.map((item) => item.versionCode));
  const versionCode = highWaterMark + 1;
  validateVersion(versionCode, '8.1.8');
  const metadata = metadataPlan(root, versionCode);
  return { directory, ledgerFile, ledger, historySha256: digest(historyBytes), highWaterMark, versionCode, evidence, metadata };
}

async function allocate(options, root = path.resolve(__dirname, '..'), run = runTool) {
  check(options.dryRun !== options.execute, 'Choose exactly one of --dry-run or --execute');
  const storage = {};
  const assess = () => allocationEvidence(options, root, run, storage);
  if (options.dryRun) {
    const result = await assess();
    return { command: 'allocate', dryRun: true, versionCode: result.versionCode, highWaterMark: result.highWaterMark,
      historySha256: result.historySha256, evidence: result.evidence, changes: result.metadata.map(({ path, before, after }) => ({ path, before, after })), publication: 'none' };
  }
  const directory = releaseDirectory(options.directory, storage);
  check(fs.lstatSync(directory).isDirectory(), 'Existing archive required');
  const lock = path.join(directory, '.prepare-lock');
  fs.mkdirSync(lock, { mode: 0o700 });
  try {
    options = { ...options, locked: true };
    const result = await assess();
    check(Number(options.expectCode) === result.versionCode, `Approve the proposed allocation with --expect-code ${result.versionCode}; history may have changed`);
    releaseDirectory(directory, storage);
    const registry = path.join(directory, '.allocations');
    if (options.initialize) {
      fs.mkdirSync(registry, { mode: 0o700 });
      const identity = fs.openSync(path.join(registry, 'registry.json'), 'wx', 0o600);
      try { fs.writeFileSync(identity, JSON.stringify({ schemaVersion: 1, directory })); fs.fsyncSync(identity); } finally { fs.closeSync(identity); }
      const parent = fs.openSync(directory, 'r');
      try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    }
    const reservation = allocationFile(directory, result.versionCode);
    const record = { schemaVersion: 2, id: crypto.randomUUID(), reconciled: true, directory,
      versionCode: result.versionCode, highWaterMark: result.highWaterMark, reservedAt: new Date().toISOString(),
      ledgerReference: `Automatic reservation ${result.versionCode}`, historySha256: result.historySha256,
      evidence: result.evidence, metadata: result.metadata };
    const fd = fs.openSync(reservation, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const parent = fs.openSync(registry, 'r');
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    check(fs.readFileSync(result.ledgerFile, 'utf8') === result.ledger, 'Ledger changed; reservation retained, stop and reconcile');
    fs.appendFileSync(result.ledgerFile, `\n### Automatic reservation ${result.versionCode}\n\n| versionCode | Actual versionName | Exact source revision | APK SHA-256 | Certificate SHA-256 | Status |\n| --- | --- | --- | --- | --- | --- |\n| \`${result.versionCode}\` | \`8.1.8\` | Unknown - not built | Not built | Not inspected | Reserved ${record.reservedAt}; automatic reservation ${record.id} |\n`);
    return { command: 'allocate', versionCode: result.versionCode, reservation, synchronised: false, publication: 'none' };
  } finally { fs.rmdirSync(lock); }
}

async function synchronise(options, root = path.resolve(__dirname, '..')) {
  check(options.dryRun !== options.execute, 'Choose exactly one of --dry-run or --execute');
  const storage = {};
  const directory = releaseDirectory(options.directory, storage);
  const record = readReservation(options.allocation, directory);
  const apply = () => {
    check(!fs.existsSync(path.join(directory, `.attempt-${record.versionCode}`)), 'Build already attempted; allocate a new code');
    const codes = fs.readdirSync(path.join(directory, '.allocations')).filter((name) => /^\d+\.json$/.test(name)).map((name) => Number(name.slice(0, -5)));
    check(record.versionCode === Math.max(...codes), 'Reservation superseded; synchronise only the newest allocation');
    const ledger = fs.readFileSync(path.join(root, 'docs/android-release-ledger.md'), 'utf8');
    check(ledgerRows(ledger).some((row) => row.versionCode === record.versionCode && /^Reserved\b/.test(row.status) && row.status.includes(record.id)), 'Reservation missing from ledger; reconcile before synchronising');
    for (const item of record.metadata) {
      const file = path.join(root, item.path);
      check(existingRegularFile(file), 'Metadata file missing');
      const current = digest(fs.readFileSync(file));
      check(current === item.before || current === item.after, `Metadata changed since allocation: ${item.path}; preserve local edits and allocate again`);
    }
    if (options.execute) {
      releaseDirectory(directory, storage);
      for (const item of record.metadata) {
        const file = path.join(root, item.path);
        if (digest(fs.readFileSync(file)) === item.after) continue;
        const temporary = file + '.allocation-' + record.id;
        fs.writeFileSync(temporary, item.target, { flag: 'wx', mode: fs.statSync(file).mode & 0o777 });
        fs.renameSync(temporary, file);
      }
    }
    return { command: 'synchronise', dryRun: options.dryRun, versionCode: record.versionCode,
      files: record.metadata.map((item) => item.path), publication: 'none' };
  };
  if (options.dryRun) return apply();
  const lock = path.join(directory, '.prepare-lock');
  fs.mkdirSync(lock, { mode: 0o700 });
  try { return apply(); } finally { fs.rmdirSync(lock); }
}

function allocationOptions(args, command) {
  const values = command === 'allocate'
    ? { '--history': 'history', '--directory': 'directory', '--build-tools': 'buildTools', '--expect-code': 'expectCode' }
    : { '--allocation': 'allocation', '--directory': 'directory' };
  const flags = { '--dry-run': 'dryRun', '--execute': 'execute', ...(command === 'allocate' ? { '--initialize': 'initialize' } : {}) };
  const options = { dryRun: false, execute: false };
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

async function preflight(options, root = path.resolve(__dirname, '..'), env = process.env, attemptId, storage = {}) {
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
    report.ledgerSha256 = digest(ledger);
    report.warnings.push(...ledgerDiagnostics(ledger, report.expected?.versionCode));
  } catch {
    report.warnings.push('Release ledger diagnostic context unavailable; inspect docs/android-release-ledger.md locally');
  }
  await attempt(async () => {
    report.directory = releaseDirectory(options.directory, storage);
    if (options.intent === 'new') {
      check(options.allocation, 'New artifact blocked: supply --allocation FILE. A new release requires a separately approved higher versionCode, a Reserved ledger entry and its matching private allocation attestation. ' + report.warnings.join('. '));
      const allocation = readJson(options.allocation);
      check(ledger !== undefined, 'Cannot check allocation without the release ledger');
      report.allocationSha256 = digest(JSON.stringify(allocation));
      if (allocation.schemaVersion === 2) {
        const reservation = readReservation(options.allocation, report.directory);
        check(digest(JSON.stringify(reservation)) === report.allocationSha256, 'Reservation changed while inspecting it');
        const registry = path.join(report.directory, '.allocations');
        for (const name of fs.readdirSync(registry).filter((name) => name !== 'registry.json')) {
          check(/^\d+\.json$/.test(name), 'Unrecognised registry entry; reconcile before preparing');
          const other = readReservation(path.join(registry, name), report.directory);
          check(other.versionCode <= allocation.versionCode, 'Reservation superseded by a newer private allocation');
        }
        check(ledgerRows(ledger).some((row) => row.versionCode === allocation.versionCode &&
          /^Reserved\b/.test(row.status) && row.status.includes(allocation.id) && row.sha256 === null),
        'Reserved ledger entry must match the private reservation identity and have no APK bytes');
        const marker = path.join(report.directory, `.attempt-${allocation.versionCode}`);
        if (attemptId !== undefined) {
          check(attemptId === allocation.id && existingRegularFile(marker) && fs.readFileSync(marker, 'utf8') === attemptId + '\n',
            'Preparation attempt marker no longer belongs to this reservation');
        } else {
          check(!fs.existsSync(marker), 'Reservation already attempted; failed or abandoned builds require a new allocation');
        }
        for (const item of allocation.metadata) {
          const file = path.join(root, item.path);
          check(existingRegularFile(file), 'Run synchronise for this reservation before preparation');
          const actual = fs.readFileSync(file, 'utf8');
          check(digest(actual) === item.after || matchesSemanticAmendment(root, allocation, item, actual),
            'Run synchronise for this reservation before preparation');
        }
      }
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

async function recheckPreparation(options, root, env, report, attemptId, storage) {
  const current = await preflight(options, root, env, attemptId, storage);
  check(current.ok, 'Preparation readiness changed: ' + current.errors.join('. '));
  for (const key of ['source', 'expected', 'semanticVersion', 'directory', 'buildTools', 'allocation', 'allocationSha256', 'ledgerSha256', 'existingArtifact']) {
    check(JSON.stringify(current[key]) === JSON.stringify(report[key]), `Preparation ${key} changed since preflight; no build started`);
  }
}

async function prepare(options, root = path.resolve(__dirname, '..'), env = process.env, build = executeBuild, run = runTool, checks = executeChecks) {
  check(options.dryRun !== options.executeBuild, 'Choose exactly one of --dry-run or --execute-build; real release builds require separate owner approval');
  const storage = {};
  const report = await preflight(options, root, env, undefined, storage);
  report.command = 'prepare';
  report.dryRun = options.dryRun;
  if (!report.ok || options.dryRun) return report;
  releaseDirectory(report.directory, storage);
  fs.mkdirSync(report.directory, { recursive: true, mode: 0o700 });
  const lock = path.join(report.directory, '.prepare-lock');
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch {
    report.ok = false;
    report.errors.push('Cannot acquire .prepare-lock; another preparation may be running. Inspect locally before removing a stale lock');
    return report;
  }
  try { await recheckPreparation(options, root, env, report, undefined, storage); } catch (error) {
    fs.rmdirSync(lock);
    report.ok = false;
    report.errors.push(error.message);
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
  let attemptId;
  report.startedAt = new Date().toISOString();
  try {
    if (options.intent === 'new' && readJson(options.allocation).schemaVersion === 2) {
      const reservation = readReservation(options.allocation, report.directory);
      attemptId = reservation.id;
      const fd = fs.openSync(path.join(report.directory, `.attempt-${reservation.versionCode}`), 'wx', 0o600);
      try { fs.writeFileSync(fd, reservation.id + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      const parent = fs.openSync(report.directory, 'r');
      try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
    }
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
    await recheckPreparation(options, root, env, report, attemptId, storage);
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
      report.staged = await stageApk(snapshot, report.buildTools, report.source.sourceRevision, report.directory, run, storage);
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
    '  --directory DIRECTORY    Trusted release archive outside Git (default: /media/data/Complete/Sanctifi/Releases; requires mounted /media/data)';
  const intent = '  --intent new|keep is required. new consumes a separately approved higher code, Reserved ledger row\n' +
    '  and --allocation FILE (private JSON: reconciled, versionCode, highWaterMark, ledgerReference).\n' +
    '  Allocation is required only for new and invalid for keep; it records prior approval, never creates it.\n' +
    '  keep requires the existing immutable APK/provenance and rejects changed rebuild bytes.\n' +
    '  Neither intent edits versions or allocates a number.';
  const commands = {
    allocate: 'allocate --history FILE (--dry-run | --execute --expect-code CODE) [--initialize] [--directory DIRECTORY] [--build-tools DIRECTORY]\n' +
      '  Reconcile complete fresh Futwick/server history, ledger, local APKs and durable reservations.\n' +
      '  --dry-run is read-only; SDK verification runs when local APKs exist. --execute reserves and appends a Reserved ledger row.\n' +
      '  --initialize explicitly starts the single private registry; use only after full owner reconciliation.',
    synchronise: 'synchronise --allocation FILE (--dry-run | --execute) [--directory DIRECTORY]\n' +
      '  Apply a registry reservation to app.json and existing Gradle versionCode only; no prebuild/build.',
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
      '  build-tools is required; directory defaults to /media/data/Complete/Sanctifi/Releases on mounted /media/data, outside Git.',
  };
  if (command) {
    check(Object.hasOwn(commands, command), 'Unknown command for help: ' + command);
    return 'Usage: node scripts/android-release.js ' + commands[command] + '\nHelp is read-only and needs no SDK, allocation file or clean checkout. No command publishes remotely.';
  }
  return 'Usage: node scripts/android-release.js COMMAND [arguments]\n\n' + Object.values(commands).join('\n\n') +
    '\n\nUse --help or COMMAND --help (also -h). Help does not inspect the checkout or run tools.\nOnly synchronise changes versions. No command publishes remotely; real builds require separate owner approval.';
}

async function main(args) {
  const [command, file, ...rest] = args;
  if (args.some((arg) => arg === '--help' || arg === '-h')) {
    check((args.length === 1 && ['--help', '-h'].includes(command)) ||
      (args.length === 2 && ['--help', '-h'].includes(file)), 'Usage: --help or COMMAND --help');
    console.log(help(args.length === 1 ? undefined : command));
    return;
  }
  if (command === 'allocate' || command === 'synchronise') {
    const options = allocationOptions(args.slice(1), command);
    console.log(JSON.stringify(await (command === 'allocate' ? allocate(options) : synchronise(options)), null, 2));
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

module.exports = { validateManifest, validateArtifact, inspectApk, stageApk, sha256, CERTIFICATE, PACKAGE, preflight, prepare, sourceState, nativeMetadata, localOptions, executeChecks, ledgerDiagnostics, allocate, synchronise, allocationOptions, DEFAULT_DIRECTORY, releaseDirectory, verifyArchiveMount };
if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
