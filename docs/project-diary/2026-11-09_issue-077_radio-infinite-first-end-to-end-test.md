# sancti.fi Client — Project Diary

**Date:** 2026-11-09
**Issue:** #077 — Radio Infinite
**Activity:** Stage 2A — first end-to-end Android client/bridge integration and device test
**Status:** First manual end-to-end test successful; automatic replenishment not implemented

## Objective

Prove that the sancti.fi Android client can use its existing Navidrome login to request AudioMuse-AI recommendations through the authenticated sancti.fi Radio Infinite bridge, resolve the returned Navidrome song IDs into playable queue entries, and **append** them without replacing the existing queue.

The immediate goal was a deliberately disposable, manually triggered test, **not** a production-ready automatic Radio Infinite implementation.

## Context and investigation

Earlier Issue #077 work established the fourth repeat mode (`off → all → one → radio`) and a server-side bridge at `https://radinf.sancti.fi/radio/recommendations`. The bridge validates Navidrome salted-token credentials and keeps privileged AudioMuse-AI credentials on the server. Its separate health endpoint is `/radio/health`.

Targeted inspection of the current Substreamer fork confirmed:

- `playerStore.getState().queue` exposes the complete queue as `Child[]`.
- `addToQueue(tracks: Child[])` in `src/services/playerService.ts` appends playable entries to the existing queue.
- `authStore` provides the existing username, password and `legacyAuth` setting.
- `expo-crypto` is already used in `ensureCoverArtAuth()` to generate a random salt and MD5 token from `password + salt`.
- The installed `subsonic-api` SDK supports `api.getSong({ id })`, returning a `Child` song object.
- `src/screens/player/player-phone-portrait.tsx` provides an easy temporary button insertion point beside the existing track actions.

These findings removed the need for a new login mechanism, modifications to the playback queue service, or privileged AMA credentials in the client.

## Decisions

1. **Test the full valuable behaviour now.** Defer additional security hardening, automatic refill, background scheduling and UI polish until the core path is demonstrated, while retaining essential authenticated access and queue-safety checks.
2. Use the **last up to three songs at the end of the current queue** as seeds, irrespective of the current playback position. One or two seeds are valid; an empty queue cannot seed a request.
3. Require Radio Infinite repeat mode for the manual test and reject legacy authentication rather than silently changing the user's settings.
4. Send salted-token credentials in an HTTPS **POST body**, not in a URL. Keep the privileged AMA token server-side.
5. Resolve returned IDs using Navidrome's `getSong` and append with the existing `addToQueue()`; never clear or replace the queue.
6. Guard against stale responses if Radio Infinite is switched off or the queue changes during the request.
7. Place a plainly labelled **TEST RI** button on Now Playing, with basic success/error feedback. This button is temporary and not intended for the released interface.

## Implementation

A targeted installer, `apply_radio_infinite_test.py`, was run in dry-run mode and then with `--apply` on **futwick**. It added:

- `src/services/radioInfiniteService.ts` — manual recommendation request, salted-token authentication, returned-song resolution and append safeguards.
- `src/components/RadioInfiniteTestButton.tsx` — temporary button and feedback.
- Two small insertions in `src/screens/player/player-phone-portrait.tsx` — component import and button placement alongside the existing track actions.

The existing `subsonicService.ts`, `playerService.ts` and authentication store were not modified for this test.

**Installer packaging issue:** The extracted source files were initially left at the repository root as well as installed under `src/`. Because TypeScript also discovered the root copies, `npx tsc --noEmit` reported eight errors: seven unresolved relative imports and one consequent implicit-`any` error. Removing only the redundant root-level `RadioInfiniteTestButton.tsx` and `radioInfiniteService.ts` resolved all eight. The actual installed source files were retained.

The installer script itself remained untracked at the time of the last reported Git status; it is not application source and should not be committed accidentally.

## Validation

### Static and regression checks

- `npx tsc --noEmit`: **passed**, zero reported errors after removing duplicate root files.
- Targeted Jest run covering Subsonic service and Now Playing screen tests: **4 suites passed, 506 tests passed, 0 failed**, in approximately 54 seconds.
- These existing tests provide regression coverage, **not** dedicated automated end-to-end coverage of the new Radio Infinite integration.

### Android device — first successful end-to-end test

The user installed and exercised the new client build on a real Android phone and supplied four screenshots:

1. The pre-existing playback queue, including **Frankie Cosmos — “Being Alive”** at its tail.
2. Now Playing with Radio Infinite repeat mode selected and the temporary **TEST RI** button visible.
3. A success dialog: **“10 recommendations added to the queue.”**
4. The queue showing the preserved boundary track followed by ten newly appended recommendations. Visible examples include **Charmpit — “Free the Burbs”**, **They Might Be Giants — “The Communists Have the Music”**, **The Front Bottoms — “Father”**, **Super 8 — “First Female Astronaut”**, **Falling and Laughing — “The Peaceful Use Of Outer Space”**, **Maxïmo Park**, **Darren Hanlon**, **Bunnygrunt** and **Tullycraft**.

**Observed result:** The client successfully initiated the authenticated bridge workflow, received and resolved ten recommendations, and appended them to the existing playback queue without replacing its preceding entries. This is the **first demonstrated end-to-end Radio Infinite client integration**.

**Not yet established:** Actual playback of all ten newly appended tracks, automatic replenishment, repeat requests over time, background execution, all error paths, and production robustness.

## Prioritisation lesson

The decision to validate the smallest complete user-visible path before undertaking further hardening delivered a concrete result quickly and confirmed that the architecture is viable. The guiding principle agreed during the session:

> Prove valuable end-to-end behaviour early, with essential safeguards in place. Then invest in robustness, security hardening and polish according to demonstrated need and risk.

This is **not** permission to omit safeguards where doing so would create unacceptable exposure. It is a sequencing principle: establish a minimum safe foundation, prove the useful behaviour, then prioritise additional work based on evidence and risk.

## Outstanding work / next session

1. **Preserve the milestone:** inspect `git status` and `git diff`, stage only the intended application changes and diary entry, then commit. Avoid accidentally including the existing unrelated `app.json` modification, installer, or other untracked files. No commit hash is recorded because a commit was not yet reported.
2. Verify playback of newly recommended tracks on the device.
3. Add focused tests for authentication rejection, bridge errors, ID resolution, empty/short queues and stale-response handling.
4. Implement automatic replenishment using the queue-tail seed rule, with a separately agreed threshold and trigger strategy. Address native/background limitations explicitly.
5. Revisit bridge hardening (including rate limiting), error handling, retry behaviour and diagnostic logging before wider release.
6. Remove the disposable **TEST RI** button once the normal Radio Infinite trigger is implemented and validated.

## References

- GitHub: `evilnick26/substreamer`, **Issue #077** (Radio Infinite); related investigation **Issue #072**.
- Earlier diary: `docs/project-diary/2026-11-07_issue-077_radio-infinite-bridge-integration.md` (present locally during this session; its full contents were not reviewed for this entry).
- Earlier Stage 1 commit: `b5d590b5` (fourth repeat mode, as previously recorded).
- Device screenshots and terminal results supplied in the 2026-11-09 development conversation.

**Session outcome:** Stage 2A manual end-to-end integration **successful**. Automatic Radio Infinite remains future work under Issue #077.
