import { CLIENT_UPDATE_URL } from '../../config/clientUpdates';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { clientUpdateChecker, createClientUpdateChecker, parseInstalledVersionCode } from '../clientUpdateService';

jest.mock('expo-application', () => ({ nativeBuildVersion: '80000186' }));

const release = (code = 80000187) => ({
  schemaVersion: 1, versionCode: code, versionName: '0.2.0',
  apkUrl: `https://updates.sancti.fi/client/apks/sanctifi-${code}.apk`, sha256: 'a'.repeat(64),
});
const response = (text = JSON.stringify(release()), extra = {}) => ({
  ok: true, redirected: false, url: CLIENT_UPDATE_URL, text: async () => text, ...extra,
}) as Response;
function setup(build: string | null = '80000186') {
  const fetchManifest = jest.fn().mockResolvedValue(response());
  const installedBuild = jest.fn(() => build);
  const checker = createClientUpdateChecker({ fetchManifest, installedBuild, isAndroid: () => true, timeoutMs: 100 });
  return { checker, fetchManifest, installedBuild };
}

describe('installed Android build', () => {
  test.each([['80000186', 80000186], ['1', 1], ['9007199254740991', Number.MAX_SAFE_INTEGER]])('%s', (input, expected) => {
    expect(parseInstalledVersionCode(input)).toBe(expected);
  });
  test.each([null, '', '0', '-1', '8.1.8', '186x', ' 80000186', '80000186 ', '1e8', '1.5', '9007199254740992'])('rejects %s without a fallback', async (input) => {
    const { checker, fetchManifest } = setup(input);
    expect(parseInstalledVersionCode(input)).toBeNull();
    expect(await checker.check()).toEqual({ status: 'error', reason: 'build' });
    expect(fetchManifest).not.toHaveBeenCalled();
  });
});

describe('update checking', () => {
  afterEach(() => jest.useRealTimers());

  test.each([[80000187, 'available'], [80000186, 'current'], [80000185, 'older']])('compares full build %s', async (code, status) => {
    const { checker, fetchManifest } = setup();
    fetchManifest.mockResolvedValue(response(JSON.stringify(release(code as number))));
    expect(await checker.check()).toMatchObject({ status, installedVersionCode: 80000186 });
    expect(fetchManifest).toHaveBeenCalledWith(CLIENT_UPDATE_URL, expect.objectContaining({
      cache: 'no-store', redirect: 'error', signal: expect.anything(),
    }));
  });

  test.each(['{', 'null', '[]', '{}', JSON.stringify({ ...release(), schemaVersion: 2 }),
    JSON.stringify({ ...release(), sha256: 'wrong' }), JSON.stringify({ ...release(), apkUrl: 'https://example.org/a.apk' }),
    ' '.repeat(32769)])('rejects malformed response %s', async (text) => {
    const { checker, fetchManifest } = setup();
    fetchManifest.mockResolvedValue(response(text));
    expect(await checker.check()).toEqual({ status: 'error', reason: 'manifest' });
  });

  test('offline, HTTP failure and failed body reads are explicit and retryable', async () => {
    const { checker, fetchManifest } = setup();
    fetchManifest.mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(response('', { ok: false }))
      .mockResolvedValueOnce(response('', { text: () => Promise.reject(new Error('connection lost')) }));
    for (let i = 0; i < 3; i++) expect(await checker.check()).toEqual({ status: 'error', reason: 'network' });
    expect(await checker.check()).toMatchObject({ status: 'available' });
  });

  test.each([{ redirected: true }, { url: 'https://other.example/alpha.json' }])('rejects a redirected manifest', async (extra) => {
    const { checker, fetchManifest } = setup();
    fetchManifest.mockResolvedValue(response(undefined, extra));
    expect(await checker.check()).toEqual({ status: 'error', reason: 'manifest' });
  });

  test('timeout settles even when transport ignores abort; late result cannot change it', async () => {
    jest.useFakeTimers();
    const { checker, fetchManifest } = setup();
    let finish!: (value: Response) => void;
    fetchManifest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = checker.check();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: 'error', reason: 'timeout' });
    expect(fetchManifest.mock.calls[0][1].signal.aborted).toBe(true);
    finish(response());
    expect(await pending).toEqual({ status: 'error', reason: 'timeout' });
    expect(await checker.check()).toMatchObject({ status: 'available' });
  });

  test('automatic guard precedes network work and survives repeated startup calls', async () => {
    const { checker, fetchManifest } = setup();
    const first = checker.checkAutomatic();
    expect(fetchManifest).not.toHaveBeenCalled();
    expect(checker.checkAutomatic()).toBe(first);
    fetchManifest.mockImplementationOnce(() => {
      expect(checker.checkAutomatic()).toBe(first);
      return Promise.resolve(response());
    });
    await first;
    expect(checker.checkAutomatic()).toBe(first);
    await checker.checkAutomatic();
    expect(fetchManifest).toHaveBeenCalledTimes(1);
    await checker.check();
    expect(fetchManifest).toHaveBeenCalledTimes(2);
  });

  test.each([true, false])('concurrent checks share the in-flight request (automatic first=%s)', async (autoFirst) => {
    const { checker, fetchManifest } = setup();
    const first = autoFirst ? checker.checkAutomatic() : checker.check();
    const second = autoFirst ? checker.check() : checker.checkAutomatic();
    expect(await first).toBe(await second);
    expect(fetchManifest).toHaveBeenCalledTimes(1);
  });

  test('automatic retries have a process-wide bound and manual retry remains allowed', async () => {
    const { checker, fetchManifest } = setup();
    fetchManifest.mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    for (const delay of [2000, 5000, null]) {
      expect(await checker.checkAutomatic()).toMatchObject({ status: 'error' });
      expect(checker.getAutomaticRetryDelay()).toBe(delay);
    }
    for (let i = 0; i < 5; i++) expect(await checker.checkAutomatic()).toMatchObject({ status: 'error' });
    expect(fetchManifest).toHaveBeenCalledTimes(3);
    expect(await checker.check()).toMatchObject({ status: 'available' });
    expect(fetchManifest).toHaveBeenCalledTimes(4);
  });

  test('prompt identities are deduplicated within this process only', () => {
    const { checker } = setup();
    expect(checker.claimPrompt(80000187)).toBe(true);
    expect(checker.claimPrompt(80000187)).toBe(false);
    expect(checker.claimPrompt(80000188)).toBe(true);
    expect(setup().checker.claimPrompt(80000187)).toBe(true);
  });

  test('native read failure does not initiate a request', async () => {
    const { checker, installedBuild, fetchManifest } = setup();
    installedBuild.mockImplementation(() => { throw new Error('unavailable'); });
    expect(await checker.check()).toEqual({ status: 'error', reason: 'build' });
    expect(fetchManifest).not.toHaveBeenCalled();
  });

  test('other platforms do not compare Android builds', async () => {
    const fetchManifest = jest.fn();
    const checker = createClientUpdateChecker({ fetchManifest, installedBuild: () => '80000186', isAndroid: () => false, timeoutMs: 100 });
    expect(await checker.check()).toEqual({ status: 'error', reason: 'unsupported' });
    expect(fetchManifest).not.toHaveBeenCalled();
  });
});

