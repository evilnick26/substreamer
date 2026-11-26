# 2026-11-26 — Issue #095 — Configurable Radio Infinite duration limits

## Objective

Replace Radio Infinite's hardcoded minimum and maximum track durations with persistent, user-configurable preferences in Sound & Playback Settings.

This issue was identified during the initial investigation of #87 and #88. It was deliberately implemented first so that the forthcoming adaptive recommendation recovery mechanism can reuse the configurable duration policy.

## Investigation

- Examined the existing Radio Infinite recommendation service and eligibility filter.
- Confirmed the existing inclusive duration limits of 90–480 seconds.
- Investigated playback settings persistence, dropdown components, global settings reset behaviour and existing test coverage.
- Confirmed that no database migration, server modification or AudioMuse-AI change was required.

## Decisions

- Retain 1:30 and 8:00 as the default limits.
- Provide independent minimum and maximum duration dropdowns.
- Allow unrestricted minimum and maximum durations independently.
- Prevent inverted duration ranges through both UI option filtering and store-level validation.
- Permit identical minimum and maximum durations.
- Continue rejecting missing, zero, negative and non-finite track durations, even when both limits are unrestricted.
- Store durations semantically as seconds, with zero representing no minimum and null representing no maximum.
- Keep the underlying duration model independent of the available UI presets.
- Apply the latest duration preferences immediately before recommendation filtering.
- Do not retrospectively modify existing queue contents.
- Keep duration filtering exclusive to Radio Infinite.
- Provide a dedicated duration reset action alongside integration with the existing global Sound & Playback reset.

### Available duration options

Minimum, in seconds:

`0, 15, 30, 45, 60, 90, 120, 150, 180, 240, 300`

Maximum, in seconds:

`120, 180, 240, 300, 360, 420, 480, 540, 600, 720, 900, 1200, 1800, 3600, null`

## Implementation

Created `src/services/radioInfiniteDuration.ts` as the shared duration policy module.

Extended `playbackSettingsStore.ts` with persistent duration preferences, validation, atomic reset and safe hydration of existing or invalid persisted settings.

Updated `radioInfiniteFilter.ts` and `radioInfiniteService.ts` to consume the configurable policy while preserving existing recommendation eligibility, duplicate prevention, adjacency filtering and batch-size behaviour.

Extended `RadioInfiniteCard.tsx` with duration dropdowns, contextual help and a dedicated reset action.

Updated the global Sound & Playback reset and English translation resources.

Added automated coverage for persistence, validation, inclusive boundaries, unrestricted durations, invalid metadata, in-flight preference changes and preservation of existing queue contents.

### UI refinement

Initial Android acceptance identified that the duration reset action appeared to be informational grey text rather than a pressable control.

Investigated existing Sync, Back Up, Restore and Reset buttons.

Adopted the established global Reset to Defaults button styling from the same Settings screen, including an outlined boundary, refresh icon, primary text colour and pressed-state feedback.

Added an explicit accessibility button role.

An initial incorrect Ionicons import caused TypeScript and build failures. Corrected this to use the existing static Ionicons implementation. No additional dependency was introduced.

## Validation

### Automated validation

- Targeted Jest tests: 204/204 passed across six suites and both platform projects.
- TypeScript validation: passed.
- Git diff whitespace validation: passed.
- Translation validation: all 13 locales validated, with missing-key warnings handled through the existing fallback mechanism.

### Wider regression suite

Full Jest run:

- 665 suites passed.
- 5 suites failed.
- 2 suites skipped.
- 11,879 tests passed.
- 11 tests failed.
- 8 tests skipped.

Investigated the failures by temporarily stashing the #95 implementation and testing the clean baseline at commit `6ac55d2d`.

Ten inline lyrics-related failures were reproduced on the unchanged baseline across the Android and iOS test projects.

Affected files:

- `src/screens/player/__tests__/player-phone-portrait.test.tsx`
- `src/components/player/__tests__/PlayerTabletLandscape.test.tsx`

Failures concerned cached lyrics visibility, progress component replacement and restoration, portrait layout, navigation and rotation behaviour.

A possible relationship with #94 was noted but not established.

The remaining failure concerned closing MoreOptionsSheet when a favourite toggle fails. An isolated rerun with the #95 implementation restored passed all 256 tests across both platform projects.

This failure was not reproduced. An intermittent timing issue is suspected but remains unconfirmed.

No regression attributable to #95 was identified.

### Android validation

Initial functional acceptance: 11/11 passed.

Verified defaults, dropdown options, incompatible range prevention, equal boundaries, unrestricted limits, persistence across restart, dedicated reset, global reset, recommendation filtering, preservation of existing queue contents and unaffected ordinary playback/PMLT behaviour.

Live Radio Infinite testing demonstrated newly appended recommendations respecting a configured 4:00–5:00 duration range while retaining previously queued shorter tracks.

Following the reset button refinement:

- Release APK build successful in 6m 14s.
- APK signature verified using v2 with one signer.
- Additional Android acceptance checks: 4/4 passed.
- Screenshots confirmed the outlined reset button with custom limits and its disappearance after restoring 1:30–8:00.

Total Android acceptance: 15/15 passed.

## Outstanding work

No outstanding implementation or acceptance defects identified for #95.

The pre-existing inline lyrics test failures require separate investigation and issue tracking.

The non-reproduced MoreOptionsSheet failure should remain noted for future investigation if it recurs.

The temporary baseline-investigation Git stash was retained as a recovery copy.

Proceed with #87 before #88.

When implementing #88, revisit whether duration preferences should be captured once per logical multi-stage refill to ensure consistent filtering across recovery stages.

## References

- Issue #95 — Configurable Radio Infinite duration limits.
- Issue #77 — Original Radio Infinite implementation.
- Issue #86 — Original duration eligibility filtering.
- Issue #87 — Primary Seed lifecycle.
- Issue #88 — Adaptive recommendation recovery.
- Issue #94 — Lyrics finalisation; possible but unconfirmed relationship to baseline test failures.
- Baseline commit: `6ac55d2d`.
- Implementation commit: `1f4f09a5`.
- Branch: `sanctifi`.
- Implementation committed and pushed successfully.
- Working tree clean following implementation commit.

## Outcome

Implementation and Android acceptance complete.

Radio Infinite now supports persistent, configurable track duration limits without changing the underlying audio, server interfaces or ordinary playback behaviour.
