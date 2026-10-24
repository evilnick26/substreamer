# 2026-10-24 — Issue #022: Physical in-place Android upgrade validation

## Context and investigation
- First controlled upgrade of the permanently signed sancti.fi Android client, following signing work in #021 and the minimal build-number increment in merged PR #29.
- Source revision: `64fca44e` on `sanctifi`.
- The generated native Android project initially retained the previous versionCode; regenerated it using `npx expo prebuild --platform android --no-install` before building.

## Implementation and build
- PR #29 changed Android `versionCode` from `80000185` to `80000186` in `app.json`; Android `versionName` remained `8.1.8`. No signing or runtime behaviour changes were required for this test.
- On futwick, built `android/app/build/outputs/apk/release/app-release.apk` with `./gradlew :app:assembleRelease --no-daemon`, logging to `substreamer-assemble-release.log`.
- Result: **BUILD SUCCESSFUL in 44m 9s**, 1518 actionable tasks (1486 executed, 32 up-to-date).

## Artifact verification
- Package: `fi.sancti.client`.
- Android `versionCode`: `80000186`; `versionName`: `8.1.8`.
- `apksigner verify --verbose --print-certs`: APK v2 signature valid, signer unchanged.
- Permanent signing certificate SHA-256: `a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c`.

## Physical-device validation (owner-reported, with before/after screenshots)
- Installed the newly signed APK **over** the existing `80000185` build on the Poco F8 Ultra without uninstalling or clearing application data. Installation and launch succeeded.
- Before upgrade: combined Nichard Pictures queue; selected track **“Attn MOVE” by Algernon Cadwallader**, from *Trying Not to Have a Thought* (2025), paused at **0:26**.
- After upgrade: the queue contained the same tracks in the same order, with the same current track selected. Playback resumed and was observed at **0:39**.
- In a subsequent separate logout/login test for #026, **Show Album Version** remained **ON** and **Accent Colour** remained **Album Artwork**. These observations establish persistence through logout/login; they were not independently measured immediately before and after APK installation.
- Logout/login also returned the custom Library navigation ordering to its default (Songs first). This is **non-blocking**, and was not observed as an upgrade regression. Cause not yet investigated.

## Decisions and outcome
- **PASS:** First permanently signed in-place Android upgrade, including playback queue, current song and playback position retention.
- **#022 remains open:** release numbering policy, static channel manifests, immutable APK publishing, promotion, and rollback/revocation workflow remain to be completed. Hosting layout was subsequently recorded in #022: `/updates/{alpha,beta,release}.json` and shared `/updates/apks/`.
- Do not treat this as exhaustive persistence testing. Android Auto, downloaded content, and every preference were not individually retested in this validation.

## Outstanding work
- Finish #022 manifest contract and publishing procedure; implement client update checks in #023.
- Optionally investigate Library order persistence under a separate low-priority issue; not an Alpha blocker.

The hosting layout noted above was subsequently superseded by
`https://updates.sancti.fi/client/`; see the
[distribution URL follow-up](2026-10-24_issue-022_distribution-url.md).
