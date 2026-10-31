# sancti.fi Client — Project Diary

## 31 October 2026 — Issue 056: Minimal Home

### Scope and implementation

Read the full issue and product-owner comment 6543018362. Base branch `sanctifi`
was fetched at `f8e19ef2`; work is isolated on `issue-056-minimal-home`.

Home's existing route is visible again, but renders `screens/sanctifi-home.tsx`
instead of the upstream Home dashboard. The upstream screen remains available in
source. Library remains the cold-start, login and Android Back destination.
No Magazine, playback, release/version, signing, dependency or schema changes.

The minimal screen contains the owner's transparent horizontal logo, Recently
Uploaded heading, and up to 20 compact artwork / album artist / title rows.
CachedImage supplies the existing disk-cached artwork. Row presses use the existing
`/album/:id` route; its detail fetch supports albums not yet fully synchronized.
A bounded ScrollView renders the 20 rows without a new list abstraction.

The original attachment was downloaded through the GitHub connector and saved as
`assets/branding/sanctifi-horizontal-transparent.png`. PNG dimensions are 1263 x
261, with alpha ranging from 0 to 255. Contain scaling and the original aspect
ratio preserve proportions; width is 90%, capped at 420. Composites at phone width
on white and #121212 were inspected: the purple lettering and colored waveform are
legible on both. These are asset checks, not native screen screenshots.

### Retrieval, refresh and cache behavior

Each Home focus calls the existing `refreshRecentlyAdded(20)`, which calls
`getAlbumList2` with `type=newest` and `size=20`. Reopening after an album-detail
visit also refreshes. There is no Home TTL or full-library synchronization call.
Restoring connectivity while focused also retries. Merely foregrounding the app
with Home already selected does not create a new navigation focus: the existing
root AppState refresh keeps its 10-minute gate. Switch away and back to Home for
an unconditional focus request. There is no polling while Home remains open. The existing cached API object
reuses authentication/client configuration, not album response data. The underlying
module performs a GET for each call; it adds no JS response cache. Native HTTP or
reverse-proxy cache behavior has not been measured against the deployment.

The existing `recentlyAdded` Zustand list supplies immediate cached rows. Its
normalized `albums` and `album_list_entries` tables provide persistence; startup's
existing hydration restores them. Merge upserts preserve richer library metadata.
Successful empty results now clear persisted list membership too (previously stale
membership survived). Refresh returns success/failure so the screen can distinguish
an empty server list from failure. Failed Subsonic protocol envelopes are rejected
rather than converted to empty results. HTTP failures already reject in the API.
Older overlapping individual refreshes are prevented from replacing newer results.

Loading retains existing rows; failure retains them and offers Retry. Explicit
offline mode or absent connectivity skips the request and displays an offline
notice. Cached entries are not claimed to be downloaded; existing Album Details
and playback rules continue to decide what can be opened/played offline. The list
shares the existing cache with upstream background refresh and sync; those existing
paths retain their own settings/timing. A Home focus always requests 20 regardless
of the user's upstream list-length preference, and display is capped at 20.

### Server source evidence

Read-only Navidrome checkout at `ec2e0a9ea9cd7c2f08f930fc0579b991e1fe0900`:

- `server/subsonic/album_lists.go:28,76-78`: newest selects the newest filter and
  queries the album repository with requested size/offset.
- `server/filter/filters.go:25`: newest orders `recently_added` descending.
- `persistence/album_repository.go:152-157`: this maps to created_at by default;
  with `RecentlyAddedByModTime`, it uses updated_at instead. Album ID breaks ties.
  Release year/date is not the ordering criterion.
- `model/mediafile.go:389-390`: album created_at aggregates the oldest track
  BirthTime; `model/metadata/map_mediafile.go:81` takes that from file metadata.
  `core/storage/local/local.go:120-127` uses filesystem birth time, with a current
  time fallback. Thus newest is the server's added-time proxy, not guaranteed
  indexing completion time; preserving old file timestamps can keep a newly
  indexed album outside the first 20. No client-side release-date sort is applied.
- `server/subsonic/helpers.go:470-483`: AlbumID3.artist is AlbumArtist, while year
  is a separate field. This is why the Home row displays `album.artist`.

