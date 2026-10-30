# Issue 047: automatic Android versionCode allocation foundations

Date: 2026-10-30. Branch: `issue-047-automatic-allocation`, based on
`sanctifi` at `983223a49afd86a6bb8d946988430b2ba818014f`.
This implements allocation/preparation foundations only. Issue 047 remains open;
end-to-end publishing and physical acceptance are outstanding.

## Investigation before implementation

Read Issue 047 and its reopening comment, the complete release CLI, its three
Node suites, release publishing runbook and ledger. Inspected app.json,
app.config.js, eas.json, create-release.js, Gradle/signing plugin fixtures and the
Futwick delivery-audit diary. The cloud initially contained upstream `master` on
branch `work`; fetched the requested base and created a dedicated feature branch
without discarding work. The working tree was clean before switching.

Observed safeguards:

- Preflight requires explicit new/keep intent, clean Git, matching Expo/native
  package/code/versionName, permanent signing configuration, local SDK/JDK and
  dependencies. New intent requires a Reserved ledger row and matching private
  reconciliation attestation; it does not allocate. Keep intent verifies a retained
  artifact/provenance and rejects differing rebuild bytes.
- Existing verification uses apksigner/aapt2, pins the single permanent certificate
  and package, checks actual versions and hashes bytes. Staging snapshots APKs,
  promotes exclusively by hard link and refuses differing bytes or provenance.
- Release directories must resolve outside Git. Preparation locks the archive,
  fingerprints native inputs, preserves old output and private logs, runs quality
  gates before Gradle, checks source stability and emits a verified manifest
  candidate. It does not remotely publish or claim phone acceptance.

The committed app.json has Android code 80000188, versionName 8.1.8 and separate
sancti.fi version 0.1.1. app.config.js patches ProGuard plugin options and preserves
version metadata. Actual Gradle builds use ignored android/app/build.gradle;
there is no native Android project in this cloud checkout to inspect. Its parser,
fixtures and runbook establish the expected literal defaultConfig code, but do
not establish the current Futwick file's bytes. EAS autoIncrement and inherited
create-release.js are separate, unsuitable allocation paths for this workflow;
the latter derives code from iOS build metadata and can push tags. Neither ran.

The ledger previously stopped at owner-confirmed 80000188 on 26 October. The
30 October Issue 054 delivery audit records Futwick's deliberate uncommitted
app.json change to 80000189, left outside its push. The owner now supplies:

| Artifact | Code | SHA-256 | Size |
| --- | --- | --- | --- |
| Published Alpha, Lyrics Without Leaving | 80000189 | `682f11bfc2bd08f32359f23eb3581e5d8c38ec64f5e1e530a10cc46cdd5178d4` | 79,568,030 bytes |
| Later Issue 024 candidate, never published | 80000189 | `c728b1117c09da1aacad785c2d1b4b46cd9ea3283e2c8b4084e6a5c41a08f261` | 79,570,830 bytes |

The latter was reportedly built approximately 2026-10-27 19:53 UTC and tested on
device. These are owner reports, not fresh cloud artifact checks. Published bytes
permanently own 80000189. Added that historical identity and the rejected collision
to the ledger without inventing build-source revisions or APK signer observations.
Old high-water statements remain explicitly historical.

Searched the checked-out repository for 80000190: no pre-existing occurrence.
Fetched all currently advertised branch heads and searched their app.json/ledger
histories for additions/removals of 80000190: none found. GitHub's releases endpoint
returned an empty list. The connector did not support the repository-wide
Actions artifacts endpoint; the installed gh CLI fallback returned total_count 0. No repository
observation establishes global availability. **80000190 remains only proposed.**

## Decisions and implementation

Extended scripts/android-release.js, keeping one CLI and no new dependencies:

1. `allocate --history FILE --dry-run` reconciles a fresh complete owner inventory,
   ledger, durable reservations, configured codes and verified local APK archives.
   It proposes max + 1 (at least above permanently occupied 80000189). It writes
   nothing. Authoritative history must identify actual Futwick/server evidence,
   the exclusive allocation directory and a check within the last 24 hours.
2. `allocate --execute --expect-code CODE` rechecks under the shared lock, requires
   approval of the exact proposal, persists an exclusive private schema-v2
   reservation and appends its public Reserved row. Explicit `--initialize` is
   required only for the first reconciled private registry. Lost/malformed history
   does not silently start a new sequence. Reservations survive ledger failure.
