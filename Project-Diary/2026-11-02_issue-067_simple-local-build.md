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
