# sancti.fi Client — Project Diary

## 27 October 2026 — Issue 024: Artist release-type grouping implementation

### Authorisation and baseline

The owner authorised implementation, testing and an Android build, with no
commit, push, rebase, merge, installation, data reset, metadata modification or
automatic resync. Installed release APK non-debuggability is explicitly not an
implementation blocker. Device acceptance remains the owner's final gate.

Read the Issue 024 client-metadata-verification diary and earlier investigation
and product decisions. Preserve those historical entries unchanged. Owner's
production evidence remains Ballboy Album/EP/Single, 3/3 PASS on obscurity
Navidrome 0.64.2, with MUSICBRAINZ_ALBUMTYPE verified across 17 FLAC tracks.

Initial local checkout: work at 2ee497cdc442de45589c2f685367c0d6afbe645b.
The only pre-existing untracked work was the client verification diary.
Fetched sanctifi and created issue-024-artist-release-grouping at
401026607cccf68b1ea25b003ccfc1d046c62da6, preserving that file.
No commits were created.

### Implementation decisions and files

- src/utils/artistReleaseGroups.ts: pure case-insensitive, whitespace-trimmed
  matching of album/ep/single. Exactly one distinct recognised primary selects
  its group; duplicates agree; conflicts and no recognised primary select
  Other Releases. Secondary/unknown descriptors are ignored only for matching,
  never rewritten. Stable partition preserves original album objects and order.
- src/screens/artist-detail.tsx: subscribe to the preference, group the existing
  sorted array, and render nonempty Albums, EPs, Singles, Other Releases headers
  in the existing FlashList. Separate header/album recycling types and stable
  keys. Existing AlbumRow, artwork, version/navigation/actions remain unchanged.
  OFF passes through the existing sorted album array and unified Albums heading.
  The shared Newest/Oldest control remains available for Other-only artists.
- src/store/layoutPreferencesStore.ts: default-true boolean and setter, persisted
  through existing partialize/KV storage. Older preferences inherit true; saved
  false survives fresh store loading. No migration.
- src/components/settings/ArtistAlbumSortOrderCard.tsx: accessible native switch
  inside the existing Appearance artist-sorting card using SettingsRow.
- src/i18n/locales/en.json: four English source labels. Other locales use existing
  English fallback until Crowdin translations arrive.
- Focused tests added in utils/__tests__/artistReleaseGroups.test.ts and
  screens/__tests__/artist-detail.releaseGroups.test.tsx; extended existing
  store/__tests__/layoutPreferencesStore.test.ts.

No services, database schemas, migrations, protocol, dependencies, AlbumRow,
signing configuration, app identity, version allocation or other screens changed.
No network requests were added for grouping. Missing/stale metadata remains
visible under Other Releases without any repair or refresh.

### Validation

TypeScript passed. Focused Jest: 8 suites / 136 tests passed across Android/iOS,
including existing AlbumRow behaviour/navigation tests. New screen tests use the
real screen and Appearance card with mocked data/chrome, verify live switching,
section order, lossless original object handoff and both year-sort directions.
Helper coverage: 29 Android tests, 100% statements/branches/functions/lines.
These tests are not physical device/FlashList layout acceptance.

Intl, translation, native-module inventory and ProGuard validators passed.
Translation validator reports 2,221 missing community-key warnings pending
Crowdin. Madge 8.0.0 reports no circular dependencies (three static icon warnings).
Final review also aligned the new setting row with existing card padding and
namespaced grouped album/header keys separately while retaining OFF-mode IDs.
Diff whitespace checks passed; deliberate second-pass review checked empty
sections, Other-only sorting, memo dependencies, metadata mutation and OFF parity.

Final full Jest: 638 suites and 11,262 tests passed across both projects;
2 existing suites / 8 tests skipped (private migration fixture unavailable).
Total: 640 suites / 11,270 tests. Duration: 544.609 seconds. Both
MoreOptionsSheet suites passed on this final full run. Existing sync tests took
about 146 seconds per platform due to real retry backoff; no sync code changed.
One earlier broad run hit an unrelated iOS MoreOptionsSheet favourites-close
wait failure. The unchanged suite passed all 122 tests on both untouched
sanctifi and the feature tree when isolated. Do not label that as a proven
pre-existing defect or repair unrelated code. Interrupted early broad invocations
are not counted as full-suite passes.

### Android build and artifact status

Established release-only Gradle wrapper attempted:
bash scripts/build-android.sh --gradle-only --release

It stopped before Gradle: the project's macOS-specific Java resolver did not
locate the installed Linux OpenJDK 21. No Android SDK/native generated project
or configured permanent signing material is available in this environment.
Permanent signing documentation requires the retained key on futwick; no key
was generated, requested for transfer or replaced with debug signing.

Android production Metro/Hermes export passed: 2,721 modules, one approximately
11 MB .hbc bundle, output /workspace/work/issue024/android-export.
Final bundle includes the grouped album/header namespaces and preference.
This is a JavaScript bundle, not an installable APK. Initial export attempted
Expo's absent home cache; retry used a scratch Expo settings directory and
disabled telemetry without changing project configuration.

No APK was produced, so APK package/signature verification is outstanding.
Source app.json still identifies fi.sancti.client, and signing/configuration
files remain unchanged. No application was installed or removed.

### Outstanding owner acceptance

Build the uncommitted feature tree on the established futwick environment with
its existing SDK/key. Verify package fi.sancti.client and the permanent release
signer against the accepted APK. Do not change signing, uninstall or clear data.

Owner acceptance after an independently approved in-place installation:
1. Appearance grouping defaults ON. Ballboy's Daylight Hours is in Albums,
   Radio Are Shite EP in EPs, Europewide Search for Love in Singles.
2. Check every other Ballboy release remains visible exactly once.
3. Toggle OFF: original unified order/presentation. Toggle ON: sections return.
4. Restart in both preference states to check persistence.
5. Check artwork, versions, navigation/actions and both year-sort directions.
6. Check one-category, missing/unknown/conflicting metadata and large artists.
7. If expected types appear under Other Releases, investigate stale installed
   metadata without triggering a resync.

Issue 024 remains awaiting native build verification and owner device acceptance.