3. `synchronise --allocation FILE --dry-run|--execute` applies only the two code
   edits, preserving versionName and semantic version. Original/target hashes
   reject unrelated local edits, and support recovery if only one file changed.
   No Expo prebuild/regeneration is introduced. Superseded/withdrawn/attempted
   reservations cannot synchronise. Unsupported native overrides fail closed.
4. Schema-v2 reservations integrate with existing preflight/prepare. An exclusive
   one-attempt marker is fsynced before any checks/build; failures cannot reuse
   that allocation. Existing manual schema remains compatible. Keep, verify,
   stage, validate, pinned signing checks and immutable provenance schema remain.

A single trusted local registry is simpler than a distributed service, but does
not coordinate other hosts or manual allocators. The owner must stop those and
confirm completeness. Importing authoritative inventory is still a manual audit;
this phase automates number selection/reservation/version edits, not server
inventory collection. The 24-hour limit is a freshness bound, not authentication
or proof of a complete server audit. Owner evidence must be retained privately.

Differing distributable APK hashes for one code block allocation. An exact hash
explicitly reconciled as rejected/non-distributable can coexist with the published
hash, supporting this known historical collision. Its code remains occupied.
Invalid partial APKs require diagnosis/quarantine and retained allocation evidence.
No rejected APK is relabelled or made publishable.

## Validation

Release-tool/signing fixtures run with synthetic bytes and simulated SDK/Gradle
responses only. They cover next selection, configured/published/reserved codes,
collisions, rejected historical bytes, absent/contradictory/stale inventory,
concurrent processes, failed and abandoned reservations, ledger-write failure,
synchronisation and interruption recovery, one-attempt builds, successful staging,
read-only dry-run, private-error redaction and existing command compatibility.

Initial sandboxed runs could not reliably capture child CLI output. Re-running
through the approved execution environment passed the existing 132 cases:
130 passed, 2 signing runtime cases skipped (prerequisites absent). These skips
are not signing-runtime verification. Final combined results are recorded below.
Final combined run: **163 tests, 161 passed, 2 skipped, 0 failed**.
TypeScript `tsc --noEmit` passed. Full Jest passed: **646 suites, 11,328 tests**;
2 suites / 8 tests skipped. Intl, translation, ProGuard and module-inventory
validators passed; translations reported 2,234 missing-key warnings awaiting
Crowdin sync. `git diff --check` passed. No native build was run.

## Futwick operation and outstanding work

Follow the automatic allocation section in docs/android-release-publishing.md:
reconcile all archives, failed attempts and server history into a private inventory;
run allocate dry-run, approve its exact code for execution, synchronise dry-run
then execute, review/commit generated public metadata and run prepare dry-run.
A real build needs separate approval; failed attempts require the next allocation.
Backup the complete private registry and never delete reservations/attempt markers.

Still requires Futwick/server access and owner decisions:

- Inspect actual ignored Gradle files, signing setup, uncommitted app.json 80000189,
  all release archives/unstaged/failed builds and private reservation history.
- Audit obscurity's full immutable archive, manifests, outstanding allocations,
  privileges and retained publication evidence; verify published 80000189 bytes
  through the established full-download checks. No server/VPN/signing credential
  is configured in this cloud task, and updates.sancti.fi is outside its allowed
  HTTP destinations. No live publication check was attempted or claimed.
- Confirm exclusive allocation host, complete evidence and authoritative availability
  before approving 80000190. Restore any lost registry rather than reinitialising.
- Review the one-attempt policy (even failed quality checks consume the code),
  rejected-artifact dispositions and retained evidence before operational use.
- Build/verify/stage a new approved Issue 024 APK on Futwick, then phone acceptance.
  Remote publishing/approval/promotion/rollback automation remains later work.

No real code was reserved, no version metadata changed, no APK was built, signed,
uploaded or published. Futwick-local files were not accessed or altered. No APKs,
credentials, private inventories or allocation records are included in the commit.

## Review follow-up: Carl's 30 October review of draft PR 59

