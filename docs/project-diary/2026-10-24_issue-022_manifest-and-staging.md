# sancti.fi Client — Project Diary
## 24 October 2026 — Issue 022: Manifest contract and APK staging

### Baseline and approved scope

Refreshed `sanctifi` at `019c17cacc50dc37ca08f7cc88fd763616a6f22d`.
The first signed in-place upgrade has passed per the separate physical-device
diary; it does not establish static publishing readiness. Approved work adds a
versioned manifest contract, local APK staging, focused tests, a release ledger
and manual publication instructions. No application runtime, version identifiers,
signing configuration or inherited release scripts are changed.

### Implementation

- Schema v1 requires versionCode/versionName, canonical same-host HTTPS APK URL
  and actual SHA-256, with optional plain-text notes. Channel belongs to the JSON
  URL; all channels can reference identical APK bytes.
- `scripts/android-release.js` separates structural validation, local APK
  verification and staging. SDK tools verify actual metadata and the permanent
  public signer. Staging uses actual APK code, preserves standard build output,
  refuses different bytes at an existing filename and records checksum/provenance.
- Default staging is `~/.local/share/sanctifi/releases/`, outside Git. Temporary
  files share its filesystem; exclusive hard-link promotion prevents overwrite.
- Publishing docs distinguish public full-GET verification from local checks,
  require APK availability before safe manifest replacement, and cover promotion,
  withdrawal, caches and the absence of ordinary in-place Android downgrades.
- `scripts/create-release.js` and EAS independent automatic increments are
  explicitly not authorised for this manual workflow; their files are unchanged.

### Human-readable version investigation — proposal only

`app.json` currently supplies Android code `80000186` and Expo version `8.1.8`;
`app.config.js` preserves that version. Settings' sancti.fi label independently
reads `SANCTIFI_VERSION = '0.1.1'` from `src/config/sanctifiVersion.ts`. The inherited
footer reads resolved Expo version and abbreviates Android build code modulo 1000.
`package.json` remains `8.1.8` but is not the sancti.fi Settings version source.

Propose channel-independent sancti.fi MAJOR.MINOR.PATCH, with `0.1.2` as the first
unified release after the existing label, subject to Nick/Carl approval. Make
`app.json`'s human version authoritative, derive the Settings label from resolved
Expo config in a separately approved change, and generate manifest versions from
verified APK metadata. Keep the numeric Android sequence above `80000186`.
The publishing guide records the migration and consistency-check plan; **no
identifier or Settings code is changed here**. The retained `80000186` artifact
must still be advertised as `8.1.8`, never relabelled `0.1.1` or `0.1.2`.

### Validation and outstanding acceptance

Validation results:

- 49 manifest/staging checks passed, none skipped. Coverage includes schema/type/
  URL/checksum failures, actual-metadata-derived naming, identical retry, different
  bytes/provenance refusal, interrupted-stage recovery, source preservation,
  wrong package/signer, missing files, symlink rejection and CLI behaviour.
- Automated positive staging tests use synthetic bytes and simulated SDK output
  or executables, not real signing material. They do not establish successful
  cryptographic verification of the retained production APK.
- A separate real Android build-tools 36.0.0 apksigner check rejected invalid APK
  bytes. The staging CLI exited nonzero, retained the source and left staging empty.
- Existing Node signing checks: 12 passed, with two native runtime groups
  explicitly skipped. TypeScript and Intl, translation, ProGuard and module
  inventory validators passed. Existing missing-translation warnings remain.
- Version/runtime/signing/release-tool files were compared byte-for-byte with the
  baseline and remain unchanged. Relative documentation links and whitespace
  checks passed. Full application Jest was not rerun for tooling/docs-only work.

No production APK is built, signed, uploaded or installed by this work.

Futwick must verify the tool against the retained real APK and provide its exact
source provenance/checksum. Sancti.fi document root, permissions, transfer method,
atomic replacement, HTTP headers/caches, missing-file behaviour, and full public
GET verification remain live acceptance. No static release is claimed deployed.
The human-version migration needs approval before implementation. Issue 022 stays
open for publication acceptance and the broader agreed workflow; Issue 023 owns
client-side checks and channel-selection behaviour.
