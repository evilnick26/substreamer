# Project Diary — 2026-11-18 — Issue #086: Radio Infinite duration filtering

## Objective

Restrict **new Radio Infinite recommendations** to tracks with durations from **90 to 480 seconds, inclusive** (1:30–8:00), without changing ordinary playback or tracks already in the queue.

Issue: https://github.com/evilnick26/substreamer/issues/86
Related: #077 (Radio Infinite), #085 (infrastructure documentation)

## Investigation

- `src/services/radioInfiniteService.ts` already resolves Bridge-provided song IDs to full Navidrome `Child` metadata using `getSong` before applying the recommendation filter.
- That metadata includes `duration` in seconds. Neither another API request nor a local SQLite lookup is required.
- `src/services/radioInfiniteFilter.ts` already handles duplicate IDs, normalized artist/title duplicates, adjacent artist/album repetition, candidate order and the ten-track acceptance cap. Duration eligibility belongs in this existing filter.

## Decisions

- Apply the duration rule **only to Radio Infinite recommendations**, before accepted tracks are appended; do not retroactively remove queued tracks.
- Accept both boundaries (90 and 480 seconds). Reject durations outside the range, and missing, zero, negative or non-finite durations.
- Keep the implementation narrowly scoped: no changes to the Bridge, AudioMuse-AI, Navidrome, SQLite, other playback modes or user-facing settings.
- **Keep issue #086 open after this implementation** to observe actual listening and consider other easy, useful recommendation filters. No further filters have yet been agreed or scheduled.

## Implementation

- `src/services/radioInfiniteFilter.ts`: added minimum/maximum duration constants and an early eligibility check in the candidate loop, before duplicate/adjacency handling.
- `src/services/__tests__/radioInfiniteFilter.test.ts`: added a default 180-second duration to the song factory and five duration-specific test cases covering boundaries, invalid durations, ordering and adjacency state.
- `src/services/__tests__/radioInfiniteService.test.ts`: added a default 180-second duration to its shared mocked song factory. Without this, previously valid mock recommendations had undefined duration and were correctly rejected by the new filter.
- `app.json` was also modified locally for an Android version bump; this is **not** part of the #086 filtering logic.

## Validation

- Initial filter tests: **38/38 passed** across Android and iOS.
- Initial service regression run: **14 failures and 10 passes** across both platforms. Failures resulted from test fixtures lacking duration, not from a newly observed production-service exception.
- Two supplied follow-up patches failed to apply (one malformed, one mismatched context); the third patch applied successfully and corrected the shared service fixture. These patch delivery problems did not change production behaviour.
- Combined Jest run of `radioInfiniteFilter.test.ts` and `radioInfiniteService.test.ts`: **4 suites passed, 62/62 tests passed**, Android and iOS; no failures.
- `git diff --check` produced no warnings. Pre-build diff showed the three #086 files above plus the separate `app.json` version bump.
- On-device observation: after approximately **20 Radio Infinite refreshes**, the user supplied queue screenshots with displayed durations within the allowed range. Shortest shown: **“Hell” — The Tubs, 1:42**; longest shown: **“Champagne Supernova” — Oasis, 7:28**. These are useful real-world corroboration, not an exhaustive audit of all recommendations or direct observation of exact boundary values.
- The screenshots indicate on-device testing, but no explicit Gradle build log or installation details were recorded in this session.

## Outstanding work

- Keep #086 **open for observation**, not because the present duration-filter implementation has a known failing test.
- Consider additional inexpensive recommendation filters only if listening reveals a concrete need; assess benefit against complexity before extending scope.
- Commit the tested code, relevant Android version bump as appropriate, and this diary entry. Record the resulting commit hash when available; none is claimed here.

## Summary

The duration rule was added at the existing recommendation-filter boundary, reusing metadata already fetched by the Radio Infinite service. The implementation is small, with passing Android/iOS unit and service regression tests and encouraging on-device observations. Issue #086 remains open intentionally for listening-led refinement.
