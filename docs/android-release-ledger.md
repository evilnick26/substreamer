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

| versionCode | Actual versionName | Exact source revision (40 characters) | APK SHA-256 | Certificate SHA-256 | Status / UTC date / channels / archive URL |
| --- | --- | --- | --- | --- | --- |
| `80000187` | `8.1.8` | `3010cf5ca0a0443e99fe1c644666b747dd927506` | `95e388228dc644a4fbca069ca205a856f376dab534b61123cf13445efa9ed3cc` | `a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c` | Published Alpha; owner reported 25 October 2026; exact UTC time not supplied. [Immutable APK](https://updates.sancti.fi/client/apks/sanctifi-80000187.apk). In-place 80000186 to 80000187 acceptance passed. |

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

No new reservations or deployments are performed by this documentation update. Before allocating,
include all later distributions and reservations, not only repository history.
The known high-water mark is `80000187`; the next new allocation must exceed it.

See [publishing procedure and proposed human-version migration](android-release-publishing.md).
Never record private keys, passwords, recovery archives or access credentials here.
