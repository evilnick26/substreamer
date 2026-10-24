# sancti.fi Client — Project Diary
## 23 October 2026 — Issue 021: Permanent release signing configuration

### Confirmed baseline and approved scope

Source baseline: `sanctifi` at `f8d9f45ab10df0ffbe91f55cdc84dded6cef0e83`.
Nick supplied read-only futwick evidence: both generated build types select debug
signing. The inspected release APK verifies with v2 signing, package
`fi.sancti.client`, versionCode `80000185`, versionName `8.1.8`, and certificate
SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

Nick is the sole existing user and accepts one uninstall/reinstall. The approved
repository work adds regeneration-safe release signing, focused tests and local
key/backup instructions. Key generation and real credentials remain exclusively
on futwick. Separate debug IDs are deferred. Numbering, channels and publishing
remain with Issue 022; package ID and version fields remain unchanged.

### Implementation

- An Expo Groovy Gradle mod adds a dedicated release signer and removes the
  release variant's debug fallback, with strict template checks and idempotence.
- Gradle reads an external properties file on the build machine. Missing or
  malformed settings permit regeneration/debug work but fail release validation.
- Automated checks use fixtures and isolated Gradle lifecycle tasks; no production
  key, native application build or actual signing operation is involved.
- `docs/android-release-signing.md` documents secure local setup, independent
  backup/recovery, the accepted migration and remaining native acceptance.

### Validation and outstanding work

Automated results:

- Signing checks with checksum-verified Gradle 8.14.3: 21 passed, none skipped.
  These include absent/incomplete/malformed credentials, invalid keystore paths,
  debug permissiveness, release lifecycle failure, and the default home location.
- The full SDK 57.0.33 Gradle template transforms and reapplies idempotently.
- CI runs the Node checks: 12 passed; the Gradle runtime group explicitly skips
  when no `GRADLE_BIN` is supplied. No Gradle dependency is added to the project.
- TypeScript passed. Full Jest: 616 suites passed, 2 skipped; 10,854 tests passed,
  8 skipped, no failures.
- Translation, Intl, ProGuard and module inventory validators passed. Translation
  validation retains the existing missing-key warnings awaiting Crowdin sync.
- Whitespace checks passed. Package identity, versions, dependencies, publishing
  scripts and EAS settings are unchanged.

Futwick validation remains required for actual AGP integration, debug/release
builds, permanent-key generation and recovery, certificate comparison, and signed
in-place upgrades.
No permanent key has been created, no local credentials changed, and no production
release build attempted. Release readiness is not established by this PR.

### PR review follow-up: actual Android plugin integration

Carl requested evidence that an incomplete release signer permits debug work and
that actual release assembly reaches our validator. No signing-plugin change was
needed. Added a real-AGP regression test using a temporary minimal Android project:
Expo 57.0.8 / React Native 0.86.0 select AGP 8.12.0; the fork pins Gradle 8.14.3.
React Native's catalog defaults to compileSdk 36 and build-tools 36.0.0. The probe
asserts loaded AGP/Gradle versions.

The six real-AGP checks passed: nullable release fields with unchanged debug
signer; debug assembly graph without release validation; actual debug Java
compilation; release assembly graph ordering our validator before preReleaseBuild;
real preReleaseBuild failure at our validator; and absence of generated APKs or
signing keys. Node counts these six checks plus their parent as seven passed.

AGP source and runtime agree: AGP omits validateSigningRelease when signing fields
are incomplete, so the preReleaseBuild dependency is necessary. The new tests
exercise actual AGP tasks rather than the original empty lifecycle harness.
The first compilation attempt exposed a JRE-only cloud installation; installing
a checksum-verified temporary JDK 21 resolved it. Android platform/build-tools
archives were checked against Google's published repository checksums. No keys or
production credentials were used.

CI now includes sanctifi push/PR targets and discovers both signing test files.
Real-AGP checks explicitly skip without their Gradle/SDK prerequisites. Full app
AGP resolution/task graphs after regeneration, debug APK packaging, actual release
signing, key recovery and device upgrades remain futwick acceptance work; exact
credential-free graph/validation commands are in the signing guide. The earlier
full Jest/TypeScript results above belong to the initial implementation; this
follow-up changes tests, CI and documentation only.

Final combined signing run: 28 tests passed, none skipped or failed. Without
runtime prerequisites (CI mode): 12 passed, two runtime groups explicitly skipped.
Whitespace checks passed. The signing plugin itself is unchanged from c1c1581a.

### 24 October validation follow-up

The futwick results reported by Nick on 24 October are recorded in
[the dated validation entry](2026-10-24_issue-021_futwick-validation.md).
That entry updates the outstanding-work status above without rewriting the
investigation, implementation or cloud-validation history.
