# Issue #006: inline synced lyrics visual polish — 2026-10-27

## Investigation and baseline

The owner reports successful initial Android acceptance of the integrated feature and authorises a focused positioning change. The supplied No Children screenshot with a two-line current entry is the reference. No surrounding box or redesign is authorised. Acceptance of this polish remains pending a new phone build and inspection.

Fetched origin/sanctifi before editing. Its tip remains 401026607cccf68b1ea25b003ccfc1d046c62da6. The integrated commit b37f264bac0b416cf5bafb04036a19e17941284c has that exact direct parent. Work starts from b37f264b on the separate local branch polish/issue-006-balanced-lyrics. This verifies the available remote history; it cannot establish the state of unpublished work on futwick.

InlineLyricsPanel previously reserved minHeight: 44 on the current Text itself, whose lineHeight is 22. Context entries have lineHeight: 20, with panel paddingVertical: 4 and gap: 2. The default-size layout budget is 20 + 44 + 20 + 4 + 8 = 96 points. A one-line current Text retains the unused second-line space before the next entry. Before the first timestamp, both empty placeholders remain ahead of the upcoming entry. This matches the source-level mechanisms behind the reported imbalance; no Android measurements were available in the cloud.

The shared panel is used by the phone and both tablet layouts through PlayerLyricsOrProgress. No caller needs editing.

## Decisions and implementation

- Move the two-line reservation to the panel and centre its children using justifyContent: center. Remove the current Text's minimum height. Keep the existing typography, colours, line limits, gap and padding.
- Preserve the normal-size 96-point budget. Scale its 84-point text-height portion with the system fontScale, leaving padding and gaps unscaled. This reserves the same space for every entry at a given font setting, including the pre-first state. No text measurements, layout callbacks, animations or per-line state are introduced.
- Before the first timestamp (selector index -1), render only the next entry, centred in the same reserved panel. Do not invent previous/current entries.
- Preserve explicit timed blank entries and the existing empty track-mismatch presentation. Do not filter or rewrite source text.
- Retrieval, persistence, eligibility, mode selection, timestamp selection, subscriptions to player progress, the full lyrics screen, settings and NPS callers are unchanged.

At default size, a full two-line group's existing height fills the original budget. A one-line group distributes its spare line height above and below the group rather than between current and next. Actual native font metrics, wrapping and surrounding coordinates remain phone acceptance checks, not results established by Jest.

## Validation

Baseline: typecheck passed; full Jest 640 suites / 11,234 tests passed, with 2 suites / 8 tests skipped. Intl/i18n validation and circular import check passed.

Focused regression tests were first run against the old panel: the reservation/centering and pre-first assertions failed on both platforms as expected. New tests cover natural current-text height, unchanged reserved panel across one/two-line fixtures, one visible pre-first entry, explicit timed blanks, original text and context styles, and the stable accessibility-size budget. The Jest device fixture defaults to fontScale 2, so tests explicitly select and restore font settings. The two-line fixture uses a line break; Jest does not perform native width-dependent wrapping.

After implementation: typecheck passed. Focused Android and iOS tests: 8 suites / 120 tests passed. These include existing actual committed-render mode checks for memory and SQLite synced-to-synced transitions, unresolved retrieval, stale responses, OFF/unsynced behaviour, phone and tablet integration.

Intl validation passed; all 13 translation files validated (2,182 existing missing-key warnings awaiting Crowdin); no circular dependencies found. Android-targeted Expo/Hermes export passed. This is a JavaScript bundle validation, not a native APK build.

Final full Jest regression: 642 suites / 11,242 tests passed, with 2 suites / 8 tests skipped. git diff --check passed. No regression failures remain in the executed checks.

## Outstanding acceptance work

No adb, emulator or connected Android device is available in this checkout; no native APK build or before/after device screenshots were produced. On futwick, build and inspect No Children (natural two-line reference), The Devil and The Jinn (one-line balance), and Psycho Killer before the first timestamp. Watch artwork, controls and metadata coordinates while seeking repeatedly across one/two-line boundaries. Repeat with enlarged accessibility fonts and narrow phone width; inspect both tablet orientations when available. Check explicit blank entries, cached synced-to-synced transitions and the absence of transient progress flashes. Native glyph metrics or constraints at extreme font sizes may need follow-up based on these observations.

