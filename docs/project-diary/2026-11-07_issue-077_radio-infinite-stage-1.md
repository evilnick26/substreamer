# sancti.fi Client — Project Diary

**Date:** 2026-11-07  
**Issue:** [#77 — Radio Infinite](https://github.com/evilnick26/substreamer/issues/77)  
**Activity:** Stage 1 — repeat-mode foundation, visual integration and device acceptance  
**Status:** Stage 1 accepted on Android; issue remains open for functional Radio Infinite playback

## Objective

Introduce Radio Infinite as a fourth repeat-mode selection in the existing Now Playing controls, without yet implementing automatic recommendation generation or queue replenishment. Preserve the existing three repeat modes and their behaviour.

## Investigation and decisions

- Existing repeat state was represented by `RepeatModeSetting` (`off`, `all`, `one`) in the persisted playback settings store. The cycle was implemented in `playerService`, with native repeat-mode mapping in `playerHelpers`.
- Adopted the cycle **Off → All → One → Radio Infinite → Off**.
- Radio Infinite is a **semantic application mode** (`radio`), not a native repeat mode. Until queue replenishment exists, it maps explicitly to native player repeat **`off`**. It must not wrap the queue or claim another track is available when none is queued.
- Selected the **filled Ionicons `infinite`** glyph for the new state, using the existing active control colour. Existing repeat and repeat-one presentation remains intact.
- Kept Stage 1 deliberately narrow: no AMA request orchestration, no queue mutation, no new runtime dependency, and no claim that Radio Infinite already functions as a continuous radio.
- Added a new accessibility label in each existing locale. The translated wording is provisional and merits native-speaker review where practical.

## Implementation

A guarded Python patch applied the initial Stage 1 source changes across **21 files**. A second guarded Python patch added two targeted regression tests. Changes remained uncommitted during this session.

Main production changes:

- `src/store/playbackSettingsStore.ts` — added `radio` to the repeat-mode type; retained the existing persisted-setting approach.
- `src/services/playerService.ts` — extended the repeat-mode cycle to four states.
- `src/services/playerHelpers.ts` — mapped `radio` to native repeat `off`.
- `src/components/RepeatButton.tsx` — rendered the filled infinity icon and corresponding accessibility label.
- `src/hooks/useCanSkip.ts` and `src/components/player/PlayerPhoneMini.tsx` — prevented Radio Infinite from being treated as a queue-wrapping repeat mode for skip availability.
- `src/i18n/locales/*.json` — added the Radio Infinite accessibility wording across the **14 existing locale files**.

Test changes:

- `src/services/__tests__/playerService.test.ts` — covered `one → radio` (native `off`) and `radio → off` (native `off`), in addition to existing cycle transitions.
- `src/hooks/__tests__/useCanSkip.test.ts` — covered disabled Skip Next at the end of the queue in `radio` mode.
- `src/store/__tests__/playbackSettingsStore.test.ts` — checked that the existing v1 settings migration preserves a `radio` value. **This is migration compatibility coverage, not a full persistence-storage round-trip test.**

## Validation

### Automated checks

- `playerService.test.ts`: **162 passed** across Android and iOS Jest projects.
- After adding the two regression tests, `useCanSkip.test.ts` and `playbackSettingsStore.test.ts`: **84 passed** across Android and iOS Jest projects (previously 80).
- Thus the final targeted suites account for **246 test executions** (162 + 84); they were run in two commands rather than one combined run.
- `npx tsc --noEmit`: **passed**, no output.
- `git diff --check`: **passed**, no output.
- Android `./gradlew assembleRelease`: **BUILD SUCCESSFUL in 6m 41s** (1,684 actionable tasks: 88 executed, 1,596 up-to-date).

### On-device acceptance (Android)

- Screenshots showed all four repeat states: Off, All, One, and Radio Infinite.
- The infinity icon displayed in the intended control position with the active blue styling; no visible Now Playing layout regression.
- At the final item in the queue with Radio Infinite selected, **Skip Next was disabled**.
- After a **full phone reboot**, the Radio Infinite selection remained active, providing a genuine cold-start persistence check.

**Result: Stage 1 accepted.** These checks validate the mode foundation and UI, not automatic radio playback.

## Working-tree precautions

- The existing local modification to `app.json` was **not part of the #77 patch** and must not be included inadvertently in a #77 commit.
- The existing untracked `docs/project-diary/2026-11-07_issue-072_radio-infinite-api-testing.md` belongs to **#72** and must be preserved independently.
- No commit or GitHub write was reported for the Stage 1 changes during this session.

## Outstanding work

1. **Stage 2 — functional Radio Infinite:** integrate the agreed AudioMuse-AI recommendation path, obtain recommendations from appropriate recent queue-tail seeds, and append tracks before the queue runs dry. Handle failures, stale requests, mode changes, queue replacement and background playback reliably. Confirm endpoint contract and security before implementation; do not make generic OpenSubsonic playback dependent on AMA.
2. Verify real end-of-track playback stops rather than wraps in Stage 1, if an additional explicit playback-end test is desired. The device check established disabled Skip Next at queue end, not necessarily natural track completion.
3. Review accessibility translations with native speakers where practical.
4. Review the complete diff, commit #77 Stage 1 files deliberately (excluding unrelated changes), and preferably commit this diary separately according to the Project Diary policy.

## References

- GitHub issue: https://github.com/evilnick26/substreamer/issues/77
- Related API investigation: `docs/project-diary/2026-11-07_issue-072_radio-infinite-api-testing.md` (separate issue; pre-existing local untracked file)
- Stage 1 patch scripts used locally: `issue_077_stage1.py` and `issue_077_stage1_test_patch.py` (not assumed to be tracked in Git)
