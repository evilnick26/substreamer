# sancti.fi Client — Project Diary

## 25 October 2026 — Issue 041: Reliable automatic Alpha discovery

### Investigation before implementation

Read [Issue 041](https://github.com/evilnick26/substreamer/issues/41) and the
[Issue 038 acceptance record](2026-10-25_issue-038_alpha-update-build.md).
Refreshed `sanctifi` to `3bb2be95bed3527b1c194dbcca78c8cd01e68b00`, then created
`issue-041-startup-update-discovery`. No device reproduction/logs were available
in Codex. The reported eventual discovery after several relaunches is preserved
as an observation, not evidence of a specific network, cache or lifecycle event.

Confirmed source mechanisms:

1. The root unconditionally mounted `ClientUpdateBanner` alongside the navigator,
   before auth hydration, splash completion, migration completion or foreground
   readiness. The public update URL itself does not need music-server auth.
2. `checkAutomatic()` cached its first promise forever in module memory, including
   a network/timeout error. A transient first failure therefore made automatic
   discovery silent for the remainder of that JS session; manual checks could
   still succeed. A regression expecting same-session automatic recovery failed
   against that implementation. Existing tests explicitly expected retained
   automatic failure, so this was a policy gap, not an untested HTTP parser bug.
3. The banner claimed a build as prompted when setting local React state, before
   verifying foreground/visibility. Its state could then disappear on unmount
   while the process-level claim survived, suppressing the cached result on
   remount. A background-mount regression confirmed that the old banner fetched
   and consumed prompt eligibility while inactive.
4. Presentation was an ordinary View, not the branded dialog until **View update**
   was pressed. Root migration renders later at the same zIndex 100; native
   onboarding/certificate modals can also cover an ordinary View. The old banner
   did not wait for any of them. These are confirmed visibility paths, not a
   claim that one was recorded during Nick's specific relaunches.
5. The guard distinguished JS module lifetime, not Activity launches. Swipe-away,
   foreground resume or Activity/UI recreation need not create a new JS runtime.
   A genuinely killed process does. A successful manual offer also calls
   `claimPrompt`, intentionally suppressing a duplicate automatic offer in the
   same session. A successful current/older result is likewise cached, so a
   later manifest promotion does not trigger polling in that session.
6. Network/server reachability in the music client is not readiness of the public
   update host. Its connectivity store starts optimistically and monitors the
   Subsonic endpoint; using it as an update-fetch gate would be misleading.
   Production Babel strips console calls, so ad-hoc production console logging
   would not establish which branch occurred on the physical phone.

The exact cause of the earlier phone attempts remains unproven without matching
request/lifecycle evidence. The fix addresses the reproduced permanent-error and
premature/lost-presentation mechanisms; physical reliability is still acceptance
work, not claimed from source inspection.

### Implemented solution and boundaries

- Root readiness now requires hydrated/authenticated state, completed splash,
  no visible migration (including its completion acknowledgement), and a real
  destination past login/root redirection. This gates updater work only; it does
  not add an app-wide startup gate or wait for heavy library sync.
- Replace the local-state banner with `ClientUpdateController`. Use the existing
  root-hosted branded alert, release notes and explicit Download/Cancel actions.
  Its store survives controller remount, unlike the old local banner state.
- Check and present only while the activity is active. Defer an available result
  behind an existing themed alert, onboarding, certificate prompt or Fire-OS
  playback guidance. Claim the prompt immediately before requesting the dialog,
  not when the HTTP request starts or while blocked. Cancel/backdrop dismissal
  remains respected; explicit manual rediscovery remains available.
- The service keeps its in-flight sharing and pre-request guard. It permits
  **at most three automatic attempts per JS session**, retrying only network/HTTP
  failures or timeouts, with foreground backoffs of **2s then 5s**. Successful
  results, invalid manifests, unavailable build and unsupported platform stop
  automatic retries. The existing 10s whole-request deadline is unchanged.
- Backoff timers are cleared on background, loss of readiness or unmount. A
  foreground resume can continue an unfinished cycle within its remaining budget;
  it does not reset a completed/exhausted cycle. An already-running shared request
  may finish/cache while backgrounded, with presentation deferred until active.
- Manual requests never wait for backoff and remain usable after exhaustion.
  Manual/automatic calls share an active HTTP request. A successful manual prompt
  suppresses a duplicate automatic prompt for that build, as before.
- There is no periodic polling, persistent retry state, native process detector,
  background scheduler, push service, forced update, generic alert queue or new
  dependency. A cold JS runtime gets a fresh budget; an extended outage exhausting
  all attempts needs a manual check or subsequent cold launch. Other arbitrary
  user dialogs are not redesigned; the controller waits for the existing alert
  slot and the known startup overlays.
- HTTPS endpoint, manifest validation, full native Android build comparison,
  signature/install flow and manual Settings controls are unchanged. The two
  now-unused banner-action translation keys are removed. Tap-target enlargement,
  human-version identity, package/version/signing and live release files are not
  changed.

### Automated verification

- Before the fix, the recovery regression reproduced a cached automatic network
  error even when the next fetch could succeed. The background-mount regression
  confirmed old-banner fetching/prompt eligibility consumption while inactive.
- `npx tsc --noEmit`: passed.
- Focused service/controller/manifest/manual-Settings checks: **8 suites / 238
  tests passed**, no skips. Coverage includes offline and HTTP recovery, timeout,
  non-retryable errors, three-attempt exhaustion, concurrent sharing, fresh-runtime
  budget, readiness/foreground/modal gates, backoff cancellation, cached results,
  dialog remount/dismissal, manual-after-exhaustion/dismissal and explicit Download.
- Changed service: **100% statements, branches, functions and lines**. Controller:
  **97.56% statements, 95.65% branches, 100% functions/lines**.
- Full `npx jest --no-coverage --maxWorkers=2`: **632 suites / 11,158 tests
  passed**; existing **2 suites / 8 tests skipped** because the private captured
  database fixture is absent. No new update-check test is skipped.
- Intl, translation, ProGuard and native module-inventory validators passed.
  Translation validation retains missing-key warnings awaiting Crowdin sync; no
  new user-facing strings were added. Madge reports no circular imports and the
  same three unresolved vector-icon static entry points.
- The documented local fixture adapter was transpiled and its seven modes checked
  against the publisher's manifest validator/error expectations without network or
  native calls. This does not substitute for running it on a phone.
- Diff/whitespace, documentation links/fences and protected-file scope checks
  passed. Manifest contract/URLs, version/package metadata, dependencies, signing,
  release tooling, manual label/feedback and inherited Developer Options control
  remain unchanged. No production APK build, device test or native screenshots
  were performed.

### Physical Android procedure and remaining evidence

Follow the [reproducible test procedure](../android-startup-update-acceptance.md).
It provides force-stop/PID/launcher commands distinguishing cold process launch
from warm resume, a full connectivity/presentation/manual-check matrix, and an
isolated local fixture adapter for a dedicated test handset/emulator. It does
not require changing live manifests or distributing synthetic APKs.

The currently published 80000187 equals the installed Issue 038 baseline: it
cannot demonstrate a newer offer by itself. Use the isolated fixture (cancel,
never download synthetic URLs) or a separately approved legitimate higher release.
No version increment, cloud APK build, phone installation, live-host operation or
public manifest change was performed here.

Pending physical acceptance includes normal cold launch with a newer result,
retry recovery, warm/background transitions, waiting behind startup dialogs,
dismissal and manual rediscovery, native modal visibility and continued browsing/
playback. No before/after native screenshots were captured; a connected Android
runtime/React Native visual renderer was unavailable. This PR must remain
unmerged for review; it does not claim Issue 041 complete.

### PR review follow-up — 25 October 2026

The reviewer noted that a successful manual check during automatic backoff still
allowed the scheduled callback to make an unnecessary third HTTP request. The
small service-level adjustment lets a validated manual result settle an existing
retry-eligible automatic cycle. Available/current/older results are all definitive
comparisons; errors leave automatic recovery eligible within its original bound.

No timer subscription or controller/Settings coupling is added. A callback already
scheduled may wake once, but it reads the settled cached result without fetching
or scheduling another retry. This also retains the available result for automatic
presentation if the manual Settings component unmounted before showing it.
Attempt counts are not reset. Manual requests remain fresh and responsive;
in-flight sharing, prompt claims and dismissal rules are unchanged.

Before this adjustment, regressions for all three successful manual outcomes
failed as expected; failed-manual continuation already passed. Updated checks:
**248 focused tests passed**, with service coverage still **100%**. Full Jest:
**632 suites / 11,168 tests passed**, with the existing 2 suites / 8 private-fixture
tests skipped. TypeScript, repository validators, documentation and diff checks
passed; Madge retains only its three existing vector-icon resolution warnings.
The controller implementation is unchanged. Tests also verify that a manual
success arriving after Settings unmount remains available to the automatic dialog
without refetching. Physical Android acceptance remains outstanding; no version,
signing, manifest or APK change is included in this follow-up.
