import { validateReleaseManifest } from '../releaseManifest';

// The publisher is Node-only; contract parity belongs in tests, never in the app bundle.
const { validateManifest } = require('../../../scripts/android-release');
const valid = {
  schemaVersion: 1, versionCode: 80000186, versionName: '8.1.8',
  apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-80000186.apk', sha256: 'a'.repeat(64),
};
const badValues: unknown[] = [
  null, [], 'manifest', {}, { ...valid, schemaVersion: '1' }, { ...valid, schemaVersion: 2 },
  ...[0, -1, 1.5, 2100000001, NaN, Infinity, '80000186'].map((versionCode) => ({ ...valid, versionCode })),
  ...['', ' 8.1.8', '8.1.8 ', 'x'.repeat(129), 8].map((versionName) => ({ ...valid, versionName })),
  ...['A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 42].map((sha256) => ({ ...valid, sha256 })),
  ...[
    'https://sancti.fi/updates/apks/sanctifi-80000186.apk',
    'http://updates.sancti.fi/client/apks/sanctifi-80000186.apk',
    'https://evil.example/client/apks/sanctifi-80000186.apk',
    `${valid.apkUrl}?download=1`, `${valid.apkUrl}#fragment`,
    valid.apkUrl.replace('80000186', '80000187'),
    valid.apkUrl.replace('/apks/', '/files/'),
  ].map((apkUrl) => ({ ...valid, apkUrl })),
  { ...valid, extra: true }, { ...valid, releaseNotes: 4 }, { ...valid, releaseNotes: undefined },
  { ...valid, releaseNotes: 'x'.repeat(4001) },
  ...Object.keys(valid).map((key) => Object.fromEntries(Object.entries(valid).filter(([name]) => name !== key))),
];

test.each([valid, { ...valid, releaseNotes: '<b>Plain text</b>' }, { ...valid, releaseNotes: '' },
  { ...valid, releaseNotes: 'x'.repeat(4000), versionName: 'x'.repeat(128) },
  { ...valid, versionCode: 2100000000, apkUrl: 'https://updates.sancti.fi/client/apks/sanctifi-2100000000.apk' },
])('accepts the publisher contract %#', (value) => {
  expect(validateReleaseManifest(value)).toBe(value);
  expect(validateManifest(value)).toBe(value);
});
test.each(badValues.map((value) => [value]))('rejects invalid contract %#', (value) => {
  expect(() => validateReleaseManifest(value)).toThrow();
  expect(() => validateManifest(value)).toThrow();
});
