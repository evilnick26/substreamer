# sancti.fi Client — Project Diary

## 24 October 2026 — Issue 023: Startup and Settings update checks

### Investigation and integration

Refreshed the GitHub `sanctifi` branch before starting. The implementation branch
starts at `df9eb721dd8b43c4818dc8bb1d4f02f5910d369a`, which records the first live
Alpha publication. Reviewed [Issue 023](https://github.com/evilnick26/substreamer/issues/23)
and the [publication evidence](2026-10-24_issue-022_alpha-publication.md).

Settings has two independent version controls. Only `SanctifiVersionLabel`'s
sancti.fi version line now starts a manual check. Its attribution remains plain
text. `VersionFooter` is unchanged, including its sliding three-second/five-tap
Developer Options unlock, countdown, haptics and success overlay. The two
components remain separate siblings in Settings.

Installed Android ordering comes exclusively from
`Application.nativeBuildVersion`, parsed as a positive safe integer. Inspection
of Expo's Android `ApplicationModule.kt` confirms this reads package versionCode,
not either display version or the inherited footer's abbreviated build number.
Unavailable or malformed native values fail explicitly without a guessed build.

Declared the already-locked `expo-application` **57.0.2** directly. The registry's
latest version checked was 58.1.2; this change deliberately retains SDK 57's
compatible mapped version (`~57.0.2`). Android autolinking resolution identifies
`expo.modules.application.ApplicationModule` at version 57.0.2. This verifies
source compatibility and module discovery, not execution inside a phone APK.

### Implementation and decisions

- The enabled channel is a code-level **Alpha** selection, fetching only
  `https://updates.sancti.fi/client/alpha.json`. Beta/Stable have no selection UI.
- A small validator mirrors the publishing contract: supported schema 1,
  required/known fields, bounded types and versionCode, exact canonical HTTPS
  APK URL with matching build, lowercase SHA-256 and optional plain-text notes.
  Tests compare accepted/rejected examples against `scripts/android-release.js`.
- The service separates validation, installed-build parsing, numeric comparison
  and request management. Full build numbers are used: greater offers an update,
  equal is current, and lower reports no downgrade. Existing APK 80000186 retains
  its actual versionName **8.1.8**; Settings still displays **0.1.1**.
- A module-level singleton records the automatic promise before starting network
  work. That promise is retained even on failure, so navigation, remounts or
  foreground transitions do not repeat automatic requests. Manual checks remain
  available, reusing an active request or starting a fresh one after completion.
- Fetch has a ten-second deadline covering the request and response body. A
  timeout settles even if transport ignores abort; a late response cannot change
  that result. HTTP failures, unreadable bodies, offline errors, malformed JSON,
  invalid/oversized manifests and redirects fail safely.
- Requests ask for no-store/no-cache. The host currently has no explicit
  Cache-Control response policy. Platform cache behaviour and manifest freshness
  still need device validation; no server caching guarantee is claimed here.
- A root-mounted, dismissible, nonmodal banner reports newer automatic results.
  Automatic failures are silent. In-memory build-based prompt tracking suppresses
  repeated automatic notices within the process. Explicit manual checks always
  give feedback, including checking, current, older, available and each failure.
- Both entry points use the existing themed alert for release details and the
  explicit **Download APK** action. Notes are plain text, previewed to 300
  characters to keep the dialog bounded. Opening details alone does not download.
  Only Download calls `Linking.openURL` with the validated APK URL; browser failures
  are reported. Android/browser manages downloading and installation.
- The client validates checksum format; it does not download APK bytes to verify
  their hash. Artifact verification remains part of the
  [publishing procedure](../android-release-publishing.md), with Android enforcing
  package-signature compatibility during installation.

### Automated validation

- `npx tsc --noEmit`: passed.
- Four focused test files, Android and iOS Jest projects: **8 suites, 198 tests
  passed**. Coverage includes full build comparisons, invalid native builds,
  publisher-contract parity, malformed JSON/URLs/checksums, HTTP/offline/body
  errors, timeout with a late response, pre-request automatic guard, manual retry,
  concurrent sharing, remount/dismissal deduplication, explicit browser action and
  browser failure, plus the unchanged inherited countdown/five-tap unlock.
- `npx jest --no-coverage --maxWorkers=2`: **626 suites and 11,056 tests passed**;
  **2 suites / 8 tests skipped** because the existing private captured database
  fixture is absent (`fixtureMigration.test.ts`, both platform projects). No new
  update-check tests are skipped.
- `node --test scripts/__tests__/android-release.test.cjs`: **52 passed**.
- Intl, translation, ProGuard and native module-inventory validators: passed.
  Translations report 2,117 missing-key warnings awaiting Crowdin sync; new
  English strings follow the existing fallback convention.
- Madge with `--ts-config tsconfig.json`: no circular dependencies; the three
  existing vector-icon static entry points are reported as unresolved/skipped.
- Expo Android autolinking resolution: `expo-application` 57.0.2 discovered with
  `expo.modules.application.ApplicationModule`; no native compilation performed.
- `git diff --check`, diary relative-link checks and scope checks passed.
  `VersionFooter`, `app.json`, display-version config, Android/signing files and
  release tooling are unchanged. Package/lockfile comparisons confirm that the
  direct dependency declaration is their only change.

### Outstanding physical Android acceptance

After PR review, validate on Nick's phone without editing the live Alpha manifest:

1. Confirm native installed build 80000186 and a manual check against published
   Alpha reports up to date, regardless of the differing human-readable versions.
2. Start offline/with a slow connection; confirm navigation and playback remain
   usable, automatic errors stay silent, and manual errors/retries are visible.
3. Confirm the custom version action and accessibility feedback visually; verify
   five taps on the separate inherited version still unlock Developer Options.
4. Use a controlled local/test newer-version response to verify banner placement,
   dismissal, remount/resume deduplication and the manual details dialog.
5. Confirm no browser opens before Download, then explicitly select it and verify
   the external browser receives the correct immutable canonical HTTPS APK URL.
6. Check platform HTTP cache/freshness behaviour on repeat manual checks. Explicit
   hosting cache policy remains separate future work.

No connected Android device, emulator or React Native visual renderer is available
for this task. Before/after native screenshots were not captured; visual rendering,
native execution, playback responsiveness and external-browser handoff remain
unvalidated. No production APK build, native regeneration,
release publication, infrastructure change, signing change or version-number
change was performed. Issue 023 remains subject to physical acceptance and PR
review; the PR must not be merged by Codex.

### Owner physical-device acceptance — evening of 24 October 2026

This section records subsequent owner validation after PR #36 was reviewed and
merged into `sanctifi`. It supersedes the earlier statement that no physical
Android execution or screenshots were available **at implementation time**;
the earlier investigation and automated-test record above is retained as
historical evidence.

- On futwick, `npm ci` succeeded and the existing generated Android project
  was used without native regeneration or a Gradle clean. A temporary,
  **local-only** versionCode increase from published Alpha `80000186` to
  `80000187` was made in `app.json` and generated
  `android/app/build.gradle` for acceptance testing. Display versionName
  remained `8.1.8`; sancti.fi client display version remained `0.1.1`.
- After a reboot, the initial build attempts were blocked by missing
  `JAVA_HOME` and `ANDROID_HOME`, not source-code errors. The existing
  Temurin JDK `17.0.20.1+1` was located at
  `/media/data/Complete/Sanctifi/Development/Android/jdk/jdk-17.0.20.1+1`
  and the existing SDK at
  `/media/data/Complete/Sanctifi/Development/Android/sdk`. Both variables
  and their relevant executable paths were added to the owner's
  `~/.bashrc`. A fresh terminal confirmed Java, ADB, Android API 36 and
  Build Tools 36.0.0 are available. This setup assumes `/media/data`
  remains mounted.
- `NODE_ENV=production ./gradlew :app:assembleRelease` succeeded:
  **BUILD SUCCESSFUL in 1h 24m**, 1,518 actionable tasks (1,037 executed,
  481 up-to-date). The resulting APK was approximately 76 MB at
  `android/app/build/outputs/apk/release/app-release.apk`.
- `apksigner verify --verbose --print-certs` succeeded with APK Signature
  Scheme v2 and one signer. Signing certificate SHA-256:
  `a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c`,
  matching the permanent sancti.fi Android release identity.
  `aapt dump badging` confirmed package `fi.sancti.client`,
  versionCode `80000187`, versionName `8.1.8`, compileSdk 36.
  Local test APK SHA-256:
  `ab469dcf90ef14ee4d7df2bebcb7ed6da3b3c64cf1fe7eff2c4bfb520657952b`.
- `adb devices` showed the phone as an authorised device; `adb install -r`
  returned **Success**. The existing app was upgraded in place without
  uninstalling or deliberately clearing app data. This verifies install
  acceptance, not a full post-upgrade data-integrity audit.
- **PASS — manual update check / no downgrade:** the on-device Settings
  screenshot displayed: “Installed build 80000187 is newer than the Alpha
  release. No downgrade offered.” This validates the actual installed-build
  comparison against the published `80000186` Alpha for the older-release
  case. No download was offered.
- **PASS — inherited Developer Options unlock:** a second on-device
  screenshot after the five-tap gesture showed the additional **File
  Explorer** and **Logging** Settings entries. The sancti.fi update-check
  label and inherited `Version 8.1.8 (187)` footer were both visible.
- **Visual observation:** the manual result text remained visible below the
  sancti.fi version label after Developer Options was unlocked. This was
  accepted for Alpha; any future presentation adjustment is optional and
  should be separately scoped.
- **Local cleanup:** the temporary tracked `app.json` versionCode change
  was restored with `git restore -- app.json`; generated
  `android/app/build.gradle` was also changed back to `80000186`.
  The command output confirmed the generated-file restoration; a final
  `git status --short` result was not shown. The installed phone build
  remains `80000187`. **Do not publish the local test APK** or alter the
  live Alpha manifest to test a newer release.

### Remaining Issue 023 acceptance after physical-device tests

- Automatic startup check behaviour, including silent offline/timeout errors
  and lack of disruption to navigation or playback.
- Manual offline/error feedback and retry.
- Controlled **newer** manifest: automatic banner, dismissal, process-level
  deduplication, manual release-details dialog, explicit Download action,
  correct external browser URL and browser failure handling.
- Repeat manual checks and platform cache/freshness behaviour.
- Final clean-working-tree confirmation and, when acceptance is complete,
  issue status update. No claim of complete Issue 023 acceptance is made yet.

Issue #035 (legacy Home-tab removal) remains separate and is deferred for
the next development session; no #035 code was merged as part of this
physical acceptance.
