const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { configureReleaseSigning } = require("../with-sanctifi-release-signing");

const fixture = fs.readFileSync(path.join(__dirname, "fixtures/app-build.gradle"), "utf8");
const generated = configureReleaseSigning(fixture);

test("release uses a dedicated signer, preserving debug, identity and versions", () => {
  assert.match(generated, /debug \{\n            signingConfig signingConfigs.debug/);
  assert.match(generated, /release \{[^}]*signingConfig signingConfigs.sanctifiRelease/);
  assert.match(generated, /sanctifiRelease \{\n            storeType 'PKCS12'/);
  assert.equal((generated.match(/signingConfig signingConfigs.debug/g) || []).length, 1);
  assert.match(generated, /applicationId "fi.sancti.client"/);
  assert.match(generated, /versionCode 80000185/);
  assert.match(generated, /versionName "8.1.8"/);
});

test("reapplying is byte-for-byte idempotent", () => {
  assert.equal(configureReleaseSigning(generated), generated);
});

test("regeneration requires no signing file or environment access", () => {
  const previous = process.env.SANCTIFI_SIGNING_PROPERTIES;
  process.env.SANCTIFI_SIGNING_PROPERTIES = "/nonexistent/signing.properties";
  try {
    assert.equal(configureReleaseSigning(fixture), generated);
  } finally {
    if (previous === undefined) delete process.env.SANCTIFI_SIGNING_PROPERTIES;
    else process.env.SANCTIFI_SIGNING_PROPERTIES = previous;
  }
});

for (const [name, source] of [
  ["changed release signer", fixture.replace(/signingConfigs.debug/g, "signingConfigs.other")],
  ["missing build types", fixture.replace("    buildTypes {", "    variants {")],
  ["duplicate signing blocks", fixture + fixture],
  ["changed signing block", fixture.replace("        debug {", "        renamed {")],
  ["additional signing override", fixture.replace("            minifyEnabled true", "            signingConfig null\n            minifyEnabled true")],
  ["incomplete generated setup", generated.replace("def sanctifiSigning = new Properties()", "// removed")],
  ["tampered release assignment", generated.replace("signingConfigs.sanctifiRelease", "signingConfigs.debug")],
  ["incomplete generated signer", generated.replace("keyAlias sanctifiSigning", "keyAlias altered")],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => configureReleaseSigning(source), /Unsupported app\/build.gradle structure/);
  });
}

test("registered Expo mod rejects Kotlin and transforms Groovy without credentials", async () => {
  const plugin = require("../with-sanctifi-release-signing");
  const config = plugin({ name: "signing-test", slug: "signing-test" });
  const mod = config.mods.android.appBuildGradle;
  const request = { projectRoot: "/tmp/unused", platformProjectRoot: "/tmp/unused/android" };
  const result = await mod({ ...config, modRequest: request,
    modResults: { language: "groovy", contents: fixture } });
  assert.equal(result.modResults.contents, generated);
  await assert.rejects(() => mod({ ...config, modRequest: request,
    modResults: { language: "kt", contents: fixture } }), /Unsupported/);
});

// Actual Gradle executes only credential validation and empty lifecycle tasks.
// No Android plugin, native build, keystore or signing operation is involved.
test("Gradle permits debug but fails release without usable settings", {
  skip: !process.env.GRADLE_BIN && "Set GRADLE_BIN to Gradle 8.14.3 for runtime checks",
  timeout: 240000,
}, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sanctifi-signing-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(root, "settings.gradle"), 'rootProject.name = "signing-test"\n');
  const setup = generated.slice(generated.indexOf("// @generated begin sanctifi-signing-setup"),
    generated.indexOf("// @generated end sanctifi-signing-setup"));
  fs.writeFileSync(path.join(root, "build.gradle"), setup + `
tasks.register('preDebugBuild')
tasks.register('preReleaseBuild')
tasks.register('validateSigningRelease')
tasks.register('debugProbe') { dependsOn('preDebugBuild') }
tasks.register('releaseProbe') { dependsOn('preReleaseBuild') }
`);
  const properties = path.join(root, "dummy.properties");
  const dummyStore = path.join(root, "dummy-not-a-keystore");
  fs.writeFileSync(dummyStore, "Fixture only; not signing material.");
  const full = `storeFile=${dummyStore}\nstorePassword=dummy-store-secret\nkeyAlias=dummy-alias\nkeyPassword=dummy-key-secret\n`;
  function run(task, file = properties) {
    const result = spawnSync(process.env.GRADLE_BIN, ["--offline", "--no-daemon", "--console=plain",
      "--max-workers=1", `-Duser.home=${home}`, task], {
      cwd: root,
      env: { ...process.env, GRADLE_USER_HOME: path.join(root, "gradle-home"),
        SANCTIFI_SIGNING_PROPERTIES: file },
      encoding: "utf8", timeout: 60000,
    });
    if (result.error) throw result.error;
    const output = result.stdout + result.stderr;
    assert.doesNotMatch(output, /dummy-store-secret|dummy-key-secret/);
    return { status: result.status, output };
  }
  await t.test("missing file permits debug", () => {
    const result = run("debugProbe");
    assert.equal(result.status, 0, result.output);
    assert.doesNotMatch(result.output, /> Task :validateSanctifiReleaseSigning/);
  });
  await t.test("missing file rejects release lifecycle and signing tasks", () => {
    for (const task of ["releaseProbe", "validateSigningRelease"]) {
      const result = run(task);
      assert.notEqual(result.status, 0);
      assert.match(result.output, /Missing sancti.fi release signing properties/);
    }
  });
  await t.test("incomplete credentials reject release", () => {
    fs.writeFileSync(properties, `storeFile=${dummyStore}\n`);
    const result = run("releaseProbe");
    assert.notEqual(result.status, 0);
    assert.match(result.output, /storePassword, keyAlias, keyPassword/);
  });
  await t.test("malformed properties permit debug and reject release without leaking values", () => {
    fs.writeFileSync(properties, "storePassword=dummy-store-secret\\uZZZZ\n");
    assert.equal(run("debugProbe").status, 0);
    const result = run("releaseProbe");
    assert.notEqual(result.status, 0);
    assert.match(result.output, /Cannot read sancti.fi release signing properties/);
  });
  await t.test("missing keystore rejects release", () => {
    fs.writeFileSync(properties, full.replace(dummyStore, path.join(root, "absent")));
    const result = run("releaseProbe");
    assert.notEqual(result.status, 0);
    assert.match(result.output, /absolute path to a readable keystore/);
  });
  await t.test("relative keystore rejects release", () => {
    fs.writeFileSync(properties, full.replace(dummyStore, "relative.p12"));
    assert.notEqual(run("releaseProbe").status, 0);
  });
  await t.test("complete dummy settings permit validation, not actual signing", () => {
    fs.writeFileSync(properties, full);
    const result = run("releaseProbe");
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /> Task :validateSanctifiReleaseSigning/);
  });
  await t.test("default external home location works without an override", () => {
    const directory = path.join(home, ".config/sanctifi");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "signing.properties"), full);
    const result = run("releaseProbe", "");
    assert.equal(result.status, 0, result.output);
  });
});
