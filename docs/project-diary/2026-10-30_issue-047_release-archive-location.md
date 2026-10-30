# Issue 047: permanent release archive location

Date: 2026-10-30. Branch: `issue-047-release-archive-location`, based on
`sanctifi` at `a5388ed2` (the merge of PR 59). Configuration/storage safety only;
Issue 047 remains open and no real release execution is authorised.

## Investigation and supplied Futwick evidence

Read the current release CLI, release/storage-related fixtures, publishing runbook
and AGENTS.md. The old default was derived from the process home directory:
`~/.local/share/sanctifi/releases`. Allocation, synchronisation and preflight
resolved it through the outside-Git check. Staging could recursively create its
directory before checking storage; preparation could also create its archive.
No mount check existed, so a directory left underneath an unmounted volume could
be mistaken for the real archive.

The owner reports migration from `/home/evilnick/.local/share/sanctifi/releases`
to **`/media/data/Complete/Sanctifi/Releases`**, verified by `diff -qr` with no
differences. The new archive holds the 80000186 and 80000187 APKs and provenance
sidecars. The original is intact for temporary manual recovery. No allocation
registry has yet been initialised, and 80000190 remains proposed/unallocated.
These are owner-reported completed actions; no migration was repeated in cloud.

Requested read-only mount evidence before settling the production rule. The owner
supplied the following Futwick results during this task:

```text
findmnt --mountpoint /media/data --output TARGET,FSTYPE,OPTIONS
TARGET      FSTYPE OPTIONS
/media/data ext4   rw,relatime

findmnt --target /media/data/Complete/Sanctifi/Releases --output TARGET,FSTYPE,OPTIONS
TARGET      FSTYPE OPTIONS
/media/data ext4   rw,relatime
```

This establishes the actual mount point and covering filesystem as `/media/data`,
mounted read-write. VeraCrypt backing is confirmed by the owner, not established
by the ext4 label. The cloud has no Futwick/VPN access or mounted copy of this
volume; it cannot independently inspect live mountinfo, archived bytes or permissions.

## Implementation and rationale

Changed the single default constant in scripts/android-release.js to the permanent
absolute path. No environment/configuration framework or home-directory fallback.
An explicit `--directory` remains available for tests and deliberate reviewed use.

Added one shared directory/storage guard used by stage, allocation,
synchronisation and preflight/preparation. Existing physical-path Git exclusion
remains, and staging now also uses it before any creation. Its original direct
symlink-directory rejection and exclusive APK/sidecar handling remain intact.

For paths requested under `/media/data`, or physical override targets resolving
there, the guard parses `/proc/self/mountinfo` from the process's Linux mount
namespace. It requires:

- Exactly one `/media/data` mount and one process root mount, with distinct
  filesystem device identities. This rejects a system-drive bind mount without
  pinning a device name or filesystem/encryption implementation.
- The deepest mount covering the physical destination to be on the same filesystem
  as `/media/data`, with both mounts reporting writable mount/superblock options.
- A consistent parent-mount hierarchy for all covering entries. Ambiguous stacked
  mounts, hidden mounts under an overmounted ancestor and differing nested
  filesystems fail closed. Irrelevant nested mounts do not block the archive.

The parser handles optional mount fields and Linux octal space/tab/newline/backslash
path escapes. It refuses malformed/unreadable mount information rather than
assuming availability. It does not execute findmnt, mount or decryption commands.
The exact `/media/data` rule follows the owner's observed mount arrangement;
it does not claim cryptographic identity of an arbitrary replacement volume.

Checks happen before archive/lock creation or mutation, with repeated validation
after asynchronous allocation/staging assessment and through preparation's existing
locked/pre-build checks. A missing mount fails even if the underlying archive
directory exists. No automatic fallback, archive recreation on system storage,
registry reset, or copying of old recovery files occurs.

Temporary overrides outside the production mount tree do not inspect production
mountinfo and never select the production archive. An alias into production must
pass the guard; a production path resolving outside the mount tree is rejected.
All overrides remain outside Git. Existing allocation reconciliation, registry and
attempt locking, signature/checksum verification and provenance formats remain.

