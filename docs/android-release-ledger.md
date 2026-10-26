# sancti.fi Android release ledger

This is a manual record, not a release service. One publisher allocates numbers.
Keep allocated/withdrawn numbers; never reuse them for different APK bytes.
Promotion reuses an artifact and does not allocate a code.

Known previously distributed codes include `80000185` and `80000186`; the latter's
actual versionName is `8.1.8`. The [physical upgrade diary](project-diary/2026-10-24_issue-022_physical-upgrade-validation.md)
records the owner-reported source `64fca44e` and permanent certificate. It does not
record the APK byte checksum. The subsequent
[24 October Alpha publication record](project-diary/2026-10-24_issue-022_alpha-publication.md)
now records the supplied checksum and successful live publication of `80000186`,
versionName `8.1.8`; Beta and Stable remain unpublished. Keep the exact build-source
attestation with the artifact record rather than inferring it from deployment HEAD.

Add one row per reservation/artifact; update its status/channel history without
erasing earlier allocations. Include failed/withdrawn reservations. Keep the full
public certificate digest in the staging record and publication evidence.

| versionCode | Actual versionName | Exact source revision (40 characters if known) | APK SHA-256 | Certificate SHA-256 | Status / UTC date / channels / archive URL |
| --- | --- | --- | --- | --- | --- |
| `80000187` | `8.1.8` | `3010cf5ca0a0443e99fe1c644666b747dd927506` | `95e388228dc644a4fbca069ca205a856f376dab534b61123cf13445efa9ed3cc` | `a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c` | Published Alpha; owner reported 25 October 2026; exact UTC time not supplied. [Immutable APK](https://updates.sancti.fi/client/apks/sanctifi-80000187.apk). In-place 80000186 to 80000187 acceptance passed. |
| `80000188` | `8.1.8` | Unknown - original build source not established | `b94623970de73c14da3f89d5569c272b1d1a994296f431750a24b2d1236c5e7e` | Unverified in this reconciliation; no APK-specific certificate digest recorded here | Published Alpha, 25 October 2026 (owner-attested); exact UTC publication time unknown. [Immutable APK](https://updates.sancti.fi/client/apks/sanctifi-80000188.apk). Historical publication, not a future reservation. |

### 26 October 2026: historical Alpha 80000188 reconciliation

The owner supplied the original APK inspection results and confirmed successful
release testing/publication, including the existing publication integrity checks.
These are owner-reported results, not APK, HTTPS or phone checks repeated here.
See the [reconciliation diary](project-diary/2026-10-26_issue-047_alpha-80000188-reconciliation.md).

Additional confirmed release facts:

| Property | Owner-supplied value / evidence |
| --- | --- |
| sancti.fi semantic version | `0.1.1`, from the owner's release testing; separate from Android versionName `8.1.8`. |
| Android package | `fi.sancti.client`, from the reported original APK inspection. |
| APK size | **79,562,702 bytes**, from the reported original APK inspection. |
| Local APK modification time | `2026-10-25 16:00:31 UTC`; a file modification time, not an established build or publication time. |
| Historical local copy | `releases/sanctifi-80000188.apk`; inspected, then deleted by the owner after the published copy had already been verified. No deletion is performed by this documentation update. |

The original build-source commit remains **unknown**. Commit
`897f374ae50863dbe9f77ffc7c7f89e33e2c68da` records the current app.json configuration
(semantic 0.1.1 / build 80000188); it does not establish which source produced the
historical APK. Neither it nor current HEAD is assigned as that artifact's source.

The original APK's signing certificate was **not independently inspected during
this latest reconciliation**. The permanent identity documented in the
[signing validation diary](project-diary/2026-10-24_issue-021_futwick-validation.md)
is not a fresh certificate observation for 80000188. No signature verification is
claimed here from the file checksum or successful historical publication alone.

The owner explicitly confirms that **no versionCode higher than 80000188 has been
reserved, built, attempted or distributed**. The owner-confirmed global allocation
high-water mark is therefore **80000188** as of this reconciliation. This statement
reconciles allocation history without filling in the unknown build provenance.

This historical Published row is not a Stage 1 `Reserved` row. No retrospective
`.apk.json`, private allocation attestation, new reservation or future release
authorisation is created. A future new artifact still requires a separately
approved higher code, matching configuration/native metadata, its own Reserved
ledger row and the Stage 1 allocation attestation. Unknown historical source does
not invalidate the confirmed allocation high-water mark; it must remain unknown.

### Earlier 80000187 acceptance

The published 80000187 APK is **79,561,254 bytes**, package `fi.sancti.client`.
Gradle release build succeeded in **13m 54s**. The owner confirmed APK publication
before manifest promotion, full public HTTPS download checksum verification,
candidate-manifest validation against the signed local APK, atomic promotion and
public Alpha advertising 80000187. The source revision above is the owner's build
attestation, not provenance inferred from deployment HEAD.

Physical acceptance passed: baseline 80000186 confirmed; manual discovery, correct
build/release notes, cancellation then rediscovery, eventual automatic discovery
(after several relaunches), browser APK download, Android in-place installation,
subsequent Up to Date result, Favourites/offline music retention, and both online
and offline playback. See the [final acceptance diary](project-diary/2026-10-25_issue-038_alpha-update-build.md)
for the full record and separate unimplemented tap-target, human-version and
startup-timing improvements. First-launch reliability is not established.

The earlier temporary local 80000187 test artifact documented under Issue 023
was not this published APK; do not substitute its checksum or provenance.
Previous 80000185/80000186 history above remains intact. Beta/Stable promotion is
not reported by this acceptance; the recorded new channel is Alpha only.

No new reservations or deployments are performed by this documentation update.
The owner-confirmed high-water mark is **80000188**; no higher code is authorised
or reserved here. Reconfirm allocation history at the time of any future release.

See [publishing procedure and proposed human-version migration](android-release-publishing.md).
Never record private keys, passwords, recovery archives or access credentials here.
