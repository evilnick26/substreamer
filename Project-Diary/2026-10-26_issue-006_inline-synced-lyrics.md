# Issue 006 - Inline synced lyrics

## Investigations and decisions

Implementation authorised following the revised plan. Lyrics mode replaces the entire PlayerProgressBar, including its seek/time/status/Retry functionality. Normal mode retains the original component. Default-ON preference belongs in Appearance & Layout. Previous/next visual truncation is approved; stored text remains unchanged.

The hook already selects entries by current track ID and guards repeated fetch attempts. No session resolution map is required for mode selection. Loading/error changes do not determine eligibility. Synchronous SQLite requested-track snapshots address first-frame selection after process restart; no prefetching or new tables.

Appearance preferences hydrate asynchronously. Added the layout preference store to the existing startup hydration gate to avoid restoring the player before the persisted OFF value is known.

## Implementation completed so far

Shared timestamp selector and structured-sync eligibility predicate; full-view search now uses the shared selector. Read-only synchronous lyric cache lookup shares row decoding with the existing async reader. Development logs record lookup duration for Android measurement. Hook adopts disk snapshots into memory after rendering, without another network request or persistence write.

Three-entry panel preserves source text, emphasises current, and visually truncates adjacent entries. A shared exclusive branch selects panel versus original progress component. Phone and both tablet layouts integrated; tablet portrait fetch ownership lifted to parent. Appearance switch and persisted preference added.

## Validation to date

Selector and existing SyncedLyricsView suites pass on iOS and Android Jest projects. Existing hook, phone, landscape and SQLite regression run: 8 suites, 150 tests passed across both projects.

New transition tests pass across both projects, including first disk-cache commit, memory-cached synced-to-synced commits, unknown-to-synced, delayed old response, blank timed entries, OFF and cache removal. A preference-test harness dynamic import failed under Jest; replaced with a static import. Final rerun and broader gate pending.

## Outstanding

Android environment setup fails because its supported JDK cannot be found; adb is unavailable in this environment. No Android build, device screenshot, SQLite latency measurement or native callback ordering validation has been completed. Jest timings are not Android measurements. Small-phone and genuine-timed Dylan readability tests remain required.

Final typecheck/full regression, translation/Intl and cycle checks pending. No remote publication or PR authorised.


## Additional validation and review

Initial broad regression invocation completed with 608 passed suites, 2 skipped; 10,728 passed tests, 8 skipped. Final-state broad runs remain in progress. All new selector/panel/mode/settings files reached 100% statement and branch coverage in the focused 6-suite/20-test run. Phone and both tablet integrations pass their replacement/OFF checks (4 suites, 70 tests). The render-sequence tests record the actual mounted branches using layout effects; they are not inferred from final eligibility alone.

Added a local native-track-ID mismatch guard: blank the outgoing text until the parent supplies the matching track, without selecting the progress bar. No core playback state changes. Existing position samples remain untagged; index correctness during native transitions still requires device validation.

Intl validation passed. Translation validation passed with missing-key warnings awaiting Crowdin. Madge 8.0.0 processed 582 files and found no cycles. The initially unavailable madge executable was run through an isolated npm cache; no package dependencies or lockfile changed. Android build command failed during environment setup before compilation. No device timing or visual verification claimed.

## Cache race found and corrected

A new adversarial committed-render test injected an unrelated previous-track result between disk-snapshot rendering and passive adoption. It failed on both Jest platforms: invalidating the snapshot solely because the shared revision changed exposed the progress bar. The hook now revalidates a missing entry against the latest revision before paint. Removal/clear operations complete their SQLite deletion before publishing the memory-cache miss, so a synchronous reader cannot restore the deleted row. Real-SQL observer tests cover that ordering. The focused cache/store/hook regression passed: 8 suites, 142 tests.

No session-only resolution map was added: the existing attempt guard and track-keyed entries suffice for mode selection. Unavailable remains normal across repeated renders without using loading as an eligibility signal.

## Final preference hydration approach

The initially added startup hydration gate was removed after reviewing queue restoration: that gate alone does not establish first-render preference availability. The single NPS preference is instead seeded from the existing synchronous KV adapter when the layout store is created; the store's existing asynchronous persistence remains unchanged. A cold-store test verifies saved OFF before asynchronous hydration. No new preference store or persistence format.

## Android validation status

Android-targeted Expo export succeeded, including a Hermes bundle. This is not a native APK build. The native build script stops during JDK discovery before Gradle compilation; this Linux environment has a system JDK but the project's discovery script searches macOS locations. No adb/device/emulator is available here. Development lookup logs use the prefix `[lyrics-cache] sync lookup` with elapsed milliseconds. Measure cold/warm requested-track reads, including contention during library sync, on Android before accepting the performance safeguard. No latency or visual measurements are claimed from this environment.

## Final automated validation

Final full run on the completed source: 614 suites passed, 2 suites skipped; 10,760 tests passed, 8 skipped. TypeScript no-emit check passed. Focused final new-file coverage run: 6 suites, 22 tests passed, with 100% statements and branches across the new selector, inline panel, mode wrapper and settings card. Translation validation passed (13 locales, missing translations fall back to English); Intl validation and final circular-import check passed. Final Android-targeted Hermes export passed. No dependencies, database schema or native audio code changed.

Implementation and automated validation are complete. Native APK compilation and on-device visual/performance acceptance remain outstanding because the required Android tooling/device is unavailable here. The feature has not been published, promoted or opened as a PR. No claim of device-proven flicker freedom or measured Android SQLite latency is made.