No remote push, protected-branch change, release promotion or PR is part of this polishing pass. The owner retains acceptance authority after phone testing.

## Later on 2026-10-27: accepted layout and first-lyric anticipation

The owner reports successful Poco F8 Ultra testing of 0e8540b9 and accepts the one-line, two-line and pre-first layout. That supersedes the earlier pending acceptance of the visual polish; the new anticipation behaviour below has not yet been accepted on-device.

Verified the remote polish branch and local HEAD both resolve to 0e8540b9a218f03757a844105f9f37eb87c9de5b, whose parent is b37f264bac0b416cf5bafb04036a19e17941284c. Created dedicated branch polish/issue-006-lyric-anticipation from that exact accepted commit. This does not assume anything about unpublished futwick changes.

Investigation: InlineLyricsPanel subscribes to playerStore using a primitive active-index snapshot. Before the first timestamp that index remains -1; checking time only in the render body would not trigger the required empty-to-upcoming transition. Effective starts already add offsetMs, and playback seconds are converted to milliseconds. PlayerLyricsOrProgress chooses lyrics mode from eligibility and the setting independently of this index.

Implementation: return a distinct waiting sentinel (-3) from the existing snapshot when index is -1 and positionMs is less than max(0, effective first timestamp minus 3000). At the threshold equality, the usual pre-first snapshot (-1) renders the centred upcoming entry. At the first timestamp, the unchanged selector returns the active index. The waiting sentinel renders no Text children inside the unchanged reserved panel. No new timers, store fields, settings or subscriptions. Styles, panel identity, track mismatch behaviour, source data, eligibility, retrieval, full lyrics screen and later timestamps remain unchanged. Display updates follow the existing playback-position event cadence; no separate timer is introduced.

Tests use programmatic playback-position updates, not an NPS seek slider. Coverage includes first timestamp 45000ms at 0, 41999, 42000 and 45000ms; immediate visibility for 0/2000/3000ms; positive, negative and fractional offsets; returning before the window; subsequent long instrumental gaps and end-of-song hold. Integration tests retain the same panel/styles and assert no progress component or fallback commits across empty, upcoming, current and restart states. Existing invalid/unsynced/OFF fallback coverage remains in place.

The pre-implementation focused run had eight expected failures across Android/iOS for the new long-intro/offset/mode assertions; the remaining 30 tests passed. The initial broad run overlapped addition of the new tests and implementation: 641 suites passed, one failed on three new long-intro/offset assertions against the old snapshot, and two were skipped. That mixed run is not used as the final validation result. Final validation is recorded after a clean post-change run below.

Native geometry and the new anticipation timing still require phone acceptance. The accepted layout styles are unchanged; tests check stable panel identity and style, not Android pixel coordinates. Restart the long-intro track and observe a quiet panel, upcoming text during the last three seconds before its effective first timestamp, then the current lyric. Check that artwork/controls/metadata stay fixed and the progress bar remains absent. The original feature's accepted device results are not evidence of device acceptance of this refinement.

Commit and push of this dedicated branch are explicitly authorised by the owner. No merge into sanctifi, PR or release promotion is authorised.

Focused validation passed: 14 Android/iOS suites, 180 tests, including the existing shared selector, full synced lyrics view, cache hook, phone/tablet integration and committed-render flicker checks. Typecheck, Intl validation and circular-import checks passed; all 13 translation files validated with the existing 2,182 missing-key warnings. Android Expo/Hermes export passed; this is not a native APK build. Clean final full regression: 642 suites / 11,258 tests passed; two suites / eight tests skipped. No final test failures. Final typecheck and git diff --check also passed. The four changed files are the panel, its focused tests, the mode integration tests and this diary. No native APK/device check was performed; phone acceptance of anticipation remains outstanding.
