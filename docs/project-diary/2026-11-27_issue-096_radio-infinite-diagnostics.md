# Issue #96 — Radio Infinite diagnostic logging

**Date:** 2026-11-27

**Issue:** https://github.com/evilnick26/substreamer/issues/96

**Status:** Implementation and agreed device acceptance complete; documented limitations remain.

## Objective and decisions

Make Radio Infinite behaviour observable on the phone for #87 acceptance and future #88 development. Prefer an optional Settings → Logging card over server/bridge instrumentation or ADB. Logging is disabled by default, stored locally, explicitly shared by the user, and must not change recommendation behaviour or require additional metadata requests. Artist/title may appear in logs; credentials, authentication material and raw request/error dumps must not.

## Investigation and implementation

Existing loggers were inspected. Installed Expo filesystem APIs support synchronous append and synchronous move; moving a File changes its URI. Existing library-sync, voice-search and image-cache rotation patterns warrant separate review because of unawaited moves/reuse of moved File objects. No unrelated logger refactor was undertaken.

The new logger uses a persistent flag and active/old files in `Paths.document`, each capped at 512 KiB (UTF-8 bytes). Oversized records are omitted. Writes, rotation, status, clear and export preparation share a serial promise lane. I/O failures are contained; writes are best effort rather than crash-durable. Exports combine old then active history into a temporary snapshot in cache. The Zustand store prevents concurrent UI actions, including sharing, and refreshes retained size after actions and on screen entry.

Instrumentation records Primary Seed establishment, restoration, invalidation and clearing; correlated logical refill IDs; seed IDs and remaining lifespan; bridge counts/IDs, duplicate exclusions, metadata lookup failures, filter rejection reasons, accepted and unexamined counts; actual playable/appended tracks, accounting, rotation and terminal outcomes. It uses metadata already available to the client. #88 stage-specific diagnostics are deferred to that issue.

| Commit | Change |
|---|---|
| `aab6096a` | Persistent logger and diagnostics store foundation. |
| `2ce5a3ec` | Settings controls, English strings, sharing and UI tests. |
| `b721dc02` | Primary Seed lifecycle instrumentation. |
| `05e57da2` | Recommendation filtering, refill and actual append/accounting instrumentation. |
| Hash not supplied | `feat(radio): timestamp diagnostic export filenames (#96)` — final filename amendment, built and tested on device. |

The filename amendment uses local time: `RI-diagnostics-YYYY-MM-DD_HH-MM-SS.log`. It checks occupied cache names and uses numeric suffixes, then removes previous matching temporary exports, including the legacy fixed name. Unrelated cache files are preserved. This is not a global uniqueness guarantee: it cannot inspect external copies, and successive same-second exports can reuse a name after its previous cached copy is removed. The ordinary separate-second export workflow was accepted; stronger collision guarantees would require further work. No change to playback behaviour.

## Validation

| Full Jest gate | Passed | Failed | Skipped | Total |
|---|---:|---:|---:|---:|
| Pre-#96 | 12,208 | 12 | 8 | 12,228 |
| Before filename amendment | 12,376 | 12 | 8 | 12,396 |
| Final | 12,382 | 12 | 8 | 12,402 |

All final failures matched the six baseline cases on both platforms: four MoreOptionsSheet favourites closure cases, one Home downloaded-album deletion refresh and one Search downloaded-album deletion refresh. Isolated pre-implementation retest passed 321 and failed 3; intermittency is demonstrated, but the root cause is unresolved. No new observed full-suite failure; 174 additional passing tests. The full gate is not green.

Final TypeScript and intl passed. All 13 translation files validated, with 2,455 missing-key warnings awaiting Crowdin (39 additional warnings from three new English keys). Madge processed 911 files, 108 warnings, no cycles. Diff check passed.

Targeted final logger/store/screen tests: 158/158 across Android and iOS. Logger coverage 100% statements/functions/lines, 97.5% branches. Earlier instrumentation gate: 408/408; player service 90.16% statements / 80.64% branches, radio service 89.74% / 84.88%, filter 100% / 100%. A Jest mock-hoisting error in the filename amendment was corrected in tests only before final validation.

