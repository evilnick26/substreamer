# sancti.fi Client — Project Diary
## 24 October 2026 — Issue 022: First in-place upgrade preparation

### Purpose and implementation

Started from refreshed remote `sanctifi` commit
`6c9237c1b7f5713c0580fe203b8b938657c346f1`, including the merged password
auto-capitalisation fix. Nick's physical phone currently has the permanently
signed client; this change prepares a higher Android build number for the first
same-key in-place upgrade experiment.

Changed only `expo.android.versionCode` in `app.json` from `80000185` to
`80000186`. Package `fi.sancti.client` and Expo version `8.1.8` remain unchanged;
the latter is the expected generated Android versionName, to be verified in the
actual APK. The separate visible sancti.fi client label remains `0.1.1`.

Reviewed the signing-plugin fixture and its `80000185` preservation assertion.
They deliberately exercise preservation of a sample input version, not equality
with the current app version. Both remain unchanged to preserve that meaningful
test without coupling a static signing fixture to every app version increment.
An additional in-memory check exercises the same plugin with `80000186`.

This is a controlled increment, not the final sancti.fi numbering policy. Signing
configuration, credentials, dependencies, release packaging and publishing scripts
are unchanged. No channel manifests, uploads or update-checking functionality are
included. No key generation or production APK build is performed in Codex.

### Validation

- Compared parsed `app.json` with the baseline: the versionCode increment is the
  only configuration change. Expo's resolved public configuration confirms
  `fi.sancti.client`, versionCode `80000186` and version `8.1.8`.
- Signing-plugin checks with both the unchanged fixture code and `80000186`
  preserve the supplied code, package and versionName and remain idempotent.
- Node signing tests: 12 passed; the two Gradle/AGP runtime groups explicitly
  skipped because those prerequisites were not enabled for this configuration
  change. No native build or signing operation was run.
- TypeScript passed. Full Jest: 618 suites passed, two skipped; 10,858 tests
  passed, eight skipped, no failures.
- Intl, translation, ProGuard and module-inventory validators passed; existing
  missing-translation warnings awaiting Crowdin sync remain.
- Whitespace and changed-file scope checks passed. Signing fixtures/assertions,
  source code, dependency declarations and lockfiles remain unchanged.

### Outstanding futwick and physical-device acceptance

After review and merge:

1. Record the installed baseline's versionCode and representative application
   state, including the existing login session and relevant settings/downloads.
   Do not expose credentials or private application data in reports.
2. On futwick, ensure Expo's generated Android project reflects versionCode
   `80000186` before building; an existing ignored native directory may retain
   older values until the supported regeneration procedure is applied. Preserve
   local-only native work before regeneration.
3. Build the new APK on futwick using the existing permanent signing identity.
   Verify the final APK's signature and certificate SHA-256, package
   `fi.sancti.client`, versionCode `80000186` and versionName `8.1.8`. Compare the
   certificate with the installed permanent-key baseline; a successful build
   alone does not prove upgrade compatibility.
4. Install the new APK over the existing installation without uninstalling,
   clearing application data or requesting a downgrade. Record the installer
   result and installed versionCode.
5. Confirm the login session, settings and representative existing data remain
   intact, and check normal playback/widget behaviour. Check the visible Issue
   026 password-keyboard change when it can be exercised without unnecessarily
   discarding the retained session.

No in-place upgrade success is claimed by this preparation. Device acceptance
remains outstanding until Nick performs these checks. The broader Issue 022
remains open for the numbering policy, channels and publishing workflow.