## Validation

Focused fixtures cover the fixed default, missing mount with/without an existing
archive directory, valid writable storage, system-drive bind mounts, read-only
mounts/superblocks, escaped/nested/hidden/stacked mount paths, malformed/unavailable
mountinfo, deliberate temporary overrides, physical aliases and no fallback.
Mutation methods are guarded in failure tests to prove no archive, lock, registry,
attempt, staging or metadata write occurs when initial mount verification fails.
No test writes into the real production path; APKs and SDK outputs are synthetic.

One existing diagnostic test implicitly used the former default without providing
an archive. It now supplies an explicit temporary `--directory`, retaining all
missing-attestation and ledger assertions. Help remains read-only and requires no
mounted storage. Full validation results are recorded after execution below.

Validation results:

- Release/signing Node suites: **204 tests, 202 passed, 2 skipped, 0 failed**.
  The two existing signing-runtime skips have absent prerequisites; they do not
  establish signing-runtime verification. The new storage file contributes 22 cases.
- TypeScript `tsc --noEmit`: passed.
- Full Jest: **646 suites / 11,328 tests passed**, with 2 suites / 8 tests skipped.
- `git diff --check`: passed.
- A read-only call to the default guard using the cloud's actual Linux mountinfo
  rejected unavailable `/media/data` as expected; no fallback directory was created.

## Completed and outstanding work

Completed: owner-reported archive migration and mount arrangement confirmation;
code/default guard, regression fixtures and release runbook/recovery documentation.
No existing historical records or archived APKs/sidecars were edited.

Before operational use on Futwick, run the new read-only guard/preflight against
actual `/proc/self/mountinfo`, verify permissions and unchanged archived sidecars,
and confirm the mounted storage supports the existing hard-link staging contract.
Test unavailable-storage behavior in a controlled readiness check when no release
process is active; do not unmount during allocation/staging/build/preparation.
Mountinfo is an availability snapshot, not a lock against an administrator's forced
unmount/remount. Recovery is to mount the existing VeraCrypt volume, inspect the
existing archive/registry and retry preflight, never create a second registry or
fall back to the old home archive. No stale registry is created by this change.

No versionCode was allocated or reserved, no `.allocations` registry was initialised,
no app.json/native version metadata was modified, and no APK was built, signed,
uploaded, published or promoted. Neither archive was moved, modified or deleted.

## Review follow-up: retain the initially verified mount identity

The owner asked whether repeated checks should compare mount identity. Confirmed:
they previously accepted any distinct writable filesystem satisfying the layout,
so a replacement volume could pass a later check. Added a small invocation-local
baseline of the `/media/data` mount ID, major:minor identity and mounted root;
rechecks must match. The covering mount ID/device/root/target is also compared to
detect a changed same-filesystem bind mount. Allocation shares the baseline across
assessment/locking, synchronisation across its checks, and preparation across
preflight, locking, pre-build validation and staging. No global cache, persisted
volume pin, mount lock, device-name requirement or encryption check is introduced.

Added focused fixtures for replacement filesystems, remounts of the same device,
changed mounted roots, changed covering mounts, harmless option/source-label
changes and allocation's lock-to-assessment boundary. All use synthetic mount
observations and mocked production writes; no real registry is initialised.

Residual limits: snapshot checks cannot eliminate check-to-use races, transient
changes undone between observations or kernel ID reuse. A new invocation establishes
its own baseline and cannot authenticate a replacement volume. Keep the correct
VeraCrypt volume mounted throughout operations; actual Futwick readiness remains
pending. No allocation, APK build/signing/publication or archive modification was
performed by this follow-up.

Follow-up validation: release/signing suites **210 cases, 208 passed, 2 skipped,
0 failed**; focused storage suite **28 passed**; TypeScript passed; full Jest
**646 suites / 11,328 tests passed**, 2 suites / 8 tests skipped. `git diff --check`
passed. Existing signing-runtime skips retain their prerequisite limitations.
