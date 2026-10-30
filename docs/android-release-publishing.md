# sancti.fi Android releases: static manifests and manual publication

## Scope and current status

The manual publication procedure below remains available. The Stage 1 local CLI
can run an explicitly approved Gradle release build; preflight and dry-run never
build. The allocation/synchronisation commands below can reserve codes and update
versionCode explicitly. It never regenerates native files, uploads files, changes
channel pointers, installs updates or changes the client updater.
Nick's hosting investigation confirmed that the existing Caddy container serves
`https://updates.sancti.fi/` from host root `/opt/updates-site`, and that the website
responds successfully over HTTPS. Nick subsequently confirmed the first live
Alpha publication on **24 October 2026**: `alpha.json` and the immutable
`sanctifi-80000186.apk` both return HTTP/2 200, and the complete public APK download
matches the checksum on futwick and the host. These are owner-reported deployment
results, recorded in the [Alpha publication diary](project-diary/2026-10-24_issue-022_alpha-publication.md),
not checks repeated or a deployment performed by this documentation update.

On **25 October 2026**, Nick confirmed publication and end-to-end acceptance of
Alpha **80000187**, versionName **8.1.8**, built from
`3010cf5ca0a0443e99fe1c644666b747dd927506`. APK publication preceded atomic manifest
promotion; the public HTTPS download checksum and the manifest's advertised build
were verified. Manual discovery, browser download, Android in-place installation
and the subsequent Up to Date result passed, with Favourites/offline media and
online/offline playback preserved. Automatic discovery was observed after several
relaunches; consistent first-launch timing remains a follow-up, not a guarantee.
See the [acceptance diary](project-diary/2026-10-25_issue-038_alpha-update-build.md)
and [release ledger](android-release-ledger.md) for the exact artifact identity and
results. The larger Settings tap target and sancti.fi human-version migration are
also future work; none is implemented by this documentation.

Public layout:

```text
https://updates.sancti.fi/client/alpha.json
https://updates.sancti.fi/client/beta.json
https://updates.sancti.fi/client/release.json
https://updates.sancti.fi/client/apks/sanctifi-<versionCode>.apk
```

The approved client distribution directory is `/opt/updates-site/client/`.
Existing `index.html`, `assets/`, `files/` and `quickstart/` content under the
hosting root must remain untouched. The verified directories are `root:root`,
mode `755`; published files are `root:root`, mode `644`. The successful manual
procedure transfers to `/tmp/` on obscurity and uses privileged installation into
the publication directory. Future publishers need suitable scoped privileges;
this does not establish direct unprivileged write access. Do not change ownership
or permissions of the whole site or use broad world-writable permissions.

This contract supersedes the earlier `https://sancti.fi/updates/` layout; the
validator accepts only the new exact APK URL. There are no alternate allowed
hosts or runtime URL configuration options. The first Alpha publication confirms
the client mapping, reported permissions, complete public APK download and a
successful same-directory manifest rename. Cache policy and failure/concurrency
behaviour still need separate consideration. Existing Caddy served the files
without configuration changes. No remote operations are performed by this update.

Each JSON URL is a channel pointer. Channel is not an APK property. Promote the
same artifact by changing a manifest only: never rebuild, resign or duplicate it.
Alpha is published; Beta/Stable remain unavailable (both returned 404 on
24 October), not dummy manifests, until approved for promotion. Demonstrate multiple-channel references in tests or
staging without inadvertently advertising a production Stable release.

The first published APK (24 October) is **79,545,302 bytes**, package
`fi.sancti.client`, versionCode `80000186`, versionName `8.1.8`. Its SHA-256 is
`42f7945d52433a993765a42fb3416e65e996507bfce2f635f4958877673d222f`.
The first Alpha manifest (297 bytes) passed local schema validation and references
that artifact, version metadata and checksum. Preserve this APK's bytes and metadata.
The Alpha pointer recorded on 25 October offered `sanctifi-80000187.apk` (79,561,254 bytes),
with SHA-256
`95e388228dc644a4fbca069ca205a856f376dab534b61123cf13445efa9ed3cc`.
Its actual versionName remains `8.1.8`; prior immutable artifacts remain unchanged.

## Manifest contract: schemaVersion 1

Required fields:

| Field | Rule |
| --- | --- |
| `schemaVersion` | Integer `1`; reject unsupported versions. |
| `versionCode` | Integer from 1 through 2100000000; order Android updates using this value only. |
| `versionName` | Nonempty string, at most 128 characters, without surrounding whitespace; exactly match the APK. |
| `apkUrl` | Exactly `https://updates.sancti.fi/client/apks/sanctifi-<versionCode>.apk`; no query, fragment, userinfo, alternate host/port or encoded path variants. |
| `sha256` | The APK bytes' SHA-256: exactly 64 lowercase hexadecimal characters. |
| `releaseNotes` | Optional plain-text string, at most 4000 characters; render as text, never executable markup. |

Reject malformed JSON, arrays, null, missing fields, wrong types and unknown
fields. Do not coerce strings into numbers. Optional release notes do not affect
release identity. No channel/platform/signing secrets belong in the manifest.
Schema changes must be coordinated with Issue 023 before publication.

The existing `80000186` APK's versionName is **8.1.8**, regardless of the separate
Settings label. Its manifest must use `8.1.8`. Obtain the real checksum from that
APK; do not publish an example or invent a checksum. A correctly shaped manifest
does not establish a valid signature or an available download.

## Three distinct checks

1. **Structure:** `node scripts/android-release.js validate /path/to/alpha.json`
   checks the JSON contract only. It reports that artifact/live hosting checks
   have not run. It does not fetch URLs.
2. **Local APK:** staging or `validate --apk ... --build-tools ...` uses Android
   SDK `apksigner verify --verbose --print-certs` and `aapt2 dump badging`, then
   computes the file checksum. It requires `fi.sancti.client`, one signer matching
   the permanent certificate, and valid actual APK version metadata. Matching a
   manifest additionally requires exact versionCode, versionName and checksum.
