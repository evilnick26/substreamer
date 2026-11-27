# Issue #87 — Rotating Primary Seed: implementation

**Date:** 2026-11-26

**Issue:** https://github.com/evilnick26/substreamer/issues/87

## Objective and decisions

Introduce musical inertia to Radio Infinite by retaining a Primary Seed across multiple successful refills. Implement this independently of #88 progressive recovery and Exploration Speed.

- Enable Radio Infinite during playback: immediately capture the current track, regardless of queue length.
- Explicit new playback selection establishes a new Primary Seed from the actual playable selection, not the album's final track.
- Automatic transitions, navigation within the queue, shuffle and ordinary queue edits retain the seed. The seed need not remain in the queue.
- Each seed receives a randomly selected lifespan of 3–5 successful logical refills. A successful refill decrements it once; at expiry, promote the first recommendation actually appended and assign a fresh lifespan.
- Failed, empty or stale refills must not consume lifespan. Disable clears context; re-enable captures the current track. Queue clearing and logout invalidate context.
- Persist the seed ID and remaining lifespan with the live queue across process restarts. Bookmarks remain independent.
- Normal recommendation seeds are the Primary Seed plus the last two queued tracks, deduplicated in order. Preserve the existing refill trigger of three upcoming tracks and cap of ten recommendations. Duration restrictions from #95 apply to recommendations, not seed eligibility.

## Investigation and implementation

The existing player/radio service dependency was circular. Queue snapshot metadata and tracks also required atomic replacement, and bare SQLite updates could overtake deferred batch writes. Native queue mutation cannot be undone merely by checking a generation after an await.

Implemented the following local commits:

| Commit | Change |
|---|---|
| `81fd9eff` | Primary Seed lifecycle, generation guards, ordered seed construction and rotation in `radioInfiniteSeed.ts`. |
| `7e28251f` | Persist seed with live queue snapshots; additive nullable `radio_primary_seed_id` and `radio_remaining_refills` columns. |
| `4ca4fa6a` | Remove player/radio circular dependency through a registered refill dispatcher. |
| `e4ffa280` | Integrate lifecycle with playback selection, mode changes, hydration, clearing and logout. |
| `c711ffc0` | Guard recommendation append against stale context and native queue transitions; account using actual appended tracks. |
| `5a40fd5b` | Exclude live Primary Seed ID from Navidrome re-ID because live queue is deleted before re-keying. |

The live snapshot and tracks are written atomically using the existing batch machinery. Cursor, seed and deletion operations use the same ordered submission path; no JS database write mutex was introduced. Seed-only changes avoid rewriting clean queue tracks; dirty snapshots incorporate the latest seed. Old or invalid seed snapshots fall back to the restored current track when Radio Infinite is enabled. The normalized schema baseline was regenerated with the established repository procedure; the schema difference was limited to the two nullable columns.

The dispatcher tracks queue revision, transition/mutation state and native queue certainty. Explicit replacement invalidates context before asynchronous work, and the guarded append rechecks context immediately before native mutation. If native mutation fails, queue certainty is invalidated rather than pretending a rollback occurred. A successful append belonging to an invalidated generation is not counted against a new seed.

## Validation

The initial baseline exposed five outdated NPS lyric fixtures, corrected separately under #94 (`b584616e`, diary `1b42e745`). Remaining favourites failures were intermittent; the isolated Android suite passed all 128 tests. See the #94 diary for the baseline history.

Targeted validation included 88 lifecycle tests, 256 persistence tests, 22 schema-upgrade tests, 360 playback integration tests and 604 guarded-refill integration tests at their respective boundaries. These counts overlap and are not additive. The final guarded-refill coverage included player service 89.86% statements / 81.35% branches and radio service 85.05% / 83.33%; seed and dispatcher reached 100%.

Final full gate: 12,217 passed, 3 failed, 8 skipped (12,228 total). The three failures were previously observed favourites sheet-closure failures; isolated retest passed 256/256. TypeScript, intl and translation validation passed (2,416 missing-key warnings); madge processed 906 files with 108 warnings and no circular dependency. The full suite was not green; known baseline exceptions were documented rather than silently waived.

## Outstanding work at implementation boundary

- Android release build and device acceptance, including actual rotation and restart persistence; see the 2026-11-27 follow-up diary.
- Persistence retains the existing asynchronous durability boundary; abrupt termination before queued writes complete can lose pending changes. No native rollback guarantee or universal serialization of ordinary queue operations is claimed.
- Same-library failover and destructive logout/server-change scenarios were not independently exercised on device.
- Investigate recurring favourites/downloaded-library test reliability separately; no speculative timeout increases.
- #88 progressive fallback remains deferred from this implementation. Optional client diagnostics became #96 to make acceptance observable without ADB or bridge changes.

No push performed during implementation.
