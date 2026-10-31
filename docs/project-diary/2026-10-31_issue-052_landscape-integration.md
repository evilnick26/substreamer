# sancti.fi Client — Project Diary

## 31 October 2026 — Issue 052: Landscape NPS integration

### Why integration was required

The experimental phone landscape NPS was implemented on
`issue-052-phone-landscape` at `6b240ef9b533effd556505812ff0eacc3af0d10d`,
from the older base `2ee497cdc442de45589c2f685367c0d6afbe645b`.
It could not be treated as a replacement for current sancti.fi: accepted work
had accumulated on `sanctifi`, including Issue #056 simplified Home, portrait
inline lyrics, album-version presentation, navigation and settings improvements.

Both remote refs were fetched before merging and fetched again before publication.
`origin/sanctifi` remained `921eee105ba05cce218ebc3d73118cdf5ff02998` and
`origin/issue-052-phone-landscape` remained `6b240ef9b533effd556505812ff0eacc3af0d10d`.
There was no advancement from the owner's supplied baseline.
`git rev-list --left-right --count origin/sanctifi...origin/issue-052-phone-landscape`
returned `161 1`: 161 commits unique to sanctifi and one unique landscape commit.
Their merge base was `2ee497cd`.

### Integration and four conflict resolutions

Created `integration-052-056` from the fetched `origin/sanctifi` and performed a
normal, non-squashed merge of `origin/issue-052-phone-landscape`. This reproduced
the same four conflicts reported on futwick. No original branch was rewritten,
force-pushed or merged into. The semantic merge commit is
`feb0c515b5dd05ca83e54afe78115843a047c1fd`, with parents `921eee10` and `6b240ef9`.
This diary is added in a separate follow-up commit because the expanded diary
requirement arrived after that merge commit was created locally, before pushing.

- `src/app/_layout.tsx`: retained sanctifi's removal of the old BackHandler import
  and its existing `useAndroidTabBack` handling. Integrated #052's shared stable
  device classification and serialized phone orientation policy, including the
  startup portrait request. No older root navigation implementation was restored.
- `src/i18n/locales/en.json`: retained the portrait synced-lyrics preference string
  and all other sanctifi strings, adding the #052 rotation/control strings.
  Programmatic checks confirmed no duplicate keys and no missing key from either
  parent's English bundle.
- `src/screens/player/player-phone-portrait.tsx`: retained the current portrait
  content implementation and its lyrics/visibility inputs, progress/control/info
  ordering, local album version and album/artist navigation. Added only the #052
  shell props, orientation header control, landscape safe-area padding and player
  content selection. Imported the landscape presenter without restoring the
  obsolete portrait PlaybackRateButton import. Landscape continues using its own
  seekable progress component, independent of lyrics availability.
- `src/screens/player/__tests__/player-phone-portrait.test.tsx`: retained both
  parents' test blocks with their correct scopes. Added an integration regression
  that starts with cached eligible synced lyrics in portrait, rotates to the
  landscape player with seeking and no inline lyrics, then returns to the same
  portrait lyrics behavior without changing its preference.

### Preservation review

Independent read-only review found no concrete semantic merge regression. Exact
content comparisons confirmed that Home routes, Home source/tests and tablet
player source match `origin/sanctifi`. The new landscape presenter, orientation
hook/service, experiment store/card, phone route and device-layout code match
`origin/issue-052-phone-landscape`. The resolved phone portrait diff against
sanctifi adds the landscape shell integration; it does not replace newer portrait
content. No unrelated production file was changed to resolve the merge.

The phone screen shell remains mounted across rotation, preserving tabs and player
state. Full lyrics-tab access and lyrics retrieval remain available. Inline lyrics
are excluded from the main landscape presentation; portrait inline lyrics retain
the existing preference and behavior. Both Android orientation experiments and
phone exclusion from the 900dp tablet takeover are retained. Tablet implementation
files are unchanged. All existing accepted sanctifi history is retained through
the first merge parent.

### Validation

- `npx tsc --noEmit`: passed, zero reported TypeScript errors.
- Focused Jest run across Android/iOS: **22 suites, 224 tests passed**, zero
  failures or skips. Includes Home, portrait/landscape NPS, inline lyrics,
  orientation lifecycle/service, wide-layout routing, tablet player, experiment
  card/store and device classification.
- Full Jest run with `--no-coverage --maxWorkers=2 --workerIdleMemoryLimit=256MB`:
  **662 suites passed, 2 skipped; 11,440 tests passed, 8 skipped; zero failures**.
  Duration 235.35 seconds. No new skips were introduced.
