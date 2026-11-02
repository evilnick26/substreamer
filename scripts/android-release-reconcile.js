#!/usr/bin/env node
'use strict';

// Issue #067: read-only reconciliation report, NOT an allocation attestation.
// Deliberately requires a separately approved historical baseline and an
// explicit declaration of every local APK archive. Never writes --history.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { reconcileLocalPublished } = require('./android-local-reconcile');
const { releaseDirectory } = require('./android-release');

function optionsFromArgs(args) {
  const values = {};
  const names = new Map([
    ['--baseline', 'baseline'], ['--directory', 'directory'],
    ['--archive', 'archives'], ['--build-tools', 'buildTools'],
    ['--ledger', 'ledgerFile'], ['--output-apk', 'outputApk'],
  ]);
  for (let i = 0; i < args.length; i += 1) {
    const key = names.get(args[i]);
    if (!key || i + 1 >= args.length || args[i + 1].startsWith('--')) {
      throw new Error('Unknown or incomplete option: ' + args[i]);
    }
    const value = args[++i];
    if (key === 'archives') (values.archives ||= []).push(value);
    else if (values[key]) throw new Error('Duplicate option: ' + key);
    else values[key] = value;
  }
  if (!values.baseline || !values.directory || !values.archives?.length ||
      !values.buildTools || !values.ledgerFile) {
    throw new Error('Required: --baseline FILE --directory DIR --archive DIR [--archive DIR...] --build-tools DIR --ledger FILE');
  }
  return values;
}

function readBaseline(file, archive) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Baseline must be a regular file');
  const baseline = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (baseline.schemaVersion !== 1 || baseline.complete !== true ||
      baseline.exclusiveAllocator !== true || baseline.allocationDirectory !== archive ||
      !Array.isArray(baseline.artifacts) || !baseline.artifacts.length) {
    throw new Error('Approved complete historical baseline required for the exact archive');
  }
  return baseline;
}

function remoteProbe() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'android-remote-inventory.js')],
    { encoding: 'utf8', timeout: 150000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Remote inventory failed: ' + (result.stderr || '').trim());
  const remote = JSON.parse(result.stdout);
  if (remote.status !== 'observed-not-authoritative') throw new Error('Unrecognised remote observation');
  return remote;
}

async function report(options, dependencies = {}) {
  const archive = releaseDirectory(options.directory);
  const baseline = readBaseline(options.baseline, archive);
  const remote = (dependencies.probe || remoteProbe)();
  const reconcile = dependencies.reconcile || reconcileLocalPublished;
  const local = await reconcile({
    directory: archive, buildTools: options.buildTools, ledgerFile: options.ledgerFile,
    archivePaths: options.archives, outputApk: options.outputApk, baseline, remote,
  });
  return {
    status: 'read-only-reconciled-not-attested',
    remoteObservedAt: remote.observedAt,
    remotePublishedCount: local.publishedCount,
    highestPublishedCode: local.highestPublishedCode,
    highestLocalKnownCode: local.localState.highestKnownCode,
    verifiedLocalPublishedCount: local.verifiedLocalCount,
    inspectedLocalApks: local.localArchiveInspectedFiles,
    declaredArchives: [archive, ...options.archives],
    limitations: 'Not complete allocation evidence: caller must prove archive scope, review historical baseline and ensure freshness; no history generated, no versionCode allocated.',
  };
}

async function main() {
  const result = await report(optionsFromArgs(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write('Release reconciliation failed closed: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
module.exports = { optionsFromArgs, readBaseline, report };
