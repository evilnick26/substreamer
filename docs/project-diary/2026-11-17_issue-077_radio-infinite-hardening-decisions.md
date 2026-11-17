# Issue #077 — Radio Infinite: hardening, decisions and validation

**Date:** 2026-11-17
**Project:** sancti.fi Client
**Status at end of session:** Implementation and automated validation complete; refreshed Android APK build and post-build verification pending.

## Objective

Complete and harden Radio Infinite for the sancti.fi client, retaining standard playback behaviour when the feature is inactive and ensuring a predictable fallback when Offline Mode is enabled. Validate the integration with the sancti.fi radio bridge and AudioMuse-AI (AMA) before external testing.

## Investigation and findings

- Radio Infinite is a fourth repeat mode: **Off → All → One → Radio → Off**.
- The client uses the sancti.fi radio bridge at `https://radinf.sancti.fi/radio/recommendations`, with AMA supplying recommendations. The bridge accepts token-and-salt authentication and seed song IDs; the client resolves returned IDs via OpenSubsonic `getSong`.
- On-device testing exercised repeated near-end-of-queue replenishment against the live bridge/AMA integration. Seven successful requests returned 20 candidate IDs each. After duplicate/adjacency filtering and resolution, each refill appended **10** tracks. Observed queue growth: **97 → 107 → 117 → 127 → 137 → 147 → 157**. No request errors were observed; manual inspection found no duplicate songs or adjacent same-artist/same-album selections in those results.
- The initial full Jest run found **four failing suite instances** (two test files across Android and iOS) because importing `playerService` now also loaded `radioInfiniteService`, which imports `expo-crypto`. The Jest environment failed in `expo-constants` while resolving `EXDevLauncher`.
- After mocking `expo-crypto` in those two tests, the hydration tests exposed a second pre-existing mock mismatch: `offlineModeStore.subscribe` was absent from the test double, although the new offline-fallback initialisation legitimately subscribes to that store.
- The downloaded-playback test subsequently passed but emitted `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`: its ordinary track-change event unconditionally attempted a dynamic import of the Radio Infinite controller, even when Radio mode was not active.

## Decisions and rationale

1. **Keep authentication intact.** Radio Infinite continues to use cryptographically random salt generation and MD5 token calculation through `expo-crypto`, matching the bridge protocol. No production authentication changes were made to accommodate Jest.
2. **Offline fallback is explicit and one-way.** When Offline Mode is enabled while Radio Infinite is selected, change repeat mode to the persisted user preference (`all` by default, or `off`). Do not automatically restore Radio when connectivity returns. Keep native repeat mode synchronised with semantic repeat state.
3. **Preserve the dynamic import.** The Radio Infinite service imports `addToQueue` from `playerService`, so the controller remains dynamically imported to avoid a static import cycle. However, load it from track-change events **only when repeat mode is `radio` and Offline Mode is disabled**. Retain the controller's own safety checks.
4. **Fix incomplete test doubles rather than weakening production logic.** Add the established `expo-crypto` mock to the two affected test files and a no-op `subscribe` method to the hydration test's offline-mode store mock.
5. **Remove routine diagnostic logging before the tester build.** The temporary Radio Infinite informational logs used during live testing were removed; warning/error diagnostics remain.
6. **Keep settings presentation compact.** The Offline Mode fallback explanation is separate from a short dropdown offering **Repeat All** and **Repeat Off**, avoiding clipped text in the selected control.

## Implementation

Relevant areas changed during Issue #077 include:

- `src/services/radioInfiniteService.ts`: recommendation request, authenticated bridge call, song resolution, filtering and bounded queue append; temporary routine `console.info` diagnostics subsequently removed.
- `src/services/radioInfiniteFilter.ts`: eligibility and adjacency filtering.
- `src/services/playerService.ts`: repeat-mode integration, offline fallback reconciliation, serialized native repeat updates, near-end refill trigger and conditional dynamic controller import.
- `src/store/playbackSettingsStore.ts`: Radio mode, repeat generation and persisted offline fallback preference.
- `src/components/settings/RadioInfiniteCard.tsx` and `src/i18n/locales/en.json`: Sound & Playback fallback settings and layout polish.
- `src/services/__tests__/radioInfiniteService.test.ts`: refill orchestration tests.
- `src/services/__tests__/playerService.hydration.test.ts` and `src/services/__tests__/downloadedFilterPlayPath.test.ts`: mock `expo-crypto`; hydration test also supplies the required offline-mode subscription method.

The client app version in `app.json` was intentionally adjusted for the APK build; this is not an unresolved code issue. Temporary patch scripts were removed from the repository root after use.

## Validation

- Live Android device: seven successful Radio Infinite refills via the bridge/AMA path; queue expanded in increments of ten; no observed errors in the captured logs.
- Earlier focused Radio Infinite/related validation: **268 tests passed** across six suites in both Jest projects.
- After test compatibility and conditional import fixes: focused hydration/downloaded-playback run **4 suites passed, 24 tests passed**, Android and iOS, **zero warnings**.
- Final complete Jest run: **670 suites passed; 2 skipped (672 total). 11,742 tests passed; 8 skipped (11,750 total). Zero failures.** Runtime **766.136 seconds**, across both Jest projects.
- TypeScript (`npx tsc --noEmit`) and `git diff --check` were clean during the regression-fix sequence. The final full-suite report establishes test success; a post-build validation result has not yet been recorded.

## Outstanding work and release boundary

- Build the refreshed Android APK **without the temporary Radio Infinite informational logs** and perform the intended on-device verification. The user began this build process after the full Jest pass; its result was not yet reported in this session.
- Record the resulting APK/version, signing/build outcome and any final device observations when available.
- **Issue #083** (AMA functional watchdog) was opened separately and is parked for a new conversation after #077 testing/build work. Its proposed design is not implemented or deployed.
- **Issue #084** (hide Navidrome scrobbling controls in Settings → Library & Data while retaining functionality) was opened separately and explicitly deferred until after #083.

## References

- GitHub: [Issue #083 — AMA functional watchdog design](https://github.com/evilnick26/substreamer/issues/83)
- GitHub: [Issue #084 — Hide Navidrome scrobbling controls](https://github.com/evilnick26/substreamer/issues/84)
- Issue #077 development discussion and test outputs, 2026-11-17.

**Diary note:** This entry records the state known at the end of the session. Add later build/test results as a dated follow-up rather than retroactively claiming they had already passed.
