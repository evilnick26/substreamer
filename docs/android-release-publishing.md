# sancti.fi Android releases: static manifests and manual publication

## Scope and current status

The manual publication procedure below remains available. The Stage 1 local CLI
can run an explicitly approved Gradle release build; preflight and dry-run never
build. It never changes versions, regenerates native files, uploads files, changes
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
Gradle. Default local staging is **`~/.local/share/sanctifi/releases/`**, outside
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

## Global build-number allocation and traceability

**Reconciliation warning, 26 October 2026:** Issue 047 records Nick's confirmation
that `80000188` was distributed and Issue 046 is closed. The inspected repository
still contains `80000187` / semantic `0.1.0`; it does not contain the exact
80000188 hash, size or source attestation. The known distributed lower bound is
therefore **80000188**, not a complete allocation history. Do not allocate another
code until Nick reconciles that artifact and every later reservation/distribution.
For a **new** distributed artifact, allocate above every previously reserved/distributed code. Never reset the sequence, allocate
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

## sancti.fi semantic identity and deferred native migration

Version sources in the inspected repository (not proof of the latest distributed artifact):

| Identifier | Current source/value |
| --- | --- |
| Android versionCode | `app.json`, `expo.android.versionCode`: `80000187` (25 October 2026). |
| Android versionName source | `app.json`, `expo.version`: `8.1.8`; `app.config.js` preserves it. Generated native files can be stale until regeneration. The built APK is authoritative for an existing artifact. |
| sancti.fi semantic version | `app.json`, `expo.extra.sanctifiVersion`: `0.1.0`; Settings reads the resolved application configuration. |
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

Read-only preparation, from a clean reviewed checkout with dependencies installed:

```bash
node scripts/android-release.js preflight --intent new --allocation /absolute/private/allocation.json
node scripts/android-release.js prepare --intent new --allocation /absolute/private/allocation.json --dry-run
```

The allocation path above is a placeholder, not an established futwick path.
Preflight/dry-run read Git and local files only: no Java, SDK, Gradle, Expo,
tests, directories, output files or signing credentials are invoked/created/read.
They return a JSON report and nonzero status for blockers, including multiple
independent diagnostics. Incomplete history does not prevent developing or
inspecting preflight; it blocks new-artifact preparation.

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
refresh is needed; this CLI never runs it or edits generated files.

Version intent is mandatory:

- **`--intent new`:** consumes a separately approved reservation, without allocating
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

The default archive remains `~/.local/share/sanctifi/releases/`; `--directory`
may select another trusted directory outside every Git checkout, including through
symlink ancestors. Preparation acquires an exclusive `.prepare-lock`; if a crash
leaves it behind, inspect running processes before manually removing it. No stale
lock is automatically deleted.

Each execution creates a private `.build-*` directory with mode 700 and private
check/build logs and `summary.json` with mode 600. Previous standard APK output
is moved there before Gradle; a freshly emitted output is required. If no new
output exists after failure, the previous output is restored. A fresh failed
output is not staged. A verified snapshot is retained privately as `candidate.apk`.
A nonzero result is never publication approval; inspect partial staging/evidence.

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
