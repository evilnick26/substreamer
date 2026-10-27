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
