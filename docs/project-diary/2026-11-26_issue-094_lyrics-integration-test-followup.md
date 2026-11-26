# Issue #94 --- Lyrics integration test follow-up

**Date:** 2026-11-26

## Discovery

During the pre-implementation baseline checks for issue #87, the full Jest run reported 22 failures across 10 test suites. Sequential retesting eliminated 12 failures relating to favourites and downloaded-library refresh. The remaining 10 failures represented five distinct NPS integration tests, each failing in both Android and iOS Jest projects.

## Root cause

The five integration tests used a single lyric timestamp of 0ms with a mocked playback position of 30 seconds. Issue #94 intentionally clears the final lyric after five seconds. These integration fixtures had not been updated to reflect that behaviour. The production implementation behaved as intended in these cases.

## Implementation

Updated the five affected lyric timestamps from 0ms to 30000ms across:

-   `src/screens/player/__tests__/player-phone-portrait.test.tsx`
-   `src/components/player/__tests__/PlayerTabletLandscape.test.tsx`

Individual fixtures were changed rather than the shared playback position to avoid affecting unrelated tests. No production code or test assertions were changed.

## Validation

-   `git diff --check`: passed.
-   Diff: two test files, five insertions, five deletions.
-   Targeted Jest run: eight suites passed, all 198 tests passed across Android and iOS.
-   Runtime: 19.294 seconds.

## Subsequent baseline validation

- TypeScript compilation passed.
- Full sequential Jest run: 669 suites passed, one failed, two skipped; 11,886 tests passed, four failed, eight skipped. Runtime: 1180.279 seconds.
- All remaining failures were in the Android project of `MoreOptionsSheet.actions.test.tsx`, involving favourite actions and sheet closure.
- Isolated Android retest: all 128 tests passed in 36.248 seconds.
- The project owner reported a history of intermittent, usually timeout-related failures in this suite on both platforms. The precise cause remains unconfirmed.
- Internationalisation and translation validation passed, with existing missing-key warnings.
- The baseline is accepted for proceeding with #87 with the intermittent test failure documented; the full quality gate is not green.

## Commit

- `b584616e` — `test(lyrics): align NPS integration fixtures with lyric timing rules (#94)`
- Local commit confirmed. No push performed in this session.
- No Android rebuild required for this test-only correction.

## Outstanding work

- Record intermittent favourites test reliability as a separate backlog issue; no speculative production changes or timeout increases.
- Downloaded-library failures from the original parallel run did not recur in the sequential retest or full sequential run.
- The existing circular dependency between `playerService` and `radioInfiniteService` remains to be addressed during #87.
- Commit this diary entry separately and resume #87 implementation planning.
