# 2026-11-03 — Issue #051: lightweight publisher (initial investigation)

## Evidence
- Owner confirmed signed APK 80000193 built and archived on Futwick with SHA-256 ed79cf71c19e24319aec0ccbe1bbde31e49155c0b1bf356b12fa9405c81ed39c; subsequently passed physical-device testing.
- Obscurity serves /opt/updates-site/client/ and /apks/ as root:root, directories 755 and APKs 644.
- alpha.json currently points to 80000191; beta.json and release.json absent.
- Futwick can SSH noninteractively to obscurity as evilnick. Noninteractive sudo has NOT been demonstrated.
- Issue #51 documents transfer, checksum, HTTPS, explicit manifest promotion, rollback and physical acceptance requirements.
- Issue #67's simplified local builder archives APKs and records checksum/provenance, but leaves deviceTested=false until separately updated.

## Decisions
- Reuse existing schemaVersion 1 validator and APK signature inspection from scripts/android-release.js.
- Build a separate publisher on top of the existing immutable archive; never rebuild, allocate a versionCode or automatically publish.
- Begin with a strictly read-only plan operation. No live server mutation is authorised.

## Implementation
- Added scripts/android-publish.js with a read-only `plan VERSION_CODE` operation, checking archive/sidecar checksum, APK identity/signature, remote destination collision, and current Alpha manifest via BatchMode SSH.
- This is only a first implementation increment, NOT a finished publisher. Upload, full HTTPS verification, manifest promotion/rollback, approval gates, automated tests and documentation remain outstanding.

## Validation
- GitHub source changes committed to issue-051-lightweight-publisher.
- No Futwick execution, automated tests, remote mutation or public publication performed in this session.

## Outstanding
- Test read-only plan on Futwick and inspect output; correct any issues before remote-write implementation.
- Decide safe handling of sudo authentication and explicit device-acceptance attestation; do not infer approval from an unchanged local deviceTested=false sidecar.
- Implement upload and promotion with full verification, rollback, tests and manual fallback.

## Follow-up — 2026-11-03

- Product owner explicitly rejected a separate device-acceptance flag or administrative gate: the deliberate approval to publish the exact APK is the acceptance decision. The existing `deviceTested: false` build sidecar must not block publication.
- Replaced an accidentally malformed initial preflight implementation with a clean read-only planner. Added isolated Node.js tests for manifest inventory, collision rejection, downgrade prevention, archive checksum and dependency-injected planning.
- No tests have been executed on Futwick yet; no remote writes or publication have occurred. Next checkpoint: run Node syntax and test commands on the development branch, then implement upload and promotion with explicit approval.

## Upload helper increment — 2026-11-03
- Owner ran `node --check scripts/android-publish.js` and all seven preflight tests successfully on Futwick.
- Live `plan 80000193` succeeded: archive SHA-256 ed79cf71c19e24319aec0ccbe1bbde31e49155c0b1bf356b12fa9405c81ed39c, versionName 8.1.8, current Alpha 80000191, remote APK absent. Read-only.
- Added isolated `scripts/android-publish-upload.js`: SCP to uniquely named remote /tmp, remote interactive sudo checksum verification and installation with exclusive hard-link publication, root:root/644 check, and best-effort temp cleanup. It does not modify channel manifests.
- Added isolated unit tests for upload command construction and cleanup. This helper is NOT yet connected to the public CLI, has NOT been executed against Obscurity, and its tests are pending Futwick execution.
- Outstanding: validate helper and security/error handling, integrate a single command, public HTTPS full-download checks, explicit confirmation, atomic manifest promotion/rollback, tests and end-to-end dry run.

## Public HTTPS verification increment — follow-up
- Owner confirmed 11/11 preflight and upload-helper tests pass on Futwick; upload helper has not been used against Obscurity.
- Added `scripts/android-publish-verify.js`: full public GET (not HEAD), no-cache request headers, HTTP 200 required, streamed SHA-256, 1 GiB safety limit, downloaded APK signer/package inspection through the existing `inspectApk`, version and checksum comparison, temporary file cleanup.
- Added five isolated tests for successful full GET, redirect rejection, correct APK identity, checksum mismatch and version mismatch. Tests are pending Futwick execution.
- Deliberately no live server changes and no manifest promotion. Remaining work: CLI orchestration, explicit promotion confirmation, remote atomic manifest update, post-promotion verification and rollback, and real-world permission checks.

## Final integration increment — follow-up
- Owner confirmed 16/16 component tests pass on Futwick.
- Implemented `publish VERSION_CODE` orchestration: repeat preflight, upload existing archive, verify full public APK, show proposed manifest, request exact interactive `PUBLISH VERSION_CODE` approval, compare-and-swap atomic Alpha manifest promotion, verify public manifest and APK, rollback on verification failure, then write a separate immutable `.publication.json` record. Existing build-sidecar `deviceTested` is not a gate.
- Added guarded remote promotion/rollback helper and unit/integration-style tests. **All new tests and actual write operations remain unvalidated on Futwick/Obscurity.** Do not run `publish` until tests and operational review pass.
- Known operational considerations for review: interactive remote sudo, remote manifest backup retention, failure after remote rename but before SSH acknowledgement, remote permissions, and CDN/cache behaviour. No release has been published by this development session.
