# Issue 065 - NPS AMA button

Date: 2026-11-02
Status: Approved implementation complete and automated checks passed. Ready for review; device acceptance remains pending.

## Baseline and workflow

Initial checkout was clean on branch work at upstream master 2ee497cdc442de45589c2f685367c0d6afbe645b. Remote inspection identified sanctifi as the product branch. Fetched sanctifi and created issue-065-nps-ama-button at d0e7a7c8. Unrelated tracked files have not been changed. User authorises commit, push and PR but forbids merging into a shared branch. AGENTS.md requires plan approval before implementation; the owner approved the concrete plan and explicitly authorised implementation, commit, push and a PR against sanctifi without merging. Full plan is in gitignored plans/issue-065-nps-ama-button.md.

## Investigation

Four visible Bookmark placements exist on sanctifi:
- src/screens/player/player-phone-portrait.tsx
- src/components/player/PlayerPhoneLandscape.tsx
- src/screens/player/player-tablet-portrait.tsx
- src/components/player/PlayerTabletLandscape.tsx

The landscape phone is rendered by the portrait screen's landscape branch and uses its header overflow source, player-phone-portrait. All player overflow contexts share src/components/MoreOptionsSheet.tsx. The existing BookmarkButton shares one handler for snapshot capture, automatic collision-safe naming, immediate save with success feedback, or manual naming through bookmarkSheetStore. It is disabled for an empty queue. There is no Bookmark overflow row yet.

Play More Like This already uses services/moreOptionsService.ts playMoreLikeThis. buildMoreLikeThisQueue seeds its deduplication set with source.id, calls getSimilarSongs(source.id), and fills through artist similarity, genre random songs and artist top songs. It plays tracks[0] from the result. Each invocation makes new calls; no seed prepend or deterministic cache is present. Client calls Subsonic similarity endpoints rather than a direct AMA service. Server-side AMA routing and real service availability have not been independently exercised here. Existing device observations in issue 65 are the owner's evidence, not cloud device validation.

On missing recommendations, existing processing overlay reports noSimilarSongsFound and does not call playTrack. Exceptions report failedToLoadSimilarSongs. Subsonic getSimilarSongs and getSimilarSongs2 return empty arrays on endpoint errors. Preserve these functions verbatim.

## Implementation

Added shared PlayMoreLikeThisButton using the existing radio-outline icon, translated label, original caller styles, size 24 and hitSlop 8. Disabled with no current track or offline. Replaced all four placements without changing their styles. Extracted the existing bookmark callback into useBookmarkAction; the existing reusable button and single player-only overflow row share it. Snapshot and suggested name are captured at tap time before awaiting overflow teardown; both naming paths keep that snapshot. Bookmark remains available offline and disabled for an empty queue. The existing recommendation overflow action remains available. No recommendation, queue, native, production dependency or unrelated controls changes. No unexpected architectural complications were found.

## Validation and outstanding work

Baseline sanctifi: typecheck passed; full Jest passed (662 suites, 11,474 tests, two suites/eight tests skipped). Focused baseline passed (8 suites, 298 tests). Intl and translation validators passed with existing missing-translation warnings. The initial circular check could not run because madge was absent and the default npm cache was not writable. Installed madge 8.0.0 (verified current npm version) only under gitignored local work/tools, without changing project dependencies. Final circular check passed (686 files; 93 resolution warnings).

Focused implementation regression passed (12 Android/iOS suites, 606 tests) before the final shared-handler and styling cases were added. Final focused coverage passed (4 Android/iOS suites, 396 tests): PlayMoreLikeThisButton and useBookmarkAction both reached 100% statements and branches. Final typecheck, Intl/translation validation and whitespace checks passed. Full final regression passed: 662 suites, 11,514 tests; existing two suites/eight tests skipped (494.757 seconds). New tests cover each of four rendered layouts invoking the existing service, one button/no visible Bookmark, offline/no-track disabling, phone portrait-landscape-portrait state preservation, current-track updates, player-only Bookmark visibility including offline, empty queue, auto/manual naming, delayed modal teardown and tap-time snapshot retention. A service regression verifies two fresh responses for the same seed start from different recommendations and exclude the seed. Existing service tests cover empty/error results, seed exclusion and ordered fallbacks. The tablet-landscape action test uses expandProgress=1, matching its expanded touch-enabled state.

No adb or emulator command is installed. Native Android build, device screenshots, touch targets, clipping and real rotation/playback acceptance remain untested. Symdex tools are unavailable; used rg/source reads.

## Integration and futwick acceptance (after implementation)

Review the issue PR against sanctifi. Do not merge until approved. On futwick, check local git status and preserve unpublished work, fetch the issue branch, review its diff against the actual local sanctifi integration baseline, then integrate only with owner approval. Use the established Android release build/signing workflow; do not infer a new build command or overwrite signing configuration. Install as an in-place update with the established package identity; preserve app data.

Test phone portrait and landscape plus tablet orientations when available. Confirm one visible recommendation button, Bookmark once in overflow, auto/manual names and tap-time saved queue/position. Verify first generated track is a recommendation, repeat the same seed, exercise AMA unavailable/network errors and offline mode while checking normal transport remains functional. Rotate during playback and with menus open; check queue/current position persist without duplicate actions or spontaneous playback changes. Inspect small widths, enlarged text, accessibility labels, hit areas, clipping and overlap. Record actual device/build identifiers and results separately from automated checks.


