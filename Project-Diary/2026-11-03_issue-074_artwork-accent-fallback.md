# 2026-11-03 - Issue #074: neutral artwork accent fallback

## Repository and isolation

- Repository: https://github.com/evilnick26/substreamer.
- Initial cloud checkout: /workspace/substreamer, branch work, clean at
  2ee497cdc442de45589c2f685367c0d6afbe645b (master source).
- Fetched the current sanctifi branch without changing that checkout. Exact base:
  c48e6e26031c03ae311aa61e89cc5114a62e20ea. Dynamic artwork extraction, global
  accent controller and monochrome treatment are present at this revision.
- Local and remote fix/074-artwork-accent-fallback did not exist before creation.
  Implementation uses that feature branch in /workspace/artwork-074, a separate
  Git worktree. No pre-existing uncommitted work was present or discarded.
- The implementation is the single commit containing this diary entry on
  fix/074-artwork-accent-fallback; its parent is the exact base above. The final
  SHA and remote verification are reported in the handoff, avoiding a self-SHA
  embedded in the commit. No merge, APK build/install or release operation.

## Build provenance

Project-Diary/2026-11-03_issue-051_lightweight-publisher.md records owner-confirmed
publication of APK 80000193 with SHA-256
ed79cf71c19e24319aec0ccbe1bbde31e49155c0b1bf356b12fa9405c81ed39c.
It does not attest the exact APK build-source commit. c48e6e26 changes only
app.json to align versionCode with the published build; it is not proof that
those bytes were built from that revision. The last relevant native/accent fix
in the base history is 1aec3880c340795326e3cdd4709deb5266899a3a. Exact source and
colour-code equivalence for the screenshots' build remain unestablished.
Inspect the immutable APK's build sidecar/source attestation on Futwick before
claiming equivalence; no Futwick or production server access was attempted.

## Investigation and decision

