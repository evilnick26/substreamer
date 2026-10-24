# sancti.fi Client — Project Diary

## 24 October 2026 — Issue 035: Library as the default navigation destination

### Starting point and scope

Read [Issue 035](https://github.com/evilnick26/substreamer/issues/35), including its
recorded investigation, then refreshed remote `sanctifi` to
`6e425593758767d31a930325ffca149cb78c3194`. Implementation uses the dedicated
`issue-035-library-default` branch. The baseline already includes the merged
Issue 023 implementation; its code and separate futwick acceptance work are
unchanged by this change.

Hide the inherited Home tab while retaining its route and implementation. Make
Library the explicit startup/authenticated destination and Android Back root.
The future magazine-style Home is not implemented. No version, signing, release
packaging, dependency, APK, hosting or publishing changes are included.

### Router investigation and decisions

The installed Expo Router is **57.0.8**. Its `layouts/TabsClient.js` maps per-screen
`href: null` to a hidden tab item and a null tab button, without removing the
route. The conflict check rejects a button defined on that same screen; this
fork's shared `screenOptions.tabBarButton` remains compatible. Regression tests
render the production tab layout using the real installed Router and tab bar,
with screen content/chrome mocked to keep playback and database startup out of
the navigation tests.

The tests exposed two details beyond the earlier read-only proposal, reported
before implementation:

- Both root `index` and retained `(tabs)/index` match `/`. Without an explicit root
  linking anchor, the Router harness selects Home for a cold `/` URL. The root
  layout now exports `unstable_settings.initialRouteName: 'index'`, resolving a
  fresh root launch through `IndexScreen`, which redirects to Library or login.
  The lightweight test root uses this same setting and a source assertion guards
  that it stays aligned with production. Tests clear the previous test's Router
  group preference when modelling a fresh process.
- The installed `TabRouter` defaults Back to `firstRoute`, which remains Home in
  the retained route declarations. The tabs now explicitly use
  `initialRouteName="library"` and `backBehavior="initialRoute"`; navigator Back
  returns to Library without selecting hidden Home.

A final redirect audit also found three `/` destinations in `LoginScreen`, beyond
those listed in the issue investigation. Normal success, successful certificate
trust retry and the already-authenticated redirect now explicitly use Library.
The root layout's authenticated-login effect also goes directly to Library,
removing reliance on ambiguous `/` navigation. Login/session handling, password
casing/whitespace and certificate trust behaviour are otherwise unchanged.

### Implementation

- `src/app/(tabs)/_layout.tsx`: hide only Home's tab button; keep Library,
  Favourites, Search and Settings, shared tab styling and keyboard dismissal.
- `src/screens/index.tsx`, `src/screens/login.tsx`, `src/app/_layout.tsx`: explicit
  Library redirects and the root link anchor described above. Logged-out startup
  still goes to login; existing logout/history-clearing safeguards remain.
- `src/hooks/useAndroidTabBack.ts`: move the existing root Back effect into a
  narrow, directly tested hook, called from the same root layout. Android Back
  on Library calls `moveToBack()`; other root tabs, including the retained Home,
  navigate to Library. Both cases consume the event, preserving the existing
  native tab-fragment `canNavigateBack()` exception workaround. Listener cleanup
  and non-Android behaviour are retained. Non-tab album/artist/playlist detail,
  player, login and play routes pass Back through to existing stack handling.
- `src/app/play.tsx`: change only the fallback destination to Library. Voice
  request mapping, once-per-mount dispatch and the nonblocking playback path used
  by Android Auto/headless media are unchanged.
- Retained Home's wrapper and `HomeScreen` byte-for-byte. Explicit `/(tabs)` still
  reaches that hidden route; hiding a tab deliberately does not delete a route
  or redirect every explicit Home link/restored state. Fresh startup and normal
  authentication now choose Library explicitly.

### Validation

- Baseline `npx tsc --noEmit` and full Jest passed before production edits:
  **626 suites / 11,056 tests passed**, with the existing 2 suites / 8 tests skipped.
- Final `npx tsc --noEmit`: passed.
- Focused navigation, voice fallback, Android Back and login checks:
  **8 suites / 66 tests passed** across Android and iOS Jest projects. This covers
  both root-index destinations, real tab visibility/navigation, retained Home,
  navigator Back, detail/Now Playing stack return, native Back interception,
  listener refresh/cleanup, iOS passthrough, nonblocking once-only voice dispatch,
  normal/already-authenticated/certificate-retry login and exact password handling.
- Dedicated Back-hook coverage run: **30 tests passed**, with **100% statements,
  branches, functions and lines** for `useAndroidTabBack.ts`.
- Final `npx jest --no-coverage --maxWorkers=2`: **632 suites / 11,118 tests
  passed**. The existing **2 suites / 8 tests** in `fixtureMigration.test.ts`
  remain skipped because the private captured database fixture is absent. No new
  navigation or login tests are skipped.
- Intl, translation, ProGuard and native module-inventory validators passed.
  Translation validation reports the existing 2,117 missing-key warnings awaiting
  Crowdin sync; this change adds no translation strings.
- Madge with the TypeScript config: no circular dependencies; the same three
  vector-icon static entry points are unresolved/skipped.
- `git diff --check`, diary link checks and protected-file scope checks passed.
  Home's wrapper/screen, Search overlay, headless media/voice mapper, Issue 023
  modules, app/version metadata, dependencies, signing and release tooling are
  unchanged.

Tests live outside `src/app` so they cannot be discovered as application routes.
The Router harness checks actual navigation with lightweight content; it does
not execute the full production root's player/database/native startup. The
hardware Back tests execute the real hook's registered callback and lifecycle,
with the native background call observed through a spy.

### Outstanding device acceptance

No APK was built or published. No connected Android device/emulator or React
Native visual renderer is available here; before/after native screenshots and
physical tab-fragment behaviour were not validated. On futwick/Nick's phone,
check after review:

1. Cold startup and login/relogin open Library. Verify a fresh launch and activity
   recreation/restoration, including an installation previously left on Home.
2. Only Library, Favourites, Search and Settings appear as main tabs, with no
   blank Home slot. Verify tab layout, selection and search keyboard behaviour.
3. Back from each other root tab returns to Library; Back on Library backgrounds
   the app without the native tab-fragment exception, and playback continues.
4. Album/artist/playlist detail and Now Playing Back/dismiss actions still return
   to the appropriate previous screen. Verify direct detail deep links as well as
   screens pushed from a selected tab, because the root link anchor affects the
   initial navigation history.
5. Verify logout cannot reveal signed-out history, and both ordinary login and
   certificate-trust retry return to Library.
6. Exercise voice/deep-link media playback and Android Auto on the device. The
   tests protect dispatch/fallback and existing media-service regressions, but do
   not establish physical Android Auto behaviour.

Issue 023's update-check acceptance remains separate. This PR is for review only
and must not be merged by Codex.
