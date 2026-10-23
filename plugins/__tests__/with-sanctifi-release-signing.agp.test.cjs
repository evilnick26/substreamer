const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { configureReleaseSigning } = require("../with-sanctifi-release-signing");

// Use real AGP tasks, but never package an APK or run signing/key generation.
test("AGP 8.12.0 tolerates absent release credentials and guards assembleRelease", {
  skip: !(process.env.GRADLE_BIN && process.env.SANCTIFI_AGP_SDK) &&
    "Set GRADLE_BIN and SANCTIFI_AGP_SDK for real Android plugin checks",
  timeout: 300000,
}, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sanctifi-real-agp-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const catalog = fs.readFileSync(require.resolve("@react-native/gradle-plugin/gradle/libs.versions.toml"), "utf8");
  assert.match(catalog, /^agp = "8\.12\.0"$/m, "Review the probe when the fork's AGP version changes");
  const properties = path.join(root, "absent.properties");
  fs.writeFileSync(path.join(root, "settings.gradle"), 'rootProject.name = "sanctifi-real-agp"\n');
  let fixture = fs.readFileSync(path.join(__dirname, "fixtures/app-build.gradle"), "utf8");
  fixture = fixture.replace("android {", `android {
    namespace "fi.sancti.probe"
    compileSdk 36
    buildToolsVersion "36.0.0"`);
  fs.writeFileSync(path.join(root, "build.gradle"), `buildscript {
    repositories { google(); mavenCentral() }
    dependencies { classpath 'com.android.tools.build:gradle:8.12.0' }
}
apply plugin: 'com.android.application'
repositories { google(); mavenCentral() }
` + configureReleaseSigning(fixture) + `
tasks.register('assertMissingReleaseSettings') {
    doLast {
        assert gradle.gradleVersion == '8.14.3'
        assert com.android.Version.ANDROID_GRADLE_PLUGIN_VERSION == '8.12.0'
        def releaseSigner = android.signingConfigs.getByName('sanctifiRelease')
        assert releaseSigner.storeFile == null
        assert releaseSigner.storePassword == null
        assert releaseSigner.keyAlias == null
        assert releaseSigner.keyPassword == null
        assert android.buildTypes.release.signingConfig.is(releaseSigner)
        assert android.buildTypes.debug.signingConfig.is(android.signingConfigs.debug)
    }
}
`);
  const javaDir = path.join(root, "src/main/java/fi/sancti/probe");
  fs.mkdirSync(javaDir, { recursive: true });
  fs.writeFileSync(path.join(root, "src/main/AndroidManifest.xml"),
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application /></manifest>');
  fs.writeFileSync(path.join(javaDir, "Probe.java"),
    'package fi.sancti.probe; public final class Probe { public static int value() { return 21; } }');

  function run(...tasks) {
    const args = ["--no-daemon", "--console=plain", "--max-workers=2"];
    if (process.env.SANCTIFI_AGP_INIT_SCRIPT) args.push("--init-script", process.env.SANCTIFI_AGP_INIT_SCRIPT);
    const result = spawnSync(process.env.GRADLE_BIN, [...args, ...tasks], {
      cwd: root, encoding: "utf8", timeout: 120000,
      env: { ...process.env,
        GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(root, "gradle-home"),
        ANDROID_HOME: process.env.SANCTIFI_AGP_SDK,
        ANDROID_SDK_ROOT: process.env.SANCTIFI_AGP_SDK,
        ANDROID_USER_HOME: path.join(root, "android-user"),
        SANCTIFI_SIGNING_PROPERTIES: properties },
    });
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  }
  await t.test("actual Android DSL accepts null release fields and preserves debug signer", () => {
    const result = run("assertMissingReleaseSettings");
    assert.equal(result.status, 0, result.output);
  });
  await t.test("assembleDebug graph excludes release validation", () => {
    const result = run("assembleDebug", "--dry-run");
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /:assembleDebug SKIPPED/);
    assert.doesNotMatch(result.output, /:validateSanctifiReleaseSigning/);
  });
  await t.test("debug Java compilation executes without release credentials", () => {
    const result = run("compileDebugJavaWithJavac");
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /> Task :compileDebugJavaWithJavac(?:\r?\n| )/);
    assert.ok(fs.existsSync(path.join(root,
      "build/intermediates/javac/debug/compileDebugJavaWithJavac/classes/fi/sancti/probe/Probe.class")));
    assert.doesNotMatch(result.output, /> Task :validateSanctifiReleaseSigning/);
  });
  await t.test("real assembleRelease graph orders our validator before preReleaseBuild", () => {
    const result = run("assembleRelease", "--dry-run");
    assert.equal(result.status, 0, result.output);
    const validation = result.output.indexOf(":validateSanctifiReleaseSigning SKIPPED");
    const preBuild = result.output.indexOf(":preReleaseBuild SKIPPED");
    const assemble = result.output.indexOf(":assembleRelease SKIPPED");
    assert.ok(validation >= 0 && preBuild > validation && assemble > preBuild, result.output);
    // AGP omits its own signing validation when this configuration is incomplete.
    assert.doesNotMatch(result.output, /:validateSigningRelease SKIPPED/);
  });
  await t.test("executing real preReleaseBuild fails at our validation task", () => {
    const result = run("preReleaseBuild");
    assert.notEqual(result.status, 0);
    assert.match(result.output, /> Task :validateSanctifiReleaseSigning FAILED/);
    assert.match(result.output, /Missing sancti.fi release signing properties/);
    assert.doesNotMatch(result.output, /> Task :preReleaseBuild(?:\r?\n| )/);
  });
  await t.test("probe creates neither APKs nor signing keys", () => {
    const forbidden = [];
    function walk(directory) {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const name = path.join(directory, item.name);
        if (item.isDirectory()) walk(name);
        else if (/\.(apk|aab|keystore|jks|p12)$/i.test(item.name)) forbidden.push(name);
      }
    }
    walk(root);
    assert.deepEqual(forbidden, []);
  });
});
