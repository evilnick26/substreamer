# sancti.fi Client - Project Diary
## 31 October 2026 - Issue #011: Monochrome artwork accents

### Root cause

The existing Kotlin and Swift extractors reject pixels with Oklab chroma below
0.04, as well as near-black and near-white pixels. With no surviving hue bucket,
they return null, the same result as missing/unreadable artwork. The shared
artwork palette service caches that result; ArtworkAccentController publishes a
null accent palette; resolveArtworkAccent substitutes default Blue (#1D9BF0).
The filtered palette alone cannot distinguish monochrome from extraction failure
or subtle coloured artwork.

### Targeted correction

- Both native extractors accumulate image-wide statistics during their existing
  pixel pass, before lightness/chroma rejection. No extra image decode, pixel
  pass, JavaScript image processing or runtime dependency is introduced.
- Only pixels with alpha at least 128 count, matching existing extraction.
  Monochrome requires all three conditions: at most 0.5% of visible pixels have
  Oklab chroma above 0.02; average chroma is at most 0.01; and chroma of the
  average Oklab a/b vector is at most 0.003. The population guard preserves
  coloured details on grey backgrounds; the mean-vector guard preserves subtle
  coherent warm, cool, sepia and olive tints. This does not inspect only the
  dominant hue or assume that secondary=null means greyscale.
- Successful monochrome extraction carries a monochrome flag, with null gradient
  modes when no hue bucket survives. Decode failures and fully transparent
  images still return null. Chromatic palette calculations are unchanged.
- ArtworkAccentController maps the flag to #909090 in Dark theme and #505050 in
  Light theme. The existing theme hook selects the cached variant on explicit
  or system theme changes, without track changes or native re-extraction.
- #909090 has contrast 5.87:1 against #121212, 5.56:1 against #181818, and 3.19:1
  against white icons. #505050 has contrast 7.40:1 against #f5f5f5 and 8.06:1
  against white. Existing primary-colour alpha/mix/pressed consumers receive
  ordinary neutral hex values. No accent-picker, preference or persistence changes.
- useImagePalette treats metadata-only results like its previous null result,
  preserving the Now Playing gradient fallback and opacity. Sparse colour noise
  may still supply the exact previous gradient palette; only the global accent
  uses the monochrome flag.

### Files

Native Kotlin/Swift extractors; the expo-image-colors TypeScript contract and
algorithm documentation; ArtworkAccentController; useImagePalette; controller,
gradient and theme hook regression tests; scripts/test-image-palette-native.py;
this diary entry. No server, audio-tag or OpenSubsonic changes.

### Validation

- Before implementation, the new controller regressions reproduced both the
  metadata-only blue fallback and the unwanted accent from sparse colour noise:
  four failures across the Android/iOS Jest projects, with existing tests passing.
- Focused Android/iOS regression run: 12 suites, 80 tests passed (including a final explicit-Blue regression). Includes normal
  colour palettes, monochrome variants, explicit/system theme changes, static
  selection, absent/unreadable artwork, stale results and unchanged gradients.
- Standalone Kotlin harness compiles and runs the production extraction math:
  13 fixtures passed, including black, white, greyscale, minor noise, coloured
  detail on grey, a single coloured hue, warm/cool grey, sepia, olive, multicolour
  with a neutral majority and fully transparent pixels. Chromatic primary
  colours are also checked against values recorded from the original extractor.
- A separate before/after Kotlin comparison verified identical dark/light
  gradient palettes for all 13 fixtures, including sparse colour noise.
- TypeScript, Intl validation, translation validation, module inventory and
  circular-import validation passed. Translation validation retains its existing
  2,351 missing-key warnings awaiting Crowdin sync; no locale files changed.
- Full Jest regression run: 662 suites and 11,472 tests passed; 2 suites and
  8 tests skipped, no failures. A subsequent focused run also checked the final
  test-only addition for an explicit Blue preference with no system scheme.
- Focused coverage: controller 96.77% statements / 90.9% branches; gradient hook
  100% / 100%; theme hook 100% / 80%. All three have 100% line coverage.
- Reproduce focused checks with `npx jest --no-coverage --runInBand
  src/components/__tests__/ArtworkAccentController.test.tsx
  src/hooks/__tests__/useTheme.test.ts src/hooks/__tests__/useImagePalette.test.ts
  src/services/__tests__/artworkPaletteService.test.ts
  src/utils/__tests__/resolveArtworkAccent.test.ts src/store/__tests__/themeStore.test.ts`.
  Run native fixtures with `python3 scripts/test-image-palette-native.py -v`
  with kotlinc/java and/or swiftc on PATH.

### Limits and acceptance

Swift fixture execution is skipped because swiftc is unavailable. The standalone
native harness validates extraction math, not image decoding or the Expo bridge;
no full Android/iOS build or device screenshots were produced here. Both native
modules must be rebuilt before visual acceptance testing. The neutrality thresholds
are deliberately conservative heuristics: tiny coloured areas within the stated
noise limits may be treated as artefacts. Final visual acceptance and issue
closure remain with the project owner. No push, PR or issue mutation is performed.
