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

## Final Android acceptance and product milestone — 2026-10-27

**Issue #006 is accepted for Alpha.**

The product owner reports that the final implementation, `a203afe5afdd3e6451d2da848422ec938b873f86`, was integrated into futwick's local sanctifi branch by a clean, conflict-free fast-forward merge, changing exactly the four expected files. The Android release APK was built successfully on futwick, transferred to the Poco F8 Ultra, installed and tested. These subsequent physical-device results supersede the pending acceptance recorded above; those earlier statements remain accurate accounts of what was known when written. This entry records the owner's report, not device testing performed in the cloud.

### Physical-device behaviour observed and accepted

- Eligible synchronised lyrics appear automatically on the NPS when the setting is enabled. Playback drives lyric progression. The current lyric is prominent and bold; previous and next entries are subdued, single-line contextual entries with truncation when necessary. Current text wraps naturally onto two lines, and the complete lyric becomes visible when a truncated contextual entry becomes current.
- The lyrics panel replaces the original progress bar. Layout remains visually stable during lyric changes: one-line spacing is balanced, the accepted two-line appearance is preserved, and the lone upcoming entry is naturally centred. Album artwork remains prominent, while transport controls and track metadata retain their positions. The frameless presentation is accepted; no surrounding container is necessary or desired.
- The three visual reference cases all passed product-owner inspection: Talking Heads — Psycho Killer; The Mountain Goats — No Children; Pernice Brothers — The Devil and The Jinn.
- The final three-second anticipation refinement passed on the Poco F8 Ultra. During sufficiently long introductions, lyric text stays hidden until three seconds before the first timestamp while the NPS remains in lyrics mode and the progress bar remains hidden. Subsequent lyric progression remains unchanged.
- During earlier device testing, switching to tracks with synchronised lyrics produced no perceptible progress-bar flash. This critical observed result is accepted. It does not establish that every possible transition or timing edge case was manually exercised; the automated suite provides broader coverage.
- Both dark and light themes passed visual inspection on the Poco F8 Ultra. The current lyric uses the appropriate high-contrast theme foreground colour, and contextual lyrics remain subdued. The owner explicitly prefers the existing theme-aware foreground styling and decided against artwork-accent colouring for the current lyric.

### Automated validation versus native acceptance

Previously reported validation for the final anticipation implementation remains: 180 focused Android/iOS tests passed; full regression 11,258 passed and eight skipped; typecheck, internationalisation/translation, circular-import and whitespace checks passed; Android Expo/Hermes export passed. Those are cloud automated results, including simulated Android/iOS test projects and a JavaScript bundle export. They are distinct from the later successful native release APK build on futwick and physical Poco F8 Ultra testing reported above. No physical iOS device testing is claimed.

This closeout changes documentation only. No implementation, dependencies or tests were changed, and the automated suite and builds were not rerun for this diary update. Documentation validation checks that the previous diary contents are preserved verbatim, that only this file changes, and that the diff has no whitespace errors.

### Unresolved observation and outstanding coverage

An earlier plain-text lyrics track took approximately a minute or longer to populate the existing full Lyrics screen. Its cause remains unresolved, and it was not established as a regression caused by #006. Record it as an observation, not a confirmed #006 defect.

Coverage not yet comprehensively demonstrated remains: wider Android devices and screen sizes; physical iOS devices; tablet layouts; extended offline and cache-recovery scenarios; and larger accessibility fonts. The earlier request for measured Android synchronous SQLite lookup latency is not fulfilled by any timing measurements in this acceptance report. No new latency measurements or exhaustive native event-order checks are claimed. Product acceptance on the tested phone does not silently mark this remaining coverage as passed.

### Product-owner assessment

The product owner considers this a watershed moment for the sancti.fi Client project. Although the application began as a Substreamer fork, inline synchronised lyrics are the first major enhancement that makes the application feel distinctly like sancti.fi, rather than simply a customised upstream client. This is a product milestone as well as an engineering outcome.

The original product objective has been achieved: lyrics are integrated naturally into listening, appear automatically and unobtrusively, and preserve a visually restrained interface and existing playback behaviour. The resulting experience matches the owner's original vision:

**"THIS FEELS LIKE WHAT I WAS IMAGINING."**

The development sequence combined investigation, implementation, automated validation, physical-device feedback, focused refinement and final acceptance. Alpha acceptance records readiness from the product owner's perspective; it does not claim that distribution has already occurred.

### Issue housekeeping

A concise acceptance-summary draft is prepared below for issue #006. It has not been posted. The issue must not be closed and the comment must not be published without explicit authorisation. This documentation update is committed and pushed only on its dedicated branch; no merge into sanctifi or PR is part of this closeout.

Draft comment:

> **Issue #006 is accepted for Alpha.** Final implementation `a203afe5afdd3e6451d2da848422ec938b873f86` integrated into local sanctifi by a conflict-free fast-forward; the release APK built on futwick and passed Poco F8 Ultra testing. Automatic synced lyrics, balanced one/two-line and centred upcoming presentation, the three-second first-lyric anticipation window, stable NPS layout and both dark/light themes are accepted. Earlier track-switch testing showed no perceptible progress-bar flash; manual coverage was not exhaustive. Automated validation: 180 focused tests passed; full suite 11,258 passed, eight skipped; typecheck, Intl/translations, cycles, whitespace and Android Expo/Hermes export passed. Wider Android, physical iOS, tablets, extended offline/cache recovery and larger fonts remain outstanding coverage. Slow plain-text loading in the full Lyrics screen remains an unresolved observation, not a confirmed #006 regression. This is sancti.fi's first major enhancement to fulfil its own distinct listening experience: **"THIS FEELS LIKE WHAT I WAS IMAGINING."**