3. **Live HTTPS:** after upload, download complete responses from the real public
   URLs and apply the local checks to those downloaded files. Neither structure
   validation nor a successful local stage proves public hosting works.

The expected public certificate SHA-256 is
`a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c`.
Checksums help detect corruption; they do not replace Android signature checks or
independently authenticate a manifest fetched from the same host.

## Local APK staging on futwick

Gradle's standard output remains
`android/app/build/outputs/apk/release/app-release.apk`. Do not rename it in
Gradle. Default local staging is **`/media/data/Complete/Sanctifi/Releases/`**, outside
the checkout and therefore outside Git. Keep any `--directory` override outside
Git too. No APKs or private material are committed.

After an approved build, from the repository root with the supported JDK set:

```bash
node scripts/android-release.js stage \
  android/app/build/outputs/apk/release/app-release.apk \
  --build-tools "$ANDROID_HOME/build-tools/36.0.0" \
  --source-revision FULL_40_CHARACTER_SOURCE_COMMIT_USED_FOR_THE_BUILD
```

Supply the actual SDK path on futwick. Record the source revision before building
and retain the build record; do not infer that an old APK came from today's HEAD.
The CLI checks that the full revision exists as a commit in this checkout. Its
relationship to the build is still a publisher attestation: the APK does not
embed a Git commit, and the tool cannot prove source provenance from its bytes.

The tool copies a snapshot to a temporary directory inside staging, verifies it,
reads its actual versionCode and creates:

```text
sanctifi-<actual-versionCode>.apk
sanctifi-<actual-versionCode>.apk.json
```

The record contains package, actual versions, public certificate digest, APK
SHA-256 and supplied source revision. It is **not** a channel manifest. The
original `app-release.apk` remains untouched. Exclusive hard-link promotion on
the same filesystem refuses overwrites atomically. Existing identical bytes and
identical provenance are a safe no-op; differing bytes or records fail. A valid
APK left by an interrupted run without its record can be restaged to complete
the record. A nonzero exit means staging is incomplete: do not publish.

The local filesystem must support hard links. The tool rejects symlink staging
destinations and cleans its own temporary files. An unsupported filesystem or
permission failure must be investigated, not worked around by overwriting files.
Keep the staging directory under trusted local ownership; immutable naming is a
publication rule, not protection against its owner's manual edits.

## Permanent archive storage on Futwick

The single authoritative local archive and future allocation registry is
**`/media/data/Complete/Sanctifi/Releases`**. Normal stage, allocate, synchronise
and prepare operations default there; there is no fallback to the former home
archive. The directory remains outside Git and private release state stays there.

The owner completed the migration from
`/home/evilnick/.local/share/sanctifi/releases` and verified it with `diff -qr`
(no differences). The new archive contains the 80000186 and 80000187 APKs and
provenance sidecars. The original remains intact for deliberate manual recovery,
not as a second active archive. No `.allocations` registry has been initialised;
80000190 is still proposed and unallocated. These are owner-reported migration
facts, not filesystem actions repeated by this change.

The owner also supplied read-only Futwick `findmnt` results: both the exact
`/media/data` mount point and the filesystem covering the release archive report
`/media/data`, `ext4`, `rw,relatime`. The volume is owner-confirmed VeraCrypt-backed
and normally mounted after startup. The guard verifies mount availability; neither
an ext4 label nor a particular device name proves encryption.

Before selecting production release storage, the CLI reads Linux
`/proc/self/mountinfo`. It requires an unambiguous mount at **`/media/data`**, on a
filesystem distinct from the process root filesystem, and read-write access at
both that mount and the deepest mount covering the resolved archive path. A
nested mount onto another filesystem, a hidden/ambiguous mount hierarchy, malformed
mount information, a read-only mount or unavailable Linux mount information stops
the operation. Bind mounts of the system-drive filesystem at `/media/data` fail.
Mount paths decode Linux's octal space/tab/newline/backslash escapes; unrelated
mounts and shared path prefixes do not count as covering the archive. Nested mounts
on the same storage are accepted only when their parent hierarchy is consistent.
No device name, encryption implementation or filesystem type is pinned.

The check applies to both requested paths under `/media/data` and resolved physical
paths, so an alias into production cannot bypass it and a production symlink cannot
escape to another drive. It runs before archive/lock creation, reservation mutation,
synchronisation and preparation, and is repeated after allocation/staging assessment
and by preparation's existing rechecks. Missing storage fails before creating a
replacement archive, registry, attempt marker or APK staging files. Read-only
preflight/dry-run also reports unavailable production storage. Independent
`verify`/`validate` of supplied local files and CLI help do not require this mount.

`--directory DIRECTORY` remains an explicit override for tests or separately
reviewed recovery. An override outside `/media/data` uses the existing outside-Git
checks without requiring the production mount, and writes only to that selected
location. Overrides physically pointing into `/media/data` retain the mount guard.
Do not use an override to the old archive to bypass a missing mount or initialise
a second registry. Temporary test archives do not read or mutate production state.

If the volume is missing, mount the existing VeraCrypt volume at `/media/data`
through the established Futwick procedure. Then check, read-only:

```bash
findmnt --mountpoint /media/data --output TARGET,FSTYPE,OPTIONS
findmnt --target /media/data/Complete/Sanctifi/Releases --output TARGET,FSTYPE,OPTIONS
```

Confirm the existing archive/sidecars and any registry are visible, then rerun
preflight. Do not run `mkdir` to reconstruct the archive while unmounted, copy
fallback files back automatically, delete the old archive, or use `--initialize`
as storage recovery. If unexpected release state appears underneath an unmounted
mount point, stop and reconcile it separately; never merge registries blindly.
Do not unmount/remount storage during a release operation: mountinfo is an
availability snapshot, not a lock against administrative or forced unmount. The
CLI does not mount/decrypt volumes or modify mount configuration.

