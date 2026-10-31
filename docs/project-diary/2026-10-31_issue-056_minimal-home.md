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
