# sancti.fi Android release signing

## Status and identity

The permanent release key must be generated and retained on **futwick**, never in
Codex. This document describes the procedure for review; adding the plugin does
not create a key, migrate an installation, or establish release readiness.

The inspected existing APK has package `fi.sancti.client`, versionCode `80000185`,
versionName `8.1.8`, and a verified v2 signature. Its Android Debug certificate
SHA-256 is `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Futwick's generated Gradle file assigned both build types to `signingConfigs.debug`.
Nick is the sole existing user and accepts a one-time uninstall/reinstall. No
special migration mechanism or separate debug package identity is included.

The permanent-key APK cannot ordinarily replace that debug-signed installation.
Uninstalling can delete settings, library state and downloaded music. Preserve
anything needed before the agreed reinstall; do not uninstall until the new APK
has passed verification. Subsequent releases must retain the permanent identity.

## Regeneration-safe configuration

`plugins/with-sanctifi-release-signing.js` uses Expo's `withAppBuildGradle` mod.
It adds a PKCS#12 `signingConfigs.sanctifiRelease`, assigns it only to the release build
type, and leaves debug signing untouched. It supports the current Groovy template
with exactly the debug/release structure used by this fork. Unexpected structures
or damaged generated sections fail prebuild clearly instead of leaving debug
signing attached to release. Reapplying the plugin is idempotent.

Expo does not read signing credentials. Gradle reads an external Java properties
file at configuration time from:

```
~/.config/sanctifi/signing.properties
```

An optional `SANCTIFI_SIGNING_PROPERTIES` environment variable overrides that
location. Use an absolute path for the override. Keep the variable shell-local;
do not add credentials or the properties file to the checkout or project `.env`.

Missing or malformed settings do not block prebuild or debug tasks. Release
`preReleaseBuild` and `validateSigningRelease` depend on an explicit validation
task. Missing fields or an unreadable/non-absolute keystore path fail release
validation; incorrect passwords, aliases or invalid keystores must fail Android's
actual signing validation. There is no debug fallback. If build types/flavors or
AGP lifecycle tasks change, review the plugin and repeat native validation.

The file contains these four fields, with **real values supplied locally only**:

```properties
storeFile=/absolute/path/outside/the/checkout/sanctifi-release.p12
storePassword=REPLACE_LOCALLY
keyAlias=sanctifi-release
keyPassword=REPLACE_LOCALLY
```

Use the same password for both password fields with the proposed PKCS#12 key.
Java properties syntax treats backslashes as escapes and has special rules for
leading whitespace. A password-manager-generated random ASCII alphanumeric
password of at least 32 characters avoids those encoding pitfalls. Do not trim or
alter a password when transferring it. Never print this file, pass passwords as
command arguments, enable shell tracing, or attach raw credential-bearing logs.
Do not run Gradle build scans or publish diagnostic reports containing credentials.
The external file contains plaintext passwords: protect it like the keystore.

## Futwick key generation — only after review

Run on futwick from the repository root, **not in Codex**. These commands refuse
to overwrite an existing keystore. Resolve the supported JDK using the repository
helper; passwords are entered only at keytool's local interactive prompts.

```bash
umask 077
source scripts/java-home.sh
SF_JAVA_HOME="$(resolve_java_home)" || exit 1
SF_SIGNING_DIR="$HOME/.local/share/sanctifi/signing"
SF_KEYSTORE="$SF_SIGNING_DIR/sanctifi-release.p12"
install -d -m 700 "$SF_SIGNING_DIR" "$HOME/.config/sanctifi"
if [ -e "$SF_KEYSTORE" ]; then
  echo "Keystore already exists; stop and investigate."
  exit 1
fi
"$SF_JAVA_HOME/bin/keytool" -genkeypair \
  -keystore "$SF_KEYSTORE" -storetype PKCS12 \
  -alias sanctifi-release -keyalg RSA -keysize 3072 \
  -sigalg SHA256withRSA -validity 10000 \
  -dname 'CN=sancti.fi Release, O=sancti.fi'
chmod 600 "$SF_KEYSTORE"
"$SF_JAVA_HOME/bin/keytool" -list -v \
  -keystore "$SF_KEYSTORE" -alias sanctifi-release