The owner's mount layout is confirmed; executing the new guard against actual
Futwick mountinfo and reviewing archive permissions remain read-only readiness
checks before operational use. Actual staging/hard-link execution needs separate
authorisation; this change does not perform it. No real allocation/build/publication
is part of readiness validation. See the
[archive-location diary](project-diary/2026-10-30_issue-047_release-archive-location.md).

## Global build-number allocation and traceability

**Historical reconciliation, 26 October 2026:** the owner confirms that Alpha
`80000188` was tested and published on 25 October, with semantic version `0.1.1`,
actual versionName `8.1.8`, package `fi.sancti.client`, size **79,562,702 bytes** and
APK SHA-256 `b94623970de73c14da3f89d5569c272b1d1a994296f431750a24b2d1236c5e7e`.
The [ledger](android-release-ledger.md) records the owner-reported inspection and
publication evidence, deleted historical local copy and timestamp limitations.
The exact original build-source commit remains unknown; the signer was not
independently inspected during this latest reconciliation. Current configuration
commit `897f374a` is not the historical APK's source attestation.

In that historical 26 October snapshot, the owner confirmed no code above
**80000188** had been reserved, built,
attempted or distributed, establishing that global allocation high-water mark.
This does not authorise a future release or create a retrospective staging or
allocation record. For a **new** distributed artifact, separately approve a code
above every previously reserved/distributed code. Never reset the sequence, allocate
per channel, or derive it from a human-readable version. Record reservations and
failed/withdrawn releases in the [ledger](android-release-ledger.md); do not reuse
their numbers. One publisher allocates at a time. A build number need not change
per commit. Reoffering the identical verified APK, including `80000186`, and
promoting it between channels do not allocate a new number.

**Do not run `scripts/create-release.js` or its `npm run release*` aliases for
sancti.fi releases.** It derives Android code from the iOS build, would currently
produce `80000186` again, pushes tags and targets `master` for GitHub releases.
EAS `production.autoIncrement` in `eas.json` is likewise outside this manual
workflow. Neither inherited tool is modified or authorised by this PR.

## Automatic allocation and versionCode synchronisation

As of 30 October, the owner reports published Alpha 80000189 and a different,
unpublished Issue 024 candidate with the same code. The published bytes permanently
own 80000189. See the ledger for both hashes; no APK is modified here. 80000190
is proposed, **not reserved or confirmed free**. The historical 80000188 statements
above do not establish current availability.

Use one trusted allocation directory on Futwick, normally the existing
`/media/data/Complete/Sanctifi/Releases/`. Back it up, including hidden entries. Allocation
reconciles ledger rows, private `.allocations/<code>.json` reservations, every APK
recursively in that directory and the selected archives, current standard Gradle
output (if present), configured codes, and a fresh authoritative inventory. It
selects their maximum plus one, with a permanent occupied floor of 80000189.
Missing history, duplicate ledger codes, missing archives/sidecars, malformed
reservations, invalid APKs and conflicting distributable hashes stop allocation.
Local APK inventory invokes existing signature/package/metadata verification and
hashing, including during allocation dry-run. It never builds or reads signing keys.

Before initial use, the owner must reconcile Futwick's unstaged APKs, old archive
locations, failed/abandoned builds, existing allocation files and the full server
archive/reservation history. Inspect actual server inventory and all channel
manifests, not just the Alpha pointer or a 404 for the proposed filename. Retain
the server inventory/checksum evidence and verify published identity through the
established full HTTPS download checks. No remote discovery or publishing command
is added in this phase. GitHub releases or the repository ledger alone cannot
establish completeness. No exact historical SSH command is invented here.

Supply the result as a **private file outside Git**, with this contract (the
example is deliberately incomplete and will be refused):

```json
{
  "schemaVersion": 1,
  "checkedAt": "REPLACE_WITH_ACTUAL_UTC_CHECK_TIME",
  "complete": false,
  "exclusiveAllocator": false,
  "allocationDirectory": "/absolute/trusted/releases",
  "sources": {
    "futwick": "Reference to actual complete local audit and retained evidence",
    "server": "Reference to actual complete publication/archive audit and retained evidence"
  },
  "archivePaths": ["/absolute/existing/legacy-archive"],
  "artifacts": [
    {
      "versionCode": 80000189,
      "sha256": "682f11bfc2bd08f32359f23eb3581e5d8c38ec64f5e1e530a10cc46cdd5178d4",
      "state": "occupied"
    }
  ]
}
```

Use the **exact ledger hash** when assembling real evidence; include every ledger
allocation and additional known server/local code, including failed reservations.
`sha256` is a lowercase file digest, or `null` for a reservation with no APK.
`state` is `occupied`, or `rejected` for an explicitly reconciled, permanently
non-distributable artifact identified by its exact hash. The latter allows the
known rejected 80000189 candidate to coexist with the published identity; both
still occupy the code. It is not permission to reuse a rejected code. Invalid or
unverifiable partial APKs must be reconciled and quarantined outside scanned
archives, with their code retained as occupied; never delete evidence to pass.
`archivePaths` must list all existing local archives, including unstaged builds;
the standard output and selected release directory are always scanned as well.

Only set `complete: true` and `exclusiveAllocator: true` after the checks are
complete and all other allocators/manual builds/publishers are stopped. The file
must identify the real physical allocation directory and have a `checkedAt` no
more than 24 hours old. This is an owner attestation backed by retained evidence,
not proof that an unavailable host was checked. Freshness does not prevent an
external publisher racing this tool: keep that exclusive operating window open
through allocation. Later local reservations are read automatically, so the file
need not be hand-edited for each new reservation within that window.

### Initial reconciliation versus routine evidence collection

