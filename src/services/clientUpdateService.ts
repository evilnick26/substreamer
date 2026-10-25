import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { CLIENT_UPDATE_URL } from '../config/clientUpdates';
import { validateReleaseManifest, type ReleaseManifest } from '../utils/releaseManifest';

export type UpdateFailure = 'unsupported' | 'build' | 'network' | 'timeout' | 'manifest';
export type UpdateResult =
  | { status: 'available' | 'current' | 'older'; installedVersionCode: number; manifest: ReleaseManifest }
  | { status: 'error'; reason: UpdateFailure };

export function parseInstalledVersionCode(value: string | null): number | null {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) return null;
  const code = Number(value);
  return Number.isSafeInteger(code) && code > 0 ? code : null;
}

export function compareRelease(manifest: ReleaseManifest, installedVersionCode: number): UpdateResult {
  const status = manifest.versionCode > installedVersionCode ? 'available'
    : manifest.versionCode === installedVersionCode ? 'current' : 'older';
  return { status, installedVersionCode, manifest };
}

interface Dependencies {
  fetchManifest: typeof fetch;
  installedBuild: () => string | null;
  isAndroid: () => boolean;
  timeoutMs: number;
}

export function createClientUpdateChecker({ fetchManifest, installedBuild, isAndroid, timeoutMs }: Dependencies) {
  let inFlight: Promise<UpdateResult> | null = null;
  let automatic: Promise<UpdateResult> | null = null;
  let automaticAttempts = 0;
  let automaticMayRetry = false;
  const retryDelays = [2000, 5000];
  const prompted = new Set<number>();

  async function perform(): Promise<UpdateResult> {
    if (!isAndroid()) return { status: 'error', reason: 'unsupported' };
    let installed: number | null;
    try {
      installed = parseInstalledVersionCode(installedBuild());
    } catch {
      installed = null;
    }
    if (installed === null) return { status: 'error', reason: 'build' };

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<UpdateResult>((resolve) => {
      timer = setTimeout(() => {
        resolve({ status: 'error', reason: 'timeout' });
        controller.abort();
      }, timeoutMs);
    });
    const request = async (): Promise<UpdateResult> => {
      try {
        const response = await fetchManifest(CLIENT_UPDATE_URL, {
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'error',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        });
        if (!response.ok) return { status: 'error', reason: 'network' };
        if (response.redirected || (response.url && response.url !== CLIENT_UPDATE_URL)) {
          return { status: 'error', reason: 'manifest' };
        }
        const text = await response.text();
        try {
          if (text.length > 32768) throw new Error('Manifest too large');
          return compareRelease(validateReleaseManifest(JSON.parse(text)), installed);
        } catch {
          return { status: 'error', reason: 'manifest' };
        }
      } catch {
        return { status: 'error', reason: 'network' };
      }
    };
    try {
      return await Promise.race([timeout, request()]);
    } finally {
      clearTimeout(timer);
    }
  }

  function check(): Promise<UpdateResult> {
    // Defer work until both guards are assigned, including synchronous fetch mocks.
    if (!inFlight) inFlight = Promise.resolve().then(perform).then((result) => {
      // A validated manual result settles pending automatic recovery too.
      if (automaticMayRetry && result.status !== 'error') {
        automaticMayRetry = false;
        automatic = Promise.resolve(result);
      }
      return result;
    }).finally(() => { inFlight = null; });
    return inFlight;
  }

  return {
    check,
    checkAutomatic(): Promise<UpdateResult> {
      if (!automatic || (automaticMayRetry && automaticAttempts <= retryDelays.length)) {
        automaticMayRetry = false;
        automaticAttempts++;
        automatic = Promise.resolve().then(check).then((result) => {
          automaticMayRetry = result.status === 'error' &&
            (result.reason === 'network' || result.reason === 'timeout');
          return result;
        });
      }
      return automatic;
    },
    getAutomaticRetryDelay(): number | null {
      return automaticMayRetry && automaticAttempts <= retryDelays.length
        ? retryDelays[automaticAttempts - 1] : null;
    },
    claimPrompt(versionCode: number): boolean {
      if (prompted.has(versionCode)) return false;
      prompted.add(versionCode);
      return true;
    },
  };
}

// Process lifetime, independent of navigation, remounts and foreground transitions.
export const clientUpdateChecker = createClientUpdateChecker({
  fetchManifest: (...args) => fetch(...args),
  installedBuild: () => Application.nativeBuildVersion,
  isAndroid: () => Platform.OS === 'android',
  timeoutMs: 10000,
});
