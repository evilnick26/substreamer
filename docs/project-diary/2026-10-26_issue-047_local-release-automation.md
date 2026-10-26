# sancti.fi Client - Project Diary

## 26 October 2026 - Issue 047: Stage 1 local release automation

### Approved scope and baseline

Following the owner's review of the investigation, Stage 1 implementation was
approved on a dedicated branch with an unmerged PR against sanctifi. Base:
`e02371f9bbda8ee4904c13aafd3e768289d9e4b4`; branch:
`issue-047-local-release-automation`. Read Issue 047 including the 26 October
historical runbook, the publishing/signing guides, ledger, existing tooling and
Issue 021/022/038/041/043 diaries. No remote publishing implementation is authorised.

### Historical reconciliation

Issue 046 approved semantic 0.1.1 / build 80000188 and is closed. Issue 047 records
Nick's confirmation that 80000188 works and was distributed. This inspected branch
still has semantic 0.1.0 / 80000187, and its ledger records the exact 80000187
artifact. No matching 80000188 source/hash/size record was found. The documentation
now makes that gap explicit and treats 80000188 as a known distributed lower bound,
not a complete allocation history. No source provenance or APK identity is guessed.

### Implementation and decisions

Extend the existing Node entry point; preserve stage/validate and their immutable
record format. Add read-only preflight, explicit new/keep version intent, independent
APK verification and opt-in local preparation. Dry-run executes no build/test/SDK/
Java/Expo process and creates no release files/directories. Preparation never edits
versions or regenerates native files. Stale/missing/ambiguous ignored Gradle metadata
stops with the reviewed manual refresh instruction and local-work preservation.

New-artifact preparation consumes an owner-authored reconciliation/allocation JSON
and a Reserved ledger row. It does not allocate numbers; the stale 80000187 checkout
cannot implicitly authorise a next release. Keep-version requires a retained staged
artifact/record, verifies it, and rejects changed rebuild bytes. Original artifact
provenance remains unchanged; comparison-build provenance is separate.

Explicit execution runs automated quality checks, then the established production
Gradle task with the unchanged permanent signer. A private exclusive preparation
lock prevents overlapping tool builds. Old standard output is isolated so a missing
new output cannot be mistaken for a successful fresh build. Verification/staging
uses a snapshot; original immutable stage protection remains in place.

Private evidence contains source/native input hashes before/after checks and build,
command/tool/timing data, check/build logs and APK identity. Ignored native inputs
are not represented as committed source. Excluded secrets/caches and uncaptured
external dependencies/environment are documented; this is not a hermetic-build
claim. Logs are never echoed/uploaded, remain private, and require review before
sharing. CLI summaries omit individual native hashes. No existing immutable
provenance record is rewritten. A local manifest candidate does not publish a channel.

CI discovers both release test files. Manual build/verify/stage/publication commands
remain available. No remote publication mode or SSH/SCP/sudo code is implemented.

### Validation

- Combined Node release/signing checks: **106 passed, 2 skipped, no failures**.
  The optional Gradle and real-AGP runtime groups were not configured. Coverage
  includes dry-run process/file safety, new/keep intent, allocation/ledger blockers,
  native metadata drift, immutable archive/provenance preservation, source/native
  mutation, fresh-output enforcement, failed checks/builds, private logs, lock
  handling, independent verification and strict CLI parsing.
- Baseline and final TypeScript checks passed. Baseline and final full Jest each
  passed **634 suites / 11,192 tests**, with the existing **2 suites / 8 tests
  skipped** because the private captured database fixture is unavailable.
- Intl, translation, ProGuard and native module-inventory validators passed.
  Translation validation retains **2,169 missing-key warnings** awaiting Crowdin.
- Syntax, whitespace, relative documentation links and changed-file scope checked.
  Version/config/dependency/signing/native helper files match the base exactly.
- Deliberate second-pass review confirmed additional failure cases needed coverage:
  stale standard output, concurrent preparations, malformed-JSON content leakage,
  original versus comparison-build provenance, and private quality-check failures.
  These are addressed with fixtures; no open finding is represented as a live
  production validation result.

All build/signature success tests use synthetic APK bytes and simulated SDK output;
the process-runner check invokes a fixture shell wrapper, not Gradle or signing.

### Outstanding owner validation and boundaries

Recover 80000188 identity/provenance and later allocations; confirm futwick's real
environment and retained archive. A real release build and cryptographic verification
of its production APK require separate approval. Complete public HTTPS checks and
physical startup/manual discovery, browser-led in-place installation, preservation,
navigation, online/offline playback and Up to Date acceptance remain outstanding.
No phone acceptance is inferred from fixtures or earlier release history.

No version values, native files, signing configuration, production APKs, server
permissions or live manifests are changed. No release is built, uploaded, installed
or published. The PR must remain unmerged; Stage 2 remains separately reviewed work.
