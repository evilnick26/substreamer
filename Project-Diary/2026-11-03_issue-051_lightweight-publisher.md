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
