# sancti.fi Client Project Diary — 2026-11-05

## Issue #073 — Now Playing combined album metadata

**Status:** Accepted on-device; local `sanctifi` commit ready to publish.

### Objective
Combine the Now Playing Year, Album, and optional Version into one full-width, pressable marquee label in phone portrait and landscape. Preserve album navigation and the Show Album Version preference; omit absent fields without stray separators.

### Investigation and decisions
- Portrait (`src/screens/player/player-phone-portrait.tsx`) previously displayed a marquee for Year/Album and a separately constrained Version text field.
- Landscape (`src/components/player/PlayerPhoneLandscape.tsx`) displayed separate static Year/Album and Version text fields.
- Both already looked up the optional Version from the local database with safeguards against stale asynchronous results.
- Reuse the existing `MarqueeText` component and Version lookup rather than introduce a new animation, database schema, or playback behaviour.
- Use a small shared semantic-label formatter; retain the album press target and preference behaviour. Remove obsolete portrait layout styles.

### Implementation
- Added `src/utils/playerAlbumLabel.ts` with `formatPlayerAlbumLabel(year, album, version)` to join available values as `(YYYY) - Album - Version`.
- Updated portrait and landscape player components to display the combined string via `MarqueeText` and to suppress Version when the preference is disabled.
- Updated `src/screens/player/__tests__/player-phone-portrait.test.tsx` for the combined presentation and removed obsolete separate-Version assertions.
- Added `src/utils/playerAlbumLabel.test.ts` for missing values, whitespace, and normal formatting.
- Feature branch `issue-073-nps-combined-album-field` committed as `8b78da1d`.
- Cherry-picked onto local `sanctifi` as `f94f0eed` (parent `1314ed08`), without pushing during device testing.
- Preserved existing uncommitted `app.json` Android version-code increment to `80000196` in `substreamer-build`; it remains an intentional local change.

### Validation
- Targeted Jest tests: **132/132 passed**, Android and iOS projects.
- `npx tsc --noEmit`: no reported errors.
- `git diff --check` and staged diff check: clean.
- Android `assembleRelease`: **BUILD SUCCESSFUL** in 2m 28s.
- APK signature verification: v2 verified, one signer; package `fi.sancti.client`, version code `80000196`, version name `8.1.8`.
- On-device screenshots: portrait and landscape show `(1978) - Who Are You - Super Deluxe Edition` and `(1975) - The Who by Numbers - Super Deluxe Edition` with Version enabled.
- With Show Album Version disabled, both orientations show `(1975) - The Who by Numbers` without dangling punctuation or visible layout regression.
- User confirmed tapping the combined album field opens Album Details and explicitly signed off the issue.

### Outstanding / follow-up
- A genuinely overflowing label's marquee motion was not explicitly verified on-device; not considered a sign-off blocker.
- Artist navigation was covered by automated tests, not separately reconfirmed in this device session.
- Diary entry must be added and committed to the repository; local `sanctifi` commit `f94f0eed` must be pushed when ready. No remote publication is claimed here.
