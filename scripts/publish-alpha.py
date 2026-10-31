#!/usr/bin/env python3
"""Attended alpha-channel publisher. Run from Futwick; never stores credentials."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys

ARCHIVE = Path("/media/data/Complete/Sanctifi/Releases")
REMOTE = "evilnick@obscurity"
ROOT = "/opt/updates-site/client"
BASE = "https://updates.sancti.fi/client"
HEX = re.compile(r"^[a-f0-9]{64}$")


def run(*argv, input_text=None, tty=False):
    return subprocess.run(argv, input=input_text, text=True, check=True,
                          stdout=None, stderr=None)


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def manifest_check(data, code, expected):
    if type(data) is not dict or set(data) - {"schemaVersion", "versionCode", "versionName", "apkUrl", "sha256", "releaseNotes"}:
        raise ValueError("Invalid manifest object or unexpected fields")
    if data.get("schemaVersion") != 1 or type(data.get("versionCode")) is not int or data["versionCode"] != code:
        raise ValueError("Manifest schema/versionCode mismatch")
    if data.get("versionName") != "8.1.8" or data.get("apkUrl") != f"{BASE}/apks/sanctifi-{code}.apk":
        raise ValueError("Unexpected versionName or APK URL")
    if data.get("sha256") != expected or not HEX.fullmatch(data["sha256"]):
        raise ValueError("Manifest SHA-256 mismatch")
    if "releaseNotes" in data and (not isinstance(data["releaseNotes"], str) or len(data["releaseNotes"]) > 4000):
        raise ValueError("Invalid release notes")



def prepare_manifest(code, notes, output):
    """Generate a reviewed local candidate; never modify an existing file."""
    if not isinstance(notes, str) or not notes.strip() or len(notes) > 4000:
        raise ValueError("Release notes must be nonempty and at most 4000 characters")
    apk = ARCHIVE / f"sanctifi-{code}.apk"
    if not apk.is_file() or apk.is_symlink():
        raise ValueError(f"Missing or symlink APK: {apk}")
    checksum = digest(apk)
    data = {
        "schemaVersion": 1,
        "versionCode": code,
        "versionName": "8.1.8",
        "apkUrl": f"{BASE}/apks/sanctifi-{code}.apk",
        "sha256": checksum,
        "releaseNotes": notes,
    }
    manifest_check(data, code, checksum)
    contents = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    print("\nProposed manifest:\n" + contents, flush=True)
    if input("Save this manifest? Type YES to confirm: ").strip() != "YES":
        print("Cancelled; nothing saved.")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation avoids accidental replacement, including symlinks.
    with output.open("x", encoding="utf-8") as stream:
        stream.write(contents)
    print(f"Manifest saved: {output}", flush=True)


def prompt_release_notes():
    print("No editor, credentials or network connection required.")
    print("Enter release notes below. Finish with a line containing only a single dot (.).")
    lines = []
    while True:
        try:
            line = input("> ")
        except EOFError as error:
            raise ValueError("Release notes input ended unexpectedly") from error
        if line == ".":
            break
        lines.append(line)
    return "\n".join(lines).strip()



def remote_preflight(code, checksum):
    """Read-only inspection of the release target; never uses sudo."""
    remote = r'''set -eu
root=/opt/updates-site/client
code=__CODE__
sha=__SHA__
test -d "$root" && test -d "$root/apks"
test -f "$root/alpha.json" && test ! -L "$root/alpha.json"
python3 - "$root/alpha.json" "$code" <<'PY'
import json,sys
with open(sys.argv[1], encoding="utf-8") as f:
    current=json.load(f)
old=current["versionCode"]
new=int(sys.argv[2])
if type(old) is not int or old >= new:
    raise SystemExit("Preflight refused: live version is not lower than candidate")
print("LIVE_VERSION:", old)
PY
target="$root/apks/sanctifi-$code.apk"
test ! -L "$target" || { echo "Symlink APK target" >&2; exit 1; }
if test -e "$target"; then
  test -f "$target"
  test "$(sha256sum "$target" | cut -d' ' -f1)" = "$sha" || { echo "Conflicting APK" >&2; exit 1; }
  echo "APK_TARGET: matching existing file"
else
  echo "APK_TARGET: absent"
fi
current=$(python3 -c 'import json; print(json.load(open("/opt/updates-site/client/alpha.json"))["versionCode"])')
backup="$root/alpha-$current.backup.json"
test ! -L "$backup" || { echo "Symlink backup" >&2; exit 1; }
if test -e "$backup"; then
  test -f "$backup" || { echo "Backup is not a regular file" >&2; exit 1; }
  cmp -s "$root/alpha.json" "$backup" || { echo "Conflicting backup" >&2; exit 1; }
  echo "BACKUP: matches current live manifest"
else
  echo "BACKUP: absent"
fi
echo "PREFLIGHT_OK"
'''
    command = "sh -c " + shlex.quote(remote.replace("__CODE__", str(code)).replace("__SHA__", checksum))
    result = subprocess.run(["ssh", REMOTE, command], text=True, check=True,
                            capture_output=True)
    if "PREFLIGHT_OK" not in result.stdout.splitlines():
        raise RuntimeError("Remote preflight did not report success")
    print(result.stdout, end="", flush=True)




def cleanup_remote_scratch(scratch):
    """Best-effort cleanup; never hide the original transport error."""
    try:
        result = subprocess.run(["ssh", REMOTE, f"rm -rf -- {scratch}"],
                                check=False)
    except OSError as error:
        print(f"WARNING: remote scratch cleanup could not run for {scratch}: {error}",
              file=sys.stderr, flush=True)
        return False
    if result.returncode != 0:
        print(f"WARNING: remote scratch cleanup failed for {scratch} "
              f"(SSH exit {result.returncode}); manual inspection may be needed",
              file=sys.stderr, flush=True)
        return False
    return True

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--code", type=int, required=True)
    parser.add_argument("--manifest", type=Path, help="Reviewed candidate JSON on Futwick")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare-manifest", action="store_true", help="Interactively create a local candidate only")
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--remote-preflight", action="store_true", help="Read-only SSH inspection; no sudo or writes")
    mode.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    code = args.code
    if code < 1 or code > 2100000000:
        parser.error("Invalid versionCode")
    if args.manifest is None:
        parser.error("--manifest FILE is required")
    if args.prepare_manifest:
        prepare_manifest(code, prompt_release_notes(), args.manifest)
        return
    apk = ARCHIVE / f"sanctifi-{code}.apk"
    if not apk.is_file() or apk.is_symlink():
        parser.error(f"Missing or symlink APK: {apk}")
    checksum = digest(apk)
    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    manifest_check(data, code, checksum)
    print(f"Release: {code}; APK: {apk}; SHA-256: {checksum}", flush=True)
    print(f"Manifest: {args.manifest}; remote: {REMOTE}:{ROOT}/alpha.json", flush=True)
    if args.dry_run:
        print("LOCAL DRY RUN ONLY: no SSH, transfer, sudo or publication attempted.")
        return

    if args.remote_preflight:
        remote_preflight(code, checksum)
        return

    # The privileged program is supplied as a quoted SSH command, never loaded
    # from a user-writable file on the remote host. SSH/sudo prompt interactively.
    remote_script = r'''set -euo pipefail
umask 022
root=/opt/updates-site/client
code=__CODE__
sha=__SHA__
scratch=__SCRATCH__
trap 'rm -rf -- "$scratch"' EXIT
test -f "$scratch/apk" && test -f "$scratch/manifest.json"
test "$(sha256sum "$scratch/apk" | cut -d' ' -f1)" = "$sha"
python3 - "$scratch/manifest.json" "$code" "$sha" <<'PY'
import json,sys
p,c,h=sys.argv[1],int(sys.argv[2]),sys.argv[3]
d=json.load(open(p))
assert type(d) is dict and set(d) <= {'schemaVersion','versionCode','versionName','apkUrl','sha256','releaseNotes'}
assert d['schemaVersion']==1 and type(d['versionCode']) is int and d['versionCode']==c
assert d['versionName']=='8.1.8' and d['sha256']==h
assert d['apkUrl']==f'https://updates.sancti.fi/client/apks/sanctifi-{c}.apk'
PY
current=$(python3 -c 'import json; print(json.load(open("/opt/updates-site/client/alpha.json"))["versionCode"])')
test "$current" -lt "$code" || { echo "Refusing non-increasing live version" >&2; exit 1; }
target="$root/apks/sanctifi-$code.apk"
backup="$root/alpha-$current.backup.json"
if test -L "$target" || test -L "$backup" || test -L "$root/alpha.json"; then
  echo "Refusing symlink publication destination" >&2
  exit 1
fi
if test -e "$target"; then
  test "$(sha256sum "$target" | cut -d' ' -f1)" = "$sha" || { echo "Conflicting APK" >&2; exit 1; }
fi
if test -e "$backup"; then
  cmp -s "$root/alpha.json" "$backup" || { echo "Conflicting backup" >&2; exit 1; }
fi
if ! test -e "$target"; then
  install -o root -g root -m 0644 "$scratch/apk" "$target"
fi
test "$(sha256sum "$target" | cut -d' ' -f1)" = "$sha"
if ! test -e "$backup"; then
  cp -p -- "$root/alpha.json" "$backup"
fi
tmp=$(mktemp "$root/.alpha.json.XXXXXXXX")
trap 'rm -f -- "$tmp"; rm -rf -- "$scratch"' EXIT
install -o root -g root -m 0644 "$scratch/manifest.json" "$tmp"
cmp -s "$scratch/manifest.json" "$tmp"
# Recheck live manifest before atomic promotion; external changes must not be overwritten.
cmp -s "$root/alpha.json" "$backup" || { echo "Live manifest changed" >&2; exit 1; }
mv -T -- "$tmp" "$root/alpha.json"
echo "REMOTE_PROMOTED:$code:$sha"
'''
    # Revalidate the live server immediately before requesting publication approval.
    # A failed preflight must stop before scratch creation or file transfer.
    remote_preflight(code, checksum)
    if input("Type PUBLISH to authorise production changes on Obscurity: ").strip() != "PUBLISH":
        print("Cancelled; nothing transferred or published.")
        return
    # Scratch name is chosen on remote by mktemp, avoiding races and shell injection.
    proc = subprocess.run(["ssh", REMOTE, "mktemp -d /tmp/sanctifi-publish.XXXXXXXX"],
                          text=True, capture_output=True, check=True)
    scratch = proc.stdout.strip()
    if not re.fullmatch(r"/tmp/sanctifi-publish\.[A-Za-z0-9]+", scratch):
        raise RuntimeError("Unexpected remote temporary directory")
    script = remote_script.replace("__CODE__", str(code)).replace("__SHA__", checksum).replace("__SCRATCH__", scratch)
    try:
        run("scp", str(apk), f"{REMOTE}:{scratch}/apk")
        run("scp", str(args.manifest), f"{REMOTE}:{scratch}/manifest.json")
        # Quoted bash -c argument: sudo authenticates via the remote SSH TTY,
        # with no user-writable script to execute and no stdin collision.
        command = "sudo bash -c " + shlex.quote(script)
        # Deliberately blocked until mocked transport and remote preflight tests pass.
        raise RuntimeError("Remote promotion disabled pending transport/preflight validation")

    finally:
        cleanup_remote_scratch(scratch)
    print("Remote promotion reported success. Verify public HTTPS before declaring publication complete.", flush=True)
    import urllib.request
    with urllib.request.urlopen(f"{BASE}/alpha.json?verify={code}", timeout=30) as response:
        public = json.load(response)
    manifest_check(public, code, checksum)
    with urllib.request.urlopen(f"{BASE}/apks/sanctifi-{code}.apk", timeout=120) as response:
        h = hashlib.sha256()
        for block in iter(lambda: response.read(1024 * 1024), b""):
            h.update(block)
    if h.hexdigest() != checksum:
        raise RuntimeError("PUBLIC APK CHECKSUM MISMATCH: inspect server immediately")
    print(f"PUBLICATION VERIFIED: {code}, {checksum}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, AssertionError, subprocess.CalledProcessError) as error:
        print(f"PUBLICATION FAILED: {error}", file=sys.stderr)
        sys.exit(1)