The deployed Navidrome version/configuration was not available. No live album was
uploaded/indexed here. Client tests change the endpoint result and prove it appears
on reopening without invoking a full sync; they do not measure scan/index latency.
An album must be indexed and returned in the endpoint's first 20 to appear.

### Validation

- Final TypeScript `npx tsc --noEmit`: passed.
- Focused screen, real Router, album-list store and Subsonic service tests:
  **8 suites / 468 tests passed**, across Android and iOS.
- New Home screen coverage (Android): **100% statements/functions/lines,
  95.45% branches**. Eleven focused cases include reopening with changed results,
  SQL persistence and successful empty clearing, failure/retry, both offline gates,
  row navigation, row cap, missing album artist, and two overlapping-request races.
- Intl, translation and native module-inventory validators passed. Translation
  validation reports **2,286 missing-key warnings** awaiting Crowdin, including
  fallback English for this feature's new strings.
- Madge with TypeScript configuration: **no circular dependencies** (three
  existing vector-icon static imports unresolved).
- Initial full Jest run: **647 suites passed, 1 failed, 2 skipped**; **11,349
  tests passed, 1 failed, 8 skipped**. The sole failure was an existing
  MoreOptionsSheet iOS star-action close wait timing out. It passed in isolation
  (**244 tests**) and paired with Home (**266 tests**). A full repeat is recorded
  below. The baseline full run was interrupted; it is not claimed as a pass.
- Final full repeat `npx jest --no-coverage --maxWorkers=2`: **648 suites /
  11,352 tests passed** in 308.944 seconds; the existing **2 suites / 8 tests**
  remain skipped (private migration fixture absent). No new skips or failures.
  The earlier timeout remains recorded above rather than hidden by this pass.
- `git diff --check`: passed. No native build, physical device, live Navidrome
  indexing experiment or full-screen native visual check was available here.

### futwick Android handover

The cloud workspace and futwick are separate checkouts. After PR review, fetch the
issue branch in futwick; do not copy paths or assume a shared filesystem:

```sh
git status --short
git fetch origin issue-056-minimal-home
git switch --create test-issue-056 --track origin/issue-056-minimal-home
npm ci
npm run android:device
```

Keep any local work before switching. If test-issue-056 already exists, use a new
local branch name. This tests the PR without merging `sanctifi`. Use the existing
futwick Android SDK/signing setup. Do not change app versions or release channels
for this feature test.

On device: confirm Library still opens at startup; visit Home in both themes and
narrow/large font configurations; tap an album, return to Home, and check another
newest request. Add an album to Navidrome and wait for indexing; compare its ID
against `getAlbumList2?type=newest&size=20`, then reopen Home and time appearance.
Test airplane mode with/without cached rows, connection failure/Retry, a genuinely
empty server list and an album not yet included in the full library sync. Verify
existing downloaded playback and Back behavior. No merge was performed.

## Android acceptance feedback and UI refinements — 31 October 2026

### Physical-device foundation accepted

Read the owner's [PR feedback](https://github.com/evilnick26/substreamer/pull/62#issuecomment-6544082349)
before editing. The original implementation was successfully built on futwick and
run on a physical Android phone. The owner accepts it as a functional foundation:
artwork, artist names and album titles display correctly. This is owner-reported
device evidence; the cloud checkout still does not share futwick's filesystem.
The reported screenshot exposed inherited header controls and an oversized logo
extending beyond the display's right edge. The previous asset/style checks did
not establish native layout correctness.

### Requested refinements and implementation

- Home alone sets `headerShown: false` in the tab navigator. This removes its
  inherited Search, Offline, Favorites and grid controls. Other tabs retain their
  existing header. Home uses the safe-area top inset plus 12 points of padding,
  with safe-area left/right insets, instead of shared search-header height.
- The existing transparent PNG is unchanged. A container with 16-point horizontal
  margins measures its available width using `onLayout`; the Image receives that
  numeric width and its proportional height (`width * 261 / 1263`). Both dimensions
  start at zero until measurement. Resizing remeasures the container. No intrinsic
  asset dimension, device width assumption, fixed logo height or cropping is used.
  `resizeMode="contain"` and the theme-provided background remain in effect.
- The first 20 albums are grouped under one heading per server-added calendar day.
  Day groups follow their first appearance in the server's newest-first list;
  albums within a day retain their order. Full year is included so different years
  cannot collapse into one heading. Dates use the device's local calendar day.
