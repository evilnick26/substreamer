# Issue #067 — 2026-11-02: Clean-sheet local APK builder

## Decisions
- Futwick is the sole APK build and versionCode allocation authority.
- Every attempted build consumes a number, even if it fails.
- The precise code does not matter; it must increase and never be reused.
- Build, physical-device acceptance and publication are separate operations.
- Discard routine server attestations, manual history JSON and remote allocation.

## Implementation
- Introduced an independent experimental `scripts/android-local-build.js`.
- Added a concise operating guide.
- Kept legacy scripts, registry, ledger and release artifacts unchanged.

## Validation and outstanding work
- Not yet run on Futwick; no live code allocated and no APK built.
- Reconcile the initial high-water mark before first use.
- Review filesystem durability, failure paths and signing/metadata checks;
  add automated tests before replacing the legacy workflow.
- Device testing and publication require separate owner decisions.

## Continuation — review pass
- Removed stale Gradle output before invoking the build and require a fresh APK.
- Added an archive record collision check and filesystem flushes for archived output.
- Added two small Node tests for atomic counter-file replacement and temporary-file collisions.
- Tests have **not** been executed; this is not an acceptance claim.
- Outstanding: verify script syntax and tests on a checked-out branch, add simulated build failure tests, inspect initial counter against real Futwick history, and review mount/storage trust and provenance.
- No allocation, build, signing, staging or publication was executed.

## Further review
- Confirmed `app.json` is tracked but `android/app/build.gradle` is generated and absent from GitHub.
- Added a clear failure if the generated Android project is missing; no automatic prebuild.
- Corrected Gradle versionCode replacement and checked the application ID.
- No test execution or live Futwick operation performed.
