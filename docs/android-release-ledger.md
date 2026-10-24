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

No new reservations or deployments are performed by this documentation update. Before allocating,
include all later distributions and reservations, not only repository history.
The known high-water mark is `80000186`; the next new allocation must exceed it.

See [publishing procedure and proposed human-version migration](android-release-publishing.md).
Never record private keys, passwords, recovery archives or access credentials here.