The private JSON import is a **Phase 1 bootstrap interface**, not the final release
operator experience. Today the CLI accepts a manually assembled inventory and
requires it to be fresh. That means a later allocation outside the 24-hour window
still needs a newly verified inventory until the collector is implemented. Do not
refresh only `checkedAt`, weaken completeness checks or claim that this manual step
completes Issue 047. Within one valid exclusive window, new registry reservations
are included automatically; no manual inventory edit is needed for each one.

Some historical information requires a human decision once, or after an anomaly:
identify every legacy archive and allocation record; establish the publication
server and authoritative allocator; account for failed/unpublished attempts; resolve
which differing historical APK was published and which must remain rejected. The
known 80000189 collision needs that disposition. Unknown original source revisions
must stay unknown. A tool can discover and hash existing bytes, but cannot infer
that no unrecorded private build existed or invent its provenance. Retain the
approved bootstrap baseline and its evidence rather than reauthoring that history
for every release. Reconciliation repeats if an unknown artifact, missing registry,
new publisher or contradictory record appears.

Phase 2 must add automated collection/refresh to **this same CLI**, before it can
claim the end-to-end workflow is complete. The intended sequence is:

1. Load the approved historical baseline and persisted archive/server configuration.
   Scan all configured local archives, standard output, durable reservations,
   attempt records and the public ledger. Use the existing APK verification/hash
   helpers; detect missing paths, changed historical bytes and unknown artifacts.
2. Through the established authenticated, scoped server connection, collect the
   **complete** immutable archive and any server reservation/in-flight state, not
   just the current Alpha pointer. Fetch/validate all channel manifests, collect
   server checksums and perform the required complete public HTTPS APK verification.
   Retain timestamped raw observations privately. Actual access and exact remote
   commands must first be audited on Futwick/obscurity; none is invented here.
3. Merge observed facts with the approved baseline, retaining occupied/failed codes
   and explicit rejected hashes. Compute codes, hashes, archive paths and check time
   automatically. Emit a concise pass/fail/evidence report and machine-generated
   inventory outside Git, promoting it atomically only after the complete collection
   succeeds. Failed refreshes preserve old evidence without renewing its timestamp.
   Never have the operator copy checksums into JSON. Missing
   server access, partial listings, unsupported/malformed data, stale evidence or
   contradictory bytes must fail closed, not reuse a cached attestation as fresh.
4. Before allocation, refresh/revalidate against the current registry and server
   state under the agreed exclusive allocation protocol. A collected snapshot is
   not a lock: if multiple hosts can allocate or publish, agree a shared authority
   and concurrency mechanism first. Keep the freshness limit until that replacement
   protocol has been reviewed; even a very recent snapshot can race another writer.
5. Feed the generated inventory directly to allocation/synchronisation/preparation,
   retain verified build evidence automatically and then automate the transfer,
   server/public checksum chain, candidate manifest validation and atomic promotion
   with rollback. Recheck destination collisions immediately before mutation. Keep
   explicit owner publication approval and real-device acceptance separate.

The current schemaVersion 1 inventory can be generated by a collector without a
consumer change: `checkedAt` is the actual completed collection time; `sources`
reference retained local/server evidence; `archivePaths` come from reviewed
configuration; `artifacts` contain discovered occupied codes/hashes plus approved
historical exceptions. `complete` and `exclusiveAllocator` must be set only after
the collector's checks and coordination succeed, not copied from an old file.
The allocator currently validates structure/freshness/consistency, **not** the
truth or authenticity of source reference strings. Structured per-source observations,
server snapshot/lock identity or signed provenance would require an explicitly
versioned extension if needed; the present strings are not proof of those properties.

Phase 2 acceptance must demonstrate a repeat release starting from the reviewed
configuration/baseline without hand-editing any inventory fields or running manual
SCP/SSH/checksum commands. Simulation must cover offline/partial server reads,
corrupt or unknown artifacts, stale snapshots, intervening allocations/publications
and interrupted refresh/publication. Owner decisions still needed are the complete
archive scope, server read access/commands and allocation authority, plus the policy
for new historical conflicts. This design does not authorise server access,
allocation, building or publication now.

### Phase 1 invocation on Futwick

On Futwick, after those checks, choose real absolute private paths:

```bash
SF_RELEASES=/media/data/Complete/Sanctifi/Releases
SF_HISTORY=/absolute/private/reconciled-history.json
node scripts/android-release.js allocate --history "$SF_HISTORY" \
  --directory "$SF_RELEASES" --build-tools "$ANDROID_HOME/build-tools/36.0.0" \
  --initialize --dry-run
```

`--initialize` is only for the first reconciled registry creation; omit it on
subsequent allocations. The archive must already exist, and a missing registry
without this flag fails. Never reinitialise a lost registry: restore its backup
and reconcile the ledger, archives and server. Separate registries on different
hosts or different `--directory` paths cannot coordinate; they are unsupported.
Dry-run writes nothing and shows proposed code, evidence and metadata hashes.

Only after owner approval of the exact dry-run proposal, repeat with
`--execute --expect-code PROPOSED_CODE` instead of `--dry-run`. The expected code
must still match fresh reconciliation. Execution shares `.prepare-lock` with
synchronisation and preparation, creates an exclusive, fsynced private reservation
**before** appending a Reserved ledger row, and prints its path. Concurrent calls
cannot issue the same reservation. Never remove reservations or reuse codes after
an interrupted allocation, abandoned build or rejection. A partial/malformed record
blocks allocation until evidence is recovered; a complete orphan reservation still
raises the next code. No stale lock is automatically removed.

Then synchronise explicitly, using the returned reservation path:

```bash
SF_ALLOCATION=/absolute/trusted/releases/.allocations/PROPOSED_CODE.json
node scripts/android-release.js synchronise --allocation "$SF_ALLOCATION" \
  --directory "$SF_RELEASES" --dry-run
node scripts/android-release.js synchronise --allocation "$SF_ALLOCATION" \
  --directory "$SF_RELEASES" --execute
```