- Intl validator: passed.
- Translation validator: all **13 locale files passed**. It reports **2,468
  missing-key warnings** awaiting translation sync; existing English fallback
  applies. No translation validation errors or parent English keys were lost.
- Native-module inventory: passed, **7 tested modules**.
- Offline Android Expo/Metro/Hermes export: passed. This is a JS/Hermes bundle
  export, not a native APK build or physical-device check.
- Conflict-marker/unmerged-file checks and `git diff --check`: passed.
- Madge was not installed in this cloud checkout, so no Madge result is claimed.

### Outstanding futwick testing

No Android SDK, connected phone, native APK build or physical rotation/geometry
validation was available in this cloud environment. Retrieve the integration
branch on futwick and build the APK before acceptance. Check:

1. Simplified Home, existing Library/navigation/playback and portrait metadata,
   album-version links and inline-lyrics preference.
2. Automatic rotation with Android auto-rotate both enabled and disabled; manual
   landscape/portrait with auto-rotate disabled.
3. Leaving NPS through Back, close and album/artist navigation restores portrait;
   background/foreground and repeated NPS entries do not leave other screens in
   landscape or interrupt playback.
4. Queue/info/full lyrics tabs survive rotation. Main landscape NPS has no inline
   lyrics, including tracks with eligible cached synced lyrics. Portrait lyrics
   return after rotating back.
5. Actual artwork/control fit with cutouts, system navigation, short windows,
   larger text and phone widths above 900dp; tablet portrait/wide behavior.

Do not merge this integration branch into sanctifi until that review and device
testing are accepted. This entry does not mark Issue #052 accepted or closed.

### Workflow lesson

Start new issues from the latest accepted `origin/sanctifi`, rather than an older
upstream or cloud default branch. Fetch and verify the actual commit before
creating the issue branch. Check divergence again before building or merging,
using the merge base and the left/right commit counts. If accepted development
has advanced, integrate it semantically on a separate branch and rerun regression
validation before device testing. Cloud and futwick are separate working trees;
explicit commit, push and fetch are required to transfer completed work.

Historical diary entries were left unchanged.

## 31 October 2026 — Landscape refinement and portrait parity audit

The owner reports a successful physical Android build/test of the initial
prototype and a promising result, with layout refinements still required. That
report concerns the previous implementation; the changes below have not yet been
physically validated. Work started from a clean `integration-052-056` checkout at
`0b830c417cbc74e0ddcb2220ffa275a3abd3e2fb`, matching its fetched remote tip.

### Audit before implementation

Read the current portrait and landscape source plus relevant history, rather than
assuming all owner/workstation changes had separate diary entries. Relevant
changes include `478e7375` (year/version), `9f3f8ca6` (version visibility),
`b2ddc53c` (artist navigation), `85159739` (decluttering and overflow options),
`8b5efc0c` (final portrait layout), and subsequent inline-lyrics integration.

The portrait code shows artwork, progress or optional inline lyrics, transport,
then linked metadata. Album metadata includes year, optional local version and
album navigation. Favorite/Bookmark sit together beside metadata; the active
Sleep Timer capsule overlays artwork. Sleep Timer, playback speed and output
selection remain accessible through existing overflow functionality.

The initial landscape presenter omitted year/version preference and navigation,
and retained standalone Sleep Timer and Cast controls from the earlier upstream
layout. These omissions/presentation differences were reported before editing.
The side-by-side composition, static metadata and absence of inline lyrics are
intentional landscape differences. The owner explicitly prefers Favorite and
Bookmark in their existing lower landscape row, so those remain first in that
row and continue using the shared controls/state handlers.

Product decisions left unchanged: landscape still offers playback rate and
optional skip controls directly, while portrait moved them to overflow; the
existing active countdown capsule remains in landscape's lower row. The removed
Sleep Timer control is the standalone icon, not the conditional active capsule.
Whether those remaining secondary controls/capsule should also be relocated or
removed is not decided here.

### Implementation

- Android phone landscape uses a compact 40dp custom header (previous Android
  header budget 56dp) with a 14sp "Playing" label. Current cutout/top insets are
  respected. A layout effect switches headers before paint and restores the
  normal native header in portrait. Portrait content sizing/ordering is unchanged.
