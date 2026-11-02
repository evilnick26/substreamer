'use strict';

const { inspect } = require('../android-remote-inventory');

const hash = (character) => character.repeat(64);
const sample = (override = {}) => {
  const names = ['apks/sanctifi-80000190.apk', 'apks/sanctifi-80000191.apk'];
  const hashes = [`${hash('a')}  apks/sanctifi-80000190.apk`, `${hash('b')}  apks/sanctifi-80000191.apk`];
  const manifest = JSON.stringify({ schemaVersion: 1, versionCode: 80000191,
    apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000191.apk', sha256: hash('b'), ...override });
  return [

  ...names,
  '---BEFORE-END---',
  '---SHA256---',
  ...hashes,
  '---ALPHA---',
  manifest,
  '---AFTER---',
  ...names,
  '---AFTER-END---',
  ...hashes,
  '---ALPHA-AGAIN---',
  manifest,
].join('\n');
};

describe('remote inventory observation (issue #067)', () => {
  test('reads APK hashes and validates the active Alpha manifest', () => {
    const result = inspect(sample());
    expect(result.status).toBe('observed-not-authoritative');
    expect(result.apks.map((entry) => entry.versionCode)).toEqual([80000190, 80000191]);
    expect(result.alpha.sha256).toBe(hash('b'));
  });

  test('rejects manifest hash mismatch', () => {
    expect(() => inspect(sample({ sha256: hash('c') }))).toThrow('Alpha manifest disagrees');
  });

  test('rejects missing hash lines', () => {
    expect(() => inspect(sample().replace(
      `${hash('a')}  apks/sanctifi-80000190.apk\n`, '',
    ))).toThrow('Remote inventory changed');
  });

  test('rejects duplicate checksum records', () => {
    expect(() => inspect(sample().replace(
      `${hash('a')}  apks/sanctifi-80000190.apk`,
      `${hash('b')}  apks/sanctifi-80000191.apk`,
    ))).toThrow('Remote inventory changed');
  });

  test('rejects manifest changed during observation', () => {
    const changed = sample().replace('---ALPHA-AGAIN---\n', '---ALPHA-AGAIN---\n ');
    expect(() => inspect(changed)).toThrow('Remote inventory changed');
  });

  test('rejects truncated remote output', () => {
    expect(() => inspect('apks/sanctifi-80000191.apk')).toThrow('Incomplete remote inventory');
  });
});