This changes only `expo.android.versionCode` in app.json and the single literal
`versionCode` in the existing ignored `android/app/build.gradle`. Native code may
start stale; both receive the reserved code without prebuild. `expo.version`,
native versionName 8.1.8 and `expo.extra.sanctifiVersion` are preserved. The current
app.config.js preserves those fields; EAS autoIncrement and create-release.js
remain outside this workflow. Dynamic version overrides, duplicate declarations,
flavors/splits or unsupported native overrides require manual review. The final
APK metadata remains authoritative and is checked by existing preparation.

Allocation snapshots both original/target files privately. Synchronisation refuses
later local edits, withdrawn or superseded reservations and attempted builds. Each
file is replaced atomically; the pair is not one atomic transaction. After a crash,
rerun only if each file still matches its recorded original or target bytes. If a
`.allocation-<id>` temporary file remains, inspect it and running processes before
removing that specific temporary file. Do not discard unrelated Futwick edits.
If ledger append failed, retain the burned private reservation and reconcile its
Reserved row before proceeding; the next allocation will still skip that code.

Review and commit the generated app.json/ledger changes, retaining ignored native
changes locally, then use the existing entry point:

```bash
node scripts/android-release.js prepare --intent new --allocation "$SF_ALLOCATION" \
  --directory "$SF_RELEASES" --dry-run
# Only after separate approval for a real build:
node scripts/android-release.js prepare --intent new --allocation "$SF_ALLOCATION" \
  --directory "$SF_RELEASES" --execute-build
```

A schema-v2 registry reservation is consumable for **one preparation attempt**.
Preparation repeats full readiness checks under `.prepare-lock` before creating
the attempt marker, then again after quality checks immediately before Gradle.
The reservation must still be the newest valid private allocation (including any
orphan reservation with no ledger row); its Reserved ledger row must match its
identity; app/native files must equal its reserved targets; the archive destination
must still be unused. Source state, allocation contents, ledger contents and metadata
must match the initial preflight snapshot. The final check accepts only this run's
exact attempt marker. A pre-lock change stops before consuming an attempt; a change
after checks started stops the build and retains the consumed attempt.
An exclusive, fsynced `.attempt-<code>` marker is created before quality checks or
Gradle. Failed checks/builds and abrupt termination burn the attempt; allocate a
new code for new bytes. Existing identical artifacts still use `--intent keep`.
Legacy manually attested allocations remain accepted for compatibility, but do
not acquire these new one-attempt semantics. Do not create new manual allocations
as a workaround. Existing stage/verify/validate behavior and provenance records
are preserved. There is still no remote publication, device test or implicit owner
approval. The remaining sequence is Build -> Verify -> Stage -> Test -> Approve ->
Publish, with publication and physical acceptance separately controlled.

## sancti.fi semantic identity and deferred native migration

Version sources recorded by configuration commit `897f374a` (not historical APK build provenance):

| Identifier | Current source/value |
| --- | --- |
| Android versionCode | `app.json`, `expo.android.versionCode`: `80000188` (recorded by `897f374a`). |
| Android versionName source | `app.json`, `expo.version`: `8.1.8`; `app.config.js` preserves it. Generated native files can be stale until regeneration. The built APK is authoritative for an existing artifact. |
| sancti.fi semantic version | `app.json`, `expo.extra.sanctifiVersion`: `0.1.1`; Settings reads the resolved application configuration. |
| sancti.fi Settings build | `Application.nativeBuildVersion`: full installed build, separate from the semantic version. |
| Inherited Settings footer | `VersionFooter.tsx` reads `Constants.expoConfig.version`; its Android build label uses versionCode modulo 1000, not the full update-ordering value. |
| npm package version | `package.json`: `8.1.8`; private package metadata, not the current sancti.fi Settings source. |
| Release manifest | Must copy verified APK metadata, not the Settings string or current source configuration. |

Under Issue 043, Nick approved **`0.1.0`** as the initial sancti.fi semantic
version, with **`app.json` / `expo.extra.sanctifiVersion`** as its authoritative
source. Settings reads it from resolved Expo configuration; there is no separate
display-only version constant. MAJOR.MINOR.PATCH advances when the owner chooses
a release version, not automatically on every APK build.

Android versionCode remains the independent, globally increasing update-ordering
key. Every new distributed artifact needs a new code even if its sancti.fi semantic
version is unchanged. This UI/config patch does not allocate another Android code
or change signing, publication, the updater comparator or the manifest contract.

**Native semantic-version migration is explicitly deferred.** `expo.version`
remains `8.1.8`, so Android versionName and the inherited footer remain `8.1.8`.
Manifest versionName must still copy the verified APK's actual metadata, not the
new Settings semantic label. Both retained `80000186` and `80000187` APKs remain
`8.1.8`; advertising either as `0.1.0` would misrepresent its metadata and fail
local artifact validation.

The earlier unapproved `0.1.2`/unified-native-version proposal remains recorded in
the [Issue 022 diary](project-diary/2026-10-24_issue-022_manifest-and-staging.md).
It is not the approved Settings identity or an instruction to migrate native
metadata now. Any future native alignment requires separate approval, a newly
allocated higher Android code, actual APK verification and its own release record.
Never rebuild, relabel, resign or overwrite an existing immutable APK to perform
that migration.

## Stage 1 local release automation

One entry point, `node scripts/android-release.js`, retains the original `stage`
and `validate` commands. New commands are `preflight`, `prepare` and `verify`.
There is no remote publishing mode. Unknown/duplicate options fail.

Read-only CLI help needs no SDK configuration, allocation file or clean checkout:

```bash
node scripts/android-release.js --help
node scripts/android-release.js preflight --help
node scripts/android-release.js prepare --help
node scripts/android-release.js verify --help
```

