# sancti.fi Client - Project Diary

## 26 October 2026 - Issue 047: Historical Alpha 80000188 reconciliation

### Scope and repository evidence

The owner requested historical documentation and future-release readiness after
PR 48 merged and configuration commit `897f374a` was pushed. Refreshed sanctifi to
`897f374ae50863dbe9f77ffc7c7f89e33e2c68da`, then created the dedicated branch
`issue-047-reconcile-alpha-80000188`. Read Issue 047 including its historical
runbook, the ledger/publishing guide, Stage 1 code and diary, and the earlier
signing/Alpha publication/80000187 acceptance records.

Direct repository inspection confirms that app.json now records versionCode
80000188, semantic version 0.1.1, native versionName 8.1.8 and package fi.sancti.client.
This verifies current configuration only, not the source used for the old APK.
The earlier Stage 1 diary remains an unchanged historical account of its baseline.

### Owner-supplied artifact and release evidence

| Property | Confirmed value / evidence |
| --- | --- |
| Android versionCode | `80000188`, from the reported original APK inspection. |
| sancti.fi semantic version | `0.1.1`, from owner release testing. |
| Android versionName | `8.1.8`, from the reported original APK inspection. |
| Package | `fi.sancti.client`, from the reported original APK inspection. |
| APK size | **79,562,702 bytes**, from the reported original APK inspection. |
| APK SHA-256 | `b94623970de73c14da3f89d5569c272b1d1a994296f431750a24b2d1236c5e7e`, from the reported original APK inspection. |
| Local modification time | `2026-10-25 16:00:31 UTC`; not necessarily build or publication time. |
| Distribution | Alpha, 25 October 2026; owner confirms successful testing/publication and the existing publication integrity checks. |
| Allocation high-water mark | **80000188**; owner explicitly confirms no higher code has been reserved, built, attempted or distributed. |

The owner retained and inspected `releases/sanctifi-80000188.apk`, then deleted that
local copy because the published copy had already been verified. This is a report
of an earlier owner action, not deletion, download or verification performed here.
No APK/HTTPS/device checks are repeated or independently claimed by this update.
No additional device-test matrix results are inferred from the general success report.

### Provenance limitations and decisions

The exact original build-source commit remains **unknown**. Neither configuration
commit `897f374a`, current HEAD nor a guessed full revision is assigned to the APK.
The exact build time and publication clock time are also unknown; local file mtime
is retained only as mtime evidence. The signing certificate was not independently
inspected during the latest reconciliation. The documented permanent signing
identity is not presented as a fresh signer observation for this APK.

Add a historical **Published Alpha** row to the ledger, preserving earlier history.
Record the known identity, unknown source and unverified signer explicitly. Replace
obsolete guide statements about missing size/hash, stale configuration and incomplete
allocation history. No historical Stage 1 staging record or private allocation JSON
is fabricated; that format is not retroactively assigned to the manual release.

### Compatibility and future preflight

Stage 1 code and checks are unchanged. Its ledger parser reads version codes from
table rows; the new Published row records 80000188 without satisfying the separate
Reserved-status requirement. A future new artifact still requires owner approval,
a code above the reconciled high-water mark, matching app.json/ignored native
metadata, a new Reserved ledger row and its own private allocation attestation.
None is created or authorised here. Allocation history must be reconfirmed then.
Unknown historical build source is not a reason to falsify provenance or block a
separately approved higher allocation once the allocation history is reconciled.

Current 80000188 cannot pass --intent new as an already distributed code. A
historical ledger row also cannot supply the retained APK/original provenance
required by --intent keep; the known source gap must not be filled with HEAD.
Futwick environment, clean source, native consistency and normal verification gates
remain required for future preparation; this documentation does not certify them.

Two existing hardcoded diagnostics still refer to the stale 80000187 baseline and
an unestablished 80000188 hash/source. They now contain obsolete wording; this is
reported separately, with no implementation or allocation-check change in scope.

### Validation and delivery boundaries

- Manifest/staging Node fixture checks: **52 passed, none skipped or failed**.
  These use synthetic bytes/simulated SDK output, not a production APK. No Gradle
  runtime tests or release build were invoked.
- TypeScript, Intl, translations, ProGuard and native module inventory passed.
  Translation validation retains **2,169 missing-key warnings** awaiting Crowdin.
- Exact hash/size/version/timestamp comparisons, ledger code/status parsing,
  documentation links/fences and whitespace checks passed. The original 80000187
  row and manual publishing checklist remain unchanged.
- Byte comparisons confirm app.json, app.config.js, Stage 1 code/tests, signing
  plugin, dependency files and the earlier Stage 1 diary match the branch base.
  The only changed files are the ledger, publishing guide and this diary.
- Full application Jest was not rerun for this documentation-only reconciliation.
  No APK, live hosting, device or futwick environment acceptance is claimed from
  these repository checks.

Only the ledger, publishing guide and this diary change. No version/configuration, native files, Stage 1 implementation,
signing identity or artifacts are changed. No Gradle, Expo prebuild, actual APK build,
future reservation/attestation, artifact transfer/removal, live manifest or server
operation is performed. The review PR references Issue 047 and must remain unmerged.
