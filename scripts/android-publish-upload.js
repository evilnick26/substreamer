'use strict';
// Issue #51: upload a verified, immutable APK; NEVER modify channel manifests.
// The caller must have performed the publication preflight first.
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = '/opt/updates-site/client/apks';
function check(ok, message) { if (!ok) throw new Error(message); }
function quote(s) { return "'" + s.replace(/'/g, "'\\''") + "'"; }
function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: options.interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'], timeout: 180000, ...options });
  check(!result.error && result.status === 0, cmd + ' failed (' + (result.stderr || result.error?.message || result.status) + ')');
  return result.stdout || '';
}
function installScript(filename, hash, temporary) {
  check(/^sanctifi-[1-9]\d*\.apk$/.test(filename), 'Invalid APK filename');
  check(/^[a-f0-9]{64}$/.test(hash), 'Invalid APK checksum');
  check(/^\/tmp\/sanctifi-upload-[a-f0-9]{32}\.apk$/.test(temporary), 'Invalid temporary path');
  const destination = ROOT + '/' + filename;
  const stage = ROOT + '/.' + filename + '.stage-' + temporary.match(/[a-f0-9]{32}/)[0];
  // No overwriting an existing immutable artifact, even under concurrent uploads.
  return [
    'set -eu',
    'test -f ' + quote(temporary),
    'printf "%s  %s\\n" ' + quote(hash) + ' ' + quote(temporary) + ' | sha256sum -c -',
    'test -d ' + quote(ROOT),
    'if test -e ' + quote(destination) + '; then',
    '  printf "%s  %s\\n" ' + quote(hash) + ' ' + quote(destination) + ' | sha256sum -c -',
    'else',
    '  test ! -e ' + quote(stage),
    '  install -o root -g root -m 644 ' + quote(temporary) + ' ' + quote(stage),
    '  printf "%s  %s\\n" ' + quote(hash) + ' ' + quote(stage) + ' | sha256sum -c -',
    '  if ln ' + quote(stage) + ' ' + quote(destination) + '; then :; else',
    '    printf "%s  %s\\n" ' + quote(hash) + ' ' + quote(destination) + ' | sha256sum -c -',
    '  fi',
    '  rm -f ' + quote(stage),
    'fi',
    'printf "%s  %s\\n" ' + quote(hash) + ' ' + quote(destination) + ' | sha256sum -c -',
    'test "$(stat -c "%U:%G:%a" ' + quote(destination) + ')" = "root:root:644"',
  ].join('\n');
}
function upload(file, filename, hash, deps = {}) {
  const run = deps.run || command;
  const suffix = (deps.random || (() => crypto.randomBytes(16).toString('hex')))();
  check(/^[a-f0-9]{32}$/.test(suffix), 'Invalid random suffix');
  const temporary = '/tmp/sanctifi-upload-' + suffix + '.apk';
  const remote = 'evilnick@obscurity';
  const script = installScript(filename, hash, temporary);
  // No manifest mutation. A failed transfer leaves only a uniquely named /tmp file.
  run('scp', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', file, remote + ':' + temporary]);
  try {
    // sudo prompts on the remote terminal, never via a stored password.
    run('ssh', ['-tt', '-o', 'ConnectTimeout=10', 'obscurity',
      'sudo /bin/sh -c ' + quote(script)], { interactive: true });
  } finally {
    // Remote temp belongs to the SSH user. Cleanup is best effort and never masks failure.
    try { run('ssh', ['-o', 'BatchMode=yes', 'obscurity', 'rm -f -- ' + quote(temporary)]); }
    catch { /* Reported by later inventory; no manifest promotion has occurred. */ }
  }
}
module.exports = { installScript, upload, quote };