`validate --help`, `stage --help` and `-h` are also supported. Help exits successfully
before readiness checks or tool execution; it does not build, test, sign, allocate,
stage or publish. Use help alone or `COMMAND --help`; mixing help with other
arguments is rejected. Help describes the existing syntax, including the difference
between read-only `prepare --dry-run` and an explicitly approved
`prepare --execute-build`, and the new/keep intent requirements.

Preflight diagnostics read the configured code and ledger rather than assuming a
particular latest release. They distinguish the unambiguous owner-confirmed
high-water statement, highest code in ledger rows, current Published/Reserved status,
and recorded hash/size/source metadata. Unknown or ambiguous fields remain unknown;
recorded evidence is not a fresh APK, signer or HTTPS check. Size is read only from
the published code's ledger section. These diagnostics do not replace allocation
validation: the existing minimum historical allocation floor and all reservation,
attestation, metadata and immutable-archive gates remain in force.

Read-only preparation, from a clean reviewed checkout with dependencies installed:

```bash
node scripts/android-release.js preflight --intent new --allocation /absolute/private/allocation.json
node scripts/android-release.js prepare --intent new --allocation /absolute/private/allocation.json --dry-run
```

The allocation path above is a placeholder, not an established futwick path.
Preflight/dry-run read Git and local files only: no Java, SDK, Gradle, Expo,
tests, directories, output files or signing credentials are invoked/created/read.
They return a JSON report and nonzero status for blockers, including multiple
independent diagnostics. Historical source gaps remain explicitly unknown; the
Published 80000188 ledger row cannot substitute for a future Reserved row and
allocation attestation. Current code 80000188 is already distributed and cannot
be prepared with new-artifact intent. No preflight check is relaxed for history.

Configure existing `JAVA_HOME` and `ANDROID_HOME` explicitly; preflight requires
`java`, `javac`, the generated Gradle wrapper and SDK executables. Build-tools
default to `$ANDROID_HOME/build-tools/36.0.0`; `--build-tools DIRECTORY` overrides
the path. No macOS SDK assumptions or emulator-starting helpers are used. JDK
17 through 24 is checked when execution is explicitly requested, not in dry-run.

`app.json` remains authoritative for the Android code and separate sancti.fi
semantic version; native versionName remains 8.1.8. Preflight compares package,
code and versionName with the ignored `android/app/build.gradle`, checks for the
permanent release-signing configuration/validator, and stops on missing, stale or
ambiguous metadata. It does not prove that signing credentials are valid.
Preserve local native work and review the established manual
`npx expo prebuild --platform android --no-install` procedure separately if a
refresh is needed; this CLI never runs prebuild. Only the explicit synchronise command edits the
generated versionCode; preparation itself does not edit it.

Version intent is mandatory:

- **`--intent new`:** consumes a separately approved reservation (automatic registry
  reservations above, or the legacy manual format below), without allocating
  or writing any version. The private allocation JSON must contain integer
  `versionCode` equal to the current app.json/native code, integer `highWaterMark`
  at least 80000188 and at least every other code recorded in the ledger, boolean
  `reconciled: true`, and nonempty string `ledgerReference` identifying the owner's
  reconciliation/reservation evidence. Its code must exceed that high-water mark
  and appear in a `Reserved` row in the ledger. An existing archive entry is a
  blocker. This is an owner attestation, not automatic discovery of private release
  history or a distributed allocation service. Do not assert reconciliation until
  it has actually happened. No allocation file or new reservation is supplied by
  this implementation.
- **`--intent keep`:** requires a retained staged APK and `.apk.json` for the
  configured code. It verifies the archive before building, compares the rebuild
  byte-for-byte by SHA-256 and fails on changed bytes. The existing artifact and
  original source attestation remain unchanged, even if the comparison build is
  from another commit. New bytes require separate approval for a globally new code.
  To inspect an older APK independently of current source configuration, use
  `verify` instead of changing source versions.

Only after separate approval for a real release build:

```bash
node scripts/android-release.js prepare --intent new --allocation /absolute/private/allocation.json --execute-build
# Or, for an approved comparison rebuild of a retained artifact:
node scripts/android-release.js prepare --intent keep --execute-build
```

`prepare` requires exactly one of `--dry-run` or `--execute-build`. Preparation
runs release-tool/signing Node tests, TypeScript, full Jest (two workers), Intl,
translation, ProGuard and module-inventory validators before Gradle; any failure
stops the sequence. Optional signing runtime groups retain their explicit skip
behaviour without prerequisites; a successful Node command is not proof that
those runtime groups executed. It then uses exactly
`(cd android && NODE_ENV=production ./gradlew :app:assembleRelease)` with the
existing signing setup. No auto-install, release tag, Git commit/push or EAS job
is performed. Run one preparation/manual build at a time per checkout.

The default archive remains `/media/data/Complete/Sanctifi/Releases/`; `--directory`
may select another trusted directory outside every Git checkout, including through
symlink ancestors. The guard resolves the nearest existing directory, then checks
all physical ancestors for `.git` files, recognisable `.git` directories, or
repository metadata (`HEAD` with `objects`/`refs`, or linked-worktree `commondir`).
Empty `.git` directories alone are not repositories. It refuses recognised markers, including
nested repositories, linked worktrees and repository metadata directories; it does
not treat a failed Git discovery command as evidence of safety. Missing path
components are appended only after that check. Existing files, dangling symlinks
and filesystem inspection errors stop preflight. A symlink pointing out of a
checkout to an external directory is acceptable because the physical destination
is outside Git. Keep the directory under trusted local ownership: this is not
protection against another process replacing ancestors after preflight.

Preparation acquires an exclusive `.prepare-lock`; if a crash
leaves it behind, inspect running processes before manually removing it. No stale
lock is automatically deleted.