The native extractor rejects palette candidates with Oklab chroma below 0.04,
or lightness outside 0.10 to 0.96. Its separate strict image-wide monochrome
checks reject subtle coherent tints. Previously, visible decoded artwork with
no surviving hue bucket and a failed monochrome check returned null, conflating
valid muted artwork with decode failure. The controller published a null accent,
and resolveArtworkAccent selected default Blue (#1D9BF0).

The unmodified production Kotlin pixel math was executed on seven screenshot
samples from the issue: Saturnalia and Seven Wonders returned null; Can't
Maintain and Raise Our Voices returned metadata-only monochrome results; the
three colourful controls produced palettes recorded in the fixture file.
This supports the mechanism for these screenshots, not proof about the original
cached pixels or exact APK. Original/cached artwork was unavailable here.

Use the existing neutral presentation result for visible artwork with no eligible
hue bucket. Do not loosen chroma thresholds or alter colourful hue selection.
The existing monochrome flag now also requests neutral presentation for this
case; its contract comment states that meaning explicitly. A new enum/flag or
JavaScript pixel processing would add unnecessary API and implementation work.

## Implementation

- Kotlin and Swift return {dark: null, light: null, monochrome: true} whenever
  visibleCount is positive but no primary hue bucket survives.
- Decode failure and no visible pixels still return null/nil. Alpha acceptance
  remains at least 128. Existing image-wide neutrality checks for images with
  surviving hues, hue scoring, secondary selection and contrast/gamut math are
  unchanged.
- The existing controller maps the neutral result to dark #909090 / light
  #505050. No runtime JavaScript changes are needed. The gradient hook already
  treats null modes as no palette, so the existing gradient fallback is preserved.
- Static preferences, Repeat, Shuffle, progress and navigation source are unchanged.
- Extended the existing native harness with empty/low-alpha buffers and seven
  compact, provenance-labelled screenshot pixel samples. It asserts both full
  gradient variants for the three colourful controls and null modes for the four
  neutral album cases. Warm/cool grey, sepia and olive gap cases now expect neutral.
- Parameterised the existing controller test over the seven album expectations;
  existing failure, stale-result, static preference and gradient tests remain.

## Validation performed

- Baseline focused Jest: 12 suites / 80 tests passed (Android and iOS configurations).
- New native expectations failed before correction: Saturnalia returned null;
  adding the synthetic gap expectations also reproduced warm grey returning null.
  A separate diagnostic execution of the old extractor also recorded null for
  both failing album samples and all original colourful palette values.
- Corrected production Kotlin math: all 22 fixtures passed using Kotlin 2.2.21
  and Java. The Python harness compiles production pixel math; it does not build
  an Android module/APK or validate image decoders/Expo/device rendering.
- Swift harness skipped because swiftc is unavailable. Equivalent source change
  reviewed, but Swift execution and iOS device acceptance are not claimed.
- Final focused Jest with isolated dependencies: 14 suites / 106 tests passed,
  including controller, PlayerTabBar, useTheme, useImagePalette, shared palette
  service, accent resolver and theme store, in both Jest platform configurations.
- TypeScript: passed after dependency isolation. An initial attempt resolved
  expo-image-colors through the original master's dependencies and failed against
  its older Palette type; isolated worktree-local module resolution removed those
  errors without production workarounds or dependency/lockfile changes.
- Intl and native module inventory validators passed. Translation validation passed
  with the existing 2,351 missing-key warnings awaiting Crowdin sync.
- Madge processed 891 files and found no circular dependencies (107 warnings).
- Existing neutral contrast independently checked: #909090 vs #121212 5.87:1,
  vs #181818 5.56:1, vs white 3.19:1; #505050 vs #f5f5f5 7.40:1 and white 8.06:1.
- Full Jest: the initial run was interrupted after dependency resolution changed
  while it was running. It mixed original-checkout React Native paths and local
  Expo paths, causing suite-initialisation errors (`null.match` in getDevServer).
  This is not a valid full-suite result. All four affected suites passed in a
  fresh isolated recheck (8 platform suites / 184 tests). The fresh full run
  with stable isolated dependencies and two workers PASSED: 662 suites and
  11,518 tests; 2 suites and 8 tests skipped. Runtime 309.459 seconds.
  Command: npx jest --no-coverage --maxWorkers=2.
  The unrelated normalizedLibrarySync suites passed in the initial run after
  about 130 seconds each. A separate diagnostic invocation exceeded a 60-second
  wall-time limit (exit 124); it was incomplete, not a failed assertion.
- Complete staged diff and whitespace review passed. All nine changed files
  are limited to the native correction, contract comments, regression tests and
  fixture provenance, and this diary. No generated native, version, signing,
  manifest, release or deployment files changed. The original checkout remains
  clean on work at 2ee497cdc442de45589c2f685367c0d6afbe645b.

## Reproduction commands

With kotlinc/java and optionally swiftc on PATH:

```sh
python3 scripts/test-image-palette-native.py -v
npx jest --no-coverage --runInBand \
  src/components/__tests__/ArtworkAccentController.test.tsx \
  src/components/__tests__/PlayerTabBar.test.tsx \
  src/hooks/__tests__/useTheme.test.ts \
  src/hooks/__tests__/useImagePalette.test.ts \
  src/services/__tests__/artworkPaletteService.test.ts \
  src/utils/__tests__/resolveArtworkAccent.test.ts \
  src/store/__tests__/themeStore.test.ts
npx tsc --noEmit
```

## Outstanding acceptance and safe handoff

- On Futwick, inspect branch, HEAD, remotes, worktrees and all tracked/untracked
  changes before integration. Do not assume the local sanctifi branch equals the
  base. Fetch the feature branch, review its single commit and compare intervening
  edits to the affected files. Do not reset, clean, force checkout or auto-stash.
- Prefer a new review worktree based on the local committed sanctifi revision,
  leaving existing uncommitted work untouched. Check whether the fix is already
  included. Cherry-pick only after the actual state and overlap have been reviewed;
  resolve any conflicts deliberately or abort that cherry-pick in the new worktree.
- Run the relevant checks again on the integrated revision. Original/cached covers
  should supplement screenshot samples before accepting exact pixel outcomes.
- The owner will build/reinstall the native Android app and test all seven albums
  in both themes, including track transitions/cache hits, progress, active Repeat,
  selected navigation, unchanged Shuffle, colourful gradients and readability of
  the Repeat One badge. Also check unreadable/missing/transparent artwork and
  static preferences. No device-level acceptance is claimed here.
- Run the Swift harness on a Swift-equipped host and perform iOS native/device
  validation separately. No merge or release publication is part of this handoff.

## 2026-11-03 — Futwick integration, Android acceptance and Alpha publication (follow-up)

This section records subsequent owner/assistant work after the isolated implementation handoff above; the original investigation and outstanding-acceptance list are retained as historical records.

- Futwick's clean local `sanctifi` was verified at `c48e6e26`, the exact implementation base. The feature branch's one commit `9525414eed67114bc516c5779624c0d913e4d3d4` was fetched and fast-forward merged into local `sanctifi`, without touching other worktrees.
- On Futwick, focused Jest passed 14 suites / 106 tests across Android and iOS test configurations; `npx tsc --noEmit` passed. The native palette harness reported two skips because neither `kotlinc` nor `swiftc` was installed locally; this is **not** local native-harness validation.
- `./gradlew assembleRelease` completed successfully in 11m 53s. The signed local test APK was verified as `fi.sancti.client`, `versionCode 80000193`, `versionName 8.1.8`, valid v2 signature. Local test APK SHA-256: `50d95670633bd3b11c6afe256f649fa4dba722e52135e3fc34206755aca3a908`. This was a test build, **not** the previously published Alpha 80000193.
- The owner tested the corrected Android build on device and supplied screenshots for The Wedding Present — *Saturnalia*, Cinerama — *Seven Wonders of the World*, and Leonard Cohen — *Songs from a Room*. All showed neutral grey accents rather than the inappropriate bright blue. The owner explicitly accepted the result as **PASS**, noting that grey is less conspicuous but preferable. This acceptance does not assert exhaustive seven-cover, two-theme, cache/transition, or iOS device testing.
- The established Futwick local build workflow created numbered Alpha candidate `80000194`. Read-only publication preflight reported `sanctifi-80000194.apk`, SHA-256 `183b04e37fa6efa90fd8edaaaf15f5d657cda218e02353f5d7cce0fc46dd39a4`, `versionName 8.1.8`, previous Alpha `80000193`, and no remote APK collision.
- The owner executed `node scripts/android-publish.js publish 80000194` with release notes: “Further work to extract a suitable accent colour based on not-quite-monochrome Album Art”. The log confirmed immutable upload to Obscurity, remote checks, full public HTTPS APK verification, explicit `PUBLISH 80000194` approval, Alpha manifest promotion, and local publication record at `/media/data/Complete/Sanctifi/Releases/sanctifi-80000194.apk.publication.json`.
- The owner committed `app.json` versionCode alignment as `847619b5` (`chore(android): align versionCode with published Alpha 80000194`). The generated `android/` directory remained Git-ignored and was not force-added. `git push origin sanctifi` succeeded, advancing GitHub `sanctifi` from `c48e6e26` to `847619b5`, including the fix commit `9525414e`.
- Outcome: **Issue #74 resolved and released on Android in Alpha 80000194**. Swift native-harness and iOS device validation remain unperformed and are not implied by closure. Further neutral-grey salience refinements, if desired, should be separately scoped rather than silently added to this bug fix.
