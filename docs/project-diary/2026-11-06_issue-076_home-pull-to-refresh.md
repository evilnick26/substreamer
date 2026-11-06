# sancti.fi Client — Project Diary

**Date:** 2026-11-06  
**Issue:** #076 — Home tab pull-to-refresh  
**Status:** Completed; released to Alpha testers

## Objective

Allow users to refresh the custom Home tab's Recently Uploaded albums by pulling down on Home itself, without having to visit Library and refresh there first.

## Investigation

- The custom Home screen is implemented in `src/screens/sanctifi-home.tsx`, rather than the original Substreamer `home.tsx`.
- Home already refreshes on focus using `albumListsStore.getState().refreshRecentlyAdded(20)` and renders the resulting Zustand `recentlyAdded` list.
- The existing `ScrollView` supports React Native's `RefreshControl`; no new scrolling component is required.
- `refreshRecentlyAdded` delegates to `persistList`, which fetches from the server, reconciles ratings, updates the local SQLite list and Zustand store, and prefetches artwork. It returns a boolean success indicator, retains prior data on failure, and guards against stale requests.
- The Library's refresh controls live in its child lists; copying the Library wrapper would be inappropriate.

## Decisions

- Reuse `refreshRecentlyAdded(20)` rather than introduce another refresh path, database operation, or broader sync mechanism.
- Keep existing album rows visible while the user performs a manual refresh.
- Disable manual refresh when Home is offline, consistent with existing connectivity behaviour.
- Limit implementation to `src/screens/sanctifi-home.tsx`; no store/schema change.
- Preserve the unrelated `app.json` Android version-code modification rather than include it in the feature commit.

## Implementation

- Added a `RefreshControl` to Home's `ScrollView`, a local `refreshing` state and an asynchronous refresh handler.
- Connected the indicator to the existing theme and guarded against offline/repeated refresh requests.
- An initial supplied patch did not apply; a corrected v2 patch applied successfully.
- Feature commit: `a5fa9994` — `feat(home): add pull-to-refresh (#76)` on `sanctifi`, pushed to `origin/sanctifi`.

## Validation

- `git apply` succeeded for corrected patch; `git diff --check` passed.
- `npx tsc --noEmit` completed without errors.
- Android build and on-device behaviour reported successful by the project owner.
- Git push succeeded; local `sanctifi` and `origin/sanctifi` aligned at `a5fa9994`.
- Working tree still had an intentional, unrelated `app.json` change; this was not included in the feature commit.

## Alpha publication

- Published **Alpha 80000197** (version name **8.1.8**), superseding **80000196**.
- Release notes: “Added Pull to Refresh to our Home tab”.
- APK: `https://updates.sancti.fi/client/apks/sanctifi-80000197.apk`
- SHA-256: `9943e24b7ac2e71374492ead2e7b9368f68fa2e265716ebd51683dcc4292c405`
- Publisher reported immutable APK upload, public HTTPS download verification, Alpha manifest promotion and publication record creation.
- Publication record: `/media/data/Complete/Sanctifi/Releases/sanctifi-80000197.apk.publication.json`.

## Outstanding work

- No outstanding implementation work for #076. Gather routine feedback from Alpha testers.
- Commit this diary entry to the repository separately from application code.

## References

- GitHub issue: https://github.com/evilnick26/substreamer/issues/76 (closed as completed)
- Commit: https://github.com/evilnick26/substreamer/commit/a5fa9994