Each execution creates a private `.build-*` directory with mode 700 and private
check/build logs and `summary.json` with mode 600. Previous standard APK output
is moved there before Gradle; a freshly emitted output is required. If no new
output exists after failure, the previous output is restored. A fresh failed
output is not staged. A verified snapshot is retained privately as `candidate.apk`.
A nonzero result is never publication approval; inspect partial staging/evidence.

### Evidence retention and interrupted-run recovery

Retention is deliberately manual and **unbounded**. There is no automatic deletion
or age-based pruning. This protects diagnostics, but repeated preparations can
retain two additional APK-sized files per run (`previous-output.apk` and
`candidate.apk`), plus check/build logs. These are separate copies from the immutable
archive; moving the old output initially does not copy it, but later runs can
retain another previous output. Preflight/dry-run and failed preflight create none.

| Outcome | Previous standard output | New output / evidence |
| --- | --- | --- |
| Failure before the old output is moved | Still at the standard output path | Any completed checks/logs remain in the private run directory. |
| Success after the old output is moved | Retained as `.build-*/previous-output.apk` | New standard output, private `candidate.apk`, logs and summary remain; the verified immutable artifact is staged/reused separately. |
| Caught failure, no new standard output exists | Moved back to the standard output path; `previous-output.apk` is no longer present in that run directory | Logs/summary and any candidate already made remain. Restored output is an older artifact, not this run's success. |
| Caught failure with a new standard output present | Retained privately; never overwrites the new output | New output is untrusted, potentially partial or invalid. Logs/summary and any private candidate remain; staging may be incomplete if failure happened during staging. |
| Abrupt termination or machine failure | May remain privately if the move completed | Cleanup/restoration and summary writing are not guaranteed. A stale lock, partial output, logs or partially completed staging may remain. |

Normal caught failures release the lock and write a summary. OS termination, an
I/O failure during recovery/cleanup, or a machine crash can prevent that; neither
an absent summary nor an existing standard output proves success. No automatic
signal recovery or stale-lock removal is attempted.

After interruption, before any retry or cleanup:

1. Confirm the Node preparation, Gradle daemon/worker and any manual build using
   this checkout have stopped. Do not remove the lock while another build can
   still write output. Inspect the private run directories and logs; directory
   names are random, so use timestamps/content to identify the affected run.
2. Preserve any standard output as an **untrusted** diagnostic file in a new private
   location without overwriting anything. Inspect `previous-output.apk` if present;
   do not assume its version or source. Do not overwrite either file to recover.
3. If restoring the previous output is useful and the standard destination is
   absent, copy exclusively, keeping the private backup. Example, with deliberately
   selected local paths (these are placeholders, not known futwick paths):

   ```bash
   SF_EVIDENCE=/absolute/private/releases/.build-CHOSEN_RUN
   SF_OUTPUT=/absolute/checkout/android/app/build/outputs/apk/release/app-release.apk
   node -e 'const fs = require("node:fs"); fs.copyFileSync(process.argv[1], process.argv[2], fs.constants.COPYFILE_EXCL)' \
     "$SF_EVIDENCE/previous-output.apk" "$SF_OUTPUT"
   ```

   This refuses an existing destination. It restores a build output only; it does
   not establish provenance, stage, publish or authorise a new build. Never assign
   today's HEAD to that recovered APK without its original evidence.
4. Review any `sanctifi-<code>.apk` and `.apk.json` left by partial staging with the
   existing verification/staging procedures. Never overwrite a conflict, invent
   missing provenance or delete an immutable release to make a retry pass. Once
   processes and recovery are settled, remove only the empty `.prepare-lock`
   directory using `rmdir`; then rerun read-only preflight. A real retry still
   requires the normal build approval and version-intent checks.

A sensible manual policy is to retain the most recent successful run, all unresolved
failed/interrupted runs, and private source/build summaries and relevant logs for
distributed artifacts. Periodically review disk usage. Once a run is resolved,
compare any APK copy with a separately verified retained artifact and its original
record before deciding it is redundant. An old output may be the only surviving
copy of another build; a failed candidate may be the evidence needed for diagnosis.

Delete only explicitly reviewed files inside one chosen `.build-*` directory; keep
needed summaries/logs separately and private. An entire run directory can be removed
only after checking every retained file and confirming no active process uses it.
Do not run wildcard cleanup over the archive root, do not delete
`sanctifi-*.apk` / `.apk.json`, and do not clean unresolved `.stage-*` or lock
artifacts as though they were obsolete build logs. No cleanup command or retention
policy in this section changes immutable release retention.

Provenance records HEAD, branch, dirty status and hashes of native input files
before checks, after checks and after building. Native output/cache directories
(`build`, `.gradle`, `.cxx`, `.kotlin`), signing.properties and key files are excluded;
native symlinks require manual review. Changes stop preparation. Ignored native
inputs are explicitly represented by hashes, rather than attributed to HEAD.
The report also includes Node/JDK versions, build-tools path, command, times,
actual APK size/hash/signer/versions, check results and manual acceptance still
outstanding. This is meaningful local evidence, not a hermetic source proof:
installed dependencies, external Gradle configuration, ignored JS/environment
inputs and signing material are not fully captured. Do not change inputs during
preparation; before/after equality cannot detect a transient change that was undone.

Existing immutable `.apk.json` records retain their format. Supplementary evidence
is written separately; keep-version reports distinguish original artifact source
from comparison-build source. CLI output omits individual native input hashes;
they remain in private evidence. Logs are never echoed or uploaded by the tool.
Gradle or external tools can emit sensitive information: keep logs private and
review/redact before sharing; do not enable shell tracing, build scans or debug logs.
No environment dump, signing-file contents, passwords or keystore bytes belong in
Git or release summaries.

A successful report includes an unadvertised schema-v1 `manifestCandidate` built
from verified APK metadata, with the canonical URL and checksum. Optional notes
can be added to a separate candidate JSON and checked with the existing validator.
This is not a published channel manifest or proof of HTTPS availability.

Independent verification, without assigning today's HEAD to an existing APK:

