# sancti.fi Client - Project Diary

## 26 October 2026 - Issue 047: Release diagnostics and CLI help

### Investigation and authorised scope

The owner reported successful read-only futwick checks after PRs 48 and 49 merged.
Both new-release entry points correctly refused missing allocation input, but their
messages still assumed the pre-reconciliation history. `prepare --help` was rejected
by the normal option parser. Refreshed sanctifi to
`14fe8e59bf4b1546437c3bd46f209dd82e8934ee` and created the dedicated branch
`issue-047-release-diagnostics-help`. The task authorises usability changes only.

Read the current CLI, tests, publishing guide and reconciled ledger. Current
configuration is 0.1.1 / 80000188; the ledger records its APK hash and size, unknown
original source, and the owner-confirmed allocation high-water mark. These facts
are documentation/configuration evidence, not APK or publication checks repeated here.

### Changes and safety distinctions

Replace the two stale historical diagnostics with ledger/configuration context.
The diagnostic helper validates numeric code ranges, agreement among recognised
owner-confirmed high-water statements, unique code rows, hash/full-revision formats
and a single positive size in the matching published-code section. It distinguishes
Published from Reserved, uses current configuration and follows changed ledger codes.
Unavailable/ambiguous evidence is described honestly instead of substituting HEAD,
borrowing another artifact's size or claiming a fresh signature/HTTPS check.

The helper is diagnostic only. Allocation still requires reconciled owner input,
a matching higher code and nonempty reference, the existing minimum historical
floor of 80000188, a Reserved ledger row and a collision-free immutable destination.
The required minimum in the allocation-error message is calculated from that
unchanged safety floor and ledger rows. No new code is suggested or authorised.
Ledger diagnostic-read failure alone does not introduce a new keep-version gate;
new intent still cannot validate allocation without its required ledger.

Add early read-only --help/-h dispatch globally and for preflight, prepare, verify,
validate and stage. It runs before argument requirements, Git/source/native checks,
SDK discovery or allocation reads. Help explains actual required arguments, new/keep,
allocation input, independent existing-APK verification, dry-run and actual authorised
build/staging. Unsupported commands or mixed help/other arguments fail without
starting release work. No release option or capability is added.

The guide documents help and diagnostic evidence limits. Existing preparation,
verification, signing, staging, provenance, manual fallback and publication boundaries
are preserved. No workflow change is needed: CI already discovers android-release
Node test files by wildcard.

### Validation

Combined Node release/signing checks passed: **130 tests passed, 2 optional runtime
groups skipped, no failures**. GRADLE_BIN and SANCTIFI_AGP_SDK were unset for this
run so no Gradle/AGP runtime check executes. All **10 new focused tests** also passed
with stricter help data-read guards. TypeScript, Intl, translations, ProGuard and
native module inventory passed; the existing **2,169 translation warnings** remain.
Full Jest passed **634 suites / 11,192 tests**, with the existing **2 suites / 8
private-fixture tests skipped**. Syntax, whitespace, documentation links/fences and
protected-file checks passed. Release functions and safety predicates were compared
with the branch base; preparation/build/staging/verification bodies are unchanged.

New tests cover the
reconciled ledger, changed synthetic code/provenance, malformed/ambiguous metadata,
size isolation, unsupported help/options, and both missing-attestation refusals.
Help tests copy the CLI into non-repository and dirty-checkout fixtures with no SDK
or allocation files, and block tool calls, configuration/allocation reads and filesystem mutation during
help execution. Only loading the CLI source itself is allowed to read a file.

### Outstanding work and restrictions

Future new-release authorisation, a higher configured/reserved code, matching private
allocation attestation and actual futwick build/device acceptance remain separate.
Unknown historical source is not filled in. No production APK build, Gradle, Expo
prebuild, version/native/signing edit, real reservation/attestation, release-artifact
staging/upload/deletion, live manifest or hosting change is performed. Tests use
synthetic fixtures only; they do not establish production APK or phone acceptance.
Stage 2 remote publication remains unimplemented. The draft PR must remain unmerged.
