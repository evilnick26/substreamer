# sancti.fi Client — Project Diary
## 24 October 2026 — Issue 021: Futwick release-signing validation

### Evidence and scope

Nick reported the following results from the actual futwick development
environment and a physical Android phone. These are owner-reported local results,
not checks independently repeated in Codex. They follow the
[23 October investigation and implementation record](2026-10-23_issue-021_release-signing.md).

This documentation branch starts from remote `sanctifi` commit
`b67321adb6c13d9689e4de4a3b4b4e71531530ca`, containing merged PR 25.
No application code, signing configuration, version numbering or release
packaging is changed by this follow-up.

### Permanent signing identity and recovery

- Generated the permanent RSA-3072 PKCS#12 release-signing key on futwick and
  stored it outside Git.
- Created an AES-256 encrypted 7z recovery archive, uploaded it to Google Drive,
  downloaded it again, and verified its checksum.
- Successfully extracted the recovery archive and confirmed that the recovered
  keystore and certificate matched the originals.
- Confirmed that Gradle's signing validator rejects missing credentials and
  accepts the real local credentials.
- Confirmed that the release task graph includes the signing validator.

The public permanent sancti.fi certificate SHA-256 is:

```text
a6222ae2d79faeb5dea3e92528b399b0e4cabc6df3c08d6e43f33ffc55dc149c
```

This permanent identity replaces the debug signing identity documented in the
earlier investigation. No private signing credentials, keystore material,
recovery passwords or other secrets may enter Git. The public certificate
fingerprint above is the only signing identity material recorded here.

### Release build, installation and device observations

- Completed `:app:assembleRelease` on futwick in **56m 22s**, with **1,446 tasks
  executed and 72 up-to-date**.
- Verified the resulting APK with Android's `apksigner`: APK Signature Scheme v2
  verification succeeded, and the signing certificate matched the permanent
  sancti.fi key fingerprint above.
- Uninstalled the previous debug-signed sancti.fi installation and successfully
  installed the permanently signed APK on a physical Android phone, completing
  Nick's agreed one-time transition.
- The client appeared to operate normally. Its Android widget worked, including
  controlling playback. These observations do not establish exhaustive feature
  coverage.

### Expo native-project regeneration comparison

Nick compared the regenerated Android files with a backup made before
regeneration. All reported substantive differences were expected:

| File | Reported difference |
| --- | --- |
| `MainActivity.kt`, `MainApplication.kt` | Package declarations changed from `com.ghenry22.substream2` to `fi.sancti.client`; implementation otherwise identical. |
| `strings.xml` | Only the final newline changed. |
| `settings.gradle` | Gradle root project renamed from `substreamer` to `sancti.fi`. |
| `app/build.gradle` | Expected signing-plugin additions, release signing configuration and namespace change; no unrelated substantive changes. |

### Remaining limitations and next ownership

- An **in-place upgrade between two permanently signed APK versions has not yet
  been tested**. The successful uninstall/reinstall above is not an upgrade test.
  In-place upgrade validation belongs to Issue 022 alongside release numbering
  and distribution.
- **Android Auto has not yet been revalidated following native regeneration.**
  The working Android widget does not establish Android Auto compatibility.
- Signing continuity must be maintained for future releases. Keep the permanent
  key, private credentials and encrypted recovery material outside Git; never
  include passwords or private material in reports or PRs.

The reported results establish a successfully built, verified and physically
installed permanently signed sancti.fi Android application. Issue 021 remains
open for Nick and Carl's review and closure after this documentation PR is merged.