```bash
node scripts/android-release.js verify /absolute/path/existing.apk --build-tools "$ANDROID_HOME/build-tools/36.0.0"
```

`verify` reports actual metadata, pinned signer, size and checksum; source revision
is explicitly unknown. `stage` continues to require the publisher's exact source
attestation. Existing manual commands below remain the fallback. Physical-device
acceptance and complete public HTTPS checks remain separate from all local results.

## Manual publishing checklist

1. Reserve/confirm the code and exact source revision in the ledger. Build only
   when authorised, then stage the verified APK as above. Copy its recorded
   metadata/checksum into the ledger and candidate manifest. Never use Settings
   text as a substitute for APK inspection.
2. Follow the successful manual transfer pattern: SCP the staged APK from futwick
   to `/tmp/` on obscurity, verify its checksum there, then use privileged
   installation into `/opt/updates-site/client/apks/`. Verify the installed file's
   checksum and ownership/mode before advertising it. The first deployment's
   hashes matched at all these stages. **Before installation, guard the immutable
   destination filename:** if it exists, compare its bytes/checksum and reuse an
   identical artifact without overwriting; stop on any difference. Use exclusive
   creation or a checked single-publisher procedure, never a blind overwriting
   install command. Temporary transfers do not constitute publication.
3. Perform a **complete GET** of the final APK URL to a temporary local file.
   Require HTTP 200, HTTPS with normal certificate verification, no login/cross-
   host redirect or HTML response, and the exact checksum. A HEAD request or
   successful transfer exit status alone is insufficient.
4. Validate the candidate manifest locally, then validate it against the downloaded
   public APK:

   ```bash
   node scripts/android-release.js validate /private/staging/alpha.json
   node scripts/android-release.js validate /private/staging/alpha.json \
     --apk /private/staging/downloaded.apk \
     --build-tools "$ANDROID_HOME/build-tools/36.0.0"
   ```

5. Retain the old live manifest outside the public URL. Upload the candidate to
   a separate temporary file, validate its transferred contents, then replace
   `alpha.json` using an atomic rename on the same filesystem or a confirmed
   equivalent. Never stream an overwrite into live JSON. The target directory is
   `/opt/updates-site/client/`. The first deployment transferred the manifest to
   a temporary location, installed it as `.alpha.json.new` in that destination
   directory, then renamed it to `alpha.json`. Preserve this temporary-file /
   same-directory replacement pattern and validate each candidate before renaming.
6. Fetch the live manifest and referenced APK over public HTTPS again and rerun
   the artifact comparison. Check ordinary requests as well as a cache-bypassing
   request. If it fails, restore the last known-good manifest and investigate.
7. Record publication time, source, APK checksum, certificate, channels and outcome
   in the ledger. Keep prior manifests and artifacts for audit and rollback.

Every failure before manifest replacement is a **stop**: do not advertise that
candidate. The tool does not deploy or enforce permissions on the server; a
publisher can bypass a manual checklist. Live acceptance must prove failed
uploads leave current channel pointers unchanged and temporary files are not
served as final artifacts. Use one publisher at a time initially.

First-publication HTTP observations: the APK returned HTTP/2 200 with the correct
Android APK MIME type, `Accept-Ranges: bytes`, `ETag` and `Last-Modified`. Alpha
JSON returned HTTP/2 200, `Content-Type: application/json`, `ETag` and
`Last-Modified`. **Neither response included explicit `Cache-Control`.**

An explicit cache policy remains a future consideration, particularly for Issue
023's client update checks. The earlier recommendations (manifest `no-store`,
immutable APK `public, max-age=31536000, immutable`) are not deployed guarantees.
Absence of explicit headers does not prove absence of caching. Agree and validate
freshness/conditional-request behaviour before relying on it in client checks.
No Caddy configuration changes are made here; failed-upload safety, cache effects
and concurrent-reader behaviour are not established by the successful publication.

## Promotion, withdrawal and client channel assignment

Promote by validating the existing APK and atomically replacing Beta/Stable's
manifest with metadata referencing the same archive URL/checksum. Approve the
target audience first. Do not rebuild, resign or copy APKs between directories.

Rollback restores a previous known-good channel pointer to stop offering a bad
release. It does not downgrade an installed newer app: clients must only offer
higher versionCodes. Users already on the bad build normally need a corrected
APK with a higher global code. For serious revocation, withdraw public download
access (for example, 410) and invalidate applicable caches, retaining a private
audit copy. Never replace an immutable URL with different bytes. Downloaded or
cached copies cannot reliably be recalled; schema v1 does not implement remote
disabling or installed-version revocation warnings.

Issue 023 should initially follow `alpha.json`, with assignment independent of
the artifact. A local persisted channel preference can later support deliberate
Beta/Stable enrolment without changing/rebuilding the APK; no mandatory V1
selector is required. Promotion does not silently move existing Alpha clients to
another channel. Startup/Settings checks, ordering/concurrency and any channel
provisioning UI are owned by Issue 023, not this tooling.

### Mount identity during a release operation

Each stage/allocation/synchronisation/preparation invocation retains the initially
verified `/media/data` mount ID, filesystem major:minor identity and mounted root.
Repeated checks must match those values, rather than accepting a replacement
writable volume. The deepest covering mount's ID, filesystem identity, root and
target are also retained to detect a changed bind mount on the same filesystem.
Preparation shares this baseline through its locked/pre-build checks and staging.
Explicit external overrides remain independent; there is no process-global or
persistent mount identity cache and no device-name or encryption-specific pin.

These are comparisons between observations, not mount locking. They do not prevent
an administrative unmount between a check and a filesystem operation, or detect a
change undone between checks. Kernel mount/device IDs can be reused; this is not
cryptographic volume authentication. A new invocation establishes a new baseline,
so the owner must still mount the correct volume and inspect storage after any
unexpected identity-change failure. Do not unmount/remount during release work.
