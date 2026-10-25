# sancti.fi Client — Project Diary

## 25 October 2026 — Issue 038: Prepare build 80000187 for Alpha update acceptance

### Investigation and baseline

Read [Issue 038](https://github.com/evilnick26/substreamer/issues/38), the
[publishing procedure](../android-release-publishing.md), release ledger, signing
implementation and the Issue 022/023 diaries. Refreshed remote `sanctifi` to
`6231577f449789e6262b62f3e865023d5b6d767e`, with a clean working tree, before creating
`issue-038-android-build-80000187`.

`app.json` / `expo.android.versionCode` is the canonical Android build-number
source. `app.config.js` preserves this value and `expo.version`, while adding
ProGuard rules. Expo supplies Android versionName from `expo.version`; generated
native files can remain stale until the configuration is applied on futwick.
Neither the inherited release script nor EAS automatic increment is appropriate
for this controlled manual increment; neither is run or changed.

The owner's latest verified baseline for this assignment is installed package
`fi.sancti.client`, versionCode **80000186**, versionName **8.1.8**, with live
Alpha advertising 80000186. This is owner-supplied evidence, not a phone or live
hosting inspection repeated in Codex. The canonical distribution base remains
`https://updates.sancti.fi/client/`.

The [Issue 023 diary](2026-10-24_issue-023_update-checks.md) records an earlier
unpublished, temporary local 80000187 APK/install. That historical result does
not override the latest baseline supplied for Issue 038 and must not be reused
as this release's APK, checksum or source provenance. Before publication, reconfirm
that the acceptance phone actually remains on 80000186 and has the update-check
implementation. The originally published 80000186 artifact predates Issue 023;
a version number alone does not establish which source/features are installed.
If the phone still runs 80000187, an offered 80000187 is equal, not newer: stop
and reconcile the acceptance baseline with Nick/Carl without uninstalling or
altering the phone as part of this preparation.

### Implementation and decisions

Only `expo.android.versionCode` changes: **80000186 to 80000187**. Retain Android
package `fi.sancti.client`, Expo/Android versionName **8.1.8**, iOS build metadata
and the independent sancti.fi Settings label **0.1.1**. Human-version unification
remains a separate, unimplemented Issue 022 proposal.

The signing fixture's 80000185 is deliberately independent sample metadata; its
preservation assertions remain meaningful and unchanged. An in-memory check with
80000187 verifies that the existing plugin preserves this build's metadata and
remains idempotent. No signing configuration or private material is changed.
No runtime code, navigation, UI, database, updater, dependency, packaging or
publishing-tool changes are included. No manifest or APK is created or replaced.

### Validation

- Parsed `app.json` against the exact baseline: only versionCode changed.
- `EXPO_NO_TELEMETRY=1 npx expo config --type public --json`: resolved package
  fi.sancti.client, code 80000187, version 8.1.8. This resolves configuration;
  it does not regenerate native files or build an APK. Telemetry was disabled
  because the cloud default Expo user-settings directory was not writable.
- In-memory signing-plugin check with 80000187: metadata preserved, permanent
  release configuration selected, repeated application byte-for-byte idempotent.
  Existing fixture/assertions remain unchanged; no signing material is used.
- Node signing/publishing checks: **64 passed**, **2 skipped**. The optional
  Gradle harness and Android Gradle Plugin runtime groups were not enabled; no
  Gradle task or native build is run for this metadata-only change.
- Focused updater/manifest/banner/Settings tests: **8 suites, 198 tests passed**
  across Android/iOS Jest projects; none skipped. Existing comparisons already
  cover 80000187 offered against installed 80000186.
- `npx tsc --noEmit`, Intl, translation, ProGuard and native module-inventory
  checks passed. Existing translation missing-key warnings await Crowdin sync.
- Whitespace, relative-link and changed-file scope checks passed. Full application
  Jest was not rerun for this single config-number/documentation change; no
  runtime source or tests were modified. APK signature/metadata, native Gradle
  execution, public hosting and physical acceptance remain unverified here.

### Subsequent futwick release steps — after review and merge only

These are instructions for Nick/Carl, not commands executed by Codex. No build,
publication, installation or end-to-end acceptance is claimed by this PR.

1. Keep the phone's existing 80000186 installation and application data intact.
   Confirm the installed build with the read-only command below and verify the
   sancti.fi Settings update-check action is present. Record representative login,
   settings, offline-media and playback state without exposing private data.

   ```bash
   adb shell dumpsys package fi.sancti.client | rg 'versionCode=|versionName='
   ```

2. Merge only after approval, refresh futwick's `sanctifi` checkout and confirm a
   clean source tree. Reserve/record this controlled 80000187 release in the
   [ledger](../android-release-ledger.md), including its historical local-test
   caveat. Record the actual full source revision **after merge and before build**;
   the baseline SHA above does not include this increment and is not build
   provenance. Keep that source unchanged through the build.

   ```bash
   git status --short
   SF_BUILD_SOURCE=$(git rev-parse HEAD)
   printf '%s\n' "$SF_BUILD_SOURCE"
   rg -n 'versionCode|versionName|applicationId' android/app/build.gradle
   ```

   Confirm generated Android metadata is 80000187 / 8.1.8 / fi.sancti.client.
   If stale, preserve local native work and apply the established reviewed Expo
   regeneration procedure before building; compare regenerated files and confirm
   the permanent release signer/validator remain configured. Editing `app.json`
   alone does not update an existing ignored Gradle project.

3. Use the existing futwick JDK/SDK setup and permanent release identity. From a
   fresh configured terminal at the checkout root, the previously successful
   release task is shown below. It builds only; do not install the APK as a
   preparatory step. Keep credentials exclusively on futwick.

   ```bash
   test -x "${JAVA_HOME:?}/bin/java"
   test -d "${ANDROID_HOME:?}"
   (cd android && NODE_ENV=production ./gradlew :app:assembleRelease)
   ```

4. Verify the actual newly built APK before staging or publication:

   ```bash
   "$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs \
     android/app/build/outputs/apk/release/app-release.apk
   "$ANDROID_HOME/build-tools/36.0.0/aapt2" dump badging \
     android/app/build/outputs/apk/release/app-release.apk | rg '^package:'
   sha256sum android/app/build/outputs/apk/release/app-release.apk
   node scripts/android-release.js stage \
     android/app/build/outputs/apk/release/app-release.apk \
     --build-tools "$ANDROID_HOME/build-tools/36.0.0" \
     --source-revision "$SF_BUILD_SOURCE"
   ```

   Require a valid APK signature, one signer matching the permanent public
   certificate SHA-256
   `a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c`,
   package fi.sancti.client, versionCode 80000187 and versionName 8.1.8. Record the
   **new APK's actual checksum**; none is available from source-only preparation.
   Staging must not overwrite any earlier local artifact named for 80000187.
   If one exists from the earlier test, stop and reconcile/isolate it with the
   owner; do not overwrite it or label it as this build.

5. Follow the existing manual publishing procedure separately: transfer to a
   temporary location, verify, publish immutable
   `https://updates.sancti.fi/client/apks/sanctifi-80000187.apk` without overwriting
   an existing artifact, then verify the **full public HTTPS download**, metadata,
   certificate and checksum. Only after that succeeds, validate a candidate
   schema-v1 Alpha manifest against the verified APK and replace `alpha.json`
   atomically. Use its actual 8.1.8 versionName and new checksum; retain the old
   manifest and immutable APK. Record source, hashes and outcome in the ledger.
   No live publication commands are executed by this PR. The obsolete Issue 022
   URL proposal is historical; the publishing guide already documents the
   canonical host. No GitHub issue text is edited here.

### Outstanding end-to-end acceptance

Preserve installed 80000186 until the new artifact and manifest are published.
Fresh-launch the existing client to exercise its one-automatic-check-per-process
behaviour. Verify newer-build notification, dismissal and continued usability,
then a manual check from the sancti.fi Settings version line. Select the explicit
Download action and follow the browser/Android installer to upgrade in place.
**Do not uninstall, clear data or use `adb install -r` for this primary path.**

Confirm installed 80000187, retained login/settings/offline media/playback and an
up-to-date manual result without another update offer. Record any failures and
cache/freshness observations in the diary. A successful build, structural manifest
validation or source-level comparison is not evidence of this physical acceptance.
The PR remains unmerged for review; all live and device steps remain outstanding.
