# Issue #67 — Simple Futwick-only internal builds

This is a clean-sheet **experimental** replacement for routine internal APK building.
It does not publish APKs or modify remote channel manifests. The existing release
tooling and historical records are deliberately left intact pending acceptance.

## One-time setup (owner approval required)

Inspect the existing Futwick archive, attempted allocations and previously distributed
APK versionCodes. Determine the highest *consumed* number. Do not assume 80000192
is available. On Futwick, after reconciliation:

```bash
node scripts/android-local-build.js init LAST_USED_CODE
```

The counter is private to `/media/data/Complete/Sanctifi/Releases/.local-build/last-code`.
Back it up with the release archive. Never delete or reset it to recover from a failure.

## Routine internal build

```bash
node scripts/android-local-build.js build
```

The command consumes the next number, synchronises Expo and Gradle, runs
`assembleRelease`, checks package/version/signing certificate, and archives
the signed APK under its permanent code. A failed build still consumes its number.
A lock prevents simultaneous builds. An abandoned lock requires manual confirmation
that no build is still running before removing it.

The resulting APK must be tested on a physical device. Publication is a separate,
explicitly approved process, using the exact archived bytes. This script does not
perform publication or authorise any release.

**Status:** six isolated Node tests and syntax checks passed on Futwick. The full build workflow has not yet been exercised.

The native `android/` project is generated and not tracked in Git. The builder
requires it to exist on Futwick and refuses to regenerate it automatically.
Before using the prototype, check that the native Gradle project and signing
configuration match the current working build environment.

## Integrating into the established Futwick checkout

The separate `substreamer-issue-067` worktree is for code review and tests only:
it does not contain the generated native Android project. Do not build there.

After explicit approval, integrate the reviewed builder, tests and documentation
into the existing `substreamer-build` checkout, retaining its native `android/`
tree and signing setup. Confirm the original checkout is clean first, and review
its current branch and upstream differences before selecting an integration method.
Do not blindly merge the experimental branch or replace the generated Android tree.

A real `build` updates tracked `app.json` and generated `android/app/build.gradle`.
The versionCode change in `app.json` must be handled deliberately when committing
subsequent source changes; do not reset the persistent counter to match Git.

The initial reconciled last-used versionCode on 2026-11-02 was `80000191`,
subject to rechecking for any newer attempts before initialising. Initialisation
and the first real build are separate owner-approved actions.
