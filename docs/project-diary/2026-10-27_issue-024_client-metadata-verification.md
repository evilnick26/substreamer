# sancti.fi Client — Project Diary

## 27 October 2026 — Issue 024: Final client-side metadata verification

### Scope and baseline

Read-only investigation; no feature implementation authorised. Read the earlier
Issue 024 working diary draft and the remote Issue 022 physical-upgrade and
Issue 047 Alpha reconciliation entries. Historical entries remain unchanged.

Current local branch is work at 2ee497cdc442de45589c2f685367c0d6afbe645b.
Remote sanctifi remains 401026607cccf68b1ea25b003ccfc1d046c62da6.
No checkout, commit or remote mutation was performed. This new diary entry is
the only repository change.

Compared Git blob IDs for the traced source paths. API parser/types, services,
schema, mappers, core persistence, detail query, database client and Artist
Details match sanctifi. albums.ts differs only by sanctifi's unrelated
getAlbumVersion helper and trailing whitespace; the release-type path matches.

### Owner-supplied production evidence

Owner reports obscurity/Navidrome 0.64.2 passes all three Ballboy cases:
A Guide for the Daylight Hours -> Album;
All the Records on the Radio Are Shite EP -> EP;
A Europewide Search for Love -> Single.
All 17 FLACs were checked; actual source key is MUSICBRAINZ_ALBUMTYPE.
Live Navidrome SQLite canonical tags and ordinary nonadmin search3 responses
retain the expected arrays. Treat this as owner-verified production evidence,
not server requests executed in this session.

### Client source findings

modules/subsonic-api/src/index.ts #requestJSON returns the parsed envelope.
AlbumID3.releaseTypes is an optional string array.
subsonicService.searchAlbumsPage returns server album objects unchanged;
normalizedLibrarySync passes them to upsertAlbums.

albumReleaseTypeRows maps every supplied token to album_id/pos/name.
upsertAlbums includes album_release_types in bulkUpsert's atomic child writes.
hydrateAlbumRows reads the children by pos; albumListRowToAlbumID3 retains them.
getArtistBase hydrates albums before returning them.
Artist Details assigns those albums directly and sorts an array copy before
passing original album objects to AlbumRow. No discard found.

Existing schema/model are sufficient. No migration, duplicated metadata,
ingestion repair or protocol extension is indicated.

### Executed verification and limitations

Existing API, repository and detail-read tests passed in both configured Jest
projects: 6 suites, 446 tests. These execute isolated fixtures using the
better-sqlite3-backed in-memory op-SQLite substitute, not a physical device.

A scratch-only integration test outside the repository also passed:
mock search3 JSON response -> real API parser -> upsertAlbums ->
actual SQL rows -> getArtistBase hydrated albums. It verified the three reported
arrays plus synthetic secondary, conflicting, absent and unknown values,
preserving casing and array order. Synthetic IDs were used; no production
response was captured. Initial scratch harness execution failed dependency
resolution outside the repository; adding its existing node_modules path fixed
the harness without application changes.

No installed client DB or screen object was inspected. adb is unavailable in
this workspace. Native op-SQLite execution and installed Ballboy data remain
unverified. The test did not mount Artist Details or run the full sync service.

### Safest installed-client verification

On the existing authorised device, check adb connectivity and run-as access for
fi.sancti.client. If accessible and sqlite3 is already available, query
files/SQLite/substreamer7.db with sqlite3 -readonly, using LEFT JOINs so missing
release-type rows remain visible. Confirm actual package/version and DB path
before drawing conclusions. Do not copy only the main file of an active WAL
database, checkpoint, force-stop, resync, clear data or install another APK.

A non-debuggable package may reject run-as. If access or sqlite3 is unavailable,
stop and report it; a release DB cannot be assumed accessible through ordinary
adb. Existing dev boot logging reports the DB path, not release-type values;
release builds strip console calls. Existing backup exports do not include the
library release-type table. No existing metadata inspection UI was found.

### Approved behaviour and readiness

The owner now approves Albums, EPs, Singles, Other Releases, in that order;
hide empty sections. Missing, unsupported, unknown and conflicting primaries go
to Other Releases. Secondary descriptors never create sections. Match without
case sensitivity, preserve metadata, sorting and AlbumRow behaviour. Persist
default-on setting under Appearance; OFF restores the unified list.

CONDITIONAL GO: architecture and isolated execution support a small presentation
change; installed-client confirmation and a sanctifi implementation checkout
remain outstanding. No feature implementation approval is inferred.

If metadata is stale, ordinary incremental sync does not refresh every existing
album. Authoritative album refresh can replace values; supplementary artist
merge preserves old children on an empty payload. Full resync is not yet shown
necessary and was not performed. Any refresh requires later authorisation.

Expected remaining implementation/validation effort: roughly 2–3 engineering
days, subject to device access and no unexpected installed-build divergence.

