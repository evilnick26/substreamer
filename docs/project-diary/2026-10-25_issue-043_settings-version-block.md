# sancti.fi Client — Project Diary

## 25 October 2026 — Issue 043: Readable Settings version block and compact footer

### Investigation, approval and branch ordering

Read [Issue 043](https://github.com/evilnick26/substreamer/issues/43) and inspected
Settings, both version components, resolved/static Expo configuration and the
existing interaction tests before implementation. Initially PR 42 was still open,
so no Issue 043 source changes or branch were created then. After the owner
confirmed it had landed, verified its squash merge and refreshed `sanctifi` to
`8899eeda3b1c931909e267e623556fe9291792cd`. This work uses the separate
`issue-043-settings-version-block` branch from that commit.

The old own-version label read a display-only `SANCTIFI_VERSION = '0.1.1'` literal,
while `expo.version` remained inherited `8.1.8`. Earlier native-version unification
was still an unapproved proposal. Nick explicitly approved initial sancti.fi
semantic version **0.1.0**, with `expo.extra.sanctifiVersion` as its authoritative
source. Native semantic-version migration is explicitly deferred. The illustrative
semantic/build progression in the issue is not a retroactive assignment to any
published APK or authority to increment the Android build in this patch.

### Layout findings and implementation

The footer had two independent spacing sources: Settings' ScrollView applied a
**12-unit gap**, and `VersionFooter` added **20 units of marginTop**. They stacked
to 32 logical units between the sancti.fi component and inherited version line.
There was no flex spacer or fixed footer height to remove. Both version text
styles were only 12 units, and only the sancti.fi component's first text line was
inside its Pressable; attribution and result text were outside it.

The change is limited to that footer:

- Add `expo.extra.sanctifiVersion: "0.1.0"` in `app.json`. Read it from
  `Constants.expoConfig.extra` at presentation time and delete the now-unused
  display-constant module. There is no second sancti.fi release-version literal
  in component/config code.
- Display the **actual full installed build** using
  `Application.nativeBuildVersion`, independently of the semantic version and the
  inherited modulo-1000 footer. `expo-application` is already a direct dependency;
  no dependency is added. Missing version/build information is shown as Unknown,
  without guessing from native versionName or source configuration.
- The presentation is now `sancti.fi Client`, `Version 0.1.0`, `Build 80000187`
  (when that is the actual installed build), then `Tap to check for updates`.
  The **brand increases from the old 12-unit line to 16, semibold**; **semantic
  version, build and result text increase from 12 to 14**. The action hint is 13.
  These are actual font-size increases, not just a larger touch area. Default
  system font scaling remains enabled, with no fixed block height or line cap.
- One full-width Pressable contains all own-version lines, hint, result and
  padding (12 units on each side, minimum height 44). It has a pressed-state
  visual, update-check label/hint, spoken version/build value and existing
  busy/disabled feedback. All lines and the padded block trigger the same existing
  manual check. The manual request/result/download logic is unchanged.
- Group the own block, plain `Based on Substreamer` attribution and independent
  inherited footer in a View with **gap 4**. Remove only the inherited text's
  extra 20-unit margin. Attribution and inherited version remain smaller at 12
  and use the secondary theme colour. No negative margins or unrelated Settings
  card/layout changes are introduced.
- Keep the inherited footer outside the update Pressable. Its handler, sliding
  three-second/five-tap window, countdown, haptics and success overlay are unchanged.
  Only its margin is removed. Upstream attribution remains noninteractive.
- Refresh the publishing guide's version-source section to document the approved
  Settings identity and deferred native migration. Historical proposals remain in
  their original diaries. No publishing procedure, updater or manifest is changed.

### Native and release boundaries

`expo.version` / Android versionName remains **8.1.8**; Android versionCode remains
**80000187**; package remains **fi.sancti.client**. iOS metadata, signing,
dependencies, manifest schema, numeric update ordering and all Issue 041 service/
controller logic are unchanged. The inherited version continues to show 8.1.8.

Settings' semantic label does not relabel an existing APK or override manifest
versionName. Existing immutable releases retain their actual 8.1.8 metadata.
The semantic version advances by owner release decision, not automatically on each
build. Native alignment and the next distributed Android build allocation remain
separate work; no APK was built, signed, published or installed here.

### Automated validation

- Baseline TypeScript and full Jest passed before source edits: **632 suites /
  11,168 tests passed**, with 8 existing private-fixture skips. New presentation
  regressions failed against the old single-line display before implementation.
- `npx tsc --noEmit`: passed.
- Focused UI/manual/startup-compatibility checks: **6 suites / 86 tests passed**
  across Android and iOS Jest projects. Coverage includes every own-version line,
  padded button and result taps; config-derived semantic/native build values;
  unavailable values; accessibility/busy/scaling/font-size/style properties;
  compact attribution spacing; five-tap isolation/countdown/window; unchanged
  Settings routes/welcome controls; and Issue 041 manual/startup interactions.
- Settings screen and inherited footer: **100% statements, branches, functions
  and lines**. Own version block: **96.96% statements, 90% branches, 100%
  functions and lines**.
- Full `npx jest --no-coverage --maxWorkers=2`: **634 suites / 11,190 tests
  passed**; existing **2 suites / 8 tests skipped** because the private captured
  database fixture is absent. No new tests are skipped.
- Resolved Expo public config confirms extra semantic 0.1.0, native version 8.1.8,
  Android code 80000187 and package fi.sancti.client. Parsed JSON comparison
  confirms the semantic extra is the only app configuration change.
- Exact source comparisons confirm the manual check handler is byte-for-byte
  unchanged, and `VersionFooter` differs only by removal of `marginTop: 20`.
- Intl, translation, ProGuard and native module-inventory checks passed. The five
  new English labels/hints/attribution keys follow the existing fallback model;
  translation validation reports 2,156 missing-key warnings awaiting Crowdin.
- Madge reports no cycles, with its three existing vector-icon resolution warnings.
  Documentation links/fences, whitespace and protected-file scope checks passed.
  No new dependency, native regeneration/build, signing or live operation ran.

### Outstanding physical checks alongside Issue 041

After review/merge and the owner's separately approved Android build:

1. Confirm the actual display uses semantic 0.1.0 and the installed full build
   independently, with upstream attribution/version nearby and secondary.
2. Compare readability with the old screen: 16-unit brand, 14-unit version/build
   and clear action hint. Check light/dark themes and larger system font sizes;
   lines should wrap and the block should grow without clipping or overlap.
3. Tap brand, version, build, hint, result and empty padded areas. They should all
   perform the existing manual check, with checking feedback and no duplicate
   in-flight action. Verify TalkBack label/hint/value and busy feedback.
4. Tap the attribution: it should perform neither update checking nor Developer
   Options activation. Five taps on the inherited footer should still unlock
   Developer Options; tapping the sancti.fi block must not count toward it.
5. Check the compact footer spacing and unchanged other Settings controls, then
   execute the separate Issue 041 startup/retry acceptance procedure. Do not
   modify a live manifest or repeat installation solely to test presentation.

No native device/emulator or React Native visual renderer was available in this
workspace. UI/interaction and style assertions are automated evidence, not native
screenshots or physical acceptance. This PR remains for review and must not be
merged by Codex.