## Changed files

- src/components/PlayMoreLikeThisButton.tsx (new shared control)
- src/hooks/useBookmarkAction.ts (extracted existing bookmark handler)
- src/components/BookmarkButton.tsx (uses shared handler)
- src/components/MoreOptionsSheet.tsx (one player-only Bookmark row)
- src/screens/player/player-phone-portrait.tsx
- src/screens/player/player-tablet-portrait.tsx
- src/components/player/PlayerPhoneLandscape.tsx
- src/components/player/PlayerTabletLandscape.tsx
- src/screens/player/__tests__/player-phone-portrait.test.tsx
- src/components/player/__tests__/PlayerTabletLandscape.test.tsx
- src/components/__tests__/MoreOptionsSheet.actions.test.tsx
- src/components/__tests__/MoreOptionsSheet.test.tsx (mock wiring for the added hook)
- src/services/__tests__/moreOptionsService.test.ts
- Project-Diary/2026-11-02_issue-065_nps-ama-button.md

## futwick commands and release constraints

After review, start with `git status --short --branch`, `git fetch origin`, and `git diff sanctifi...origin/issue-065-nps-ama-button --stat`. Review unpublished local sanctifi commits too; do not reset or overwrite them. Test from a separate branch/worktree if needed. Integrate through the reviewed PR or approved cherry-pick only after explicit merge approval; this session does neither.

Run `npx tsc --noEmit` and `npx jest --no-coverage`. For release preparation, consult `node scripts/android-release.js prepare --help` and the existing futwick release procedure. Changed release APK bytes require the established separately approved version allocation/signing workflow; do not use `--intent keep` to rebuild modified source. Do not allocate a version, regenerate native metadata or publish updates as part of this issue branch. Build with the approved release configuration, verify APK identity/signature, and install with data retained (package fi.sancti.client). Record the issue commit and resulting build code with device acceptance.

## Handover status

All 14 intended files reviewed; recommendation/Subsonic/playback service implementations remain byte-for-byte unchanged from the branch base. Issue branch is issue-065-nps-ama-button; PR targets sanctifi. The resulting commit/PR identifiers are supplied in the development handover. No merge or issue closure is authorised or performed. Device/native build, visual screenshots, live AMA/network acceptance and physical orientation testing remain outstanding as described above.

## Approved overflow cleanup follow-up (2026-11-02)

The owner reports that build 80000192 successfully displayed the dedicated recommendation button in portrait and landscape, and requested removal of both Add bookmark and the redundant recommendation entry from player overflow. This is a product decision to keep playback bookmarks unexposed, not a request to remove their infrastructure.

Futwick was not mounted in the cloud environment. Implementation waited until the owner transferred issue-065-nps-overflow-cleanup to GitHub. Fetched that branch, verified its HEAD exactly matched b5577d83789f248ea7b452664dc9c1a4a0b9d71c (including the integrated issue 67 builder), and worked only on that branch. No older cloud baseline was substituted.

MoreOptionsSheet.tsx removes the Bookmark row and its unused hook import/call and queue-length subscription. The existing recommendation visibility predicate now excludes player sources; default and playlist-detail song menus retain their existing service action. No other row, handler or ordering changed. Player-source queue-row menus share this predicate. Dedicated recommendation button and all four phone/tablet orientation layout files remain byte-for-byte unchanged. Bookmark hooks, components, services, stores, tables and data remain intact.

Updated MoreOptionsSheet.actions.test.tsx to replace obsolete exposed-Bookmark menu cases with player-source absence checks online/offline and non-player recommendation invocation checks. Existing standalone Bookmark handler and service coverage remains. Changed files are this diary, that test file and MoreOptionsSheet.tsx only.

Validation: npx tsc --noEmit passed. Focused Jest passed on Android and iOS: 10 suites, 460 tests (50.184 seconds), covering both menu suites, phone portrait/landscape/tablet portrait, tablet landscape and bookmarkService. git diff --check passed. Full regression and broader validators were not rerun for this small follow-up. No cloud device, screenshot, native APK or live AMA checks performed; physical overflow acceptance remains outstanding.

No versionCode, app.json, signing or builder changes; no APK build/publication, force push, rebase or merge. Futwick's established build checkout, generated Android directory, uncommitted 80000192 versionCode and archived APK were not accessed or changed.

Integration after explicit approval: fetch origin in the verified clean Futwick follow-up worktree and fast-forward that branch with git merge --ff-only origin/issue-065-nps-overflow-cleanup. Review the three-file diff against b5577d83. Do not integrate into the established sanctifi build checkout until authorised. After approval, inspect its status and staged/unstaged app.json diffs, fetch origin, and cherry-pick the reviewed cleanup commit only; stop on any conflict without discarding local work. Recheck that app.json, generated Android files and release tooling are unchanged. Do not rebuild or overwrite archived 80000192. Later authorised device acceptance should check both overflow menus omit both rows while the dedicated buttons still work, and the remaining menu actions retain their order and behaviour.
