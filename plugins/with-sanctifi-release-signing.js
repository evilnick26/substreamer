const { withAppBuildGradle } = require("expo/config-plugins");

const ERROR = "[with-sanctifi-release-signing] Unsupported app/build.gradle structure; review the Expo template before building releases.";

// Credentials are read by Gradle on the build machine, never by Expo prebuild.
const SETUP = `// @generated begin sanctifi-signing-setup
def sanctifiSigning = new Properties()
def sanctifiSigningPath = System.getenv('SANCTIFI_SIGNING_PROPERTIES')
def sanctifiSigningFile = sanctifiSigningPath
    ? new File(sanctifiSigningPath)
    : new File(System.getProperty('user.home'), '.config/sanctifi/signing.properties')
def sanctifiSigningReadFailed = false
try {
    if (sanctifiSigningFile.isFile()) {
        sanctifiSigningFile.withInputStream { sanctifiSigning.load(it) }
    }
} catch (Exception ignored) {
    sanctifiSigningReadFailed = true
}

def validateSanctifiReleaseSigning = tasks.register('validateSanctifiReleaseSigning') {
    doLast {
        if (sanctifiSigningReadFailed) {
            throw new GradleException('Cannot read sancti.fi release signing properties; inspect the local file without logging credentials.')
        }
        def required = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']
        def missing = required.findAll { !sanctifiSigning.getProperty(it)?.trim() }
        if (!missing.isEmpty()) {
            throw new GradleException('Missing sancti.fi release signing properties: ' + missing.join(', ') + '. Configure the external signing.properties file; debug signing is never used for release.')
        }
        def keystore = new File(sanctifiSigning.getProperty('storeFile'))
        if (!keystore.isAbsolute() || !keystore.isFile() || !keystore.canRead()) {
            throw new GradleException('sancti.fi storeFile must be an absolute path to a readable keystore.')
        }
    }
}
tasks.configureEach { task ->
    if (task.name == 'preReleaseBuild' || task.name == 'validateSigningRelease') {
        task.dependsOn(validateSanctifiReleaseSigning)
    }
}
// @generated end sanctifi-signing-setup

`;

const SIGNER = `        // @generated begin sanctifi-signing-config
        sanctifiRelease {
            storeType 'PKCS12'
            def keystorePath = sanctifiSigning.getProperty('storeFile')
            if (keystorePath) storeFile new File(keystorePath)
            storePassword sanctifiSigning.getProperty('storePassword')
            keyAlias sanctifiSigning.getProperty('keyAlias')
            keyPassword sanctifiSigning.getProperty('keyPassword')
        }
        // @generated end sanctifi-signing-config
`;

function count(contents, text) {
  return contents.split(text).length - 1;
}

function configureReleaseSigning(contents) {
  let original = contents;
  if (contents.includes("@generated begin sanctifi-signing")) {
    if (count(contents, SETUP) !== 1 || count(contents, SIGNER) !== 1 ||
        count(contents, "signingConfig signingConfigs.sanctifiRelease") !== 1) {
      throw new Error(ERROR);
    }
    original = contents.replace(SETUP, "").replace(SIGNER, "")
      .replace("signingConfig signingConfigs.sanctifiRelease", "signingConfig signingConfigs.debug");
  }

  const signing = /^    signingConfigs \{\n        debug \{\n(?:            [^\n]*\n)+        \}\n    \}/gm;
  const buildTypes = /^    buildTypes \{\n        debug \{\n            signingConfig signingConfigs\.debug\n        \}\n        release \{\n(?:(?!^        \}).)*^        \}\n    \}/gms;
  const signingBlocks = [...original.matchAll(signing)];
  const buildBlocks = [...original.matchAll(buildTypes)];
  if ((original.match(/^android \{/gm) || []).length !== 1 || count(original, "    signingConfigs {") !== 1 ||
      count(original, "    buildTypes {") !== 1 || signingBlocks.length !== 1 ||
      buildBlocks.length !== 1 || count(original, "signingConfig signingConfigs.debug") !== 2 ||
      (original.match(/\bsigningConfig\b/g) || []).length !== 2 ||
      count(buildBlocks[0][0], "signingConfig signingConfigs.debug") !== 2 ||
      original.includes("sanctifiRelease") || original.includes("@generated begin sanctifi-signing")) {
    throw new Error(ERROR);
  }

  const signingBlock = signingBlocks[0][0];
  const buildBlock = buildBlocks[0][0];
  const releaseStart = buildBlock.indexOf("        release {");
  const signedBuildBlock = buildBlock.slice(0, releaseStart) + buildBlock.slice(releaseStart)
    .replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.sanctifiRelease");
  const result = original.replace(signingBlock, signingBlock.slice(0, -5) + SIGNER + "    }")
    .replace(buildBlock, signedBuildBlock)
    .replace(/^android \{/m, SETUP + "android {");
  if (contents !== original && result !== contents) throw new Error(ERROR);
  return result;
}

function withSanctifiReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") throw new Error(ERROR);
    config.modResults.contents = configureReleaseSigning(config.modResults.contents);
    return config;
  });
}

module.exports = withSanctifiReleaseSigning;
module.exports.configureReleaseSigning = configureReleaseSigning;
