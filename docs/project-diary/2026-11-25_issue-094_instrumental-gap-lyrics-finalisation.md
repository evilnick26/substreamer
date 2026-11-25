# Project Diary — Instrumental gap lyrics finalisation

**Date:** 2026-11-25
**Issue:** #094 — Lyrics Without Leaving: clear stale lyrics during instrumental gaps and outros
**Related:** #006 — Lyrics Without Leaving

## Background

Implementation and Android acceptance work took place on
22–23 November 2026. Issue #094 was closed as completed
on 23 November, but the implementation remained uncommitted
and its temporary diagnostic recorder was still present.

This was discovered during working tree inspection before
starting issue #091 on 25 November.

## Implemented behaviour

- Gaps shorter than 9 seconds retain continuous lyric presentation.
- Gaps of 9 seconds or longer hold the current lyric for
  3 seconds before clearing the panel.
- Anticipate the next lyric 3 seconds before its timestamp.
- Hold the final lyric for 5 seconds before clearing.
- Suppress distant previous and next lyric context across
  long instrumental gaps.
- Retain the lyrics panel and its layout space during blank
  intervals without reverting to the seekbar.
- Preserve underlying lyric timestamps and synchronisation.

All timing constants are internal presentation parameters,
not user preferences.

## Finalisation — 25 November

- Reviewed the outstanding implementation and test changes.
- Removed the temporary SANCTIFI_LYRICS_094 diagnostic recorder.
- Removed the associated unused React imports.
- Preserved the accepted presentation logic.
- Retained all associated regression tests.

## Validation

Ran:

    npx jest \
      src/components/__tests__/InlineLyricsPanel.test.tsx \
      src/components/__tests__/PlayerLyricsOrProgress.test.tsx \
      --runInBand

Results:

- Test suites: 4 passed, 4 total.
- Tests: 54 passed, 54 total.
- Snapshots: 0.
- Execution time: 7.296 seconds.
- git diff --check: clean.

The final implementation diff comprised three files,
237 insertions and 13 deletions.

Android acceptance preceded diagnostic removal.
No fresh Android acceptance run was performed during
this housekeeping session.

## Decisions and lessons

- Keep temporary diagnostic instrumentation out of
  permanent implementation commits.
- Resolve outstanding working tree changes before
  beginning unrelated development tasks.
- Ensure issue closure, implementation commits and
  Project Diary entries remain aligned.

## Outstanding work

No further functional changes identified for #094.
Final diagnostic-free APK will be produced during
the next application build.