- `formatAddedDate` in the existing `utils/dateFormat.ts` reuses its Date/string/
  number parsing and unavailable-date convention, with the existing
  `layoutPreferencesStore.dateFormat` preference. Month/Day renders YYYY/MM/DD;
  Day/Month renders YYYY/DD/MM. Changing the preference updates headings without
  another request. No new setting or dependency was added.
- Missing/invalid dates and unset server timestamps (Go zero time or epoch zero)
  are labelled **Added date unavailable**. Neither release date/year nor current
  time is substituted. Artwork, compact rows, Album Details routes, focus refresh,
  cached/offline/error behavior, Library startup and Android Back are preserved.
  Home's shared BannerStack is hidden with the header; its existing inline offline
  and error messages remain. The shared banners remain on other tabs.

### Added-date investigation and limits

The endpoint already returns `AlbumID3.created`; it does not expose a separate
indexing-completion timestamp. In the API wrapper, JSON responses are returned
without date revival (`modules/subsonic-api/src/index.ts:194-220`), so network dates
can be strings despite the Date type. Existing SQL mapping stores the timestamp
(`src/db/repository/mappers.ts:152`) and rehydrates a Date
(`src/db/repository/albums.ts:125`). The formatter accepts both representations.
No persistence changes are necessary.

Navidrome source at the previously recorded reference commit confirms
`server/subsonic/helpers.go:470-483` maps `created` from `albumCreatedAt`, separately
from release year. `helpers.go:346-356` uses CreatedAt by default, UpdatedAt under
RecentlyAddedByModTime, with legacy fallbacks. `model/mediafile.go:390` derives
CreatedAt from track BirthTime. Thus these are the server's **Added** dates (also
used by the existing Album Details Added field), not invented upload dates or
release dates. They are not guaranteed to be the moment Navidrome indexed an
album. The deployed server payload/configuration has not been independently
captured here. Missing dates are reported honestly by the unavailable heading.

### Refinement validation

- Final `npx tsc --noEmit`: passed.
- Focused Android/iOS Home, real Router and date formatter tests: **6 suites /
  76 tests passed**. Tests cover same-day grouping, date preference changes,
  raw JSON strings and cached Date objects, unknown/invalid/zero timestamps,
  same-day and cross-year order, row routes, the 20 cap, cached offline/error and
  refresh behavior, header removal limited to Home, safe-area placement and
  numeric logo resizing at widths 288, 328 and 736.
- Android coverage: Home **100% statements / 96.15% branches**; date formatter
  **100% statements / 100% branches**. Existing locale-based detail formatters
  also retain their output and unavailable-date behavior.
- Full final Jest run: **650 suites / 11,382 tests passed** in 284.336 seconds.
  Existing **2 suites / 8 tests** remain skipped for the absent private migration
  fixture. No new skips or remaining failures.
- Intl and translation validators passed. Translation validation reports the
  existing Crowdin backlog plus the new unavailable-date label: **2,299 missing-key
  warnings**; all 13 locale files validate and fall back to English where needed.
- Madge with TypeScript configuration: no circular dependencies; the same three
  vector-icon static entry points remain unresolved. `git diff --check` passed.
- The unchanged logo was composited at width 288 on light (#f5f5f5) and dark
  (#121212) backgrounds and inspected: the complete logo remains legible. These
  are asset/frame checks, not screenshots of a revised native Android screen.
  No revised APK was built in the cloud; physical layout acceptance remains on
  futwick as requested.

### Revised futwick acceptance

Keep local work before updating. If already on the issue branch:

```sh
git fetch origin issue-056-minimal-home
git switch issue-056-minimal-home
git pull --ff-only origin issue-056-minimal-home
npm run android:device
```

If testing on the earlier local `test-issue-056` branch instead, fetch first, switch
to it, then run `git merge --ff-only origin/issue-056-minimal-home`. No dependency
changes were made. Build with the established futwick SDK/signing setup.

Verify the revised APK in light/dark themes, narrow portrait and landscape widths:
logo begins below the status bar, remains entirely visible and resizes without
stretching. Home must have no inherited controls while Library retains them.
Verify same-day grouping and both existing date preferences, cached/offline dates,
row navigation and refresh after leaving/reopening Home. This revision still needs
physical Android acceptance; PR 62 remains open and unmerged.
