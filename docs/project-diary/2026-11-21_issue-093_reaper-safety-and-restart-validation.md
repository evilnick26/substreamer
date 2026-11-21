# sancti.fi Client — Project Diary

**Date:** 2026-11-21
**Issue:** #093 — Reconcile stale albums and songs immediately after full Sync
**Activity:** Reaper integration, safety and concurrency validation; pre-APK gate
**Status at end of entry:** Automated checks passed; Android release build and controlled device acceptance still pending. Local implementation/test changes not yet committed.

## Objective

After a successful authoritative full library enumeration, remove locally retained album and song rows that Navidrome no longer returns, without requiring an application restart. Preserve downloaded/cached, starred and playlist-referenced data. Show reconciliation progress and deletion counts before reporting Sync Complete.

## Investigation and findings

- Previously the stale-row Reaper ran at startup, so a full Sync could finish while server-deleted albums remained visible locally until restart.
- The Reaper uses the completed full-resync epoch and `synced_at` stamps. Only a full run completing both album and song enumeration may authorise deletion; partial or resumed enumeration cannot.
- Deletion is chunked and yields between batches. SQL rechecks the epoch and retention exclusions at DELETE time, guarding against rows refreshed after candidate selection.
- The existing Sync coordinator chains a replacement run behind the previous in-flight promise. The Issue #93 integration awaits the Reaper inside that promise.
- Settings' small X dismisses the progress banner; it does not cancel Sync. Pause/Restart are separate Settings controls and are hidden while reconciliation is active.
- The Reaper itself does not observe Sync generation cancellation. A cancelled/superseded Sync does not publish its old reconciliation result, but the Reaper is allowed to finish.

## Decisions

1. **Reaper ownership:** once invoked, reconciliation is not cancelled by Pause/Restart. A replacement full Sync waits for the active Reaper to settle before enumerating/writing.
2. A failed Reaper must not be stamped complete or represented as success; report the error and permit later retry. Waiting Syncs must not be blocked permanently.
3. Keep the startup Reaper for recovery after an interrupted application session.
4. Keep source audio and tags untouched. Reconciliation concerns only the client's normalized local database.
5. Avoid further production changes unless a specific safety defect is demonstrated. Do not extend Issue #93 into unrelated UI work.

## Implementation (local, not yet on GitHub)

Eight numbered patch steps, including focused follow-up corrections, modified the local checkout. Principal changes:

- `src/services/libraryReapService.ts`: explicit completed/already-completed/skipped/failed result and single-flight handling; underlying deletion SQL unchanged.
- `src/store/syncStatusStore.ts`: ephemeral reconciliation phases and removed-row counts.
- `src/services/normalizedLibrarySync.ts`: await startup recovery Reaper before fresh full writes; after successful full enumeration await epoch Reaper, publish result/error, and prevent superseded runs from publishing stale UI state.
- `src/components/LibrarySyncBanner.tsx` and `src/components/settings/LibrarySyncCard.tsx`: reconciliation/progress and completion display; 2-second removed-count and Sync Complete transitions where applicable.
- `src/app/_layout.tsx`: correctly await startup Reaper.
- Tests expanded in `src/services/__tests__/normalizedLibrarySync.test.ts`, `src/services/__tests__/libraryReapService.test.ts` and banner component tests.

English UI strings are provisional; translation is deferred.

## Validation

- Normal reconciliation, zero deletions, failure reporting, cancellation/supersession, overlapping full Sync, retention exclusions, and UI transitions were tested on Android and iOS Jest projects.
- The SQL-backed Reaper suite includes a deterministic race test: pause between stale candidate selection and DELETE, refresh the row, resume deletion, verify refreshed rows survive. **34/34 passed** across Android/iOS; rerun with `--detectOpenHandles` exited cleanly.
- Existing reconciliation orchestration tests included overlapping requests joining one active run and cancellation suppressing stale UI publication.
- **Patch 8 (2026-11-21):** a focused test holds the Reaper pending, requests a replacement full Sync after generation change, verifies the replacement does not enumerate while the Reaper is active, releases the Reaper, then verifies the replacement completes. **2/2 targeted tests passed** (one Android, one iOS; 126 other tests skipped by filter).
- After Patch 8: `git diff --check` and `npx tsc --noEmit` completed cleanly.
- Prior targeted suites passed; no full-suite rerun was performed after Patch 8. No Android device acceptance for Issue #93 has yet occurred.

## Outstanding work

1. Build and install the locally patched signed release APK; verify the app launches and the sacrificial EP is present.
2. Controlled acceptance fixture: **Carl & Nick's Seminal Funk Bravado — Mind the size of a planet (2002)**, tracks **Ouch! Me Diodes** and **No Biscuits for you**. **Do not delete it from Navidrome until the new APK is installed and the EP is confirmed in the client.**
3. Remove that EP from the server, allow Navidrome to index the change, run **one** full client Sync, and verify immediate removal and correct counts without restarting.
4. Inspect `git status` and diff before committing local Issue #93 implementation/tests. Coordinate this GitHub-only diary commit with the local checkout before any pull/rebase; do not overwrite uncommitted work.
5. Record APK/device results in a subsequent dated diary entry rather than retroactively claiming success here.

## References

- [GitHub issue #93](https://github.com/evilnick26/substreamer/issues/93)
- Local patch scripts `issue_093_patch_01.py` through `issue_093_patch_08.py` (including 02a, 03a, 05a corrections).
- Separate experimental branch `issue-93-sync-reconciliation` remains untouched and must not be merged implicitly.