- Reduced landscape gaps and vertical padding. Metadata/seek content retains a
  vertical overflow fallback; primary transport is outside it and remains pinned.
  Measured details dimensions select compact text and a 44dp play button on short
  or narrow areas (52dp otherwise). Extremely narrow columns relocate Shuffle and
  Repeat to the horizontal secondary row; Favorite and Bookmark remain first.
- Added linked artist/album metadata, positive album year, and the same optional
  local album-version lookup/preference as portrait. Late album-version results
  are ignored after album changes/unmount. No server fetch or metadata duplication
  is introduced. Removed standalone SleepTimerButton and CastButton imports/rendering
  only from landscape; underlying stores, output controls and overflow actions
  are unchanged. Full lyrics tab, retrieval/storage and portrait inline lyrics
  remain unchanged; main landscape content never renders inline lyrics.
- A phone-only status-bar hook owns a React Native StatusBar stack entry while
  Android landscape NPS is focused and foreground-active. It pops that exact entry
  on portrait, blur, background or unmount, restoring the existing Expo/root policy.
  Unrelated renders do not repeatedly push/reset it. The override is nonanimated
  and installed in a layout effect; no Android navigation-bar API is called.
- Header padding follows live safe-area insets. Artwork and details measure the
  actual remaining content area after header, tabs and safe areas, so hiding the
  status bar can reclaim space without a hardcoded status-bar-height subtraction.

### Artwork sizing and limits

Portrait artwork sizing is byte-for-byte unchanged. It fits the portrait width
(minus its existing 64dp horizontal padding, capped at 400dp) and its existing
height/tier budget. Landscape no longer allocates art via the old 1:1.4 column
ratio. Its square is the largest that fits the measured body height and width,
reserving a 220dp transport/details column and 12dp separation:
`max(0, floor(min(bodyHeight, bodyWidth - 220 - 12)))`.
There is no additional artwork percentage reduction or estimated height reserve.
The square uses contain scaling, preserving the whole cover without stretching or
cropping non-square source images.

Equal portrait/landscape size is constrained by the remaining landscape height.
Even with the status bar hidden, the 40dp header, 52dp bottom tabs, actual safe
areas/navigation region and 4dp body vertical padding still consume space. If the
portrait cover is larger than that measured square, equal size cannot fit without
changing those controls/regions; this implementation uses the largest available
square. It does not shrink portrait artwork to manufacture parity.

The owner provided a 1200 x 2608 pixel panel resolution at approximately 416 ppi.
This identifies the physical short edge but not Android logical display density,
window insets, or displayed artwork dimensions. Physical ppi must not be treated
as React Native PixelRatio. No paired portrait/landscape artwork measurements were
available. Automated layout-event tests are not a substitute for that comparison.
Verify actual size parity and constraints on futwick, particularly after status-bar
inset updates.

### Validation and remaining device work

Focused Android/iOS checks: 14 suites / 218 tests passed. TypeScript passed. Tests
cover year/version visibility and stale results, metadata links, removed controls,
Favorite state/offline handling and Bookmark auto/manual/disabled paths, maximum
square bounds/contain mode, compact/narrow transport behavior, custom header reset,
phone/tablet selection, orientation lifecycle and status-bar ownership/restoration
across repeated rotation, focus and foreground changes. Original portrait tests,
Home tests and tablet player tests remain passing.

Exact source comparisons confirm portrait PlayerContent/artwork sizing and all
subsequent portrait presenters/styles are unchanged. Home, tablet players and the
orientation lifecycle/service are unchanged. Android Expo/Metro/Hermes export,
Intl, all 13 translation validators and the 7-module inventory check passed.
Translation validation reports 2,481 missing-key warnings with existing English
fallback, including the new Playing label. No Madge result is claimed because it
is not installed here. Final full-suite counts are recorded below.

Physical checks still required: same-phone artwork-size comparison; normal fit
without vertical scrolling; cutouts/navigation bars and large text; both automatic
rotation directions; manual landscape with system auto-rotate off; header/status
bar flicker or jumps; restoration on close, album/artist navigation, background/
foreground and repeated rotations; metadata/version preference, lower-row controls
and full lyrics access. No native APK/device test or navigation-bar change was
performed in this cloud session. Do not treat the earlier device test as acceptance
of these refinements. Historical diary sections remain unchanged.

Final full Jest validation: **664 suites passed, 2 skipped; 11,468 tests passed,
8 skipped; zero failures**. No new skips. All intended refinements are isolated
to the phone landscape presenter/header/status-bar scope and their integration
tests, with the diary and one English label added.
