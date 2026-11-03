'use strict';
// Issue #51: compare-and-swap Alpha manifest, preserving a rollback copy.
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateManifest } = require('./android-release.js');
const BASE = '/opt/updates-site/client';
const MANIFEST = BASE + '/alpha.json';
function check(ok, message) { if (!ok) throw new Error(message); }
function quote(s) { return "'" + s.replace(/'/g, "'\\''") + "'"; }
function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function remote(args, options = {}) {
  const result = spawnSync('ssh', args, {
    encoding: 'utf8', timeout: 120000,
    stdio: options.interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  check(!result.error && result.status === 0, 'Remote manifest operation failed: ' + (result.stderr || result.error?.message || result.status));
  return result.stdout || '';
}
function readCurrent(run = remote) {
  return run(['-o', 'BatchMode=yes', 'obscurity',
    'if test -f ' + MANIFEST + '; then cat ' + MANIFEST + '; else printf "ALPHA_ABSENT"; fi']);
}
function scriptFor(action, expectedHash, nextJson, token) {
  check(['promote', 'rollback'].includes(action), 'Invalid action');
  check(/^[a-f0-9]{64}$/.test(expectedHash), 'Invalid expected checksum');
  check(/^[a-f0-9]{32}$/.test(token), 'Invalid token');
  const nextHash = hash(nextJson);
  const encoded = Buffer.from(nextJson).toString('base64');
  const stage = BASE + '/.alpha-' + token + '.tmp';
  const backup = BASE + '/.alpha-' + token + '.backup';
  const lines = [
    'set -eu',
    'umask 077',
    'test -f ' + MANIFEST,
    'printf "%s  %s\\n" ' + quote(expectedHash) + ' ' + quote(MANIFEST) + ' | sha256sum -c -',
  ];
  if (action === 'promote') {
    lines.push(
      'test ! -e ' + quote(stage),
      'test ! -e ' + quote(backup),
      'cp -p ' + quote(MANIFEST) + ' ' + quote(backup),
      'printf "%s" ' + quote(encoded) + ' | base64 -d > ' + quote(stage),
      'chown root:root ' + quote(stage),
      'chmod 644 ' + quote(stage),
      'printf "%s  %s\\n" ' + quote(nextHash) + ' ' + quote(stage) + ' | sha256sum -c -',
      'mv -f ' + quote(stage) + ' ' + quote(MANIFEST),
    );
  } else {
    lines.push(
      'test -f ' + quote(backup),
      'printf "%s  %s\\n" ' + quote(nextHash) + ' ' + quote(backup) + ' | sha256sum -c -',
      'mv -f ' + quote(backup) + ' ' + quote(MANIFEST),
    );
  }
  return lines.join('\n');
}
function invoke(script, run = remote) {
  return run(['-tt', 'obscurity', 'sudo /bin/sh -c ' + quote(script)], { interactive: true });
}
function promote(manifest, previousRaw, deps = {}) {
  validateManifest(manifest);
  check(previousRaw !== 'ALPHA_ABSENT', 'Alpha manifest missing: initial publication not supported');
  const token = (deps.random || (() => crypto.randomBytes(16).toString('hex')))();
  const nextJson = JSON.stringify(manifest, null, 2) + '\n';
  const before = hash(previousRaw);
  const after = hash(nextJson);
  const run = deps.run || remote;
  // Caller checks that readCurrent() still matches previousRaw before invoking.
  invoke(scriptFor('promote', before, nextJson, token), run);
  return { token, before, after, previousRaw, nextJson };
}
function rollback(state, deps = {}) {
  invoke(scriptFor('rollback', state.after, state.previousRaw, state.token), deps.run || remote);
}
module.exports = { hash, readCurrent, scriptFor, promote, rollback };
