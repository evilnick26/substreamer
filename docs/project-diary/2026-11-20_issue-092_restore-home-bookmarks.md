# sancti.fi Client — Project Diary

**Date:** 2026-11-20
**Issue:** #092 — Restore saved Bookmarks section on sancti.fi Home
**Activity:** Restore Home bookmark access and player overflow creation action; validate on Android
**Status at end of session:** Functionally validated; changes awaiting commit

## Objective

Restore access to saved playback bookmarks from the customised sancti.fi Home screen, without reintroducing permanent bookmark controls on the Now Playing Screen (NPS). A bookmark should preserve a playback queue, its current song and the position within that song.

## Investigation and findings

- The active Home route (`src/app/(tabs)/index.tsx`) uses `src/screens/sanctifi-home.tsx`, not the older `src/screens/home.tsx`.
- The older Home screen already used `ResumeBookmarksSection`; the customised Home screen did not mount it. The component and underlying bookmark functionality remained available.
- Bookmark creation was no longer exposed through the NPS controls or its overflow menu, despite the existing `BookmarkButton`, `useBookmarkAction`, `BookmarkNameSheet`, bookmark stores and `bookmarkService` remaining in the codebase.
- `useBookmarkAction` captures the playback snapshot **before** awaiting a menu-close callback, then either saves with an automatically generated name or opens the naming sheet, depending on the user's bookmark setting.
- `MoreOptionsSheet` already distinguishes player-originated menus with `source.startsWith('player-')` and provides `hideAndAwait()` for dismissing the sheet before opening another UI.
- Existing overflow tests explicitly asserted that `Add bookmark` was absent from player menus. Those expectations reflected the earlier UI cleanup and needed revision once the behaviour changed.

## Decisions

1. Reuse the existing bookmark implementation rather than introduce a new storage model or playback mechanism.
2. Mount `ResumeBookmarksSection` on the customised Home screen below the Updates link and above Recently Uploaded. The section remains hidden when there are no bookmarks.
3. Restore **Add bookmark** in player-originated song overflow menus, including phone and tablet layouts, online and offline. Do **not** restore a permanent NPS bookmark button.
4. Use the existing `useBookmarkAction` with `moreOptionsStore.getState().hideAndAwait()` to preserve snapshot timing and avoid overlapping sheets.
5. Keep non-player overflow menus unchanged. Retain the intentional absence of `Play More Like This` from player-originated overflow menus.
6. Update only the obsolete bookmark assertions in the relevant test; do not perform a blanket replacement of absence assertions or weaken unrelated tests.

## Implementation

Four tracked files changed:

| File | Change |
|---|---|
| `src/screens/sanctifi-home.tsx` | Import and mount `ResumeBookmarksSection` in the customised Home screen. |
| `src/screens/__tests__/sanctifi-home.test.tsx` | Add a mock/assertion confirming that Home mounts the bookmarks section. |
| `src/components/MoreOptionsSheet.tsx` | Import `useBookmarkAction`, wire it to `hideAndAwait()`, and render `Add bookmark` for player-originated song menus. |
| `src/components/__tests__/MoreOptionsSheet.actions.test.tsx` | Update player-layout expectations to require `Add bookmark` both online and offline, while preserving the `Play More Like This` absence assertions and non-player behaviour. |

Final uncommitted diff summary: **4 files changed, 34 insertions, 3 deletions**. No bookmark persistence, audio metadata or playback-service changes were required.

## Validation

### Static checks and automated tests

- `./node_modules/.bin/tsc --noEmit` completed successfully (approximately 76 seconds).
- `git diff --check` reported no whitespace errors.
- Initial overflow test run produced eight expected failures from outdated bookmark-absence assertions (four player layouts on Android and iOS) and one isolated iOS favourites sheet-close failure.
- After the targeted assertion update, both overflow test files passed on **Android and iOS**: **4 suites passed; 284 tests passed; 0 failed**. The earlier iOS favourites failure did not recur; no changes were made to that test.
- Earlier in the issue, the Home-focused regression run passed **10 suites / 156 tests**, and TypeScript passed before the overflow restoration.

### Android device verification

A release APK was built and installed for functional testing. Confirmed:

- Bookmark creation was accessible through the NPS overflow menu; a bookmark was also created through a queue track's overflow menu.
- Home displayed the restored **Jump Back In** section with two independently saved bookmarks, including artwork, names, queue progress and remaining duration.
- Selecting a bookmark restored **the complete saved queue, the selected song and the exact playback position within that song**.

This verifies the end-to-end functional objective, beyond merely rendering the menu action or Home section.

## Outstanding work and follow-up

- Add this diary entry to the project's diary directory and commit it together with the four implementation/test files, as agreed for this session. No commit hash exists yet.
- No further functional changes are required for #092 on the evidence gathered. The focused automated tests are green and Android device restoration works.
- An additional automated interaction test for pressing the overflow bookmark action could strengthen regression coverage later, but was **not** added in this session and is not a blocker for the verified objective.
- The isolated iOS favourites failure seen in the first run is not currently reproducible; investigate only if it recurs.

## References

- GitHub issue **#092** — Restore saved Bookmarks section on sancti.fi Home.
- Existing components/services: `ResumeBookmarksSection`, `useBookmarkAction`, `BookmarkNameSheet`, `bookmarkService`, `moreOptionsStore`.
- Final validation: 284/284 overflow tests passing across Android and iOS; Android device confirmed exact-position bookmark restoration.
