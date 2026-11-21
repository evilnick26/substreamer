# sancti.fi Client — Project Diary

**Date:** 2026-11-21
**Issue:** #093 — Reconcile stale library records immediately after full Sync
**Activity:** Android device acceptance, final wording correction, tests and Git integration
**Status at end of session:** Functionally accepted on Android; implementation committed and pushed to `sanctifi`.

## Objective

Verify on a real Android device that a full non-Legacy Sync reconciles Navidrome-deleted local records immediately, reports removal counts, and refreshes Home without restarting the app. Finish the user-facing terminology correction and commit the work.

## Investigation and observations

- A new release APK containing the locally developed Issue #93 changes was installed on the phone.
- The sacrificial release **Carl & Nick's Seminal Funk Bravado — Mind the size of a planet (2002)**, containing **Ouch! Me Diodes** and **No Biscuits for you**, was visible in Home before the test.
- The first full non-Legacy Sync was run **before** the sacrificial release was deleted on the server. It reported **0 albums and 17 songs removed**; the release correctly remained visible. Navidrome's missing-file report separately showed 17 missing files. Equal counts are corroborating evidence, not proof that the exact same 17 IDs were involved.
- The source release was then removed. Syncthing needed time to propagate the deletion to the Navidrome filesystem; the user waited for Navidrome to detect the missing files before the actual acceptance Sync.
- Other V/A albums were moved into a *Cherry Picked series* folder around the same time, so the subsequent total song deletion count cannot be attributed solely to the sacrificial release.
- On the second full non-Legacy Sync, the client reported **1 album and 23 songs removed**. The release count decreased from **11,227 to 11,226** and the song count from **155,316 to 155,293**.
- **Without an app restart**, *Mind the size of a planet* disappeared from Home. The user could still navigate to its previously playing context, where the release page displayed **No tracks found**. The mini-player retained its previous playback context; this was observed, not treated as a requirement to clear the queue.
- The removal-count message was transient (a couple of seconds), as intended; the screenshot was taken promptly.

## Decisions

1. **Android acceptance passes:** the specific Issue #93 goal — removal from Home after one completed full Sync, without restart — was observed.
2. User-facing reconciliation messages should say **release/releases**, not **album/albums**, because the library includes EPs, singles and other release types. Internal database/table naming remains unchanged.
3. The previously playing context is separate from normalized library membership. Do not silently add queue-clearing or playback-context changes to Issue #93.
4. The 23-song deletion count is a total across stale eligible records; **only two songs belonged to the deliberately deleted EP**. The other 21 were not individually identified and must not be attributed with certainty to the V/A moves.
5. Preserve the earlier pre-APK diary entry as the historical record of investigation and test readiness; record acceptance in this separate follow-up entry.

## Implementation and validation

- **Patch 9** changed reconciliation wording from album(s) to release(s) in `src/components/LibrarySyncBanner.tsx` and `src/components/settings/LibrarySyncCard.tsx`, with updated expectations in `src/components/__tests__/LibrarySyncBanner.test.tsx`. No deletion SQL, data model or Sync logic was changed by Patch 9.
- Focused UI Jest run after Patch 9: **2 suites / 28 tests passed**, Android and iOS.
- `git diff --check` and `npx tsc --noEmit` completed cleanly.
- Earlier Issue #93 suites had covered reconciliation outcomes, protected records, SQL race safety, cancellation, overlapping Syncs, and Restart waiting for an active Reaper. The final restart gate passed **2/2 targeted Android/iOS tests**; the SQL-backed Reaper suite passed **34/34**. No new full-suite run is claimed here.
- Final implementation diff: **9 files changed, 454 insertions, 14 deletions**.
- Local implementation commit originally `4537caf4` was rebased on top of the earlier Issue #93 diary commit `542c040b`, yielding **`db0e35ef`** (`fix: reconcile stale library records after full sync (#93)`), then pushed successfully to `sanctifi`.
- The Bookmark restoration work was already committed separately as **`28701240`** (`#92`); it was not part of the Issue #93 implementation commit.
- The earlier experimental branch `issue-93-sync-reconciliation` was deleted from the remote after confirming it contained only one superseded unique commit.

## Outstanding work and follow-up

- This diary entry is being committed directly to GitHub **after** the implementation push. The local checkout should use `git pull --ff-only origin sanctifi` to obtain it, assuming no new local commits have been made meanwhile.
- Issue #93 is functionally validated on Android and ready for issue closure according to the project's normal workflow. No further production change is required by the observed acceptance results.
- A future issue may consider whether stale playback navigation should be handled differently, but that is explicitly outside Issue #93 scope.

## References

- [Issue #93](https://github.com/evilnick26/substreamer/issues/93)
- Prior diary: `docs/project-diary/2026-11-21_issue-093_reaper-safety-and-restart-validation.md`
- Implementation: `db0e35ef` on `sanctifi`.
