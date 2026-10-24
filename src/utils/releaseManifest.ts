import { RELEASE_BASE_URL } from '../config/clientUpdates';

export interface ReleaseManifest {
  schemaVersion: 1;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  releaseNotes?: string;
}

/** Keep the public contract aligned with scripts/android-release.js. */
export function validateReleaseManifest(value: unknown): ReleaseManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Manifest must be an object');
  }
  const manifest = value as Record<string, unknown>;
  const required = ['schemaVersion', 'versionCode', 'versionName', 'apkUrl', 'sha256'];
  if (
    !required.every((key) => Object.prototype.hasOwnProperty.call(manifest, key)) ||
    !Object.keys(manifest).every((key) => [...required, 'releaseNotes'].includes(key)) ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.versionCode !== 'number' ||
    !Number.isInteger(manifest.versionCode) || manifest.versionCode <= 0 || manifest.versionCode > 2100000000 ||
    typeof manifest.versionName !== 'string' || !manifest.versionName.length ||
    manifest.versionName.length > 128 || manifest.versionName.trim() !== manifest.versionName ||
    manifest.apkUrl !== `${RELEASE_BASE_URL}apks/sanctifi-${manifest.versionCode}.apk` ||
    typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    (Object.prototype.hasOwnProperty.call(manifest, 'releaseNotes') &&
      (typeof manifest.releaseNotes !== 'string' || manifest.releaseNotes.length > 4000))
  ) {
    throw new Error('Invalid release manifest');
  }
  return manifest as unknown as ReleaseManifest;
}