```

Record only the public certificate SHA-256, alias, creation/expiry dates and
responsible owner in the release record. Never upload the keystore or passwords.
Use a local editor under `umask 077` to create the external properties file;
do not overwrite an existing file without inspecting it locally first. Set its
permissions to `600`, verify parent-directory permissions, and store the password
in a password manager. Keep editor backup/temporary files outside the repository
and protected too.

## Independent backup and recovery

Before distributing anything:

1. Copy the keystore into an encrypted backup independent of futwick, such as an
   encrypted offline volume. A second file on futwick or an ordinary synchronized
   copy is insufficient. Do not overwrite an existing backup blindly.
2. Ensure the password manager and backup-unlocking recovery information remain
   accessible if futwick is lost. Document ownership and recovery locations
   privately; do not put secrets or sensitive access instructions in Git.
3. Recover the backup into a private temporary directory on futwick. Compare the
   recovered file's SHA-256 with the original locally, and inspect its public
   certificate with keytool. Confirm the expected alias and certificate match.
4. During approved native validation, prove that the recovered key can sign a
   disposable artifact and that apksigner reports the expected certificate.
   Listing a certificate alone does not prove usable private-key recovery.
5. Remove temporary recovery copies after validation, accounting for local
   backup/snapshot policies. Record the recovery result without credentials.

## Automated checks

No extra npm dependencies are needed:

```bash
node --test plugins/__tests__/with-sanctifi-release-signing.test.cjs
```

For runtime checks, point `GRADLE_BIN` to a trusted Gradle 8.14.3 installation:

```bash
GRADLE_BIN=/absolute/path/to/gradle-8.14.3/bin/gradle \
  node --test plugins/__tests__/with-sanctifi-release-signing.test.cjs
```

Without `GRADLE_BIN`, the runtime group is explicitly skipped. The runtime harness
uses isolated user/Gradle directories, dummy passwords and a text file that is not
a keystore. It exercises the generated validation task and lifecycle dependency
wiring; it does **not** run AGP, produce an APK, or prove native signing works.
The existing GitHub Actions test workflow runs the Node checks; its Gradle runtime
group is skipped unless a Gradle executable is explicitly supplied.

## Native acceptance on futwick — still required

After the implementation and local key procedure are approved:

1. Regenerate the Android project, preserving any local-only work first. Confirm
   the release signer is `sanctifiRelease` and debug remains `debug`. Repeat
   regeneration to check persistence; do not hand-edit the generated file.
2. With a controlled nonexistent properties override, confirm a normal debug
   build succeeds and a release build fails without producing a usable new
   artifact. Distinguish stale APKs by removing/archiving prior outputs first.
3. With local credentials, build a release APK. Check signature validity,
   certificate SHA-256, package ID, versionName and versionCode using Android
   build-tools `apksigner verify --verbose --print-certs` and `aapt2 dump badging`.
   The certificate must match the newly recorded permanent fingerprint and differ
   from the known debug fingerprint. Check a recovered-key artifact as above.
4. Complete Nick's accepted reinstall only after artifact verification. Keep
   future debug installations from replacing the release installation; separate
   package IDs remain deferred.
5. On a disposable device/profile, test a baseline and higher-version APK signed
   by the permanent key. Confirm in-place upgrade and representative data
   retention. Separately confirm incompatible-signer rejection without removing
   the baseline. Record the package versions, certificates and observed results.

Do not distribute Alpha APKs until backup recovery and upgrade acceptance pass.
Actual Android/AGP task wiring, credential errors and signing need this native
validation; the isolated tests cannot establish them.

## Boundary with release numbering and publishing

Issue 022 owns the globally increasing versionCode sequence, human-readable
versionName, manifests and publishing procedure. This signing change does not
alter versions, channels, release scripts or EAS settings. Allocate validation
and published build numbers through that procedure, above the highest already
distributed value; do not independently increment from multiple workflows.

Promote the exact verified signed APK across Alpha/Beta/Stable without rebuilding
or resigning. The inherited EAS project/owner and credentials have not been
verified as sancti.fi-controlled. Any future cloud build requires a separate
decision about secure signing custody and explicit certificate comparison; this
implementation keeps the permanent key exclusively on futwick.
