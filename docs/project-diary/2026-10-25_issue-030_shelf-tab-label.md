# sancti.fi Client — Project Diary

## 25 October 2026 — Issue 030: Shelf bottom-navigation label only

### Investigation and approved scope

Read [Issue 030](https://github.com/evilnick26/substreamer/issues/30) in full,
including the updated **25 October** approval and exclusions. Shelf is the final
label for the bottom-navigation destination only, not a new collection type or
a screen-wide/global rename. Refreshed remote `sanctifi` to
`8899eeda3b1c931909e267e623556fe9291792cd`, then created the clean, dedicated
`issue-030-shelf-tab-label` branch. Unmerged PR 44's Settings/version changes are
not included; its separate local APK validation is not touched.

Precise navigation/localisation sources:

- `src/app/(tabs)/_layout.tsx`: the `Tabs.Screen` named `favorites` had
  `title: t('favorites')`, supplying both the default tab label and route title,
  and an Ionicons `heart` icon.
- `src/i18n/locales/en.json`: `favorites` is **Favorites** in the English source
  and is reused elsewhere. Changing it would rename unauthorised UI too.
- Expo Router **57.0.8**, `BottomTabBar.js`: label resolution prefers
  `options.tabBarLabel` over `options.title`. Its existing accessibility fallback
  uses that resolved label; iOS adds tab-position context. `BottomTabItem.js`
  retains its platform role, selected state and normal button handlers.
- `src/app/(tabs)/favorites.tsx` still renders `FavoritesScreen`; the route remains
  `/favorites`. `SearchableHeader` continues using the existing route name for
  search/filter behaviour. There is no need to rename the route or its title.

### Existing favourites semantics checked

- Now Playing uses `FavoriteButton` (`src/components/FavoriteButton.tsx`), whose
  handler calls `toggleStar('song', trackId)`. Its offline-disabled behaviour is
  unchanged. Album Details and Artist Details call the same helper with `album`
  and `artist`; their existing offline visibility rules are unchanged.
- `src/services/moreOptionsService.ts` / `toggleStar` determines current membership,
  applies an optimistic override, calls the appropriate star/unstar wrapper and
  refreshes the existing favourites store; request errors revert the override.
- `src/services/subsonicService.ts` keeps the normal authenticated `getStarred2`
  reads and star/unstar parameters: song `id`, `albumId` or `artistId`. The patch
  adds no API calls or sync protocol.
- `favoritesStore`, `favoritesSyncService` and `src/db/repository/favorites.ts`
  retain SQL-backed membership: starred library rows plus existing `favorite_*`
  remainder tables. The store gates unavailable-API reconciliation so an offline
  stand-in empty payload does not erase membership. These are existing mechanisms,
  not new Shelf storage. The model-table classification retains session-scoped
  favourite data; no user/session or persistence code is changed.
- `src/screens/favorites.tsx` keeps Songs / Albums / Artists, search, indicators
  and the existing Offline/Downloaded gates. Downloaded song favourites still use
  the existing starred aggregate; artists remain subject to their existing
  non-downloadable behaviour. No richer Shelf, playlist or tagging model is added.

**Semantic trade-off:** sancti.fi presents the navigation entry as Shelf, but the
items remain per-user OpenSubsonic favourites/stars. Other clients continue using
those existing semantics; Shelf does not create shared editorial membership.
Box Sets/V/A Series, playlists, audio tags and richer Shelf concepts are untouched.
No live cross-client compatibility experiment is claimed by this source review.

### Minimal implementation

Add only `tabBarLabel: t('shelf')` to the existing `favorites` tab, retaining
`title: t('favorites')`, the heart, route, declaration order, selection, handlers
and accessibility defaults. Add the single English `shelf: "Shelf"` key beside
`favorites`; all existing localisation values and other language files remain
unchanged. Existing fallback/Crowdin conventions handle the new key.

The original title remains **Favorites**, and all other Favourites/Favorites
wording, existing documentation and screen content remain as they were. No
Settings, updater, data, signing, package, build/version or release files change.

### Validation

- New Shelf navigation assertions failed against the old label, then passed after
  the single-option change. The real installed Router renders the production
  layout and retained `FavoritesTab` wrapper with lightweight screen/chrome mocks.
  Tests check Shelf's accessible name, heart, route, order, unselected/selected
  states, unchanged title **Favorites** and unaltered screen placeholder wording.
- Focused navigation, Favourites screen/filter gates, store, sync, repository and
  star-action checks: **16 suites / 438 tests passed**, none skipped, across
  Android/iOS Jest projects. These are automated local tests, not live server or
  other-client interoperability tests.
- `npx tsc --noEmit`: passed.
- Normal full Jest run **once** after the completed change, as requested:
  **632 suites / 11,170 tests passed**. Existing **2 suites / 8 tests skipped**
  because the private captured database fixture is absent; no new tests skipped.
- Intl, translation, ProGuard and native module-inventory checks passed.
  Translation validation reports 2,104 missing-key warnings awaiting Crowdin sync,
  including the new English navigation key's normal fallback/translations.
  Madge reports no cycles, with its three existing vector-icon resolution warnings.
- Exact-source comparison confirms the tab layout differs only by `tabBarLabel`.
  Parsed localisation comparison confirms only `shelf` was added; original values
  are unchanged. Whitespace, diary links/fences and protected-file scope checks
  passed. Excluded screens, actions, persistence, updater, Settings/version,
  dependencies, native metadata, signing and release files remain unchanged.

### Outstanding physical confirmation

No APK was built, signed, installed, published or modified. Native screenshots,
TalkBack/VoiceOver and another OpenSubsonic client were not exercised here.
After review, confirm Shelf is shown with the same heart and selected appearance,
tapping it opens the existing three-segment Favourites destination, and Back,
search/filters and song/album/artist hearts behave normally. Existing non-tab
Favourites wording must remain unchanged. Check accessibility reads Shelf with the
platform's usual context, not a new role or gesture. Physical persistence and
cross-client refresh, if checked, should use the existing per-user favourites
workflow; they are not established by merely renaming a tab.

The PR targets `sanctifi` and must remain unmerged for owner review.