Read Issue 047 (including its reopening comment), current draft PR 59 and the
[review](https://github.com/evilnick26/substreamer/pull/59#pullrequestreview-5716697394).
The two concerns were assessed against the implementation, not treated as settled
solely because they appeared in review.

### Confirmed preflight/preparation race

Before this follow-up, `prepare` performed preflight without `.prepare-lock`, then
acquired the lock and only validated the private record's structure before making
the attempt marker. A completed allocation between those operations could make
the old code superseded. Source checks alone are insufficient: a private newer
reservation left without its ledger row after an interrupted allocation does not
change Git/native source state. Changed private evidence also evades those hashes.

Four focused regressions were run against an isolated copy of the pre-review CLI
at `16d31541`: orphan newer reservation and changed private evidence, each inserted
before lock acquisition and during quality checks. All four failed as expected:
the old implementation reached the simulated Java/check or build callback rather
than rejecting invalid readiness. No actual Java/Gradle build or signing occurred.

Changes:

- Schema-v2 preflight now reads/validates the private registry and rejects a newer
  reservation even if it has no ledger row. Its own public row must be uniquely
  Reserved, match the private reservation identity and have no APK bytes. Metadata
  must still equal the reserved target bytes. Allocation contents and ledger bytes
  are fingerprinted in the preparation report.
- After acquiring the shared lock, preparation repeats full preflight and compares
  source, expected/semantic metadata, directory/tools, allocation/evidence contents,
  ledger contents and existing artifact state with the initial report. Failure
  releases the lock before tests, tools, evidence directory or attempt creation.
- After quality checks, immediately before the build callback, preparation repeats
  that validation while retaining the lock. Only its exact owned attempt marker is
  accepted. Superseded/withdrawn/changed allocations, changed metadata or an occupied
  archive destination stop the build. A failure after the attempt began preserves
  the burned attempt and existing diagnostic/previous-output recovery behavior.

Nineteen new regression cases cover both checkpoints for orphan/newer reservations,
changed private evidence, withdrawn/wrong/duplicate ledger rows, app/native edits
and an intervening archive collision; a completed competing allocation in another
Node process between preflight and the lock; and removed/replaced attempt markers.
Existing dry-run, successful preparation, keep-version and staging tests remain.
Allocation, synchronisation and preparation share the lock, held throughout
preparation. This is not
protection against manual/remote writers ignoring that lock or disconnected
allocation hosts; their coordination remains an operational prerequisite.

### Inventory bootstrap and the intended automatic workflow

Carl's second concern also holds: although the same fresh inventory can cover
several local reservations in one exclusive window, the current 24-hour input
contract still imposes manual inventory renewal later. This is a Phase 1 limitation,
not completion of Issue 047. Refreshing just the timestamp is not acceptable.

Expanded the runbook with an explicit Phase 2 design. Human bootstrap decisions
identify all historical archive/attempt records, establish allocation authority and
resolve the 80000189 published/rejected collision. Unrecorded history and unknown
original source revisions cannot be inferred from a checksum. Those reviewed
historical decisions form a persistent baseline, not a new hand-authored JSON
exercise for every release. New unexplained conflicts require human reconciliation.

Routine collection must be automated by the existing CLI: scan configured local
archives/reservations/attempts; inspect the full authenticated server archive,
channel manifests and in-flight state; compute/verify checksums and public APKs;
retain timestamped observations; merge the approved historical baseline; and feed
a machine-generated inventory into allocation. Missing access, incomplete reads,
stale observations or conflicting bytes must fail closed. Refresh and reservation
need an agreed exclusive protocol; even a freshly generated snapshot is not a lock.
The later publish flow must automate transfer/checksum/manifest promotion/rollback
while retaining explicit owner publication approval and physical acceptance.

The current schema can accept machine-generated `checkedAt`, evidence references,
paths and occupied/rejected artifact records without changing the allocator.
However source strings are not authenticated evidence. The Phase 2 collector must
validate its own source observations before claiming completeness/exclusivity;
structured source/snapshot/coordination metadata may need a versioned extension.
No live collector or fictional server commands are added in this follow-up.

Remaining owner decisions: complete archive scope and bootstrap dispositions;
actual scoped server read access/commands; whether Futwick remains the sole
allocation authority (recommended by the existing simple local design) or another
shared coordination mechanism is needed. Phase 2 acceptance must demonstrate a
repeat release without hand-edited inventory fields or manual transfer/checksum
choreography. These decisions do not authorise real 80000190 allocation now.

### Follow-up validation

Release/signing Node fixtures: **182 tests, 180 passed, 2 skipped, 0 failed**.
The two signing runtime skips retain their prerequisite limitations. TypeScript
`tsc --noEmit` passed. Full Jest: **646 suites / 11,328 tests passed**, with
2 suites / 8 tests skipped. `git diff --check` passed. No app.json/native
version metadata was changed; all allocations/build callbacks in regression tests
used temporary synthetic fixtures. PR 59 remains draft; no merge, real reservation,
Android build, signing, upload or publication is authorised or performed.
