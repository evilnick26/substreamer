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
