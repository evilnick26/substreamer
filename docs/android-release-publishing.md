# sancti.fi Android releases: static manifests and manual publication

## Scope and current status

This procedure prepares files locally. It does not build/sign APKs, upload files,
change versions, install updates or implement the client checks owned by Issue 023.
Nick's hosting investigation confirmed that the existing Caddy container serves
`https://updates.sancti.fi/` from host root `/opt/updates-site`, and that the website
responds successfully over HTTPS. Nick subsequently confirmed the first live
Alpha publication on **24 October 2026**: `alpha.json` and the immutable
`sanctifi-80000186.apk` both return HTTP/2 200, and the complete public APK download
matches the checksum on futwick and the host. These are owner-reported deployment
results, recorded in the [Alpha publication diary](project-diary/2026-10-24_issue-022_alpha-publication.md),
not checks repeated or a deployment performed by this documentation update.

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

The published APK is **79,545,302 bytes**, package `fi.sancti.client`, versionCode
`80000186`, versionName `8.1.8`. Its SHA-256 is
`42f7945d52433a993765a42fb3416e65e996507bfce2f635f4958877673d222f`.
The 297-byte Alpha manifest passed local schema validation and references that
artifact, version metadata and checksum. Preserve this APK's bytes and metadata.

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

Known distributed high-water mark: `80000186`. For a **new** distributed artifact,
allocate above every previously reserved/distributed code, normally `80000187`
next after confirming no other allocation. Never reset the sequence, allocate
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

## Proposed human-readable numbering — approval required

Investigation of the current sources:

| Identifier | Current source/value |
| --- | --- |
| Android versionCode | `app.json`, `expo.android.versionCode`: `80000186`. |
| Android versionName source | `app.json`, `expo.version`: `8.1.8`; `app.config.js` preserves it. Generated native files can be stale until regeneration. The built APK is authoritative for an existing artifact. |
| sancti.fi Settings label | `src/config/sanctifiVersion.ts`, `SANCTIFI_VERSION`: `0.1.1`; consumed by `SanctifiVersionLabel.tsx`. |
| Inherited Settings footer | `VersionFooter.tsx` reads `Constants.expoConfig.version`; its Android build label uses versionCode modulo 1000, not the full update-ordering value. |
| npm package version | `package.json`: `8.1.8`; private package metadata, not the current sancti.fi Settings source. |
| Future release manifest | Must copy verified APK metadata, not the Settings string or current source configuration. |

**Proposal, not implemented:** use channel-independent `MAJOR.MINOR.PATCH`
sancti.fi versions. Suggest `0.1.2` for the first unified release after the
existing Settings `0.1.1`, subject to Nick/Carl approval. Patch increments cover
compatible fixes, minor increments cover new features (and breaking changes
during 0.x), and major increments mark a stable incompatible release after 1.0.
Do not append Alpha/Beta/Stable to versionName: promotion must preserve the APK.
Android's independent globally increasing versionCode remains the sole update
ordering key; a new build of the same human version still needs a new code if
distributed as different APK bytes.

Use **`app.json` / `expo.version` as the single human-version authority**. In a
separately approved migration, replace the independent hard-coded Settings
version with a value derived from resolved Expo config, as the inherited footer
already does. Preserve existing footer interactions; review its abbreviated
build label separately if a full build number is needed. If package.json's
version is aligned, treat it as a checked mirror, never another allocator.
No new dependency or release service is needed. Add a consistency check in that
migration so accidental duplicate literals cannot drift.

Approval and migration sequence:

1. Approve the convention, the first unified human version (proposed `0.1.2`),
   and the Settings derivation change before implementation.
2. In a separate PR, update the authoritative human version, derive the Settings
   label from it, and allocate a new global Android code above `80000186` and any
   later reservations. Do not change the key or package identity.
   The human-readable move from inherited `8.1.8` to proposed `0.1.2` is
   intentional; numeric versionCode still increases and determines update order.
3. Regenerate native Android files, build on futwick and verify final metadata.
   Confirm the Settings display and manifest match that APK's actual versionName.
4. Publish that new artifact under its new code. Never relabel, rebuild, resign
   or overwrite the existing `80000186` APK to implement this migration.

**This PR changes no version identifiers.** Publishing the retained `80000186`
APK still requires manifest versionName `8.1.8`; advertising it as `0.1.1` or
`0.1.2` would misrepresent its metadata and fails local artifact validation.

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