## Device acceptance

The owner reported initial logging tests passed. Real exports demonstrated useful seed/refill/accounting diagnostics and enabled #87 acceptance. One initial reboot launched via Music Widget appeared to reset logging to OFF and show no retained log. Force-stop/relaunch, subsequent reboot via app drawer and subsequent reboot via widget all retained logging and history. The initial failure was not reproducible; actual file disappearance was not established. Record and revisit if it recurs, rather than apply a speculative fix.

Final APK exported two files into Documents at 20:03:

- `RI-diagnostics-2026-11-27_20-03-26.log`
- `RI-diagnostics-2026-11-27_20-03-35.log`

Both remained present, each displayed as 3.83 KB. Correct local timestamps and distinct filenames verified by screenshot. Same-second collision behaviour was not tested on device.

## Discovery: stale AudioMuse-AI track mapping

The first substantial log showed 15 successful ten-track refills, followed by two failures in metadata resolution. Both bridge responses contained `4M5vPK3MoaUMDtkph0I0iw`; `getSong` failure caused the existing Promise.all lookup batch to abort before filtering or appending. Lifespan remained unchanged.

Read-only investigation on obscurity (Navidrome 0.64.2, AudioMuse-AI 3.7.2) established:

- Navidrome `media_file` contained no row for the failing ID. Fat Dog — All the Same (`2bWrZhZpcune4UqOTzZ5EH`) served as a successful positive control in both databases.
- AMA `track_server_map` joined to `score` identified Tears Lost Drop — Skrillex with Sleepnet & Joker, from FUCK U SKRILLEX YOU THINK UR ANDY WARHOL BUT UR NOT!! <3.
- The deleted ID and surviving Navidrome ID `7bCXKF0FSbBwvCA4VotQ1n` both mapped to AMA item `fp_40671691abd9321424a5cbdf5ba149d397b4fdfa711354e762e`.
- Deleted mapping: fingerprint tier, 2026-09-18 18:01:42; surviving mapping: default tier, 2026-09-18 15:28:42. The owner recalled removing a duplicate copy of this album. Why AMA selected the obsolete mapping remains unknown.

No database writes, cleanup or reanalysis were performed. AMA 3.7.5 appeared during the investigation, but no evidence established that it fixes this mapping problem.

Two issues were created:

- [#97](https://github.com/evilnick26/substreamer/issues/97): deferred read-only audit/reconciliation of Navidrome and AMA mappings. Low immediate value relative to cost; no cleanup scheduled.
- [#98](https://github.com/evilnick26/substreamer/issues/98): isolate unavailable recommendation tracks, log safe failure details and continue processing valid candidates. Preserve order, eligibility, cap, stale guards and successful-refill accounting. Investigate systemic authentication/connectivity errors separately from individual missing tracks. No AMA changes. All-unavailable batches may still fail; #88 provides bounded recovery later.

## Outstanding work and development workflow

- #87 explicitly accepted; #96 agreed device acceptance complete. Commit diary documentation separately, confirm final filename commit hash, and obtain approval before push/issue closure.
- Keep the non-reproducible reboot observation and baseline test failures visible. Separate reliability investigation and existing logger rotation review remain backlog proposals, not implemented fixes.
- The owner identified copy/paste fatigue as an engineering risk after repeated terminal round trips. Agreed to explore GitHub-first delegated implementation, issue branches, remote validation and explicit decision/acceptance checkpoints, with local builds/device testing retained. Update AGENTS.md and verify tooling before adopting; no unattended execution capability assumed. Latest explicit workflow decision was to switch for #98. The owner subsequently identified #88 as the next clean-tree milestone; confirm sequencing before implementation rather than silently changing either decision.
- #88 remains outside #96 scope; extend the logger with stage-specific diagnostics when implementing it.

No push performed as of this diary entry.