test('the production singleton uses the native installed build, not a display or abbreviated version', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const nativeBuild = jest.replaceProperty(Application, 'nativeBuildVersion', '80000186');
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue(response(JSON.stringify(release(80000186))));
  try {
    expect(await clientUpdateChecker.check()).toMatchObject({ status: 'current', installedVersionCode: 80000186 });
    nativeBuild.replaceValue(null);
    expect(await clientUpdateChecker.check()).toEqual({ status: 'error', reason: 'build' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = originalFetch;
    nativeBuild.restore();
    platform.restore();
  }
});

test.each(['offline', 'HTTP failure'])('a first automatic %s can recover within the same process', async (failure) => {
  const { checker, fetchManifest } = setup();
  if (failure === 'offline') fetchManifest.mockRejectedValueOnce(new TypeError('startup network unavailable'));
  else fetchManifest.mockResolvedValueOnce(response('', { ok: false }));
  expect(await checker.checkAutomatic()).toEqual({ status: 'error', reason: 'network' });
  expect(await checker.checkAutomatic()).toMatchObject({ status: 'available' });
  expect(fetchManifest).toHaveBeenCalledTimes(2);
});

test('concurrent automatic recovery and manual calls still share one request', async () => {
  const { checker, fetchManifest } = setup();
  fetchManifest.mockRejectedValueOnce(new Error('offline'));
  await checker.checkAutomatic();
  const retry = checker.checkAutomatic();
  expect(checker.checkAutomatic()).toBe(retry);
  const manual = checker.check();
  expect(await retry).toBe(await manual);
  expect(fetchManifest).toHaveBeenCalledTimes(2);
  expect(checker.getAutomaticRetryDelay()).toBeNull();
  expect(await checker.checkAutomatic()).toMatchObject({ status: 'available' });
  expect(fetchManifest).toHaveBeenCalledTimes(2);
});

test('automatic timeout is retryable and a later success stops retrying', async () => {
  jest.useFakeTimers();
  try {
    const { checker, fetchManifest } = setup();
    fetchManifest.mockImplementationOnce(() => new Promise(() => {}));
    const first = checker.checkAutomatic();
    await jest.advanceTimersByTimeAsync(100);
    expect(await first).toEqual({ status: 'error', reason: 'timeout' });
    expect(checker.getAutomaticRetryDelay()).toBe(2000);
    expect(await checker.checkAutomatic()).toMatchObject({ status: 'available' });
    expect(checker.getAutomaticRetryDelay()).toBeNull();
    expect(fetchManifest).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

test.each(['manifest', 'build', 'unsupported'])('non-transient %s failure is not retried automatically', async (reason) => {
  const fetchManifest = jest.fn().mockResolvedValue(response('{'));
  const checker = createClientUpdateChecker({ fetchManifest, installedBuild: () => reason === 'build' ? null : '80000186', isAndroid: () => reason !== 'unsupported', timeoutMs: 100 });
  for (let i = 0; i < 5; i++) expect(await checker.checkAutomatic()).toEqual({ status: 'error', reason });
  expect(checker.getAutomaticRetryDelay()).toBeNull();
  expect(fetchManifest).toHaveBeenCalledTimes(reason === 'manifest' ? 1 : 0);
});

test('a genuinely new checker/process gets a fresh automatic budget', async () => {
  const first = setup();
  first.fetchManifest.mockRejectedValue(new Error('offline'));
  for (let i = 0; i < 5; i++) await first.checker.checkAutomatic();
  expect(first.fetchManifest).toHaveBeenCalledTimes(3);
  const fresh = setup();
  expect(await fresh.checker.checkAutomatic()).toMatchObject({ status: 'available' });
  expect(fresh.fetchManifest).toHaveBeenCalledTimes(1);
});
