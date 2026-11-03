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

## Operational recovery review — follow-up
- Owner confirmed the actual remote `ssh -tt obscurity 'sudo /bin/sh -c ...'` prompts for sudo password and reports root plus both writable publication directories. No changes were made to the server.
- Added a server-side `flock` around both Alpha promotion and rollback; compare-and-swap checksum verification remains inside the lock.
- On SSH failure during promotion, inspect the current manifest: exact new bytes mean success, exact previous bytes mean no promotion, otherwise report UNKNOWN and require manual inspection. No blind retries.
- Local publication record now uses a same-directory temporary file and exclusive hard-link creation, then reads it back; record failure is explicitly reported as post-publication bookkeeping failure, not as an excuse to roll back a verified release.
- Added four regression tests for interrupted SSH outcomes and publication record integrity. These tests have NOT been run on Futwick. No live publication has occurred.
- Remaining before first live release: Futwick tests; inspect lock availability and remote operational edge cases; assess PR branch integration with stale `sanctifi` base; owner approval for actual promotion.

## First live invocation — CLI dispatch defect
- Owner approved live publication of 80000193, then ran `node scripts/android-publish.js publish 80000193`.
- Command printed usage and exited before any upload or manifest change. Root cause: CLI dispatch accepted only `plan`, despite exporting and testing `publish()`.
- Corrected CLI dispatch to accept `publish`; corrected live publication path to call the tested atomic record writer with explicit post-publication bookkeeping error handling.
- Added two regression tests for CLI dispatch. Awaiting Futwick validation before retrying live publication; no live publication occurred.

## First successful live Alpha publication and release notes follow-up
- Owner ran `node scripts/android-publish.js publish 80000193` and approved promotion. Remote upload, checksums, public APK verification, Alpha manifest promotion, and local publication record all reported success. Alpha changed from 80000191 to 80000193. Immutable APK SHA256: ed79cf71c19e24319aec0ccbe1bbde31e49155c0b1bf356b12fa9405c81ed39c.
- Publication revealed no CLI facility to enter changelog text; live manifest omitted `releaseNotes`.
- Owner supplied exact release notes: "Switched Bookmark icon for Play More Like This on NPS. Bookmark is now in overflow menu".
- Added CLI release notes prompt for future publications and guarded `amend-notes` operation to update the currently live Alpha manifest only, preserving versionCode, versionName, APK URL, and SHA256. Uses existing atomic promotion and public manifest verification; added regression tests.
- Amendment has NOT been run against Obscurity; Futwick tests pending. Do not rerun `publish` for the already published APK.

## Live release-notes amendment — validated
- Owner ran `node scripts/android-publish.js amend-notes 80000193 "Switched Bookmark icon for Play More Like This on NPS. Bookmark is now in overflow menu"`.
- Owner explicitly confirmed `PUBLISH 80000193`; interactive sudo and atomic manifest replacement succeeded.
- CLI reported `Alpha release notes amended and publicly verified: 80000193`.
- Existing immutable APK 80000193 was not rebuilt or re-uploaded. Notes-only manifest amendment preserved its version, URL and SHA256.
- Latest Futwick test run: 30/30 tests passing, including amendment and actual CLI dispatch regression tests.
- Issue #51 implementation and live operational acceptance criteria met. PR #69 remains draft; branch integration with `sanctifi` still requires reconciliation before merging. Do not conflate successful publication with PR merge.
